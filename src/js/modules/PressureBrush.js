import { getStroke } from "https://esm.sh/perfect-freehand";

export const PressureBrush = fabric.util.createClass(fabric.BaseBrush, {
    initialize: function (canvas) {
        this.canvas = canvas;
        this.color = '#000000';
        this.width = 4;
        this.points = [];
        this.pressureSensitivity = 1.0;
        this.streamline = 0.7;
        this._lastPoint = null;
        this._posBuffer = [];
        this._anchorPoint = null;
        this._isAltConstrained = false;
        this._posBuffer = [];
        this._posWindowSize = 1;

        this._onPointerMove = (e) => {
            if (!this.canvas.isDrawingMode || this.points.length === 0) return;

            const coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
            for (const ce of coalesced) {
                const pointer = this.canvas.getPointer(ce);
                this.addPoint(pointer, ce, false);
            }

            this.canvas.clearContext(this.canvas.contextTop);
            this.renderLatest(this.canvas.contextTop);
        };
    },

    onMouseDown: function (pointer, options) {
        if (!this.canvas.isDrawingMode) return;
        this.points = [];
        this.canvas.clearContext(this.canvas.contextTop);
        this._lastPoint = null;
        this.addPoint(pointer, options.e, true);
        this.canvas.upperCanvasEl.addEventListener('pointermove', this._onPointerMove);
    },

    onMouseMove: function (pointer, options) {
        if (!this.canvas.isDrawingMode || this.points.length === 0) return;
        this.addPoint(pointer, options.e, false);
        this.canvas.clearContext(this.canvas.contextTop);
        this.renderLatest(this.canvas.contextTop);
    },

    onMouseUp: function () {
        this.canvas.upperCanvasEl.removeEventListener('pointermove', this._onPointerMove);
        if (!this.canvas.isDrawingMode || this.points.length === 0) return;
        this.canvas.clearContext(this.canvas.contextTop);
        this.createPath();
        this.points = [];
        this._lastPoint = null;
        this._anchorPoint = null;
    },

    // PATCH — PressureBrush.js
    // Substituir o bloco completo de addPoint por este:

    addPoint: function (pointer, e, isDown) {
        let rawPressure = 0.5;
        if (e && typeof e.pressure === 'number') {
            rawPressure = e.pointerType === 'mouse' ? 0.5 : e.pressure;
        } else if (window.currentPointerPressure !== undefined) {
            rawPressure = window.currentPointerPressure;
        }

        rawPressure = Math.pow(Math.max(0.01, rawPressure), 1.15) * this.pressureSensitivity;

        if (isDown) {
            this._posBuffer = [];
            this._lastRawPoint = { x: pointer.x, y: pointer.y };
            const pt = { x: pointer.x, y: pointer.y, pressure: rawPressure };
            this.points.push(pt);
            this._lastPoint = pt;
            this._anchorPoint = { x: pointer.x, y: pointer.y };
            return;
        }

        if (!this._lastPoint || !this._lastRawPoint) return;

        let currentX = pointer.x;
        let currentY = pointer.y;

        if (e && e.altKey && this._anchorPoint) {
            const diffX = Math.abs(currentX - this._anchorPoint.x);
            const diffY = Math.abs(currentY - this._anchorPoint.y);
            if (diffX > diffY) {
                currentY = this._anchorPoint.y;
            } else {
                currentX = this._anchorPoint.x;
            }
        }

        const dx = currentX - this._lastRawPoint.x;
        const dy = currentY - this._lastRawPoint.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 0.01) return;

        this._lastRawPoint = { x: currentX, y: currentY };

        this._posBuffer.push({ x: currentX, y: currentY });
        if (this._posBuffer.length > this._posWindowSize) this._posBuffer.shift();

        const bufLen = this._posBuffer.length;
        let avgX = 0, avgY = 0;
        for (let i = 0; i < bufLen; i++) {
            avgX += this._posBuffer[i].x;
            avgY += this._posBuffer[i].y;
        }
        avgX /= bufLen;
        avgY /= bufLen;

        const pPressure = (this._lastPoint.pressure * 0.6) + (rawPressure * 0.4);
        const pt = { x: avgX, y: avgY, pressure: pPressure };
        this.points.push(pt);
        this._lastPoint = pt;
    },

    getStrokeOptions: function (isComplete) {
        const dynamicTaper = Math.max(2, Math.min(this.width * 1.5, 30));
        const dynamicThinning = Math.max(0.3, 0.75 - (this.width * 0.005));

        return {
            size: this.width,
            thinning: dynamicThinning,
            smoothing: 0.8,
            streamline: 0.6,
            simulatePressure: false,
            last: isComplete,
            start: {
                cap: true,
                taper: dynamicTaper,
                easing: (t) => t * (2 - t)
            },
            end: {
                cap: true,
                taper: dynamicTaper,
                easing: (t) => --t * t * t + 1
            }
        };
    }, getStrokeOptions: function (isComplete) {
        const dynamicTaper = Math.max(2, Math.min(this.width * 1.5, 30));
        const dynamicThinning = Math.max(0.3, 0.75 - (this.width * 0.005));

        return {
            size: this.width,
            thinning: dynamicThinning,
            smoothing: 0.8,
            streamline: this.streamline,
            simulatePressure: false,
            last: isComplete,
            start: {
                cap: true,
                taper: dynamicTaper,
                easing: (t) => t * (2 - t)
            },
            end: {
                cap: true,
                taper: dynamicTaper,
                easing: (t) => --t * t * t + 1
            }
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
        ctx.fillStyle = this.color;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fill(path2d, 'nonzero');
        ctx.restore();
    },

    createPath: function () {
        if (this.points.length < 2) return;
        const stroke = getStroke(this.points, this.getStrokeOptions(true));
        if (!stroke || stroke.length === 0) return;

        const pathData = this.getSvgPathFromStroke(stroke);
        const path = new fabric.Path(pathData, {
            fill: this.color,
            stroke: null,
            selectable: false,
            evented: false,
            objectCaching: false,
            fillRule: 'nonzero'
        });

        this.canvas.add(path);
        this.canvas.fire('path:created', { path: path });
        this.canvas.requestRenderAll();
    }
});