import time

from openai import AsyncOpenAI

from app.config import settings


client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


# ─────────────────────────────────────────────────────────────────────
# System prompt — single tight block, with minimal conditional appendices.
# Total prompt sits around 200-280 words depending on which contexts apply.
# ─────────────────────────────────────────────────────────────────────

BASE_PROMPT = """You are Sensei, the in-app coach for Seynsei — a CBT-grounded social anxiety app by SEYN. Voice: warm, unhurried, a wise friend not a textbook. British English throughout.

Replies are SHORT — one to two short paragraphs, often less. No lists, no bullets, no numbered steps.

Never open with filler-affirmation ("Absolutely", "Of course", "Great question"). Start with substance — curiosity or one specific question, not reassurance. Don't say "you're brave" or "I'm here for you" or recite that anxiety is normal — they already know. Show care through attention, not declaration.

Approach: validate their specific feeling, then EITHER a gentle reframe OR one tiny next step — pick one, not both. Use Socratic questioning when it fits. Say "let's test that prediction" not "let's do a behavioural experiment".

Boundaries: don't diagnose, prescribe, or replace therapy. If severe distress or self-harm comes up, gently encourage professional support. Don't push beyond what they're ready for.

If gamification surfaces (level, streak, achievements), engage naturally — don't perform it. Coaching first."""


def _challenge_section(challenge: dict, domain: dict) -> str:
    name = challenge.get("name", "a challenge")
    tier = challenge.get("tier", "?")
    domain_label = domain.get("label", "")
    rationale = challenge.get("rationale", "")
    line = f'\n\nChallenge in scope: "{name}" — Tier {tier} {domain_label}.'
    if rationale:
        line += f" Why it helps: {rationale}"
    return line


def _generic_section() -> str:
    return "\n\nNo specific challenge in scope. Listen first; don't assume they want exposure work."


def _reflection_section(rc: dict) -> str:
    name = rc.get("challenge_name", "a challenge")
    line = f'\n\nThey just completed: "{name}".'
    before, after = rc.get("anxiety_before"), rc.get("anxiety_after")
    if before is not None and after is not None:
        diff = before - after
        line += f" SUDS {before} → {after}"
        if diff > 0:
            line += f" (down {diff})."
        elif diff < 0:
            line += f" (up {-diff})."
        else:
            line += " (held steady)."
    elif before is not None:
        line += f" SUDS beforehand: {before}."
    notes = rc.get("notes")
    if notes:
        line += f' They wrote: "{notes}".'
    line += " Open by asking what came up — was it harder or easier than predicted? Don't lead with prep advice or generic congratulation."
    return line


def _user_progress_section(uc: dict) -> str:
    level = uc.get("current_level", "?")
    streak = uc.get("current_streak", 0)
    return f"\n\nUser context: Level {level}, {streak}-day streak."


# Human-readable phrases for the trigger codes stored on the user.
_TRIGGER_PHRASES = {
    "strangers": "talking to strangers",
    "groups": "being in groups",
    "authority": "authority figures",
    "phone_calls": "phone calls",
    "dating": "dating situations",
    "being_watched": "being watched",
    "speaking_up": "speaking up",
}

_FOCUS_PHRASES = {
    "social": "social confidence",
    "dating": "dating confidence",
    "both": "both social and dating confidence",
}

_GOAL_PHRASES = {
    "make_friends": "making friends",
    "confidence": "building general confidence",
    "dating": "getting more comfortable with dating",
    "speak_up": "speaking up more",
    "less_avoidance": "avoiding less",
}


def _profile_section(pc: dict) -> str:
    """Concise profile context so the coach can tailor its tone. Only emits
    the pieces that are actually present; returns "" when nothing is set."""
    bits: list[str] = []

    focus = pc.get("focus_area")
    if focus in _FOCUS_PHRASES:
        bits.append(f"they're focused on {_FOCUS_PHRASES[focus]}")

    triggers = pc.get("top_triggers") or []
    phrases = [_TRIGGER_PHRASES[t] for t in triggers if t in _TRIGGER_PHRASES]
    if phrases:
        if len(phrases) == 1:
            bits.append(f"{phrases[0]} tends to trigger them")
        else:
            bits.append(", ".join(phrases[:-1]) + f" and {phrases[-1]} trigger them most")

    comfort = pc.get("comfort_level")
    if isinstance(comfort, int):
        bits.append(f"they rate their social comfort {comfort}/5")

    goal = pc.get("main_goal")
    if goal in _GOAL_PHRASES:
        bits.append(f"their goal is {_GOAL_PHRASES[goal]}")

    if not bits:
        return ""

    return "\n\nProfile context (for tailoring, don't recite): " + "; ".join(bits) + "."


def build_system_prompt(
    challenge: dict | None,
    domain: dict | None,
    user_context: dict | None = None,
    reflection_context: dict | None = None,
    profile_context: dict | None = None,
) -> str:
    sections = [BASE_PROMPT]
    if challenge:
        sections.append(_challenge_section(challenge, domain or {}))
    else:
        sections.append(_generic_section())
    if reflection_context:
        sections.append(_reflection_section(reflection_context))
    if user_context:
        sections.append(_user_progress_section(user_context))
    if profile_context:
        sections.append(_profile_section(profile_context))
    return "".join(sections)


async def get_coach_response(
    user_message: str,
    conversation_history: list[dict],
    challenge: dict | None,
    domain: dict | None,
    user_context: dict | None = None,
    reflection_context: dict | None = None,
    profile_context: dict | None = None,
) -> dict:
    """Get a coach reply. user_message is required — synthetic openers
    (when the route wants the coach to open without a real user message)
    are constructed by the caller and passed in here."""
    system_prompt = build_system_prompt(
        challenge=challenge,
        domain=domain,
        user_context=user_context,
        reflection_context=reflection_context,
        profile_context=profile_context,
    )
    messages = [{"role": m["role"], "content": m["content"]} for m in conversation_history]
    messages.append({"role": "user", "content": user_message})

    # Crude timing — prints to stdout so it shows up in the uvicorn log
    print(
        f"[coach] OpenAI request: model={settings.OPENAI_MODEL} "
        f"system_prompt_chars={len(system_prompt)} "
        f"history_msgs={len(conversation_history)} "
        f"max_tokens=350"
    )
    t0 = time.perf_counter()
    response = await client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        max_tokens=350,
        messages=[
            {"role": "system", "content": system_prompt},
            *messages,
        ],
    )
    elapsed = time.perf_counter() - t0
    print(
        f"[coach] OpenAI reply: {elapsed:.2f}s "
        f"prompt_tokens={response.usage.prompt_tokens} "
        f"completion_tokens={response.usage.completion_tokens}"
    )

    content = response.choices[0].message.content.strip()

    return {
        "content": content,
        "usage": {
            "input_tokens": response.usage.prompt_tokens,
            "output_tokens": response.usage.completion_tokens,
        },
    }
