import { PressureBrush } from '../PressureBrush.js';
import { EraserBrush } from '../EraserBrush.js';

const DRAWING_TOOLS = new Set(['brush', 'pen', 'eraser']);

const CROSSHAIR_TOOLS = new Set(['fill', 'cutarea', 'rectangle', 'ellipse']);

const SELECTION_DISABLED_TOOLS = new Set(['cutarea', 'rectangle', 'ellipse']);

export class CanvasTools {
    constructor(cm) {
        this.cm = cm;
    }

    _disableAllObjects() {
        this.cm.canvas.getObjects().forEach(obj => {
            obj.set({ selectable: false, evented: false });
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

        if (tool === 'brush') {
            this._setupDrawingTool(new PressureBrush(this.cm.canvas));
        } else if (tool === 'pen') {
            const brush = new fabric.PencilBrush(this.cm.canvas);
            brush.decimate = 1.5;
            this._setupDrawingTool(brush);
        } else if (tool === 'eraser') {
            this.cm.canvas.isDrawingMode = true;
            const eraser = new EraserBrush(this.cm.canvas);
            eraser.width = this.cm.brushSize;
            this.cm.canvas.freeDrawingBrush = eraser;
            this.cm.canvas.defaultCursor = 'none';
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

            this.cm.canvas.getObjects().forEach(obj => {
                let canSelect = true;
                if (obj.type === 'rect' || obj.type === 'ellipse' || obj.isEraser || obj.isSelectionRect) {
                    canSelect = false;
                }
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
                    transparentCorners: false
                });
            });
            this.cm.canvas.requestRenderAll();
        }
    }

    setBrushColor(color) {
        this.cm.brushColor = color;
        if (DRAWING_TOOLS.has(this.cm.currentTool) && this.cm.canvas.freeDrawingBrush) {
            this.cm.canvas.freeDrawingBrush.color = this.getBrushColorAsRGBA();
        }
    }

    setBrushSize(size) {
        this.cm.brushSize = parseInt(size, 10);
        if (this.cm.canvas.freeDrawingBrush) {
            this.cm.canvas.freeDrawingBrush.width = this.cm.brushSize;
        }
        this.cm.cursorManager.updateSize(this.cm.brushSize, this.cm.zoom);
    }

    setFillTolerance(val) {
        this.cm.fillTolerance = parseInt(val, 10);
    }

    getBrushColorAsRGBA() {
        const hex = this.cm.brushColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${this.cm.brushOpacity})`;
    }

    setBrushOpacity(opacity) {
        this.cm.brushOpacity = opacity / 100;
        if ((this.cm.currentTool === 'brush' || this.cm.currentTool === 'pen') && this.cm.canvas.freeDrawingBrush) {
            this.cm.canvas.freeDrawingBrush.color = this.getBrushColorAsRGBA();
        }
    }
}