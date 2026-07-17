"""
Recommender service — deterministic, rules-first.

Picks the underserved domain, moves the tier with the SUDS-based
progression engine (progression.py), and recommends the least-practised
challenge at that level.

Deliberately NOT an ML model yet: with near-zero real users, a trained
model would be theatre. Instead the rules encode the clinical logic
(domain balance, dating gate, graduated tier progression with safety
guardrails) and every recommendation is logged so a supervised
replacement (XGBoost) can be trained on real outcomes once the data
exists. Phase 4 swaps decide() in progression.py for the model — same
`history -> decision` interface, so both can be replayed offline against
logged histories before the switch.

Phase-4 trigger (defined now, so "ML later" is a plan with a threshold
rather than an aspiration). Train a candidate XGBoost when BOTH hold:
  - >= 50 distinct users each with >= 3 logged attempts, AND
  - >= 1,000 recommendation_logs rows with a resolvable outcome
    (a subsequent attempt within 14 days, or its recorded absence).
Deploy only if the candidate beats these rules in offline replay on a
time-based split (train on past, evaluate on later data). Even then the
clinical vetoes stay rule-based: the dating gate and the overwhelm
step-down are guardrails around any model, never learned by it.

Rules, in order:
1. Cold start (0 completions): first Tier-1 Social challenge.
2. Dating gate: don't recommend Dating until user has demonstrated
   (a) >= 5 Social completions AND (b) >= 1 Social Tier-2 attempt.
   Therapeutic rationale: Dating-domain anxiety is clinically heavier
   than Social-domain anxiety (rejection sensitivity, attractiveness
   self-judgement, identity vulnerability). Even Tier-1 Dating
   ("eye contact with someone attractive") activates different neural
   circuitry than Tier-1 Social ("eye contact with anyone"). So the
   recommender stays in Social until the user has both REPETITION
   (>=5 challenges) and TIER PROGRESSION (past pure presence into
   Tier-2 scripted interaction). Once both conditions met, Dating opens.
   This gate ONLY restricts recommendations — users can still browse
   the Dating tab and self-select any Dating challenge.
3. After gate: pick the domain with fewer completions (tie -> Social).
4. Tier: baseline = max_tier completed in that domain (1 if untouched),
   then the SUDS progression engine (progression.py) steps it up, down,
   or holds based on the user's attempt history at that tier — 2-of-3
   wins to climb, immediate step-down on an overwhelming session,
   abandons count as step-down evidence. Clamped to [1, 5].
5. Among candidates at that domain+tier, pick the one the user has
   completed least often. Tie -> lowest sort_order.
"""

from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Challenge, ChallengeCompletion, RecommendationLog, User
from app.services.progression import Attempt, Decision, decide


# Tuple order matters: first entry is the tie-break winner for domain selection.
DOMAIN_PRIORITY = ("social", "dating")

MIN_TIER, MAX_TIER = 1, 5

# Short display names for the reason string (full labels live in progress_service).
DOMAIN_DISPLAY = {
    "social": "Social",
    "dating": "Dating",
}


# Dating-unlock gate. Both conditions must be true before the recommender
# starts surfacing Dating challenges.
# Therapeutic: build basic Social comfort + demonstrate tier progression
# before introducing romantic-context exposure.
DATING_UNLOCK_MIN_SOCIAL = 5           # min total Social completions
DATING_UNLOCK_MIN_SOCIAL_TIER = 2      # min Social tier reached


class Recommendation(BaseModel):
    challenge_id: str
    name: str
    domain: str
    tier: int
    reason: str


async def recommend_next(user: User, session: AsyncSession) -> Recommendation | None:
    """Return the next-challenge recommendation. None if no challenges exist at all."""

    # Count completions per domain. Pre-populate zeros for domains the user
    # hasn't touched so the tie-break still works.
    domain_counts: dict[str, int] = {d: 0 for d in DOMAIN_PRIORITY}
    rows = (await session.execute(
        select(Challenge.domain, func.count(ChallengeCompletion.id))
        .join(ChallengeCompletion, Challenge.id == ChallengeCompletion.challenge_id)
        .where(
            ChallengeCompletion.user_id == user.id,
            ChallengeCompletion.status == ChallengeCompletion.STATUS_COMPLETED,
        )
        .group_by(Challenge.domain)
    )).all()
    for domain, count in rows:
        if domain in domain_counts:
            domain_counts[domain] = count

    total = sum(domain_counts.values())

    # --- Rule 1: cold start ---
    if total == 0:
        first = (await session.execute(
            select(Challenge)
            .where(Challenge.domain == "social", Challenge.tier == 1)
            .order_by(Challenge.sort_order)
            .limit(1)
        )).scalar_one_or_none()
        if first is None:
            return None
        rec = Recommendation(
            challenge_id=first.id,
            name=first.name,
            domain=first.domain,
            tier=first.tier,
            reason="Let's start with a gentle Social challenge.",
        )
        # cold start: no attempt history, so no progression decision to log
        return await _log_and_return(session, user, rec, progression=None)

    # --- Rule 2: Dating-unlock gate ---
    # Get max Social tier reached for the gate check.
    max_social_tier = (await session.execute(
        select(func.max(Challenge.tier))
        .join(ChallengeCompletion, Challenge.id == ChallengeCompletion.challenge_id)
        .where(
            ChallengeCompletion.user_id == user.id,
            ChallengeCompletion.status == ChallengeCompletion.STATUS_COMPLETED,
            Challenge.domain == "social",
        )
    )).scalar() or 0

    dating_unlocked = (
        domain_counts["social"] >= DATING_UNLOCK_MIN_SOCIAL
        and max_social_tier >= DATING_UNLOCK_MIN_SOCIAL_TIER
    )

    # --- Rule 3: domain selection ---
    if not dating_unlocked:
        # Stay in Social until both gate conditions are met.
        target_domain = "social"
    else:
        # Anti-avoidance: pick whichever domain has fewer completions.
        # min() over DOMAIN_PRIORITY keeps the tie-break deterministic
        # (Social wins ties because it comes first in the tuple).
        target_domain = min(DOMAIN_PRIORITY, key=lambda d: domain_counts[d])

        # --- Profile bias (gentle): prefer the user's stated focus area.
        # This NEVER overrides the dating gate — we're already past it here
        # (dating_unlocked is True). "both" applies no bias. A focus of
        # "dating" only takes effect now that the gate has opened.
        focus = getattr(user, "focus_area", None)
        if focus in ("social", "dating"):
            target_domain = focus

    # --- Rule 4: SUDS-based tier progression ---
    # Baseline = max completed tier in the domain (1 if untouched), then the
    # progression engine moves it up/down/holds based on the user's SUDS +
    # completion pattern at that tier. Pure function — see progression.py
    # for the full spec (WIN/LOSS/TOO_EASY, 2-of-3 window, overwhelm rule).
    max_tier = (await session.execute(
        select(func.max(Challenge.tier))
        .join(ChallengeCompletion, Challenge.id == ChallengeCompletion.challenge_id)
        .where(
            ChallengeCompletion.user_id == user.id,
            ChallengeCompletion.status == ChallengeCompletion.STATUS_COMPLETED,
            Challenge.domain == target_domain,
        )
    )).scalar()
    target_tier = max_tier or 1

    # --- Profile prior: low self-rated comfort lowers the BASELINE only.
    # Applied BEFORE the progression engine, deliberately: the intake form
    # is a prior, not a ceiling. A comfort<=2 user starts from tier 1, but
    # the engine evaluates their actual attempts and can step them up past
    # it — behaviour outranks self-report, in both directions. (Previously
    # this floor was applied after progression, which trapped low-comfort
    # users at tier 1 no matter what their SUDS evidence showed.)
    comfort = getattr(user, "comfort_level", None)
    low_comfort_bias = isinstance(comfort, int) and comfort <= 2
    if low_comfort_bias and target_tier > 1:
        target_tier = 1

    # Full attempt history at that tier — abandons included, deliberately:
    # they're the strongest step-down evidence the engine has.
    attempt_rows = (await session.execute(
        select(
            ChallengeCompletion.status,
            ChallengeCompletion.anxiety_before,
            ChallengeCompletion.anxiety_after,
        )
        .join(Challenge, Challenge.id == ChallengeCompletion.challenge_id)
        .where(
            ChallengeCompletion.user_id == user.id,
            Challenge.domain == target_domain,
            Challenge.tier == target_tier,
        )
        .order_by(ChallengeCompletion.completed_at.asc())
    )).all()

    progression = decide([
        Attempt(
            completed=(s == ChallengeCompletion.STATUS_COMPLETED),
            anxiety_before=b,
            anxiety_after=a,
        )
        for s, b, a in attempt_rows
    ])
    if progression is Decision.STEP_UP:
        target_tier = min(target_tier + 1, MAX_TIER)
    elif progression is Decision.STEP_DOWN:
        target_tier = max(target_tier - 1, MIN_TIER)

    # --- Rule 5: candidates at that domain+tier, ranked by completion count ---
    candidates = (await session.execute(
        select(Challenge)
        .where(Challenge.domain == target_domain, Challenge.tier == target_tier)
        .order_by(Challenge.sort_order)
    )).scalars().all()
    if not candidates:
        return None

    # How many times has the user done each candidate?
    counts: dict[str, int] = {c.id: 0 for c in candidates}
    rows = (await session.execute(
        select(ChallengeCompletion.challenge_id, func.count(ChallengeCompletion.id))
        .where(
            ChallengeCompletion.user_id == user.id,
            ChallengeCompletion.status == ChallengeCompletion.STATUS_COMPLETED,
            ChallengeCompletion.challenge_id.in_([c.id for c in candidates]),
        )
        .group_by(ChallengeCompletion.challenge_id)
    )).all()
    for cid, count in rows:
        counts[cid] = count

    # Pick least-completed; ties broken by sort_order (preserved by the query above).
    best = min(candidates, key=lambda c: counts[c.id])

    rec = Recommendation(
        challenge_id=best.id,
        name=best.name,
        domain=best.domain,
        tier=best.tier,
        reason=_build_reason(
            target_domain,
            target_tier,
            domain_counts,
            dating_unlocked,
            focus_bias=getattr(user, "focus_area", None) in ("social", "dating"),
            low_comfort_bias=low_comfort_bias,
            progression=progression,
        ),
    )
    return await _log_and_return(session, user, rec, progression=progression)

# ======================================================
# Helpers
# ======================================================


async def _log_and_return(
    session: AsyncSession,
    user: User,
    rec: Recommendation,
    progression: Decision | None = None,
) -> Recommendation:
    """Persist a row to recommendation_logs, then return the recommendation.

    Pure data collection — the row is read by the Phase 4 ML training
    pipeline (joined against completions to derive 'was_followed'). No
    runtime code reads from the table.

    Snapshots the mutable inputs (profile fields, progression branch,
    target tier) because they can't be reconstructed at training time.
    """
    session.add(RecommendationLog(
        user_id=user.id,
        challenge_id=rec.challenge_id,
        strategy="rules",
        reason=rec.reason,
        confidence=None,
        progression=progression.value if progression is not None else None,
        tier=rec.tier,
        comfort_level=getattr(user, "comfort_level", None),
        focus_area=getattr(user, "focus_area", None),
    ))
    await session.commit()
    return rec


def _build_reason(
    target_domain: str,
    target_tier: int,
    domain_counts: dict[str, int],
    dating_unlocked: bool,
    focus_bias: bool = False,
    low_comfort_bias: bool = False,
    progression: Decision = Decision.HOLD,
) -> str:
    """Generate the user-facing explanation for the recommendation.

    focus_bias / low_comfort_bias annotate the reason when a profile-driven
    nudge shaped the pick — they never change the clinical gating, only the
    wording, so the recommendation stays explainable.
    """
    target_name = DOMAIN_DISPLAY[target_domain]

    # Progression moves take narrative priority: if the engine moved the
    # tier, the user deserves to hear why — framed as earned (up) or as
    # consolidation, never as failure (down).
    if progression is Decision.STEP_UP:
        return (
            f"Your anxiety's been coming down at this level — you've earned "
            f"a step up. Try a Tier {target_tier} {target_name} challenge."
        )
    if progression is Decision.STEP_DOWN:
        return (
            f"Let's consolidate at Tier {target_tier} {target_name} for now — "
            "solid ground first, then we climb again."
        )

    # Low-comfort nudge takes narrative priority — it's the gentlest signal.
    if low_comfort_bias:
        return (
            f"Let's keep it manageable with a Tier {target_tier} {target_name} "
            "challenge while your comfort builds."
        )

    # Early-Social bias active — be honest about why we're staying in Social
    if target_domain == "social" and not dating_unlocked:
        return "Stay close to Social for now. Let it become familiar."

    if focus_bias:
        return f"Leaning into your focus on {target_name} with a Tier {target_tier} challenge."

    other = "dating" if target_domain == "social" else "social"
    if domain_counts[target_domain] < domain_counts[other]:
        other_name = DOMAIN_DISPLAY[other]
        return f"You've been focusing on {other_name}. Let's practise a {target_name} challenge."
    return (
        f"Keep building confidence in {target_name} at Tier {target_tier}. "
        "Consistency is where real progress happens."
    )