const MIN_SHAPE_SIZE = 3;

export class ShapeManager {
    constructor(canvasManager, config) {
        this.cm = canvasManager;
        this.canvas = canvasManager.canvas;

        this.shapeType = config.shapeType;

        this.isDrawing = false;
        this.shape = null;

        this.startX = 0;
        this.startY = 0;
    }

    _buildShapeConfig(x, y) {
        const color = this.cm.getBrushColorAsRGBA();
        return {
            left: x,
            top: y,
            fill: color,
            stroke: color,
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

    _renderDimensionPreview(w, h, left, top) {
        const ctx = this.canvas.contextTop;
        if (!ctx) return;

        this.canvas.clearContext(ctx);

        const label = `${Math.round(w)} × ${Math.round(h)}`;
        const padding = 4;
        const fontSize = 11;

        ctx.save();
        ctx.font = `600 ${fontSize}px Oswald, Arial Narrow, sans-serif`;

        const textWidth = ctx.measureText(label).width;
        const boxW = textWidth + padding * 2;
        const boxH = fontSize + padding * 2;

        let lx = left + w + 6;
        let ly = top + h + 6;
        if (lx + boxW > this.canvas.width) lx = left - boxW - 6;
        if (ly + boxH > this.canvas.height) ly = top - boxH - 6;

        ctx.fillStyle = 'rgba(5, 5, 5, 0.75)';
        ctx.fillRect(lx, ly, boxW, boxH);

        ctx.strokeStyle = 'rgba(192, 57, 43, 0.8)';
        ctx.lineWidth = 1;
        ctx.strokeRect(lx, ly, boxW, boxH);

        ctx.fillStyle = '#e0e0e0';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, lx + padding, ly + boxH / 2);

        ctx.restore();
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
        this._renderDimensionPreview(w, h, left, top);
        this.canvas.requestRenderAll();
    }

    onMouseUp() {
        this.isDrawing = false;

        this.canvas.clearContext(this.canvas.contextTop);

        if (!this.shape) return;

        const tooSmall = this.shapeType === 'rect'
            ? this.shape.width < MIN_SHAPE_SIZE && this.shape.height < MIN_SHAPE_SIZE
            : this.shape.rx < MIN_SHAPE_SIZE / 2 && this.shape.ry < MIN_SHAPE_SIZE / 2;

        if (tooSmall) {
            this.canvas.remove(this.shape);
        } else {
            const committed = this.shape;
            this.cm.historyManager.addCommand(committed);

            this.cm.setTool('select');
            this.canvas.setActiveObject(committed);
        }

        this.shape = null;
    }
}