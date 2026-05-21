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

        const activeLayerId = this.canvasManager.layerManager.activeLayerId;
        const hiddenObjects = [];

        this.canvas.getObjects().forEach(obj => {
            if (obj.isBg || obj.isSelectionRect || obj.isEraser || obj.layerId !== activeLayerId) {
                if (obj.visible !== false) {
                    obj.visible = false;
                    hiddenObjects.push(obj);
                }
            }
        });

        this.clipboardDataURL = this.canvas.toDataURL({
            format: 'png',
            left: this.selectionRect.left,
            top: this.selectionRect.top,
            width: this.selectionRect.width,
            height: this.selectionRect.height,
            multiplier: 1
        });

        this.clipboardBounds = {
            left: this.selectionRect.left,
            top: this.selectionRect.top,
            width: this.selectionRect.width,
            height: this.selectionRect.height
        };

        hiddenObjects.forEach(obj => obj.visible = true);
        this.canvas.renderAll();
    }

    cut() {
        if (!this.selectionRect) return;
        this.copy();
        this.deleteSelection();
    }

    deleteSelection() {
        if (!this.selectionRect || this.selectionRect.width === 0 || this.selectionRect.height === 0) return;

        const eraserRect = new fabric.Rect({
            left: this.selectionRect.left,
            top: this.selectionRect.top,
            width: this.selectionRect.width,
            height: this.selectionRect.height,
            fill: '#000000',
            globalCompositeOperation: 'destination-out',
            layerId: this.canvasManager.layerManager.activeLayerId,
            selectable: false,
            evented: false,
            isEraser: true
        });

        this.canvas.add(eraserRect);
        this.canvas.renderAll();
        this.canvasManager.historyManager.addCommand(eraserRect);
    }

    paste() {
        if (!this.clipboardDataURL || !this.clipboardBounds) return;

        if (!CutAreaManager._copyCount) CutAreaManager._copyCount = 0;
        CutAreaManager._copyCount += 1;
        this.canvasManager.layerManager.addLayer(`Copy Layer ${CutAreaManager._copyCount}`);
        const newLayerId = this.canvasManager.layerManager.activeLayerId;

        fabric.Image.fromURL(this.clipboardDataURL, (img) => {
            img.set({
                left: this.clipboardBounds.left,
                top: this.clipboardBounds.top,
                layerId: newLayerId,
                selectable: true,
                evented: true
            });
            this.canvas.add(img);

            this.clearSelection();

            const btnSelect = document.getElementById('btn-select');
            if (btnSelect) {
                btnSelect.click();
            } else {
                this.canvasManager.setTool('select');
            }

            this.canvas.setActiveObject(img);
            this.canvas.renderAll();
            this.canvasManager.historyManager.addCommand(img);
        });
    }
}