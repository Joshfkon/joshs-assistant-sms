import Anthropic from "@anthropic-ai/sdk";
import twilio from "twilio";

function shouldTrigger(text) {
  const t = text.toLowerCase().trim();

  // Direct phrase triggers
  const triggers = [
    "ugh",
    "bored",
    "hw god",
    "hwgod",
    "josh",
    "steroids",
    "therapy",
    "wtf",
    "vibe check",
    "interesting",
  ];

  // If any direct trigger phrase appears
  if (triggers.some((p) => t.includes(p))) return true;

  // Special handling for "lol"
  // Trigger only if it's emphatic, not casual
  if (
    t === "lol" ||
    t === "lol." ||
    t === "lol?" ||
    t.includes("lol lol")
  ) {
    return true;
  }

  return false;
}

function cannedResponse(text) {
  const t = text.toLowerCase().trim();

  const map = {
    "hello there": "General Kenobi.",
    "this is the way": "This is the way.",
    "i have spoken": "So it shall be.",
    "so say we all": "So say we all.",
    "winter is coming": "And no one prepared.",
    "may the force be with you": "Always.",

    "interesting": "Very interesting.",
    "bold move": "Let's see if it pays off.",
    "big if true": "Huge if accurate.",
    "trust the process": "Concerning.",
    "say less": "Already too much.",
    "make it make sense": "It will not.",
    "vibe check": "Vibe: questionable.",

    "ugh": "Noted.",
    "wtf": "Valid reaction.",
    "therapy": "Josh recommends avoidance.",
    "steroids": "Allegedly.",
    "josh": "Josh has no comment.",
    "lol": "Acknowledged.",

    "are we doing this": "We are doing this.",
    "this again": "Yes. This again.",
    "thoughts": "Regrettably.",
    "who approved this": "No one.",
  };

  return map[t] || null;
}

async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const raw = await readRawBody(req);
    const params = new URLSearchParams(raw);

    const incoming = (params.get("Body") || "").trim();
    const upper = incoming.toUpperCase();

    // Kill switch: no reply
    if (upper === "ASSISTANT OFF") {
      res.status(200).send("");
      return;
    }

    // STOP keyword — Twilio handles opt-out automatically, but acknowledge it
    if (upper === "STOP") {
      const twiml = new twilio.twiml.MessagingResponse();
      twiml.message("You have been unsubscribed and will no longer receive messages. Text START to resubscribe.");
      res.setHeader("Content-Type", "text/xml");
      res.status(200).send(twiml.toString());
      return;
    }

    // HELP keyword — required for A2P compliance
    if (upper === "HELP") {
      const twiml = new twilio.twiml.MessagingResponse();
      twiml.message("Josh's Assistant SMS: An AI-powered auto-reply service. Reply STOP to opt out. For support, email josh@joshfkon.com");
      res.setHeader("Content-Type", "text/xml");
      res.status(200).send(twiml.toString());
      return;
    }

    // Deterministic canned responses (no API call)
    const canned = cannedResponse(incoming);
    if (canned) {
      const twiml = new twilio.twiml.MessagingResponse();
      twiml.message(canned);
      res.setHeader("Content-Type", "text/xml");
      res.status(200).send(twiml.toString());
      return;
    }

    // Only respond to trigger phrases
    if (!shouldTrigger(incoming)) {
      res.status(200).send("");
      return;
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("Missing ANTHROPIC_API_KEY env var");
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const system = `
You are Josh's Assistant.
You are explicitly an AI speaking on Josh's behalf.

Your replies must be no more than two short sentences.

Tone:
- Dry
- Confident
- Slightly smug
- Occasional sibling roast (light, not cruel)

Rules:
- Never pretend to be Josh
- Never apologize
- Never explain yourself
- Minimal emojis (0–1 max)
- If there's an argument, pick a side decisively
- If trivial, overanalyze slightly for humor
`.trim();

    const msg = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 200,
      system,
      messages: [{ role: "user", content: incoming }],
    });

    const reply =
      msg?.content?.map((c) => (c.type === "text" ? c.text : "")).join("").trim() ||
      "Noted.";

    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(reply);

    res.setHeader("Content-Type", "text/xml");
    res.status(200).send(twiml.toString());
  } catch (err) {
    console.error("Webhook error:", err);

    // Return TwiML so Twilio doesn't keep retrying forever
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message("Josh's Assistant is temporarily unavailable. Try again.");
    res.setHeader("Content-Type", "text/xml");
    res.status(200).send(twiml.toString());
  }
}
