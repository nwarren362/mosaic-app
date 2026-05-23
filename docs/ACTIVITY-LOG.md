# Brief description of activity log feature.
Abstracted code reusable across multiple pages including
    - venues_id
    - artists_id
    - gigs_id
* UI uses ActivityTimeline
* summaries stay concise
* old/new values live in metadata
* activity is the visible history layer, not yet full domain events
* later: domain_events + workflow handlers