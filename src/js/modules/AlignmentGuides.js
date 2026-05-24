export class AlignmentGuides {

    static DEFAULTS = {
        snapThreshold: 8,
        releaseThreshold: 14,
        guideColor: '#c0392b',
        canvasCenterColor: '#e67e22',
        lineWidth: 1,
        dashPattern: [6, 4],
        gapLineColor: '#3498db',
        gapLabelBg: 'rgba(15,15,20,0.85)',
        gapLabelText: '#e0e0e0',
        gapLabelFont: '600 10px Oswald, Arial Narrow, sans-serif',
    };

    constructor(canvasManager) {
        this.canvas = canvasManager.canvas;
        this.cfg = { ...AlignmentGuides.DEFAULTS };

        this._verticalLines = [];
        this._horizontalLines = [];
        this._gapMeasurements = [];

        this._snapLockedX = null;
        this._snapLockedY = null;

        this._altPressed = false;
        this._init();
    }

    _init() {
        window.addEventListener('keydown', (e) => {
            if (e.key !== 'Alt') return;
            e.preventDefault();
            this._altPressed = true;
            this._snapLockedX = null;
            this._snapLockedY = null;

            const active = this.canvas.getActiveObject();
            if (active) {
                this._clearState();
                this._computeGapMeasurements(active);
                this.canvas.requestRenderAll();
            }
        });
        window.addEventListener('keyup', (e) => {
            if (e.key !== 'Alt') return;
            this._altPressed = false;
            this._clearAll();
        });

        this.canvas.on('object:moving', (e) => this._onTransform(e));
        this.canvas.on('object:scaling', (e) => this._onTransform(e));
        this.canvas.on('after:render', (e) => this._drawAll(e.ctx));
        this.canvas.on('mouse:up', () => this._clearAll());
    }


    _onTransform(e) {
        this._clearState();
        const active = e.target;

        if (this._altPressed) {
            this._snapLockedX = null;
            this._snapLockedY = null;
            this._computeGapMeasurements(active);
        } else {
            this._computeSnapGuides(active);
        }
    }

    _computeSnapGuides(active) {
        const zoom = this.canvas.getZoom();
        const snapThr = this.cfg.snapThreshold / zoom;
        const relThr = this.cfg.releaseThreshold / zoom;
        const cw = this.canvas.getWidth();
        const ch = this.canvas.getHeight();

        const _activePoints = (obj) => {
            const c = obj.getCenterPoint();
            const hw = obj.getScaledWidth() / 2;
            const hh = obj.getScaledHeight() / 2;
            return { c, xs: [c.x - hw, c.x, c.x + hw], ys: [c.y - hh, c.y, c.y + hh] };
        };

        const _snapAxis = (lockedKey, linesArr, axis, candidatesFn, isCenter) => {
            const locked = this[lockedKey];
            const { c, xs, ys } = _activePoints(active);
            const pts = axis === 'x' ? xs : ys;

            if (locked !== null) {
                const minDist = Math.min(...pts.map(p => Math.abs(p - locked)));
                if (minDist < relThr) {
                    const closest = pts.reduce((a, b) => Math.abs(a - locked) < Math.abs(b - locked) ? a : b);
                    const delta = locked - closest;
                    active.setPositionByOrigin(
                        new fabric.Point(axis === 'x' ? c.x + delta : c.x, axis === 'y' ? c.y + delta : c.y),
                        'center', 'center'
                    );
                    linesArr.push(axis === 'x'
                        ? { x: locked, y1: 0, y2: ch, isCanvasCenter: locked === cw / 2 }
                        : { y: locked, x1: 0, x2: cw, isCanvasCenter: locked === ch / 2 }
                    );
                    return;
                }
                this[lockedKey] = null;
            }

            for (const candidate of candidatesFn()) {
                const target = axis === 'x' ? candidate.tx : candidate.ty;
                const { xs: axs, ys: ays, c: cc } = _activePoints(active);
                const curPts = axis === 'x' ? axs : ays;
                const closest = curPts.reduce((a, b) => Math.abs(a - target) < Math.abs(b - target) ? a : b);
                if (Math.abs(closest - target) < snapThr) {
                    const delta = target - closest;
                    active.setPositionByOrigin(
                        new fabric.Point(axis === 'x' ? cc.x + delta : cc.x, axis === 'y' ? cc.y + delta : cc.y),
                        'center', 'center'
                    );
                    this[lockedKey] = target;
                    linesArr.push(axis === 'x'
                        ? { x: target, y1: 0, y2: ch, isCanvasCenter: candidate.isCanvasCenter }
                        : { y: target, x1: 0, x2: cw, isCanvasCenter: candidate.isCanvasCenter }
                    );
                    break;
                }
            }
        };

        _snapAxis('_snapLockedX', this._verticalLines, 'x', () => this._candidatesX(active, cw, ch, snapThr));
        _snapAxis('_snapLockedY', this._horizontalLines, 'y', () => this._candidatesY(active, cw, ch, snapThr));
    }

    _candidatesX(active, cw, ch, threshold) {
        const candidates = [
            { tx: cw / 2, isCanvasCenter: true },
            { tx: 0, isCanvasCenter: false },
            { tx: cw, isCanvasCenter: false },
        ];
        this._getSnapTargets(active).forEach(t => {
            const tc = t.getCenterPoint();
            const thw = t.getScaledWidth() / 2;
            [tc.x - thw, tc.x, tc.x + thw].forEach(x => candidates.push({ tx: x, isCanvasCenter: false }));
        });
        return candidates;
    }

    _candidatesY(active, cw, ch, threshold) {
        const candidates = [
            { ty: ch / 2, isCanvasCenter: true },
            { ty: 0, isCanvasCenter: false },
            { ty: ch, isCanvasCenter: false },
        ];
        this._getSnapTargets(active).forEach(t => {
            const tc = t.getCenterPoint();
            const thh = t.getScaledHeight() / 2;
            [tc.y - thh, tc.y, tc.y + thh].forEach(y => candidates.push({ ty: y, isCanvasCenter: false }));
        });
        return candidates;
    }

    _computeGapMeasurements(active) {
        const zoom = this.canvas.getZoom();
        const ac = active.getCenterPoint();
        const abr = active.getBoundingRect();
        const aw = abr.width / zoom;
        const ah = abr.height / zoom;
        const aL = ac.x - aw / 2, aR = ac.x + aw / 2;
        const aT = ac.y - ah / 2, aB = ac.y + ah / 2;

        let nearLeft = null, dLeft = Infinity;
        let nearRight = null, dRight = Infinity;
        let nearTop = null, dTop = Infinity;
        let nearBot = null, dBot = Infinity;

        this._getSnapTargets(active).forEach(t => {
            const tc = t.getCenterPoint();
            const tbr = t.getBoundingRect();
            const tw = tbr.width / zoom;
            const th = tbr.height / zoom;
            const tL = tc.x - tw / 2, tR = tc.x + tw / 2;
            const tT = tc.y - th / 2, tB = tc.y + th / 2;

            const overlapV = tT < aB && tB > aT;
            const overlapH = tL < aR && tR > aL;

            if (overlapV) {
                if (tR <= aL && aL - tR < dLeft) { dLeft = aL - tR; nearLeft = { tR, tT, tB }; }
                if (tL >= aR && tL - aR < dRight) { dRight = tL - aR; nearRight = { tL, tT, tB }; }
            }
            if (overlapH) {
                if (tB <= aT && aT - tB < dTop) { dTop = aT - tB; nearTop = { tB, tL, tR }; }
                if (tT >= aB && tT - aB < dBot) { dBot = tT - aB; nearBot = { tT, tL, tR }; }
            }
        });

        if (nearLeft && dLeft > 0) {
            const midY = Math.max(nearLeft.tT, aT) + (Math.min(nearLeft.tB, aB) - Math.max(nearLeft.tT, aT)) / 2;
            this._gapMeasurements.push({ axis: 'x', from: nearLeft.tR, to: aL, pos: midY, label: `${Math.round(dLeft)}px` });
        }
        if (nearRight && dRight > 0) {
            const midY = Math.max(nearRight.tT, aT) + (Math.min(nearRight.tB, aB) - Math.max(nearRight.tT, aT)) / 2;
            this._gapMeasurements.push({ axis: 'x', from: aR, to: nearRight.tL, pos: midY, label: `${Math.round(dRight)}px` });
        }
        if (nearTop && dTop > 0) {
            const midX = Math.max(nearTop.tL, aL) + (Math.min(nearTop.tR, aR) - Math.max(nearTop.tL, aL)) / 2;
            this._gapMeasurements.push({ axis: 'y', from: nearTop.tB, to: aT, pos: midX, label: `${Math.round(dTop)}px` });
        }
        if (nearBot && dBot > 0) {
            const midX = Math.max(nearBot.tL, aL) + (Math.min(nearBot.tR, aR) - Math.max(nearBot.tL, aL)) / 2;
            this._gapMeasurements.push({ axis: 'y', from: aB, to: nearBot.tT, pos: midX, label: `${Math.round(dBot)}px` });
        }
    }

    _drawAll(ctx) {
        if (!ctx) return;
        if (!this._verticalLines.length && !this._horizontalLines.length && !this._gapMeasurements.length) return;

        ctx.save();
        ctx.transform(...this.canvas.viewportTransform);

        const zoom = this.canvas.getZoom();
        ctx.lineWidth = this.cfg.lineWidth / zoom;

        this._verticalLines.forEach(l => {
            ctx.setLineDash(l.isCanvasCenter ? [] : this.cfg.dashPattern.map(v => v / zoom));
            ctx.strokeStyle = l.isCanvasCenter ? this.cfg.canvasCenterColor : this.cfg.guideColor;
            ctx.beginPath(); ctx.moveTo(l.x, l.y1); ctx.lineTo(l.x, l.y2); ctx.stroke();
            ctx.setLineDash([]);
        });

        this._horizontalLines.forEach(l => {
            ctx.setLineDash(l.isCanvasCenter ? [] : this.cfg.dashPattern.map(v => v / zoom));
            ctx.strokeStyle = l.isCanvasCenter ? this.cfg.canvasCenterColor : this.cfg.guideColor;
            ctx.beginPath(); ctx.moveTo(l.x1, l.y); ctx.lineTo(l.x2, l.y); ctx.stroke();
            ctx.setLineDash([]);
        });

        this._drawGapMeasurements(ctx, zoom);

        ctx.restore();
    }

    _drawGapMeasurements(ctx, zoom) {
        if (!this._gapMeasurements.length) return;
        ctx.strokeStyle = this.cfg.gapLineColor;
        ctx.lineWidth = 1 / zoom;
        ctx.setLineDash([]);

        this._gapMeasurements.forEach(gap => {
            const a = 4 / zoom;
            if (gap.axis === 'x') {
                const { from: x1, to: x2, pos: y } = gap;
                ctx.beginPath();
                ctx.moveTo(x1, y); ctx.lineTo(x2, y);
                ctx.moveTo(x1, y); ctx.lineTo(x1 + a, y - a); ctx.moveTo(x1, y); ctx.lineTo(x1 + a, y + a);
                ctx.moveTo(x2, y); ctx.lineTo(x2 - a, y - a); ctx.moveTo(x2, y); ctx.lineTo(x2 - a, y + a);
                ctx.stroke();
                this._drawLabel(ctx, gap.label, (x1 + x2) / 2, y - 8 / zoom, zoom);
            } else {
                const { from: y1, to: y2, pos: x } = gap;
                ctx.beginPath();
                ctx.moveTo(x, y1); ctx.lineTo(x, y2);
                ctx.moveTo(x, y1); ctx.lineTo(x - a, y1 + a); ctx.moveTo(x, y1); ctx.lineTo(x + a, y1 + a);
                ctx.moveTo(x, y2); ctx.lineTo(x - a, y2 - a); ctx.moveTo(x, y2); ctx.lineTo(x + a, y2 - a);
                ctx.stroke();
                this._drawLabel(ctx, gap.label, x + 8 / zoom, (y1 + y2) / 2, zoom);
            }
        });
    }

    _drawLabel(ctx, text, x, y, zoom) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1 / zoom, 1 / zoom);
        ctx.font = this.cfg.gapLabelFont;
        const pad = 4, w = ctx.measureText(text).width + pad * 2, h = 16;
        ctx.fillStyle = this.cfg.gapLabelBg; ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = this.cfg.gapLineColor; ctx.lineWidth = 0.5; ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = this.cfg.gapLabelText;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, 0, 0);
        ctx.restore();
    }

    _getSnapTargets(active) {
        return this.canvas.getObjects().filter(o =>
            o !== active && !o.isBg && !o.isEraser && !o.isSelectionRect
        );
    }

    _clearState() {
        this._verticalLines = [];
        this._horizontalLines = [];
        this._gapMeasurements = [];
    }

    _clearAll() {
        this._clearState();
        this._snapLockedX = null;
        this._snapLockedY = null;
        this.canvas.requestRenderAll();
    }
}