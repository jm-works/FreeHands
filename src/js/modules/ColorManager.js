function hsvToHex(h, s, v) {
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

function hexToHsv(hex) {
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

function drawHandle(ctx, x, y, color) {
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#000000';
    ctx.stroke();
}

function drawColorWheel(ctx, size, center, radius, triRadius, hue, sat, val) {
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
    drawHandle(ctx, hx, hy, hsvToHex(hue, 1, 1));

    const svx = (val * sat) * p1.x + (val * (1 - sat)) * p2.x + (1 - val) * p3.x;
    const svy = (val * sat) * p1.y + (val * (1 - sat)) * p2.y + (1 - val) * p3.y;
    drawHandle(ctx, svx, svy, hsvToHex(hue, sat, val));
}

function calculateSV(x, y, hue, center, triRadius) {
    const angleRad = hue * Math.PI / 180;
    const p1 = { x: center + triRadius * Math.cos(angleRad), y: center + triRadius * Math.sin(angleRad) };
    const p2 = { x: center + triRadius * Math.cos(angleRad + 2.0944), y: center + triRadius * Math.sin(angleRad + 2.0944) };
    const p3 = { x: center + triRadius * Math.cos(angleRad + 4.1888), y: center + triRadius * Math.sin(angleRad + 4.1888) };

    const denom = (p2.y - p3.y) * (p1.x - p3.x) + (p3.x - p2.x) * (p1.y - p3.y);
    const w1 = ((p2.y - p3.y) * (x - p3.x) + (p3.x - p2.x) * (y - p3.y)) / denom;
    const w2 = ((p3.y - p1.y) * (x - p3.x) + (p1.x - p3.x) * (y - p3.y)) / denom;
    const w3 = 1 - w1 - w2;

    let v = 1 - w3;
    v = Math.max(0, Math.min(1, v));
    let s = v > 0 ? w1 / v : 0;
    s = Math.max(0, Math.min(1, s));

    return { sat: s, val: v };
}

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
        drawColorWheel(this.ctx, this.size, this.center, this.radius, this.triRadius, this.hue, this.sat, this.val);
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
                const sv = calculateSV(x, y, this.hue, this.center, this.triRadius);
                this.sat = sv.sat;
                this.val = sv.val;
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

    update() {
        this.draw();
        const hexColor = hsvToHex(this.hue, this.sat, this.val);

        const preview = document.getElementById('active-color-preview');
        const hexInput = document.getElementById('color-hex-code');

        if (preview) preview.style.backgroundColor = hexColor;
        if (hexInput && document.activeElement !== hexInput) {
            hexInput.value = hexColor.replace('#', '').toUpperCase();
        }

        this._updateActiveSwatch(hexColor);

        if (this.onColorChange) {
            this.onColorChange(hexColor);
        }
    }

    _showSwatchContextMenu(e, swatchEl) {
        e.preventDefault();
        document.querySelectorAll('.swatch-context-menu').forEach(m => m.remove());

        const menu = document.createElement('div');
        menu.className = 'swatch-context-menu';
        menu.style.visibility = 'hidden';
        menu.style.left = '0px';
        menu.style.top = '0px';

        const deleteItem = document.createElement('div');
        deleteItem.className = 'swatch-context-item swatch-context-delete';
        deleteItem.textContent = 'Delete Color';
        deleteItem.onclick = () => {
            swatchEl.remove();
            menu.remove();
        };

        menu.appendChild(deleteItem);
        document.body.appendChild(menu);

        const mw = menu.offsetWidth;
        const mh = menu.offsetHeight;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        const x = e.clientX + mw > vw ? e.clientX - mw : e.clientX;
        const y = e.clientY + mh > vh ? e.clientY - mh : e.clientY;

        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.style.visibility = 'visible';

        const close = (ev) => {
            if (!menu.contains(ev.target)) {
                menu.remove();
                document.removeEventListener('mousedown', close);
            }
        };
        setTimeout(() => document.addEventListener('mousedown', close), 0);
    }

    _setupHexInput() {
        const hexInput = document.getElementById('color-hex-code');
        if (!hexInput) return;

        hexInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') hexInput.blur();
        });

        hexInput.addEventListener('blur', () => {
            let val = hexInput.value.replace(/[^0-9a-fA-F]/g, '');
            if (val.length === 3) val = val.split('').map(c => c + c).join('');
            if (val.length === 6) {
                const hex = '#' + val;
                const hsv = hexToHsv(hex);
                this.hue = hsv.h; this.sat = hsv.s; this.val = hsv.v;
                this.update();
            } else {
                hexInput.value = hsvToHex(this.hue, this.sat, this.val).replace('#', '').toUpperCase();
            }
        });

        hexInput.addEventListener('input', () => {
            const val = hexInput.value.replace(/[^0-9a-fA-F]/g, '');
            if (val.length === 6) {
                const hex = '#' + val;
                const hsv = hexToHsv(hex);
                this.hue = hsv.h; this.sat = hsv.s; this.val = hsv.v;
                this.draw();
                const preview = document.getElementById('active-color-preview');
                if (preview) preview.style.backgroundColor = hex;
                this._updateActiveSwatch(hex);
                if (this.onColorChange) this.onColorChange(hex);
            }
        });
    }

    _updateActiveSwatch(hexColor) {
        const swatches = document.querySelectorAll('.palette-color');
        swatches.forEach(sw => {
            const swHex = this._rgbToHex(sw.style.backgroundColor);
            sw.classList.toggle('active-swatch', swHex && swHex.toLowerCase() === hexColor.toLowerCase());
        });
    }

    _rgbToHex(rgb) {
        const m = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (!m) return null;
        return '#' + [m[1], m[2], m[3]].map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
    }

    setColorFromHex(hex) {
        const hsv = hexToHsv(hex);
        this.hue = hsv.h;
        this.sat = hsv.s;
        this.val = hsv.v;
        this.update();
    }

    createDefaultPalette() {
        const palette = document.getElementById('color-palette');
        if (!palette) return;
        palette.innerHTML = '';

        this._setupHexInput();

        const colors = [
            '#0D0D0D', '#2A2A2A', '#555555', '#A0A0A0', '#E0E0E0',
            '#C0392B', '#7A1F18', '#E8774A', '#F0C27F', '#FFFFFF',
            '#1A3A4A', '#2980B9', '#6DAEDB', '#27AE60', '#F39C12',
        ];

        const makeSwatch = (hex) => {
            const div = document.createElement('div');
            div.className = 'palette-color';
            div.style.backgroundColor = hex;
            div.title = hex.toUpperCase();
            div.onclick = () => {
                const hsv = hexToHsv(hex);
                this.hue = hsv.h; this.sat = hsv.s; this.val = hsv.v;
                this.update();
            };
            div.addEventListener('contextmenu', (e) => this._showSwatchContextMenu(e, div));
            return div;
        };

        colors.forEach(hex => palette.appendChild(makeSwatch(hex)));

        const addBtn = document.createElement('div');
        addBtn.className = 'palette-add-btn';
        addBtn.title = 'Add current color';
        addBtn.textContent = '+';
        addBtn.onclick = () => {
            const current = hsvToHex(this.hue, this.sat, this.val);
            palette.insertBefore(makeSwatch(current), addBtn);
            this._updateActiveSwatch(current);
        };
        palette.appendChild(addBtn);
    }
}

export class ColorPickerModal {
    constructor() {
        this.hue = 0;
        this.sat = 1;
        this.val = 1;
        this.size = 180;
        this.center = this.size / 2;
        this.radius = this.size / 2 - 15;
        this.triRadius = this.radius - 15;
    }

    show(initialHex, onConfirm) {
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';
        overlay.style.zIndex = '100005';
        overlay.style.display = 'flex';

        const modal = document.createElement('div');
        modal.className = 'custom-modal';
        modal.style.width = '240px';
        modal.style.alignItems = 'center';

        const title = document.createElement('div');
        title.className = 'custom-modal-message';
        title.textContent = 'Select Color';
        title.style.alignSelf = 'flex-start';

        const canvas = document.createElement('canvas');
        canvas.width = this.size;
        canvas.height = this.size;
        canvas.style.cursor = 'crosshair';
        canvas.style.marginTop = '10px';
        const ctx = canvas.getContext('2d');

        const hexContainer = document.createElement('div');
        hexContainer.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;margin-top:15px;';

        const preview = document.createElement('div');
        preview.style.cssText = 'width:30px;height:30px;border:1px solid var(--border-strong);';
        preview.style.backgroundColor = initialHex;

        const hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.className = 'custom-modal-input';
        hexInput.style.flex = '1';
        hexInput.value = initialHex.replace('#', '').toUpperCase();

        hexContainer.appendChild(preview);
        hexContainer.appendChild(hexInput);

        const btnRow = document.createElement('div');
        btnRow.className = 'custom-modal-btns';
        btnRow.style.width = '100%';
        btnRow.style.marginTop = '15px';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'custom-modal-btn cancel';
        cancelBtn.textContent = 'Cancel';

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'custom-modal-btn confirm';
        confirmBtn.textContent = 'OK';

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(confirmBtn);

        modal.appendChild(title);
        modal.appendChild(canvas);
        modal.appendChild(hexContainer);
        modal.appendChild(btnRow);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        let isDraggingRing = false;
        let isDraggingTriangle = false;

        const hsv = hexToHsv(initialHex);
        this.hue = hsv.h;
        this.sat = hsv.s;
        this.val = hsv.v;

        const draw = () => {
            drawColorWheel(ctx, this.size, this.center, this.radius, this.triRadius, this.hue, this.sat, this.val);
        };

        const updateState = () => {
            draw();
            const hex = hsvToHex(this.hue, this.sat, this.val);
            preview.style.backgroundColor = hex;
            if (document.activeElement !== hexInput) {
                hexInput.value = hex.replace('#', '').toUpperCase();
            }
        };

        const handleMouse = (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const dx = x - this.center;
            const dy = y - this.center;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (e.type === 'mousedown') {
                if (dist > this.radius - 10 && dist < this.radius + 10) {
                    isDraggingRing = true;
                } else if (dist <= this.triRadius) {
                    isDraggingTriangle = true;
                }
            }

            if (isDraggingRing) {
                this.hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
            } else if (isDraggingTriangle) {
                const sv = calculateSV(x, y, this.hue, this.center, this.triRadius);
                this.sat = sv.sat;
                this.val = sv.val;
            }

            if (isDraggingRing || isDraggingTriangle) {
                updateState();
            }
        };

        canvas.addEventListener('mousedown', (e) => {
            handleMouse(e);
            const onMove = (me) => handleMouse(me);
            const onUp = () => {
                isDraggingRing = false;
                isDraggingTriangle = false;
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        });

        hexInput.addEventListener('blur', () => {
            let val = hexInput.value.replace(/[^0-9a-fA-F]/g, '');
            if (val.length === 3) val = val.split('').map(c => c + c).join('');
            if (val.length === 6) {
                const hex = '#' + val;
                const hsv = hexToHsv(hex);
                this.hue = hsv.h; this.sat = hsv.s; this.val = hsv.v;
                updateState();
            } else {
                hexInput.value = hsvToHex(this.hue, this.sat, this.val).replace('#', '').toUpperCase();
            }
        });

        hexInput.addEventListener('input', () => {
            const val = hexInput.value.replace(/[^0-9a-fA-F]/g, '');
            if (val.length === 6) {
                const hex = '#' + val;
                const hsv = hexToHsv(hex);
                this.hue = hsv.h; this.sat = hsv.s; this.val = hsv.v;
                draw();
                preview.style.backgroundColor = hex;
            }
        });

        const close = () => {
            document.body.removeChild(overlay);
            window.removeEventListener('keydown', onKey, { capture: true });
        };

        cancelBtn.onclick = close;

        confirmBtn.onclick = () => {
            if (onConfirm) {
                onConfirm(hsvToHex(this.hue, this.sat, this.val));
            }
            close();
        };

        const onKey = (e) => {
            if (e.key === 'Escape') cancelBtn.onclick();
            if (e.key === 'Enter') confirmBtn.onclick();
        };
        window.addEventListener('keydown', onKey, { capture: true });

        updateState();
    }
}

export const colorPickerModal = new ColorPickerModal();