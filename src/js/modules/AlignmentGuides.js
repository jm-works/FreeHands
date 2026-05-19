export class AlignmentGuides {
    constructor(canvasManager) {
        this.canvas = canvasManager.canvas;
        this.aligningLineOffset = 10;
        this.aligningLineColor = '#c0392b';
        this.centerLineColor = '#c0392b';
        this.aligningLineWidth = 1.5;
        this.verticalLines = [];
        this.horizontalLines = [];
        this.init();
    }

    init() {
        this.canvas.on('object:moving', (e) => this.onObjectMoving(e));
        this.canvas.on('after:render', (e) => this.drawLines(e.ctx || this.canvas.contextContainer));
        this.canvas.on('mouse:up', () => {
            this.verticalLines = [];
            this.horizontalLines = [];
            this.canvas.requestRenderAll();
        });
    }

    drawLines(ctx) {
        if (!ctx) return;
        if (this.verticalLines.length === 0 && this.horizontalLines.length === 0) return;

        ctx.save();
        ctx.transform.apply(ctx, this.canvas.viewportTransform);
        ctx.lineWidth = this.aligningLineWidth / this.canvas.getZoom();

        this.verticalLines.forEach(line => {
            ctx.strokeStyle = line.isCenter ? this.centerLineColor : this.aligningLineColor;

            if (!line.isCenter) ctx.setLineDash([5, 5]);
            else ctx.setLineDash([]);

            ctx.beginPath();
            ctx.moveTo(line.x, line.y1);
            ctx.lineTo(line.x, line.y2);
            ctx.stroke();
        });

        this.horizontalLines.forEach(line => {
            ctx.strokeStyle = line.isCenter ? this.centerLineColor : this.aligningLineColor;

            if (!line.isCenter) ctx.setLineDash([5, 5]);
            else ctx.setLineDash([]);

            ctx.beginPath();
            ctx.moveTo(line.x1, line.y);
            ctx.lineTo(line.x2, line.y);
            ctx.stroke();
        });

        ctx.restore();
    }

    onObjectMoving(e) {
        this.verticalLines = [];
        this.horizontalLines = [];

        const activeObject = e.target;
        const canvasWidth = this.canvas.getWidth();
        const canvasHeight = this.canvas.getHeight();
        let objCenter = activeObject.getCenterPoint();
        const objBound = activeObject.getBoundingRect();
        const objHalfWidth = objBound.width / 2;
        const objHalfHeight = objBound.height / 2;

        let snapX = false;
        let snapY = false;

        const checkAndSnapX = (activeVal, targetVal, lineCoords) => {
            if (Math.abs(activeVal - targetVal) < this.aligningLineOffset / this.canvas.getZoom()) {
                activeObject.setPositionByOrigin(new fabric.Point(targetVal, objCenter.y), 'center', 'center');
                objCenter = activeObject.getCenterPoint();
                this.verticalLines.push(lineCoords);
                return true;
            }
            return false;
        };

        const checkAndSnapY = (activeVal, targetVal, lineCoords) => {
            if (Math.abs(activeVal - targetVal) < this.aligningLineOffset / this.canvas.getZoom()) {
                activeObject.setPositionByOrigin(new fabric.Point(objCenter.x, targetVal), 'center', 'center');
                objCenter = activeObject.getCenterPoint();
                this.horizontalLines.push(lineCoords);
                return true;
            }
            return false;
        };

        if (checkAndSnapX(objCenter.x, canvasWidth / 2, { x: canvasWidth / 2, y1: 0, y2: canvasHeight, isCenter: true })) snapX = true;
        if (checkAndSnapY(objCenter.y, canvasHeight / 2, { y: canvasHeight / 2, x1: 0, x2: canvasWidth, isCenter: true })) snapY = true;

        this.canvas.getObjects().forEach(target => {
            if (target === activeObject || target.isBg || target.isEraser || target.isSelectionRect) return;

            const targetCenter = target.getCenterPoint();
            const targetBound = target.getBoundingRect();
            const targetHalfWidth = targetBound.width / 2;
            const targetHalfHeight = targetBound.height / 2;

            if (!snapX) {
                const xs = [
                    targetCenter.x,
                    targetCenter.x - targetHalfWidth,
                    targetCenter.x + targetHalfWidth
                ];
                for (let x of xs) {
                    if (checkAndSnapX(objCenter.x, x, {
                        x: x,
                        y1: Math.min(objCenter.y, targetCenter.y) - Math.max(objHalfHeight, targetHalfHeight),
                        y2: Math.max(objCenter.y, targetCenter.y) + Math.max(objHalfHeight, targetHalfHeight),
                        isCenter: false
                    })) { snapX = true; break; }
                }
            }

            if (!snapY) {
                const ys = [
                    targetCenter.y,
                    targetCenter.y - targetHalfHeight,
                    targetCenter.y + targetHalfHeight
                ];
                for (let y of ys) {
                    if (checkAndSnapY(objCenter.y, y, {
                        y: y,
                        x1: Math.min(objCenter.x, targetCenter.x) - Math.max(objHalfWidth, targetHalfWidth),
                        x2: Math.max(objCenter.x, targetCenter.x) + Math.max(objHalfWidth, targetHalfWidth),
                        isCenter: false
                    })) { snapY = true; break; }
                }
            }
        });
    }
}