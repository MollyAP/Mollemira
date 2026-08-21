
        (() => {
            'use strict';

            const PENTA_VERSION = 5;
            const MIN_ZOOM = 0.05;
            const MAX_ZOOM = 100;
            const MOBILE_LAYOUT_QUERY = '(max-width: 820px), (hover: none) and (pointer: coarse)';
            const $ = sel => document.querySelector(sel);
            const $$ = sel => [...document.querySelectorAll(sel)];
            const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
            const uid = () => crypto?.randomUUID?.() || Math.random().toString(36).slice(2);

            const state = {
                width: 1280,
                height: 720,
                tool: 'brush',
                activeShapeTool: 'rect',
                activeSelectionTool: 'rectSelect',
                activeMoveTool: 'movePixels',
                showAltTools: null,
                transformDrag: null,
                lineEdit: null,
                linePointDrag: null,
                lineCurveType: 'spline',
                lineStartCap: 'flat',
                lineEndCap: 'flat',
                lineDash: 'solid',
                fxViewer: {
                    activeEffect: null,
                    pixel: {
                        palette: 'none',
                        pixelSize: 1,
                        dither: 0,
                        erode: 0,
                        brightness: 0,
                        contrast: 0,
                        saturation: 0,
                        crt: false,
                        glitch: false,
                        cycle: false,
                        ghost: false,
                        frameCount: 12,
                        frameDelay: 150,
                        target: 'activeLayer',
                        previewBase: null,
                        previewLayerId: null,
                        generatedFrames: false,
                        previewTimer: null
                    }
                },
                primaryColor: '#d70040',
                secondaryColor: '#38d5ff',
                colorLabMode: 'HEX',
                strokeColor: '#d70040',
                brushLab: {
                    spacing: 8,
                    scatter: 0,
                    sizeJitter: 0,
                    opacityJitter: 0,
                    angleJitter: 0,
                    pressureCurve: [
                        { x: 0, y: 0 },
                        { x: .25, y: .18 },
                        { x: .75, y: .9 },
                        { x: 1, y: 1 }
                    ],
                    texture: null,
                    textureName: '',
                    useTexture: false,
                    dualBrush: false,
                    dualOpacity: .45,
                    dualOffset: .35,
                    dualBlend: 'source-over',
                    presets: []
                },
                activeCurvePoint: null,
                size: 18,
                opacity: 1,
                softness: 0,
                stabilizer: 0,
                blend: 'source-over',
                mousePressureEnabled: false,
                antiAlias: true,
                textSize: 42,
                textFont: 'Inter',
                textDefaults: {
                    font: 'Inter',
                    size: 42,
                    fill: '#d70040',
                    stroke: '',
                    strokeWidth: 2,
                    opacity: 1,
                    align: 'left',
                    bold: false,
                    italic: false,
                    underline: false,
                    tracking: 0,
                    kerning: 0,
                    lineHeight: 1.18,
                    textBoxMode: 'point',
                    wrapWidth: 320,
                    shadow: false,
                    shadowColor: '#000000',
                    shadowBlur: 8,
                    shadowOffsetX: 4,
                    shadowOffsetY: 4,
                    glow: false,
                    glowColor: '#38d5ff',
                    glowBlur: 14
                },
                zoom: .72,
                panX: 0,
                panY: 0,
                onion: false,
                fps: 12,
                recentColors: ['#d70040', '#38d5ff'],
                swatches: ['#000000', '#ffffff', '#d70040', '#38d5ff', '#ff5277'],
                palettes: [
                    { name: 'Penta Neon', colors: ['#d70040', '#38d5ff', '#ff5277', '#62e5a8', '#ffcf5a'] },
                    { name: 'Soft Pastel', colors: ['#cdb4db', '#ffc8dd', '#ffafcc', '#bde0fe', '#a2d2ff'] },
                    { name: 'Warm Sunset', colors: ['#ff595e', '#ff924c', '#ffca3a', '#c5ca30', '#8ac926'] },
                    { name: 'Night UI', colors: ['#101116', '#1c1e27', '#303445', '#9ea4bd', '#f4f6ff'] }
                ],
                dockOpen: false,
                activeDock: null,
                bottomDockCompact: false,
                theme: 'Penta Dark',
                documents: [],
                activeDocument: 0,
                frames: [],
                activeFrame: 0,
                activeLayer: 0,
                drawing: false,
                panning: false,
                start: null,
                last: null,
                smooth: null,
                undoStack: [],
                redoStack: [],
                maxHistory: 36,
                playing: false,
                playTimer: null,
                selection: null,
                selectionMode: 'replace',
                selectionClip: 'antialiased',
                selectionPath: null,
                selectionMask: null,
                selectionDraft: null,
                movingSelection: false,
                selectionTransform: null,
                moveToolMode: 'pixels',
                floatingSelection: null,
                selectionOutlineTransform: null,
                resampling: 'nearest',
                lastSelection: null,
                selectedLayerIds: [],
                clipboard: null,
                selectedStrokeIds: [],
                strokeRevisionTarget: 'selected',
                selectedVectorObject: null,
                justCommittedText: false,
                lastTextClick: null,
                textEdit: null,
                snapEnabled: false,
                pixelGrid: false,
                pixelGridThreshold: 5,
                mousePressure: .55,
                lastMoveTime: 0,
                strokePoints: [],
                strokeBase: null,
                strokeDistance: 0,
                strokeStartedAt: 0
            };

            const workspaceTouches = new Map();
            let workspaceGesture = null;

            const toolFamilies = {
                shape: [
                    { tool: 'rect', icon: 'rectangle', title: 'Rectangle' },
                    { tool: 'ellipse', icon: 'circle', title: 'Ellipse' },
                    { tool: 'line', icon: 'pen_size_2', title: 'Line' }
                ],
                selection: [
                    { tool: 'rectSelect', icon: 'select', title: 'Rectangle Select' },
                    { tool: 'lassoSelect', icon: 'gesture', title: 'Lasso Select' },
                    { tool: 'ellipseSelect', icon: 'circle', title: 'Ellipse Select' },
                    { tool: 'magicWand', icon: 'auto_fix_high', title: 'Magic Wand' }
                ],
                move: [
                    { tool: 'movePixels', icon: 'open_with', title: 'Move Selected Pixels' },
                    { tool: 'moveSelection', icon: 'select_all', title: 'Move Selection Outline' }
                ]
            };

            const dockModules = {
                animation: {
                    name: 'Animation Studio',
                    icon: 'animation',
                    render: renderAnimationPanel
                },
                color: {
                    name: 'Color Lab',
                    icon: 'palette',
                    render: renderColorStudio
                },
                brush: {
                    name: 'Brush Manager',
                    icon: 'brush',
                    render: renderBrushLab
                },
                line: {
                    name: 'Line Options',
                    icon: 'pen_size_2',
                    render: renderLineOptionsDock
                },
                strokes: {
                    name: 'Stroke Revision',
                    icon: 'gesture',
                    render: renderStrokeRevision
                },
                text: {
                    name: 'Text Engine',
                    icon: 'text_fields',
                    render: renderTextEngine
                },
                fx: {
                    name: 'Effects Viewer',
                    icon: 'auto_awesome',
                    render: renderFXViewer
                }
            };

            const themes = {
                'Penta Dark': { bg: '#181719', panel: '#211f22', panelSolid: '#211f22', panel2: '#29262a', panel3: '#363137', text: '#f2f0f8', muted: '#aaa4bc', line: 'rgba(215, 0, 64, .20)', accent: '#d70040', accent2: '#dd295f', accentSoft: 'rgba(215, 0, 64, .18)', accentFlat: '#d90a4c', danger: '#d96b86', good: '#8fc9ad', shadow: '0 22px 70px rgba(0, 0, 0, .44)', scheme: 'dark' },
                'Penta Light': { bg: '#eeebf4', panel: '#f4f2f8', panelSolid: '#f8f7fb', panel2: '#ebe7f2', panel3: '#ded8e8', text: '#17131f', muted: '#6b627c', line: 'rgba(215, 0, 64, .18)', accent: '#d70040', accent2: '#b70036', accentSoft: 'rgba(215, 0, 64, .14)', accentFlat: '#d90a4c', danger: '#c75572', good: '#4f9a76', shadow: '0 22px 70px rgba(42, 34, 66, .18)', scheme: 'light' },
                'Penta Glass': { bg: 'rgba(8, 28, 42, .72)', panel: 'rgba(235, 252, 255, .18)', panelSolid: 'rgba(235, 252, 255, .30)', panel2: 'rgba(214, 246, 255, .20)', panel3: 'rgba(187, 238, 255, .26)', text: '#f5fdff', muted: '#b8e6ee', line: 'rgba(255, 255, 255, .28)', accent: '#00c8d7', accent2: '#7deeff', accentSoft: 'rgba(0, 200, 215, .22)', accentFlat: '#16d9e8', danger: '#ff6b8b', good: '#79f2c9', shadow: '0 22px 70px rgba(0, 25, 42, .42)', scheme: 'dark' }
            };

            const els = {
                shell: $('#canvasShell'), stage: $('#stage'), workspace: $('#workspace'), composite: $('#compositeCanvas'), preview: $('#previewCanvas'), cursor: $('#cursorPreview'), pixelGrid: $('#pixelGridOverlay'), uiOverlay: $('#uiOverlayCanvas'), selectionBox: $('#selectionBox'), textEditor: $('#textEditor'),
                layerList: $('#layerList'), framesStrip: null, toast: $('#toast'), status: $('#statusLine')
            };

            const pixelPalettes = {
                none: { name: 'None', colors: null },
                sora: { name: 'Sora', colors: [[0, 0, 0], [8, 14, 32], [22, 32, 60], [36, 54, 92], [52, 76, 120], [72, 104, 152], [100, 140, 184], [168, 148, 40], [220, 200, 90], [248, 236, 160], [255, 252, 228], [224, 160, 128]] },
                gameboy: { name: 'Game Boy', colors: [[8, 24, 32], [52, 104, 86], [136, 192, 112], [224, 248, 208]] },
                nes: { name: 'NES', colors: [[0, 0, 0], [252, 252, 252], [188, 188, 188], [124, 124, 124], [228, 0, 8], [248, 56, 0], [248, 184, 0], [172, 124, 0], [0, 184, 0], [88, 216, 84], [0, 168, 68], [0, 232, 216], [0, 120, 248], [104, 68, 252], [216, 0, 204], [248, 120, 88]] },
                cga: { name: 'CGA', colors: [[0, 0, 0], [85, 255, 255], [255, 85, 255], [255, 255, 255]] },
                c64: { name: 'C64', colors: [[0, 0, 0], [255, 255, 255], [136, 0, 0], [170, 255, 238], [204, 68, 204], [0, 204, 85], [0, 0, 170], [238, 238, 119], [136, 68, 0], [102, 68, 0], [255, 119, 119], [51, 51, 51], [119, 119, 119], [170, 255, 102], [0, 136, 255], [187, 187, 187]] },
                pico8: { name: 'PICO-8', colors: [[0, 0, 0], [29, 43, 83], [126, 37, 83], [0, 135, 81], [171, 82, 54], [95, 87, 79], [194, 195, 199], [255, 241, 232], [255, 0, 77], [255, 163, 0], [255, 236, 39], [0, 228, 54], [41, 173, 255], [131, 118, 156], [255, 119, 168], [255, 204, 170]] },
                sweetie16: { name: 'Sweetie 16', colors: [[26, 28, 44], [93, 39, 93], [177, 62, 83], [239, 125, 87], [255, 205, 117], [167, 240, 112], [56, 183, 100], [37, 113, 121], [41, 54, 111], [59, 93, 201], [65, 166, 246], [115, 239, 247], [244, 244, 244], [148, 176, 194], [86, 108, 134], [51, 60, 87]] },
                mono: { name: 'Mono', colors: [[0, 0, 0], [34, 34, 34], [68, 68, 68], [102, 102, 102], [136, 136, 136], [170, 170, 170], [204, 204, 204], [238, 238, 238], [255, 255, 255]] },
                sunset: { name: 'Sunset', colors: [[13, 2, 33], [44, 6, 69], [87, 10, 82], [140, 15, 75], [191, 36, 51], [224, 80, 29], [240, 134, 28], [248, 190, 53], [255, 237, 120], [255, 255, 230]] },
                cyber: { name: 'Cyber', colors: [[8, 4, 16], [20, 8, 40], [48, 12, 64], [100, 20, 100], [180, 20, 100], [255, 40, 120], [255, 140, 200], [10, 40, 80], [0, 160, 200], [80, 240, 255], [200, 160, 255], [255, 255, 255]] },
                horror: { name: 'Horror', colors: [[0, 0, 0], [24, 4, 4], [60, 8, 8], [120, 16, 16], [180, 20, 20], [220, 60, 40], [40, 44, 16], [72, 80, 32], [48, 24, 48], [80, 72, 68], [200, 180, 140], [240, 220, 190]] }
            };

            function toast(msg) {
                positionToast();
                els.toast.textContent = msg;
                els.toast.classList.add('show');
                clearTimeout(toast._t);
                toast._t = setTimeout(() => els.toast.classList.remove('show'), 2400);
            }

            function positionToast() {
                const dock = document.getElementById('bottomDock');
                const dockHeight = dock?.getBoundingClientRect().height || (state.dockOpen && !state.bottomDockCompact ? 138 : 58);
                els.toast?.style.setProperty('--toast-bottom', `${Math.round(dockHeight + 18)}px`);
            }

            function closePentaWindow() {
                document.querySelector('.penta-modal-backdrop')?.remove();
            }

            function openPentaWindow({ title, body, actions = [] }) {
                closePentaWindow();

                const wrap = document.createElement('div');
                wrap.className = 'penta-modal-backdrop';

                wrap.innerHTML = `
          <div class="penta-window" role="dialog" aria-modal="true">
            <div class="penta-window-header">
              <span>${escapeHtml(title)}</span>
              <button class="icon-btn" data-close-window>
                <span class="material-symbols-rounded">close</span>
              </button>
            </div>
            <div class="penta-window-body">${body}</div>
            <div class="penta-window-actions">
              ${actions.map(a => `
                <button class="btn ${a.primary ? 'primary' : ''} ${a.danger ? 'danger' : ''}" data-window-action="${a.id}">
                  ${a.icon ? `<span class="material-symbols-rounded">${a.icon}</span>` : ''}
                  ${escapeHtml(a.label)}
                </button>
              `).join('')}
            </div>
          </div>
        `;

                document.body.appendChild(wrap);

                wrap.addEventListener('click', e => {
                    if (e.target === wrap || e.target.closest('[data-close-window]')) closePentaWindow();
                });

                for (const action of actions) {
                    wrap.querySelector(`[data-window-action="${action.id}"]`)?.addEventListener('click', () => {
                        action.onClick?.(wrap);
                    });
                }

                return wrap;
            }

            function makeCanvas(w = state.width, h = state.height) {
                const c = document.createElement('canvas');
                c.width = w; c.height = h;
                c.className = 'layer-canvas';
                return c;
            }

            function makeLayer(name = 'Layer', type = 'raster') {
                return { id: uid(), name, type, visible: true, opacity: 1, blend: 'source-over', canvas: makeCanvas(), offsetX: 0, offsetY: 0, freeSize: false, objects: [], strokeEvents: [], revisionBase: null };
            }

            function currentFps(max = 60) {
                const value = Number($('#fps')?.value || state.fps || 12);
                state.fps = clamp(value, 1, 60);
                return clamp(value, 1, max);
            }

            function makeFrame(name) {
                const bg = makeLayer('Background');

                const ctx = bg.canvas.getContext('2d');
                ctx.save();
                ctx.globalCompositeOperation = 'source-over';
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, state.width, state.height);
                ctx.restore();

                return { id: uid(), name, duration: 1000 / currentFps(), layers: [bg] };
            }

            function makeDocument(name, width, height) {
                const prev = { width: state.width, height: state.height };
                state.width = width;
                state.height = height;
                const doc = {
                    id: uid(),
                    name,
                    width,
                    height,
                    frames: [makeFrame('Frame 1')],
                    activeFrame: 0,
                    activeLayer: 0,
                    undoStack: [],
                    redoStack: []
                };
                state.width = prev.width;
                state.height = prev.height;
                return doc;
            }

            function activeDocument() {
                return state.documents[state.activeDocument];
            }

            function syncActiveDocumentFromState() {
                const doc = activeDocument();
                if (!doc) return;
                doc.width = state.width;
                doc.height = state.height;
                doc.frames = state.frames;
                doc.activeFrame = state.activeFrame;
                doc.activeLayer = state.activeLayer;
                doc.undoStack = state.undoStack;
                doc.redoStack = state.redoStack;
            }

            function loadDocumentToState(doc) {
                state.width = doc.width;
                state.height = doc.height;
                state.frames = doc.frames;
                state.activeFrame = doc.activeFrame || 0;
                state.activeLayer = doc.activeLayer || 0;
                state.undoStack = doc.undoStack || [];
                state.redoStack = doc.redoStack || [];
            }

            function switchDocument(index) {
                if (!state.documents[index]) return;
                if (state.floatingSelection) commitFloatingSelection();
                syncActiveDocumentFromState();
                state.activeDocument = index;
                loadDocumentToState(state.documents[index]);
                state.lineEdit = null;
                state.linePointDrag = null;
                state.floatingSelection = null;
                state.selectionOutlineTransform = null;
                closeCanvasSwitcher();
                sizeAllCanvases();
                fitStage();
                renderAll();
            }

            function activeFrame() { return state.frames[state.activeFrame]; }
            function activeLayer() { return activeFrame().layers[state.activeLayer]; }

            function init() {
                state.theme = localStorage.getItem('penta.theme') || state.theme;
                state.bottomDockCompact = localStorage.getItem('penta.bottomDockCompact') === 'true';
                const doc = makeDocument('Canvas 1', state.width, state.height);
                state.documents = [doc];
                state.activeDocument = 0;
                loadDocumentToState(doc);
                applyTheme(state.theme, false);
                setBottomDockCompact(state.bottomDockCompact, false);
                sizeAllCanvases();
                renderDockLaunchers();
                initLayerDockToggle();
                attachEvents();
                requestAnimationFrame(selectionOverlayTick);
                requestAnimationFrame(() => {
                    fitStage();
                    renderAll();

                    requestAnimationFrame(() => {
                        centerCanvasInWorkspace();
                    });
                });
                pushHistory('Initial project');
                toast('Welcome to Penta, let\'s start drawing!');
            }

            function applyTheme(name, persist = true) {
                const theme = themes[name] || themes['Penta Dark'];
                state.theme = themes[name] ? name : 'Penta Dark';
                const root = document.documentElement.style;
                const values = { bg: '--bg', panel: '--panel', panelSolid: '--panel-solid', panel2: '--panel-2', panel3: '--panel-3', text: '--text', muted: '--muted', line: '--line', accent: '--accent', accent2: '--accent-2', accentSoft: '--accent-soft', accentFlat: '--accent-flat', danger: '--danger', good: '--good', shadow: '--shadow' };
                Object.entries(values).forEach(([key, variable]) => root.setProperty(variable, theme[key]));
                document.documentElement.style.colorScheme = theme.scheme;
                document.body.classList.toggle('penta-glass-theme', state.theme === 'Penta Glass');
                if (persist) localStorage.setItem('penta.theme', state.theme);
                updateControls?.();
            }

            function setBottomDockCompact(compact, persist = true) {
                state.bottomDockCompact = !!compact;
                document.querySelector('.app')?.classList.toggle('bottom-dock-compact', state.bottomDockCompact);
                const toggle = $('#bottomDockCompactToggle');
                if (toggle) {
                    toggle.title = state.bottomDockCompact ? 'Expand bottom dock' : 'Collapse bottom dock';
                    toggle.setAttribute('aria-label', toggle.title);
                    toggle.setAttribute('aria-pressed', String(state.bottomDockCompact));
                    toggle.querySelector('.material-symbols-rounded').textContent = state.bottomDockCompact ? 'chevron_right' : 'chevron_left';
                }
                if (persist) localStorage.setItem('penta.bottomDockCompact', String(state.bottomDockCompact));
                renderDockLaunchers?.();
                requestAnimationFrame(positionToast);
            }

            function initLayerDockToggle() {
                const app = document.querySelector('.app');
                const toggle = document.getElementById('layerDockToggle');
                if (!app || !toggle) return;

                toggle.addEventListener('click', () => {
                    const collapsed = app.classList.toggle('layer-dock-collapsed');

                    toggle.setAttribute('aria-expanded', String(!collapsed));
                    toggle.title = collapsed ? 'Expand layer dock' : 'Collapse layer dock';
                    toggle.setAttribute('aria-label', collapsed ? 'Expand layer dock' : 'Collapse layer dock');
                    toggle.querySelector('.material-symbols-rounded').textContent =
                        collapsed ? 'chevron_backward' : 'chevron_forward';

                    requestAnimationFrame(() => {
                        resizeOverlayCanvases?.();
                        fitStage?.();
                        renderAll?.();
                    });
                });
            }

            function selectionOverlayTick() {
                if (state.selectionMask || state.floatingSelection) {
                    drawSelectedVectorOverlay();
                }
                requestAnimationFrame(selectionOverlayTick);
            }

            function sizeAllCanvases() {
                els.shell.style.width = state.width + 'px';
                els.shell.style.height = state.height + 'px';
                els.composite.width = state.width;
                els.composite.height = state.height;
                Object.assign(els.composite.style, { width: state.width + 'px', height: state.height + 'px' });
                els.preview.width = state.width;
                els.preview.height = state.height;
                Object.assign(els.preview.style, { width: state.width + 'px', height: state.height + 'px' });
                for (const frame of state.frames) for (const layer of frame.layers) {
                    if (!layer.freeSize && (layer.canvas.width !== state.width || layer.canvas.height !== state.height)) {
                        const old = layer.canvas;
                        const next = makeCanvas();
                        next.getContext('2d').drawImage(old, 0, 0);
                        layer.canvas = next;
                        layer.offsetX = 0;
                        layer.offsetY = 0;
                    }
                }
            }

            function mountLayers() {
                [...els.shell.querySelectorAll('.layer-canvas')].forEach(n => n.remove());
                const frame = activeFrame();
                for (const layer of frame.layers) {
                    const x = layer.offsetX || 0;
                    const y = layer.offsetY || 0;
                    Object.assign(layer.canvas.style, {
                        inset: 'auto',
                        left: x + 'px', top: y + 'px',
                        width: layer.canvas.width + 'px', height: layer.canvas.height + 'px',
                        opacity: layer.opacity, display: (layer.visible && (layer.type || 'raster') === 'raster') ? 'block' : 'none', mixBlendMode: layer.blend || 'normal'
                    });
                    els.shell.insertBefore(layer.canvas, els.composite);
                }
            }

            function composite(frame = activeFrame(), includeOnion = false) {
                const c = els.composite;
                const ctx = c.getContext('2d');
                ctx.clearRect(0, 0, state.width, state.height);

                if (includeOnion && state.onion && state.activeFrame > 0) {
                    ctx.save();
                    ctx.globalAlpha = .22;
                    ctx.globalCompositeOperation = 'source-over';
                    for (const layer of state.frames[state.activeFrame - 1].layers) if (layer.visible) drawLayerToContext(ctx, layer);
                    ctx.restore();
                }

                for (const layer of frame.layers) {
                    if (!layer.visible) continue;
                    ctx.save();
                    ctx.globalAlpha = layer.opacity;
                    ctx.globalCompositeOperation = layer.blend || 'source-over';
                    drawLayerToContext(ctx, layer);
                    ctx.restore();
                }
                return c;
            }

            function renderAll() {
                mountLayers();
                composite(activeFrame(), true);
                renderLayers();
                renderFrames();
                updateControls();
                drawSelectedVectorOverlay();
                syncActiveDocumentFromState();
            }

            function updateControls() {
                $('#cw').value = state.width; $('#ch').value = state.height;
                $('#color').value = state.primaryColor;
                $('#colorText').value = state.primaryColor;
                const color2 = $('#color2');
                const colorText2 = $('#colorText2');
                if (color2) color2.value = state.secondaryColor;
                if (colorText2) colorText2.value = state.secondaryColor;
                if (!state.antiAlias) state.resampling = 'nearest';
                $('#size').value = state.size; $('#sizeOut').value = state.size;
                $('#opacity').value = Math.round(state.opacity * 100); $('#opacityOut').value = Math.round(state.opacity * 100) + '%';
                $('#softness').value = Math.round(state.softness * 100); $('#softOut').value = Math.round(state.softness * 100) + '%';
                $('#stabilizer').value = Math.round(state.stabilizer * 100); $('#stabOut').value = Math.round(state.stabilizer * 100) + '%';
                $('#blend').value = state.blend;
                $('#mousePressureEnabled').value = state.mousePressureEnabled ? 'on' : 'off';
                updateAntialiasButton();
                $('#pixelGridToggle')?.classList.toggle('active', state.pixelGrid);
                $('#textSize').value = state.textSize;
                $('#layerOpacity').value = Math.round(activeLayer().opacity * 100); $('#layerOpacityOut').value = Math.round(activeLayer().opacity * 100) + '%';
                $$('input[type="range"]').forEach(input => {
                    const min = Number(input.min || 0), max = Number(input.max || 100), value = Number(input.value);
                    input.style.setProperty('--range-fill', `${clamp((value - min) / Math.max(1, max - min) * 100, 0, 100)}%`);
                });
                const fps = $('#fps');
                if (fps) fps.value = state.fps;
                const onion = $('#onion');
                if (onion) onion.innerHTML = `<span class="material-symbols-rounded">animation</span>Onion: ${state.onion ? 'On' : 'Off'}`;
                const z = snapZoomForPixelGrid(state.zoom);
                if (pixelGridActive()) {
                    state.zoom = z;
                    state.panX = Math.round(state.panX);
                    state.panY = Math.round(state.panY);
                }
                // On a phone the stage is the viewport.  Transforming it moves the
                // viewport itself (and is what caused the canvas to drift offscreen).
                // Keep it fixed and transform only the canvas shell instead.
                const mobileLayout = window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
                if (mobileLayout) {
                    els.stage.style.transform = 'none';
                    els.shell.style.transform = `translate(-50%, -50%) translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
                } else {
                    els.shell.style.transform = '';
                    els.stage.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
                }
                els.status.innerHTML =
                    `<span>${state.width}×${state.height}</span>` +
                    `<span>${Math.round(state.zoom * 100)}%</span>` +
                    `<span>${activeFrame().layers.length} layers</span>` +
                    `<span>${state.activeFrame + 1}/${state.frames.length} frames</span>`;
                updatePixelViewMode();
                updatePixelGridOverlay();
                redrawUiOverlay();
                updateToolButtons();
                renderAltTools();
            }

            function updatePixelViewMode() {
                const zoomedIn = state.zoom >= 1;

                document.querySelector('.app')?.classList.toggle(
                    'pixel-accurate-view',
                    zoomedIn
                );
            }

            function canvasToScreenPoint(p) {
                const wr = els.workspace.getBoundingClientRect();
                const sr = els.shell.getBoundingClientRect();

                return {
                    x: sr.left - wr.left + p.x * state.zoom,
                    y: sr.top - wr.top + p.y * state.zoom
                };
            }

            function redrawUiOverlay() {
                const c = els.uiOverlay;
                if (!c) return;

                const wr = els.workspace.getBoundingClientRect();
                const dpr = window.devicePixelRatio || 1;

                c.width = Math.round(wr.width * dpr);
                c.height = Math.round(wr.height * dpr);
                c.style.width = wr.width + 'px';
                c.style.height = wr.height + 'px';

                const ctx = c.getContext('2d');
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.clearRect(0, 0, wr.width, wr.height);

                drawScreenSpaceHandles(ctx);
            }

            function drawScreenHandle(ctx, p, active = false) {
                const s = canvasToScreenPoint(p);

                ctx.save();
                ctx.fillStyle = active ? '#38d5ff' : '#1c1e27';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.rect(Math.round(s.x) - 5.5, Math.round(s.y) - 5.5, 11, 11);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            }

            function drawScreenPath(ctx, points, close = true, color = '#38d5ff') {
                if (!points?.length) return;
                ctx.save();
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                ctx.setLineDash([6, 4]);
                ctx.beginPath();
                points.forEach((p, i) => {
                    const s = canvasToScreenPoint(p);
                    if (i === 0) ctx.moveTo(s.x, s.y);
                    else ctx.lineTo(s.x, s.y);
                });
                if (close) ctx.closePath();
                ctx.stroke();
                ctx.restore();
            }

            function drawScreenTransform(ctx, corners, handles, color = '#38d5ff') {
                drawScreenPath(ctx, corners, true, color);
                for (const h of handles) drawScreenHandle(ctx, h, h.id === 'rotate' || h.id === 'pivot');
            }

            function drawScreenSpaceHandles(ctx) {
                if (state.floatingSelection) {
                    drawScreenTransform(ctx, floatingSelectionCorners(state.floatingSelection), floatingSelectionHandles(state.floatingSelection), '#38d5ff');
                }
                if (state.selectionOutlineTransform && state.tool === 'moveSelection') {
                    drawScreenTransform(ctx, floatingSelectionCorners(state.selectionOutlineTransform), floatingSelectionHandles(state.selectionOutlineTransform), '#38d5ff');
                }
                if (state.lineEdit && state.tool === 'line') {
                    const handles = lineEditScreenHandles(state.lineEdit);
                    for (const h of handles) drawScreenHandle(ctx, h, h.type === 'move');
                }
                if (state.textEdit) return;
                const obj = getSelectedObject?.();
                if (obj && !obj._editing) {
                    const b = vectorObjectBounds(obj);
                    const corners = [
                        { x: b.x, y: b.y },
                        { x: b.x + b.w, y: b.y },
                        { x: b.x + b.w, y: b.y + b.h },
                        { x: b.x, y: b.y + b.h }
                    ];
                    drawScreenTransform(ctx, corners, getTransformHandles(obj), state.primaryColor);
                }
            }

            function updateAntialiasButton() {
                const btn = $('#antiAliasToggle');
                if (!btn) return;

                btn.classList.toggle('active', state.antiAlias);
                btn.title = state.antiAlias
                    ? 'Antialiasing: ON (smooth)'
                    : 'Antialiasing: OFF (jagged)';

                const icon = btn.querySelector('.material-symbols-rounded');
                if (icon) icon.textContent = state.antiAlias ? 'line_start_circle' : 'line_start_square';
            }

            function renderAltTools() {
                const section = $('#altToolsSection');
                const row = $('#altTools');
                const modeSection = $('#modeToolsSection');
                const modeRow = $('#modeTools');
                const family = state.showAltTools;
                if (!section || !row) return;

                if (!family || !toolFamilies[family]) {
                    section.style.display = 'none';
                    row.innerHTML = '';
                    if (modeSection) modeSection.style.display = 'none';
                    if (modeRow) modeRow.innerHTML = '';
                    return;
                }

                section.style.display = 'block';
                row.innerHTML = toolFamilies[family].map(t => `
          <button class="tool-btn ${state.tool === t.tool ? 'active' : ''}"
            data-alt-tool="${t.tool}"
            data-family="${family}"
            title="${t.title}">
            <span class="material-symbols-rounded">${t.icon}</span>
          </button>
                `).join('');

                const selectionActive = family === 'selection' || ['rectSelect', 'ellipseSelect', 'lassoSelect', 'magicWand'].includes(state.tool);
                if (modeSection && modeRow) {
                    modeSection.style.display = selectionActive ? 'block' : 'none';
                    modeRow.innerHTML = selectionActive ? [
                        ['replace', 'crop_square', 'Replace'], ['add', 'add', 'Add'],
                        ['subtract', 'remove', 'Subtract'], ['intersect', 'interests', 'Intersect']
                    ].map(([mode, icon, title]) => `<button class="tool-btn ${state.selectionMode === mode ? 'active' : ''}" data-selection-mode="${mode}" title="${title} selection"><span class="material-symbols-rounded">${icon}</span></button>`).join('') : '';
                    modeRow.querySelectorAll('[data-selection-mode]').forEach(btn => btn.onclick = () => {
                        state.selectionMode = btn.dataset.selectionMode;
                        renderAltTools();
                        toast(`${btn.title}.`);
                    });
                }
            }

            function getToolDef(family, tool) {
                return toolFamilies[family]?.find(t => t.tool === tool);
            }

            function updateToolFamilyButtons() {
                const shape = getToolDef('shape', state.activeShapeTool);
                const sel = getToolDef('selection', state.activeSelectionTool);
                const move = getToolDef('move', state.activeMoveTool);
                const shapeBtn = $('#shapeToolBtn');
                const selBtn = $('#selectionToolBtn');
                const moveBtn = $('#moveToolBtn');

                if (shape && shapeBtn) {
                    shapeBtn.querySelector('.material-symbols-rounded').textContent = shape.icon;
                    shapeBtn.title = shape.title;
                }

                if (sel && selBtn) {
                    selBtn.querySelector('.material-symbols-rounded').textContent = sel.icon;
                    selBtn.title = sel.title;
                }

                if (move && moveBtn) {
                    moveBtn.querySelector('.material-symbols-rounded').textContent = move.icon;
                    moveBtn.title = move.title;
                }

                shapeBtn?.classList.toggle('active', toolFamilies.shape.some(t => t.tool === state.tool));
                selBtn?.classList.toggle('active', toolFamilies.selection.some(t => t.tool === state.tool));
                moveBtn?.classList.toggle('active', toolFamilies.move.some(t => t.tool === state.tool));
            }

            function updateToolButtons() {
                $$('#tools .tool-btn').forEach(btn => {
                    const tool = btn.dataset.tool;
                    const family = btn.dataset.family;
                    let active = false;

                    if (tool) active = state.tool === tool;
                    if (family === 'shape') active = toolFamilies.shape.some(t => t.tool === state.tool);
                    if (family === 'selection') active = toolFamilies.selection.some(t => t.tool === state.tool);
                    if (family === 'move') active = toolFamilies.move.some(t => t.tool === state.tool);

                    btn.classList.toggle('active', active);
                });

                updateToolFamilyButtons();
                renderMobileContextControls();
            }

            function syncActiveToolFamily(tool) {
                if (toolFamilies.shape.some(t => t.tool === tool)) state.activeShapeTool = tool;
                if (toolFamilies.selection.some(t => t.tool === tool)) state.activeSelectionTool = tool;
                if (toolFamilies.move.some(t => t.tool === tool)) state.activeMoveTool = tool;
            }

            function pixelGridActive() {
                return state.pixelGrid && state.zoom >= state.pixelGridThreshold;
            }

            function snapZoomForPixelGrid(z) {
                if (!pixelGridActive()) return z;
                return Math.max(1, Math.round(z));
            }

            function updatePixelGridOverlay() {
                const grid = els.pixelGrid;
                if (!grid) return;

                const show = state.pixelGrid && state.zoom >= state.pixelGridThreshold;
                grid.style.display = show ? 'block' : 'none';
                if (!show) return;

                const workspaceRect = els.workspace.getBoundingClientRect();
                const shellRect = els.shell.getBoundingClientRect();
                const dpr = window.devicePixelRatio || 1;

                grid.width = Math.round(workspaceRect.width * dpr);
                grid.height = Math.round(workspaceRect.height * dpr);
                grid.style.width = workspaceRect.width + 'px';
                grid.style.height = workspaceRect.height + 'px';

                const ctx = grid.getContext('2d');
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.clearRect(0, 0, workspaceRect.width, workspaceRect.height);

                const left = shellRect.left - workspaceRect.left;
                const top = shellRect.top - workspaceRect.top;
                const cellX = state.zoom;
                const cellY = state.zoom;
                const right = left + shellRect.width;
                const bottom = top + shellRect.height;

                ctx.save();
                ctx.beginPath();
                ctx.rect(left, top, shellRect.width, shellRect.height);
                ctx.clip();

                ctx.lineWidth = Math.max(1, window.devicePixelRatio || 1) / (window.devicePixelRatio || 1);
                ctx.strokeStyle = 'rgba(255,255,255,.35)';
                ctx.beginPath();

                for (let i = 0; i <= state.width; i++) {
                    const x = left + i * cellX;
                    ctx.moveTo(x, top);
                    ctx.lineTo(x, bottom);
                }

                for (let i = 0; i <= state.height; i++) {
                    const y = top + i * cellY;
                    ctx.moveTo(left, y);
                    ctx.lineTo(right, y);
                }

                ctx.stroke();
                ctx.restore();
            }

            function applyAliasing(ctx) {
                ctx.imageSmoothingEnabled = state.antiAlias;
                ctx.lineCap = 'butt';
                ctx.lineJoin = state.antiAlias ? 'round' : 'miter';
            }

            function snapPixel(v) {
                return Math.round(v);
            }

            function shouldUseHardPixelBrush() {
                return !state.antiAlias && state.softness <= 0;
            }

            function handleRadius() {
                return clamp(7 / state.zoom, 3, 14);
            }

            function drawJaggedLine(ctx, x0, y0, x1, y1, color, size = 1) {
                x0 = Math.round(x0);
                y0 = Math.round(y0);
                x1 = Math.round(x1);
                y1 = Math.round(y1);

                const s = Math.max(1, Math.round(size));
                const r = Math.max(0, Math.floor(s / 2));
                const dx = Math.abs(x1 - x0);
                const dy = Math.abs(y1 - y0);
                const sx = x0 < x1 ? 1 : -1;
                const sy = y0 < y1 ? 1 : -1;
                let err = dx - dy;

                ctx.save();
                ctx.fillStyle = color;
                ctx.imageSmoothingEnabled = false;

                while (true) {
                    ctx.fillRect(x0 - r, y0 - r, s, s);
                    if (x0 === x1 && y0 === y1) break;
                    const e2 = 2 * err;
                    if (e2 > -dy) {
                        err -= dy;
                        x0 += sx;
                    }
                    if (e2 < dx) {
                        err += dx;
                        y0 += sy;
                    }
                }

                ctx.restore();
            }

            function drawJaggedRect(ctx, x, y, w, h, fill, stroke, strokeWidth = 1) {
                x = Math.round(x);
                y = Math.round(y);
                w = Math.round(w);
                h = Math.round(h);

                if (w < 0) { x += w; w = Math.abs(w); }
                if (h < 0) { y += h; h = Math.abs(h); }

                ctx.save();
                ctx.imageSmoothingEnabled = false;

                if (fill) {
                    ctx.fillStyle = fill;
                    ctx.fillRect(x, y, w, h);
                }

                if (stroke && strokeWidth > 0) {
                    ctx.fillStyle = stroke;
                    const s = Math.max(1, Math.round(strokeWidth));
                    ctx.fillRect(x, y, w, s);
                    ctx.fillRect(x, y + h - s, w, s);
                    ctx.fillRect(x, y, s, h);
                    ctx.fillRect(x + w - s, y, s, h);
                }

                ctx.restore();
            }

            function drawJaggedEllipse(ctx, x, y, w, h, fill, stroke, strokeWidth = 1) {
                x = Math.round(x);
                y = Math.round(y);
                w = Math.round(w);
                h = Math.round(h);

                if (w < 0) { x += w; w = Math.abs(w); }
                if (h < 0) { y += h; h = Math.abs(h); }

                const rx = Math.max(1, Math.round(w / 2));
                const ry = Math.max(1, Math.round(h / 2));
                const cx = x + rx;
                const cy = y + ry;
                const innerRx = Math.max(1, rx - strokeWidth);
                const innerRy = Math.max(1, ry - strokeWidth);

                ctx.save();
                ctx.imageSmoothingEnabled = false;

                if (fill) ctx.fillStyle = fill;
                for (let py = y; py <= y + h; py++) {
                    for (let px = x; px <= x + w; px++) {
                        const nx = (px - cx) / rx;
                        const ny = (py - cy) / ry;
                        const d = nx * nx + ny * ny;
                        if (fill && d <= 1) {
                            ctx.fillRect(px, py, 1, 1);
                        }
                        if (stroke && strokeWidth > 0) {
                            const ix = (px - cx) / innerRx;
                            const iy = (py - cy) / innerRy;
                            const innerD = ix * ix + iy * iy;
                            if (d <= 1 && innerD >= 1) {
                                ctx.fillStyle = stroke;
                                ctx.fillRect(px, py, 1, 1);
                            }
                        }
                    }
                }

                ctx.restore();
            }

            function renderLayers() {
                els.layerList.innerHTML = '';
                const layers = activeFrame().layers;
                layers.slice().reverse().forEach((layer, revIndex) => {
                    const index = layers.length - 1 - revIndex;
                    const item = document.createElement('div');
                    item.className = 'layer-item' + (index === state.activeLayer ? ' active' : '');
                    const thumb = document.createElement('canvas'); thumb.width = 88; thumb.height = 68;
                    const thumbCtx = thumb.getContext('2d');
                    thumbCtx.save();
                    thumbCtx.scale(thumb.width / state.width, thumb.height / state.height);
                    drawLayerToContext(thumbCtx, layer);
                    thumbCtx.restore();
                    item.innerHTML = `<div class="layer-head"><div class="thumb"></div><div><div class="layer-name" contenteditable="true">${escapeHtml(layer.name)}</div><div class="layer-meta">${layer.type || 'raster'} · ${Math.round(layer.opacity * 100)}% · ${layer.blend || 'source-over'}</div></div><div class="mini-actions"><button class="mini vis"><span class="material-symbols-rounded">${layer.visible ? 'visibility' : 'visibility_off'}</span></button></div></div>`;
                    item.querySelector('.thumb').appendChild(thumb);
                    item.addEventListener('click', e => { if (!e.target.closest('.mini') && !e.target.closest('[contenteditable]')) { commitTextEdit(); clearPixelFxPreviewBase(); state.activeLayer = index; renderAll(); } });
                    item.querySelector('.vis').addEventListener('click', e => { e.stopPropagation(); layer.visible = !layer.visible; pushHistory('Layer visibility'); renderAll(); });
                    item.querySelector('.layer-name').addEventListener('blur', e => { layer.name = e.target.textContent.trim() || 'Layer'; renderLayers(); });
                    els.layerList.appendChild(item);
                });
            }

            function renderFrames() {
                els.framesStrip = $('#framesStrip');
                if (!els.framesStrip) return;
                els.framesStrip.innerHTML = '';
                state.frames.forEach((frame, i) => {
                    const card = document.createElement('div');
                    card.className = 'frame-card' + (i === state.activeFrame ? ' active' : '');
                    const preview = document.createElement('canvas'); preview.width = 160; preview.height = 90;
                    const pctx = preview.getContext('2d');
                    const temp = document.createElement('canvas'); temp.width = state.width; temp.height = state.height;
                    const tctx = temp.getContext('2d');
                    for (const layer of frame.layers) if (layer.visible) { tctx.save(); tctx.globalAlpha = layer.opacity; drawLayerToContext(tctx, layer); tctx.restore(); }
                    pctx.drawImage(temp, 0, 0, preview.width, preview.height);
                    card.innerHTML = `<div class="frame-preview"></div><div class="frame-label"><span>${escapeHtml(frame.name)}</span><span>${i + 1}</span></div>`;
                    card.querySelector('.frame-preview').appendChild(preview);
                    card.addEventListener('click', () => { state.activeFrame = i; state.activeLayer = clamp(state.activeLayer, 0, activeFrame().layers.length - 1); renderAll(); });
                    els.framesStrip.appendChild(card);
                });
            }

            function renderDockLaunchers() {
                const dockLaunchers = document.getElementById('dockLaunchers');
                // Line Options is opened by the Line tool; it is not a desktop dock tab.
                const entries = Object.entries(dockModules).filter(([key]) => key !== 'line');
                const activeIndex = entries.findIndex(([key]) => key === state.activeDock);

                const fanGap = 50;
                const stackX = 0;

                dockLaunchers.innerHTML = entries.map(([key, mod], i) => {
                    const fanX = i * fanGap;
                    const collapseX = activeIndex >= 0 ? stackX : fanX;
                    const activeClass = key === state.activeDock ? ' active-dock' : '';
                    const icon = mod.icon;
                    const title = mod.name;

                    return `
            <button
              class="icon-btn${activeClass}"
              data-dock="${key}"
              title="${title}"
              style="
                --fan-x:${fanX}px;
                --collapse-x:${collapseX}px;
                --dock-z:${key === state.activeDock ? 20 : entries.length - i};
              ">
              <span class="material-symbols-rounded">${icon}</span>
            </button>
          `;
                }).join('');
            }

            function renderDockContent() {
                const container = document.getElementById('dockContent');
                const mod = dockModules[state.activeDock];
                if (!mod) return;
                if (!container.querySelector('.dock-page-body')) renderDockShell();
                const body = container.querySelector('.dock-page-body');
                body.innerHTML = '';
                mod.render(body);
                updateControls();
            }

            function renderDockShell() {
                const container = document.getElementById('dockContent');
                const mod = dockModules[state.activeDock];
                if (!container || !mod) return;
                container.innerHTML = `<div class="dock-page-title">${mod.name}</div><div class="dock-page-body"></div>`;
            }

            function renderAnimationPanel(container) {
                container.innerHTML = `
          <div class="animation-panel expanded-only">
            <div class="timeline-controls">
              <button class="icon-btn" id="play">
                <span class="material-symbols-rounded">${state.playing ? 'pause' : 'play_arrow'}</span>
              </button>
              <button class="icon-btn" id="addFrame"><span class="material-symbols-rounded">add_box</span></button>
              <button class="icon-btn danger" id="delFrame">
                <span class="material-symbols-rounded">disabled_by_default</span>
              </button>
              <div class="field" style="width:86px;margin:0">
                <label>FPS</label>
                <input type="number" id="fps" min="1" max="60" value="${state.fps}">
              </div>
            </div>
            <div class="frames-strip" id="framesStrip"></div>
            <div class="timeline-controls">
              <button class="btn" id="onion">
                <span class="material-symbols-rounded">animation</span>Onion: ${state.onion ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        `;

                $('#addFrame').onclick = addFrame;
                $('#delFrame').onclick = deleteFrame;
                $('#play').onclick = togglePlay;
                $('#onion').onclick = () => { state.onion = !state.onion; renderAll(); };
                $('#fps').onchange = () => { state.fps = currentFps(); };
                renderFrames();
            }

            function renderColorStudio(el) {
                const mode = state.colorLabMode || 'HEX';
                const channels = colorLabChannels(state.primaryColor, mode);
                const activePalette = state.palettes[0]?.colors || state.swatches;
                el.innerHTML = `
          <div class="color-studio expanded-only">
            <div class="color-current">
              <div class="color-pair">
                <input type="color" id="csColor" value="${state.primaryColor}" title="Primary color">
                <input type="color" id="csColor2" value="${state.secondaryColor}" title="Secondary color">
              </div>
              <div class="cs-channel-fields" style="--channels:${channels.length}">
                ${channels.map((channel, i) => `<input type="text" class="cs-channel" data-channel="${i}" value="${channel.value}" title="${channel.label}">`).join('')}
              </div>
              <button class="btn cs-mode" id="csMode" title="Cycle color channel mode">${mode}</button>
            </div>

            <div class="cs-block">
              <strong>Recent Swatches</strong>
              <div class="cs-swatches">
                ${state.recentColors.map(c => colorButton(c, false)).join('')}
              </div>
            </div>

            <div class="cs-block">
              <strong>Palette</strong>
              <div class="cs-palette-stack" id="csSwatches">
                ${activePalette.slice(0, 10).map((c, i) => colorButton(c, true, i)).join('')}
              </div>
            </div>

            <div></div>
            <div class="cs-workspace" aria-label="Color Lab workspace">
              <button class="icon-btn" id="openPaletteMenu" title="Palettes"><span class="material-symbols-rounded">palette</span></button>
              <button class="icon-btn" id="csSetup" title="Document color setup"><span class="material-symbols-rounded">settings</span></button>
              <button class="icon-btn" id="csProof" title="Soft proofing"><span class="material-symbols-rounded">document_search</span></button>
              <button class="icon-btn" id="csHdr" title="HDR"><span class="material-symbols-rounded">hdr_on</span></button>
            </div>
          </div>
        `;

                $('#csColor').oninput = e => setPentaColor(e.target.value, 'primary', true);
                $('#csColor2').oninput = e => setPentaColor(e.target.value, 'secondary', true);
                el.querySelectorAll('.cs-channel').forEach((input, index) => input.onchange = () => {
                    const values = [...el.querySelectorAll('.cs-channel')].map(field => field.value);
                    if (mode === 'HEX' && index === 1) {
                        setPentaColor(values[1], 'secondary', true);
                        return;
                    }
                    const color = colorFromLabChannels(values, mode);
                    if (color) setPentaColor(color, 'primary', true);
                    else toast('Enter valid ' + mode + ' channel values.');
                });
                $('#csMode').onclick = () => {
                    state.colorLabMode = { HEX: 'RGB', RGB: 'CMYK', CMYK: 'LAB', LAB: 'HEX' }[mode];
                    renderDockContent();
                };

                $('#openPaletteMenu').onclick = e => {
                    e.preventDefault();
                    e.stopPropagation();

                    const rect = e.currentTarget.getBoundingClientRect();
                    openPaletteMenu(rect);
                };
                $('#csSetup').onclick = () => toast('Document color setup is available in Settings.');
                $('#csProof').onclick = () => toast('Soft proofing uses your browser display profile.');
                $('#csHdr').onclick = () => toast('HDR preview depends on your display and browser.');

                bindColorButtons(el);
                bindSwatchDrag(el);
            }

            function renderBrushLab(el) {
                el.innerHTML = `
          <div class="brush-lab-compact expanded-only">
            <div class="bl-preview-card">
              <canvas id="brushPreviewCanvas" width="280" height="42"></canvas>
            </div>
            <button class="btn" id="openBrushDynamics">
              <span class="material-symbols-rounded">tune</span>Dynamics
            </button>
            <button class="btn" id="openPressureCurve">
              <span class="material-symbols-rounded">show_chart</span>Pressure Curve
            </button>
            <button class="btn" id="openTextureBrush">
              <span class="material-symbols-rounded">texture</span>Texture
            </button>
            <button class="btn" id="openDualBrush">
              <span class="material-symbols-rounded">gesture</span>Dual Brush
            </button>
            <button class="btn" id="openBrushPresets">
              <span class="material-symbols-rounded">inventory_2</span>Presets
            </button>
          </div>
        `;

                $('#openBrushDynamics').onclick = e => openBrushFloatingMenu('dynamics', e.currentTarget.getBoundingClientRect());
                $('#openPressureCurve').onclick = e => openBrushFloatingMenu('pressure', e.currentTarget.getBoundingClientRect());
                $('#openTextureBrush').onclick = e => openBrushFloatingMenu('texture', e.currentTarget.getBoundingClientRect());
                $('#openDualBrush').onclick = e => openBrushFloatingMenu('dual', e.currentTarget.getBoundingClientRect());
                $('#openBrushPresets').onclick = e => openBrushFloatingMenu('presets', e.currentTarget.getBoundingClientRect());
                drawBrushPreview();
            }

            function renderLineOptionsDock(el) {
                el.innerHTML = `
          <div class="brush-lab-compact expanded-only">
            <button class="btn primary" id="finishLine">
              <span class="material-symbols-rounded">check</span>Finish
            </button>
            <select id="lineCurveType">
              <option value="spline" selected>Cubic Spline</option>
              <option value="straight">Straight</option>
              <option value="bezier">Bezier</option>
            </select>
            <select id="lineDash">
              <option value="solid">Solid</option>
              <option value="dash">Dash</option>
              <option value="dot">Dot</option>
              <option value="dashdot">Dash Dot</option>
            </select>
            <select id="lineStartCap">
              <option value="flat">Start Flat</option>
              <option value="round">Start Round</option>
              <option value="arrow">Start Arrow</option>
              <option value="arrow2">Start Double Arrow</option>
            </select>
            <select id="lineEndCap">
              <option value="flat">End Flat</option>
              <option value="round">End Round</option>
              <option value="arrow">End Arrow</option>
              <option value="arrow2">End Double Arrow</option>
            </select>
          </div>
        `;

                $('#finishLine').onclick = commitLineEdit;
                $('#lineCurveType').value = state.lineCurveType;
                $('#lineDash').value = state.lineDash;
                $('#lineStartCap').value = state.lineStartCap;
                $('#lineEndCap').value = state.lineEndCap;

                $('#lineCurveType').onchange = e => updateLineOption('lineCurveType', 'curveType', e.target.value);
                $('#lineDash').onchange = e => updateLineOption('lineDash', 'dash', e.target.value);
                $('#lineStartCap').onchange = e => updateLineOption('lineStartCap', 'startCap', e.target.value);
                $('#lineEndCap').onchange = e => updateLineOption('lineEndCap', 'endCap', e.target.value);
            }

            function updateLineOption(stateKey, lineKey, value) {
                state[stateKey] = value;
                if (state.lineEdit) state.lineEdit[lineKey] = value;
                renderAll();
            }

            function renderStrokeRevision(el) {
                const selected = getSelectedStrokeEntries();
                const targetCount = getStrokeTargetEntries(state.strokeRevisionTarget).length;
                const recent = getAllStrokeEntries()
                    .slice()
                    .reverse()
                    .slice(0, 40);
                el.innerHTML = `
          <div class="stroke-revision expanded-only">
            <div class="sr-group">
              <div class="sr-targets" id="srTargets">
                ${strokeTargetButton('selected', `Selected (${selected.length})`)}
                ${strokeTargetButton('selection', 'Inside Sel.')}
                ${strokeTargetButton('layer', 'Current Layer')}
                ${strokeTargetButton('color', 'Match Color')}
                ${strokeTargetButton('brush', 'Same Brush')}
                <button class="tool-btn" id="srPickMode">Pick Stroke</button>
              </div>
            </div>

            <div class="sr-group">
              <strong>Recent Strokes</strong>
              <div class="sr-list" id="srList">
                ${recent.length ? recent.map(({ event }) => strokeCard(event)).join('') : '<div class="dock-placeholder"><p>No editable strokes yet</p></div>'}
              </div>
            </div>

            <div class="sr-group">
              <strong>Revise</strong>
              <div class="sr-actions">
                <button class="btn primary" id="openStrokeRevise">
                  <span class="material-symbols-rounded">tune</span>Edit Strokes
                </button>
              </div>
            </div>
          </div>
        `;

                $('#srTargets')?.querySelectorAll('[data-stroke-target]').forEach(btn => {
                    btn.onclick = () => {
                        state.strokeRevisionTarget = btn.dataset.strokeTarget;
                        renderDockContent();
                    };
                });

                $('#srList')?.querySelectorAll('[data-stroke-id]').forEach(btn => {
                    btn.onclick = () => {
                        toggleStrokeSelection(btn.dataset.strokeId, !state.selectedStrokeIds.includes(btn.dataset.strokeId));
                        updateStrokeRevisionSelectionUI();
                    };
                });

                $('#openStrokeRevise').onclick = e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    openStrokeReviseMenu(rect);
                };
                $('#srPickMode').onclick = () => {
                    setTool('strokePick');
                    toast('Pick Stroke mode: click a recorded brush stroke.');
                };

                drawStrokeRevisionThumbs();
            }

            function strokeTargetButton(target, label) {
                return `<button class="tool-btn${state.strokeRevisionTarget === target ? ' active' : ''}" data-stroke-target="${target}">${label}</button>`;
            }

            function strokeCard(event) {
                return `
          <button class="sr-card${state.selectedStrokeIds.includes(event.id) ? ' active' : ''}" data-stroke-id="${event.id}" title="${event.color} · ${Math.round(event.opacity * 100)}%">
            <canvas data-stroke-thumb="${event.id}" width="160" height="72"></canvas>
            <span>${event.tool} · ${event.color}</span>
          </button>
        `;
            }

            function addStrokeCardQuietly(event) {
                if (state.activeDock !== 'strokes') return;

                const list = document.getElementById('srList');
                if (!list) return;

                const empty = list.querySelector('.dock-placeholder');
                if (empty) empty.remove();

                const card = htmlToElement(strokeCard(event));
                list.prepend(card);

                card.onclick = () => {
                    toggleStrokeSelection(event.id, !state.selectedStrokeIds.includes(event.id));
                    updateStrokeRevisionSelectionUI();
                };

                drawOneStrokeRevisionThumb(event.id);
                updateStrokeRevisionSelectionUI();

                while (list.querySelectorAll('.sr-card').length > 40) {
                    list.lastElementChild?.remove();
                }
            }

            function drawOneStrokeRevisionThumb(id) {
                const canvas = document.querySelector(`[data-stroke-thumb="${id}"]`);
                if (!canvas) return;

                const entry = getAllStrokeEntries().find(x => x.event.id === id);
                if (!entry) return;

                drawStrokeThumb(canvas, entry.event);
            }

            function openStrokeReviseMenu(rect) {
                closeStrokeReviseMenu();

                const wrap = document.createElement('div');
                wrap.id = 'floatingStrokeRevise';

                Object.assign(wrap.style, {
                    position: 'fixed',
                    left: rect.left + 'px',
                    bottom: '158px',
                    zIndex: 999999
                });

                wrap.innerHTML = renderStrokeReviseMenu();
                document.body.appendChild(wrap);
                bindStrokeReviseMenu(wrap);
            }

            function closeStrokeReviseMenu() {
                document.getElementById('floatingStrokeRevise')?.remove();
            }

            function renderStrokeReviseMenu() {
                const selected = getSelectedStrokeEntries();
                const event = selected[0]?.event || getStrokeTargetEntries()[0]?.event;
                const oldColor = event?.color || state.primaryColor;
                const newColor = oldColor;
                const opacity = Math.round((event?.opacity ?? state.opacity) * 100);
                const size = Math.round(event?.size || state.size);

                return `
          <div class="brush-float wide">
            <strong>Stroke Revision</strong>

            <div class="stroke-color-revise">
              <div>
                <strong>Old</strong>
                <div class="readonly-color">
                  <span style="background:${oldColor}"></span>
                  <code>${oldColor}</code>
                </div>
              </div>

              <div class="sr-new-color">
                <strong>New</strong>
                <input type="color" id="srColor" value="${newColor}">
                <input type="text" id="srHex" value="${newColor}">
              </div>
            </div>

            <div class="split">
              <div class="bl-mini-field">
                <label>Opacity <output id="srOpacityOut">${opacity}%</output></label>
                <input type="range" id="srOpacity" min="1" max="100" value="${opacity}">
              </div>
              <div class="bl-mini-field">
                <label>Size <output id="srSizeOut">${size}</output></label>
                <input type="range" id="srSize" min="1" max="160" value="${size}">
              </div>
            </div>

            <div class="bl-actions">
              <button class="btn primary" id="srApply">
                <span class="material-symbols-rounded">replay</span>Apply Revision
              </button>
              <button class="btn" id="srUseCurrentBrush">
                <span class="material-symbols-rounded">brush</span>Use Current Brush
              </button>
              <button class="btn" id="srRestore">
                <span class="material-symbols-rounded">restore</span>Restore Original
              </button>
            </div>
          </div>
        `;
            }

            function bindStrokeReviseMenu(root) {
                const syncColor = () => {
                    const color = root.querySelector('#srColor');
                    const hex = root.querySelector('#srHex');
                    if (!color || !hex) return;
                    color.oninput = () => { hex.value = color.value; };
                    hex.onchange = () => {
                        if (/^#[0-9a-f]{6}$/i.test(hex.value)) color.value = hex.value;
                    };
                };
                const bindOut = (id, suffix = '') => {
                    const input = root.querySelector('#' + id);
                    const out = root.querySelector('#' + id + 'Out');
                    if (input && out) input.oninput = () => out.textContent = input.value + suffix;
                };

                syncColor();
                bindOut('srOpacity', '%');
                bindOut('srSize');

                root.querySelector('#srApply').onclick = () => applyStrokeRevisionFromUI(false);
                root.querySelector('#srUseCurrentBrush').onclick = () => applyStrokeRevisionFromUI(true);
                root.querySelector('#srRestore').onclick = async () => {
                    await restoreOriginalStrokes();
                    closeStrokeReviseMenu();
                };
            }

            function getAllStrokeEntries(frame = activeFrame()) {
                const entries = [];
                for (const layer of frame.layers) {
                    for (const event of layer.strokeEvents || []) {
                        entries.push({ frame, layer, event });
                    }
                }
                return entries;
            }

            function getSelectedStrokeEntries() {
                const ids = new Set(state.selectedStrokeIds);
                return getAllStrokeEntries().filter(entry => ids.has(entry.event.id));
            }

            function getStrokeTargetEntries(target = state.strokeRevisionTarget) {
                const entries = getAllStrokeEntries();
                if (target === 'selected') return getSelectedStrokeEntries();
                if (target === 'layer') return (activeLayer().strokeEvents || []).map(event => ({ frame: activeFrame(), layer: activeLayer(), event }));
                if (target === 'selection') {
                    const bounds = getSelectionBounds();
                    if (!bounds) return [];
                    return entries.filter(({ event }) => rectsIntersect(event.bounds, bounds));
                }
                if (target === 'color') {
                    const color = getSelectedStrokeEntries()[0]?.event.color || state.primaryColor;
                    return entries.filter(({ event }) => event.color === color);
                }
                if (target === 'brush') {
                    const signature = brushSignature(getSelectedStrokeEntries()[0]?.event.brushLab || state.brushLab);
                    return entries.filter(({ event }) => brushSignature(event.brushLab) === signature);
                }
                return [];
            }

            function toggleStrokeSelection(id, on) {
                state.selectedStrokeIds = on
                    ? [...new Set([...state.selectedStrokeIds, id])]
                    : state.selectedStrokeIds.filter(x => x !== id);
            }

            function updateStrokeRevisionSelectionUI() {
                const selected = getSelectedStrokeEntries();
                const targetCount = getStrokeTargetEntries(state.strokeRevisionTarget).length;

                document.querySelectorAll('.sr-card[data-stroke-id]').forEach(card => {
                    card.classList.toggle('active', state.selectedStrokeIds.includes(card.dataset.strokeId));
                });

                const selectedTarget = htmlToElement(strokeTargetButton('selected', `Selected (${selected.length})`));
                selectedTarget.onclick = () => {
                    state.strokeRevisionTarget = 'selected';
                    renderDockContent();
                };
                document.querySelector('[data-stroke-target="selected"]')?.replaceWith(selectedTarget);

                const status = document.querySelector('.stroke-revision .status');
                if (status) {
                    status.textContent = `${targetCount} stroke${targetCount === 1 ? '' : 's'} targeted`;
                }
            }

            function refreshStrokeRevisionQuietly() {
                drawStrokeRevisionThumbs();
                updateStrokeRevisionSelectionUI();
            }

            function htmlToElement(html) {
                const t = document.createElement('template');
                t.innerHTML = html.trim();
                return t.content.firstElementChild;
            }

            function rectsIntersect(a, b) {
                if (!a || !b) return false;
                return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
            }

            function brushSignature(brushLab) {
                const b = brushLab || {};
                return JSON.stringify({
                    spacing: b.spacing,
                    scatter: b.scatter,
                    sizeJitter: b.sizeJitter,
                    opacityJitter: b.opacityJitter,
                    angleJitter: b.angleJitter,
                    pressureCurve: b.pressureCurve,
                    textureName: b.textureName,
                    useTexture: b.useTexture,
                    dualBrush: b.dualBrush,
                    dualOpacity: b.dualOpacity,
                    dualOffset: b.dualOffset,
                    dualBlend: b.dualBlend
                });
            }

            function drawStrokeRevisionThumbs() {
                document.querySelectorAll('[data-stroke-thumb]').forEach(canvas => {
                    const id = canvas.dataset.strokeThumb;
                    const entry = getAllStrokeEntries().find(x => x.event.id === id);
                    if (entry) drawStrokeThumb(canvas, entry.event);
                });
            }

            function drawStrokeThumb(canvas, event) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                const b = event.bounds || calculateStrokeBounds(event.points, event.size, event.brushLab);
                const scale = Math.min((canvas.width - 18) / Math.max(1, b.w), (canvas.height - 18) / Math.max(1, b.h));
                ctx.save();
                ctx.translate((canvas.width - b.w * scale) / 2 - b.x * scale, (canvas.height - b.h * scale) / 2 - b.y * scale);
                ctx.scale(scale, scale);
                renderStrokeEventToContext(ctx, event, true);
                ctx.restore();
            }

            function calculateStrokeBounds(points, size, brushLab = {}) {
                if (!points?.length) return { x: 0, y: 0, w: 0, h: 0 };
                const xs = points.map(p => p.x);
                const ys = points.map(p => p.y);
                const pad = Math.max(8, size * (1.5 + (brushLab.scatter || 0) / 100));
                const x = clamp(Math.min(...xs) - pad, 0, state.width);
                const y = clamp(Math.min(...ys) - pad, 0, state.height);
                const maxX = clamp(Math.max(...xs) + pad, 0, state.width);
                const maxY = clamp(Math.max(...ys) + pad, 0, state.height);
                return { x, y, w: maxX - x, h: maxY - y };
            }

            function makeStrokeEvent(layer) {
                const points = (state.strokePoints || []).map(p => ({
                    x: roundStrokeNumber(p.x),
                    y: roundStrokeNumber(p.y),
                    pressure: roundStrokeNumber(p.pressure),
                    distance: roundStrokeNumber(p.distance),
                    t: Math.round(p.t || 0)
                }));
                const brushLab = cloneBrushLabForStroke();
                return {
                    id: uid(),
                    layerId: layer.id,
                    frameId: activeFrame().id,
                    tool: state.tool,
                    points,
                    color: state.strokeColor,
                    secondaryColor: state.secondaryColor,
                    opacity: state.opacity,
                    size: state.size,
                    softness: state.softness,
                    blend: state.blend,
                    antiAlias: state.antiAlias,
                    taper: state.strokeTaper,
                    brushLab,
                    timestamp: Date.now(),
                    bounds: calculateStrokeBounds(points, state.size, brushLab),
                    original: null
                };
            }

            function editableStrokeSnapshot(event) {
                return {
                    tool: event.tool,
                    color: event.color,
                    secondaryColor: event.secondaryColor,
                    opacity: event.opacity,
                    size: event.size,
                    softness: event.softness,
                    blend: event.blend,
                    antiAlias: event.antiAlias,
                    taper: event.taper,
                    brushLab: structuredClone(event.brushLab || {}),
                    bounds: event.bounds ? { ...event.bounds } : null
                };
            }

            function applyEditableStrokeSnapshot(event, snapshot) {
                if (!snapshot) return;
                event.tool = snapshot.tool;
                event.color = snapshot.color;
                event.secondaryColor = snapshot.secondaryColor;
                event.opacity = snapshot.opacity;
                event.size = snapshot.size;
                event.softness = snapshot.softness;
                event.blend = snapshot.blend;
                event.antiAlias = snapshot.antiAlias;
                event.taper = snapshot.taper;
                event.brushLab = structuredClone(snapshot.brushLab || {});
                event.bounds = snapshot.bounds ? { ...snapshot.bounds } : calculateStrokeBounds(event.points, event.size, event.brushLab);
            }

            function cloneBrushLabForStroke() {
                const clone = structuredClone(state.brushLab);
                clone.presets = [];
                return clone;
            }

            function roundStrokeNumber(value) {
                return Math.round(Number(value || 0) * 1000) / 1000;
            }

            function ensureRevisionBase(layer) {
                if (!layer.revisionBase && !(layer.strokeEvents || []).length) {
                    layer.revisionBase = layer.canvas.toDataURL('image/png');
                }
            }

            function bakeLayerRevisionHistory(layer = activeLayer()) {
                if (!layer?.strokeEvents?.length && !layer?.revisionBase) return;
                layer.strokeEvents = [];
                layer.revisionBase = null;
                state.selectedStrokeIds = [];
            }

            function recordCurrentStroke() {
                const layer = activeLayer();
                if (!state.strokePoints?.length) return;
                if (!layer.strokeEvents) layer.strokeEvents = [];
                const event = makeStrokeEvent(layer);
                layer.strokeEvents.push(event);
                state.selectedStrokeIds = [event.id];
                addStrokeCardQuietly(event);
            }

            function renderStrokeEventToContext(ctx, event, finalPass = true) {
                withStrokeRenderState(event, () => {
                    renderStrokePointsToContext(ctx, event.points || [], finalPass, event.taper ?? false);
                });
            }

            function withStrokeRenderState(event, fn) {
                const saved = {
                    tool: state.tool,
                    strokeColor: state.strokeColor,
                    secondaryColor: state.secondaryColor,
                    size: state.size,
                    opacity: state.opacity,
                    softness: state.softness,
                    blend: state.blend,
                    antiAlias: state.antiAlias,
                    brushLab: state.brushLab
                };
                state.tool = event.tool || 'brush';
                state.strokeColor = event.color || event.primaryColor || state.primaryColor;
                state.secondaryColor = event.secondaryColor || state.secondaryColor;
                state.size = event.size || state.size;
                state.opacity = event.opacity ?? state.opacity;
                state.softness = event.softness ?? state.softness;
                state.blend = event.blend || 'source-over';
                state.antiAlias = event.antiAlias ?? state.antiAlias;
                state.brushLab = structuredClone(event.brushLab || state.brushLab);
                try {
                    fn();
                } finally {
                    Object.assign(state, saved);
                }
            }

            function renderStrokePointsToContext(ctx, pts, finalPass = true, taperEnabled = false) {
                if (!pts.length) return;
                ctx.save();
                ctx.globalCompositeOperation = state.tool === 'eraser' ? 'destination-out' : state.blend;
                applyAliasing(ctx);

                if (state.tool === 'brush' && shouldUseHardPixelBrush()) {
                    ctx.globalAlpha = state.opacity;
                    for (let i = 1; i < pts.length; i++) {
                        const prev = pts[i - 1];
                        const p = pts[i];
                        drawJaggedLine(
                            ctx,
                            prev.x,
                            prev.y,
                            p.x,
                            p.y,
                            state.strokeColor,
                            Math.max(1, Math.round(state.size))
                        );
                    }
                    if (pts.length === 1) {
                        const p = pts[0];
                        drawJaggedLine(ctx, p.x, p.y, p.x, p.y, state.strokeColor, Math.max(1, Math.round(state.size)));
                    }
                    ctx.restore();
                    return;
                }

                const sampled = sampleStroke(pts, Math.max(.8, state.size * (state.brushLab.spacing / 100)));
                const total = sampled.length ? sampled[sampled.length - 1].distance : 0;
                const taperLen = taperEnabled
                    ? clamp(state.size * 2.8, 14, Math.max(14, total * .48))
                    : 0;

                for (const p of sampled) {
                    const pressure = applyPressureCurve(p.pressure);

                    const taper = taperEnabled
                        ? easeOutCubic(Math.min(
                            clamp(p.distance / taperLen, 0, 1),
                            finalPass ? clamp((total - p.distance) / taperLen, 0, 1) : 1
                        ))
                        : 1;

                    const radius = taperEnabled
                        ? clamp((state.size * (.12 + pressure * .88) * taper) / 2, .08, state.size * 1.25)
                        : clamp((state.size * (.12 + pressure * .88)) / 2, .08, state.size * 1.25);

                    if (radius <= .12) continue;

                    ctx.globalAlpha = state.opacity *
                        clamp(.22 + pressure * .78, .04, 1) *
                        (taperEnabled ? clamp(taper * 1.25, 0, 1) : 1);

                    stampBrush(ctx, p, radius, pressure, taper);
                }
                ctx.restore();
            }

            async function replayLayerStrokes(layer) {
                const ctx = layer.canvas.getContext('2d');
                ctx.clearRect(0, 0, state.width, state.height);
                if (layer.revisionBase) {
                    await drawDataUrl(layer.canvas, layer.revisionBase);
                }
                for (const event of layer.strokeEvents || []) {
                    renderStrokeEventToContext(ctx, event, true);
                }
            }

            async function replayChangedStrokeLayers(entries) {
                const layers = [...new Set(entries.map(entry => entry.layer))];
                for (const layer of layers) {
                    await replayLayerStrokes(layer);
                }
            }

            async function applyStrokeRevisionFromUI(useCurrentBrush) {
                const entries = getStrokeTargetEntries();
                if (!entries.length) return toast('No recorded strokes match that target.');
                const color = ($('#srHex')?.value || $('#srColor')?.value || state.primaryColor).toLowerCase();
                const secondaryColor = color;
                if (!/^#[0-9a-f]{6}$/i.test(color)) return toast('Invalid stroke revision color.');
                const opacity = clamp(Number($('#srOpacity')?.value || 100) / 100, .01, 1);
                const size = clamp(Number($('#srSize')?.value || state.size), 1, 160);
                for (const { event } of entries) {
                    if (!event.original) event.original = editableStrokeSnapshot(event);
                    event.color = color;
                    event.secondaryColor = secondaryColor;
                    event.opacity = opacity;
                    event.size = size;
                    if (useCurrentBrush) {
                        event.softness = state.softness;
                        event.blend = state.blend;
                        event.antiAlias = state.antiAlias;
                        event.taper = state.strokeTaper;
                        event.brushLab = cloneBrushLabForStroke();
                    }
                    event.bounds = calculateStrokeBounds(event.points, event.size, event.brushLab);
                }
                await replayChangedStrokeLayers(entries);
                pushHistory('Revise strokes');

                mountLayers();
                composite(activeFrame(), true);
                renderLayers();
                renderFrames();
                updateControls();

                if (state.activeDock === 'strokes') {
                    refreshStrokeRevisionQuietly();
                }

                toast(`Revised ${entries.length} stroke${entries.length === 1 ? '' : 's'}.`);
            }

            async function restoreOriginalStrokes() {
                const entries = getStrokeTargetEntries();
                const restorable = entries.filter(({ event }) => event.original);
                if (!restorable.length) return toast('No original stroke revisions to restore.');
                for (const { event } of restorable) {
                    const original = event.original;
                    applyEditableStrokeSnapshot(event, original);
                    event.original = null;
                }
                await replayChangedStrokeLayers(restorable);
                pushHistory('Restore original strokes');
                mountLayers();
                composite(activeFrame(), true);
                renderLayers();
                renderFrames();
                updateControls();
                if (state.activeDock === 'strokes') {
                    refreshStrokeRevisionQuietly();
                }
                toast(`Restored ${restorable.length} stroke${restorable.length === 1 ? '' : 's'}.`);
            }

            function findNearestStrokeAt(p) {
                const entries = getAllStrokeEntries();
                let best = null;
                for (let i = entries.length - 1; i >= 0; i--) {
                    const { event, layer } = entries[i];
                    if (!layer.visible || !rectsIntersect(event.bounds, { x: p.x - 1, y: p.y - 1, w: 2, h: 2 })) continue;
                    const dist = distanceToStroke(event, p);
                    const threshold = Math.max(8, (event.size || 1) * .65 + 6);
                    if (dist <= threshold && (!best || dist < best.dist)) best = { ...entries[i], dist };
                }
                return best;
            }

            function distanceToStroke(event, p) {
                const pts = event.points || [];
                let best = Infinity;
                for (let i = 1; i < pts.length; i++) {
                    best = Math.min(best, pointSegmentDistance(p, pts[i - 1], pts[i]));
                }
                return pts.length === 1 ? Math.hypot(p.x - pts[0].x, p.y - pts[0].y) : best;
            }

            function pointSegmentDistance(p, a, b) {
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const len2 = dx * dx + dy * dy;
                if (!len2) return Math.hypot(p.x - a.x, p.y - a.y);
                const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
                return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
            }

            function pickStrokeAtPoint(p) {
                const entry = findNearestStrokeAt(p);
                if (!entry) return toast('No recorded stroke found there.');
                state.selectedStrokeIds = [entry.event.id];
                state.strokeRevisionTarget = 'selected';
                if (!state.dockOpen || state.activeDock !== 'strokes') openDock('strokes');
                else updateStrokeRevisionSelectionUI();
                toast('Stroke selected for revision.');
            }

            function brushSlider(label, id, value, min, max, suffix = '') {
                return `
          <div class="bl-mini-field">
            <label>${label} <output id="${id}Out">${value}${suffix}</output></label>
            <input type="range" id="${id}" min="${min}" max="${max}" value="${value}" data-suffix="${suffix}">
          </div>
        `;
            }

            function renderTextEngine(el) {
                const obj = getSelectedTextObject();
                const t = obj || state.textDefaults;
                el.innerHTML = `
          <div class="text-engine expanded-only">
            <div class="te-block te-selected">
              <strong>Text Engine</strong>
              <div class="te-preview">
                ${obj ? escapeHtml((obj.text || 'Text').split('\n')[0].slice(0, 26)) : 'No text selected'}
              </div>
            </div>
            <div class="te-block">
              <strong>Font</strong>
              <select id="teFont">
                ${textFontOptions(t.font || state.textFont)}
              </select>
            </div>
            <div class="te-block te-size">
              <strong>Size</strong>
              <input type="number" id="teSize" min="6" max="400" value="${Math.round(t.size || state.textSize)}">
            </div>
            <div class="te-block">
              <strong>Style</strong>
              <div class="te-buttons">
                <button class="icon-btn ${t.bold ? 'active' : ''}" id="teBold"><b>B</b></button>
                <button class="icon-btn ${t.italic ? 'active' : ''}" id="teItalic"><i>I</i></button>
                <button class="icon-btn ${t.underline ? 'active' : ''}" id="teUnderline"><u>U</u></button>
              </div>
            </div>
            <div class="te-block">
              <strong>Align</strong>
              <div class="te-buttons">
                <button class="icon-btn ${t.align === 'left' ? 'active' : ''}" data-te-align="left">
                  <span class="material-symbols-rounded">format_align_left</span>
                </button>
                <button class="icon-btn ${t.align === 'center' ? 'active' : ''}" data-te-align="center">
                  <span class="material-symbols-rounded">format_align_center</span>
                </button>
                <button class="icon-btn ${t.align === 'right' ? 'active' : ''}" data-te-align="right">
                  <span class="material-symbols-rounded">format_align_right</span>
                </button>
              </div>
            </div>
            <div class="te-block te-color">
              <strong>Fill</strong>
              <input type="color" id="teFill" value="${t.fill || state.primaryColor}">
            </div>
            <div class="te-block">
              <strong>More</strong>
              <div class="te-buttons">
                <button class="btn" id="openTextSpacing"><span class="material-symbols-rounded">format_letter_spacing</span>Spacing</button>
                <button class="btn" id="openTextEffects"><span class="material-symbols-rounded">auto_awesome</span>Effects</button>
                <button class="btn" id="openTextAdvanced"><span class="material-symbols-rounded">tune</span>Advanced</button>
              </div>
            </div>
          </div>
        `;
                bindTextEngineControls();
            }

            function getSelectedTextObject() {
                const obj = getSelectedObject?.();
                if (!obj) return null;
                return (obj.type === 'text' || obj.kind === 'text') ? obj : null;
            }

            function textFontOptions(active) {
                const fonts = [
                    'Inter',
                    'Arial',
                    'Verdana',
                    'Georgia',
                    'Times New Roman',
                    'Courier New',
                    'Trebuchet MS',
                    'Impact'
                ];
                return fonts.map(font => `
          <option value="${font}" ${font === active ? 'selected' : ''}>${font}</option>
        `).join('');
            }

            function applyTextPatch(patch) {
                const obj = getSelectedTextObject();
                if (obj) {
                    Object.assign(obj, patch);
                    measureAndUpdateTextObject(obj);
                    pushHistory('Edit text style');
                    renderAll();
                } else {
                    Object.assign(state.textDefaults, patch);
                    state.textSize = state.textDefaults.size;
                    state.textFont = state.textDefaults.font;
                    updateControls();
                }
                if (state.activeDock === 'text') renderDockContent();
            }

            function measureAndUpdateTextObject(obj) {
                const m = measureTextObject(
                    obj.text || '',
                    obj.size || state.textSize,
                    obj.font || state.textFont,
                    obj
                );
                obj.w = m.w;
                obj.h = m.h;
            }

            function bindTextEngineControls() {
                $('#teFont').onchange = e => applyTextPatch({ font: e.target.value });
                $('#teSize').onchange = e => applyTextPatch({ size: clamp(Number(e.target.value) || 42, 6, 400) });
                $('#teFill').oninput = e => applyTextPatch({ fill: e.target.value });
                $('#teBold').onclick = () => {
                    const t = getSelectedTextObject() || state.textDefaults;
                    applyTextPatch({ bold: !t.bold });
                };
                $('#teItalic').onclick = () => {
                    const t = getSelectedTextObject() || state.textDefaults;
                    applyTextPatch({ italic: !t.italic });
                };
                $('#teUnderline').onclick = () => {
                    const t = getSelectedTextObject() || state.textDefaults;
                    applyTextPatch({ underline: !t.underline });
                };
                document.querySelectorAll('[data-te-align]').forEach(btn => {
                    btn.onclick = () => applyTextPatch({ align: btn.dataset.teAlign });
                });
                $('#openTextSpacing').onclick = e => openTextFloatingMenu('spacing', e.currentTarget.getBoundingClientRect());
                $('#openTextEffects').onclick = e => openTextFloatingMenu('effects', e.currentTarget.getBoundingClientRect());
                $('#openTextAdvanced').onclick = e => openTextFloatingMenu('advanced', e.currentTarget.getBoundingClientRect());
            }

            function openTextFloatingMenu(kind, rect) {
                closeTextFloatingMenu();
                const wrap = document.createElement('div');
                wrap.id = 'floatingTextMenu';
                Object.assign(wrap.style, {
                    position: 'fixed',
                    left: rect.left + 'px',
                    bottom: '158px',
                    zIndex: 999999
                });
                wrap.innerHTML = renderTextFloatingMenu(kind);
                document.body.appendChild(wrap);
                bindTextFloatingMenu(kind, wrap);
            }

            function closeTextFloatingMenu() {
                document.getElementById('floatingTextMenu')?.remove();
            }

            function currentTextSettings() {
                return getSelectedTextObject() || state.textDefaults;
            }

            function renderTextFloatingMenu(kind) {
                const t = currentTextSettings();
                if (kind === 'spacing') return `
          <div class="text-float">
            <strong>Spacing</strong>
            ${textSlider('Tracking', 'teTracking', t.tracking ?? 0, -50, 200, 'px')}
            ${textSlider('Kerning', 'teKerning', t.kerning ?? 0, -50, 200, 'px')}
            ${textSlider('Line Height', 'teLineHeight', Math.round((t.lineHeight ?? 1.18) * 100), 60, 300, '%')}
          </div>
        `;
                if (kind === 'effects') return `
          <div class="text-float wide">
            <strong>Effects</strong>
            <label><input type="checkbox" id="teOutlineOn" ${t.stroke ? 'checked' : ''}> Outline</label>
            <input type="color" id="teStroke" value="${t.stroke || '#000000'}">
            ${textSlider('Outline Width', 'teStrokeWidth', t.strokeWidth ?? 2, 0, 40, 'px')}
            <label><input type="checkbox" id="teShadowOn" ${t.shadow ? 'checked' : ''}> Shadow</label>
            <input type="color" id="teShadowColor" value="${t.shadowColor || '#000000'}">
            ${textSlider('Shadow Blur', 'teShadowBlur', t.shadowBlur ?? 8, 0, 80, 'px')}
            ${textSlider('Shadow X', 'teShadowX', t.shadowOffsetX ?? 4, -80, 80, 'px')}
            ${textSlider('Shadow Y', 'teShadowY', t.shadowOffsetY ?? 4, -80, 80, 'px')}
            <label><input type="checkbox" id="teGlowOn" ${t.glow ? 'checked' : ''}> Glow</label>
            <input type="color" id="teGlowColor" value="${t.glowColor || state.secondaryColor}">
            ${textSlider('Glow Blur', 'teGlowBlur', t.glowBlur ?? 14, 0, 100, 'px')}
          </div>
        `;
                return `
          <div class="text-float">
            <strong>Advanced</strong>
            ${textSlider('Opacity', 'teOpacity', Math.round((t.opacity ?? 1) * 100), 0, 100, '%')}
            <label>Text Box Mode</label>
            <select id="teTextBoxMode">
              <option value="point" ${(t.textBoxMode || 'point') === 'point' ? 'selected' : ''}>Point text</option>
              <option value="box" ${t.textBoxMode === 'box' ? 'selected' : ''}>Box text</option>
            </select>
            <label>Wrap Width</label>
            <input type="number" id="teWrapWidth" min="40" max="2000" value="${Math.round(t.wrapWidth || 320)}">
            <button class="btn" id="teUseCurrentColors">
              <span class="material-symbols-rounded">palette</span>Use Current Colors
            </button>
            <button class="btn danger" id="teResetStyle">
              <span class="material-symbols-rounded">restart_alt</span>Reset Text Style
            </button>
          </div>
        `;
            }

            function textSlider(label, id, value, min, max, suffix = '') {
                return `
          <div class="bl-mini-field">
            <label>${label} <output id="${id}Out">${value}${suffix}</output></label>
            <input type="range" id="${id}" min="${min}" max="${max}" value="${value}" data-suffix="${suffix}">
          </div>
        `;
            }

            function bindTextFloatingMenu(kind, root) {
                const bindSlider = (id, fn) => {
                    const input = root.querySelector('#' + id);
                    const out = root.querySelector('#' + id + 'Out');
                    if (!input) return;
                    input.oninput = () => {
                        const v = Number(input.value);
                        if (out) out.textContent = input.value + (input.dataset.suffix || '');
                        fn(v);
                    };
                };
                bindSlider('teTracking', v => applyTextPatch({ tracking: v }));
                bindSlider('teKerning', v => applyTextPatch({ kerning: v }));
                bindSlider('teLineHeight', v => applyTextPatch({ lineHeight: v / 100 }));
                bindSlider('teStrokeWidth', v => applyTextPatch({ strokeWidth: v }));
                bindSlider('teShadowBlur', v => applyTextPatch({ shadowBlur: v }));
                bindSlider('teShadowX', v => applyTextPatch({ shadowOffsetX: v }));
                bindSlider('teShadowY', v => applyTextPatch({ shadowOffsetY: v }));
                bindSlider('teGlowBlur', v => applyTextPatch({ glowBlur: v }));
                bindSlider('teOpacity', v => applyTextPatch({ opacity: v / 100 }));
                root.querySelector('#teOutlineOn')?.addEventListener('change', e => {
                    applyTextPatch({ stroke: e.target.checked ? '#000000' : '' });
                });
                root.querySelector('#teStroke')?.addEventListener('input', e => {
                    applyTextPatch({ stroke: e.target.value });
                });
                root.querySelector('#teShadowOn')?.addEventListener('change', e => {
                    applyTextPatch({ shadow: e.target.checked });
                });
                root.querySelector('#teShadowColor')?.addEventListener('input', e => {
                    applyTextPatch({ shadowColor: e.target.value });
                });
                root.querySelector('#teGlowOn')?.addEventListener('change', e => {
                    applyTextPatch({ glow: e.target.checked });
                });
                root.querySelector('#teGlowColor')?.addEventListener('input', e => {
                    applyTextPatch({ glowColor: e.target.value });
                });
                root.querySelector('#teTextBoxMode')?.addEventListener('change', e => {
                    applyTextPatch({ textBoxMode: e.target.value });
                });
                root.querySelector('#teWrapWidth')?.addEventListener('change', e => {
                    applyTextPatch({ wrapWidth: clamp(Number(e.target.value) || 320, 40, 2000) });
                });
                root.querySelector('#teUseCurrentColors')?.addEventListener('click', () => {
                    applyTextPatch({
                        fill: state.primaryColor,
                        stroke: state.secondaryColor
                    });
                });
                root.querySelector('#teResetStyle')?.addEventListener('click', () => {
                    applyTextPatch({
                        font: 'Inter',
                        size: 42,
                        bold: false,
                        italic: false,
                        underline: false,
                        align: 'left',
                        tracking: 0,
                        kerning: 0,
                        lineHeight: 1.18,
                        textBoxMode: 'point',
                        wrapWidth: 320,
                        stroke: '',
                        strokeWidth: 2,
                        shadow: false,
                        glow: false,
                        opacity: 1
                    });
                });
            }

            function renderFXViewer(el) {
                if (state.fxViewer.activeEffect === 'pixel') {
                    renderPixelConverterFX(el);
                    return;
                }

                el.innerHTML = `
          <div class="fx-launcher expanded-only">
            <button class="icon-btn active-dock" id="fxPixelConverter" title="Pixel Converter">
              <span class="material-symbols-rounded">grid_view</span>
            </button>

            <div class="dock-placeholder">
              <h3>Pixel Converter</h3>
              <p>Turn the active layer into live pixel art.</p>
            </div>
          </div>
        `;

                $('#fxPixelConverter').onclick = () => {
                    state.fxViewer.activeEffect = 'pixel';
                    renderDockContent();
                    renderDockLaunchers();
                };
            }

            function renderPixelConverterFX(el) {
                const p = state.fxViewer.pixel;

                el.innerHTML = `
          <div class="pixel-fx-panel expanded-only">
            <div class="pixel-fx-group fx-back-row">
              <button class="btn" id="fxBackToList"><span class="material-symbols-rounded">arrow_back</span>All effects</button>
            </div>
            <div class="pixel-fx-group">
              <strong>Palette</strong>
              <select id="pxPalette">
                ${Object.entries(pixelPalettes).map(([key, pal]) => `
                  <option value="${key}" ${p.palette === key ? 'selected' : ''}>${pal.name}</option>
                `).join('')}
              </select>
            </div>

            <div class="pixel-fx-group">
              <strong>Pixel</strong>
              <input type="range" id="pxSize" min="1" max="64" value="${p.pixelSize}">
            </div>

            <div class="pixel-fx-group">
              <strong>Dither</strong>
              <input type="range" id="pxDither" min="0" max="100" value="${p.dither}">
            </div>

            <div class="pixel-fx-group">
              <strong>Adjust</strong>
              <button class="btn" id="openPixelAdjust">
                <span class="material-symbols-rounded">tune</span>Adjust
              </button>
            </div>

            <div class="pixel-fx-group">
              <strong>FX</strong>
              <div class="pixel-fx-checks">
                <label><input type="checkbox" id="pxCrt" ${p.crt ? 'checked' : ''}> CRT</label>
                <label><input type="checkbox" id="pxGlitch" ${p.glitch ? 'checked' : ''}> Glitch</label>
                <label><input type="checkbox" id="pxCycle" ${p.cycle ? 'checked' : ''}> Cycle</label>
                <label><input type="checkbox" id="pxGhost" ${p.ghost ? 'checked' : ''}> Ghost</label>
              </div>
            </div>
          </div>
        `;

                bindPixelConverterFX();
                $('#fxBackToList').onclick = () => {
                    state.fxViewer.activeEffect = null;
                    renderDockContent();
                };
            }

            function bindPixelConverterFX() {
                const p = state.fxViewer.pixel;

                $('#pxPalette').onchange = e => {
                    p.palette = e.target.value;
                    updatePixelFxLive();
                };

                $('#pxSize').oninput = e => {
                    p.pixelSize = clamp(Number(e.target.value) || 1, 1, 64);
                    updatePixelFxLive();
                };

                $('#pxDither').oninput = e => {
                    p.dither = Number(e.target.value) || 0;
                    updatePixelFxLive();
                };

                $('#pxCrt').onchange = e => {
                    p.crt = e.target.checked;
                    updatePixelFxLive();
                };

                $('#pxGlitch').onchange = e => {
                    p.glitch = e.target.checked;
                    updatePixelFxLive();
                };

                $('#pxCycle').onchange = e => {
                    p.cycle = e.target.checked;
                    updatePixelFxLive();
                };

                $('#pxGhost').onchange = e => {
                    p.ghost = e.target.checked;
                    updatePixelFxLive();
                };

                $('#openPixelAdjust').onclick = e => openPixelAdjustFloating(e.currentTarget);

                updatePixelFxLive();
            }

            function openPixelAdjustFloating(anchor) {
                closeBrushFloatingMenu?.();
                closeTextFloatingMenu?.();
                document.getElementById('floatingPixelAdjust')?.remove();

                const p = state.fxViewer.pixel;
                const rect = anchor.getBoundingClientRect();

                const wrap = document.createElement('div');
                wrap.id = 'floatingPixelAdjust';
                wrap.className = 'brush-float wide';

                Object.assign(wrap.style, {
                    position: 'fixed',
                    left: rect.left + 'px',
                    bottom: '158px',
                    zIndex: 999999
                });

                wrap.innerHTML = `
          <strong>Pixel Adjust</strong>

          ${pixelFxSlider('Brightness', 'pxBrightFloat', p.brightness, -100, 100)}
          ${pixelFxSlider('Contrast', 'pxContrastFloat', p.contrast, -100, 100)}
          ${pixelFxSlider('Saturation', 'pxSatFloat', p.saturation, -100, 100)}
          ${pixelFxSlider('Erode', 'pxErodeFloat', p.erode, 0, 4)}
          ${pixelFxSlider('Frame Count', 'pxFramesFloat', p.frameCount, 2, 60)}
          ${pixelFxSlider('Frame Delay', 'pxDelayFloat', p.frameDelay, 20, 1000)}
        `;

                document.body.appendChild(wrap);
                bindPixelAdjustFloating(wrap);
            }

            function pixelFxSlider(label, id, value, min, max) {
                return `
          <div class="bl-mini-field">
            <label>${label} <output id="${id}Out">${value}</output></label>
            <input type="range" id="${id}" min="${min}" max="${max}" value="${value}">
          </div>
        `;
            }

            function bindPixelAdjustFloating(root) {
                const bind = (id, key, min, max) => {
                    const input = root.querySelector('#' + id);
                    const out = root.querySelector('#' + id + 'Out');

                    input.oninput = () => {
                        const v = clamp(Number(input.value) || 0, min, max);
                        state.fxViewer.pixel[key] = v;
                        out.textContent = v;
                        updatePixelFxLive();
                    };
                };

                bind('pxBrightFloat', 'brightness', -100, 100);
                bind('pxContrastFloat', 'contrast', -100, 100);
                bind('pxSatFloat', 'saturation', -100, 100);
                bind('pxErodeFloat', 'erode', 0, 4);
                bind('pxFramesFloat', 'frameCount', 2, 60);
                bind('pxDelayFloat', 'frameDelay', 20, 1000);
            }

            function renderLayoutAssistant(el) {
                renderPlaceholderDock(el, 'Layout Assistant');
            }

            function renderPlaceholderDock(el, title) {
                el.innerHTML = `
          <div class="dock-placeholder expanded-only">
            <h3>${title}</h3>
          </div>
          <div></div>
          <div></div>
        `;
            }

            function pxClamp(v) {
                return Math.max(0, Math.min(255, v));
            }

            function pxNearest(r, g, b, pal) {
                let best = pal[0];
                let dist = Infinity;

                for (const col of pal) {
                    const dr = r - col[0];
                    const dg = g - col[1];
                    const db = b - col[2];
                    const d = dr * dr + dg * dg + db * db;

                    if (d < dist) {
                        dist = d;
                        best = col;
                    }
                }

                return best;
            }

            function pxAdjustPixel(r, g, b, bright, contrast, sat) {
                r += bright;
                g += bright;
                b += bright;

                const safeContrast = clamp(contrast, -254, 254);
                const f = (259 * (safeContrast + 255)) / (255 * (259 - safeContrast));

                r = f * (r - 128) + 128;
                g = f * (g - 128) + 128;
                b = f * (b - 128) + 128;

                const gray = .2126 * r + .7152 * g + .0722 * b;
                const s = 1 + sat / 100;

                return [
                    pxClamp(gray + (r - gray) * s),
                    pxClamp(gray + (g - gray) * s),
                    pxClamp(gray + (b - gray) * s)
                ];
            }

            function pxQuantizeDither(data, w, h, pal, amount) {
                const buf = new Float32Array(w * h * 3);

                for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
                    buf[j] = data[i];
                    buf[j + 1] = data[i + 1];
                    buf[j + 2] = data[i + 2];
                }

                const strength = amount / 100;

                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const i = (y * w + x) * 4;
                        const j = (y * w + x) * 3;

                        if (data[i + 3] < 20) continue;

                        const old = [pxClamp(buf[j]), pxClamp(buf[j + 1]), pxClamp(buf[j + 2])];
                        const q = pxNearest(old[0], old[1], old[2], pal);

                        data[i] = q[0];
                        data[i + 1] = q[1];
                        data[i + 2] = q[2];

                        const er = (old[0] - q[0]) * strength;
                        const eg = (old[1] - q[1]) * strength;
                        const eb = (old[2] - q[2]) * strength;

                        for (const [dx, dy, f] of [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]]) {
                            const nx = x + dx;
                            const ny = y + dy;

                            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;

                            const nj = (ny * w + nx) * 3;
                            buf[nj] += er * f;
                            buf[nj + 1] += eg * f;
                            buf[nj + 2] += eb * f;
                        }
                    }
                }
            }

            function renderPixelArtCanvas(sourceCanvas, opts, frameIndex = 0) {
                const pal = pixelPalettes[opts.palette]?.colors || null;
                const pixelSize = Math.max(1, opts.pixelSize | 0);
                const smallW = Math.max(1, Math.ceil(sourceCanvas.width / pixelSize));
                const smallH = Math.max(1, Math.ceil(sourceCanvas.height / pixelSize));

                const small = document.createElement('canvas');
                small.width = smallW;
                small.height = smallH;

                const sctx = small.getContext('2d', { willReadFrequently: true });
                sctx.imageSmoothingEnabled = true;
                sctx.drawImage(sourceCanvas, 0, 0, smallW, smallH);

                const img = sctx.getImageData(0, 0, smallW, smallH);
                const data = img.data;

                for (let i = 0; i < data.length; i += 4) {
                    if (data[i + 3] < 20) continue;

                    const [r, g, b] = pxAdjustPixel(
                        data[i],
                        data[i + 1],
                        data[i + 2],
                        opts.brightness,
                        opts.contrast,
                        opts.saturation
                    );

                    data[i] = r;
                    data[i + 1] = g;
                    data[i + 2] = b;
                }

                if (pal && opts.dither > 0) {
                    pxQuantizeDither(data, smallW, smallH, pal, opts.dither);
                } else if (pal) {
                    for (let i = 0; i < data.length; i += 4) {
                        if (data[i + 3] < 20) continue;
                        const q = pxNearest(data[i], data[i + 1], data[i + 2], pal);
                        data[i] = q[0];
                        data[i + 1] = q[1];
                        data[i + 2] = q[2];
                    }
                }

                if (opts.cycle && pal) {
                    const shift = frameIndex % pal.length;
                    for (let i = 0; i < data.length; i += 4) {
                        if (data[i + 3] < 20) continue;
                        const idx = pal.findIndex(col => col[0] === data[i] && col[1] === data[i + 1] && col[2] === data[i + 2]);
                        if (idx < 0) continue;
                        const cycled = pal[(idx + shift) % pal.length];
                        data[i] = cycled[0];
                        data[i + 1] = cycled[1];
                        data[i + 2] = cycled[2];
                    }
                }

                if (opts.erode > 0) pxErodeImageData(img, smallW, smallH, opts.erode);
                sctx.putImageData(img, 0, 0);

                const out = document.createElement('canvas');
                out.width = sourceCanvas.width;
                out.height = sourceCanvas.height;

                const octx = out.getContext('2d');
                octx.imageSmoothingEnabled = false;
                octx.drawImage(small, 0, 0, out.width, out.height);

                if (opts.crt) pxApplyCRT(out, frameIndex);
                if (opts.ghost) pxApplyGhost(out, frameIndex);
                if (opts.glitch) pxApplyGlitch(out, frameIndex);

                return out;
            }

            function pxErodeImageData(imageData, w, h, passes) {
                const d = imageData.data;
                for (let p = 0; p < passes; p++) {
                    const copy = new Uint8ClampedArray(d);
                    for (let y = 0; y < h; y++) {
                        for (let x = 0; x < w; x++) {
                            const i = (y * w + x) * 4;
                            if (copy[i + 3] < 20) continue;
                            let lum = .2126 * copy[i] + .7152 * copy[i + 1] + .0722 * copy[i + 2];
                            let best = i;
                            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                                const nx = x + dx;
                                const ny = y + dy;
                                if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                                const ni = (ny * w + nx) * 4;
                                if (copy[ni + 3] < 20) continue;
                                const nl = .2126 * copy[ni] + .7152 * copy[ni + 1] + .0722 * copy[ni + 2];
                                if (nl < lum) {
                                    lum = nl;
                                    best = ni;
                                }
                            }
                            d[i] = copy[best];
                            d[i + 1] = copy[best + 1];
                            d[i + 2] = copy[best + 2];
                        }
                    }
                }
            }

            function pxApplyCRT(canvas) {
                const ctx = canvas.getContext('2d');
                ctx.save();
                ctx.globalAlpha = .16;
                ctx.fillStyle = '#000';
                for (let y = 0; y < canvas.height; y += 3) ctx.fillRect(0, y, canvas.width, 1);
                ctx.restore();
            }

            function pxApplyGlitch(canvas, frameIndex = 0) {
                const ctx = canvas.getContext('2d');
                const rnd = n => {
                    const x = Math.sin((frameIndex + 1) * 928.13 + n * 71.7) * 10000;
                    return x - Math.floor(x);
                };
                for (let i = 0; i < 6; i++) {
                    const y = Math.floor(rnd(i) * canvas.height);
                    const sh = 2 + rnd(i + 12) * 10;
                    const dx = (rnd(i + 24) * 18 - 9) | 0;
                    ctx.drawImage(canvas, 0, y, canvas.width, sh, dx, y, canvas.width, sh);
                }
            }

            function pxApplyGhost(canvas, frameIndex = 0) {
                const ctx = canvas.getContext('2d');
                ctx.save();
                ctx.globalAlpha = .18;
                ctx.drawImage(canvas, Math.sin(frameIndex / 5) * 4, 0);
                ctx.restore();
            }

            function ensurePixelFxBase() {
                const p = state.fxViewer.pixel;
                const layer = activeLayer();

                if (p.generatedFrames && p.previewBase) return p.previewBase;

                if (!layer || (layer.type || 'raster') !== 'raster') {
                    toast('Pixel Converter needs a raster layer.');
                    return null;
                }

                if (!p.previewBase || p.previewLayerId !== layer.id) {
                    p.previewBase = makeCanvas();
                    drawLayerToContext(p.previewBase.getContext('2d'), layer);
                    p.previewLayerId = layer.id;
                }

                return p.previewBase;
            }

            function clearPixelFxPreviewBase() {
                const p = state.fxViewer.pixel;
                if (p.generatedFrames) removePixelFxFrames();
                stopPixelFxPlayback();
                p.previewBase = null;
                p.previewLayerId = null;
                p.generatedFrames = false;
            }

            function pixelFxIsNeutral() {
                const p = state.fxViewer.pixel;

                return (
                    p.palette === 'none' &&
                    p.pixelSize <= 1 &&
                    p.dither === 0 &&
                    p.erode === 0 &&
                    p.brightness === 0 &&
                    p.contrast === 0 &&
                    p.saturation === 0 &&
                    !p.crt &&
                    !p.glitch &&
                    !p.cycle &&
                    !p.ghost
                );
            }

            function pixelFxIsAnimated() {
                const p = state.fxViewer.pixel;
                return !!(p.crt || p.glitch || p.cycle || p.ghost);
            }

            function updatePixelFxLive() {
                const p = state.fxViewer.pixel;
                const base = ensurePixelFxBase();

                if (!base) return;

                stopPixelFxPlayback();

                if (pixelFxIsNeutral()) {
                    if (!p.generatedFrames) {
                        const layer = activeLayer();
                        const ctx = layer.canvas.getContext('2d');
                        ctx.clearRect(0, 0, state.width, state.height);
                        ctx.drawImage(base, 0, 0);
                    }
                    removePixelFxFrames();
                    renderAll();
                    return;
                }

                if (pixelFxIsAnimated()) {
                    generatePixelFxFramesFromBase(base);
                    startPixelFxPlayback();
                    return;
                }

                if (p.generatedFrames) removePixelFxFrames();

                const out = mergePixelFxSelection(base, renderPixelArtCanvas(base, p, 0));
                const layer = activeLayer();
                const ctx = layer.canvas.getContext('2d');
                ctx.clearRect(0, 0, state.width, state.height);
                ctx.drawImage(out, 0, 0);

                renderAll();
            }

            function generatePixelFxFramesFromBase(base) {
                const p = state.fxViewer.pixel;
                const count = clamp(p.frameCount || 12, 2, 60);
                const delay = clamp(p.frameDelay || 150, 20, 1000);
                const frames = [];

                for (let i = 0; i < count; i++) {
                    const out = mergePixelFxSelection(base, renderPixelArtCanvas(base, p, i));
                    const layer = makeLayer('Pixel FX Preview', 'raster');

                    layer.canvas.width = state.width;
                    layer.canvas.height = state.height;
                    layer.canvas.getContext('2d').drawImage(out, 0, 0);

                    frames.push({
                        id: uid(),
                        name: `Pixel FX ${i + 1}`,
                        duration: delay,
                        layers: [layer]
                    });
                }

                state.frames = frames;
                state.activeFrame = 0;
                state.activeLayer = 0;
                p.generatedFrames = true;

                renderAll();
            }

            function startPixelFxPlayback() {
                const p = state.fxViewer.pixel;

                if (!p.generatedFrames || !state.frames.length) return;

                stopPixelFxPlayback();

                let i = 0;
                p.previewTimer = setInterval(() => {
                    i = (i + 1) % state.frames.length;
                    state.activeFrame = i;
                    state.activeLayer = 0;
                    renderAll();
                }, clamp(p.frameDelay || 150, 20, 1000));
            }

            function stopPixelFxPlayback() {
                const p = state.fxViewer.pixel;

                if (p.previewTimer) {
                    clearInterval(p.previewTimer);
                    p.previewTimer = null;
                }
            }

            function removePixelFxFrames() {
                const p = state.fxViewer.pixel;

                if (!p.generatedFrames) return;

                stopPixelFxPlayback();

                const base = p.previewBase;
                const layer = makeLayer('Background', 'raster');

                if (base) {
                    layer.canvas.getContext('2d').drawImage(base, 0, 0);
                }

                state.frames = [{
                    id: uid(),
                    name: 'Frame 1',
                    duration: 1000 / currentFps(),
                    layers: [layer]
                }];

                state.activeFrame = 0;
                state.activeLayer = 0;
                p.generatedFrames = false;
            }

            function getPixelFxSourceCanvas() {
                const layer = activeLayer();

                if (!layer || (layer.type || 'raster') !== 'raster') {
                    toast('Pixel Converter needs a raster layer.');
                    return null;
                }

                const src = document.createElement('canvas');
                src.width = state.width;
                src.height = state.height;
                drawLayerToContext(src.getContext('2d'), layer);

                return src;
            }

            function applyPixelFxToActiveLayer() {
                const layer = activeLayer();
                const src = getPixelFxSourceCanvas();
                if (!src) return;

                const out = mergePixelFxSelection(src, renderPixelArtCanvas(src, state.fxViewer.pixel, 0));
                const ctx = layer.canvas.getContext('2d');

                ctx.clearRect(0, 0, state.width, state.height);
                ctx.drawImage(out, 0, 0);

                pushHistory('Pixel Art Converter');
                renderAll();
            }

            function mergePixelFxSelection(src, out) {
                if (!state.selectionMask) return out;

                const merged = makeCanvas();
                const ctx = merged.getContext('2d');
                ctx.drawImage(src, 0, 0);

                const clipped = makeCanvas();
                clipped.getContext('2d').drawImage(out, 0, 0);
                applySelectionClip(clipped.getContext('2d'));

                ctx.save();
                ctx.globalCompositeOperation = 'destination-out';
                ctx.drawImage(state.selectionMask, 0, 0);
                ctx.restore();
                ctx.drawImage(clipped, 0, 0);

                return merged;
            }

            function applyPixelFxToFrames() {
                const src = getPixelFxSourceCanvas();
                if (!src) return;

                const opts = state.fxViewer.pixel;
                const count = clamp(opts.frameCount || 12, 2, 60);
                const delay = clamp(opts.frameDelay || 150, 20, 1000);
                const frames = [];

                for (let i = 0; i < count; i++) {
                    const out = mergePixelFxSelection(src, renderPixelArtCanvas(src, opts, i));
                    const layer = makeLayer('Pixel FX', 'raster');
                    layer.canvas.width = state.width;
                    layer.canvas.height = state.height;
                    layer.canvas.getContext('2d').drawImage(out, 0, 0);

                    frames.push({
                        id: uid(),
                        name: `Pixel FX ${i + 1}`,
                        duration: delay,
                        layers: [layer]
                    });
                }

                state.frames = frames;
                state.activeFrame = 0;
                state.activeLayer = 0;
                state.selection = null;
                state.selectionMask = null;
                state.selectedVectorObject = null;

                pushHistory('Pixel FX animation');
                renderAll();
                openDock('animation');
                toast(`${count} real Penta animation frames created.`);
            }

            function colorButton(color, draggable = false, index = -1) {
                return `
          <button
            class="cs-swatch"
            data-color="${color}"
            ${draggable ? `draggable="true" data-swatch-index="${index}"` : ''}
            title="Left click primary, right click secondary: ${color}"
            style="background:${color}">
          </button>
        `;
            }

            function colorLabChannels(hex, mode) {
                const [r, g, b] = hexToRgba(hex);
                if (mode === 'HEX') return [{ label: 'Primary hex', value: hex }, { label: 'Secondary hex', value: state.secondaryColor }];
                if (mode === 'RGB') return [['R', r], ['G', g], ['B', b]].map(([label, value]) => ({ label, value }));
                if (mode === 'CMYK') {
                    const k = 1 - Math.max(r, g, b) / 255;
                    const c = k === 1 ? 0 : (1 - r / 255 - k) / (1 - k);
                    const m = k === 1 ? 0 : (1 - g / 255 - k) / (1 - k);
                    const y = k === 1 ? 0 : (1 - b / 255 - k) / (1 - k);
                    return [['C', c], ['M', m], ['Y', y], ['K', k]].map(([label, value]) => ({ label, value: Math.round(value * 100) }));
                }
                const [l, a, labB] = rgbToLab(r, g, b);
                return [['L', l], ['A', a], ['B', labB]].map(([label, value]) => ({ label, value: Math.round(value * 10) / 10 }));
            }

            function colorFromLabChannels(values, mode) {
                if (mode === 'HEX') return /^#[0-9a-f]{6}$/i.test(values[0]) ? values[0] : null;
                const v = values.map(Number);
                if (v.some(n => !Number.isFinite(n))) return null;
                if (mode === 'RGB') return rgbToHex(...v.map(n => clamp(Math.round(n), 0, 255)));
                if (mode === 'CMYK') {
                    const [c, m, y, k] = v.map(n => clamp(n, 0, 100) / 100);
                    return rgbToHex(Math.round(255 * (1 - c) * (1 - k)), Math.round(255 * (1 - m) * (1 - k)), Math.round(255 * (1 - y) * (1 - k)));
                }
                const [r, g, b] = labToRgb(clamp(v[0], 0, 100), clamp(v[1], -128, 127), clamp(v[2], -128, 127));
                return rgbToHex(r, g, b);
            }

            function rgbToLab(r, g, b) {
                let [x, y, z] = [r, g, b].map(v => { v /= 255; return v > .04045 ? ((v + .055) / 1.055) ** 2.4 : v / 12.92; });
                [x, y, z] = [(x * .4124 + y * .3576 + z * .1805) / .95047, (x * .2126 + y * .7152 + z * .0722), (x * .0193 + y * .1192 + z * .9505) / 1.08883];
                [x, y, z] = [x, y, z].map(v => v > .008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
                return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
            }

            function labToRgb(l, a, b) {
                let y = (l + 16) / 116, x = a / 500 + y, z = y - b / 200;
                [x, y, z] = [x, y, z].map(v => v ** 3 > .008856 ? v ** 3 : (v - 16 / 116) / 7.787);
                [x, y, z] = [x * .95047, y, z * 1.08883];
                const linear = [x * 3.2406 + y * -1.5372 + z * -.4986, x * -.9689 + y * 1.8758 + z * .0415, x * .0557 + y * -.204 + z * 1.057];
                return linear.map(v => Math.round(255 * (v > .0031308 ? 1.055 * v ** (1 / 2.4) - .055 : 12.92 * v))).map(v => clamp(v, 0, 255));
            }

            function setPentaColor(color, slot = 'primary', refreshDock = false) {
                if (!/^#[0-9a-f]{6}$/i.test(color)) {
                    toast('Invalid hex color.');
                    return;
                }

                color = color.toLowerCase();

                if (slot === 'secondary') {
                    state.secondaryColor = color;
                } else {
                    state.primaryColor = color;
                }

                state.recentColors = [
                    color,
                    ...state.recentColors.filter(c => c !== color)
                ].slice(0, 12);

                updateControls();

                if (refreshDock && state.activeDock === 'color') {
                    renderDockContent();
                }
            }

            function saveSwatch(color) {
                if (!state.swatches.includes(color)) {
                    state.swatches.push(color);
                }
                renderDockContent();
                toast('Swatch saved.');
            }

            function openBrushFloatingMenu(kind, rect) {
                closeBrushFloatingMenu();
                const wrap = document.createElement('div');
                wrap.id = 'floatingBrushMenu';
                Object.assign(wrap.style, {
                    position: 'fixed',
                    left: rect.left + 'px',
                    bottom: '158px',
                    zIndex: 999999
                });
                wrap.innerHTML = renderBrushFloatingMenu(kind);
                document.body.appendChild(wrap);
                bindBrushFloatingMenu(kind, wrap);
            }

            function closeBrushFloatingMenu() {
                document.getElementById('floatingBrushMenu')?.remove();
            }

            function renderBrushFloatingMenu(kind) {
                const b = state.brushLab;
                if (kind === 'dynamics') return `
          <div class="brush-float">
            <strong>Stroke Dynamics</strong>
            ${brushSlider('Spacing', 'blSpacing', b.spacing, 1, 60, '%')}
            ${brushSlider('Scatter', 'blScatter', b.scatter, 0, 220, '%')}
            ${brushSlider('Size Jitter', 'blSizeJitter', b.sizeJitter, 0, 100, '%')}
            ${brushSlider('Opacity Jitter', 'blOpacityJitter', b.opacityJitter, 0, 100, '%')}
            ${brushSlider('Angle Jitter', 'blAngleJitter', b.angleJitter, 0, 360, 'deg')}
            <label class="bl-toggle"><input type="checkbox" id="blMousePressure" ${state.mousePressureEnabled ? 'checked' : ''}> Mouse pressure emulation</label>
            <select id="blMainBlend" aria-label="Brush blend mode">
              ${['source-over','multiply','screen','overlay','lighter','color-dodge','color-burn'].map(mode => `<option value="${mode}">${mode}</option>`).join('')}
            </select>
          </div>
        `;
                if (kind === 'pressure') return `
          <div class="brush-float wide">
            <strong>Pressure Curve</strong>
            <canvas id="pressureCurveCanvas" width="410" height="180"></canvas>
            <div class="bl-actions">
              <button class="btn" id="curveSoft">Soft</button>
              <button class="btn" id="curveLinear">Linear</button>
              <button class="btn" id="curveHard">Hard</button>
            </div>
          </div>
        `;
                if (kind === 'texture') return `
          <div class="brush-float">
            <strong>Texture Brush</strong>
            <button class="btn" id="importTextureBrush">
              <span class="material-symbols-rounded">texture</span>Import Texture
            </button>
            <button class="btn" id="clearTextureBrush">
              <span class="material-symbols-rounded">hide_image</span>Clear Texture
            </button>
            <label style="font-size:12px;color:var(--muted)">
              <input type="checkbox" id="useTextureBrush" ${b.useTexture ? 'checked' : ''}>
              Use texture stamp ${b.textureName ? `- ${escapeHtml(b.textureName)}` : ''}
            </label>
          </div>
        `;
                if (kind === 'dual') return `
          <div class="brush-float">
            <strong>Dual Brush</strong>
            <label style="font-size:12px;color:var(--muted)">
              <input type="checkbox" id="dualBrushToggle" ${b.dualBrush ? 'checked' : ''}>
              Blend primary + secondary
            </label>
            ${brushSlider('Dual Opacity', 'blDualOpacity', Math.round(b.dualOpacity * 100), 0, 100, '%')}
            ${brushSlider('Dual Offset', 'blDualOffset', Math.round(b.dualOffset * 100), 0, 200, '%')}
            <select id="blDualBlend">
              <option value="source-over">source-over</option>
              <option value="multiply">multiply</option>
              <option value="screen">screen</option>
              <option value="overlay">overlay</option>
              <option value="lighter">lighter</option>
            </select>
          </div>
        `;
                return `
          <div class="brush-float">
            <strong>Brush Presets</strong>
            <select id="brushPresetSelect">
              <option value="">Custom presets</option>
              ${b.presets.map((preset, i) => `<option value="${i}">${escapeHtml(preset.name || 'Brush ' + (i + 1))}</option>`).join('')}
            </select>
            <div class="bl-actions">
              <button class="btn" id="saveBrushPreset"><span class="material-symbols-rounded">add</span>Save</button>
              <button class="btn" id="exportBrushPreset"><span class="material-symbols-rounded">download</span>Export</button>
              <button class="btn" id="importBrushPreset"><span class="material-symbols-rounded">upload</span>Import</button>
            </div>
          </div>
        `;
            }

            function bindBrushFloatingMenu(kind, root) {
                const b = state.brushLab;
                bindBrushSlider('blSpacing', v => b.spacing = v);
                bindBrushSlider('blScatter', v => b.scatter = v);
                bindBrushSlider('blSizeJitter', v => b.sizeJitter = v);
                bindBrushSlider('blOpacityJitter', v => b.opacityJitter = v);
                bindBrushSlider('blAngleJitter', v => b.angleJitter = v);
                bindBrushSlider('blDualOpacity', v => b.dualOpacity = v / 100);
                bindBrushSlider('blDualOffset', v => b.dualOffset = v / 100);

                if ($('#blMousePressure')) $('#blMousePressure').onchange = e => {
                    state.mousePressureEnabled = e.target.checked;
                    $('#mousePressureEnabled').value = state.mousePressureEnabled ? 'on' : 'off';
                };
                if ($('#blMainBlend')) {
                    $('#blMainBlend').value = state.blend;
                    $('#blMainBlend').onchange = e => {
                        state.blend = e.target.value;
                        $('#blend').value = state.blend;
                    };
                }

                if ($('#useTextureBrush')) $('#useTextureBrush').onchange = e => {
                    b.useTexture = e.target.checked;
                    drawBrushPreview();
                };

                if ($('#dualBrushToggle')) $('#dualBrushToggle').onchange = e => {
                    b.dualBrush = e.target.checked;
                    drawBrushPreview();
                };

                if ($('#blDualBlend')) {
                    $('#blDualBlend').value = b.dualBlend;
                    $('#blDualBlend').onchange = e => {
                        b.dualBlend = e.target.value;
                        drawBrushPreview();
                    };
                }

                if ($('#importTextureBrush')) $('#importTextureBrush').onclick = () => $('#brushTextureInput').click();

                if ($('#clearTextureBrush')) $('#clearTextureBrush').onclick = () => {
                    b.texture = null;
                    b.textureName = '';
                    b.useTexture = false;
                    closeBrushFloatingMenu();
                    renderDockContent();
                };

                if ($('#curveLinear')) $('#curveLinear').onclick = () => setPressureCurve([
                    { x: 0, y: 0 }, { x: .33, y: .33 }, { x: .66, y: .66 }, { x: 1, y: 1 }
                ]);

                if ($('#curveSoft')) $('#curveSoft').onclick = () => setPressureCurve([
                    { x: 0, y: 0 }, { x: .2, y: .45 }, { x: .65, y: .9 }, { x: 1, y: 1 }
                ]);

                if ($('#curveHard')) $('#curveHard').onclick = () => setPressureCurve([
                    { x: 0, y: 0 }, { x: .35, y: .08 }, { x: .78, y: .55 }, { x: 1, y: 1 }
                ]);

                if ($('#pressureCurveCanvas')) {
                    drawPressureCurve();
                    bindPressureCurveCanvas();
                }

                if ($('#saveBrushPreset')) $('#saveBrushPreset').onclick = saveCurrentBrushPreset;
                if ($('#exportBrushPreset')) $('#exportBrushPreset').onclick = exportCurrentBrushPreset;
                if ($('#importBrushPreset')) $('#importBrushPreset').onclick = () => $('#brushPresetInput').click();
                if ($('#brushPresetSelect')) $('#brushPresetSelect').onchange = e => {
                    if (e.target.value === '') return;
                    applyBrushPreset(b.presets[Number(e.target.value)]);
                    closeBrushFloatingMenu();
                };
            }

            function bindBrushSlider(id, setter) {
                const input = $('#' + id);
                const out = $('#' + id + 'Out');
                if (!input) return;

                input.oninput = e => {
                    const v = Number(e.target.value);
                    setter(v);
                    if (out) out.textContent = v + (input.dataset.suffix || '%');
                    drawBrushPreview();
                };
            }

            function setPressureCurve(points) {
                state.brushLab.pressureCurve = points;
                drawPressureCurve();
                drawBrushPreview();
            }

            function bindPressureCurveCanvas() {
                const canvas = $('#pressureCurveCanvas');
                if (!canvas) return;

                canvas.onpointerdown = e => {
                    const p = curvePointer(e, canvas);
                    const pts = state.brushLab.pressureCurve;

                    let best = 1;
                    let bestDist = Infinity;

                    for (let i = 1; i < pts.length - 1; i++) {
                        const dx = pts[i].x - p.x;
                        const dy = pts[i].y - p.y;
                        const d = Math.hypot(dx, dy);
                        if (d < bestDist) {
                            bestDist = d;
                            best = i;
                        }
                    }

                    state.activeCurvePoint = best;
                    moveCurvePoint(best, p);
                    canvas.setPointerCapture(e.pointerId);
                };

                canvas.onpointermove = e => {
                    if (state.activeCurvePoint == null) return;
                    moveCurvePoint(state.activeCurvePoint, curvePointer(e, canvas));
                };

                canvas.onpointerup = () => {
                    state.activeCurvePoint = null;
                };
            }

            function curvePointer(e, canvas) {
                const r = canvas.getBoundingClientRect();
                return {
                    x: clamp((e.clientX - r.left) / r.width, 0, 1),
                    y: clamp(1 - ((e.clientY - r.top) / r.height), 0, 1)
                };
            }

            function moveCurvePoint(index, p) {
                const pts = state.brushLab.pressureCurve;
                const minX = pts[index - 1].x + .03;
                const maxX = pts[index + 1].x - .03;

                pts[index].x = clamp(p.x, minX, maxX);
                pts[index].y = clamp(p.y, 0, 1);

                drawPressureCurve();
                drawBrushPreview();
            }

            function drawPressureCurve() {
                const canvas = $('#pressureCurveCanvas');
                if (!canvas) return;

                const ctx = canvas.getContext('2d');
                const pts = state.brushLab.pressureCurve;
                const w = canvas.width;
                const h = canvas.height;

                ctx.clearRect(0, 0, w, h);

                ctx.strokeStyle = 'rgba(255,255,255,.11)';
                ctx.lineWidth = 1;
                for (let i = 0; i <= 4; i++) {
                    const x = i * w / 4;
                    const y = i * h / 4;
                    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
                }

                ctx.strokeStyle = state.primaryColor;
                ctx.lineWidth = 3;
                ctx.beginPath();
                pts.forEach((p, i) => {
                    const x = p.x * w;
                    const y = (1 - p.y) * h;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                });
                ctx.stroke();

                for (const p of pts) {
                    ctx.fillStyle = '#fff';
                    ctx.beginPath();
                    ctx.arc(p.x * w, (1 - p.y) * h, 5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            function applyPressureCurve(v) {
                const pts = state.brushLab.pressureCurve;
                v = clamp(v, 0, 1);

                for (let i = 0; i < pts.length - 1; i++) {
                    const a = pts[i];
                    const b = pts[i + 1];

                    if (v >= a.x && v <= b.x) {
                        const t = (v - a.x) / Math.max(.0001, b.x - a.x);
                        return a.y + (b.y - a.y) * t;
                    }
                }

                return v;
            }

            function bindColorButtons(root) {
                root.querySelectorAll('[data-color]').forEach(btn => {
                    btn.onclick = e => {
                        e.preventDefault();
                        setPentaColor(btn.dataset.color, 'primary', true);
                    };

                    btn.oncontextmenu = e => {
                        e.preventDefault();
                        setPentaColor(btn.dataset.color, 'secondary', true);
                    };
                });
            }

            function bindSwatchDrag(root) {
                const swatches = root.querySelectorAll('[data-swatch-index]');
                let fromIndex = null;

                swatches.forEach(btn => {
                    btn.addEventListener('dragstart', e => {
                        fromIndex = Number(btn.dataset.swatchIndex);
                        btn.classList.add('dragging');
                        e.dataTransfer.effectAllowed = 'move';
                    });

                    btn.addEventListener('dragend', () => {
                        btn.classList.remove('dragging');
                        root.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over'));
                    });

                    btn.addEventListener('dragover', e => {
                        e.preventDefault();
                        btn.classList.add('drag-over');
                    });

                    btn.addEventListener('dragleave', () => {
                        btn.classList.remove('drag-over');
                    });

                    btn.addEventListener('drop', e => {
                        e.preventDefault();
                        const toIndex = Number(btn.dataset.swatchIndex);
                        reorderSwatch(fromIndex, toIndex);
                    });
                });
            }

            function reorderSwatch(fromIndex, toIndex) {
                if (fromIndex === toIndex || fromIndex == null || toIndex == null) return;

                const moved = state.swatches.splice(fromIndex, 1)[0];
                state.swatches.splice(toIndex, 0, moved);

                renderDockContent();
            }

            function renderPaletteMenu() {
                return `
          <div class="palette-menu">
            ${state.palettes.map((palette, i) => `
              <div class="palette-row">
                <div>
                  <strong>${escapeHtml(palette.name)}</strong>
                  <div class="palette-colors">
                    ${palette.colors.map(c => `<button class="palette-chip" data-color="${c}" style="background:${c}" title="${c}"></button>`).join('')}
                  </div>
                </div>
                <div class="mini-actions">
                  <button class="mini" data-apply-palette="${i}" title="Add to swatches">
                    <span class="material-symbols-rounded">add</span>
                  </button>
                  <button class="mini" data-remove-palette="${i}" title="Remove palette">
                    <span class="material-symbols-rounded">delete</span>
                  </button>
                </div>
              </div>
            `).join('')}

            <button class="btn" id="addCustomPalette">
              <span class="material-symbols-rounded">add_circle</span>Add Custom Palette
            </button>
          </div>
        `;
            }

            function openPaletteMenu(rect) {
                closePaletteMenu();

                const wrap = document.createElement('div');
                wrap.id = 'floatingPaletteMenu';
                wrap.innerHTML = renderPaletteMenu();

                Object.assign(wrap.style, {
                    position: 'fixed',
                    left: rect.left + 'px',
                    bottom: '158px',
                    zIndex: 999999
                });

                document.body.appendChild(wrap);
                bindPaletteMenu(wrap);
                bindColorButtons(wrap);
            }

            function closePaletteMenu() {
                document.getElementById('floatingPaletteMenu')?.remove();
            }

            function openCanvasSwitcher(anchor) {
                closeCanvasSwitcher();
                syncActiveDocumentFromState();

                const r = anchor.getBoundingClientRect();
                const pop = document.createElement('div');
                pop.id = 'canvasSwitcherPop';
                pop.className = 'canvas-switcher';

                Object.assign(pop.style, {
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    zIndex: 999999,
                    maxHeight: '500px'
                });

                pop.innerHTML = `
          <div class="canvas-switcher-title">CANVASES</div>
          <div class="canvas-carousel">
            ${state.documents.map((d, i) => `
              <button class="canvas-card ${i === state.activeDocument ? 'active' : ''}" data-doc="${i}">
                <canvas class="canvas-card-preview" data-canvas-preview="${i}" width="128" height="76"></canvas>
                <strong>${escapeHtml(d.name)}</strong><span>${d.width} × ${d.height} px</span><span>${d.frames.length} frame${d.frames.length === 1 ? '' : 's'}</span>
              </button>
            `).join('')}
            <button class="canvas-card add" id="newCanvasFromSwitcher">
              <span class="material-symbols-rounded">add</span><strong>New Canvas</strong>
            </button>
          </div>
          <div class="canvas-switcher-details">
            <div>Name<strong>${escapeHtml(state.documents[state.activeDocument].name)}</strong></div>
            <div>Preset<strong>Custom</strong></div>
            <div>Width<strong>${state.width} px</strong></div>
            <div>Height<strong>${state.height} px</strong></div>
            <div>Resolution<strong>72 ppi</strong></div>
            <div>Color Mode<strong>RGBA 8-bit</strong></div>
            <div>Background<strong>White</strong></div>
            <div>Color Profile<strong>sRGB</strong></div>
          </div>
        `;

                document.body.appendChild(pop);
                pop.querySelectorAll('[data-canvas-preview]').forEach(canvas => drawDocumentThumbnail(canvas, state.documents[Number(canvas.dataset.canvasPreview)]));

                pop.querySelectorAll('[data-doc]').forEach(btn => {
                    btn.onclick = () => {
                        switchDocument(Number(btn.dataset.doc));
                        openCanvasSwitcher(anchor);
                    };
                });

                pop.querySelector('#newCanvasFromSwitcher').onclick = () => {
                    syncActiveDocumentFromState();
                    state.documents.push(makeDocument(`Canvas ${state.documents.length + 1}`, 1280, 720));
                    switchDocument(state.documents.length - 1);
                    openCanvasSwitcher(anchor);
                };
            }

            function closeCanvasSwitcher() {
                document.getElementById('canvasSwitcherPop')?.remove();
            }

            function openColorWorkflow(anchor) {
                document.getElementById('colorWorkflowPop')?.remove();
                const r = anchor.getBoundingClientRect();
                const pop = document.createElement('div');
                pop.id = 'colorWorkflowPop'; pop.className = 'color-workflow-pop';
                pop.innerHTML = `<strong>COLOR WORKFLOW</strong><div><span>Canvas</span><b>${state.width} × ${state.height} px</b></div><div><span>Color mode</span><b>RGBA 8-bit</b></div><div><span>Profile</span><b>sRGB</b></div>`;
                Object.assign(pop.style, { position: 'fixed', top: `${r.bottom + 8}px`, right: '18px', zIndex: 999999 });
                pop.addEventListener('pointerleave', () => pop.remove());
                document.body.appendChild(pop);
            }

            function openCustomColorPicker(slot, anchor) {
                document.getElementById('pentaColorPickerBackdrop')?.remove();
                const current = slot === 'secondary' ? state.secondaryColor : state.primaryColor;
                const [r, g, b] = hexToRgba(current);
                let [h, s, l] = rgbToHsl(r, g, b);
                const backdrop = document.createElement('div');
                backdrop.id = 'pentaColorPickerBackdrop'; backdrop.className = 'penta-color-picker-backdrop';
                const pop = document.createElement('div');
                pop.id = 'pentaColorPicker'; pop.className = 'penta-color-picker';
                pop.innerHTML = `<div class="picker-left"><strong>COLOR</strong><div class="picker-wheel"></div><span>RECENT SWATCHES</span></div><div class="picker-right"><div class="picker-top"><span>OLD<div class="picker-preview" style="background:${current}"></div></span><span>NEW<div class="picker-preview"></div></span></div><label>HEX<input type="text" value="${current}" aria-label="Hex color"></label><div class="picker-number-grid"><label>R<input type="number" data-rgb="r" value="${r}"></label><label>G<input type="number" data-rgb="g" value="${g}"></label><label>B<input type="number" data-rgb="b" value="${b}"></label></div><div class="picker-number-grid"><label>H<input type="number" data-channel="h" value="${Math.round(h * 360)}"></label><label>S<input type="number" data-channel="s" value="${Math.round(s * 100)}"></label><label>B<input type="number" data-channel="l" value="${Math.round(l * 100)}"></label></div><div class="field"><label>OPACITY <output>100</output></label><input type="range" min="0" max="100" value="100"></div><div class="split"><button class="btn" data-picker-close>Close</button><button class="btn primary" data-picker-close>Apply</button></div></div>`;
                const hex = pop.querySelector('input[type="text"]'), preview = pop.querySelector('.picker-preview');
                const sync = () => {
                    const [nr, ng, nb] = hslToRgb(h, s, l).map(Math.round); const next = rgbToHex(nr, ng, nb);
                    preview.style.background = next; hex.value = next; setPentaColor(next, slot, true); updateControls();
                    pop.querySelectorAll('input[type="range"]').forEach(input => { input.style.setProperty('--range-fill', `${(input.value - input.min) / (input.max - input.min) * 100}%`); input.previousElementSibling.querySelector('output').value = input.value; });
                };
                pop.querySelectorAll('input[data-channel]').forEach(input => input.oninput = () => { if (input.dataset.channel === 'h') h = input.value / 360; if (input.dataset.channel === 's') s = input.value / 100; if (input.dataset.channel === 'l') l = input.value / 100; sync(); });
                pop.querySelectorAll('input[data-rgb]').forEach(input => input.oninput = () => {
                    const rgb = ['r', 'g', 'b'].map(key => clamp(Number(pop.querySelector(`[data-rgb="${key}"]`).value), 0, 255));
                    [h, s, l] = rgbToHsl(...rgb); sync();
                });
                hex.onchange = () => { if (/^#[0-9a-f]{6}$/i.test(hex.value)) { const rgb = hexToRgba(hex.value); [h, s, l] = rgbToHsl(...rgb); sync(); } };
                backdrop.appendChild(pop); backdrop.addEventListener('pointerdown', e => { if (e.target === backdrop) backdrop.remove(); });
                pop.querySelectorAll('[data-picker-close]').forEach(button => button.onclick = () => backdrop.remove());
                document.body.appendChild(backdrop); sync();
            }

            function drawDocumentThumbnail(target, documentState) {
                const ctx = target.getContext('2d');
                const frame = documentState?.frames?.[documentState.activeFrame || 0];
                if (!frame) return;
                const scale = Math.min(target.width / documentState.width, target.height / documentState.height);
                const w = documentState.width * scale, h = documentState.height * scale;
                const x = (target.width - w) / 2, y = (target.height - h) / 2;
                frame.layers.forEach(layer => {
                    if (layer.visible === false || !layer.canvas) return;
                    ctx.save(); ctx.globalAlpha = layer.opacity ?? 1;
                    ctx.globalCompositeOperation = layer.blend || 'source-over';
                    ctx.drawImage(layer.canvas, x, y, w, h); ctx.restore();
                });
            }

            function bindPaletteMenu(root) {
                const addCustom = $('#addCustomPalette');
                if (addCustom) {
                    addCustom.onclick = () => {
                        openPentaWindow({
                            title: 'Custom Palette',
                            body: `
                <div class="field">
                  <label>Name</label>
                  <input type="text" id="paletteName" value="Custom Palette">
                </div>
                <div class="field">
                  <label>Colors</label>
                  <input type="text" id="paletteColors" value="${state.primaryColor}, ${state.secondaryColor}">
                </div>
              `,
                            actions: [
                                { id: 'cancel', label: 'Cancel', onClick: closePentaWindow },
                                {
                                    id: 'add',
                                    label: 'Add',
                                    primary: true,
                                    icon: 'check',
                                    onClick: () => {
                                        const name = $('#paletteName').value.trim() || 'Custom Palette';
                                        const colors = $('#paletteColors').value
                                            .split(',')
                                            .map(c => c.trim().toLowerCase())
                                            .filter(c => /^#[0-9a-f]{6}$/i.test(c));
                                        if (!colors.length) return toast('No valid colors found.');
                                        state.palettes.push({ name, colors });
                                        closePentaWindow();
                                        renderDockContent();
                                    }
                                }
                            ]
                        });
                    };
                }

                root.querySelectorAll('[data-apply-palette]').forEach(btn => {
                    btn.onclick = () => {
                        const palette = state.palettes[Number(btn.dataset.applyPalette)];
                        for (const color of palette.colors) {
                            if (!state.swatches.includes(color)) state.swatches.push(color);
                        }
                        toast('Palette added to swatches.');
                        renderDockContent();
                    };
                });

                root.querySelectorAll('[data-remove-palette]').forEach(btn => {
                    btn.onclick = () => {
                        const index = Number(btn.dataset.removePalette);
                        state.palettes.splice(index, 1);
                        renderDockContent();
                    };
                });
            }

            function escapeHtml(s) { return s.replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }

            function attachEvents() {
                $('#bottomDockCompactToggle')?.addEventListener('click', () => {
                    if (state.dockOpen) closeDock();
                    setBottomDockCompact(!state.bottomDockCompact);
                });
                $('#tools').addEventListener('click', e => {
                    const btn = e.target.closest('button');
                    if (!btn) return;

                    commitTextEdit();

                    const family = btn.dataset.family;
                    const tool = btn.dataset.tool;

                    if (family) {
                        state.showAltTools = state.showAltTools === family ? null : family;

                        const nextTool =
                            family === 'shape' ? state.activeShapeTool :
                                family === 'selection' ? state.activeSelectionTool :
                                    state.activeMoveTool;

                        if (state.lineEdit && nextTool !== 'line') commitLineEdit();
                        if (state.floatingSelection && nextTool !== 'movePixels') {
                            commitFloatingSelection();
                            pushHistory('Move selected pixels');
                        }
                        if (nextTool !== 'moveSelection') state.selectionOutlineTransform = null;
                        state.tool = nextTool;

                        updateToolButtons();
                        renderAltTools();
                        showToolOptionsForTool(state.tool);
                        // A family button selects its remembered tool on touch. The
                        // active-tool controls now live on the canvas, so the sheet
                        // must not remain in the way of drawing.
                        dismissMobileToolSheet();
                        return;
                    }

                    if (tool) {
                        if (state.lineEdit && tool !== 'line') commitLineEdit();
                        if (state.floatingSelection && tool !== 'movePixels') {
                            commitFloatingSelection();
                            pushHistory('Move selected pixels');
                        }
                        if (tool !== 'moveSelection') state.selectionOutlineTransform = null;
                        state.tool = tool;
                        state.showAltTools = null;
                        syncActiveToolFamily(tool);
                        updateToolButtons();
                        renderAltTools();
                        showToolOptionsForTool(tool);
                        dismissMobileToolSheet();
                    }
                });

                $('#altTools')?.addEventListener('click', e => {
                    const btn = e.target.closest('[data-alt-tool]');
                    if (!btn) return;

                    commitTextEdit();

                    const tool = btn.dataset.altTool;
                    const family = btn.dataset.family;

                    if (state.lineEdit && tool !== 'line') commitLineEdit();
                    if (state.floatingSelection && tool !== 'movePixels') {
                        commitFloatingSelection();
                        pushHistory('Move selected pixels');
                    }
                    if (tool !== 'moveSelection') state.selectionOutlineTransform = null;
                    state.tool = tool;

                    if (family === 'shape') state.activeShapeTool = tool;
                    if (family === 'selection') state.activeSelectionTool = tool;
                    if (family === 'move') state.activeMoveTool = tool;

                    updateToolButtons();
                    renderAltTools();
                    showToolOptionsForTool(tool);
                    dismissMobileToolSheet();
                });

                $('#color').oninput = e => setPentaColor(e.target.value, 'primary', true);
                $('#colorText').onchange = e => setPentaColor(e.target.value, 'primary', true);
                $('#color2').oninput = e => setPentaColor(e.target.value, 'secondary', true);
                [['#color', 'primary'], ['#color2', 'secondary']].forEach(([selector, slot]) => {
                    $(selector).addEventListener('pointerdown', e => { e.preventDefault(); openCustomColorPicker(slot, e.currentTarget); });
                    $(selector).addEventListener('click', e => e.preventDefault());
                });
                $('#colorText2').onchange = e => setPentaColor(e.target.value, 'secondary', true);
                $('#size').oninput = e => { state.size = +e.target.value; updateControls(); };
                $('#opacity').oninput = e => { state.opacity = +e.target.value / 100; updateControls(); };
                $('#softness').oninput = e => { state.softness = +e.target.value / 100; updateControls(); };
                $('#stabilizer').oninput = e => { state.stabilizer = +e.target.value / 100; updateControls(); };
                $('#blend').onchange = e => { state.blend = e.target.value; };
                $('#mousePressureEnabled').onchange = e => { state.mousePressureEnabled = e.target.value === 'on'; };
                $('#antiAliasToggle')?.addEventListener('click', () => {
                    state.antiAlias = !state.antiAlias;
                    if (!state.antiAlias) state.resampling = 'nearest';
                    updateControls();
                    drawSelectedVectorOverlay();
                    toast(`Antialiasing: ${state.antiAlias ? 'ON (smooth)' : 'OFF (jagged)'}`);
                });
                $('#pixelGridToggle')?.addEventListener('click', () => {
                    state.pixelGrid = !state.pixelGrid;
                    updateControls();
                    drawSelectedVectorOverlay();
                    toast(`Pixel grid: ${state.pixelGrid ? 'On' : 'Off'}`);
                });
                $('#textSize').onchange = e => { state.textSize = clamp(+e.target.value || 42, 6, 400); };
                $('#layerOpacity').oninput = e => { activeLayer().opacity = +e.target.value / 100; composite(activeFrame(), true); updateControls(); renderLayers(); };
                $('#layerOpacity').onchange = () => pushHistory('Layer opacity');

                let openMenu = null;
                let menuCloseTimer = null;

                function closeMenus() {
                    document.querySelectorAll('.menu-list.open').forEach(x => x.classList.remove('open'));
                    document.querySelectorAll('.menu > button.active').forEach(x => x.classList.remove('active'));
                    openMenu = null;
                }

                function openAppMenu(menu) {
                    clearTimeout(menuCloseTimer);

                    const button = menu.querySelector(':scope > button');
                    const list = menu.querySelector('.menu-list');
                    const rect = button.getBoundingClientRect();

                    document.querySelectorAll('.menu-list.open').forEach(x => {
                        if (x !== list) x.classList.remove('open');
                    });

                    document.querySelectorAll('.menu > button.active').forEach(x => x.classList.remove('active'));

                    list.style.left = rect.left + 'px';
                    list.style.top = rect.bottom + 6 + 'px';
                    list.classList.add('open');
                    button.classList.add('active');
                    openMenu = list;
                }

                document.querySelectorAll('.menu').forEach(menu => {
                    const button = menu.querySelector(':scope > button');
                    const list = menu.querySelector('.menu-list');

                    button.addEventListener('pointerdown', e => {
                        e.preventDefault();
                        e.stopPropagation();

                        if (openMenu === list) closeMenus();
                        else openAppMenu(menu);
                    });

                    button.addEventListener('pointerenter', () => {
                        if (openMenu) openAppMenu(menu);
                    });

                    menu.addEventListener('pointerleave', () => {
                        clearTimeout(menuCloseTimer);
                        menuCloseTimer = setTimeout(() => {
                            if (!document.querySelector('.menu:hover') && !document.querySelector('.menu-list:hover')) {
                                closeMenus();
                            }
                        }, 220);
                    });

                    list.addEventListener('pointerenter', () => clearTimeout(menuCloseTimer));

                    list.addEventListener('pointerleave', () => {
                        clearTimeout(menuCloseTimer);
                        menuCloseTimer = setTimeout(closeMenus, 180);
                    });
                });

                document.addEventListener('pointerdown', e => {
                    if (!e.target.closest('.menu') && !e.target.closest('.menu-list')) {
                        closeMenus();
                    }
                });

                document.addEventListener('click', e => {
                    if (
                        !e.target.closest('#floatingPaletteMenu') &&
                        !e.target.closest('#openPaletteMenu')
                    ) {
                        closePaletteMenu();
                    }
                });

                document.addEventListener('click', e => {
                    if (
                        !e.target.closest('#floatingBrushMenu') &&
                        !e.target.closest('#dockContent')
                    ) {
                        closeBrushFloatingMenu();
                    }
                });

                document.addEventListener('click', e => {
                    if (
                        !e.target.closest('#floatingStrokeRevise') &&
                        !e.target.closest('#openStrokeRevise')
                    ) {
                        closeStrokeReviseMenu();
                    }
                });

                document.addEventListener('click', e => {
                    if (
                        !e.target.closest('#floatingTextMenu') &&
                        !e.target.closest('#openTextSpacing') &&
                        !e.target.closest('#openTextEffects') &&
                        !e.target.closest('#openTextAdvanced')
                    ) {
                        closeTextFloatingMenu();
                    }
                });

                document.addEventListener('click', e => {
                    if (
                        !e.target.closest('#floatingPixelAdjust') &&
                        !e.target.closest('#openPixelAdjust')
                    ) {
                        document.getElementById('floatingPixelAdjust')?.remove();
                    }
                });

                document.addEventListener('click', e => {
                    if (
                        !e.target.closest('#canvasSwitcherPop') &&
                        !e.target.closest('#canvasSwitcherBtn')
                    ) {
                        closeCanvasSwitcher();
                    }
                });

                document.addEventListener('pointerdown', e => {
                    if (!els.textEditor || els.textEditor.style.display !== 'block') return;
                    if (!els.textEditor.contains(e.target)) commitTextEdit();
                }, true);

                els.textEditor.addEventListener('keydown', e => {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelTextEdit();
                    }
                });

                ['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu'].forEach(type => {
                    els.textEditor.addEventListener(type, e => {
                        e.stopPropagation();
                    });
                });

                els.textEditor.addEventListener('input', autoResizeTextEditor);
                window.addEventListener('blur', commitTextEdit);

                els.shell.addEventListener('pointerdown', pointerDown);
                els.workspace.addEventListener('pointerdown', trackWorkspaceTouch, true);
                els.shell.addEventListener('contextmenu', e => {
                    e.preventDefault();
                });
                window.addEventListener('pointermove', pointerMove);
                window.addEventListener('pointerup', pointerUp);
                window.addEventListener('pointercancel', pointerUp);
                els.shell.addEventListener('pointerleave', () => els.cursor.style.display = 'none');
                els.shell.addEventListener('pointermove', updateCursor);
                els.workspace.addEventListener('wheel', handleWorkspaceWheel, { passive: false });

                $('#addLayer').onclick = () => { activeFrame().layers.push(makeLayer('Raster ' + (activeFrame().layers.length + 1), 'raster')); state.activeLayer = activeFrame().layers.length - 1; pushHistory('Add raster layer'); renderAll(); };
                $('#addVectorLayer').onclick = () => { activeFrame().layers.push(makeLayer('Vector ' + (activeFrame().layers.length + 1), 'vector')); state.activeLayer = activeFrame().layers.length - 1; pushHistory('Add vector layer'); renderAll(); };
                $('#dupLayer').onclick = duplicateLayer;
                $('#delLayer').onclick = deleteLayer;
                $('#zoomIn')?.addEventListener('click', () => zoomAt(state.zoom >= 8 ? 1.5 : 1.15));
                $('#zoomOut')?.addEventListener('click', () => zoomAt(state.zoom >= 8 ? 1 / 1.5 : .85));
                $('#undo')?.addEventListener('click', undo); $('#redo')?.addEventListener('click', redo);
                $('#topUndo').onclick = undo; $('#topRedo').onclick = redo;

                $('#dockLaunchers').addEventListener('click', e => {
                    const btn = e.target.closest('[data-dock]');
                    if (!btn) return;

                    const key = btn.dataset.dock;
                    if (key === 'fx') {
                        if (!state.dockOpen || state.activeDock !== 'fx') {
                            openDock('fx');
                            return;
                        }

                        if (state.fxViewer.activeEffect) {
                            state.fxViewer.activeEffect = null;
                            stopPixelFxPlayback();
                            renderDockContent();
                            renderDockLaunchers();
                            return;
                        }

                        closeDock();
                        return;
                    }

                    if (state.dockOpen && state.activeDock === key) {
                        closeDock();
                    } else {
                        openDock(key);
                    }
                });

                $('#projectInput').onchange = openFile;
                $('#imageInput').onchange = importImage;
                $('#brushTextureInput').onchange = importBrushTexture;
                $('#brushPresetInput').onchange = importBrushPreset;
                $('#canvasSwitcherBtn')?.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    openCanvasSwitcher(e.currentTarget);
                });
                $('#statusLine')?.addEventListener('pointerenter', e => openColorWorkflow(e.currentTarget));
                $('#statusLine')?.addEventListener('pointerleave', () => {
                    setTimeout(() => { if (!document.querySelector('#colorWorkflowPop:hover')) document.getElementById('colorWorkflowPop')?.remove(); }, 120);
                });
                $('#mainMenu').addEventListener('click', e => {
                    const item = e.target.closest('[data-action]');
                    if (!item) return;
                    e.preventDefault();
                    runMenuAction(item.dataset.action);
                    closeMenus();
                    item.blur();
                });

                window.addEventListener('keydown', e => {
                    if (els.textEditor?.style.display === 'block') return;
                    if (e.key === 'Enter' && state.lineEdit) { e.preventDefault(); commitLineEdit(); }
                    else if (e.key === 'Enter' && state.floatingSelection) {
                        e.preventDefault();
                        commitFloatingSelection();
                        pushHistory('Move selected pixels');
                        renderAll();
                    }
                    else if (e.key === 'Enter' || (e.ctrlKey && e.key.toLowerCase() === 'd')) { e.preventDefault(); deselect(); }
                    else if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
                    else if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
                    else if (e.ctrlKey && e.key.toLowerCase() === 'c') { e.preventDefault(); copySelection(false); }
                    else if (e.ctrlKey && e.key.toLowerCase() === 'x') { e.preventDefault(); copySelection(true); }
                    else if (e.ctrlKey && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteSelection(); }
                    else if (state.selectionMask && e.key === ']') { e.preventDefault(); growSelection(1); }
                    else if (state.selectionMask && e.key === '[') { e.preventDefault(); growSelection(-1); }
                    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                        const obj = getSelectedObject();
                        if (!obj) return;
                        e.preventDefault();
                        const step = e.shiftKey ? 10 : 1;
                        if (e.key === 'ArrowLeft') moveVectorObject(obj, -step, 0);
                        if (e.key === 'ArrowRight') moveVectorObject(obj, step, 0);
                        if (e.key === 'ArrowUp') moveVectorObject(obj, 0, -step);
                        if (e.key === 'ArrowDown') moveVectorObject(obj, 0, step);
                        renderAll();
                    }
                    else if (!e.ctrlKey && !e.metaKey) {
                        const map = { b: 'brush', p: 'pencil', e: 'eraser', g: 'fill', i: 'eyedropper', l: 'line', r: 'rect', o: 'ellipse', m: 'rectSelect', t: 'text' };
                        if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);
                        if (e.code === 'Space') setTool('pan');
                    }
                });
            }

            function setTool(tool) {
                commitTextEdit();
                if (state.lineEdit && tool !== 'line') commitLineEdit();
                if (state.floatingSelection && tool !== 'movePixels') {
                    commitFloatingSelection();
                    pushHistory('Move selected pixels');
                }
                if (tool !== 'moveSelection') state.selectionOutlineTransform = null;
                state.tool = tool;
                state.showAltTools = null;
                syncActiveToolFamily(tool);
                updateToolButtons();
                renderAltTools();
                showToolOptionsForTool(tool);
            }

            function dismissMobileToolSheet() {
                if (!window.matchMedia(MOBILE_LAYOUT_QUERY).matches) return;
                document.querySelector('.panel.left')?.classList.remove('is-mobile-open');
                if (!document.querySelector('.panel.right.is-mobile-open')) {
                    document.body.classList.remove('mobile-sheet-open');
                }
                document.querySelectorAll('.mobile-panel-nav button').forEach(button => {
                    if (button.dataset.panel === 'tools') button.classList.remove('is-active');
                });
            }

            function renderMobileContextControls() {
                let bar = document.getElementById('mobileContextControls');
                if (!bar) {
                    bar = document.createElement('div');
                    bar.id = 'mobileContextControls';
                    bar.className = 'mobile-context-controls';
                    document.body.appendChild(bar);
                }

                const mobile = window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
                const selectionTool = ['rectSelect', 'ellipseSelect', 'lassoSelect', 'magicWand'].includes(state.tool);
                if (!mobile || !selectionTool) {
                    bar.hidden = true;
                    return;
                }

                const modes = [['replace', 'Replace'], ['add', 'Add'], ['subtract', 'Subtract'], ['intersect', 'Intersect']];
                bar.hidden = false;
                bar.innerHTML = `<span class="mobile-context-label">Selection</span>${modes.map(([mode, label]) => `<button class="tool-btn${state.selectionMode === mode ? ' active' : ''}" data-selection-mode="${mode}">${label}</button>`).join('')}<span class="mobile-context-divider"></span><button class="tool-btn" data-selection-action="shrink" title="Shrink selection"><span class="material-symbols-rounded">remove</span></button><button class="tool-btn" data-selection-action="grow" title="Grow selection"><span class="material-symbols-rounded">add</span></button><button class="tool-btn" data-selection-action="clear" title="Deselect"><span class="material-symbols-rounded">close</span></button>`;
                bar.onclick = event => {
                    const modeButton = event.target.closest('[data-selection-mode]');
                    const actionButton = event.target.closest('[data-selection-action]');
                    if (modeButton) {
                        state.selectionMode = modeButton.dataset.selectionMode;
                        renderAltTools();
                        renderMobileContextControls();
                    }
                    if (actionButton) {
                        const action = actionButton.dataset.selectionAction;
                        if (action === 'grow') growSelection(1);
                        if (action === 'shrink') growSelection(-1);
                        if (action === 'clear') deselect();
                    }
                };
            }

            function showToolOptionsForTool(tool) {
                if (tool === 'line') openDock('line');
                if (tool === 'movePixels' || tool === 'moveSelection') ensureMoveToolSelection(tool);
            }

            function openDock(key) {
                const app = document.querySelector('.app');

                if (window.matchMedia(MOBILE_LAYOUT_QUERY).matches) {
                    openMobileDock(key);
                    return;
                }

                state.dockOpen = true;
                state.activeDock = key;

                renderDockLaunchers();

                requestAnimationFrame(() => {
                    app.classList.remove('dock-closing');
                    app.classList.add('dock-open');
                    app.classList.remove('dock-content-ready');
                    renderDockShell();
                    positionToast();

                    setTimeout(() => {
                        renderDockContent();
                        app.classList.add('dock-content-ready');
                    }, 260);
                });
            }

            function closeDock() {
                const app = document.querySelector('.app');

                closeBrushFloatingMenu();
                closeStrokeReviseMenu();
                closeTextFloatingMenu();
                document.querySelector('.mobile-dock-sheet')?.classList.remove('is-open');
                document.getElementById('floatingPixelAdjust')?.remove();
                stopPixelFxPlayback();
                app.classList.add('dock-closing');
                app.classList.remove('dock-content-ready');

                setTimeout(() => {
                    document.getElementById('dockContent').innerHTML = '';
                    els.framesStrip = null;

                    requestAnimationFrame(() => {
                        app.classList.remove('dock-open');
                        positionToast();

                        setTimeout(() => {
                            state.dockOpen = false;
                            state.activeDock = null;
                            app.classList.remove('dock-closing');
                            renderDockLaunchers();
                            updateControls();
                        }, 520);
                    });
                }, 120);
            }

            function openMobileDock(key) {
                state.dockOpen = true;
                state.activeDock = key;
                let sheet = document.querySelector('.mobile-dock-sheet');
                if (!sheet) {
                    sheet = document.createElement('section');
                    sheet.className = 'mobile-dock-sheet';
                    sheet.innerHTML = '<div class="mobile-dock-sheet-header"><span></span><button class="icon-btn" type="button" aria-label="Close panel"><span class="material-symbols-rounded">close</span></button></div>';
                    document.body.appendChild(sheet);
                    sheet.querySelector('button').onclick = closeDock;
                }
                sheet.querySelector('.mobile-dock-sheet-header span').textContent = dockModules[key]?.name || 'Penta panel';
                sheet.appendChild(document.getElementById('dockContent'));
                renderDockLaunchers();
                renderDockContent();
                sheet.classList.add('is-open');
                positionToast();
            }

            function getPoint(e) {
                const r = els.shell.getBoundingClientRect();
                return { x: clamp((e.clientX - r.left) / state.zoom, 0, state.width), y: clamp((e.clientY - r.top) / state.zoom, 0, state.height) };
            }

            function ensureMoveToolSelection(tool = state.tool) {
                if (tool !== 'movePixels' && tool !== 'moveSelection') return;

                if (!state.selectionMask) {
                    state.selectionMask = makeRectSelectionMask(0, 0, state.width, state.height);
                    syncSelectionFromMask();
                }

                if (tool === 'movePixels') {
                    state.selectionOutlineTransform = null;
                    if (!state.floatingSelection) state.floatingSelection = liftSelectedPixels();
                    if (state.floatingSelection) {
                        state.selectionMask = selectionMaskFromTransform(state.floatingSelection);
                        syncSelectionFromMask();
                    }
                }

                if (tool === 'moveSelection') {
                    if (state.floatingSelection) {
                        commitFloatingSelection();
                        pushHistory('Move selected pixels');
                    }
                    if (!state.selectionOutlineTransform) state.selectionOutlineTransform = makeSelectionOutlineTransform();
                }

                drawSelectedVectorOverlay();
            }

            function makeSelectionOutlineTransform() {
                const b = getSelectionBounds() || { x: 0, y: 0, w: state.width, h: state.height };
                const w = Math.max(1, Math.round(b.w));
                const h = Math.max(1, Math.round(b.h));
                const mask = makeCanvas(w, h);
                mask.getContext('2d').drawImage(state.selectionMask, b.x, b.y, b.w, b.h, 0, 0, w, h);
                return {
                    canvas: mask,
                    x: b.x,
                    y: b.y,
                    w,
                    h,
                    scaleX: 1,
                    scaleY: 1,
                    rotation: 0,
                    pivotX: .5,
                    pivotY: .5
                };
            }

            function selectionMaskFromTransform(f) {
                const mask = createEmptySelectionMask();
                const ctx = mask.getContext('2d', { willReadFrequently: true });
                ctx.imageSmoothingEnabled = false;
                drawFloatingSelection(ctx, {
                    ...f,
                    canvas: f.maskCanvas || f.canvas
                });

                const img = ctx.getImageData(0, 0, state.width, state.height);
                for (let i = 0; i < img.data.length; i += 4) {
                    const on = img.data[i + 3] > 0;
                    img.data[i] = 255;
                    img.data[i + 1] = 255;
                    img.data[i + 2] = 255;
                    img.data[i + 3] = on ? 255 : 0;
                }
                ctx.putImageData(img, 0, 0);
                return mask;
            }

            function updateTransformBox(f, t, p, e = {}) {
                if (!f || !t) return;

                const dx = p.x - t.start.x;
                const dy = p.y - t.start.y;
                const original = t.original;
                const originalW = Math.max(1, original.w ?? f.canvas.width * (original.scaleX || 1));
                const originalH = Math.max(1, original.h ?? f.canvas.height * (original.scaleY || 1));

                if (t.mode === 'move') {
                    f.x = original.x + dx;
                    f.y = original.y + dy;
                    return;
                }

                const cx = original.x + originalW * f.pivotX;
                const cy = original.y + originalH * f.pivotY;

                if (t.mode === 'rotate') {
                    const a0 = Math.atan2(t.start.y - cy, t.start.x - cx);
                    const a1 = Math.atan2(p.y - cy, p.x - cx);
                    f.rotation = original.rotation + a1 - a0;
                    return;
                }

                if (t.mode === 'scale') {
                    const minSize = 2;
                    let x = original.x;
                    let y = original.y;
                    let w = originalW;
                    let h = originalH;

                    if (t.handle.includes('e')) w = Math.max(minSize, originalW + dx);
                    if (t.handle.includes('s')) h = Math.max(minSize, originalH + dy);
                    if (t.handle.includes('w')) {
                        x = original.x + dx;
                        w = Math.max(minSize, originalW - dx);
                    }
                    if (t.handle.includes('n')) {
                        y = original.y + dy;
                        h = Math.max(minSize, originalH - dy);
                    }

                    if (e.shiftKey && originalH > 0) {
                        const ratio = originalW / originalH;
                        if (Math.abs(dx) > Math.abs(dy)) h = w / ratio;
                        else w = h * ratio;
                    }

                    f.x = x;
                    f.y = y;
                    f.w = w;
                    f.h = h;
                    f.scaleX = w / originalW;
                    f.scaleY = h / originalH;
                }
            }

            function updateFloatingSelectionTransform(p, e = {}) {
                const fs = state.floatingSelection;
                if (!fs || !fs.drag) return;

                const drag = fs.drag;
                updateTransformBox(fs, drag, p, e);
                state.selectionMask = selectionMaskFromTransform(fs);
                syncSelectionFromMask();
            }

            function updateSelectionOutlineTransform(p, e = {}) {
                const f = state.selectionOutlineTransform;
                const t = state.selectionTransform;
                updateTransformBox(f, t, p, e);
                if (!f) return;
                state.selectionMask = selectionMaskFromTransform(f);
                syncSelectionFromMask();
            }

            function commitFloatingSelection() {
                const f = state.floatingSelection;
                if (!f) return false;

                if (f.layerId) {
                    const layer = activeFrame().layers.find(l => l.id === f.layerId);
                    if (layer) {
                        layer.canvas = f.canvas;
                        layer.offsetX = f.x;
                        layer.offsetY = f.y;
                        layer.freeSize = true;
                        layer.visible = true;
                        state.selectionMask = selectionMaskFromTransform(f);
                        syncSelectionFromMask();
                        state.floatingSelection = null;
                        state.selectionTransform = null;
                        return true;
                    }
                }

                const ctx = activeLayer().canvas.getContext('2d');
                drawFloatingSelection(ctx, f);

                state.selectionMask = selectionMaskFromTransform(f);
                syncSelectionFromMask();
                state.floatingSelection = null;
                state.selectionTransform = null;
                return true;
            }

            function drawPencilPixel(layer, p) {
                if ((layer.type || 'raster') !== 'raster') {
                    toast('Pencil tool only works on raster layers.');
                    return false;
                }

                drawWithSelectionClip(layer, ctx => {
                    ctx.save();
                    ctx.imageSmoothingEnabled = false;
                    ctx.globalCompositeOperation = state.blend || 'source-over';
                    ctx.globalAlpha = state.opacity;
                    ctx.fillStyle = state.strokeColor || state.primaryColor;

                    const size = Math.max(1, Math.round(state.size || 1));
                    const x = Math.round(p.x);
                    const y = Math.round(p.y);

                    ctx.fillRect(x, y, size, size);
                    ctx.restore();
                });

                return true;
            }

            function drawPencilLine(layer, a, b) {
                if ((layer.type || 'raster') !== 'raster') {
                    toast('Pencil tool only works on raster layers.');
                    return false;
                }

                drawWithSelectionClip(layer, ctx => {
                    ctx.save();
                    ctx.imageSmoothingEnabled = false;
                    ctx.globalCompositeOperation = state.blend || 'source-over';
                    ctx.globalAlpha = state.opacity;
                    drawJaggedLine(
                        ctx,
                        a.x,
                        a.y,
                        b.x,
                        b.y,
                        state.strokeColor || state.primaryColor,
                        Math.max(1, Math.round(state.size || 1))
                    );
                    ctx.restore();
                });

                return true;
            }

            function pointerDown(e) {
                if (e.button !== 0 && e.button !== 2) return;
                e.preventDefault();

                state.strokeColor = e.button === 2 ? state.secondaryColor : state.primaryColor;

                const p = getPoint(e);

                const selectionToolActive = ['select', 'rectSelect', 'ellipseSelect', 'lassoSelect', 'magicWand', 'moveSelection', 'movePixels'].includes(state.tool);
                const lineControl = state.lineEdit && state.tool === 'line' ? hitLineEditControlScreen(e) : null;
                if (lineControl) {
                    state.linePointDrag = {
                        ...lineControl,
                        start: p,
                        points: structuredClone(state.lineEdit.points)
                    };
                    return;
                }

                if (state.lineEdit && state.tool === 'line') {
                    commitLineEdit();
                    return;
                }

                const selectedObject = getSelectedObject?.();
                const transformHandle = selectedObject ? hitTestTransformHandleScreen(e, selectedObject) : null;
                if (transformHandle) {
                    state.transformDrag = {
                        id: selectedObject.id,
                        handle: transformHandle,
                        start: p,
                        original: structuredClone(selectedObject)
                    };
                    return;
                }

                if (e.button === 2 && selectedObject) {
                    state.transformDrag = {
                        id: selectedObject.id,
                        handle: 'rotate',
                        start: p,
                        original: structuredClone(selectedObject)
                    };
                    return;
                }

                const transformToolActive = ['rect', 'ellipse', 'line', 'select'].includes(state.tool);
                if (transformToolActive) {
                    const hit = hitTestVector(p.x, p.y);
                    if (hit) {
                        const obj = e.altKey ? duplicateVectorObject(hit) : hit;
                        state.selectedVectorObject = obj.id;
                        state.transformDrag = {
                            id: obj.id,
                            handle: 'move',
                            start: p,
                            original: structuredClone(obj)
                        };
                        drawSelectedVectorOverlay();
                        return;
                    }
                }
                if (state.tool === 'zoom') { zoomAt(e.button === 2 ? 1 / 1.15 : 1.15, e.clientX, e.clientY); return; }
                if (state.tool === 'pan') { state.panning = true; state.start = { x: e.clientX, y: e.clientY, panX: state.panX, panY: state.panY }; return; }
                if (state.tool === 'strokePick') { pickStrokeAtPoint(p); return; }
                if (state.tool === 'pencil') {
                    if (!drawPencilPixel(activeLayer(), p)) return;
                    bakeLayerRevisionHistory();
                    state.drawing = true;
                    document.body.classList.add('is-drawing');
                    state.start = p;
                    state.last = p;
                    state.smooth = p;
                    return;
                }
                if (state.tool === 'magicWand') {
                    state.selectionDraft = { mode: getSelectionModeFromEvent(e) };
                    combineSelectionMask(makeMagicWandSelectionMask(p.x, p.y), state.selectionDraft.mode);
                    state.selectionOutlineTransform = null;
                    syncSelectionFromMask();
                    drawSelectedVectorOverlay();
                    toast('Magic wand selection created.');
                    return;
                }
                if (state.tool === 'moveSelection') {
                    ensureMoveToolSelection('moveSelection');
                    if (!state.selectionOutlineTransform) return;
                    const f = state.selectionOutlineTransform;
                    state.selectionTransform = {
                        ...hitSelectionOutlineTransformScreen(e, p),
                        start: p,
                        original: structuredClone({
                            x: f.x,
                            y: f.y,
                            w: f.w ?? f.canvas.width * (f.scaleX || 1),
                            h: f.h ?? f.canvas.height * (f.scaleY || 1),
                            scaleX: f.scaleX || 1,
                            scaleY: f.scaleY || 1,
                            rotation: f.rotation || 0
                        })
                    };
                    state.movingSelection = true;
                    state.start = { x: p.x, y: p.y };
                    state.last = p;
                    return;
                }
                if (state.tool === 'movePixels') {
                    ensureMoveToolSelection('movePixels');
                    const fs = state.floatingSelection;
                    if (!fs) return;
                    const handle = hitFloatingSelectionTransformScreen(e, p);
                    fs.drag = {
                        mode: handle?.mode || 'move',
                        handle: handle?.handle || 'move',
                        start: p,
                        original: structuredClone({
                            x: fs.x,
                            y: fs.y,
                            w: fs.w ?? fs.canvas.width * (fs.scaleX || 1),
                            h: fs.h ?? fs.canvas.height * (fs.scaleY || 1),
                            scaleX: fs.scaleX || 1,
                            scaleY: fs.scaleY || 1,
                            rotation: fs.rotation || 0
                        })
                    };
                    state.selectionTransform = fs.drag;
                    state.movingSelection = true;
                    state.start = { x: p.x, y: p.y };
                    state.last = p;
                    renderAll();
                    return;
                }
                if (state.tool === 'fill') { if (!floodFill(Math.floor(p.x), Math.floor(p.y))) return; bakeLayerRevisionHistory(); pushHistory('Fill'); renderAll(); return; }
                if (state.tool === 'eyedropper') { pickColor(p); return; }
                if (state.tool === 'text') {
                    const hit = hitTestTextObject(p.x, p.y);

                    if (hit) {
                        const now = performance.now();
                        const last = state.lastTextClick;
                        const isDouble =
                            last &&
                            last.id === hit.id &&
                            now - last.time < 360;

                        state.lastTextClick = {
                            id: hit.id,
                            time: now
                        };

                        state.selectedVectorObject = hit.id;

                        if (isDouble) {
                            state.transformDrag = null;
                            state.drawing = false;
                            beginTextEdit(p, hit);

                            requestAnimationFrame(() => {
                                els.textEditor.focus();
                                document.execCommand?.('selectAll', false, null);
                            });

                            return;
                        }

                        state.transformDrag = {
                            id: hit.id,
                            handle: 'move',
                            start: p,
                            original: structuredClone(hit)
                        };
                        drawSelectedVectorOverlay();
                        return;
                    }

                    state.lastTextClick = null;

                    if (state.justCommittedText) return;

                    beginTextEdit(p);
                    return;
                }
                if (state.tool === 'select') {
                    const hit = hitTestVector(p.x, p.y);
                    if (hit) {
                        const obj = e.altKey ? duplicateVectorObject(hit) : hit;
                        state.selectedVectorObject = obj.id;
                        state.transformDrag = {
                            id: obj.id,
                            handle: 'move',
                            start: p,
                            original: structuredClone(obj)
                        };
                        drawSelectedVectorOverlay();
                        return;
                    }
                    state.selectedVectorObject = null;
                    drawSelectedVectorOverlay();
                }
                state.drawing = true;
                document.body.classList.add('is-drawing');
                state.start = p; state.last = p; state.smooth = p;
                if (selectionToolActive) {
                    updateSelectionBox();
                    state.selectionDraft = { mode: getSelectionModeFromEvent(e) };
                    if (state.tool === 'lassoSelect') state.selectionPath = [p];
                }

                if (state.tool === 'brush' || state.tool === 'eraser') {
                    if (!ensureRasterTarget()) { state.drawing = false; document.body.classList.remove('is-drawing'); return; }
                    ensureRevisionBase(activeLayer());
                    const ctx = activeLayer().canvas.getContext('2d');
                    state.strokeBase = ctx.getImageData(0, 0, state.width, state.height);
                    state.strokePoints = [];
                    state.strokeDistance = 0;
                    state.strokeStartedAt = performance.now();
                    state.mousePressure = .08;
                    state.lastMoveTime = state.strokeStartedAt;
                    state.strokeTaper = pressureTaperEnabled(e.pointerType);
                    const pressure = resolvePressure(e, p, 0, true);
                    state.strokePoints.push({ x: p.x, y: p.y, pressure, distance: 0, t: 0 });
                    renderSmoothStroke(false);
                }
            }

            function pointerMove(e) {
                if (updateWorkspaceTouch(e)) return;
                if (state.linePointDrag) {
                    updateLinePointDrag(getPoint(e));
                    return;
                }
                if (state.transformDrag) {
                    updateTransformDrag(getPoint(e), e);
                    return;
                }
                if (state.movingSelection) {
                    const p = getPoint(e);
                    if (state.tool === 'moveSelection' && state.selectionOutlineTransform) {
                        updateSelectionOutlineTransform(p, e);
                    }
                    if (state.tool === 'movePixels' && state.floatingSelection) {
                        updateFloatingSelectionTransform(p, e);
                    }
                    state.last = p;
                    drawSelectedVectorOverlay();
                    return;
                }
                if (state.panning) {
                    state.panX = state.start.panX + (e.clientX - state.start.x);
                    state.panY = state.start.panY + (e.clientY - state.start.y);
                    updateControls(); return;
                }
                if (!state.drawing) return;
                // Selection previews must follow every touch sample directly.  The
                // general drawing path can be stabilized, but delaying a marquee
                // makes a second selection appear only when the finger lifts.
                if (['rectSelect', 'ellipseSelect', 'lassoSelect'].includes(state.tool)) {
                    const p = getPoint(e);
                    if (state.tool === 'lassoSelect') state.selectionPath.push(p);
                    state.last = p;
                    state.smooth = p;
                    if (state.tool !== 'lassoSelect') setPreviewSelection(state.start, p);
                    drawPreview(state.start, p);
                    return;
                }
                if (state.tool === 'pencil') {
                    const p = getPoint(e);
                    drawPencilLine(activeLayer(), state.last, p);
                    state.last = p;
                    renderAll();
                    return;
                }
                const pRaw = getPoint(e);
                // A stabilizer must never freeze a stroke.  At 0 it follows the pointer
                // exactly; at 100 it trails smoothly while continuing to accept samples.
                const follow = 1 - state.stabilizer * .82;
                const p = { x: state.smooth.x + (pRaw.x - state.smooth.x) * follow, y: state.smooth.y + (pRaw.y - state.smooth.y) * follow };
                const dist = Math.hypot(p.x - state.last.x, p.y - state.last.y);
                state.smooth = p;
                if (['line', 'rect', 'ellipse', 'select', 'rectSelect', 'ellipseSelect', 'lassoSelect'].includes(state.tool)) {
                    if (state.tool === 'lassoSelect') state.selectionPath.push(p);
                    if (['select', 'rectSelect', 'ellipseSelect'].includes(state.tool)) setPreviewSelection(state.start, p);
                    drawPreview(state.start, p);
                }
                if (state.tool === 'brush' || state.tool === 'eraser') {
                    if (dist >= .2) {
                        state.strokeDistance += dist;
                        const pressure = resolvePressure(e, p, dist, false);
                        state.strokePoints.push({ x: p.x, y: p.y, pressure, distance: state.strokeDistance, t: performance.now() - state.strokeStartedAt });
                        if (state.strokePoints.length > 2200) state.strokePoints.splice(1, state.strokePoints.length - 2200);
                        renderSmoothStroke(false);
                    }
                }
                state.last = p;
                composite(activeFrame(), true);
            }

            function pointerUp(e) {
                if (finishWorkspaceTouch(e)) return;
                document.body.classList.remove('is-drawing');
                if (state.linePointDrag) {
                    state.linePointDrag = null;
                    renderAll();
                    return;
                }
                if (state.transformDrag) {
                    state.transformDrag = null;
                    pushHistory('Transform vector object');
                    renderAll();
                    return;
                }
                if (state.panning) { state.panning = false; return; }
                if (state.movingSelection) {
                    if (state.tool === 'moveSelection') {
                        pushHistory('Move selection');
                    }
                    if (state.tool === 'movePixels' && state.floatingSelection) {
                        state.floatingSelection.drag = null;
                    }
                    state.movingSelection = false;
                    state.selectionTransform = null;
                    renderAll();
                    return;
                }
                if (!state.drawing) return;
                if (state.tool === 'pencil') {
                    state.strokeColor = state.primaryColor;
                    state.drawing = false;
                    pushHistory('Pencil stroke');
                    renderAll();
                    return;
                }
                clearPreview();
                updateSelectionBox();
                const end = getPoint(e);
                let historyLabel = 'Draw';
                let shouldRender = true;
                if (state.tool === 'brush' || state.tool === 'eraser') {
                    const dist = Math.hypot(end.x - state.last.x, end.y - state.last.y);
                    if (dist > .2) {
                        state.strokeDistance += dist;
                        state.strokePoints.push({ x: end.x, y: end.y, pressure: .05, distance: state.strokeDistance, t: performance.now() - state.strokeStartedAt });
                    }
                    renderSmoothStroke(true);
                    recordCurrentStroke();
                    state.strokeBase = null;
                    state.strokePoints = [];
                }
                if (['rect', 'ellipse'].includes(state.tool)) {
                    state.strokeColor = state.primaryColor;
                    state.drawing = false;
                    commitShapeTool(state.tool, state.start, end);
                    return;
                }
                if (state.tool === 'line') {
                    state.strokeColor = state.primaryColor;
                    state.drawing = false;
                    beginLineEdit(state.start, end, e);
                    return;
                }
                if (['select', 'rectSelect', 'ellipseSelect', 'lassoSelect'].includes(state.tool)) {
                    if (state.tool === 'lassoSelect') {
                        const path = state.selectionPath || [];
                        if (path.length > 2) {
                            combineSelectionMask(makeLassoSelectionMask(path), state.selectionDraft?.mode || state.selectionMode || 'replace');
                            state.selectionOutlineTransform = null;
                            syncSelectionFromMask();
                            drawSelectedVectorOverlay();
                            toast(state.selection ? 'Selection created.' : 'Selection cleared.');
                        }
                        state.selectionPath = null;
                    } else {
                        setSelectionFromPoints(state.start, end);
                    }
                    historyLabel = 'Select';
                }
                state.strokeColor = state.primaryColor;
                state.drawing = false;
                if (shouldRender) {
                    pushHistory(historyLabel);
                    renderAll();
                }
            }

            function layerCtx() {
                const ctx = activeLayer().canvas.getContext('2d');
                ctx.globalAlpha = state.opacity;
                ctx.globalCompositeOperation = state.tool === 'eraser' ? 'destination-out' : state.blend;
                applyAliasing(ctx);
                return ctx;
            }

            function renderSmoothStroke(finalPass = false) {
                const layer = activeLayer();
                const ctx = layer.canvas.getContext('2d');
                if (state.strokeBase) ctx.putImageData(state.strokeBase, 0, 0);
                const pts = state.strokePoints || [];
                if (state.selectionMask) {
                    const temp = makeCanvas();
                    const tctx = temp.getContext('2d');
                    if (state.tool === 'eraser') {
                        if (state.strokeBase) tctx.putImageData(state.strokeBase, 0, 0);
                        else tctx.drawImage(layer.canvas, 0, 0);
                        renderStrokePointsToContext(tctx, pts, finalPass, state.strokeTaper);
                        applySelectionClip(tctx);
                        ctx.save();
                        ctx.globalCompositeOperation = 'destination-out';
                        ctx.drawImage(state.selectionMask, 0, 0);
                        ctx.restore();
                        ctx.drawImage(temp, 0, 0);
                        return;
                    }
                    renderStrokePointsToContext(tctx, pts, finalPass, state.strokeTaper);
                    applySelectionClip(tctx);
                    ctx.drawImage(temp, 0, 0);
                    return;
                }
                renderStrokePointsToContext(ctx, pts, finalPass, state.strokeTaper);
            }

            function sampleStroke(points, spacing) {
                if (points.length <= 1) return points.slice();
                const out = [];
                let prev = catmull(points, 0);
                let carry = 0;
                out.push({ ...prev, distance: 0 });
                for (let i = 0; i < points.length - 1; i++) {
                    const steps = Math.max(8, Math.ceil(Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y) / 2));
                    for (let j = 1; j <= steps; j++) {
                        const u = i + j / steps;
                        const cur = catmull(points, u);
                        let seg = Math.hypot(cur.x - prev.x, cur.y - prev.y);
                        while (carry + seg >= spacing) {
                            const ratio = (spacing - carry) / Math.max(seg, .0001);
                            const x = prev.x + (cur.x - prev.x) * ratio;
                            const y = prev.y + (cur.y - prev.y) * ratio;
                            const pressure = prev.pressure + (cur.pressure - prev.pressure) * ratio;
                            const distance = (out[out.length - 1]?.distance || 0) + spacing;
                            out.push({ x, y, pressure, distance });
                            prev = { x, y, pressure };
                            seg = Math.hypot(cur.x - prev.x, cur.y - prev.y);
                            carry = 0;
                            if (seg < .0001) break;
                        }
                        carry += seg;
                        prev = cur;
                    }
                }
                return out;
            }

            function catmull(points, t) {
                const i = Math.floor(t);
                const u = t - i;
                const p0 = points[Math.max(0, i - 1)];
                const p1 = points[Math.max(0, i)];
                const p2 = points[Math.min(points.length - 1, i + 1)];
                const p3 = points[Math.min(points.length - 1, i + 2)];
                const u2 = u * u, u3 = u2 * u;
                const interp = (a, b, c, d) => .5 * ((2 * b) + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
                return {
                    x: interp(p0.x, p1.x, p2.x, p3.x),
                    y: interp(p0.y, p1.y, p2.y, p3.y),
                    pressure: clamp(interp(p0.pressure, p1.pressure, p2.pressure, p3.pressure), .02, 1),
                    distance: p1.distance + (p2.distance - p1.distance) * u
                };
            }

            function stampBrush(ctx, p, radius, pressure, taper) {
                if (!state.antiAlias) {
                    stampPixelBrush(ctx, p, radius);
                    return;
                }

                const b = state.brushLab;
                const seed = hashFloat(p.distance * 99.13 + p.x * 3.71 + p.y * 8.41);

                const scatterAmt = state.size * (b.scatter / 100);
                const angle = seed * Math.PI * 2;
                const sx = Math.cos(angle) * scatterAmt * hashFloat(seed * 17.1);
                const sy = Math.sin(angle) * scatterAmt * hashFloat(seed * 31.7);

                const sizeJ = 1 + ((hashFloat(seed * 12.33) - .5) * 2) * (b.sizeJitter / 100);
                const opacityJ = 1 - hashFloat(seed * 44.2) * (b.opacityJitter / 100);
                const rotation = (hashFloat(seed * 72.7) - .5) * 2 * (b.angleJitter || 0) * Math.PI / 180;

                const x = p.x + sx;
                const y = p.y + sy;
                const r = Math.max(.1, radius * sizeJ);

                ctx.globalAlpha *= opacityJ;

                if (state.tool === 'eraser') {
                    drawSoftStamp(ctx, x, y, r, '#000');
                    return;
                }

                if (b.useTexture && b.texture) {
                    drawTextureStamp(ctx, x, y, r, state.strokeColor, b.texture, rotation);
                } else {
                    drawSoftStamp(ctx, x, y, r, state.strokeColor);
                }

                if (b.dualBrush) {
                    ctx.save();
                    ctx.globalCompositeOperation = b.dualBlend || 'source-over';
                    ctx.globalAlpha *= b.dualOpacity;

                    const ox = r * b.dualOffset;
                    const oy = r * b.dualOffset;

                    if (b.useTexture && b.texture) {
                        drawTextureStamp(ctx, x + ox, y + oy, r * .92, state.secondaryColor, b.texture, -rotation);
                    } else {
                        drawSoftStamp(ctx, x + ox, y + oy, r * .92, state.secondaryColor);
                    }

                    ctx.restore();
                }
            }

            function stampPixelBrush(ctx, p, radius) {
                const r = Math.max(1, Math.round(radius));
                const cx = Math.round(p.x);
                const cy = Math.round(p.y);

                ctx.save();
                ctx.imageSmoothingEnabled = false;
                ctx.fillStyle = state.strokeColor;

                for (let y = -r; y <= r; y++) {
                    for (let x = -r; x <= r; x++) {
                        if (x * x + y * y <= r * r) {
                            ctx.fillRect(cx + x, cy + y, 1, 1);
                        }
                    }
                }

                ctx.restore();
            }

            function drawSoftStamp(ctx, x, y, r, color) {
                const g = ctx.createRadialGradient(x, y, Math.max(.1, r * state.softness * .22), x, y, r);
                g.addColorStop(0, color);
                g.addColorStop(clamp(1 - state.softness, .05, 1), color);
                g.addColorStop(1, hexWithAlpha(color, 0));

                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }

            function drawTextureStamp(ctx, x, y, r, color, textureDataUrl, rotation = 0) {
                if (!drawTextureStamp.cache) drawTextureStamp.cache = new Map();

                let img = drawTextureStamp.cache.get(textureDataUrl);
                if (!img) {
                    img = new Image();
                    img.src = textureDataUrl;
                    drawTextureStamp.cache.set(textureDataUrl, img);
                }

                if (!img.complete) {
                    drawSoftStamp(ctx, x, y, r, color);
                    return;
                }

                const s = r * 2;
                const temp = document.createElement('canvas');
                temp.width = Math.ceil(s);
                temp.height = Math.ceil(s);
                const t = temp.getContext('2d');

                t.save();
                t.translate(temp.width / 2, temp.height / 2);
                t.rotate(rotation);
                t.drawImage(img, -temp.width / 2, -temp.height / 2, temp.width, temp.height);
                t.restore();

                t.globalCompositeOperation = 'source-atop';
                t.fillStyle = color;
                t.fillRect(0, 0, temp.width, temp.height);

                ctx.drawImage(temp, x - r, y - r, s, s);
            }

            function hashFloat(n) {
                const x = Math.sin(n) * 10000;
                return x - Math.floor(x);
            }

            function drawBrushPreview() {
                const canvas = $('#brushPreviewCanvas');
                if (!canvas) return;

                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                ctx.save();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                const oldTool = state.tool;
                const oldStroke = state.strokeColor;
                state.tool = 'brush';
                state.strokeColor = state.primaryColor;

                const points = [];
                for (let i = 0; i < 38; i++) {
                    const t = i / 37;
                    points.push({
                        x: 16 + t * (canvas.width - 32),
                        y: canvas.height / 2 + Math.sin(t * Math.PI * 2) * 14,
                        pressure: applyPressureCurve(Math.sin(t * Math.PI)),
                        distance: t * 260
                    });
                }

                const oldOpacity = state.opacity;
                state.opacity = 1;

                for (const p of points) {
                    const pressure = p.pressure;
                    const radius = clamp((state.size * (.12 + pressure * .88)) / 2, .08, state.size * 1.25);
                    ctx.globalAlpha = clamp(.22 + pressure * .78, .04, 1);
                    stampBrush(ctx, p, radius, pressure, 1);
                }

                state.opacity = oldOpacity;
                state.strokeColor = oldStroke;
                state.tool = oldTool;

                ctx.restore();
            }

            function easeOutCubic(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }

            function drawSmoothRect(ctx, x, y, w, h) {
                applyAliasing(ctx);
                ctx.fillStyle = state.primaryColor;
                ctx.strokeStyle = state.secondaryColor;
                ctx.lineWidth = state.size;
                ctx.beginPath();
                ctx.rect(x, y, w, h);
                ctx.fill();
                ctx.stroke();
            }

            function drawSmoothEllipse(ctx, x, y, w, h) {
                applyAliasing(ctx);
                ctx.fillStyle = state.primaryColor;
                ctx.strokeStyle = state.secondaryColor;
                ctx.lineWidth = state.size;
                ctx.beginPath();
                ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }

            function commitShapeTool(kind, start, end) {
                const layer = activeLayer();
                const x = Math.min(start.x, end.x);
                const y = Math.min(start.y, end.y);
                const w = Math.abs(end.x - start.x);
                const h = Math.abs(end.y - start.y);

                if ((layer.type || 'raster') === 'vector') {
                    const obj = {
                        id: uid(),
                        type: kind,
                        kind,
                        x,
                        y,
                        w,
                        h,
                        rotation: 0,
                        pivotX: x + w / 2,
                        pivotY: y + h / 2,
                        fill: state.primaryColor,
                        stroke: state.secondaryColor,
                        strokeWidth: state.size,
                        lineWidth: state.size,
                        opacity: state.opacity
                    };

                    layer.objects.push(obj);
                    state.selectedVectorObject = obj.id;
                    pushHistory(`Add vector ${kind}`);
                    renderAll();
                    return true;
                }

                if (!ensureRasterTarget()) return false;

                drawWithSelectionClip(layer, ctx => {
                    ctx.globalAlpha = state.opacity;
                    ctx.globalCompositeOperation = state.blend || 'source-over';

                    if (kind === 'rect') {
                        state.antiAlias
                            ? drawSmoothRect(ctx, x, y, w, h)
                            : drawJaggedRect(ctx, x, y, w, h, state.primaryColor, state.secondaryColor, state.size);
                    }

                    if (kind === 'ellipse') {
                        state.antiAlias
                            ? drawSmoothEllipse(ctx, x, y, w, h)
                            : drawJaggedEllipse(ctx, x, y, w, h, state.primaryColor, state.secondaryColor, state.size);
                    }
                });

                bakeLayerRevisionHistory(layer);
                pushHistory(`Draw ${kind}`);
                renderAll();
                return true;
            }

            function beginLineEdit(start, end, e = {}) {
                if (e.shiftKey) end = constrainAngle(start, end, 15);

                if (e.altKey) {
                    const dx = end.x - start.x;
                    const dy = end.y - start.y;
                    end = { x: start.x + dx, y: start.y + dy };
                    start = { x: start.x - dx, y: start.y - dy };
                }

                state.lineEdit = {
                    id: uid(),
                    points: [
                        { x: start.x, y: start.y },
                        { x: start.x + (end.x - start.x) / 3, y: start.y + (end.y - start.y) / 3 },
                        { x: start.x + (end.x - start.x) * 2 / 3, y: start.y + (end.y - start.y) * 2 / 3 },
                        { x: end.x, y: end.y }
                    ],
                    curveType: state.lineCurveType,
                    stroke: state.primaryColor,
                    width: state.size,
                    opacity: state.opacity,
                    startCap: state.lineStartCap,
                    endCap: state.lineEndCap,
                    dash: state.lineDash,
                    antiAlias: state.antiAlias,
                    rotation: 0
                };

                renderAll();
                openDock('line');
            }

            function constrainAngle(start, end, degrees = 15) {
                const dx = end.x - start.x;
                const dy = end.y - start.y;
                const length = Math.hypot(dx, dy);
                const step = degrees * Math.PI / 180;
                const angle = Math.round(Math.atan2(dy, dx) / step) * step;
                return {
                    x: start.x + Math.cos(angle) * length,
                    y: start.y + Math.sin(angle) * length
                };
            }

            function drawLineEditOverlay(ctx) {
                const line = state.lineEdit;
                if (!line) return;

                drawPreviewWithSelectionClip(ctx, previewCtx => {
                    drawLineUnified(previewCtx, line);
                });
            }

            function drawLineCurve(ctx, line) {
                drawLineUnified(ctx, line);
            }

            function drawLineUnified(ctx, line, options = {}) {
                const [p0, p1, p2, p3] = line.points || [];
                if (!p0 || !p1 || !p2 || !p3) return;

                const aa = line.antiAlias ?? state.antiAlias;

                ctx.save();
                ctx.globalAlpha *= options.opacity ?? (line.opacity ?? state.opacity);
                ctx.strokeStyle = line.stroke || state.primaryColor;
                ctx.fillStyle = line.stroke || state.primaryColor;
                ctx.lineWidth = line.width || line.strokeWidth || line.lineWidth || state.size;
                ctx.lineCap = line.startCap === 'round' && line.endCap === 'round' ? 'round' : 'butt';
                ctx.lineJoin = 'round';
                ctx.imageSmoothingEnabled = aa;

                if (aa) drawSmoothLineUnified(ctx, line);
                else drawJaggedLineUnified(ctx, line);

                drawLineEndCaps(ctx, line);
                ctx.restore();
            }

            function drawSmoothLineUnified(ctx, line) {
                const [p0, p1, p2, p3] = line.points || [];
                if (line.dash === 'dash') ctx.setLineDash([16, 8]);
                if (line.dash === 'dot') ctx.setLineDash([2, 8]);
                if (line.dash === 'dashdot') ctx.setLineDash([16, 8, 2, 8]);

                ctx.beginPath();
                ctx.moveTo(p0.x, p0.y);

                if ((line.curveType || 'straight') === 'straight') {
                    ctx.lineTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.lineTo(p3.x, p3.y);
                }

                if (line.curveType === 'bezier') {
                    ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
                }

                if (line.curveType === 'spline') {
                    drawCubicSplinePath(ctx, line.points);
                }

                ctx.stroke();
            }

            function drawJaggedLineUnified(ctx, line) {
                const pts = lineCurveSamplePoints(line);
                const color = line.stroke || state.primaryColor;
                const width = line.width || line.strokeWidth || line.lineWidth || state.size;
                for (let i = 1; i < pts.length; i++) {
                    drawJaggedLine(ctx, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, color, width);
                }
            }

            function lineCurveSamplePoints(line) {
                const pts = line.points || [];
                if (pts.length < 4) return pts.slice();
                const [p0, p1, p2, p3] = pts;
                const type = line.curveType || 'straight';
                if (type === 'straight') return [p0, p1, p2, p3];
                const out = [];
                const steps = 48;
                for (let i = 0; i <= steps; i++) {
                    const t = i / steps;
                    if (type === 'bezier') out.push(cubicBezierPoint(p0, p1, p2, p3, t));
                    else out.push(catmullLinePoint(pts, t * (pts.length - 1)));
                }
                return out;
            }

            function cubicBezierPoint(p0, p1, p2, p3, t) {
                const mt = 1 - t;
                return {
                    x: mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
                    y: mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y
                };
            }

            function catmullLinePoint(points, t) {
                const i = Math.floor(t);
                const u = t - i;
                const p0 = points[Math.max(0, i - 1)];
                const p1 = points[Math.max(0, i)];
                const p2 = points[Math.min(points.length - 1, i + 1)];
                const p3 = points[Math.min(points.length - 1, i + 2)];
                const u2 = u * u;
                const u3 = u2 * u;
                const interp = (a, b, c, d) => .5 * ((2 * b) + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
                return {
                    x: interp(p0.x, p1.x, p2.x, p3.x),
                    y: interp(p0.y, p1.y, p2.y, p3.y)
                };
            }

            function drawCubicSplinePath(ctx, points) {
                if (!points?.length) return;
                for (let i = 0; i < points.length - 1; i++) {
                    const p0 = points[Math.max(0, i - 1)];
                    const p1 = points[i];
                    const p2 = points[i + 1];
                    const p3 = points[Math.min(points.length - 1, i + 2)];
                    ctx.bezierCurveTo(
                        p1.x + (p2.x - p0.x) / 6,
                        p1.y + (p2.y - p0.y) / 6,
                        p2.x - (p3.x - p1.x) / 6,
                        p2.y - (p3.y - p1.y) / 6,
                        p2.x,
                        p2.y
                    );
                }
            }

            function drawLineEndCaps(ctx, line) {
                const pts = line.points || [];
                if (pts.length < 4) return;
                const start = getLineStartPoint(line);
                const end = getLineEndPoint(line);
                const startAngle = getLineStartAngle(line);
                const endAngle = getLineEndAngle(line);

                drawOneLineCap(ctx, line.startCap, start, startAngle + Math.PI, line);
                drawOneLineCap(ctx, line.endCap, end, endAngle, line);
            }

            function getLineStartPoint(line) {
                return line.points[0];
            }

            function getLineEndPoint(line) {
                return line.points[line.points.length - 1];
            }

            function getLineStartAngle(line) {
                const pts = lineCurveSamplePoints(line);
                const a = pts[0];
                const b = pts[1] || a;
                return Math.atan2(b.y - a.y, b.x - a.x);
            }

            function getLineEndAngle(line) {
                const pts = lineCurveSamplePoints(line);
                const a = pts[pts.length - 2] || pts[0];
                const b = pts[pts.length - 1] || a;
                return Math.atan2(b.y - a.y, b.x - a.x);
            }

            function drawOneLineCap(ctx, cap, tip, angle, line) {
                if (cap === 'round' && !(line.startCap === 'round' && line.endCap === 'round')) {
                    const radius = (line.width || state.size) / 2;
                    ctx.save();
                    ctx.fillStyle = line.stroke || state.primaryColor;
                    ctx.beginPath();
                    ctx.arc(tip.x, tip.y, radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                    return;
                }
                if (cap !== 'arrow' && cap !== 'arrow2') return;
                const len = Math.max(12, (line.width || state.size) * 2.2);
                const spread = Math.PI / 7;

                ctx.save();
                ctx.fillStyle = line.stroke || state.primaryColor;
                ctx.beginPath();
                ctx.moveTo(tip.x, tip.y);
                ctx.lineTo(tip.x - Math.cos(angle - spread) * len, tip.y - Math.sin(angle - spread) * len);
                ctx.lineTo(tip.x - Math.cos(angle + spread) * len, tip.y - Math.sin(angle + spread) * len);
                ctx.closePath();
                ctx.fill();

                if (cap === 'arrow2') {
                    const offset = -len * .72;
                    const second = {
                        x: tip.x + Math.cos(angle) * offset,
                        y: tip.y + Math.sin(angle) * offset
                    };
                    ctx.beginPath();
                    ctx.moveTo(second.x, second.y);
                    ctx.lineTo(second.x - Math.cos(angle - spread) * len, second.y - Math.sin(angle - spread) * len);
                    ctx.lineTo(second.x - Math.cos(angle + spread) * len, second.y - Math.sin(angle + spread) * len);
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.restore();
            }

            function hitLineEditControl(p) {
                const line = state.lineEdit;
                if (!line) return null;
                const hit = Math.max(8, 9 / state.zoom);
                for (let i = 0; i < line.points.length; i++) {
                    const point = line.points[i];
                    if (Math.hypot(p.x - point.x, p.y - point.y) <= hit) return { type: 'point', index: i };
                }
                const end = line.points[3];
                const r = handleRadius();
                const x = end.x + r * 2.2;
                const y = end.y - r;
                const s = r * 2;
                if (p.x >= x && p.x <= x + s && p.y >= y && p.y <= y + s) return { type: 'move' };
                return null;
            }

            function lineEditScreenHandles(line) {
                const end = line.points[3];
                return [
                    ...line.points.map((p, i) => ({ ...p, id: 'point-' + i, type: 'point', index: i })),
                    { id: 'move', type: 'move', x: end.x + 28 / state.zoom, y: end.y }
                ];
            }

            function hitScreenHandle(e, handles) {
                const wr = els.workspace.getBoundingClientRect();
                const sx = e.clientX - wr.left;
                const sy = e.clientY - wr.top;

                for (const h of handles) {
                    const p = canvasToScreenPoint(h);
                    if (Math.abs(sx - p.x) <= 8 && Math.abs(sy - p.y) <= 8) return h;
                }

                return null;
            }

            function hitLineEditControlScreen(e) {
                if (!state.lineEdit) return null;
                const hit = hitScreenHandle(e, lineEditScreenHandles(state.lineEdit));
                if (!hit) return null;
                return hit.type === 'point'
                    ? { type: 'point', index: hit.index }
                    : { type: 'move' };
            }

            function updateLinePointDrag(p) {
                const drag = state.linePointDrag;
                const line = state.lineEdit;
                if (!drag || !line) return;
                const dx = p.x - drag.start.x;
                const dy = p.y - drag.start.y;

                if (drag.type === 'move') {
                    line.points = drag.points.map(point => ({ x: point.x + dx, y: point.y + dy }));
                } else {
                    line.points[drag.index] = {
                        x: drag.points[drag.index].x + dx,
                        y: drag.points[drag.index].y + dy
                    };
                }

                renderAll();
            }

            function commitLineEdit() {
                const line = state.lineEdit;
                if (!line) return;

                const layer = activeLayer();
                if ((layer.type || 'raster') === 'vector') {
                    const obj = {
                        ...structuredClone(line),
                        id: uid(),
                        type: 'lineCurve'
                    };
                    const b = lineCurveBounds(obj);
                    obj.pivotX = b.x + b.w / 2;
                    obj.pivotY = b.y + b.h / 2;
                    layer.objects.push(obj);
                    state.selectedVectorObject = obj.id;
                } else {
                    drawWithSelectionClip(layer, ctx => drawLineCurve(ctx, line));
                    bakeLayerRevisionHistory(layer);
                }

                state.lineEdit = null;
                state.linePointDrag = null;
                pushHistory('Commit line / curve');
                renderAll();
            }

            function floodFill(x, y) {
                if (!ensureRasterTarget()) return false;
                const layer = activeLayer();
                const ctx = layer.canvas.getContext('2d');
                const img = ctx.getImageData(0, 0, state.width, state.height);
                const data = img.data;
                const maskData = state.selectionMask?.getContext('2d').getImageData(0, 0, state.width, state.height).data;
                const start = (y * state.width + x) * 4;
                if (maskData && !maskData[start + 3]) return false;
                const target = data.slice(start, start + 4);
                const fill = hexToRgba(state.strokeColor, Math.round(state.opacity * 255));
                if (colorsClose(target, fill, 0)) return;
                const stack = [[x, y]];
                while (stack.length) {
                    const [cx, cy] = stack.pop();
                    if (cx < 0 || cy < 0 || cx >= state.width || cy >= state.height) continue;
                    const i = (cy * state.width + cx) * 4;
                    if (maskData && !maskData[i + 3]) continue;
                    if (!colorsClose(data.slice(i, i + 4), target, 10)) continue;
                    data[i] = fill[0]; data[i + 1] = fill[1]; data[i + 2] = fill[2]; data[i + 3] = fill[3];
                    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
                }
                ctx.putImageData(img, 0, 0);
                return true;
            }

            function pickColor(p) {
                const c = composite(activeFrame(), false);
                const d = c.getContext('2d').getImageData(Math.floor(p.x), Math.floor(p.y), 1, 1).data;
                setPentaColor(rgbToHex(d[0], d[1], d[2]), 'primary', true); toast('Color picked ' + state.primaryColor);
            }

            function hexToRgba(hex, a = 255) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a]; }
            function rgbToHex(r, g, b) { return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''); }
            function hexWithAlpha(hex, alpha) { const [r, g, b] = hexToRgba(hex); return `rgba(${r},${g},${b},${alpha})`; }
            function colorsClose(a, b, t) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) + Math.abs(a[3] - b[3]) <= t; }

            function updateCursor(e) {
                if (state.tool === 'pan') { els.cursor.style.display = 'none'; return; }
                const r = els.shell.getBoundingClientRect();
                const d = state.size * state.zoom;
                els.cursor.style.display = 'block';
                els.cursor.style.width = els.cursor.style.height = d + 'px';
                els.cursor.style.left = (e.clientX - r.left - d / 2) / state.zoom + 'px';
                els.cursor.style.top = (e.clientY - r.top - d / 2) / state.zoom + 'px';
                els.cursor.style.transform = `scale(${1 / state.zoom})`;
            }

            function duplicateLayer() {
                const src = activeLayer();
                const copy = makeLayer(src.name + ' copy', src.type || 'raster');
                copy.opacity = src.opacity; copy.visible = src.visible; copy.blend = src.blend; copy.objects = JSON.parse(JSON.stringify(src.objects || [])); copy.strokeEvents = JSON.parse(JSON.stringify(src.strokeEvents || [])); copy.revisionBase = src.revisionBase || null;
                copy.offsetX = src.offsetX || 0; copy.offsetY = src.offsetY || 0; copy.freeSize = !!src.freeSize;
                copy.canvas = makeCanvas(src.canvas.width, src.canvas.height);
                copy.canvas.getContext('2d').drawImage(src.canvas, 0, 0);
                activeFrame().layers.splice(state.activeLayer + 1, 0, copy);
                state.activeLayer++;
                pushHistory('Duplicate layer'); renderAll();
            }

            function deleteLayer() {
                const layers = activeFrame().layers;
                if (layers.length <= 1) return toast('The canvas needs at least one layer.');
                const removed = layers.splice(state.activeLayer, 1)[0];
                if (removed?.strokeEvents?.length) {
                    const removedIds = new Set(removed.strokeEvents.map(event => event.id));
                    state.selectedStrokeIds = state.selectedStrokeIds.filter(id => !removedIds.has(id));
                }
                state.activeLayer = clamp(state.activeLayer, 0, layers.length - 1);
                pushHistory('Delete layer'); renderAll();
            }

            function clearActiveLayer() {
                const layer = activeLayer();
                if ((layer.type || 'raster') === 'vector') {
                    layer.objects = [];
                    state.selectedVectorObject = null;
                } else {
                    const ctx = layer.canvas?.getContext('2d');
                    if (state.selectionMask) {
                        ctx.save();
                        ctx.globalCompositeOperation = 'destination-out';
                        ctx.drawImage(state.selectionMask, 0, 0);
                        ctx.restore();
                    } else {
                        ctx?.clearRect(0, 0, state.width, state.height);
                    }
                    bakeLayerRevisionHistory(layer);
                }
                pushHistory('Clear layer');
                renderAll();
            }

            function addFrame() {
                const cur = activeFrame();
                const frame = {
                    id: uid(), name: 'Frame ' + (state.frames.length + 1), duration: 1000 / currentFps(), layers: cur.layers.map(l => {
                        const nl = makeLayer(l.name, l.type || 'raster'); nl.opacity = l.opacity; nl.visible = l.visible; nl.blend = l.blend; nl.objects = JSON.parse(JSON.stringify(l.objects || [])); nl.strokeEvents = JSON.parse(JSON.stringify(l.strokeEvents || [])); nl.revisionBase = l.revisionBase || null; nl.canvas.getContext('2d').drawImage(l.canvas, 0, 0); return nl;
                    })
                };
                state.frames.splice(state.activeFrame + 1, 0, frame);
                state.activeFrame++;
                pushHistory('Add frame'); renderAll();
            }

            function deleteFrame() {
                if (state.frames.length <= 1) return toast('The document needs at least one page.');
                state.frames.splice(state.activeFrame, 1);
                state.activeFrame = clamp(state.activeFrame, 0, state.frames.length - 1);
                pushHistory('Delete frame'); renderAll();
            }

            function togglePlay() {
                state.playing = !state.playing;
                const play = $('#play');
                if (play) play.innerHTML = `<span class="material-symbols-rounded">${state.playing ? 'pause' : 'play_arrow'}</span>`;
                clearInterval(state.playTimer);
                if (state.playing) {
                    state.playTimer = setInterval(() => {
                        state.activeFrame = (state.activeFrame + 1) % state.frames.length;
                        renderAll();
                    }, 1000 / currentFps());
                }
            }

            function resizeProject() {
                openPentaWindow({
                    title: 'Resize Image',
                    body: `
            <div class="split">
              <div class="field">
                <label>Width</label>
                <input type="number" id="resizeW" value="${state.width}" min="1">
              </div>
              <div class="field">
                <label>Height</label>
                <input type="number" id="resizeH" value="${state.height}" min="1">
              </div>
            </div>
            <p style="margin:0;color:var(--muted);font-size:12px">
              Resizes the whole project canvas.
            </p>
          `,
                    actions: [
                        { id: 'cancel', label: 'Cancel', onClick: closePentaWindow },
                        {
                            id: 'apply',
                            label: 'Apply',
                            primary: true,
                            icon: 'check',
                            onClick: () => {
                                state.width = clamp(Number($('#resizeW').value) || state.width, 1, 12000);
                                state.height = clamp(Number($('#resizeH').value) || state.height, 1, 12000);
                                for (const frame of state.frames) for (const layer of frame.layers) {
                                    layer.strokeEvents = [];
                                    layer.revisionBase = null;
                                }
                                state.selection = null;
                                state.selectionMask = null;
                                state.selectedStrokeIds = [];
                                sizeAllCanvases();
                                fitStage();
                                renderAll();
                                pushHistory('Resize project');
                                closePentaWindow();
                            }
                        }
                    ]
                });
            }

            function fitStage() {
                const wr = els.workspace.getBoundingClientRect();
                const mobileLayout = window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
                // Phones start with the complete canvas visible and centered.
                // Pinching and panning can then enlarge or reposition it.
                state.zoom = mobileLayout
                    ? Math.min(
                        Math.max(1, wr.width - 16) / state.width,
                        Math.max(1, wr.height - 16) / state.height
                    )
                    : Math.min((wr.width - 60) / state.width, (wr.height - 60) / state.height, 1);
                state.panX = 0; state.panY = 0;
            }

            function touchGeometry() {
                const points = [...workspaceTouches.values()];
                if (!points.length) return null;
                const center = points.reduce(
                    (sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }),
                    { x: 0, y: 0 }
                );
                const distance = points.length > 1
                    ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
                    : null;
                return { center, distance };
            }

            function cancelCanvasInteractionForGesture() {
                document.body.classList.remove('is-drawing');
                if (state.strokeBase && (state.tool === 'brush' || state.tool === 'eraser')) {
                    activeLayer().canvas.getContext('2d').putImageData(state.strokeBase, 0, 0);
                }
                state.strokeBase = null;
                state.strokePoints = [];
                state.drawing = false;
                state.panning = false;
                state.linePointDrag = null;
                state.transformDrag = null;
                clearPreview();
                composite(activeFrame(), true);
            }

            function trackWorkspaceTouch(e) {
                if (e.pointerType !== 'touch') return;
                workspaceTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
                els.workspace.setPointerCapture?.(e.pointerId);
                if (workspaceTouches.size < 2) return;

                e.preventDefault();
                e.stopPropagation();
                cancelCanvasInteractionForGesture();
                const geometry = touchGeometry();
                workspaceGesture = {
                    lastCenter: geometry.center,
                    lastDistance: geometry.distance
                };
            }

            function updateWorkspaceTouch(e) {
                if (e.pointerType !== 'touch' || !workspaceTouches.has(e.pointerId)) return false;
                workspaceTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
                if (!workspaceGesture) return false;

                e.preventDefault();
                const geometry = touchGeometry();
                if (!geometry) return true;
                if (geometry.distance && workspaceGesture.lastDistance) {
                    zoomAt(geometry.distance / workspaceGesture.lastDistance, geometry.center.x, geometry.center.y);
                }
                state.panX += geometry.center.x - workspaceGesture.lastCenter.x;
                state.panY += geometry.center.y - workspaceGesture.lastCenter.y;
                workspaceGesture.lastCenter = geometry.center;
                workspaceGesture.lastDistance = geometry.distance;
                updateControls();
                drawSelectedVectorOverlay();
                return true;
            }

            function finishWorkspaceTouch(e) {
                if (e.pointerType !== 'touch' || !workspaceTouches.has(e.pointerId)) return false;
                const handledGesture = Boolean(workspaceGesture);
                workspaceTouches.delete(e.pointerId);
                if (handledGesture) {
                    e.preventDefault();
                    const geometry = touchGeometry();
                    if (geometry) {
                        workspaceGesture.lastCenter = geometry.center;
                        workspaceGesture.lastDistance = geometry.distance;
                    } else {
                        workspaceGesture = null;
                    }
                }
                return handledGesture;
            }

            function syncMobileViewportSize() {
                const height = window.visualViewport?.height || window.innerHeight;
                document.documentElement.style.setProperty('--penta-viewport-height', `${Math.round(height)}px`);
            }

            function centerCanvasInWorkspace() {
                if (window.matchMedia(MOBILE_LAYOUT_QUERY).matches) {
                    state.panX = 0;
                    state.panY = 0;
                    updateControls();
                    return;
                }
                const workspaceRect = els.workspace.getBoundingClientRect();
                const shellRect = els.shell.getBoundingClientRect();

                const workspaceCenterX = workspaceRect.left + workspaceRect.width / 2;
                const workspaceCenterY = workspaceRect.top + workspaceRect.height / 2;

                const shellCenterX = shellRect.left + shellRect.width / 2;
                const shellCenterY = shellRect.top + shellRect.height / 2;

                state.panX += workspaceCenterX - shellCenterX;
                state.panY += workspaceCenterY - shellCenterY;

                updateControls();
            }

            function zoomAt(mult, clientX = null, clientY = null) {
                const oldZoom = state.zoom;
                const newZoom = clamp(oldZoom * mult, MIN_ZOOM, MAX_ZOOM);
                if (newZoom === oldZoom) return;

                if (clientX == null || clientY == null) {
                    state.zoom = pixelGridActive() ? Math.max(1, Math.round(newZoom)) : newZoom;
                    updateControls();
                    drawSelectedVectorOverlay();
                    return;
                }

                const before = getCanvasPointFromClient(clientX, clientY, oldZoom);

                state.zoom = pixelGridActive() ? Math.max(1, Math.round(newZoom)) : newZoom;
                updateControls();

                const after = getCanvasPointFromClient(clientX, clientY, state.zoom);

                state.panX += (after.x - before.x) * state.zoom;
                state.panY += (after.y - before.y) * state.zoom;

                updateControls();
                drawSelectedVectorOverlay();
            }

            function getCanvasPointFromClient(clientX, clientY, zoom = state.zoom) {
                const r = els.shell.getBoundingClientRect();
                return {
                    x: (clientX - r.left) / zoom,
                    y: (clientY - r.top) / zoom
                };
            }

            function handleWorkspaceWheel(e) {
                e.preventDefault();

                if (e.ctrlKey) {
                    const mult = Math.exp(-e.deltaY * 0.01);
                    zoomAt(mult, e.clientX, e.clientY);
                    return;
                }

                state.panX -= e.deltaX;
                state.panY -= e.deltaY;

                updateControls();
            }

            function snapshot() {
                return JSON.stringify({
                    width: state.width, height: state.height, activeFrame: state.activeFrame, activeLayer: state.activeLayer, selectedStrokeIds: state.selectedStrokeIds,
                    frames: state.frames.map(f => ({ id: f.id, name: f.name, duration: f.duration, layers: f.layers.map(l => ({ id: l.id, name: l.name, type: l.type || 'raster', visible: l.visible, opacity: l.opacity, blend: l.blend, offsetX: l.offsetX || 0, offsetY: l.offsetY || 0, freeSize: !!l.freeSize, objects: l.objects || [], strokeEvents: l.strokeEvents || [], revisionBase: l.revisionBase || null, data: l.canvas.toDataURL('image/png') })) }))
                });
            }
            async function restore(json) {
                const data = typeof json === 'string' ? JSON.parse(json) : json;
                state.width = data.width; state.height = data.height;
                state.frames = [];
                for (const f of data.frames) {
                    const frame = { id: f.id || uid(), name: f.name, duration: f.duration, layers: [] };
                    for (const l of f.layers) {
                        const layer = makeLayer(l.name, l.type || 'raster'); layer.id = l.id || uid(); layer.visible = l.visible; layer.opacity = l.opacity; layer.blend = l.blend || 'source-over'; layer.offsetX = l.offsetX || 0; layer.offsetY = l.offsetY || 0; layer.freeSize = !!l.freeSize; layer.objects = l.objects || []; layer.strokeEvents = l.strokeEvents || []; layer.revisionBase = l.revisionBase || null;
                        await drawDataUrl(layer.canvas, l.data);
                        frame.layers.push(layer);
                    }
                    state.frames.push(frame);
                }
                state.activeFrame = clamp(data.activeFrame || 0, 0, state.frames.length - 1);
                state.activeLayer = clamp(data.activeLayer || 0, 0, activeFrame().layers.length - 1);
                state.selectedStrokeIds = data.selectedStrokeIds || [];
                syncActiveDocumentFromState();
                sizeAllCanvases(); fitStage(); renderAll();
            }
            function pushHistory(label) {
                clearPixelFxPreviewBase();
                state.undoStack.push(snapshot());
                if (state.undoStack.length > state.maxHistory) state.undoStack.shift();
                state.redoStack.length = 0;
                syncActiveDocumentFromState();
            }
            async function undo() { if (state.undoStack.length <= 1) return; clearPixelFxPreviewBase(); state.redoStack.push(state.undoStack.pop()); await restore(state.undoStack[state.undoStack.length - 1]); toast('Undo'); }
            async function redo() { if (!state.redoStack.length) return; clearPixelFxPreviewBase(); const s = state.redoStack.pop(); state.undoStack.push(s); await restore(s); toast('Redo'); }

            async function drawDataUrl(canvas, url) {
                const img = new Image(); img.src = url; await img.decode();
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
                canvas.getContext('2d').drawImage(img, 0, 0);
            }

            function download(name, blob) {
                if (!blob) {
                    toast('Export failed: no file was created.');
                    return;
                }

                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = name;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();

                setTimeout(() => {
                    URL.revokeObjectURL(url);
                    a.remove();
                }, 1500);
            }

            async function importBrushTexture(e) {
                const file = e.target.files[0];
                if (!file) return;

                const dataUrl = await fileToDataURL(file);
                const img = new Image();
                img.src = dataUrl;
                await img.decode();

                state.brushLab.texture = dataUrl;
                state.brushLab.textureName = file.name;
                state.brushLab.useTexture = true;

                closeBrushFloatingMenu();
                renderDockContent();
                toast('Texture brush imported.');
                e.target.value = '';
            }

            function saveCurrentBrushPreset() {
                openPentaWindow({
                    title: 'Save Brush Preset',
                    body: `
            <div class="field">
              <label>Name</label>
              <input type="text" id="brushPresetName" value="Custom Brush">
            </div>
          `,
                    actions: [
                        { id: 'cancel', label: 'Cancel', onClick: closePentaWindow },
                        {
                            id: 'save',
                            label: 'Save',
                            primary: true,
                            icon: 'check',
                            onClick: () => {
                                const name = $('#brushPresetName').value.trim() || 'Custom Brush';
                                const preset = getCurrentBrushPreset(name);
                                state.brushLab.presets.push(preset);
                                closePentaWindow();
                                closeBrushFloatingMenu();
                                renderDockContent();
                                toast('Brush preset saved.');
                            }
                        }
                    ]
                });
            }

            function getCurrentBrushPreset(name = 'Penta Brush') {
                return {
                    app: 'Penta',
                    type: 'pbrush',
                    version: 1,
                    name,
                    size: state.size,
                    opacity: state.opacity,
                    softness: state.softness,
                    stabilizer: state.stabilizer,
                    blend: state.blend,
                    antiAlias: state.antiAlias,
                    brushLab: structuredClone(state.brushLab)
                };
            }

            function applyBrushPreset(preset) {
                if (!preset || preset.type !== 'pbrush') {
                    toast('Invalid brush preset.');
                    return;
                }

                state.size = preset.size ?? state.size;
                state.opacity = preset.opacity ?? state.opacity;
                state.softness = preset.softness ?? state.softness;
                state.stabilizer = preset.stabilizer ?? state.stabilizer;
                state.blend = preset.blend ?? state.blend;
                state.antiAlias = preset.antiAlias ?? state.antiAlias;

                state.brushLab = {
                    ...state.brushLab,
                    ...(preset.brushLab || {})
                };

                updateControls();
                renderDockContent();
                toast('Brush preset loaded.');
            }

            function exportCurrentBrushPreset() {
                const preset = getCurrentBrushPreset('Penta Brush');
                const blob = new Blob([JSON.stringify(preset, null, 2)], {
                    type: 'application/x-penta-brush+json'
                });

                download('penta-brush.pbrush', blob);
            }

            async function importBrushPreset(e) {
                const file = e.target.files[0];
                if (!file) return;

                try {
                    const preset = JSON.parse(await file.text());
                    applyBrushPreset(preset);
                    closeBrushFloatingMenu();
                } catch {
                    toast('Could not import brush preset.');
                }

                e.target.value = '';
            }

            function fileToDataURL(file) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }

            function savePenta() {
                const project = { app: 'Penta', version: PENTA_VERSION, savedAt: new Date().toISOString(), ...JSON.parse(snapshot()) };
                download('artwork.penta', new Blob([JSON.stringify(project)], { type: 'application/x-penta+json' }));
                toast('Saved proprietary .penta project.');
            }

            async function openFile(e) {
                const file = e.target.files[0];
                if (!file) return;

                const name = file.name.toLowerCase();

                try {
                    if (name.endsWith('.penta') || file.type === 'application/json') {
                        await openPenta(e);
                        return;
                    }

                    if (file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(name)) {
                        await openImageFile(file);
                        return;
                    }

                    toast('Unsupported file type.');
                } catch (err) {
                    console.error(err);
                    toast('Could not open file.');
                } finally {
                    e.target.value = '';
                }
            }

            async function openPenta(e) {
                const file = e.target.files[0]; if (!file) return;
                clearPixelFxPreviewBase();
                const text = await file.text();
                await restore(text);
                state.undoStack = [snapshot()]; state.redoStack = [];
                syncActiveDocumentFromState();
                toast('Opened ' + file.name);
                e.target.value = '';
            }

            async function importImage(e) {
                const file = e.target.files[0]; if (!file) return;
                clearPixelFxPreviewBase();
                if (file.type === 'image/gif') { await importGifFrames(file); e.target.value = ''; return; }
                const img = await loadImageFromFile(file);
                const layer = makeLayer(file.name.replace(/\.[^.]+$/, ''));
                layer.canvas = makeCanvas(img.naturalWidth, img.naturalHeight);
                layer.freeSize = true;
                layer.offsetX = Math.round((state.width - img.naturalWidth) / 2);
                layer.offsetY = Math.round((state.height - img.naturalHeight) / 2);
                layer.canvas.getContext('2d').drawImage(img, 0, 0);
                activeFrame().layers.push(layer); state.activeLayer = activeFrame().layers.length - 1;
                pushHistory('Import image'); renderAll(); toast('Imported image as an offset layer.');
                e.target.value = '';
            }

            async function loadImageFromFile(file) {
                const img = new Image();
                img.src = await fileToDataURL(file);
                await img.decode();
                return img;
            }

            async function openImageFile(file) {
                clearPixelFxPreviewBase();
                if (file.type === 'image/gif') {
                    await importGifFrames(file);
                    return;
                }

                const img = await loadImageFromFile(file);
                if (documentLooksEmpty()) resizeCurrentDocumentToImage(img, file.name);
                else openImageAsNewDocument(img, file.name);
            }

            function documentLooksEmpty() {
                if (state.frames.length !== 1) return false;
                if (activeFrame().layers.length !== 1) return false;

                const layer = activeLayer();
                if ((layer.objects || []).length) return false;
                if (layer.offsetX || layer.offsetY || layer.freeSize) return false;

                const data = layer.canvas.getContext('2d').getImageData(0, 0, state.width, state.height).data;
                for (let i = 3; i < data.length; i += 4) {
                    if (data[i] !== 0) return false;
                }

                return true;
            }

            function resizeCurrentDocumentToImage(img, name) {
                state.width = img.naturalWidth;
                state.height = img.naturalHeight;
                state.frames = [makeFrame('Frame 1')];
                state.activeFrame = 0;
                state.activeLayer = 0;

                const layer = activeLayer();
                layer.name = name.replace(/\.[^.]+$/, '');
                layer.canvas.width = state.width;
                layer.canvas.height = state.height;
                layer.canvas.getContext('2d').drawImage(img, 0, 0);

                sizeAllCanvases();
                fitStage();
                pushHistory('Open image');
                renderAll();
                toast('Opened image on the empty canvas.');
            }

            function openImageAsNewDocument(img, name) {
                syncActiveDocumentFromState();
                const doc = makeDocument(name.replace(/\.[^.]+$/, ''), img.naturalWidth, img.naturalHeight);
                state.documents.push(doc);
                state.activeDocument = state.documents.length - 1;
                loadDocumentToState(doc);

                const layer = activeLayer();
                layer.name = doc.name;
                layer.canvas.width = state.width;
                layer.canvas.height = state.height;
                layer.canvas.getContext('2d').drawImage(img, 0, 0);

                sizeAllCanvases();
                fitStage();
                pushHistory('Open image as new canvas');
                renderAll();
                toast('Opened image as a new canvas.');
            }

            function exportRaster(type) {
                const c = document.createElement('canvas'); c.width = state.width; c.height = state.height;
                const ctx = c.getContext('2d');
                if (type === 'jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, state.width, state.height); }
                for (const layer of activeFrame().layers) if (layer.visible) { ctx.globalAlpha = layer.opacity; ctx.globalCompositeOperation = layer.blend || 'source-over'; drawLayerToContext(ctx, layer); }
                c.toBlob(blob => download(`penta-export.${type === 'jpeg' ? 'jpg' : 'png'}`, blob), `image/${type}`, .94);
            }

            async function exportGif() {
                try {
                    warnHugeAnimation('GIF');
                    toast('Building GIF...');

                    const fps = currentFps(30);
                    const delayMs = Math.round(1000 / fps);
                    const delayCs = Math.max(2, Math.round(100 / fps));
                    const canvases = state.frames.map(frame =>
                        renderFrameToCanvas(frame, state.width, state.height)
                    );

                    if (!canvases.length) {
                        toast('GIF export failed: no frames found.');
                        return;
                    }

                    if (window.GIF) {
                        let finished = false;

                        const gif = new GIF({
                            workers: 1,
                            quality: 10,
                            dither: 'FloydSteinberg',
                            width: state.width,
                            height: state.height,
                            workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js'
                        });

                        gif.on('finished', blob => {
                            finished = true;
                            download('penta-animation.gif', blob);
                            toast('Exported GIF.');
                        });

                        gif.on('abort', () => {
                            toast('GIF export was aborted.');
                        });

                        for (const c of canvases) {
                            gif.addFrame(c, { delay: delayMs, copy: true });
                        }

                        gif.render();

                        setTimeout(() => {
                            if (!finished) {
                                try {
                                    const blob = simpleGif(canvases, delayCs);
                                    download('penta-animation-fallback.gif', blob);
                                    toast('gif.js stalled, so Penta used fallback GIF export.');
                                } catch (fallbackErr) {
                                    console.error(fallbackErr);
                                    toast('GIF export failed. Check console for details.');
                                }
                            }
                        }, 8000);

                        return;
                    }

                    const blob = simpleGif(canvases, delayCs);
                    download('penta-animation-fallback.gif', blob);
                    toast('gif.js unavailable; used fallback GIF export.');
                } catch (err) {
                    console.error(err);
                    toast('GIF export failed. Check console for details.');
                }
            }

            async function exportApng() {
                warnHugeAnimation('APNG');
                if (!window.UPNG) return toast('APNG export needs UPNG.js from CDN. Try WebM if offline.');
                const fps = currentFps();
                const canvases = state.frames.map(frame => renderFrameToCanvas(frame, state.width, state.height));
                const buffers = canvases.map(c => c.getContext('2d').getImageData(0, 0, state.width, state.height).data.buffer);
                const delays = canvases.map(() => Math.round(1000 / fps));
                const apng = UPNG.encode(buffers, state.width, state.height, 0, delays);
                download('penta-animation-truecolor.apng', new Blob([apng], { type: 'image/apng' }));
                toast('Exported true-color APNG at full canvas size.');
            }

            async function exportWebm() {
                warnHugeAnimation('WebM');
                if (!window.MediaRecorder) return toast('WebM export needs MediaRecorder support in this browser.');
                const fps = currentFps();
                const c = document.createElement('canvas'); c.width = state.width; c.height = state.height;
                const ctx = c.getContext('2d');
                const stream = c.captureStream(fps);
                const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
                const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12000000 });
                const chunks = [];
                rec.ondataavailable = e => e.data.size && chunks.push(e.data);
                rec.onstop = () => download('penta-animation-truecolor.webm', new Blob(chunks, { type: 'video/webm' }));
                rec.start();
                let i = 0;
                const timer = setInterval(() => {
                    ctx.clearRect(0, 0, state.width, state.height);
                    ctx.drawImage(renderFrameToCanvas(state.frames[i], state.width, state.height), 0, 0);
                    i++;
                    if (i >= state.frames.length) {
                        clearInterval(timer);
                        setTimeout(() => { rec.stop(); toast('Exported true-color WebM at full canvas size.'); }, 140);
                    }
                }, 1000 / fps);
            }


            function ensureRasterTarget() {
                if ((activeLayer().type || 'raster') !== 'raster') {
                    toast('This tool only works on raster layers.');
                    return false;
                }
                return true;
            }

            function pressureTaperEnabled(pointerType) {
                return pointerType === 'pen' || state.mousePressureEnabled;
            }

            function resolvePressure(e, p, dist = 0, isStart = false) {
                if (e && e.pointerType === 'pen') {
                    return e.pressure && e.pressure > 0 ? clamp(e.pressure, .03, 1) : 1;
                }
                if (e && e.pointerType === 'mouse' && state.mousePressureEnabled) {
                    const now = performance.now();
                    const dt = Math.max(4, now - (state.lastMoveTime || now));
                    state.lastMoveTime = now;

                    const age = Math.max(0, now - (state.strokeStartedAt || now));
                    const rampByTime = clamp(age / 130, 0, 1);
                    const rampByDistance = clamp((state.strokeDistance || 0) / Math.max(16, state.size * 1.15), 0, 1);
                    const startRamp = easeOutCubic(Math.max(rampByTime, rampByDistance));

                    const speed = dist / dt;
                    const speedDip = clamp(1 - speed / 5.5, .74, 1);
                    const target = clamp((.12 + startRamp * .88) * speedDip, .05, 1);
                    const smoothing = isStart ? 1 : .18;
                    state.mousePressure += (target - state.mousePressure) * smoothing;
                    return clamp(state.mousePressure, .04, 1);
                }

                return 1;
            }

            function drawLayerToContext(ctx, layer) {
                if ((layer.type || 'raster') === 'vector') drawVectorObjects(ctx, layer.objects || []);
                else ctx.drawImage(layer.canvas, layer.offsetX || 0, layer.offsetY || 0);
            }

            function drawVectorObjects(ctx, objects) {
                for (const o of objects) drawVectorObject(ctx, o);
            }

            function drawVectorObject(ctx, obj) {
                const type = obj.type || obj.kind;
                const aa = obj.antiAlias ?? state.antiAlias;

                if (type === 'text') {
                    if (obj._editing) return;
                    ctx.save();
                    applyObjectTransform(ctx, obj);
                    ctx.imageSmoothingEnabled = aa;
                    drawTextObject(ctx, obj);
                    ctx.restore();
                    return;
                }

                if (type === 'lineCurve') {
                    ctx.save();
                    applyObjectTransform(ctx, obj);
                    drawLineCurve(ctx, obj);
                    ctx.restore();
                    return;
                }

                ctx.save();
                applyObjectTransform(ctx, obj);
                ctx.globalAlpha *= obj.opacity ?? 1;
                ctx.strokeStyle = obj.stroke || state.secondaryColor || state.strokeColor;
                ctx.fillStyle = obj.fill ?? 'transparent';
                ctx.lineWidth = obj.strokeWidth || obj.lineWidth || 4;
                ctx.imageSmoothingEnabled = aa;
                ctx.lineCap = aa ? 'round' : 'butt';
                ctx.lineJoin = aa ? 'round' : 'miter';
                ctx.font = `${obj.italic ? 'italic ' : ''}${obj.bold ? 'bold ' : ''}${obj.size || 42}px ${obj.font || 'Inter, sans-serif'}`;
                ctx.textAlign = obj.align || 'left';

                if (type === 'rect') {
                    const x = aa ? obj.x : snapPixel(obj.x);
                    const y = aa ? obj.y : snapPixel(obj.y);
                    const w = aa ? obj.w : snapPixel(obj.w);
                    const h = aa ? obj.h : snapPixel(obj.h);
                    if (!aa) {
                        drawJaggedRect(ctx, x, y, w, h, obj.fill && obj.fill !== 'transparent' ? obj.fill : null, obj.stroke || state.secondaryColor || state.strokeColor, obj.strokeWidth || obj.lineWidth || 4);
                        ctx.restore();
                        return;
                    }
                    ctx.beginPath();
                    ctx.rect(x, y, w, h);
                    if (obj.fill && obj.fill !== 'transparent') ctx.fill();
                    ctx.stroke();
                }

                if (type === 'ellipse') {
                    const x = aa ? obj.x : snapPixel(obj.x);
                    const y = aa ? obj.y : snapPixel(obj.y);
                    const w = aa ? obj.w : snapPixel(obj.w);
                    const h = aa ? obj.h : snapPixel(obj.h);
                    if (!aa) {
                        drawJaggedEllipse(ctx, x, y, w, h, obj.fill && obj.fill !== 'transparent' ? obj.fill : null, obj.stroke || state.secondaryColor || state.strokeColor, obj.strokeWidth || obj.lineWidth || 4);
                        ctx.restore();
                        return;
                    }
                    ctx.beginPath();
                    ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
                    if (obj.fill && obj.fill !== 'transparent') ctx.fill();
                    ctx.stroke();
                }

                if (type === 'line') {
                    const x1 = aa ? obj.x : snapPixel(obj.x);
                    const y1 = aa ? obj.y : snapPixel(obj.y);
                    const x2 = aa ? obj.x + obj.w : snapPixel(obj.x + obj.w);
                    const y2 = aa ? obj.y + obj.h : snapPixel(obj.y + obj.h);
                    if (!aa) {
                        drawJaggedLine(ctx, x1, y1, x2, y2, obj.stroke || state.secondaryColor || state.strokeColor, obj.strokeWidth || obj.lineWidth || 4);
                        ctx.restore();
                        return;
                    }
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }

                if (type === 'path') {
                    const points = obj.points || [];
                    if (points.length) {
                        if (!aa) {
                            for (let i = 1; i < points.length; i++) {
                                drawJaggedLine(ctx, points[i - 1].x, points[i - 1].y, points[i].x, points[i].y, obj.stroke || state.secondaryColor || state.strokeColor, obj.strokeWidth || obj.lineWidth || 4);
                            }
                            ctx.restore();
                            return;
                        }
                        ctx.beginPath();
                        points.forEach((p, i) => {
                            const x = aa ? p.x : snapPixel(p.x);
                            const y = aa ? p.y : snapPixel(p.y);
                            if (i === 0) ctx.moveTo(x, y);
                            else ctx.lineTo(x, y);
                        });
                        ctx.stroke();
                    }
                }

                ctx.restore();
            }

            function applyObjectTransform(ctx, obj) {
                const rotation = obj.rotation || 0;
                if (!rotation) return;
                const pivot = getObjectPivot(obj);
                ctx.translate(pivot.x, pivot.y);
                ctx.rotate(rotation);
                ctx.translate(-pivot.x, -pivot.y);
            }

            function getObjectPivot(obj) {
                const b = vectorObjectBounds(obj);
                return {
                    x: obj.pivotX ?? b.x + b.w / 2,
                    y: obj.pivotY ?? b.y + b.h / 2
                };
            }

            function drawTextObject(ctx, obj) {
                const size = obj.size || state.textSize;
                const lineHeight = obj.lineHeight || 1.18;

                ctx.save();
                ctx.globalAlpha *= obj.opacity ?? 1;
                ctx.font = `${obj.italic ? 'italic ' : ''}${obj.bold ? '700 ' : ''}${size}px ${obj.font || state.textFont}`;
                ctx.textBaseline = 'alphabetic';
                ctx.textAlign = obj.align || 'left';
                const lines = textObjectLines(ctx, obj.text || '', obj);

                if (obj.shadow) {
                    ctx.shadowColor = obj.shadowColor || '#000000';
                    ctx.shadowBlur = obj.shadowBlur ?? 8;
                    ctx.shadowOffsetX = obj.shadowOffsetX ?? 4;
                    ctx.shadowOffsetY = obj.shadowOffsetY ?? 4;
                }

                if (obj.glow) {
                    ctx.save();
                    ctx.shadowColor = obj.glowColor || state.secondaryColor;
                    ctx.shadowBlur = obj.glowBlur ?? 14;
                    ctx.fillStyle = obj.fill || state.primaryColor;
                    drawTrackedMultilineText(ctx, obj, lines, size, lineHeight, 'fill');
                    ctx.restore();
                }

                ctx.fillStyle = obj.fill || state.primaryColor;
                ctx.strokeStyle = obj.stroke || 'transparent';
                ctx.lineWidth = obj.strokeWidth || 2;
                ctx.lineJoin = 'round';

                if (obj.stroke) drawTrackedMultilineText(ctx, obj, lines, size, lineHeight, 'stroke');
                drawTrackedMultilineText(ctx, obj, lines, size, lineHeight, 'fill');

                if (obj.underline) {
                    drawTextUnderlines(ctx, obj, lines, size, lineHeight);
                }

                ctx.restore();
            }

            function drawTrackedMultilineText(ctx, obj, lines, size, lineHeight, mode) {
                const tracking = obj.tracking || 0;
                const kerning = obj.kerning || 0;
                const spacing = tracking + kerning;

                lines.forEach((line, i) => {
                    let x = obj.x;
                    const y = obj.y + i * size * lineHeight;

                    if ((obj.align || 'left') !== 'left') {
                        const width = measureLineWithTracking(ctx, line, spacing);
                        if (obj.align === 'center') x -= width / 2;
                        if (obj.align === 'right') x -= width;
                    }

                    for (const ch of line) {
                        if (mode === 'stroke') ctx.strokeText(ch, x, y);
                        else ctx.fillText(ch, x, y);
                        x += ctx.measureText(ch).width + spacing;
                    }
                });
            }

            function measureLineWithTracking(ctx, line, spacing = 0) {
                let w = 0;
                for (const ch of line) {
                    w += ctx.measureText(ch).width + spacing;
                }
                return Math.max(0, w - spacing);
            }

            function textObjectLines(ctx, text, obj = {}) {
                const rawLines = String(text || '').split('\n');
                const wrapWidth = Number(obj.wrapWidth || 0);
                if ((obj.textBoxMode || 'point') !== 'box' || wrapWidth <= 0) return rawLines;

                const spacing = (obj.tracking || 0) + (obj.kerning || 0);
                return rawLines.flatMap(line => wrapTextLine(ctx, line, wrapWidth, spacing));
            }

            function wrapTextLine(ctx, line, wrapWidth, spacing = 0) {
                if (!line) return [''];

                const tokens = line.split(/(\s+)/);
                const lines = [];
                let current = '';

                for (const token of tokens) {
                    const next = current + token;
                    if (current && measureLineWithTracking(ctx, next, spacing) > wrapWidth) {
                        lines.push(current.trimEnd());
                        current = token.trimStart();
                    } else {
                        current = next;
                    }
                }

                if (current || !lines.length) lines.push(current.trimEnd());
                return lines;
            }

            function drawTextUnderlines(ctx, obj, lines, size, lineHeight) {
                const spacing = (obj.tracking || 0) + (obj.kerning || 0);

                ctx.save();
                ctx.strokeStyle = obj.fill || state.primaryColor;
                ctx.lineWidth = Math.max(1, size / 18);

                lines.forEach((line, i) => {
                    let x = obj.x;
                    const y = obj.y + i * size * lineHeight;
                    const width = measureLineWithTracking(ctx, line, spacing);

                    if (obj.align === 'center') x -= width / 2;
                    if (obj.align === 'right') x -= width;

                    const underlineY = y + size * .12;
                    ctx.beginPath();
                    ctx.moveTo(x, underlineY);
                    ctx.lineTo(x + width, underlineY);
                    ctx.stroke();
                });

                ctx.restore();
            }

            function getVectorObjectById(id) {
                const layer = activeLayer();
                if ((layer.type || 'raster') !== 'vector') return null;
                return (layer.objects || []).find(obj => obj.id === id) || null;
            }

            function getSelectedObject() {
                return getVectorObjectById(state.selectedVectorObject);
            }

            function duplicateVectorObject(obj) {
                const clone = structuredClone(obj);
                clone.id = uid();
                activeLayer().objects.push(clone);
                return clone;
            }

            function prepareVectorResize(obj) {
                const b = vectorObjectBounds(obj);
                obj.initialWidth = Math.max(1, b.w);
                obj.initialFontSize = obj.size || state.textSize;
                if ((obj.type || obj.kind) === 'text') {
                    obj.w = b.w;
                    obj.h = b.h;
                }
            }

            function snap(v, grid = 10) {
                return Math.round(v / grid) * grid;
            }

            function vectorObjectBounds(obj) {
                const type = obj.type || obj.kind;
                if (type === 'path') return calculateStrokeBounds(obj.points || [], obj.strokeWidth || obj.lineWidth || 1);
                if (type === 'lineCurve') return lineCurveBounds(obj);
                if (type === 'text') {
                    const lines = String(obj.text || '').split('\n');
                    const size = obj.size || 42;
                    const w = obj.w || Math.max(40, ...lines.map(line => line.length * size * .6));
                    const h = obj.h || lines.length * size * (obj.lineHeight || 1.18);
                    return { x: obj.x, y: obj.y - size, w, h };
                }
                const x = Math.min(obj.x, obj.x + (obj.w || 0));
                const y = Math.min(obj.y, obj.y + (obj.h || 0));
                return { x, y, w: Math.abs(obj.w || 0), h: Math.abs(obj.h || 0) };
            }

            function lineCurveBounds(line) {
                const points = line.points || [];
                if (!points.length) return { x: 0, y: 0, w: 0, h: 0 };
                const pad = Math.max(8, (line.width || line.strokeWidth || line.lineWidth || 1) / 2 + 6);
                const xs = points.map(p => p.x);
                const ys = points.map(p => p.y);
                const x = Math.min(...xs) - pad;
                const y = Math.min(...ys) - pad;
                const maxX = Math.max(...xs) + pad;
                const maxY = Math.max(...ys) + pad;
                return { x, y, w: maxX - x, h: maxY - y };
            }

            function hitTestVector(x, y) {
                const layer = activeLayer();
                if ((layer.type || 'raster') !== 'vector') return null;
                const objects = layer.objects || [];
                for (let i = objects.length - 1; i >= 0; i--) {
                    const obj = objects[i];
                    const b = vectorObjectBounds(obj);
                    const pad = Math.max(6, (obj.strokeWidth || obj.lineWidth || 1) / 2);
                    if (x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad) return obj;
                }
                return null;
            }

            function hitTestVectorHandle(x, y) {
                const obj = getVectorObjectById(state.selectedVectorObject);
                const handle = obj ? hitTestTransformHandle(x, y, obj) : null;
                return handle ? { obj, name: handle } : null;
            }

            function getTransformHandles(obj) {
                const b = vectorObjectBounds(obj);
                const cx = b.x + b.w / 2;
                const cy = b.y + b.h / 2;
                const rotate = getRotateHandleForBox({ ...b, rotation: obj.rotation || 0 });

                return [
                    { id: 'nw', x: b.x, y: b.y },
                    { id: 'n', x: cx, y: b.y },
                    { id: 'ne', x: b.x + b.w, y: b.y },
                    { id: 'e', x: b.x + b.w, y: cy },
                    { id: 'se', x: b.x + b.w, y: b.y + b.h },
                    { id: 's', x: cx, y: b.y + b.h },
                    { id: 'sw', x: b.x, y: b.y + b.h },
                    { id: 'w', x: b.x, y: cy },
                    { id: 'rotate', x: rotate.x, y: rotate.y },
                    { id: 'pivot', x: obj.pivotX ?? cx, y: obj.pivotY ?? cy }
                ];
            }

            function hitTestTransformHandle(x, y, obj) {
                const size = Math.max(8, handleRadius());
                const handles = getTransformHandles(obj);
                const hit = handles.find(h => Math.abs(x - h.x) <= size && Math.abs(y - h.y) <= size);
                return hit?.id || null;
            }

            function hitTestTransformHandleScreen(e, obj) {
                const hit = hitScreenHandle(e, getTransformHandles(obj));
                return hit?.id || null;
            }

            function moveVectorObject(obj, dx, dy) {
                if ((obj.type || obj.kind) === 'path') {
                    obj.points = (obj.points || []).map(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
                    return;
                }
                if ((obj.type || obj.kind) === 'lineCurve') {
                    obj.points = (obj.points || []).map(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
                    if (obj.pivotX != null) obj.pivotX += dx;
                    if (obj.pivotY != null) obj.pivotY += dy;
                    return;
                }
                obj.x += dx;
                obj.y += dy;
                if (obj.pivotX != null) obj.pivotX += dx;
                if (obj.pivotY != null) obj.pivotY += dy;
            }

            function offsetVectorObject(obj, dx, dy) {
                moveVectorObject(obj, dx, dy);
            }

            function resizeVectorObject(obj, handle, dx, dy) {
                const type = obj.type || obj.kind;
                if (type === 'path') return moveVectorObject(obj, dx, dy);
                if (type === 'text') {
                    if (handle === 'se' || handle === 'br') {
                        obj.w = Math.max(20, (obj.w || vectorObjectBounds(obj).w) + dx);
                        obj.h = Math.max(8, (obj.h || vectorObjectBounds(obj).h) + dy);
                        const scale = obj.w / Math.max(1, obj.initialWidth || obj.w);
                        obj.size = clamp((obj.initialFontSize || obj.size || state.textSize) * scale, 6, 400);
                        return;
                    }
                    return moveVectorObject(obj, dx, dy);
                }
                if (handle.includes('n')) {
                    obj.y += dy;
                    obj.h -= dy;
                }
                if (handle.includes('s')) obj.h += dy;
                if (handle.includes('w')) {
                    obj.x += dx;
                    obj.w -= dx;
                }
                if (handle.includes('e')) obj.w += dx;
            }

            function updateTransformDrag(p, e) {
                const drag = state.transformDrag;
                if (!drag) return;

                const obj = getSelectedObject();
                if (!obj) return;

                const o = drag.original;
                const dx = p.x - drag.start.x;
                const dy = p.y - drag.start.y;

                if (drag.handle === 'move') {
                    Object.assign(obj, structuredClone(o));
                    moveVectorObject(obj, dx, dy);
                } else if (drag.handle === 'pivot') {
                    const pivot = getObjectPivot(o);
                    obj.pivotX = pivot.x + dx;
                    obj.pivotY = pivot.y + dy;
                } else if (drag.handle === 'rotate') {
                    const pivot = getObjectPivot(obj);
                    const a0 = Math.atan2(drag.start.y - pivot.y, drag.start.x - pivot.x);
                    const a1 = Math.atan2(p.y - pivot.y, p.x - pivot.x);
                    let angle = (o.rotation || 0) + (a1 - a0);
                    if (e.shiftKey) angle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
                    obj.rotation = angle;
                } else {
                    resizeObjectFromHandle(obj, o, drag.handle, dx, dy, e);
                }

                renderAll();
            }

            function resizeObjectFromHandle(obj, original, handle, dx, dy, e) {
                Object.assign(obj, structuredClone(original));
                const b = vectorObjectBounds(original);
                let x1 = b.x;
                let y1 = b.y;
                let x2 = b.x + b.w;
                let y2 = b.y + b.h;

                if (handle.includes('w')) x1 += dx;
                if (handle.includes('e')) x2 += dx;
                if (handle.includes('n')) y1 += dy;
                if (handle.includes('s')) y2 += dy;

                if (e.shiftKey && b.w && b.h) {
                    const aspect = b.w / b.h;
                    const w = Math.max(1, Math.abs(x2 - x1));
                    const h = Math.max(1, Math.abs(y2 - y1));
                    if (w / h > aspect) {
                        const nextW = h * aspect;
                        if (handle.includes('w')) x1 = x2 - nextW;
                        else x2 = x1 + nextW;
                    } else {
                        const nextH = w / aspect;
                        if (handle.includes('n')) y1 = y2 - nextH;
                        else y2 = y1 + nextH;
                    }
                }

                const nb = {
                    x: Math.min(x1, x2),
                    y: Math.min(y1, y2),
                    w: Math.max(1, Math.abs(x2 - x1)),
                    h: Math.max(1, Math.abs(y2 - y1))
                };

                applyResizedBounds(obj, original, b, nb);
            }

            function applyResizedBounds(obj, original, oldBounds, nextBounds) {
                const type = obj.type || obj.kind;
                if (type === 'lineCurve') {
                    const sx = nextBounds.w / Math.max(1, oldBounds.w);
                    const sy = nextBounds.h / Math.max(1, oldBounds.h);
                    obj.points = (original.points || []).map(p => ({
                        ...p,
                        x: nextBounds.x + (p.x - oldBounds.x) * sx,
                        y: nextBounds.y + (p.y - oldBounds.y) * sy
                    }));
                    return;
                }

                if (type === 'path') {
                    const sx = nextBounds.w / Math.max(1, oldBounds.w);
                    const sy = nextBounds.h / Math.max(1, oldBounds.h);
                    obj.points = (original.points || []).map(p => ({
                        ...p,
                        x: nextBounds.x + (p.x - oldBounds.x) * sx,
                        y: nextBounds.y + (p.y - oldBounds.y) * sy
                    }));
                    return;
                }

                if (type === 'text') {
                    obj.x = nextBounds.x;
                    obj.y = nextBounds.y + (original.size || state.textSize);
                    obj.w = nextBounds.w;
                    obj.h = nextBounds.h;
                    const scale = nextBounds.w / Math.max(1, oldBounds.w);
                    obj.size = clamp((original.size || state.textSize) * scale, 6, 400);
                    return;
                }

                obj.x = nextBounds.x;
                obj.y = nextBounds.y;
                obj.w = nextBounds.w;
                obj.h = nextBounds.h;
            }

            function drawSelectedVectorOverlay() {
                const ctx = els.preview.getContext('2d');
                ctx.clearRect(0, 0, state.width, state.height);
                if (state.floatingSelection) {
                    drawFloatingSelection(ctx, state.floatingSelection);
                }
                drawSelectionOverlay(ctx);
                drawLineEditOverlay(ctx);
                redrawUiOverlay();
            }

            function drawFloatingSelection(ctx, f) {
                const scaleX = f.scaleX || 1;
                const scaleY = f.scaleY || 1;
                const w = f.w ?? f.canvas.width * scaleX;
                const h = f.h ?? f.canvas.height * scaleY;
                const drawScaleX = w / Math.max(1, f.canvas.width);
                const drawScaleY = h / Math.max(1, f.canvas.height);

                ctx.save();
                ctx.imageSmoothingEnabled = state.resampling !== 'nearest' && state.antiAlias;
                ctx.translate(f.x + f.pivotX * w, f.y + f.pivotY * h);
                ctx.rotate(f.rotation || 0);
                ctx.scale(drawScaleX, drawScaleY);
                ctx.drawImage(f.canvas, -f.pivotX * f.canvas.width, -f.pivotY * f.canvas.height);
                ctx.restore();
            }

            function floatingSelectionCorners(f) {
                const w = f.w ?? f.canvas.width * (f.scaleX || 1);
                const h = f.h ?? f.canvas.height * (f.scaleY || 1);
                const pivot = { x: f.x + f.pivotX * w, y: f.y + f.pivotY * h };
                const pts = [
                    { id: 'nw', x: f.x, y: f.y },
                    { id: 'ne', x: f.x + w, y: f.y },
                    { id: 'se', x: f.x + w, y: f.y + h },
                    { id: 'sw', x: f.x, y: f.y + h }
                ];
                const a = f.rotation || 0;
                const cos = Math.cos(a);
                const sin = Math.sin(a);
                return pts.map(p => ({
                    ...p,
                    x: pivot.x + (p.x - pivot.x) * cos - (p.y - pivot.y) * sin,
                    y: pivot.y + (p.x - pivot.x) * sin + (p.y - pivot.y) * cos
                }));
            }

            function floatingSelectionHandles(f) {
                const c = floatingSelectionCorners(f);
                const mid = (id, a, b) => ({ id, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
                const top = mid('n', c[0], c[1]);
                const angle = f.rotation || 0;
                const rotateDistance = 34 / state.zoom;
                const rotate = {
                    id: 'rotate',
                    x: top.x + Math.sin(angle) * rotateDistance,
                    y: top.y - Math.cos(angle) * rotateDistance
                };
                return [
                    ...c,
                    mid('n', c[0], c[1]),
                    mid('e', c[1], c[2]),
                    mid('s', c[2], c[3]),
                    mid('w', c[3], c[0]),
                    rotate
                ];
            }

            function rotatePoint(point, pivot, angle) {
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                return {
                    x: pivot.x + (point.x - pivot.x) * cos - (point.y - pivot.y) * sin,
                    y: pivot.y + (point.x - pivot.x) * sin + (point.y - pivot.y) * cos
                };
            }

            function getRotateHandleForBox(box) {
                const cx = box.x + box.w / 2;
                const cy = box.y + box.h / 2;
                const angle = box.rotation || 0;
                const topCenter = rotatePoint({ x: cx, y: box.y }, { x: cx, y: cy }, angle);
                const outward = {
                    x: Math.sin(angle),
                    y: -Math.cos(angle)
                };
                const distance = 34 / state.zoom;

                return {
                    x: topCenter.x + outward.x * distance,
                    y: topCenter.y + outward.y * distance
                };
            }

            function drawFloatingSelectionBox(ctx, f) {
                const corners = floatingSelectionCorners(f);
                const handles = floatingSelectionHandles(f);
                ctx.save();
                ctx.lineWidth = 1 / state.zoom;
                ctx.strokeStyle = '#38d5ff';
                ctx.setLineDash([6 / state.zoom, 4 / state.zoom]);
                ctx.beginPath();
                ctx.moveTo(corners[0].x, corners[0].y);
                for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
                ctx.closePath();
                ctx.stroke();
                ctx.setLineDash([]);
                const r = handleRadius();
                for (const h of handles) {
                    ctx.beginPath();
                    if (h.id === 'rotate') ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
                    else ctx.rect(h.x - r, h.y - r, r * 2, r * 2);
                    ctx.fillStyle = '#101116';
                    ctx.fill();
                    ctx.stroke();
                }
                ctx.restore();
            }

            function hitTransformBox(f, p) {
                if (!f) return null;
                const hit = Math.max(8, 10 / state.zoom);
                for (const h of floatingSelectionHandles(f)) {
                    if (Math.hypot(p.x - h.x, p.y - h.y) <= hit) return { mode: h.id === 'rotate' ? 'rotate' : 'scale', handle: h.id };
                }
                const b = floatingSelectionAxisBounds(f);
                if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return { mode: 'move', handle: 'move' };
                return { mode: 'rotate', handle: 'rotate' };
            }

            function hitFloatingSelectionTransform(p) {
                return hitTransformBox(state.floatingSelection, p);
            }

            function hitSelectionOutlineTransform(p) {
                return hitTransformBox(state.selectionOutlineTransform, p);
            }

            function hitTransformBoxScreen(e, f, p) {
                if (!f) return null;
                const hit = hitScreenHandle(e, floatingSelectionHandles(f));
                if (hit) return { mode: hit.id === 'rotate' ? 'rotate' : 'scale', handle: hit.id };
                return hitTransformBox(f, p);
            }

            function hitFloatingSelectionTransformScreen(e, p) {
                return hitTransformBoxScreen(e, state.floatingSelection, p);
            }

            function hitSelectionOutlineTransformScreen(e, p) {
                return hitTransformBoxScreen(e, state.selectionOutlineTransform, p);
            }

            function floatingSelectionAxisBounds(f) {
                const c = floatingSelectionCorners(f);
                const xs = c.map(p => p.x);
                const ys = c.map(p => p.y);
                const x = Math.min(...xs);
                const y = Math.min(...ys);
                return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
            }

            function drawTransformBox(ctx, obj) {
                const b = vectorObjectBounds(obj);
                const handles = getTransformHandles(obj);
                const r = handleRadius();

                ctx.save();
                ctx.strokeStyle = state.primaryColor;
                ctx.lineWidth = 1 / state.zoom;
                ctx.setLineDash([6 / state.zoom, 4 / state.zoom]);
                ctx.strokeRect(b.x, b.y, b.w, b.h);
                ctx.setLineDash([]);

                for (const h of handles) {
                    ctx.beginPath();

                    if (h.id === 'rotate') {
                        ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
                    } else if (h.id === 'pivot') {
                        ctx.moveTo(h.x - r, h.y);
                        ctx.lineTo(h.x + r, h.y);
                        ctx.moveTo(h.x, h.y - r);
                        ctx.lineTo(h.x, h.y + r);
                    } else {
                        ctx.rect(h.x - r, h.y - r, r * 2, r * 2);
                    }

                    ctx.stroke();
                }
                ctx.restore();
            }

            function drawHandle(ctx, x, y) {
                ctx.fillStyle = '#fff';
                ctx.strokeStyle = '#101116';
                ctx.lineWidth = 1;
                ctx.fillRect(x - 4, y - 4, 8, 8);
                ctx.strokeRect(x - 4, y - 4, 8, 8);
            }

            function rasterizeLayer(layer = activeLayer()) {
                if ((layer.type || 'raster') !== 'vector') return toast('Active layer is already raster.');
                const temp = makeCanvas(state.width, state.height);
                const ctx = temp.getContext('2d');
                for (const obj of layer.objects || []) drawVectorObject(ctx, obj);
                layer.canvas = temp;
                layer.type = 'raster';
                layer.objects = [];
                state.selectedVectorObject = null;
                pushHistory('Rasterize vector layer');
                renderAll();
            }

            function strokeToVector(event, layer = activeLayer()) {
                if ((layer.type || 'raster') !== 'vector') return false;
                const points = simplifyVectorPoints(event.points || [], Math.max(1.5, (event.size || 1) * .12));
                layer.objects.push({
                    id: uid(),
                    type: 'path',
                    kind: 'path',
                    points,
                    fill: 'transparent',
                    stroke: event.color,
                    strokeWidth: event.size,
                    lineWidth: event.size,
                    opacity: event.opacity ?? 1,
                    antiAlias: state.antiAlias
                });
                return true;
            }

            function simplifyVectorPoints(points, tolerance = 2) {
                if (points.length <= 2) return points.map(p => ({ x: p.x, y: p.y }));
                const first = points[0];
                const last = points[points.length - 1];
                let index = -1;
                let maxDist = 0;
                for (let i = 1; i < points.length - 1; i++) {
                    const dist = pointSegmentDistance(points[i], first, last);
                    if (dist > maxDist) {
                        index = i;
                        maxDist = dist;
                    }
                }
                if (maxDist > tolerance) {
                    const left = simplifyVectorPoints(points.slice(0, index + 1), tolerance);
                    const right = simplifyVectorPoints(points.slice(index), tolerance);
                    return left.slice(0, -1).concat(right);
                }
                return [{ x: first.x, y: first.y }, { x: last.x, y: last.y }];
            }

            function convertSelectionToVector() {
                const layer = activeLayer();
                if ((layer.type || 'raster') !== 'vector') return toast('Choose a vector layer before converting strokes.');
                const strokes = getSelectedStrokeEntries();
                if (!strokes.length) return toast('Select recorded strokes before converting to vector paths.');
                let count = 0;
                for (const { event } of strokes) if (strokeToVector(event, layer)) count++;
                if (!count) return;
                pushHistory('Stroke to vector');
                renderAll();
                toast(`Converted ${count} stroke${count === 1 ? '' : 's'} to vector paths.`);
            }

            function renderFrameToCanvas(frame, w = state.width, h = state.height) {
                const c = document.createElement('canvas'); c.width = w; c.height = h;
                const ctx = c.getContext('2d');
                ctx.scale(w / state.width, h / state.height);
                for (const layer of frame.layers) if (layer.visible) { ctx.save(); ctx.globalAlpha = layer.opacity; ctx.globalCompositeOperation = layer.blend || 'source-over'; drawLayerToContext(ctx, layer); ctx.restore(); }
                return c;
            }

            function getSelectionModeFromEvent(e) {
                if (e.ctrlKey && e.buttons === 1) return 'add';
                if (e.altKey && e.buttons === 1) return 'subtract';
                if (e.altKey && (e.buttons & 2)) return 'intersect';
                if (e.ctrlKey && (e.buttons & 2)) return 'xor';
                return state.selectionMode || 'replace';
            }

            function createEmptySelectionMask() {
                const c = document.createElement('canvas');
                c.width = state.width;
                c.height = state.height;
                return c;
            }

            function makeRectSelectionMask(x, y, w, h) {
                const c = createEmptySelectionMask();
                const ctx = c.getContext('2d');
                if (w < 0) { x += w; w = Math.abs(w); }
                if (h < 0) { y += h; h = Math.abs(h); }
                if (state.selectionClip === 'pixelated') {
                    x = Math.round(x);
                    y = Math.round(y);
                    w = Math.round(w);
                    h = Math.round(h);
                }
                ctx.fillStyle = '#fff';
                ctx.fillRect(x, y, w, h);
                return c;
            }

            function makeEllipseSelectionMask(x, y, w, h) {
                const c = createEmptySelectionMask();
                const ctx = c.getContext('2d');
                ctx.imageSmoothingEnabled = state.selectionClip !== 'pixelated';
                if (state.selectionClip === 'pixelated') {
                    drawJaggedEllipse(ctx, x, y, w, h, '#fff', null, 0);
                } else {
                    ctx.fillStyle = '#fff';
                    ctx.beginPath();
                    ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
                    ctx.fill();
                }
                return c;
            }

            function makeLassoSelectionMask(points) {
                const c = createEmptySelectionMask();
                const ctx = c.getContext('2d');
                if (!points?.length) return c;
                ctx.imageSmoothingEnabled = state.selectionClip !== 'pixelated';
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                points.forEach((p, i) => {
                    const x = state.selectionClip === 'pixelated' ? Math.round(p.x) : p.x;
                    const y = state.selectionClip === 'pixelated' ? Math.round(p.y) : p.y;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                });
                ctx.closePath();
                ctx.fill();
                return c;
            }

            function makeMagicWandSelectionMask(x, y, tolerance = 18) {
                const src = renderFrameToCanvas(activeFrame(), state.width, state.height);
                const sctx = src.getContext('2d');
                const img = sctx.getImageData(0, 0, state.width, state.height);
                const data = img.data;
                x = clamp(Math.floor(x), 0, state.width - 1);
                y = clamp(Math.floor(y), 0, state.height - 1);
                const start = (y * state.width + x) * 4;
                const target = data.slice(start, start + 4);
                const mask = createEmptySelectionMask();
                const mctx = mask.getContext('2d');
                const out = mctx.createImageData(state.width, state.height);
                const visited = new Uint8Array(state.width * state.height);
                const stack = [[x, y]];

                while (stack.length) {
                    const [cx, cy] = stack.pop();
                    if (cx < 0 || cy < 0 || cx >= state.width || cy >= state.height) continue;
                    const pi = cy * state.width + cx;
                    if (visited[pi]) continue;
                    visited[pi] = 1;
                    const i = pi * 4;
                    if (!colorsClose(data.slice(i, i + 4), target, tolerance)) continue;
                    out.data[i] = 255;
                    out.data[i + 1] = 255;
                    out.data[i + 2] = 255;
                    out.data[i + 3] = 255;
                    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
                }

                mctx.putImageData(out, 0, 0);
                return mask;
            }

            function combineSelectionMask(newMask, mode = 'replace') {
                if (!state.selectionMask || mode === 'replace') {
                    state.selectionMask = newMask;
                    return;
                }

                const out = createEmptySelectionMask();
                const ctx = out.getContext('2d');
                ctx.drawImage(state.selectionMask, 0, 0);

                if (mode === 'add') ctx.globalCompositeOperation = 'source-over';
                if (mode === 'subtract') ctx.globalCompositeOperation = 'destination-out';
                if (mode === 'intersect') ctx.globalCompositeOperation = 'destination-in';
                if (mode === 'xor') ctx.globalCompositeOperation = 'xor';

                ctx.drawImage(newMask, 0, 0);
                state.selectionMask = out;
            }

            function getSelectionBounds() {
                if (!state.selectionMask) return null;
                const ctx = state.selectionMask.getContext('2d');
                const data = ctx.getImageData(0, 0, state.width, state.height).data;
                let minX = state.width;
                let minY = state.height;
                let maxX = -1;
                let maxY = -1;
                for (let y = 0; y < state.height; y++) {
                    for (let x = 0; x < state.width; x++) {
                        if (data[(y * state.width + x) * 4 + 3] > 0) {
                            minX = Math.min(minX, x);
                            minY = Math.min(minY, y);
                            maxX = Math.max(maxX, x);
                            maxY = Math.max(maxY, y);
                        }
                    }
                }
                if (maxX < minX || maxY < minY) return null;
                return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, inverted: false };
            }

            function syncSelectionFromMask() {
                const bounds = getSelectionBounds();
                state.selection = bounds;
                if (bounds) {
                    state.lastSelection = { ...bounds };
                    state.lastSelectionMask = cloneSelectionMask();
                }
            }

            function cloneSelectionMask(mask = state.selectionMask) {
                if (!mask) return null;
                const next = createEmptySelectionMask();
                next.getContext('2d').drawImage(mask, 0, 0);
                return next;
            }

            function setSelectionMaskFromImageData(imageData) {
                const next = createEmptySelectionMask();
                next.getContext('2d').putImageData(imageData, 0, 0);
                state.selectionMask = next;
                syncSelectionFromMask();
            }

            function applySelectionClip(ctx) {
                if (!state.selectionMask) return false;
                ctx.save();
                ctx.globalCompositeOperation = 'destination-in';
                ctx.drawImage(state.selectionMask, 0, 0);
                ctx.restore();
                return true;
            }

            function drawWithSelectionClip(layer, drawFn) {
                if (!state.selectionMask) {
                    drawFn(layer.canvas.getContext('2d'));
                    return;
                }

                const temp = makeCanvas();
                const tctx = temp.getContext('2d');
                drawFn(tctx);
                applySelectionClip(tctx);
                layer.canvas.getContext('2d').drawImage(temp, 0, 0);
            }

            function drawPreviewWithSelectionClip(ctx, drawFn) {
                ctx.save();

                if (state.selectionMask) {
                    const temp = makeCanvas();
                    const tctx = temp.getContext('2d');
                    drawFn(tctx);
                    applySelectionClip(tctx);
                    ctx.drawImage(temp, 0, 0);
                } else {
                    drawFn(ctx);
                }

                ctx.restore();
            }

            function applySelectionMask(ctx, drawFn) {
                if (!state.selectionMask) {
                    drawFn(ctx);
                    return;
                }

                const temp = makeCanvas(ctx.canvas.width, ctx.canvas.height);
                const tctx = temp.getContext('2d');
                drawFn(tctx);
                applySelectionClip(tctx);
                ctx.drawImage(temp, 0, 0);
            }

            function drawSelectionOverlay(ctx) {
                if (!state.selectionMask) return;

                const mctx = state.selectionMask.getContext('2d', { willReadFrequently: true });
                const { data } = mctx.getImageData(0, 0, state.width, state.height);
                const phase = Math.floor(performance.now() / 110) % 8;
                const size = Math.max(.75, 1 / state.zoom);

                ctx.save();
                ctx.imageSmoothingEnabled = false;

                for (let y = 0; y < state.height; y++) {
                    for (let x = 0; x < state.width; x++) {
                        const i = (y * state.width + x) * 4;
                        if (!data[i + 3]) continue;

                        const top = y === 0 || !data[((y - 1) * state.width + x) * 4 + 3];
                        const bottom = y === state.height - 1 || !data[((y + 1) * state.width + x) * 4 + 3];
                        const left = x === 0 || !data[(y * state.width + x - 1) * 4 + 3];
                        const right = x === state.width - 1 || !data[(y * state.width + x + 1) * 4 + 3];

                        if (!top && !bottom && !left && !right) continue;

                        ctx.fillStyle = ((x + y + phase) % 8) < 4 ? '#ffffff' : '#000000';
                        ctx.fillRect(x, y, size, size);
                    }
                }

                ctx.restore();
            }

            function moveSelectionMask(dx, dy) {
                if (!state.selectionMask) return;
                const next = createEmptySelectionMask();
                const ctx = next.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(state.selectionMask, Math.round(dx), Math.round(dy));
                state.selectionMask = next;
                syncSelectionFromMask();
            }

            function getSelectionCenter() {
                const b = getSelectionBounds();
                if (!b) return { x: state.width / 2, y: state.height / 2 };
                return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
            }

            function liftSelectedPixels() {
                if (!state.selectionMask || !ensureRasterTarget()) return null;

                const b = getSelectionBounds();
                if (!b) return null;
                const w = Math.max(1, Math.round(b.w));
                const h = Math.max(1, Math.round(b.h));
                const layer = activeLayer();
                const src = layer.canvas;
                const masked = makeCanvas();
                const mctx = masked.getContext('2d');
                mctx.drawImage(src, 0, 0);
                mctx.globalCompositeOperation = 'destination-in';
                mctx.drawImage(state.selectionMask, 0, 0);

                const floating = makeCanvas(w, h);
                const fctx = floating.getContext('2d');
                fctx.drawImage(masked, b.x, b.y, b.w, b.h, 0, 0, w, h);

                const floatingMask = makeCanvas(w, h);
                floatingMask.getContext('2d').drawImage(state.selectionMask, b.x, b.y, b.w, b.h, 0, 0, w, h);

                const ctx = src.getContext('2d');
                ctx.save();
                ctx.globalCompositeOperation = 'destination-out';
                ctx.drawImage(state.selectionMask, 0, 0);
                ctx.restore();

                return {
                    canvas: floating,
                    maskCanvas: floatingMask,
                    x: b.x,
                    y: b.y,
                    w,
                    h,
                    scaleX: 1,
                    scaleY: 1,
                    rotation: 0,
                    pivotX: .5,
                    pivotY: .5,
                    drag: null
                };
            }

            function setSelectionFromPoints(a, b) {
                const x = a.x;
                const y = a.y;
                const w = b.x - a.x;
                const h = b.y - a.y;
                if (Math.abs(w) <= 2 || Math.abs(h) <= 2) {
                    if (state.selectionMode === 'replace') {
                        state.selection = null;
                        state.selectionMask = null;
                        drawSelectedVectorOverlay();
                    }
                    toast('Selection cleared.');
                    return;
                }

                const mask = state.tool === 'ellipseSelect'
                    ? makeEllipseSelectionMask(x, y, w, h)
                    : makeRectSelectionMask(x, y, w, h);
                combineSelectionMask(mask, state.selectionDraft?.mode || state.selectionMode || 'replace');
                state.selectionOutlineTransform = null;
                syncSelectionFromMask();
                drawSelectedVectorOverlay();
                toast(state.selection ? 'Selection created.' : 'Selection cleared.');
            }

            function updateSelectionBox() {
                if (!els.selectionBox) return;
                els.selectionBox.style.display = 'none';
                els.selectionBox.classList.remove('is-ellipse');
            }

            function clearPreview() {
                els.preview.getContext('2d').clearRect(0, 0, state.width, state.height);
            }

            function drawPreview(a, b) {
                clearPreview();

                const ctx = els.preview.getContext('2d');
                // Keep an existing selection visible while a second selection is
                // being drafted (Add/Subtract/Intersect). Previously clearPreview
                // erased it until pointer-up.
                drawSelectionOverlay(ctx);
                ctx.save();
                ctx.strokeStyle = state.strokeColor;
                ctx.lineWidth = Math.max(1, state.size);
                ctx.globalAlpha = state.opacity;

                const previewShape = state.tool;
                if (previewShape === 'line') {
                    const line = {
                        points: [
                            { x: a.x, y: a.y },
                            { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 },
                            { x: a.x + (b.x - a.x) * 2 / 3, y: a.y + (b.y - a.y) * 2 / 3 },
                            { x: b.x, y: b.y }
                        ],
                        curveType: state.lineCurveType,
                        stroke: state.strokeColor || state.primaryColor,
                        width: state.size,
                        opacity: state.opacity,
                        startCap: state.lineStartCap,
                        endCap: state.lineEndCap,
                        dash: state.lineDash,
                        antiAlias: state.antiAlias
                    };
                    drawPreviewWithSelectionClip(ctx, previewCtx => drawLineUnified(previewCtx, line));
                    ctx.restore();
                    return;
                }

                if (['line', 'rect', 'ellipse'].includes(previewShape) && !state.antiAlias) {
                    if (previewShape === 'rect') drawJaggedRect(ctx, a.x, a.y, b.x - a.x, b.y - a.y, null, state.strokeColor, state.size);
                    if (previewShape === 'ellipse') drawJaggedEllipse(ctx, a.x, a.y, b.x - a.x, b.y - a.y, null, state.strokeColor, state.size);
                    ctx.restore();
                    return;
                }

                if (['rectSelect', 'select', 'ellipseSelect'].includes(state.tool)) {
                    ctx.strokeStyle = '#ffffff';
                    ctx.fillStyle = 'rgba(56,213,255,.22)';
                    ctx.lineWidth = Math.max(1, 1 / state.zoom);
                    ctx.setLineDash([6, 4]);
                    if (state.tool === 'ellipseSelect') {
                        const x = a.x;
                        const y = a.y;
                        const w = b.x - a.x;
                        const h = b.y - a.y;
                        ctx.beginPath();
                        ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                    } else {
                        const x = Math.min(a.x, b.x);
                        const y = Math.min(a.y, b.y);
                        const w = Math.abs(b.x - a.x);
                        const h = Math.abs(b.y - a.y);
                        ctx.fillRect(x, y, w, h);
                        ctx.strokeRect(x, y, w, h);
                    }
                    ctx.restore();
                    return;
                }

                if (state.tool === 'lassoSelect') {
                    const points = state.selectionPath || [];
                    if (points.length > 1) {
                        ctx.strokeStyle = '#ffffff';
                        ctx.fillStyle = 'rgba(56,213,255,.18)';
                        ctx.lineWidth = Math.max(1, 1 / state.zoom);
                        ctx.setLineDash([6, 4]);
                        ctx.beginPath();
                        ctx.moveTo(points[0].x, points[0].y);
                        points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
                        ctx.stroke();
                    }
                    ctx.restore();
                    return;
                }

                if (state.tool === 'lassoSelect' && state.selectionPath?.length) {
                    ctx.strokeStyle = '#ffffff';
                    ctx.fillStyle = 'rgba(56,213,255,.16)';
                    ctx.lineWidth = Math.max(1, 1 / state.zoom);
                    ctx.setLineDash([6, 4]);
                    ctx.beginPath();
                    state.selectionPath.forEach((p, i) => {
                        if (i === 0) ctx.moveTo(p.x, p.y);
                        else ctx.lineTo(p.x, p.y);
                    });
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                    ctx.restore();
                    return;
                }

                applyAliasing(ctx);

                ctx.beginPath();

                if (state.tool === 'line') {
                    const x1 = state.antiAlias ? a.x : snapPixel(a.x);
                    const y1 = state.antiAlias ? a.y : snapPixel(a.y);
                    const x2 = state.antiAlias ? b.x : snapPixel(b.x);
                    const y2 = state.antiAlias ? b.y : snapPixel(b.y);
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                }

                if (state.tool === 'rect') {
                    const x = state.antiAlias ? a.x : snapPixel(a.x);
                    const y = state.antiAlias ? a.y : snapPixel(a.y);
                    const w = state.antiAlias ? b.x - a.x : snapPixel(b.x - a.x);
                    const h = state.antiAlias ? b.y - a.y : snapPixel(b.y - a.y);
                    ctx.rect(x, y, w, h);
                }

                if (state.tool === 'ellipse') {
                    const x = state.antiAlias ? a.x : snapPixel(a.x);
                    const y = state.antiAlias ? a.y : snapPixel(a.y);
                    const w = state.antiAlias ? b.x - a.x : snapPixel(b.x - a.x);
                    const h = state.antiAlias ? b.y - a.y : snapPixel(b.y - a.y);
                    ctx.ellipse(
                        x + w / 2,
                        y + h / 2,
                        Math.abs(w / 2),
                        Math.abs(h / 2),
                        0,
                        0,
                        Math.PI * 2
                    );
                }

                ctx.stroke();
                ctx.restore();

                if (state.tool === 'select') {
                    setPreviewSelection(a, b);
                }
            }

            function setPreviewSelection(a, b) {
                if (!els.selectionBox) return;
                const x = Math.min(a.x, b.x);
                const y = Math.min(a.y, b.y);
                const w = Math.abs(b.x - a.x);
                const h = Math.abs(b.y - a.y);

                els.selectionBox.classList.toggle('is-ellipse', state.tool === 'ellipseSelect');
                Object.assign(els.selectionBox.style, {
                    display: w > 2 && h > 2 ? 'block' : 'none',
                    left: x + 'px',
                    top: y + 'px',
                    width: w + 'px',
                    height: h + 'px'
                });
            }

            function addVectorObject(a, b, kind = 'rect') {
                let layer = activeLayer();
                if ((layer.type || 'raster') !== 'vector') {
                    layer = makeLayer('Vector ' + (activeFrame().layers.length + 1), 'vector');
                    activeFrame().layers.push(layer);
                    state.activeLayer = activeFrame().layers.length - 1;
                }
                const obj = {
                    id: uid(),
                    type: kind,
                    kind,
                    x: a.x,
                    y: a.y,
                    w: b.x - a.x,
                    h: b.y - a.y,
                    stroke: state.strokeColor || state.primaryColor,
                    fill: 'transparent',
                    opacity: state.opacity,
                    lineWidth: state.size,
                    strokeWidth: state.size,
                    antiAlias: state.antiAlias
                };
                layer.objects.push(obj);
                state.selectedVectorObject = obj.id;

                pushHistory('Add vector object');
                renderAll();
            }

            function hitTestTextObject(x, y) {
                for (let li = activeFrame().layers.length - 1; li >= 0; li--) {
                    const layer = activeFrame().layers[li];
                    if ((layer.type || 'raster') !== 'vector' || !layer.visible) continue;

                    for (let oi = layer.objects.length - 1; oi >= 0; oi--) {
                        const obj = layer.objects[oi];
                        if ((obj.type || obj.kind) !== 'text') continue;

                        const b = vectorObjectBounds(obj);

                        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
                            state.activeLayer = li;
                            return obj;
                        }
                    }
                }

                return null;
            }

            function autoResizeTextEditor() {
                const ed = els.textEditor;
                if (!ed || ed.style.display !== 'block') return;
                ed.style.height = 'auto';
                ed.style.height = ed.scrollHeight + 'px';
            }

            function getTextEditorPlainText() {
                const ed = els.textEditor;

                let html = ed.innerHTML
                    .replace(/<div><br><\/div>/gi, '\n')
                    .replace(/<div>/gi, '\n')
                    .replace(/<\/div>/gi, '')
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/&nbsp;/gi, ' ');

                const temp = document.createElement('textarea');
                temp.innerHTML = html;

                return temp.value.replace(/\n{3,}/g, '\n\n').trim();
            }

            function measureTextObject(text, size, font = state.textFont, obj = {}) {
                const c = document.createElement('canvas');
                const ctx = c.getContext('2d');
                ctx.font = `${obj.italic ? 'italic ' : ''}${obj.bold ? '700 ' : ''}${size}px ${font}`;

                const spacing = (obj.tracking || 0) + (obj.kerning || 0);
                const lines = textObjectLines(ctx, text, obj);
                return {
                    w: Math.max(40, (obj.textBoxMode || 'point') === 'box' ? Number(obj.wrapWidth || 0) : 0, ...lines.map(line => measureLineWithTracking(ctx, line, spacing))),
                    h: Math.max(size * 1.25, lines.length * size * (obj.lineHeight || 1.18))
                };
            }

            function cancelTextEdit() {
                const ed = els.textEditor;
                const edit = state.textEdit;

                if (edit?.existing) {
                    delete edit.existing._editing;
                }

                state.textEdit = null;
                ed.style.display = 'none';
                renderAll();
            }

            function commitTextEdit() {
                const ed = els.textEditor;
                if (!ed || ed.style.display !== 'block') return;

                const text = getTextEditorPlainText();
                ed.style.display = 'none';
                state.justCommittedText = true;
                setTimeout(() => state.justCommittedText = false, 0);

                const edit = state.textEdit;
                if (edit?.existing) {
                    delete edit.existing._editing;
                }

                state.textEdit = null;
                if (!text || !edit) {
                    if (edit?.existing) renderAll();
                    return;
                }

                if (edit.existing) {
                    const m = measureTextObject(text, edit.size, edit.font, edit.existing);
                    edit.existing.text = text;
                    edit.existing.w = m.w;
                    edit.existing.h = m.h;
                    edit.existing.fill = edit.color;
                    edit.existing.size = edit.size;
                    edit.existing.font = edit.font;
                    edit.existing.lineHeight = edit.existing.lineHeight || 1.18;
                    edit.existing.opacity = edit.opacity;
                    pushHistory('Edit text object');
                    renderAll();
                    return;
                }

                let layer = activeLayer();
                if ((layer.type || 'raster') !== 'vector') {
                    layer = makeLayer('Text/Vector ' + (activeFrame().layers.length + 1), 'vector');
                    activeFrame().layers.push(layer);
                    state.activeLayer = activeFrame().layers.length - 1;
                }

                const defaults = state.textDefaults;
                const obj = {
                    id: uid(),
                    type: 'text',
                    kind: 'text',
                    x: edit.x,
                    y: edit.y + edit.size,
                    text,
                    w: 40,
                    h: edit.size * 1.25,
                    fill: defaults.fill || state.primaryColor,
                    stroke: defaults.stroke || '',
                    strokeWidth: defaults.strokeWidth ?? 2,
                    opacity: defaults.opacity ?? 1,
                    size: edit.size,
                    font: defaults.font || state.textFont,
                    lineHeight: defaults.lineHeight ?? 1.18,
                    tracking: defaults.tracking ?? 0,
                    kerning: defaults.kerning ?? 0,
                    textBoxMode: defaults.textBoxMode || 'point',
                    wrapWidth: defaults.wrapWidth ?? 320,
                    bold: defaults.bold ?? false,
                    italic: defaults.italic ?? false,
                    underline: defaults.underline ?? false,
                    align: defaults.align || 'left',
                    shadow: defaults.shadow ?? false,
                    shadowColor: defaults.shadowColor || '#000000',
                    shadowBlur: defaults.shadowBlur ?? 8,
                    shadowOffsetX: defaults.shadowOffsetX ?? 4,
                    shadowOffsetY: defaults.shadowOffsetY ?? 4,
                    glow: defaults.glow ?? false,
                    glowColor: defaults.glowColor || state.secondaryColor,
                    glowBlur: defaults.glowBlur ?? 14,
                    antiAlias: state.antiAlias
                };
                const m = measureTextObject(text, obj.size, obj.font, obj);
                obj.w = m.w;
                obj.h = m.h;

                layer.objects.push(obj);
                state.selectedVectorObject = obj.id;
                pushHistory('Text object');
                renderAll();
            }

            function beginTextEdit(p, existing = null) {
                commitTextEdit();
                const ed = els.textEditor;

                if (existing) {
                    existing._editing = true;
                    renderAll();
                }

                const x = existing ? existing.x : p.x;
                const y = existing ? existing.y - (existing.size || state.textSize) : p.y;
                const size = existing?.size || state.textDefaults.size || state.textSize;
                const color = existing?.fill || state.textDefaults.fill || state.primaryColor;
                const font = existing?.font || state.textDefaults.font || state.textFont;
                const opacity = existing?.opacity ?? state.textDefaults.opacity ?? state.opacity;
                const editWidth = existing?.w ? Math.ceil(existing.w + 24) + 'px' : '';
                const editMinHeight = existing?.h ? Math.ceil(existing.h + 18) + 'px' : '48px';

                ed.textContent = existing ? existing.text : 'Text';
                Object.assign(ed.style, {
                    display: 'block',
                    left: x + 'px',
                    top: y + 'px',
                    fontSize: size + 'px',
                    fontFamily: font,
                    fontWeight: (existing?.bold || (!existing && state.textDefaults.bold)) ? '700' : '400',
                    fontStyle: (existing?.italic || (!existing && state.textDefaults.italic)) ? 'italic' : 'normal',
                    textDecoration: (existing?.underline || (!existing && state.textDefaults.underline)) ? 'underline' : 'none',
                    letterSpacing: ((existing?.tracking ?? state.textDefaults.tracking ?? 0) + (existing?.kerning ?? state.textDefaults.kerning ?? 0)) + 'px',
                    lineHeight: existing?.lineHeight || state.textDefaults.lineHeight || 1.18,
                    color,
                    width: editWidth,
                    minHeight: editMinHeight,
                    height: 'auto'
                });
                state.textEdit = { existing, x, y, size, color, font, opacity };
                drawSelectedVectorOverlay();
                ed.focus();
                document.execCommand?.('selectAll', false, null);
                autoResizeTextEditor();
            }


            function copySelection(cut = false) {
                if (!state.selectionMask) return toast('No active selection to copy.');
                if (!ensureRasterTarget()) return;
                const s = getSelectionBounds();
                if (!s) return toast('No active selection to copy.');
                const src = activeLayer().canvas;
                const clip = document.createElement('canvas'); clip.width = Math.round(s.w); clip.height = Math.round(s.h);
                const clipCtx = clip.getContext('2d');
                const masked = makeCanvas();
                const mctx = masked.getContext('2d');
                drawLayerToContext(mctx, activeLayer());
                applySelectionClip(mctx);
                clipCtx.drawImage(masked, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
                state.clipboard = { canvas: clip, w: clip.width, h: clip.height };
                if (cut) {
                    const cutCtx = activeLayer().canvas.getContext('2d');
                    cutCtx.save();
                    cutCtx.globalCompositeOperation = 'destination-out';
                    cutCtx.drawImage(state.selectionMask, 0, 0);
                    cutCtx.restore();
                    pushHistory('Cut selection'); renderAll();
                    toast('Selection cut to Penta clipboard.');
                } else {
                    toast('Selection copied to Penta clipboard.');
                }
            }

            function pasteSelection() {
                if (!state.clipboard) return toast('Penta clipboard is empty.');

                const tooBig =
                    state.clipboard.w > state.width ||
                    state.clipboard.h > state.height;

                if (tooBig) {
                    openPentaWindow({
                        title: 'Clipboard Larger Than Canvas',
                        body: `
              <p style="margin:0;color:var(--muted);line-height:1.5">
                The clipboard is ${state.clipboard.w}x${state.clipboard.h}, but this canvas is ${state.width}x${state.height}.
                You can still paste it. Parts outside the canvas will not export unless moved into view or the canvas is expanded.
              </p>
            `,
                        actions: [
                            { id: 'cancel', label: 'Cancel', onClick: closePentaWindow },
                            {
                                id: 'paste',
                                label: 'Paste Anyway',
                                primary: true,
                                icon: 'content_paste',
                                onClick: () => {
                                    closePentaWindow();
                                    pasteClipboardAsFloatingLayer();
                                }
                            }
                        ]
                    });
                    return;
                }

                pasteClipboardAsFloatingLayer();
            }

            function pasteClipboardAsFloatingLayer() {
                const layer = makeLayer('Pasted Selection', 'raster');
                const s = getSelectionBounds();
                const x = s ? s.x + 12 : 32;
                const y = s ? s.y + 12 : 32;

                layer.canvas = makeCanvas(state.clipboard.w, state.clipboard.h);
                layer.freeSize = true;
                layer.offsetX = x;
                layer.offsetY = y;
                layer.visible = false;
                layer.canvas.getContext('2d').drawImage(state.clipboard.canvas, 0, 0);

                activeFrame().layers.push(layer);
                state.activeLayer = activeFrame().layers.length - 1;
                state.floatingSelection = {
                    canvas: layer.canvas,
                    x,
                    y,
                    w: state.clipboard.w,
                    h: state.clipboard.h,
                    scaleX: 1,
                    scaleY: 1,
                    rotation: 0,
                    pivotX: .5,
                    pivotY: .5,
                    layerId: layer.id
                };

                pushHistory('Paste into new layer');
                renderAll();
                toast('Pasted selection onto a floating layer.');
            }

            function warnHugeAnimation(type) {
                const pixels = state.width * state.height * Math.max(1, state.frames.length);
                if (pixels > 80_000_000) toast(`${type} full-size export may be very slow or memory-heavy on this canvas.`);
            }

            async function importGifFrames(file) {
                const buf = await file.arrayBuffer();
                const api = window.gifuct || window.GIFuct;
                if (!api || !api.parseGIF) {
                    toast('GIF frame splitting needs gifuct-js from CDN. Browser fallback imports first frame only.');
                    const url = URL.createObjectURL(file); const img = new Image(); img.src = url; await img.decode();
                    const layer = makeLayer(file.name.replace(/\.gif$/i, ''), 'raster'); layer.canvas.getContext('2d').drawImage(img, 0, 0); activeFrame().layers.push(layer); URL.revokeObjectURL(url); renderAll(); return;
                }
                const gif = api.parseGIF(buf);
                const frames = api.decompressFrames(gif, true);
                if (!frames.length) return toast('No GIF frames found.');
                state.width = frames[0].dims.width; state.height = frames[0].dims.height; state.frames = [];
                let previous = null;
                frames.forEach((fr, i) => {
                    const frame = { id: uid(), name: 'GIF Frame ' + (i + 1), duration: (fr.delay || 10) * 10, layers: [makeLayer('Frame image', 'raster')] };
                    const c = frame.layers[0].canvas; c.width = state.width; c.height = state.height;
                    const ctx = c.getContext('2d');
                    if (previous) ctx.drawImage(previous, 0, 0);
                    const img = ctx.createImageData(fr.dims.width, fr.dims.height);
                    img.data.set(fr.patch);
                    ctx.putImageData(img, fr.dims.left, fr.dims.top);
                    previous = document.createElement('canvas'); previous.width = state.width; previous.height = state.height; previous.getContext('2d').drawImage(c, 0, 0);
                    state.frames.push(frame);
                });
                state.activeFrame = 0; state.activeLayer = 0; sizeAllCanvases(); fitStage(); pushHistory('Import GIF frames'); renderAll();
                toast(`Imported GIF as ${frames.length} animation frames.`);
            }

            function simpleGif(canvases, delayCs) {
                const w = canvases[0].width, h = canvases[0].height;
                const bytes = [];
                const put = (...n) => bytes.push(...n);
                const str = s => [...s].forEach(ch => put(ch.charCodeAt(0)));
                const word = n => put(n & 255, (n >> 8) & 255);
                str('GIF89a'); word(w); word(h); put(0xF7, 0, 0);
                for (let r = 0; r < 8; r++) for (let g = 0; g < 8; g++) for (let b = 0; b < 4; b++) put(r * 36, g * 36, b * 85);
                str('NETSCAPE2.0');
                bytes.splice(13 + 768, 0, 0x21, 0xFF, 0x0B);
                const out = []; const oput = (...n) => out.push(...n); const ostr = s => [...s].forEach(ch => oput(ch.charCodeAt(0))); const oword = n => oput(n & 255, (n >> 8) & 255);
                ostr('GIF89a'); oword(w); oword(h); oput(0xF7, 0, 0);
                for (let r = 0; r < 8; r++) for (let g = 0; g < 8; g++) for (let b = 0; b < 4; b++) oput(r * 36, g * 36, b * 85);
                oput(0x21, 0xFF, 0x0B); ostr('NETSCAPE2.0'); oput(3, 1, 0, 0, 0);
                for (const canvas of canvases) {
                    oput(0x21, 0xF9, 4, 0x04); oword(delayCs); oput(0, 0);
                    oput(0x2C); oword(0); oword(0); oword(w); oword(h); oput(0);
                    const data = canvas.getContext('2d').getImageData(0, 0, w, h).data;
                    const idx = new Uint8Array(w * h);
                    for (let i = 0, j = 0; i < data.length; i += 4, j++) idx[j] = ((data[i] >> 5) << 5) | ((data[i + 1] >> 5) << 2) | (data[i + 2] >> 6);
                    const lzw = lzwEncode(idx, 8);
                    oput(8);
                    for (let i = 0; i < lzw.length; i += 255) { const sub = lzw.slice(i, i + 255); oput(sub.length, ...sub); }
                    oput(0);
                }
                oput(0x3B);
                return new Blob([new Uint8Array(out)], { type: 'image/gif' });
            }

            function lzwEncode(indices, minCodeSize) {
                const clear = 1 << minCodeSize, end = clear + 1;
                let codeSize = minCodeSize + 1;
                const bits = [];
                const write = code => { for (let i = 0; i < codeSize; i++) bits.push((code >> i) & 1); };
                write(clear);
                for (const v of indices) write(v);
                write(end);
                const out = [];
                for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b |= (bits[i + j] || 0) << j; out.push(b); }
                return out;
            }

            function togglePixelGrid() {
                state.pixelGrid = !state.pixelGrid;
                updateControls();
                drawSelectedVectorOverlay();
                toast(`Pixel grid: ${state.pixelGrid ? 'On' : 'Off'}`);
            }

            function togglePixelView() {
                state.antiAlias = !state.antiAlias;
                if (!state.antiAlias) state.resampling = 'nearest';
                updateControls();
                drawSelectedVectorOverlay();
                toast(`Antialiasing: ${state.antiAlias ? 'ON (smooth)' : 'OFF (jagged)'}`);
            }

            function runMenuAction(action) {
                const actions = { new: newProject, open: () => $('#projectInput').click(), save: savePenta, saveAs, print: printProject, undo, redo, cut: () => copySelection(true), copy: () => copySelection(false), copyMerged, paste: pasteSelection, pasteNewLayer: pasteSelection, selectAll, deselect, reselect, inverseSelection, growSelection: () => growSelection(1), shrinkSelection: () => growSelection(-1), allLayers, deselectLayers, findLayers, incrementLayer, decrementLayer, zoomIn: () => zoomAt(state.zoom >= 8 ? 1.5 : 1.15), zoomOut: () => zoomAt(state.zoom >= 8 ? 1 / 1.5 : .85), zoomWindow: () => { fitStage(); updateControls(); drawSelectedVectorOverlay(); toast('Zoomed to window.'); }, zoomSelection, togglePixelGrid, togglePixelView, cropSelection, resizeImage: resizeProject, canvasSize, imageFlipH: () => transformImage('flipH'), imageFlipV: () => transformImage('flipV'), imageRotate90CW: () => transformImage('rot90cw'), imageRotate90CCW: () => transformImage('rot90ccw'), imageRotate180: () => transformImage('rot180'), flatten, addLayer: () => { activeFrame().layers.push(makeLayer('Raster ' + (activeFrame().layers.length + 1), 'raster')); state.activeLayer = activeFrame().layers.length - 1; pushHistory('Add raster layer'); renderAll(); }, deleteLayer, duplicateLayer, mergeDown, toggleLayerVisibility, clearLayer: clearActiveLayer, importLayer: () => $('#imageInput').click(), layerFlipH: () => transformLayer('flipH'), layerFlipV: () => transformLayer('flipV'), layerRotate180: () => transformLayer('rot180'), layerRotateZoom, rasterizeLayer, strokesToVector: convertSelectionToVector, blackWhite: () => adjustActiveLayer('blackWhite'), brightnessContrast: () => adjustActiveLayer('brightnessContrast'), exposure: () => adjustActiveLayer('exposure'), highlightsShadows: () => adjustActiveLayer('highlightsShadows'), hueSaturation: () => adjustActiveLayer('hueSaturation'), invertAlpha: () => adjustActiveLayer('invertAlpha'), invertColors: () => adjustActiveLayer('invertColors'), help: showHelp, settings: showSettings };
                const fn = actions[action]; if (fn) fn(); else toast('Menu action not implemented yet: ' + action);
            }
            function saveAs() {
                openPentaWindow({
                    title: 'Save As',
                    body: `
            <p style="margin:0;color:var(--muted);font-size:13px">
              Choose an export format.
            </p>
            <div class="penta-choice-grid">
              <button class="btn" data-save-format="penta">Penta</button>
              <button class="btn" data-save-format="png">PNG</button>
              <button class="btn" data-save-format="jpeg">JPEG</button>
              <button class="btn" data-save-format="gif">GIF</button>
              <button class="btn" data-save-format="apng">APNG</button>
              <button class="btn" data-save-format="webm">WebM</button>
            </div>
          `,
                    actions: [
                        { id: 'cancel', label: 'Cancel', onClick: closePentaWindow }
                    ]
                });

                document.querySelectorAll('[data-save-format]').forEach(btn => {
                    btn.onclick = () => {
                        const choice = btn.dataset.saveFormat;
                        closePentaWindow();

                        if (choice === 'penta') return savePenta();
                        if (choice === 'png') return exportRaster('png');
                        if (choice === 'jpeg') return exportRaster('jpeg');
                        if (choice === 'gif') return exportGif();
                        if (choice === 'apng') return exportApng();
                        if (choice === 'webm') return exportWebm();
                    };
                });
            }
            function printProject() { const c = renderFrameToCanvas(activeFrame(), state.width, state.height); const url = c.toDataURL('image/png'); const win = window.open('', '_blank'); if (!win) return toast('Popup blocked. Allow popups to print.'); win.document.write(`<title>Penta Print</title><body style="margin:0;background:#fff;display:grid;place-items:center;min-height:100vh"><img src="${url}" style="max-width:100%;height:auto"></body>`); win.document.close(); win.onload = () => win.print(); }
            function selectAll() { state.selectionMask = makeRectSelectionMask(0, 0, state.width, state.height); state.selectionOutlineTransform = null; syncSelectionFromMask(); drawSelectedVectorOverlay(); toast('Selected entire canvas.'); }
            function deselect() {
                if (state.floatingSelection) {
                    commitFloatingSelection();
                    pushHistory('Move selected pixels');
                }
                if (state.selectionMask) state.lastSelectionMask = cloneSelectionMask();
                if (state.selection) state.lastSelection = { ...state.selection };
                state.selection = null;
                state.selectionMask = null;
                state.selectionDraft = null;
                state.floatingSelection = null;
                state.selectionOutlineTransform = null;
                state.selectionTransform = null;
                drawSelectedVectorOverlay();
                toast('Selection cleared.');
            }
            function reselect() {
                if (!state.lastSelectionMask && !state.lastSelection) return toast('No previous selection to restore.');
                state.selectionMask = state.lastSelectionMask
                    ? cloneSelectionMask(state.lastSelectionMask)
                    : makeRectSelectionMask(state.lastSelection.x, state.lastSelection.y, state.lastSelection.w, state.lastSelection.h);
                state.selectionOutlineTransform = null;
                syncSelectionFromMask();
                drawSelectedVectorOverlay();
                toast('Previous selection restored.');
            }
            function inverseSelection() {
                if (!state.selectionMask) return toast('Create a selection before using Inverse.');
                const next = createEmptySelectionMask();
                const ctx = next.getContext('2d');
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, state.width, state.height);
                ctx.globalCompositeOperation = 'destination-out';
                ctx.drawImage(state.selectionMask, 0, 0);
                state.selectionMask = next;
                state.selectionOutlineTransform = null;
                syncSelectionFromMask();
                drawSelectedVectorOverlay();
                toast('Selection inverted.');
            }
            function growSelection(amount) {
                if (!state.selectionMask) return toast('No selection to adjust.');

                const radius = Math.abs(amount);
                if (!radius) return;

                const src = state.selectionMask.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, state.width, state.height);
                const dst = new ImageData(state.width, state.height);
                const grow = amount > 0;

                for (let y = 0; y < state.height; y++) {
                    for (let x = 0; x < state.width; x++) {
                        let selected = grow ? false : true;

                        for (let yy = y - radius; yy <= y + radius; yy++) {
                            for (let xx = x - radius; xx <= x + radius; xx++) {
                                if (xx < 0 || yy < 0 || xx >= state.width || yy >= state.height) {
                                    if (!grow) selected = false;
                                    continue;
                                }

                                const on = src.data[(yy * state.width + xx) * 4 + 3] > 0;
                                if (grow && on) selected = true;
                                if (!grow && !on) selected = false;
                            }
                        }

                        if (selected) {
                            const i = (y * state.width + x) * 4;
                            dst.data[i] = 255;
                            dst.data[i + 1] = 255;
                            dst.data[i + 2] = 255;
                            dst.data[i + 3] = 255;
                        }
                    }
                }

                setSelectionMaskFromImageData(dst);
                state.selectionOutlineTransform = null;
                drawSelectedVectorOverlay();
            }
            function allLayers() { state.selectedLayerIds = activeFrame().layers.map(l => l.id); toast('All layers selected for layer-navigation commands.'); }
            function deselectLayers() { state.selectedLayerIds = []; toast('Layer selection cleared. Active layer remains highlighted.'); }
            function findLayers() {
                openPentaWindow({
                    title: 'Find Layers',
                    body: `
            <div class="field">
              <label>Name or type</label>
              <input type="text" id="findLayerTerm" value="">
            </div>
          `,
                    actions: [
                        { id: 'cancel', label: 'Cancel', onClick: closePentaWindow },
                        {
                            id: 'find',
                            label: 'Find',
                            primary: true,
                            icon: 'search',
                            onClick: () => {
                                const term = $('#findLayerTerm').value.trim().toLowerCase();
                                if (!term) return;
                                const idx = activeFrame().layers.findIndex(l => (l.name + ' ' + (l.type || 'raster')).toLowerCase().includes(term));
                                if (idx < 0) return toast('No matching layer found.');
                                state.activeLayer = idx;
                                closePentaWindow();
                                renderAll();
                                toast('Found layer: ' + activeLayer().name);
                            }
                        }
                    ]
                });
            }
            function incrementLayer() { state.activeLayer = clamp(state.activeLayer + 1, 0, activeFrame().layers.length - 1); renderAll(); toast('Active layer: ' + activeLayer().name); }
            function decrementLayer() { state.activeLayer = clamp(state.activeLayer - 1, 0, activeFrame().layers.length - 1); renderAll(); toast('Active layer: ' + activeLayer().name); }
            function zoomSelection() {
                const s = getSelectionBounds();
                if (!s) return toast('No selection to zoom to.');
                const wr = els.workspace.getBoundingClientRect();
                state.zoom = clamp(Math.min((wr.width - 80) / s.w, (wr.height - 80) / s.h), MIN_ZOOM, MAX_ZOOM);
                state.panX = ((state.width / 2) - (s.x + s.w / 2)) * state.zoom;
                state.panY = ((state.height / 2) - (s.y + s.h / 2)) * state.zoom;
                updateControls();
                drawSelectedVectorOverlay();
                toast('Zoomed to selection.');
            }
            function copyMerged() {
                const src = renderFrameToCanvas(activeFrame(), state.width, state.height);
                const s = getSelectionBounds() || { x: 0, y: 0, w: state.width, h: state.height };
                const clip = document.createElement('canvas');
                clip.width = Math.round(s.w);
                clip.height = Math.round(s.h);
                const ctx = clip.getContext('2d');

                if (state.selectionMask) {
                    const masked = makeCanvas();
                    const mctx = masked.getContext('2d');
                    mctx.drawImage(src, 0, 0);
                    applySelectionClip(mctx);
                    ctx.drawImage(masked, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
                } else {
                    ctx.drawImage(src, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
                }

                state.clipboard = { canvas: clip, w: clip.width, h: clip.height };
                toast('Copied merged visible artwork to Penta clipboard.');
            }
            function cropSelection() {
                const s = getSelectionBounds();
                if (!s) return toast('No selection to crop to.');
                for (const frame of state.frames) for (const layer of frame.layers) {
                    const old = layer.canvas;
                    const next = makeCanvas(Math.round(s.w), Math.round(s.h));
                    next.getContext('2d').drawImage(old, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
                    layer.canvas = next;
                    layer.strokeEvents = [];
                    layer.revisionBase = null;
                    for (const o of layer.objects || []) offsetVectorObject(o, -s.x, -s.y);
                }
                state.width = Math.round(s.w);
                state.height = Math.round(s.h);
                state.selection = null;
                state.selectionMask = null;
                state.floatingSelection = null;
                state.selectionTransform = null;
                state.selectedStrokeIds = [];
                sizeAllCanvases();
                fitStage();
                pushHistory('Crop to selection');
                renderAll();
                toast('Canvas cropped to the selection bounds. Stroke revision history was baked into the cropped pixels.');
            }
            function canvasSize() {
                openPentaWindow({
                    title: 'Canvas Size',
                    body: `
            <div class="split">
              <div class="field">
                <label>Width</label>
                <input type="number" id="canvasSizeW" value="${state.width}" min="1">
              </div>
              <div class="field">
                <label>Height</label>
                <input type="number" id="canvasSizeH" value="${state.height}" min="1">
              </div>
            </div>
            <div class="field">
              <label>Anchor</label>
              <select id="canvasSizeAnchor">
                <option value="center">Center</option>
                <option value="topleft">Top Left</option>
              </select>
            </div>
          `,
                    actions: [
                        { id: 'cancel', label: 'Cancel', onClick: closePentaWindow },
                        {
                            id: 'apply',
                            label: 'Apply',
                            primary: true,
                            icon: 'check',
                            onClick: () => {
                                const nw = clamp(Number($('#canvasSizeW').value) || state.width, 1, 12000);
                                const nh = clamp(Number($('#canvasSizeH').value) || state.height, 1, 12000);
                                const anchor = $('#canvasSizeAnchor').value;
                                const dx = anchor === 'center' ? Math.round((nw - state.width) / 2) : 0;
                                const dy = anchor === 'center' ? Math.round((nh - state.height) / 2) : 0;
                                for (const frame of state.frames) for (const layer of frame.layers) {
                                    const old = layer.canvas;
                                    const next = makeCanvas(nw, nh);
                                    next.getContext('2d').drawImage(old, dx, dy);
                                    layer.canvas = next;
                                    layer.strokeEvents = [];
                                    layer.revisionBase = null;
                                    for (const o of layer.objects || []) offsetVectorObject(o, dx, dy);
                                }
                                state.width = nw;
                                state.height = nh;
                                state.selection = null;
                                state.selectionMask = null;
                                state.selectedStrokeIds = [];
                                sizeAllCanvases();
                                fitStage();
                                pushHistory('Canvas size');
                                renderAll();
                                closePentaWindow();
                                toast('Canvas size changed. Stroke revision history was baked into the resized canvas.');
                            }
                        }
                    ]
                });
            }
            function transformImage(kind) { const oldW = state.width, oldH = state.height; if (kind === 'rot90cw' || kind === 'rot90ccw') [state.width, state.height] = [state.height, state.width]; for (const frame of state.frames) for (const layer of frame.layers) transformOneLayer(layer, kind, oldW, oldH); state.selection = null; state.selectionMask = null; sizeAllCanvases(); fitStage(); pushHistory('Transform image'); renderAll(); toast('Image transformed: ' + kind); }
            function transformLayer(kind) { transformOneLayer(activeLayer(), kind, state.width, state.height); pushHistory('Transform layer'); renderAll(); toast('Layer transformed: ' + kind); }
            function transformOneLayer(layer, kind, w = state.width, h = state.height) { const old = layer.canvas, outW = (kind === 'rot90cw' || kind === 'rot90ccw') ? h : w, outH = (kind === 'rot90cw' || kind === 'rot90ccw') ? w : h; const next = makeCanvas(outW, outH), ctx = next.getContext('2d'); if (kind === 'flipH') { ctx.translate(outW, 0); ctx.scale(-1, 1); } if (kind === 'flipV') { ctx.translate(0, outH); ctx.scale(1, -1); } if (kind === 'rot180') { ctx.translate(outW, outH); ctx.rotate(Math.PI); } if (kind === 'rot90cw') { ctx.translate(outW, 0); ctx.rotate(Math.PI / 2); } if (kind === 'rot90ccw') { ctx.translate(0, outH); ctx.rotate(-Math.PI / 2); } ctx.drawImage(old, 0, 0); layer.canvas = next; layer.strokeEvents = []; layer.revisionBase = null; for (const o of layer.objects || []) transformObject(o, kind, w, h); }
            function transformObject(o, kind, w, h) {
                if ((o.type || o.kind) === 'path') {
                    o.points = (o.points || []).map(p => transformPoint(p, kind, w, h));
                    return;
                }
                if (kind === 'flipH') o.x = w - o.x - (o.w || 0);
                if (kind === 'flipV') o.y = h - o.y - (o.h || 0);
                if (kind === 'rot180') { o.x = w - o.x - (o.w || 0); o.y = h - o.y - (o.h || 0); }
                if (kind === 'rot90cw') { const x = o.x, y = o.y, ow = o.w || 0, oh = o.h || 0; o.x = h - y - oh; o.y = x; o.w = oh; o.h = ow; }
                if (kind === 'rot90ccw') { const x = o.x, y = o.y, ow = o.w || 0, oh = o.h || 0; o.x = y; o.y = w - x - ow; o.w = oh; o.h = ow; }
            }
            function transformPoint(p, kind, w, h) {
                if (kind === 'flipH') return { ...p, x: w - p.x };
                if (kind === 'flipV') return { ...p, y: h - p.y };
                if (kind === 'rot180') return { ...p, x: w - p.x, y: h - p.y };
                if (kind === 'rot90cw') return { ...p, x: h - p.y, y: p.x };
                if (kind === 'rot90ccw') return { ...p, x: p.y, y: w - p.x };
                return { ...p };
            }
            function layerRotateZoom() {
                openPentaWindow({
                    title: 'Rotate / Zoom Layer',
                    body: `
            <div class="split">
              <div class="field">
                <label>Degrees</label>
                <input type="number" id="layerRotateDegrees" value="0">
              </div>
              <div class="field">
                <label>Scale</label>
                <input type="number" id="layerRotateScale" value="1" step="0.1">
              </div>
            </div>
          `,
                    actions: [
                        { id: 'cancel', label: 'Cancel', onClick: closePentaWindow },
                        {
                            id: 'apply',
                            label: 'Apply',
                            primary: true,
                            icon: 'check',
                            onClick: () => {
                                const deg = Number($('#layerRotateDegrees').value) || 0;
                                const zoom = Number($('#layerRotateScale').value) || 1;
                                const layer = activeLayer(), old = layer.canvas, next = makeCanvas(state.width, state.height), ctx = next.getContext('2d');
                                ctx.translate(state.width / 2, state.height / 2);
                                ctx.rotate(deg * Math.PI / 180);
                                ctx.scale(zoom, zoom);
                                ctx.drawImage(old, -state.width / 2, -state.height / 2);
                                layer.canvas = next;
                                layer.objects = [];
                                layer.strokeEvents = [];
                                layer.revisionBase = null;
                                state.selectedStrokeIds = [];
                                closePentaWindow();
                                pushHistory('Rotate / zoom layer');
                                renderAll();
                                toast('Layer rotated/scaled. Vector objects and stroke revision history were rasterized into the transform.');
                            }
                        }
                    ]
                });
            }
            function flatten() { const frame = activeFrame(), merged = makeLayer('Flattened Image', 'raster'); merged.canvas.getContext('2d').drawImage(renderFrameToCanvas(frame, state.width, state.height), 0, 0); merged.strokeEvents = []; merged.revisionBase = null; frame.layers = [merged]; state.activeLayer = 0; state.selectedStrokeIds = []; pushHistory('Flatten image'); renderAll(); toast('Visible layers flattened into one raster layer. Stroke revision history was baked into the flattened pixels.'); }
            function mergeDown() { const layers = activeFrame().layers; if (state.activeLayer <= 0) return toast('No layer below to merge into.'); const src = layers[state.activeLayer], dst = layers[state.activeLayer - 1], ctx = dst.canvas.getContext('2d'); ctx.save(); ctx.globalAlpha = src.opacity; ctx.globalCompositeOperation = src.blend || 'source-over'; drawLayerToContext(ctx, src); ctx.restore(); dst.objects = [...(dst.objects || []), ...(src.objects || [])]; dst.strokeEvents = []; dst.revisionBase = null; layers.splice(state.activeLayer, 1); state.activeLayer--; state.selectedStrokeIds = []; pushHistory('Merge layer down'); renderAll(); toast('Merged active layer down. Stroke revision history on the merged pixels was baked.'); }
            function toggleLayerVisibility() { activeLayer().visible = !activeLayer().visible; pushHistory('Toggle layer visibility'); renderAll(); toast(activeLayer().visible ? 'Layer visible.' : 'Layer hidden.'); }
            function adjustActiveLayer(kind) {
                if (!ensureRasterTarget()) return;
                const fields = {
                    brightnessContrast: `
            <div class="split">
              <div class="field"><label>Brightness</label><input type="number" id="adjBrightness" value="20"></div>
              <div class="field"><label>Contrast</label><input type="number" id="adjContrast" value="10"></div>
            </div>
          `,
                    exposure: `<div class="field"><label>Exposure stops</label><input type="number" id="adjExposure" value="0.5" step="0.1"></div>`,
                    hueSaturation: `
            <div class="split">
              <div class="field"><label>Hue degrees</label><input type="number" id="adjHue" value="0"></div>
              <div class="field"><label>Saturation</label><input type="number" id="adjSaturation" value="20"></div>
            </div>
          `,
                    highlightsShadows: `
            <div class="split">
              <div class="field"><label>Shadows</label><input type="number" id="adjShadows" value="20"></div>
              <div class="field"><label>Highlights</label><input type="number" id="adjHighlights" value="10"></div>
            </div>
          `
                };

                if (!fields[kind]) {
                    applyLayerAdjustment(kind, {});
                    return;
                }

                openPentaWindow({
                    title: 'Adjustment',
                    body: fields[kind],
                    actions: [
                        { id: 'cancel', label: 'Cancel', onClick: closePentaWindow },
                        {
                            id: 'apply',
                            label: 'Apply',
                            primary: true,
                            icon: 'check',
                            onClick: () => {
                                applyLayerAdjustment(kind, {
                                    brightness: Number($('#adjBrightness')?.value || 0),
                                    contrast: Number($('#adjContrast')?.value || 0),
                                    exposure: Number($('#adjExposure')?.value || 0),
                                    hue: Number($('#adjHue')?.value || 0),
                                    saturation: Number($('#adjSaturation')?.value || 0),
                                    shadows: Number($('#adjShadows')?.value || 0),
                                    highlights: Number($('#adjHighlights')?.value || 0)
                                });
                                closePentaWindow();
                            }
                        }
                    ]
                });
            }

            function applyLayerAdjustment(kind, values) {
                const layer = activeLayer(), ctx = layer.canvas.getContext('2d'), img = ctx.getImageData(0, 0, state.width, state.height), data = img.data;
                const maskData = state.selectionMask?.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, state.width, state.height).data;
                const b = values.brightness || 0, contrast = values.contrast || 0, exposure = values.exposure || 0, sat = values.saturation || 0, hue = values.hue || 0, hi = values.highlights || 0, sh = values.shadows || 0;
                const factor = (259 * (contrast + 255)) / (255 * (259 - contrast)), expMul = Math.pow(2, exposure);
                for (let i = 0; i < data.length; i += 4) {
                    let r = data[i], g = data[i + 1], bl = data[i + 2], a = data[i + 3];
                    if (maskData && !maskData[i + 3]) continue;
                    if (!a) continue;
                    if (kind === 'blackWhite') { const y = .2126 * r + .7152 * g + .0722 * bl; r = g = bl = y; }
                    if (kind === 'brightnessContrast') { r = factor * (r - 128) + 128 + b; g = factor * (g - 128) + 128 + b; bl = factor * (bl - 128) + 128 + b; }
                    if (kind === 'exposure') { r *= expMul; g *= expMul; bl *= expMul; }
                    if (kind === 'highlightsShadows') { const lum = (.2126 * r + .7152 * g + .0722 * bl) / 255, shadowBoost = (1 - lum) * sh, highCut = lum * hi; r += shadowBoost - highCut; g += shadowBoost - highCut; bl += shadowBoost - highCut; }
                    if (kind === 'hueSaturation') [r, g, bl] = shiftHueSat(r, g, bl, hue, sat);
                    if (kind === 'invertColors') { r = 255 - r; g = 255 - g; bl = 255 - bl; }
                    if (kind === 'invertAlpha') a = 255 - a;
                    data[i] = clamp(Math.round(r), 0, 255); data[i + 1] = clamp(Math.round(g), 0, 255); data[i + 2] = clamp(Math.round(bl), 0, 255); data[i + 3] = clamp(Math.round(a), 0, 255);
                }
                ctx.putImageData(img, 0, 0);
                bakeLayerRevisionHistory(layer);
                pushHistory('Adjustment ' + kind);
                renderAll();
                toast('Adjustment applied: ' + kind);
            }
            function shiftHueSat(r, g, b, hue, sat) { let [h, s, l] = rgbToHsl(r, g, b); h = (h + hue / 360) % 1; if (h < 0) h += 1; s = clamp(s * (1 + sat / 100), 0, 1); return hslToRgb(h, s, l); } function rgbToHsl(r, g, b) { r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b); let h = 0, s, l = (max + min) / 2; if (max !== min) { const d = max - min; s = l > .5 ? d / (2 - max - min) : d / (max + min); if (max === r) h = (g - b) / d + (g < b ? 6 : 0); else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h /= 6; } return [h, s, l]; } function hslToRgb(h, s, l) { let r, g, b; if (s === 0) r = g = b = l; else { const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }; const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3); } return [r * 255, g * 255, b * 255]; }
            function showHelp() {
                openPentaWindow({
                    title: 'Help',
                    body: `
            <div style="display:grid;gap:6px;font-size:13px">
              <div><span class="kbd">B</span> Brush</div>
              <div><span class="kbd">E</span> Eraser</div>
              <div><span class="kbd">T</span> Text</div>
              <div><span class="kbd">V</span> Vector</div>
              <div><span class="kbd">Ctrl+Z</span> Undo</div>
            </div>
          `,
                    actions: [{ id: 'ok', label: 'OK', primary: true, onClick: closePentaWindow }]
                });
            }

            function showSettings() {
                openPentaWindow({
                    title: 'Settings',
                    body: `
            <label class="field">
              <span>Theme</span>
              <select id="settingsTheme">
                ${Object.keys(themes).map(name => `<option value="${name}" ${name === state.theme ? 'selected' : ''}>${name}</option>`).join('')}
              </select>
            </label>
            <label class="field">
              <span>Bottom dock</span>
              <select id="settingsBottomDock">
                <option value="compact" ${state.bottomDockCompact ? 'selected' : ''}>Compact icon dock</option>
                <option value="full" ${!state.bottomDockCompact ? 'selected' : ''}>Full dock</option>
              </select>
            </label>
            <label class="field">
              <span>Pixel grid threshold</span>
              <input type="number" id="settingsPixelGridThreshold" value="${state.pixelGridThreshold}" min="1" max="100">
            </label>
            <label class="field">
              <span>Max history states</span>
              <input type="number" id="settingsHistory" value="${state.maxHistory}" min="4" max="200">
            </label>
          `,
                    actions: [
                        { id: 'cancel', label: 'Cancel', onClick: closePentaWindow },
                        {
                            id: 'apply',
                            label: 'Apply',
                            primary: true,
                            onClick: () => {
                                applyTheme($('#settingsTheme').value);
                                setBottomDockCompact($('#settingsBottomDock').value === 'compact');
                                state.pixelGridThreshold = clamp(Number($('#settingsPixelGridThreshold').value) || 5, 1, 100);
                                state.maxHistory = clamp(Number($('#settingsHistory').value) || 36, 4, 200);
                                updateControls();
                                closePentaWindow();
                            }
                        }
                    ]
                });
            }

            function newProject() {
                state.width = Number($('#cw').value) || 1280;
                state.height = Number($('#ch').value) || 720;
                state.frames = [makeFrame('Frame 1')]; state.activeFrame = 0; state.activeLayer = 0;
                state.undoStack = []; state.redoStack = [];
                syncActiveDocumentFromState();
                sizeAllCanvases(); fitStage(); pushHistory('New project'); renderAll(); toast('New project created.');
            }

            let resizeFrame = 0;
            let previousViewportWidth = window.innerWidth;
            const handleViewportResize = () => {
                const widthChanged = Math.abs(window.innerWidth - previousViewportWidth) > 2;
                previousViewportWidth = window.innerWidth;
                syncMobileViewportSize();
                cancelAnimationFrame(resizeFrame);
                resizeFrame = requestAnimationFrame(() => {
                    if (!window.matchMedia(MOBILE_LAYOUT_QUERY).matches || widthChanged) fitStage();
                    updateControls();
                    drawSelectedVectorOverlay();
                    redrawUiOverlay();
                });
            };
            syncMobileViewportSize();
            window.addEventListener('resize', handleViewportResize, { passive: true });
            window.visualViewport?.addEventListener('resize', handleViewportResize, { passive: true });
            window.addEventListener('orientationchange', handleViewportResize, { passive: true });
            init();
        })();

// Touch workspace controls: Penta's full desktop docks become explicit bottom sheets.
document.addEventListener('DOMContentLoaded', () => {
    if (!window.matchMedia('(max-width: 820px), (hover: none) and (pointer: coarse)').matches) return;
    const left = document.querySelector('.panel.left');
    const right = document.querySelector('.panel.right');
    if (!left || !right) return;
    const nav = document.createElement('nav');
    nav.className = 'mobile-panel-nav';
    nav.setAttribute('aria-label', 'Penta mobile controls');
    nav.innerHTML = '<button type="button" data-panel="menu" aria-label="Main menu"><span class="material-symbols-rounded">menu</span></button><button type="button" data-panel="tools" aria-label="Tools"><span class="material-symbols-rounded">brush</span></button><button type="button" data-panel="layers" aria-label="Layers"><span class="material-symbols-rounded">layers</span></button>';
    document.body.appendChild(nav);
    const close = () => { left.classList.remove('is-mobile-open'); right.classList.remove('is-mobile-open'); document.body.classList.remove('mobile-sheet-open'); nav.querySelectorAll('button').forEach(b => b.classList.remove('is-active')); };
    nav.addEventListener('click', event => {
        const button = event.target.closest('button'); if (!button) return;
        if (button.dataset.panel === 'menu') { close(); openMobileMenu(); return; }
        const panel = button.dataset.panel === 'tools' ? left : right;
        const wasOpen = panel.classList.contains('is-mobile-open'); close();
        if (!wasOpen) { panel.classList.add('is-mobile-open'); button.classList.add('is-active'); document.body.classList.add('mobile-sheet-open'); }
    });
    document.querySelector('.workspace')?.addEventListener('pointerdown', close);
    let startY = 0;
    [left, right].forEach(panel => panel.addEventListener('pointerdown', e => { startY = e.clientY; }));
    [left, right].forEach(panel => panel.addEventListener('pointerup', e => { if (e.clientY - startY > 70) close(); }));

    function openMobileMenu(sectionIndex = null) {
        let menu = document.querySelector('.mobile-menu');
        if (!menu) {
            menu = document.createElement('dialog');
            menu.className = 'mobile-menu';
            document.body.appendChild(menu);
        }
        const sourceMenus = [...document.querySelectorAll('#mainMenu .menu')];
        const labelFor = item => item.textContent.trim().replace(/\s+/g, ' ');
        if (sectionIndex === null) {
            menu.innerHTML = `<header><span>Penta menu</span><button class="icon-btn" type="button" aria-label="Close menu"><span class="material-symbols-rounded">close</span></button></header><p class="mobile-menu-help">Choose a menu category</p><div class="mobile-menu-grid mobile-menu-categories">${sourceMenus.map((menuEl, index) => `<button type="button" data-menu-section="${index}">${labelFor(menuEl.querySelector(':scope > button'))}</button>`).join('')}</div>`;
        } else {
            const sourceMenu = sourceMenus[sectionIndex];
            const title = labelFor(sourceMenu.querySelector(':scope > button'));
            // Undo/redo are persistent top-bar actions on mobile, so repeating
            // them in the menu only adds noise.
            const actions = [...sourceMenu.querySelectorAll('[data-action]')]
                .filter(action => !['undo', 'redo'].includes(action.dataset.action));
            menu.innerHTML = `<header><button class="icon-btn mobile-menu-back" type="button" aria-label="Back"><span class="material-symbols-rounded">arrow_back</span></button><span>${title}</span><button class="icon-btn mobile-menu-close" type="button" aria-label="Close menu"><span class="material-symbols-rounded">close</span></button></header><div class="mobile-menu-grid mobile-menu-actions">${actions.map(action => `<button type="button" data-action="${action.dataset.action}">${labelFor(action)}</button>`).join('')}</div>`;
        }
        menu.querySelector('header button:not(.mobile-menu-back)')?.addEventListener('click', () => menu.close());
        menu.querySelector('.mobile-menu-close')?.addEventListener('click', () => menu.close());
        menu.querySelector('.mobile-menu-back')?.addEventListener('click', () => openMobileMenu());
        menu.querySelector('.mobile-menu-grid').onclick = event => {
            const section = event.target.closest('[data-menu-section]');
            if (section) { openMobileMenu(Number(section.dataset.menuSection)); return; }
            const button = event.target.closest('[data-action]'); if (!button) return;
            document.querySelector(`#mainMenu [data-action="${button.dataset.action}"]`)?.click();
            menu.close();
        };
        if (!menu.open) menu.showModal();
    }
});
