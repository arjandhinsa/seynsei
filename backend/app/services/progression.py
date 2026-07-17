"""SUDS-based tier progression engine.

Pure function: (attempt history at the user's current tier) -> decision.
No database access, deliberately:
  1. Every branch of the spec is unit-testable with a hand-built list.
  2. `history -> decision` is exactly the interface a trained model has,
     so the Phase-4 ML recommender can replace this function behind the
     same call site — and logged histories can be replayed through both
     for offline comparison before the model ever serves a user.

The spec (each threshold is a named constant; rationale inline):

  WIN        completed AND (before - after) >= 2      within-session habituation.
                                                      >= 2 because a 1-point move
                                                      on a 0-10 integer scale is
                                                      rating noise.
  TOO_EASY   completed AND before <= 3                the user was never really
                                                      anxious: no learning is
                                                      happening at this tier. It
                                                      can't produce a 2-point drop
                                                      (nowhere to drop from), yet
                                                      it's the clearest step-up
                                                      case there is.
  LOSS       abandoned OR (after - before) >= 2       an abandon is a LOSS even
                                                      with no ratings: the missing
                                                      data is caused by the outcome
                                                      itself (informative missing-
                                                      ness). Behaviour outranks
                                                      self-report.

  STEP_UP    >= 3 attempts at tier AND >= 2 of last 3 are WIN or TOO_EASY.
             3 attempts because one exposure can be a fluke and two a good
             day; three with two wins is the smallest sample where pattern
             beats luck — and exposure work favours repetition anyway.
  STEP_DOWN  most recent attempt has after >= 9 (immediate — flooding costs
             more than a false demotion; a wrongly demoted user re-earns the
             tier in 3 sessions), OR >= 2 of last 3 are LOSS.
  HOLD       everything else, including all cold-start cases (< 3 attempts).

  Null ratings count toward the 3-attempt minimum but are never WIN or
  LOSS (no evidence, no credit) — except abandonment, per above.

Priority: STEP_DOWN is checked first. If the history somehow supports both
(e.g. two losses and two wins interleaved), safety wins.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Decision(str, Enum):
    STEP_UP = "step_up"
    HOLD = "hold"
    STEP_DOWN = "step_down"


# --- thresholds (the spec, as constants) ---
MIN_ATTEMPTS_AT_TIER = 3   # attempts needed before any step-up
WINDOW = 3                 # decisions look at the last N attempts
REQUIRED_IN_WINDOW = 2     # "2 of 3"
WIN_REDUCTION = 2          # before - after >= 2 (1 point = rating noise)
LOSS_INCREASE = 2          # after - before >= 2
TOO_EASY_BEFORE = 3        # before <= 3: tier no longer bites
OVERWHELM_AFTER = 9        # a single after >= 9 steps down immediately


@dataclass(frozen=True)
class Attempt:
    """One row from challenge_completions, at the tier under evaluation.

    Ordered oldest -> newest by the caller. `completed` False == abandoned.
    """
    completed: bool
    anxiety_before: int | None = None
    anxiety_after: int | None = None


def is_win(a: Attempt) -> bool:
    if not a.completed or a.anxiety_before is None or a.anxiety_after is None:
        return False
    return (a.anxiety_before - a.anxiety_after) >= WIN_REDUCTION


def is_too_easy(a: Attempt) -> bool:
    if not a.completed or a.anxiety_before is None:
        return False
    return a.anxiety_before <= TOO_EASY_BEFORE


def is_loss(a: Attempt) -> bool:
    if not a.completed:
        return True  # behaviour outranks self-report
    if a.anxiety_before is None or a.anxiety_after is None:
        return False
    return (a.anxiety_after - a.anxiety_before) >= LOSS_INCREASE


def decide(attempts_at_tier: list[Attempt]) -> Decision:
    """The progression decision for the user's current tier.

    `attempts_at_tier`: every attempt (completed and abandoned) the user has
    made at their current tier in the current domain, oldest first.
    The caller owns clamping (no step_down below tier 1 / step_up above max).
    """
    if not attempts_at_tier:
        return Decision.HOLD

    window = attempts_at_tier[-WINDOW:]
    last = attempts_at_tier[-1]

    # --- STEP_DOWN first: safety outranks progression ---
    if last.anxiety_after is not None and last.anxiety_after >= OVERWHELM_AFTER:
        return Decision.STEP_DOWN
    if sum(1 for a in window if is_loss(a)) >= REQUIRED_IN_WINDOW:
        return Decision.STEP_DOWN

    # --- STEP_UP ---
    if len(attempts_at_tier) >= MIN_ATTEMPTS_AT_TIER:
        if sum(1 for a in window if is_win(a) or is_too_easy(a)) >= REQUIRED_IN_WINDOW:
            return Decision.STEP_UP

    return Decision.HOLD
