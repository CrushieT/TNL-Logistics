# Git Branching, Commits, and PR Workflow Conventions

This document defines the git branching, commit messaging, and Pull Request conventions for the TNL Logistics monorepo. Future development changes and commits MUST strictly adhere to these rules.

---

## 1. Branch Naming Conventions

Branches should be named using the nested layout: `<scope>/<type>/<description>`.

### Valid Scopes
* `backend/` — Changes affecting the Spring Boot service.
* `web/` — Changes affecting the Expo/React Native Web admin portal.
* `mobile/` — Changes affecting the Expo/React Native mobile courier portal.

### Valid Types
* `feature/` — New feature implementations.
* `bugfix/` — Fixing defects or issues.
* `test/` — Adding or modifying unit/integration tests.

### Examples
* `backend/feature/register-shipment`
* `backend/feature/qr-generation`
* `backend/bugfix/duplicate-tracking-ids`
* `backend/test/shipment-service-tests`
* `web/feature/dashboard-layout`
* `web/feature/shipment-form`
* `web/bugfix/api-client-error-handling`
* `mobile/feature/qr-scanner-integration`
* `mobile/feature/label-printer-setup`
* `mobile/bugfix/offline-mode`

---

## 2. Commit Message Conventions

Commit messages must be prefixed with their respective scope: `[backend]`, `[web]`, or `[mobile]`.

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

## 4. PR Title Format

PR titles must adopt the scope prefix combined with standard semantic labels:

* `[backend] feat: Register shipment with QR generation`
* `[web] feat: Create admin dashboard layout`
* `[mobile] feat: Integrate QR scanner`
* `[backend] fix: Handle duplicate tracking IDs`
