export class CanvasImage {
    constructor(cm) {
        this.cm = cm;
    }

    placeImage(dataURL) {
        const img = new Image();
        img.onload = () => {
            const canvasW = this.cm.canvas.width;
            const canvasH = this.cm.canvas.height;

            let scale = 1;
            if (img.width > canvasW || img.height > canvasH) {
                scale = Math.min(canvasW / img.width, canvasH / img.height) * 0.8;
            }

            const scaledW = img.width * scale;
            const scaledH = img.height * scale;

            this.cm.layerManager.addLayer('Placed Image');
            const layerId = this.cm.layerManager.activeLayerId;

            const fabricImg = new fabric.Image(img, {
                left: (canvasW - scaledW) / 2,
                top: (canvasH - scaledH) / 2,
                scaleX: scale,
                scaleY: scale,
                layerId: layerId,
                selectable: true,
                evented: true,
                hasControls: true,
                hasBorders: true,
                lockUniScaling: false
            });

            fabricImg.setControlsVisibility({
                mt: true, mb: true, ml: true, mr: true,
                tl: true, tr: true, bl: true, br: true, mtr: true
            });

            const prevTool = this.cm.currentTool;
            this.cm.canvas.isDrawingMode = false;
            this.cm.canvas.selection = false;
            this.cm.canvas.add(fabricImg);
            this.cm.canvas.setActiveObject(fabricImg);
            this.cm.canvas.requestRenderAll();

            const confirmPlacement = () => {
                fabricImg.set({ selectable: false, evented: false });
                fabricImg.setCoords();
                this.cm.canvas.discardActiveObject();
                this.cm.canvas.isDrawingMode = prevTool !== 'pan' && prevTool !== 'fill' && prevTool !== 'cutarea' && prevTool !== 'select';
                this.cm.canvas.selection = false;
                this.cm.canvas.requestRenderAll();
                this.cm.historyManager.saveState();

                this.cm.canvas.off('mouse:dblclick', confirmPlacement);
                document.removeEventListener('keydown', onKey, true);
                overlayBanner.remove();
            };

            const onKey = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    confirmPlacement();
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.cm.canvas.remove(fabricImg);
                    this.cm.layerManager.deleteLayer(layerId);
                    this.cm.canvas.isDrawingMode = prevTool !== 'pan' && prevTool !== 'fill' && prevTool !== 'cutarea' && prevTool !== 'select';
                    this.cm.canvas.discardActiveObject();
                    this.cm.canvas.requestRenderAll();
                    this.cm.canvas.off('mouse:dblclick', confirmPlacement);
                    document.removeEventListener('keydown', onKey, true);
                    overlayBanner.remove();
                }
            };

            this.cm.canvas.on('mouse:dblclick', confirmPlacement);
            document.addEventListener('keydown', onKey, true);

            const overlayBanner = document.createElement('div');
            overlayBanner.style.cssText = `
                position: fixed;
                bottom: calc(var(--statusbar-height) + 10px);
                left: 50%;
                transform: translateX(-50%);
                background: var(--ink-dark);
                border: 1px solid var(--accent-color);
                color: var(--text-primary);
                font-family: var(--font-ui);
                font-size: 0.72rem;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                padding: 7px 18px;
                z-index: 9998;
                pointer-events: none;
                box-shadow: 0 4px 16px rgba(0,0,0,0.7);
                white-space: nowrap;
            `;
            overlayBanner.textContent = 'Transform — Press Enter to confirm · Esc to cancel · Double-click to confirm';
            document.body.appendChild(overlayBanner);
        };
        img.src = dataURL;
    }
}