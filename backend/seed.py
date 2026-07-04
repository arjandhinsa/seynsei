"""
Seed script for Seynsei's gamified v1.

Populates the database with:
- 40 challenges (20 Social + 20 Dating, across 5 tiers; social 5/5/4/4/2, dating 3/2/5/6/4)
- 18 achievements (first-time milestones, volume, streaks, XP, repetition, balance)

Usage:
  python seed.py                    # seed only if tables are empty (safe to re-run)
  python seed.py --wipe             # DESTRUCTIVE (DEV ONLY): drop all tables, run
                                    # `alembic upgrade head`, reseed catalogue.
  python seed.py --sync-challenges  # sync live table to this catalogue (matched on
                                    # domain+name): inserts new, updates tier/xp/text/
                                    # order of existing. Never deletes.
"""
import argparse
import asyncio
import subprocess

from sqlalchemy import select, func, text

from app.database import engine, Base, SessionLocal
# Importing from app.models triggers models/__init__.py, which imports every
# model class — so SQLAlchemy's mapper is fully configured before we seed.
from app.models import Achievement, Challenge


# Tier → default XP value. Stored per-challenge on Challenge.xp_value so
# individual challenges can be tuned later without being locked to the
# tier default. The seed uses this map as the source of truth.
TIER_XP = {1: 1, 2: 5, 3: 15, 4: 50, 5: 100}


# ============================================================================
# CHALLENGES — 40 total, distribution: social 5/5/4/4/2, dating 3/2/5/6/4.
# ============================================================================
SEED_CHALLENGES = {
    "social": [
        # --- Tier 1: Presence ---
        {
            "tier": 1,
            "name": "Hold eye contact for three seconds",
            "description": "When you pass someone or speak to a cashier, hold eye contact for a full three-Mississippi before looking away.",
            "tip": "A quick glance and nod counts if three seconds feels too long today.",
            "rationale": "Eye contact avoidance is one of the most reinforced safety behaviours in social anxiety. Holding contact without escape collects evidence that nothing bad happens.",
            "safety_behaviour_targeted": "Breaking eye contact the moment it registers",
            "cognitive_distortion_challenged": "Assuming they must be judging me",
        },
        {
            "tier": 1,
            "name": "Smile at someone you pass",
            "description": "Deliberately smile at someone you cross paths with today. Just a small, brief smile. Keep walking.",
            "tip": "A half-smile at someone who already looks friendly is a perfect start.",
            "rationale": "Introduces a positive signal without commitment to conversation. Builds a felt sense that strangers are, on the whole, safe.",
            "safety_behaviour_targeted": "Keeping a neutral or closed face in public",
            "cognitive_distortion_challenged": "Assuming they'll think I'm weird",
        },
        {
            "tier": 1,
            "name": "Eat or drink alone somewhere public",
            "description": "Sit in a café, park, or canteen and have something on your own. No phone as a shield, just be there.",
            "tip": "Ten minutes is plenty. A takeaway coffee on a bench counts.",
            "rationale": "Being alone in public triggers a fear of looking friendless. Sitting with it collects evidence that nobody is actually watching or judging.",
            "safety_behaviour_targeted": "Using your phone as a shield so you never look 'alone'",
            "cognitive_distortion_challenged": "Believing everyone can tell I have no one to be with",
        },
        {
            "tier": 1,
            "name": "Arrive somewhere on your own",
            "description": "Turn up to a place, like a class, an event, or a café meetup, by yourself rather than waiting to walk in with someone.",
            "tip": "Arriving five minutes early, so the room fills up around you, is often the easier version.",
            "rationale": "The walk-in alone is where anticipatory dread peaks. Doing it proves the feared spotlight moment passes in seconds.",
            "safety_behaviour_targeted": "Only going places when you can enter alongside someone",
            "cognitive_distortion_challenged": "Assuming everyone notices and pities the person who walks in alone",
        },
        {
            "tier": 1,
            "name": "Write or type while others could see",
            "description": "Journal, take notes, or type on your laptop somewhere public where people could glance over. Let yourself be watched.",
            "tip": "A corner seat still counts. You don't need to sit centre stage.",
            "rationale": "Fear of being observed while doing a task keeps you hidden. Being visibly at work, and fine, weakens the scrutiny belief.",
            "safety_behaviour_targeted": "Only writing or typing where nobody can possibly see the screen",
            "cognitive_distortion_challenged": "Believing people are watching and evaluating what I'm doing",
        },
        # --- Tier 2: Scripted ---
        {
            "tier": 2,
            "name": "Order something and ask one follow-up question",
            "description": "Order at a café or shop and ask one follow-up: what's in it, which is their favourite, anything real.",
            "tip": "Any genuine question works. 'What do you recommend' is always valid.",
            "rationale": "Pushes past the rehearsed transaction into a tiny real exchange. Low-stakes and high-frequency training.",
            "safety_behaviour_targeted": "Rehearsing the exact order to avoid improvisation",
            "cognitive_distortion_challenged": "Worrying I'll sound stupid if I ad-lib",
        },
        {
            "tier": 2,
            "name": "Compliment a staff member genuinely",
            "description": "Tell someone serving you something real: 'great playlist', 'love this place', 'you made my day'. Mean it.",
            "tip": "One sentence is enough. You don't have to wait for a reply.",
            "rationale": "Practises warmth in a setting where the other person is professionally receptive. Low rejection risk, real expression.",
            "safety_behaviour_targeted": "Nodding and leaving without speaking beyond the transaction",
            "cognitive_distortion_challenged": "Thinking my positivity will sound hollow",
        },
        {
            "tier": 2,
            "name": "Make a phone call to book something",
            "description": "Ring a restaurant, salon, or clinic and book, ask a question, or check opening times. Out loud, on the phone, not online.",
            "tip": "Jot the first line down beforehand if it helps. 'Hi, I'd like to book a table' is a fine script.",
            "rationale": "Calls remove the safety net of editing your words, so anxiety pushes everything online. A short scripted call rebuilds tolerance for real-time voice.",
            "safety_behaviour_targeted": "Booking everything online to avoid speaking on the phone",
            "cognitive_distortion_challenged": "Believing I'll freeze or fumble my words on a call",
        },
        {
            "tier": 2,
            "name": "Ask a stranger for help or directions",
            "description": "Ask someone nearby for directions, the time, or where to find something in a shop, even if you don't strictly need to.",
            "tip": "Staff are the gentle version. A shop assistant is paid to be asked.",
            "rationale": "Asking for help means briefly needing something from another person, which anxiety codes as an imposition. Small asks show most people are glad to help.",
            "safety_behaviour_targeted": "Working things out alone to avoid ever bothering anyone",
            "cognitive_distortion_challenged": "Believing I'm a nuisance for asking",
        },
        {
            "tier": 2,
            "name": "Send a voice note instead of typing",
            "description": "Reply to a friend with a short voice note rather than a text. Say it once, send it, no re-recording.",
            "tip": "Fifteen seconds is enough. Rambling a little is completely fine.",
            "rationale": "Voice notes expose your unedited voice and pace, which text lets you hide. The 'no re-record' rule targets the perfectionism underneath.",
            "safety_behaviour_targeted": "Re-recording until it sounds 'perfect', or avoiding voice notes entirely",
            "cognitive_distortion_challenged": "Believing my natural voice or delivery is embarrassing",
        },
        # --- Tier 3: Unscripted ---
        {
            "tier": 3,
            "name": "Start a two-line exchange in a queue",
            "description": "While waiting, say one line to the person next to you, about the wait, the weather, the place. Let it end if it ends.",
            "tip": "If they give a one-word reply and turn away, you still did the challenge.",
            "rationale": "Generating conversation without an agenda is the core feared skill. Accepting that it can just end disarms the pressure.",
            "safety_behaviour_targeted": "Pretending to check your phone to avoid initiating",
            "cognitive_distortion_challenged": "Believing awkward silence equals disaster",
        },
        {
            "tier": 3,
            "name": "Show up to a group activity",
            "description": "Sign up for and attend one class, meetup, or club you've been avoiding. Goal: stay the full session.",
            "tip": "You can leave early. Just arriving counts for today.",
            "rationale": "Shared-activity settings reduce the cognitive load of socialising. The activity is the structure. Exposure without direct social demand.",
            "safety_behaviour_targeted": "Avoiding group settings where interaction can't be controlled",
            "cognitive_distortion_challenged": "Thinking if I can't be perfectly social, I shouldn't go",
        },
        {
            "tier": 3,
            "name": "Return an item or make a mild complaint",
            "description": "Take something back, ask for a refund, or point out a small problem, like a wrong order or a cold coffee, calmly and directly.",
            "tip": "One clear sentence does it. 'This isn't quite what I ordered, could you swap it?'",
            "rationale": "Complaining means risking someone's mild displeasure, which anxiety avoids at the cost of your own needs. It shows friction rarely turns into conflict.",
            "safety_behaviour_targeted": "Putting up with the wrong or faulty thing to avoid any fuss",
            "cognitive_distortion_challenged": "Believing standing up for myself makes me difficult or rude",
        },
        {
            "tier": 3,
            "name": "Tell a short story to a group",
            "description": "When a few people are chatting, take the floor for thirty seconds: a small thing that happened to you this week.",
            "tip": "A one-line anecdote counts. You don't need a punchline.",
            "rationale": "Holding a group's attention is a top feared moment because all eyes are on you at once. Doing it briefly shows the spotlight is survivable and often welcomed.",
            "safety_behaviour_targeted": "Only ever reacting to others' stories, never telling your own",
            "cognitive_distortion_challenged": "Believing people will find my story boring or lose interest halfway",
        },
        # --- Tier 4: Initiation with stake ---
        {
            "tier": 4,
            "name": "Start a conversation with someone new",
            "description": "At a café, gym, or event, introduce yourself to someone and chat for at least two minutes. No transactional excuse.",
            "tip": "If the conversation stalls naturally after 90 seconds, that still counts.",
            "rationale": "Full social initiation without a transactional excuse. Tests the core fear of not being interesting enough.",
            "safety_behaviour_targeted": "Staying silent until someone else speaks first",
            "cognitive_distortion_challenged": "Thinking I'm boring and won't have anything to say if I start talking",
        },
        {
            "tier": 4,
            "name": "Organise a small gathering",
            "description": "Invite two or three people for coffee, a walk, or a casual meal. You set the time and place.",
            "tip": "One person counts. Even one person you organised something with is a completion.",
            "rationale": "Shifts from reactive to proactive social role. Being the organiser actually gives you more control, which can reduce anxiety.",
            "safety_behaviour_targeted": "Waiting for others to initiate plans",
            "cognitive_distortion_challenged": "Thinking no one wants to spend time with me",
        },
        {
            "tier": 4,
            "name": "Speak up in a meeting or class",
            "description": "Ask a question, offer an opinion, or add a point in a meeting, seminar, or group where you'd normally stay quiet.",
            "tip": "Building on someone else's point ('to add to that…') is an easier way in than starting cold.",
            "rationale": "Speaking to a captive group with a real point on the line is a core avoidance. It tests whether your contribution is actually as unwelcome as anxiety predicts.",
            "safety_behaviour_targeted": "Staying silent and only speaking one-to-one afterwards",
            "cognitive_distortion_challenged": "Believing my point is obvious, wrong, or not worth the room's time",
        },
        {
            "tier": 4,
            "name": "Disagree with someone politely",
            "description": "When you genuinely see it differently, say so out loud, calmly and kindly, instead of nodding along.",
            "tip": "'I actually see it a bit differently' is a full, complete way to start.",
            "rationale": "Voicing disagreement risks disapproval, so anxiety defaults to false agreement. Doing it gently shows relationships hold weight and can survive difference.",
            "safety_behaviour_targeted": "Agreeing outwardly to keep the peace even when you don't",
            "cognitive_distortion_challenged": "Believing disagreement will make them dislike or reject me",
        },
        # --- Tier 5: Vulnerability ---
        {
            "tier": 5,
            "name": "Share something real with a friend",
            "description": "Tell someone you trust about a struggle or feeling you've been carrying. Not solution-seeking, just 'this has been happening'.",
            "tip": "Start small. One sentence of honesty about something minor is a complete challenge.",
            "rationale": "Emotional exposure. Challenges the core belief that authentic self equals rejection. Vulnerability consistently deepens rather than damages relationships.",
            "safety_behaviour_targeted": "Keeping conversations surface-level",
            "cognitive_distortion_challenged": "Believing if people really knew me, they'd leave",
        },
        {
            "tier": 5,
            "name": "Make a small mistake on purpose in public",
            "description": "Deliberately drop a minor clanger (mispronounce a word, ask an 'obvious' question, fumble your change) and let it just sit there.",
            "tip": "Something tiny counts. Asking the barista to repeat themselves twice is a perfectly good 'mistake'.",
            "rationale": "This is the classic decatastrophising drill: engineer the feared blunder and watch the sky stay up. It teaches that small mistakes cost almost nothing socially.",
            "safety_behaviour_targeted": "Rehearsing and over-checking everything so you never slip up in front of people",
            "cognitive_distortion_challenged": "Believing a small mistake means everyone will think less of me",
        },
    ],
    # The dating ladder follows the real-world sequence: notice people →
    # low-stakes openers → direct interest → the ask and the date itself →
    # aftermath and vulnerability. Nothing assumes a date before Tier 4.
    "dating": [
        # --- Tier 1: Presence, noticing, showing up ---
        {
            "tier": 1,
            "name": "Hold eye contact with someone you find attractive",
            "description": "When you see someone you find attractive, hold eye contact for a full three-Mississippi before looking away.",
            "tip": "You can look away and back. Three seconds total across two glances still counts.",
            "rationale": "Desensitises the intimacy-adjacent freeze response. Attraction-triggered look-away is a learnable override.",
            "safety_behaviour_targeted": "Looking away the instant attraction registers",
            "cognitive_distortion_challenged": "Assuming they'll think I'm creepy for holding it",
        },
        {
            "tier": 1,
            "name": "Smile at someone you're drawn to",
            "description": "When you make eye contact with someone you find attractive, smile briefly. No follow-up required.",
            "tip": "A soft smile counts. It doesn't need to be beaming.",
            "rationale": "Practises expressing positive regard with zero agenda. Decouples attraction from pursuit.",
            "safety_behaviour_targeted": "Maintaining a blank face to avoid revealing interest",
            "cognitive_distortion_challenged": "Assuming they'll be weirded out",
        },
        {
            "tier": 1,
            "name": "Set up or dust off a dating profile",
            "description": "Make or revive a dating profile with recent photos and a bio in your own voice. You don't have to message anyone yet.",
            "tip": "Honest beats impressive. One real hobby and one photo from the last year is a fine start.",
            "rationale": "For avoidant daters the profile itself is the first feared step, because it makes your interest in dating visible. Simply existing on the app is the exposure. Messaging comes later.",
            "safety_behaviour_targeted": "Staying off the apps entirely so interest in dating never becomes visible",
            "cognitive_distortion_challenged": "Believing putting myself out there proves I'm desperate",
        },
        # --- Tier 2: Low-stakes openers ---
        {
            "tier": 2,
            "name": "Start a friendly chat with no agenda",
            "description": "Talk to someone you're drawn to with zero agenda. Just be curious about them as a person.",
            "tip": "Let it be short. Three sentences each and a natural exit is a win.",
            "rationale": "Decouples attraction from performance anxiety. Removing outcome pressure makes you naturally more relaxed.",
            "safety_behaviour_targeted": "Avoiding any conversation with people you find attractive",
            "cognitive_distortion_challenged": "Believing any conversation has to lead somewhere",
        },
        {
            "tier": 2,
            "name": "Compliment their style or energy",
            "description": "Tell someone you're drawn to something specific you appreciate: their style, their energy, something they said. Not about their looks.",
            "tip": "One line is enough. 'I like your energy' or 'that's a great jacket' both work.",
            "rationale": "Practises expressing positive regard observationally rather than objectifying. The 'not their looks' rule lowers your fear of being misread.",
            "safety_behaviour_targeted": "Only saying generic neutral things to avoid specifics",
            "cognitive_distortion_challenged": "Thinking it has to be clever",
        },
        # --- Tier 3: Direct interest ---
        {
            "tier": 3,
            "name": "Keep a conversation past ten minutes with someone you're drawn to",
            "description": "Stay in a conversation with someone you're attracted to past the point your anxiety wants to exit. Notice the pull to bail and stay anyway.",
            "tip": "If they wrap up at 8 minutes, that was them, not you. You still exposed yourself to the stay.",
            "rationale": "Social anxiety wants to exit the moment mutual interest becomes visible. Staying past that reflex is the exposure.",
            "safety_behaviour_targeted": "Making an excuse to end the conversation when heat registers",
            "cognitive_distortion_challenged": "Fearing they'll be uninterested if I stay too long",
        },
        {
            "tier": 3,
            "name": "Express direct interest in continuing to talk",
            "description": "Tell someone you've enjoyed talking to that you'd like to continue the conversation sometime.",
            "tip": "Exact words matter less than intent. 'This was nice, we should do it again' works.",
            "rationale": "Moves from passive hoping to active expression, the core shift for romantic confidence.",
            "safety_behaviour_targeted": "Hoping the other person will signal first",
            "cognitive_distortion_challenged": "Assuming if they wanted to, they'd say so",
        },
        {
            "tier": 3,
            "name": "Say hello when the signals are there",
            "description": "When someone holds your eye contact or returns your smile, go over and say hello instead of noting it and walking away.",
            "tip": "The window can be short and that's fine. 'Hi, I noticed you and thought I'd say hello' is enough.",
            "rationale": "Anxiety discounts even clear signals as accidents, so open invitations pass unused. Acting on one teaches you to trust what you noticed.",
            "safety_behaviour_targeted": "Explaining away returned interest so you never have to act on it",
            "cognitive_distortion_challenged": "Believing I must have misread it and they didn't mean me",
        },
        {
            "tier": 3,
            "name": "Ask for someone's number",
            "description": "Ask someone you've been talking to for their number. Clear, simple, no qualifiers.",
            "tip": "If they decline, you still completed the challenge. The asking is the exposure, not the outcome.",
            "rationale": "A concrete ask with an outcome, but lower-stake than proposing plans. The ask itself is the exposure.",
            "safety_behaviour_targeted": "Waiting for them to offer their number first",
            "cognitive_distortion_challenged": "Assuming they'll say no",
        },
        {
            "tier": 3,
            "name": "Ask someone out on a dating app",
            "description": "When a chat on the app is going well, ask them out: a real plan, a place, a rough day. Don't let it drift into weeks of messaging.",
            "tip": "'Fancy grabbing a coffee this weekend?' is complete. Offering two options can feel easier than one.",
            "rationale": "Endless messaging feels safe but keeps the connection theoretical. Asking through the app is the gentlest version of the real ask, with distance to soften any no.",
            "safety_behaviour_targeted": "Keeping the chat going forever so there's never a moment to be turned down",
            "cognitive_distortion_challenged": "Believing asking will ruin the easy chat we already have",
        },
        # --- Tier 4: The ask, and the date itself ---
        {
            "tier": 4,
            "name": "Go and say hello to someone who catches your eye",
            "description": "When you notice someone you'd like to meet, in a café, bookshop, gym, or gallery, walk over and say hello with something real: an introduction or a genuine question. No waiting for a perfect excuse.",
            "tip": "'Hi, this is a bit out of the blue, but I wanted to say hello' is a complete opener. If they're busy, wish them a good day and go. It counts either way.",
            "rationale": "Waiting for a natural opening that never comes is how attraction stays theoretical. Walking over without one proves the approach itself is survivable, whatever comes of it.",
            "safety_behaviour_targeted": "Only ever talking to people when circumstance hands you an excuse",
            "cognitive_distortion_challenged": "Believing approaching someone unprompted will always be unwelcome",
        },
        {
            "tier": 4,
            "name": "Ask someone on a low-key date",
            "description": "Suggest coffee, a walk, or a specific activity you both enjoy. Keep it casual, but commit to a time and place.",
            "tip": "Specific is easier. 'Coffee Saturday afternoon' beats 'sometime'.",
            "rationale": "Proposes real logistics and an implicit time commitment. Follows naturally from having asked for their number.",
            "safety_behaviour_targeted": "Keeping things vague to avoid a real ask",
            "cognitive_distortion_challenged": "Believing if they say no I'll be humiliated",
        },
        {
            "tier": 4,
            "name": "Hold eye contact across a date",
            "description": "On a date, let your gaze rest on theirs while they talk instead of darting away. Soft and natural, not a staring contest.",
            "tip": "Looking at the bridge of their nose or one eye is a gentler starting point.",
            "rationale": "Sustained eye contact signals interest and presence, which is exactly what intimacy anxiety flees. Holding it lets connection build instead of leaking away.",
            "safety_behaviour_targeted": "Looking at your drink or the room to dodge the intimacy of a held gaze",
            "cognitive_distortion_challenged": "Believing holding their gaze is too intense and will scare them off",
        },
        {
            "tier": 4,
            "name": "Sit with a silence on a date",
            "description": "When a natural pause lands, let it breathe for a beat instead of scrambling to fill it. Let the quiet be okay.",
            "tip": "Even a two-second pause, held on purpose, counts as the exposure.",
            "rationale": "Rushing to fill every gap is a safety behaviour that reads as anxiety. Tolerating silence shows a pause isn't a verdict and often feels comfortable, not fatal.",
            "safety_behaviour_targeted": "Filling every silence immediately so it can't feel awkward",
            "cognitive_distortion_challenged": "Believing a silence means it's going badly or they're bored",
        },
        {
            "tier": 4,
            "name": "Ask a genuine follow-up question on a date",
            "description": "When they share something, ask a real follow-up that goes a layer deeper rather than moving straight to your own turn.",
            "tip": "'What was that like for you?' works for almost anything they mention.",
            "rationale": "Deflecting attention away from the other person is a subtle self-focus safety behaviour. Curiosity pulls you out of your head and into the actual connection.",
            "safety_behaviour_targeted": "Steering off their answers to avoid getting too close or too involved",
            "cognitive_distortion_challenged": "Believing showing real interest makes me look keen or intense",
        },
        {
            "tier": 4,
            "name": "Share an unpopular opinion on a date",
            "description": "Say what you actually think on something light, like a film everyone loves that you didn't, rather than mirroring them.",
            "tip": "Keep it low-stakes. A contrarian food or telly opinion is plenty.",
            "rationale": "Agreeing with everything is a likeability safety behaviour that erases you from the date. A small honest difference tests whether being yourself is actually a dealbreaker.",
            "safety_behaviour_targeted": "Mirroring their opinions so they can't find a reason to go off you",
            "cognitive_distortion_challenged": "Believing they'll only like me if I agree with everything",
        },
        # --- Tier 5: Aftermath and vulnerability ---
        {
            "tier": 5,
            "name": "Check in after a date instead of waiting",
            "description": "Message first after a date to say you enjoyed it, rather than waiting them out to see who breaks first.",
            "tip": "One warm line does it. 'Had a really good time tonight' needs nothing more.",
            "rationale": "The 'never text first' rule is a safety behaviour that trades a shot at connection for protection from looking keen. Reaching out shows interest isn't something to be ashamed of.",
            "safety_behaviour_targeted": "Waiting for them to message first to avoid looking too interested",
            "cognitive_distortion_challenged": "Believing showing I enjoyed it hands them the upper hand",
        },
        {
            "tier": 5,
            "name": "Sit with a non-reply without a follow-up spiral",
            "description": "When a message goes unanswered, leave it. No double-text, no rewriting what you sent, no reading disaster into the silence.",
            "tip": "Notice the urge to 'fix' it and let a full day pass. Doing nothing is the whole challenge here.",
            "rationale": "Chasing and re-analysing a silence is anxiety trying to buy certainty. Tolerating the not-knowing is the exposure, and it proves you can survive an ambiguous outcome.",
            "safety_behaviour_targeted": "Double-texting or re-reading your message to manage the anxiety of no reply",
            "cognitive_distortion_challenged": "Reading a slow or absent reply as proof I've been rejected or done something wrong",
        },
        {
            "tier": 5,
            "name": "Handle rejection with grace",
            "description": "If someone isn't interested, respond with kindness. Thank them for their honesty and move forward without withdrawing bitterly.",
            "tip": "One kind line is enough. 'Thanks for being honest, take care.'",
            "rationale": "The ultimate exposure: facing the feared outcome and surviving it. Your win condition is how you respond, not the outcome itself.",
            "safety_behaviour_targeted": "Avoiding any situation where rejection is possible",
            "cognitive_distortion_challenged": "Taking their rejection as proof I'm unworthy",
        },
        {
            "tier": 5,
            "name": "Tell someone you like them",
            "description": "Tell a person you're into that you like them, clearly and in your own words, before you're certain they feel the same.",
            "tip": "Plain beats poetic. 'I like you, properly, not just as a friend' is complete.",
            "rationale": "Naming your feelings first, without a guaranteed yes, is the deepest romantic exposure there is. Your win is the honesty, not whether it's returned.",
            "safety_behaviour_targeted": "Hinting and hedging so you can never be clearly turned down",
            "cognitive_distortion_challenged": "Believing saying it first, unsure, would be humiliating if it isn't returned",
        },
    ],
}


# ============================================================================
# ACHIEVEMENTS — 18 total across 6 categories.
# ============================================================================
SEED_ACHIEVEMENTS = [
    # First-time tier milestones
    {"code": "first_step",    "name": "First Step",            "description": "Your first completion ever.",           "icon": "🌱",  "condition_type": "total_completions",      "condition_value": 1,   "xp_bonus": 10},
    {"code": "first_tier_2",  "name": "Into the Conversation", "description": "First Tier 2 challenge completed.",     "icon": "💬",  "condition_type": "tier_reached",           "condition_value": 2,   "xp_bonus": 10},
    {"code": "first_tier_3",  "name": "Off-Script",            "description": "First Tier 3 challenge completed.",     "icon": "✨",  "condition_type": "tier_reached",           "condition_value": 3,   "xp_bonus": 25},
    {"code": "first_tier_4",  "name": "Skin in the Game",      "description": "First Tier 4 challenge completed.",     "icon": "⚡",  "condition_type": "tier_reached",           "condition_value": 4,   "xp_bonus": 75},
    {"code": "first_tier_5",  "name": "Vulnerable",            "description": "First Tier 5 challenge completed.",     "icon": "🏆",  "condition_type": "tier_reached",           "condition_value": 5,   "xp_bonus": 150},
    # Volume
    {"code": "completions_5",   "name": "Getting Started", "description": "Complete 5 challenges.",   "icon": "🎯",  "condition_type": "total_completions", "condition_value": 5,   "xp_bonus": 20},
    {"code": "completions_25",  "name": "Committed",       "description": "Complete 25 challenges.",  "icon": "🔨",  "condition_type": "total_completions", "condition_value": 25,  "xp_bonus": 50},
    {"code": "completions_100", "name": "Century Club",    "description": "Complete 100 challenges.", "icon": "💯",  "condition_type": "total_completions", "condition_value": 100, "xp_bonus": 200},
    # Streaks
    {"code": "streak_2",  "name": "Back Again",         "description": "Two days in a row.",   "icon": "🔥",  "condition_type": "streak_days", "condition_value": 2,  "xp_bonus": 10},
    {"code": "streak_7",  "name": "Building Momentum",  "description": "Seven-day streak.",    "icon": "🔥",  "condition_type": "streak_days", "condition_value": 7,  "xp_bonus": 50},
    {"code": "streak_30", "name": "On Fire",            "description": "Thirty-day streak.",   "icon": "🔥",  "condition_type": "streak_days", "condition_value": 30, "xp_bonus": 200},
    # Level / XP milestones — no xp_bonus because the level-up itself is the reward
    {"code": "xp_100",  "name": "Level 2", "description": "Reach 100 total XP.",  "icon": "🥉",  "condition_type": "xp_milestone", "condition_value": 100,  "xp_bonus": 0},
    {"code": "xp_400",  "name": "Level 3", "description": "Reach 400 total XP.",  "icon": "🥈",  "condition_type": "xp_milestone", "condition_value": 400,  "xp_bonus": 0},
    {"code": "xp_1000", "name": "Level 4", "description": "Reach 1000 total XP.", "icon": "🥇",  "condition_type": "xp_milestone", "condition_value": 1000, "xp_bonus": 0},
    {"code": "xp_2000", "name": "Level 5", "description": "Reach 2000 total XP.", "icon": "💎",  "condition_type": "xp_milestone", "condition_value": 2000, "xp_bonus": 0},
    # Repetition — rewards habituation on a single challenge
    {"code": "repeat_10", "name": "10 of a Kind", "description": "Repeat one challenge 10 times.", "icon": "🔁", "condition_type": "challenge_repeat_count", "condition_value": 10, "xp_bonus": 30},
    {"code": "repeat_25", "name": "Habit Formed", "description": "Repeat one challenge 25 times.", "icon": "🌀", "condition_type": "challenge_repeat_count", "condition_value": 25, "xp_bonus": 100},
    # Balance — rewards cross-domain practice
    {"code": "balanced_10", "name": "Balanced", "description": "At least 10 completions in each domain.", "icon": "⚖️", "condition_type": "domain_balance", "condition_value": 10, "xp_bonus": 50},
]


# ============================================================================
# Database operations
# ============================================================================
async def wipe_all():
    """Drop every table, run alembic upgrade head, then reseed.
    DESTRUCTIVE. Only run in dev, or when cutting over to a fresh database."""
    print("[seed --wipe] DESTRUCTIVE — only run in dev. "
          "Drops all tables, recreates via alembic, reseeds catalogue.")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        # Drop alembic_version too — otherwise upgrade head is a no-op
        # because alembic still thinks it's at head.
        await conn.execute(text("DROP TABLE IF EXISTS alembic_version"))
    # Subprocess so alembic owns schema creation end-to-end (same path as prod).
    subprocess.run(["alembic", "upgrade", "head"], check=True)
    print("Database wiped and recreated via alembic.")


async def seed_challenges(session):
    """Insert the master challenge catalog. Skips if challenges already exist."""
    result = await session.execute(select(func.count(Challenge.id)))
    existing = result.scalar() or 0
    if existing > 0:
        print(f"Skipping challenges — already seeded ({existing} rows).")
        return 0

    order = 0
    for domain, challenges in SEED_CHALLENGES.items():
        for c in challenges:
            session.add(Challenge(
                domain=domain,
                tier=c["tier"],
                name=c["name"],
                description=c["description"],
                tip=c.get("tip"),
                rationale=c.get("rationale"),
                safety_behaviour_targeted=c.get("safety_behaviour_targeted"),
                cognitive_distortion_challenged=c.get("cognitive_distortion_challenged"),
                xp_value=TIER_XP[c["tier"]],
                sort_order=order,
            ))
            order += 1
    await session.commit()
    print(f"Seeded {order} challenges across {len(SEED_CHALLENGES)} domains.")
    return order


async def sync_challenges(session):
    """Sync the live table to this catalogue, keyed by (domain, name).

    - New entries are inserted.
    - Existing entries get their tier, xp_value, text fields, and sort_order
      updated to match the catalogue (tiers can be rebalanced over time).
    - Rows in the DB that are no longer in the catalogue are left alone
      (completions may reference them), just reported.
    Never deletes. Safe to run on a populated DB.
    """
    result = await session.execute(select(Challenge))
    by_key = {(row.domain, row.name): row for row in result.scalars().all()}

    inserted = updated = 0
    order = 0
    seen = set()
    for domain, challenges in SEED_CHALLENGES.items():
        for c in challenges:
            key = (domain, c["name"])
            seen.add(key)
            if key in by_key:
                row = by_key[key]
                row.tier = c["tier"]
                row.xp_value = TIER_XP[c["tier"]]
                row.description = c["description"]
                row.tip = c.get("tip")
                row.rationale = c.get("rationale")
                row.safety_behaviour_targeted = c.get("safety_behaviour_targeted")
                row.cognitive_distortion_challenged = c.get("cognitive_distortion_challenged")
                row.sort_order = order
                updated += 1
            else:
                session.add(Challenge(
                    domain=domain,
                    tier=c["tier"],
                    name=c["name"],
                    description=c["description"],
                    tip=c.get("tip"),
                    rationale=c.get("rationale"),
                    safety_behaviour_targeted=c.get("safety_behaviour_targeted"),
                    cognitive_distortion_challenged=c.get("cognitive_distortion_challenged"),
                    xp_value=TIER_XP[c["tier"]],
                    sort_order=order,
                ))
                inserted += 1
            order += 1

    orphans = [k for k in by_key if k not in seen]
    await session.commit()
    print(f"Synced challenges: {inserted} inserted, {updated} updated.")
    if orphans:
        print(f"Left in DB but no longer in catalogue (kept): {orphans}")
    return inserted


async def seed_achievements(session):
    """Insert the achievements catalog. Skips if achievements already exist."""
    result = await session.execute(select(func.count(Achievement.id)))
    existing = result.scalar() or 0
    if existing > 0:
        print(f"Skipping achievements — already seeded ({existing} rows).")
        return 0

    for a in SEED_ACHIEVEMENTS:
        session.add(Achievement(**a))
    await session.commit()
    print(f"Seeded {len(SEED_ACHIEVEMENTS)} achievements.")
    return len(SEED_ACHIEVEMENTS)


async def main(wipe: bool, sync_challenges_only: bool = False):
    if wipe:
        await wipe_all()
    # --sync-challenges is an additive top-up for an already-seeded catalogue:
    # it inserts only the new challenges and leaves everything else alone.
    if sync_challenges_only:
        async with SessionLocal() as session:
            await sync_challenges(session)
        return
    # Non-wipe path assumes the schema already exists. On a fresh checkout
    # run `alembic upgrade head` first, then `python seed.py`. The seed
    # functions skip if catalogue rows are already present.
    async with SessionLocal() as session:
        await seed_challenges(session)
        await seed_achievements(session)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed the Seynsei database.")
    parser.add_argument(
        "--wipe",
        action="store_true",
        help="Drop and recreate all tables before seeding. Destroys user data.",
    )
    parser.add_argument(
        "--sync-challenges",
        action="store_true",
        dest="sync_challenges",
        help="Additively insert only new challenges (matched on domain+name), "
             "leaving existing rows untouched. Does not seed achievements.",
    )
    args = parser.parse_args()
    asyncio.run(main(wipe=args.wipe, sync_challenges_only=args.sync_challenges))