import { checkIntersection, rasterizeWithEraser } from './utils/canvasUtils.js';

export class CutAreaManager {
    constructor(canvasManager) {
        this.canvasManager = canvasManager;
        this.canvas = canvasManager.canvas;
        this.selectionRect = null;
        this.clipboardDataURL = null;
        this.clipboardBounds = null;
        this.action = null;
        this.startX = 0;
        this.startY = 0;
        this.moveStartX = 0;
        this.moveStartY = 0;
        this.origL = 0;
        this.origR = 0;
        this.origT = 0;
        this.origB = 0;
    }

    getInteractZone(x, y) {
        if (!this.selectionRect) return null;
        const l = this.selectionRect.left;
        const t = this.selectionRect.top;
        const w = this.selectionRect.width;
        const h = this.selectionRect.height;
        const r = l + w;
        const b = t + h;
        const tol = 10 / this.canvasManager.zoom;

        const nearL = Math.abs(x - l) <= tol;
        const nearR = Math.abs(x - r) <= tol;
        const nearT = Math.abs(y - t) <= tol;
        const nearB = Math.abs(y - b) <= tol;

        if (nearL && nearT) return 'tl';
        if (nearR && nearT) return 'tr';
        if (nearL && nearB) return 'bl';
        if (nearR && nearB) return 'br';
        if (nearL) return 'l';
        if (nearR) return 'r';
        if (nearT) return 't';
        if (nearB) return 'b';

        if (x >= l && x <= r && y >= t && y <= b) return 'inside';
        return null;
    }

    onMouseDown(x, y) {
        const zone = this.getInteractZone(x, y);

        if (zone) {
            this.action = zone;
            if (zone === 'inside') {
                this.moveStartX = x;
                this.moveStartY = y;
                this.origL = this.selectionRect.left;
                this.origT = this.selectionRect.top;
            } else {
                this.origL = this.selectionRect.left;
                this.origR = this.selectionRect.left + this.selectionRect.width;
                this.origT = this.selectionRect.top;
                this.origB = this.selectionRect.top + this.selectionRect.height;
            }
            return;
        }

        this.clearSelection();
        this.action = 'draw';
        this.startX = x;
        this.startY = y;

        this.selectionRect = new fabric.Rect({
            left: x,
            top: y,
            width: 0,
            height: 0,
            fill: 'rgba(192, 57, 43, 0.15)',
            stroke: '#c0392b',
            strokeDashArray: [5, 5],
            strokeWidth: 1.5,
            selectable: false,
            evented: false,
            isSelectionRect: true
        });
        this.canvas.add(this.selectionRect);
        this.canvas.renderAll();
    }

    onMouseMove(x, y) {
        if (!this.action) return;

        if (this.action === 'draw') {
            const w = Math.abs(x - this.startX);
            const h = Math.abs(y - this.startY);
            const l = Math.min(x, this.startX);
            const t = Math.min(y, this.startY);
            this.selectionRect.set({ left: l, top: t, width: w, height: h });
            this.canvas.renderAll();
            return;
        }

        if (this.action === 'inside') {
            const dx = x - this.moveStartX;
            const dy = y - this.moveStartY;
            this.selectionRect.set({ left: this.origL + dx, top: this.origT + dy });
            this.canvas.renderAll();
            return;
        }

        let newL = this.origL;
        let newR = this.origR;
        let newT = this.origT;
        let newB = this.origB;

        if (this.action.includes('l')) newL = x;
        if (this.action.includes('r')) newR = x;
        if (this.action.includes('t')) newT = y;
        if (this.action.includes('b')) newB = y;

        const finalL = Math.min(newL, newR);
        const finalR = Math.max(newL, newR);
        const finalT = Math.min(newT, newB);
        const finalB = Math.max(newT, newB);

        this.selectionRect.set({
            left: finalL,
            top: finalT,
            width: finalR - finalL,
            height: finalB - finalT
        });
        this.canvas.renderAll();
    }

    onMouseUp() {
        this.action = null;
        if (this.selectionRect && (this.selectionRect.width === 0 || this.selectionRect.height === 0)) {
            this.clearSelection();
        }
    }

    clearSelection() {
        if (this.selectionRect) {
            this.canvas.remove(this.selectionRect);
            this.selectionRect = null;
            this.canvas.renderAll();
        }
    }

    copy() {
        if (!this.selectionRect || this.selectionRect.width === 0 || this.selectionRect.height === 0) return;

        const { left, top, width, height } = this.selectionRect;
        const activeLayerId = this.canvasManager.layerManager.activeLayerId;

        const offscreen = document.createElement('canvas');
        offscreen.width = this.canvas.width;
        offscreen.height = this.canvas.height;
        const ctx = offscreen.getContext('2d');

        const layerObjects = this.canvas.getObjects().filter(
            obj => obj.layerId === activeLayerId && !obj.isBg && !obj.isSelectionRect
        );

        layerObjects.forEach(obj => {
            const el = obj.toCanvasElement({ multiplier: 1 });
            const b = obj.getBoundingRect(true, true);
            ctx.save();
            ctx.globalCompositeOperation = obj.globalCompositeOperation || 'source-over';
            ctx.globalAlpha = obj.opacity ?? 1;
            ctx.drawImage(el, b.left, b.top, b.width, b.height);
            ctx.restore();
        });

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = Math.round(width);
        cropCanvas.height = Math.round(height);
        cropCanvas.getContext('2d').drawImage(
            offscreen,
            Math.round(left), Math.round(top), Math.round(width), Math.round(height),
            0, 0, Math.round(width), Math.round(height)
        );

        this.clipboardDataURL = cropCanvas.toDataURL('image/png');
        this.clipboardBounds = { left, top, width, height };
    }

    cut() {
        if (!this.selectionRect || this.selectionRect.width === 0 || this.selectionRect.height === 0) return;
        this.copy();
        if (this.clipboardDataURL) this.deleteSelection();
    }

    async deleteSelection() {
        if (!this.selectionRect || this.selectionRect.width === 0 || this.selectionRect.height === 0) return;

        const { left, top, width, height } = this.selectionRect;
        const activeLayerId = this.canvasManager.layerManager.activeLayerId;
        const historyManager = this.canvasManager.historyManager;

        const selBbox = { left, top, width, height };
        const targets = this.canvas.getObjects().filter(obj =>
            obj.layerId === activeLayerId &&
            !obj.isBg &&
            !obj.isSelectionRect &&
            checkIntersection(obj.getBoundingRect(), selBbox)
        );

        if (targets.length === 0) return;

        const prevURL = await historyManager.captureLayerDataURL(activeLayerId);
        const prevObjects = historyManager.snapshotLayerObjects(activeLayerId);

        const cutShape = new fabric.Rect({
            left,
            top,
            width,
            height,
            fill: '#000000',
            selectable: false,
            evented: false,
            objectCaching: false
        });

        for (const obj of targets) {
            const currentIndex = this.canvas.getObjects().indexOf(obj);
            const result = await rasterizeWithEraser(obj, cutShape);

            if (result.removed) {
                this.canvas.remove(obj);
            } else {
                this.canvas.remove(obj);
                if (currentIndex > -1) {
                    this.canvas.insertAt(result.img, currentIndex, false);
                } else {
                    this.canvas.add(result.img);
                }
            }
        }

        this.canvas.requestRenderAll();
        const nextURL = await historyManager.captureLayerDataURL(activeLayerId);
        historyManager.rasterCommand(prevURL, nextURL, activeLayerId, prevObjects);
    }

    paste() {
        if (!this.clipboardDataURL || !this.clipboardBounds) return;

        if (!this.canvasManager._copyCount) this.canvasManager._copyCount = 0;
        this.canvasManager._copyCount += 1;
        this.canvasManager.layerManager.addLayer(`Copy Layer ${this.canvasManager._copyCount}`);
        const newLayerId = this.canvasManager.layerManager.activeLayerId;

        fabric.Image.fromURL(this.clipboardDataURL, (img) => {
            img.set({
                left: this.clipboardBounds.left,
                top: this.clipboardBounds.top,
                layerId: newLayerId,
            });

            this.canvas.add(img);
            this.clearSelection();

            this.canvasManager.setTool('select');
            img.set({ selectable: true, evented: true });

            this.canvas.setActiveObject(img);
            this.canvas.requestRenderAll();
            this.canvasManager.historyManager.addCommand(img);
        });
    }
}