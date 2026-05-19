import { CanvasManager } from './modules/canva/CanvasManager.js';
import { ColorManager } from './modules/ColorManager.js';
import { IntroManager } from './modules/IntroManager.js';
import { MenuManager } from './modules/MenuManager.js';
import { promptModal } from './modules/PromptModal.js';
import { alertModal } from './modules/AlertModal.js';
import { FilterManager } from './modules/FilterManager.js';
import { EffectManager } from './modules/EffectManager.js';

document.addEventListener('DOMContentLoaded', () => {

    document.addEventListener('contextmenu', (e) => e.preventDefault());

    const tapSound = new Audio('src/assets/sound/tap.mp3');

    document.addEventListener('mousedown', (e) => {
        const elementosInterativos = 'button, .menu-item, input, select, .palette-color, .layer-item, .layer-icon, .layer-context-menu-item';
        if (e.target.closest(elementosInterativos)) {
            tapSound.currentTime = 0;
            tapSound.play().catch(() => { });
        }
    });

    const introManager = new IntroManager('fh-root', 'fh-c');

    const canvasManager = new CanvasManager('drawing-canvas');
    const filterManager = new FilterManager(canvasManager);
    const effectManager = new EffectManager(canvasManager);

    const topMenuManager = new MenuManager(canvasManager);

    topMenuManager.registerMenu('menu-file', [
        {
            label: 'Place Image',
            action: () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        canvasManager.placeImage(ev.target.result);
                    };
                    reader.readAsDataURL(file);
                };
                input.click();
            }
        },
        { type: 'separator' },
        {
            label: 'Save Image',
            action: () => {
                promptModal.show('Enter the name to save the image:', 'FreeHands_Artwork', (fileName) => {
                    if (fileName === null) return;
                    if (fileName.trim() === '') {
                        fileName = 'FreeHands_Artwork';
                    }

                    if (!fileName.toLowerCase().endsWith('.png')) {
                        fileName += '.png';
                    }

                    const dataURL = canvasManager.canvas.toDataURL({
                        format: 'png',
                        quality: 1
                    });

                    const link = document.createElement('a');
                    link.download = fileName;
                    link.href = dataURL;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                });
            }
        }
    ]);

    topMenuManager.registerMenu('menu-edit', [
        {
            label: 'BG Size',
            action: () => {
                promptModal.show('Width x Height (e.g. 1920x1080):', `${canvasManager.canvas.width}x${canvasManager.canvas.height}`, (val) => {
                    if (!val) return;
                    const parts = val.toLowerCase().split('x');
                    if (parts.length === 2) {
                        const w = parseInt(parts[0].trim(), 10);
                        const h = parseInt(parts[1].trim(), 10);
                        if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
                            if (w > 1920 || h > 1080) {
                                alertModal.show('Maximum size allowed is 1920x1080px!');
                                return;
                            }
                            canvasManager.resizeCanvas(w, h);
                            const sizeDisplay = document.getElementById('canvas-size-display');
                            if (sizeDisplay) {
                                sizeDisplay.textContent = `${w} x ${h} px`;
                            }
                        } else {
                            alertModal.show('Invalid dimensions!');
                        }
                    }
                });
            }
        },
        {
            label: 'Add Effects',
            action: () => {
                effectManager.open();
            }
        },
        {
            label: 'Add Filter',
            action: () => {
                filterManager.open();
            }
        },
        {
            label: 'Change Paper Texture',
            action: () => {
                const textures = [
                    { id: 'none', label: 'Plain White' },
                    { id: 'grain', label: 'Paper Grain' },
                    { id: 'watercolor', label: 'Watercolor Paper' },
                    { id: 'canvas_fabric', label: 'Canvas' },
                    { id: 'parchment', label: 'Parchment' },
                    { id: 'kraft', label: 'Kraft Paper' },
                    { id: 'grid', label: 'Grid' },
                    { id: 'dots', label: 'Dot Grid' }
                ];

                const overlay = document.createElement('div');
                overlay.className = 'custom-modal-overlay';
                overlay.style.zIndex = '100001';
                overlay.style.display = 'flex';

                const modal = document.createElement('div');
                modal.className = 'custom-modal';
                modal.style.width = '320px';

                const title = document.createElement('div');
                title.className = 'custom-modal-message';
                title.textContent = 'Select Paper Texture';

                const grid = document.createElement('div');
                grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;max-height:280px;overflow-y:auto;padding-right:4px;';

                textures.forEach(t => {
                    const btn = document.createElement('button');
                    btn.className = 'custom-modal-btn';
                    btn.style.cssText = 'width:100%;padding:10px 8px;text-align:center;cursor:pointer;font-size:0.72rem;';
                    btn.textContent = t.label;
                    btn.onclick = () => {
                        document.body.removeChild(overlay);
                        canvasManager.setPaperTexture(t.id);
                    };
                    grid.appendChild(btn);
                });

                const cancelRow = document.createElement('div');
                cancelRow.className = 'custom-modal-btns';
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'custom-modal-btn cancel';
                cancelBtn.textContent = 'Cancel';
                cancelBtn.onclick = () => document.body.removeChild(overlay);
                cancelRow.appendChild(cancelBtn);

                const onKey = (e) => {
                    if (e.key === 'Escape') {
                        document.body.removeChild(overlay);
                        window.removeEventListener('keydown', onKey, { capture: true });
                    }
                };
                window.addEventListener('keydown', onKey, { capture: true });

                modal.appendChild(title);
                modal.appendChild(grid);
                modal.appendChild(cancelRow);
                overlay.appendChild(modal);
                document.body.appendChild(overlay);
            }
        }
    ]);

    const colorManager = new ColorManager('color-wheel-canvas', (color) => {
        canvasManager.setBrushColor(color);
    });

    const sizeContainer = document.getElementById('size-container');
    const sizeSlider = document.getElementById('brush-size');
    const sizeInput = document.getElementById('brush-size-val');

    const opacityContainer = document.getElementById('opacity-container');
    const opacitySlider = document.getElementById('brush-opacity');
    const opacityInput = document.getElementById('brush-opacity-val');

    const toleranceContainer = document.getElementById('tolerance-container');
    const toleranceSlider = document.getElementById('fill-tolerance');
    const toleranceInput = document.getElementById('fill-tolerance-val');

    const toolBtns = document.querySelectorAll('.tool-btn');

    function syncControls(slider, numberInput, callback) {
        const updateSliderFill = () => {
            const min = parseFloat(slider.min) || 0;
            const max = parseFloat(slider.max) || 100;
            const val = parseFloat(slider.value);
            const percentage = ((val - min) / (max - min)) * 100;
            slider.style.setProperty('--slider-fill', `${percentage}%`);
        };

        slider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            numberInput.value = val;
            updateSliderFill();
            if (callback) callback(val);
        });

        numberInput.addEventListener('input', (e) => {
            let val = parseInt(e.target.value);
            const min = parseInt(slider.min) || 0;
            const max = parseInt(slider.max) || 100;

            if (isNaN(val)) return;

            if (val > max) {
                val = max;
                numberInput.value = max;
            }

            slider.value = val;
            updateSliderFill();

            let safeVal = val < min ? min : val;
            if (callback) callback(safeVal);
        });

        numberInput.addEventListener('blur', (e) => {
            let val = parseInt(e.target.value);
            const min = parseInt(slider.min) || 0;
            const max = parseInt(slider.max) || 100;

            if (isNaN(val) || val < min) {
                val = min;
            } else if (val > max) {
                val = max;
            }

            numberInput.value = val;
            slider.value = val;
            updateSliderFill();
            if (callback) callback(val);
        });

        updateSliderFill();
        if (callback) callback(slider.value);
    }

    syncControls(sizeSlider, sizeInput, (val) => {
        canvasManager.setBrushSize(val);
    });

    syncControls(opacitySlider, opacityInput, (val) => {
        canvasManager.setBrushOpacity(val);
    });

    syncControls(toleranceSlider, toleranceInput, (val) => {
        canvasManager.setFillTolerance(val);
    });

    canvasManager.onBrushSizeChange = (newSize) => {
        sizeSlider.value = newSize;
        sizeInput.value = newSize;
        const min = parseFloat(sizeSlider.min) || 0;
        const max = parseFloat(sizeSlider.max) || 100;
        const percentage = ((newSize - min) / (max - min)) * 100;
        sizeSlider.style.setProperty('--slider-fill', `${percentage}%`);
    };

    function updateActiveButtonUI(toolId) {
        toolBtns.forEach(b => b.classList.remove('active'));
        const activeBtn = document.getElementById(`btn-${toolId}`);
        if (activeBtn) activeBtn.classList.add('active');
    }

    canvasManager.onSpaceToggle = (isPressed) => {
        if (isPressed) {
            updateActiveButtonUI('pan');
        } else {
            updateActiveButtonUI(canvasManager.currentTool);
        }
    };

    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const toolId = btn.id;

            if (toolId === 'btn-brush' || toolId === 'btn-pen' || toolId === 'btn-rectangle' || toolId === 'btn-ellipse' || toolId === 'btn-line') {
                sizeContainer.style.display = 'block';
                opacityContainer.style.display = 'block';
                toleranceContainer.style.display = 'none';
            } else if (toolId === 'btn-eraser') {
                sizeContainer.style.display = 'block';
                opacityContainer.style.display = 'none';
                toleranceContainer.style.display = 'none';
            } else if (toolId === 'btn-fill') {
                sizeContainer.style.display = 'none';
                opacityContainer.style.display = 'none';
                toleranceContainer.style.display = 'block';
            } else {
                sizeContainer.style.display = 'none';
                opacityContainer.style.display = 'none';
                toleranceContainer.style.display = 'none';
            }

            switch (toolId) {
                case 'btn-brush':
                    canvasManager.setTool('brush');
                    break;
                case 'btn-pen':
                    canvasManager.setTool('pen');
                    break;
                case 'btn-eraser':
                    canvasManager.setTool('eraser');
                    break;
                case 'btn-fill':
                    canvasManager.setTool('fill');
                    break;
                case 'btn-rectangle':
                    canvasManager.setTool('rectangle');
                    break;
                case 'btn-line':
                    canvasManager.setTool('line');
                    break;
                case 'btn-ellipse':
                    canvasManager.setTool('ellipse');
                    break;
                case 'btn-cutarea':
                    canvasManager.setTool('cutarea');
                    break;
                case 'btn-select':
                    canvasManager.setTool('select');
                    break;
                case 'btn-pan':
                    canvasManager.setTool('pan');
                    break;
            }

            updateActiveButtonUI(canvasManager.currentTool);
        });
    });
});