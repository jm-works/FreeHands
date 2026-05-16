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

        this.isAltPressed = false;

        this.onBrushSizeChange = null;
        this.onSpaceToggle = null;

        this.init();

        this.layerCanvas = document.createElement('canvas');
        this.layerCtx = this.layerCanvas.getContext('2d');

        this.layerManager = new LayerManager(this);
        this.overrideRender();

        this.virtualX = window.innerWidth / 2;
        this.virtualY = window.innerHeight / 2;
        this.activeArrowKeys = new Set();
        this.keyboardDrawInterval = null;
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
            const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);

            if (isArrow && !isInput) {
                const isDrawingTool = this.currentTool === 'brush' || this.currentTool === 'pen' || this.currentTool === 'eraser';
                if (!isDrawingTool || !this.canvas.freeDrawingBrush) return;

                e.preventDefault();

                const wasEmpty = this.activeArrowKeys.size === 0;

                this.activeArrowKeys.add(e.key);

                if (wasEmpty) {
                    this.canvas.isDrawingMode = true;

                    const rect = this.board.getBoundingClientRect();

                    const pointer = {
                        x: (this.virtualX - rect.left) / this.zoom,
                        y: (this.virtualY - rect.top) / this.zoom
                    };

                    this.canvas.freeDrawingBrush.onMouseDown(pointer, {
                        e: {
                            pointerType: 'mouse',
                            pressure: 0.5
                        }
                    });

                    this.keyboardDrawInterval = setInterval(() => {
                        const step = this.isAltPressed ? 10 : 3;

                        if (this.activeArrowKeys.has('ArrowUp')) this.virtualY -= step;
                        if (this.activeArrowKeys.has('ArrowDown')) this.virtualY += step;
                        if (this.activeArrowKeys.has('ArrowLeft')) this.virtualX -= step;
                        if (this.activeArrowKeys.has('ArrowRight')) this.virtualX += step;

                        const rect = this.board.getBoundingClientRect();

                        const pointer = {
                            x: (this.virtualX - rect.left) / this.zoom,
                            y: (this.virtualY - rect.top) / this.zoom
                        };

                        this.canvas.freeDrawingBrush.onMouseMove(pointer, {
                            e: {
                                pointerType: 'mouse',
                                pressure: 0.5,
                                altKey: this.isAltPressed
                            }
                        });

                        this.cursorManager.updatePosition(this.virtualX, this.virtualY);
                        this.canvas.requestRenderAll();
                    }, 16);
                }

                return;
            }

            if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
                if (this.currentTool === 'select') {
                    const activeObjects = this.canvas.getActiveObjects();
                    if (activeObjects.length > 0) {
                        e.preventDefault();
                        activeObjects.forEach(obj => this.canvas.remove(obj));
                        this.canvas.discardActiveObject();
                        this.historyManager.saveState();
                    }
                }
            } else if (isCtrl && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) this.historyManager.redo();
                else this.historyManager.undo();
            } else if (isCtrl && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                this.historyManager.redo();
            } else if (e.key === 'Shift' && !this.isShiftPressed && !isInput) {
                this.isShiftPressed = true;
                this.canvas.isDrawingMode = false;
            } else if (e.key === 'Alt' && !isInput) {
                e.preventDefault();
                this.isAltPressed = true;
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
            const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);

            if (isArrow) {
                this.activeArrowKeys.delete(e.key);

                if (this.activeArrowKeys.size === 0 && this.keyboardDrawInterval) {
                    clearInterval(this.keyboardDrawInterval);
                    this.keyboardDrawInterval = null;

                    this.canvas.freeDrawingBrush.onMouseUp({
                        e: {
                            pointerType: 'mouse'
                        }
                    });
                }

                return;
            }

            if (e.key === 'Shift' && !isInput) {
                this.isShiftPressed = false;
                if (!this.isResizingBrush && !this.isSpacePressed && (this.currentTool === 'brush' || this.currentTool === 'pen' || this.currentTool === 'eraser')) {
                    this.canvas.isDrawingMode = true;
                }
            }

            if (e.key === 'Alt') {
                this.isAltPressed = false;
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

            this.virtualX = e.clientX;
            this.virtualY = e.clientY;

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
                if (this.currentTool === 'fill' || this.currentTool === 'pan' || this.currentTool === 'select') {
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

        this.canvas.on('object:modified', () => {
            this.historyManager.saveState();
        });

        this.workspace.addEventListener('pointerenter', () => {
            if (!this.isSpacePressed && !this.isResizingBrush && this.currentTool !== 'fill' && this.currentTool !== 'pan' && this.currentTool !== 'select') {
                this.cursorManager.show();
            }
            this.canvas.calcOffset();
        });

        this.workspace.addEventListener('pointerleave', () => {
            if (!this.isResizingBrush) this.cursorManager.hide();
        });
    }

    setTool(tool) {
        if (this.currentTool === 'select' && tool !== 'select') {
            this.canvas.selection = false;
            this.canvas.discardActiveObject();
            this.canvas.getObjects().forEach(obj => {
                obj.set({ selectable: false, evented: false });
            });
            this.canvas.requestRenderAll();
        }

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
        } else if (tool === 'select') {
            this.canvas.isDrawingMode = false;
            this.canvas.selection = true;
            this.canvas.defaultCursor = 'default';
            this.cursorManager.hide();

            this.canvas.getObjects().forEach(obj => {
                let canSelect = true;

                if (obj.type === 'rect' || obj.isEraser) canSelect = false;

                if (this.layerManager && canSelect) {
                    const layer = this.layerManager.layers.find(l => l.id === obj.layerId);
                    if (!layer || layer.locked || !layer.visible) canSelect = false;
                }

                obj.set({
                    selectable: canSelect,
                    evented: canSelect,
                    borderColor: '#c0392b',
                    cornerColor: '#c0392b',
                    cornerSize: 8,
                    transparentCorners: false
                });
            });
            this.canvas.requestRenderAll();
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

    resizeCanvas(width, height) {
        this.canvas.setWidth(width);
        this.canvas.setHeight(height);
        this.canvas.calcOffset();

        const bgRect = this.canvas.getObjects().find(obj => obj.isBg);
        if (bgRect) {
            bgRect.set({ width: width, height: height });
        }

        this.canvas.requestRenderAll();
        if (this.historyManager) {
            this.historyManager.saveState();
        }
    }
}