"""add user personalization fields

Revision ID: a1b2c3d4e5f6
Revises: 3d34ef708f6f
Create Date: 2026-07-04 00:00:00.000000

Additive, SQLite-compatible ALTERs. All new columns are nullable except
onboarding_completed, which carries a server_default of false so existing
rows remain valid without a data backfill.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '3d34ef708f6f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('focus_area', sa.String(length=20), nullable=True))
    op.add_column('users', sa.Column('top_triggers', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('comfort_level', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('main_goal', sa.String(length=30), nullable=True))
    op.add_column(
        'users',
        sa.Column(
            'onboarding_completed',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column('users', 'onboarding_completed')
    op.drop_column('users', 'main_goal')
    op.drop_column('users', 'comfort_level')
    op.drop_column('users', 'top_triggers')
    op.drop_column('users', 'focus_area')
