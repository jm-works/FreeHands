import { getStroke } from "https://esm.sh/perfect-freehand";

function getBoundsFromImageData(imgData) {
    const width = imgData.width;
    const height = imgData.height;
    const data = imgData.data;
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let hasPixels = false;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const alpha = data[(y * width + x) * 4 + 3];
            if (alpha > 5) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                hasPixels = true;
            }
        }
    }

    if (!hasPixels) return null;

    return {
        left: minX,
        top: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
    };
}

function checkIntersection(bbox1, bbox2) {
    return (
        bbox1.left < bbox2.left + bbox2.width &&
        bbox1.left + bbox1.width > bbox2.left &&
        bbox1.top < bbox2.top + bbox2.height &&
        bbox1.top + bbox1.height > bbox2.top
    );
}

const cloneObjectAsync = (obj) => {
    return new Promise((resolve) => {
        obj.clone((cloned) => resolve(cloned));
    });
};

const createImageAsync = (url) => {
    return new Promise((resolve) => {
        fabric.Image.fromURL(url, (img) => resolve(img));
    });
};

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
        ctx.fillStyle = 'rgba(61, 174, 233, 0.5)';
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
        const intersectingObjects = objects.filter(obj => checkIntersection(obj.getBoundingRect(), eraserBbox));

        if (intersectingObjects.length === 0) return;

        const historyManager = canvas.historyManager;
        const prevURL = historyManager
            ? await historyManager.captureLayerDataURL(activeLayerId)
            : null;
        const prevObjects = historyManager
            ? historyManager.snapshotLayerObjects(activeLayerId)
            : [];

        for (const obj of intersectingObjects) {
            const objBbox = obj.getBoundingRect();
            const pad = 10;
            const cWidth = objBbox.width + pad * 2;
            const cHeight = objBbox.height + pad * 2;

            const staticCanvas = new fabric.StaticCanvas(null, {
                width: cWidth,
                height: cHeight,
                enableRetinaScaling: false
            });

            staticCanvas.viewportTransform = [1, 0, 0, 1, -objBbox.left + pad, -objBbox.top + pad];

            const clonedObj = await cloneObjectAsync(obj);
            staticCanvas.add(clonedObj);

            const clonedEraser = await cloneObjectAsync(eraserPath);
            clonedEraser.set({ globalCompositeOperation: 'destination-out' });
            staticCanvas.add(clonedEraser);

            staticCanvas.renderAll();

            const ctx = staticCanvas.getContext();
            const imgData = ctx.getImageData(0, 0, cWidth, cHeight);
            const bounds = getBoundsFromImageData(imgData);

            const currentIndex = canvas.getObjects().indexOf(obj);

            if (!bounds) {
                if (currentIndex > -1) canvas.remove(obj);
            } else {
                const croppedCanvas = document.createElement('canvas');
                croppedCanvas.width = bounds.width;
                croppedCanvas.height = bounds.height;
                const croppedCtx = croppedCanvas.getContext('2d');

                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = cWidth;
                tempCanvas.height = cHeight;
                tempCanvas.getContext('2d').putImageData(imgData, 0, 0);

                croppedCtx.drawImage(tempCanvas, bounds.left, bounds.top, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);

                const img = await createImageAsync(croppedCanvas.toDataURL());

                img.set({
                    left: objBbox.left - pad + bounds.left,
                    top: objBbox.top - pad + bounds.top,
                    layerId: obj.layerId,
                    selectable: false,
                    evented: false,
                    opacity: obj.opacity || 1,
                    globalCompositeOperation: obj.globalCompositeOperation || 'source-over'
                });

                if (currentIndex > -1) {
                    canvas.remove(obj);
                    canvas.insertAt(img, currentIndex, false);
                } else {
                    canvas.add(img);
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