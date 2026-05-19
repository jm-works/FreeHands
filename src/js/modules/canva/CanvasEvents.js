export class CanvasEvents {
    constructor(cm) {
        this.cm = cm;
    }

    addEventListeners() {
        window.addEventListener('keydown', (e) => {
            const isCtrl = e.ctrlKey || e.metaKey;
            const isInput = e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'textarea';
            const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);

            if (isArrow && !isInput) {
                const isDrawingTool = this.cm.currentTool === 'brush' || this.cm.currentTool === 'pen' || this.cm.currentTool === 'eraser';
                if (!isDrawingTool || !this.cm.canvas.freeDrawingBrush) return;

                e.preventDefault();

                const wasEmpty = this.cm.activeArrowKeys.size === 0;

                this.cm.activeArrowKeys.add(e.key);

                if (wasEmpty) {
                    this.cm.canvas.isDrawingMode = true;

                    const rect = this.cm.board.getBoundingClientRect();

                    const pointer = {
                        x: (this.cm.virtualX - rect.left) / this.cm.zoom,
                        y: (this.cm.virtualY - rect.top) / this.cm.zoom
                    };

                    this.cm.canvas.freeDrawingBrush.onMouseDown(pointer, {
                        e: {
                            pointerType: 'mouse',
                            pressure: 0.5
                        }
                    });

                    this.cm.keyboardDrawInterval = setInterval(() => {
                        const step = this.cm.isAltPressed ? 10 : 3;

                        if (this.cm.activeArrowKeys.has('ArrowUp')) this.cm.virtualY -= step;
                        if (this.cm.activeArrowKeys.has('ArrowDown')) this.cm.virtualY += step;
                        if (this.cm.activeArrowKeys.has('ArrowLeft')) this.cm.virtualX -= step;
                        if (this.cm.activeArrowKeys.has('ArrowRight')) this.cm.virtualX += step;

                        const rect = this.cm.board.getBoundingClientRect();

                        const pointer = {
                            x: (this.cm.virtualX - rect.left) / this.cm.zoom,
                            y: (this.cm.virtualY - rect.top) / this.cm.zoom
                        };

                        this.cm.canvas.freeDrawingBrush.onMouseMove(pointer, {
                            e: {
                                pointerType: 'mouse',
                                pressure: 0.5,
                                altKey: this.cm.isAltPressed
                            }
                        });

                        this.cm.cursorManager.updatePosition(this.cm.virtualX, this.cm.virtualY);
                        this.cm.canvas.requestRenderAll();
                    }, 16);
                }

                return;
            }

            if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
                if (this.cm.currentTool === 'select') {
                    const activeObjects = this.cm.canvas.getActiveObjects();
                    if (activeObjects.length > 0) {
                        e.preventDefault();
                        activeObjects.forEach(obj => this.cm.canvas.remove(obj));
                        this.cm.canvas.discardActiveObject();
                        this.cm.historyManager.saveState();
                    }
                } else if (this.cm.currentTool === 'cutarea') {
                    e.preventDefault();
                    this.cm.cutAreaManager.deleteSelection();
                }
            } else if (isCtrl && e.key.toLowerCase() === 'c' && !isInput) {
                if (this.cm.currentTool === 'cutarea') {
                    e.preventDefault();
                    this.cm.cutAreaManager.copy();
                }
            } else if (isCtrl && e.key.toLowerCase() === 'x' && !isInput) {
                if (this.cm.currentTool === 'cutarea') {
                    e.preventDefault();
                    this.cm.cutAreaManager.cut();
                }
            } else if (isCtrl && e.key.toLowerCase() === 'v' && !isInput) {
                if (this.cm.cutAreaManager.clipboardDataURL) {
                    e.preventDefault();
                    this.cm.cutAreaManager.paste();
                }
            } else if (isCtrl && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) this.cm.historyManager.redo();
                else this.cm.historyManager.undo();
            } else if (isCtrl && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                this.cm.historyManager.redo();
            } else if (e.key === 'Shift' && !this.cm.isShiftPressed && !isInput) {
                this.cm.isShiftPressed = true;
                if (this.cm.currentTool !== 'select') {
                    this.cm.canvas.isDrawingMode = false;
                }
            } else if (e.key === 'Alt' && !isInput) {
                e.preventDefault();
                this.cm.isAltPressed = true;
            } else if (e.code === 'Space' && !isInput) {
                e.preventDefault();
                if (!this.cm.isSpacePressed) {
                    this.cm.isSpacePressed = true;
                    this.cm.canvas.isDrawingMode = false;
                    this.cm.cursorManager.updateSystemCursor(this.cm.isSpacePressed, this.cm.isPanning);
                    if (this.cm.onSpaceToggle) this.cm.onSpaceToggle(true);
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            const isInput = e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'textarea';
            const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);

            if (isArrow) {
                this.cm.activeArrowKeys.delete(e.key);

                if (this.cm.activeArrowKeys.size === 0 && this.cm.keyboardDrawInterval) {
                    clearInterval(this.cm.keyboardDrawInterval);
                    this.cm.keyboardDrawInterval = null;

                    if (this.cm.canvas.freeDrawingBrush) {
                        this.cm.canvas.freeDrawingBrush.onMouseUp({
                            e: {
                                pointerType: 'mouse'
                            }
                        });
                    }
                }

                return;
            }

            if (e.key === 'Shift' && !isInput) {
                this.cm.isShiftPressed = false;
                if (!this.cm.isResizingBrush && !this.cm.isSpacePressed && (this.cm.currentTool === 'brush' || this.cm.currentTool === 'pen' || this.cm.currentTool === 'eraser')) {
                    this.cm.canvas.isDrawingMode = true;
                }
            }

            if (e.key === 'Alt') {
                this.cm.isAltPressed = false;
            }

            if (e.code === 'Space' && !isInput) {
                e.preventDefault();
                this.cm.isSpacePressed = false;
                if (!this.cm.isShiftPressed && (this.cm.currentTool === 'brush' || this.cm.currentTool === 'pen' || this.cm.currentTool === 'eraser')) {
                    this.cm.canvas.isDrawingMode = true;
                }
                this.cm.cursorManager.updateSystemCursor(this.cm.isSpacePressed, this.cm.isPanning);
                if (this.cm.onSpaceToggle) this.cm.onSpaceToggle(false);
            }
        });

        const interceptDrawing = (e) => {
            const activeLayer = this.cm.layerManager ? this.cm.layerManager.layers.find(l => l.id === this.cm.layerManager.activeLayerId) : null;
            const layerPrevent = activeLayer && (activeLayer.locked || !activeLayer.visible);

            if ((e.shiftKey || this.cm.isShiftPressed || this.cm.isResizingBrush) && this.cm.currentTool !== 'select') {
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }

            if (layerPrevent && !this.cm.isSpacePressed && this.cm.currentTool !== 'pan') {
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        };

        this.cm.workspace.addEventListener('mousedown', interceptDrawing, { capture: true });
        this.cm.workspace.addEventListener('touchstart', interceptDrawing, { capture: true, passive: false });

        this.cm.workspace.addEventListener('pointerdown', (e) => {
            if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                document.activeElement.blur();
            }

            window.currentPointerPressure = e.pressure !== undefined ? e.pressure : 0.5;
            if (window.currentPointerPressure === 0 && e.pointerType === 'mouse') window.currentPointerPressure = 0.5;

            const activeLayer = this.cm.layerManager ? this.cm.layerManager.layers.find(l => l.id === this.cm.layerManager.activeLayerId) : null;
            const layerPrevent = activeLayer && (activeLayer.locked || !activeLayer.visible);

            if (e.shiftKey || this.cm.isShiftPressed) {
                if (this.cm.currentTool !== 'select') {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    this.cm.isResizingBrush = true;
                    this.cm.canvas.isDrawingMode = false;
                    this.cm.resizeStartPosX = e.clientX;
                    this.cm.initialBrushSize = this.cm.brushSize;
                    this.cm.cursorManager.updateSystemCursor(false, false);
                    return;
                }
            }

            if (e.button === 1 || this.cm.isSpacePressed || this.cm.currentTool === 'pan') {
                e.preventDefault();
                e.stopPropagation();
                this.cm.isPanning = true;
                this.cm.canvas.isDrawingMode = false;
                this.cm.lastPosX = e.clientX;
                this.cm.lastPosY = e.clientY;
                this.cm.cursorManager.updateSystemCursor(true, this.cm.isPanning);
                return;
            }

            if (layerPrevent) {
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }

            if (this.cm.currentTool === 'cutarea') {
                e.preventDefault();
                e.stopPropagation();
                const rect = this.cm.board.getBoundingClientRect();
                const x = (e.clientX - rect.left) / this.cm.zoom;
                const y = (e.clientY - rect.top) / this.cm.zoom;
                this.cm.cutAreaManager.onMouseDown(x, y);
                return;
            }

            if (this.cm.currentTool === 'rectangle') {
                e.preventDefault();
                e.stopPropagation();
                const rect = this.cm.board.getBoundingClientRect();
                const x = (e.clientX - rect.left) / this.cm.zoom;
                const y = (e.clientY - rect.top) / this.cm.zoom;
                this.cm.rectangleManager.onMouseDown(x, y);
                return;
            }

            if (this.cm.currentTool === 'ellipse') {
                e.preventDefault();
                e.stopPropagation();
                const rect = this.cm.board.getBoundingClientRect();
                const x = (e.clientX - rect.left) / this.cm.zoom;
                const y = (e.clientY - rect.top) / this.cm.zoom;
                this.cm.ellipseManager.onMouseDown(x, y);
                return;
            }

            if (this.cm.currentTool === 'line') {
                e.preventDefault();
                e.stopPropagation();
                const rect = this.cm.board.getBoundingClientRect();
                const x = (e.clientX - rect.left) / this.cm.zoom;
                const y = (e.clientY - rect.top) / this.cm.zoom;
                this.cm.lineManager.onMouseDown(x, y);
                return;
            }

            if (this.cm.currentTool === 'fill') {
                e.preventDefault();
                e.stopPropagation();
                const rect = this.cm.board.getBoundingClientRect();
                const x = (e.clientX - rect.left) / this.cm.zoom;
                const y = (e.clientY - rect.top) / this.cm.zoom;
                const sel = this.cm.cutAreaManager.selectionRect;
                const clipBounds = (sel && sel.width > 0 && sel.height > 0)
                    ? { left: sel.left, top: sel.top, width: sel.width, height: sel.height }
                    : null;
                this.cm.fillManager.fill(x, y, this.cm.brushColor, this.cm.fillTolerance, this.cm.brushOpacity, clipBounds,
                    clipBounds ? () => this.cm.cutAreaManager.clearSelection() : null);
                return;
            }
        }, { capture: true });

        window.addEventListener('pointermove', (e) => {
            window.currentPointerPressure = e.pressure !== undefined ? e.pressure : 0.5;
            if (window.currentPointerPressure === 0 && e.pointerType === 'mouse') window.currentPointerPressure = 0.5;

            this.cm.virtualX = e.clientX;
            this.cm.virtualY = e.clientY;

            if (this.cm.currentTool === 'cutarea') {
                const rect = this.cm.board.getBoundingClientRect();
                const x = (e.clientX - rect.left) / this.cm.zoom;
                const y = (e.clientY - rect.top) / this.cm.zoom;
                this.cm.cutAreaManager.onMouseMove(x, y);
            }

            if (this.cm.currentTool === 'rectangle') {
                const rect = this.cm.board.getBoundingClientRect();
                const x = (e.clientX - rect.left) / this.cm.zoom;
                const y = (e.clientY - rect.top) / this.cm.zoom;
                this.cm.rectangleManager.onMouseMove(x, y, e.shiftKey || this.cm.isShiftPressed);
            }

            if (this.cm.currentTool === 'line') {
                const rect = this.cm.board.getBoundingClientRect();
                const x = (e.clientX - rect.left) / this.cm.zoom;
                const y = (e.clientY - rect.top) / this.cm.zoom;
                this.cm.lineManager.onMouseMove(x, y, e.shiftKey || this.cm.isShiftPressed);
            }

            if (this.cm.currentTool === 'ellipse') {
                const rect = this.cm.board.getBoundingClientRect();
                const x = (e.clientX - rect.left) / this.cm.zoom;
                const y = (e.clientY - rect.top) / this.cm.zoom;
                this.cm.ellipseManager.onMouseMove(x, y, e.shiftKey || this.cm.isShiftPressed);
            }

            if (this.cm.isResizingBrush) {
                const deltaX = e.clientX - this.cm.resizeStartPosX;
                let newSize = this.cm.initialBrushSize + Math.round(deltaX * 0.5);

                if (newSize < 1) newSize = 1;
                if (newSize > 100) newSize = 100;

                this.cm.setBrushSize(newSize);

                if (this.cm.onBrushSizeChange) {
                    this.cm.onBrushSizeChange(newSize);
                }
            } else if (this.cm.isPanning) {
                this.cm.offsetX += (e.clientX - this.cm.lastPosX);
                this.cm.offsetY += (e.clientY - this.cm.lastPosY);
                this.cm.lastPosX = e.clientX;
                this.cm.lastPosY = e.clientY;
                this.cm.updateTransform();
            } else if (!this.cm.isSpacePressed && !e.shiftKey && !this.cm.isShiftPressed) {
                if (this.cm.currentTool === 'fill' || this.cm.currentTool === 'pan' || this.cm.currentTool === 'select' || this.cm.currentTool === 'cutarea' || this.cm.currentTool === 'rectangle' || this.cm.currentTool === 'ellipse' || this.cm.currentTool === 'line') {
                    this.cm.cursorManager.hide();
                } else {
                    this.cm.cursorManager.updatePosition(e.clientX, e.clientY);
                    if (e.target.closest('.workspace-area') && !this.cm.cursorManager.isVisible) {
                        this.cm.cursorManager.show();
                    }
                }
            }
        });

        window.addEventListener('pointerup', (e) => {
            if (this.cm.currentTool === 'cutarea') {
                this.cm.cutAreaManager.onMouseUp();
            }

            if (this.cm.currentTool === 'rectangle') {
                this.cm.rectangleManager.onMouseUp();
            }

            if (this.cm.currentTool === 'line') {
                this.cm.lineManager.onMouseUp();
            }

            if (this.cm.currentTool === 'ellipse') {
                this.cm.ellipseManager.onMouseUp();
            }

            if (this.cm.isResizingBrush) {
                this.cm.isResizingBrush = false;
                this.cm.cursorManager.updatePosition(e.clientX, e.clientY);
                if (!this.cm.isShiftPressed && !this.cm.isSpacePressed && (this.cm.currentTool === 'brush' || this.cm.currentTool === 'pen' || this.cm.currentTool === 'eraser')) {
                    this.cm.canvas.isDrawingMode = true;
                }
            }

            if (this.cm.isPanning) {
                this.cm.isPanning = false;
                if (!this.cm.isShiftPressed && !this.cm.isSpacePressed && (this.cm.currentTool === 'brush' || this.cm.currentTool === 'pen' || this.cm.currentTool === 'eraser')) {
                    this.cm.canvas.isDrawingMode = true;
                }
                this.cm.cursorManager.updateSystemCursor(this.cm.isSpacePressed, this.cm.isPanning);
            }
        });

        this.cm.workspace.addEventListener('wheel', (e) => {
            e.preventDefault();

            const delta = e.deltaY;
            let newZoom = this.cm.zoom * (0.999 ** delta);
            if (newZoom > 10) newZoom = 10;
            if (newZoom < 0.1) newZoom = 0.1;

            const scaleRatio = newZoom / this.cm.zoom;
            this.cm.zoom = newZoom;

            const rect = this.cm.workspace.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const mouseX = e.clientX - centerX;
            const mouseY = e.clientY - centerY;

            this.cm.offsetX = mouseX - (mouseX - this.cm.offsetX) * scaleRatio;
            this.cm.offsetY = mouseY - (mouseY - this.cm.offsetY) * scaleRatio;

            this.cm.updateTransform();
            this.cm.cursorManager.updateSize(this.cm.brushSize, this.cm.zoom);

            const zoomDisplay = document.getElementById('zoom-val-display');
            if (zoomDisplay) zoomDisplay.textContent = `Zoom: ${Math.round(this.cm.zoom * 100)}%`;
        }, { passive: false });

        this.cm.canvas.on('path:created', (e) => {
            if (e.path && this.cm.layerManager) {
                e.path.layerId = this.cm.layerManager.activeLayerId;
            }
            this.cm.historyManager.saveState();
        });

        this.cm.canvas.on('object:modified', () => {
            this.cm.historyManager.saveState();
        });

        this.cm.workspace.addEventListener('pointerenter', () => {
            if (!this.cm.isSpacePressed && !this.cm.isResizingBrush && this.cm.currentTool !== 'fill' && this.cm.currentTool !== 'pan' && this.cm.currentTool !== 'select' && this.cm.currentTool !== 'cutarea' && this.cm.currentTool !== 'rectangle' && this.cm.currentTool !== 'ellipse' && this.cm.currentTool !== 'line') {
                this.cm.cursorManager.show();
            }
            this.cm.canvas.calcOffset();
        });

        this.cm.workspace.addEventListener('pointerleave', () => {
            if (!this.cm.isResizingBrush) this.cm.cursorManager.hide();
        });
    }
}