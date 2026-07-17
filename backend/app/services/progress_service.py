"""
Progress aggregation service.

Builds the dashboard snapshot for /api/progress/overview — composes data
from users, challenges, completions, and achievements into a single response.

Multiple queries here, but the dashboard is a heavy endpoint by nature.
Worth optimising later if latency becomes an issue.
"""

from datetime import date

from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Achievement, Challenge, ChallengeCompletion, User, UserAchievement
from app.services.xp import level_progress


# Display labels for domains. If we add a third domain, update here AND in
# the recommender's DOMAIN_PRIORITY.
DOMAIN_LABELS = {
    "social": "Social",
    "dating": "Dating",
}


# --- Pydantic response shapes ---

class DomainSummary(BaseModel):
    domain: str
    label: str
    total_completions: int
    unique_challenges_completed: int
    total_challenges: int
    avg_suds_reduction: float | None  # None when no before+after data yet


class RecentCompletion(BaseModel):
    completion_id: str
    challenge_id: str
    challenge_name: str
    domain: str
    tier: int
    completed_at: str
    xp_earned: int
    anxiety_before: int | None
    anxiety_after: int | None
    streak_day: int
    # 'completed' | 'abandoned'. Abandoned attempts ARE shown in history
    # (deliberate: avoidance patterns should be visible, not hidden) but the
    # frontend renders them muted, with no XP badge.
    status: str


class UnlockedAchievement(BaseModel):
    id: str
    code: str
    name: str
    description: str | None
    icon: str | None
    xp_bonus: int
    unlocked_at: str


class DashboardOverview(BaseModel):
    # Identity
    user_id: str
    display_name: str | None

    # XP / level
    total_xp: int
    current_level: int
    xp_in_level: int
    xp_needed_for_level: int
    xp_to_next_level: int

    # Streak
    current_streak: int
    longest_streak: int
    is_streak_active: bool  # true if last completion was today or yesterday
    last_completion_date: str | None

    # Completions
    total_completions: int
    domain_breakdown: list[DomainSummary]
    recent_completions: list[RecentCompletion]

    # Achievements
    unlocked: list[UnlockedAchievement]
    unlocked_count: int
    total_achievements: int


# --- Service function ---

async def build_overview(
    user: User,
    session: AsyncSession,
    *,
    today: date | None = None,
) -> DashboardOverview:
    """Assemble the full dashboard snapshot in ~6 queries."""
    today = today or date.today()

    # XP / level (pure function)
    lp = level_progress(user.total_xp)

    # Streak "active" heuristic: today or yesterday counts. Anything older
    # means the user has broken the streak (the DB still holds current_streak
    # until they complete again and it resets).
    if user.last_completion_date is None:
        is_active = False
    else:
        is_active = (today - user.last_completion_date).days <= 1

    # Total completions (successes only — abandons never count as progress)
    total_completions = (await session.execute(
        select(func.count(ChallengeCompletion.id))
        .where(
            ChallengeCompletion.user_id == user.id,
            ChallengeCompletion.status == ChallengeCompletion.STATUS_COMPLETED,
        )
    )).scalar() or 0

    # Per-domain breakdown
    domain_breakdown: list[DomainSummary] = []
    for domain_key, label in DOMAIN_LABELS.items():
        total_in_domain = (await session.execute(
            select(func.count(Challenge.id))
            .where(Challenge.domain == domain_key)
        )).scalar() or 0

        completions_in_domain = (await session.execute(
            select(func.count(ChallengeCompletion.id))
            .join(Challenge, Challenge.id == ChallengeCompletion.challenge_id)
            .where(
                ChallengeCompletion.user_id == user.id,
                ChallengeCompletion.status == ChallengeCompletion.STATUS_COMPLETED,
                Challenge.domain == domain_key,
            )
        )).scalar() or 0

        unique_completed = (await session.execute(
            select(func.count(func.distinct(ChallengeCompletion.challenge_id)))
            .join(Challenge, Challenge.id == ChallengeCompletion.challenge_id)
            .where(
                ChallengeCompletion.user_id == user.id,
                ChallengeCompletion.status == ChallengeCompletion.STATUS_COMPLETED,
                Challenge.domain == domain_key,
            )
        )).scalar() or 0

        # Average SUDS reduction where both before and after were recorded
        reduction_rows = (await session.execute(
            select(
                ChallengeCompletion.anxiety_before,
                ChallengeCompletion.anxiety_after,
            )
            .join(Challenge, Challenge.id == ChallengeCompletion.challenge_id)
            .where(
                ChallengeCompletion.user_id == user.id,
                ChallengeCompletion.status == ChallengeCompletion.STATUS_COMPLETED,
                Challenge.domain == domain_key,
                ChallengeCompletion.anxiety_before.is_not(None),
                ChallengeCompletion.anxiety_after.is_not(None),
            )
        )).all()

        if reduction_rows:
            reductions = [before - after for before, after in reduction_rows]
            avg_reduction = round(sum(reductions) / len(reductions), 1)
        else:
            avg_reduction = None

        domain_breakdown.append(DomainSummary(
            domain=domain_key,
            label=label,
            total_completions=completions_in_domain,
            unique_challenges_completed=unique_completed,
            total_challenges=total_in_domain,
            avg_suds_reduction=avg_reduction,
        ))

    # Last 10 attempts (completed AND abandoned), newest first.
    # No status filter here — history shows the honest record.
    recent_rows = (await session.execute(
        select(ChallengeCompletion, Challenge)
        .join(Challenge, Challenge.id == ChallengeCompletion.challenge_id)
        .where(ChallengeCompletion.user_id == user.id)
        .order_by(ChallengeCompletion.completed_at.desc())
        .limit(10)
    )).all()

    recent_completions = [
        RecentCompletion(
            completion_id=comp.id,
            challenge_id=challenge.id,
            challenge_name=challenge.name,
            domain=challenge.domain,
            tier=challenge.tier,
            completed_at=comp.completed_at.isoformat(),
            xp_earned=comp.xp_earned,
            anxiety_before=comp.anxiety_before,
            anxiety_after=comp.anxiety_after,
            streak_day=comp.streak_day,
            status=comp.status,
        )
        for comp, challenge in recent_rows
    ]

    # Unlocked achievements, newest unlock first
    unlock_rows = (await session.execute(
        select(UserAchievement, Achievement)
        .join(Achievement, Achievement.id == UserAchievement.achievement_id)
        .where(UserAchievement.user_id == user.id)
        .order_by(UserAchievement.unlocked_at.desc())
    )).all()

    unlocked = [
        UnlockedAchievement(
            id=ach.id,
            code=ach.code,
            name=ach.name,
            description=ach.description,
            icon=ach.icon,
            xp_bonus=ach.xp_bonus,
            unlocked_at=ua.unlocked_at.isoformat(),
        )
        for ua, ach in unlock_rows
    ]

    total_achievements = (await session.execute(
        select(func.count(Achievement.id))
    )).scalar() or 0

    return DashboardOverview(
        user_id=user.id,
        display_name=user.display_name,
        total_xp=user.total_xp,
        current_level=lp["current_level"],
        xp_in_level=lp["xp_in_level"],
        xp_needed_for_level=lp["xp_needed_for_level"],
        xp_to_next_level=lp["xp_to_next_level"],
        current_streak=user.current_streak,
        longest_streak=user.longest_streak,
        is_streak_active=is_active,
        last_completion_date=user.last_completion_date.isoformat() if user.last_completion_date else None,
        total_completions=total_completions,
        domain_breakdown=domain_breakdown,
        recent_completions=recent_completions,
        unlocked=unlocked,
        unlocked_count=len(unlocked),
        total_achievements=total_achievements,
    )