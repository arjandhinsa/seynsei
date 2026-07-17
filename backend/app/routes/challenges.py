from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field

from app.database import get_db
from app.models import Challenge, ChallengeCompletion, User
from app.middleware.auth import get_current_user, get_current_user_optional
from app.services.completion import record_abandon, record_completion


router = APIRouter()


# --- Schemas ---

class ChallengeResponse(BaseModel):
    id: str
    domain: str
    tier: int
    name: str
    description: str
    tip: str | None
    rationale: str | None
    xp_value: int
    safety_behaviour_targeted: str | None
    cognitive_distortion_challenged: str | None


#changed to 1-10 anxiety scale
class CompletionRequest(BaseModel):
    anxiety_before: int | None = Field(None, ge=1, le=10)
    anxiety_after: int | None = Field(None, ge=1, le=10)
    notes: str | None = None


class CompletionResponse(BaseModel):
    """A historical attempt (completed or abandoned) — returned by GET /completions."""
    id: str
    challenge_id: str
    completed_at: str
    anxiety_before: int | None
    anxiety_after: int | None
    notes: str | None
    xp_earned: int
    streak_day: int
    status: str  # 'completed' | 'abandoned'


class AbandonRequest(BaseModel):
    """Body for POST /{challenge_id}/abandon. Only the pre-rating: we never
    ask for an 'after' rating from someone who just backed out."""
    anxiety_before: int | None = Field(None, ge=1, le=10)
    notes: str | None = None


class AchievementInfo(BaseModel):
    """Summary of an achievement, nested inside completion results."""
    id: str
    code: str
    name: str
    description: str | None
    icon: str | None
    xp_bonus: int


class CompletionResultResponse(BaseModel):
    """Rich response for POST /{challenge_id}/complete.

    Includes everything the frontend needs to render the post-completion screen:
    XP animation, level-up detection, streak state, achievements unlocked.
    """
    completion: CompletionResponse
    # XP breakdown — three numbers so the UI can show them as separate popups
    xp_earned: int
    bonus_xp_from_achievements: int
    total_xp_after: int
    # Level state
    level_before: int
    level_after: int
    leveled_up: bool
    # Streak state
    streak_day: int
    streak_after: int
    is_new_personal_best_streak: bool
    # Achievements unlocked on THIS completion
    newly_unlocked: list[AchievementInfo]


# --- Endpoints ---

@router.get("/", response_model=list[ChallengeResponse])
async def list_challenges(
    domain: Literal["social", "dating"] | None = Query(None, description="Filter by domain"),
    tier: int | None = Query(None, ge=1, le=5, description="Filter by tier 1–5"),
    db: AsyncSession = Depends(get_db),
    user_id: str | None = Depends(get_current_user_optional),
):
    """List all challenges, optionally filtered by domain and/or tier.
    Ordered by domain → tier → sort_order for a stable display sequence.

    Public: works without auth so guests can browse the catalogue. The
    response carries no user-specific data (no completion counts or
    is_completed flags), so an anonymous caller sees the full catalogue
    exactly as a logged-in one does. user_id is accepted for future
    per-user enrichment but is currently unused here.
    """
    query = select(Challenge).order_by(Challenge.domain, Challenge.tier, Challenge.sort_order)

    if domain:
        query = query.where(Challenge.domain == domain)
    if tier:
        query = query.where(Challenge.tier == tier)

    result = await db.execute(query)
    challenges = result.scalars().all()

    return [
        ChallengeResponse(
            id=c.id,
            domain=c.domain,
            tier=c.tier,
            name=c.name,
            description=c.description,
            tip=c.tip,
            rationale=c.rationale,
            xp_value=c.xp_value,
            safety_behaviour_targeted=c.safety_behaviour_targeted,
            cognitive_distortion_challenged=c.cognitive_distortion_challenged,
        )
        for c in challenges
    ]


@router.get("/completions", response_model=list[CompletionResponse])
async def get_completions(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """All completions for the current user, newest first."""
    result = await db.execute(
        select(ChallengeCompletion)
        .where(ChallengeCompletion.user_id == user_id)
        .order_by(ChallengeCompletion.completed_at.desc())
    )
    completions = result.scalars().all()

    return [
        CompletionResponse(
            id=c.id,
            challenge_id=c.challenge_id,
            completed_at=c.completed_at.isoformat(),
            anxiety_before=c.anxiety_before,
            anxiety_after=c.anxiety_after,
            notes=c.notes,
            xp_earned=c.xp_earned,
            streak_day=c.streak_day,
            status=c.status,
        )
        for c in completions
    ]


@router.post(
    "/{challenge_id}/abandon",
    response_model=CompletionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def abandon_challenge(
    challenge_id: str,
    body: AbandonRequest = AbandonRequest(),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record an abandoned attempt. No XP, no streak, no achievements —
    just the honest data point. The frontend confirms before calling this
    (deliberate friction: an abandon should be a decision, not an accident).
    """
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    challenge = await db.get(Challenge, challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    attempt = await record_abandon(
        user=user,
        challenge=challenge,
        anxiety_before=body.anxiety_before,
        notes=body.notes,
        session=db,
    )

    return CompletionResponse(
        id=attempt.id,
        challenge_id=attempt.challenge_id,
        completed_at=attempt.completed_at.isoformat(),
        anxiety_before=attempt.anxiety_before,
        anxiety_after=attempt.anxiety_after,
        notes=attempt.notes,
        xp_earned=attempt.xp_earned,
        streak_day=attempt.streak_day,
        status=attempt.status,
    )


@router.post(
    "/{challenge_id}/complete",
    response_model=CompletionResultResponse,
    status_code=status.HTTP_201_CREATED,
)
async def complete_challenge(
    challenge_id: str,
    body: CompletionRequest = CompletionRequest(),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a challenge completion. Repeatable — no unique constraint.

    Delegates to the completion orchestrator, which handles XP calculation
    (with streak multiplier), streak tracking, achievement checks, and
    bonus-XP application in a single transaction.
    """
    # Load user (get_current_user only gives us the ID from the JWT)
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Load challenge — 404 if it doesn't exist (expired link, deleted, etc.)
    challenge = await db.get(Challenge, challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    result = await record_completion(
        user=user,
        challenge=challenge,
        anxiety_before=body.anxiety_before,
        anxiety_after=body.anxiety_after,
        notes=body.notes,
        session=db,
    )

    return CompletionResultResponse(
        completion=CompletionResponse(
            id=result.completion.id,
            challenge_id=result.completion.challenge_id,
            completed_at=result.completion.completed_at.isoformat(),
            anxiety_before=result.completion.anxiety_before,
            anxiety_after=result.completion.anxiety_after,
            notes=result.completion.notes,
            xp_earned=result.completion.xp_earned,
            streak_day=result.completion.streak_day,
            status=result.completion.status,
        ),
        xp_earned=result.xp_earned,
        bonus_xp_from_achievements=result.bonus_xp_from_achievements,
        total_xp_after=result.total_xp_after,
        level_before=result.level_before,
        level_after=result.level_after,
        leveled_up=result.leveled_up,
        streak_day=result.streak_day,
        streak_after=result.streak_after,
        is_new_personal_best_streak=result.is_new_personal_best_streak,
        newly_unlocked=[
            AchievementInfo(
                id=a.id,
                code=a.code,
                name=a.name,
                description=a.description,
                icon=a.icon,
                xp_bonus=a.xp_bonus,
            )
            for a in result.newly_unlocked
        ],
    )