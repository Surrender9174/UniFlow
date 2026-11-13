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
question about the inbox, UniFlow reads up to 5 recent Inbox messages from the last 30 days and
sends their content to the Gemini API to answer it. UniFlow does not store email
contents. Disconnecting clears the local encrypted Gmail session; to revoke the
app's Google permission entirely, also remove it from your Google Account's
third-party connections.

The assistant can also add school or university tasks when a task and its due
date/time are clear; if the date or time is missing, it asks for those details.
These tasks are saved in the current browser and appear on the dashboard and
Tasks page. Saved tasks can be deleted or postponed to a selected future date
and time from the Tasks page; the schedule updates to reflect the new deadline.
Gmail does not need to be connected for task requests, but Gemini must be
configured.

The default model is `gemini-3.5-flash-lite`, which is available on Google's
free tier and is optimized for low-latency tasks. Free-tier limits still apply,
and Google may use submitted content to improve its products. Change
`GEMINI_MODEL` in `.env.local` only if you have confirmed the other model is
available on your plan.

## WhatsApp chat export

On `/assistant`, upload a WhatsApp-exported `.txt` file up to 200 KB. Uni sends
the text to Gemini to identify school announcements such as tests, oral
assessments, class cancellations, schedule changes, and deadlines. The export
is not stored by UniFlow. On the free tier, Google may use submitted content to
improve its products; remove private information you do not want to share before
uploading. Non-cancelled events can be added from their result cards to the
browser-local task list and appear in `/schedule`. Select a day in the week
calendar to see that day's activities; use the arrows to browse other weeks.
Events without a confirmed date and time are saved without a deadline and shown
in a separate unscheduled group; cancelled events remain visible in the analysis
but are not added as tasks.
Tasks Gemini creates from chat requests are also shown in that schedule section.

The Gmail read scope may require Google OAuth verification and additional
review before the app can be used by people outside your configured test users.
