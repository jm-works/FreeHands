const TRANSFORM_PROPS = ['left', 'top', 'scaleX', 'scaleY', 'angle', 'flipX', 'flipY', 'width', 'height', 'opacity'];

function captureTransformProps(obj) {
    const snap = {};
    TRANSFORM_PROPS.forEach(p => { snap[p] = obj[p]; });
    return snap;
}

function applySelectStyle(obj) {
    obj.set({
        selectable: true,
        evented: true,
        borderColor: '#c0392b',
        cornerColor: '#c0392b',
        cornerSize: 8,
        transparentCorners: false,
        padding: obj.type === 'line' ? 10 : 0
    });
}

export class CanvasEvents {
    constructor(cm) {
        this.cm = cm;
    }

    _selectPaste() {
        if (!this.cm._clipboard) return;

        const activeLayerId = this.cm.layerManager ? this.cm.layerManager.activeLayerId : null;

        this.cm._clipboard.clone((clonedObj) => {
            this.cm.canvas.discardActiveObject();

            this.cm._pasteOffset = (this.cm._pasteOffset || 0) + 10;
            const offset = this.cm._pasteOffset;

            if (clonedObj.type === 'activeSelection') {
                clonedObj.canvas = this.cm.canvas;
                const children = [];
                clonedObj.forEachObject((obj) => {
                    obj.set('layerId', activeLayerId);
                    obj.set({ left: obj.left + offset, top: obj.top + offset });
                    applySelectStyle(obj);
                    obj.set({ padding: obj.type === 'line' ? 10 : 0 });
                    this.cm.historyManager._assignUID(obj);
                    this.cm.canvas.add(obj);
                    children.push(obj);
                });
                clonedObj.setCoords();
                this.cm.historyManager.addCommand(children);
            } else {
                clonedObj.set({ left: clonedObj.left + offset, top: clonedObj.top + offset, layerId: activeLayerId });
                applySelectStyle(clonedObj);
                this.cm.historyManager._assignUID(clonedObj);
                this.cm.canvas.add(clonedObj);
                this.cm.historyManager.addCommand([clonedObj]);
            }

            this.cm.canvas.setActiveObject(clonedObj);
            if (this.cm.layerManager) this.cm.layerManager.updateZIndices();
            this.cm.canvas.requestRenderAll();
        });
    }

    _selectDuplicate() {
        const activeObject = this.cm.canvas.getActiveObject();
        if (!activeObject) return;

        const activeLayerId = this.cm.layerManager ? this.cm.layerManager.activeLayerId : null;

        activeObject.clone((clonedObj) => {
            this.cm.canvas.discardActiveObject();

            if (clonedObj.type === 'activeSelection') {
                clonedObj.canvas = this.cm.canvas;
                const children = [];
                clonedObj.forEachObject((obj) => {
                    obj.set({ left: obj.left + 10, top: obj.top + 10, layerId: activeLayerId });
                    applySelectStyle(obj);
                    this.cm.historyManager._assignUID(obj);
                    this.cm.canvas.add(obj);
                    children.push(obj);
                });
                clonedObj.setCoords();
                this.cm.historyManager.addCommand(children);
                const sel = new fabric.ActiveSelection(children, { canvas: this.cm.canvas });
                this.cm.canvas.setActiveObject(sel);
            } else {
                clonedObj.set({ left: clonedObj.left + 10, top: clonedObj.top + 10, layerId: activeLayerId });
                applySelectStyle(clonedObj);
                this.cm.historyManager._assignUID(clonedObj);
                this.cm.canvas.add(clonedObj);
                this.cm.historyManager.addCommand([clonedObj]);
                this.cm.canvas.setActiveObject(clonedObj);
            }

            if (this.cm.layerManager) this.cm.layerManager.updateZIndices();
            this.cm.canvas.requestRenderAll();
        });
    }

    _selectNudge(dx, dy) {
        const activeObject = this.cm.canvas.getActiveObject();
        if (!activeObject) return;

        const targets = activeObject.type === 'activeSelection'
            ? activeObject.getObjects()
            : [activeObject];

        const prevProps = targets.map(obj => captureTransformProps(obj));

        targets.forEach(obj => {
            obj.set({ left: obj.left + dx, top: obj.top + dy });
            obj.setCoords();
        });

        if (activeObject.type === 'activeSelection') activeObject.setCoords();

        const nextProps = targets.map(obj => captureTransformProps(obj));
        this.cm.historyManager.modifyCommand(targets, prevProps, nextProps);
        this.cm.canvas.requestRenderAll();
    }

    addEventListeners() {
        window.addEventListener('keydown', (e) => {
            const isCtrl = e.ctrlKey || e.metaKey;
            const isInput = e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'textarea';
            const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);

            if ((e.key === '+' || e.key === '=' || e.key === '-') && !isInput) {
                e.preventDefault();
                const zoomFactor = e.key === '-' ? 0.9 : 1.1;
                const rect = this.cm.workspace.getBoundingClientRect();

                const px = (this.cm.virtualX !== undefined && this.cm.virtualX >= rect.left && this.cm.virtualX <= rect.right)
                    ? (this.cm.virtualX - rect.left) : (rect.width / 2);
                const py = (this.cm.virtualY !== undefined && this.cm.virtualY >= rect.top && this.cm.virtualY <= rect.bottom)
                    ? (this.cm.virtualY - rect.top) : (rect.height / 2);

                const dx = (px - this.cm.offsetX - rect.width / 2) / this.cm.zoom;
                const dy = (py - this.cm.offsetY - rect.height / 2) / this.cm.zoom;

                const newZoom = Math.min(Math.max(this.cm.zoom * zoomFactor, 0.1), 20);
                this.cm.offsetX += dx * (this.cm.zoom - newZoom);
                this.cm.offsetY += dy * (this.cm.zoom - newZoom);
                this.cm.zoom = newZoom;

                this.cm.updateTransform();
                this.cm.cursorManager.updateSize(this.cm.brushSize, this.cm.zoom);

                const zoomDisplay = document.getElementById('zoom-val-display');
                if (zoomDisplay) zoomDisplay.textContent = `Zoom: ${Math.round(this.cm.zoom * 100)}%`;
                return;
            }

            if (isArrow && !isInput) {
                if (this.cm.currentTool === 'select') {
                    const activeObject = this.cm.canvas.getActiveObject();
                    if (activeObject) {
                        e.preventDefault();
                        const step = e.shiftKey ? 10 : 1;
                        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
                        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
                        this._selectNudge(dx, dy);
                    }
                    return;
                }

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
                    this.cm.canvas.freeDrawingBrush.onMouseDown(pointer, { e: { pointerType: 'mouse', pressure: 0.5 } });

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
                            e: { pointerType: 'mouse', pressure: 0.5, altKey: this.cm.isAltPressed }
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
                        this.cm.canvas.selection = true;
                    }
                } else if (this.cm.currentTool === 'cutarea') {
                    e.preventDefault();
                    this.cm.cutAreaManager.deleteSelection();
                }

            } else if (e.key === 'Escape' && !isInput) {
                if (this.cm.currentTool === 'select') {
                    this.cm.canvas.discardActiveObject();
                    this.cm.canvas.requestRenderAll();
                }

            } else if (isCtrl && e.key.toLowerCase() === 'a' && !isInput) {
                if (this.cm.currentTool === 'select') {
                    e.preventDefault();
                    const activeLayerId = this.cm.layerManager ? this.cm.layerManager.activeLayerId : null;
                    const selectables = this.cm.canvas.getObjects().filter(obj =>
                        obj.selectable && obj.layerId === activeLayerId
                    );
                    if (selectables.length === 0) return;
                    if (selectables.length === 1) {
                        this.cm.canvas.setActiveObject(selectables[0]);
                    } else {
                        const sel = new fabric.ActiveSelection(selectables, { canvas: this.cm.canvas });
                        this.cm.canvas.setActiveObject(sel);
                    }
                    this.cm.canvas.requestRenderAll();
                }

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

            if (!isInput) this.cm.shortcuts.dispatch(e);
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
                        this.cm.canvas.freeDrawingBrush.onMouseUp({ e: { pointerType: 'mouse' } });
                    }
                }
                return;
            }

            if (e.key === 'Shift' && !isInput) {
                this.cm.isShiftPressed = false;
                if (!this.cm.isResizingBrush && !this.cm.isSpacePressed &&
                    (this.cm.currentTool === 'brush' || this.cm.currentTool === 'pen' || this.cm.currentTool === 'eraser')) {
                    this.cm.canvas.isDrawingMode = true;
                }
            }

            if (e.key === 'Alt') this.cm.isAltPressed = false;

            if (e.code === 'Space' && !isInput) {
                e.preventDefault();
                this.cm.isSpacePressed = false;
                if (!this.cm.isShiftPressed &&
                    (this.cm.currentTool === 'brush' || this.cm.currentTool === 'pen' || this.cm.currentTool === 'eraser')) {
                    this.cm.canvas.isDrawingMode = true;
                }
                this.cm.cursorManager.updateSystemCursor(this.cm.isSpacePressed, this.cm.isPanning);
                if (this.cm.onSpaceToggle) this.cm.onSpaceToggle(false);
            }
        });

        const interceptDrawing = (e) => {
            const activeLayer = this.cm.layerManager
                ? this.cm.layerManager.layers.find(l => l.id === this.cm.layerManager.activeLayerId)
                : null;
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
            if (document.activeElement &&
                (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                document.activeElement.blur();
            }

            window.currentPointerPressure = e.pressure !== undefined ? e.pressure : 0.5;
            if (window.currentPointerPressure === 0 && e.pointerType === 'mouse') window.currentPointerPressure = 0.5;

            const activeLayer = this.cm.layerManager
                ? this.cm.layerManager.layers.find(l => l.id === this.cm.layerManager.activeLayerId)
                : null;
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
                this.cm.cursorManager.updateSystemCursor(true, true);
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
                const sel = this.cm.cutAreaManager.selection;
                const clipBounds = sel
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
                if (this.cm.onBrushSizeChange) this.cm.onBrushSizeChange(newSize);
            } else if (this.cm.isPanning) {
                this.cm.offsetX += (e.clientX - this.cm.lastPosX);
                this.cm.offsetY += (e.clientY - this.cm.lastPosY);
                this.cm.lastPosX = e.clientX;
                this.cm.lastPosY = e.clientY;
                this.cm.updateTransform();
            } else if (!this.cm.isSpacePressed && !e.shiftKey && !this.cm.isShiftPressed) {
                if (this.cm.currentTool === 'fill' || this.cm.currentTool === 'pan' ||
                    this.cm.currentTool === 'select' || this.cm.currentTool === 'cutarea' ||
                    this.cm.currentTool === 'rectangle' || this.cm.currentTool === 'ellipse' ||
                    this.cm.currentTool === 'line') {
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
            if (e.button === 1) {
                this.cm.isPanning = false;
                this.cm.cursorManager.updateSystemCursor(this.cm.isSpacePressed, false);
                if (this.cm.currentTool !== 'pan' && !this.cm.isSpacePressed) {
                    const isDrawingTool = this.cm.currentTool === 'brush' || this.cm.currentTool === 'pen' || this.cm.currentTool === 'eraser';
                    if (isDrawingTool) this.cm.canvas.isDrawingMode = true;
                }
                return;
            }

            if (this.cm.currentTool === 'cutarea') this.cm.cutAreaManager.onMouseUp();
            if (this.cm.currentTool === 'rectangle') this.cm.rectangleManager.onMouseUp();
            if (this.cm.currentTool === 'line') this.cm.lineManager.onMouseUp();
            if (this.cm.currentTool === 'ellipse') this.cm.ellipseManager.onMouseUp();

            if (this.cm.isResizingBrush) {
                this.cm.isResizingBrush = false;
                if (!this.cm.isSpacePressed &&
                    (this.cm.currentTool === 'brush' || this.cm.currentTool === 'pen' || this.cm.currentTool === 'eraser')) {
                    this.cm.canvas.isDrawingMode = true;
                }
                this.cm.cursorManager.updateSystemCursor(this.cm.isSpacePressed, false);
            }

            if (this.cm.isPanning) {
                this.cm.isPanning = false;
                this.cm.cursorManager.updateSystemCursor(this.cm.isSpacePressed, false);
            }
        });

        this.cm.canvas.on('mouse:down', (e) => {
            if (!e.target) return;

            const targets = e.target.type === 'activeSelection'
                ? e.target.getObjects()
                : [e.target];

            targets.forEach(obj => {
                obj._prevTransformProps = captureTransformProps(obj);
            });
        });

        this.cm.canvas.on('path:created', (e) => {
            if (!e.path || e.path.__historyRegistered) return;
            e.path.__historyRegistered = true;

            if (this.cm.layerManager) {
                e.path.layerId = this.cm.layerManager.activeLayerId;
            }
            this.cm.historyManager._assignUID(e.path);
            this.cm.historyManager.addCommand([e.path]);
        });

        this.cm.canvas.on('object:modified', (e) => {
            if (!e.target) return;

            const targets = e.target.type === 'activeSelection'
                ? e.target.getObjects()
                : [e.target];

            const withPrev = targets.filter(obj => obj._prevTransformProps);
            if (withPrev.length === 0) return;

            const prevProps = withPrev.map(obj => obj._prevTransformProps);
            const nextProps = withPrev.map(obj => captureTransformProps(obj));

            this.cm.historyManager.modifyCommand(withPrev, prevProps, nextProps);
            targets.forEach(obj => { delete obj._prevTransformProps; });
        });

        this.cm.canvas.on('object:rotating', (e) => {
            const shiftPressed = (e.e && e.e.shiftKey) || this.cm.isShiftPressed;
            if (shiftPressed) {
                e.target.snapAngle = 45;
                e.target.snapThreshold = 45;
            } else {
                e.target.snapAngle = 0;
                e.target.snapThreshold = 0;
            }
        });

        this.cm.workspace.addEventListener('pointerenter', () => {
            if (!this.cm.isSpacePressed && !this.cm.isResizingBrush &&
                this.cm.currentTool !== 'fill' && this.cm.currentTool !== 'pan' &&
                this.cm.currentTool !== 'select' && this.cm.currentTool !== 'cutarea' &&
                this.cm.currentTool !== 'rectangle' && this.cm.currentTool !== 'ellipse' &&
                this.cm.currentTool !== 'line') {
                this.cm.cursorManager.show();
            }
            this.cm.canvas.calcOffset();
        });

        this.cm.workspace.addEventListener('pointerleave', () => {
            if (!this.cm.isResizingBrush) this.cm.cursorManager.hide();
        });

        this.cm.workspace.addEventListener('wheel', (e) => {
            e.preventDefault();

            const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
            const rect = this.cm.workspace.getBoundingClientRect();

            const px = e.clientX - rect.left;
            const py = e.clientY - rect.top;

            const dx = (px - this.cm.offsetX - rect.width / 2) / this.cm.zoom;
            const dy = (py - this.cm.offsetY - rect.height / 2) / this.cm.zoom;

            const newZoom = Math.min(Math.max(this.cm.zoom * zoomFactor, 0.1), 20);
            this.cm.offsetX += dx * (this.cm.zoom - newZoom);
            this.cm.offsetY += dy * (this.cm.zoom - newZoom);
            this.cm.zoom = newZoom;

            this.cm.updateTransform();
            this.cm.cursorManager.updateSize(this.cm.brushSize, this.cm.zoom);

            const zoomDisplay = document.getElementById('zoom-val-display');
            if (zoomDisplay) zoomDisplay.textContent = `Zoom: ${Math.round(this.cm.zoom * 100)}%`;
        }, { passive: false });
    }
}