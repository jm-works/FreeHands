import { alertModal } from './AlertModal.js';
import { colorPickerModal } from './ColorManager.js';

export class EffectManager {
    constructor(canvasManager) {
        this.cm = canvasManager;
    }

    async open() {
        const layerManager = this.cm.layerManager;
        const canvas = this.cm.canvas;
        const activeLayerId = layerManager.activeLayerId;

        if (!activeLayerId) {
            alertModal.show('No active layer to apply effects.');
            return;
        }

        const layerObjects = canvas.getObjects().filter(obj => obj.layerId === activeLayerId && !obj.isBg);
        if (layerObjects.length === 0) {
            alertModal.show('Active layer is empty.');
            return;
        }

        const prevURL = await this.cm.historyManager.captureLayerDataURL(activeLayerId);
        const prevObjects = this.cm.historyManager.snapshotLayerObjects(activeLayerId);

        const defaults = {
            globalOpacity: 1,
            shadowColor: '#000000',
            shadowOpacity: 0.5,
            shadowBlur: 0,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            tintColor: '#c0392b',
            tintOpacity: 0,
            noise: 0,
            pixelate: 1
        };

        const effects = { ...defaults };
        const domElements = {};

        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';
        overlay.style.zIndex = '100001';
        overlay.style.display = 'flex';
        overlay.style.background = 'rgba(0, 0, 0, 0.1)';
        overlay.style.backdropFilter = 'none';
        overlay.style.justifyContent = 'flex-end';
        overlay.style.alignItems = 'flex-start';
        overlay.style.padding = '60px 20px 0 0';

        const modal = document.createElement('div');
        modal.className = 'custom-modal';
        modal.style.width = '360px';
        modal.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.8)';

        const title = document.createElement('div');
        title.className = 'custom-modal-message';
        title.textContent = 'Layer Effects';
        modal.appendChild(title);

        const sliderGrid = document.createElement('div');
        sliderGrid.className = 'custom-modal-scroll';
        sliderGrid.style.cssText = 'display:flex;flex-direction:column;gap:10px;max-height:420px;overflow-y:auto;padding-right:12px;margin-top:10px;';

        let previewImg = null;

        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 0, 0';
        };

        const applyPreview = () => {
            if (!previewImg) return;

            previewImg.set('opacity', effects.globalOpacity);

            if (effects.shadowBlur > 0 || effects.shadowOffsetX !== 0 || effects.shadowOffsetY !== 0) {
                const rgb = hexToRgb(effects.shadowColor);
                previewImg.set('shadow', new fabric.Shadow({
                    color: `rgba(${rgb}, ${effects.shadowOpacity})`,
                    blur: effects.shadowBlur,
                    offsetX: effects.shadowOffsetX,
                    offsetY: effects.shadowOffsetY
                }));
            } else {
                previewImg.set('shadow', null);
            }

            const filters = [];

            if (effects.tintOpacity > 0) {
                filters.push(new fabric.Image.filters.BlendColor({
                    color: effects.tintColor,
                    mode: 'tint',
                    alpha: effects.tintOpacity
                }));
            }

            if (effects.noise > 0) {
                filters.push(new fabric.Image.filters.Noise({
                    noise: effects.noise
                }));
            }

            if (effects.pixelate > 1) {
                filters.push(new fabric.Image.filters.Pixelate({
                    blocksize: effects.pixelate
                }));
            }

            previewImg.filters = filters;
            previewImg.applyFilters();

            canvas.requestRenderAll();
        };

        const sections = [
            {
                title: 'General',
                items: [
                    { type: 'slider', key: 'globalOpacity', label: 'Opacity', min: 0, max: 1, step: 0.01 }
                ]
            },
            {
                title: 'Drop Shadow / Glow',
                items: [
                    { type: 'color', key: 'shadowColor', label: 'Color' },
                    { type: 'slider', key: 'shadowOpacity', label: 'Alpha', min: 0, max: 1, step: 0.01 },
                    { type: 'slider', key: 'shadowBlur', label: 'Blur', min: 0, max: 100, step: 1 },
                    { type: 'slider', key: 'shadowOffsetX', label: 'Offset X', min: -100, max: 100, step: 1 },
                    { type: 'slider', key: 'shadowOffsetY', label: 'Offset Y', min: -100, max: 100, step: 1 }
                ]
            },
            {
                title: 'Color Overlay (Tint)',
                items: [
                    { type: 'color', key: 'tintColor', label: 'Color' },
                    { type: 'slider', key: 'tintOpacity', label: 'Alpha', min: 0, max: 1, step: 0.01 }
                ]
            },
            {
                title: 'Stylize',
                items: [
                    { type: 'slider', key: 'noise', label: 'Noise', min: 0, max: 1000, step: 1 },
                    { type: 'slider', key: 'pixelate', label: 'Pixelate', min: 1, max: 50, step: 1 }
                ]
            }
        ];

        sections.forEach(sec => {
            const secTitle = document.createElement('div');
            secTitle.textContent = sec.title;
            secTitle.style.cssText = 'font-family:var(--font-ui);font-size:0.75rem;color:var(--accent-color);margin-top:8px;border-bottom:1px solid var(--border-strong);padding-bottom:4px;text-transform:uppercase;letter-spacing:1px;';
            sliderGrid.appendChild(secTitle);

            sec.items.forEach(def => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;gap:8px;';

                const lbl = document.createElement('label');
                lbl.textContent = def.label;
                lbl.style.cssText = 'font-family:var(--font-ui);font-size:0.72rem;color:var(--text-secondary);text-transform:uppercase;width:80px;flex-shrink:0;';

                if (def.type === 'slider') {
                    const slider = document.createElement('input');
                    slider.type = 'range';
                    slider.min = def.min;
                    slider.max = def.max;
                    slider.step = def.step;
                    slider.value = defaults[def.key];
                    slider.style.cssText = 'flex:1;accent-color:var(--accent-color);cursor:pointer;';

                    const valDisplay = document.createElement('span');
                    valDisplay.textContent = defaults[def.key].toFixed(def.step < 1 ? 2 : 0);
                    valDisplay.style.cssText = 'font-family:var(--font-ui);font-size:0.72rem;color:var(--text-accent);width:36px;text-align:right;flex-shrink:0;';

                    slider.addEventListener('input', () => {
                        const v = parseFloat(slider.value);
                        effects[def.key] = v;
                        valDisplay.textContent = v.toFixed(def.step < 1 ? 2 : 0);
                        applyPreview();
                    });

                    row.appendChild(lbl);
                    row.appendChild(slider);
                    row.appendChild(valDisplay);
                    sliderGrid.appendChild(row);

                    domElements[def.key] = { type: 'slider', input: slider, display: valDisplay, step: def.step };

                } else if (def.type === 'color') {
                    const colorInput = document.createElement('div');
                    colorInput.style.cssText = 'flex:1;height:24px;background-color:' + defaults[def.key] + ';border:1px solid var(--border-strong);cursor:pointer;';

                    colorInput.addEventListener('click', () => {
                        colorPickerModal.show(effects[def.key], (newColor) => {
                            effects[def.key] = newColor;
                            colorInput.style.backgroundColor = newColor;
                            applyPreview();
                        });
                    });

                    row.appendChild(lbl);
                    row.appendChild(colorInput);
                    sliderGrid.appendChild(row);

                    domElements[def.key] = { type: 'color', input: colorInput };
                }
            });
        });

        modal.appendChild(sliderGrid);

        const btnRow = document.createElement('div');
        btnRow.className = 'custom-modal-btns';
        btnRow.style.marginTop = '15px';

        const resetBtn = document.createElement('button');
        resetBtn.className = 'custom-modal-btn';
        resetBtn.textContent = 'Reset';
        resetBtn.style.marginRight = 'auto';
        resetBtn.onclick = () => {
            Object.keys(defaults).forEach(key => {
                effects[key] = defaults[key];
                if (domElements[key]) {
                    if (domElements[key].type === 'slider') {
                        domElements[key].input.value = defaults[key];
                        domElements[key].display.textContent = defaults[key].toFixed(domElements[key].step < 1 ? 2 : 0);
                    } else if (domElements[key].type === 'color') {
                        domElements[key].input.style.backgroundColor = defaults[key];
                    }
                }
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
        confirmBtn.onclick = async () => {
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

            const nextURL = await this.cm.historyManager.captureLayerDataURL(activeLayerId);
            this.cm.historyManager.rasterCommand(prevURL, nextURL, activeLayerId, prevObjects);

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