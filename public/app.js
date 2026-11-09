import { scoreTranscript, TACTIC_LABELS } from "./heuristics.js";
import { SCAM_CALL, GENUINE_CALL } from "./demo-scripts.js";

const $ = (id) => document.getElementById(id);
const VERDICT_TEXT = {
  idle: "Not listening",
  safe: "Sounds OK",
  unclear: "Listening carefully",
  suspicious: "Be careful",
  likely_scam: "Likely a scam",
};
const LEVEL = { idle: 0, safe: 0, unclear: 1, suspicious: 2, likely_scam: 3 };

const state = {
  lines: [],             // { speaker, text }
  mode: "idle",          // idle | mic | demo
  ai: false,            // is an AI provider configured on the server?
  latest: null,          // what is on screen now
  aiResult: null,    // last AI result and the transcript length it saw
  aiSeen: 0,
  inFlight: false,
  pending: false,
  spokenLevel: 0,        // highest verdict level already whispered
  spokenWhispers: new Set(),
  familyAlerted: false,
  speaking: false,
  runId: 0,              // bumps to cancel a running demo
};

// ---------- analysis: instant on-device pass, then the AI model's deeper pass ----------

function onNewLine(line) {
  state.lines.push(line);
  renderLine(line);
  const local = scoreTranscript(state.lines);
  if (local.tactics.length && line.speaker !== "You") $("lines").lastElementChild.classList.add("flag");
  apply(combine(local));
  requestAI();
}

// The AI's judgement wins, except that a strong red flag heard after its
// last look must never be hidden while we wait for the next answer.
function combine(local) {
  const c = state.aiResult;
  if (!c) return { ...local, source: "on-device" };
  const newSince = state.lines.length > state.aiSeen;
  if (newSince && local.risk > c.risk) return { ...local, source: "on-device" };
  return c;
}

async function requestAI() {
  if (!state.ai) return;
  if (state.inFlight) { state.pending = true; return; }
  state.inFlight = true;
  const runId = state.runId;
  const seen = state.lines.length;
  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lines: state.lines }),
    });
    const data = await res.json();
    if (runId !== state.runId) return; // call was reset meanwhile
    if (res.ok && data.source !== "heuristic") {
      state.aiResult = { ...data, source: `${data.source === "gemini" ? "Gemini" : "Claude"} · ${data.latency_ms} ms` };
      state.aiSeen = seen;
      apply(combine(scoreTranscript(state.lines)));
    }
  } catch (e) {
    console.warn("analysis request failed", e);
  } finally {
    state.inFlight = false;
    if (state.pending && runId === state.runId) { state.pending = false; requestAI(); }
  }
}

function apply(a) {
  state.latest = a;
  const meter = $("meter");
  meter.dataset.verdict = a.verdict;
  $("meterFill").style.width = `${Math.max(4, a.risk)}%`;
  $("verdict").textContent = VERDICT_TEXT[a.verdict];
  $("riskNum").textContent = `${a.risk}%`;
  $("srcTag").textContent = `checked by ${a.source}`;

  const flagged = LEVEL[a.verdict] >= 2;
  $("whisper").textContent = flagged && a.whisper ? a.whisper : a.verdict === "safe" ? "No warning signs so far." : "Listening for warning signs…";
  $("sayCard").hidden = !(flagged && a.say_this);
  $("sayThis").textContent = a.say_this ? `“${a.say_this}”` : "";
  $("tactics").innerHTML = "";
  for (const t of a.tactics) {
    const li = document.createElement("li");
    li.textContent = TACTIC_LABELS[t] || t;
    $("tactics").appendChild(li);
  }
  $("evidence").textContent = flagged && a.evidence ? `Heard: “${a.evidence}”` : "";
  $("familyBtn").disabled = !flagged;

  maybeWhisper(a);
  if (a.verdict === "likely_scam" && $("autoFamily").checked) alertFamily(a);
}

// ---------- the voice moment: a private, calm whisper ----------

function maybeWhisper(a) {
  if (!$("spokenAlerts").checked || !a.whisper) return;
  const level = LEVEL[a.verdict];
  // Speak when the danger level rises, or when a new kind of warning appears at the same level.
  if (level < 2 || level < state.spokenLevel) return;
  if (level === state.spokenLevel && state.spokenWhispers.has(a.whisper)) return;
  state.spokenLevel = level;
  state.spokenWhispers.add(a.whisper);
  const text = a.say_this ? `${a.whisper} You can say: ${a.say_this}` : a.whisper;
  chime().then(() => speak(text, { role: "guard" }));
}

function chime() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
    return new Promise((r) => setTimeout(() => { ctx.close(); r(); }, 420));
  } catch {
    return Promise.resolve();
  }
}

let voices = [];
function loadVoices() { voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en")); }
if ("speechSynthesis" in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }

function pickVoice(role) {
  if (!voices.length) return null;
  const gb = voices.filter((v) => v.lang === "en-GB");
  const pool = gb.length >= 2 ? gb : voices;
  return { caller: pool[0], you: pool[1] || pool[0], guard: pool[Math.min(2, pool.length - 1)] }[role] || pool[0];
}

// Speaking pauses the microphone so CallGuard never transcribes its own voice.
function speak(text, { role = "guard" } = {}) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(role);
    if (v) u.voice = v;
    u.rate = role === "guard" ? 0.95 : 1.02;
    u.pitch = role === "you" ? 1.15 : role === "caller" ? 0.9 : 1;
    u.volume = role === "guard" ? 1 : 0.9;
    state.speaking = true;
    pauseMic();
    const done = () => { state.speaking = false; resumeMic(); resolve(); };
    u.onend = done;
    u.onerror = done;
    speechSynthesis.speak(u);
  });
}

// ---------- family alert (simulated in the prototype) ----------

function alertFamily(a) {
  if (state.familyAlerted) return;
  state.familyAlerted = true;
  $("familyMsg").textContent = `CallGuard: Mum is on a call that looks like a scam. ${a.family_summary} You may want to ring her now.`;
  $("familyToast").hidden = false;
  setTimeout(() => { $("familyToast").hidden = true; }, 9000);
}
$("familyBtn").onclick = () => { state.familyAlerted = false; if (state.latest) alertFamily(state.latest); };

// ---------- live microphone (Web Speech API) ----------

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
let micWanted = false;

function startMic() {
  if (!SR) {
    $("whisper").textContent = "Live listening needs Chrome or Edge. The demo calls still work.";
    return;
  }
  reset();
  state.mode = "mic";
  micWanted = true;
  rec = new SR();
  rec.lang = "en-GB";
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) {
        const text = r[0].transcript.trim();
        if (text) onNewLine({ speaker: "Call", text });
      } else interim += r[0].transcript;
    }
    $("interim").textContent = interim;
  };
  // Chrome ends recognition after silences; keep it going while we want it.
  rec.onend = () => { if (micWanted && !state.speaking) try { rec.start(); } catch {} };
  rec.onerror = (e) => {
    if (e.error === "not-allowed") { micWanted = false; $("whisper").textContent = "Microphone access was blocked."; setListening(false); }
  };
  rec.start();
  setListening(true);
  $("whisper").textContent = "Listening for warning signs…";
  apply({ ...scoreTranscript([]), verdict: "unclear", source: "on-device" });
}

function pauseMic() { if (rec && micWanted) try { rec.abort(); } catch {} }
function resumeMic() { if (rec && micWanted) try { rec.start(); } catch {} }

function stopAll() {
  micWanted = false;
  state.runId++;
  if (rec) try { rec.abort(); } catch {}
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  state.mode = "idle";
  setListening(false);
  $("interim").textContent = "";
}

function setListening(on) {
  $("listenBtn").textContent = on ? "Stop" : "Start listening";
}

$("listenBtn").onclick = () => (state.mode === "idle" ? startMic() : stopAll());

// ---------- demo mode: a scripted call, read aloud and "transcribed" ----------

async function playDemo(script) {
  stopAll();
  reset();
  state.mode = "demo";
  const runId = state.runId;
  setListening(true);
  $("whisper").textContent = "Playing a demo call…";
  for (const line of script) {
    if (runId !== state.runId) return;
    $("interim").textContent = `${line.speaker}: ${line.text}`;
    const silent = !("speechSynthesis" in window);
    await (silent ? wait(1500) : speak(line.text, { role: line.speaker === "You" ? "you" : "caller" }));
    if (runId !== state.runId) return;
    $("interim").textContent = "";
    onNewLine(line);
    await wait(250);
    // let any whisper finish before the next line, as it would on a real call
    while (state.speaking || ("speechSynthesis" in window && (speechSynthesis.pending || speechSynthesis.speaking))) await wait(150);
  }
  if (runId === state.runId) { state.mode = "idle"; setListening(false); }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
$("demoScam").onclick = () => playDemo(SCAM_CALL);
$("demoSafe").onclick = () => playDemo(GENUINE_CALL);

// ---------- rendering helpers ----------

function renderLine(line) {
  const li = document.createElement("li");
  const b = document.createElement("b");
  b.textContent = line.speaker;
  li.append(b, document.createTextNode(line.text));
  $("lines").appendChild(li);
  $("lines").scrollTop = $("lines").scrollHeight;
}

function reset() {
  Object.assign(state, {
    lines: [], latest: null, aiResult: null, aiSeen: 0, pending: false,
    spokenLevel: 0, spokenWhispers: new Set(), familyAlerted: false,
  });
  $("lines").innerHTML = "";
  $("tactics").innerHTML = "";
  $("evidence").textContent = "";
  $("sayCard").hidden = true;
  $("familyToast").hidden = true;
  $("familyBtn").disabled = true;
  $("meter").dataset.verdict = "idle";
  $("meterFill").style.width = "0";
  $("verdict").textContent = VERDICT_TEXT.idle;
  $("riskNum").textContent = "";
  $("srcTag").textContent = "";
}

fetch("/api/status")
  .then((r) => r.json())
  .then((s) => {
    state.ai = Boolean(s.provider);
    $("engine").textContent = s.provider ? `${s.provider === "gemini" ? "Gemini" : "Claude"} · ${s.model}` : "On-device only (no API key)";
  })
  .catch(() => { $("engine").textContent = "Server offline"; });
