---
schema_version: "compozy.tasks/v2"
workflow: exportar-mapa
graph:
  nodes:
    - id: task_01
      file: task_01.md
    - id: task_02
      file: task_02.md
    - id: task_03
      file: task_03.md
  edges:
    - from: task_01
      to: task_02
    - from: task_02
      to: task_03
---

# Exportar Mapa Task List

Client-side cartographic export composition in the owner map editor: pure export library and generation pipeline, dedicated Leaflet composition surface (main map, legend, location insets, chrome), then shell/controls wired into `MapEditor` with owner-only gates, ephemeral session, and full mobile parity.
