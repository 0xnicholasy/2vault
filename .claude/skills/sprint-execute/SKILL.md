---
name: sprint-execute
description: "Full sprint implementation loop: plan, build, verify, fix, commit, update progress. Use when implementing a sprint from docs/IMPLEMENTATION.md. Invoke with sprint number (e.g., /sprint-execute 2.1) or no args to auto-detect next TODO sprint. Add --auto-run to chain sprints across fresh contexts."
---

# Sprint Execute

**Role**: Autonomous Sprint Implementation Engine

You execute sprints from `docs/IMPLEMENTATION.md` end-to-end: plan, implement, verify, fix, commit, and update progress. You work autonomously through the implement-verify-fix loop, only stopping for user approval at the planning phase or when hitting hard limits. Each phase produces a checkpoint commit so progress is never lost.

## Arguments

- `{sprintNumber}` (optional): Sprint to execute (e.g., `2.1`). If omitted, auto-detect the next `[ ] TODO` sprint from `docs/IMPLEMENTATION.md`.
- `--auto-run` (optional): When set, after completing a sprint, output a `/clear` command followed by the next `/sprint-execute` invocation so the user can continue in a fresh context window. This prevents context bloat across multi-sprint runs.

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
7. **Checkpoint commit**: Stage `tasks/todo.md` and commit:
   - Message: `docs: Sprint X.Y implementation plan`

### Phase 2: Pre-flight Check

Before writing any code, verify the codebase is in a clean state:

1. Run `bun run typecheck` - record result
2. Run `bun test` - record result
3. Run `git status` - ensure working tree is clean (or only has expected changes)
4. If typecheck or tests have **pre-existing failures**, report them to the user and ask whether to:
   - Fix them first (create a separate fix commit)
   - Continue anyway (document known failures)
   - Abort
5. **Checkpoint commit** (if pre-existing failures were fixed): Stage fixes and commit:
   - Message: `fix: resolve pre-existing failures before Sprint X.Y`

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
3. **Checkpoint commit**: Stage and commit the progress update:
   - Message: `docs: mark Sprint X.Y complete in IMPLEMENTATION.md`

### Phase 7: Report

Print a summary:

```
## Sprint X.Y Complete

**Files changed:** (list)
**Tests:** X passing, Y new
**Verify iterations:** N/5
**Commits:** (list all checkpoint + main commits with hashes)

**Next sprint:** X.Z - (title)
```

### Phase 8: Auto-Run Continuation (only if `--auto-run` flag is set)

If `--auto-run` was passed:

1. Detect the next `[ ] TODO` sprint from `docs/IMPLEMENTATION.md`
2. If no more sprints remain, print "All sprints complete!" and stop
3. Otherwise, print the following block for the user to copy-paste:

```
---
Run this to continue in a fresh context:

/clear
/sprint-execute {nextSprintNumber} --auto-run
```

**Why fresh context?** Each sprint can consume significant context window. Starting fresh ensures the next sprint has full context budget for its own planning, implementation, and debugging. All progress is safely committed to git, so no state is lost.

## Checkpoint Commit Rules

Every phase that produces meaningful artifacts gets its own commit. This ensures:
- Progress is never lost if a later phase fails
- Git history shows clear phase boundaries
- `--auto-run` can safely clear context knowing everything is committed

Checkpoint commits use these prefixes:
- `docs:` for plan and progress updates
- `fix:` for pre-flight fixes
- `feat:` / `fix:` / `refactor:` for implementation commits

**Never squash checkpoint commits** - they preserve the implementation narrative.

## Error Recovery

- **Subagent failure**: Retry once, then fall back to main context
- **Partial implementation**: If some sub-tasks complete but others fail, commit what works and report partial progress. Checkpoint commits ensure completed work is saved.
- **Pre-existing test failures**: Isolate from new failures. Only fix what this sprint introduces.
- **Dependency not installed**: Run `bun install` once. If still failing, report and stop.
- **Context window getting large**: If you notice context growing large mid-sprint, commit current progress and suggest the user run `/clear` then `/sprint-execute X.Y` to continue with a fresh context. The checkpoint commits ensure no work is lost.

## Example Usage

```
/sprint-execute 2.1              # Execute Sprint 2.1: Extension Scaffold
/sprint-execute                  # Auto-detect next TODO sprint
/sprint-execute 2.1 --auto-run   # Execute 2.1, then prompt to chain next sprint
/sprint-execute --auto-run       # Auto-detect + chain sprints across fresh contexts
```
