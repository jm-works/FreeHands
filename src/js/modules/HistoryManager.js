const SNAPSHOT_EVERY = 15;
const CUSTOM_FABRIC_PROPS = ['layerId', 'isBg', 'isEraser'];

let _uidCounter = 0;

export class HistoryManager {

    constructor(canvasManager) {
        this.canvasManager = canvasManager;
        this.canvas = canvasManager.canvas;

        this.ops = [];
        this.cursor = -1;
        this.snapshots = [];

        this.isProcessing = false;
    }

    addCommand(objects) {
        if (!objects || objects.length === 0) return;
        const arr = Array.isArray(objects) ? objects : [objects];
        arr.forEach(obj => this._assignUID(obj));

        this._pushOp({
            type: 'add',
            snapshots: arr.map(obj => ({
                uid: obj.__uid,
                json: obj.toObject(CUSTOM_FABRIC_PROPS),
                index: this.canvas.getObjects().indexOf(obj)
            }))
        });
    }

    removeCommand(objects) {
        if (!objects || objects.length === 0) return;
        const arr = Array.isArray(objects) ? objects : [objects];

        this._pushOp({
            type: 'remove',
            snapshots: arr.map(obj => ({
                uid: obj.__uid || null,
                json: obj.toObject(CUSTOM_FABRIC_PROPS),
                index: this.canvas.getObjects().indexOf(obj)
            }))
        });
    }

    modifyCommand(objects, prevProps, nextProps) {
        if (!objects || objects.length === 0) return;
        const arr = Array.isArray(objects) ? objects : [objects];

        this._pushOp({
            type: 'modify',
            deltas: arr.map((obj, i) => ({
                uid: obj.__uid,
                prev: prevProps[i],
                next: nextProps[i]
            }))
        });
    }

    rasterCommand(prevDataURL, nextDataURL, layerId, prevObjects = []) {
        this._pushOp({
            type: 'raster',
            prevDataURL,
            nextDataURL,
            prevObjects,
            layerId
        });
    }

    /**
     * @param {string} layerId
     * @returns {Array} 
     */
    snapshotLayerObjects(layerId) {
        return this.canvas.getObjects()
            .filter(obj => obj.layerId === layerId && !obj.isBg)
            .map(obj => ({
                uid: obj.__uid || null,
                json: obj.toObject(CUSTOM_FABRIC_PROPS),
                index: this.canvas.getObjects().indexOf(obj)
            }));
    }

    saveState() {
        if (this.isProcessing || !this.canvasManager.layerManager || !this.canvas) return;

        const canvasJSON = this.canvas.toJSON(CUSTOM_FABRIC_PROPS);
        const layersState = this.canvasManager.layerManager.getLayersState();

        this._pushOp({
            type: 'snapshot_legacy',
            canvasJSON,
            layersState
        });
    }

    undo() {
        if (this.cursor < 0 || this.isProcessing) return;
        if (this.ops[this.cursor].type === 'base') return;
        this.isProcessing = true;

        const op = this.ops[this.cursor];
        this._applyOpReverse(op).then(() => {
            this.cursor--;
            this.isProcessing = false;
        });
    }

    redo() {
        if (this.cursor >= this.ops.length - 1 || this.isProcessing) return;

        this.isProcessing = true;

        this.cursor++;
        const op = this.ops[this.cursor];
        this._applyOp(op).then(() => {
            this.isProcessing = false;
        });
    }

    _pushOp(op) {
        if (this.cursor < this.ops.length - 1) {
            this.ops.splice(this.cursor + 1);
            this.snapshots = this.snapshots.filter(s => s.atCursor <= this.cursor);
        }

        this.ops.push(op);
        this.cursor = this.ops.length - 1;

        if (this.cursor > 0 && this.cursor % SNAPSHOT_EVERY === 0) {
            this._takeSnapshot();
        }
    }

    async _applyOp(op) {
        switch (op.type) {
            case 'base': return;
            case 'add':
                await this._readdObjects(op.snapshots);
                break;

            case 'remove':
                op.snapshots.forEach(({ uid }) => {
                    const obj = this._findObjectByUID(uid);
                    if (obj) this.canvas.remove(obj);
                });
                this.canvas.requestRenderAll();
                break;

            case 'modify':
                this.canvas.discardActiveObject();
                op.deltas.forEach(({ uid, next }) => {
                    const obj = this._findObjectByUID(uid);
                    if (obj) {
                        obj.set(next);
                        if (obj.type === 'i-text') obj.initDimensions();
                        obj.setCoords();
                    }
                });
                this.canvas.requestRenderAll();
                break;

            case 'raster':
                await this._restoreRasterLayer(op.nextDataURL, op.layerId);
                break;

            case 'snapshot_legacy':
                await this._restoreSnapshot(op.canvasJSON, op.layersState);
                break;

            case 'layer':
                await this._applyLayerOp(op);
                break;
        }
    }

    async _applyOpReverse(op) {
        switch (op.type) {
            case 'base': return;
            case 'add':
                op.snapshots.forEach(({ uid }) => {
                    const obj = this._findObjectByUID(uid);
                    if (obj) this.canvas.remove(obj);
                });
                this.canvas.requestRenderAll();
                break;

            case 'remove':
                await this._readdObjects(op.snapshots);
                break;

            case 'modify':
                this.canvas.discardActiveObject();
                op.deltas.forEach(({ uid, prev }) => {
                    const obj = this._findObjectByUID(uid);
                    if (obj) {
                        obj.set(prev);
                        if (obj.type === 'i-text') obj.initDimensions();
                        obj.setCoords();
                    }
                });
                this.canvas.requestRenderAll();
                break;

            case 'raster':
                this.canvas.getObjects()
                    .filter(obj => obj.layerId === op.layerId && !obj.isBg)
                    .forEach(obj => this.canvas.remove(obj));

                if (op.prevObjects && op.prevObjects.length > 0) {
                    await this._readdObjects(op.prevObjects);
                } else {
                    this.canvas.requestRenderAll();
                }
                break;

            case 'snapshot_legacy': {
                const prevOp = this._findPrevSnapshotLegacy(this.cursor - 1);
                if (prevOp) {
                    await this._restoreSnapshot(prevOp.canvasJSON, prevOp.layersState);
                } else {
                    this.canvas.clear();
                    if (this.canvasManager.layerManager) {
                        this.canvasManager.layerManager.restoreLayersState([]);
                    }
                    this.canvas.requestRenderAll();
                }
                break;
            }

            case 'layer':
                await this._applyLayerOpReverse(op);
                break;
        }
    }

    _takeSnapshot() {
        if (!this.canvasManager.layerManager) return;

        this.snapshots.push({
            atCursor: this.cursor,
            canvasJSON: this.canvas.toJSON(CUSTOM_FABRIC_PROPS),
            layersState: this.canvasManager.layerManager.getLayersState()
        });
    }

    _findSnapshotBefore(cursorTarget) {
        let best = null;
        for (const snap of this.snapshots) {
            if (snap.atCursor <= cursorTarget) best = snap;
            else break;
        }
        return best;
    }

    _findPrevSnapshotLegacy(fromCursor) {
        for (let i = fromCursor; i >= 0; i--) {
            const op = this.ops[i];
            if (op && op.type === 'snapshot_legacy' && op.canvasJSON) {
                return op;
            }
        }
        return null;
    }

    _assignUID(obj) {
        if (!obj.__uid) {
            obj.__uid = `fh_${++_uidCounter}_${Date.now()}`;
        }
    }

    _findObjectByUID(uid) {
        if (!uid) return undefined;
        return this.canvas.getObjects().find(obj => obj.__uid === uid);
    }

    _findObjectByJSON(json) {
        return this.canvas.getObjects().find(obj =>
            obj.type === json.type &&
            Math.abs((obj.left || 0) - (json.left || 0)) < 1 &&
            Math.abs((obj.top || 0) - (json.top || 0)) < 1
        );
    }

    _restoreRasterLayer(dataURL, layerId) {
        return new Promise((resolve) => {
            const layerObjects = this.canvas.getObjects().filter(
                obj => obj.layerId === layerId && !obj.isBg
            );

            const insertIndex = layerObjects.length > 0
                ? this.canvas.getObjects().indexOf(layerObjects[0])
                : -1;

            layerObjects.forEach(obj => this.canvas.remove(obj));

            fabric.Image.fromURL(dataURL, (img) => {
                img.set({
                    left: 0,
                    top: 0,
                    layerId,
                    selectable: false,
                    evented: false,
                    hasControls: false,
                    hasBorders: false,
                    originX: 'left',
                    originY: 'top'
                });

                if (insertIndex > -1) {
                    this.canvas.insertAt(img, insertIndex, false);
                } else {
                    this.canvas.add(img);
                }

                this.canvas.requestRenderAll();
                resolve();
            });
        });
    }

    _restoreSnapshot(canvasJSON, layersState) {
        return new Promise((resolve) => {
            this.canvas.loadFromJSON(canvasJSON, () => {
                if (this.canvasManager.layerManager) {
                    this.canvasManager.layerManager.restoreLayersState(layersState);
                }

                const textureHandler = this.canvasManager.textureHandler;
                if (textureHandler) {
                    const textureId = textureHandler.currentTextureId;
                    if (textureId && textureId !== 'none') {
                        textureHandler.setPaperTexture(textureId, true);
                        setTimeout(() => {
                            this.canvas.renderAll();
                            resolve();
                        }, 50);
                        return;
                    }
                }

                this.canvas.renderAll();
                resolve();
            });
        });
    }

    _readdObjects(snapshots) {
        return new Promise((resolve) => {
            if (snapshots.length === 0) { resolve(); return; }

            const jsons = snapshots.map(s => s.json);

            fabric.util.enlivenObjects(jsons, (revived) => {
                const isSelectTool = this.canvasManager.currentTool === 'select';

                revived.forEach((obj, i) => {
                    if (!obj) return;
                    const { uid, index } = snapshots[i];
                    obj.__uid = uid;

                    if (isSelectTool) {
                        obj.set({
                            selectable: true,
                            evented: true,
                            borderColor: '#c0392b',
                            cornerColor: '#c0392b',
                            cornerSize: 8,
                            transparentCorners: false
                        });
                    }

                    const total = this.canvas.getObjects().length;
                    const safeIndex = Math.min(index, total);

                    if (safeIndex >= 0 && safeIndex < total) {
                        this.canvas.insertAt(obj, safeIndex, false);
                    } else {
                        this.canvas.add(obj);
                    }
                });

                this.canvas.requestRenderAll();
                resolve();
            }, '');
        });
    }

    /**
     * @param {string} layerId
     * @returns {Promise<string>}
     */
    captureLayerDataURL(layerId) {
        return new Promise((resolve) => {
            const sourceObjects = this.canvas.getObjects().filter(
                obj => obj.layerId === layerId && !obj.isBg
            );

            if (sourceObjects.length === 0) {
                const blank = document.createElement('canvas');
                blank.width = this.canvas.width;
                blank.height = this.canvas.height;
                resolve(blank.toDataURL());
                return;
            }

            const ordered = sourceObjects.slice().sort(
                (a, b) => this.canvas.getObjects().indexOf(a) - this.canvas.getObjects().indexOf(b)
            );

            const clonePromises = ordered.map(
                obj => new Promise(res => obj.clone(res, CUSTOM_FABRIC_PROPS))
            );

            Promise.all(clonePromises).then((clones) => {
                const offscreen = new fabric.StaticCanvas(null, {
                    width: this.canvas.width,
                    height: this.canvas.height
                });

                clones.forEach(clone => {
                    clone.set({ left: clone.left, top: clone.top });
                    offscreen.add(clone);
                });

                offscreen.renderAll();
                const dataURL = offscreen.toDataURL({ format: 'png', multiplier: 1 });
                offscreen.dispose();
                resolve(dataURL);
            });
        });
    }

    /**
     * @param {'add'|'delete'|'move'|'rename'|'property'} action
     * @param {Object} data
     */
    layerCommand(action, data) {
        this._pushOp({ type: 'layer', action, data });
    }

    async _applyLayerOp(op) {
        const lm = this.canvasManager.layerManager;

        switch (op.action) {
            case 'add':
                lm.layers.splice(op.data.insertIndex, 0, op.data.layer);
                lm.setActiveLayer(op.data.layer.id);
                break;

            case 'delete': {
                const toRemove = this.canvas.getObjects().filter(o => o.layerId === op.data.layer.id);
                toRemove.forEach(o => this.canvas.remove(o));
                const idx = lm.layers.findIndex(l => l.id === op.data.layer.id);
                if (idx > -1) lm.layers.splice(idx, 1);
                if (lm.activeLayerId === op.data.layer.id) {
                    const nextIdx = Math.min(op.data.index, lm.layers.length - 1);
                    if (nextIdx >= 0) lm.setActiveLayer(lm.layers[nextIdx].id);
                }
                break;
            }

            case 'move': {
                const [moved] = lm.layers.splice(op.data.fromIndex, 1);
                lm.layers.splice(op.data.toIndex, 0, moved);
                break;
            }

            case 'rename': {
                const layer = lm.layers.find(l => l.id === op.data.id);
                if (layer) layer.name = op.data.nextName;
                break;
            }

            case 'property': {
                const layer = lm.layers.find(l => l.id === op.data.id);
                if (layer) {
                    layer[op.data.prop] = op.data.nextValue;
                    if (lm.activeLayerId === op.data.id) lm.setActiveLayer(op.data.id);
                }
                break;
            }

            case 'duplicate': {
                lm.layers.splice(op.data.index, 0, { ...op.data.layerSnapshot });
                await new Promise(resolve => {
                    fabric.util.enlivenObjects(op.data.objectsJSON, (revived) => {
                        revived.forEach(obj => {
                            if (!obj) return;
                            this._assignUID(obj);
                            this.canvas.add(obj);
                        });
                        lm.updateZIndices();
                        lm.renderUI();
                        lm.setActiveLayer(op.data.newId);
                        this.canvas.requestRenderAll();
                        resolve();
                    }, '');
                });
                return;
            }

            case 'merge': {
                op.data.affectedObjectsMeta.forEach(({ uid, newLayerId, newOpacity, newGCO }) => {
                    const obj = this._findObjectByUID(uid);
                    if (!obj) return;
                    obj.layerId = newLayerId;
                    obj.opacity = newOpacity;
                    obj.globalCompositeOperation = newGCO;
                });
                const mergeIdx = lm.layers.findIndex(l => l.id === op.data.sourceId);
                if (mergeIdx > -1) lm.layers.splice(mergeIdx, 1);
                lm.updateZIndices();
                lm.renderUI();
                lm.setActiveLayer(op.data.belowId);
                this.canvas.requestRenderAll();
                return;
            }
        }

        lm.updateZIndices();
        lm.renderUI();
        this.canvas.requestRenderAll();
    }

    async _applyLayerOpReverse(op) {
        const lm = this.canvasManager.layerManager;

        switch (op.action) {
            case 'add': {
                const toRemove = this.canvas.getObjects().filter(o => o.layerId === op.data.layer.id);
                toRemove.forEach(o => this.canvas.remove(o));
                const idx = lm.layers.findIndex(l => l.id === op.data.layer.id);
                if (idx > -1) lm.layers.splice(idx, 1);
                if (lm.layers.length > 0) {
                    const fallback = Math.min(op.data.insertIndex, lm.layers.length - 1);
                    lm.setActiveLayer(lm.layers[fallback].id);
                }
                break;
            }

            case 'delete': {
                lm.layers.splice(op.data.index, 0, op.data.layer);
                if (op.data.removedObjectsJSON && op.data.removedObjectsJSON.length > 0) {
                    await new Promise(resolve => {
                        const jsons = op.data.removedObjectsJSON.map(o => o.json);
                        fabric.util.enlivenObjects(jsons, (revived) => {
                            revived.forEach((obj, i) => {
                                if (!obj) return;
                                const original = op.data.removedObjectsJSON[i];
                                if (original.json.__uid) obj.__uid = original.json.__uid;
                                const safeIndex = Math.min(original.index, this.canvas.getObjects().length);
                                this.canvas.insertAt(obj, safeIndex, false);
                            });
                            resolve();
                        }, '');
                    });
                }
                lm.setActiveLayer(op.data.layer.id);
                break;
            }

            case 'move': {
                const [moved] = lm.layers.splice(op.data.toIndex, 1);
                lm.layers.splice(op.data.fromIndex, 0, moved);
                break;
            }

            case 'rename': {
                const layer = lm.layers.find(l => l.id === op.data.id);
                if (layer) layer.name = op.data.prevName;
                break;
            }

            case 'property': {
                const layer = lm.layers.find(l => l.id === op.data.id);
                if (layer) {
                    layer[op.data.prop] = op.data.prevValue;
                }
                break;
            }

            case 'duplicate': {
                this.canvas.getObjects()
                    .filter(obj => obj.layerId === op.data.newId)
                    .forEach(obj => this.canvas.remove(obj));
                const dupIdx = lm.layers.findIndex(l => l.id === op.data.newId);
                if (dupIdx > -1) lm.layers.splice(dupIdx, 1);
                lm.updateZIndices();
                lm.renderUI();
                lm.setActiveLayer(op.data.sourceId);
                this.canvas.requestRenderAll();
                return;
            }

            case 'merge': {
                op.data.affectedObjectsMeta.forEach(({ uid, originalLayerId, originalOpacity, originalGCO }) => {
                    const obj = this._findObjectByUID(uid);
                    if (!obj) return;
                    obj.layerId = originalLayerId;
                    obj.opacity = originalOpacity;
                    obj.globalCompositeOperation = originalGCO;
                });
                lm.layers.splice(op.data.index, 0, { ...op.data.layerSnapshot });
                lm.updateZIndices();
                lm.renderUI();
                lm.setActiveLayer(op.data.sourceId);
                this.canvas.requestRenderAll();
                return;
            }
        }

        lm.updateZIndices();
        lm.renderUI();
        lm.setActiveLayer(lm.activeLayerId);
        this.canvas.requestRenderAll();
    }
}