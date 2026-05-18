import { CursorManager } from './CursorManager.js';
import { HistoryManager } from './HistoryManager.js';
import { FillManager } from './FillManager.js';
import { PressureBrush } from './PressureBrush.js';
import { EraserBrush } from './EraserBrush.js';
import { LayerManager } from './LayerManager.js';
import { CutAreaManager } from './CutAreaManager.js';

fabric.Object.prototype.selectable = false;
fabric.Object.prototype.evented = false;

export class CanvasManager {
    constructor(canvasId) {
        this.canvas = new fabric.Canvas(canvasId, {
            isDrawingMode: true,
            width: 800,
            height: 600,
            selection: false,
            selectionColor: 'rgba(192, 57, 43, 0.15)',
            selectionBorderColor: '#c0392b',
            selectionLineWidth: 1.5,
            selectionDashArray: [5, 5]
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
        this.cutAreaManager = new CutAreaManager(this);

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

        fabric.ActiveSelection.prototype.borderColor = '#c0392b';
        fabric.ActiveSelection.prototype.cornerColor = '#c0392b';
        fabric.ActiveSelection.prototype.cornerSize = 8;
        fabric.ActiveSelection.prototype.transparentCorners = false;
        fabric.ActiveSelection.prototype.selectable = true;
        fabric.ActiveSelection.prototype.evented = true;

        this.init();

        this.layerCanvas = document.createElement('canvas');
        this.layerCtx = this.layerCanvas.getContext('2d');

        this.layerManager = new LayerManager(this);
        this.canvas.layerManager = this.layerManager;
        this.canvas.historyManager = this.historyManager;
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
            const topLevelObjects = [];

            for (let i = 0, len = objects.length; i < len; ++i) {
                const obj = objects[i];
                const layerId = obj.layerId;

                if (!layerId) {
                    topLevelObjects.push(obj);
                    continue;
                }

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

            for (let i = 0; i < topLevelObjects.length; i++) {
                topLevelObjects[i].render(ctx);
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
                } else if (this.currentTool === 'cutarea') {
                    e.preventDefault();
                    this.cutAreaManager.deleteSelection();
                }
            } else if (isCtrl && e.key.toLowerCase() === 'c' && !isInput) {
                if (this.currentTool === 'cutarea') {
                    e.preventDefault();
                    this.cutAreaManager.copy();
                }
            } else if (isCtrl && e.key.toLowerCase() === 'x' && !isInput) {
                if (this.currentTool === 'cutarea') {
                    e.preventDefault();
                    this.cutAreaManager.cut();
                }
            } else if (isCtrl && e.key.toLowerCase() === 'v' && !isInput) {
                if (this.cutAreaManager.clipboardDataURL) {
                    e.preventDefault();
                    this.cutAreaManager.paste();
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
                if (this.currentTool !== 'select') {
                    this.canvas.isDrawingMode = false;
                }
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

            if ((e.shiftKey || this.isShiftPressed || this.isResizingBrush) && this.currentTool !== 'select') {
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
                if (this.currentTool !== 'select') {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    this.isResizingBrush = true;
                    this.canvas.isDrawingMode = false;
                    this.resizeStartPosX = e.clientX;
                    this.initialBrushSize = this.brushSize;
                    this.cursorManager.updateSystemCursor(false, false);
                    return;
                }
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

            if (this.currentTool === 'cutarea') {
                e.preventDefault();
                e.stopPropagation();
                const rect = this.board.getBoundingClientRect();
                const x = (e.clientX - rect.left) / this.zoom;
                const y = (e.clientY - rect.top) / this.zoom;
                this.cutAreaManager.onMouseDown(x, y);
                return;
            }

            if (this.currentTool === 'fill') {
                e.preventDefault();
                e.stopPropagation();
                const rect = this.board.getBoundingClientRect();
                const x = (e.clientX - rect.left) / this.zoom;
                const y = (e.clientY - rect.top) / this.zoom;
                const sel = this.cutAreaManager.selectionRect;
                const clipBounds = (sel && sel.width > 0 && sel.height > 0)
                    ? { left: sel.left, top: sel.top, width: sel.width, height: sel.height }
                    : null;
                this.fillManager.fill(x, y, this.brushColor, this.fillTolerance, this.brushOpacity, clipBounds,
                    clipBounds ? () => this.cutAreaManager.clearSelection() : null);
                return;
            }
        }, { capture: true });

        window.addEventListener('pointermove', (e) => {
            window.currentPointerPressure = e.pressure !== undefined ? e.pressure : 0.5;
            if (window.currentPointerPressure === 0 && e.pointerType === 'mouse') window.currentPointerPressure = 0.5;

            this.virtualX = e.clientX;
            this.virtualY = e.clientY;

            if (this.currentTool === 'cutarea') {
                const rect = this.board.getBoundingClientRect();
                const x = (e.clientX - rect.left) / this.zoom;
                const y = (e.clientY - rect.top) / this.zoom;
                this.cutAreaManager.onMouseMove(x, y);
            }

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
                if (this.currentTool === 'fill' || this.currentTool === 'pan' || this.currentTool === 'select' || this.currentTool === 'cutarea') {
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
            if (this.currentTool === 'cutarea') {
                this.cutAreaManager.onMouseUp();
            }

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

        this.canvas.on('path:created', (e) => {
            if (e.path && this.layerManager) {
                e.path.layerId = this.layerManager.activeLayerId;
            }
            this.historyManager.saveState();
        });

        this.canvas.on('object:modified', () => {
            this.historyManager.saveState();
        });

        this.workspace.addEventListener('pointerenter', () => {
            if (!this.isSpacePressed && !this.isResizingBrush && this.currentTool !== 'fill' && this.currentTool !== 'pan' && this.currentTool !== 'select' && this.currentTool !== 'cutarea') {
                this.cursorManager.show();
            }
            this.canvas.calcOffset();
        });

        this.workspace.addEventListener('pointerleave', () => {
            if (!this.isResizingBrush) this.cursorManager.hide();
        });
    }

    setTool(tool) {
        if ((this.currentTool === 'cutarea' && tool !== 'cutarea' && tool !== 'fill') ||
            (this.currentTool === 'fill' && tool !== 'fill' && tool !== 'cutarea')) {
            this.cutAreaManager.clearSelection();
        }

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
        } else if (tool === 'cutarea') {
            this.canvas.isDrawingMode = false;
            this.canvas.defaultCursor = 'crosshair';
            this.cursorManager.hide();
            this.canvas.selection = false;
            this.canvas.getObjects().forEach(obj => {
                obj.set({ selectable: false, evented: false });
            });
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

                if (obj.type === 'rect' || obj.isEraser || obj.isSelectionRect) canSelect = false;

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
            this.canvas.sendToBack(bgRect);
        }

        this.canvas.requestRenderAll();
        if (this.historyManager) {
            this.historyManager.saveState();
        }
    }

    placeImage(dataURL) {
        const img = new Image();
        img.onload = () => {
            const canvasW = this.canvas.width;
            const canvasH = this.canvas.height;

            let scale = 1;
            if (img.width > canvasW || img.height > canvasH) {
                scale = Math.min(canvasW / img.width, canvasH / img.height) * 0.8;
            }

            const scaledW = img.width * scale;
            const scaledH = img.height * scale;

            this.layerManager.addLayer('Placed Image');
            const layerId = this.layerManager.activeLayerId;

            const fabricImg = new fabric.Image(img, {
                left: (canvasW - scaledW) / 2,
                top: (canvasH - scaledH) / 2,
                scaleX: scale,
                scaleY: scale,
                layerId: layerId,
                selectable: true,
                evented: true,
                hasControls: true,
                hasBorders: true,
                lockUniScaling: false
            });

            fabricImg.setControlsVisibility({
                mt: true,
                mb: true,
                ml: true,
                mr: true,
                tl: true,
                tr: true,
                bl: true,
                br: true,
                mtr: true
            });

            const prevTool = this.currentTool;
            this.canvas.isDrawingMode = false;
            this.canvas.selection = false;
            this.canvas.add(fabricImg);
            this.canvas.setActiveObject(fabricImg);
            this.canvas.requestRenderAll();

            const confirmPlacement = () => {
                fabricImg.set({ selectable: false, evented: false });
                fabricImg.setCoords();
                this.canvas.discardActiveObject();
                this.canvas.isDrawingMode = prevTool !== 'pan' && prevTool !== 'fill' && prevTool !== 'cutarea' && prevTool !== 'select';
                this.canvas.selection = false;
                this.canvas.requestRenderAll();
                this.historyManager.saveState();

                this.canvas.off('mouse:dblclick', confirmPlacement);
                document.removeEventListener('keydown', onKey, true);
                overlayBanner.remove();
            };

            const onKey = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    confirmPlacement();
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.canvas.remove(fabricImg);
                    this.layerManager.deleteLayer(layerId);
                    this.canvas.isDrawingMode = prevTool !== 'pan' && prevTool !== 'fill' && prevTool !== 'cutarea' && prevTool !== 'select';
                    this.canvas.discardActiveObject();
                    this.canvas.requestRenderAll();
                    this.canvas.off('mouse:dblclick', confirmPlacement);
                    document.removeEventListener('keydown', onKey, true);
                    overlayBanner.remove();
                }
            };

            this.canvas.on('mouse:dblclick', confirmPlacement);
            document.addEventListener('keydown', onKey, true);

            const overlayBanner = document.createElement('div');
            overlayBanner.style.cssText = `
                position: fixed;
                bottom: calc(var(--statusbar-height) + 10px);
                left: 50%;
                transform: translateX(-50%);
                background: var(--ink-dark);
                border: 1px solid var(--accent-color);
                color: var(--text-primary);
                font-family: var(--font-ui);
                font-size: 0.72rem;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                padding: 7px 18px;
                z-index: 9998;
                pointer-events: none;
                box-shadow: 0 4px 16px rgba(0,0,0,0.7);
                white-space: nowrap;
            `;
            overlayBanner.textContent = 'Transform — Press Enter to confirm · Esc to cancel · Double-click to confirm';
            document.body.appendChild(overlayBanner);
        };
        img.src = dataURL;
    }

    setPaperTexture(textureId) {
        const width = this.canvas.width;
        const height = this.canvas.height;

        const offscreen = document.createElement('canvas');
        offscreen.width = width;
        offscreen.height = height;
        const ctx = offscreen.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        const textures = {
            none: () => { },
            grain: () => {
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const noise = (Math.random() - 0.5) * 30;
                    data[i] = Math.min(255, Math.max(0, data[i] + noise));
                    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
                    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
                }
                ctx.putImageData(imageData, 0, 0);
            },
            watercolor: () => {
                for (let i = 0; i < 2000; i++) {
                    const x = Math.random() * width;
                    const y = Math.random() * height;
                    const r = Math.random() * 40 + 10;
                    const alpha = Math.random() * 0.03 + 0.005;
                    const hue = Math.random() * 30 + 190;
                    ctx.beginPath();
                    ctx.arc(x, y, r, 0, Math.PI * 2);
                    ctx.fillStyle = `hsla(${hue}, 40%, 80%, ${alpha})`;
                    ctx.fill();
                }
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const noise = (Math.random() - 0.5) * 8;
                    data[i] = Math.min(255, Math.max(0, data[i] + noise));
                    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
                    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
                }
                ctx.putImageData(imageData, 0, 0);
            },
            canvas_fabric: () => {
                const cellSize = 6;
                for (let y = 0; y < height; y += cellSize) {
                    for (let x = 0; x < width; x += cellSize) {
                        const shade = 230 + Math.floor(Math.random() * 20);
                        ctx.fillStyle = `rgb(${shade},${shade - 2},${shade - 5})`;
                        ctx.fillRect(x, y, cellSize, cellSize);
                    }
                }
                ctx.strokeStyle = 'rgba(180,170,160,0.25)';
                ctx.lineWidth = 0.5;
                for (let y = 0; y <= height; y += cellSize) {
                    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
                }
                for (let x = 0; x <= width; x += cellSize) {
                    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
                }
            },
            parchment: () => {
                const grad = ctx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.7);
                grad.addColorStop(0, '#f5ead0');
                grad.addColorStop(0.6, '#ecdbb8');
                grad.addColorStop(1, '#d4b98a');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, width, height);
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const noise = (Math.random() - 0.5) * 18;
                    data[i] = Math.min(255, Math.max(0, data[i] + noise));
                    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise * 0.9));
                    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise * 0.5));
                }
                ctx.putImageData(imageData, 0, 0);
            },
            kraft: () => {
                ctx.fillStyle = '#c1925a';
                ctx.fillRect(0, 0, width, height);
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const noise = (Math.random() - 0.5) * 35;
                    data[i] = Math.min(255, Math.max(0, data[i] + noise));
                    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise * 0.7));
                    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise * 0.3));
                }
                ctx.putImageData(imageData, 0, 0);
                for (let i = 0; i < 400; i++) {
                    ctx.strokeStyle = `rgba(100,60,20,${Math.random() * 0.07})`;
                    ctx.lineWidth = Math.random() * 1.5;
                    ctx.beginPath();
                    const x1 = Math.random() * width;
                    ctx.moveTo(x1, 0);
                    ctx.lineTo(x1 + (Math.random() - 0.5) * 20, height);
                    ctx.stroke();
                }
            },
            grid: () => {
                const step = 30;
                ctx.strokeStyle = 'rgba(180,200,220,0.7)';
                ctx.lineWidth = 0.5;
                for (let y = 0; y <= height; y += step) {
                    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
                }
                for (let x = 0; x <= width; x += step) {
                    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
                }
            },
            dots: () => {
                const step = 24;
                ctx.fillStyle = 'rgba(150,170,200,0.6)';
                for (let y = step; y < height; y += step) {
                    for (let x = step; x < width; x += step) {
                        ctx.beginPath();
                        ctx.arc(x, y, 0.8, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        };

        const fn = textures[textureId];
        if (!fn) return;
        fn();

        const dataURL = offscreen.toDataURL('image/png');

        const existingBg = this.canvas.getObjects().find(obj => obj.isBg);
        const bgLayerId = existingBg
            ? existingBg.layerId
            : (this.layerManager ? this.layerManager.layers[this.layerManager.layers.length - 1].id : null);

        if (existingBg) {
            this.canvas.remove(existingBg);
        }

        fabric.Image.fromURL(dataURL, (img) => {
            img.set({
                left: 0,
                top: 0,
                selectable: false,
                evented: false,
                layerId: bgLayerId,
                isBg: true
            });

            const objects = this.canvas.getObjects();
            this.canvas.add(img);
            if (objects.length > 0) {
                this.canvas.sendToBack(img);
            }
            this.canvas.requestRenderAll();
            if (this.historyManager) {
                this.historyManager.saveState();
            }
        });
    }
}