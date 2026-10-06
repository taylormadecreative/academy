"""Every word of the AI 101 course in one place. The class page (/ai101/class/), the stage
(/ai101/class/stage/) and the Prompt Kit PDF (build_prompt_kit.py) all read from here.

EVENT is this run's date and links; everything else is the course. A company run later is a new EVENT
plus their logo, not a rewrite.

Rules for anything added here:
- Plain words a first-timer understands (about 6th-8th grade). Define every AI word the first time it shows up.
- Examples from everyday life as well as work. Never assume they own a business or have used a chatbot.
- Never the list-only price or the Eventbrite code: build_ai101_class.check_public_copy refuses to build.
- Tool menu paths only as checked on TOOLS_CHECKED. Menus move; check again before every run.
"""

EVENT = {
    "slug": "ai101",
    "title": "AI 101",
    "date": "2026-10-09",
    "date_line": "Friday, October 9 · 7 to 8 PM CT",
    "starts_utc": "2026-10-10T00:00:00Z",
    "class_url": "https://taylormadeacademy.com/ai101/class/",
    "page": "/ai101/class/",
    "kit": "/ai101/cheat-sheet.pdf",
    "signup": "/ai101/",
    "replay": "/ai101/replay/",
    "verified_tag": "Verified attendee · Oct 9",
    "next_title": "Build Your First AI Agent",
    "next_when": "Friday, October 23 · 7 to 9 PM CT",
    "next_where": "Online, or in the studio with me",
    "next_href": "/agent/",
}

OUTCOMES = [  # each one is something you can see a person do tonight (the check line of a step, a tap, or a question)
    "Say what a chatbot is, and what an LLM is, in one sentence each.",
    "Write a prompt with all five parts and get a useful first answer.",
    "Change an answer with follow-ups, without starting over.",
    "Check one claim from an AI answer against a second source.",
    "Name three things you never paste into an AI, and how to swap them out.",
    "Find where your tool saves your instructions once.",
]

FOLLOW = {
    "instagram": {"label": "Instagram", "handle": "@taylormade_creative", "url": "https://instagram.com/taylormade_creative"},
    "facebook": {"label": "Facebook group", "handle": "Taylormade Academy", "url": "https://www.facebook.com/groups/taylormadeacademy"},
    "tiktok": {"label": "TikTok", "handle": "@taylormadecreative", "url": "https://tiktok.com/@taylormadecreative"},
    "linkedin": {"label": "LinkedIn", "handle": "Nelson Taylor", "url": "https://linkedin.com/in/taylormademd"},
}
FOLLOW_LINE = "Follow me so you don't lose me after tonight."

TOOL_ORDER = ["claude", "chatgpt", "gemini"]
TOOLS_CHECKED = "2026-10-06"  # fact-checked against each vendor's help pages that day; Gemini Gems become "skills" in November
_TYPE = "Type in the message box at the bottom of the screen. Press Enter, or tap the arrow, to send it."
TOOLS = {
    "claude": {
        "name": "Claude", "site": "claude.ai", "url": "https://claude.ai",
        "signup": "Go to claude.ai, or get the Claude app. Sign up with your email or your Google account. Claude texts a code to your phone to finish signing up, so keep your phone close. Use a regular mobile number. Google Voice and landlines don't work. The free plan is all you need tonight.",
        "type": _TYPE,
        "new_chat": "Tap “New chat” at the top of the menu on the left. On the phone app, open the menu first.",
        "save_once": "Click your initials at the bottom left, then Settings. In the box called “Instructions for Claude,” paste your “About me.” Or make a Project, a folder for one job with its own instructions, and paste it there. Free accounts get up to 5 Projects.",
        "save_short": "Settings → Instructions for Claude, or a Project",
        "upload": "Tap the + next to the message box to add a photo or a PDF.",
        "voice": "In the Claude phone app, tap the voice button (the sound-wave icon) in the message box and just talk.",
        "limit": "The free plan lets you send a certain number of messages every few hours. If you hit the limit, wait a bit or switch to ChatGPT or Gemini. The prompts work in all three.",
    },
    "chatgpt": {
        "name": "ChatGPT", "site": "chatgpt.com", "url": "https://chatgpt.com",
        "signup": "Go to chatgpt.com, or get the ChatGPT app. Sign up with your email, or your Google, Microsoft or Apple account. Free is fine.",
        "type": _TYPE,
        "new_chat": "Tap “New chat” (the pencil icon) at the top left.",
        "save_once": "On the website: Settings, then Personalization, then Custom instructions. In the phone app: Settings, then Customize ChatGPT. Make sure customization is turned on, paste your “About me,” and save.",
        "save_short": "Settings → Personalization → Custom instructions",
        "upload": "Tap the + next to the message box to add a photo or a file.",
        "voice": "Tap the voice button at the right end of the message box and just talk.",
        "limit": "The free plan doesn't cap everyday text chats right now. It does limit extras like photo and file uploads, images and voice. If you hit a limit, ChatGPT tells you when it resets. Wait a bit, or switch to Claude or Gemini. The prompts work in all three tools.",
    },
    "gemini": {
        "name": "Gemini", "site": "gemini.google.com", "url": "https://gemini.google.com",
        "signup": "Go to gemini.google.com, or get the Gemini app. Sign in with your Google (Gmail) account. Free is fine.",
        "type": _TYPE,
        "new_chat": "On the website, click “New chat” at the top left. If you don't see it, open the menu first. On the phone app, tap “New chat” at the top of the screen.",
        "save_once": "On gemini.google.com: Settings & help, then Personal context, then Add. Paste your “About me” and submit. Or make a Gem on the website: a saved helper with your instructions built in. In November, Google turns Gems into “skills,” and your Gems move over on their own.",
        "save_short": "Settings & help → Personal context",
        "upload": "Tap the + next to the message box to add a photo or a file.",
        "voice": "In the Gemini phone app, tap the Live button (the sound-wave icon) to talk with Gemini out loud.",
        "limit": "The free plan has a usage limit that refreshes every few hours, plus a weekly limit. Gemini tells you when you are close and when it refreshes. If you hit it, wait a bit or switch to Claude or ChatGPT. The prompts work in all three tools.",
    },
}

START_HERE = [
    {"title": "What a chatbot is", "body": "A website or phone app where you type a question and an AI types back. Claude, ChatGPT and Gemini are three of the best known, and all three are free to start. Tonight I use Claude. Pick yours above and this page changes to match it. You'll see two chats tonight: the room chat is where we all talk to each other, and your AI chat is where you talk to the AI."},
    {"title": "Tonight you'll have three things open", "body": "The room, where you watch me. This page, where you copy the prompts. Your AI chat, where you type to the AI. Two devices is easiest: watch the room on your phone or tablet, and use a laptop for this page and your AI chat. One device works too. Watch me first, then try it yourself in the practice time at 7:30. This page keeps every step, so nothing is lost."},
    {"title": "Make a free account", "tool": "signup"},
    {"title": "Stuck on the account?", "body": "Already have Gmail? Pick Gemini above. You sign in with the Google account you already have. Still stuck? Watch the first part and ask in the room chat. Everything tonight works in all three."},
    {"title": "Where you type", "tool": "type"},
    {"title": "Start a new chat", "tool": "new_chat"},
    {"title": "How to copy and paste", "body": "Tap Copy under a prompt. Switch to your AI chat and tap the message box. On a laptop, press Ctrl and V. On a Mac, press Command and V. On a phone, press and hold in the message box, then tap Paste. Then send it."},
    {"title": "One tap before we start", "body": "When you're set up, tap how confident you feel, 1 to 5. It takes five seconds, and you can do it before 7:00.", "link": ("#step-hi", "Go to Step 1")},
]

PARTS = [
    {"key": "role", "letter": "R", "name": "Role", "ask": "Who should the AI act like?",
     "tip": "Start with “You are…”", "placeholder": "a friendly helper for our community group's events"},
    {"key": "task", "letter": "T", "name": "Task", "ask": "The one job you want done. Start with a verb.",
     "tip": "Write… Plan… Explain… Sum up…", "placeholder": "write a reminder text about Sunday's potluck"},
    {"key": "context", "letter": "C", "name": "Context", "ask": "The background: who it's for, what matters, what to avoid.",
     "tip": "What a smart new helper wouldn't know yet.", "placeholder": "it goes to everyone on our list, and we need a head count by Friday"},
    {"key": "format", "letter": "F", "name": "Format", "ask": "How it should look: length, tone, list or paragraph.",
     "tip": "Under 50 words… friendly… as a list…", "placeholder": "under 40 words, warm, and end with how to reply"},
    {"key": "example", "letter": "E", "name": "Example", "ask": "Show it one you like. AI copies examples really well.",
     "tip": "Optional, and the secret weapon.", "placeholder": "(optional) paste a message you liked"},
]

DEMO = {  # the run of show's demos, verbatim
    "bad": "Write a post about my bakery.",
    "parts": {
        "role": "You are a social media writer for a small family bakery.",
        "task": "Write an Instagram caption for our new sweet potato pie.",
        "context": "It's my grandmother's recipe and we only sell it on Fridays. Our customers are busy parents who love comfort food.",
        "format": "Keep it under 60 words, warm and friendly, and end with a question.",
        "example": "Here's a caption we loved last month: \"Saturday mornings smell like cinnamon around here. Come see what's fresh before it's gone. What's your go-to Saturday treat?\"",
    },
    "follow_ups": ["Make it shorter.", "Now write it like a grandmother is talking.", "Give me 3 more options, each with a different opening line."],
    "check": ["Give me 3 facts about the history of Dallas, with a link to a source for each one.",
              "Which of these are you least sure about? Tell me where I can check each one."],
}
DEMO_ALT = {  # the same five parts for someone who isn't a business owner (the builder's placeholders match it)
    "label": "Not a business owner? Same five parts, a different life.",
    "parts": [("role", "You are a friendly helper for our community group's events."),
              ("task", "Write a reminder text about Sunday's potluck."),
              ("context", "It goes to everyone on our list, and we need a head count by Friday."),
              ("format", "Keep it under 40 words, warm, and end with how to reply.")],
}
GOOD = " ".join(DEMO["parts"][p["key"]] for p in PARTS)

ABOUT_ME = ("About me: I'm [YOUR FIRST NAME]. I [WHAT YOU DO, OR WHAT YOU'LL USE AI FOR]. When you answer me, use plain "
            "words, keep it short unless I ask for more, and ask me a question if something isn't clear.")

STEPS = [  # "flow" (optional) orders a step's lines, copy boxes and extras so each instruction sits next to its action
    {"id": "hi", "n": 1, "time": "7:00", "min": 2, "title": "Say hi",
     "do": ["In the room chat, finish this sentence: “I'd love help with ______.” Pick something that takes up your time every week.",
            "Then tap how confident you feel about using AI, from 1 to 5. Already did? You're ahead of me. There's no right answer. It helps me make the class better."],
     "extra": "pulse_before",
     "check": "You said hi in the room chat and tapped your number."},
    {"id": "words", "n": 2, "time": "7:02", "min": 6, "title": "What AI actually is",
     "do": ["AI here means a computer program that can read and write a lot like a person. It learned by reading a huge amount of writing.",
            "Look at the drawing. You type, the AI writes back, and you reply to make it better. That loop is the whole skill.",
            "Now send your first message. Tap Copy, switch to your AI chat, paste it into the message box, and send it:",
            "You'll hear these words everywhere. You don't have to memorize them. They're on your cheat sheet."],
     "prompts": [("Try it", "In two short sentences, explain what you are to someone who has never used AI before.")],
     "flow": [("do", 0), ("do", 1), ("extra", "diagram"), ("do", 2), ("prompt", 0), ("do", 3), ("extra", "words_step2")],
     "check": "You sent your first message, and you can say what a chatbot is in one sentence."},
    {"id": "prompt5", "n": 3, "time": "7:08", "min": 11, "title": "The 5-part prompt",
     "do": ["Most AI answers come out bland for one reason: the AI only knows what you tell it.",
            "First, paste the bland prompt into your AI chat and read the answer. It could be anybody's bakery.",
            "Then start a new AI chat and paste the 5-part prompt. Same request, now with a Role, a Task, the Context, a Format and an Example."],
     "prompts": [("The bland one", DEMO["bad"]), ("The 5-part one", GOOD)],
     "flow": [("do", 0), ("do", 1), ("prompt", 0), ("do", 2), ("prompt", 1), ("extra", "parts"), ("extra", "parts_alt")],
     "check": "You saw a bland answer turn into one that sounds like a real bakery, and you can name the five parts."},
    {"id": "steer", "n": 4, "time": "7:19", "min": 5, "title": "Steer it",
     "do": ["Don't start over. It's a conversation, so you steer it. A follow-up is a short reply that changes the answer. In the same AI chat, send these one at a time:"],
     "prompts": [("Follow-up 1", DEMO["follow_ups"][0]), ("Follow-up 2", DEMO["follow_ups"][1]), ("Follow-up 3", DEMO["follow_ups"][2])],
     "check": "You changed the answer three times without starting over."},
    {"id": "check", "n": 5, "time": "7:24", "min": 4, "title": "Check it, and keep it safe",
     "do": ["The context window is how much the AI can keep in mind at once. In a very long chat it can lose the start. New job? Start a new chat.",
            "A hallucination is when the AI makes something up and says it like a fact. Names, numbers, dates and links are where it happens most. Try it (use your own town if you like):",
            "Now check one yourself. Open one of the links. Does the page really say that? Some tools search the web and show real links. Check anyway. Then paste this:",
            "Asking the AI “Are you sure?” helps, but it isn't proof. Proof is a second source you find yourself.",
            "Keep it safe. Before you paste, swap real names, numbers and addresses for [brackets]. What you type is saved by the company that runs the AI, and depending on your settings it can be used to improve the AI. At work, ask one question: “Which AI tools can I use, and what can I put in them?”",
            "Extra, if you have time: a token is a small piece of text. A short word is often one token. A long word can be a few. AI reads, writes and counts in tokens. Type in the box to see it."],
     "prompts": [("Ask for facts and links", DEMO["check"][0]), ("Then ask what to check", DEMO["check"][1])],
     "flow": [("do", 0), ("do", 1), ("prompt", 0), ("do", 2), ("prompt", 1), ("do", 3), ("do", 4), ("extra", "never_paste"), ("do", 5), ("extra", "token_toy")],
     "check": "You opened one source and checked it, and you can name three things you never paste."},
    {"id": "save", "n": 6, "time": "7:28", "min": 2, "title": "Save it once",
     "do": ["Everything you tell the AI about yourself, you can save once. Then every new chat already knows you. Keep it general: your first name and what you do. No address, no account numbers, nothing private. Here's where:"],
     "tool": "save_once",
     "prompts": [("Your “About me” (fill in the brackets)", ABOUT_ME)],
     "check": "You found where your tool saves your “About me.”"},
    {"id": "yourturn", "n": 7, "time": "7:30", "min": 11, "title": "Your turn",
     "do": ["Pick one real task from your week. Use the one you named at 7:00 if you can.",
            "Fill in the five boxes. Use made-up names and numbers, or swap real ones for [brackets]. Your prompt builds itself.",
            "Copy it, paste it into your AI chat, and send it. Read the answer, then reply once to make it better. Ask yourself: which part of my prompt would fix what's wrong?",
            "Want to share? Paste one line from the AI's answer in the room chat, only if it has nothing private in it. The class is recorded. Proud of it? Post it to your story and tag @taylormade_creative."],
     "extra": "builder",
     "ideas": ["A thank-you text to a client or a friend", "A flyer for a church or community event", "A weekly meal plan on a budget",
               "A reply to an upset customer", "A birthday message for someone you love", "An email asking for a day off"],
     "check": "You wrote your own 5-part prompt, made the answer better once, and can name the part you'd change next."},
]

# The proof (js/ai101-proof.js → ea_pulse_save in 0059). The 1-5 is asked before (7:00) and after (7:41, before the
# pitch). The taps and the 3 questions are what a company asks for: can they do it, not only do they feel able.
PULSE_Q = {"before": "How confident are you that you could use AI to get something useful done?",
           "after": "Now, how confident are you that you could use AI to get something useful done?"}
PULSE_ENDS = ("Not at all confident", "Very confident")
PULSE_NOTE = "Your answer stays private. I only share totals."
PRACTICE_TAPS = [  # score = the button's number, 1-based
    {"kind": "useful", "q": "Was the first answer useful?", "labels": ["Not yet", "Almost", "Yes"]},
    {"kind": "steered", "q": "Did you reply to make it better?", "labels": ["Not yet", "Yes"]},
]
CHECK_ITEMS = [  # score = the option picked (1-based); "right" is the right one. Your first answer is the one that counts.
    {"kind": "chk_safe", "outcome": 5, "q": "Your company allows AI for writing help. A customer sends you an angry email. What do you paste into the AI?",
     "options": ["The whole email, with their name and account number", "The email, with their name and account number swapped for [brackets]", "Only their account number"],
     "right": 2, "yes": "Right. Swap real names and numbers for [brackets] first.", "no": "Not quite. Swap real names and numbers for [brackets] before you paste."},
    {"kind": "chk_verify", "outcome": 4, "q": "The AI gives you a number and says where it came from. What's the best next step?",
     "options": ["Use it. It sounded sure.", "Ask the AI “Are you sure?” and use it if it says yes.", "Open the source yourself and see if it says that."],
     "right": 3, "yes": "Right. Proof is a second source you find yourself.", "no": "Not quite. “Are you sure?” helps, but proof is a second source you find yourself."},
    {"kind": "chk_prompt", "outcome": 2, "q": "The AI's answer is too generic. Which of these will most likely fix it?",
     "options": ["Ask the same thing again", "Add who it's for, and show it one you like", "Switch to a different AI"],
     "right": 2, "yes": "Right. Tell it who it's for and show it an example. The AI only knows what you tell it.", "no": "Not quite. Add the Context and an Example. The AI only knows what you tell it."},
]

FOLLOW_UPS = [
    "Make it shorter.", "Make it sound like me: [HOW YOU TALK].", "Give me 3 more options.", "Explain that more simply.",
    "Put that in a table.", "Ask me 3 questions first, then try again.", "Make it warmer.", "Make it more professional.",
    "What's missing?", "Turn it into a checklist.",
]

LIBRARY = [
    {"group": "At work", "items": [
        {"title": "A clear email", "prompt": "You are a friendly, professional coworker. Write an email to [WHO] about [WHAT]. They need to know [THE KEY DETAILS]. Keep it under 120 words, polite and direct, and end with a clear ask."},
        {"title": "Meeting notes into a summary", "prompt": "Here are my notes from a meeting: [PASTE YOUR NOTES, WITH NO PRIVATE OR CUSTOMER INFORMATION]. Turn them into a short summary with three parts: what we decided, who is doing what, and by when. Use bullet points.",
         "note": "Only if your company allows AI for work notes. Take out names, numbers and anything confidential first."},
        {"title": "Reply to an upset customer", "prompt": "You are a calm, kind customer service writer. A customer wrote this: [PASTE THEIR MESSAGE, WITH THEIR NAME AND DETAILS REMOVED]. Write a reply that says sorry, explains what happens next, and offers [WHAT YOU CAN DO]. Under 100 words."},
        {"title": "Show a new coworker the ropes", "prompt": "I need to teach a new coworker how to [TASK]. Write a simple, numbered checklist they can follow on their first day. Use plain words, and add one tip for the step people usually get wrong."},
        {"title": "Plan a hard conversation", "prompt": "I need to talk to [WHO] about [THE ISSUE]. Help me plan it. Give me an opening line, three points to cover, and two calm answers if they push back.",
         "note": "Leave out real names and private details. For serious issues at work, talk to HR first."},
        {"title": "A job post", "prompt": "Write a job post for a [ROLE] at [YOUR KIND OF WORKPLACE]. Must-haves: [LIST]. Pay: [RANGE]. Keep it friendly and plain, under 200 words, with a short “what a day looks like” section.",
         "note": "AI can repeat unfair patterns from what it learned. Read it for wording that leaves people out. Don't use AI to choose between job candidates."},
    ]},
    {"group": "Your own business", "items": [
        {"title": "A social media caption", "prompt": "You are a social media writer for [YOUR BUSINESS]. Write an Instagram caption about [WHAT YOU'RE POSTING]. My customers are [WHO THEY ARE]. Keep it under 60 words, warm, and end with a question."},
        {"title": "Answers to the questions you always get", "prompt": "Here are the questions my customers ask most: [LIST THEM]. Write a short, friendly answer to each one that I can save and paste whenever someone asks."},
        {"title": "A no-pressure follow-up", "prompt": "Write a short text to someone who asked about [YOUR SERVICE] last week but hasn't booked. Friendly, no pressure, under 40 words, ending with one easy next step."},
        {"title": "Flyer words", "prompt": "Write the words for a flyer for [YOUR EVENT OR SALE] on [DATE] at [PLACE]. Give me a headline, three short bullet points and a call to action. Short enough to read from across a room."},
        {"title": "Describe what you do", "prompt": "Write a short description of my [SERVICE OR PRODUCT] for my website. It's for [WHO]. What makes it different: [WHAT]. Two short paragraphs, plain words, no hype."},
        {"title": "Answer a review", "prompt": "A customer left this review: [PASTE THE REVIEW]. Write a thank-you reply under 50 words that sounds like a real person, not a company."},
    ]},
    {"group": "Home and family", "items": [
        {"title": "A meal plan on a budget", "prompt": "Plan 5 weeknight dinners for [NUMBER] people for under $[AMOUNT] total. We like [FOODS]. Allergies or things we don't eat: [LIST, OR NONE]. Give me the meals, then one shopping list grouped by store aisle."},
        {"title": "A birthday message", "prompt": "Write a heartfelt birthday message for my [WHO], who is turning [AGE]. Mention [A FAVORITE MEMORY]. Warm and a little funny, under 80 words."},
        {"title": "A church or community announcement", "prompt": "Write a short announcement for our [CHURCH, CLUB OR GROUP]'s [EVENT] on [DATE]. Say what to bring and who to call with questions. Friendly, under 100 words, and easy to read out loud."},
        {"title": "Help with homework", "prompt": "My child is in [GRADE] and is learning [TOPIC]. Explain it to me in simple words so I can help, then give me 3 practice questions with the answers."},
        {"title": "Plan a trip", "prompt": "Plan a [NUMBER]-day trip to [PLACE] for [WHO'S GOING] on a budget of $[AMOUNT]. We like [THINGS YOU ENJOY]. Give me a simple day-by-day plan, then list which details I should double-check before I book.",
         "note": "AI can get prices and opening hours wrong. Check them before you book."},
        {"title": "A thank-you note", "prompt": "Write a thank-you note to [WHO] for [WHAT THEY DID]. Sincere, not over the top, under 60 words."},
    ]},
    {"group": "Money and time", "items": [
        {"title": "A simple budget", "prompt": "My monthly take-home pay is $[AMOUNT]. My bills are: [LIST EACH ONE AND WHAT IT COSTS]. Build me a simple monthly budget, show what's left over, and give me three realistic ways to save $[AMOUNT] a month.",
         "note": "AI isn't a financial advisor. Use it to organize your numbers, not to make big money decisions."},
        {"title": "Plan your week", "prompt": "Here's everything I need to do this week: [LIST]. I work [YOUR HOURS]. Put it into a realistic day-by-day plan with the most important things first."},
        {"title": "Make a decision", "prompt": "I'm choosing between [OPTION A] and [OPTION B]. What matters most to me: [LIST]. Make a simple pros-and-cons table, then ask me two questions that would help me decide."},
        {"title": "Question a bill", "prompt": "Write a polite letter to [COMPANY] about a charge of $[AMOUNT] on [DATE] that I think is wrong because [REASON]. Ask them to fix it. Under 150 words.",
         "note": "Leave your account number out of the chat. Add it to the letter yourself."},
        {"title": "Cut what you don't use", "prompt": "Here are my monthly subscriptions and what each costs: [LIST]. Ask me how often I use each one, then help me decide what to keep, pause or cancel."},
        {"title": "Turn a big goal into small steps", "prompt": "My goal is [YOUR GOAL] by [DATE]. I have about [TIME] a week for it. Break it into small weekly steps I can actually do."},
    ]},
    {"group": "Learn anything", "items": [
        {"title": "Explain it like I'm new", "prompt": "Explain [TOPIC] to me like I'm brand new to it. Use an everyday example, keep it under 150 words, then ask me one question to check I understood."},
        {"title": "Quiz me", "prompt": "Quiz me on [TOPIC], one question at a time. Wait for my answer, tell me if I'm right, and explain gently if I'm not. Start easy and get harder."},
        {"title": "Learn a new skill in 30 days", "prompt": "I want to learn [SKILL] in 30 days with [TIME] a day. Make me a simple week-by-week plan, and tell me what kinds of free resources to look for."},
        {"title": "Practice a conversation", "prompt": "Pretend you're [WHO, FOR EXAMPLE A HIRING MANAGER FOR A CUSTOMER SERVICE JOB]. Ask me one question at a time, and after each answer give me one tip to do better."},
        {"title": "Make something long short", "prompt": "Sum this up in 5 bullet points a 12-year-old would understand: [PASTE THE TEXT]. Then tell me the one thing I should remember."},
        {"title": "Get ready for a doctor's visit", "prompt": "I have a doctor's appointment about [WHAT'S GOING ON]. Help me write a short list of questions to ask, and what to tell the doctor about how I've been feeling.",
         "note": "AI isn't your doctor. Use it to get ready, then ask your doctor."},
    ]},
]

LEVEL_UPS = [
    {"title": "Have it ask you questions first", "why": "Not sure what to tell it? Let it interview you.",
     "prompt": "Before you answer, ask me 3 questions so you can do this well."},
    {"title": "Show it an example", "why": "AI copies examples really well, so one good example often works better than a long description.",
     "prompt": "Here's one I like: [PASTE IT]. Write mine in the same style."},
    {"title": "Make it sound like you", "why": "Paste a couple of things you wrote and it picks up your voice.",
     "prompt": "Here are two messages I wrote: [PASTE THEM]. Write the next one in my voice. It's about [WHAT]."},
    {"title": "Use your own language", "why": "Write to it in Spanish, Vietnamese or any language you're comfortable in, and ask it to answer the same way. Have a person check anything important.",
     "prompt": "Please answer in [YOUR LANGUAGE], in plain words: [YOUR QUESTION, OR THE TEXT TO EXPLAIN]."},
    {"title": "Give it a photo or a PDF", "why": "It can read a letter, a menu, a form or a screenshot. Cover anything private first.",
     "prompt": "Explain this in plain words. What do I need to do, and by when?", "tool": "upload"},
    {"title": "Talk to it out loud", "why": "On your phone you can talk instead of type. Great for practicing a conversation.",
     "tool": "voice"},
]

TEN_THINGS = [
    ("How you ask decides what you get.", "A clear, detailed ask gets a clear, useful answer."),
    ("It can be wrong and sound sure.", "Check names, numbers, dates and links before you use them."),
    ("It's a conversation, not a search.", "Reply to make the answer better. You don't have to start over."),
    ("Give it context and an example.", "Tell it who it's for and what matters. An example is one of the most reliable ways to steer an answer. A role sets the voice."),
    ("Slow it down on hard problems.", "“Think it through step by step” can help with math, plans and tricky questions. Some tools also have a Thinking mode."),
    ("It doesn't know everything recent.", "Its knowledge stops at a date. For anything new, give it the facts, or ask it to search the web if your tool can."),
    ("Keep private things out.", "No passwords, Social Security or bank numbers, or other people's private information. Swap real names and numbers for [brackets] first."),
    ("You're the one in charge.", "You're responsible for what you send, post or act on. Read every answer first."),
    ("Use it for a first draft.", "Ideas, drafts, summaries and explanations. Then add your own judgment."),
    ("It keeps getting better.", "What's hard for it today may be easy next month. Keep trying new things."),
]

FIX_IT = [
    ("The answer is too generic.", "Add the Context and an Example. Or say: “Ask me 3 questions first, then try again.”"),
    ("It made something up.", "Ask: “Which parts should I check, and where?” Don't trust a “yes, I'm sure.” Check names, numbers, dates and links in a second source you find yourself."),
    ("I hit a limit.", "Free plans have limits. It can be how much you send, or extras like photos, images and voice. The tool tells you when it resets. Wait a bit, or switch tools. Your prompts work in all three."),
    ("It says it can't help.", "Say what you need and why, in plain words. It may say no on purpose to anything harmful. For medical, legal or money questions, it can help you get ready, but don't rely on it as professional advice."),
    ("It forgot what I said earlier.", "Long chats can lose the start. Open a new chat and paste a short summary of what matters."),
    ("I lost my chat.", "Your old chats are listed in the menu on the left. On the phone, open the menu first. Chats you start in Incognito or Temporary mode are not saved. Keep your best prompts in a note on your phone so you can reuse them."),
]

NEVER_PASTE = [
    "Passwords, PINs or security codes",
    "Social Security, bank or card numbers",
    "Other people's private information, like health details, addresses or phone numbers",
    "Customer or client information",
    "Employee information, like reviews, pay or medical notes",
    "Company secrets. At work, follow your company's AI rules.",
]
NEVER_PASTE_SLIP = "Pasted something by mistake? Delete that chat. At work, tell your manager or IT right away."

WORDS_FULL = [
    ("AI", "Computer programs that do things that used to take a person, like writing, answering questions and summing things up."),
    ("Generative AI", "AI that makes something new: words, pictures, video or music."),
    ("Chatbot", "An AI you talk to by typing. Claude, ChatGPT and Gemini are chatbots."),
    ("Prompt", "What you type to the AI: your instructions and your question."),
    ("Follow-up", "Your reply that steers the answer, like “shorter” or “give me 3 more”."),
    ("Model", "The “brain” behind the chatbot. Some models are faster, some are smarter."),
    ("LLM", "Large Language Model. The kind of model behind chatbots. It learned from a huge amount of writing."),
    ("Training data", "Everything the model learned from. It's why AI can be out of date."),
    ("Token", "A small piece of text: a short word, part of a longer word, or a mark like a period. AI reads, writes and counts in tokens."),
    ("Context window", "How much the AI can keep in mind at once. Very long chats can forget the start."),
    ("Hallucination", "When AI makes something up and says it like a fact. That's why you check."),
    ("Custom instructions", "Your background and rules, saved once so you don't retype them. They carry into your new chats. A Claude Project is similar, but only for chats inside that Project."),
    ("Agent", "An AI set up to do a whole job for you. It can use tools and take steps on its own. Set it up once, and it can do the job again and again. That's the October 23 workshop."),
]
WORDS_STEP2 = ["AI", "Generative AI", "Chatbot", "Prompt", "Model", "LLM"]

WHATS_NEXT = {
    "agent_h": "Next: build an AI that does the job for you.",
    "agent_p": "You saw tonight how to save your “About me” once. An agent saves a whole job: who it is, the steps, and how the answer should look. You hand it the details, and it does the job the same way every time. No code.",
    "replay_p": "Tonight is recorded. If you want to watch it again, the replay is inside the Academy for members. Every prompt from tonight stays free on this page.",
    "team_p": "Want AI 101 for your team at work? Reply to your sign-up email with the word TEAM. I'll send you the outline: what people learn, how we measure it, and how your company's AI rules come first.",
}

ACCESS = ("The room doesn't have live captions yet. Everything I show on screen is also on this page as text, and you can use "
          "this page with a keyboard or a screen reader. Need something else to take part? Reply to your sign-up email.")

STAGE = {  # every word on Nelson's screen (/ai101/class/stage/) that isn't already above
    "soon_h": "AI 101 starts at 7:00 PM CT",
    "soon_sub": "Open your class page now, and grab a free Claude account at claude.ai. Keep your phone close: it texts you a code.",
    "title_kicker": "Free live class · Taylormade Academy",
    "title_sub": "Tonight: how to ask, the words everyone uses, and your first great prompt. We end at 8:00.",
    "title_tap": "On your class page: tap how confident you feel, 1 to 5.",
    "chat_prompt": "Write a thank-you note to my neighbor.",
    "chat_answer": "Thank you so much for watering my plants while I was away. They look happier than ever, and so do I. You're the best neighbor on the block!",
    "chat_loop": "Reply to make it better.",
    "words": [("AI", "Programs that read and write a lot like a person."),
              ("Generative AI", "AI that makes something new: words, pictures, video, music."),
              ("LLM", "Large Language Model. It learned from a huge amount of writing.")],
    "words_data": "Training data",
    "words_chatbot": "Chatbot = the app you type into. The model = the brain inside it.",
    "bland_left_h": "Write a post about my bakery.",
    "bland_left_note": "Could be anybody's bakery.",
    "bland_right_h": "+ who it's for · what's special · how long · an example",
    "bland_right_note": "Sounds like YOUR bakery.",
    "bland_foot": "The AI only knows what you tell it.",
    "steer_answer": "Our sweet potato pie is here! It's my grandmother's recipe, baked fresh every Friday and gone by Saturday. Busy week? Let us handle dessert. Swing by for a slice, or the whole pie, and taste a little bit of home. What's your favorite comfort food?",
    "steer_short": "Grandma's sweet potato pie is back, Fridays only. Grab a slice before it's gone! What's your go-to comfort food?",
    "steer_grandma": "Come on by, friends. The sweet potato pie is ready. It's my grandmother's recipe, made with love every Friday, and it goes fast. Stop in and get a slice while it's warm. What did your grandmother bake best?",
    "steer_options": ["Friday just got sweeter.", "Grandma's pie is back.", "Warning: this pie sells out."],
    "steer_note": "Example answers. Yours will be different.",
    "tokens_sentence": "Write a thank-you note to my neighbor.",
    "tokens_h": "A token is a small piece of text.",
    "tokens_sub": "AI reads, writes and counts in tokens.",
    "window_h": "The context window",
    "window_sub": "How much the AI can keep in mind at once.",
    "window_words": "My name is Ann . I run a food truck in Dallas . We sell tacos on weekends . Help me write a menu for Friday . Make it shorter . Add prices . Now write a post about it .",
    "window_tip": "Very long chats can lose the start. New job? New chat.",
    "check_h": "A chatbot predicts the next word.",
    "check_sentence": "The best pie in Texas is made in",
    "check_fill": "Dallas",
    "check_guesses": [("Dallas", 62), ("Austin", 48), ("Houston", 40), ("my kitchen", 22)],  # bar lengths only: an illustration, not real odds
    "check_guess_note": "Example guesses, not real numbers.",
    "check_claim": "73% of small businesses used AI last year, according to the Bluebonnet Business AI Index.",
    "check_claim_note": "Sounds sure. Has a source. A made-up example of a hallucination. The number and the source are both fake.",
    "check_list": ["Names", "Numbers", "Dates", "Links"],
    "safe_h": "Never paste:",
    "safe_items": ["Passwords", "Social Security, bank and card numbers", "Other people's private info", "Customer and client info", "Employee info", "Company secrets"],
    "safe_foot": "Swap real names and numbers for [brackets]. At work, follow your company's AI rules.",
    "save_card": "About me: I'm Nelson. I teach AI at Taylormade Academy. Keep answers short and in plain words.",
    "save_h": "Save it once. Every chat knows you.",
    "yourturn_h": "Your turn",
    "yourturn_share": "Share one line from the answer, only if it has nothing private. Post it to your story and tag @taylormade_creative.",
    "qa_h": "Questions?",
    "qa_sub": "First, tap your 1 to 5 again on your class page. Then ask in the chat. I'll take the quickest ones first.",
    "next_card": "You are a friendly assistant for my business. Write a follow-up text to a customer who asked about…",
    "next_h1": "Doing the same job again and again?",
    "next_jobs": ["Follow-up sent", "Caption written", "Question answered"],
    "next_h2": "An agent saves the whole job. You hand it the details.",
    "bye_h": "Before you go",
    "bye_sub": "If tonight helped, leave a review. It takes a minute.",
    "bye_thanks": "Thank you. See you on the 23rd.",
}
