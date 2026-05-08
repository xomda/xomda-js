# Plan: Floating card layout, resizable panels, nav toggle

## Context

The current layout uses a permanent `VNavigationDrawer` (60px, icon-only) that is part of the Vuetify layout system. This means it occupies a fixed column — the canvas and other views are squeezed to fill the remaining space. The user wants the background (canvas grid, page surface) to fill the full viewport and all chrome to float on top of it. Additionally, the inline panels in templates/file views are fixed-width with no resize mechanism.

Three things to implement:
1. **Replace side navigation drawer** with a floating card that has two toggle states (icon-only / icon+text)
2. **Floating properties panel** in model design mode (overlays canvas instead of pushing it)
3. **Resizable panel dividers** between content panels (templates tree, file tree) with a delayed drag handle

Plus: uniform Vuetify density/size defaults and updated AI agent instructions.

---

## 1. AppNav — floating navigation card

### New component: `packages/client/src/components/AppNav/`
- `AppNav.tsx` — replaces `Sidebar.tsx` and the `VNavigationDrawer` in `App.tsx`
- `AppNav.module.scss`
- `index.ts`

**Behavior:**
- `position: fixed; left: 8px; top: 8px; bottom: 8px; z-index: 1000`
- Two states only (no in-between resize):
  - **Collapsed** (default): ~56px wide — icon only
  - **Expanded**: ~200px wide — icon + text label
- Toggle button at the bottom of the card (chevron right/left icon)
- State persisted via the existing `useLocalStorageStore` (add `navExpanded: boolean`)
- Width transitions with `transition: width 0.2s ease` (snap to one of two values)
- Uses `VCard` with elevation for the floating appearance, `VTooltip` on icons when collapsed
- Same 6 nav items as current `Sidebar.tsx`
- CSS variable `--appnav-width` set on `:root` by the component (used by views that want left margin)

### Changes to `packages/client/src/App.tsx`
- Remove `VNavigationDrawer` import and usage
- Add `<AppNav />` (fixed position, floats above `VMain`)
- `VMain` becomes full-width (no left offset from drawer)
- `VApp` background fills full viewport naturally

### Changes to `packages/client/src/components/index.ts`
- Add `AppNav` export, keep `Sidebar` export until confirmed removable (or remove `Sidebar` since `AppNav` replaces it fully)

---

## 2. Floating properties panel in ModelView

### Changes to `packages/client/src/views/ModelView.tsx`
- Remove the flex layout (`.layout`, `.canvasWrapper`, `.sidebar` pattern)
- Canvas fills 100% of `VMain` (`height: 100%; width: 100%`)
- Properties panel rendered as `position: absolute; right: 16px; top: 16px; bottom: 16px` within a `position: relative` canvas wrapper
- Use `VCard` with elevation for the floating panel appearance
- Animate in/out with CSS: `opacity`, `transform: translateX(+20px → 0)`, `pointer-events`
- Width remains ~350px

### Changes to `packages/client/src/views/ModelView.module.scss`
- Remove `.layout`, `.canvasWrapper` flex layout
- New `.canvasContainer`: `position: relative; height: 100%; width: 100%; overflow: hidden`
- New `.propertiesPanel`: `position: absolute; right: 16px; top: 16px; bottom: 16px; width: 350px; z-index: 10`
  - Hidden: `opacity: 0; transform: translateX(20px); pointer-events: none`
  - Visible: `opacity: 1; transform: translateX(0); pointer-events: auto`
  - Transition: `0.2s ease`
- Keep `.sidebarHeader`, `.sidebarContent` as-is (just rename references)

---

## 3. PanelDivider — resizable panel divider

### New component: `packages/client/src/components/PanelDivider/`
- `PanelDivider.tsx`
- `PanelDivider.module.scss`
- `index.ts`

**Props:**
```ts
{ direction?: 'horizontal' | 'vertical' /* default: vertical */ }
```
**Emits:** `resize(delta: number)` — called during pointermove while dragging

**Behavior:**
- A thin element (full height, ~8px wide hit zone, 1px visible line centered)
- On `pointerenter`: starts a 600ms timer; when timer fires, fades in a grip handle (ease-in, ~250ms)
- On `pointerleave`: clears timer, fades out handle immediately or fast
- On `pointerdown`: starts drag, captures pointer, emits `resize(delta)` on each pointermove
- Cursor: `col-resize` on the element

**Handle appearance:**
```scss
.divider {
  width: 8px; flex-shrink: 0; cursor: col-resize;
  display: flex; align-items: center; justify-content: center;
  position: relative;
}
.line {
  width: 1px; height: 100%;
  background: rgba(var(--v-border-color), var(--v-border-opacity));
}
.handle {
  position: absolute;
  width: 4px; height: 32px; border-radius: 2px;
  background: rgba(var(--v-theme-on-surface), 0.3);
  opacity: 0;
  transition: opacity 0.25s ease-in;
  pointer-events: none;
}
.handle.visible { opacity: 1; }
```

### Composable: `packages/client/src/composables/usePanelResize.ts`
Manages the width state for a resizable left panel:
```ts
function usePanelResize(initialWidth: number, min: number, max: number) {
  const width = ref(initialWidth)
  function onResize(delta: number) { width.value = clamp(width.value + delta, min, max) }
  return { width, onResize }
}
```

---

## 4. Apply resizable panels to views

### `packages/client/src/views/TemplatesView.tsx`
- Remove `VNavigationDrawer` usage — replace with inline flex panel
- Left panel: `<div style={{ width: `${panelWidth.value}px`, flexShrink: 0 }}>`
  - Contains the existing folder tree + template list
- Add `<PanelDivider onResize={onResize} />` between left and right
- Right panel: `<div style="flex: 1">` with the editor
- Use `usePanelResize(280, 160, 480)` composable

### `packages/client/src/views/TemplatePPView.tsx`
- Same pattern as TemplatesView

### `packages/client/src/views/FileBrowserView.tsx`
- Already uses an inline flex layout with a 260px left panel (`style="width:260px; border-right:..."`)
- Convert fixed width to reactive: use `usePanelResize(260, 160, 480)`
- Remove inline `border-right` style (PanelDivider provides the visual separator)
- Add `<PanelDivider onResize={onResize} />` between left and right panels

### `packages/client/src/composables/index.ts`
- Export `usePanelResize`

---

## 5. Vuetify density/size defaults

### Changes to `packages/client/src/vuetify.ts`

```ts
defaults: {
  global: {
    size: 'small',           // already set — keep
    density: 'comfortable',  // ADD: for components that have size prop
  },
  // Override: components without a `size` prop use compact
  VList: { density: 'compact' },
  VListItem: { density: 'compact' },
  VListSubheader: { density: 'compact' },
  VEmptyState: { size: 96 }, // already set — keep
}
```

---

## 6. Update AI agent instructions

### `packages/client/src/vuetify.ts` comment
Already handled by the defaults above — no extra comment needed.

### `.cursor/rules/coding-standards.mdc`
Add a new **UI Layout Patterns** section after "UI Component Priority":

```markdown
### UI Layout Patterns (Cards & Panels)
- **No side navigation drawers** (`VNavigationDrawer`) for content panels. Use floating `VCard` components or inline flex panels instead.
- **Navigation sidebar**: Use the `AppNav` component (`@xomda/client`). It is a floating card with two toggle states (icon-only / icon+text).
- **Floating panels** (model design mode, properties): Use `position: absolute` with `VCard` and elevation. Animate visibility with `opacity`+`transform`.
- **Resizable split panels**: Use the `PanelDivider` component between flex siblings and `usePanelResize` composable for state.
- **Vuetify size/density rule**:
  - Components with a `size` prop: `size="small"` + `density="comfortable"` (set globally in `vuetify.ts`)
  - Components without a `size` prop (VList, VListItem, etc.): `density="compact"` (set per-component in `vuetify.ts`)
  - Never override these defaults inline without a clear reason.
```

### `CLAUDE.md` — Essential Rules section
Add two new rules:
```
13. **No VNavigationDrawer for panels**: Use `AppNav` for navigation and inline flex panels with `PanelDivider` for split layouts.
14. **Vuetify defaults**: Global size=small + density=comfortable for components with size prop; density=compact for VList/VListItem/VListSubheader (configured in vuetify.ts — do not override inline without reason).
```

---

## Files to create (new)
| File | Purpose |
|------|---------|
| `packages/client/src/components/AppNav/AppNav.tsx` | Floating nav card |
| `packages/client/src/components/AppNav/AppNav.module.scss` | AppNav styles |
| `packages/client/src/components/AppNav/index.ts` | Re-exports AppNav |
| `packages/client/src/components/PanelDivider/PanelDivider.tsx` | Draggable divider |
| `packages/client/src/components/PanelDivider/PanelDivider.module.scss` | Divider styles |
| `packages/client/src/components/PanelDivider/index.ts` | Re-exports PanelDivider |
| `packages/client/src/composables/usePanelResize.ts` | Panel width state |

## Files to modify
| File | Change |
|------|--------|
| `packages/client/src/App.tsx` | Remove VNavigationDrawer, add AppNav |
| `packages/client/src/components/index.ts` | Add AppNav export, remove Sidebar |
| `packages/client/src/views/ModelView.tsx` | Floating properties panel |
| `packages/client/src/views/ModelView.module.scss` | New layout styles |
| `packages/client/src/views/TemplatesView.tsx` | Replace VNavigationDrawer with flex+PanelDivider |
| `packages/client/src/views/TemplatesView.module.scss` | Remove sidebar styles |
| `packages/client/src/views/TemplatePPView.tsx` | Same as TemplatesView |
| `packages/client/src/views/FileBrowserView.tsx` | Make left panel resizable |
| `packages/client/src/composables/index.ts` | Export usePanelResize |
| `packages/client/src/vuetify.ts` | Add density defaults |
| `.cursor/rules/coding-standards.mdc` | Add UI Layout Patterns section |
| `CLAUDE.md` | Add rules 13 & 14 |

## Verification
- `pnpm --filter @xomda/client dev` — start dev server, visually verify:
  - AppNav floats over canvas in model view, toggles between narrow/wide
  - Properties panel floats over canvas when entity/package selected
  - Templates/TemplatePP/FileBrowser all have draggable panel dividers
  - Handle appears with fade-in delay on hover
- `pnpm typecheck` — no TypeScript errors
- `pnpm lint` — no lint errors
- `pnpm --filter @xomda/client test` — existing tests pass
