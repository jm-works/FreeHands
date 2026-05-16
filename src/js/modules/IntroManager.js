export class IntroManager {
    constructor(rootId, canvasId) {
        this.root = document.getElementById(rootId);
        this.cv = document.getElementById(canvasId);

        if (!this.root || !this.cv) {
            console.warn("Introduction not found.");
            return;
        }

        this.ctx = this.cv.getContext('2d');
        this.W = 0;
        this.H = 0;

        this.phase = 'scene0';
        this.phaseT = 0;
        this.lastNow = performance.now();
        this.shutT = 0;
        this.interferenceTimer = 0;

        this.noiseOff = null;
        this.nCtx = null;

        this.init();
    }

    eo(t) { return 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3); }
    nm(t, a, b) { return Math.min(Math.max((t - a) / (b - a), 0), 1); }
    lerp(a, b, t) { return a + (b - a) * t; }

    resize() {
        this.W = this.cv.width = this.root.offsetWidth;
        this.H = this.cv.height = this.root.offsetHeight;
        this.noiseOff = new OffscreenCanvas(this.W || 640, this.H || 540);
        this.nCtx = this.noiseOff.getContext('2d');
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.audio = new Audio('src/assets/sound/startup.mp3');

        const startInteraction = () => {
            if (this.phase === 'awaiting_interaction') {
                this.audio.play().catch(() => { });
                this.phase = 'scene0';
                this.phaseT = 0;
            } else if (['scene0', 'scene1', 'scene2', 'tv_on'].includes(this.phase)) {
                this.audio.pause();
                this.audio.currentTime = 0;
                this.phase = 'logo';
                this.phaseT = 0;
            } else if (this.phase === 'idle') {
                this.phase = 'shutoff';
                this.shutT = 0;
            }
        };

        this.root.addEventListener('mousedown', startInteraction);
        window.addEventListener('keydown', startInteraction);

        this.tick = this.tick.bind(this);

        const p = this.audio.play();
        if (p !== undefined) {
            p.then(() => {
                this.phase = 'scene0';
                requestAnimationFrame(this.tick);
            }).catch(() => {
                this.phase = 'awaiting_interaction';
                requestAnimationFrame(this.tick);
            });
        } else {
            this.phase = 'awaiting_interaction';
            requestAnimationFrame(this.tick);
        }
    }

    buildNoise(alpha) {
        const ow = Math.max(this.W, 1), oh = Math.max(this.H, 1);
        if (this.noiseOff.width !== ow || this.noiseOff.height !== oh) {
            this.noiseOff.width = ow; this.noiseOff.height = oh;
            this.nCtx = this.noiseOff.getContext('2d');
        }
        const id = this.nCtx.createImageData(ow, oh);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
            const v = (Math.random() * 255) | 0;
            d[i] = d[i + 1] = d[i + 2] = v;
            d[i + 3] = (alpha * 255) | 0;
        }
        this.nCtx.putImageData(id, 0, 0);
    }

    drawNoise(alpha) {
        if (alpha <= 0) return;
        this.buildNoise(alpha);
        this.ctx.drawImage(this.noiseOff, 0, 0, this.W, this.H);
    }

    drawScanroll(t) {
        const lineH = 3;
        const rollY = ((t * 0.18) % 1) * this.H;
        this.ctx.save();
        this.ctx.globalAlpha = 0.06;
        this.ctx.fillStyle = '#fff';
        for (let y = -lineH; y < this.H + lineH; y += lineH * 2) {
            this.ctx.fillRect(0, (y + rollY) % this.H, this.W, lineH);
        }
        this.ctx.restore();
    }

    drawCRT() {
        const g = this.ctx.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.1, this.W / 2, this.H / 2, this.H * 0.82);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.7, 'rgba(0,0,0,0.12)');
        g.addColorStop(1, 'rgba(0,0,0,0.88)');
        this.ctx.fillStyle = g; this.ctx.fillRect(0, 0, this.W, this.H);
        ['0,0', 'W,0', '0,H', 'W,H'].forEach(corner => {
            const [cx, cy] = corner.split(',').map(v => v === 'W' ? this.W : v === 'H' ? this.H : 0);
            const cg = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, this.H * 0.5);
            cg.addColorStop(0, 'rgba(0,0,0,0.5)');
            cg.addColorStop(1, 'rgba(0,0,0,0)');
            this.ctx.fillStyle = cg; this.ctx.fillRect(0, 0, this.W, this.H);
        });
    }

    phosphorGlow(strength) {
        this.ctx.save();
        this.ctx.globalAlpha = strength * 0.07;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.W, this.H);
        this.ctx.restore();
    }

    drawInterference(dt) {
        this.interferenceTimer += dt;
        if (this.interferenceTimer > 120 && Math.random() < 0.3) {
            this.interferenceTimer = 0;
            const ly = Math.random() * this.H;
            const lh = 2 + Math.random() * 8;
            this.ctx.save();
            this.ctx.globalAlpha = 0.12 + Math.random() * 0.18;
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillRect(0, ly, this.W, lh);
            const shift = (Math.random() - 0.5) * 12;
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.globalAlpha = 0.08;
            this.ctx.fillStyle = '#fff';
            this.ctx.fillRect(shift, ly, this.W, lh / 2);
            this.ctx.restore();
        }
    }

    txt(str, x, y, size, weight, family, color, alpha, align, tracking) {
        this.ctx.save();
        this.ctx.globalAlpha = alpha ?? 1;
        this.ctx.fillStyle = color ?? '#e8dfc8';
        this.ctx.font = `${weight ?? '400'} ${size}px '${family ?? 'Oswald'}', sans-serif`;
        this.ctx.textAlign = align ?? 'center';
        this.ctx.textBaseline = 'middle';
        if (tracking) this.ctx.letterSpacing = tracking;
        this.ctx.fillText(str, x, y);
        this.ctx.restore();
    }

    rule(y, x0, x1, color, alpha) {
        this.ctx.save();
        this.ctx.globalAlpha = alpha ?? 0.35;
        this.ctx.strokeStyle = color ?? '#444';
        this.ctx.lineWidth = 0.8;
        this.ctx.beginPath(); this.ctx.moveTo(x0, y); this.ctx.lineTo(x1, y); this.ctx.stroke();
        this.ctx.restore();
    }

    wipeRect(x, y, w, h, progress) {
        this.ctx.beginPath();
        this.ctx.rect(x, y, w * progress, h);
        this.ctx.clip();
    }

    drawScene0(t) {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.W, this.H);
        const bursts = [0, 160, 380];
        bursts.forEach(start => {
            const dt = t - start;
            if (dt >= 0 && dt < 90) {
                const a = dt < 45 ? dt / 45 : 1 - (dt - 45) / 45;
                this.ctx.save();
                this.ctx.globalAlpha = a * 0.12;
                this.ctx.fillStyle = '#fff';
                this.ctx.fillRect(0, 0, this.W, this.H);
                this.ctx.restore();
            }
        });
        if (t > 500) {
            const a = this.eo(this.nm(t, 500, 900));
            this.txt('A production', this.W / 2, this.H / 2, 45, '400', 'Special Elite', '#666', a * 0.6, 'center', '0.18em');
            this.txt('FreeHands TEAM', this.W / 2, this.H / 2 + 40, 35, '600', 'Oswald', '#555', a * 0.5, 'center', '0.24em');
        }
    }

    drawScene1(t) {
        this.ctx.fillStyle = '#151515';
        this.ctx.fillRect(0, 0, this.W, this.H);

        if (t > 100) {
            const a = this.eo(this.nm(t, 100, 400));
            this.rule(this.H * 0.5 - 42, this.W * 0.14, this.W * 0.86, '#3a3a3a', a * 0.5);
            this.ctx.save();
            this.ctx.globalAlpha = a;
            this.ctx.save();
            this.wipeRect(this.W * 0.14, this.H * 0.5 - 38, this.W * 0.72, this.H * 0.25, this.nm(t, 100, 480));
            this.txt('NEW YORK', this.W / 2, this.H * 0.5 + 2, 65, '700', 'Oswald', '#ccc4b0', 1, 'center', '0.18em');
            this.ctx.restore();
            this.ctx.restore();
            this.rule(this.H * 0.5 + 32, this.W * 0.14, this.W * 0.86, '#3a3a3a', a * 0.5);
        }
    }

    drawScene2(t) {
        this.ctx.fillStyle = '#181818';
        this.ctx.fillRect(0, 0, this.W, this.H);
        const sceneA = this.eo(this.nm(t, 0, 300));

        this.ctx.save();
        this.ctx.globalAlpha = sceneA * 0.9;
        this.ctx.fillStyle = '#222222';
        this.ctx.fillRect(0, this.H * 0.22, this.W * 0.22, this.H);
        this.ctx.fillRect(this.W * 0.05, this.H * 0.12, this.W * 0.12, this.H);
        this.ctx.fillRect(this.W * 0.72, this.H * 0.10, this.W * 0.28, this.H);
        this.ctx.fillRect(this.W * 0.80, this.H * 0.06, this.W * 0.14, this.H);
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(this.W * 0.38, this.H * 0.35, this.W * 0.24, this.H);
        this.ctx.restore();

        this.ctx.save();
        this.ctx.globalAlpha = sceneA * 0.55;
        const wins = [[0.07, 0.18], [0.10, 0.18], [0.07, 0.26], [0.10, 0.26], [0.82, 0.13], [0.87, 0.13], [0.92, 0.13], [0.82, 0.22], [0.89, 0.28], [0.84, 0.35], [0.90, 0.40]];
        wins.forEach(([wx, wy]) => {
            this.ctx.fillStyle = '#e8b84040';
            this.ctx.fillRect(this.W * wx, this.H * wy, this.W * 0.018, this.H * 0.028);
            const g = this.ctx.createRadialGradient(this.W * wx + this.W * 0.009, this.H * wy + this.H * 0.014, 0, this.W * wx + this.W * 0.009, this.H * wy + this.H * 0.014, this.W * 0.04);
            g.addColorStop(0, 'rgba(232,184,64,0.06)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            this.ctx.fillStyle = g;
            this.ctx.fillRect(this.W * wx - this.W * 0.04, this.H * wy - this.H * 0.04, this.W * 0.1, this.H * 0.1);
        });
        this.ctx.restore();

        this.ctx.save();
        this.ctx.globalAlpha = sceneA * 0.6;
        const fog = this.ctx.createLinearGradient(0, this.H * 0.4, 0, this.H);
        fog.addColorStop(0, 'rgba(24, 24, 24, 0)');
        fog.addColorStop(1, 'rgba(10, 10, 10, 0.95)');
        this.ctx.fillStyle = fog;
        this.ctx.fillRect(0, this.H * 0.4, this.W, this.H * 0.6);
        this.ctx.restore();

        this.ctx.save();
        this.ctx.globalAlpha = sceneA * 0.35;
        this.ctx.strokeStyle = '#8899bb';
        this.ctx.lineWidth = 1.2;
        for (let i = 0; i < 110; i++) {
            const sx = ((i * 137.508) % 1) * this.W;
            const sy = ((i * 73.311 + t * 0.12) % 1) * this.H;
            this.ctx.beginPath();
            this.ctx.moveTo(sx, sy);
            this.ctx.lineTo(sx - 5, sy + this.H * 0.05);
            this.ctx.stroke();
        }
        this.ctx.restore();

        this.ctx.save();
        this.ctx.globalAlpha = sceneA * 0.85;

        this.ctx.strokeStyle = '#0f0f0f';
        this.ctx.lineWidth = 5;
        this.ctx.beginPath();
        this.ctx.moveTo(this.W * 0.33, this.H);
        this.ctx.lineTo(this.W * 0.33, this.H * 0.35);
        this.ctx.lineTo(this.W * 0.38, this.H * 0.32);
        this.ctx.stroke();

        const lg = this.ctx.createRadialGradient(this.W * 0.38, this.H * 0.32, 0, this.W * 0.38, this.H * 0.32, this.W * 0.35);
        lg.addColorStop(0, 'rgba(255, 220, 130, 0.45)');
        lg.addColorStop(0.15, 'rgba(255, 220, 130, 0.15)');
        lg.addColorStop(1, 'rgba(0,0,0,0)');
        this.ctx.fillStyle = lg;
        this.ctx.fillRect(0, 0, this.W, this.H);
        this.ctx.restore();

        this.ctx.save();
        this.ctx.globalAlpha = sceneA * 0.98;
        this.ctx.fillStyle = '#050505';
        const fx = this.W * 0.44, fy = this.H * 0.94;

        this.ctx.beginPath();
        this.ctx.ellipse(fx, fy - this.H * 0.36, this.W * 0.045, this.H * 0.012, 0, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.moveTo(fx - this.W * 0.03, fy - this.H * 0.36);
        this.ctx.quadraticCurveTo(fx - this.W * 0.025, fy - this.H * 0.43, fx, fy - this.H * 0.42);
        this.ctx.quadraticCurveTo(fx + this.W * 0.025, fy - this.H * 0.43, fx + this.W * 0.03, fy - this.H * 0.36);
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.moveTo(fx - this.W * 0.015, fy - this.H * 0.36);
        this.ctx.quadraticCurveTo(fx - this.W * 0.05, fy - this.H * 0.30, fx - this.W * 0.055, fy - this.H * 0.25);
        this.ctx.quadraticCurveTo(fx - this.W * 0.065, fy + this.H * 0.00, fx - this.W * 0.06, fy + this.H * 0.12);
        this.ctx.lineTo(fx + this.W * 0.06, fy + this.H * 0.12);
        this.ctx.quadraticCurveTo(fx + this.W * 0.065, fy + this.H * 0.00, fx + this.W * 0.055, fy - this.H * 0.26);
        this.ctx.quadraticCurveTo(fx + this.W * 0.05, fy - this.H * 0.31, fx + this.W * 0.03, fy - this.H * 0.33);
        this.ctx.lineTo(fx + this.W * 0.02, fy - this.H * 0.35);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();

        if (t > 400) {
            const a = this.eo(this.nm(t, 400, 800));
            this.rule(this.H * 0.88 - 18, this.W * 0.15, this.W * 0.85, '#333', a * 0.4);
            this.txt('"crime never sleeps. neither does the artist."', this.W / 2, this.H * 0.88, 30, '400', 'Special Elite', '#776655', a * 0.55, 'center', '0.08em');
            this.rule(this.H * 0.88 + 18, this.W * 0.15, this.W * 0.85, '#333', a * 0.4);
        }
    }

    drawLogo(alpha, staticAlpha) {
        this.ctx.save();
        this.phosphorGlow(alpha * 0.6);

        const max_rw = this.W * 0.5;
        const lineP = this.eo(this.nm(alpha, 0, 1));
        const draw_rw = max_rw * lineP;

        this.ctx.globalAlpha = alpha > 0 ? Math.min(alpha * 2, 0.9) : 0;
        this.ctx.strokeStyle = '#c0392b';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        const topRightX = this.W / 2 + max_rw / 2;
        this.ctx.moveTo(topRightX, this.H / 2 - 72);
        this.ctx.lineTo(topRightX - draw_rw, this.H / 2 - 72);
        this.ctx.stroke();

        const sz = Math.min(this.W * 0.13, 120);
        this.ctx.font = `900 ${sz}px 'Playfair Display', Georgia, serif`;
        this.ctx.textBaseline = 'middle';
        this.ctx.textAlign = 'left';

        const fAdvance = this.ctx.measureText('Fr').width - this.ctx.measureText('r').width;
        const hAdvance = this.ctx.measureText('Ha').width - this.ctx.measureText('a').width;
        const fW = this.ctx.measureText('Free').width;
        const hW = this.ctx.measureText('Hands').width;
        const gap = sz * 0.075;

        const sx = this.W / 2 - (fW + gap + hW) / 2;

        const aInit = this.eo(this.nm(alpha, 0, 0.5));
        const aRest = this.eo(this.nm(alpha, 0.4, 1));

        this.ctx.globalAlpha = aInit * 0.08;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText('F', sx + 1, this.H / 2 - 4 + 1);
        this.ctx.globalAlpha = aInit;
        this.ctx.fillStyle = '#e0d0b0';
        this.ctx.fillText('F', sx, this.H / 2 - 4);

        this.ctx.globalAlpha = aRest * 0.08;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText('ree', sx + fAdvance + 1, this.H / 2 - 4 + 1);
        this.ctx.globalAlpha = aRest;
        this.ctx.fillStyle = '#e0d0b0';
        this.ctx.fillText('ree', sx + fAdvance, this.H / 2 - 4);

        const hX = sx + fW + gap;
        this.ctx.globalAlpha = aInit * 0.08;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText('H', hX + 1, this.H / 2 - 4 + 1);
        this.ctx.globalAlpha = aInit;
        this.ctx.fillStyle = '#c0392b';
        this.ctx.fillText('H', hX, this.H / 2 - 4);

        this.ctx.globalAlpha = aRest * 0.08;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText('ands', hX + hAdvance + 1, this.H / 2 - 4 + 1);
        this.ctx.globalAlpha = aRest;
        this.ctx.fillStyle = '#c0392b';
        this.ctx.fillText('ands', hX + hAdvance, this.H / 2 - 4);

        this.ctx.globalAlpha = alpha > 0 ? Math.min(alpha * 2, 0.9) : 0;
        this.ctx.beginPath();
        const botLeftX = this.W / 2 - max_rw / 2;
        this.ctx.moveTo(botLeftX, this.H / 2 + 56);
        this.ctx.lineTo(botLeftX + draw_rw, this.H / 2 + 56);
        this.ctx.stroke();

        const aSub = this.eo(this.nm(alpha, 0.5, 1));
        this.ctx.globalAlpha = aSub * 0.6;
        this.ctx.fillStyle = '#706050';
        this.ctx.font = "600 20px 'Oswald', sans-serif";
        this.ctx.letterSpacing = '0.28em';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('A Drawing WebApp', this.W / 2, this.H / 2 + 80);

        if (this.phase === 'idle') {
            const pulse = 0.22 + 0.22 * Math.sin(this.phaseT / 650 * Math.PI * 2);
            this.ctx.globalAlpha = pulse;
            this.ctx.fillStyle = '#907050';
            this.ctx.font = "400 25px 'Special Elite', monospace";
            this.ctx.letterSpacing = '0.18em';
            this.ctx.fillText('— click to start —', this.W / 2, this.H * 0.88);
        }
        this.ctx.restore();
    }

    tick(now) {
        if (this.phase === 'awaiting_interaction') {
            this.lastNow = now;
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, this.W, this.H);
            this.txt('PRESS ANY BUTTON TO START', this.W / 2, this.H / 2, 25, '400', 'Special Elite', '#fff', 1, 'center', '0.1em');
            requestAnimationFrame(this.tick);
            return;
        }

        const dt = now - this.lastNow;
        this.lastNow = now;
        this.phaseT += dt;

        if (this.phase === 'scene0') {
            this.drawScene0(this.phaseT);
            if (this.phaseT > 1800) { this.phase = 'scene1'; this.phaseT = 0; }
        }
        else if (this.phase === 'scene1') {
            this.drawScene1(this.phaseT);
            if (this.phaseT > 1600) { this.phase = 'scene2'; this.phaseT = 0; }
        }
        else if (this.phase === 'scene2') {
            this.drawScene2(this.phaseT);
            if (this.phaseT > 3000) { this.phase = 'tv_on'; this.phaseT = 0; }
        }

        if (['scene0', 'scene1', 'scene2'].includes(this.phase)) {
            this.drawNoise(0.04);
            this.drawScanroll(this.phaseT);
            this.drawCRT();
        }

        else if (this.phase === 'tv_on') {
            this.ctx.fillStyle = '#000'; this.ctx.fillRect(0, 0, this.W, this.H);
            const p = this.nm(this.phaseT, 0, 800);
            const staticA = this.lerp(0.9, 0.0, this.eo(p));
            this.drawNoise(staticA);
            if (this.phaseT > 300) {
                const bp = this.eo(this.nm(this.phaseT, 300, 700));
                const lineH = this.lerp(this.H, 3, bp);
                const lineY = this.H / 2 - lineH / 2;
                this.ctx.save();
                this.ctx.globalAlpha = bp * 0.85;
                this.ctx.fillStyle = '#ffffff';
                this.ctx.fillRect(0, lineY, this.W, lineH);
                this.ctx.restore();
            }
            this.drawScanroll(this.phaseT);
            this.drawCRT();
            if (this.phaseT > 800) { this.phase = 'logo'; this.phaseT = 0; }
        }

        else if (this.phase === 'logo') {
            this.ctx.fillStyle = '#000'; this.ctx.fillRect(0, 0, this.W, this.H);
            const expand = this.eo(this.nm(this.phaseT, 0, 600));
            const logoA = this.eo(this.nm(this.phaseT, 300, 1400));
            if (expand < 0.99) {
                const lineH = this.lerp(4, this.H * 1.1, expand);
                const lineY = this.H / 2 - lineH / 2;
                this.ctx.save();
                this.ctx.globalAlpha = (1 - expand) * 0.9;
                this.ctx.fillStyle = '#e0d0b0';
                this.ctx.fillRect(0, lineY, this.W, lineH);
                this.ctx.restore();
            }
            const staticA = (1 - this.eo(this.nm(this.phaseT, 0, 500))) * 0.4;
            this.drawNoise(staticA);
            this.drawLogo(logoA, 0);
            this.drawScanroll(this.phaseT);
            this.drawInterference(dt);
            this.drawCRT();
            if (this.phaseT > 1600) { this.phase = 'idle'; this.phaseT = 0; }
        }

        else if (this.phase === 'idle') {
            this.ctx.fillStyle = '#000'; this.ctx.fillRect(0, 0, this.W, this.H);
            const staticA = 0.06 + 0.04 * Math.sin(this.phaseT / 900);
            this.drawNoise(staticA);
            this.drawLogo(1, staticA);
            this.drawScanroll(this.phaseT);
            this.drawInterference(dt);
            this.drawCRT();
            this.phosphorGlow(0.5);
        }

        else if (this.phase === 'shutoff') {
            this.shutT += dt;
            const p1 = this.eo(this.nm(this.shutT, 0, 180));
            const p2 = this.eo(this.nm(this.shutT, 180, 480));
            this.ctx.fillStyle = '#000'; this.ctx.fillRect(0, 0, this.W, this.H);

            const scaleY = 1 - p1;
            this.ctx.save();
            this.ctx.translate(this.W / 2, this.H / 2); this.ctx.scale(1, scaleY); this.ctx.translate(-this.W / 2, -this.H / 2);
            this.ctx.globalAlpha = 1 - p1 * 0.5;
            this.drawLogo(1, 0);
            this.ctx.restore();

            if (p1 > 0 && p1 < 1) {
                const lh = this.lerp(8, 2, p1);
                this.ctx.save();
                this.ctx.globalAlpha = (1 - p1) * 0.9 + 0.1;
                this.ctx.fillStyle = '#d0c8a0';
                this.ctx.fillRect(0, this.H / 2 - lh / 2, this.W, lh);
                this.ctx.restore();
            }
            if (p1 >= 0.8) {
                const dp = this.eo(this.nm(this.shutT, 200, 380));
                const dw = this.lerp(this.W * 0.15, 0, dp);
                this.ctx.save();
                this.ctx.globalAlpha = (1 - p2) * 0.95;
                this.ctx.fillStyle = '#c8c0a0';
                this.ctx.fillRect(this.W / 2 - dw / 2, this.H / 2 - 1, dw, 2);
                this.ctx.restore();
            }
            this.drawNoise((1 - p2) * 0.08);
            this.drawCRT();

            if (this.shutT > 500) { this.ctx.fillStyle = '#000'; this.ctx.fillRect(0, 0, this.W, this.H); }

            if (this.shutT > 700 && this.phase !== 'done') {
                this.phase = 'done';
                this.root.style.opacity = '0';
                this.root.style.pointerEvents = 'none';
                setTimeout(() => {
                    this.root.style.display = 'none';
                }, 1500);
            }
        }

        if (this.phase !== 'done') requestAnimationFrame(this.tick);
    }
}