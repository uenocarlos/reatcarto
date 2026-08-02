---
provider: manual
pr:
round: 5
round_created_at: 2026-08-02T18:41:38Z
status: resolved
file: src/components/map/export/CompositionPreview.jsx
line: 42
severity: high
author: claude-code
provider_ref:
---

# Issue 002: Beside/below layout ignores composition growth

## Review Comment

`buildPreviewModel` computes `compositionLayout` via `computeCompositionLayout` (UT-022/023 assert `totalWidth`/`totalHeight` grow for beside/below), but `CompositionPreview` never applies it:

```jsx
const layout = model.compositionLayout;
// ...
style={{
  aspectRatio: String(model.paperFrame.aspect),
  maxHeight: '100%',
}}
```

The capture root stays locked to the paper aspect ratio. Legend `beside`/`below` only compete inside that box (`flex-1` map + external `LegendFrame`), so the map shrinks and the exported PNG does not grow to include map + legend + chrome as required by ADR-005 / US-004.

Suggested fix: derive the preview/capture container size from `compositionLayout.totalWidth` / `totalHeight` (plus header/footer), or set `aspectRatio` to `totalWidth/totalHeight` when the legend is outside the map. Keep the map frame on the paper aspect and let the outer composition grow. Extend UT-022-style checks to assert the DOM/`data-testid="composition-preview"` dimensions (or style) reflect growth, not only the pure layout helper.

## Triage

- Decision: `valid`
- Root cause: `CompositionPreview` lia `model.compositionLayout` mas aplicava `aspectRatio: model.paperFrame.aspect` no container raiz (`data-testid="composition-preview"`). Com legenda `beside`/`below`, mapa e legenda competiam dentro da caixa de aspecto do papel (`flex-1`), encolhendo o mapa em vez de expandir a composição exportada (ADR-005 / US-004).
- Fix: quando `layout.legendOutsideMap`, o preview usa `layout.totalWidth / layout.totalHeight` como aspecto do container de captura; o frame do mapa mantém `paperAspect` via `aspectRatio` e `flex: 0 1 auto`. Atributos `data-composition-aspect` / `data-map-aspect` expõem os valores para testes. UT-022b/UT-023b validam modelo + contrato de source em `CompositionPreview.jsx`.
