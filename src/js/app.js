import { CanvasManager } from './modules/CanvasManager.js';
import { ColorManager } from './modules/ColorManager.js';

document.addEventListener('DOMContentLoaded', () => {

    const canvasManager = new CanvasManager('drawing-canvas');
    const colorManager = new ColorManager('color-wheel-canvas', (color) => {
        canvasManager.setBrushColor(color);
    });

    const sizeSlider = document.getElementById('brush-size');
    const sizeInput = document.getElementById('brush-size-val');

    const opacitySlider = document.getElementById('brush-opacity');
    const opacityInput = document.getElementById('brush-opacity-val');

    function syncControls(slider, numberInput, callback) {
        slider.addEventListener('input', (e) => {
            const val = e.target.value;
            numberInput.value = val;
            if (callback) callback(val);
        });

        numberInput.addEventListener('input', (e) => {
            let val = parseInt(e.target.value);

            if (isNaN(val)) return;
            if (val < slider.min) val = slider.min;
            if (val > slider.max) val = slider.max;

            slider.value = val;
            if (callback) callback(val);
        });

        if (callback) callback(slider.value);
    }

    // Vinculando o Tamanho do Pincel
    syncControls(sizeSlider, sizeInput, (val) => {
        canvasManager.setBrushSize(val);
    });

    syncControls(opacitySlider, opacityInput, (val) => {
        console.log("Opacidade atualizada:", val, "%");
    });

    const toolBtns = document.querySelectorAll('.tool-btn');

    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            toolBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const toolId = btn.id;
            switch (toolId) {
                case 'btn-brush':
                    console.log("Tool select: Brush");
                    break;
                case 'btn-eraser':
                    console.log("Tool select: Eraser");
                    break;
                case 'btn-fill':
                    console.log("Tool select: Fill");
                    break;
                case 'btn-pan':
                    console.log("Tool select: Pan");
                    break;
            }
        });
    });

    console.log('BipBip FreeHands is coming baby! Let´s go draaaaaaaaw.');
});