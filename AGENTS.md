# Repository Instructions — TNL Logistics

These instructions govern all AI assistant activities in this repository. They supplement the global ground rules in `~/.gemini/config/rules/AGENTS.md`.

## Project Documentation Synchronization

Keep project documentation strictly synchronized with code changes:

- **Project Structure Alignment:** Whenever directories, files, or packages are added, removed, moved, or renamed, immediately update [`.agents/rules/project-structure.md`](.agents/rules/project-structure.md) to reflect the new layout.
- **Build Plan Progress Alignment:** Whenever a development milestone, phase, or feature slice is completed, added, or modified, immediately update [`.agents/rules/build-plan.md`](.agents/rules/build-plan.md) with the latest status tags (`[COMPLETED]`, `[IN PROGRESS]`, `[UPCOMING]`). Never use emojis in status tags.

## Core Architectural Invariants

- **Unified Modular Monolith:** Spring Boot 3.4 (Java 21) backend + MySQL 8.0 + Expo / React Native Web & Mobile sharing a single synchronized database schema.
- **4 Decoupled Status Lifecycles:**
  - Tracking Status: `REGISTERED` -> `QR_GENERATED` -> `LOADED_ON_TRUCK` -> `ARRIVED_AT_TNL` -> `LOADED_TO_HAULER`.
  - Payment Status: `UNPAID` -> `PARTIALLY_PAID` -> `PAID` (and `FOR_COLLECTION`).
  - Label Status: `NOT_PRINTED` -> `PRINTED` -> `REPRINTED`.
  - Waybill Status: `NOT_GENERATED` -> `GENERATED` -> `SENT_TO_HAULER` -> `COMPLETED`.
  Never conflate or cross-couple these independent lifecycles.

## Reference Rules

Consult the specialized rule files on demand when relevant to the task:

- [`.agents/rules/git-conventions.md`](.agents/rules/git-conventions.md): Consult when proposing commits, branches, or PRs (scoped branching `<scope>/<type>/<description>`, commit message format `[scope] (phase) message`, strictly zero autonomous staging/commit/push).
- [`.agents/rules/answer.md`](.agents/rules/answer.md): Consult for communication tone (direct, plain paragraphs, senior engineer critique, anti-hype, no emojis).
- [`.agents/rules/karpathy-guidelines.md`](.agents/rules/karpathy-guidelines.md): Reference copy of the core behavioral guidelines active globally.

## Full Skill Set

This repo has its own `SKILL.md` files that are authoritative over the global file's condensed `/ship`/`/bug`/`/test`/`/audit` summary. They add:

- `/threat-model` — design-time threat modeling, run before `/ship` for auth/upload/PII/external-integration features.
- `/review` — manual five-axis merge-checkpoint review (correctness, readability, architecture, security, performance).
- `performance-optimization` — ship-internal only, invoked by `/ship` Step 5 for High/Critical performance findings. Measure -> Identify -> Fix -> Verify -> Guard.
- Explicit non-trivial-change counter-examples for `/ship`'s fast-path (null checks, validation annotations, role/`@PreAuthorize` changes, query condition changes are never trivial).
- Precise cycle-cap logic: 3 consecutive test-fix cycles, 3 consecutive audit-fix cycles, 6 combined — stop and report rather than continuing.