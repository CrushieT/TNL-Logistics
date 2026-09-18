## Scope
- [ ] Backend
- [ ] Web
- [ ] Mobile
- [ ] Fullstack

## Build-Plan Phase
Phase number (e.g. `5.2`) or `N/A`.

## What does this PR do?
Brief description.

## Files Changed
List the main files (or let GitHub auto-generate).

## Verification (/test Report)
<!-- Paste /test's full structured report here:
- Scope: Endpoints/methods tested and mode used
- Automated Suite Results: Test class(es) and pass/fail counts
- Contract Check Results: Schema diffing, role gating, negative/edge cases, concurrency
- Summary verdict: Overall pass/fail
-->

```text
Paste /test's full report here
```

## Audit Sign-Off (/audit Report)

### Audit Scope Header
- **Audit Mode:** [Git Diff Scoped | Targeted Scope | Full Sweep]
- **Audited Target(s):** [List of specific files or directories analyzed]

### Findings Matrix

| Severity | Count | Category |
| :--- | :---: | :--- |
| **Critical** | 0 | Remote code execution, SQL injection, authentication bypass |
| **High** | 0 | Missing role checks, transaction leaks, severe performance bottlenecks |
| **Medium** | 0 | Missing input validation, unhandled edge cases, missing high-traffic indexes |
| **Low / Info** | 0 | Naming inconsistencies, low-traffic indexing, minor refactoring |

### High / Critical Remediation
State "None found" or detail each finding and its resolution.

## Checklist
- [ ] No hardcoded secrets or sensitive credential leakage (Security)
- [ ] Input validation and exception shielding implemented (Robustness)
- [ ] Database queries indexed and transactions scoped properly (Performance)
- [ ] Code follows naming conventions and service-layer separation (Code Quality)
- [ ] Commit messages follow `[scope]` and optional `(phase)` conventions
- [ ] PR targets `dev` branch per branch merge strategy
