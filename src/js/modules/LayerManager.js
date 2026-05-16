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
            layerId: this.activeLayerId
        });
        this.canvas.add(bgRect);
        this.canvasManager.historyManager.undoStack = [];
        this.canvasManager.historyManager.saveState();

        document.addEventListener('click', () => this.closeContextMenu());
    }

    initUI() {
        this.container.innerHTML = '';

        this.toolbar = document.createElement('div');
        this.toolbar.className = 'layer-toolbar';
        this.toolbar.innerHTML = `
            <div style="display: flex; gap: 4px;">
                <button class="layer-btn" id="btn-add-layer" title="New Layer">+</button>
                <button class="layer-btn" id="btn-up-layer" title="Move Up">↑</button>
                <button class="layer-btn" id="btn-down-layer" title="Move Down">↓</button>
            </div>
            <button class="layer-btn layer-btn-delete" id="btn-delete-layer" title="Delete">
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
            </select>
            <input type="range" id="layer-opacity-slider" min="0" max="100" value="100" style="flex:1;">
            <span id="layer-opacity-label">100%</span>
        `;

        this.listContainer = document.createElement('div');
        this.listContainer.className = 'layer-list-container';

        this.container.appendChild(this.toolbar);
        this.container.appendChild(this.controlsContainer);
        this.container.appendChild(this.listContainer);

        document.getElementById('btn-add-layer').onclick = () => this.addLayer();
        document.getElementById('btn-delete-layer').onclick = () => this.deleteLayer();
        document.getElementById('btn-up-layer').onclick = () => this.moveLayer(-1);
        document.getElementById('btn-down-layer').onclick = () => this.moveLayer(1);

        document.getElementById('layer-opacity-slider').oninput = (e) => this.setLayerProperty('opacity', e.target.value);
        document.getElementById('layer-blend-mode').onchange = (e) => this.setLayerProperty('blendMode', e.target.value);
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
        this.canvasManager.historyManager.saveState();
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
            fabric.util.enlivenObjects(objectsToClone, (clones) => {
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
            objectsToRemove.forEach(obj => this.canvas.remove(obj));
            this.layers.splice(index, 1);

            const nextIndex = Math.min(index, this.layers.length - 1);
            this.setActiveLayer(this.layers[nextIndex].id);
            this.canvasManager.historyManager.saveState();
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
            this.canvasManager.historyManager.saveState();
        }
    }

    setActiveLayer(id) {
        this.activeLayerId = id;

        const layer = this.layers.find(l => l.id === id);
        if (layer) {
            document.getElementById('layer-opacity-slider').value = layer.opacity;
            document.getElementById('layer-opacity-label').textContent = `${layer.opacity}%`;
            document.getElementById('layer-blend-mode').value = layer.blendMode;
        }

        this.renderUI();
    }

    setLayerProperty(prop, value) {
        const layer = this.layers.find(l => l.id === this.activeLayerId);
        if (!layer) return;

        if (prop === 'opacity') {
            layer.opacity = value;
            document.getElementById('layer-opacity-label').textContent = `${value}%`;
        } else if (prop === 'blendMode') {
            layer.blendMode = value;
        }

        this.canvas.requestRenderAll();
    }

    toggleState(id, prop) {
        const layer = this.layers.find(l => l.id === id);
        if (!layer) return;

        layer[prop] = !layer[prop];

        if (prop === 'visible') {
            this.canvas.requestRenderAll();
        }
        this.renderUI();
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
                layer.name = newName.trim();
                this.canvasManager.historyManager.saveState();
                this.renderUI();
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
        this.activeLayerId = state.activeLayerId;

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

        this.layers.forEach(layer => {
            const item = document.createElement('div');
            item.className = `layer-item ${layer.id === this.activeLayerId ? 'active' : ''}`;
            item.onclick = () => this.setActiveLayer(layer.id);
            item.oncontextmenu = (e) => this.showContextMenu(e, layer.id);

            const visIcon = document.createElement('span');
            visIcon.className = 'layer-icon';
            visIcon.innerHTML = `<img src="src/assets/icons/Layer/${layer.visible ? 'Layer_On.svg' : 'layer-Off.svg'}" alt="Visibility">`;
            visIcon.style.opacity = layer.visible ? '1' : '0.4';
            visIcon.onclick = (e) => { e.stopPropagation(); this.toggleState(layer.id, 'visible'); };

            const lockIcon = document.createElement('span');
            lockIcon.className = 'layer-icon';
            lockIcon.innerHTML = `<img src="src/assets/icons/Layer/${layer.locked ? 'layer-locked.svg' : 'layer-unlocked.svg'}" alt="Lock">`;
            lockIcon.style.opacity = layer.locked ? '1' : '0.4';
            lockIcon.onclick = (e) => { e.stopPropagation(); this.toggleState(layer.id, 'locked'); };

            const nameSpan = document.createElement('span');
            nameSpan.className = 'layer-name';
            nameSpan.textContent = layer.name;
            if (layer.locked) nameSpan.style.opacity = '0.5';
            nameSpan.ondblclick = (e) => { e.stopPropagation(); this.promptRename(layer); };

            item.appendChild(visIcon);
            item.appendChild(lockIcon);
            item.appendChild(nameSpan);

            this.listContainer.appendChild(item);
        });
    }
}