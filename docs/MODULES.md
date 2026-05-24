# FreeHands — Module Reference

All modules are ES6 classes imported strictly via ES6 module syntax. No CommonJS, no global namespace pollution.

---

## Core Canvas (`src/js/modules/canva/`)

### `CanvasManager`
The composition root for the canvas subsystem. Constructs and holds references to all other managers. Owns primitive state: `brushColor`, `brushSize`, `brushOpacity`, `stabilizerValue`, `fillTolerance`, `currentTool`, `zoom`, `offsetX`, `offsetY`.

Exposes `setBrushSize()`, `setBrushOpacity()`, `setFillTolerance()`, `setTool()`, `resizeCanvas(w, h)`, `placeImage(dataURL)`.

### `CanvasRenderer`
Overrides `fabric.Canvas._renderObjects` to implement per-layer compositing. Maintains a single shared offscreen `layerCanvas` (`HTMLCanvasElement`) that is cleared and reused each render cycle. Each visible layer is drawn into `layerCanvas`, then composited onto the main context with `globalAlpha = layer.opacity / 100` and `globalCompositeOperation = layer.blendMode`.

Objects without a `layerId` (UI overlays, background) are rendered last, outside the layer loop.

### `CanvasEvents`
Centralizes all pointer, keyboard, and Fabric event listeners. Handles: pan (`Space` + drag), zoom (`Ctrl+Wheel`), brush size resize (right-click drag), tool-specific mouse routing, clipboard operations (`Ctrl+C/V/X/D`), and undo/redo (`Ctrl+Z/Y`).

Keeping listeners here prevents cross-contamination between tool modules and allows complex interaction rules (e.g. pan suppressing brush strokes) to be enforced in one place.

### `CanvasTools`
Manages tool transitions. `setTool(name)` enables or disables `isDrawingMode`, assigns the correct brush to `canvas.freeDrawingBrush`, toggles `selectable`/`evented` on all objects, and updates cursor state via `CursorManager`.

### `CanvasImage`
Handles image import: drag-and-drop from the OS and File menu "Place Image". Converts a `dataURL` to a `fabric.Image`, centers it on the canvas, assigns it to the active layer, and registers an `addCommand` in `HistoryManager`.

### `CanvasTexture`
Generates procedural background textures (plain white, parchment, kraft, grid) on an offscreen `<canvas>`. Results are cached under the key `${textureId}_${width}x${height}`. All texture applications use `silent = true` — they modify the background object without registering in the undo history.

---

## Drawing Tools

### `PressureBrush`
Extends `fabric.BaseBrush`. On `pointerdown`, begins collecting `{ x, y, pressure }` points, reading `PointerEvent.pressure` with a fallback of `0.5` for mouse input. Points are smoothed through a positional averaging buffer. On each `pointermove`, `getStroke()` from `perfect-freehand` converts the point array to a filled polygon, which is rendered to `contextTop` via `Path2D` for live preview. On `mouseup`, a final `fabric.Path` is committed to the canvas and `path:created` is fired, which `CanvasEvents` intercepts to register `addCommand`.

Stroke parameters (`thinning`, `taper`, `streamline`) scale dynamically with brush size.

### `EraserBrush`
Extends `fabric.BaseBrush`. Stroke geometry is identical to `PressureBrush` (same `perfect-freehand` pipeline), but on commit, instead of adding a path to the canvas, it iterates all non-background, non-eraser objects on the active layer whose bounding rects intersect the eraser path, and passes each to `rasterizeWithEraser()`.

The live preview on `contextTop` renders the eraser shape in semi-transparent red to indicate the affected area.

### `StabilizedPencilBrush`
Wraps Fabric's built-in `PencilBrush` with a weighted moving-average smoothing pass applied to the stroke points before commit. The stabilizer strength (0–100) is exposed via the toolbar slider.

---

## Layer System

### `LayerManager`
Manages `layers[]` — an ordered array of plain objects `{ id, name, visible, locked, opacity, blendMode }`. The array order determines render order (index 0 = top).

Implements: `addLayer()`, `deleteLayer()`, `duplicateLayer()`, `mergeDown()`, `moveLayer()`, `setActiveLayer()`, `setLayerProperty()`, `toggleState()`.

Layer names use a monotonically incrementing `_layerCount` counter that never decrements on delete or merge, preventing name collisions after structural changes.

`mergeDown(id)` is `async`. It computes the union bounding box of all objects on both layers, rasterizes them onto a cropped offscreen `<canvas>` (layer below first with `source-over`, layer above on top with its `opacity` and `blendMode`), then replaces all objects from both layers with a single selectable `fabric.Image` positioned at `bounds.left / bounds.top`. The operation is registered as a `mergeFull` op in `HistoryManager`.

Z-index consistency is maintained by `updateZIndices()`, which re-sorts `canvas._objects` to match the `layers[]` order after any structural change.

All mutating operations register the appropriate command in `HistoryManager` for full undo support.

The panel UI (drag-to-reorder, context menu, opacity slider, blend mode select) is built and managed entirely within this class via DOM API.

---

## History System

### `HistoryManager`
See [`HISTORY_SYSTEM.md`](HISTORY_SYSTEM.md) for the full specification.

Op types: `add`, `remove`, `modify`, `raster`, `mergeFull`, `layer`, `snapshot_legacy`.

Key methods: `addCommand(objects)`, `removeCommand(objects)`, `modifyCommand(objects, prev, next)`, `rasterCommand(prevURL, nextURL, layerId, prevObjects)`, `mergeFullCommand(data)`, `layerCommand(action, data)`, `undo()`, `redo()`.

---

## Pixel Tools

### `FillManager`
Implements Flood Fill via iterative BFS (stack-based, not recursive, to avoid call stack overflow on large canvases). Reads pixel data from a rasterized snapshot of the active layer into a `Uint8Array`-backed `ImageData`. A separate `Uint8Array visited[width * height]` tracks processed pixels.

Tolerance check is a per-channel absolute difference against the sampled start color. Fill output is written to a new `ImageData`, converted to a `dataURL`, and added as a `fabric.Image` on the active layer. History is recorded as a `rasterCommand`.

### `CutAreaManager`
Draws a rectangular selection on `contextTop`. On confirm, captures the enclosed pixel region from the active layer via `captureLayerDataURL`, crops to the selection bounds, and can either delete the region (boolean erase via `rasterizeWithEraser`) or copy it to the clipboard as a `fabric.Image`.

---

## UI Utilities

### `SelectionPanel`
A floating DOM panel that appears adjacent to the active Fabric selection. Position is computed by converting the object's bounding rect from canvas space (accounting for `viewportTransform` and device pixel ratio) to viewport coordinates. The panel defaults to appearing below the selection and flips above if it would overflow the viewport, avoiding collision with Fabric's rotate handle.

Exposes alignment buttons (left, center, right, top, middle, bottom) and distribute controls. Each action calls `modifyCommand` on completion.

### `AlignmentGuides`
Hooks into `object:moving`, `object:scaling`, and `after:render`. During transform, computes snap candidates (canvas center, object edges/centers of all other objects on the active layer) and applies magnetic correction to the active object's position within a configurable threshold. Active guide lines are drawn onto `contextTop` in the `after:render` callback.

Alt-mode switches from snap to gap measurement: nearest neighbors in each axis are found and gap distances are rendered as labeled dimension lines.

### `ShortcutManager`
Maps keyboard events to tool switches and canvas actions. Organized as a plain lookup table of `key → handler` for clarity and extensibility.

### `CursorManager`
Applies CSS cursor classes to the workspace element based on the active tool. Handles the "brush resize" cursor state during right-click drag.

### `EyeDropperManager`
On activation, renders a rasterized snapshot of the entire canvas to a hidden `<canvas>`, then samples the pixel color at the click position from its `ImageData`. Passes the sampled hex color to `ColorManager`.

---

## Effects & Filters

### `FilterManager`
Wraps Fabric.js built-in image filters (`Brightness`, `Contrast`, `Saturation`, `Blur`, `HueRotation`, `Sepia`, `Invert`). Builds a filter list from slider values, applies to the selected `fabric.Image` via `applyFilters()`, and registers a `modifyCommand`.

### `EffectManager`
Applies per-layer post-processing (drop shadow, noise, color overlay) using CSS filters and canvas compositing on the layer's rendered output. Effects are stored on the layer object and re-applied each render.

### `ColorManager`
Manages the active foreground and background colors. Hosts the HSV color picker (`colorPickerModal`), exposes `setColor(hex)` and `getColor()`. Other modules read `canvasManager.brushColor` directly after `ColorManager` updates it.