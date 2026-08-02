---
schema_version: "compozy.tasks/v2"
workflow: login-and-postgis
graph:
  nodes:
    - id: task_01
      file: task_01.md
    - id: task_02
      file: task_02.md
    - id: task_03
      file: task_03.md
    - id: task_04
      file: task_04.md
    - id: task_05
      file: task_05.md
    - id: task_06
      file: task_06.md
  edges:
    - from: task_01
      to: task_02
    - from: task_02
      to: task_03
    - from: task_03
      to: task_04
    - from: task_03
      to: task_05
    - from: task_04
      to: task_06
    - from: task_05
      to: task_06
---

# Account Access and PostGIS Map Persistence Task List

Vertical slices for verified accounts, PostGIS-backed private maps, offline sync, public gallery, administration, and account deletion.

| ID | Title | Type | Complexity |
| --- | --- | --- | --- |
| task_01 | Foundation: bootstrap, PostGIS schema, CLIs, and test harness | infra | high |
| task_02 | Auth API, mailer, and client session UI | backend | high |
| task_03 | Private online maps, elements, and photos | backend | high |
| task_04 | Offline store, sync engine, and safe logout | frontend | critical |
| task_05 | Publication and anonymous public gallery | frontend | medium |
| task_06 | Admin accountability and permanent account deletion | backend | high |

Parallel wave after `task_03`: `task_04` ∥ `task_05`, then `task_06`.
