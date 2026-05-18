export class RectangleManager {
    constructor(canvasManager) {
        this.cm = canvasManager;
        this.canvas = canvasManager.canvas;
        this.isDrawing = false;
        this.rect = null;
        this.startX = 0;
        this.startY = 0;
    }

    onMouseDown(x, y) {
        this.isDrawing = true;
        this.startX = x;
        this.startY = y;

        this.rect = new fabric.Rect({
            left: x,
            top: y,
            width: 0,
            height: 0,
            fill: 'transparent',
            stroke: this.cm.getBrushColorAsRGBA(),
            strokeWidth: this.cm.brushSize,
            strokeUniform: true,
            selectable: false,
            evented: false,
            layerId: this.cm.layerManager ? this.cm.layerManager.activeLayerId : null
        });

        this.canvas.add(this.rect);
    }

    onMouseMove(x, y, isSquare) {
        if (!this.isDrawing || !this.rect) return;

        let w = Math.abs(x - this.startX);
        let h = Math.abs(y - this.startY);

        if (isSquare) {
            const max = Math.max(w, h);
            w = max;
            h = max;
        }

        this.rect.set({
            left: x > this.startX ? this.startX : this.startX - w,
            top: y > this.startY ? this.startY : this.startY - h,
            width: w,
            height: h
        });

        this.canvas.requestRenderAll();
    }

    onMouseUp() {
        this.isDrawing = false;
        if (this.rect) {
            if (this.rect.width === 0 && this.rect.height === 0) {
                this.canvas.remove(this.rect);
            } else {
                this.cm.historyManager.saveState();
            }
            this.rect = null;
        }
    }
}