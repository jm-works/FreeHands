import { CanvasManager } from './modules/CanvasManager.js';
import { ColorManager } from './modules/ColorManager.js';
import { IntroManager } from './modules/IntroManager.js';
import { MenuManager } from './modules/MenuManager.js';
import { promptModal } from './modules/PromptModal.js';

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

    const topMenuManager = new MenuManager(canvasManager);

    topMenuManager.registerMenu('menu-file', [
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
            label: 'Add Filter',
            action: () => {
                console.log('Action: Add Filter - Irei Fazer algo aqui depois');
                alert('Add Filter selected (to be implemented)');
            }
        },
        {
            label: 'Change Paper Texture',
            action: () => {
                console.log('Action: Change Texture - Irei Fazer algo aqui depois');
                alert('Change Paper Texture selected (to be implemented)');
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

            if (toolId === 'btn-brush' || toolId === 'btn-pen') {
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