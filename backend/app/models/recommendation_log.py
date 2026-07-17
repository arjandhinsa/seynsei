import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, ForeignKey, Text, Float, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RecommendationLog(Base):
    """One row per /recommend call. Training data for the Phase 4 ML
    recommender — joined against completions at train time to derive
    'was_followed'. Pure data collection; no app behaviour reads from it."""

    __tablename__ = "recommendation_logs"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # SET NULL on challenge delete — keep the recommendation history if
    # the catalogue changes.
    challenge_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("challenges.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # 'rules' for now; 'ml' / 'explore' / 'rules_only' (control arm) when
    # Phase 4 lands. Free string (not enum) so adding strategies later
    # doesn't need a migration.
    strategy: Mapped[str] = mapped_column(String(20), nullable=False)

    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    # --- decision-time snapshot (training features the DB can't rebuild) ---
    # Completion history at rec time is reconstructable from timestamps;
    # these fields are not: profile fields mutate without history, and the
    # progression branch is internal state. Captured at log time so the
    # Phase-4 pipeline knows exactly what the recommender saw.
    progression: Mapped[str | None] = mapped_column(String(10), nullable=True)
    tier: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comfort_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    focus_area: Mapped[str | None] = mapped_column(String(20), nullable=True)

    recommended_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
