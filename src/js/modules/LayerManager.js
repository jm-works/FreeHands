import { promptModal } from './PromptModal.js';

export class LayerManager {
    constructor(canvasManager) {
        this.canvasManager = canvasManager;
        this.canvasManager.layerManager = this;
        this.canvas = canvasManager.canvas;
        this.container = document.getElementById('layers-list');

        this.layers = [];
        this.activeLayerId = null;
        this.contextMenu = null;

        this.initUI();
        this.setupCanvasEvents();

        this.addLayer('Background');

        const bgRect = new fabric.Rect({
            left: 0,
            top: 0,
            width: this.canvas.width,
            height: this.canvas.height,
            fill: '#ffffff',
            selectable: false,
            evented: false,
            layerId: this.activeLayerId,
            isBg: true
        });
        this.canvas.add(bgRect);
        this.canvasManager.historyManager.ops = [];
        this.canvasManager.historyManager.cursor = -1;
        this.canvasManager.historyManager.snapshots = [];
        this.canvasManager.historyManager.saveState();

        document.addEventListener('click', () => this.closeContextMenu());
    }

    initUI() {
        this.container.innerHTML = '';

        this.toolbar = document.createElement('div');
        this.toolbar.className = 'layer-toolbar';
        this.toolbar.innerHTML = `
            <div class="layer-btn-group">
                <button class="layer-btn" id="btn-add-layer" title="New Layer">+</button>
                <button class="layer-btn" id="btn-up-layer" title="Move Up">↑</button>
                <button class="layer-btn" id="btn-down-layer" title="Move Down">↓</button>
            </div>
            <button class="layer-btn layer-btn-delete" id="btn-delete-layer" title="Delete Layer">
                <img src="src/assets/icons/Layer/deletelayer.svg" alt="Delete">
            </button>
        `;

        this.controlsContainer = document.createElement('div');
        this.controlsContainer.className = 'layer-opacity-container';
        this.controlsContainer.innerHTML = `
            <select id="layer-blend-mode" class="layer-blend-select" title="Blend Mode">
                <option value="source-over">Normal</option>
                <option value="multiply">Multiply</option>
                <option value="screen">Screen</option>
                <option value="overlay">Overlay</option>
                <option value="darken">Darken</option>
                <option value="lighten">Lighten</option>
                <option value="color-dodge">Dodge</option>
                <option value="color-burn">Burn</option>
            </select>
            <input type="range" id="layer-opacity-slider" min="0" max="100" value="100" style="flex:1;">
            <span id="layer-opacity-label">100%</span>
        `;

        this.listContainer = document.createElement('div');
        this.listContainer.className = 'layer-list-container';

        this.container.appendChild(this.toolbar);
        this.container.appendChild(this.controlsContainer);
        this.container.appendChild(this.listContainer);
        this._setupContainerDrop();

        document.getElementById('btn-add-layer').onclick = () => this.addLayer();
        document.getElementById('btn-delete-layer').onclick = () => this.deleteLayer();
        document.getElementById('btn-up-layer').onclick = () => this.moveLayer(-1);
        document.getElementById('btn-down-layer').onclick = () => this.moveLayer(1);

        const opacitySlider = document.getElementById('layer-opacity-slider');
        opacitySlider.addEventListener('mousedown', (e) => { this._prevOpacity = e.target.value; });
        opacitySlider.addEventListener('input', (e) => { this.setLayerProperty('opacity', e.target.value, false); });
        opacitySlider.addEventListener('change', (e) => { this.setLayerProperty('opacity', e.target.value, true, this._prevOpacity); });

        const blendSelect = document.getElementById('layer-blend-mode');
        blendSelect.addEventListener('focus', (e) => {
            if (!this._suppressPropertyCommit) this._prevBlend = e.target.value;
        });
        blendSelect.addEventListener('change', (e) => { this.setLayerProperty('blendMode', e.target.value, true, this._prevBlend); });
    }

    setupCanvasEvents() {
        this.canvas.on('object:added', (e) => {
            if (e.target && !e.target.layerId) {
                e.target.layerId = this.activeLayerId;
                this.updateZIndices();
            }
        });
    }

    addLayer(name = `Layer ${this.layers.length + 1}`) {
        const layer = {
            id: 'layer_' + Date.now(),
            name: name,
            visible: true,
            locked: false,
            opacity: 100,
            blendMode: 'source-over'
        };

        this.layers.unshift(layer);
        this.setActiveLayer(layer.id);
        this.canvasManager.historyManager.layerCommand('add', { layer: { ...layer }, insertIndex: 0 });
    }

    duplicateLayer(id) {
        const layerToDup = this.layers.find(l => l.id === id);
        if (!layerToDup) return;

        const newId = 'layer_' + Date.now();
        const newLayer = { ...layerToDup, id: newId, name: layerToDup.name + ' copy' };

        const index = this.layers.findIndex(l => l.id === id);
        this.layers.splice(index, 0, newLayer);

        const objectsToClone = this.canvas.getObjects().filter(obj => obj.layerId === id);
        if (objectsToClone.length > 0) {
            const clonePromises = objectsToClone.map(obj => new Promise(resolve => obj.clone(resolve)));
            Promise.all(clonePromises).then(clones => {
                clones.forEach(clone => {
                    clone.layerId = newId;
                    this.canvas.add(clone);
                });
                this.setActiveLayer(newId);
                this.updateZIndices();
                this.canvasManager.historyManager.saveState();
            });
        } else {
            this.setActiveLayer(newId);
            this.updateZIndices();
        }
    }

    mergeDown(id) {
        const index = this.layers.findIndex(l => l.id === id);
        if (index >= this.layers.length - 1) return;

        const layer = this.layers[index];
        const layerBelow = this.layers[index + 1];

        const objects = this.canvas.getObjects().filter(obj => obj.layerId === id);
        objects.forEach(obj => {
            obj.layerId = layerBelow.id;
            obj.opacity = (obj.opacity || 1) * (layer.opacity / 100);
            if (layer.blendMode !== 'source-over' && !obj.isEraser) {
                obj.globalCompositeOperation = layer.blendMode;
            }
        });

        this.layers.splice(index, 1);
        this.setActiveLayer(layerBelow.id);
        this.canvasManager.historyManager.saveState();
    }

    deleteLayer(targetId = this.activeLayerId) {
        if (this.layers.length <= 1) return;

        const layer = this.layers.find(l => l.id === targetId);
        if (layer && layer.locked) return;

        const index = this.layers.findIndex(l => l.id === targetId);
        if (index > -1) {
            const objectsToRemove = this.canvas.getObjects().filter(obj => obj.layerId === targetId);

            const removedObjectsJSON = objectsToRemove.map(obj => ({
                json: obj.toObject(['layerId', 'isBg', 'isEraser', '__uid']),
                index: this.canvas.getObjects().indexOf(obj)
            }));

            objectsToRemove.forEach(obj => this.canvas.remove(obj));
            this.layers.splice(index, 1);

            const nextIndex = Math.min(index, this.layers.length - 1);
            this.setActiveLayer(this.layers[nextIndex].id);
            this.canvasManager.historyManager.layerCommand('delete', { layer: { ...layer }, index, removedObjectsJSON });
        }
    }

    moveLayer(direction) {
        const index = this.layers.findIndex(l => l.id === this.activeLayerId);
        const newIndex = index + direction;

        if (newIndex >= 0 && newIndex < this.layers.length) {
            const temp = this.layers[index];
            this.layers[index] = this.layers[newIndex];
            this.layers[newIndex] = temp;
            this.updateZIndices();
            this.renderUI();
            this.canvasManager.historyManager.layerCommand('move', { fromIndex: index, toIndex: newIndex });
        }
    }

    setActiveLayer(id) {
        this.activeLayerId = id;

        const layer = this.layers.find(l => l.id === id);
        if (layer) {
            this._suppressPropertyCommit = true;
            document.getElementById('layer-opacity-slider').value = layer.opacity;
            document.getElementById('layer-opacity-label').textContent = `${layer.opacity}%`;
            document.getElementById('layer-blend-mode').value = layer.blendMode;
            setTimeout(() => { this._suppressPropertyCommit = false; }, 0);
        }

        this.renderUI();
    }

    setLayerProperty(prop, value, commit = true, prevValue = null) {
        const layer = this.layers.find(l => l.id === this.activeLayerId);
        if (!layer) return;

        if (prop === 'opacity') {
            layer.opacity = value;
            document.getElementById('layer-opacity-label').textContent = `${value}%`;
        } else if (prop === 'blendMode') {
            layer.blendMode = value;
        }

        this._updateActiveLayerMeta();
        this.canvas.requestRenderAll();

        if (commit && prevValue !== null && prevValue !== value) {
            if (this.canvasManager.historyManager.isProcessing) return;
            this.canvasManager.historyManager.layerCommand('property', {
                id: layer.id,
                prop,
                prevValue,
                nextValue: value
            });
        }
    }

    _updateActiveLayerMeta() {
        const layer = this.layers.find(l => l.id === this.activeLayerId);
        if (!layer) return;
        const item = this.listContainer.querySelector(`[data-layer-id="${layer.id}"]`);
        if (!item) return;
        const meta = item.querySelector('.layer-meta');
        if (!meta) return;
        const blendLabel = { 'source-over': 'Normal', 'multiply': 'Multiply', 'screen': 'Screen', 'overlay': 'Overlay', 'darken': 'Darken', 'lighten': 'Lighten', 'color-dodge': 'Dodge', 'color-burn': 'Burn' };
        meta.textContent = `${layer.opacity}%  ·  ${blendLabel[layer.blendMode] || layer.blendMode}`;
    }

    toggleState(id, prop) {
        const layer = this.layers.find(l => l.id === id);
        if (!layer) return;

        layer[prop] = !layer[prop];

        if (prop === 'visible') {
            this.canvas.requestRenderAll();
        }
        this.renderUI();
        this.canvasManager.historyManager.saveState();
    }

    updateZIndices() {
        this.canvas._objects.sort((a, b) => {
            const indexA = this.layers.findIndex(l => l.id === a.layerId);
            const indexB = this.layers.findIndex(l => l.id === b.layerId);

            if (indexA === indexB) return 0;

            return indexB - indexA;
        });
        this.canvas.requestRenderAll();
    }

    showContextMenu(e, layerId) {
        e.preventDefault();
        this.closeContextMenu();
        this.setActiveLayer(layerId);

        this.contextMenu = document.createElement('div');
        this.contextMenu.className = 'layer-context-menu';

        const layer = this.layers.find(l => l.id === layerId);

        const options = [
            { label: 'Rename', action: () => this.promptRename(layer) },
            { label: 'Duplicate Layer', action: () => this.duplicateLayer(layerId) },
            { label: 'Merge Down', action: () => this.mergeDown(layerId) },
            { label: 'Delete', action: () => this.deleteLayer(layerId) }
        ];

        options.forEach(opt => {
            const item = document.createElement('div');
            item.className = 'layer-context-menu-item';
            item.textContent = opt.label;
            item.onclick = (ev) => {
                ev.stopPropagation();
                opt.action();
                this.closeContextMenu();
            };
            this.contextMenu.appendChild(item);
        });

        document.body.appendChild(this.contextMenu);

        const menuRect = this.contextMenu.getBoundingClientRect();
        let top = e.clientY;
        let left = e.clientX;

        if (left + menuRect.width > window.innerWidth) {
            left = window.innerWidth - menuRect.width - 5;
        }

        if (top + menuRect.height > window.innerHeight) {
            top = window.innerHeight - menuRect.height - 5;
        }

        this.contextMenu.style.top = `${top}px`;
        this.contextMenu.style.left = `${left}px`;
    }

    closeContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
        }
    }

    promptRename(layer) {
        promptModal.show('New layer name:', layer.name, (newName) => {
            if (newName && newName.trim() !== '') {
                const prevName = layer.name;
                layer.name = newName.trim();
                this.renderUI();
                this.canvasManager.historyManager.layerCommand('rename', { id: layer.id, prevName, nextName: layer.name });
            }
        });
    }

    getLayersState() {
        return {
            layers: JSON.parse(JSON.stringify(this.layers)),
            activeLayerId: this.activeLayerId
        };
    }

    restoreLayersState(state) {
        this.layers = JSON.parse(JSON.stringify(state.layers));

        const currentLayerExists = this.layers.some(l => l.id === this.activeLayerId);

        if (!currentLayerExists || !this.activeLayerId) {
            this.activeLayerId = state.activeLayerId;
        }

        const layer = this.layers.find(l => l.id === this.activeLayerId);
        if (layer) {
            const opacitySlider = document.getElementById('layer-opacity-slider');
            const opacityLabel = document.getElementById('layer-opacity-label');
            const blendSelect = document.getElementById('layer-blend-mode');

            if (opacitySlider) opacitySlider.value = layer.opacity;
            if (opacityLabel) opacityLabel.textContent = `${layer.opacity}%`;
            if (blendSelect) blendSelect.value = layer.blendMode;
        }

        this.renderUI();
    }

    renderUI() {
        this.listContainer.innerHTML = '';

        this.layers.forEach((layer, index) => {
            const item = document.createElement('div');
            item.className = `layer-item ${layer.id === this.activeLayerId ? 'active' : ''}`;
            item.dataset.layerId = layer.id;
            item.draggable = true;
            if (!layer.visible) item.style.opacity = '0.45';
            item.onclick = () => this.setActiveLayer(layer.id);
            item.oncontextmenu = (e) => this.showContextMenu(e, layer.id);

            this._setupDragEvents(item, layer.id);

            const dragHandle = document.createElement('span');
            dragHandle.className = 'layer-drag-handle';
            dragHandle.innerHTML = '&#8942;&#8942;';
            dragHandle.title = 'Drag to reorder';

            const info = document.createElement('div');
            info.className = 'layer-info';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'layer-name';
            nameSpan.textContent = layer.name;
            nameSpan.ondblclick = (e) => { e.stopPropagation(); this.promptRename(layer); };

            const meta = document.createElement('span');
            meta.className = 'layer-meta';
            const blendLabel = { 'source-over': 'Normal', 'multiply': 'Multiply', 'screen': 'Screen', 'overlay': 'Overlay', 'darken': 'Darken', 'lighten': 'Lighten', 'color-dodge': 'Dodge', 'color-burn': 'Burn' };
            meta.textContent = `${layer.opacity}%  ·  ${blendLabel[layer.blendMode] || layer.blendMode}`;

            info.appendChild(nameSpan);
            info.appendChild(meta);

            const icons = document.createElement('div');
            icons.className = 'layer-icons';

            const visIcon = document.createElement('span');
            visIcon.className = `layer-icon ${layer.visible ? 'active-icon' : ''}`;
            visIcon.title = layer.visible ? 'Hide layer' : 'Show layer';
            visIcon.innerHTML = `<img src="src/assets/icons/Layer/${layer.visible ? 'Layer_On.svg' : 'layer-Off.svg'}" alt="Visibility">`;
            visIcon.onclick = (e) => { e.stopPropagation(); this.toggleState(layer.id, 'visible'); };

            const lockIcon = document.createElement('span');
            lockIcon.className = `layer-icon ${layer.locked ? 'active-icon' : ''}`;
            lockIcon.title = layer.locked ? 'Unlock layer' : 'Lock layer';
            lockIcon.innerHTML = `<img src="src/assets/icons/Layer/${layer.locked ? 'layer-locked.svg' : 'layer-unlocked.svg'}" alt="Lock">`;
            lockIcon.onclick = (e) => { e.stopPropagation(); this.toggleState(layer.id, 'locked'); };

            icons.appendChild(visIcon);
            icons.appendChild(lockIcon);

            item.appendChild(dragHandle);
            item.appendChild(info);
            item.appendChild(icons);

            this.listContainer.appendChild(item);
        });
    }

    _setupDragEvents(item, layerId) {
        item.addEventListener('dragstart', (e) => {
            this._dragSrcId = layerId;
            e.dataTransfer.effectAllowed = 'move';
            item.classList.add('layer-dragging');
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('layer-dragging');
            this._clearDropIndicators();
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            this._clearDropIndicators();
            if (layerId !== this._dragSrcId) item.classList.add('layer-drop-over');
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            this._clearDropIndicators();
            if (!this._dragSrcId || this._dragSrcId === layerId) return;

            const fromIndex = this.layers.findIndex(l => l.id === this._dragSrcId);
            const toIndex = this.layers.findIndex(l => l.id === layerId);
            if (fromIndex === -1 || toIndex === -1) return;

            const [moved] = this.layers.splice(fromIndex, 1);
            this.layers.splice(toIndex, 0, moved);

            this.updateZIndices();
            this.renderUI();
            this.canvasManager.historyManager.layerCommand('move', { fromIndex, toIndex });
            this._dragSrcId = null;
        });
    }

    _clearDropIndicators() {
        this.listContainer.querySelectorAll('.layer-drop-over').forEach(el => el.classList.remove('layer-drop-over'));
        this.listContainer.classList.remove('layer-drop-after');
    }

    _setupContainerDrop() {
        this.listContainer.addEventListener('dragover', (e) => {
            const items = [...this.listContainer.querySelectorAll('.layer-item')];
            if (!items.length) return;
            const last = items[items.length - 1];
            const rect = last.getBoundingClientRect();
            if (e.clientY > rect.bottom) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                this._clearDropIndicators();
                this.listContainer.classList.add('layer-drop-after');
            }
        });

        this.listContainer.addEventListener('dragleave', (e) => {
            if (!this.listContainer.contains(e.relatedTarget)) {
                this.listContainer.classList.remove('layer-drop-after');
            }
        });

        this.listContainer.addEventListener('drop', (e) => {
            const items = [...this.listContainer.querySelectorAll('.layer-item')];
            if (!items.length) return;
            const last = items[items.length - 1];
            const rect = last.getBoundingClientRect();
            if (e.clientY > rect.bottom) {
                e.preventDefault();
                this._clearDropIndicators();
                if (!this._dragSrcId) return;

                const fromIndex = this.layers.findIndex(l => l.id === this._dragSrcId);
                if (fromIndex === -1) return;

                const [moved] = this.layers.splice(fromIndex, 1);
                this.layers.push(moved);

                const toIndex = this.layers.length - 1;

                this.updateZIndices();
                this.renderUI();
                this.canvasManager.historyManager.layerCommand('move', { fromIndex, toIndex });
                this._dragSrcId = null;
            }
        });
    }
}