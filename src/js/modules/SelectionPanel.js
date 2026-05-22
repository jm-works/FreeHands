const PANEL_OFFSET_Y = 12;
const PANEL_MARGIN = 6;

const ICONS = {
    flipH: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v12M3 5l-2 3 2 3M13 5l2 3-2 3"/><line x1="1" y1="8" x2="6" y2="8"/><line x1="10" y1="8" x2="15" y2="8"/></svg>`,
    flipV: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 8h12M5 3l3-2 3 2M5 13l3 2 3-2"/><line x1="8" y1="1" x2="8" y2="6"/><line x1="8" y1="10" x2="8" y2="15"/></svg>`,
    alignLeft: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="2" y1="2" x2="2" y2="14"/><rect x="4" y="4" width="5" height="3" rx="0.5"/><rect x="4" y="9" width="8" height="3" rx="0.5"/></svg>`,
    alignCenterH: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="8" y1="2" x2="8" y2="14"/><rect x="4.5" y="4" width="7" height="3" rx="0.5"/><rect x="2.5" y="9" width="11" height="3" rx="0.5"/></svg>`,
    alignRight: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="14" y1="2" x2="14" y2="14"/><rect x="7" y="4" width="5" height="3" rx="0.5"/><rect x="4" y="9" width="8" height="3" rx="0.5"/></svg>`,
    alignTop: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="2" y1="2" x2="14" y2="2"/><rect x="4" y="4" width="3" height="5" rx="0.5"/><rect x="9" y="4" width="3" height="8" rx="0.5"/></svg>`,
    alignMiddleV: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="2" y1="8" x2="14" y2="8"/><rect x="4" y="4.5" width="3" height="7" rx="0.5"/><rect x="9" y="2.5" width="3" height="11" rx="0.5"/></svg>`,
    alignBottom: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="2" y1="14" x2="14" y2="14"/><rect x="4" y="7" width="3" height="5" rx="0.5"/><rect x="9" y="4" width="3" height="8" rx="0.5"/></svg>`,
    distH: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="2" y1="3" x2="2" y2="13"/><line x1="14" y1="3" x2="14" y2="13"/><rect x="5.5" y="5" width="5" height="6" rx="0.5"/></svg>`,
    distV: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="3" y1="2" x2="13" y2="2"/><line x1="3" y1="14" x2="13" y2="14"/><rect x="5" y="5.5" width="6" height="5" rx="0.5"/></svg>`,
};

export class SelectionPanel {
    constructor(cm) {
        this.cm = cm;
        this._panel = null;
        this._visible = false;
        this._hideTimer = null;

        this._build();
        this._bindCanvasEvents();
    }

    _build() {
        this._panel = document.createElement('div');
        this._panel.className = 'sp-panel';
        this._panel.setAttribute('aria-label', 'Selection transforms');

        const flipGroup = this._buildGroup('Flip', this._flipButtons());
        const alignGroup = this._buildGroup('Align', this._alignButtons());
        const distGroup = this._buildGroup('Distribute', this._distributeButtons());

        this._panel.append(flipGroup, this._sep(), alignGroup, this._sep(), distGroup);

        this._panel.addEventListener('mousedown', e => e.stopPropagation());
        this._panel.addEventListener('pointerdown', e => e.stopPropagation());

        document.body.appendChild(this._panel);
        this._injectStyles();
        this._panel.style.display = 'none';
    }

    _sep() {
        const s = document.createElement('div');
        s.className = 'sp-sep';
        return s;
    }

    _buildGroup(label, buttons) {
        const group = document.createElement('div');
        group.className = 'sp-group';
        group.setAttribute('aria-label', label);
        buttons.forEach(cfg => group.appendChild(this._buildBtn(cfg)));
        return group;
    }

    _buildBtn({ id, title, icon, action }) {
        const btn = document.createElement('button');
        btn.className = 'sp-btn';
        btn.id = `sp-${id}`;
        btn.title = title;
        btn.innerHTML = icon;
        btn.addEventListener('click', () => action());
        return btn;
    }

    _flipButtons() {
        return [
            { id: 'flip-h', title: 'Flip Horizontal', icon: ICONS.flipH, action: () => this._flipH() },
            { id: 'flip-v', title: 'Flip Vertical', icon: ICONS.flipV, action: () => this._flipV() },
        ];
    }

    _alignButtons() {
        return [
            { id: 'align-left', title: 'Align Left', icon: ICONS.alignLeft, action: () => this._align('left') },
            { id: 'align-center-h', title: 'Align Center', icon: ICONS.alignCenterH, action: () => this._align('center') },
            { id: 'align-right', title: 'Align Right', icon: ICONS.alignRight, action: () => this._align('right') },
            { id: 'align-top', title: 'Align Top', icon: ICONS.alignTop, action: () => this._align('top') },
            { id: 'align-middle-v', title: 'Align Middle', icon: ICONS.alignMiddleV, action: () => this._align('middle') },
            { id: 'align-bottom', title: 'Align Bottom', icon: ICONS.alignBottom, action: () => this._align('bottom') },
        ];
    }

    _distributeButtons() {
        return [
            { id: 'dist-h', title: 'Distribute Horizontally', icon: ICONS.distH, action: () => this._distribute('horizontal') },
            { id: 'dist-v', title: 'Distribute Vertically', icon: ICONS.distV, action: () => this._distribute('vertical') },
        ];
    }

    show(fabricObject) {
        if (!fabricObject) return;
        this._updateDistributeState(fabricObject);
        this._reposition(fabricObject);
        if (!this._visible) {
            this._panel.style.display = 'flex';
            requestAnimationFrame(() => this._panel.classList.add('sp-visible'));
            this._visible = true;
        }
    }

    hide() {
        if (!this._visible) return;
        this._panel.classList.remove('sp-visible');
        this._visible = false;
        setTimeout(() => {
            if (!this._visible) this._panel.style.display = 'none';
        }, 150);
    }

    _reposition(fabricObject) {
        const vb = this._getViewportBounds(fabricObject);
        if (!vb) return;

        const panelW = this._panel.offsetWidth || 320;
        const panelH = this._panel.offsetHeight || 36;

        const workspaceRect = this.cm.workspace.getBoundingClientRect();

        let x = vb.left + vb.width / 2 - panelW / 2;
        x = Math.max(workspaceRect.left + PANEL_MARGIN, Math.min(x, workspaceRect.right - panelW - PANEL_MARGIN));

        let y = vb.top - panelH - PANEL_OFFSET_Y;
        if (y < workspaceRect.top + PANEL_MARGIN) {
            y = vb.bottom + PANEL_OFFSET_Y;
        }

        this._panel.style.left = `${x}px`;
        this._panel.style.top = `${y}px`;
    }

    _getViewportBounds(fabricObject) {
        try {
            const br = fabricObject.getBoundingRect(true);
            const boardRect = this.cm.board.getBoundingClientRect();

            return {
                left: boardRect.left + br.left * this.cm.zoom,
                top: boardRect.top + br.top * this.cm.zoom,
                width: br.width * this.cm.zoom,
                height: br.height * this.cm.zoom,
                bottom: boardRect.top + (br.top + br.height) * this.cm.zoom,
            };
        } catch {
            return null;
        }
    }

    _updateDistributeState(fabricObject) {
        const count = fabricObject.type === 'activeSelection'
            ? fabricObject.getObjects().length
            : 1;

        const disabled = count < 3;
        ['sp-dist-h', 'sp-dist-v'].forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.disabled = disabled;
            btn.classList.toggle('sp-disabled', disabled);
        });
    }

    _flipH() {
        const obj = this.cm.canvas.getActiveObject();
        if (!obj) return;

        const targets = obj.type === 'activeSelection' ? obj.getObjects() : [obj];
        const prev = targets.map(o => ({ flipX: o.flipX }));

        targets.forEach(o => o.set('flipX', !o.flipX));
        if (obj.type === 'activeSelection') obj.setCoords();

        const next = targets.map(o => ({ flipX: o.flipX }));
        this.cm.historyManager.modifyCommand(targets, prev, next);
        this.cm.canvas.requestRenderAll();
        this.show(obj);
    }

    _flipV() {
        const obj = this.cm.canvas.getActiveObject();
        if (!obj) return;

        const targets = obj.type === 'activeSelection' ? obj.getObjects() : [obj];
        const prev = targets.map(o => ({ flipY: o.flipY }));

        targets.forEach(o => o.set('flipY', !o.flipY));
        if (obj.type === 'activeSelection') obj.setCoords();

        const next = targets.map(o => ({ flipY: o.flipY }));
        this.cm.historyManager.modifyCommand(targets, prev, next);
        this.cm.canvas.requestRenderAll();
        this.show(obj);
    }

    _align(direction) {
        const obj = this.cm.canvas.getActiveObject();
        if (!obj) return;

        const isMulti = obj.type === 'activeSelection';
        const targets = isMulti ? obj.getObjects() : [obj];
        const refBounds = isMulti
            ? obj.getBoundingRect(true)
            : { left: 0, top: 0, width: this.cm.canvas.width, height: this.cm.canvas.height };

        const prev = targets.map(o => ({ left: o.left, top: o.top }));

        targets.forEach(o => {
            const ow = o.getScaledWidth();
            const oh = o.getScaledHeight();
            const originX = o.originX || 'left';
            const originY = o.originY || 'top';

            switch (direction) {
                case 'left':
                    o.set('left', refBounds.left + (originX === 'center' ? ow / 2 : 0));
                    break;
                case 'center':
                    o.set('left', refBounds.left + refBounds.width / 2 + (originX === 'center' ? 0 : -ow / 2));
                    break;
                case 'right':
                    o.set('left', refBounds.left + refBounds.width - (originX === 'center' ? ow / 2 : ow));
                    break;
                case 'top':
                    o.set('top', refBounds.top + (originY === 'center' ? oh / 2 : 0));
                    break;
                case 'middle':
                    o.set('top', refBounds.top + refBounds.height / 2 + (originY === 'center' ? 0 : -oh / 2));
                    break;
                case 'bottom':
                    o.set('top', refBounds.top + refBounds.height - (originY === 'center' ? oh / 2 : oh));
                    break;
            }
            o.setCoords();
        });

        if (isMulti) obj.setCoords();

        const next = targets.map(o => ({ left: o.left, top: o.top }));
        this.cm.historyManager.modifyCommand(targets, prev, next);
        this.cm.canvas.requestRenderAll();
        this.show(obj);
    }

    _distribute(axis) {
        const obj = this.cm.canvas.getActiveObject();
        if (!obj || obj.type !== 'activeSelection') return;

        const targets = obj.getObjects();
        if (targets.length < 3) return;

        const prev = targets.map(o => ({ left: o.left, top: o.top }));

        if (axis === 'horizontal') {
            const sorted = [...targets].sort((a, b) => a.left - b.left);
            const first = sorted[0].left;
            const last = sorted[sorted.length - 1].left;
            const step = (last - first) / (sorted.length - 1);
            sorted.forEach((o, i) => { o.set('left', first + step * i); o.setCoords(); });
        } else {
            const sorted = [...targets].sort((a, b) => a.top - b.top);
            const first = sorted[0].top;
            const last = sorted[sorted.length - 1].top;
            const step = (last - first) / (sorted.length - 1);
            sorted.forEach((o, i) => { o.set('top', first + step * i); o.setCoords(); });
        }

        obj.setCoords();

        const next = targets.map(o => ({ left: o.left, top: o.top }));
        this.cm.historyManager.modifyCommand(targets, prev, next);
        this.cm.canvas.requestRenderAll();
        this.show(obj);
    }

    _bindCanvasEvents() {
        const canvas = this.cm.canvas;

        const onSelect = (e) => {
            if (this.cm.currentTool !== 'select') return;
            this.show(e.selected?.[0] ?? canvas.getActiveObject());
        };

        const onModified = () => {
            if (this.cm.currentTool !== 'select') return;
            const obj = canvas.getActiveObject();
            if (obj) this.show(obj);
        };

        const onMoving = () => this._deferHide();
        const onScaling = () => this._deferHide();

        canvas.on('selection:created', onSelect);
        canvas.on('selection:updated', onSelect);
        canvas.on('selection:cleared', () => this.hide());
        canvas.on('object:moving', onMoving);
        canvas.on('object:scaling', onScaling);
        canvas.on('object:rotating', onScaling);
        canvas.on('object:modified', onModified);
        canvas.on('mouse:wheel', () => this._deferShow());

        this.cm.workspace.addEventListener('pointermove', () => {
            if (this.cm.isPanning) this._deferHide();
        });

        this.cm.workspace.addEventListener('pointerup', () => {
            if (this.cm.currentTool !== 'select') return;
            const obj = canvas.getActiveObject();
            if (obj) this.show(obj);
        });
    }

    _deferHide() {
        clearTimeout(this._hideTimer);
        if (this._visible) this.hide();
    }

    _deferShow() {
        clearTimeout(this._hideTimer);
        this._deferHide();
        this._hideTimer = setTimeout(() => {
            if (this.cm.currentTool !== 'select') return;
            const obj = this.cm.canvas.getActiveObject();
            if (obj) this.show(obj);
        }, 120);
    }

    _injectStyles() {
        if (document.getElementById('sp-styles')) return;
        const style = document.createElement('style');
        style.id = 'sp-styles';
        style.textContent = `
            .sp-panel {
                position: fixed;
                z-index: 1000;
                display: none;
                align-items: center;
                gap: 2px;
                padding: 4px 6px;
                background: var(--bg-panel, #1a1a1a);
                border: 1px solid var(--border-strong, #404040);
                border-radius: 4px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.4);
                opacity: 0;
                transform: translateY(4px);
                transition: opacity 0.12s ease, transform 0.12s ease;
                pointer-events: auto;
                user-select: none;
            }

            .sp-panel.sp-visible {
                opacity: 1;
                transform: translateY(0);
            }

            .sp-group {
                display: flex;
                align-items: center;
                gap: 1px;
            }

            .sp-sep {
                width: 1px;
                height: 20px;
                background: var(--border-color, #2a2a2a);
                margin: 0 4px;
                flex-shrink: 0;
            }

            .sp-btn {
                width: 26px;
                height: 26px;
                padding: 4px;
                background: transparent;
                border: 1px solid transparent;
                border-radius: 3px;
                color: var(--text-secondary, #808080);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.1s, color 0.1s, border-color 0.1s;
                flex-shrink: 0;
            }

            .sp-btn svg {
                width: 14px;
                height: 14px;
                pointer-events: none;
            }

            .sp-btn:hover {
                background: rgba(192, 57, 43, 0.15);
                border-color: var(--accent-dim, #7a1f18);
                color: var(--text-primary, #e0e0e0);
            }

            .sp-btn:active {
                background: rgba(192, 57, 43, 0.28);
                border-color: var(--accent-color, #c0392b);
            }

            .sp-btn.sp-disabled {
                opacity: 0.35;
                pointer-events: none;
                cursor: default;
            }
        `;
        document.head.appendChild(style);
    }
}