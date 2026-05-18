export class ShapeManager {
    constructor(canvasManager, config) {
        this.cm = canvasManager;
        this.canvas = canvasManager.canvas;

        this.shapeType = config.shapeType;
        this.finalSizeCheck = config.finalSizeCheck;

        this.isDrawing = false;
        this.shape = null;

        this.startX = 0;
        this.startY = 0;
    }

    _buildShapeConfig(x, y) {
        return {
            left: x,
            top: y,
            fill: 'transparent',
            stroke: this.cm.getBrushColorAsRGBA(),
            strokeWidth: this.cm.brushSize,
            strokeUniform: true,
            selectable: false,
            evented: false,
            layerId: this.cm.layerManager ? this.cm.layerManager.activeLayerId : null
        };
    }

    createShape(x, y) {
        const base = this._buildShapeConfig(x, y);
        if (this.shapeType === 'rect') {
            return new fabric.Rect({ ...base, width: 0, height: 0 });
        }
        return new fabric.Ellipse({ ...base, rx: 0, ry: 0 });
    }

    _updateShape(w, h, left, top) {
        const update = { left, top };
        if (this.shapeType === 'rect') {
            update.width = w;
            update.height = h;
        } else {
            update.rx = w / 2;
            update.ry = h / 2;
        }
        this.shape.set(update);
    }

    onMouseDown(x, y) {
        this.isDrawing = true;
        this.startX = x;
        this.startY = y;
        this.shape = this.createShape(x, y);
        this.canvas.add(this.shape);
    }

    onMouseMove(x, y, lockProportion) {
        if (!this.isDrawing || !this.shape) return;

        let w = Math.abs(x - this.startX);
        let h = Math.abs(y - this.startY);

        if (lockProportion) {
            const max = Math.max(w, h);
            w = max;
            h = max;
        }

        const left = x > this.startX ? this.startX : this.startX - w;
        const top = y > this.startY ? this.startY : this.startY - h;

        this._updateShape(w, h, left, top);
        this.canvas.requestRenderAll();
    }

    onMouseUp() {
        this.isDrawing = false;
        if (!this.shape) return;

        if (this.finalSizeCheck(this.shape)) {
            this.canvas.remove(this.shape);
        } else {
            this.cm.historyManager.saveState();
        }

        this.shape = null;
    }
}