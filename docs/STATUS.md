# Status

**Last updated:** 2026-09-30 (see `docs/CHANGELOG.md` for every change)
**Current stage:** Overnight build, started 2026-09-30. Stages 1 to 4 done. Stages 5 to 9 follow in order; this file is brought up to date at the end of the build.

## Summary

| Area | State |
|---|---|
| Implemented | Nothing yet beyond the records (Stage 1) |
| Tested | Nothing yet |
| Installed in Microsoft 365 (test) | Nothing |
| Piloted | Nothing |
| In production | Nothing. The current Word form and the Teams posting are unchanged and still in use |

## Stages

| Stage | State | Notes |
|---|---|---|
| 1. Read and records | Done, 2026-09-30 | `CLAUDE.md`, `docs/STRATEGY.md`, `DECISIONS.md` (P-001 to P-031), `DATA_MODEL.md`, `SOP.md`, `QUESTIONS_FOR_MAX.md`. The travel project and the F2 form were read; the attached form's $100 and "over $500" wording differs from Max's $500 decision (P-005, question 2) |
| 2. Copy | Done, 2026-09-30 | The travel app, tooling and CI under the new name and IDs. Still travel rules inside; replaced in Stages 3 to 6. Build and 144 tests pass here |
| 3. Rules | Done, 2026-09-30 | `purchaseRules.ts` and the rest of the domain layer, the CSV, email and submission code, the data interface. 154 unit tests pass. The data layer, flow and screens still use the old travel types until Stages 4 to 6 |
| 4. Data | Done, 2026-10-01 | Lists, mapping, SharePoint and mock services, fake SharePoint, sample data. 413 unit tests pass for the domain, export and data layers. The flow and screens still use the old travel code until Stages 5 and 6 |
| 5. Screens | Not started | |
| 6. Export and flows | Not started | |
| 7. Checks | Not started | |
| 8. Checkpoint steps | Not started | |
| 9. Morning report | Not started | |
| 10. Review with Max | Waiting on the build | Max answers `docs/QUESTIONS_FOR_MAX.md` |
| 11. Test-site checkpoint | Not started | Max follows `docs/CHECKPOINT.md` |
| 12. Security review and SOP proof pass | Not started | |
| 13. Pilot | Not started | |
| 14. Production | Not started | |
| 15. New purchasing policy (last stage) | Not started | Max writes the policy with Claude; `purchaseRules.ts`, the Instructions, the SOP and the form text follow |

## Pending items

- Max to answer `docs/QUESTIONS_FOR_MAX.md`.
- For the test-site checkpoint: Max follows `docs/CHECKPOINT.md` (written in Stage 8).
- The travel app's own open items (colleague test, Mark processed, site choice, Teams app details) are tracked in its repository and do not block this project.

## Next step

Stages 5 and 6: the screens, and the flow package (approval branch).
