# Git Branching, Commits, and PR Workflow Conventions

This document defines the git branching, commit messaging, and Pull Request conventions for the TNL Logistics monorepo. Future development changes and commits MUST strictly adhere to these rules.

---

## 1. Branch Naming Conventions

Branches should be named using the nested layout: `<scope>/<type>/<description>`.

### Valid Scopes
* `backend/` — Changes affecting the Spring Boot service.
* `web/` — Changes affecting the Expo/React Native Web admin portal.
* `mobile/` — Changes affecting the Expo/React Native mobile courier portal.
* `fullstack/` — Changes that genuinely span backend and web/mobile scopes together (e.g. a full feature slice touching both the Spring Boot API and its frontend consumer in the same branch).

**Scope Selection Rule:** If a change spans scopes, use `fullstack/` for the branch and commit prefix; if the change is primarily in one scope with a minor secondary touch, use the primary scope and note the secondary scope in the commit body.

### Valid Types
* `feature/` — New feature implementations.
* `bugfix/` — Fixing defects or issues.
* `test/` — Adding or modifying unit/integration tests.
* `docs/` — Documentation-only changes (README, build-plan, project-structure, or other .md file corrections) with no functional code change.
* `chore/` — Non-functional maintenance: dependency bumps, config tweaks, tooling changes, cleanup that doesn't fit feature/bugfix/test/docs.

### Examples
* `backend/feature/register-shipment`
* `backend/feature/qr-generation`
* `backend/bugfix/duplicate-tracking-ids`
* `backend/test/shipment-service-tests`
* `backend/docs/fix-migration-version-count`
* `web/feature/dashboard-layout`
* `web/feature/shipment-form`
* `web/bugfix/api-client-error-handling`
* `web/chore/update-expo-sdk`
* `mobile/feature/qr-scanner-integration`
* `mobile/feature/label-printer-setup`
* `mobile/bugfix/offline-mode`
* `fullstack/feature/dashboard-live-metrics`

---

## 2. Commit Message Conventions

Commit messages must be prefixed with their respective scope: `[backend]`, `[web]`, `[mobile]`, or `[fullstack]`.

### Build-Plan Phase Tagging
When a commit corresponds to a specific phase in `build-plan.md`, include the phase number in parentheses after the scope prefix, e.g. `[web] (5.2) Add live SSE dashboard binding`. This is optional for changes that don't map to a specific build-plan phase (e.g. chore/docs commits), but required for feature/bugfix commits tied to an active phase.

### Examples

```bash
# Backend Commit Examples
git commit -m "[backend] Add Shipment entity with tracking ID"
git commit -m "[backend] Implement QR generation (Rules 01-03)"
git commit -m "[backend] Add POST /shipments endpoint"

# Web Commit Examples
git commit -m "[web] Create dashboard layout component"
git commit -m "[web] Build shipment registration form"
git commit -m "[web] Fix API client error handling"
git commit -m "[web] (5.2) Add live SSE dashboard binding"

# Mobile Commit Examples
git commit -m "[mobile] Integrate expo-camera for QR scanning"
git commit -m "[mobile] Add label printer component"
git commit -m "[mobile] Implement offline queue"
```

---

## 3. Git Workflow with Scoped Branches

When working on a feature, restrict your modifications to the scope folder matching your branch.

```bash
# 1. Pull latest dev branch
git checkout dev
git pull origin dev

# 2. Spawn a scoped branch
git checkout -b backend/feature/register-shipment

# 3. Make changes to backend scope directory only
# e.g., modifying files in backend/src/...

# 4. Stage and commit changes with the scoped message
git add backend/src/
git commit -m "[backend] Add Shipment entity and service layer"

# 5. Push branch to remote
git push origin backend/feature/register-shipment
```

---

## 4. Branch Merge Strategy

- Feature/bugfix/test/docs/chore branches are opened as PRs targeting `dev`, not `main`.
- PRs into `dev` are merged via squash-merge to keep history readable per scoped commit.
- `dev` is merged into `main` only at release/milestone checkpoints, not per-feature.
- Direct commits to `main` are not permitted under any circumstance.

---

## 5. AI Assistant Execution Guardrails

All AI coding assistants and subagents must strictly adhere to these rules:
- **Never Stage Automatically:** NEVER execute `git add` or `git add .` unless the user explicitly commands you to stage or add files in their prompt.
- **Leave Working Directory Unstaged:** After creating files, editing code, or running test suites, leave all modified and new files unstaged in the working directory so the user can inspect changes with standard `git diff`.
- **Do Not Initiate Staging/Commit Permissions:** Never run `git add`, `git commit`, or `git push` proactively. Do not trigger permission prompts for staging or committing unless explicitly asked.
- **Direct Command Invocation (No Subshell Wrappers):** Always invoke commands (`mvn test`, `git`) directly in PowerShell. Never wrap or prefix commands in `cmd /c`, `cmd.exe /c`, or `powershell -c`. Subshell wrappers change the leading command token from `mvn` to `cmd`, which bypasses the configured permission allowlist and triggers unwanted interactive approval prompts. This is the canonical statement of this rule; the /ship skill references it rather than duplicating it.

---

## 6. PR Title Format

PR titles must adopt the scope prefix combined with standard semantic labels:

* `[backend] feat: Register shipment with QR generation`
* `[web] feat: Create admin dashboard layout`
* `[mobile] feat: Integrate QR scanner`
* `[backend] fix: Handle duplicate tracking IDs`
