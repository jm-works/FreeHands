export class StabilizedPencilBrush extends fabric.PencilBrush {
    constructor(canvas) {
        super(canvas);
        this.decimate = 1.5;
        this.windowSize = 1;
        this._buffer = [];
    }

    _smoothedPoint(rawPoint) {
        this._buffer.push(rawPoint);
        if (this._buffer.length > this.windowSize) {
            this._buffer.shift();
        }

        const len = this._buffer.length;
        let x = 0, y = 0;
        for (let i = 0; i < len; i++) {
            x += this._buffer[i].x;
            y += this._buffer[i].y;
        }
        return { x: x / len, y: y / len };
    }

    onMouseDown(pointer, options) {
        this._buffer = [];
        super.onMouseDown(pointer, options);
    }

    onMouseMove(pointer, options) {
        const smoothed = this._smoothedPoint(pointer);
        super.onMouseMove(smoothed, options);
    }
}