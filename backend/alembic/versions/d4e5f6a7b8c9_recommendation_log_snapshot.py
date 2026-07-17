"""Snapshot decision context onto recommendation_logs.

Why: the Phase-4 training pipeline can rebuild a user's completion history
at recommendation time from timestamps — but NOT the mutable profile
fields (comfort_level, focus_area can change with no history) or the
internal decision state (which progression branch fired, what tier was
targeted). Log-time capture beats train-time reconstruction whenever the
source is mutable. Without these columns, next year's model can't know
what the recommender saw when it decided.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLS = [
    # which progression branch fired: 'step_up' | 'hold' | 'step_down'
    sa.Column("progression", sa.String(length=10), nullable=True),
    # the tier the recommender targeted after progression + clamps
    sa.Column("tier", sa.Integer(), nullable=True),
    # mutable profile fields, as they were at recommendation time
    sa.Column("comfort_level", sa.Integer(), nullable=True),
    sa.Column("focus_area", sa.String(length=20), nullable=True),
]


def upgrade() -> None:
    for col in COLS:
        op.add_column("recommendation_logs", col)


def downgrade() -> None:
    for col in reversed(COLS):
        op.drop_column("recommendation_logs", col.name)
