import { CanvasManager } from './modules/CanvasManager.js';
import { ColorManager } from './modules/ColorManager.js';

document.addEventListener('DOMContentLoaded', () => {
    const canvasManager = new CanvasManager('drawing-canvas');

    const colorManager = new ColorManager('color-wheel-canvas', (color) => {
        canvasManager.setBrushColor(color);
    });

    const brushSizeInput = document.getElementById('brush-size');
    const brushSizeVal = document.getElementById('brush-size-val');

    brushSizeInput.addEventListener('input', (e) => {
        const novoTamanho = e.target.value;
        brushSizeVal.textContent = novoTamanho;
        canvasManager.setBrushSize(novoTamanho);
    });
});