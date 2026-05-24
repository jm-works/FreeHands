# Contributing to FreeHands

## Browser Requirement

> ⚠️ FreeHands is developed and tested exclusively on **Chromium-based browsers** (Chrome, Edge, Brave). Before submitting any change, verify behavior in at least one Chromium browser. Firefox compatibility is not a project goal and should not be used as a test target. Rendering discrepancies in Firefox — particularly around `globalCompositeOperation`, Canvas compositing, CSS filters, and custom scrollbars — are known and out of scope.

---

## Stack

- **HTML5 / CSS3 / Vanilla JavaScript (ES6 Modules)** — no build step, no transpiler, no bundler.
- **Fabric.js 5.3.1** — loaded via CDN in `index.html`. Do not upgrade without auditing the `_renderObjects` override in `CanvasRenderer.js`.
- **perfect-freehand** — loaded via `esm.sh` import in `PressureBrush.js` and `EraserBrush.js`.

---

## Code Conventions

**Module structure.** Every feature is a class. Each class receives a `canvasManager` reference at construction and accesses sibling managers through it. Do not import manager classes cross-module — they are not singletons, and circular imports will break.

**History registration.** Any action that modifies the canvas in a way the user would expect to undo must call the appropriate `HistoryManager` command method. Check `historyManager.isProcessing` before registering — do not register commands during undo/redo replay.

**Render triggering.** Always call `canvas.requestRenderAll()` after modifying objects or layer state. Never mutate `canvas._objects` directly.

**Silent operations.** Actions that should not appear in the undo history (e.g. texture application, UI state sync) must pass `silent = true` where the API supports it, and must not call any `HistoryManager` command method.

**Comments.** Comments explain *why* a decision was made, not what a line of code does. Fabric.js internals are non-obvious; non-trivial overrides deserve an explanation of what they replace and why.

**Naming.** Use precise web terminology: `CanvasRenderingContext2D`, `EventListener`, `fabric.Object`, `ImageData`, `viewportTransform`. Avoid informal synonyms.

---

## Adding a New Tool

1. Create a new Manager class in `src/js/modules/`. Receive `canvasManager` in the constructor.
2. Register it in `CanvasManager.js` — instantiate it and assign it to `this.yourManager`.
3. Add a tool ID to the relevant `Set` constants in `CanvasTools.js` (`DRAWING_TOOLS`, `CROSSHAIR_TOOLS`, or `SELECTION_DISABLED_TOOLS`).
4. Handle the tool activation case in `CanvasTools.setTool()`.
5. Wire UI controls in `app.js`.
6. Register all undoable actions via `HistoryManager`.

---

## Adding a New Op Type to HistoryManager

1. Add a registration method (e.g. `xyzCommand(data)`) that calls `_pushOp({ type: 'xyz', ...data })`.
2. Add the forward case to `_applyOp(op)`.
3. Add the reverse case to `_applyOpReverse(op)`.
4. Both methods must restore canvas state and call `canvas.requestRenderAll()` on completion.

---

## File Structure

```
src/
  js/
    app.js                   ← composition root, UI wiring
    modules/
      canva/                 ← CanvasManager and its sub-modules
      utils/                 ← shared utilities (canvasUtils.js)
      HistoryManager.js
      LayerManager.js
      FillManager.js
      PressureBrush.js
      EraserBrush.js
      SelectionPanel.js
      AlignmentGuides.js
      ... (one file per manager)
  css/
  assets/
docs/
README.md
index.html
```

---

## Technical Review

Parts of the codebase underwent AI-assisted technical review for bug identification and targeted corrections. Architecture, design, and implementation are original authorial work. When contributing, please adhere to the existing patterns rather than introducing new abstractions — consistency is preferred over cleverness.
