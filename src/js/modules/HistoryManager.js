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

    rasterCommand(prevDataURL, nextDataURL, layerId) {
        this._pushOp({
            type: 'raster',
            prevDataURL,
            nextDataURL,
            layerId
        });
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

    async undo() {
        if (this.cursor < 0 || this.isProcessing) return;
        this.isProcessing = true;

        const op = this.ops[this.cursor];
        await this._applyOpReverse(op);
        this.cursor--;

        this.isProcessing = false;
    }

    async redo() {
        if (this.cursor >= this.ops.length - 1 || this.isProcessing) return;
        this.isProcessing = true;

        this.cursor++;
        const op = this.ops[this.cursor];
        await this._applyOp(op);

        this.isProcessing = false;
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
                op.deltas.forEach(({ uid, next }) => {
                    const obj = this._findObjectByUID(uid);
                    if (obj) {
                        obj.set(next);
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
        }
    }

    async _applyOpReverse(op) {
        switch (op.type) {
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
                op.deltas.forEach(({ uid, prev }) => {
                    const obj = this._findObjectByUID(uid);
                    if (obj) {
                        obj.set(prev);
                        obj.setCoords();
                    }
                });
                this.canvas.requestRenderAll();
                break;

            case 'raster':
                await this._restoreRasterLayer(op.prevDataURL, op.layerId);
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
}