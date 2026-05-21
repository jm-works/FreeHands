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
                        this.cm.historyManager.removeCommand(activeObjects);
                        activeObjects.forEach(obj => this.cm.canvas.remove(obj));
                        this.cm.canvas.discardActiveObject();
                        this.cm.canvas.requestRenderAll();
                    }
                } else if (this.cm.currentTool === 'cutarea') {
                    e.preventDefault();
                    this.cm.cutAreaManager.deleteSelection();
                }
            } else if (isCtrl && e.key.toLowerCase() === 'c' && !isInput) {
                if (this.cm.currentTool === 'cutarea') {
                    e.preventDefault();
                    this.cm.cutAreaManager.copy();
                } else if (this.cm.currentTool === 'select') {
                    const activeObject = this.cm.canvas.getActiveObject();
                    if (activeObject) {
                        e.preventDefault();
                        activeObject.clone((cloned) => {
                            this.cm._clipboard = cloned;
                        });
                    }
                }
            } else if (isCtrl && e.key.toLowerCase() === 'x' && !isInput) {
                if (this.cm.currentTool === 'cutarea') {
                    e.preventDefault();
                    this.cm.cutAreaManager.cut();
                } else if (this.cm.currentTool === 'select') {
                    const activeObject = this.cm.canvas.getActiveObject();
                    if (activeObject) {
                        e.preventDefault();
                        activeObject.clone((cloned) => {
                            this.cm._clipboard = cloned;
                            const activeObjects = this.cm.canvas.getActiveObjects();
                            this.cm.historyManager.removeCommand(activeObjects);
                            activeObjects.forEach(obj => this.cm.canvas.remove(obj));
                            this.cm.canvas.discardActiveObject();
                            this.cm.canvas.requestRenderAll();
                        });
                    }
                }
            } else if (isCtrl && e.key.toLowerCase() === 'v' && !isInput) {
                if (this.cm.currentTool === 'cutarea') {
                    if (this.cm.cutAreaManager.clipboardDataURL) {
                        e.preventDefault();
                        this.cm.cutAreaManager.paste();
                    }
                } else if (this.cm.currentTool === 'select') {
                    if (this.cm._clipboard) {
                        e.preventDefault();
                        this.cm._clipboard.clone((clonedObj) => {
                            this.cm.canvas.discardActiveObject();
                            clonedObj.set({
                                left: clonedObj.left + 10,
                                top: clonedObj.top + 10,
                                evented: true,
                                selectable: true
                            });

                            if (this.cm.layerManager) {
                                if (!this.cm._copyCount) this.cm._copyCount = 0;
                                this.cm._copyCount += 1;
                                this.cm.layerManager.addLayer(`Copy Layer ${this.cm._copyCount}`);
                            }

                            const activeLayerId = this.cm.layerManager ? this.cm.layerManager.activeLayerId : null;

                            if (clonedObj.type === 'activeSelection') {
                                clonedObj.canvas = this.cm.canvas;
                                clonedObj.forEachObject((obj) => {
                                    obj.set('layerId', activeLayerId);
                                    obj.set({
                                        selectable: true,
                                        evented: true,
                                        borderColor: '#c0392b',
                                        cornerColor: '#c0392b',
                                        cornerSize: 8,
                                        transparentCorners: false,
                                        padding: obj.type === 'line' ? 10 : 0
                                    });
                                    this.cm.canvas.add(obj);
                                });
                                clonedObj.setCoords();
                            } else {
                                clonedObj.set('layerId', activeLayerId);
                                clonedObj.set({
                                    selectable: true,
                                    evented: true,
                                    borderColor: '#c0392b',
                                    cornerColor: '#c0392b',
                                    cornerSize: 8,
                                    transparentCorners: false,
                                    padding: clonedObj.type === 'line' ? 10 : 0
                                });
                                this.cm.canvas.add(clonedObj);
                            }

                            this.cm._clipboard.top += 10;
                            this.cm._clipboard.left += 10;
                            this.cm.canvas.setActiveObject(clonedObj);
                            if (this.cm.layerManager) this.cm.layerManager.updateZIndices();
                            this.cm.canvas.requestRenderAll();

                            const pastedObjects = clonedObj.type === 'activeSelection'
                                ? clonedObj.getObjects()
                                : [clonedObj];
                            pastedObjects.forEach(obj => this.cm.historyManager._assignUID(obj));
                            this.cm.historyManager.addCommand(pastedObjects);
                        });
                    }
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

        this.cm.canvas.on('mouse:down', (e) => {
            const target = e.target;
            if (!target) return;

            const targets = (target.type === 'activeSelection')
                ? target.getObjects()
                : [target];

            targets.forEach(obj => {
                obj._prevTransformProps = {
                    left: obj.left,
                    top: obj.top,
                    scaleX: obj.scaleX,
                    scaleY: obj.scaleY,
                    angle: obj.angle,
                    flipX: obj.flipX,
                    flipY: obj.flipY,
                    width: obj.width,
                    height: obj.height,
                    opacity: obj.opacity,
                };
            });
        });

        this.cm.canvas.on('path:created', (e) => {
            if (!e.path) return;
            if (this.cm.layerManager) {
                e.path.layerId = this.cm.layerManager.activeLayerId;
            }
            this.cm.historyManager._assignUID(e.path);
            this.cm.historyManager.addCommand(e.path);
        });

        this.cm.canvas.on('object:modified', (e) => {
            const target = e.target;
            if (!target) { this.cm.historyManager.saveState(); return; }

            const targets = (target.type === 'activeSelection')
                ? target.getObjects()
                : [target];

            const validTargets = targets.filter(obj => obj._prevTransformProps);

            if (validTargets.length === 0) {
                this.cm.historyManager.saveState();
                return;
            }

            const prevProps = validTargets.map(obj => ({ ...obj._prevTransformProps }));
            const nextProps = validTargets.map(obj => ({
                left: obj.left,
                top: obj.top,
                scaleX: obj.scaleX,
                scaleY: obj.scaleY,
                angle: obj.angle,
                flipX: obj.flipX,
                flipY: obj.flipY,
                width: obj.width,
                height: obj.height,
                opacity: obj.opacity,
            }));

            validTargets.forEach(obj => this.cm.historyManager._assignUID(obj));
            this.cm.historyManager.modifyCommand(validTargets, prevProps, nextProps);
            validTargets.forEach(obj => delete obj._prevTransformProps);
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