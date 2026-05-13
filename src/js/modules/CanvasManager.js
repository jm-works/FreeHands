export class CanvasManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.container = this.canvas.parentElement;
        this.ctx = this.canvas.getContext('2d');

        // (Sim, é exatamente isso que você está pensando, funciona, isso que importa.)
        this.isDrawing = false;

        // Brush settings
        this.brushColor = '#000000';
        this.brushSize = 5;

        // Pan & Zoom
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;

        this.isPanning = false;
        this.isSpacePressed = false;
        this.panStartX = 0;
        this.panStartY = 0;

        this.init();
    }

    init() {
        this.setupCanvas();
        this.addEventListeners();
        this.updateTransform();
    }

    setupCanvas() {
        // Canvas Size (Irei deixar dinamico essa desgraça em algum momento, acalmem)
        this.canvas.width = 800;
        this.canvas.height = 600;

        // Paper (Vou deixar dinamico em algum momento, se eu lembrar)
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Brush Config
        this.ctx.lineWidth = this.brushSize;
        this.ctx.lineCap = 'round';
        this.ctx.strokeStyle = this.brushColor;
    }

    addEventListeners() {
        this.container.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.container.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });

        window.addEventListener('mousemove', this.handleMouseMove.bind(this));
        window.addEventListener('mouseup', this.handleMouseUp.bind(this));

        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        window.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    handleWheel(e) {
        e.preventDefault();
        const zoomSensitivity = 0.1;
        const delta = e.deltaY > 0 ? -1 : 1;
        this.adjustZoom(delta * zoomSensitivity);
    }

    handleKeyDown(e) {
        if (e.code === 'Space') {
            if (!this.isSpacePressed) {
                this.isSpacePressed = true;
                this.updateCursor();
            }
        } else if (e.key === '+' || e.key === '=') {
            this.adjustZoom(0.1);
        } else if (e.key === '-') {
            this.adjustZoom(-0.1);
        }
    }

    handleKeyUp(e) {
        if (e.code === 'Space') {
            this.isSpacePressed = false;
            this.updateCursor();
        }
    }

    adjustZoom(amount) {
        this.scale += amount;
        this.scale = Math.max(0.1, Math.min(this.scale, 10));
        this.updateTransform();
    }

    updateTransform() {
        this.canvas.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale})`;
    }

    updateCursor() {
        if (this.isSpacePressed) {
            this.canvas.style.cursor = this.isPanning ? 'grabbing' : 'grab';
            this.container.style.cursor = this.isPanning ? 'grabbing' : 'grab';
        } else {
            this.canvas.style.cursor = 'crosshair';
            this.container.style.cursor = 'default';
        }
    }

    handleMouseDown(e) {
        if (e.button === 1 || (e.button === 0 && this.isSpacePressed)) {
            e.preventDefault();
            this.isPanning = true;
            this.panStartX = e.clientX - this.offsetX;
            this.panStartY = e.clientY - this.offsetY;
            this.updateCursor();
        }
        else if (e.button === 0 && e.target === this.canvas) {
            this.isDrawing = true;
            this.draw(e);
        }
    }

    handleMouseMove(e) {
        if (this.isPanning) {
            this.offsetX = e.clientX - this.panStartX;
            this.offsetY = e.clientY - this.panStartY;
            this.updateTransform();
        } else if (this.isDrawing) {
            this.draw(e);
        }
    }

    handleMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.updateCursor();
        }
        if (this.isDrawing) {
            this.isDrawing = false;
            this.ctx.beginPath();
        }
    }

    getMousePos(e) {
        // Mouse Settings (Em algum momento terá suporte a mesa digitalizadora)
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / this.scale,
            y: (e.clientY - rect.top) / this.scale
        };
    }

    draw(e) {
        if (!this.isDrawing) return;

        const pos = this.getMousePos(e);

        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
    }

    setBrushColor(color) {
        this.brushColor = color;
        this.ctx.strokeStyle = color;
    }

    setBrushSize(size) {
        this.brushSize = size;
        this.ctx.lineWidth = size;
    }
}