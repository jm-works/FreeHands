export class EyeDropperManager {
    constructor(canvasManager) {
        this.cm = canvasManager;
        this.onColorPicked = null;
    }

    get isSupported() {
        return 'EyeDropper' in window;
    }

    async pick() {
        const prevTool = this.cm.currentTool;

        this.cm.setTool('eyedropper');
        if (this.cm.onToolChange) this.cm.onToolChange('eyedropper');

        try {
            let hex;

            if (this.isSupported) {
                const dropper = new EyeDropper();
                const result = await dropper.open();
                hex = result.sRGBHex;
            } else {
                hex = await this._fallbackPick();
            }

            if (hex) this._applyColor(hex);
        } catch {
        } finally {
            this.cm.setTool(prevTool);
            if (this.cm.onToolChange) this.cm.onToolChange(prevTool);
        }
    }

    _fallbackPick() {
        return new Promise((resolve) => {
            const canvas = this.cm.canvas.getElement();

            const onClick = (e) => {
                canvas.removeEventListener('click', onClick);
                const rect = canvas.getBoundingClientRect();
                const x = Math.round(e.clientX - rect.left);
                const y = Math.round(e.clientY - rect.top);
                const ctx = canvas.getContext('2d');
                const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
                resolve(`#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`);
            };

            canvas.addEventListener('click', onClick);
        });
    }

    _applyColor(hex) {
        this.cm.setBrushColor(hex);
        if (this.onColorPicked) this.onColorPicked(hex);
    }
}