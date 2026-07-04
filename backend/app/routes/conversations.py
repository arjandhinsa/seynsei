import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.config import settings
from app.database import get_db
from app.models import (
    Achievement,
    Challenge,
    ChallengeCompletion,
    Conversation,
    Message,
    User,
    UserAchievement,
)
from app.middleware.auth import get_current_user
from app.services.coach import get_coach_response
from app.services.xp import level_for_xp


router = APIRouter()


# Display info for the coach's system prompt. Two domains now.
DOMAIN_INFO = {
    "social": {
        "label": "Social",
        "description": "Daily interactions, friendships, group settings, public-speaking confidence",
    },
    "dating": {
        "label": "Dating",
        "description": "Romantic confidence, vulnerability, and rejection tolerance",
    },
}


# --- Schemas ---

class StartConversationRequest(BaseModel):
    """All fields optional — different combinations open different framings.

    - challenge_id only → coach opens with prep guidance for that challenge
    - completion_id only → coach opens with reflection on that completion
    - first_message only → user opens; coach replies. Generic chat.
    - challenge_id + first_message → user opens with that challenge in scope
    - none → 400 (we need at least one anchor)
    """
    challenge_id: str | None = None
    completion_id: str | None = None
    first_message: str | None = None


class SendMessageRequest(BaseModel):
    content: str


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: str


class ConversationDetailResponse(BaseModel):
    id: str
    challenge_id: str | None
    started_at: str
    messages: list[MessageResponse]


class RecentConversationResponse(BaseModel):
    conversation_id: str | None


class SenseiQuotaResponse(BaseModel):
    """Free-tier state for the chat UI. Premium users get limit = None."""
    is_premium: bool
    limit: int | None
    used_today: int
    remaining: int | None


# --- Helpers ---


async def _sensei_replies_today(user_id: str, db: AsyncSession) -> int:
    """Count coach replies generated for this user since UTC midnight.

    Each OpenAI call produces exactly one assistant message, so counting
    assistant messages is counting cost.
    """
    day_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    result = await db.execute(
        select(func.count(Message.id))
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            Conversation.user_id == user_id,
            Message.role == "assistant",
            Message.created_at >= day_start,
        )
    )
    return result.scalar() or 0


async def _enforce_sensei_quota(user_id: str, db: AsyncSession) -> None:
    """Raise 429 when a free user has used today's Sensei replies."""
    user = await db.get(User, user_id)
    if user and user.is_premium:
        return
    used = await _sensei_replies_today(user_id, db)
    if used >= settings.FREE_DAILY_SENSEI_MESSAGES:
        raise HTTPException(
            status_code=429,
            detail=(
                "You've used today's free Sensei messages. They refresh "
                "tomorrow. Until then, the challenges are all yours."
            ),
        )


def _challenge_to_dict(challenge: Challenge) -> dict:
    return {
        "name": challenge.name,
        "description": challenge.description,
        "tip": challenge.tip,
        "rationale": challenge.rationale,
        "tier": challenge.tier,
    }


def _msg_to_response(msg: Message) -> MessageResponse:
    return MessageResponse(
        id=msg.id,
        role=msg.role,
        content=msg.content,
        created_at=msg.created_at.isoformat(),
    )


def _build_reflection_opener(rc: dict) -> str:
    """Synthetic opener so the coach knows we're in reflection mode.
    Not stored in the DB — only sent to the model alongside the reflection
    section in the system prompt. The first stored message is the coach's reply."""
    name = rc.get("challenge_name") or "the challenge"
    before = rc.get("anxiety_before")
    after = rc.get("anxiety_after")
    if before is not None and after is not None:
        return (
            f'I just completed "{name}". My anxiety was {before}/10 going in and '
            f"{after}/10 afterwards. I'd like to reflect on how it went."
        )
    return f'I just completed "{name}". I\'d like to reflect on how it went.'


def _build_prep_opener(challenge_name: str) -> str:
    return (
        f'I\'ve chosen to work on this challenge: "{challenge_name}". '
        "Can you help me prepare for it?"
    )


async def _build_user_context(user_id: str, db: AsyncSession) -> dict | None:
    user = await db.get(User, user_id)
    if not user:
        return None

    recent_unlock = (await db.execute(
        select(Achievement.name)
        .join(UserAchievement, UserAchievement.achievement_id == Achievement.id)
        .where(UserAchievement.user_id == user_id)
        .order_by(UserAchievement.unlocked_at.desc())
        .limit(1)
    )).scalar_one_or_none()

    return {
        "current_level": level_for_xp(user.total_xp),
        "current_streak": user.current_streak,
        "longest_streak": user.longest_streak,
        "recent_unlock": recent_unlock,
    }


async def _build_profile_context(user_id: str, db: AsyncSession) -> dict | None:
    """Personalization profile for the coach. Returns None when the user has
    supplied nothing, so the prompt stays unchanged for un-onboarded users."""
    user = await db.get(User, user_id)
    if not user:
        return None

    triggers: list[str] = []
    if user.top_triggers:
        try:
            decoded = json.loads(user.top_triggers)
            if isinstance(decoded, list):
                triggers = [t for t in decoded if isinstance(t, str)]
        except (ValueError, TypeError):
            triggers = []

    if not any((user.focus_area, triggers, user.comfort_level, user.main_goal)):
        return None

    return {
        "focus_area": user.focus_area,
        "top_triggers": triggers,
        "comfort_level": user.comfort_level,
        "main_goal": user.main_goal,
    }


async def _resolve_completion(
    completion_id: str, user_id: str, db: AsyncSession
) -> tuple[ChallengeCompletion, Challenge]:
    """Load + ownership-check a completion, plus its challenge."""
    completion = await db.get(ChallengeCompletion, completion_id)
    if not completion or completion.user_id != user_id:
        raise HTTPException(status_code=404, detail="Completion not found")
    challenge = await db.get(Challenge, completion.challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge for completion not found")
    return completion, challenge


# --- Endpoints ---

@router.post("/", response_model=ConversationDetailResponse, status_code=201)
async def start_conversation(
    body: StartConversationRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _enforce_sensei_quota(user_id, db)

    challenge: Challenge | None = None
    reflection_context: dict | None = None

    # Resolve challenge from completion_id (preferred) or challenge_id
    if body.completion_id:
        completion, challenge = await _resolve_completion(body.completion_id, user_id, db)
        reflection_context = {
            "challenge_name": challenge.name,
            "anxiety_before": completion.anxiety_before,
            "anxiety_after": completion.anxiety_after,
            "notes": completion.notes,
        }
    elif body.challenge_id:
        challenge = await db.get(Challenge, body.challenge_id)
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")

    if not challenge and not body.first_message:
        raise HTTPException(
            status_code=400,
            detail="Need challenge_id, completion_id, or first_message",
        )

    challenge_data: dict | None = _challenge_to_dict(challenge) if challenge else None
    domain_data: dict | None = DOMAIN_INFO.get(challenge.domain) if challenge else None
    user_context = await _build_user_context(user_id, db)
    profile_context = await _build_profile_context(user_id, db)

    conversation = Conversation(
        user_id=user_id,
        challenge_id=challenge.id if challenge else None,
    )
    db.add(conversation)
    await db.flush()

    stored_messages: list[Message] = []

    if body.first_message:
        # Mode: user-initiated. Store the user message; coach responds to it.
        user_msg = Message(
            conversation_id=conversation.id,
            role="user",
            content=body.first_message,
        )
        db.add(user_msg)
        await db.flush()
        stored_messages.append(user_msg)

        ai_response = await get_coach_response(
            user_message=body.first_message,
            conversation_history=[],
            challenge=challenge_data,
            domain=domain_data,
            user_context=user_context,
            reflection_context=reflection_context,
            profile_context=profile_context,
        )
    else:
        # Mode: synthetic opener (challenge prep or completion reflection).
        # We send a synthetic "user" message to the model but DON'T store it —
        # the conversation thread the user sees starts with the coach's reply.
        if reflection_context:
            opener = _build_reflection_opener(reflection_context)
        else:
            assert challenge is not None  # established above
            opener = _build_prep_opener(challenge.name)

        ai_response = await get_coach_response(
            user_message=opener,
            conversation_history=[],
            challenge=challenge_data,
            domain=domain_data,
            user_context=user_context,
            reflection_context=reflection_context,
            profile_context=profile_context,
        )

    coach_msg = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=ai_response["content"],
        api_metadata=json.dumps(ai_response["usage"]),
    )
    db.add(coach_msg)
    stored_messages.append(coach_msg)

    conversation.total_tokens = (
        ai_response["usage"]["input_tokens"]
        + ai_response["usage"]["output_tokens"]
    )

    await db.commit()
    await db.refresh(conversation)
    for m in stored_messages:
        await db.refresh(m)

    return ConversationDetailResponse(
        id=conversation.id,
        challenge_id=conversation.challenge_id,
        started_at=conversation.started_at.isoformat(),
        messages=[_msg_to_response(m) for m in stored_messages],
    )


@router.post("/{conversation_id}/messages", response_model=MessageResponse)
async def send_message(
    conversation_id: str,
    body: SendMessageRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _enforce_sensei_quota(user_id, db)

    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id, Conversation.user_id == user_id)
        .options(selectinload(Conversation.messages))
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    challenge_data: dict | None = None
    domain_data: dict | None = None
    if conversation.challenge_id:
        challenge = await db.get(Challenge, conversation.challenge_id)
        if challenge:
            challenge_data = _challenge_to_dict(challenge)
            domain_data = DOMAIN_INFO.get(challenge.domain)

    user_context = await _build_user_context(user_id, db)
    profile_context = await _build_profile_context(user_id, db)

    history = [{"role": m.role, "content": m.content} for m in conversation.messages]

    user_msg = Message(
        conversation_id=conversation.id,
        role="user",
        content=body.content,
    )
    db.add(user_msg)

    ai_response = await get_coach_response(
        user_message=body.content,
        conversation_history=history,
        challenge=challenge_data,
        domain=domain_data,
        user_context=user_context,
        profile_context=profile_context,
    )

    coach_msg = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=ai_response["content"],
        api_metadata=json.dumps(ai_response["usage"]),
    )
    db.add(coach_msg)

    conversation.last_message_at = datetime.now(timezone.utc)
    conversation.total_tokens += (
        ai_response["usage"]["input_tokens"]
        + ai_response["usage"]["output_tokens"]
    )

    await db.commit()
    await db.refresh(coach_msg)

    return _msg_to_response(coach_msg)


@router.get("/quota", response_model=SenseiQuotaResponse)
async def get_sensei_quota(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Free-tier chat state, so the UI can show what's left today."""
    user = await db.get(User, user_id)
    used = await _sensei_replies_today(user_id, db)
    if user and user.is_premium:
        return SenseiQuotaResponse(
            is_premium=True, limit=None, used_today=used, remaining=None
        )
    limit = settings.FREE_DAILY_SENSEI_MESSAGES
    return SenseiQuotaResponse(
        is_premium=False,
        limit=limit,
        used_today=used,
        remaining=max(0, limit - used),
    )


@router.get("/recent", response_model=RecentConversationResponse)
async def get_recent_conversation(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the user's most recent conversation id, or null."""
    result = await db.execute(
        select(Conversation.id)
        .where(Conversation.user_id == user_id)
        .order_by(Conversation.last_message_at.desc())
        .limit(1)
    )
    conv_id = result.scalar_one_or_none()
    return RecentConversationResponse(conversation_id=conv_id)


@router.get("/{conversation_id}/messages", response_model=list[MessageResponse])
async def get_messages(
    conversation_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return messages for a conversation, oldest first. 404 if not the user's."""
    conversation = await db.get(Conversation, conversation_id)
    if not conversation or conversation.user_id != user_id:
        raise HTTPException(status_code=404, detail="Conversation not found")

    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    messages = result.scalars().all()
    return [_msg_to_response(m) for m in messages]
