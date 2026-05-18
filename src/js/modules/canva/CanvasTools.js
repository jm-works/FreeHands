import { PressureBrush } from '../PressureBrush.js';
import { EraserBrush } from '../EraserBrush.js';

export class CanvasTools {
    constructor(cm) {
        this.cm = cm;
    }

    setTool(tool) {
        if ((this.cm.currentTool === 'cutarea' && tool !== 'cutarea' && tool !== 'fill') ||
            (this.cm.currentTool === 'fill' && tool !== 'fill' && tool !== 'cutarea')) {
            this.cm.cutAreaManager.clearSelection();
        }

        if (this.cm.currentTool === 'select' && tool !== 'select') {
            this.cm.canvas.selection = false;
            this.cm.canvas.discardActiveObject();
            this.cm.canvas.getObjects().forEach(obj => {
                obj.set({ selectable: false, evented: false });
            });
            this.cm.canvas.requestRenderAll();
        }

        this.cm.currentTool = tool;

        if (tool === 'brush') {
            this.cm.canvas.isDrawingMode = true;
            this.cm.canvas.freeDrawingBrush = new PressureBrush(this.cm.canvas);
            this.cm.canvas.freeDrawingBrush.color = this.getBrushColorAsRGBA();
            this.cm.canvas.freeDrawingBrush.width = this.cm.brushSize;
            this.cm.canvas.defaultCursor = 'none';
        } else if (tool === 'pen') {
            this.cm.canvas.isDrawingMode = true;
            this.cm.canvas.freeDrawingBrush = new fabric.PencilBrush(this.cm.canvas);
            this.cm.canvas.freeDrawingBrush.color = this.getBrushColorAsRGBA();
            this.cm.canvas.freeDrawingBrush.width = this.cm.brushSize;
            this.cm.canvas.freeDrawingBrush.decimate = 1.5;
            this.cm.canvas.defaultCursor = 'none';
        } else if (tool === 'eraser') {
            this.cm.canvas.isDrawingMode = true;
            this.cm.canvas.freeDrawingBrush = new EraserBrush(this.cm.canvas);
            this.cm.canvas.freeDrawingBrush.width = this.cm.brushSize;
            this.cm.canvas.defaultCursor = 'none';
        } else if (tool === 'fill') {
            this.cm.canvas.isDrawingMode = false;
            this.cm.canvas.defaultCursor = 'crosshair';
            this.cm.cursorManager.hide();
        } else if (tool === 'cutarea') {
            this.cm.canvas.isDrawingMode = false;
            this.cm.canvas.defaultCursor = 'crosshair';
            this.cm.cursorManager.hide();
            this.cm.canvas.selection = false;
            this.cm.canvas.getObjects().forEach(obj => {
                obj.set({ selectable: false, evented: false });
            });
        } else if (tool === 'rectangle') {
            this.cm.canvas.isDrawingMode = false;
            this.cm.canvas.defaultCursor = 'crosshair';
            this.cm.cursorManager.hide();
            this.cm.canvas.selection = false;
            this.cm.canvas.getObjects().forEach(obj => {
                obj.set({ selectable: false, evented: false });
            });
        } else if (tool === 'ellipse') {
            this.cm.canvas.isDrawingMode = false;
            this.cm.canvas.defaultCursor = 'crosshair';
            this.cm.cursorManager.hide();
            this.cm.canvas.selection = false;
            this.cm.canvas.getObjects().forEach(obj => {
                obj.set({ selectable: false, evented: false });
            });
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

                if (obj.type === 'rect' || obj.type === 'ellipse' || obj.isEraser || obj.isSelectionRect) canSelect = false;

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
        if ((this.cm.currentTool === 'brush' || this.cm.currentTool === 'pen') && this.cm.canvas.freeDrawingBrush) {
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