# Classic board vs Staged-gate Scrumban (implementation guideline)

Manual guideline for the project workflow-mode split. Follow this when adding features so classic and Scrumban stay cleanly separated.

## Intent (locked)

Existing projects (~10 at release) must keep **classic Plane** behavior. Hierarchy customizations from commits `b9b8a78302` → `762dbcdc5b` must **not** reshape those boards. Scrumban is a **create-time choice** for new custom projects only.

| Mode                 | Meaning                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Classic baseline** | Git parent of first hierarchy commit: `5f7d92784c` (`release: v1.4.2`), i.e. `b9b8a78302^`                        |
| **Scrumban**         | Current hierarchy product (L1–L4, locked list/board, pinned L3 filters, Cycles-first nav, hierarchy board states) |

**Rule:** every Scrumban product surface is gated behind `Project.workflow_mode`. Missing/unknown mode → treat as classic (`scrum`).

## Mode model

`Project.workflow_mode`:

- `scrum` — classic (default)
- `staged_gate_scrumban` — custom

- Migration backfills **all existing rows → `scrum`**.
- Create UI: two cards (Scrum vs Staged-gate Scrumban).
- Branch form defaults + post-create “Open” URL by mode.

Helpers:

- Backend: seed via `default_states_for_workflow_mode(workflow_mode)`
- Frontend: `PROJECT_WORKFLOW_MODE`, `isStagedGateScrumbanMode(mode)` — **default false / classic-safe**

## Critical release fix: do not remap classic boards

Migrations `0128`–`0131` historically seeded/remapped hierarchy board states for **every** project. That breaks “no impact” on release.

Required approach:

1. Add `workflow_mode` (migration e.g. `0133`) and backfill `scrum`.
2. Follow-up data migration for DBs that already ran hierarchy remaps:
   - Leave Scrumban projects alone
   - For `workflow_mode=scrum` with `hierarchy_board:*` states: restore classic columns (Backlog / Todo / In Progress / Done / Cancelled + Triage) and remap issues back to classic states
3. Mode-aware defaults in `apps/api/plane/db/models/state.py`:
   - `DEFAULT_STATES_SCRUM` — classic five (+ triage)
   - `DEFAULT_STATES_STAGED_GATE_SCRUMBAN` — hierarchy board set
4. Project create: seed states/types/estimate/intake **by mode only**. Hierarchy types + Linear estimate seed **only** for Scrumban creates.

**Honest limit:** schema columns (`hierarchy_level`, `progress_status`, etc.) remain global; classic UI does not surface them.

## Product matrix (must gate)

| Surface                     | Classic (`scrum`)                          | Scrumban (`staged_gate_scrumban`)                                      |
| --------------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| Feature defaults            | cycle/module/views/intake **off**, page on | all those **on** + default Intake                                      |
| Seeded states               | classic Backlog…Cancelled                  | hierarchy board columns                                                |
| Nav                         | Work items visible; default **work_items** | hide Work items; Hierarchy on (milestones + epics); default **cycles** |
| List/board display          | user-controlled (no `LOCKED_*`)            | locked list/board filters                                              |
| Header filters              | normal filter row                          | pinned L3 status + assignees                                           |
| Issue fetch                 | all levels as classic                      | L3-focused board fetch                                                 |
| Modules tab                 | Plane Module list + Add module             | Milestone + Epic list: Create milestone, Create epic, drag to group    |
| Assignee / progress filters | classic self-match                         | L4-child / include-children semantics                                  |
| Open after create           | `/issues`                                  | `/cycles`                                                              |

## Implementation checklist

### Persist mode + classic create defaults

- [x] `Project.workflow_mode` + classic BooleanField defaults (`cycle_view` etc. False)
- [x] Migration: add field, backfill `scrum`, alter defaults
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
- [x] L3-only fetch / hierarchy modules list / epic labels / progress-status widgets: Scrumban only (fetch + modules list gated; remaining epic label/progress widgets may still show fields if present — hide via UX follow-ups as needed)

### Data safety

- [x] Cleanup migration for scrum projects that already received hierarchy board states (`0134`)
- [x] Do **not** re-run global remap on upgrade after this patch

### Keep

- [x] ListFilterPlus (+) criteria visibility fix + pinned props excluded from + dropdown on list/board (Scrumban); classic unaffected when pins are off

## Verification

1. Existing project (`scrum`): Work items tab, free group-by, classic states, no pinned L3 bar
2. New Scrum project: same as classic
3. New Scrumban project: Cycles-first, locked board/list, pinned filters, hierarchy states, Hierarchy nav
4. Creating Scrumban does not change any existing project’s states/nav

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
```

## Do / don’t

**Do**

- Gate new hierarchy UX behind `workflow_mode === staged_gate_scrumban`
- Default missing mode to classic
- Seed Scrumban-only data only on Scrumban create

**Don’t**

- Apply `LOCKED_*` display filters to classic projects
- Hide Work items or force Cycles default on classic
- Remap classic project states to `hierarchy_board:*` in bulk migrations
- Mix Scrumban filter semantics into classic assignee/progress filters
- Auto-seed hierarchy types (Milestone/Epic/Story/…) on classic projects (list endpoint must check `workflow_mode`)
- Label Plane Modules as “Epic” — Module stays Module; Epic is only a hierarchy type name on Scrumban work items
