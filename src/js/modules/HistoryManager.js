export class HistoryManager {
    constructor(canvasManager) {
        this.cm = canvasManager;
        this.canvas = canvasManager.canvas;

        this.ops = [];
        this.cursor = -1;
        this.snapshots = [];

        this.SNAPSHOT_EVERY = 15;
        this.isProcessing = false;
    }

    /**
     * @param {fabric.Object|fabric.Object[]} objects
     */
    addCommand(objects) {
        const arr = [].concat(objects);
        const layersState = this._captureLayersState();

        this._pushOp({
            type: 'add',
            objectsJSON: arr.map(o => o.toJSON(['layerId', 'isBg', 'isEraser', 'globalCompositeOperation'])),
            layersState
        });
    }

    /**
     * @param {fabric.Object|fabric.Object[]} objects
     */
    removeCommand(objects) {
        const arr = [].concat(objects);
        const allObjects = this.canvas.getObjects();
        const layersState = this._captureLayersState();

        this._pushOp({
            type: 'remove',
            objectsJSON: arr.map(o => ({
                json: o.toJSON(['layerId', 'isBg', 'isEraser', 'globalCompositeOperation']),
                zIndex: allObjects.indexOf(o)
            })),
            layersState
        });
    }

    /**
     * @param {fabric.Object|fabric.Object[]} objects
     * @param {Object|Object[]} prevProps 
     * @param {Object|Object[]} nextProps 
     */
    modifyCommand(objects, prevProps, nextProps) {
        const arr = [].concat(objects);
        const prev = [].concat(prevProps);
        const next = [].concat(nextProps);
        const layersState = this._captureLayersState();

        this._pushOp({
            type: 'modify',
            patches: arr.map((o, i) => ({
                objectId: o.__uid,
                prev: prev[i],
                next: next[i]
            })),
            layersState
        });
    }

    /**
     * @param {string} prevDataURL
     * @param {string} nextDataURL
     * @param {string} affectedLayerId
     */
    rasterCommand(prevDataURL, nextDataURL, affectedLayerId) {
        const layersState = this._captureLayersState();

        this._pushOp({
            type: 'raster',
            affectedLayerId,
            prevDataURL,
            nextDataURL,
            layersState
        });
    }

    undo() {
        if (this.cursor < 0 || this.isProcessing) return;
        this.isProcessing = true;

        const op = this.ops[this.cursor];
        this.cursor--;

        this._applyOpReverse(op).finally(() => {
            this.isProcessing = false;
        });
    }

    redo() {
        if (this.cursor >= this.ops.length - 1 || this.isProcessing) return;
        this.isProcessing = true;

        this.cursor++;
        const op = this.ops[this.cursor];

        this._applyOpForward(op).finally(() => {
            this.isProcessing = false;
        });
    }

    saveState() {
        if (this.isProcessing || !this.cm.layerManager || !this.canvas) return;

        const layersState = this._captureLayersState();
        this._pushOp({
            type: 'snapshot_legacy',
            canvasJSON: this.canvas.toJSON(['layerId', 'isBg', 'isEraser', 'globalCompositeOperation']),
            layersState
        });
    }


    _pushOp(op) {
        if (this.cursor < this.ops.length - 1) {
            this.ops = this.ops.slice(0, this.cursor + 1);
            this.snapshots = this.snapshots.filter(s => s.afterCursor <= this.cursor);
        }

        this.ops.push(op);
        this.cursor = this.ops.length - 1;

        if (this.cursor > 0 && this.cursor % this.SNAPSHOT_EVERY === 0) {
            this._takeSnapshot();
        }
    }

    async _applyOpForward(op) {
        if (op.type === 'add') {
            await this._restoreObjects(op.objectsJSON);
            this._restoreLayersState(op.layersState);

        } else if (op.type === 'remove') {
            op.objectsJSON.forEach(({ json }) => {
                const target = this._findObjectByJSON(json);
                if (target) this.canvas.remove(target);
            });
            this._restoreLayersState(op.layersState);

        } else if (op.type === 'modify') {
            op.patches.forEach(({ objectId, next }) => {
                const obj = this._findObjectByUID(objectId);
                if (obj) { obj.set(next); obj.setCoords(); }
            });
            this._restoreLayersState(op.layersState);

        } else if (op.type === 'raster') {
            await this._restoreLayerRaster(op.affectedLayerId, op.nextDataURL);
            this._restoreLayersState(op.layersState);

        } else if (op.type === 'snapshot_legacy') {
            await this._restoreFullSnapshot(op.canvasJSON, op.layersState);
        }

        this.canvas.requestRenderAll();
    }

    async _applyOpReverse(op) {
        if (op.type === 'add') {
            op.objectsJSON.forEach(json => {
                const target = this._findObjectByJSON(json);
                if (target) this.canvas.remove(target);
            });
            this._restoreLayersState(op.layersState);

        } else if (op.type === 'remove') {
            for (const { json, zIndex } of op.objectsJSON) {
                await this._restoreObjectAtIndex(json, zIndex);
            }
            this._restoreLayersState(op.layersState);

        } else if (op.type === 'modify') {
            op.patches.forEach(({ objectId, prev }) => {
                const obj = this._findObjectByUID(objectId);
                if (obj) { obj.set(prev); obj.setCoords(); }
            });
            this._restoreLayersState(op.layersState);

        } else if (op.type === 'raster') {
            await this._restoreLayerRaster(op.affectedLayerId, op.prevDataURL);
            this._restoreLayersState(op.layersState);

        } else if (op.type === 'snapshot_legacy') {
            let prevJSON = null;
            let prevLayers = null;

            for (let i = this.cursor; i >= 0; i--) {
                if (this.ops[i].type === 'snapshot_legacy' && this.ops[i].canvasJSON) {
                    prevJSON = this.ops[i].canvasJSON;
                    prevLayers = this.ops[i].layersState;
                    break;
                }
            }

            if (!prevJSON) {
                const snap = this._nearestSnapshot(this.cursor + 1);
                if (snap) {
                    prevJSON = snap.canvasJSON;
                    prevLayers = snap.layersState;
                }
            }

            if (prevJSON) {
                await this._restoreFullSnapshot(prevJSON, prevLayers);
            }
        }

        this.canvas.requestRenderAll();
    }

    _takeSnapshot() {
        this.snapshots.push({
            afterCursor: this.cursor,
            canvasJSON: this.canvas.toJSON(['layerId', 'isBg', 'isEraser', 'globalCompositeOperation']),
            layersState: this._captureLayersState()
        });
    }

    _nearestSnapshot(beforeCursor) {
        for (let i = this.snapshots.length - 1; i >= 0; i--) {
            if (this.snapshots[i].afterCursor < beforeCursor) return this.snapshots[i];
        }
        return null;
    }

    _captureLayersState() {
        return this.cm.layerManager?.getLayersState() ?? null;
    }

    _restoreLayersState(layersState) {
        if (layersState && this.cm.layerManager) {
            this.cm.layerManager.restoreLayersState(layersState);
        }
    }

    async _restoreFullSnapshot(canvasJSON, layersState) {
        return new Promise(resolve => {
            this.canvas.loadFromJSON(canvasJSON, () => {
                this._restoreLayersState(layersState);
                this._handleTextureRestore(resolve);
            });
        });
    }

    _handleTextureRestore(resolve) {
        const th = this.cm.textureHandler;
        if (th?.currentTextureId && th.currentTextureId !== 'none') {
            th.setPaperTexture(th.currentTextureId, true);
            setTimeout(() => { this.canvas.renderAll(); resolve(); }, 50);
        } else {
            this.canvas.renderAll();
            resolve();
        }
    }

    async _restoreObjects(objectsJSONArray) {
        return new Promise(resolve => {
            let remaining = objectsJSONArray.length;
            if (remaining === 0) { resolve(); return; }

            objectsJSONArray.forEach(json => {
                fabric.util.enlivenObjects([json], ([obj]) => {
                    if (obj) {
                        this._assignUID(obj);
                        this.canvas.add(obj);
                    }
                    if (--remaining === 0) resolve();
                });
            });
        });
    }

    async _restoreObjectAtIndex(json, zIndex) {
        return new Promise(resolve => {
            fabric.util.enlivenObjects([json], ([obj]) => {
                if (obj) {
                    this._assignUID(obj);
                    this.canvas.insertAt(obj, zIndex, false);
                }
                resolve();
            });
        });
    }

    async _restoreLayerRaster(layerId, dataURL) {
        return new Promise(resolve => {
            const toRemove = this.canvas.getObjects().filter(o => o.layerId === layerId);
            toRemove.forEach(o => this.canvas.remove(o));

            if (!dataURL) { resolve(); return; }

            fabric.Image.fromURL(dataURL, (img) => {
                img.set({
                    layerId,
                    selectable: false,
                    evented: false,
                    left: 0,
                    top: 0
                });
                this.canvas.add(img);
                resolve();
            });
        });
    }

    _findObjectByJSON(json) {
        return this.canvas.getObjects().find(o =>
            o.layerId === json.layerId &&
            Math.abs((o.left ?? 0) - (json.left ?? 0)) < 0.5 &&
            Math.abs((o.top ?? 0) - (json.top ?? 0)) < 0.5 &&
            o.type === json.type
        );
    }

    _findObjectByUID(uid) {
        return this.canvas.getObjects().find(o => o.__uid === uid);
    }

    _assignUID(obj) {
        if (!obj.__uid) obj.__uid = `fh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }
}