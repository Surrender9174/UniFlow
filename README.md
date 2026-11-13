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

4. In the Supabase SQL Editor, run
   `supabase/migrations/20261113210000_student_profile_details.sql`. It creates
   or updates the student profile table, applies row-level security, and copies
   signup details from Auth metadata for new and existing users.
5. Start the app with `npm run dev`, then open `/assistant` and connect Gmail.

After a student signs in, UniFlow also updates that student's existing
`public.profiles` row using its `id`. The form fields map to `name`,
`education_level`, `institution`, `study_year`, `semester`, and `class_name`.
Year and semester labels are converted to numbers for the integer columns;
`Doctorat` has no numeric year and is stored as `NULL`. The `schedule` field
isn't part of this table's shown columns.

The app requests only Gmail's `gmail.readonly` permission. When you send a
question about the inbox, UniFlow reads up to 5 recent Inbox messages from the
last 30 days and sends their content to Gemini to answer it. UniFlow does not
store email bodies. When background monitoring is configured, the encrypted
refresh token and generated school alerts are stored in Supabase; disconnecting
deletes that connection. To revoke Google's permission entirely, also remove
UniFlow from your Google Account's third-party connections.

The assistant can also add school or university tasks when a task and its due
date/time are clear; if the date or time is missing, it asks for those details.
These tasks are saved in the current browser and appear on the dashboard and
Tasks page. Dated tasks appear on their selected day in the schedule; tasks
without a deadline are grouped separately. Saved tasks can be deleted or
postponed to a selected future date and time from the Tasks page. In the
assistant, you can also ask to move a saved task to a new date and time; Gemini
must identify the task and a future date/time before UniFlow changes it.
Gmail does not need to be connected for task requests, but Gemini must be
configured.

The assistant conversation is also saved in the current browser and restored
when `/assistant` is opened again. It is not synced to other devices. The latest
8 messages are sent to Gemini as context for each new request; clearing this
browser's site data removes the saved conversation. For each assistant question,
the saved weekly timetable and up to 100 active tasks with due dates are also
sent to Gemini so it can answer questions such as what is scheduled for tomorrow
or which task to reschedule. The timetable and tasks are stored in this browser,
not in the database.

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

## SkillSwap setup

SkillSwap is available at `/skillswap`. It uses the existing Supabase project
for authentication, profiles, skill listings, availability, sessions,
notifications, peer reviews, and reports. Exchanges are free: the feature does
not create credits, balances, payments, or escrow.

1. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
   `.env.local`. Use the project's anon/publishable key; SkillSwap API requests
   use the signed-in user's token and Supabase row-level security.
2. Apply
   [`supabase/migrations/20261113223000_skillswap.sql`](./supabase/migrations/20261113223000_skillswap.sql)
   to the same Supabase project, using `supabase db push` or the Supabase SQL
   Editor. The migration creates the schema, access policies, session functions,
   and private Realtime authorization. The API will return setup errors until
   this migration has been applied.
3. For calls that must work across restrictive NATs/firewalls, configure a
   Coturn server with its REST shared-secret authentication enabled. Set
   `SKILLSWAP_TURN_URL` to one or more comma-separated `turn:`/`turns:` URLs and
   `SKILLSWAP_TURN_SECRET` to the server-side shared secret. The API derives
   short-lived per-user credentials; never expose the shared secret through a
   `NEXT_PUBLIC_` variable. `SKILLSWAP_TURN_TTL_SECONDS` is optional and is
   clamped to 5 minutes–2 hours. Without TURN, the app uses a public STUN server,
   so peer-to-peer calls may not connect on some networks.
4. Open `/skillswap`, complete a profile, add skills to teach and learn, and set
   recurring availability. Accepted sessions can be opened at
   `/skillswap/room/[sessionId]`.

The room uses private Supabase Realtime channels for WebRTC signaling, live
chat, the shared whiteboard, and code snippets. These collaboration messages
are transient and are not saved as session history. The session timer moves an
accepted session to mutual confirmation; only after both participants confirm
does it become completed. Reviews and dispute/no-show reports are stored in
Supabase.
## Search and notifications

The global search covers UniFlow pages, saved tasks, and timetable entries in
the current browser. The task badge and Tasks page both count the same saved
tasks. Deadline countdowns are shown in the notification menu; when browser
notifications are enabled, UniFlow can also alert about a deadline while the
app is open. Tasks and timetable entries are still browser-local, so deadline
push reminders cannot run after the browser is closed.

### Gmail alerts while UniFlow is closed

Background Gmail checks need a deployed app and an external scheduler. They do
not run automatically from a local `npm run dev` process.

1. Run `supabase/migrations/20261114120000_gmail_monitoring.sql` in the
   Supabase SQL Editor.
2. Set the Supabase URL and anon key in `.env.local`, plus the server-only
   Supabase secret key as `SUPABASE_SECRET_KEY` (the legacy
   `SUPABASE_SERVICE_ROLE_KEY` variable is also accepted). Never expose the
   secret key in client-side code.
3. Keep `GMAIL_SESSION_SECRET` configured. It encrypts the stored Gmail refresh
   token and signs the OAuth state.
4. Generate a random cron secret and VAPID keys:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   node -e "console.log(require('web-push').generateVAPIDKeys())"
   ```

   Put the first value in `MONITOR_CRON_SECRET`, the VAPID `publicKey` in
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, the `privateKey` in `VAPID_PRIVATE_KEY`, and
   a valid `mailto:` contact in `VAPID_SUBJECT`. Keep the private key and cron
   secret server-only.
5. Add the required server-side environment variables to the Vercel project and
   deploy UniFlow. Vercel Hobby cron jobs can run only once per day, so this
   repository uses GitHub Actions for hourly checks. In the GitHub repository,
   open **Settings → Secrets and variables → Actions** and add:
   - `APP_BASE_URL`: the production HTTPS URL of the Vercel deployment, without
     a trailing slash.
   - `MONITOR_CRON_SECRET`: the same random secret configured in Vercel.

   Push this workflow to the repository's default branch and make sure GitHub
   Actions are enabled. It calls `/api/cron/gmail-monitor` hourly and can also
   be started manually from the Actions tab. Scheduled runs use UTC and GitHub
   may delay them; the endpoint returns an error if any account fails so the
   run is reported as failed.
6. In UniFlow, reconnect Gmail while signed in, then allow browser notifications
   from the notification menu. Reconnecting is required to associate and
   encrypt the refresh token for background checks.

The monitor searches for new Inbox messages, sends their content to Gemini to
identify concrete school-related updates, and stores only the generated alert
and Gmail message ID in Supabase—not the full email body. Gmail access remains
read-only. Until the migration, server secrets, deployment, scheduler, and
browser permission are configured, background Gmail alerts are not active.
