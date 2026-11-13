# UniFlow

UniFlow is a Next.js study companion. Its assistant can connect to Gmail and
answer questions about recent inbox messages.

## Gmail and Gemini setup

1. In Google Cloud, enable the Gmail API and create an OAuth client ID for a
   **Web application**.
2. Add `http://localhost:3000/api/gmail/callback` as an authorized redirect URI.
   While the OAuth consent screen is in testing, add your Google account as a
   test user.
3. Create a Gemini API key in Google AI Studio. Add the values from
   `.env.example` to `.env.local` (copy the template only if you don't already
   have a local env file). Fill in the Google OAuth values, `GEMINI_API_KEY`,
   and the exact redirect URI. Generate a private session secret with:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

4. Start the app with `npm run dev`, then open `/assistant` and connect Gmail.

The app requests only Gmail's `gmail.readonly` permission. When you send a
question, UniFlow reads up to 10 recent Inbox messages from the last 30 days and
sends their content to the Gemini API to answer it. UniFlow does not store email
contents. Disconnecting clears the local encrypted Gmail session; to revoke the
app's Google permission entirely, also remove it from your Google Account's
third-party connections.

The default model is `gemini-4-carbon` for stronger reasoning. It may cost more
than a Flash model; change `GEMINI_MODEL` in `.env.local` if you prefer a faster,
lower-cost option.

The Gmail read scope may require Google OAuth verification and additional
review before the app can be used by people outside your configured test users.
