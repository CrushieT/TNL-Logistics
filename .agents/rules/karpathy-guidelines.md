# Karpathy Guidelines

Behavioral guidelines to reduce common LLM coding mistakes, derived from [Andrej Karpathy's observations](https://x.com/karpathy/status/2015883857489522876) on LLM coding pitfalls.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

- **Post-Implementation Testing Guide:** Upon completing any phase or feature slice implementation, you MUST provide a "What to Test" checklist including:
  1. Executed automated test suite commands and results.
  2. Step-by-step manual testing instructions (API endpoints, payloads, or UI flows).
  3. Expected database state and response outputs to verify success.

## 5. Production-Ready Code

**Write code that's ready to ship, not ready to learn from.**

- No toy examples or placeholder implementations.
- Proper error handling for all failure modes.
- Security-aware (no hardcoded secrets, SQL injection, XSS).
- Follow established patterns from your framework.
- If code is speculative or incomplete, mark it clearly: `// TODO: implement X before shipping`.
- Assume someone will read this in production 6 months from now.

Question: "Would I deploy this today?" If no, don't commit it.

## 6. Maintain Documentation & Rules

**Keep system guidelines and folder structure layouts updated.**

- **Project Structure Alignment:** Any time the workspace directory tree, folder layout, file names, or package layout is modified (e.g. adding, deleting, moving, or renaming directories/files), you MUST immediately update [`.agents/rules/project-structure.md`](file:///C:/Users/Aundray/Desktop/Project/Tracking/logistics/.agents/rules/project-structure.md) to keep the documentation synchronized.
- **Build Plan Progress Alignment:** Any time a phase, feature slice, or development milestone is completed, added, or modified, you MUST immediately update [`.docs/build-plan.md`](file:///C:/Users/Aundray/Desktop/Project/Tracking/logistics/.docs/build-plan.md) to reflect the current progress status (`[COMPLETED]`, `[CURRENT FOCUS]`, `[UPCOMING]`). Do not use emojis in status tags.

## 7. Error Explanation Before Code Fixes

**Always explain the root cause first.**

- When the user sends an error message, stack trace, or asks about a bug:
  1. Clearly explain what the error means, where it occurred, and why it happened in plain terms.
  2. Only after providing the full explanation, propose the specific code changes and ask or proceed to apply the fix.

