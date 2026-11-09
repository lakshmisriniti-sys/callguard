// On-device scam-tactic detector. Runs instantly in the browser on every utterance
// (no network round trip) and is the server's fallback when Claude is unavailable.
// Shared by the browser and the Node server, so it must stay dependency-free.

export const TACTICS = [
  "urgency",
  "authority_impersonation",
  "unusual_payment",
  "credential_request",
  "secrecy",
  "remote_access",
  "threat_or_fear",
  "too_good_to_be_true",
  "isolation",
];

export const TACTIC_LABELS = {
  urgency: "Pressure to act now",
  authority_impersonation: "Claims to be bank / police / HMRC",
  unusual_payment: "Gift cards, crypto or 'safe account'",
  credential_request: "Asks for a code, PIN or password",
  secrecy: "Tells you to keep it secret",
  remote_access: "Wants control of your device",
  threat_or_fear: "Threats or fear",
  too_good_to_be_true: "Prize or refund too good to be true",
  isolation: "Keeps you from hanging up or asking family",
};

// weight: how much one hit adds. strong: a single hit alone is a serious red flag.
const RULES = [
  { tactic: "urgency", weight: 12, re: /\b(right now|immediately|urgent(ly)?|(within|in) (the next )?(\d+|five|ten|fifteen|twenty|thirty) (minutes|hours)|before it'?s too late|act (fast|quickly)|today only|time is running out)\b/i },
  { tactic: "authority_impersonation", weight: 12, re: /\b(fraud (department|team)|security (team|department)|hmrc|tax office|police|metropolitan police|scotland yard|national crime agency|microsoft (support|technician)|amazon (security|support)|your bank'?s?)\b/i },
  { tactic: "unusual_payment", weight: 30, strong: true, re: /\b(gift cards?|itunes|google play cards?|steam cards?|bitcoin|crypto(currency)?|safe account|secure account|holding account|wire (the )?money|western union|moneygram)\b/i },
  { tactic: "credential_request", weight: 30, strong: true, re: /\b(one[- ]time (pass)?code|verification code|the code (we|i) (just )?sent|(read|tell) me (the|that) (code|number)|six[- ]digit|6[- ]digit|your pin|card pin|password|security number on the back|cvv)\b/i },
  { tactic: "secrecy", weight: 22, strong: true, re: /\b(don'?t tell (anyone|your|the|them|him|her)|keep (this|it) (between us|secret|confidential|to yourself)|do not (tell|inform|speak to) (anyone|the (bank|branch|staff))|if (the )?(bank|cashier) asks)\b/i },
  { tactic: "remote_access", weight: 30, strong: true, re: /\b(anydesk|teamviewer|any desk|team viewer|remote (access|desktop|support)|download (this|an?) (app|program|software)|let me (connect|access|log ?in to) your (computer|phone|device))\b/i },
  { tactic: "threat_or_fear", weight: 15, re: /\b(arrest(ed)?|warrant|court|prosecut\w*|legal action|lose (all )?your (money|savings)|account (will be|has been) (frozen|closed|suspended|compromised)|suspicious (activity|transactions?)|deport\w*)\b/i },
  { tactic: "too_good_to_be_true", weight: 15, re: /\b(you'?ve won|you have won|prize|lottery|refund of|compensation (of|payment)|claim your|free (holiday|iphone))\b/i },
  { tactic: "isolation", weight: 18, re: /\b(don'?t hang up|stay on the line|do not (end|disconnect) (the|this) call|don'?t call (anyone|your (son|daughter|family)))\b/i },
];

const COPY = {
  credential_request: { whisper: "Real banks never ask for your code. Don't read it out.", say: "I don't share codes on the phone. I'll call my bank on the number on my card." },
  unusual_payment: { whisper: "No real bank or police asks for gift cards or transfers.", say: "I won't move any money. I'll call my bank myself." },
  remote_access: { whisper: "Don't install anything. Nobody genuine needs to control your device.", say: "I'm not installing anything. Goodbye." },
  secrecy: { whisper: "Being told to keep secrets is a classic scam sign.", say: "I'm going to talk to my family first. I'll call you back." },
  isolation: { whisper: "You are allowed to hang up. A real caller won't mind.", say: "I'm ending this call now and will call back on an official number." },
  default: { whisper: "This call has warning signs. Take your time.", say: "I'll call you back on the official number." },
};

const PRIORITY = ["credential_request", "unusual_payment", "remote_access", "secrecy", "isolation"];

export function scoreTranscript(lines) {
  const hits = new Map(); // tactic -> { count, evidence }
  for (const line of lines) {
    if (line.speaker && /^(you|me|user)$/i.test(line.speaker)) continue; // only judge the caller
    for (const rule of RULES) {
      const m = line.text.match(rule.re);
      if (!m) continue;
      const h = hits.get(rule.tactic) || { count: 0, evidence: line.text, rule };
      h.count += 1;
      hits.set(rule.tactic, h);
    }
  }

  let risk = 0;
  let strong = 0;
  for (const { count, rule } of hits.values()) {
    risk += rule.weight * Math.min(count, 2);
    if (rule.strong) strong += 1;
  }
  if (strong > 0) risk = Math.max(risk, 55 + 15 * (strong - 1));
  if (hits.size >= 3) risk += 10; // several tactics together is the real tell
  risk = Math.min(100, risk);

  const tactics = [...hits.keys()];
  const verdict = risk >= 70 ? "likely_scam" : risk >= 40 ? "suspicious" : risk >= 15 ? "unclear" : "safe";
  const lead = PRIORITY.find((t) => hits.has(t)) || tactics[0];
  const copy = COPY[lead] || COPY.default;
  const flagged = verdict === "suspicious" || verdict === "likely_scam";

  return {
    risk,
    verdict,
    tactics,
    evidence: lead ? hits.get(lead).evidence : "",
    whisper: flagged ? copy.whisper : "",
    say_this: flagged ? copy.say : "",
    family_summary: tactics.length
      ? `A caller is using scam tactics: ${tactics.map((t) => TACTIC_LABELS[t]).join("; ")}.`
      : "No warning signs so far.",
  };
}
