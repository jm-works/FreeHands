import { alertModal } from './AlertModal.js';

export class FilterManager {
    constructor(canvasManager) {
        this.cm = canvasManager;
    }

    open() {
        const layerManager = this.cm.layerManager;
        const canvas = this.cm.canvas;
        const activeLayerId = layerManager.activeLayerId;

        if (!activeLayerId) {
            alertModal.show('No active layer to apply filter.');
            return;
        }

        const layerObjects = canvas.getObjects().filter(obj => obj.layerId === activeLayerId && !obj.isBg);
        if (layerObjects.length === 0) {
            alertModal.show('Active layer is empty.');
            return;
        }

        const filters = {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            blur: 0,
            hue: 0,
            sepia: 0,
            invert: 0
        };

        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';
        overlay.style.zIndex = '100001';
        overlay.style.display = 'flex';

        // Remove o fundo escuro e o blur para revelar o canvas em tempo real
        overlay.style.background = 'rgba(0, 0, 0, 0.1)';
        overlay.style.backdropFilter = 'none';

        // Move o modal para o canto superior direito para não cobrir o desenho
        overlay.style.justifyContent = 'flex-end';
        overlay.style.alignItems = 'flex-start';
        overlay.style.padding = '60px 20px 0 0';

        const modal = document.createElement('div');
        modal.className = 'custom-modal';
        modal.style.width = '360px';
        modal.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.8)';

        const title = document.createElement('div');
        title.className = 'custom-modal-message';
        title.textContent = 'Add Filter — Active Layer';
        modal.appendChild(title);

        const sliderDefs = [
            { key: 'brightness', label: 'Brightness', min: -1, max: 1, step: 0.01, default: 0 },
            { key: 'contrast', label: 'Contrast', min: -1, max: 1, step: 0.01, default: 0 },
            { key: 'saturation', label: 'Saturation', min: -1, max: 1, step: 0.01, default: 0 },
            { key: 'blur', label: 'Blur', min: 0, max: 1, step: 0.01, default: 0 },
            { key: 'hue', label: 'Hue Rotate', min: -1, max: 1, step: 0.01, default: 0 },
            { key: 'sepia', label: 'Sepia', min: 0, max: 1, step: 0.01, default: 0 },
            { key: 'invert', label: 'Invert', min: 0, max: 1, step: 0.01, default: 0 }
        ];

        const sliderGrid = document.createElement('div');
        sliderGrid.style.cssText = 'display:flex;flex-direction:column;gap:10px;max-height:340px;overflow-y:auto;padding-right:4px;';

        let previewImg = null;

        const buildFilters = () => {
            const list = [];
            if (filters.brightness !== 0) list.push(new fabric.Image.filters.Brightness({ brightness: filters.brightness }));
            if (filters.contrast !== 0) list.push(new fabric.Image.filters.Contrast({ contrast: filters.contrast }));
            if (filters.saturation !== 0) list.push(new fabric.Image.filters.Saturation({ saturation: filters.saturation }));
            if (filters.blur > 0) list.push(new fabric.Image.filters.Blur({ blur: filters.blur }));
            if (filters.hue !== 0) list.push(new fabric.Image.filters.HueRotation({ rotation: filters.hue }));
            if (filters.sepia > 0) list.push(new fabric.Image.filters.Sepia());
            if (filters.invert > 0) list.push(new fabric.Image.filters.Invert());
            return list;
        };

        const applyPreview = () => {
            if (!previewImg) return;
            previewImg.filters = buildFilters();
            previewImg.applyFilters();
            canvas.requestRenderAll();
        };

        sliderDefs.forEach(def => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;';

            const lbl = document.createElement('label');
            lbl.textContent = def.label;
            lbl.style.cssText = 'font-family:var(--font-ui);font-size:0.72rem;color:var(--text-secondary);text-transform:uppercase;width:90px;flex-shrink:0;';

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = def.min;
            slider.max = def.max;
            slider.step = def.step;
            slider.value = def.default;
            slider.style.cssText = 'flex:1;accent-color:var(--accent-color);cursor:pointer;';

            const valDisplay = document.createElement('span');
            valDisplay.textContent = '0.00';
            valDisplay.style.cssText = 'font-family:var(--font-ui);font-size:0.72rem;color:var(--text-accent);width:36px;text-align:right;flex-shrink:0;';

            slider.addEventListener('input', () => {
                const v = parseFloat(slider.value);
                filters[def.key] = v;
                valDisplay.textContent = v.toFixed(2);
                applyPreview();
            });

            row.appendChild(lbl);
            row.appendChild(slider);
            row.appendChild(valDisplay);
            sliderGrid.appendChild(row);
        });

        modal.appendChild(sliderGrid);

        const btnRow = document.createElement('div');
        btnRow.className = 'custom-modal-btns';

        const resetBtn = document.createElement('button');
        resetBtn.className = 'custom-modal-btn';
        resetBtn.textContent = 'Reset';
        resetBtn.style.marginRight = 'auto';
        resetBtn.onclick = () => {
            sliderGrid.querySelectorAll('input[type=range]').forEach((slider, i) => {
                slider.value = sliderDefs[i].default;
                filters[sliderDefs[i].key] = sliderDefs[i].default;
                slider.nextElementSibling.textContent = '0.00';
            });
            applyPreview();
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'custom-modal-btn cancel';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => {
            if (previewImg) {
                canvas.remove(previewImg);
                layerObjects.forEach(obj => { obj.visible = true; });
                canvas.requestRenderAll();
            }
            document.body.removeChild(overlay);
            window.removeEventListener('keydown', onKey, { capture: true });
        };

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'custom-modal-btn confirm';
        confirmBtn.textContent = 'Apply';
        confirmBtn.onclick = () => {
            if (!previewImg) {
                document.body.removeChild(overlay);
                window.removeEventListener('keydown', onKey, { capture: true });
                return;
            }
            layerObjects.forEach(obj => canvas.remove(obj));
            previewImg.set({
                layerId: activeLayerId,
                selectable: false,
                evented: false,
                hasControls: false,
                hasBorders: false
            });
            canvas.requestRenderAll();
            this.cm.historyManager.saveState();
            document.body.removeChild(overlay);
            window.removeEventListener('keydown', onKey, { capture: true });
        };

        btnRow.appendChild(resetBtn);
        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(confirmBtn);
        modal.appendChild(btnRow);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const onKey = (e) => {
            if (e.key === 'Escape') cancelBtn.onclick();
            if (e.key === 'Enter') confirmBtn.onclick();
        };
        window.addEventListener('keydown', onKey, { capture: true });

        const tempFabricCanvas = new fabric.StaticCanvas(null, {
            width: canvas.width,
            height: canvas.height
        });

        let cloneCount = 0;
        const sortedObjects = [...layerObjects].sort((a, b) => {
            return canvas.getObjects().indexOf(a) - canvas.getObjects().indexOf(b);
        });

        sortedObjects.forEach(obj => {
            obj.clone((cloned) => {
                tempFabricCanvas.add(cloned);
                cloneCount++;
                if (cloneCount === sortedObjects.length) {
                    tempFabricCanvas.renderAll();
                    const dataURL = tempFabricCanvas.toDataURL({ format: 'png' });
                    tempFabricCanvas.dispose();
                    fabric.Image.fromURL(dataURL, (img) => {
                        img.set({
                            left: 0,
                            top: 0,
                            layerId: activeLayerId,
                            selectable: false,
                            evented: false,
                            hasControls: false,
                            hasBorders: false,
                            originX: 'left',
                            originY: 'top'
                        });
                        previewImg = img;
                        layerObjects.forEach(obj => { obj.visible = false; });
                        canvas.add(previewImg);
                        layerManager.updateZIndices();
                        canvas.requestRenderAll();
                    });
                }
            });
        });
    }
}