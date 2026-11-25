# Clipping Rewards website

Responsive Next.js website for Clipping Rewards. The root page contains the service overview, Tiffany Queen client work section, process, FAQ, configurable booking CTA, and a fact-limited FAQ chatbot.

## Run locally

1. Copy `.env.example` to `.env.local`.
2. Add Google OAuth client credentials and a refresh token with Google Calendar and Gmail send scopes to enable live appointments and email notifications.
3. Run `npm install`, then `npm run dev`.

## Environment settings

- `NEXT_PUBLIC_CONTACT_EMAIL`: public contact address (currently `clippigreward@gmail.com`).
- `NEXT_PUBLIC_SITE_URL`: canonical domain used for metadata.
- `NEXT_PUBLIC_ANALYTICS_ID`: optional Google Analytics measurement ID. Booking clicks, chatbot opens, and results-section views are tracked when configured.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`: server-only OAuth credentials for Google Calendar availability, event creation, and Gmail notifications. Never use `NEXT_PUBLIC_*` for secrets.
- `GOOGLE_CALENDAR_ID`, `GOOGLE_SENDER_EMAIL`, `BOOKING_NOTIFICATION_EMAIL`: calendar source, sending account, and business notification inbox. Both email settings default to `clippigreward@gmail.com`.
- `BUSINESS_TIMEZONE`, `BUSINESS_DAYS`, `BUSINESS_START_TIME`, `BUSINESS_END_TIME`, `MEETING_DURATION`, `BUFFER_TIME`, `BOOKING_MIN_NOTICE_HOURS`, `BOOKING_MAX_DAYS_AHEAD`: configurable calendar hours and booking rules. Dates and times are stored as instants and converted with the IANA timezone database provided by `Intl` on the server and browser.
- `AI_PROVIDER` and `CHATBOT_API_KEY`: reserved for a future server-side AI provider connection.

The chatbot currently answers from the supplied business facts and avoids inventing campaign data. The provided Tiffany Queen image is used in the client case study. The case study uses qualitative campaign language and contains no fabricated performance metrics.

Official Instagram, YouTube, Discord, and Whop URLs are centralized in `app/lib/social.ts` and linked from the footer. Change each URL there when an account link changes.

Without Google OAuth credentials, the booking calendar offers future date/time preferences within the configured booking window (90 days by default) and prepares an email request to the business inbox; the visitor must send that email, and the team confirms the time by email. It does not mark the request as booked. With Google OAuth configured, the calendar displays verified free slots using the configured working days, checks availability again on submission, inserts a calendar event, notifies the business inbox, and emails the client. Configure the connected OAuth project to allow Calendar API access and Gmail `gmail.send`; test notifications on a non-production calendar before launch.

The Privacy and Terms pages are editable starter pages. Replace their launch notes with approved policies before collecting visitor information.
