import { CanvasManager } from './modules/canva/CanvasManager.js';
import { ColorManager, colorPickerModal } from './modules/ColorManager.js';
import { IntroManager } from './modules/IntroManager.js';
import { MenuManager } from './modules/MenuManager.js';
import { promptModal } from './modules/PromptModal.js';
import { alertModal } from './modules/AlertModal.js';
import { FilterManager } from './modules/FilterManager.js';
import { EffectManager } from './modules/EffectManager.js';

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

    document.addEventListener('dragover', (e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault();
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (!file || !file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (ev) => canvasManager.placeImage(ev.target.result);
        reader.readAsDataURL(file);
    });

    window._cm = canvasManager;
    const filterManager = new FilterManager(canvasManager);
    const effectManager = new EffectManager(canvasManager);

    const topMenuManager = new MenuManager(canvasManager);

    topMenuManager.registerMenu('menu-file', [
        {
            label: 'Place Image',
            action: () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        canvasManager.placeImage(ev.target.result);
                    };
                    reader.readAsDataURL(file);
                };
                input.click();
            }
        },
        { type: 'separator' },
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
            label: 'BG Size',
            action: () => {
                promptModal.show('Width x Height (e.g. 1920x1080):', `${canvasManager.canvas.width}x${canvasManager.canvas.height}`, (val) => {
                    if (!val) return;
                    const parts = val.toLowerCase().split('x');
                    if (parts.length === 2) {
                        const w = parseInt(parts[0].trim(), 10);
                        const h = parseInt(parts[1].trim(), 10);
                        if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
                            if (w > 1920 || h > 1080) {
                                alertModal.show('Maximum size allowed is 1920x1080px!');
                                return;
                            }
                            canvasManager.resizeCanvas(w, h);
                            const sizeDisplay = document.getElementById('canvas-size-display');
                            if (sizeDisplay) {
                                sizeDisplay.textContent = `${w} x ${h} px`;
                            }
                        } else {
                            alertModal.show('Invalid dimensions!');
                        }
                    }
                });
            }
        },
        {
            label: 'Add Effects',
            action: () => {
                effectManager.open();
            }
        },
        {
            label: 'Add Filter',
            action: () => {
                filterManager.open();
            }
        },
        {
            label: 'Change Paper Texture',
            action: () => {
                const textures = [
                    { id: 'none', label: 'Plain White' },
                    { id: 'grain', label: 'Paper Grain' },
                    { id: 'watercolor', label: 'Watercolor Paper' },
                    { id: 'canvas_fabric', label: 'Canvas' },
                    { id: 'parchment', label: 'Parchment' },
                    { id: 'kraft', label: 'Kraft Paper' },
                    { id: 'grid', label: 'Grid' },
                    { id: 'dots', label: 'Dot Grid' }
                ];

                const overlay = document.createElement('div');
                overlay.className = 'custom-modal-overlay';
                overlay.style.zIndex = '100001';
                overlay.style.display = 'flex';

                const modal = document.createElement('div');
                modal.className = 'custom-modal';
                modal.style.width = '320px';

                const title = document.createElement('div');
                title.className = 'custom-modal-message';
                title.textContent = 'Select Paper Texture';

                const grid = document.createElement('div');
                grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;max-height:280px;overflow-y:auto;padding-right:4px;';

                textures.forEach(t => {
                    const btn = document.createElement('button');
                    btn.className = 'custom-modal-btn';
                    btn.style.cssText = 'width:100%;padding:10px 8px;text-align:center;cursor:pointer;font-size:0.72rem;';
                    btn.textContent = t.label;
                    btn.onclick = () => {
                        document.body.removeChild(overlay);
                        canvasManager.setPaperTexture(t.id);
                    };
                    grid.appendChild(btn);
                });

                const cancelRow = document.createElement('div');
                cancelRow.className = 'custom-modal-btns';
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'custom-modal-btn cancel';
                cancelBtn.textContent = 'Cancel';
                cancelBtn.onclick = () => document.body.removeChild(overlay);
                cancelRow.appendChild(cancelBtn);

                const onKey = (e) => {
                    if (e.key === 'Escape') {
                        document.body.removeChild(overlay);
                        window.removeEventListener('keydown', onKey, { capture: true });
                    }
                };
                window.addEventListener('keydown', onKey, { capture: true });

                modal.appendChild(title);
                modal.appendChild(grid);
                modal.appendChild(cancelRow);
                overlay.appendChild(modal);
                document.body.appendChild(overlay);
            }
        }
    ]);

    const colorManager = new ColorManager('color-wheel-canvas', (color) => {
        canvasManager.setBrushColor(color);
    });

    canvasManager.eyeDropperManager.onColorPicked = (hex) => {
        colorManager.setColorFromHex(hex);
    };

    const sizeContainer = document.getElementById('size-container');
    const sizeSlider = document.getElementById('brush-size');
    const sizeInput = document.getElementById('brush-size-val');

    const opacityContainer = document.getElementById('opacity-container');
    const opacitySlider = document.getElementById('brush-opacity');
    const opacityInput = document.getElementById('brush-opacity-val');

    const toleranceContainer = document.getElementById('tolerance-container');
    const toleranceSlider = document.getElementById('fill-tolerance');
    const toleranceInput = document.getElementById('fill-tolerance-val');

    const stabilizerContainer = document.getElementById('stabilizer-container');
    const stabilizerSlider = document.getElementById('brush-stabilizer');
    const stabilizerInput = document.getElementById('brush-stabilizer-val');

    const textControls = document.getElementById('text-controls');
    const textFontSelect = document.getElementById('text-font');
    const textSizeSlider = document.getElementById('text-size');
    const textSizeInput = document.getElementById('text-size-val');
    const btnTextBold = document.getElementById('btn-text-bold');
    const btnTextItalic = document.getElementById('btn-text-italic');
    const btnTextUnderline = document.getElementById('btn-text-underline');
    const btnAlignLeft = document.getElementById('btn-text-align-left');
    const btnAlignCenter = document.getElementById('btn-text-align-center');
    const btnAlignRight = document.getElementById('btn-text-align-right');
    const textLeadingSlider = document.getElementById('text-leading');
    const textLeadingInput = document.getElementById('text-leading-val');
    const textSpacingSlider = document.getElementById('text-spacing');
    const textSpacingInput = document.getElementById('text-spacing-val');
    const textColorSwatch = document.getElementById('text-color-swatch');
    const textColorWrap = document.getElementById('text-color-wrap');
    let textCurrentColor = '#000000';

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

    syncControls(stabilizerSlider, stabilizerInput, (val) => {
        canvasManager.setStabilizer(val);
    });

    function syncTextUI(itext) {
        if (!itext) return;

        const fontVal = itext.fontFamily || 'sans-serif';
        if (textFontSelect) textFontSelect.value = fontVal;
        if (textFontLabel) {
            const opt = [...textFontSelect.options].find(o => o.value === fontVal);
            textFontLabel.textContent = opt ? opt.text : fontVal;
        }

        const size = itext.fontSize || 24;
        if (textSizeSlider) {
            textSizeSlider.value = size;
            const pct = ((size - 8) / (200 - 8)) * 100;
            textSizeSlider.style.setProperty('--slider-fill', `${pct}%`);
        }
        if (textSizeInput) textSizeInput.value = size;

        const leading = Math.round((itext.lineHeight || 1.2) * 100);
        if (textLeadingSlider) {
            textLeadingSlider.value = leading;
            const pct = ((leading - 50) / (300 - 50)) * 100;
            textLeadingSlider.style.setProperty('--slider-fill', `${pct}%`);
        }
        if (textLeadingInput) textLeadingInput.value = leading;

        const spacing = Math.round(itext.charSpacing || 0);
        if (textSpacingSlider) {
            textSpacingSlider.value = spacing;
            const pct = ((spacing + 200) / 1000) * 100;
            textSpacingSlider.style.setProperty('--slider-fill', `${pct}%`);
        }
        if (textSpacingInput) textSpacingInput.value = spacing;

        const color = itext.fill || '#000000';
        textCurrentColor = color;
        if (textColorSwatch) textColorSwatch.style.background = color;

        btnTextBold?.classList.toggle('active', itext.fontWeight === 'bold');
        btnTextItalic?.classList.toggle('active', itext.fontStyle === 'italic');
        btnTextUnderline?.classList.toggle('active', !!itext.underline);
        [btnAlignLeft, btnAlignCenter, btnAlignRight].forEach(b => b?.classList.remove('active'));
        const align = itext.textAlign || 'left';
        if (align === 'left') btnAlignLeft?.classList.add('active');
        else if (align === 'center') btnAlignCenter?.classList.add('active');
        else if (align === 'right') btnAlignRight?.classList.add('active');
    }

    canvasManager.textManager.onTextCreated = (itext) => syncTextUI(itext);

    canvasManager.canvas.on('selection:created', () => {
        const obj = canvasManager.canvas.getActiveObject();
        if (obj?.type === 'i-text') syncTextUI(obj);
    });
    canvasManager.canvas.on('selection:updated', () => {
        const obj = canvasManager.canvas.getActiveObject();
        if (obj?.type === 'i-text') syncTextUI(obj);
    });

    const tm = () => canvasManager.textManager;

    const textFontLabel = document.getElementById('text-font-label');

    textFontSelect?.addEventListener('mousedown', (e) => e.stopPropagation());
    textFontSelect?.addEventListener('change', () => {
        const val = textFontSelect.value;
        const label = textFontSelect.options[textFontSelect.selectedIndex].text;
        if (textFontLabel) textFontLabel.textContent = label;
        tm().applyProp({ fontFamily: val });
    });

    if (textSizeSlider && textSizeInput) {
        syncControls(textSizeSlider, textSizeInput, (val) => tm().applyProp({ fontSize: val }, { commit: false }));
        textSizeSlider.addEventListener('change', () => {
            tm().applyProp({ fontSize: parseInt(textSizeSlider.value) }, { commit: true });
        });
        textSizeInput.addEventListener('change', () => {
            tm().applyProp({ fontSize: parseInt(textSizeInput.value) }, { commit: true });
        });
    }

    [btnTextBold, btnTextItalic, btnTextUnderline, btnAlignLeft, btnAlignCenter, btnAlignRight].forEach(btn => {
        btn?.addEventListener('mousedown', (e) => e.preventDefault());
    });

    btnTextBold?.addEventListener('click', () => {
        const obj = canvasManager.canvas.getActiveObject();
        const next = obj?.fontWeight === 'bold' ? 'normal' : 'bold';
        tm().applyProp({ fontWeight: next });
        btnTextBold.classList.toggle('active', next === 'bold');
    });

    btnTextItalic?.addEventListener('click', () => {
        const obj = canvasManager.canvas.getActiveObject();
        const next = obj?.fontStyle === 'italic' ? 'normal' : 'italic';
        tm().applyProp({ fontStyle: next });
        btnTextItalic.classList.toggle('active', next === 'italic');
    });

    btnTextUnderline?.addEventListener('click', () => {
        const obj = canvasManager.canvas.getActiveObject();
        const next = !obj?.underline;
        tm().applyProp({ underline: next });
        btnTextUnderline.classList.toggle('active', next);
    });

    btnAlignLeft?.addEventListener('click', () => {
        tm().applyProp({ textAlign: 'left' });
        [btnAlignLeft, btnAlignCenter, btnAlignRight].forEach(b => b?.classList.remove('active'));
        btnAlignLeft.classList.add('active');
    });
    btnAlignCenter?.addEventListener('click', () => {
        tm().applyProp({ textAlign: 'center' });
        [btnAlignLeft, btnAlignCenter, btnAlignRight].forEach(b => b?.classList.remove('active'));
        btnAlignCenter.classList.add('active');
    });
    btnAlignRight?.addEventListener('click', () => {
        tm().applyProp({ textAlign: 'right' });
        [btnAlignLeft, btnAlignCenter, btnAlignRight].forEach(b => b?.classList.remove('active'));
        btnAlignRight.classList.add('active');
    });

    btnAlignLeft?.classList.add('active');

    if (textLeadingSlider && textLeadingInput) {
        syncControls(textLeadingSlider, textLeadingInput, (val) => {
            tm().applyProp({ lineHeight: val / 100 }, { commit: false });
        });
        textLeadingSlider.addEventListener('change', () => {
            tm().applyProp({ lineHeight: parseInt(textLeadingSlider.value) / 100 }, { commit: true });
        });
        textLeadingInput.addEventListener('change', () => {
            tm().applyProp({ lineHeight: parseInt(textLeadingInput.value) / 100 }, { commit: true });
        });
    }

    if (textSpacingSlider && textSpacingInput) {
        syncControls(textSpacingSlider, textSpacingInput, (val) => {
            tm().applyProp({ charSpacing: val }, { commit: false });
        });
        textSpacingSlider.addEventListener('change', () => {
            tm().applyProp({ charSpacing: parseInt(textSpacingSlider.value) }, { commit: true });
        });
        textSpacingInput.addEventListener('change', () => {
            tm().applyProp({ charSpacing: parseInt(textSpacingInput.value) }, { commit: true });
        });
    }

    textColorWrap?.addEventListener('click', () => {
        colorPickerModal.show(textCurrentColor, (hex) => {
            textCurrentColor = hex;
            if (textColorSwatch) textColorSwatch.style.background = hex;
            tm().applyProp({ fill: hex });
        });
    });

    canvasManager.onBrushSizeChange = (newSize) => {
        sizeSlider.value = newSize;
        sizeInput.value = newSize;
        const min = parseFloat(sizeSlider.min) || 0;
        const max = parseFloat(sizeSlider.max) || 100;
        const percentage = ((newSize - min) / (max - min)) * 100;
        sizeSlider.style.setProperty('--slider-fill', `${percentage}%`);
    };

    canvasManager.onBrushOpacityChange = (newOpacity) => {
        opacitySlider.value = newOpacity;
        opacityInput.value = newOpacity;
        const min = parseFloat(opacitySlider.min) || 0;
        const max = parseFloat(opacitySlider.max) || 100;
        const percentage = ((newOpacity - min) / (max - min)) * 100;
        opacitySlider.style.setProperty('--slider-fill', `${percentage}%`);
    };

    function updateToolbarUI(tool) {
        const show = (el) => el && (el.style.display = 'block');
        const hide = (el) => el && (el.style.display = 'none');
        const hideText = () => hide(textControls);

        if (tool === 'brush' || tool === 'pen') {
            show(sizeContainer); show(opacityContainer); show(stabilizerContainer);
            hide(toleranceContainer); hideText();
        } else if (tool === 'rectangle' || tool === 'ellipse' || tool === 'line') {
            show(sizeContainer); show(opacityContainer);
            hide(stabilizerContainer); hide(toleranceContainer); hideText();
        } else if (tool === 'eraser') {
            show(sizeContainer);
            hide(opacityContainer); hide(stabilizerContainer); hide(toleranceContainer); hideText();
        } else if (tool === 'fill') {
            show(toleranceContainer);
            hide(sizeContainer); hide(opacityContainer); hide(stabilizerContainer); hideText();
        } else if (tool === 'text') {
            if (textControls) textControls.style.display = 'flex';
            hide(sizeContainer); hide(opacityContainer); hide(stabilizerContainer); hide(toleranceContainer);
        } else {
            hide(sizeContainer); hide(opacityContainer); hide(stabilizerContainer);
            hide(toleranceContainer); hideText();
        }
    }

    canvasManager.onToolChange = (tool) => {
        updateActiveButtonUI(tool);
        updateToolbarUI(tool);
    };

    canvasManager.canvas.on('mouse:dblclick', (opt) => {
        if (canvasManager.currentTool !== 'select') return;
        if (!opt.target || opt.target.type !== 'i-text') return;
        if (textControls) textControls.style.display = 'flex';
        syncTextUI(opt.target);
    });

    canvasManager.canvas.on('selection:cleared', () => {
        if (canvasManager.currentTool === 'select' && textControls) {
            textControls.style.display = 'none';
        }
    });

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

            const TEXT_STYLE_BTNS = ['btn-text-bold', 'btn-text-italic', 'btn-text-underline',
                'btn-text-align-left', 'btn-text-align-center', 'btn-text-align-right'];
            if (TEXT_STYLE_BTNS.includes(toolId)) return;

            switch (toolId) {
                case 'btn-brush': canvasManager.setTool('brush'); break;
                case 'btn-pen': canvasManager.setTool('pen'); break;
                case 'btn-eyedropper':
                    canvasManager.setTool('eyedropper');
                    canvasManager.pickColor();
                    break;
                case 'btn-eraser': canvasManager.setTool('eraser'); break;
                case 'btn-fill': canvasManager.setTool('fill'); break;
                case 'btn-rectangle': canvasManager.setTool('rectangle'); break;
                case 'btn-line': canvasManager.setTool('line'); break;
                case 'btn-ellipse': canvasManager.setTool('ellipse'); break;
                case 'btn-cutarea': canvasManager.setTool('cutarea'); break;
                case 'btn-select': canvasManager.setTool('select'); break;
                case 'btn-pan': canvasManager.setTool('pan'); break;
                case 'btn-text': canvasManager.setTool('text'); break;
            }

            canvasManager.eyeDropperManager.onColorPicked = (hex) => {
                colorManager.setColorFromHex(hex);
            };
        });
    });
});