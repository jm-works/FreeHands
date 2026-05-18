export class EllipseManager {
    constructor(canvasManager) {
        this.cm = canvasManager;
        this.canvas = canvasManager.canvas;
        this.isDrawing = false;
        this.ellipse = null;
        this.startX = 0;
        this.startY = 0;
    }

    onMouseDown(x, y) {
        this.isDrawing = true;
        this.startX = x;
        this.startY = y;

        this.ellipse = new fabric.Ellipse({
            left: x,
            top: y,
            rx: 0,
            ry: 0,
            fill: 'transparent',
            stroke: this.cm.getBrushColorAsRGBA(),
            strokeWidth: this.cm.brushSize,
            strokeUniform: true,
            selectable: false,
            evented: false,
            layerId: this.cm.layerManager ? this.cm.layerManager.activeLayerId : null
        });

        this.canvas.add(this.ellipse);
    }

    onMouseMove(x, y, isCircle) {
        if (!this.isDrawing || !this.ellipse) return;

        let w = Math.abs(x - this.startX);
        let h = Math.abs(y - this.startY);

        if (isCircle) {
            const max = Math.max(w, h);
            w = max;
            h = max;
        }

        this.ellipse.set({
            left: x > this.startX ? this.startX : this.startX - w,
            top: y > this.startY ? this.startY : this.startY - h,
            rx: w / 2,
            ry: h / 2
        });

        this.canvas.requestRenderAll();
    }

    onMouseUp() {
        this.isDrawing = false;
        if (this.ellipse) {
            if (this.ellipse.rx === 0 && this.ellipse.ry === 0) {
                this.canvas.remove(this.ellipse);
            } else {
                this.cm.historyManager.saveState();
            }
            this.ellipse = null;
        }
    }
}