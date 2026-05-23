import { CursorManager } from '../CursorManager.js';
import { HistoryManager } from '../HistoryManager.js';
import { FillManager } from '../FillManager.js';
import { LayerManager } from '../LayerManager.js';
import { CutAreaManager } from '../CutAreaManager.js';
import { RectangleManager } from '../RectangleManager.js';
import { EllipseManager } from '../EllipseManager.js';
import { AlignmentGuides } from '../AlignmentGuides.js';
import { LineManager } from '../LineManager.js';
import { SelectionPanel } from '../SelectionPanel.js';
import { ShortcutManager } from '../ShortcutManager.js';
import { TextManager } from '../TextManager.js';
import { EyeDropperManager } from '../EyeDropperManager.js';

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
        this.stabilizerValue = 0;
        this.fillTolerance = 32;
        this.brushOpacity = 1;
        this.currentTool = 'brush';
        this.textSize = 24;

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
        this.onBrushOpacityChange = null;
        this.onSpaceToggle = null;
        this.onToolChange = null;

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
        this.textManager = new TextManager(this);
        this.eyeDropperManager = new EyeDropperManager(this);

        this.canvas.layerManager = this.layerManager;
        this.canvas.historyManager = this.historyManager;

        this.tools = new CanvasTools(this);
        this.renderer = new CanvasRenderer(this);
        this.events = new CanvasEvents(this);
        this.shortcuts = new ShortcutManager(this);
        this.selectionPanel = new SelectionPanel(this);
        this.imageHandler = new CanvasImage(this);
        this.textureHandler = new CanvasTexture(this);

        this.init();
    }

    init() {
        window.addEventListener('resize', () => this.canvas.calcOffset());

        this.events.addEventListeners();
        this.cursorManager.updateSize(this.brushSize, this.zoom);
        this.cursorManager.updateSystemCursor(this.isSpacePressed, this.isPanning);
        this.renderer.overrideRender();

        setTimeout(() => {
            this.canvas.calcOffset();
            this.tools.setTool('pen');
            document.getElementById('btn-pen')?.click();
            this.tools.setTool('brush');
            document.getElementById('btn-brush')?.click();
        }, 100);
    }

    updateTransform() {
        this.board.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.zoom})`;
        this.canvas.calcOffset();
    }

    setTool(tool) { this.tools.setTool(tool); }
    setBrushColor(color) { this.tools.setBrushColor(color); }
    setStabilizer(value) { this.tools.setStabilizer(value); }
    setBrushSize(size) { this.tools.setBrushSize(size); }
    setFillTolerance(val) { this.tools.setFillTolerance(val); }
    getBrushColorAsRGBA() { return this.tools.getBrushColorAsRGBA(); }
    setBrushOpacity(opacity) { this.tools.setBrushOpacity(opacity); }
    createText(x, y) { this.textManager.createAt(x, y); }

    clipboardCopy() {
        if (this.currentTool === 'cutarea') {
            this.cutAreaManager.copy();
            return;
        }
        if (this.currentTool !== 'select') return;
        const obj = this.canvas.getActiveObject();
        if (!obj) return;
        obj.clone((cloned) => {
            this._clipboard = cloned;
            this._pasteOffset = 0;
        });
    }

    clipboardCut() {
        if (this.currentTool === 'cutarea') {
            this.cutAreaManager.cut();
            return;
        }
        if (this.currentTool !== 'select') return;
        const obj = this.canvas.getActiveObject();
        if (!obj) return;
        obj.clone((cloned) => {
            this._clipboard = cloned;
            this._pasteOffset = 0;
        });
        // Remove after cloning (async-safe)
        const targets = this.canvas.getActiveObjects();
        this.historyManager.removeCommand(targets);
        targets.forEach(o => this.canvas.remove(o));
        this.canvas.discardActiveObject();
        this.canvas.requestRenderAll();
    }

    clipboardPaste() {
        if (this.currentTool === 'cutarea') {
            this.cutAreaManager.paste();
            return;
        }
        this.events._selectPaste();
    }

    clipboardDuplicate() {
        if (this.currentTool !== 'select') return;
        this.events._selectDuplicate();
    }

    placeImage(dataURL) { this.imageHandler.placeImage(dataURL); }

    pickColor() {
        if (this.eyeDropperManager) this.eyeDropperManager.pick();
    }
}