# Classic board vs Staged-gate Scrumban (implementation guideline)

Manual guideline for the project workflow-mode split. Follow this when adding features so classic and Scrumban stay cleanly separated.

## Intent (locked)

Existing projects must keep **classic Plane** behavior. Hierarchy customizations must **not** reshape those boards. Scrumban is a **create-time choice** for new projects only.

| Mode                 | Meaning                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------- |
| **Classic baseline** | Stock Plane before hierarchy (`workflow_mode = scrum`)                                  |
| **Scrumban**         | L1 Milestone → L2 Epic → L3 delivery → L4 sub-task; locked board/list; Cycles-first nav |

**Rule:** every Scrumban product surface is gated behind `Project.workflow_mode`. Missing/unknown mode → treat as classic (`scrum`).

## Production safety (will classic break?)

**No — shipping this should not break existing classic projects**, if migrations `0133`–`0136` run on deploy.

| Guard         | What it does                                                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0133`        | Adds `workflow_mode`, backfills **all existing projects → `scrum`**                                                                                         |
| `0134`        | For `scrum` projects that already got `hierarchy_board:*` columns: restore classic Backlog/Todo/In Progress/Done/Cancelled (+ Triage) and remap issues back |
| `0135`        | Reset Scrumban-shaped saved display filters on classic projects                                                                                             |
| `0136`        | Scrumban only: remap QA To Do/In Progress → shared To Do/In Progress; soft-delete QA columns                                                                |
| FE/BE helpers | `isStagedGateScrumbanMode(mode)` defaults **false** (classic-safe)                                                                                          |

**Caveats (not breakages, but know them):**

- Schema fields (`hierarchy_level`, `progress_status`, `qa_outcome`, etc.) stay global; classic UI does not surface them.
- A project that was already intentionally using hierarchy boards and should **stay** Scrumban must be set to `staged_gate_scrumban` after deploy — otherwise `0134` restores classic states.
- Scrumban is **opt-in at create**; there is no silent upgrade of existing projects.

## Mode model

`Project.workflow_mode`:

- `scrum` — classic (default)
- `staged_gate_scrumban` — custom

- Migration backfills **all existing rows → `scrum`**.
- Create UI: two cards (Scrum vs Staged-gate Scrumban) — titles only.
- Branch form defaults + post-create “Open” URL by mode.

Helpers:

- Backend: seed via `default_states_for_workflow_mode(workflow_mode)`
- Frontend: `PROJECT_WORKFLOW_MODE`, `isStagedGateScrumbanMode(mode)`, `useIsStagedGateScrumban` — **default false / classic-safe**

## Critical release fix: do not remap classic boards

Migrations `0128`–`0131` historically seeded/remapped hierarchy board states for **every** project. That breaks “no impact” on release.

Required approach (done):

1. `0133` — add `workflow_mode`, backfill `scrum`
2. `0134` — restore classic columns for scrum that already had hierarchy remaps; leave Scrumban alone
3. Mode-aware defaults in `apps/api/plane/db/models/state.py`:
   - `DEFAULT_STATES_SCRUM` — classic five (+ triage)
   - `DEFAULT_STATES_STAGED_GATE_SCRUMBAN` — hierarchy board set
4. Project create: seed states/types/estimate/intake **by mode only**. Hierarchy types + Linear estimate seed **only** for Scrumban creates.

## Product matrix (must gate)

| Surface                     | Classic (`scrum`)                          | Scrumban (`staged_gate_scrumban`)                              |
| --------------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| Feature defaults            | cycle/module/views/intake **off**, page on | all those **on** + default Intake                              |
| Seeded states               | classic Backlog…Cancelled                  | hierarchy board columns (4 + Triage)                           |
| Nav                         | Work items visible; default **work_items** | hide Work items; Hierarchy on; default **cycles**              |
| List/board display          | user-controlled (no `LOCKED_*`)            | locked list/board filters                                      |
| Header filters              | normal filter row                          | pinned **Category** (L3 type) → State (progress) → Assignees   |
| Issue fetch                 | all levels as classic                      | L3-focused board fetch; L4 in state columns under L3 swimlanes |
| Modules tab                 | Plane Module list + Add module             | Milestone + Epic planner (not a rename of Module)              |
| Assignee / progress filters | classic self-match                         | L4-child / include-children semantics                          |
| Open after create           | `/issues`                                  | `/cycles`                                                      |
| Hierarchy type badges       | hidden                                     | shown (Milestone / Epic / Story / Design / Dev / QA)           |

## Scrumban board rules (current)

Board columns (L4 states): **To Do** · **In Progress** · **Under Review** · **Done** (Design / Dev / QA share these).

| Rule                     | Behavior                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Swimlanes                | One row per L3; L4 cards in state columns                                                                                                                                                         |
| L3 header                | Chevron = collapse/expand; **title click = open L3 peek**; badge before title; progress dropdown after                                                                                            |
| L3 Total SP              | Read-only property **below Estimate** on L3 peek/sidebar: Design / Dev / QA Σ of L4 points                                                                                                        |
| L4 sub-work items        | Sub-task rows show editable **Estimate** (when project estimates are on); updates L3 Total SP optimistically                                                                                      |
| Add sub-task             | Only on **To Do** column (not other columns)                                                                                                                                                      |
| Create from Add sub-task | Pick Design / Dev / QA → title → Enter; parent = L3                                                                                                                                               |
| QA create routing        | QA type lands in shared **To Do** (same as Design/Dev)                                                                                                                                            |
| Leave To Do gate         | **Dev** and **QA** cannot leave To Do without **assignee + estimate** (toast + API validation). Design is not gated.                                                                              |
| L4 parent lock           | L4 cannot change parent: no cross-L3 swimlane drag; parent property read-only; remove-from-parent disabled; API rejects reparent                                                                  |
| Quick-add UX             | Close (X) + Escape cancel; after Enter, return to **+ Add sub-task**                                                                                                                              |
| Layout                   | Columns fill width; cards sit up to **3-up** in a column when wide enough; L3 swimlane title is **bold ~1.5×** size                                                                               |
| Board Add sub-task       | Type + title + **assignee** before Enter                                                                                                                                                          |
| Pinned filters           | **Category** (Story/Task/Bug/Story-bug) → **State** (L3 progress) → **Assignees**                                                                                                                 |
| L3 Total SP              | Derived on list/detail API (`design_estimate_points` / `dev_estimate_points` / `qa_estimate_points`); shown under Estimate on L3 card; FE optimistically adjusts on L4 estimate edit — no polling |

## Classic vs Scrumban UI splits

Prefer mode-routed files instead of scattering `if (isScrumban)` deep in shared trees:

- `*.classic.tsx` / `*.scrumban.tsx` with a thin router (e.g. sidebar, properties, peek, default-properties, sub-issue quick-action)
- Shared helpers: `hierarchy-status.ts`, `use-workflow-mode.ts`, `resolveTodoStateId`

**Modules vs Epic (locked meaning):**

- Classic Modules tab = Plane `Module` entity
- Scrumban Modules tab = Milestone + Epic planner
- Epic = L2 hierarchy work item — **not** a rename of Module

## Implementation checklist

### Persist mode + classic create defaults

- [x] `Project.workflow_mode` + classic BooleanField defaults (`cycle_view` etc. False)
- [x] Migrations `0133`–`0136`
- [x] Serializers include `workflow_mode` on create/list
- [x] Types/constants: `TProjectWorkflowMode`, `PROJECT_WORKFLOW_MODE`, `isStagedGateScrumbanMode`

### Create picker + branched seeding

- [x] Picker under `apps/web/core/components/projects/create/`
- [x] Mode-based feature defaults in create `utils.ts`
- [x] Open CTA → issues vs cycles in `project-feature-update.tsx`
- [x] App + API project create: seed states/types/estimate/intake by mode only

### Hard-gate Scrumban UX (default false = classic-safe)

Gate with `isStagedGateScrumbanMode(project.workflow_mode)`:

- [x] Nav: `use-navigation-items.ts`, `project-navigation.tsx`, `tab-navigation-utils.ts`
- [x] Locked layouts: `resolveDisplayFiltersForLayout` only when Scrumban
- [x] Pinned filters: layout roots only when Scrumban
- [x] Filter semantics: classic assignee/progress for scrum in `filterset.py`
- [x] L3 swimlanes + L4 board create / leave-To Do rules / L3 title peek
- [x] Classic/scrumban component splits for sidebar, properties, peek, modal defaults, sub-issue actions

### Data safety

- [x] Cleanup migration for scrum projects that already received hierarchy board states (`0134`)
- [x] Display-filter reset for scrum (`0135`)
- [x] Collapse QA columns on Scrumban (`0136`)
- [x] Do **not** re-run global remap on upgrade after this patch

### Keep

- [x] ListFilterPlus (+) criteria visibility fix + pinned props excluded from + dropdown on list/board (Scrumban); classic unaffected when pins are off

## Verification

1. Existing project (`scrum`): Work items tab, free group-by, classic states, no pinned L3 bar, no hierarchy badges
2. New Scrum project: same as classic
3. New Scrumban project: Cycles-first, locked board/list, pinned filters, hierarchy states, Hierarchy nav
4. Creating Scrumban does not change any existing project’s states/nav
5. Scrumban board: Add sub-task only on To Do; Design/Dev/QA share four columns; Dev/QA blocked leaving To Do without assignee+estimate; L3 title opens peek

## Decision flow

```text
Create project
    → workflow_mode?
        → scrum (default / existing)
            → Work items + free layouts
            → Classic states (Backlog / Todo / Done / …)
        → staged_gate_scrumban (opt-in)
            → Cycles + Hierarchy nav
            → Hierarchy board columns
            → Locked list/board + pinned filters
            → L3 swimlanes + L4 Design/Dev/QA rules
```

## Do / don’t

**Do**

- Gate new hierarchy UX behind `workflow_mode === staged_gate_scrumban`
- Default missing mode to classic
- Seed Scrumban-only data only on Scrumban create
- Prefer `.classic.tsx` / `.scrumban.tsx` splits for large surfaces
- Keep API validation for Scrumban rules (e.g. leave-To Do) so dropdowns/API clients cannot bypass the board

**Don’t**

- Apply `LOCKED_*` display filters to classic projects
- Hide Work items or force Cycles default on classic
- Remap classic project states to `hierarchy_board:*` in bulk migrations
- Mix Scrumban filter semantics into classic assignee/progress filters
- Auto-seed hierarchy types (Milestone/Epic/Story/…) on classic projects (list endpoint must check `workflow_mode`)
- Label Plane Modules as “Epic” — Module stays Module; Epic is only a hierarchy type name on Scrumban work items
- Show Scrumban Add sub-task / leave-To Do gates on classic boards
