import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.user import User
from app.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_token,
)
from app.middleware.auth import get_current_user


router = APIRouter()

# --- Personalization value domains ---
# Kept as Literal types so pydantic rejects invalid codes with a 422 for free.
FocusArea = Literal["social", "dating", "both"]
TriggerCode = Literal[
    "strangers",
    "groups",
    "authority",
    "phone_calls",
    "dating",
    "being_watched",
    "speaking_up",
]
MainGoal = Literal[
    "make_friends",
    "confidence",
    "dating",
    "speak_up",
    "less_avoidance",
]


def _parse_top_triggers(raw: str | None) -> list[str] | None:
    """Decode the JSON-encoded top_triggers column into a list. Returns None
    when the column is null so UserResponse stays consistent (list | None)."""
    if raw is None:
        return None
    try:
        value = json.loads(raw)
    except (ValueError, TypeError):
        return None
    return value if isinstance(value, list) else None


# --- Request/Response shapes ---

class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: str | None = None
    focus_area: FocusArea | None = None
    top_triggers: list[TriggerCode] | None = None
    comfort_level: int | None = Field(None, ge=1, le=5)
    main_goal: MainGoal | None = None

class LoginRequest(BaseModel):
    email: str
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str | None
    equipped_avatar_id: str | None
    focus_area: str | None
    top_triggers: list[str] | None
    comfort_level: int | None
    main_goal: str | None
    onboarding_completed: bool
    is_premium: bool = False


def _user_response(user: User) -> UserResponse:
    """Build a UserResponse from a User row, decoding the JSON triggers column."""
    return UserResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        equipped_avatar_id=user.equipped_avatar_id,
        focus_area=user.focus_area,
        top_triggers=_parse_top_triggers(user.top_triggers),
        comfort_level=user.comfort_level,
        main_goal=user.main_goal,
        onboarding_completed=user.onboarding_completed,
        is_premium=user.is_premium,
    )

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    # If ANY personalization field was provided, mark onboarding complete.
    provided_profile = any(
        v is not None
        for v in (body.focus_area, body.top_triggers, body.comfort_level, body.main_goal)
    )

    # Create user with hashed password — never store plaintext
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        display_name=body.display_name,
        focus_area=body.focus_area,
        top_triggers=(
            json.dumps(body.top_triggers) if body.top_triggers is not None else None
        ),
        comfort_level=body.comfort_level,
        main_goal=body.main_goal,
        onboarding_completed=provided_profile,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)  # Reload from DB to get the generated ID

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )

@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    # Look up user by email
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # Deliberately vague error — don't reveal whether the email exists
    # "Wrong password" tells an attacker the email IS registered
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated",
        )

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )

@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest):
    # Exchange a valid refresh token for new tokens
    # Called when the frontend's access token expires
    user_id = verify_token(body.refresh_token, expected_type="refresh")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )

@router.get("/me", response_model=UserResponse)
async def get_me(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Protected route — get_current_user runs first
    # If the token is invalid, this code never runs
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return _user_response(user)

class UpdateMeRequest(BaseModel):
    """All fields optional. Only fields present in the request body get
    updated; others are left untouched. Pass `null` explicitly to clear
    a nullable field (e.g. unequip an avatar)."""
    display_name: str | None = None
    equipped_avatar_id: str | None = None
    focus_area: FocusArea | None = None
    top_triggers: list[TriggerCode] | None = None
    comfort_level: int | None = Field(None, ge=1, le=5)
    main_goal: MainGoal | None = None


@router.patch("/me", response_model=UserResponse)
async def update_me(
    body: UpdateMeRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's profile fields. PATCH semantics — only
    fields present in the request body are touched. Use the body of the
    request payload (not query strings) to differentiate "field omitted"
    from "field explicitly set to null".

    Validation that an avatar code is real / unlocked happens client-side
    for v1 (the catalogue is hard-coded in the frontend; unlocks are
    level-derived). Move server-side if/when the catalogue moves.
    """
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # PATCH semantics: use model_dump(exclude_unset=True) so we only
    # touch fields the client explicitly sent.
    updates = body.model_dump(exclude_unset=True)

    if "display_name" in updates:
        # Treat empty/whitespace as null (clears the name)
        name = updates["display_name"]
        user.display_name = name.strip() if name and name.strip() else None

    if "equipped_avatar_id" in updates:
        user.equipped_avatar_id = updates["equipped_avatar_id"]

    # Personalization fields — any of these appearing marks onboarding complete.
    profile_touched = False

    if "focus_area" in updates:
        user.focus_area = updates["focus_area"]
        profile_touched = True

    if "top_triggers" in updates:
        triggers = updates["top_triggers"]
        user.top_triggers = json.dumps(triggers) if triggers is not None else None
        profile_touched = True

    if "comfort_level" in updates:
        user.comfort_level = updates["comfort_level"]
        profile_touched = True

    if "main_goal" in updates:
        user.main_goal = updates["main_goal"]
        profile_touched = True

    if profile_touched:
        user.onboarding_completed = True

    await db.commit()
    await db.refresh(user)

    return _user_response(user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Hard-delete the current user and everything associated. All FKs to
    users.id use ondelete=CASCADE, so the DB drops the user's
    challenge_completions, conversations (and their messages),
    user_achievements, and recommendation_logs in one go."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()
    # 204 — frontend handles logout + redirect.