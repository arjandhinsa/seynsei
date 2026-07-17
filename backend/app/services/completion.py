"""
Completion orchestrator.

Wires together xp + streak + achievements into a single transactional write.
The route layer does just two things: look up the challenge and call this.

Flow:
1. Compute streak update from current user state + today's date
2. Compute xp_earned using the challenge's base XP and the streak day
3. Create the ChallengeCompletion row with xp_earned and streak_day
4. Update user: total_xp, current_streak, longest_streak, last_completion_date
5. Flush so achievement stats queries see the new completion row
6. Run achievement checks, stage UserAchievement rows, sum xp_bonus
7. Add bonus XP to user.total_xp (AFTER checks — no retroactive unlocks)
8. Commit once. Atomic: all or nothing.

Returns a CompletionResult rich enough for the route to build the response
without further queries.
"""

from dataclasses import dataclass, field
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Achievement, Challenge, ChallengeCompletion, User
from app.services.achievements import check_and_unlock
from app.services.streak import compute_streak_update
from app.services.xp import level_for_xp, xp_for_completion


@dataclass
class CompletionResult:
    completion: ChallengeCompletion

    # XP breakdown — three numbers so the frontend can show them separately
    # "+5 XP" from the completion, "+10 bonus XP" from unlocks, total after.
    xp_earned: int
    bonus_xp_from_achievements: int
    total_xp_after: int

    # Level state — for the level-up animation decision
    level_before: int
    level_after: int
    leveled_up: bool

    # Streak state
    streak_day: int
    streak_after: int
    is_new_personal_best_streak: bool

    # Achievements unlocked THIS completion
    newly_unlocked: list[Achievement] = field(default_factory=list)


async def record_completion(
    *,
    user: User,
    challenge: Challenge,
    anxiety_before: int | None,
    anxiety_after: int | None,
    notes: str | None,
    session: AsyncSession,
    today: date | None = None,
) -> CompletionResult:
    """Atomically record a completion, update gamified user state, and detect
    any newly-unlocked achievements.

    All writes happen in one transaction. Commits on success. Caller catches
    exceptions for rollback.
    """
    today = today or date.today()
    level_before = level_for_xp(user.total_xp)

    # 1. Streak update — pure function, no DB access
    streak_update = compute_streak_update(
        current_streak=user.current_streak,
        longest_streak=user.longest_streak,
        last_completion_date=user.last_completion_date,
        today=today,
    )

    # 2. XP earned — base from challenge, multiplier from streak day
    xp_earned = xp_for_completion(challenge.xp_value, streak_update.streak_day)

    # 3. Create the completion row
    completion = ChallengeCompletion(
        user_id=user.id,
        challenge_id=challenge.id,
        anxiety_before=anxiety_before,
        anxiety_after=anxiety_after,
        notes=notes,
        xp_earned=xp_earned,
        streak_day=streak_update.streak_day,
    )
    session.add(completion)

    # 4. Update user state. Achievement checks will query this state shortly.
    user.total_xp += xp_earned
    user.current_streak = streak_update.current_streak
    if streak_update.is_new_personal_best:
        user.longest_streak = streak_update.current_streak
    user.last_completion_date = today

    # 5. Flush so build_user_stats in check_and_unlock sees the new row
    await session.flush()

    # 6. Achievement checks return newly-unlocked Achievement objects
    #    (UserAchievement rows are staged in the session)
    newly_unlocked = await check_and_unlock(user, session)

    # 7. Apply bonus XP AFTER achievement checks — this ordering is the
    #    no-cascade invariant. An xp_bonus that would cross a new milestone
    #    unlocks on the NEXT completion, not this one.
    bonus_xp = sum(a.xp_bonus for a in newly_unlocked)
    user.total_xp += bonus_xp

    # 8. Commit. Everything or nothing.
    await session.commit()
    await session.refresh(completion)

    level_after = level_for_xp(user.total_xp)

    return CompletionResult(
        completion=completion,
        xp_earned=xp_earned,
        bonus_xp_from_achievements=bonus_xp,
        total_xp_after=user.total_xp,
        level_before=level_before,
        level_after=level_after,
        leveled_up=level_after > level_before,
        streak_day=streak_update.streak_day,
        streak_after=streak_update.current_streak,
        is_new_personal_best_streak=streak_update.is_new_personal_best,
        newly_unlocked=newly_unlocked,
    )


async def record_abandon(
    *,
    user: User,
    challenge: Challenge,
    anxiety_before: int | None,
    notes: str | None,
    session: AsyncSession,
) -> ChallengeCompletion:
    """Record an abandoned attempt.

    Deliberately NOT routed through record_completion: an abandon touches
    none of the gamified state (no XP, no streak, no achievements, no
    user-row updates), so it gets its own minimal write path instead of
    an if-branch through the eight-step completion orchestration.

    The row still carries anxiety_before — an abandon with a high pre-rating
    is the strongest step-down signal the progression rules have.
    anxiety_after is intentionally not collected: the user has just backed
    out of an exposure; demanding a second rating at that moment is both
    poor UX and clinically tone-deaf.
    """
    attempt = ChallengeCompletion(
        user_id=user.id,
        challenge_id=challenge.id,
        anxiety_before=anxiety_before,
        anxiety_after=None,
        notes=notes,
        xp_earned=0,
        streak_day=0,
        status=ChallengeCompletion.STATUS_ABANDONED,
    )
    session.add(attempt)
    await session.commit()
    await session.refresh(attempt)
    return attempt