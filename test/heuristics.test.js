import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreTranscript } from "../public/heuristics.js";
import { SCAM_CALL, GENUINE_CALL } from "../public/demo-scripts.js";

test("demo scam call ends as likely_scam with the key tactics", () => {
  const a = scoreTranscript(SCAM_CALL);
  assert.equal(a.verdict, "likely_scam");
  for (const t of ["credential_request", "unusual_payment", "secrecy", "authority_impersonation"]) {
    assert.ok(a.tactics.includes(t), `missing ${t}`);
  }
  assert.ok(a.whisper && a.say_this);
});

test("scam is flagged as soon as the code is requested", () => {
  const upToCode = SCAM_CALL.slice(0, 5);
  assert.ok(["suspicious", "likely_scam"].includes(scoreTranscript(upToCode).verdict));
});

test("genuine GP surgery call stays safe", () => {
  const a = scoreTranscript(GENUINE_CALL);
  assert.equal(a.verdict, "safe");
  assert.equal(a.whisper, "");
});

test("the protected user's own words are not judged", () => {
  const a = scoreTranscript([{ speaker: "You", text: "Should I buy gift cards and tell you the code?" }]);
  assert.equal(a.risk, 0);
});
