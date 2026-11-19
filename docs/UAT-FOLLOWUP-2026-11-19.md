# Local UAT follow-up — 19 November 2026

Nigel confirmed ordinary-agent administration denial, artist/venue deactivation, and preservation of a venue with an archived gig. In the follow-up, Nigel also passed both the admin agency-selector test and the Gig 305 cancellation-task archive explanation test.

The combined disposable fixture contains no invitations initially. In `/admin/invitations`, agent5@example.test must have only Test agency 101 in the Agency selector; agent1@example.test must have only Test agency 102, despite being an ordinary member of 101. Password: `test`. Creating an invitation is unnecessary for this check. Browser check on the current admin session confirmed only 101 and an empty invitation list.

Archive clarification: ordinary open tasks are closed atomically during archiving. Only an unfinished task with metadata event_type=gig.cancelled blocks it. Adding an ordinary task does not test that blocker. Gig 305 has the seeded task “Notify relevant parties about gig cancellation”. Browser attempt on 19 November correctly displayed the focused archive error and Review gig tasks control, preserving the gig. Phone UAT is deferred until a Vercel release; the loopback-only backend is inaccessible from a phone.

The new tenant composite foreign keys exposed ambiguous PostgREST artist embedding. Reproduced PGRST201 against the local backend; both Gigs list and task gig-label queries now explicitly select the existing gigs_artist_id_fkey relationship, compatible with the released schema and pending composite constraints. Browser verification showed three unarchived gigs under All after the fix. Focused ESLint, TypeScript and diff checks passed. No production changes, push or database migration applied during this follow-up.

Last-admin and tenant-relationship safeguards retain their earlier automated coverage; user technical testing is not required.

Following acceptance, Nigel requested removal of the repetitive database-error sentence for the cancellation-task blocker. The notice now retains its heading, the actionable instruction to complete the cancellation notification task in Activity, and Review gig tasks. Other archive errors retain their original explanation.
