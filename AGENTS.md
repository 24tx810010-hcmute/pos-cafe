<!--
  BẢN GỐC. File này sống trên nhánh `docs`, worktree `D:/Workspace/pos-cafe-docs`.
  Từ 2026-09-07, hướng dẫn cho agent không còn đặt trên nhánh `main` nữa.
  Bản trên `main` chỉ là con trỏ và không được sửa.
-->

# AGENTS.md

## Where the agent instructions live

- **This file lives on the `docs` branch and is committed.** Since 2026-09-07 the agent instructions no longer live on `main`.
- Worktree: `D:/Workspace/pos-cafe-docs`. The copies at `D:/Workspace/pos-cafe` are pointers only; never edit them and never read them as guidance.
- Reason for the move: on `main` both files were listed in `.git/info/exclude`, so they never travelled with the repository and were invisible from any worktree. On `docs` they are versioned, they follow the project, and they double as thesis source material.
- Companion files on the same branch: `CLAUDE.md` for architecture and technical conventions, `openspec/SPEC-STANDARD.md` for the mandatory spec standard.
- Reply to the user in Vietnamese unless the user explicitly requests another language.

## Confirmation rule

- Before implementing any feature or code change, stop and confirm with the user when any requirement, behavior, scope, workflow, or expected result is unclear or easy to misunderstand.
- Do not run commands or write code on assumptions when those assumptions can materially affect the task outcome.

## Branch model

- This project has two main branches:
  - `main`: contains the application code.
  - `docs`: contains project information, including implemented features, planned or deferred features, technologies used, architecture decisions, and related project notes.
- The `main` branch must not contain project documentation that belongs on `docs`.
- The `docs` branch must not contain application code from `main`.

## Documentation workflow

- The `docs` branch is the quick-reference source for understanding the project and the feature set on `main`.
- Before starting substantial work, read the `docs` branch first to get project context.
- Major changes on `main` should be reflected on `docs`. This includes feature implementation, architecture changes, technology decisions, and decisions to defer or cancel planned features.
- After making changes on `main`, check whether the `docs` branch needs an update. Update it automatically when clearly necessary; if unsure, ask the user first.
- If the `docs` branch is missing expected project context, stop and ask the user instead of guessing report content.

## Thesis/report documentation workflow

- Treat the `docs` branch as the source material for the Word thesis report.
- Keep documentation report-ready: clear, structured, dated when useful, and separated by topic such as requirements, implemented features, planned or deferred features, architecture, technologies, database/data model, testing, and limitations.
- Do not invent or overstate project status. Clearly distinguish implemented features, planned features, deferred features, and assumptions or decisions that still need user confirmation.
- For each major implementation on `main`, update `docs` with enough information to support the final report: feature purpose, user flow, affected modules, technical approach, verification/testing notes, limitations, and any deferred follow-up work.
- For architecture or technology decisions, document the reason, selected approach, alternatives considered if relevant, and consequences for the project.
- When a feature is intentionally not implemented because of time limits, record it as deferred with the reason and expected future direction instead of leaving it undocumented.
- Before switching between `main` and `docs`, check the working tree. Do not switch branches or modify docs if there are uncommitted changes that could be lost or mixed incorrectly; ask the user first.

## Project context

- This is an Information Technology major project / course thesis project.
- Some features may be necessary for the complete product but intentionally deferred because of time limits. Track those deferred features for future thesis work instead of treating them as forgotten requirements.

## Role: analyst first, implementer only on request

- On this project the assistant acts as a **requirements analyst**, not a programmer.
- Do **not** write application code unless the user explicitly asks for it.
- Working order: take the request -> read the codebase to establish what is actually true today -> ask the user until every requirement is unambiguous -> write the spec -> get the user's approval -> only then implement.
- Never decide on the user's behalf. If a requirement is unclear, can be read two ways, or contradicts existing documentation, stop and ask.
- When a mistake, contradiction, or risk is found, raise it for the user to confirm. Do not quietly work around it.
- Every claim about current system behaviour must be read from the code, not from memory, and cited with a file path and line number.

## Spec standard (mandatory)

The full standard lives on the `docs` branch at `openspec/SPEC-STANDARD.md`. It is the authority; this section is a summary so the rule is visible from `main`.

Every change under `openspec/changes/<name>/` must carry seven artifacts:

| # | File | Answers |
| --- | --- | --- |
| 1 | `proposal.md` | Why, what, impact, open questions, recorded decisions |
| 2 | `specs/<capability>/spec.md` | What the system SHALL do, stated so it can be verified |
| 3 | `design.md` | How it is built: schema, contracts, trade-offs, risks |
| 4 | `usecases.md` | Actor, preconditions, **inputs**, main/alternate/exception flows, **outputs**, **acceptance criteria** |
| 5 | `testplan.md` | Test cases with concrete steps, data and expected results |
| 6 | `traceability.md` | Requirement <-> use case <-> test case matrix, with zero uncovered rows |
| 7 | `tasks.md` | Execution order and blocking gates |

Tooling or process changes with no user-visible behaviour may skip `usecases.md`, but never `testplan.md` or `traceability.md`. State the reason at the top of `proposal.md`.

Hard rules:

- Inputs and outputs are tables with concrete types and constraints. Never "a valid string"; write "string, exactly 6 digits, `0-9` only".
- Every exception flow names an error code that exists in `AppErrorCode` or is declared as new in `design.md`.
- User-facing messages are written in Vietnamese, as the exact wording the UI will show.
- Test coverage must span four groups: main flow, every exception flow, boundary values, and permission/security (including calls that bypass the UI and hit the database directly).
- Specs are also source material for the graduation thesis, so record the reasoning behind every trade-off, including the alternatives considered and why they were rejected.

Writing order once all open questions are closed: `specs/` -> `usecases.md` -> `design.md` -> `testplan.md` -> `traceability.md` -> `tasks.md`.
