export class CanvasTexture {
    constructor(cm) {
        this.cm = cm;
    }

    setPaperTexture(textureId) {
        const width = this.cm.canvas.width;
        const height = this.cm.canvas.height;

        const offscreen = document.createElement('canvas');
        offscreen.width = width;
        offscreen.height = height;
        const ctx = offscreen.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        const textures = {
            none: () => { },
            grain: () => {
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const noise = (Math.random() - 0.5) * 30;
                    data[i] = Math.min(255, Math.max(0, data[i] + noise));
                    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
                    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
                }
                ctx.putImageData(imageData, 0, 0);
            },
            watercolor: () => {
                for (let i = 0; i < 2000; i++) {
                    const x = Math.random() * width;
                    const y = Math.random() * height;
                    const r = Math.random() * 40 + 10;
                    const alpha = Math.random() * 0.03 + 0.005;
                    const hue = Math.random() * 30 + 190;
                    ctx.beginPath();
                    ctx.arc(x, y, r, 0, Math.PI * 2);
                    ctx.fillStyle = `hsla(${hue}, 40%, 80%, ${alpha})`;
                    ctx.fill();
                }
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const noise = (Math.random() - 0.5) * 8;
                    data[i] = Math.min(255, Math.max(0, data[i] + noise));
                    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
                    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
                }
                ctx.putImageData(imageData, 0, 0);
            },
            canvas_fabric: () => {
                const cellSize = 6;
                for (let y = 0; y < height; y += cellSize) {
                    for (let x = 0; x < width; x += cellSize) {
                        const shade = 230 + Math.floor(Math.random() * 20);
                        ctx.fillStyle = `rgb(${shade},${shade - 2},${shade - 5})`;
                        ctx.fillRect(x, y, cellSize, cellSize);
                    }
                }
                ctx.strokeStyle = 'rgba(180,170,160,0.25)';
                ctx.lineWidth = 0.5;
                for (let y = 0; y <= height; y += cellSize) {
                    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
                }
                for (let x = 0; x <= width; x += cellSize) {
                    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
                }
            },
            parchment: () => {
                const grad = ctx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.7);
                grad.addColorStop(0, '#f5ead0');
                grad.addColorStop(0.6, '#ecdbb8');
                grad.addColorStop(1, '#d4b98a');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, width, height);
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const noise = (Math.random() - 0.5) * 18;
                    data[i] = Math.min(255, Math.max(0, data[i] + noise));
                    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise * 0.9));
                    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise * 0.5));
                }
                ctx.putImageData(imageData, 0, 0);
            },
            kraft: () => {
                ctx.fillStyle = '#c1925a';
                ctx.fillRect(0, 0, width, height);
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const noise = (Math.random() - 0.5) * 35;
                    data[i] = Math.min(255, Math.max(0, data[i] + noise));
                    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise * 0.7));
                    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise * 0.3));
                }
                ctx.putImageData(imageData, 0, 0);
                for (let i = 0; i < 400; i++) {
                    ctx.strokeStyle = `rgba(100,60,20,${Math.random() * 0.07})`;
                    ctx.lineWidth = Math.random() * 1.5;
                    ctx.beginPath();
                    const x1 = Math.random() * width;
                    ctx.moveTo(x1, 0);
                    ctx.lineTo(x1 + (Math.random() - 0.5) * 20, height);
                    ctx.stroke();
                }
            },
            grid: () => {
                const step = 30;
                ctx.strokeStyle = 'rgba(180,200,220,0.7)';
                ctx.lineWidth = 0.5;
                for (let y = 0; y <= height; y += step) {
                    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
                }
                for (let x = 0; x <= width; x += step) {
                    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
                }
            },
            dots: () => {
                const step = 24;
                ctx.fillStyle = 'rgba(150,170,200,0.6)';
                for (let y = step; y < height; y += step) {
                    for (let x = step; x < width; x += step) {
                        ctx.beginPath();
                        ctx.arc(x, y, 0.8, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        };

        const fn = textures[textureId];
        if (!fn) return;
        fn();

        const dataURL = offscreen.toDataURL('image/png');

        const existingBg = this.cm.canvas.getObjects().find(obj => obj.isBg);
        const bgLayerId = existingBg
            ? existingBg.layerId
            : (this.cm.layerManager ? this.cm.layerManager.layers[this.cm.layerManager.layers.length - 1].id : null);

        if (existingBg) {
            this.cm.canvas.remove(existingBg);
        }

        fabric.Image.fromURL(dataURL, (img) => {
            img.set({
                left: 0,
                top: 0,
                selectable: false,
                evented: false,
                layerId: bgLayerId,
                isBg: true
            });

            const objects = this.cm.canvas.getObjects();
            this.cm.canvas.add(img);
            if (objects.length > 0) {
                this.cm.canvas.sendToBack(img);
            }
            this.cm.canvas.requestRenderAll();
            if (this.cm.historyManager) {
                this.cm.historyManager.saveState();
            }
        });
    }
}