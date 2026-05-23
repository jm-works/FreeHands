export class TextManager {
    constructor(canvasManager) {
        this.cm = canvasManager;
        this._defaults = {
            fontFamily: 'sans-serif',
            fontSize: 24,
            fontWeight: 'normal',
            fontStyle: 'normal',
            underline: false,
            textAlign: 'left',
            lineHeight: 1.2,
            charSpacing: 0,
            fill: '#000000',
        };
        this.onTextCreated = null;
        this._initFabricEvents();
    }

    _initFabricEvents() {
        this.cm.canvas.on('mouse:down', (opt) => {
            if (this.cm.currentTool !== 'text') return;
            if (opt.target && opt.target.type === 'i-text') return;

            const pointer = this.cm.canvas.getPointer(opt.e);
            this._createAt(pointer.x, pointer.y);
        });

        this.cm.canvas.on('text:editing:entered', (opt) => {
            if (this.onTextCreated) this.onTextCreated(opt.target);
        });

        this.cm.canvas.on('text:editing:exited', (opt) => {
            if (this.cm.currentTool !== 'text') return;
            const itext = opt.target;

            if (!itext.text || itext.text.trim() === '') {
                this.cm.canvas.remove(itext);
                this.cm.canvas.requestRenderAll();
                return;
            }

            if (!itext.__committed) {
                itext.__committed = true;
                this.cm.historyManager._assignUID(itext);
                this.cm.historyManager.addCommand([itext]);
            }

            requestAnimationFrame(() => {
                if (this.cm.currentTool === 'text') {
                    this.cm.setTool('select');
                }
            });
        });
    }

    _createAt(x, y) {
        const itext = new fabric.IText('', {
            left: x,
            top: y,
            fontFamily: this._defaults.fontFamily,
            fontSize: this._defaults.fontSize,
            fontWeight: this._defaults.fontWeight,
            fontStyle: this._defaults.fontStyle,
            underline: this._defaults.underline,
            textAlign: this._defaults.textAlign,
            lineHeight: this._defaults.lineHeight,
            charSpacing: this._defaults.charSpacing,
            fill: this._defaults.fill,
            selectable: true,
            evented: true,
            layerId: this.cm.layerManager ? this.cm.layerManager.activeLayerId : null,
            borderColor: '#c0392b',
            cornerColor: '#c0392b',
            cornerSize: 8,
            transparentCorners: false,
            __committed: false,
        });

        this.cm.canvas.add(itext);
        this.cm.canvas.setActiveObject(itext);
        itext.enterEditing();
        this.cm.canvas.requestRenderAll();
    }

    applyProp(props) {
        Object.assign(this._defaults, props);
        if (props.fontSize !== undefined) this.cm.textSize = props.fontSize;

        const itext = this.cm.canvas.getActiveObject();
        if (!itext || itext.type !== 'i-text') return;

        itext.set(props);
        if (itext.isEditing) {
            itext.initDimensions();
            itext.setCoords();
        }
        this.cm.canvas.requestRenderAll();
    }

    _enableITexts() {
        this.cm.canvas.getObjects().forEach(obj => {
            if (obj.type !== 'i-text') return;
            const layer = this.cm.layerManager?.layers.find(l => l.id === obj.layerId);
            const locked = layer && (layer.locked || !layer.visible);
            obj.set({ selectable: !locked, evented: !locked });
        });
    }

    _discard() {
        const active = this.cm.canvas.getActiveObject();
        if (active?.type === 'i-text' && active.isEditing) {
            active.exitEditing();
            if (!active.text || active.text.trim() === '') {
                this.cm.canvas.remove(active);
            }
            this.cm.canvas.requestRenderAll();
        }
    }
}