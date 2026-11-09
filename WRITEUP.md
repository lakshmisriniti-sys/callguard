# CallGuard: a voice co-pilot that whispers when a call turns into a scam

**Track:** Security (with Real-Time Assistance) · **Author:** Lakshmi

## The problem

Phone scams work *during* the call. A caller says they're from the bank's fraud team, creates panic ("a payment goes through in ten minutes"), and talks the victim into reading out a one-time code or moving savings to a "safe account". Caller ID and spam labels help before the phone is answered. Once a number is spoofed or the call is picked up, though, the victim is alone with a skilled manipulator, and the people most often targeted are older people, who may also have low vision or hearing loss.

## Who it's for

People who are likely targets, such as an elderly parent living alone, and the family members who worry about them.

## What I built

A working web prototype. You put the call on speaker next to a laptop or tablet running CallGuard, and it:

1. **Transcribes the call live** in the browser (Web Speech API).
2. **Spots manipulation tactics in two layers.** An on-device rule set reacts within milliseconds to clear red flags (code requests, gift cards, remote-access apps, "don't tell the bank"). An LLM (Gemini on its free tier, or Claude) then judges the whole conversation in context and returns structured JSON: a risk score, the tactics, the line that gave it away, a whisper, and a sentence to say.
3. **Whispers to the user.** A soft chime, then a calm sentence such as *"Real banks never ask for your code. Don't read it out."*, followed by *"You can say: I don't share codes on the phone. I'll call my bank on the number on my card."*
4. **Alerts a trusted contact** automatically when the call is very likely a scam (simulated in the prototype).

There are two built-in demo calls. A bank-impersonation scam escalates to *Likely a scam*, and a GP-surgery reminder stays *Sounds OK*, to show it doesn't raise false alarms.

## Why voice is the right interface here

* **Eyes and hands are busy.** The user is holding a conversation, often with the phone at their ear. They won't read a pop-up mid-call, but they will hear a calm voice.
* **It has to be real-time.** The danger lasts seconds ("read me the code"). A warning after the call is too late.
* **Accessibility.** Many targets have poor eyesight or little confidence with apps. Speech needs no reading, tapping or menus.
* **It gives the user the words.** Victims often know something is off but feel too polite to hang up. A ready-made sentence to say out loud gives them a script and the permission to end the call.

## Design decisions

* **Fast rules plus an LLM's judgement** gives an instant first warning and context-aware accuracy (a real bank call can mention "your account"). If the model is slow or unavailable, the rules still protect the user.
* **Free to run.** The default model is Gemini on its free tier, and the provider can be swapped for Claude behind the same schema.
* **Treat the caller's words as untrusted input.** The transcript is speech from an attacker, so the prompt treats instructions inside it as a scam signal (a defence against prompt injection).
* **Don't nag.** The app only speaks when danger rises or a new kind of warning appears, and it pauses the microphone while it speaks so it never transcribes itself.
* **Privacy.** CallGuard stores no audio or transcripts, and the API key never reaches the browser. The prototype relies on cloud speech recognition and the free Gemini tier. A real product would move speech-to-text onto the device and use a no-retention API tier.

## What I'd do next with more time

1. **Run on the phone itself**: an Android in-call service or iOS Live Activity, whispering through the earpiece only, so the caller can't hear.
2. **Speaker separation** (diarisation), so only the caller is judged and the user's own words are ignored.
3. **Synthetic-voice detection** on the caller's audio, so it can say "this voice may be AI-generated", plus number reputation from a Hiya-style caller-ID database.
4. **Real family alerts** via SMS or push, with a one-tap "call Mum now" button.
5. **An evaluation set** of real (anonymised) scam and genuine call transcripts, to measure precision and recall and to tune the thresholds and prompt.
6. **Multilingual support**, since many scams target non-native speakers.
