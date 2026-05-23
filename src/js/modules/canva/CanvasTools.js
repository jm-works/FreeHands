import { PressureBrush } from '../PressureBrush.js';
import { EraserBrush } from '../EraserBrush.js';
import { StabilizedPencilBrush } from '../StabilizedPencilBrush.js';

const DRAWING_TOOLS = new Set(['brush', 'pen', 'eraser']);
const CROSSHAIR_TOOLS = new Set(['fill', 'cutarea', 'rectangle', 'ellipse', 'line']);
const SELECTION_DISABLED_TOOLS = new Set(['cutarea', 'rectangle', 'ellipse', 'line']);

export class CanvasTools {
    constructor(cm) {
        this.cm = cm;
        this._initSelectionFilter();
    }

    _initSelectionFilter() {
        this.cm.canvas.on('selection:created', (e) => {
            if (this.cm.currentTool !== 'select') return;
            if (!this.cm.layerManager) return;

            const activeLayerId = this.cm.layerManager.activeLayerId;
            const selected = this.cm.canvas.getActiveObjects();
            const valid = selected.filter(obj => obj.layerId === activeLayerId);

            if (valid.length === selected.length) return;

            this.cm.canvas.discardActiveObject();

            if (valid.length === 0) return;

            if (valid.length === 1) {
                this.cm.canvas.setActiveObject(valid[0]);
            } else {
                const sel = new fabric.ActiveSelection(valid, { canvas: this.cm.canvas });
                this.cm.canvas.setActiveObject(sel);
            }

            this.cm.canvas.requestRenderAll();
        });
    }

    _disableAllObjects() {
        this.cm.canvas.getObjects().forEach(obj => {
            obj.set({ selectable: false, evented: false });
        });
    }

    _enableSelectableObjects() {
        this.cm.canvas.getObjects().forEach(obj => {
            let canSelect = true;
            if (obj.isBg || obj.isEraser || obj.isSelectionRect) canSelect = false;
            if (this.cm.layerManager && canSelect) {
                const layer = this.cm.layerManager.layers.find(l => l.id === obj.layerId);
                if (!layer || layer.locked || !layer.visible) canSelect = false;
            }
            obj.set({
                selectable: canSelect,
                evented: canSelect,
                borderColor: '#c0392b',
                cornerColor: '#c0392b',
                cornerSize: 8,
                transparentCorners: false,
                padding: obj.type === 'line' ? 10 : 0
            });
        });
    }

    _setupDrawingTool(brush) {
        this.cm.canvas.isDrawingMode = true;
        this.cm.canvas.freeDrawingBrush = brush;
        brush.color = this.getBrushColorAsRGBA();
        brush.width = this.cm.brushSize;
        this.cm.canvas.defaultCursor = 'none';
    }

    setTool(tool) {
        const prev = this.cm.currentTool;

        if ((prev === 'cutarea' || prev === 'fill') && tool !== 'cutarea' && tool !== 'fill') {
            this.cm.cutAreaManager.clearSelection();
        }

        if (prev === 'select' && tool !== 'select') {
            this.cm.canvas.selection = false;
            this.cm.canvas.discardActiveObject();
            this._disableAllObjects();
            this.cm.canvas.requestRenderAll();
        }

        this.cm.currentTool = tool;

        if (this.cm.selectionPanel && tool !== 'select') {
            this.cm.selectionPanel.hide();
        }

        if (tool === 'brush') {
            const brush = new PressureBrush(this.cm.canvas);
            brush._posWindowSize = this._stabilizerWindowSize();
            this._setupDrawingTool(brush);
        } else if (tool === 'pen') {
            const brush = new StabilizedPencilBrush(this.cm.canvas);
            brush.windowSize = this._stabilizerWindowSize();
            this._setupDrawingTool(brush);
        } else if (tool === 'eraser') {
            const eraser = new EraserBrush(this.cm.canvas);
            this._setupDrawingTool(eraser);
        } else if (CROSSHAIR_TOOLS.has(tool)) {
            this.cm.canvas.isDrawingMode = false;
            this.cm.canvas.defaultCursor = 'crosshair';
            this.cm.cursorManager.hide();

            if (SELECTION_DISABLED_TOOLS.has(tool)) {
                this.cm.canvas.selection = false;
                this._disableAllObjects();
            }
        } else if (tool === 'pan') {
            this.cm.canvas.isDrawingMode = false;
            this.cm.canvas.defaultCursor = 'grab';
            this.cm.cursorManager.hide();
        } else if (tool === 'select') {
            this.cm.canvas.isDrawingMode = false;
            this.cm.canvas.selection = true;
            this.cm.canvas.defaultCursor = 'default';
            this.cm.cursorManager.hide();
            this._enableSelectableObjects();
        }

        this.cm.canvas.requestRenderAll();
        if (this.cm.onToolChange) this.cm.onToolChange(tool);
    }

    getBrushColorAsRGBA() {
        const hex = this.cm.brushColor || '#000000';
        const opacity = this.cm.brushOpacity !== undefined ? this.cm.brushOpacity : 1;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${opacity})`;
    }

    setBrushColor(color) {
        this.cm.brushColor = color;
        if (this.cm.canvas.freeDrawingBrush) {
            this.cm.canvas.freeDrawingBrush.color = this.getBrushColorAsRGBA();
        }
    }

    setBrushSize(size) {
        this.cm.brushSize = parseInt(size, 10);
        if (this.cm.canvas.freeDrawingBrush) {
            this.cm.canvas.freeDrawingBrush.width = this.cm.brushSize;
        }
        this.cm.cursorManager.updateSize(this.cm.brushSize, this.cm.zoom);
        if (this.cm.onBrushSizeChange) this.cm.onBrushSizeChange(this.cm.brushSize);
    }

    setFillTolerance(val) {
        this.cm.fillTolerance = parseInt(val);
    }

    setBrushOpacity(opacity) {
        this.cm.brushOpacity = opacity / 100;
        if (this.cm.canvas.freeDrawingBrush) {
            this.cm.canvas.freeDrawingBrush.color = this.getBrushColorAsRGBA();
        }
        if (this.cm.onBrushOpacityChange) this.cm.onBrushOpacityChange(opacity);
    }

    _stabilizerWindowSize() {
        const v = this.cm.stabilizerValue ?? 0;
        return Math.round(1 + Math.pow(v / 100, 0.4) * 39);
    }

    _stabilizerStreamline() {
        const v = this.cm.stabilizerValue ?? 0;
        return 0.4 + Math.pow(v / 100, 0.7) * 0.55;
    }

    setStabilizer(value) {
        this.cm.stabilizerValue = value;
        const brush = this.cm.canvas.freeDrawingBrush;
        if (!brush) return;

        const size = this._stabilizerWindowSize();

        if (brush instanceof PressureBrush) {
            brush._posWindowSize = size;
            brush._posBuffer = [];
        } else if (brush instanceof StabilizedPencilBrush) {
            brush.windowSize = size;
            brush._buffer = [];
        }
    }
}