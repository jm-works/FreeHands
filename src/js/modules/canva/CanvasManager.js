import { CursorManager } from '../CursorManager.js';
import { HistoryManager } from '../HistoryManager.js';
import { FillManager } from '../FillManager.js';
import { LayerManager } from '../LayerManager.js';
import { CutAreaManager } from '../CutAreaManager.js';
import { RectangleManager } from '../RectangleManager.js';
import { EllipseManager } from '../EllipseManager.js';
import { AlignmentGuides } from '../AlignmentGuides.js';
import { LineManager } from '../LineManager.js';

import { CanvasRenderer } from './CanvasRenderer.js';
import { CanvasEvents } from './CanvasEvents.js';
import { CanvasTools } from './CanvasTools.js';
import { CanvasImage } from './CanvasImage.js';
import { CanvasTexture } from './CanvasTexture.js';

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

        this.brushColor = '#000000';
        this.brushSize = 5;
        this.fillTolerance = 32;
        this.brushOpacity = 1;
        this.currentTool = 'brush';

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

        this.virtualX = window.innerWidth / 2;
        this.virtualY = window.innerHeight / 2;
        this.activeArrowKeys = new Set();
        this.keyboardDrawInterval = null;

        fabric.ActiveSelection.prototype.borderColor = '#c0392b';
        fabric.ActiveSelection.prototype.cornerColor = '#c0392b';
        fabric.ActiveSelection.prototype.cornerSize = 8;
        fabric.ActiveSelection.prototype.transparentCorners = false;
        fabric.ActiveSelection.prototype.selectable = true;
        fabric.ActiveSelection.prototype.evented = true;

        this.cursorManager = new CursorManager(this.workspace);
        this.historyManager = new HistoryManager(this);
        this.fillManager = new FillManager(this);
        this.cutAreaManager = new CutAreaManager(this);
        this.rectangleManager = new RectangleManager(this);
        this.ellipseManager = new EllipseManager(this);
        this.layerManager = new LayerManager(this);
        this.alignmentGuides = new AlignmentGuides(this);
        this.lineManager = new LineManager(this);

        this.canvas.layerManager = this.layerManager;
        this.canvas.historyManager = this.historyManager;

        this.tools = new CanvasTools(this);
        this.renderer = new CanvasRenderer(this);
        this.events = new CanvasEvents(this);
        this.imageHandler = new CanvasImage(this);
        this.textureHandler = new CanvasTexture(this);

        this.init();
    }

    init() {
        setTimeout(() => this.canvas.calcOffset(), 100);
        window.addEventListener('resize', () => this.canvas.calcOffset());

        this.events.addEventListeners();
        this.cursorManager.updateSize(this.brushSize, this.zoom);
        this.cursorManager.updateSystemCursor(this.isSpacePressed, this.isPanning);
        this.renderer.overrideRender();
        this.tools.setTool('brush');
    }

    updateTransform() {
        this.board.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.zoom})`;
        this.canvas.calcOffset();
    }

    setTool(tool) { this.tools.setTool(tool); }
    setBrushColor(color) { this.tools.setBrushColor(color); }
    setBrushSize(size) { this.tools.setBrushSize(size); }
    setFillTolerance(val) { this.tools.setFillTolerance(val); }
    getBrushColorAsRGBA() { return this.tools.getBrushColorAsRGBA(); }
    setBrushOpacity(opacity) { this.tools.setBrushOpacity(opacity); }

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

    placeImage(dataURL) { this.imageHandler.placeImage(dataURL); }
    setPaperTexture(textureId) { this.textureHandler.setPaperTexture(textureId); }
}