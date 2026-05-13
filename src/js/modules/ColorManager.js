export class ColorManager {
    constructor(canvasId, onColorChange) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.onColorChange = onColorChange;

        this.size = 180;
        this.canvas.width = this.size;
        this.canvas.height = this.size;

        this.hue = 0;
        this.sat = 1;
        this.val = 0;

        this.center = this.size / 2;
        this.radius = this.size / 2 - 15;
        this.triRadius = this.radius - 15;
        this.isDraggingRing = false;
        this.isDraggingTriangle = false;

        this.init();
    }

    init() {
        this.addEventListeners();
        this.createDefaultPalette();
        this.update();
    }

    draw() {
        const { ctx, size, center, radius, triRadius, hue, sat, val } = this;
        ctx.clearRect(0, 0, size, size);

        for (let i = 0; i < 360; i++) {
            const angle = i * Math.PI / 180;
            ctx.beginPath();
            ctx.arc(center, center, radius, angle, (i + 1.5) * Math.PI / 180);
            ctx.strokeStyle = `hsl(${i}, 100%, 50%)`;
            ctx.lineWidth = 14;
            ctx.stroke();
        }

        const angleRad = hue * Math.PI / 180;
        const p1 = { x: center + triRadius * Math.cos(angleRad), y: center + triRadius * Math.sin(angleRad) };
        const p2 = { x: center + triRadius * Math.cos(angleRad + 2.0944), y: center + triRadius * Math.sin(angleRad + 2.0944) };
        const p3 = { x: center + triRadius * Math.cos(angleRad + 4.1888), y: center + triRadius * Math.sin(angleRad + 4.1888) };

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.save();
        ctx.clip();
        const gradHue = ctx.createLinearGradient(p2.x, p2.y, p1.x, p1.y);
        gradHue.addColorStop(0, 'rgba(255,255,255,0)');
        gradHue.addColorStop(1, `hsl(${hue}, 100%, 50%)`);
        ctx.fillStyle = gradHue;
        ctx.fillRect(0, 0, size, size);

        const gradBlack = ctx.createLinearGradient((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, p3.x, p3.y);
        gradBlack.addColorStop(0, 'rgba(0,0,0,0)');
        gradBlack.addColorStop(1, '#000000');
        ctx.fillStyle = gradBlack;
        ctx.fillRect(0, 0, size, size);
        ctx.restore();

        const hx = center + radius * Math.cos(angleRad);
        const hy = center + radius * Math.sin(angleRad);
        this.drawHandle(hx, hy, '#ffffff');

        const svx = (val * sat) * p1.x + (val * (1 - sat)) * p2.x + (1 - val) * p3.x;
        const svy = (val * sat) * p1.y + (val * (1 - sat)) * p2.y + (1 - val) * p3.y;
        this.drawHandle(svx, svy, this.hsvToHex(hue, sat, val));
    }

    drawHandle(x, y, color) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, 6, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = '#000000';
        this.ctx.stroke();
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    }

    addEventListeners() {
        const handleMouse = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const dx = x - this.center;
            const dy = y - this.center;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (e.type === 'mousedown') {
                if (dist > this.radius - 10 && dist < this.radius + 10) {
                    this.isDraggingRing = true;
                } else if (dist <= this.triRadius) {
                    this.isDraggingTriangle = true;
                }
            }

            if (this.isDraggingRing) {
                this.hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
            } else if (this.isDraggingTriangle) {
                this.calculateSVFromTriangleClick(x, y);
            }

            if (this.isDraggingRing || this.isDraggingTriangle) {
                this.update();
            }
        };

        this.canvas.addEventListener('mousedown', (e) => {
            handleMouse(e);
            const onMove = (me) => handleMouse(me);
            const onUp = () => {
                this.isDraggingRing = false;
                this.isDraggingTriangle = false;
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        });
    }

    calculateSVFromTriangleClick(x, y) {
        const angleRad = this.hue * Math.PI / 180;
        const p1 = { x: this.center + this.triRadius * Math.cos(angleRad), y: this.center + this.triRadius * Math.sin(angleRad) };
        const p2 = { x: this.center + this.triRadius * Math.cos(angleRad + 2.0944), y: this.center + this.triRadius * Math.sin(angleRad + 2.0944) };
        const p3 = { x: this.center + this.triRadius * Math.cos(angleRad + 4.1888), y: this.center + this.triRadius * Math.sin(angleRad + 4.1888) };

        const denom = (p2.y - p3.y) * (p1.x - p3.x) + (p3.x - p2.x) * (p1.y - p3.y);
        const w1 = ((p2.y - p3.y) * (x - p3.x) + (p3.x - p2.x) * (y - p3.y)) / denom;
        const w2 = ((p3.y - p1.y) * (x - p3.x) + (p1.x - p3.x) * (y - p3.y)) / denom;
        const w3 = 1 - w1 - w2;

        let v = 1 - w3;
        v = Math.max(0, Math.min(1, v));
        let s = v > 0 ? w1 / v : 0;
        s = Math.max(0, Math.min(1, s));

        this.sat = s;
        this.val = v;
    }

    update() {
        this.draw();
        const hexColor = this.hsvToHex(this.hue, this.sat, this.val);

        const preview = document.getElementById('active-color-preview');
        const hexText = document.getElementById('color-hex-code');

        if (preview && hexText) {
            preview.style.backgroundColor = hexColor;
            hexText.textContent = hexColor.toUpperCase();
        }

        if (this.onColorChange) {
            this.onColorChange(hexColor);
        }
    }

    createDefaultPalette() {
        const palette = document.getElementById('color-palette');
        if (!palette) return;
        palette.innerHTML = '';

        const colors = [
            '#000000', '#333333', '#777777', '#FFFFFF', '#FF0000',
            '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
            '#8B4513', '#FFA500', '#8A2BE2', '#008000', '#4B0082'
        ];

        colors.forEach(hex => {
            const div = document.createElement('div');
            div.className = 'palette-color';
            div.style.backgroundColor = hex;
            div.onclick = () => {
                const hsv = this.hexToHsv(hex);
                this.hue = hsv.h;
                this.sat = hsv.s;
                this.val = hsv.v;
                this.update();
            };
            palette.appendChild(div);
        });
    }

    hsvToHex(h, s, v) {
        let r, g, b, i, f, p, q, t;
        h /= 360;
        i = Math.floor(h * 6);
        f = h * 6 - i;
        p = v * (1 - s);
        q = v * (1 - f * s);
        t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }
        const toHex = x => {
            const hex = Math.round(x * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    hexToHsv(hex) {
        let r = parseInt(hex.slice(1, 3), 16) / 255;
        let g = parseInt(hex.slice(3, 5), 16) / 255;
        let b = parseInt(hex.slice(5, 7), 16) / 255;

        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, v = max;
        let d = max - min;
        s = max === 0 ? 0 : d / max;

        if (max !== min) {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h * 360, s: s, v: v };
    }
}