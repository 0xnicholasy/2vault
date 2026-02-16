---
name: sprint-execute
description: "Full sprint implementation loop: plan, build, verify, fix, commit, update progress. Use when implementing a sprint from docs/IMPLEMENTATION.md. Invoke with sprint number (e.g., /sprint-execute 2.1) or no args to auto-detect next TODO sprint."
---

# Sprint Execute

**Role**: Autonomous Sprint Implementation Engine

You execute sprints from `docs/IMPLEMENTATION.md` end-to-end: plan, implement, verify, fix, commit, and update progress. You work autonomously through the implement-verify-fix loop, only stopping for user approval at the planning phase or when hitting hard limits.

## Arguments

- `{sprintNumber}` (optional): Sprint to execute (e.g., `2.1`). If omitted, auto-detect the next `[ ] TODO` sprint from `docs/IMPLEMENTATION.md`.

## Safety Constraints

These are non-negotiable. Violating any of these is a hard stop.

- **Max 5 verify iterations** before stopping and reporting status
- **Never run**: `git push`, `git reset --hard`, `git checkout .`, `git clean`, `git branch -D`, `git push --force`
- **Never use** `git add .` or `git add -A` - always stage specific files
- **Never use** `any` or `unknown` in TypeScript without inline justification
- **Never use** `// eslint-disable` comments
- **No emoji text** in source code
- **Use `bun`** for all package commands (never npm)

## Workflow

### Phase 0: Parse Sprint Spec

1. Read `docs/IMPLEMENTATION.md`
2. If sprint number provided, find that sprint section. If not, find the first sprint marked `[TODO]` or `[ ]`
3. Extract:
   - Sprint title and goal
   - All sub-tasks (the checkbox items)
   - File locations mentioned
   - Dependencies on other sprints
4. If sprint is already `[x] DONE`, stop and report "Sprint already completed"
5. Read the `<!-- Claude Code Tooling -->` comment to identify which agents/skills are recommended for this sprint

### Phase 1: Plan (requires user approval)

1. Enter plan mode
2. Read all existing source files related to this sprint's scope
3. Identify dependencies, imports, and integration points
4. Write implementation plan to `tasks/todo.md` with checkable items:
   - Sub-tasks from IMPLEMENTATION.md mapped to specific code changes
   - Test files to create or modify
   - Verification criteria
5. Present plan to user for confirmation before proceeding
6. If the user rejects or modifies the plan, incorporate feedback and re-present

### Phase 2: Pre-flight Check

Before writing any code, verify the codebase is in a clean state:

1. Run `bun run typecheck` - record result
2. Run `bun test` - record result
3. Run `git status` - ensure working tree is clean (or only has expected changes)
4. If typecheck or tests have **pre-existing failures**, report them to the user and ask whether to:
   - Fix them first (create a separate fix commit)
   - Continue anyway (document known failures)
   - Abort

### Phase 3: Implement

1. Work through plan items sequentially (or use subagents for independent parallel work)
2. For each sub-task:
   - Write the implementation code
   - Write or update tests
   - Mark the item in `tasks/todo.md` as done
3. Use recommended agents/skills from the tooling comment:
   - `sprint-architect` for breaking down complex tasks
   - `browser-extension-builder` for Manifest V3 patterns
   - `frontend-design` for UI components
   - `typescript-expert` for type-level issues
   - `javascript-testing-patterns` for test strategy
4. After writing code, use `pr-review-toolkit:code-reviewer` to check style and patterns

### Phase 4: Verify Loop (max 5 iterations)

Repeat until all checks pass or 5 iterations reached:

1. **Typecheck**: Run `bun run typecheck`
   - If errors: fix them, increment iteration counter, restart loop
2. **Tests**: Run `bun test`
   - If failures: fix them, increment iteration counter, restart loop
3. **Build** (if sprint involves build-relevant changes): Run `bun run build`
   - If errors: fix them, increment iteration counter, restart loop

On each iteration, log:
- Iteration number (e.g., "Verify iteration 2/5")
- What failed
- What was fixed

If 5 iterations reached without all checks passing:
- Stop implementation
- Report: what passes, what still fails, what was attempted
- Do NOT commit broken code

### Phase 5: Commit

Only reached if all checks pass:

1. Run `git status` to see all changed files
2. Run `git diff` to review changes
3. Stage specific files (never `git add .`):
   - Source files changed
   - Test files changed
   - Configuration files changed (if any)
   - Do NOT stage `.env`, credentials, or large binaries
4. Write conventional commit message:
   - Format: `feat: <description>` for new features, `fix:` for fixes, `refactor:` for refactoring
   - Include sprint reference: `(Sprint X.Y)`
   - Include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
5. Create the commit

### Phase 6: Update Progress

1. In `docs/IMPLEMENTATION.md`:
   - Change sprint checkbox items from `[ ]` to `[x]` for completed items
   - Change sprint header status from `[TODO]` to `[DONE]`
2. In `tasks/todo.md`:
   - Mark all completed items
   - Add review notes section
3. Stage and commit the progress update:
   - Message: `docs: mark Sprint X.Y complete in IMPLEMENTATION.md`

### Phase 7: Report

Print a summary:

```
## Sprint X.Y Complete

**Files changed:** (list)
**Tests:** X passing, Y new
**Verify iterations:** N/5
**Commits:** (hash - message)

**Next sprint:** X.Z - (title)
```

## Error Recovery

- **Subagent failure**: Retry once, then fall back to main context
- **Partial implementation**: If some sub-tasks complete but others fail, commit what works and report partial progress
- **Pre-existing test failures**: Isolate from new failures. Only fix what this sprint introduces.
- **Dependency not installed**: Run `bun install` once. If still failing, report and stop.

## Example Usage

```
/sprint-execute 2.1    # Execute Sprint 2.1: Extension Scaffold
/sprint-execute        # Auto-detect next TODO sprint
```
