export class LineManager {
    constructor(canvasManager) {
        this.cm = canvasManager;
        this.canvas = canvasManager.canvas;
        this.isDrawing = false;
        this.shape = null;
        this.startX = 0;
        this.startY = 0;
    }

    onMouseDown(x, y) {
        this.isDrawing = true;
        this.startX = x;
        this.startY = y;
        this.shape = new fabric.Line([x, y, x, y], {
            stroke: this.cm.getBrushColorAsRGBA(),
            strokeWidth: this.cm.brushSize,
            selectable: false,
            evented: false,
            strokeLineCap: 'round',
            padding: 15,
            layerId: this.cm.layerManager ? this.cm.layerManager.activeLayerId : null
        });
        this.canvas.add(this.shape);
    }

    onMouseMove(x, y, lockAxis) {
        if (!this.isDrawing || !this.shape) return;

        let endX = x;
        let endY = y;

        if (lockAxis) {
            const dx = x - this.startX;
            const dy = y - this.startY;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            const snappedAngle = Math.round(angle / 45) * 45;
            const rad = snappedAngle * (Math.PI / 180);
            const dist = Math.sqrt(dx * dx + dy * dy);

            endX = this.startX + Math.cos(rad) * dist;
            endY = this.startY + Math.sin(rad) * dist;
        }

        this.shape.set({ x2: endX, y2: endY });
        this.shape.setCoords();
        this.canvas.requestRenderAll();
    }

    onMouseUp() {
        this.isDrawing = false;
        if (!this.shape) return;

        if (this.shape.x1 === this.shape.x2 && this.shape.y1 === this.shape.y2) {
            this.canvas.remove(this.shape);
        } else {
            this.shape.setCoords();
            this.cm.historyManager._assignUID(this.shape);
            this.cm.historyManager.addCommand(this.shape);
        }
        this.shape = null;
    }
}