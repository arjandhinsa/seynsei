"""Unit tests for the progression spec — every branch, no database.

Run: pytest backend/tests/test_progression.py  (or python -m pytest)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.progression import Attempt, Decision, decide  # noqa: E402


def done(before=None, after=None):
    return Attempt(completed=True, anxiety_before=before, anxiety_after=after)


def bailed(before=None):
    return Attempt(completed=False, anxiety_before=before, anxiety_after=None)


# --- cold start / hold ---

def test_no_attempts_holds():
    assert decide([]) == Decision.HOLD


def test_fewer_than_three_attempts_never_steps_up():
    # two perfect wins — still hold: below the 3-attempt minimum
    assert decide([done(7, 3), done(7, 3)]) == Decision.HOLD


def test_flat_suds_holds():
    # completing but not habituating: the definition of hold
    assert decide([done(6, 6), done(5, 6), done(6, 5)]) == Decision.HOLD


def test_null_ratings_count_toward_minimum_but_never_win():
    # three attempts, but only one has ratings: no 2-of-3 evidence
    assert decide([done(), done(), done(7, 3)]) == Decision.HOLD


# --- step up ---

def test_two_wins_of_three_steps_up():
    assert decide([done(7, 4), done(6, 6), done(7, 5)]) == Decision.STEP_UP


def test_too_easy_counts_as_step_up_evidence():
    # cruising at low SUDS can't produce a 2-point drop but means the tier
    # lost its bite — clearest step-up case there is
    assert decide([done(3, 3), done(2, 2), done(6, 6)]) == Decision.STEP_UP


def test_win_plus_too_easy_combined():
    assert decide([done(6, 6), done(7, 4), done(3, 2)]) == Decision.STEP_UP


def test_window_is_last_three_only():
    # two old wins, then three flat sessions: old evidence expired
    history = [done(8, 4), done(8, 4), done(6, 6), done(6, 5), done(5, 6)]
    assert decide(history) == Decision.HOLD


# --- step down ---

def test_single_overwhelm_steps_down_immediately():
    # one after >= 9 acts NOW — flooding costs more than a false demotion
    assert decide([done(7, 9)]) == Decision.STEP_DOWN


def test_overwhelm_must_be_most_recent():
    # a 9 two sessions ago followed by recovery does not demote
    assert decide([done(7, 9), done(6, 4), done(6, 4)]) == Decision.STEP_UP


def test_two_abandons_of_three_step_down():
    assert decide([done(6, 5), bailed(8), bailed(7)]) == Decision.STEP_DOWN


def test_abandon_is_loss_despite_missing_ratings():
    # informative missingness: the bail-out IS the measurement
    assert decide([bailed(), bailed(), done(5, 5)]) == Decision.STEP_DOWN


def test_rising_suds_steps_down():
    assert decide([done(5, 7), done(5, 5), done(4, 6)]) == Decision.STEP_DOWN


def test_step_down_checked_before_step_up():
    # 2 wins AND 2 losses in the window is impossible with window=3, so force
    # the conflict via the overwhelm override sitting on top of two wins
    assert decide([done(7, 4), done(7, 4), done(7, 9)]) == Decision.STEP_DOWN


def test_step_down_needs_no_minimum_attempts():
    # safety rules apply from attempt one; the 3-attempt floor is only for step_up
    assert decide([bailed(), bailed()]) == Decision.STEP_DOWN


if __name__ == "__main__":
    # allow running without pytest
    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"  ok  {name}")
            except AssertionError:
                failures += 1
                print(f"FAIL  {name}")
    raise SystemExit(1 if failures else 0)
