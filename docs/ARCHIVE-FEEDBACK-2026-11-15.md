# Archive feedback — UAT-02, 15 November 2026

Status: improvements verified locally and accepted for a local commit; repeat UAT on the affected device remains pending. No deployment or production data changes.

The user reported that Confirm archive does nothing and displays no explanation despite a reason and both confirmations being complete. The local future-cancelled-gig/cancellation-task case returned the original inline error, so the exact reported silent failure has **not** been reproduced. Treat the changes below as verified feedback/recovery improvements, not proof of the original device-specific cause.

## Behaviour

- Failures display a prominent error notice, receive keyboard focus and scroll into view, including on narrow phones.
- An unfinished cancellation notification task explains what to complete and offers Review gig tasks, scrolling to the current gig's Activity section.
- Empty error messages get a readable fallback instead of disappearing.
- Unexpected successful response data produces an explicit uncertain-result message instead of silently refreshing an unchanged gig.
- A 15-second request timeout releases the form and asks the user to reload before retrying. It does not claim a timed-out operation failed: the server may have committed before the response was lost. Existing RPC idempotence remains the safeguard for retries.
- Database rules are unchanged: only unfinished cancellation notification tasks block archiving; other open tasks are closed atomically on success.

## Verification

Using the disposable native PostgreSQL/PostgREST sample backend and the actual app:

1. Cancellation follow-up blocker displayed the focused notice and next action at 375px; no horizontal overflow. Review gig tasks reached the task. Snapshot: `/private/tmp/mosaic-db-audit/archive-feedback-2026-11-15.png`.
2. Replaced **only the local fixture RPC** temporarily with an empty-message error; confirmed fallback appeared.
3. Returned an invalid empty-object success response; confirmed uncertain-result notice appeared.
4. Simulated a 20-second RPC; the 15-second client timeout displayed an explanation and re-enabled the form.
5. Restored the reviewed original fixture RPC. Archived a different sample gig with an ordinary outstanding task successfully, preserving the task in read-only history.
6. Reset the temporary mobile viewport. Stopped Next/PostgREST/PostgreSQL and removed the sample cluster; installed PostgreSQL software remains.

Final full lint (zero errors, three existing image warnings), TypeScript, production build and diff whitespace checks pass. These are browser acceptance checks; no new automated browser suite is claimed. After an authorised release, repeat the user's exact flow on the affected phone/browser using a test gig on Vercel. UAT-01 (band-to-gig click-through) and UAT-03 (portrait gig-list content) remain deferred until after hardening.
