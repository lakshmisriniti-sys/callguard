// Scripted calls for demo mode, so CallGuard can be shown without a real scammer.
// "Caller" lines are read aloud in one voice; "You" lines in another.

export const SCAM_CALL = [
  { speaker: "Caller", text: "Hello, am I speaking with Mr Raj Patel? This is James calling from the fraud department at your bank." },
  { speaker: "You", text: "Oh. Yes, this is Raj." },
  { speaker: "Caller", text: "We've detected suspicious transactions on your account this morning, a payment of eight hundred pounds to an online electronics store." },
  { speaker: "You", text: "I didn't buy anything like that." },
  { speaker: "Caller", text: "Don't worry, that's why I'm calling. To stop it I need to verify you. We've just sent a six digit code to your phone. Can you read me the code?" },
  { speaker: "You", text: "Hold on, let me find my glasses." },
  { speaker: "Caller", text: "Please be quick, the payment goes through in the next ten minutes. And please stay on the line, don't hang up." },
  { speaker: "Caller", text: "Once we've verified you, we will move your savings to a safe account while we investigate. If the branch asks, don't tell them about this call, it's a confidential investigation." },
];

export const GENUINE_CALL = [
  { speaker: "Caller", text: "Hi, is that Mr Raj Patel? It's Sophie from Riverside Surgery." },
  { speaker: "You", text: "Yes, speaking." },
  { speaker: "Caller", text: "I'm just calling to remind you about your flu jab appointment on Thursday at half past ten." },
  { speaker: "You", text: "Lovely, thank you. Do I need to bring anything?" },
  { speaker: "Caller", text: "Nothing at all, just wear something with short sleeves. If you can't make it, ring the surgery on the usual number and we'll rebook you." },
  { speaker: "You", text: "Will do. Thanks Sophie." },
  { speaker: "Caller", text: "No problem, see you Thursday. Bye now." },
];
