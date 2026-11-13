# UniFlow

UniFlow is a Next.js study companion. Its assistant can connect to Gmail and
answer questions about recent inbox messages.

## Gmail and OpenAI setup

1. In Google Cloud, enable the Gmail API and create an OAuth client ID for a
   **Web application**.
2. Add `http://localhost:3000/api/gmail/callback` as an authorized redirect URI.
   While the OAuth consent screen is in testing, add your Google account as a
   test user.
3. Copy `.env.example` to `.env.local` and fill in the Google client ID and
   secret, the exact redirect URI, and an OpenAI API key. Generate a private
   session secret with:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

4. Start the app with `npm run dev`, then open `/assistant` and connect Gmail.

The app requests only Gmail's `gmail.readonly` permission. When you send a
question, UniFlow reads up to 10 recent Inbox messages from the last 30 days and
sends their content to OpenAI to answer it. UniFlow does not store email
contents. OpenAI handles submitted content under the data controls for your
OpenAI account. Disconnecting clears the local encrypted Gmail session; to
revoke the app's Google permission entirely, also remove it from your Google
Account's third-party connections.

The Gmail read scope may require Google OAuth verification and additional
review before the app can be used by people outside your configured test users.
