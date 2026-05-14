export class CursorManager {
    constructor(canvasContainer) {
        this.container = canvasContainer;
        this.canvas = this.container.querySelector('canvas');

        this.overlay = document.getElementById('brush-cursor-overlay');
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.id = 'brush-cursor-overlay';
            document.body.appendChild(this.overlay);
        }

        this.isVisible = false;
    }

    updateSize(brushSize, scale) {
        const visualSize = brushSize * scale;
        this.overlay.style.width = `${visualSize}px`;
        this.overlay.style.height = `${visualSize}px`;

        if (visualSize <= 1) {
            this.overlay.style.borderColor = 'transparent';
            this.overlay.style.boxShadow = 'none';
        } else {
            this.overlay.style.borderColor = 'rgba(0, 0, 0, 0.7)';
            this.overlay.style.boxShadow = '0 0 0 1px rgba(255, 255, 255, 0.7)';
        }
    }

    updatePosition(clientX, clientY) {
        this.overlay.style.left = `${clientX}px`;
        this.overlay.style.top = `${clientY}px`;
    }

    show() {
        this.isVisible = true;
        this.overlay.style.display = 'block';
    }

    hide() {
        this.isVisible = false;
        this.overlay.style.display = 'none';
    }

    updateSystemCursor(isSpacePressed, isPanning) {
        if (isSpacePressed) {
            this.hide();
            const grabCursor = isPanning ? 'grabbing' : 'grab';
            this.container.style.cursor = grabCursor;
            this.canvas.style.cursor = grabCursor;
        } else {
            this.container.style.cursor = 'none';
            this.canvas.style.cursor = 'none';
            if (this.isVisible) {
                this.show();
            }
        }
    }
}