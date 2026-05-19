export class FillManager {
    constructor(canvasManager) {
        this.canvasManager = canvasManager;
        this.canvas = canvasManager.canvas;
    }

    fill(startX, startY, hexColor, tolerance = 32, opacity = 1, clipBounds = null, onComplete = null) {
        startX = Math.floor(startX);
        startY = Math.floor(startY);

        const width = this.canvas.width;
        const height = this.canvas.height;

        const targetColor = this.hexToRgba(hexColor, opacity);

        if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

        if (clipBounds) {
            const cl = Math.floor(clipBounds.left);
            const ct = Math.floor(clipBounds.top);
            const cr = cl + Math.floor(clipBounds.width);
            const cb = ct + Math.floor(clipBounds.height);
            if (startX < cl || startX >= cr || startY < ct || startY >= cb) return;
        }

        const tempReadCanvas = document.createElement('canvas');
        tempReadCanvas.width = width;
        tempReadCanvas.height = height;
        const ctx = tempReadCanvas.getContext('2d', { willReadFrequently: true });

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(this.canvas.toCanvasElement(), 0, 0);

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        const startPos = (startY * width + startX) * 4;
        const startR = data[startPos];
        const startG = data[startPos + 1];
        const startB = data[startPos + 2];
        const startA = data[startPos + 3];

        if (this.colorMatch(startR, startG, startB, startA, targetColor)) return;

        const fillImgData = new ImageData(width, height);
        const fillData = fillImgData.data;
        const visited = new Uint8Array(width * height);

        const minX = clipBounds ? Math.max(0, Math.floor(clipBounds.left)) : 0;
        const minY = clipBounds ? Math.max(0, Math.floor(clipBounds.top)) : 0;
        const maxX = clipBounds ? Math.min(width - 1, Math.floor(clipBounds.left + clipBounds.width) - 1) : width - 1;
        const maxY = clipBounds ? Math.min(height - 1, Math.floor(clipBounds.top + clipBounds.height) - 1) : height - 1;

        const stack = [startX, startY];

        while (stack.length > 0) {
            const y = stack.pop();
            const x = stack.pop();

            if (x < minX || x > maxX || y < minY || y > maxY) continue;

            const pos = y * width + x;
            if (visited[pos]) continue;
            visited[pos] = 1;

            const pos4 = pos * 4;
            const r = data[pos4];
            const g = data[pos4 + 1];
            const b = data[pos4 + 2];
            const a = data[pos4 + 3];

            if (Math.abs(r - startR) <= tolerance &&
                Math.abs(g - startG) <= tolerance &&
                Math.abs(b - startB) <= tolerance &&
                Math.abs(a - startA) <= tolerance) {

                fillData[pos4] = targetColor[0];
                fillData[pos4 + 1] = targetColor[1];
                fillData[pos4 + 2] = targetColor[2];
                fillData[pos4 + 3] = targetColor[3];

                if (x > minX) stack.push(x - 1, y);
                if (x < maxX) stack.push(x + 1, y);
                if (y > minY) stack.push(x, y - 1);
                if (y < maxY) stack.push(x, y + 1);
            }
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        tempCanvas.getContext('2d').putImageData(fillImgData, 0, 0);

        fabric.Image.fromURL(tempCanvas.toDataURL(), (img) => {
            img.set({
                left: 0,
                top: 0,
                selectable: false,
                evented: false,
                layerId: this.canvasManager.layerManager ? this.canvasManager.layerManager.activeLayerId : null
            });
            this.canvas.add(img);
            this.canvas.requestRenderAll();
            this.canvasManager.historyManager.saveState();
            if (onComplete) onComplete();
        });
    }

    hexToRgba(hex, opacity = 1) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return [r, g, b, Math.round(opacity * 255)];
    }

    colorMatch(r, g, b, a, target) {
        return r === target[0] && g === target[1] && b === target[2] && a === target[3];
    }
}