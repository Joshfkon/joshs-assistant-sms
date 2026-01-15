# Josh's Assistant (Twilio SMS → OpenAI → Vercel)

This is a tiny webhook you can deploy on **Vercel**. When your Twilio number receives an SMS, Twilio hits `/api/sms`, we generate a reply with OpenAI, and respond with TwiML to send the SMS back.

## Files
- `api/sms.js` — Twilio webhook handler (POST form-encoded)
- `package.json` — dependencies (`openai`, `twilio`)

## Deploy (Vercel)
1. Push this repo to GitHub.
2. Import it in Vercel.
3. Add environment variable:
   - `OPENAI_API_KEY` = your OpenAI API key
4. Deploy.

Your webhook URL will look like:
`https://<your-project>.vercel.app/api/sms`

## Wire Twilio to Vercel
Twilio Console → Phone Numbers → your number → Messaging:
- **A message comes in**: Webhook
- URL: `https://<your-project>.vercel.app/api/sms`
- Method: POST
Save.

## Test
Text your Twilio number. You should get a reply.

## Kill switch
Text `ASSISTANT OFF` to make the webhook return an empty response (no reply).

## Notes
- This MVP is stateless. If you want real rate limiting or memory, add Upstash Redis or Supabase.
