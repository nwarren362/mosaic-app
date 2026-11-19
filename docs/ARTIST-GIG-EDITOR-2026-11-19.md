# Artist gig editor placement — 19 November 2026

Prepared locally after Nigel confirmed previous release testing passed. Nigel reviewed and accepted the new presentation. Committed locally; deployment awaits explicit push authorisation.

The existing editor now renders directly below the selected gig, with one editor at a time. A shared native disclosure button highlights selection with the theme primary border and exposes expanded state/associated region. Enter works for keyboard selection. Opening/switching gently scrolls the editor heading into view if needed. Existing save and detail navigation remain; the navigation label is now “Open gig details”. Date/status/fee fields wrap to fit narrow screens.

Focused local browser acceptance used synthetic Artist 201: opened the first of two gigs and verified editor placement before the next gig; switched with Enter and confirmed one editor; saved a sample title and observed it in the list; closed/reopened; the renamed action reached the matching Gig 303 details. At 375px, document scroll width was 360px with one editor, no horizontal overflow; viewport reset. No production records changed. Evidence: `/private/tmp/mosaic-inline-gig-editor-mobile-2026-11-19.png`.

Focused ESLint passed with the existing artist-image warning; TypeScript and production build passed; whitespace check passed. No database migration or new automated test suite required for this presentation change.
