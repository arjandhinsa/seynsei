"""
Recommender service (Phase 3 stub).

Rule-based stub that picks the underserved domain and recommends at the
user's current tier, preferring challenges they've done least often.

NOT an ML model. Phase 4 will replace this with a two-layer system:
- Rules (here) do the clinical gating: domain balance, tier progression.
- XGBoost picks the specific challenge within what the rules allow.

The stub keeps the frontend working with something defensible until then.

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
4. Tier = max_tier completed in that domain, or 1 if user has never
   touched it. Stub never pushes the user up a tier — that requires
   SUDS evidence (Phase 4).
5. Among candidates at that domain+tier, pick the one the user has
   completed least often. Tie -> lowest sort_order.
"""

from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Challenge, ChallengeCompletion, RecommendationLog, User


# Tuple order matters: first entry is the tie-break winner for domain selection.
DOMAIN_PRIORITY = ("social", "dating")

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
        .where(ChallengeCompletion.user_id == user.id)
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
        return await _log_and_return(session, user.id, rec)

    # --- Rule 2: Dating-unlock gate ---
    # Get max Social tier reached for the gate check.
    max_social_tier = (await session.execute(
        select(func.max(Challenge.tier))
        .join(ChallengeCompletion, Challenge.id == ChallengeCompletion.challenge_id)
        .where(
            ChallengeCompletion.user_id == user.id,
            Challenge.domain == "social",
        )
    )).scalar() or 0

    dating_unlocked = (
        domain_counts["social"] >= DATING_UNLOCK_MIN_SOCIAL
        or max_social_tier >= DATING_UNLOCK_MIN_SOCIAL_TIER
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

    # --- Rule 4: tier = max completed in target domain, or 1 if untouched ---
    max_tier = (await session.execute(
        select(func.max(Challenge.tier))
        .join(ChallengeCompletion, Challenge.id == ChallengeCompletion.challenge_id)
        .where(
            ChallengeCompletion.user_id == user.id,
            Challenge.domain == target_domain,
        )
    )).scalar()
    target_tier = max_tier or 1

    # --- Profile bias (gentle): low self-rated comfort -> stay lower.
    # If the user rates their comfort <= 2, prefer the lower of the eligible
    # tiers (the floor of 1 .. their current max) so we don't push them into
    # the top of what they've unlocked. Never raises the tier, only lowers it,
    # so this can't jump the user ahead of their earned progression.
    comfort = getattr(user, "comfort_level", None)
    low_comfort_bias = isinstance(comfort, int) and comfort <= 2
    if low_comfort_bias and target_tier > 1:
        target_tier = 1

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
        ),
    )
    return await _log_and_return(session, user.id, rec)

# ======================================================
# Helpers
# ======================================================


async def _log_and_return(
    session: AsyncSession,
    user_id: str,
    rec: Recommendation,
) -> Recommendation:
    """Persist a row to recommendation_logs, then return the recommendation.

    Pure data collection — the row is read by the Phase 4 ML training
    pipeline (joined against completions to derive 'was_followed'). No
    runtime code reads from the table.
    """
    session.add(RecommendationLog(
        user_id=user_id,
        challenge_id=rec.challenge_id,
        strategy="rules",
        reason=rec.reason,
        confidence=None,
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
) -> str:
    """Generate the user-facing explanation for the recommendation.

    focus_bias / low_comfort_bias annotate the reason when a profile-driven
    nudge shaped the pick — they never change the clinical gating, only the
    wording, so the recommendation stays explainable.
    """
    target_name = DOMAIN_DISPLAY[target_domain]

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