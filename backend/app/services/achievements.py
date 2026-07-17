"""
Achievements service.

After a completion is recorded and user state is updated, call check_and_unlock()
to detect achievements whose conditions are newly met. Each unlock:
- Creates a UserAchievement row (added to the session — caller commits)
- Is returned as an Achievement object so the caller can sum xp_bonus and
  surface the unlock in the response

Design:
- Single pass, no recursive cascade. If an xp_bonus pushes total_xp across
  a new milestone, that milestone unlocks on the NEXT completion. Locked in
  with Arjan so behaviour stays predictable.
- User stats built in four queries at the top, then dispatch on condition_type.
- Unknown condition_type returns False (log-and-skip) rather than crashing —
  a typo in seed data shouldn't take down completions.
"""

from dataclasses import dataclass, field

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Achievement, Challenge, ChallengeCompletion, User, UserAchievement


# The two domains we seed. Used so domain_balance checks against both
# even if the user has zero completions in one of them.
KNOWN_DOMAINS = ("social", "dating")


@dataclass
class UserStats:
    """Snapshot of the stats achievements evaluate against — built from DB once per check."""
    total_completions: int
    max_tier_reached: int
    total_xp: int
    current_streak: int
    completions_per_challenge: dict[str, int] = field(default_factory=dict)
    completions_per_domain: dict[str, int] = field(default_factory=dict)


async def build_user_stats(user: User, session: AsyncSession) -> UserStats:
    """Aggregate everything the achievement checks need — four queries."""
    # 1. Total completions (across all challenges)
    total = (await session.execute(
        select(func.count(ChallengeCompletion.id))
        .where(
            ChallengeCompletion.user_id == user.id,
            ChallengeCompletion.status == ChallengeCompletion.STATUS_COMPLETED,
        )
    )).scalar() or 0

    # 2. Highest tier the user has ever completed
    max_tier = (await session.execute(
        select(func.max(Challenge.tier))
        .join(ChallengeCompletion, Challenge.id == ChallengeCompletion.challenge_id)
        .where(
            ChallengeCompletion.user_id == user.id,
            ChallengeCompletion.status == ChallengeCompletion.STATUS_COMPLETED,
        )
    )).scalar() or 0

    # 3. Completions per challenge_id — for challenge_repeat_count
    rows = (await session.execute(
        select(ChallengeCompletion.challenge_id, func.count(ChallengeCompletion.id))
        .where(
            ChallengeCompletion.user_id == user.id,
            ChallengeCompletion.status == ChallengeCompletion.STATUS_COMPLETED,
        )
        .group_by(ChallengeCompletion.challenge_id)
    )).all()
    per_challenge = {challenge_id: count for challenge_id, count in rows}

    # 4. Completions per domain — for domain_balance. Start with zeros for
    # every known domain so un-touched domains correctly fail a balance check.
    per_domain = {d: 0 for d in KNOWN_DOMAINS}
    rows = (await session.execute(
        select(Challenge.domain, func.count(ChallengeCompletion.id))
        .join(ChallengeCompletion, Challenge.id == ChallengeCompletion.challenge_id)
        .where(
            ChallengeCompletion.user_id == user.id,
            ChallengeCompletion.status == ChallengeCompletion.STATUS_COMPLETED,
        )
        .group_by(Challenge.domain)
    )).all()
    for domain, count in rows:
        per_domain[domain] = count

    return UserStats(
        total_completions=total,
        max_tier_reached=max_tier,
        total_xp=user.total_xp,
        current_streak=user.current_streak,
        completions_per_challenge=per_challenge,
        completions_per_domain=per_domain,
    )


def meets_condition(achievement: Achievement, stats: UserStats) -> bool:
    """Dispatch on condition_type. Returns False for unknown types."""
    t = achievement.condition_type
    v = achievement.condition_value

    if t == "total_completions":
        return stats.total_completions >= v
    if t == "tier_reached":
        return stats.max_tier_reached >= v
    if t == "streak_days":
        return stats.current_streak >= v
    if t == "xp_milestone":
        return stats.total_xp >= v
    if t == "challenge_repeat_count":
        return any(count >= v for count in stats.completions_per_challenge.values())
    if t == "domain_balance":
        # ALL known domains must meet the threshold
        return all(stats.completions_per_domain.get(d, 0) >= v for d in KNOWN_DOMAINS)

    # Unknown condition_type — soft-fail so a typo in seed doesn't break completions
    return False


async def check_and_unlock(user: User, session: AsyncSession) -> list[Achievement]:
    """Evaluate all achievements against user's current state; create UserAchievement
    rows for newly-met ones.

    Returns the list of Achievement objects that were just unlocked, so the
    caller can sum xp_bonus and surface them in the completion response.

    Rows are ADDED to the session but NOT committed — caller commits.
    """
    all_achievements = (await session.execute(select(Achievement))).scalars().all()

    existing = (await session.execute(
        select(UserAchievement.achievement_id)
        .where(UserAchievement.user_id == user.id)
    )).scalars().all()
    unlocked_ids = set(existing)

    stats = await build_user_stats(user, session)

    newly_unlocked: list[Achievement] = []
    for achievement in all_achievements:
        if achievement.id in unlocked_ids:
            continue
        if meets_condition(achievement, stats):
            session.add(UserAchievement(
                user_id=user.id,
                achievement_id=achievement.id,
            ))
            newly_unlocked.append(achievement)

    return newly_unlocked