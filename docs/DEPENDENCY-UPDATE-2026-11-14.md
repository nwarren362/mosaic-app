# Dependency security update — 14 November 2026

## Scope

First implementation task from the proposed hardening sprint. Update dependencies and lockfile only; application behaviour, email authorization, workflow recovery and lint cleanup are separate tasks. Earlier edits to `TODO.md` and `docs/AUDIT-2026-11-12.md` remain separate and uncommitted.

Acceptance: compatible security fixes reviewed; no critical/high npm findings; TypeScript and production build pass; lint results compared with baseline; browser smoke checks for login and core pages, including mobile where accessible. Record remaining findings and blockers before acceptance/commit.

## Changes

- Next.js and eslint-config-next: 16.1.1 → 16.4.6, pinned together.
- Compatible transitive security fixes through `npm audit fix` (no `--force` or overrides).
- Notable resolved dependencies: PostCSS 8.5.23, sharp 0.35.5, ws 8.23.0 and typescript-eslint 8.72.2.
- Starting `next dev` also appended its standard managed documentation block to `AGENTS.md`; verified against `node_modules/next/dist/server/lib/generate-agent-files.js` and the bundled upgrade guide. Existing project guidance is preserved.
- React, React DOM and Supabase JS remain at their existing versions. All lockfile tarballs resolve through the npm registry.

Release reference: [Next.js 16.4.6](https://github.com/vercel/next.js/releases/tag/v16.4.6). Registry peer metadata accepts React 19 and Node >=20.9; local checks used Node 24.12.0 and npm 11.6.2.

## Checks

- Before: npm audit reported 17 affected packages (1 critical, 12 high, 3 moderate, 1 low).
- After: zero critical/high; seven moderate development-tooling findings remain in the typescript-eslint chain, rooted in nested minimatch 10.2.6. A second compatible fix pass made no further changes. [Advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249). Do not interpret dependent-package counts as independent exploits. No forced major override was introduced.
- `npm audit --omit=dev --json`: zero vulnerabilities.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed with Next.js 16.4.6, including TypeScript and all 18 static pages. Build needed network access for configured Google fonts; no application changes were required.
- `npm run lint`: 23 errors and 15 warnings, versus 9 errors and 15 warnings in the earlier baseline. Updated rules expose additional set-state-in-effect, purity and declaration-order findings in unchanged application source. Rules were not disabled; lint cleanup remains a separate task.
- `git diff --check`: passed.
- `npm ls --depth=0`: no invalid direct dependency versions; npm reports platform-related `@emnapi/runtime` and `@img/sharp-wasm32` as extraneous locally.

## Browser acceptance

Development server started at http://localhost:3000. Login page renders with its inputs, navigation and links. A 375px viewport smoke check showed the login controls and mobile header; the temporary viewport override was reset. Chrome reports a hydration mismatch involving extension-injected `xk-pk-bridge` / `xk-injected` attributes on the root HTML element; the diagnostic does not identify changed application markup. After user sign-in, authenticated smoke checks passed: Artists loaded four records and search narrowed to one; Venues loaded four records and search narrowed to one; Gigs showed the upcoming empty state and ten records under All; Tasks loaded two records and KPI filtering produced the expected empty state and restored the list. At 375px, Tasks and Artists fit without horizontal overflow, and the mobile menu opened and navigated correctly. Viewport override was reset. No further runtime errors were captured beyond the extension-attribute hydration diagnostic. These were read/search/filter checks, not acceptance of every CRUD or workflow path. One existing task linked to a gig with an Unknown label; investigate the related record/access separately. Tasks can automatically escalate on load; the two displayed tasks already had escalation dates from July, and no new escalation message appeared. No credentials were read, no email sent, and no business records deliberately modified for testing.

## Status

Dependency update and recorded limitations accepted by the user on 14 November 2026. Authenticated desktop and focused mobile smoke checks are complete. The separate lint cleanup below now passes with three image warnings; the recorded limitations are accepted. Nothing pushed or deployed. Remaining moderate tooling advisories and newly exposed lint findings require explicit tracking rather than a claim of a completely clean dependency/check baseline.

## Tooling advisory review and accepted deferral

Reviewed GHSA-g3hv-75wg-m249 against the installed source. The maintainer advisory describes amplification of attacker-controlled glob patterns when `optimizationLevel >= 2`, and identifies 11.0.1 as patched. npm registry metadata still lists typescript-eslint 8.72.2 as latest, with typescript-estree depending on `minimatch ^10.2.2`; 10.2.6 is the newest version on that major line. There is currently no supported compatible fix in this dependency chain.

The parser's `dist/useProgramFromProjectService.js:244` passes only `{ dot: true }` to minimatch for `allowDefaultProject` patterns. The installed minimatch implementation defaults optimizationLevel to 1. Mosaic does not configure projectService/allowDefaultProject in its ESLint configuration. This supports a low-exposure assessment for the current setup, rather than a claim that the affected package has been fixed.

Accepted disposition: temporarily defer the seven moderate package findings caused by this one advisory; do not force minimatch 11 outside the parser's declared range. Project maintainer to review again by 28 November 2026, or sooner when a compatible parser/backport is released, lint configuration introduces externally supplied glob patterns, or the advisory conditions change. Re-run the full and production audits at dependency changes. This is a documented review date, not an automatically scheduled reminder. The user accepted this temporary deferral on 14 November 2026.

## Lint cleanup follow-up

The separate source cleanup is documented in [lint verification](LINT-CLEANUP-2026-11-14.md). It supersedes the failing lint count above: lint now exits successfully with zero errors and three image-performance warnings. Dependency changes and source cleanup are accepted for separate local commits.
