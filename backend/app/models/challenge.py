import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# The master list of challenges that users can complete
class Challenge(Base):
    __tablename__ = "challenges"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    # Which domain this challenge belongs to
    domain: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    ) 

    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # CBT rationale explaining why this challenge is helpful for anxiety
    rationale: Mapped[str] = mapped_column(
        Text,
        nullable=True,
    ) 

    # Difficulty scale 1-5
    # 1 = smile at a stranger, 5 = share something vulnerable
    tier: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )   

    # Stored per-row so we can tune an individual challenge's reward
    # without being locked to the tier's default. Seed derives from tier.
    xp_value: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    # The specific avoidance pattern this exposure targets
    # e.g. "eye contact avoidance", "rehearsing sentences before speaking",
    # "checking the room for exits"
    safety_behaviour_targeted: Mapped[str] = mapped_column(
        Text,
        nullable=True,
    )

    # The CBT cognitive distortion this challenge is designed to disprove
    # e.g. "mind-reading", "catastrophising", "personalisation"
    cognitive_distortion_challenged: Mapped[str] = mapped_column(
        Text,
        nullable=True,
    )

    # Optional one-liner that softens or reframes the challenge.
    tip: Mapped[str] = mapped_column(
        Text,
        nullable=True,
    )
    
    # Controls the display order within a domain
    # So challenges appear in a sensible sequence
    sort_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )

    completions = relationship("ChallengeCompletion", back_populates="challenge")


# Records every ATTEMPT a user makes at a challenge — completed or abandoned.
# (Historically completions-only; the status column turned it into an attempt
# log. Any query that means "successes" MUST filter status == "completed".)
class ChallengeCompletion(Base):
    __tablename__ = "challenge_completions"

    # 'completed' | 'abandoned'. Free string (matches the strategy-column
    # convention in recommendation_logs) so new outcomes don't need a
    # migration. Abandoned rows carry anxiety_before but usually no
    # anxiety_after; they award no XP and don't advance streaks.
    STATUS_COMPLETED = "completed"
    STATUS_ABANDONED = "abandoned"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    # Foreign keys to link to the user and challenge
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    challenge_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("challenges.id", ondelete="CASCADE"),
        nullable=False,
    )

    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=STATUS_COMPLETED,
        server_default=STATUS_COMPLETED,
        index=False,  # covered by composite (user_id, status) index in migration
    )

    #Xp awarded, including any streak multipliers or bonuses.
    # Stored here due to changes in streak multiplier or bonuses over time
    # and we want to keep historical XP to stay consistent.

    xp_earned: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0, 
    )

    # which day of the current streak this completion is
    #  (1 for the first day, 2 for the second, etc)

    streak_day: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )

    # SUDS (Subjective Units of Distress) ratings
    # Scale: 1 (barely noticeable) → 10 (worst anxiety you can imagine)
    # Users rate before and after attempting the challenge
    # Tracking both lets them see their anxiety dropping over time

    # nullable=True because these are optional — user can skip the rating
    anxiety_before: Mapped[int] = mapped_column(
        Integer,
        nullable=True,
    )

    anxiety_after: Mapped[int] = mapped_column(
        Integer,
        nullable=True,
    )

    # Optional personal reflection — "what happened vs what I predicted"
    notes: Mapped[str] = mapped_column(
        Text,
        nullable=True,
    )

    # Two-way relationships back to User and Challenge
    # completion.user → the User who completed it
    # completion.challenge → which Challenge they completed
    user = relationship("User", back_populates="completions")
    challenge = relationship("Challenge", back_populates="completions")

    