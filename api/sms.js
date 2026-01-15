import Anthropic from "@anthropic-ai/sdk";
import twilio from "twilio";

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

    // Kill switch: no reply
    if (incoming.toUpperCase() === "ASSISTANT OFF") {
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
      model: "claude-3-5-sonnet-20241022",
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
