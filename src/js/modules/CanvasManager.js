import { CursorManager } from './CursorManager.js';
import { HistoryManager } from './HistoryManager.js';
import { FillManager } from './FillManager.js';
import { PressureBrush } from './PressureBrush.js';
import { EraserBrush } from './EraserBrush.js';
import { LayerManager } from './LayerManager.js';

fabric.Object.prototype.selectable = false;
fabric.Object.prototype.evented = false;

export class CanvasManager {
    constructor(canvasId) {
        this.canvas = new fabric.Canvas(canvasId, {
            isDrawingMode: true,
            width: 800,
            height: 600,
            selection: false
        });

        this.workspace = this.canvas.wrapperEl.parentElement;
        this.workspace.style.touchAction = 'none';
        this.canvas.upperCanvasEl.style.touchAction = 'none';
        this.canvas.lowerCanvasEl.style.touchAction = 'none';

        this.board = this.canvas.wrapperEl;

        this.zoom = 1;
        this.offsetX = 0;
        this.offsetY = 0;

        this.cursorManager = new CursorManager(this.workspace);
        this.historyManager = new HistoryManager(this);
        this.fillManager = new FillManager(this);

        this.brushColor = '#000000';
        this.brushSize = 5;
        this.fillTolerance = 32;
        this.brushOpacity = 1;

        this.currentTool = 'brush';
        this.canvas.freeDrawingBrush = new PressureBrush(this.canvas);
        this.canvas.freeDrawingBrush.color = this.getBrushColorAsRGBA();
        this.canvas.freeDrawingBrush.width = this.brushSize;

        this.canvas.freeDrawingCursor = 'none';

        this.isPanning = false;
        this.isSpacePressed = false;
        this.isShiftPressed = false;
        this.lastPosX = 0;
        this.lastPosY = 0;

        this.isResizingBrush = false;
        this.resizeStartPosX = 0;
        this.initialBrushSize = 0;

        this.onBrushSizeChange = null;
        this.onSpaceToggle = null;

        this.init();

        this.layerCanvas = document.createElement('canvas');
        this.layerCtx = this.layerCanvas.getContext('2d');

        this.layerManager = new LayerManager(this);
        this.overrideRender();
    }

    init() {
        setTimeout(() => this.canvas.calcOffset(), 100);
        window.addEventListener('resize', () => this.canvas.calcOffset());

        this.addEventListeners();
        this.cursorManager.updateSize(this.brushSize, this.zoom);
        this.cursorManager.updateSystemCursor(this.isSpacePressed, this.isPanning);
    }

    overrideRender() {
        this.canvas._renderObjects = (ctx, objects) => {
            if (!this.layerManager) {
                for (let i = 0, len = objects.length; i < len; ++i) {
                    objects[i].render(ctx);
                }
                return;
            }

            const layerObjects = {};
            for (let i = 0, len = objects.length; i < len; ++i) {
                const obj = objects[i];
                const layerId = obj.layerId;
                if (!layerId) continue;
                if (!layerObjects[layerId]) layerObjects[layerId] = [];
                layerObjects[layerId].push(obj);
            }

            const layersReversed = [...this.layerManager.layers].reverse();
            const v = this.canvas.viewportTransform;
            const retina = this.canvas.getRetinaScaling();

            this.layerCanvas.width = this.canvas.lowerCanvasEl.width;
            this.layerCanvas.height = this.canvas.lowerCanvasEl.height;

            for (let i = 0; i < layersReversed.length; i++) {
                const layer = layersReversed[i];
                if (!layer.visible) continue;

                const objs = layerObjects[layer.id];
                if (!objs || objs.length === 0) continue;

                this.layerCtx.clearRect(0, 0, this.layerCanvas.width, this.layerCanvas.height);
                this.layerCtx.save();
                this.layerCtx.scale(retina, retina);
                this.layerCtx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);

                for (let j = 0; j < objs.length; j++) {
                    objs[j].render(this.layerCtx);
                }
                this.layerCtx.restore();

                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.globalAlpha = layer.opacity / 100;
                ctx.globalCompositeOperation = layer.blendMode || 'source-over';
                ctx.drawImage(this.layerCanvas, 0, 0);
                ctx.restore();
            }
        };
    }

    updateTransform() {
        this.board.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.zoom})`;
        this.canvas.calcOffset();
    }

    addEventListeners() {
        window.addEventListener('keydown', (e) => {
            const isCtrl = e.ctrlKey || e.metaKey;
            const isInput = e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'textarea';

            if (isCtrl && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) this.historyManager.redo();
                else this.historyManager.undo();
            } else if (isCtrl && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                this.historyManager.redo();
            } else if (e.key === 'Shift' && !this.isShiftPressed && !isInput) {
                this.isShiftPressed = true;
                this.canvas.isDrawingMode = false;
            } else if (e.code === 'Space' && !isInput) {
                e.preventDefault();
                if (!this.isSpacePressed) {
                    this.isSpacePressed = true;
                    this.canvas.isDrawingMode = false;
                    this.cursorManager.updateSystemCursor(this.isSpacePressed, this.isPanning);
                    if (this.onSpaceToggle) this.onSpaceToggle(true);
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            const isInput = e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'textarea';

            if (e.key === 'Shift' && !isInput) {
                this.isShiftPressed = false;
                if (!this.isResizingBrush && !this.isSpacePressed && (this.currentTool === 'brush' || this.currentTool === 'pen' || this.currentTool === 'eraser')) {
                    this.canvas.isDrawingMode = true;
                }
            }

            if (e.code === 'Space' && !isInput) {
                e.preventDefault();
                this.isSpacePressed = false;
                if (!this.isShiftPressed && (this.currentTool === 'brush' || this.currentTool === 'pen' || this.currentTool === 'eraser')) {
                    this.canvas.isDrawingMode = true;
                }
                this.cursorManager.updateSystemCursor(this.isSpacePressed, this.isPanning);
                if (this.onSpaceToggle) this.onSpaceToggle(false);
            }
        });

        const interceptDrawing = (e) => {
            const activeLayer = this.layerManager ? this.layerManager.layers.find(l => l.id === this.layerManager.activeLayerId) : null;
            const layerPrevent = activeLayer && (activeLayer.locked || !activeLayer.visible);

            if (e.shiftKey || this.isShiftPressed || this.isResizingBrush) {
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }

            if (layerPrevent && !this.isSpacePressed && this.currentTool !== 'pan') {
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        };

        this.workspace.addEventListener('mousedown', interceptDrawing, { capture: true });
        this.workspace.addEventListener('touchstart', interceptDrawing, { capture: true, passive: false });

        this.workspace.addEventListener('pointerdown', (e) => {
            window.currentPointerPressure = e.pressure !== undefined ? e.pressure : 0.5;
            if (window.currentPointerPressure === 0 && e.pointerType === 'mouse') window.currentPointerPressure = 0.5;

            const activeLayer = this.layerManager ? this.layerManager.layers.find(l => l.id === this.layerManager.activeLayerId) : null;
            const layerPrevent = activeLayer && (activeLayer.locked || !activeLayer.visible);

            if (e.shiftKey || this.isShiftPressed) {
                e.preventDefault();
                e.stopImmediatePropagation();
                this.isResizingBrush = true;
                this.canvas.isDrawingMode = false;
                this.resizeStartPosX = e.clientX;
                this.initialBrushSize = this.brushSize;
                this.cursorManager.updateSystemCursor(false, false);
                return;
            }

            if (e.button === 1 || this.isSpacePressed || this.currentTool === 'pan') {
                e.preventDefault();
                e.stopPropagation();
                this.isPanning = true;
                this.canvas.isDrawingMode = false;
                this.lastPosX = e.clientX;
                this.lastPosY = e.clientY;
                this.cursorManager.updateSystemCursor(true, this.isPanning);
                return;
            }

            if (layerPrevent) {
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }

            if (this.currentTool === 'fill') {
                e.preventDefault();
                e.stopPropagation();
                const rect = this.board.getBoundingClientRect();
                const x = (e.clientX - rect.left) / this.zoom;
                const y = (e.clientY - rect.top) / this.zoom;
                this.fillManager.fill(x, y, this.brushColor, this.fillTolerance, this.brushOpacity);
                return;
            }
        }, { capture: true });

        window.addEventListener('pointermove', (e) => {
            window.currentPointerPressure = e.pressure !== undefined ? e.pressure : 0.5;
            if (window.currentPointerPressure === 0 && e.pointerType === 'mouse') window.currentPointerPressure = 0.5;

            if (this.isResizingBrush) {
                const deltaX = e.clientX - this.resizeStartPosX;
                let newSize = this.initialBrushSize + Math.round(deltaX * 0.5);

                if (newSize < 1) newSize = 1;
                if (newSize > 100) newSize = 100;

                this.setBrushSize(newSize);

                if (this.onBrushSizeChange) {
                    this.onBrushSizeChange(newSize);
                }
            } else if (this.isPanning) {
                this.offsetX += (e.clientX - this.lastPosX);
                this.offsetY += (e.clientY - this.lastPosY);
                this.lastPosX = e.clientX;
                this.lastPosY = e.clientY;
                this.updateTransform();
            } else if (!this.isSpacePressed && !e.shiftKey && !this.isShiftPressed) {
                if (this.currentTool === 'fill' || this.currentTool === 'pan') {
                    this.cursorManager.hide();
                } else {
                    this.cursorManager.updatePosition(e.clientX, e.clientY);
                    if (e.target.closest('.workspace-area') && !this.cursorManager.isVisible) {
                        this.cursorManager.show();
                    }
                }
            }
        });

        window.addEventListener('pointerup', (e) => {
            if (this.isResizingBrush) {
                this.isResizingBrush = false;
                this.cursorManager.updatePosition(e.clientX, e.clientY);
                if (!this.isShiftPressed && !this.isSpacePressed && (this.currentTool === 'brush' || this.currentTool === 'eraser')) {
                    this.canvas.isDrawingMode = true;
                }
            }

            if (this.isPanning) {
                this.isPanning = false;
                if (!this.isShiftPressed && !this.isSpacePressed && (this.currentTool === 'brush' || this.currentTool === 'eraser')) {
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

        this.canvas.on('path:created', () => {
            this.historyManager.saveState();
        });

        this.workspace.addEventListener('pointerenter', () => {
            if (!this.isSpacePressed && !this.isResizingBrush && this.currentTool !== 'fill' && this.currentTool !== 'pan') {
                this.cursorManager.show();
            }
            this.canvas.calcOffset();
        });

        this.workspace.addEventListener('pointerleave', () => {
            if (!this.isResizingBrush) this.cursorManager.hide();
        });
    }

    setTool(tool) {
        this.currentTool = tool;
        if (tool === 'brush') {
            this.canvas.isDrawingMode = true;
            this.canvas.freeDrawingBrush = new PressureBrush(this.canvas);
            this.canvas.freeDrawingBrush.color = this.getBrushColorAsRGBA();
            this.canvas.freeDrawingBrush.width = this.brushSize;
            this.canvas.defaultCursor = 'none';
        } else if (tool === 'pen') {
            this.canvas.isDrawingMode = true;
            this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
            this.canvas.freeDrawingBrush.color = this.getBrushColorAsRGBA();
            this.canvas.freeDrawingBrush.width = this.brushSize;
            this.canvas.freeDrawingBrush.decimate = 1.5;
            this.canvas.defaultCursor = 'none';
        } else if (tool === 'eraser') {
            this.canvas.isDrawingMode = true;
            this.canvas.freeDrawingBrush = new EraserBrush(this.canvas);
            this.canvas.freeDrawingBrush.width = this.brushSize;
            this.canvas.defaultCursor = 'none';
        } else if (tool === 'fill') {
            this.canvas.isDrawingMode = false;
            this.canvas.defaultCursor = 'crosshair';
            this.cursorManager.hide();
        } else if (tool === 'pan') {
            this.canvas.isDrawingMode = false;
            this.canvas.defaultCursor = 'grab';
            this.cursorManager.hide();
        }
    }

    setBrushColor(color) {
        this.brushColor = color;
        if ((this.currentTool === 'brush' || this.currentTool === 'pen') && this.canvas.freeDrawingBrush) {
            this.canvas.freeDrawingBrush.color = this.getBrushColorAsRGBA();
        }
    }

    setBrushSize(size) {
        this.brushSize = parseInt(size, 10);
        if (this.canvas.freeDrawingBrush) {
            this.canvas.freeDrawingBrush.width = this.brushSize;
        }
        this.cursorManager.updateSize(this.brushSize, this.zoom);
    }

    setFillTolerance(val) {
        this.fillTolerance = parseInt(val, 10);
    }

    getBrushColorAsRGBA() {
        const hex = this.brushColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${this.brushOpacity})`;
    }

    setBrushOpacity(opacity) {
        this.brushOpacity = opacity / 100;
        if ((this.currentTool === 'brush' || this.currentTool === 'pen') && this.canvas.freeDrawingBrush) {
            this.canvas.freeDrawingBrush.color = this.getBrushColorAsRGBA();
        }
    }
}