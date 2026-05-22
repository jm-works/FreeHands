import { getStroke } from "https://esm.sh/perfect-freehand";
import {
    getBoundsFromImageData,
    checkIntersection,
    cloneObjectAsync,
    createImageAsync,
    rasterizeWithEraser
} from './utils/canvasUtils.js';

export const EraserBrush = fabric.util.createClass(fabric.BaseBrush, {
    initialize: function (canvas) {
        this.canvas = canvas;
        this.width = 10;
        this.points = [];
        this._lastPoint = null;
    },

    onMouseDown: function (pointer, options) {
        if (!this.canvas.isDrawingMode) return;
        this.points = [];
        this.canvas.clearContext(this.canvas.contextTop);
        this._lastPoint = null;
        this.addPoint(pointer, true);
    },

    onMouseMove: function (pointer, options) {
        if (!this.canvas.isDrawingMode || this.points.length === 0) return;
        this.addPoint(pointer, false);
        this.canvas.clearContext(this.canvas.contextTop);
        this.renderLatest(this.canvas.contextTop);
    },

    onMouseUp: function () {
        if (!this.canvas.isDrawingMode || this.points.length === 0) return;
        this.canvas.clearContext(this.canvas.contextTop);
        this.createPath();
        this.points = [];
        this._lastPoint = null;
    },

    addPoint: function (pointer, isDown) {
        if (isDown) {
            const pt = { x: pointer.x, y: pointer.y, pressure: 0.5 };
            this.points.push(pt);
            this._lastPoint = pt;
            return;
        }

        const dx = pointer.x - this._lastPoint.x;
        const dy = pointer.y - this._lastPoint.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const dynamicMinDist = Math.max(1.0, this.width * 0.1);

        if (dist < dynamicMinDist) return;

        const px = this._lastPoint.x + (dx * 0.5);
        const py = this._lastPoint.y + (dy * 0.5);

        const pt = { x: px, y: py, pressure: 0.5 };
        this.points.push(pt);
        this._lastPoint = pt;
    },

    getStrokeOptions: function (isComplete) {
        return {
            size: this.width,
            thinning: 0,
            smoothing: 0.6,
            streamline: 0.6,
            simulatePressure: false,
            last: isComplete,
            start: { cap: true, taper: 0 },
            end: { cap: true, taper: 0 }
        };
    },

    getSvgPathFromStroke: function (stroke) {
        if (!stroke || stroke.length === 0) return "";
        const d = stroke.reduce(
            (acc, [x0, y0], i, arr) => {
                const [x1, y1] = arr[(i + 1) % arr.length];
                acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
                return acc;
            },
            ["M", ...stroke[0], "Q"]
        );
        d.push("Z");
        return d.join(" ");
    },

    renderLatest: function (ctx) {
        if (this.points.length < 2) return;
        const stroke = getStroke(this.points, this.getStrokeOptions(false));
        if (!stroke || stroke.length === 0) return;

        const pathData = this.getSvgPathFromStroke(stroke);
        const path2d = new Path2D(pathData);

        ctx.save();
        ctx.fillStyle = 'rgba(192, 57, 43, 0.35)';
        ctx.strokeStyle = 'rgba(192, 57, 43, 0.7)';
        ctx.lineWidth = 1;
        ctx.stroke(path2d);
        ctx.fill(path2d, 'nonzero');
        ctx.globalCompositeOperation = 'source-over';
        ctx.fill(path2d, 'nonzero');
        ctx.restore();
    },

    createPath: async function () {
        if (this.points.length < 2) return;
        const stroke = getStroke(this.points, this.getStrokeOptions(true));
        if (!stroke || stroke.length === 0) return;

        const pathData = this.getSvgPathFromStroke(stroke);
        const eraserPath = new fabric.Path(pathData, {
            fill: '#000000',
            stroke: null,
            selectable: false,
            evented: false,
            objectCaching: false,
            fillRule: 'nonzero',
            globalCompositeOperation: 'destination-out',
            isEraser: true
        });

        const canvas = this.canvas;
        const activeLayerId = canvas.layerManager ? canvas.layerManager.activeLayerId : null;

        const objects = canvas.getObjects().filter(obj =>
            (activeLayerId ? obj.layerId === activeLayerId : true) &&
            !obj.isEraser &&
            !obj.isBg
        );

        const eraserBbox = eraserPath.getBoundingRect();
        const intersectingObjects = objects.filter(obj =>
            checkIntersection(obj.getBoundingRect(), eraserBbox)
        );

        if (intersectingObjects.length === 0) return;

        const historyManager = canvas.historyManager;
        const prevURL = historyManager
            ? await historyManager.captureLayerDataURL(activeLayerId)
            : null;
        const prevObjects = historyManager
            ? historyManager.snapshotLayerObjects(activeLayerId)
            : [];

        for (const obj of intersectingObjects) {
            const currentIndex = canvas.getObjects().indexOf(obj);
            const result = await rasterizeWithEraser(obj, eraserPath);

            if (result.removed) {
                if (currentIndex > -1) canvas.remove(obj);
            } else {
                canvas.remove(obj);
                if (currentIndex > -1) {
                    canvas.insertAt(result.img, currentIndex, false);
                } else {
                    canvas.add(result.img);
                }
            }
        }

        canvas.requestRenderAll();

        if (historyManager && prevURL !== null) {
            const nextURL = await historyManager.captureLayerDataURL(activeLayerId);
            historyManager.rasterCommand(prevURL, nextURL, activeLayerId, prevObjects);
        }
    }
});