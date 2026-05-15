import { CanvasManager } from './modules/CanvasManager.js';
import { ColorManager } from './modules/ColorManager.js';
import { IntroManager } from './modules/IntroManager.js';

document.addEventListener('DOMContentLoaded', () => {

    document.addEventListener('contextmenu', (e) => e.preventDefault());

    const introManager = new IntroManager('fh-root', 'fh-c');

    const canvasManager = new CanvasManager('drawing-canvas');
    const colorManager = new ColorManager('color-wheel-canvas', (color) => {
        canvasManager.setBrushColor(color);
    });
    const sizeSlider = document.getElementById('brush-size');
    const sizeInput = document.getElementById('brush-size-val');

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

            if (isNaN(val)) return;
            if (val < slider.min) val = slider.min;
            if (val > slider.max) val = slider.max;

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

            if (toolId === 'btn-fill') {
                toleranceContainer.style.display = 'block';
            } else {
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
                case 'btn-pan':
                    canvasManager.setTool('pan');
                    break;
            }

            updateActiveButtonUI(canvasManager.currentTool);
        });
    });
});