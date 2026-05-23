export class CanvasImage {
    constructor(cm) {
        this.cm = cm;
    }

    placeImage(dataURL) {
        const img = new Image();
        img.onload = () => this._setupPlacement(img);
        img.src = dataURL;
    }

    _setupPlacement(img) {
        const canvasW = this.cm.canvas.width;
        const canvasH = this.cm.canvas.height;

        const scale = (img.width > canvasW || img.height > canvasH)
            ? Math.min(canvasW / img.width, canvasH / img.height) * 0.8
            : 1;

        this.cm.layerManager.addLayer('Placed Image');
        const layerId = this.cm.layerManager.activeLayerId;

        const fabricImg = new fabric.Image(img, {
            left: (canvasW - img.width * scale) / 2,
            top: (canvasH - img.height * scale) / 2,
            scaleX: scale,
            scaleY: scale,
            layerId,
            selectable: true,
            evented: true,
            hasControls: true,
            hasBorders: true,
            lockUniScaling: false,
            borderColor: '#c0392b',
            cornerColor: '#c0392b',
            cornerSize: 8,
            transparentCorners: false,
        });

        const prevTool = this.cm.currentTool;

        this.cm.canvas.isDrawingMode = false;
        this.cm.canvas.selection = false;
        this.cm.canvas.add(fabricImg);
        this.cm.canvas.setActiveObject(fabricImg);
        this.cm.canvas.requestRenderAll();

        const onConfirm = () => this._confirmPlacement(fabricImg, layerId, prevTool, cleanup);
        const onCancel = () => this._cancelPlacement(fabricImg, layerId, prevTool, cleanup);

        const banner = this._createBanner(onConfirm, onCancel);

        const onDblClick = () => onConfirm();

        const onKey = (e) => {
            if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onConfirm(); }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
        };

        const cleanup = () => this._cleanup(banner, onDblClick, onKey);

        this.cm.canvas.on('mouse:dblclick', onDblClick);
        document.addEventListener('keydown', onKey, true);
    }

    _createBanner(onConfirm, onCancel) {
        const banner = document.createElement('div');
        banner.style.cssText = `
            position: fixed;
            bottom: calc(var(--statusbar-height) + 12px);
            left: 50%;
            transform: translateX(-50%);
            background: var(--ink-dark);
            border: 1px solid var(--accent-color);
            color: var(--text-primary);
            font-family: var(--font-ui);
            font-size: 0.72rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            padding: 6px 8px 6px 16px;
            z-index: 9998;
            box-shadow: 0 4px 20px rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            gap: 12px;
            white-space: nowrap;
            user-select: none;
        `;

        const label = document.createElement('span');
        label.style.cssText = `color: var(--text-secondary); letter-spacing: 0.12em;`;
        label.textContent = 'Transform Image';

        const hint = document.createElement('span');
        hint.style.cssText = `color: var(--text-secondary); font-size: 0.65rem; opacity: 0.6;`;
        hint.textContent = 'Double-click or Enter to confirm · Esc to cancel';

        const btnConfirm = this._createBannerButton('Confirm', '#c0392b', '#fff', onConfirm);
        const btnCancel = this._createBannerButton('Cancel', '#2a2a2a', 'var(--text-secondary)', onCancel);

        banner.append(label, hint, btnCancel, btnConfirm);
        document.body.appendChild(banner);
        return banner;
    }

    _createBannerButton(text, bg, color, onClick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.style.cssText = `
            background: ${bg};
            color: ${color};
            border: none;
            font-family: var(--font-ui);
            font-size: 0.72rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            padding: 4px 14px;
            cursor: pointer;
            pointer-events: auto;
        `;
        btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
        return btn;
    }

    _confirmPlacement(fabricImg, layerId, prevTool, cleanup) {
        cleanup();

        fabricImg.set({ selectable: false, evented: false });
        fabricImg.setCoords();
        this.cm.canvas.discardActiveObject();

        this.cm.tools.setTool(prevTool);

        this.cm.canvas.requestRenderAll();
        this.cm.historyManager.saveState();
    }

    _cancelPlacement(fabricImg, layerId, prevTool, cleanup) {
        cleanup();

        this.cm.canvas.remove(fabricImg);
        this.cm.layerManager.deleteLayer(layerId);
        this.cm.canvas.discardActiveObject();

        this.cm.tools.setTool(prevTool);

        this.cm.canvas.requestRenderAll();
    }

    _cleanup(banner, onDblClick, onKey) {
        banner.remove();
        this.cm.canvas.off('mouse:dblclick', onDblClick);
        document.removeEventListener('keydown', onKey, true);
    }
}