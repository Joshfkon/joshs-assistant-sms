import OpenAI from "openai";
import twilio from "twilio";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  // Twilio posts application/x-www-form-urlencoded.
  // Vercel serverless functions may not auto-parse it, so parse the raw body.
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");

  const params = new URLSearchParams(raw);
  const incoming = (params.get("Body") || "").trim();

  // Kill switch (optional)
  if (incoming.toUpperCase() === "ASSISTANT OFF") {
    res.status(200).send("");
    return;
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
You are Josh’s Assistant.
You are explicitly an AI speaking on Josh’s behalf.

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
        `.trim()
      },
      { role: "user", content: incoming }
    ]
  });

  const reply = completion.choices?.[0]?.message?.content ?? "Noted.";

  // Return TwiML so Twilio sends an SMS reply
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(reply);

  res.setHeader("Content-Type", "text/xml");
  res.status(200).send(twiml.toString());
}
