"""Add status to challenge_completions (attempt tracking).

The table becomes a log of ATTEMPTS, not just successes. 'abandoned' rows
are the strongest step-down signal the progression rules have — an aborted
exposure previously left no trace at all.

server_default='completed' matters: it backfills every existing row with
the historically correct value (everything logged so far WAS a completion)
in one statement, with no data migration step.

Revision ID: c3d4e5f6a7b8
Revises: b7c8d9e0f1a2
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b7c8d9e0f1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "challenge_completions",
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="completed",
        ),
    )
    # Most reads are "this user's completed rows" — index matches that shape.
    op.create_index(
        "ix_challenge_completions_user_status",
        "challenge_completions",
        ["user_id", "status"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_challenge_completions_user_status",
        table_name="challenge_completions",
    )
    op.drop_column("challenge_completions", "status")
