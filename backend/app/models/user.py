import uuid #generates unqiqe ids
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Boolean, Integer, Date, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()), #generates a unique id for each user
    )

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    ) #users email for login

    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    ) #hashed password for security

    display_name: Mapped[str] = mapped_column(
        String(100),
        nullable=True,
    ) #optional display name for the user

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
    ) #indicates if the user account is active

    # --- personalization / onboarding fields (additive, nullable) ---
    focus_area: Mapped[str] = mapped_column(
        String(20),
        nullable=True,
    )  # "social" | "dating" | "both"

    top_triggers: Mapped[str] = mapped_column(
        Text,
        nullable=True,
    )  # JSON-encoded array of trigger codes

    comfort_level: Mapped[int] = mapped_column(
        Integer,
        nullable=True,
    )  # 1..5 self-rated social comfort

    main_goal: Mapped[str] = mapped_column(
        String(30),
        nullable=True,
    )  # "make_friends" | "confidence" | "dating" | "speak_up" | "less_avoidance"

    onboarding_completed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )  # true once the user has supplied any personalization data

    # --- gamification fields ---
    total_xp: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    ) #total experience points earned by the user

    current_streak: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )  # consecutive days with at least one completion

    longest_streak: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )  # personal best — never decreases

    last_completion_date: Mapped[datetime] = mapped_column(
        Date,
        nullable=True,
    )  # date only (not datetime) — streak compares calendar days, so time-of-day would be noise


    # The avatar the user has equipped, with a string code matching the frontend
    # catalog (e.g. "the_seeker"). Nullable: a fresh user has no equipped
    # avatar yet (frontend defaults to whichever stage matches their level).
    equipped_avatar_id: Mapped[str] = mapped_column(
        String(50),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    ) #timestamp for when the user account was created

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    ) #timestamp for when the user account was last updated

    completions = relationship("ChallengeCompletion", back_populates="user")
    conversations = relationship("Conversation", back_populates="user")
    achievements = relationship("UserAchievement", back_populates="user")