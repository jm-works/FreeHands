# FreeHands — History System

## Design

`HistoryManager` implements the Command Pattern for undo/redo. The core invariant is that every undoable action produces a discrete, self-contained op rather than a full canvas snapshot. This keeps memory usage bounded and undo/redo operations fast regardless of canvas complexity.

---

## Op Types

| Type | When registered | Undo | Redo |
|---|---|---|---|
| `add` | Object(s) added to canvas | Remove objects | Re-add objects |
| `remove` | Object(s) removed from canvas | Re-add objects | Remove objects |
| `modify` | Transform, style, or property change | Apply `prev` props | Apply `next` props |
| `raster` | Pixel-destructive operation (erase, fill, cut) | Restore `prevDataURL` image | Restore `nextDataURL` image |
| `mergeFull` | Layer merge (rasterizes two layers into one image) | Remove merged image, restore both layers' objects and source layer in stack | Re-apply merged image at original position, remove source layer from stack |
| `layer` | Layer structure change (add, delete, duplicate, merge, move, property) | Reverse layer mutation | Re-apply layer mutation |
| `snapshot_legacy` | Full canvas + layer state snapshot | Restore full snapshot | Restore full snapshot |

`snapshot_legacy` exists as a fallback. No active module calls `saveState()` directly — it remains for edge cases not yet covered by atomic ops.

---

## Op Stack Structure

```
ops[]      ← array of op objects
cursor     ← index of current state (last applied op)
snapshots  ← periodic full snapshots, one per SNAPSHOT_EVERY (15) ops
```

`_pushOp(op)` truncates `ops` at `cursor + 1` (discards redo branch) before pushing the new op. `cursor` advances on push and retreats on undo.

---

## Object Identity

Every `fabric.Object` on the canvas is assigned a monotonically increasing `__uid` integer via `_assignUID()`. UIDs are serialized into `toObject()` output via the `CUSTOM_FABRIC_PROPS` list (`['layerId', 'isBg', 'isEraser']` + `__uid`).

`_findObjectByUID(uid)` resolves a live canvas object from a stored UID, allowing `modify` ops to target the correct instance after undo/redo cycles have restored objects from JSON.

---

## Synchronization Guard

`isProcessing` (boolean, synchronous) is set to `true` for the duration of any undo or redo operation. All modules that register commands check `historyManager.isProcessing` before calling any command method, preventing re-entrant history registration during replay.

The `__historyRegistered` flag on individual objects serves a similar purpose for `path:created` event handlers — it prevents a path that was re-added during undo from triggering a second `addCommand`.

---

## Raster Ops

Raster ops store a `prevDataURL` and `nextDataURL` for the affected layer. On undo, the previous snapshot image is re-added to the layer and all vector objects that existed before the destructive operation (`prevObjects`) are restored. On redo, the next snapshot image replaces them.

`captureLayerDataURL(layerId)` renders all objects on a given layer to a temporary `fabric.StaticCanvas` (offscreen, no interaction overhead) and returns a PNG data URL. This capture happens before and after every pixel-destructive operation.

---

## Periodic Snapshots

Every `SNAPSHOT_EVERY` (15) ops, a full canvas JSON and layer state are stored in `snapshots[]`. During a long undo sequence, reaching a snapshot allows the full state to be restored in one step rather than replaying 15 individual reverse ops. This is a performance hedge for large histories.

---

## Layer Commands

`layerCommand(action, data)` handles the full undo/redo lifecycle for structural layer changes. Each `action` variant carries enough data to reverse itself:

- `add` — stores the layer descriptor; undo removes it and its objects.
- `delete` — stores the layer descriptor + serialized objects; undo restores both.
- `duplicate` — stores source ID, new ID, index, and object JSON.
- `move` — stores previous and next indices.
- `property` — stores `prop`, `prevValue`, `nextValue` (used for opacity, blendMode, visible, locked).

> **Note:** `mergeDown` no longer uses `layerCommand('merge', ...)`. It registers a `mergeFull` op instead — see Op Types above.