import { CursorManager } from './CursorManager.js';
import { HistoryManager } from './HistoryManager.js';

fabric.Object.prototype.selectable = false;
fabric.Object.prototype.evented = false;

export class CanvasManager {
    constructor(canvasId) {
        this.canvas = new fabric.Canvas(canvasId, {
            isDrawingMode: true,
            width: 800,
            height: 600,
            selection: false,
            backgroundColor: '#ffffff'
        });

        this.workspace = this.canvas.wrapperEl.parentElement;
        this.workspace.style.touchAction = 'none';

        this.board = this.canvas.wrapperEl;

        this.zoom = 1;
        this.offsetX = 0;
        this.offsetY = 0;

        this.cursorManager = new CursorManager(this.workspace);
        this.historyManager = new HistoryManager(this.canvas);

        this.currentTool = 'brush';
        this.brushColor = '#000000';
        this.brushSize = 5;

        this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
        this.canvas.freeDrawingBrush.color = this.brushColor;
        this.canvas.freeDrawingBrush.width = this.brushSize;
        this.canvas.freeDrawingBrush.decimate = 1;

        this.canvas.freeDrawingCursor = 'none';

        this.isPanning = false;
        this.isSpacePressed = false;
        this.lastPosX = 0;
        this.lastPosY = 0;

        this.init();
    }

    init() {
        setTimeout(() => this.canvas.calcOffset(), 100);
        window.addEventListener('resize', () => this.canvas.calcOffset());

        this.addEventListeners();
        this.cursorManager.updateSize(this.brushSize, this.zoom);
        this.cursorManager.updateSystemCursor(this.isSpacePressed, this.isPanning);
    }

    updateTransform() {
        this.board.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.zoom})`;
        this.canvas.calcOffset();
    }

    addEventListeners() {
        window.addEventListener('keydown', (e) => {
            const isCtrl = e.ctrlKey || e.metaKey;

            if (isCtrl && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) this.historyManager.redo();
                else this.historyManager.undo();
            } else if (isCtrl && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                this.historyManager.redo();
            } else if (e.code === 'Space' && !this.isSpacePressed) {
                this.isSpacePressed = true;
                this.canvas.isDrawingMode = false;
                this.cursorManager.updateSystemCursor(this.isSpacePressed, this.isPanning);
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                this.isSpacePressed = false;
                this.canvas.isDrawingMode = (this.currentTool === 'brush' || this.currentTool === 'eraser');
                this.cursorManager.updateSystemCursor(this.isSpacePressed, this.isPanning);
            }
        });

        this.canvas.on('mouse:down', (opt) => {
            const evt = opt.e;
            if (evt.button === 1 || this.isSpacePressed || this.currentTool === 'pan') {
                evt.preventDefault();
                this.isPanning = true;
                this.canvas.isDrawingMode = false;
                this.lastPosX = evt.clientX;
                this.lastPosY = evt.clientY;
                this.cursorManager.updateSystemCursor(true, this.isPanning);
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                this.offsetX += (e.clientX - this.lastPosX);
                this.offsetY += (e.clientY - this.lastPosY);
                this.lastPosX = e.clientX;
                this.lastPosY = e.clientY;
                this.updateTransform();
            } else if (!this.isSpacePressed) {
                this.cursorManager.updatePosition(e.clientX, e.clientY);

                if (e.target.closest('.workspace-area') && !this.cursorManager.isVisible) {
                    this.cursorManager.show();
                }
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.isPanning) {
                this.isPanning = false;
                if (!this.isSpacePressed && (this.currentTool === 'brush' || this.currentTool === 'eraser')) {
                    this.canvas.isDrawingMode = true;
                }
                this.cursorManager.updateSystemCursor(this.isSpacePressed, this.isPanning);
            }
        });

        this.workspace.addEventListener('wheel', (e) => {
            e.preventDefault();

            const delta = e.deltaY;
            let newZoom = this.zoom * (0.999 ** delta);
            if (newZoom > 10) newZoom = 10;
            if (newZoom < 0.1) newZoom = 0.1;

            const scaleRatio = newZoom / this.zoom;
            this.zoom = newZoom;

            const rect = this.workspace.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const mouseX = e.clientX - centerX;
            const mouseY = e.clientY - centerY;

            this.offsetX = mouseX - (mouseX - this.offsetX) * scaleRatio;
            this.offsetY = mouseY - (mouseY - this.offsetY) * scaleRatio;

            this.updateTransform();
            this.cursorManager.updateSize(this.brushSize, this.zoom);

            const zoomDisplay = document.getElementById('zoom-val-display');
            if (zoomDisplay) zoomDisplay.textContent = `Zoom: ${Math.round(this.zoom * 100)}%`;
        }, { passive: false });

        this.canvas.on('path:created', (opt) => {
            if (this.currentTool === 'eraser') {
                opt.path.globalCompositeOperation = 'destination-out';
                this.canvas.requestRenderAll();
            }
            this.historyManager.saveState();
        });

        this.workspace.addEventListener('pointerenter', () => {
            if (!this.isSpacePressed) this.cursorManager.show();
            this.canvas.calcOffset();
        });

        this.workspace.addEventListener('pointerleave', () => {
            this.cursorManager.hide();
        });
    }

    setTool(tool) {
        this.currentTool = tool;
        if (tool === 'brush') {
            this.canvas.isDrawingMode = true;
            this.canvas.freeDrawingBrush.color = this.brushColor;
        } else if (tool === 'eraser') {
            this.canvas.isDrawingMode = true;
            this.canvas.freeDrawingBrush.color = 'rgba(0,0,0,1)';
        } else if (tool === 'pan') {
            this.canvas.isDrawingMode = false;
        }
    }

    setBrushColor(color) {
        this.brushColor = color;
        if (this.currentTool === 'brush') {
            this.canvas.freeDrawingBrush.color = color;
        }
    }

    setBrushSize(size) {
        this.brushSize = parseInt(size, 10);
        this.canvas.freeDrawingBrush.width = this.brushSize;
        this.cursorManager.updateSize(this.brushSize, this.zoom);
    }
}