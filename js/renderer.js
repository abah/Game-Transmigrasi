// ======================================================
// RENDERER.JS - Township-Style Isometric Rendering Engine
// ======================================================

const Renderer = {
    canvas: null,
    ctx: null,
    miniCanvas: null,
    miniCtx: null,

    // Camera
    camera: { x: 0, y: 0, zoom: 1 },
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    cameraStart: { x: 0, y: 0 },
    dragDistance: 0,

    // Hover
    hoverTile: { x: -1, y: -1 },

    // Animation
    animTime: 0,
    people: [],
    particles: [],
    clouds: [],
    butterflies: [],

    // Tile half-dimensions
    TW: 64, TH: 32,
    get tileWHalf() { return this.TW / 2; },
    get tileHHalf() { return this.TH / 2; },

    // Sprite system
    spriteImages: {},
    spritesLoaded: false,
    SPRITE_BASE_WIDTH: 100, // Kenney road pack tile width
    SPRITE_ANCHOR_Y: 25,    // Diamond center Y in 100×50 isometric diamond

    // ==============================
    //  INITIALIZATION
    // ==============================
    init() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.miniCanvas = document.getElementById('mini-map');
        this.miniCtx = this.miniCanvas.getContext('2d');

        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Camera center on map
        const cx = GameData.MAP_SIZE / 2, cy = GameData.MAP_SIZE / 2;
        const sc = this.tileToScreen(cx, cy);
        this.camera.x = -sc.x + this.canvas.width / 2;
        this.camera.y = -sc.y + this.canvas.height / 2;

        // Input
        this.canvas.addEventListener('mousedown', e => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', e => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.isDragging = false);
        this.canvas.addEventListener('mouseleave', () => { this.isDragging = false; this.hoverTile = { x: -1, y: -1 }; });
        this.canvas.addEventListener('wheel', e => this.onWheel(e), { passive: false });
        this.canvas.addEventListener('click', e => this.onClick(e));
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        this.canvas.addEventListener('touchstart', e => this.onTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', e => this.onTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', e => this.onTouchEnd(e));

        // Clouds
        for (let i = 0; i < 6; i++) {
            this.clouds.push({
                x: Math.random() * 3000 - 500, y: 30 + Math.random() * 120,
                w: 100 + Math.random() * 160, speed: 0.15 + Math.random() * 0.25,
                opacity: 0.35 + Math.random() * 0.25
            });
        }
        // Butterflies
        for (let i = 0; i < 8; i++) {
            this.butterflies.push({
                x: Math.random() * GameData.MAP_SIZE, y: Math.random() * GameData.MAP_SIZE,
                phase: Math.random() * Math.PI * 2, speed: 0.01 + Math.random() * 0.015,
                color: ['#f0a0d0','#f0d060','#a0d0f0','#f09060'][Math.floor(Math.random()*4)]
            });
        }
    },

    resize() {
        const isMobile = window.innerWidth <= 1024;
        const sp = document.getElementById('side-panel');
        const panelW = isMobile ? 0 : (sp ? sp.offsetWidth : 260);
        const topBar = document.getElementById('top-bar');
        const topH = topBar ? topBar.offsetHeight : 52;

        const cssW = window.innerWidth - panelW;
        const cssH = window.innerHeight - topH;

        // Scale canvas by devicePixelRatio so rendering is crisp on Retina/HDPI screens
        // and touch coordinates (in CSS px) map accurately to canvas pixels
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width  = cssW * dpr;
        this.canvas.height = cssH * dpr;
        this.canvas.style.width  = cssW + 'px';
        this.canvas.style.height = cssH + 'px';

        // Store DPR for use in coordinate conversion
        this._dpr = dpr;
    },

    // ==============================
    //  SPRITE LOADING
    // ==============================
    loadSprites() {
        const manifest = {
            // Terrain
            grass: 'assets/sprites/terrain/grass.png',
            water: 'assets/sprites/terrain/water.png',
            dirt: 'assets/sprites/terrain/dirt.png',
            // Roads (auto-tiling)
            roadEW: 'assets/sprites/roads/roadEW.png',
            roadNS: 'assets/sprites/roads/roadNS.png',
            roadNE: 'assets/sprites/roads/roadNE.png',
            roadNW: 'assets/sprites/roads/roadNW.png',
            roadES: 'assets/sprites/roads/roadES.png',
            roadSW: 'assets/sprites/roads/roadSW.png',
            crossroad: 'assets/sprites/roads/crossroad.png',
            crossroadNES: 'assets/sprites/roads/crossroadNES.png',
            crossroadNEW: 'assets/sprites/roads/crossroadNEW.png',
            crossroadNSW: 'assets/sprites/roads/crossroadNSW.png',
            crossroadESW: 'assets/sprites/roads/crossroadESW.png',
            endN: 'assets/sprites/roads/endN.png',
            endS: 'assets/sprites/roads/endS.png',
            endE: 'assets/sprites/roads/endE.png',
            endW: 'assets/sprites/roads/endW.png',
            roadSingle: 'assets/sprites/roads/road.png',
            // Bridges
            bridgeEW: 'assets/sprites/roads/bridgeEW.png',
            bridgeNS: 'assets/sprites/roads/bridgeNS.png',
            // Trees
            treeTall: 'assets/sprites/trees/treeTall.png',
            coniferTall: 'assets/sprites/trees/coniferTall.png',
            coniferAltTall: 'assets/sprites/trees/coniferAltTall.png',
            coniferShort: 'assets/sprites/trees/coniferShort.png',
            coniferAltShort: 'assets/sprites/trees/coniferAltShort.png',
        };

        return new Promise((resolve) => {
            const keys = Object.keys(manifest);
            let loaded = 0;
            const total = keys.length;

            if (total === 0) { this.spritesLoaded = true; resolve(); return; }

            keys.forEach(key => {
                const img = new Image();
                img.onload = () => {
                    this.spriteImages[key] = img;
                    loaded++;
                    if (loaded >= total) { this.spritesLoaded = true; resolve(); }
                };
                img.onerror = () => {
                    console.warn('Failed to load sprite:', key, manifest[key]);
                    loaded++;
                    if (loaded >= total) { this.spritesLoaded = true; resolve(); }
                };
                img.src = manifest[key];
            });
        });
    },

    // Draw a terrain sprite at tile center (sx, sy)
    _drawTerrainSprite(ctx, sx, sy, spriteKey) {
        const sprite = this.spriteImages[spriteKey];
        if (!sprite) return false;

        const scale = this.TW / this.SPRITE_BASE_WIDTH;
        const drawW = sprite.width * scale;
        const drawH = sprite.height * scale;
        const anchorX = (sprite.width / 2) * scale;
        const anchorY = this.SPRITE_ANCHOR_Y * scale;

        ctx.drawImage(sprite, sx - anchorX, sy - anchorY, drawW, drawH);
        return true;
    },

    // Check if a tile has road
    _isRoadTile(x, y) {
        const size = GameData.MAP_SIZE;
        if (x < 0 || y < 0 || x >= size || y >= size) return false;
        return Game.map.tiles[y * size + x] === GameData.TILE.ROAD;
    },

    // Get road sprite key based on neighbor connections
    // Kenney isometric directions (verified from sprites):
    //   N = top-left edge    (screen upper-left)  = grid tx-1
    //   E = top-right edge   (screen upper-right) = grid ty-1
    //   S = bottom-right edge(screen lower-right) = grid tx+1
    //   W = bottom-left edge (screen lower-left)  = grid ty+1
    _getRoadSpriteKey(tx, ty) {
        const n = this._isRoadTile(tx - 1, ty);   // Kenney N = upper-left = -tx
        const e = this._isRoadTile(tx, ty - 1);   // Kenney E = upper-right = -ty
        const s = this._isRoadTile(tx + 1, ty);   // Kenney S = lower-right = +tx
        const w = this._isRoadTile(tx, ty + 1);   // Kenney W = lower-left = +ty

        const key = (n ? 'N' : '') + (e ? 'E' : '') + (s ? 'S' : '') + (w ? 'W' : '');

        const spriteMap = {
            'NESW': 'crossroad',
            'NES':  'crossroadNES',
            'NEW':  'crossroadNEW',
            'NSW':  'crossroadNSW',
            'ESW':  'crossroadESW',
            'NS':   'roadNS',
            'EW':   'roadEW',
            'NE':   'roadNE',
            'NW':   'roadNW',
            'ES':   'roadES',
            'SW':   'roadSW',
            'N':    'endN',
            'S':    'endS',
            'E':    'endE',
            'W':    'endW',
            '':     'roadSingle'
        };

        return spriteMap[key] || 'roadSingle';
    },

    // Render road tile with auto-tiling
    _renderRoadWithSprites(ctx, sx, sy, tx, ty) {
        const spriteKey = this._getRoadSpriteKey(tx, ty);
        if (this._drawTerrainSprite(ctx, sx, sy, spriteKey)) return true;
        // Fallback
        return this._drawTerrainSprite(ctx, sx, sy, 'roadSingle');
    },

    // Rich grass detail overlay (on top of sprite) — world-class realism
    _addGrassDetails(ctx, sx, sy, tx, ty) {
        const rng = this._seededRandom(tx * 31 + ty * 17);
        const hw = this.TW / 2, hh = this.TH / 2;

        ctx.save();
        this._tileDiamond(ctx, sx, sy, this.TW, this.TH);
        ctx.clip();

        // --- Light/shadow patches (simulates terrain micro-undulation) ---
        ctx.fillStyle = 'rgba(255,255,230,0.035)';
        ctx.beginPath();
        ctx.ellipse(sx - hw * 0.15, sy - hh * 0.2, hw * 0.4, hh * 0.35, 0.7, 0, Math.PI * 2);
        ctx.fill();

        // --- Grass blade clusters ---
        const clusters = 2 + Math.floor(rng() * 3);
        for (let c = 0; c < clusters; c++) {
            const cx = sx + (rng() - 0.5) * this.TW * 0.6;
            const cy = sy + (rng() - 0.5) * this.TH * 0.4;
            const bladeCount = 3 + Math.floor(rng() * 3);
            const greenVar = Math.floor((rng() - 0.5) * 30);

            for (let b = 0; b < bladeCount; b++) {
                const bx = cx + (rng() - 0.5) * 4;
                const by = cy + (rng() - 0.5) * 1.5;
                const bh = 2 + rng() * 3;
                const lean = (rng() - 0.5) * 2;
                ctx.strokeStyle = `rgba(${55 + Math.floor(rng() * 25)},${140 + greenVar},${30 + Math.floor(rng() * 15)},${0.3 + rng() * 0.2})`;
                ctx.lineWidth = 0.4 + rng() * 0.3;
                ctx.beginPath();
                ctx.moveTo(bx, by);
                ctx.quadraticCurveTo(bx + lean * 0.4, by - bh * 0.6, bx + lean, by - bh);
                ctx.stroke();
            }
        }

        // --- Small wildflowers ---
        if (rng() > 0.6) {
            const fCols = ['#e8e060', '#e080a0', '#f0f0f0', '#a0a0ff', '#ffb0c0'];
            const fx = sx + (rng() - 0.5) * 16;
            const fy = sy + (rng() - 0.5) * 5;
            ctx.strokeStyle = 'rgba(60,120,40,0.3)';
            ctx.lineWidth = 0.3;
            ctx.beginPath();
            ctx.moveTo(fx, fy);
            ctx.lineTo(fx, fy - 2);
            ctx.stroke();
            ctx.fillStyle = fCols[Math.floor(rng() * fCols.length)];
            ctx.beginPath();
            ctx.arc(fx, fy - 2.3, 0.8 + rng() * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Occasional pebble ---
        if (rng() > 0.8) {
            ctx.fillStyle = 'rgba(0,0,0,0.05)';
            ctx.beginPath();
            ctx.ellipse(sx + (rng() - 0.5) * 14 + 0.4, sy + (rng() - 0.3) * 5 + 0.3, 1.5, 0.7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(${130 + Math.floor(rng() * 30)},${120 + Math.floor(rng() * 20)},${100 + Math.floor(rng() * 20)},0.2)`;
            ctx.beginPath();
            ctx.ellipse(sx + (rng() - 0.5) * 14, sy + (rng() - 0.3) * 5, 1.3, 0.6, rng() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    },

    // Water animation overlay (on top of sprite)
    _addWaterEffects(ctx, sx, sy, tx, ty) {
        const t = this.animTime;
        const w1 = Math.sin(t * 1.2 + tx * 0.8 + ty * 0.6);
        const w2 = Math.sin(t * 0.9 - tx * 0.5 + ty * 1.1);
        const w3 = Math.sin(t * 1.8 + tx * 0.3 - ty * 0.9);
        const hw = this.TW / 2, hh = this.TH / 2;

        // Clip to tile
        ctx.save();
        this._tileDiamond(ctx, sx, sy, this.TW, this.TH);
        ctx.clip();

        // Wave ripple lines
        for (let layer = 0; layer < 2; layer++) {
            const speed = 1 + layer * 0.6;
            const amp = 1.5 + layer * 0.5;
            const alpha = 0.07 - layer * 0.02;
            ctx.strokeStyle = `rgba(200,230,255,${alpha + w1 * 0.02})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            for (let i = -hw; i <= hw; i += 3) {
                const waveY = Math.sin(t * speed + i * 0.3 + tx + layer * 2) * amp;
                const px = sx + i;
                const py = sy + waveY + (layer - 0.5) * 3;
                if (i === -hw) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
        }

        // Light caustics
        const rng = this._seededRandom(tx * 47 + ty * 89);
        for (let i = 0; i < 3; i++) {
            const cx = sx + (rng() - 0.5) * this.TW * 0.7 + Math.sin(t * 1.5 + i * 2.3) * 2;
            const cy = sy + (rng() - 0.5) * this.TH * 0.5 + Math.cos(t * 1.2 + i * 1.7) * 1;
            const cr = 2 + rng() * 2.5 + Math.sin(t * 2 + i) * 0.6;
            ctx.fillStyle = `rgba(200,240,255,${0.05 + Math.sin(t * 1.8 + i) * 0.02})`;
            ctx.beginPath();
            ctx.ellipse(cx, cy, cr, cr * 0.45, rng() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        // Sun glint
        ctx.fillStyle = `rgba(255,255,255,${0.1 + w3 * 0.04})`;
        ctx.beginPath();
        ctx.ellipse(sx + w1 * 4, sy - 1 + w2 * 1.5, 4 + w3, 1.5, 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Shore effect
        this._drawShoreEffect(ctx, sx, sy, this.TW, this.TH, tx, ty);
    },

    // Farmland crop overlay (on top of grass sprite)
    _addFarmlandOverlay(ctx, sx, sy, tx, ty) {
        // Crop rows
        const growth = (Math.sin(this.animTime * 0.3) + 1) * 0.5;
        for (let i = -2; i <= 2; i++) {
            ctx.strokeStyle = `rgba(${70 + growth * 40},${130 + growth * 50},${30 + growth * 20},0.6)`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx + i * 7 - 3, sy + 7);
            ctx.lineTo(sx + i * 7 + 3, sy - 7);
            ctx.stroke();

            // Plants on rows
            for (let j = -1; j <= 1; j++) {
                const px = sx + i * 7;
                const py = sy + j * 5;
                const h = 2 + growth * 2.5;
                ctx.strokeStyle = `rgb(${70 + growth * 50},${140 + growth * 50},${35})`;
                ctx.lineWidth = 0.7;
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(px + Math.sin(this.animTime * 0.8 + i) * 0.4, py - h);
                ctx.stroke();
            }
        }
    },

    // Render forest tile — multiple trees for dense, varied forest
    _renderTreeSprite(ctx, sx, sy, tx, ty) {
        const rng = this._seededRandom(tx * 137 + ty * 59);
        const anim = this.animTime || 0;

        // --- How many trees on this tile: 2-3 ---
        const treeCount = 2 + (rng() > 0.55 ? 1 : 0);

        for (let t = 0; t < treeCount; t++) {
            // Wider spread: main tree near center, extras spread out more
            const spread = t === 0 ? 0.6 : 1.0;
            const ox = (rng() - 0.5) * 24 * spread;
            const oy = (rng() - 0.5) * 10 * spread;
            const px = sx + ox, py = sy + oy;

            // Ground details only for the first tree
            if (t === 0) this._groundDetail(ctx, px, py, this._seededRandom(tx * 31 + ty * 47));

            // Scale secondary trees slightly smaller
            const isSecondary = t > 0;

            // Each tree gets a fresh type roll for maximum variety
            const typeRoll = rng();

            if (isSecondary && rng() > 0.4) {
                // Secondary trees are often smaller bushes/undergrowth
                this._treeBush(ctx, px, py, this._seededRandom(tx * 200 + ty * 300 + t * 77), anim);
            } else if (typeRoll < 0.10) {
                this._drawSpriteTree(ctx, px, py, 'treeTall', this._seededRandom(tx * 51 + ty * 73 + t * 99), anim);
            } else if (typeRoll < 0.17) {
                this._drawSpriteTree(ctx, px, py, 'coniferTall', this._seededRandom(tx * 53 + ty * 79 + t * 99), anim);
            } else if (typeRoll < 0.22) {
                this._drawSpriteTree(ctx, px, py, 'coniferAltTall', this._seededRandom(tx * 57 + ty * 83 + t * 99), anim);
            } else if (typeRoll < 0.27) {
                this._drawSpriteTree(ctx, px, py, 'coniferShort', this._seededRandom(tx * 61 + ty * 89 + t * 99), anim);
            } else if (typeRoll < 0.32) {
                this._drawSpriteTree(ctx, px, py, 'coniferAltShort', this._seededRandom(tx * 67 + ty * 91 + t * 99), anim);
            } else if (typeRoll < 0.44) {
                this._treeBanyan(ctx, px, py, this._seededRandom(tx * 71 + ty * 97 + t * 99), anim);
            } else if (typeRoll < 0.54) {
                this._treeBirch(ctx, px, py, this._seededRandom(tx * 73 + ty * 101 + t * 99), anim);
            } else if (typeRoll < 0.64) {
                this._treeBamboo(ctx, px, py, this._seededRandom(tx * 79 + ty * 103 + t * 99), anim);
            } else if (typeRoll < 0.74) {
                this._treeFlowering(ctx, px, py, this._seededRandom(tx * 83 + ty * 107 + t * 99), anim);
            } else if (typeRoll < 0.84) {
                this._treeAcacia(ctx, px, py, this._seededRandom(tx * 89 + ty * 109 + t * 99), anim);
            } else if (typeRoll < 0.92) {
                this._treeLargeRound(ctx, px, py, this._seededRandom(tx * 93 + ty * 113 + t * 99), anim);
            } else {
                this._treeLargeConifer(ctx, px, py, this._seededRandom(tx * 97 + ty * 117 + t * 99), anim);
            }
        }

        // --- Extra undergrowth ferns/small plants between trees ---
        const undergrowthRng = this._seededRandom(tx * 211 + ty * 157);
        if (undergrowthRng() > 0.3) {
            const ugCount = 1 + Math.floor(undergrowthRng() * 2);
            for (let u = 0; u < ugCount; u++) {
                const ux = sx + (undergrowthRng() - 0.5) * 22;
                const uy = sy + (undergrowthRng() - 0.5) * 9;
                const uh = 2 + undergrowthRng() * 3;
                const ugGreen = 100 + Math.floor(undergrowthRng() * 50);
                // Small fern
                ctx.strokeStyle = `rgba(${40 + Math.floor(undergrowthRng() * 20)},${ugGreen},${25},${0.3 + undergrowthRng() * 0.15})`;
                ctx.lineWidth = 0.5;
                for (let fb = 0; fb < 3; fb++) {
                    const lean = (undergrowthRng() - 0.5) * 3;
                    ctx.beginPath();
                    ctx.moveTo(ux + fb - 1, uy);
                    ctx.quadraticCurveTo(ux + lean * 0.4 + fb - 1, uy - uh * 0.6, ux + lean + fb - 1, uy - uh);
                    ctx.stroke();
                }
            }
        }

        return true;
    },

    // Draw a sprite-based tree with realistic shadow, sway and lighting overlay
    _drawSpriteTree(ctx, px, py, spriteKey, rng, anim) {
        const sprite = this.spriteImages[spriteKey];
        if (!sprite) return false;

        const targetHeight = 28 + rng() * 14;
        const treeScale = targetHeight / sprite.height;
        const w = sprite.width * treeScale;
        const h = sprite.height * treeScale;

        // Subtle sway
        const sway = Math.sin(anim * 0.6 + px * 0.05) * 1.2;

        // --- Soft radial shadow ---
        const shadowGrad = ctx.createRadialGradient(px + 1, py + 3, 1, px + 1, py + 3, w * 0.5);
        shadowGrad.addColorStop(0, 'rgba(0,0,0,0.16)');
        shadowGrad.addColorStop(0.6, 'rgba(0,0,0,0.06)');
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.ellipse(px + 1, py + 3, w * 0.48, h * 0.07, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw tree sprite with sway skew
        ctx.save();
        ctx.translate(px, py - h + 4);
        ctx.transform(1, 0, sway * 0.01, 1, 0, 0);
        ctx.drawImage(sprite, -w / 2, 0, w, h);

        // --- Sunlight overlay (top-left highlight) ---
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = 'rgba(255,255,200,0.04)';
        ctx.beginPath();
        ctx.ellipse(-w * 0.15, h * 0.25, w * 0.3, h * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        ctx.restore();

        return true;
    },

    // Realistic ground details around trees — textured with depth
    _groundDetail(ctx, px, py, rng) {
        // --- Root-zone darkened earth circle ---
        ctx.fillStyle = 'rgba(30,50,15,0.06)';
        ctx.beginPath();
        ctx.ellipse(px, py + 1, 12, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        const detailType = rng();
        if (detailType < 0.35) {
            // --- Lush grass tufts with curvature and color variation ---
            const tufts = 2 + Math.floor(rng() * 4);
            for (let i = 0; i < tufts; i++) {
                const gx = px + (rng() - 0.5) * 18;
                const gy = py + (rng() - 0.5) * 7;
                const bladeCount = 3 + Math.floor(rng() * 3);
                const greenBase = 130 + Math.floor(rng() * 40);

                for (let b = 0; b < bladeCount; b++) {
                    const bx = gx + (rng() - 0.5) * 3;
                    const by = gy + (rng() - 0.5) * 1;
                    const bh = 2.5 + rng() * 4;
                    const lean = (rng() - 0.5) * 3;
                    ctx.strokeStyle = `rgba(${50 + Math.floor(rng() * 25)},${greenBase},${25 + Math.floor(rng() * 15)},${0.35 + rng() * 0.2})`;
                    ctx.lineWidth = 0.4 + rng() * 0.4;
                    ctx.beginPath();
                    ctx.moveTo(bx, by);
                    ctx.quadraticCurveTo(bx + lean * 0.3, by - bh * 0.6, bx + lean, by - bh);
                    ctx.stroke();
                }
            }
        } else if (detailType < 0.55) {
            // --- Small stones with shadow + highlight ---
            const stoneCount = 1 + Math.floor(rng() * 3);
            for (let s = 0; s < stoneCount; s++) {
                const sx2 = px + (rng() - 0.5) * 14;
                const sy2 = py + (rng() - 0.2) * 5;
                const sr = 1.2 + rng() * 1.3;
                const angle = rng() * Math.PI;
                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.08)';
                ctx.beginPath();
                ctx.ellipse(sx2 + 0.4, sy2 + 0.3, sr + 0.3, sr * 0.5, angle, 0, Math.PI * 2);
                ctx.fill();
                // Body
                ctx.fillStyle = `rgba(${120 + Math.floor(rng() * 40)},${110 + Math.floor(rng() * 30)},${90 + Math.floor(rng() * 25)},0.4)`;
                ctx.beginPath();
                ctx.ellipse(sx2, sy2, sr, sr * 0.55, angle, 0, Math.PI * 2);
                ctx.fill();
                // Highlight
                ctx.fillStyle = 'rgba(255,255,240,0.12)';
                ctx.beginPath();
                ctx.ellipse(sx2 - sr * 0.2, sy2 - sr * 0.15, sr * 0.35, sr * 0.2, angle, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (detailType < 0.75) {
            // --- Fallen leaves with realistic shapes ---
            const leafColors = [
                'rgba(140,100,30,0.28)', 'rgba(180,130,40,0.22)',
                'rgba(100,80,20,0.25)', 'rgba(160,110,25,0.2)',
                'rgba(110,90,30,0.18)'
            ];
            const leafCount = 3 + Math.floor(rng() * 3);
            for (let i = 0; i < leafCount; i++) {
                const lx = px + (rng() - 0.5) * 16;
                const ly = py + (rng() - 0.3) * 6;
                const angle = rng() * Math.PI * 2;
                const lw = 1.5 + rng() * 1.5;
                const lh = lw * (0.5 + rng() * 0.3);
                ctx.fillStyle = leafColors[Math.floor(rng() * leafColors.length)];
                ctx.beginPath();
                ctx.ellipse(lx, ly, lw, lh, angle, 0, Math.PI * 2);
                ctx.fill();
                // Leaf vein
                ctx.strokeStyle = 'rgba(80,60,20,0.1)';
                ctx.lineWidth = 0.2;
                ctx.beginPath();
                ctx.moveTo(lx - Math.cos(angle) * lw * 0.7, ly - Math.sin(angle) * lw * 0.7);
                ctx.lineTo(lx + Math.cos(angle) * lw * 0.7, ly + Math.sin(angle) * lw * 0.7);
                ctx.stroke();
            }
        } else if (detailType < 0.88) {
            // --- Moss/lichen patches ---
            ctx.fillStyle = `rgba(45,95,35,${0.08 + rng() * 0.06})`;
            ctx.beginPath();
            ctx.ellipse(px + (rng() - 0.5) * 10, py + (rng() - 0.3) * 4, 4 + rng() * 4, 2 + rng() * 2, rng() * Math.PI, 0, Math.PI * 2);
            ctx.fill();

            // --- Tiny mushrooms ---
            if (rng() > 0.5) {
                const mx = px + (rng() - 0.5) * 8;
                const my = py + (rng() - 0.2) * 3;
                ctx.fillStyle = 'rgba(160,140,100,0.35)';
                ctx.fillRect(mx - 0.3, my - 2.5, 0.6, 2.5);
                ctx.fillStyle = `rgba(${180 + Math.floor(rng() * 60)},${140 + Math.floor(rng() * 40)},${100 + Math.floor(rng() * 30)},0.4)`;
                ctx.beginPath();
                ctx.ellipse(mx, my - 2.5, 1.5 + rng() * 0.5, 0.8 + rng() * 0.3, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        // else: minimal bare ground
    },

    // === BANYAN / Large tropical tree — AAA quality ===
    _treeBanyan(ctx, x, y, rng, anim) {
        const h = 20 + rng() * 10;
        const sway = Math.sin(anim * 0.4 + x * 0.03) * 1;
        const swayFine = Math.sin(anim * 1.1 + x * 0.07) * 0.5;

        // --- Shadow with soft radial gradient ---
        const shadowGrad = ctx.createRadialGradient(x, y + 3, 2, x, y + 3, 16);
        shadowGrad.addColorStop(0, 'rgba(0,0,0,0.2)');
        shadowGrad.addColorStop(0.6, 'rgba(0,0,0,0.1)');
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.ellipse(x, y + 3, 16, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- Main trunk with gradient and gnarled texture ---
        const tw = 3.5 + rng() * 2;
        const trunkGrad = ctx.createLinearGradient(x - tw, y, x + tw, y - h * 0.5);
        trunkGrad.addColorStop(0, '#4a3418');
        trunkGrad.addColorStop(0.3, '#5a4020');
        trunkGrad.addColorStop(0.6, '#6a4a28');
        trunkGrad.addColorStop(1, '#5a3e1e');
        ctx.fillStyle = trunkGrad;
        ctx.beginPath();
        ctx.moveTo(x - tw, y);
        ctx.bezierCurveTo(x - tw * 1.2, y - h * 0.15, x - tw * 0.7, y - h * 0.35, x - tw * 0.4 + sway * 0.3, y - h * 0.55);
        ctx.lineTo(x + tw * 0.4 + sway * 0.3, y - h * 0.55);
        ctx.bezierCurveTo(x + tw * 0.7, y - h * 0.35, x + tw * 1.2, y - h * 0.15, x + tw, y);
        ctx.closePath();
        ctx.fill();

        // --- Bark texture (vertical cracks, knots) ---
        ctx.strokeStyle = 'rgba(80,50,15,0.2)';
        ctx.lineWidth = 0.4;
        for (let i = 0; i < 5; i++) {
            const lx = x + (rng() - 0.5) * tw * 1.2;
            const startY = y - h * (0.05 + rng() * 0.1);
            const endY = y - h * (0.35 + rng() * 0.15);
            ctx.beginPath();
            ctx.moveTo(lx, startY);
            ctx.quadraticCurveTo(lx + (rng() - 0.5) * 1.5, (startY + endY) / 2, lx + sway * 0.15, endY);
            ctx.stroke();
        }
        // Bark knots
        for (let i = 0; i < 2; i++) {
            const kx = x + (rng() - 0.5) * tw * 0.6;
            const ky = y - h * (0.15 + rng() * 0.25);
            ctx.fillStyle = 'rgba(60,35,10,0.25)';
            ctx.beginPath();
            ctx.ellipse(kx, ky, 1.5 + rng(), 1 + rng() * 0.5, rng(), 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Buttress roots (massive, spreading) ---
        for (let i = 0; i < 4; i++) {
            const side = (rng() > 0.5 ? 1 : -1);
            const rootX = x + side * (tw * 0.5 + rng() * 3);
            const rootEndX = rootX + side * (4 + rng() * 6);
            ctx.fillStyle = `rgba(${70 + Math.floor(rng() * 20)},${45 + Math.floor(rng() * 15)},${20 + Math.floor(rng() * 10)},0.6)`;
            ctx.beginPath();
            ctx.moveTo(rootX, y - h * 0.08);
            ctx.quadraticCurveTo(rootEndX * 0.5 + rootX * 0.5, y - 2, rootEndX, y + 1);
            ctx.lineTo(rootEndX - side * 1.5, y + 1);
            ctx.quadraticCurveTo(rootEndX * 0.3 + rootX * 0.7, y - 1, rootX, y - h * 0.02);
            ctx.closePath();
            ctx.fill();
        }

        // --- Aerial roots (hanging) ---
        ctx.lineWidth = 0.6;
        for (let i = 0; i < 5; i++) {
            const rx = x + (rng() - 0.5) * 14 + sway * 0.5;
            const ry = y - h * (0.35 + rng() * 0.2);
            const rootSway = Math.sin(anim * 0.8 + i * 1.7) * 0.8;
            ctx.strokeStyle = `rgba(${90 + Math.floor(rng() * 20)},${65 + Math.floor(rng() * 15)},${35 + Math.floor(rng() * 10)},${0.3 + rng() * 0.2})`;
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.quadraticCurveTo(rx + rootSway + (rng() - 0.5) * 3, (ry + y) * 0.5, rx + rootSway * 0.5 + (rng() - 0.5) * 2, y - rng() * 3);
            ctx.stroke();
        }

        // --- Canopy: back layer (darker, deeper) ---
        const canopyCenterY = y - h * 0.7;
        const darkGreens = ['#145818', '#1a6420', '#1e5e1c', '#185a1a'];
        for (let i = 0; i < 5; i++) {
            const cx = x + (rng() - 0.5) * 16 + sway * 0.6;
            const cy = canopyCenterY - rng() * h * 0.15 + 3;
            const r = 7 + rng() * 8;
            ctx.fillStyle = darkGreens[Math.floor(rng() * darkGreens.length)];
            ctx.beginPath();
            ctx.ellipse(cx, cy, r, r * 0.65, rng() * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Canopy: mid layer ---
        const midGreens = ['#1e7422', '#28842c', '#2a7a28', '#348e34'];
        for (let i = 0; i < 6; i++) {
            const cx = x + (rng() - 0.5) * 14 + sway * 0.8;
            const cy = canopyCenterY - rng() * h * 0.2;
            const r = 6 + rng() * 7;
            ctx.fillStyle = midGreens[Math.floor(rng() * midGreens.length)];
            ctx.beginPath();
            ctx.ellipse(cx, cy, r, r * 0.7, rng() * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Canopy: front highlight layer ---
        const lightGreens = ['#38a838', '#42b842', '#3ca040', '#48c048'];
        for (let i = 0; i < 4; i++) {
            const cx = x + (rng() - 0.5) * 10 + sway + swayFine;
            const cy = canopyCenterY - rng() * h * 0.15 - 2;
            const r = 4 + rng() * 5;
            ctx.fillStyle = lightGreens[Math.floor(rng() * lightGreens.length)];
            ctx.beginPath();
            ctx.ellipse(cx, cy, r, r * 0.65, rng() * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Sunlight dapples on canopy ---
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = `rgba(200,245,120,${0.08 + rng() * 0.06})`;
            ctx.beginPath();
            ctx.ellipse(
                x + (rng() - 0.5) * 12 + sway - 2,
                canopyCenterY - rng() * h * 0.15 - 3,
                3 + rng() * 3, 2 + rng() * 2,
                rng() * Math.PI, 0, Math.PI * 2
            );
            ctx.fill();
        }

        // --- Canopy bottom shadow (volume) ---
        ctx.fillStyle = 'rgba(0,20,0,0.06)';
        ctx.beginPath();
        ctx.ellipse(x + sway * 0.5, canopyCenterY + 8, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();
    },

    // === BIRCH tree — AAA quality (white trunk, elegant drooping branches) ===
    _treeBirch(ctx, x, y, rng, anim) {
        const h = 18 + rng() * 10;
        const sway = Math.sin(anim * 0.7 + x * 0.04) * 1.5;
        const swayFine = Math.sin(anim * 1.5 + x * 0.09) * 0.6;

        // --- Soft shadow ---
        const shadowGrad = ctx.createRadialGradient(x + 1, y + 2, 1, x + 1, y + 2, 10);
        shadowGrad.addColorStop(0, 'rgba(0,0,0,0.14)');
        shadowGrad.addColorStop(0.7, 'rgba(0,0,0,0.06)');
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.ellipse(x + 1, y + 2, 10, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- White trunk with gradient (lit from left) ---
        const trunkGrad = ctx.createLinearGradient(x - 2, y, x + 2, y - h * 0.3);
        trunkGrad.addColorStop(0, '#f0ebe0');
        trunkGrad.addColorStop(0.4, '#e8e2d4');
        trunkGrad.addColorStop(0.7, '#ddd6c8');
        trunkGrad.addColorStop(1, '#d0c8ba');
        ctx.fillStyle = trunkGrad;
        ctx.beginPath();
        ctx.moveTo(x - 2, y);
        ctx.bezierCurveTo(x - 1.8, y - h * 0.25, x - 1.4 + sway * 0.1, y - h * 0.5, x - 1 + sway * 0.15, y - h * 0.75);
        ctx.lineTo(x + 1 + sway * 0.15, y - h * 0.75);
        ctx.bezierCurveTo(x + 1.4 + sway * 0.1, y - h * 0.5, x + 1.8, y - h * 0.25, x + 2, y);
        ctx.closePath();
        ctx.fill();

        // --- Characteristic dark bark bands ---
        for (let i = 0; i < 7; i++) {
            const my = y - h * (0.07 + rng() * 0.6);
            const bandW = 1.5 + rng() * 1.5;
            const bandH = 0.5 + rng() * 0.8;
            ctx.fillStyle = `rgba(${50 + Math.floor(rng() * 20)},${40 + Math.floor(rng() * 15)},${30 + Math.floor(rng() * 10)},${0.25 + rng() * 0.2})`;
            ctx.beginPath();
            ctx.ellipse(x + (rng() - 0.5) * 1.5, my, bandW, bandH, rng() * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Trunk highlight (lit edge) ---
        ctx.fillStyle = 'rgba(255,255,250,0.15)';
        ctx.beginPath();
        ctx.moveTo(x - 1.8, y - h * 0.05);
        ctx.lineTo(x - 1.2 + sway * 0.1, y - h * 0.65);
        ctx.lineTo(x - 0.5 + sway * 0.12, y - h * 0.65);
        ctx.lineTo(x - 0.8, y - h * 0.05);
        ctx.closePath();
        ctx.fill();

        // --- Elegant drooping branches with leaf clusters ---
        const leafDark = ['#4a9828', '#3a8820', '#428e24'];
        const leafMid = ['#5ab830', '#68c840', '#58b028'];
        const leafLight = ['#78d850', '#84e458', '#70d048'];

        const branchCount = 5 + Math.floor(rng() * 3);
        for (let i = 0; i < branchCount; i++) {
            const bx = x + sway * (0.4 + i * 0.08);
            const by = y - h * (0.4 + rng() * 0.35);
            const bendX = bx + (rng() - 0.5) * 18;
            const bendY = by + 5 + rng() * 10;
            const branchSway = Math.sin(anim * 0.9 + i * 2) * 1;

            // Branch line
            ctx.strokeStyle = `rgba(${110 + Math.floor(rng() * 30)},${95 + Math.floor(rng() * 20)},${70 + Math.floor(rng() * 15)},0.4)`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.quadraticCurveTo((bx + bendX) / 2, by + 3 + branchSway, bendX + branchSway, bendY);
            ctx.stroke();

            // Leaf clusters along branch (3 layers: dark → mid → light)
            for (let j = 0; j < 5; j++) {
                const t = j / 4;
                const lx = bx + (bendX + branchSway - bx) * t;
                const ly = by + (bendY - by) * t * t + swayFine;
                const lr = 2.5 + rng() * 2;
                // Dark layer
                ctx.fillStyle = leafDark[Math.floor(rng() * leafDark.length)];
                ctx.beginPath();
                ctx.ellipse(lx + 0.5, ly + 0.5, lr + 0.5, (lr + 0.5) * 0.65, rng() * 0.5, 0, Math.PI * 2);
                ctx.fill();
                // Mid layer
                ctx.fillStyle = leafMid[Math.floor(rng() * leafMid.length)];
                ctx.beginPath();
                ctx.ellipse(lx, ly, lr, lr * 0.65, rng() * 0.5, 0, Math.PI * 2);
                ctx.fill();
                // Light highlight
                if (rng() > 0.4) {
                    ctx.fillStyle = leafLight[Math.floor(rng() * leafLight.length)];
                    ctx.beginPath();
                    ctx.ellipse(lx - lr * 0.2, ly - lr * 0.15, lr * 0.45, lr * 0.35, rng() * 0.3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // --- Crown canopy (top puff) ---
        const crownY = y - h * 0.8;
        ctx.fillStyle = '#3a8820';
        ctx.beginPath();
        ctx.ellipse(x + sway, crownY + 2, 7, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4aa830';
        ctx.beginPath();
        ctx.ellipse(x + sway, crownY, 6, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#68c848';
        ctx.beginPath();
        ctx.ellipse(x + sway - 1.5, crownY - 1.5, 4, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Sunlight on crown
        ctx.fillStyle = 'rgba(200,255,120,0.1)';
        ctx.beginPath();
        ctx.ellipse(x + sway - 2, crownY - 2, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();
    },

    // === BAMBOO cluster — AAA quality ===
    _treeBamboo(ctx, x, y, rng, anim) {
        const stalks = 4 + Math.floor(rng() * 4);

        // --- Soft cluster shadow ---
        const shadowGrad = ctx.createRadialGradient(x, y + 2, 1, x, y + 2, 10 + stalks);
        shadowGrad.addColorStop(0, 'rgba(0,0,0,0.12)');
        shadowGrad.addColorStop(0.7, 'rgba(0,0,0,0.05)');
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.ellipse(x, y + 2, 10 + stalks, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- Fallen bamboo leaves on ground ---
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = `rgba(${130 + Math.floor(rng() * 30)},${140 + Math.floor(rng() * 20)},${60 + Math.floor(rng() * 20)},0.15)`;
            ctx.beginPath();
            ctx.ellipse(x + (rng() - 0.5) * 14, y + (rng() - 0.3) * 4, 2 + rng(), 0.5, rng() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        for (let i = 0; i < stalks; i++) {
            const bx = x + (rng() - 0.5) * 14;
            const h = 16 + rng() * 12;
            const sway = Math.sin(anim * 0.9 + i * 1.5 + bx * 0.05) * 2.5;
            const stalkWidth = 1.6 + rng() * 0.8;

            // Stalk (segmented) with gradient per segment
            const segments = 5 + Math.floor(rng() * 3);
            const hueVar = Math.floor((rng() - 0.5) * 15);
            const stalkGreenR = 70 + hueVar;
            const stalkGreenG = 138 + hueVar;
            const stalkGreenB = 45 + Math.floor(hueVar * 0.5);

            let prevX = bx, prevY = y;
            for (let s = 1; s <= segments; s++) {
                const t = s / segments;
                const nx = bx + sway * t * t;
                const ny = y - h * t;
                const segWidth = stalkWidth * (1 - t * 0.25); // Taper upward

                // Segment with cylindrical shading
                const segGrad = ctx.createLinearGradient(prevX - segWidth, prevY, prevX + segWidth, prevY);
                segGrad.addColorStop(0, `rgb(${stalkGreenR - 15},${stalkGreenG - 20},${stalkGreenB - 10})`);
                segGrad.addColorStop(0.3, `rgb(${stalkGreenR + 10},${stalkGreenG + 15},${stalkGreenB + 5})`);
                segGrad.addColorStop(0.7, `rgb(${stalkGreenR},${stalkGreenG},${stalkGreenB})`);
                segGrad.addColorStop(1, `rgb(${stalkGreenR - 20},${stalkGreenG - 25},${stalkGreenB - 12})`);

                ctx.strokeStyle = segGrad;
                ctx.lineWidth = segWidth * 2;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(prevX, prevY);
                ctx.lineTo(nx, ny);
                ctx.stroke();

                // Node ring (bamboo joint)
                const nodeGrad = ctx.createLinearGradient(nx - segWidth - 1, ny, nx + segWidth + 1, ny);
                nodeGrad.addColorStop(0, `rgb(${stalkGreenR + 15},${stalkGreenG + 20},${stalkGreenB + 10})`);
                nodeGrad.addColorStop(0.5, `rgb(${stalkGreenR + 25},${stalkGreenG + 30},${stalkGreenB + 15})`);
                nodeGrad.addColorStop(1, `rgb(${stalkGreenR + 5},${stalkGreenG + 10},${stalkGreenB})`);
                ctx.fillStyle = nodeGrad;
                ctx.beginPath();
                ctx.ellipse(nx, ny, segWidth + 1, 1.2, 0, 0, Math.PI * 2);
                ctx.fill();

                // Highlight line on stalk
                ctx.strokeStyle = `rgba(255,255,220,0.06)`;
                ctx.lineWidth = 0.3;
                ctx.beginPath();
                ctx.moveTo(prevX - segWidth * 0.3, prevY);
                ctx.lineTo(nx - segWidth * 0.3, ny);
                ctx.stroke();

                prevX = nx;
                prevY = ny;
            }

            // --- Leaf sprays at top and some nodes ---
            const leafSets = 1 + Math.floor(rng() * 2);
            for (let ls = 0; ls < leafSets; ls++) {
                const lx = bx + sway * (0.7 + ls * 0.15);
                const ly = y - h * (0.85 + ls * 0.1);
                const leafCount = 3 + Math.floor(rng() * 3);
                for (let l = 0; l < leafCount; l++) {
                    const angle = (rng() - 0.5) * Math.PI * 0.9;
                    const leafLen = 5 + rng() * 6;
                    const leafSway = Math.sin(anim * 1.2 + l * 2 + i) * 1;
                    const lxEnd = lx + Math.cos(angle) * leafLen * 0.7 + leafSway;
                    const lyEnd = ly + Math.sin(angle) * leafLen * 0.35 - 2;

                    // Dark leaf underside
                    ctx.fillStyle = `rgba(${40 + Math.floor(rng() * 20)},${110 + Math.floor(rng() * 20)},${25},0.5)`;
                    ctx.beginPath();
                    ctx.ellipse(lxEnd + 0.3, lyEnd + 0.3, leafLen * 0.45, 1.3, angle, 0, Math.PI * 2);
                    ctx.fill();
                    // Leaf body
                    ctx.fillStyle = `rgba(${55 + Math.floor(rng() * 25)},${135 + Math.floor(rng() * 25)},${35 + Math.floor(rng() * 10)},0.65)`;
                    ctx.beginPath();
                    ctx.ellipse(lxEnd, lyEnd, leafLen * 0.45, 1.2, angle, 0, Math.PI * 2);
                    ctx.fill();
                    // Light vein
                    ctx.strokeStyle = 'rgba(180,220,100,0.12)';
                    ctx.lineWidth = 0.2;
                    ctx.beginPath();
                    ctx.moveTo(lxEnd - Math.cos(angle) * leafLen * 0.35, lyEnd - Math.sin(angle) * leafLen * 0.15);
                    ctx.lineTo(lxEnd + Math.cos(angle) * leafLen * 0.35, lyEnd + Math.sin(angle) * leafLen * 0.15);
                    ctx.stroke();
                }
            }
        }
        ctx.lineCap = 'butt'; // Reset
    },

    // === FLOWERING tree — AAA quality (tropical, lush) ===
    _treeFlowering(ctx, x, y, rng, anim) {
        const h = 17 + rng() * 8;
        const sway = Math.sin(anim * 0.5 + x * 0.04) * 1;
        const swayFine = Math.sin(anim * 1.3 + x * 0.08) * 0.4;

        // --- Soft shadow ---
        const shadowGrad = ctx.createRadialGradient(x, y + 3, 1, x, y + 3, 12);
        shadowGrad.addColorStop(0, 'rgba(0,0,0,0.16)');
        shadowGrad.addColorStop(0.6, 'rgba(0,0,0,0.07)');
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.ellipse(x, y + 3, 12, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- Trunk with cylindrical shading ---
        const tw = 2.5 + rng();
        const trunkGrad = ctx.createLinearGradient(x - tw, y, x + tw, y - h * 0.4);
        trunkGrad.addColorStop(0, '#5a3818');
        trunkGrad.addColorStop(0.3, '#7a5230');
        trunkGrad.addColorStop(0.6, '#6a4828');
        trunkGrad.addColorStop(1, '#5a3a1a');
        ctx.fillStyle = trunkGrad;
        ctx.beginPath();
        ctx.moveTo(x - tw, y);
        ctx.bezierCurveTo(x - tw * 0.8, y - h * 0.2, x - tw * 0.5 + sway * 0.15, y - h * 0.45, x - 1 + sway * 0.3, y - h * 0.6);
        ctx.lineTo(x + 1 + sway * 0.3, y - h * 0.6);
        ctx.bezierCurveTo(x + tw * 0.5 + sway * 0.15, y - h * 0.45, x + tw * 0.8, y - h * 0.2, x + tw, y);
        ctx.closePath();
        ctx.fill();

        // Bark texture
        ctx.strokeStyle = 'rgba(70,40,12,0.18)';
        ctx.lineWidth = 0.3;
        for (let i = 0; i < 4; i++) {
            const lx = x + (rng() - 0.5) * tw;
            ctx.beginPath();
            ctx.moveTo(lx, y - h * (0.05 + rng() * 0.08));
            ctx.quadraticCurveTo(lx + (rng() - 0.5), y - h * 0.3, lx + sway * 0.1, y - h * (0.4 + rng() * 0.1));
            ctx.stroke();
        }

        // --- Branches visible through foliage ---
        ctx.strokeStyle = '#5a3a1a';
        ctx.lineWidth = 1;
        const branchCount = 3 + Math.floor(rng() * 2);
        const branchEnds = [];
        for (let i = 0; i < branchCount; i++) {
            const bx = x + (rng() - 0.5) * 3 + sway * 0.3;
            const by = y - h * (0.4 + rng() * 0.15);
            const ex = bx + (rng() - 0.5) * 16;
            const ey = by - 4 - rng() * 8;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.quadraticCurveTo((bx + ex) / 2 + (rng() - 0.5) * 3, ey - 2, ex, ey);
            ctx.stroke();
            branchEnds.push({ x: ex, y: ey });
        }

        // --- Foliage: 3 depth layers ---
        const canopyCY = y - h * 0.7;
        // Dark (back)
        const darkLeaf = ['#1a6420', '#226a22', '#1e5e1e'];
        for (let i = 0; i < 5; i++) {
            ctx.fillStyle = darkLeaf[Math.floor(rng() * darkLeaf.length)];
            ctx.beginPath();
            ctx.ellipse(
                x + (rng() - 0.5) * 14 + sway * 0.6,
                canopyCY + (rng() - 0.5) * h * 0.2 + 2,
                5 + rng() * 4, 4 + rng() * 3,
                rng() * 0.5, 0, Math.PI * 2
            );
            ctx.fill();
        }
        // Mid
        const midLeaf = ['#2a7e2a', '#349034', '#2c8430'];
        for (let i = 0; i < 5; i++) {
            ctx.fillStyle = midLeaf[Math.floor(rng() * midLeaf.length)];
            ctx.beginPath();
            ctx.ellipse(
                x + (rng() - 0.5) * 12 + sway * 0.8,
                canopyCY + (rng() - 0.5) * h * 0.18,
                4.5 + rng() * 4, 3.5 + rng() * 2.5,
                rng() * 0.4, 0, Math.PI * 2
            );
            ctx.fill();
        }
        // Light (front)
        const lightLeaf = ['#3a9a3a', '#44aa44', '#3ea040'];
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = lightLeaf[Math.floor(rng() * lightLeaf.length)];
            ctx.beginPath();
            ctx.ellipse(
                x + (rng() - 0.5) * 8 + sway + swayFine,
                canopyCY + (rng() - 0.5) * h * 0.12 - 2,
                3.5 + rng() * 3, 3 + rng() * 2,
                rng() * 0.3, 0, Math.PI * 2
            );
            ctx.fill();
        }

        // --- Flowers: multi-petal with center dot ---
        const flowerPalettes = [
            { petals: ['#e84878', '#f06090', '#ff80a8'], center: '#f0e040' },
            { petals: ['#e0a020', '#f0c040', '#ffe060'], center: '#c06020' },
            { petals: ['#b838d0', '#d058e0', '#e078f0'], center: '#f0e060' },
            { petals: ['#e04040', '#f06050', '#ff8060'], center: '#f0e040' },
        ];
        const palette = flowerPalettes[Math.floor(rng() * flowerPalettes.length)];
        const flowerCount = 8 + Math.floor(rng() * 6);
        for (let i = 0; i < flowerCount; i++) {
            const fx = x + (rng() - 0.5) * 16 + sway + swayFine;
            const fy = canopyCY + (rng() - 0.5) * h * 0.25;
            const fr = 1 + rng() * 1.5;

            // Petals (4-5 small ellipses in a circle)
            const petalCount = 4 + Math.floor(rng() * 2);
            const pCol = palette.petals[Math.floor(rng() * palette.petals.length)];
            for (let p = 0; p < petalCount; p++) {
                const angle = (p / petalCount) * Math.PI * 2 + rng() * 0.3;
                const px = fx + Math.cos(angle) * fr * 0.5;
                const py = fy + Math.sin(angle) * fr * 0.4;
                ctx.fillStyle = pCol;
                ctx.beginPath();
                ctx.ellipse(px, py, fr * 0.5, fr * 0.35, angle, 0, Math.PI * 2);
                ctx.fill();
            }
            // Center
            ctx.fillStyle = palette.center;
            ctx.beginPath();
            ctx.arc(fx, fy, fr * 0.25, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Falling petals (animated) ---
        for (let i = 0; i < 2; i++) {
            const fallPhase = (anim * 0.3 + rng() * 10 + i * 5) % 8;
            if (fallPhase < 4) {
                const fpx = x + (rng() - 0.5) * 20 + Math.sin(anim * 0.5 + i * 3) * 3;
                const fpy = canopyCY + fallPhase * 5 + Math.sin(anim + i * 2) * 1.5;
                ctx.fillStyle = `${palette.petals[0]}88`;
                ctx.beginPath();
                ctx.ellipse(fpx, fpy, 1, 0.5, anim * 0.8 + i, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // --- Sun highlight on canopy ---
        ctx.fillStyle = 'rgba(220,255,140,0.06)';
        ctx.beginPath();
        ctx.ellipse(x + sway - 3, canopyCY - 3, 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();
    },

    // === ACACIA / flat-topped spreading tree — AAA quality ===
    _treeAcacia(ctx, x, y, rng, anim) {
        const h = 18 + rng() * 8;
        const sway = Math.sin(anim * 0.35 + x * 0.03) * 0.8;
        const swayFine = Math.sin(anim * 1.0 + x * 0.06) * 0.4;

        // --- Wide, soft shadow (characteristic flat spread) ---
        const shadowGrad = ctx.createRadialGradient(x, y + 4, 2, x, y + 4, 18);
        shadowGrad.addColorStop(0, 'rgba(0,0,0,0.18)');
        shadowGrad.addColorStop(0.5, 'rgba(0,0,0,0.08)');
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.ellipse(x, y + 4, 18, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- Trunk with gradient and natural curve ---
        const trunkGrad = ctx.createLinearGradient(x - 2, y, x + 2, y - h * 0.5);
        trunkGrad.addColorStop(0, '#4a2e12');
        trunkGrad.addColorStop(0.3, '#6a4420');
        trunkGrad.addColorStop(0.6, '#5a3818');
        trunkGrad.addColorStop(1, '#4a3015');
        ctx.fillStyle = trunkGrad;
        ctx.beginPath();
        ctx.moveTo(x - 1.8, y);
        ctx.bezierCurveTo(x - 0.5, y - h * 0.25, x + 1.5, y - h * 0.5, x + sway, y - h * 0.68);
        ctx.lineTo(x + 2.5 + sway, y - h * 0.68);
        ctx.bezierCurveTo(x + 3.5, y - h * 0.45, x + 2, y - h * 0.2, x + 1.8, y);
        ctx.closePath();
        ctx.fill();

        // Bark detail
        ctx.strokeStyle = 'rgba(60,35,10,0.15)';
        ctx.lineWidth = 0.3;
        for (let i = 0; i < 4; i++) {
            const lx = x + (rng() - 0.5) * 2;
            ctx.beginPath();
            ctx.moveTo(lx, y - h * (0.05 + rng() * 0.1));
            ctx.lineTo(lx + sway * 0.1, y - h * (0.4 + rng() * 0.2));
            ctx.stroke();
        }

        // --- Main spreading branches (visible structure) ---
        const branches = [
            [-16 - rng() * 4, -5 - rng() * 3],
            [14 + rng() * 4, -4 - rng() * 2],
            [-10 - rng() * 3, -10 - rng() * 3],
            [11 + rng() * 3, -9 - rng() * 3],
            [(rng() - 0.5) * 4, -13 - rng() * 3]
        ];
        for (let bi = 0; bi < branches.length; bi++) {
            const [dx, dy] = branches[bi];
            const bWidth = 1.2 - bi * 0.1;
            ctx.strokeStyle = `rgba(${70 + Math.floor(rng() * 20)},${45 + Math.floor(rng() * 15)},${20 + Math.floor(rng() * 10)},0.5)`;
            ctx.lineWidth = bWidth;
            ctx.beginPath();
            ctx.moveTo(x + sway, y - h * 0.68);
            ctx.bezierCurveTo(
                x + dx * 0.3 + sway, y - h * 0.68 + dy * 0.1,
                x + dx * 0.6 + sway, y - h * 0.68 + dy * 0.5,
                x + dx + sway, y - h * 0.68 + dy
            );
            ctx.stroke();
        }

        // --- Flat canopy: 3 depth layers ---
        const canopyY = y - h * 0.76;
        // Back (dark)
        const darkG = ['#1e5a14', '#246418', '#1a5012'];
        for (let i = 0; i < 6; i++) {
            ctx.fillStyle = darkG[Math.floor(rng() * darkG.length)];
            ctx.beginPath();
            ctx.ellipse(
                x + (rng() - 0.5) * 22 + sway * 0.6,
                canopyY + (rng() - 0.5) * 6 + 2,
                8 + rng() * 7, 3 + rng() * 2.5,
                rng() * 0.2, 0, Math.PI * 2
            );
            ctx.fill();
        }
        // Mid
        const midG = ['#2a7418', '#347e22', '#2e7a1e'];
        for (let i = 0; i < 6; i++) {
            ctx.fillStyle = midG[Math.floor(rng() * midG.length)];
            ctx.beginPath();
            ctx.ellipse(
                x + (rng() - 0.5) * 20 + sway * 0.8,
                canopyY + (rng() - 0.5) * 5,
                7 + rng() * 6, 2.5 + rng() * 2,
                rng() * 0.15, 0, Math.PI * 2
            );
            ctx.fill();
        }
        // Front (light)
        const lightG = ['#3e9228', '#48a030', '#429a2c'];
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = lightG[Math.floor(rng() * lightG.length)];
            ctx.beginPath();
            ctx.ellipse(
                x + (rng() - 0.5) * 16 + sway + swayFine,
                canopyY + (rng() - 0.5) * 4 - 1,
                6 + rng() * 5, 2 + rng() * 1.5,
                rng() * 0.1, 0, Math.PI * 2
            );
            ctx.fill();
        }

        // --- Sun highlight on flat top ---
        ctx.fillStyle = 'rgba(180,230,90,0.07)';
        ctx.beginPath();
        ctx.ellipse(x + sway - 3, canopyY - 3, 10, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- Canopy underside shadow (gives volume) ---
        ctx.fillStyle = 'rgba(0,25,0,0.05)';
        ctx.beginPath();
        ctx.ellipse(x + sway * 0.5, canopyY + 6, 14, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- Tiny leaf particles (sparse, edge flutter) ---
        for (let i = 0; i < 2; i++) {
            const lpx = x + (rng() - 0.5) * 22 + sway + Math.sin(anim * 0.7 + i * 4) * 2;
            const lpy = canopyY + (rng() - 0.5) * 4 + Math.sin(anim * 0.5 + i * 3) * 1;
            ctx.fillStyle = `rgba(${60 + Math.floor(rng() * 30)},${140 + Math.floor(rng() * 30)},${30},0.2)`;
            ctx.beginPath();
            ctx.ellipse(lpx, lpy, 1.5, 0.6, rng() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    // === Dense bush / shrub — AAA quality ===
    _treeBush(ctx, x, y, rng, anim) {
        const h = 8 + rng() * 6;
        const sway = Math.sin(anim * 0.8 + x * 0.06) * 0.6;
        const swayFine = Math.sin(anim * 1.5 + x * 0.1) * 0.3;

        // --- Soft ground shadow ---
        const shadowGrad = ctx.createRadialGradient(x, y + 2, 1, x, y + 2, 11);
        shadowGrad.addColorStop(0, 'rgba(0,0,0,0.14)');
        shadowGrad.addColorStop(0.6, 'rgba(0,0,0,0.06)');
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.ellipse(x, y + 2, 11, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- Short trunk (barely visible through foliage) ---
        const trunkGrad = ctx.createLinearGradient(x - 1.5, y, x + 1.5, y - 4);
        trunkGrad.addColorStop(0, '#4a2a10');
        trunkGrad.addColorStop(1, '#6a4020');
        ctx.fillStyle = trunkGrad;
        ctx.beginPath();
        ctx.moveTo(x - 1.2, y);
        ctx.lineTo(x - 0.8, y - 3.5);
        ctx.lineTo(x + 0.8, y - 3.5);
        ctx.lineTo(x + 1.2, y);
        ctx.closePath();
        ctx.fill();

        // --- Dense foliage: 3 depth layers ---
        const darkBush = ['#1e5a12', '#246218', '#1a5210'];
        const midBush = ['#2a7a1a', '#348a24', '#2e8020'];
        const lightBush = ['#40a030', '#4aaa38', '#44a434'];

        // Dark back layer
        for (let i = 0; i < 4 + Math.floor(rng() * 2); i++) {
            ctx.fillStyle = darkBush[Math.floor(rng() * darkBush.length)];
            const bx = x + (rng() - 0.5) * 14 + sway * 0.5;
            const by = y - h * 0.25 - rng() * h * 0.4;
            const r = 4 + rng() * 4.5;
            ctx.beginPath();
            ctx.ellipse(bx + 0.5, by + 0.5, r + 0.5, (r + 0.5) * 0.7, rng() * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
        // Mid layer
        for (let i = 0; i < 4 + Math.floor(rng() * 2); i++) {
            ctx.fillStyle = midBush[Math.floor(rng() * midBush.length)];
            const bx = x + (rng() - 0.5) * 12 + sway * 0.7;
            const by = y - h * 0.3 - rng() * h * 0.4;
            const r = 3.5 + rng() * 4;
            ctx.beginPath();
            ctx.ellipse(bx, by, r, r * 0.72, rng() * 0.2, 0, Math.PI * 2);
            ctx.fill();
        }
        // Front highlight layer
        for (let i = 0; i < 3 + Math.floor(rng() * 2); i++) {
            ctx.fillStyle = lightBush[Math.floor(rng() * lightBush.length)];
            const bx = x + (rng() - 0.5) * 10 + sway + swayFine;
            const by = y - h * 0.35 - rng() * h * 0.3;
            const r = 3 + rng() * 3;
            ctx.beginPath();
            ctx.ellipse(bx, by, r, r * 0.7, rng() * 0.2, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Sunlight dapple on top ---
        ctx.fillStyle = 'rgba(190,240,100,0.06)';
        ctx.beginPath();
        ctx.ellipse(x + sway - 2, y - h * 0.6, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- Berries or small flowers ---
        if (rng() > 0.4) {
            const berryType = rng();
            let berryCol1, berryCol2;
            if (berryType < 0.33) { berryCol1 = '#c03030'; berryCol2 = '#e04848'; } // red
            else if (berryType < 0.66) { berryCol1 = '#3030b0'; berryCol2 = '#5050d0'; } // blue
            else { berryCol1 = '#d0a020'; berryCol2 = '#e0c040'; } // golden

            const berryCount = 3 + Math.floor(rng() * 4);
            for (let i = 0; i < berryCount; i++) {
                const bx = x + (rng() - 0.5) * 12 + sway;
                const by = y - h * (0.15 + rng() * 0.45);
                const br = 0.8 + rng() * 0.6;
                ctx.fillStyle = berryCol1;
                ctx.beginPath();
                ctx.arc(bx, by, br, 0, Math.PI * 2);
                ctx.fill();
                // Tiny highlight
                ctx.fillStyle = berryCol2;
                ctx.beginPath();
                ctx.arc(bx - br * 0.25, by - br * 0.25, br * 0.35, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // --- Edge leaf detail (visible individual leaves at boundary) ---
        for (let i = 0; i < 3; i++) {
            const edgeAngle = rng() * Math.PI * 2;
            const edgeDist = 5 + rng() * 4;
            const elx = x + Math.cos(edgeAngle) * edgeDist + sway;
            const ely = y - h * 0.3 + Math.sin(edgeAngle) * edgeDist * 0.4;
            ctx.fillStyle = `rgba(${50 + Math.floor(rng() * 20)},${120 + Math.floor(rng() * 30)},${25},0.25)`;
            ctx.beginPath();
            ctx.ellipse(elx, ely, 2 + rng(), 1.2 + rng() * 0.5, edgeAngle, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    // ==============================
    //  COORDINATE CONVERSION
    // ==============================
    tileToScreen(tx, ty) {
        return { x: (tx - ty) * this.tileWHalf, y: (tx + ty) * this.tileHHalf };
    },
    screenToTile(sx, sy) {
        // sx/sy are in CSS pixels (from touch/mouse events).
        // Camera and tile math work in canvas pixels, so multiply by DPR.
        const dpr = this._dpr || window.devicePixelRatio || 1;
        const wx = (sx * dpr - this.camera.x) / this.camera.zoom;
        const wy = (sy * dpr - this.camera.y) / this.camera.zoom;
        return {
            x: Math.floor((wx / this.tileWHalf + wy / this.tileHHalf) / 2),
            y: Math.floor((wy / this.tileHHalf - wx / this.tileWHalf) / 2)
        };
    },

    // ==============================
    //  INPUT HANDLING
    // ==============================
    onMouseDown(e) {
        if (e.button === 0) {
            this.isDragging = true;
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.cameraStart = { x: this.camera.x, y: this.camera.y };
            this.dragDistance = 0;
        }
    },
    onMouseMove(e) {
        const r = this.canvas.getBoundingClientRect();
        const mx = e.clientX - r.left, my = e.clientY - r.top;
        this.hoverTile = this.screenToTile(mx, my);
        if (this.isDragging) {
            const dpr = this._dpr || window.devicePixelRatio || 1;
            const dx = (e.clientX - this.dragStart.x) * dpr;
            const dy = (e.clientY - this.dragStart.y) * dpr;
            this.dragDistance = Math.sqrt(dx * dx + dy * dy);
            this.camera.x = this.cameraStart.x + dx;
            this.camera.y = this.cameraStart.y + dy;
        }
        if (!(Game && Game.selectedBuilding)) this.updateTooltip(mx, my);
    },
    onClick(e) {
        if (this.dragDistance > 5) return;
        const r = this.canvas.getBoundingClientRect();
        const tile = this.screenToTile(e.clientX - r.left, e.clientY - r.top);
        if (Game && Game.selectedBuilding) Game.placeBuilding(tile.x, tile.y);
        else Game.selectTile(tile.x, tile.y);
    },
    onWheel(e) {
        e.preventDefault();
        const dpr = this._dpr || window.devicePixelRatio || 1;
        const r = this.canvas.getBoundingClientRect();
        // Convert CSS px → canvas px for zoom center
        const mx = (e.clientX - r.left) * dpr;
        const my = (e.clientY - r.top) * dpr;
        const old = this.camera.zoom;
        this.camera.zoom = Math.max(0.3, Math.min(2.5, old * (e.deltaY > 0 ? 0.9 : 1.1)));
        const ratio = this.camera.zoom / old;
        this.camera.x = mx - (mx - this.camera.x) * ratio;
        this.camera.y = my - (my - this.camera.y) * ratio;
    },
    onTouchStart(e) {
        e.preventDefault();
        const dpr = this._dpr || window.devicePixelRatio || 1;
        if (e.touches.length === 1) {
            this.isDragging = true;
            this.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            this.cameraStart = { x: this.camera.x, y: this.camera.y };
            this.dragDistance = 0;
            this._pinchActive = false;

            this._longPressTimer = setTimeout(() => {
                if (this.dragDistance < 8) {
                    const r = this.canvas.getBoundingClientRect();
                    const t2 = e.touches[0];
                    const mx = t2.clientX - r.left;
                    const my = t2.clientY - r.top;
                    const tile = this.screenToTile(mx, my); // screenToTile already applies DPR
                    this.hoverTile = tile;
                    this.updateTooltip(t2.clientX, t2.clientY - 80);
                    if (navigator.vibrate) navigator.vibrate(30);
                }
            }, 500);
        } else if (e.touches.length === 2) {
            this._pinchActive = true;
            this.isDragging = false;
            if (this._longPressTimer) { clearTimeout(this._longPressTimer); this._longPressTimer = null; }
            const dx = e.touches[1].clientX - e.touches[0].clientX;
            const dy = e.touches[1].clientY - e.touches[0].clientY;
            // Pinch distance in CSS px (ratio, so DPR cancels out)
            this._pinchStartDist = Math.sqrt(dx * dx + dy * dy);
            this._pinchStartZoom = this.camera.zoom;
            // Pinch center in CSS px (will be converted to canvas px when used)
            this._pinchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            this._pinchCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        }
    },
    onTouchMove(e) {
        e.preventDefault();
        const dpr = this._dpr || window.devicePixelRatio || 1;
        if (e.touches.length === 2 && this._pinchActive) {
            const dx = e.touches[1].clientX - e.touches[0].clientX;
            const dy = e.touches[1].clientY - e.touches[0].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const scale = dist / (this._pinchStartDist || 1);
            const newZoom = Math.min(3, Math.max(0.4, this._pinchStartZoom * scale));

            // Zoom toward pinch center — convert CSS px → canvas px
            const r = this.canvas.getBoundingClientRect();
            const pcx = (this._pinchCenterX - r.left) * dpr;
            const pcy = (this._pinchCenterY - r.top) * dpr;
            const worldX = (pcx - this.camera.x) / this.camera.zoom;
            const worldY = (pcy - this.camera.y) / this.camera.zoom;
            this.camera.zoom = newZoom;
            this.camera.x = pcx - worldX * newZoom;
            this.camera.y = pcy - worldY * newZoom;

            // Pan with 2-finger movement — delta in CSS px → canvas px
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            if (this._lastPinchMidX !== undefined) {
                this.camera.x += (midX - this._lastPinchMidX) * dpr;
                this.camera.y += (midY - this._lastPinchMidY) * dpr;
            }
            this._lastPinchMidX = midX;
            this._lastPinchMidY = midY;
        } else if (this.isDragging && e.touches.length === 1) {
            const dx = (e.touches[0].clientX - this.dragStart.x) * dpr;
            const dy = (e.touches[0].clientY - this.dragStart.y) * dpr;
            this.dragDistance = Math.sqrt(dx * dx + dy * dy);
            this.camera.x = this.cameraStart.x + dx;
            this.camera.y = this.cameraStart.y + dy;
            if (this.dragDistance > 8 && this._longPressTimer) {
                clearTimeout(this._longPressTimer);
                this._longPressTimer = null;
            }
        }
    },
    onTouchEnd(e) {
        if (this._longPressTimer) { clearTimeout(this._longPressTimer); this._longPressTimer = null; }
        this._pinchActive = false;
        this._lastPinchMidX = undefined;
        this._lastPinchMidY = undefined;

        if (e.touches.length === 0) {
            if (this.dragDistance < 10) {
                const r = this.canvas.getBoundingClientRect();
                const t = e.changedTouches[0];
                // screenToTile handles DPR internally
                const tile = this.screenToTile(t.clientX - r.left, t.clientY - r.top);
                if (Game && Game.selectedBuilding) {
                    Game.placeBuilding(tile.x, tile.y);
                }
            }
            this.isDragging = false;
        }
    },
    updateTooltip(mx, my) {
        const tip = document.getElementById('building-tooltip');
        const t = this.hoverTile;
        if (t.x >= 0 && t.x < GameData.MAP_SIZE && t.y >= 0 && t.y < GameData.MAP_SIZE) {
            const b = Game.map.buildings[t.y * GameData.MAP_SIZE + t.x];
            if (b && b.id) {
                const d = GameData.BUILDINGS[b.id];
                if (d) {
                    document.getElementById('tooltip-title').textContent = d.icon + ' ' + d.name;
                    document.getElementById('tooltip-desc').textContent = d.desc;
                    let s = '';
                    for (let k in d.production) if (d.production[k] > 0) s += `<div class="tip-stat"><span class="tip-label">${k}</span><span class="tip-val positive">+${d.production[k]}/bln</span></div>`;
                    for (let k in d.effects) if (d.effects[k] > 0) s += `<div class="tip-stat"><span class="tip-label">${k}</span><span class="tip-val positive">+${d.effects[k]}</span></div>`;
                    document.getElementById('tooltip-stats').innerHTML = s;
                    tip.style.display = 'block';
                    tip.style.left = (mx + 20) + 'px';
                    tip.style.top = (my + 70) + 'px';
                    return;
                }
            }
        }
        tip.style.display = 'none';
    },

    // ==============================
    //  DRAWING HELPERS
    // ==============================

    // Isometric box with gradient walls
    _box(ctx, sx, sy, hw, hd, h, topCol, leftCols, rightCols) {
        // Top face
        ctx.fillStyle = topCol;
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd - h);
        ctx.lineTo(sx + hw, sy - h);
        ctx.lineTo(sx, sy + hd - h);
        ctx.lineTo(sx - hw, sy - h);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Left face with gradient
        let gl = ctx.createLinearGradient(sx - hw, sy - h, sx - hw, sy);
        gl.addColorStop(0, leftCols[0]);
        gl.addColorStop(1, leftCols[1]);
        ctx.fillStyle = gl;
        ctx.beginPath();
        ctx.moveTo(sx - hw, sy);
        ctx.lineTo(sx - hw, sy - h);
        ctx.lineTo(sx, sy - hd - h);
        ctx.lineTo(sx, sy - hd);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Right face with gradient
        let gr = ctx.createLinearGradient(sx + hw, sy - h, sx + hw, sy);
        gr.addColorStop(0, rightCols[0]);
        gr.addColorStop(1, rightCols[1]);
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.moveTo(sx + hw, sy);
        ctx.lineTo(sx + hw, sy - h);
        ctx.lineTo(sx, sy - hd - h);
        ctx.lineTo(sx, sy - hd);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    },

    // Hip (pyramid) roof
    _hipRoof(ctx, sx, sy, hw, hd, baseH, roofH, overhang, leftCol, rightCol, topCol) {
        const ow = hw + overhang;
        const od = hd + overhang * 0.5;
        const by = sy - baseH;

        // Left slope
        ctx.fillStyle = leftCol;
        ctx.beginPath();
        ctx.moveTo(sx - ow, by + 1);
        ctx.lineTo(sx, by - od - roofH);
        ctx.lineTo(sx, by - hd);
        ctx.lineTo(sx - hw, by);
        ctx.closePath();
        ctx.fill();

        // Right slope
        ctx.fillStyle = rightCol;
        ctx.beginPath();
        ctx.moveTo(sx + ow, by + 1);
        ctx.lineTo(sx, by - od - roofH);
        ctx.lineTo(sx, by - hd);
        ctx.lineTo(sx + hw, by);
        ctx.closePath();
        ctx.fill();

        // Top surface (front-facing slopes)
        ctx.fillStyle = topCol;
        ctx.beginPath();
        ctx.moveTo(sx, by - od - roofH);
        ctx.lineTo(sx + ow, by + 1);
        ctx.lineTo(sx, by + od + 1);
        ctx.lineTo(sx - ow, by + 1);
        ctx.closePath();
        ctx.fill();
    },

    // Gable roof (ridged)
    _gableRoof(ctx, sx, sy, hw, hd, baseH, roofH, overhang, leftCol, rightCol, ridgeCol) {
        const ow = hw + overhang;
        const od = hd + overhang * 0.5;
        const by = sy - baseH;

        // Left slope
        ctx.fillStyle = leftCol;
        ctx.beginPath();
        ctx.moveTo(sx - ow, by + 1);
        ctx.lineTo(sx - ow * 0.1, by - roofH);
        ctx.lineTo(sx + ow * 0.1, by - roofH);
        ctx.lineTo(sx, by - hd);
        ctx.lineTo(sx - hw, by);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Right slope  
        ctx.fillStyle = rightCol;
        ctx.beginPath();
        ctx.moveTo(sx + ow, by + 1);
        ctx.lineTo(sx + ow * 0.1, by - roofH);
        ctx.lineTo(sx - ow * 0.1, by - roofH);
        ctx.lineTo(sx, by - hd);
        ctx.lineTo(sx + hw, by);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Front face (visible lower part of gable)
        ctx.fillStyle = ridgeCol;
        ctx.beginPath();
        ctx.moveTo(sx - ow * 0.1, by - roofH);
        ctx.lineTo(sx + ow * 0.1, by - roofH);
        ctx.lineTo(sx + ow, by + 1);
        ctx.lineTo(sx, by + od + 1);
        ctx.lineTo(sx - ow, by + 1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    },

    // Ground shadow (ellipse)
    _shadow(ctx, sx, sy, w, h) {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 2, w, h * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
    },

    // Window on left wall
    _windowL(ctx, sx, sy, ox, oy, w, h) {
        // Frame
        ctx.fillStyle = 'rgba(40,30,20,0.5)';
        ctx.fillRect(sx - ox - 0.5, sy - oy - 0.5, w + 1, h + 1);
        // Glass
        const g = ctx.createLinearGradient(sx - ox, sy - oy, sx - ox + w, sy - oy + h);
        g.addColorStop(0, 'rgba(160,210,240,0.8)');
        g.addColorStop(0.5, 'rgba(200,235,255,0.9)');
        g.addColorStop(1, 'rgba(140,190,220,0.7)');
        ctx.fillStyle = g;
        ctx.fillRect(sx - ox, sy - oy, w, h);
        // Reflection
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(sx - ox + 1, sy - oy + 1, w * 0.4, h * 0.5);
    },

    // Window on right wall
    _windowR(ctx, sx, sy, ox, oy, w, h) {
        ctx.fillStyle = 'rgba(40,30,20,0.5)';
        ctx.fillRect(sx + ox - 0.5, sy - oy - 0.5, w + 1, h + 1);
        const g = ctx.createLinearGradient(sx + ox, sy - oy, sx + ox + w, sy - oy + h);
        g.addColorStop(0, 'rgba(130,180,210,0.7)');
        g.addColorStop(0.5, 'rgba(170,210,235,0.8)');
        g.addColorStop(1, 'rgba(110,160,190,0.6)');
        ctx.fillStyle = g;
        ctx.fillRect(sx + ox, sy - oy, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(sx + ox + 1, sy - oy + 1, w * 0.4, h * 0.5);
    },

    // Door
    _door(ctx, x, y, w, h, color) {
        ctx.fillStyle = color || '#5a3a1a';
        ctx.fillRect(x, y - h, w, h);
        // Handle
        ctx.fillStyle = '#c0a040';
        ctx.beginPath();
        ctx.arc(x + w * 0.75, y - h * 0.45, 0.8, 0, Math.PI * 2);
        ctx.fill();
    },

    // Small decorative tree
    _treeSmall(ctx, x, y, h, trunkCol, leafCol) {
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.beginPath();
        ctx.ellipse(x, y + 1, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Trunk
        ctx.fillStyle = trunkCol || '#6a4a2a';
        ctx.fillRect(x - 1.2, y - h * 0.55, 2.4, h * 0.4);
        // Foliage (3 layers)
        for (let i = 0; i < 3; i++) {
            const ly = y - h * 0.45 - i * (h * 0.18);
            const r = (h * 0.3) - i * 1.5;
            ctx.fillStyle = i === 0 ? leafCol : (i === 1 ? this._lighten(leafCol, 15) : this._lighten(leafCol, 30));
            ctx.beginPath();
            ctx.arc(x, ly, r, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    // Dense forest cluster — canvas fallback with multiple trees per tile
    _treeLarge(ctx, x, y, seed) {
        const rng = this._seededRandom(seed);
        const anim = this.animTime || 0;

        // Ground details
        this._groundDetail(ctx, x, y, this._seededRandom(seed + 999));

        // 2-3 trees per tile for density
        const treeCount = 2 + (rng() > 0.55 ? 1 : 0);

        for (let t = 0; t < treeCount; t++) {
            const spread = t === 0 ? 0.5 : 1.0;
            const ox = (rng() - 0.5) * 22 * spread;
            const oy = (rng() - 0.5) * 9 * spread;
            const px = x + ox, py = y + oy;

            const isSecondary = t > 0;
            const typeRoll = rng();

            if (isSecondary && rng() > 0.4) {
                // Secondary trees often bushes/undergrowth
                this._treeBush(ctx, px, py, this._seededRandom(seed + 500 + t * 77), anim);
            } else if (typeRoll < 0.18) {
                this._treeLargeRound(ctx, px, py, this._seededRandom(seed + t * 100 + 1), anim);
            } else if (typeRoll < 0.34) {
                this._treeLargeConifer(ctx, px, py, this._seededRandom(seed + t * 100 + 2), anim);
            } else if (typeRoll < 0.48) {
                this._treeBanyan(ctx, px, py, this._seededRandom(seed + t * 100 + 3), anim);
            } else if (typeRoll < 0.60) {
                this._treeBirch(ctx, px, py, this._seededRandom(seed + t * 100 + 4), anim);
            } else if (typeRoll < 0.70) {
                this._treeAcacia(ctx, px, py, this._seededRandom(seed + t * 100 + 5), anim);
            } else if (typeRoll < 0.80) {
                this._treeBamboo(ctx, px, py, this._seededRandom(seed + t * 100 + 6), anim);
            } else if (typeRoll < 0.90) {
                this._treeFlowering(ctx, px, py, this._seededRandom(seed + t * 100 + 7), anim);
            } else {
                this._treeBush(ctx, px, py, this._seededRandom(seed + t * 100 + 8), anim);
            }
        }

        // Extra undergrowth ferns
        const ugRng = this._seededRandom(seed + 777);
        if (ugRng() > 0.35) {
            const ugCount = 1 + Math.floor(ugRng() * 2);
            for (let u = 0; u < ugCount; u++) {
                const ux = x + (ugRng() - 0.5) * 20;
                const uy = y + (ugRng() - 0.5) * 8;
                const uh = 2 + ugRng() * 2.5;
                ctx.strokeStyle = `rgba(${45 + Math.floor(ugRng() * 20)},${110 + Math.floor(ugRng() * 40)},${28},${0.25 + ugRng() * 0.15})`;
                ctx.lineWidth = 0.5;
                for (let fb = 0; fb < 3; fb++) {
                    const lean = (ugRng() - 0.5) * 2.5;
                    ctx.beginPath();
                    ctx.moveTo(ux + fb - 1, uy);
                    ctx.quadraticCurveTo(ux + lean * 0.4 + fb - 1, uy - uh * 0.6, ux + lean + fb - 1, uy - uh);
                    ctx.stroke();
                }
            }
        }
    },

    // Classic rounded deciduous tree
    _treeLargeRound(ctx, x, y, rng, anim) {
        const h = 17 + rng() * 10;
        const sway = Math.sin(anim * 0.5 + x * 0.04) * 1;
        const swayFine = Math.sin(anim * 1.2 + x * 0.08) * 0.4;

        // --- Soft radial shadow ---
        const shadowGrad = ctx.createRadialGradient(x, y + 3, 1, x, y + 3, 12);
        shadowGrad.addColorStop(0, 'rgba(0,0,0,0.16)');
        shadowGrad.addColorStop(0.6, 'rgba(0,0,0,0.07)');
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.ellipse(x, y + 3, 12, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- Trunk with cylindrical gradient ---
        const tw = 2.5 + rng() * 1.5;
        const trunkGrad = ctx.createLinearGradient(x - tw, y, x + tw, y - h * 0.4);
        trunkGrad.addColorStop(0, '#4a2e12');
        trunkGrad.addColorStop(0.25, '#6a4a28');
        trunkGrad.addColorStop(0.5, '#5a3a18');
        trunkGrad.addColorStop(1, '#4a3015');
        ctx.fillStyle = trunkGrad;
        ctx.beginPath();
        ctx.moveTo(x - tw, y);
        ctx.bezierCurveTo(x - tw * 0.9, y - h * 0.2, x - tw * 0.6, y - h * 0.4, x - tw * 0.35 + sway * 0.2, y - h * 0.52);
        ctx.lineTo(x + tw * 0.35 + sway * 0.2, y - h * 0.52);
        ctx.bezierCurveTo(x + tw * 0.6, y - h * 0.4, x + tw * 0.9, y - h * 0.2, x + tw, y);
        ctx.closePath();
        ctx.fill();

        // Bark texture
        ctx.strokeStyle = 'rgba(40,25,8,0.15)';
        ctx.lineWidth = 0.3;
        for (let i = 0; i < 5; i++) {
            const lx = x + (rng() - 0.5) * tw * 1.1;
            ctx.beginPath();
            ctx.moveTo(lx, y - h * (0.05 + rng() * 0.08));
            ctx.quadraticCurveTo(lx + (rng() - 0.5) * 1, y - h * 0.25, lx + sway * 0.1, y - h * (0.35 + rng() * 0.12));
            ctx.stroke();
        }

        // Trunk highlight
        ctx.fillStyle = 'rgba(255,250,230,0.06)';
        ctx.beginPath();
        ctx.moveTo(x - tw * 0.7, y - h * 0.05);
        ctx.lineTo(x - tw * 0.4 + sway * 0.1, y - h * 0.45);
        ctx.lineTo(x - tw * 0.15 + sway * 0.12, y - h * 0.45);
        ctx.lineTo(x - tw * 0.3, y - h * 0.05);
        ctx.closePath();
        ctx.fill();

        // --- Canopy: 3 depth layers with variety ---
        const canopyCY = y - h * 0.65;
        const palettes = [
            { dark: ['#1a6020', '#1e5a1c'], mid: ['#2a7e2a', '#2e8a30'], light: ['#3ea83a', '#48b844'] },
            { dark: ['#145818', '#185e1c'], mid: ['#228228', '#26882c'], light: ['#38a034', '#40aa3c'] },
            { dark: ['#1e5a20', '#226024'], mid: ['#307a30', '#368434'], light: ['#44a240', '#4cac48'] },
        ];
        const pal = palettes[Math.floor(rng() * palettes.length)];

        // Back dark layer
        for (let i = 0; i < 5; i++) {
            ctx.fillStyle = pal.dark[Math.floor(rng() * pal.dark.length)];
            const ox = (rng() - 0.5) * 12 + sway * 0.5;
            const oy = (rng() - 0.5) * 8;
            const r = 5 + rng() * 5;
            ctx.beginPath();
            ctx.ellipse(x + ox, canopyCY + oy + 2, r, r * 0.8, rng() * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
        // Mid layer
        for (let i = 0; i < 5; i++) {
            ctx.fillStyle = pal.mid[Math.floor(rng() * pal.mid.length)];
            const ox = (rng() - 0.5) * 10 + sway * 0.7;
            const oy = (rng() - 0.5) * 7;
            const r = 4.5 + rng() * 5;
            ctx.beginPath();
            ctx.ellipse(x + ox, canopyCY + oy, r, r * 0.82, rng() * 0.2, 0, Math.PI * 2);
            ctx.fill();
        }
        // Front highlight layer
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = pal.light[Math.floor(rng() * pal.light.length)];
            const ox = (rng() - 0.5) * 8 + sway + swayFine;
            const oy = (rng() - 0.5) * 5;
            const r = 3.5 + rng() * 4;
            ctx.beginPath();
            ctx.ellipse(x + ox, canopyCY + oy - 1, r, r * 0.78, rng() * 0.2, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Sun highlight ---
        ctx.fillStyle = 'rgba(190,250,110,0.07)';
        ctx.beginPath();
        ctx.ellipse(x - 2 + sway, canopyCY - 4, 5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- Canopy underside shadow (volume) ---
        ctx.fillStyle = 'rgba(0,20,0,0.04)';
        ctx.beginPath();
        ctx.ellipse(x + sway * 0.3, canopyCY + 7, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();
    },

    // Classic conifer tree — AAA quality
    _treeLargeConifer(ctx, x, y, rng, anim) {
        const h = 18 + rng() * 10;
        const sway = Math.sin(anim * 0.45 + x * 0.03) * 0.8;

        // --- Soft shadow ---
        const shadowGrad = ctx.createRadialGradient(x, y + 2, 1, x, y + 2, 8);
        shadowGrad.addColorStop(0, 'rgba(0,0,0,0.14)');
        shadowGrad.addColorStop(0.6, 'rgba(0,0,0,0.06)');
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.ellipse(x, y + 2, 8, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- Trunk with gradient ---
        const tw = 2 + rng();
        const trunkGrad = ctx.createLinearGradient(x - tw / 2, y, x + tw / 2, y - h * 0.35);
        trunkGrad.addColorStop(0, '#4a2e12');
        trunkGrad.addColorStop(0.4, '#6a4a28');
        trunkGrad.addColorStop(1, '#5a3818');
        ctx.fillStyle = trunkGrad;
        ctx.beginPath();
        ctx.moveTo(x - tw / 2, y);
        ctx.lineTo(x - tw / 2 + 0.3, y - h * 0.35);
        ctx.lineTo(x + tw / 2 - 0.3, y - h * 0.35);
        ctx.lineTo(x + tw / 2, y);
        ctx.closePath();
        ctx.fill();

        // Bark rings
        ctx.strokeStyle = 'rgba(80,50,20,0.12)';
        ctx.lineWidth = 0.3;
        for (let i = 0; i < 3; i++) {
            const ry = y - h * (0.08 + rng() * 0.22);
            ctx.beginPath();
            ctx.moveTo(x - tw / 2, ry);
            ctx.lineTo(x + tw / 2, ry);
            ctx.stroke();
        }

        // --- Layered conifer foliage with depth ---
        const layers = 5 + Math.floor(rng() * 2);
        const darkGreens = ['#0e4210', '#124a14', '#164e18'];
        const midGreens = ['#1a5a18', '#1e6820', '#227220'];
        const lightGreens = ['#2a8028', '#308a30', '#369438'];

        for (let i = 0; i < layers; i++) {
            const t = i / layers;
            const baseY = y - h * 0.28 - t * h * 0.13;
            const tipY = baseY - h * 0.18;
            const bw = (10 - i * 1.3) + rng() * 2;
            const layerSway = sway * (1 + t * 0.3);

            // Dark (back) triangle
            ctx.fillStyle = darkGreens[i % darkGreens.length];
            ctx.beginPath();
            ctx.moveTo(x + layerSway, tipY + 1);
            ctx.lineTo(x + bw + 1 + layerSway * 0.8, baseY + 1);
            ctx.lineTo(x - bw - 1 + layerSway * 0.8, baseY + 1);
            ctx.closePath();
            ctx.fill();

            // Mid triangle
            ctx.fillStyle = midGreens[i % midGreens.length];
            ctx.beginPath();
            ctx.moveTo(x + layerSway, tipY);
            ctx.lineTo(x + bw + layerSway * 0.9, baseY);
            ctx.lineTo(x - bw + layerSway * 0.9, baseY);
            ctx.closePath();
            ctx.fill();

            // Light edge (sun-facing side)
            ctx.fillStyle = lightGreens[i % lightGreens.length];
            ctx.beginPath();
            ctx.moveTo(x + layerSway, tipY);
            ctx.lineTo(x - bw * 0.7 + layerSway * 0.9, baseY);
            ctx.lineTo(x - bw + layerSway * 0.9, baseY);
            ctx.closePath();
            ctx.fill();

            // Branch edge texture (zigzag)
            ctx.strokeStyle = `rgba(${20 + i * 8},${70 + i * 12},${18 + i * 6},0.15)`;
            ctx.lineWidth = 0.4;
            ctx.beginPath();
            for (let j = 0; j < 5; j++) {
                const jt = j / 4;
                const jx = (x - bw + layerSway * 0.9) + jt * bw * 2;
                const jy = baseY + Math.sin(j * 2.5) * 1;
                if (j === 0) ctx.moveTo(jx, jy);
                else ctx.lineTo(jx, jy);
            }
            ctx.stroke();
        }

        // --- Top spike ---
        ctx.fillStyle = midGreens[0];
        ctx.beginPath();
        ctx.moveTo(x + sway * 1.3, y - h + 2);
        ctx.lineTo(x + 2 + sway * 1.1, y - h * 0.82);
        ctx.lineTo(x - 2 + sway * 1.1, y - h * 0.82);
        ctx.closePath();
        ctx.fill();

        // --- Sun highlight on left side ---
        ctx.fillStyle = 'rgba(180,240,100,0.05)';
        ctx.beginPath();
        ctx.moveTo(x + sway, y - h * 0.9);
        ctx.lineTo(x - 5 + sway * 0.8, y - h * 0.5);
        ctx.lineTo(x - 2 + sway * 0.8, y - h * 0.5);
        ctx.closePath();
        ctx.fill();
    },

    // Palm tree
    _palmTree(ctx, x, y, h, anim) {
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.beginPath();
        ctx.ellipse(x + 4, y + 2, 10, 4, 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Curved trunk
        ctx.strokeStyle = '#7a5a30';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 3, y - h * 0.5, x + 1, y - h);
        ctx.stroke();
        ctx.strokeStyle = '#8a6a3a';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Fronds
        const frondCount = 7;
        for (let i = 0; i < frondCount; i++) {
            const angle = (i / frondCount) * Math.PI * 2 + anim * 0.2;
            const fx = x + 1 + Math.cos(angle) * 14;
            const fy = y - h + Math.sin(angle) * 5 - 2;
            const sway = Math.sin(anim * 0.8 + i) * 2;

            ctx.strokeStyle = i % 2 === 0 ? '#2a7a20' : '#38922a';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(x + 1, y - h);
            ctx.quadraticCurveTo(fx + sway, fy - 4, fx + sway * 1.5, fy + 2);
            ctx.stroke();
        }

        // Coconuts
        ctx.fillStyle = '#6a4a20';
        ctx.beginPath();
        ctx.arc(x + 1, y - h + 3, 2.2, 0, Math.PI * 2);
        ctx.arc(x + 3, y - h + 2, 2, 0, Math.PI * 2);
        ctx.fill();
    },

    // Flower cluster
    _flowers(ctx, x, y, type, anim) {
        const colors = type === 0 ? ['#e06090','#f080a0'] : type === 1 ? ['#f0d040','#f0e070'] : ['#d060e0','#e080f0'];
        for (let i = 0; i < 4; i++) {
            const fx = x + (i - 1.5) * 3 + Math.sin(anim + i) * 0.5;
            const fy = y - 1 + Math.cos(anim * 0.7 + i) * 0.3;
            // Stem
            ctx.strokeStyle = '#3a8030';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(fx, fy + 2);
            ctx.lineTo(fx, fy - 1);
            ctx.stroke();
            // Petals
            ctx.fillStyle = colors[i % 2];
            ctx.beginPath();
            ctx.arc(fx, fy - 2, 1.8, 0, Math.PI * 2);
            ctx.fill();
            // Center
            ctx.fillStyle = '#f0e060';
            ctx.beginPath();
            ctx.arc(fx, fy - 2, 0.7, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    // Fence segment
    _fence(ctx, x1, y1, x2, y2, color) {
        ctx.strokeStyle = color || '#c0a870';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        // Posts
        ctx.fillStyle = color || '#c0a870';
        ctx.fillRect(x1 - 1, y1 - 4, 2, 5);
        ctx.fillRect(x2 - 1, y2 - 4, 2, 5);
        // Mid post
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        ctx.fillRect(mx - 0.8, my - 3.5, 1.6, 4.5);
    },

    // Utility: seeded random
    _seededRandom(seed) {
        let s = seed;
        return function() {
            s = (s * 16807 + 0) % 2147483647;
            return (s - 1) / 2147483646;
        };
    },

    // Utility: lighten a hex color
    _lighten(hex, amount) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.min(255, (num >> 16) + amount);
        const g = Math.min(255, ((num >> 8) & 0xff) + amount);
        const b = Math.min(255, (num & 0xff) + amount);
        return `rgb(${r},${g},${b})`;
    },

    // Utility: darken
    _darken(hex, amount) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.max(0, (num >> 16) - amount);
        const g = Math.max(0, ((num >> 8) & 0xff) - amount);
        const b = Math.max(0, (num & 0xff) - amount);
        return `rgb(${r},${g},${b})`;
    },

    // ==============================
    //  TERRAIN RENDERING
    // ==============================
    renderTile(ctx, x, y) {
        const scr = this.tileToScreen(x, y);
        const sx = scr.x, sy = scr.y;
        const tw = this.TW, th = this.TH;
        const tileType = Game.map.tiles[y * GameData.MAP_SIZE + x];

        // Use sprites if loaded
        if (this.spritesLoaded) {
            switch (tileType) {
                case GameData.TILE.GRASS:
                    if (this._drawTerrainSprite(ctx, sx, sy, 'grass')) {
                        this._addGrassDetails(ctx, sx, sy, x, y);
                        return;
                    }
                    break;
                case GameData.TILE.FOREST:
                    if (this._drawTerrainSprite(ctx, sx, sy, 'grass')) return;
                    break;
                case GameData.TILE.WATER:
                    if (this._drawTerrainSprite(ctx, sx, sy, 'water')) {
                        this._addWaterEffects(ctx, sx, sy, x, y);
                        return;
                    }
                    break;
                case GameData.TILE.DIRT:
                    if (this._drawTerrainSprite(ctx, sx, sy, 'dirt')) return;
                    break;
                case GameData.TILE.ROAD:
                    if (this._renderRoadWithSprites(ctx, sx, sy, x, y)) return;
                    break;
                case GameData.TILE.FARMLAND:
                    if (this._drawTerrainSprite(ctx, sx, sy, 'grass')) {
                        this._addFarmlandOverlay(ctx, sx, sy, x, y);
                        return;
                    }
                    break;
                case GameData.TILE.BRIDGE:
                    if (this._drawTerrainSprite(ctx, sx, sy, 'water')) return;
                    break;
            }
        }

        // Fallback to canvas rendering
        switch (tileType) {
            case GameData.TILE.GRASS: this._renderGrass(ctx, sx, sy, tw, th, x, y); break;
            case GameData.TILE.FOREST: this._renderForest(ctx, sx, sy, tw, th, x, y); break;
            case GameData.TILE.WATER: this._renderWater(ctx, sx, sy, tw, th, x, y); break;
            case GameData.TILE.DIRT: this._renderDirt(ctx, sx, sy, tw, th, x, y); break;
            case GameData.TILE.ROAD: this._renderRoad(ctx, sx, sy, tw, th, x, y); break;
            case GameData.TILE.FARMLAND: this._renderFarmland(ctx, sx, sy, tw, th, x, y); break;
            case GameData.TILE.BRIDGE: this._renderWater(ctx, sx, sy, tw, th, x, y); break;
            default: this._renderGrass(ctx, sx, sy, tw, th, x, y);
        }
    },

    _tileDiamond(ctx, sx, sy, tw, th) {
        ctx.beginPath();
        ctx.moveTo(sx, sy - th / 2);
        ctx.lineTo(sx + tw / 2, sy);
        ctx.lineTo(sx, sy + th / 2);
        ctx.lineTo(sx - tw / 2, sy);
        ctx.closePath();
    },

    _renderGrass(ctx, sx, sy, tw, th, tx, ty) {
        const rng = this._seededRandom(tx * 31 + ty * 17);
        const hw = tw / 2, hh = th / 2;

        // --- Per-tile color variation (natural patchiness) ---
        const hueShift = (rng() - 0.5) * 15;    // ±15 color variation
        const valShift = (rng() - 0.5) * 12;     // ±12 brightness variation
        const baseR = Math.round(78 + hueShift * 0.3 + valShift);
        const baseG = Math.round(175 + hueShift + valShift);
        const baseB = Math.round(62 + hueShift * 0.2);

        // --- Multi-stop gradient simulating sun angle (top-left light) ---
        const g = ctx.createLinearGradient(sx - hw, sy - hh, sx + hw * 0.5, sy + hh * 0.5);
        g.addColorStop(0, `rgb(${baseR + 18},${baseG + 22},${baseB + 8})`);
        g.addColorStop(0.35, `rgb(${baseR + 8},${baseG + 12},${baseB + 4})`);
        g.addColorStop(0.65, `rgb(${baseR},${baseG},${baseB})`);
        g.addColorStop(1, `rgb(${Math.max(0, baseR - 12)},${Math.max(0, baseG - 15)},${Math.max(0, baseB - 8)})`);
        this._tileDiamond(ctx, sx, sy, tw, th);
        ctx.fillStyle = g;
        ctx.fill();

        // Clip for internal details
        ctx.save();
        this._tileDiamond(ctx, sx, sy, tw, th);
        ctx.clip();

        // --- Secondary color patches (clumps of different grass species) ---
        const patches = 1 + Math.floor(rng() * 2);
        for (let p = 0; p < patches; p++) {
            const px = sx + (rng() - 0.5) * tw * 0.6;
            const py = sy + (rng() - 0.5) * th * 0.5;
            const pr = 6 + rng() * 8;
            const pShade = rng() > 0.5 ? 15 : -10;
            ctx.fillStyle = `rgba(${baseR + pShade},${baseG + pShade + 5},${baseB + pShade * 0.3},0.25)`;
            ctx.beginPath();
            ctx.ellipse(px, py, pr, pr * 0.5, rng() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Subtle directional light/shadow (simulates terrain undulation) ---
        const lightAngle = 0.7; // sun from upper-left
        ctx.fillStyle = 'rgba(255,255,240,0.04)';
        ctx.beginPath();
        ctx.ellipse(sx - hw * 0.2, sy - hh * 0.25, hw * 0.5, hh * 0.4, lightAngle, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,30,0,0.03)';
        ctx.beginPath();
        ctx.ellipse(sx + hw * 0.2, sy + hh * 0.2, hw * 0.4, hh * 0.3, lightAngle, 0, Math.PI * 2);
        ctx.fill();

        // --- Grass blade clusters (varied heights, directions, density) ---
        const bladeClusters = 3 + Math.floor(rng() * 4);
        for (let c = 0; c < bladeClusters; c++) {
            const cx = sx + (rng() - 0.5) * tw * 0.7;
            const cy = sy + (rng() - 0.5) * th * 0.55;
            const bladeCount = 3 + Math.floor(rng() * 4);
            const clusterGreen = baseG + Math.floor((rng() - 0.5) * 30);

            for (let b = 0; b < bladeCount; b++) {
                const bx = cx + (rng() - 0.5) * 5;
                const by = cy + (rng() - 0.5) * 2;
                const bladeH = 2.5 + rng() * 3.5;
                const lean = (rng() - 0.5) * 2.5;
                const thick = 0.4 + rng() * 0.4;

                const bladeR = Math.round(50 + rng() * 30);
                const bladeB2 = Math.round(20 + rng() * 20);
                ctx.strokeStyle = `rgba(${bladeR},${Math.min(255, clusterGreen)},${bladeB2},${0.35 + rng() * 0.25})`;
                ctx.lineWidth = thick;
                ctx.beginPath();
                ctx.moveTo(bx, by);
                ctx.quadraticCurveTo(bx + lean * 0.4, by - bladeH * 0.6, bx + lean, by - bladeH);
                ctx.stroke();
            }
        }

        // --- Micro-detail: small wildflowers ---
        if (rng() > 0.65) {
            const flowerCount = 1 + Math.floor(rng() * 3);
            const flowerCols = ['#e8e060', '#e080a0', '#f0f0f0', '#a0a0ff', '#ffb0c0'];
            for (let f = 0; f < flowerCount; f++) {
                const fx = sx + (rng() - 0.5) * tw * 0.6;
                const fy = sy + (rng() - 0.5) * th * 0.4;
                const fCol = flowerCols[Math.floor(rng() * flowerCols.length)];
                // Tiny stem
                ctx.strokeStyle = `rgba(${baseR - 20},${baseG - 10},${baseB - 15},0.4)`;
                ctx.lineWidth = 0.3;
                ctx.beginPath();
                ctx.moveTo(fx, fy);
                ctx.lineTo(fx, fy - 2.5);
                ctx.stroke();
                // Petals
                ctx.fillStyle = fCol;
                ctx.beginPath();
                ctx.arc(fx, fy - 2.8, 0.9 + rng() * 0.5, 0, Math.PI * 2);
                ctx.fill();
                // Center
                ctx.fillStyle = '#f0e040';
                ctx.beginPath();
                ctx.arc(fx, fy - 2.8, 0.35, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // --- Micro-detail: small pebbles/clover ---
        if (rng() > 0.75) {
            const stoneCol = `rgba(${130 + Math.floor(rng() * 30)},${120 + Math.floor(rng() * 20)},${100 + Math.floor(rng() * 20)},0.25)`;
            ctx.fillStyle = stoneCol;
            ctx.beginPath();
            ctx.ellipse(sx + (rng() - 0.5) * tw * 0.5, sy + (rng() - 0.3) * th * 0.3, 1.5 + rng(), 0.8 + rng() * 0.4, rng() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        // --- Tile edge ambient occlusion (subtle darkening at edges) ---
        ctx.strokeStyle = 'rgba(40,80,30,0.08)';
        ctx.lineWidth = 0.6;
        this._tileDiamond(ctx, sx, sy, tw, th);
        ctx.stroke();
    },

    _renderForest(ctx, sx, sy, tw, th, tx, ty) {
        const rng = this._seededRandom(tx * 41 + ty * 23);
        const hw = tw / 2, hh = th / 2;

        // --- Darker, richer forest floor color ---
        const hueShift = (rng() - 0.5) * 10;
        const valShift = (rng() - 0.5) * 8;
        const baseR = Math.round(48 + hueShift * 0.3 + valShift);
        const baseG = Math.round(120 + hueShift + valShift);
        const baseB = Math.round(38 + hueShift * 0.2);

        const g = ctx.createLinearGradient(sx - hw, sy - hh, sx + hw * 0.5, sy + hh * 0.5);
        g.addColorStop(0, `rgb(${baseR + 12},${baseG + 14},${baseB + 6})`);
        g.addColorStop(0.4, `rgb(${baseR + 4},${baseG + 6},${baseB + 2})`);
        g.addColorStop(0.7, `rgb(${baseR},${baseG},${baseB})`);
        g.addColorStop(1, `rgb(${Math.max(0, baseR - 10)},${Math.max(0, baseG - 12)},${Math.max(0, baseB - 6)})`);
        this._tileDiamond(ctx, sx, sy, tw, th);
        ctx.fillStyle = g;
        ctx.fill();

        ctx.save();
        this._tileDiamond(ctx, sx, sy, tw, th);
        ctx.clip();

        // --- Dappled sunlight patches (light filtering through canopy) ---
        const dapples = 2 + Math.floor(rng() * 3);
        for (let d = 0; d < dapples; d++) {
            const dx = sx + (rng() - 0.5) * tw * 0.6;
            const dy = sy + (rng() - 0.5) * th * 0.4;
            const dr = 3 + rng() * 5;
            ctx.fillStyle = `rgba(180,220,100,${0.06 + rng() * 0.04})`;
            ctx.beginPath();
            ctx.ellipse(dx, dy, dr, dr * 0.5, rng() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Shadow pools (from tree canopy above) ---
        const shadows = 1 + Math.floor(rng() * 2);
        for (let s = 0; s < shadows; s++) {
            const shx = sx + (rng() - 0.5) * tw * 0.5;
            const shy = sy + (rng() - 0.5) * th * 0.35;
            ctx.fillStyle = `rgba(15,40,10,${0.06 + rng() * 0.04})`;
            ctx.beginPath();
            ctx.ellipse(shx, shy, 4 + rng() * 5, 2 + rng() * 3, rng(), 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Forest floor debris: fallen leaves, twigs, moss ---
        const leafColors = ['rgba(100,70,20,0.2)', 'rgba(140,100,30,0.18)', 'rgba(80,60,15,0.22)', 'rgba(120,90,25,0.15)'];
        const leafCount = 2 + Math.floor(rng() * 4);
        for (let l = 0; l < leafCount; l++) {
            ctx.fillStyle = leafColors[Math.floor(rng() * leafColors.length)];
            ctx.beginPath();
            ctx.ellipse(
                sx + (rng() - 0.5) * tw * 0.6,
                sy + (rng() - 0.5) * th * 0.4,
                1 + rng() * 1.5, 0.6 + rng() * 0.5,
                rng() * Math.PI, 0, Math.PI * 2
            );
            ctx.fill();
        }

        // --- Moss patches (deep green) ---
        if (rng() > 0.5) {
            ctx.fillStyle = `rgba(30,90,25,${0.12 + rng() * 0.06})`;
            ctx.beginPath();
            ctx.ellipse(sx + (rng() - 0.5) * 12, sy + (rng() - 0.3) * 6, 4 + rng() * 4, 2 + rng() * 2, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Low undergrowth ferns/grass ---
        const fernCount = 2 + Math.floor(rng() * 3);
        for (let f = 0; f < fernCount; f++) {
            const fx = sx + (rng() - 0.5) * tw * 0.6;
            const fy = sy + (rng() - 0.5) * th * 0.4;
            const fh = 2 + rng() * 2;
            ctx.strokeStyle = `rgba(${40 + Math.floor(rng() * 20)},${100 + Math.floor(rng() * 30)},${25},0.3)`;
            ctx.lineWidth = 0.4;
            for (let fb = 0; fb < 3; fb++) {
                const lean = (rng() - 0.5) * 3;
                ctx.beginPath();
                ctx.moveTo(fx + fb - 1, fy);
                ctx.quadraticCurveTo(fx + lean + fb - 1, fy - fh * 0.6, fx + lean * 1.5 + fb - 1, fy - fh);
                ctx.stroke();
            }
        }

        ctx.restore();

        ctx.strokeStyle = 'rgba(30,60,25,0.1)';
        ctx.lineWidth = 0.6;
        this._tileDiamond(ctx, sx, sy, tw, th);
        ctx.stroke();
    },

    _renderWater(ctx, sx, sy, tw, th, tx, ty) {
        const t = this.animTime;
        const hw = tw / 2, hh = th / 2;

        // Check depth (surrounded by more water = deeper)
        const size = GameData.MAP_SIZE;
        let waterNeighbors = 0;
        const dirs8 = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
        for (const [dx, dy] of dirs8) {
            const nx = tx + dx, ny = ty + dy;
            if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
                if (Game.map.tiles[ny * size + nx] === GameData.TILE.WATER) waterNeighbors++;
            }
        }
        const depth = waterNeighbors / 8; // 0 = shallow, 1 = deep

        // Slow wave oscillations
        const w1 = Math.sin(t * 1.2 + tx * 0.8 + ty * 0.6);
        const w2 = Math.sin(t * 0.9 - tx * 0.5 + ty * 1.1);
        const w3 = Math.sin(t * 1.8 + tx * 0.3 - ty * 0.9);

        // Clip to tile diamond
        ctx.save();
        this._tileDiamond(ctx, sx, sy, tw, th);
        ctx.clip();

        // Base water color (deeper = darker blue, shallower = lighter turquoise)
        const deepR = 30 + w1 * 5, deepG = 90 + w1 * 8 + depth * 20, deepB = 160 + w1 * 10;
        const shallowR = 60 + w2 * 6, shallowG = 160 + w2 * 8, shallowB = 200 + w2 * 6;
        const r = Math.round(shallowR + (deepR - shallowR) * depth);
        const g = Math.round(shallowG + (deepG - shallowG) * depth);
        const b = Math.round(shallowB + (deepB - shallowB) * depth);

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(sx - hw, sy - hh, tw, th);

        // Layered wave ripples (3 layers for depth)
        for (let layer = 0; layer < 3; layer++) {
            const speed = 0.8 + layer * 0.5;
            const amp = 2 + layer * 0.8;
            const freq = 0.25 + layer * 0.1;
            const alpha = 0.08 - layer * 0.02;
            const bright = layer === 0 ? 200 : (layer === 1 ? 180 : 160);

            ctx.strokeStyle = `rgba(${bright},${bright + 30},255,${alpha + w1 * 0.02})`;
            ctx.lineWidth = 1.2 - layer * 0.3;
            ctx.beginPath();
            for (let i = -hw; i <= hw; i += 2) {
                const waveY = Math.sin(t * speed + i * freq + tx + layer * 2) * amp;
                const px = sx + i;
                const py = sy + waveY + (layer - 1) * 3;
                if (i === -hw) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
        }

        // Light caustics (dancing light patches underwater)
        const causticCount = 3 + Math.floor(depth * 3);
        const rng = this._seededRandom(tx * 47 + ty * 89);
        for (let i = 0; i < causticCount; i++) {
            const baseX = (rng() - 0.5) * tw * 0.8;
            const baseY = (rng() - 0.5) * th * 0.6;
            const cx = sx + baseX + Math.sin(t * 1.5 + i * 2.3) * 3;
            const cy = sy + baseY + Math.cos(t * 1.2 + i * 1.7) * 1.5;
            const cr = 2.5 + rng() * 3 + Math.sin(t * 2 + i) * 0.8;
            const ca = 0.06 + Math.sin(t * 1.8 + i * 1.3) * 0.03;
            ctx.fillStyle = `rgba(200,240,255,${ca})`;
            ctx.beginPath();
            ctx.ellipse(cx, cy, cr, cr * 0.5, rng() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        // Main specular reflection (sun glint)
        const glintX = sx + w1 * 5 - 2;
        const glintY = sy - 1 + w2 * 2;
        const glintR = 5 + w3 * 1.5;
        const glintAlpha = 0.12 + w3 * 0.05;
        ctx.fillStyle = `rgba(255,255,255,${glintAlpha})`;
        ctx.beginPath();
        ctx.ellipse(glintX, glintY, glintR, glintR * 0.35, 0.4 + w1 * 0.1, 0, Math.PI * 2);
        ctx.fill();

        // Secondary glint
        if (depth > 0.3) {
            ctx.fillStyle = `rgba(220,240,255,${0.06 + w2 * 0.03})`;
            ctx.beginPath();
            ctx.ellipse(sx - 6 + w2 * 3, sy + 3 + w1 * 1.5, 4, 1.5, -0.3, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore(); // Remove clip

        // Shore foam effects
        this._drawShoreEffect(ctx, sx, sy, tw, th, tx, ty);
    },

    _drawShoreEffect(ctx, sx, sy, tw, th, tx, ty) {
        const size = GameData.MAP_SIZE;
        const t = this.animTime;
        const hw = tw / 2, hh = th / 2;

        // 4 cardinal directions with proper isometric offsets
        const dirs = [
            [-1, 0, -hw * 0.65, -hh * 0.35, 0.5],   // top-left edge
            [1, 0,  hw * 0.65,  hh * 0.35, 0.5],     // bottom-right edge
            [0, -1, hw * 0.65, -hh * 0.35, -0.5],    // top-right edge
            [0, 1, -hw * 0.65,  hh * 0.35, -0.5],    // bottom-left edge
        ];

        for (const [dx, dy, ox, oy, angle] of dirs) {
            const nx = tx + dx, ny = ty + dy;
            if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
            const nt = Game.map.tiles[ny * size + nx];
            if (nt === GameData.TILE.WATER) continue;

            // Animated foam line at shore edge
            const foamWave = Math.sin(t * 2 + tx * 1.2 + ty * 0.8) * 1.5;

            // Sandy shore gradient
            ctx.save();
            this._tileDiamond(ctx, sx, sy, tw, th);
            ctx.clip();

            // Beach sand at water edge
            ctx.fillStyle = 'rgba(200,190,150,0.15)';
            ctx.beginPath();
            ctx.ellipse(sx + ox * 1.1, sy + oy * 1.1, 10, 4, angle, 0, Math.PI * 2);
            ctx.fill();

            // White foam
            ctx.fillStyle = `rgba(240,248,255,${0.2 + Math.sin(t * 2.5 + dx * 3) * 0.08})`;
            ctx.beginPath();
            ctx.ellipse(sx + ox + foamWave * 0.3, sy + oy + foamWave * 0.15, 8, 2.2, angle, 0, Math.PI * 2);
            ctx.fill();

            // Foam dots
            for (let i = 0; i < 3; i++) {
                const fx = sx + ox + (Math.sin(t * 1.5 + i * 2) - 0.5) * 6;
                const fy = sy + oy + (Math.cos(t * 1.2 + i * 2.5) - 0.5) * 2.5;
                ctx.fillStyle = `rgba(255,255,255,${0.12 + Math.sin(t * 3 + i) * 0.05})`;
                ctx.beginPath();
                ctx.arc(fx, fy, 1 + Math.sin(t * 2 + i * 1.5) * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    },

    _renderDirt(ctx, sx, sy, tw, th, tx, ty) {
        const rng = this._seededRandom(tx * 23 + ty * 41);
        const hw = tw / 2, hh = th / 2;

        // --- Per-tile color variation ---
        const hueShift = (rng() - 0.5) * 12;
        const valShift = (rng() - 0.5) * 10;
        const baseR = Math.round(155 + hueShift + valShift);
        const baseG = Math.round(130 + hueShift * 0.7 + valShift);
        const baseB = Math.round(85 + hueShift * 0.3);

        // Multi-stop gradient with directional lighting
        const g = ctx.createLinearGradient(sx - hw, sy - hh, sx + hw * 0.5, sy + hh * 0.5);
        g.addColorStop(0, `rgb(${baseR + 15},${baseG + 12},${baseB + 10})`);
        g.addColorStop(0.4, `rgb(${baseR + 5},${baseG + 4},${baseB + 3})`);
        g.addColorStop(0.7, `rgb(${baseR},${baseG},${baseB})`);
        g.addColorStop(1, `rgb(${Math.max(0, baseR - 12)},${Math.max(0, baseG - 10)},${Math.max(0, baseB - 8)})`);
        this._tileDiamond(ctx, sx, sy, tw, th);
        ctx.fillStyle = g;
        ctx.fill();

        ctx.save();
        this._tileDiamond(ctx, sx, sy, tw, th);
        ctx.clip();

        // --- Soil texture: subtle color patches (clay, sand, humus) ---
        const soilPatches = 2 + Math.floor(rng() * 3);
        for (let p = 0; p < soilPatches; p++) {
            const px = sx + (rng() - 0.5) * tw * 0.6;
            const py = sy + (rng() - 0.5) * th * 0.4;
            const pr = 4 + rng() * 6;
            const pType = rng();
            let pCol;
            if (pType < 0.33) pCol = `rgba(${baseR + 15},${baseG + 8},${baseB + 12},0.15)`; // sandy
            else if (pType < 0.66) pCol = `rgba(${baseR - 15},${baseG - 12},${baseB - 8},0.12)`; // clay
            else pCol = `rgba(${baseR - 8},${baseG - 4},${baseB - 10},0.1)`; // humus
            ctx.fillStyle = pCol;
            ctx.beginPath();
            ctx.ellipse(px, py, pr, pr * 0.45, rng() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Surface cracks (dried soil) ---
        if (rng() > 0.35) {
            const crackCount = 1 + Math.floor(rng() * 2);
            ctx.strokeStyle = `rgba(${Math.max(0, baseR - 30)},${Math.max(0, baseG - 25)},${Math.max(0, baseB - 20)},0.12)`;
            ctx.lineWidth = 0.4;
            for (let c = 0; c < crackCount; c++) {
                const crx = sx + (rng() - 0.5) * tw * 0.5;
                const cry = sy + (rng() - 0.5) * th * 0.3;
                ctx.beginPath();
                ctx.moveTo(crx, cry);
                const segs = 2 + Math.floor(rng() * 2);
                let cx2 = crx, cy2 = cry;
                for (let s = 0; s < segs; s++) {
                    cx2 += (rng() - 0.5) * 6;
                    cy2 += (rng() - 0.5) * 3;
                    ctx.lineTo(cx2, cy2);
                }
                ctx.stroke();
            }
        }

        // --- Pebbles with shadow and highlight ---
        const pebbleCount = 1 + Math.floor(rng() * 3);
        for (let p = 0; p < pebbleCount; p++) {
            if (rng() > 0.4) continue;
            const px = sx + (rng() - 0.5) * tw * 0.55;
            const py = sy + (rng() - 0.5) * th * 0.35;
            const pr = 1 + rng() * 1.5;
            const pAngle = rng() * Math.PI;
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.08)';
            ctx.beginPath();
            ctx.ellipse(px + 0.5, py + 0.3, pr + 0.3, (pr + 0.3) * 0.5, pAngle, 0, Math.PI * 2);
            ctx.fill();
            // Stone body
            const stoneR = 120 + Math.floor(rng() * 40);
            const stoneG = 110 + Math.floor(rng() * 30);
            const stoneB = 90 + Math.floor(rng() * 25);
            ctx.fillStyle = `rgb(${stoneR},${stoneG},${stoneB})`;
            ctx.beginPath();
            ctx.ellipse(px, py, pr, pr * 0.55, pAngle, 0, Math.PI * 2);
            ctx.fill();
            // Highlight
            ctx.fillStyle = 'rgba(255,255,240,0.15)';
            ctx.beginPath();
            ctx.ellipse(px - pr * 0.2, py - pr * 0.15, pr * 0.4, pr * 0.25, pAngle, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Sparse dry grass tufts at edges ---
        if (rng() > 0.55) {
            const tufts = 1 + Math.floor(rng() * 2);
            for (let t = 0; t < tufts; t++) {
                const tx2 = sx + (rng() - 0.5) * tw * 0.5;
                const ty2 = sy + (rng() - 0.5) * th * 0.3;
                ctx.strokeStyle = `rgba(160,145,80,${0.2 + rng() * 0.15})`;
                ctx.lineWidth = 0.4;
                for (let b = 0; b < 3; b++) {
                    const lean = (rng() - 0.5) * 2;
                    const bh = 1.5 + rng() * 2;
                    ctx.beginPath();
                    ctx.moveTo(tx2 + b - 1, ty2);
                    ctx.lineTo(tx2 + lean + b - 1, ty2 - bh);
                    ctx.stroke();
                }
            }
        }

        ctx.restore();

        // Edge darkening
        ctx.strokeStyle = `rgba(${Math.max(0, baseR - 40)},${Math.max(0, baseG - 35)},${Math.max(0, baseB - 30)},0.08)`;
        ctx.lineWidth = 0.6;
        this._tileDiamond(ctx, sx, sy, tw, th);
        ctx.stroke();
    },

    _renderRoad(ctx, sx, sy, tw, th, tx, ty) {
        // Asphalt
        const g = ctx.createLinearGradient(sx - tw/2, sy, sx + tw/2, sy);
        g.addColorStop(0, '#7a8088');
        g.addColorStop(0.5, '#8a9098');
        g.addColorStop(1, '#727880');
        this._tileDiamond(ctx, sx, sy, tw, th);
        ctx.fillStyle = g;
        ctx.fill();

        // Road edge
        ctx.strokeStyle = 'rgba(100,108,115,0.6)';
        ctx.lineWidth = 1;
        this._tileDiamond(ctx, sx, sy, tw * 0.92, th * 0.92);
        ctx.stroke();

        // Center line (dashed)
        ctx.strokeStyle = 'rgba(220,210,150,0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(sx - 6, sy + 3);
        ctx.lineTo(sx + 6, sy - 3);
        ctx.stroke();
        ctx.setLineDash([]);
    },

    _renderFarmland(ctx, sx, sy, tw, th, tx, ty) {
        const rng = this._seededRandom(tx * 37 + ty * 19);
        const hw = tw / 2, hh = th / 2;

        // --- Rich farmland base with directional lighting ---
        const hueShift = (rng() - 0.5) * 10;
        const baseR = Math.round(90 + hueShift);
        const baseG = Math.round(170 + hueShift);
        const baseB = Math.round(50 + hueShift * 0.3);

        const g = ctx.createLinearGradient(sx - hw, sy - hh, sx + hw * 0.5, sy + hh * 0.5);
        g.addColorStop(0, `rgb(${baseR + 12},${baseG + 15},${baseB + 8})`);
        g.addColorStop(0.4, `rgb(${baseR + 4},${baseG + 6},${baseB + 3})`);
        g.addColorStop(0.7, `rgb(${baseR},${baseG},${baseB})`);
        g.addColorStop(1, `rgb(${Math.max(0, baseR - 8)},${Math.max(0, baseG - 10)},${Math.max(0, baseB - 5)})`);
        this._tileDiamond(ctx, sx, sy, tw, th);
        ctx.fillStyle = g;
        ctx.fill();

        ctx.save();
        this._tileDiamond(ctx, sx, sy, tw, th);
        ctx.clip();

        // --- Soil furrows (rich brown lines between rows) ---
        ctx.strokeStyle = `rgba(${100 + Math.floor(rng() * 20)},${80 + Math.floor(rng() * 15)},${40},0.15)`;
        ctx.lineWidth = 0.5;
        for (let i = -3; i <= 3; i++) {
            ctx.beginPath();
            ctx.moveTo(sx + i * 5 - 3, sy + 7);
            ctx.lineTo(sx + i * 5 + 3, sy - 7);
            ctx.stroke();
        }

        // --- Crop rows with varying greens ---
        const rowCount = 5;
        for (let i = -2; i <= 2; i++) {
            const rowX = sx + i * 5.5;
            const cropCount = 3 + Math.floor(rng() * 2);
            for (let j = 0; j < cropCount; j++) {
                const t = (j / (cropCount - 1)) - 0.5;
                const cx = rowX + t * 1;
                const cy = sy + t * 10;
                const ch = 2 + rng() * 2;
                const lean = (rng() - 0.5) * 1;
                const cropGreen = baseG + Math.floor((rng() - 0.5) * 20);
                ctx.strokeStyle = `rgba(${baseR - 20},${cropGreen},${baseB - 10},${0.35 + rng() * 0.2})`;
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.quadraticCurveTo(cx + lean * 0.3, cy - ch * 0.6, cx + lean, cy - ch);
                ctx.stroke();
            }
        }

        ctx.restore();

        // Edge
        ctx.strokeStyle = `rgba(${Math.max(0, baseR - 25)},${Math.max(0, baseG - 30)},${Math.max(0, baseB - 15)},0.08)`;
        ctx.lineWidth = 0.5;
        this._tileDiamond(ctx, sx, sy, tw, th);
        ctx.stroke();
    },

    // ==============================
    //  FOREST TREES (rendered on top)
    // ==============================
    renderForestTrees(ctx, x, y) {
        const scr = this.tileToScreen(x, y);
        if (Game.map.tiles[y * GameData.MAP_SIZE + x] !== GameData.TILE.FOREST) return;
        this._treeLarge(ctx, scr.x, scr.y - 4, x * 100 + y);
    },

    // ==============================
    //  BUILDING RENDERING (DISPATCH)
    // ==============================
    renderBuilding(ctx, x, y, building) {
        const bData = GameData.BUILDINGS[building.id];
        if (!bData) return;

        const size = bData.size || 1;
        let scr;
        if (size >= 2) {
            const offset = (size - 1) / 2;
            scr = this.tileToScreen(x + offset, y + offset);
        } else {
            scr = this.tileToScreen(x, y);
        }
        const sx = scr.x, sy = scr.y;

        // Construction progress
        let progress = 1;
        if (building.buildTime && building.buildTime > 0) {
            progress = Math.max(0.15, 1 - building.buildTime / 3);
        }

        // Tile-type buildings skip 3D render (unless they have custom render like jembatan)
        if (bData.isTile && !bData.hasCustomRender) return;

        ctx.save();
        if (progress < 1) ctx.globalAlpha = 0.5 + progress * 0.5;

        try {
            // Reset canvas state to avoid leaking dashes/styles from previous renders
            ctx.setLineDash([]);
            ctx.lineWidth = 1;
            ctx.globalCompositeOperation = 'source-over';

            // Dispatch to specific renderer
            switch (building.id) {
                case 'rumah_transmigran': this._drawRumahTransmigran(ctx, sx, sy, progress); break;
                case 'rumah_layak': this._drawRumahLayak(ctx, sx, sy, progress); break;
                case 'perumahan': this._drawPerumahan(ctx, sx, sy, progress); break;
                case 'sawah': this._drawSawah(ctx, sx, sy, progress); break;
                case 'ladang': this._drawLadang(ctx, sx, sy, progress); break;
                case 'perkebunan': this._drawPerkebunan(ctx, sx, sy, progress); break;
                case 'peternakan': this._drawPeternakan(ctx, sx, sy, progress); break;
                case 'perikanan': this._drawPerikanan(ctx, sx, sy, progress); break;
                case 'sekolah': this._drawSekolah(ctx, sx, sy, progress); break;
                case 'smp': this._drawSMP(ctx, sx, sy, progress); break;
                case 'sma': this._drawSMA(ctx, sx, sy, progress); break;
                case 'puskesmas': this._drawPuskesmas(ctx, sx, sy, progress); break;
                case 'masjid': this._drawMasjid(ctx, sx, sy, progress); break;
                case 'balai_desa': this._drawBalaiDesa(ctx, sx, sy, progress); break;
                case 'apartemen': this._drawApartemen(ctx, sx, sy, progress); break;
                case 'gedung_pencakar': this._drawGedungPencakar(ctx, sx, sy, progress); break;
                case 'taman': this._drawTaman(ctx, sx, sy, progress); break;
                case 'pasar': this._drawPasar(ctx, sx, sy, progress); break;
                case 'koperasi': this._drawKoperasi(ctx, sx, sy, progress); break;
                case 'gudang': this._drawGudang(ctx, sx, sy, progress); break;
                case 'pabrik': this._drawPabrik(ctx, sx, sy, progress); break;
                case 'bank': this._drawBank(ctx, sx, sy, progress); break;
                case 'universitas': this._drawUniversitas(ctx, sx, sy, progress); break;
                case 'mall': this._drawMall(ctx, sx, sy, progress); break;
                case 'jembatan': this._drawJembatan(ctx, sx, sy, progress, x, y); break;
                case 'bandara': this._drawBandara(ctx, sx, sy, progress); break;
                case 'tol': this._drawTol(ctx, sx, sy, progress); break;
                case 'pembangkit': this._drawPembangkit(ctx, sx, sy, progress); break;
                case 'instalasi_air': this._drawInstalasi(ctx, sx, sy, progress); break;
                case 'rumah_sakit': this._drawRumahSakit(ctx, sx, sy, progress); break;
                case 'hotel': this._drawHotel(ctx, sx, sy, progress); break;
                case 'stasiun': this._drawStasiun(ctx, sx, sy, progress); break;
                case 'agro_industri': this._drawAgroIndustri(ctx, sx, sy, progress); break;
                case 'stadion': this._drawStadion(ctx, sx, sy, progress); break;
                case 'taman_besar': this._drawTamanBesar(ctx, sx, sy, progress); break;
                case 'pabrik_besar': this._drawPabrikBesar(ctx, sx, sy, progress); break;
                default: this._drawGeneric(ctx, sx, sy, bData, progress); break;
            }

            // Construction scaffolding
            if (progress < 1) {
                ctx.setLineDash([]);
                ctx.strokeStyle = 'rgba(180,140,70,0.6)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(sx - 18, sy + 2); ctx.lineTo(sx - 18, sy - 28);
                ctx.moveTo(sx + 18, sy + 2); ctx.lineTo(sx + 18, sy - 28);
                ctx.moveTo(sx - 20, sy - 14); ctx.lineTo(sx + 20, sy - 14);
                ctx.stroke();
            }
        } catch (err) {
            console.error('[Render Error] Building:', building.id, 'at', x, y, err);
        }

        ctx.restore();
    },

    // ==============================
    //  PER-BUILDING RENDERERS
    // ==============================

    // --- RUMAH TRANSMIGRAN ---
    _drawRumahTransmigran(ctx, sx, sy, p) {
        const hw = 22, hd = 11, stiltH = 6 * p, wallH = 16 * p;
        const baseY = sy - stiltH; // base of walls (top of stilts)
        const anim = this.animTime || 0;

        // --- Ground shadow ---
        this._shadow(ctx, sx, sy, 26, 14);

        // --- Dirt patch under house ---
        ctx.fillStyle = 'rgba(140,110,70,0.25)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 1, hw + 4, hd + 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- STILTS (tiang panggung) ---
        if (p > 0.1) {
            const stiltColor = '#7a5a30';
            const stiltDark = '#5a4020';
            const stiltPositions = [
                [-hw * 0.7, hd * 0.3], [-hw * 0.2, -hd * 0.3],
                [hw * 0.2, -hd * 0.3], [hw * 0.7, hd * 0.3],
                [-hw * 0.45, hd * 0.7], [hw * 0.45, hd * 0.7]
            ];
            for (const [ox, oy] of stiltPositions) {
                const px = sx + ox, py = sy + oy;
                // Stilt post
                ctx.fillStyle = stiltDark;
                ctx.fillRect(px - 1.2, py - stiltH, 2.4, stiltH);
                ctx.fillStyle = stiltColor;
                ctx.fillRect(px - 1, py - stiltH, 2, stiltH);
                // Stilt top cap
                ctx.fillStyle = stiltDark;
                ctx.fillRect(px - 1.8, py - stiltH - 0.5, 3.6, 1);
            }
            // Cross braces between stilts (left side)
            ctx.strokeStyle = 'rgba(90,60,30,0.4)';
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(sx - hw * 0.7, sy + hd * 0.3);
            ctx.lineTo(sx - hw * 0.2, sy - hd * 0.3 - stiltH * 0.6);
            ctx.moveTo(sx - hw * 0.2, sy - hd * 0.3);
            ctx.lineTo(sx - hw * 0.7, sy + hd * 0.3 - stiltH * 0.6);
            ctx.stroke();
        }

        // --- FLOOR PLATFORM (lantai kayu) ---
        this._box(ctx, sx, baseY, hw + 1, hd + 0.5, 1.5,
            '#c09858', ['#b08848', '#a07838'], ['#987038', '#886028']);

        // Floor plank lines on top face
        ctx.strokeStyle = 'rgba(80,50,20,0.12)';
        ctx.lineWidth = 0.3;
        for (let i = 1; i <= 3; i++) {
            const frac = i / 4;
            ctx.beginPath();
            ctx.moveTo(sx - hw * (1 - frac), baseY - hd * frac - 1.5);
            ctx.lineTo(sx + hw * frac, baseY - hd * (1 - frac) - 1.5);
            ctx.stroke();
        }

        // --- FRONT PORCH / TERAS ---
        if (p > 0.3) {
            const porchW = hw * 0.4, porchD = hd + 4;
            const porchX = sx + hw * 0.1, porchY = baseY + hd * 0.1;

            // Porch floor
            ctx.fillStyle = '#b89050';
            ctx.beginPath();
            ctx.moveTo(porchX, porchY - 1.5);
            ctx.lineTo(porchX + porchW, porchY + porchD * 0.4 - 1.5);
            ctx.lineTo(porchX, porchY + porchD * 0.8 - 1.5);
            ctx.lineTo(porchX - porchW, porchY + porchD * 0.4 - 1.5);
            ctx.closePath();
            ctx.fill();

            // Porch railing posts
            if (p > 0.6) {
                ctx.fillStyle = '#8a6030';
                const rH = 5;
                ctx.fillRect(porchX + porchW - 1, porchY + porchD * 0.4 - 1.5 - rH, 1.2, rH);
                ctx.fillRect(porchX - porchW + 1, porchY + porchD * 0.4 - 1.5 - rH, 1.2, rH);
                // Railing bar
                ctx.strokeStyle = '#8a6030';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.moveTo(porchX - porchW + 1.6, porchY + porchD * 0.4 - 1.5 - rH * 0.6);
                ctx.lineTo(porchX + porchW - 0.4, porchY + porchD * 0.4 - 1.5 - rH * 0.6);
                ctx.stroke();
            }

            // Porch steps (tangga)
            if (p > 0.5) {
                for (let s = 0; s < 2; s++) {
                    const stepY = porchY + porchD * 0.6 + s * 2.5;
                    const stepW = 5 - s;
                    ctx.fillStyle = s === 0 ? '#a08040' : '#907030';
                    ctx.fillRect(porchX - stepW / 2, stepY - 1, stepW, 2);
                    ctx.strokeStyle = 'rgba(60,40,15,0.2)';
                    ctx.lineWidth = 0.3;
                    ctx.strokeRect(porchX - stepW / 2, stepY - 1, stepW, 2);
                }
            }
        }

        // --- WALLS (dinding papan kayu) ---
        // Left wall
        const lwGrad = ctx.createLinearGradient(sx - hw, baseY - wallH, sx - hw, baseY);
        lwGrad.addColorStop(0, '#d4a868');
        lwGrad.addColorStop(0.5, '#c89850');
        lwGrad.addColorStop(1, '#b88840');
        ctx.fillStyle = lwGrad;
        ctx.beginPath();
        ctx.moveTo(sx - hw, baseY);
        ctx.lineTo(sx - hw, baseY - wallH);
        ctx.lineTo(sx, baseY - hd - wallH);
        ctx.lineTo(sx, baseY - hd);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Right wall
        const rwGrad = ctx.createLinearGradient(sx + hw, baseY - wallH, sx + hw, baseY);
        rwGrad.addColorStop(0, '#b88838');
        rwGrad.addColorStop(0.5, '#a87828');
        rwGrad.addColorStop(1, '#986820');
        ctx.fillStyle = rwGrad;
        ctx.beginPath();
        ctx.moveTo(sx + hw, baseY);
        ctx.lineTo(sx + hw, baseY - wallH);
        ctx.lineTo(sx, baseY - hd - wallH);
        ctx.lineTo(sx, baseY - hd);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Top of wall
        ctx.fillStyle = '#d8b070';
        ctx.beginPath();
        ctx.moveTo(sx, baseY - hd - wallH);
        ctx.lineTo(sx + hw, baseY - wallH);
        ctx.lineTo(sx, baseY + hd - wallH);
        ctx.lineTo(sx - hw, baseY - wallH);
        ctx.closePath();
        ctx.fill();

        // --- PLANK LINES on walls ---
        ctx.strokeStyle = 'rgba(80,50,15,0.13)';
        ctx.lineWidth = 0.4;
        for (let i = 1; i <= 5; i++) {
            const frac = i / 6;
            const ly = baseY - wallH * frac;
            // Left wall planks
            ctx.beginPath();
            ctx.moveTo(sx - hw, ly);
            ctx.lineTo(sx, ly - hd);
            ctx.stroke();
            // Right wall planks
            ctx.beginPath();
            ctx.moveTo(sx + hw, ly);
            ctx.lineTo(sx, ly - hd);
            ctx.stroke();
        }

        // --- Vertical wood grain lines (subtle) ---
        ctx.strokeStyle = 'rgba(90,60,20,0.06)';
        ctx.lineWidth = 0.3;
        for (let i = 1; i <= 3; i++) {
            const frac = i / 4;
            // Left wall vertical grain
            const lx = sx - hw * (1 - frac);
            ctx.beginPath();
            ctx.moveTo(lx, baseY - hd * frac);
            ctx.lineTo(lx, baseY - hd * frac - wallH);
            ctx.stroke();
            // Right wall vertical grain
            const rx = sx + hw * frac;
            ctx.beginPath();
            ctx.moveTo(rx, baseY - hd * (1 - frac));
            ctx.lineTo(rx, baseY - hd * (1 - frac) - wallH);
            ctx.stroke();
        }

        // --- WINDOWS with shutters (jendela berterali) ---
        if (p > 0.5) {
            // Left wall window
            const wlx = sx - hw * 0.52, wly = baseY - wallH * 0.55;
            const ww = 6, wh = 5;
            // Shutter frame
            ctx.fillStyle = '#6a4820';
            ctx.fillRect(wlx - 0.8, wly - 0.8, ww + 1.6, wh + 1.6);
            // Glass/opening
            const wlGrad = ctx.createLinearGradient(wlx, wly, wlx + ww, wly + wh);
            wlGrad.addColorStop(0, 'rgba(140,200,230,0.7)');
            wlGrad.addColorStop(0.5, 'rgba(180,225,250,0.85)');
            wlGrad.addColorStop(1, 'rgba(120,180,210,0.6)');
            ctx.fillStyle = wlGrad;
            ctx.fillRect(wlx, wly, ww, wh);
            // Window cross bars (terali)
            ctx.strokeStyle = '#7a5828';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(wlx + ww / 2, wly); ctx.lineTo(wlx + ww / 2, wly + wh);
            ctx.moveTo(wlx, wly + wh / 2); ctx.lineTo(wlx + ww, wly + wh / 2);
            ctx.stroke();
            // Reflection
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(wlx + 1, wly + 1, ww * 0.3, wh * 0.4);

            // Right wall window
            const wrx = sx + hw * 0.2, wry = baseY - wallH * 0.55;
            ctx.fillStyle = '#5a3818';
            ctx.fillRect(wrx - 0.8, wry - 0.8, ww + 1.6, wh + 1.6);
            const wrGrad = ctx.createLinearGradient(wrx, wry, wrx + ww, wry + wh);
            wrGrad.addColorStop(0, 'rgba(110,170,200,0.6)');
            wrGrad.addColorStop(0.5, 'rgba(150,200,230,0.75)');
            wrGrad.addColorStop(1, 'rgba(90,150,180,0.5)');
            ctx.fillStyle = wrGrad;
            ctx.fillRect(wrx, wry, ww, wh);
            ctx.strokeStyle = '#6a4820';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(wrx + ww / 2, wry); ctx.lineTo(wrx + ww / 2, wry + wh);
            ctx.moveTo(wrx, wry + wh / 2); ctx.lineTo(wrx + ww, wry + wh / 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(wrx + 1, wry + 1, ww * 0.3, wh * 0.4);
        }

        // --- DOOR (pintu kayu) ---
        if (p > 0.7) {
            const dx = sx - 3, dy = baseY - hd;
            const dw = 5, dh = 9;
            // Door frame
            ctx.fillStyle = '#5a3818';
            ctx.fillRect(dx - 0.8, dy - dh - 0.8, dw + 1.6, dh + 1.2);
            // Door panels
            const dGrad = ctx.createLinearGradient(dx, dy - dh, dx, dy);
            dGrad.addColorStop(0, '#7a5030');
            dGrad.addColorStop(0.5, '#6a4428');
            dGrad.addColorStop(1, '#5a3820');
            ctx.fillStyle = dGrad;
            ctx.fillRect(dx, dy - dh, dw, dh);
            // Panel insets
            ctx.strokeStyle = 'rgba(40,25,10,0.3)';
            ctx.lineWidth = 0.4;
            ctx.strokeRect(dx + 0.8, dy - dh + 1, dw - 1.6, dh * 0.4);
            ctx.strokeRect(dx + 0.8, dy - dh * 0.5 + 0.5, dw - 1.6, dh * 0.35);
            // Door handle
            ctx.fillStyle = '#c8a840';
            ctx.beginPath();
            ctx.arc(dx + dw * 0.78, dy - dh * 0.45, 0.9, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- CORRUGATED ZINC ROOF (atap seng bergelombang) ---
        if (p > 0.3) {
            const roofH = 12 * p;
            const ow = hw + 5, od = hd + 3;
            const by = baseY - wallH;

            // Left slope (main visible)
            const rlGrad = ctx.createLinearGradient(sx - ow, by, sx, by - roofH);
            rlGrad.addColorStop(0, '#a8a0a0');
            rlGrad.addColorStop(0.5, '#b8b0b0');
            rlGrad.addColorStop(1, '#989090');
            ctx.fillStyle = rlGrad;
            ctx.beginPath();
            ctx.moveTo(sx - ow, by + 1);
            ctx.lineTo(sx - ow * 0.08, by - roofH);
            ctx.lineTo(sx + ow * 0.08, by - roofH);
            ctx.lineTo(sx, by - hd);
            ctx.lineTo(sx - hw, by);
            ctx.closePath();
            ctx.fill();

            // Right slope
            const rrGrad = ctx.createLinearGradient(sx + ow, by, sx, by - roofH);
            rrGrad.addColorStop(0, '#908888');
            rrGrad.addColorStop(0.5, '#a09898');
            rrGrad.addColorStop(1, '#807878');
            ctx.fillStyle = rrGrad;
            ctx.beginPath();
            ctx.moveTo(sx + ow, by + 1);
            ctx.lineTo(sx + ow * 0.08, by - roofH);
            ctx.lineTo(sx - ow * 0.08, by - roofH);
            ctx.lineTo(sx, by - hd);
            ctx.lineTo(sx + hw, by);
            ctx.closePath();
            ctx.fill();

            // Front face
            ctx.fillStyle = '#b0a8a8';
            ctx.beginPath();
            ctx.moveTo(sx - ow * 0.08, by - roofH);
            ctx.lineTo(sx + ow * 0.08, by - roofH);
            ctx.lineTo(sx + ow, by + 1);
            ctx.lineTo(sx, by + od + 1);
            ctx.lineTo(sx - ow, by + 1);
            ctx.closePath();
            ctx.fill();

            // Corrugation ridges on front face
            ctx.strokeStyle = 'rgba(60,55,55,0.15)';
            ctx.lineWidth = 0.5;
            for (let i = 1; i <= 6; i++) {
                const frac = i / 7;
                const rx = sx - ow + (ow * 2) * frac;
                const ry1 = by + 1 + (by - roofH - by) * (frac < 0.5 ? frac * 0.5 : (1 - frac) * 0.5);
                const ry2 = by + od * 0.8;
                ctx.beginPath();
                ctx.moveTo(rx, by - roofH * 0.3);
                ctx.lineTo(rx + (frac < 0.5 ? 2 : -2), ry2);
                ctx.stroke();
            }

            // Corrugation ridges on left slope
            ctx.strokeStyle = 'rgba(70,60,60,0.1)';
            for (let i = 1; i <= 4; i++) {
                const frac = i / 5;
                ctx.beginPath();
                ctx.moveTo(sx - hw * frac, by - hd * (1 - frac) - wallH * 0.05);
                ctx.lineTo(sx - ow * 0.08 - (ow * 0.92) * (1 - frac), by - roofH * frac);
                ctx.stroke();
            }

            // Ridge cap (nok atap)
            ctx.strokeStyle = '#787070';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sx - ow * 0.08, by - roofH);
            ctx.lineTo(sx + ow * 0.08, by - roofH);
            ctx.stroke();

            // Slight rust spots
            ctx.fillStyle = 'rgba(160,90,50,0.08)';
            ctx.beginPath();
            ctx.arc(sx - 6, by - roofH * 0.3, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(sx + 8, by - roofH * 0.5, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // === ENVIRONMENTAL DETAILS (only when fully built) ===
        if (p >= 1) {
            // --- Clothesline (jemuran) ---
            const clx1 = sx + hw * 0.5, cly1 = sy - 2;
            const clx2 = sx + hw * 1.1, cly2 = sy + hd * 0.6;
            // Poles
            ctx.fillStyle = '#7a7a7a';
            ctx.fillRect(clx1 - 0.5, cly1 - 10, 1, 10);
            ctx.fillRect(clx2 - 0.5, cly2 - 10, 1, 10);
            // Line
            ctx.strokeStyle = '#a0a0a0';
            ctx.lineWidth = 0.4;
            ctx.beginPath();
            ctx.moveTo(clx1, cly1 - 10);
            ctx.lineTo(clx2, cly2 - 10);
            ctx.stroke();
            // Clothes hanging (animated slight swing)
            const swing = Math.sin(anim * 0.8) * 0.5;
            const clothColors = ['#d04040', '#4080c0', '#e0e0e0', '#40a040'];
            for (let c = 0; c < 4; c++) {
                const t = (c + 0.5) / 4;
                const cx = clx1 + (clx2 - clx1) * t;
                const cy = cly1 - 10 + (cly2 - cly1) * t + 1;
                ctx.fillStyle = clothColors[c];
                ctx.fillRect(cx - 1.2 + swing, cy, 2.5, 3.5 + Math.sin(anim + c) * 0.3);
            }

            // --- Water drum (drum air) ---
            const drumX = sx - hw * 0.95, drumY = sy + hd * 0.5;
            ctx.fillStyle = '#3868a0';
            ctx.beginPath();
            ctx.ellipse(drumX, drumY, 3, 1.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#2858a0';
            ctx.fillRect(drumX - 3, drumY - 5, 6, 5);
            ctx.fillStyle = '#4878b8';
            ctx.beginPath();
            ctx.ellipse(drumX, drumY - 5, 3, 1.5, 0, 0, Math.PI * 2);
            ctx.fill();
            // Water glint
            ctx.fillStyle = 'rgba(150,210,255,0.4)';
            ctx.beginPath();
            ctx.ellipse(drumX - 0.5, drumY - 5.2, 1.8, 0.8, 0, 0, Math.PI * 2);
            ctx.fill();
            // Drum band
            ctx.strokeStyle = '#1a3860';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(drumX - 3, drumY - 2); ctx.lineTo(drumX + 3, drumY - 2);
            ctx.stroke();

            // --- Small garden plants (tanaman) ---
            const plants = [
                [sx - hw * 1.0, sy + hd * 0.15, '#3a9030'],
                [sx - hw * 0.85, sy - hd * 0.1, '#48a838'],
                [sx - hw * 1.15, sy + hd * 0.4, '#308828'],
            ];
            for (const [px, py, col] of plants) {
                // Soil mound
                ctx.fillStyle = 'rgba(120,80,40,0.3)';
                ctx.beginPath();
                ctx.ellipse(px, py + 1, 2.5, 1, 0, 0, Math.PI * 2);
                ctx.fill();
                // Stem
                ctx.strokeStyle = '#2a7020';
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(px, py + 0.5);
                ctx.lineTo(px + Math.sin(anim * 0.5 + px) * 0.3, py - 3);
                ctx.stroke();
                // Leaves
                ctx.fillStyle = col;
                ctx.beginPath();
                ctx.arc(px + Math.sin(anim * 0.5 + px) * 0.3, py - 3.5, 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = this._lighten(col, 20);
                ctx.beginPath();
                ctx.arc(px + 1 + Math.sin(anim * 0.5 + px) * 0.3, py - 4.5, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }

            // --- Smoke from chimney/cooking (asap dapur) ---
            for (let s = 0; s < 3; s++) {
                const smokeY = baseY - wallH - 10 - s * 5 - Math.sin(anim * 0.6 + s) * 2;
                const smokeX = sx + 4 + Math.sin(anim * 0.4 + s * 1.5) * 2;
                const smokeR = 1.5 + s * 0.8;
                ctx.fillStyle = `rgba(200,200,210,${0.15 - s * 0.04})`;
                ctx.beginPath();
                ctx.arc(smokeX, smokeY, smokeR, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    },

    // --- RUMAH LAYAK HUNI ---
    _drawRumahLayak(ctx, sx, sy, p) {
        const hw = 24, hd = 12, wallH = 22 * p, foundH = 3;
        const baseY = sy - foundH;
        const anim = this.animTime || 0;

        // --- Shadow ---
        this._shadow(ctx, sx, sy, 28, 16);

        // --- Yard / lawn patch ---
        ctx.fillStyle = 'rgba(100,170,70,0.15)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 2, hw + 6, hd + 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- Foundation (beton/batako) ---
        this._box(ctx, sx, sy, hw + 3, hd + 2, foundH,
            '#c0b8a8', ['#b0a898','#a09888'], ['#908878','#807868']);
        // Foundation texture lines (bata)
        ctx.strokeStyle = 'rgba(80,60,40,0.08)';
        ctx.lineWidth = 0.3;
        for (let i = 1; i <= 2; i++) {
            const fy = sy - foundH * (i / 3);
            ctx.beginPath();
            ctx.moveTo(sx - hw - 3, fy + (hd + 2) * (i / 3));
            ctx.lineTo(sx, fy);
            ctx.stroke();
        }

        // --- Main walls (plaster / stucco) ---
        // Left wall
        const lwGrad = ctx.createLinearGradient(sx - hw, baseY - wallH, sx - hw, baseY);
        lwGrad.addColorStop(0, '#f2ead0');
        lwGrad.addColorStop(0.4, '#ece2c4');
        lwGrad.addColorStop(1, '#e0d4b4');
        ctx.fillStyle = lwGrad;
        ctx.beginPath();
        ctx.moveTo(sx - hw, baseY);
        ctx.lineTo(sx - hw, baseY - wallH);
        ctx.lineTo(sx, baseY - hd - wallH);
        ctx.lineTo(sx, baseY - hd);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.05)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Right wall
        const rwGrad = ctx.createLinearGradient(sx + hw, baseY - wallH, sx + hw, baseY);
        rwGrad.addColorStop(0, '#dcd0b0');
        rwGrad.addColorStop(0.4, '#d4c8a4');
        rwGrad.addColorStop(1, '#c8bc98');
        ctx.fillStyle = rwGrad;
        ctx.beginPath();
        ctx.moveTo(sx + hw, baseY);
        ctx.lineTo(sx + hw, baseY - wallH);
        ctx.lineTo(sx, baseY - hd - wallH);
        ctx.lineTo(sx, baseY - hd);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Top of wall
        ctx.fillStyle = '#f0e8d0';
        ctx.beginPath();
        ctx.moveTo(sx, baseY - hd - wallH);
        ctx.lineTo(sx + hw, baseY - wallH);
        ctx.lineTo(sx, baseY + hd - wallH);
        ctx.lineTo(sx - hw, baseY - wallH);
        ctx.closePath();
        ctx.fill();

        // --- Wall trim / lisplang line ---
        ctx.strokeStyle = 'rgba(100,80,50,0.2)';
        ctx.lineWidth = 0.8;
        const trimY = wallH * 0.88;
        ctx.beginPath();
        ctx.moveTo(sx - hw, baseY - trimY + hd * 0.12);
        ctx.lineTo(sx, baseY - hd - trimY);
        ctx.lineTo(sx + hw, baseY - trimY + hd * 0.12);
        ctx.stroke();

        // --- Windows with shutters ---
        if (p > 0.5) {
            // Left wall: 2 windows
            for (let w = 0; w < 2; w++) {
                const wx = hw * (0.3 + w * 0.38);
                const wy = wallH * 0.52;
                const ww = 5.5, wh = 5.5;
                const wlx = sx - wx, wly = baseY - wy;
                // Kusen (frame)
                ctx.fillStyle = '#7a5a30';
                ctx.fillRect(wlx - 1, wly - 1, ww + 2, wh + 2);
                // Glass
                const wg = ctx.createLinearGradient(wlx, wly, wlx + ww, wly + wh);
                wg.addColorStop(0, 'rgba(150,210,240,0.75)');
                wg.addColorStop(0.5, 'rgba(190,230,255,0.85)');
                wg.addColorStop(1, 'rgba(130,190,220,0.65)');
                ctx.fillStyle = wg;
                ctx.fillRect(wlx, wly, ww, wh);
                // Cross bars
                ctx.strokeStyle = '#8a6a38';
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(wlx + ww / 2, wly);
                ctx.lineTo(wlx + ww / 2, wly + wh);
                ctx.moveTo(wlx, wly + wh / 2);
                ctx.lineTo(wlx + ww, wly + wh / 2);
                ctx.stroke();
                // Reflection
                ctx.fillStyle = 'rgba(255,255,255,0.25)';
                ctx.fillRect(wlx + 0.5, wly + 0.5, ww * 0.35, wh * 0.4);
            }

            // Right wall: 2 windows
            for (let w = 0; w < 2; w++) {
                const wx = hw * (0.15 + w * 0.38);
                const wy = wallH * 0.52;
                const ww = 5, wh = 5.5;
                const wrx = sx + wx, wry = baseY - wy;
                ctx.fillStyle = '#6a4a28';
                ctx.fillRect(wrx - 1, wry - 1, ww + 2, wh + 2);
                const wg = ctx.createLinearGradient(wrx, wry, wrx + ww, wry + wh);
                wg.addColorStop(0, 'rgba(120,180,210,0.65)');
                wg.addColorStop(0.5, 'rgba(160,210,235,0.75)');
                wg.addColorStop(1, 'rgba(100,160,190,0.55)');
                ctx.fillStyle = wg;
                ctx.fillRect(wrx, wry, ww, wh);
                ctx.strokeStyle = '#7a5830';
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(wrx + ww / 2, wry);
                ctx.lineTo(wrx + ww / 2, wry + wh);
                ctx.moveTo(wrx, wry + wh / 2);
                ctx.lineTo(wrx + ww, wry + wh / 2);
                ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.fillRect(wrx + 0.5, wry + 0.5, ww * 0.35, wh * 0.4);
            }
        }

        // --- Front door with porch ---
        if (p > 0.7) {
            const dx = sx - 3.5, dy = baseY - hd;
            // Porch floor
            ctx.fillStyle = '#c0b098';
            ctx.beginPath();
            ctx.moveTo(dx - 4, dy + 1);
            ctx.lineTo(dx + 10, dy + 1);
            ctx.lineTo(dx + 8, dy + 5);
            ctx.lineTo(dx - 2, dy + 5);
            ctx.closePath();
            ctx.fill();
            // Porch columns
            ctx.fillStyle = '#d0c8b0';
            ctx.fillRect(dx - 2, dy - 8, 1.5, 8);
            ctx.fillRect(dx + 8, dy - 8, 1.5, 8);
            // Porch roof / canopy
            ctx.fillStyle = '#3a68a8';
            ctx.beginPath();
            ctx.moveTo(dx - 4, dy - 9);
            ctx.lineTo(dx + 12, dy - 9);
            ctx.lineTo(dx + 10, dy - 7);
            ctx.lineTo(dx - 2, dy - 7);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#2a58a0';
            ctx.fillRect(dx - 4, dy - 10, 16, 1.5);
            // Door
            const dGrad = ctx.createLinearGradient(dx + 1, dy - 9, dx + 1, dy);
            dGrad.addColorStop(0, '#6a4428');
            dGrad.addColorStop(1, '#5a3820');
            ctx.fillStyle = dGrad;
            ctx.fillRect(dx + 1, dy - 9, 5, 9);
            // Door panels
            ctx.strokeStyle = 'rgba(40,25,10,0.25)';
            ctx.lineWidth = 0.4;
            ctx.strokeRect(dx + 1.8, dy - 8, 3.4, 3);
            ctx.strokeRect(dx + 1.8, dy - 4.5, 3.4, 3);
            // Door handle
            ctx.fillStyle = '#c8a840';
            ctx.beginPath();
            ctx.arc(dx + 5, dy - 4.5, 0.7, 0, Math.PI * 2);
            ctx.fill();
            // Steps
            ctx.fillStyle = '#b0a890';
            ctx.fillRect(dx + 0.5, dy + 0.5, 6, 1.5);
            ctx.fillStyle = '#a09880';
            ctx.fillRect(dx + 1, dy + 2.5, 5.5, 1.5);
        }

        // --- Roof (genteng biru keramik) ---
        if (p > 0.3) {
            const roofH = 14 * p;
            const ow = hw + 5, od = hd + 3;
            const by = baseY - wallH;

            // Left slope
            const rlG = ctx.createLinearGradient(sx - ow, by, sx, by - roofH);
            rlG.addColorStop(0, '#2a5898');
            rlG.addColorStop(0.5, '#3468a8');
            rlG.addColorStop(1, '#1e4888');
            ctx.fillStyle = rlG;
            ctx.beginPath();
            ctx.moveTo(sx - ow, by + 1);
            ctx.lineTo(sx, by - od - roofH);
            ctx.lineTo(sx, by - hd);
            ctx.lineTo(sx - hw, by);
            ctx.closePath();
            ctx.fill();

            // Right slope
            const rrG = ctx.createLinearGradient(sx + ow, by, sx, by - roofH);
            rrG.addColorStop(0, '#1e4888');
            rrG.addColorStop(0.5, '#2a5898');
            rrG.addColorStop(1, '#163878');
            ctx.fillStyle = rrG;
            ctx.beginPath();
            ctx.moveTo(sx + ow, by + 1);
            ctx.lineTo(sx, by - od - roofH);
            ctx.lineTo(sx, by - hd);
            ctx.lineTo(sx + hw, by);
            ctx.closePath();
            ctx.fill();

            // Front face
            ctx.fillStyle = '#3878b8';
            ctx.beginPath();
            ctx.moveTo(sx, by - od - roofH);
            ctx.lineTo(sx + ow, by + 1);
            ctx.lineTo(sx, by + od + 1);
            ctx.lineTo(sx - ow, by + 1);
            ctx.closePath();
            ctx.fill();

            // Tile lines on front face
            ctx.strokeStyle = 'rgba(20,40,80,0.12)';
            ctx.lineWidth = 0.4;
            for (let i = 1; i <= 5; i++) {
                const frac = i / 6;
                const ty = by - od * frac - roofH * frac;
                const bw = ow * (1 - frac);
                ctx.beginPath();
                ctx.moveTo(sx - bw, ty + od * (1 - frac) + 1);
                ctx.lineTo(sx + bw, ty + od * (1 - frac) + 1);
                ctx.stroke();
            }

            // Ridge cap
            ctx.strokeStyle = '#284888';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sx, by - od - roofH);
            ctx.lineTo(sx - ow * 0.5, by - roofH * 0.5 + 1);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(sx, by - od - roofH);
            ctx.lineTo(sx + ow * 0.5, by - roofH * 0.5 + 1);
            ctx.stroke();
        }

        // --- Details (only when fully built) ---
        if (p >= 1) {
            // Flower garden (taman bunga)
            const flowerSets = [
                [sx + hw * 0.6, sy + hd * 0.2, '#e04060'],
                [sx + hw * 0.85, sy + hd * 0.45, '#e0a020'],
                [sx - hw * 0.7, sy + hd * 0.1, '#d060a0'],
                [sx - hw * 0.9, sy + hd * 0.35, '#c04040'],
            ];
            for (const [fx, fy, col] of flowerSets) {
                // Soil
                ctx.fillStyle = 'rgba(110,80,40,0.2)';
                ctx.beginPath();
                ctx.ellipse(fx, fy + 1, 2.5, 1, 0, 0, Math.PI * 2);
                ctx.fill();
                // Stem
                ctx.strokeStyle = '#308020';
                ctx.lineWidth = 0.4;
                ctx.beginPath();
                ctx.moveTo(fx, fy + 0.5);
                ctx.lineTo(fx + Math.sin(anim * 0.6 + fx) * 0.3, fy - 2.5);
                ctx.stroke();
                // Petals
                ctx.fillStyle = col;
                const px = fx + Math.sin(anim * 0.6 + fx) * 0.3;
                const py = fy - 3;
                for (let pi = 0; pi < 5; pi++) {
                    const a = (pi / 5) * Math.PI * 2 + anim * 0.2;
                    ctx.beginPath();
                    ctx.arc(px + Math.cos(a) * 1.2, py + Math.sin(a) * 1.2, 0.8, 0, Math.PI * 2);
                    ctx.fill();
                }
                // Center
                ctx.fillStyle = '#f0e040';
                ctx.beginPath();
                ctx.arc(px, py, 0.6, 0, Math.PI * 2);
                ctx.fill();
            }

            // Satellite dish on roof
            const dishX = sx + hw * 0.4, dishY = baseY - wallH - 14 * p * 0.5;
            ctx.fillStyle = '#c0c0c0';
            ctx.beginPath();
            ctx.ellipse(dishX, dishY, 2.5, 1.5, -0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(dishX, dishY);
            ctx.lineTo(dishX + 1, dishY + 4);
            ctx.stroke();

            // Motorcycle parked
            const motoX = sx + hw * 0.3, motoY = sy + hd * 0.8;
            // Body
            ctx.fillStyle = '#303030';
            ctx.fillRect(motoX - 2, motoY - 2.5, 4, 2);
            ctx.fillStyle = '#d02020';
            ctx.fillRect(motoX - 1.5, motoY - 3, 3, 1.5);
            // Wheels
            ctx.fillStyle = '#202020';
            ctx.beginPath();
            ctx.arc(motoX - 1.5, motoY, 1.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(motoX + 1.5, motoY, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    // --- KOMPLEK PERUMAHAN ---
    _drawPerumahan(ctx, sx, sy, p) {
        const hw = 40, hd = 20;
        const anim = this.animTime || 0;
        this._shadow(ctx, sx, sy, 46, 25);

        // --- Road / jalan komplek in front ---
        ctx.fillStyle = '#6a6a6a';
        ctx.beginPath();
        ctx.moveTo(sx, sy + hd + 4);
        ctx.lineTo(sx + hw + 4, sy + 4);
        ctx.lineTo(sx + hw + 4, sy + 6);
        ctx.lineTo(sx, sy + hd + 6);
        ctx.closePath();
        ctx.fill();
        // Road marking
        ctx.strokeStyle = '#e0d080';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(sx + hw * 0.2, sy + hd + 3);
        ctx.lineTo(sx + hw + 2, sy + 3);
        ctx.stroke();
        ctx.setLineDash([]);

        // --- House 1 (back-left, blue roof) ---
        const h1x = sx - hw * 0.38, h1y = sy - hd * 0.1;
        const h1h = 18 * p;
        // Foundation
        this._box(ctx, h1x, h1y, 16, 8, 2, '#b8b0a0', ['#a8a090','#989080'], ['#888070','#787060']);
        // Walls
        const lw1 = ctx.createLinearGradient(h1x - 16, h1y - 2, h1x - 16, h1y - 2 - h1h);
        lw1.addColorStop(0, '#e8e0c8'); lw1.addColorStop(1, '#f0e8d0');
        ctx.fillStyle = lw1;
        ctx.beginPath();
        ctx.moveTo(h1x - 16, h1y - 2);
        ctx.lineTo(h1x - 16, h1y - 2 - h1h);
        ctx.lineTo(h1x, h1y - 8 - 2 - h1h);
        ctx.lineTo(h1x, h1y - 8 - 2);
        ctx.closePath();
        ctx.fill();
        const rw1 = ctx.createLinearGradient(h1x + 16, h1y - 2, h1x + 16, h1y - 2 - h1h);
        rw1.addColorStop(0, '#d4ccb0'); rw1.addColorStop(1, '#dcd4bc');
        ctx.fillStyle = rw1;
        ctx.beginPath();
        ctx.moveTo(h1x + 16, h1y - 2);
        ctx.lineTo(h1x + 16, h1y - 2 - h1h);
        ctx.lineTo(h1x, h1y - 8 - 2 - h1h);
        ctx.lineTo(h1x, h1y - 8 - 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ece4cc';
        ctx.beginPath();
        ctx.moveTo(h1x, h1y - 8 - 2 - h1h); ctx.lineTo(h1x + 16, h1y - 2 - h1h);
        ctx.lineTo(h1x, h1y + 8 - 2 - h1h); ctx.lineTo(h1x - 16, h1y - 2 - h1h);
        ctx.closePath(); ctx.fill();
        // Roof (hip, blue)
        this._hipRoof(ctx, h1x, h1y - 2, 16, 8, h1h, 9 * p, 3, '#2a5898', '#1e4888', '#3868a8');
        // Windows & Door
        if (p > 0.5) {
            this._windowL(ctx, h1x, h1y - 2, 10, h1h * 0.5, 4, 4);
            this._windowR(ctx, h1x, h1y - 2, 4, h1h * 0.5, 4, 4);
        }
        if (p > 0.7) { this._door(ctx, h1x - 2, h1y - 10, 3.5, 7, '#5a3818'); }

        // --- House 2 (front-right, red/brown roof) ---
        const h2x = sx + hw * 0.28, h2y = sy + hd * 0.25;
        const h2h = 18 * p;
        this._box(ctx, h2x, h2y, 16, 8, 2, '#b8b0a0', ['#a8a090','#989080'], ['#888070','#787060']);
        const lw2 = ctx.createLinearGradient(h2x - 16, h2y - 2, h2x - 16, h2y - 2 - h2h);
        lw2.addColorStop(0, '#f0e8d4'); lw2.addColorStop(1, '#f8f0dc');
        ctx.fillStyle = lw2;
        ctx.beginPath();
        ctx.moveTo(h2x - 16, h2y - 2);
        ctx.lineTo(h2x - 16, h2y - 2 - h2h);
        ctx.lineTo(h2x, h2y - 8 - 2 - h2h);
        ctx.lineTo(h2x, h2y - 8 - 2);
        ctx.closePath();
        ctx.fill();
        const rw2 = ctx.createLinearGradient(h2x + 16, h2y - 2, h2x + 16, h2y - 2 - h2h);
        rw2.addColorStop(0, '#d8d0b8'); rw2.addColorStop(1, '#e0d8c0');
        ctx.fillStyle = rw2;
        ctx.beginPath();
        ctx.moveTo(h2x + 16, h2y - 2);
        ctx.lineTo(h2x + 16, h2y - 2 - h2h);
        ctx.lineTo(h2x, h2y - 8 - 2 - h2h);
        ctx.lineTo(h2x, h2y - 8 - 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f4eccc';
        ctx.beginPath();
        ctx.moveTo(h2x, h2y - 8 - 2 - h2h); ctx.lineTo(h2x + 16, h2y - 2 - h2h);
        ctx.lineTo(h2x, h2y + 8 - 2 - h2h); ctx.lineTo(h2x - 16, h2y - 2 - h2h);
        ctx.closePath(); ctx.fill();
        // Roof (hip, brownish-red)
        this._hipRoof(ctx, h2x, h2y - 2, 16, 8, h2h, 9 * p, 3, '#a04030', '#883020', '#b85040');
        if (p > 0.5) {
            this._windowL(ctx, h2x, h2y - 2, 10, h2h * 0.5, 4, 4);
            this._windowR(ctx, h2x, h2y - 2, 4, h2h * 0.5, 4, 4);
        }
        if (p > 0.7) { this._door(ctx, h2x - 2, h2y - 10, 3.5, 7, '#6a4020'); }

        // --- House 3 (back-right, green roof) ---
        const h3x = sx + hw * 0.05, h3y = sy - hd * 0.4;
        const h3h = 16 * p;
        this._box(ctx, h3x, h3y, 14, 7, 2, '#b0a898', ['#a09888','#908878'], ['#807868','#706858']);
        const lw3 = ctx.createLinearGradient(h3x - 14, h3y - 2, h3x - 14, h3y - 2 - h3h);
        lw3.addColorStop(0, '#e4dcc8'); lw3.addColorStop(1, '#ece4d0');
        ctx.fillStyle = lw3;
        ctx.beginPath();
        ctx.moveTo(h3x - 14, h3y - 2); ctx.lineTo(h3x - 14, h3y - 2 - h3h);
        ctx.lineTo(h3x, h3y - 7 - 2 - h3h); ctx.lineTo(h3x, h3y - 7 - 2);
        ctx.closePath(); ctx.fill();
        const rw3 = ctx.createLinearGradient(h3x + 14, h3y - 2, h3x + 14, h3y - 2 - h3h);
        rw3.addColorStop(0, '#d0c8b4'); rw3.addColorStop(1, '#d8d0bc');
        ctx.fillStyle = rw3;
        ctx.beginPath();
        ctx.moveTo(h3x + 14, h3y - 2); ctx.lineTo(h3x + 14, h3y - 2 - h3h);
        ctx.lineTo(h3x, h3y - 7 - 2 - h3h); ctx.lineTo(h3x, h3y - 7 - 2);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e8e0c8';
        ctx.beginPath();
        ctx.moveTo(h3x, h3y - 7 - 2 - h3h); ctx.lineTo(h3x + 14, h3y - 2 - h3h);
        ctx.lineTo(h3x, h3y + 7 - 2 - h3h); ctx.lineTo(h3x - 14, h3y - 2 - h3h);
        ctx.closePath(); ctx.fill();
        this._hipRoof(ctx, h3x, h3y - 2, 14, 7, h3h, 8 * p, 3, '#3a7848', '#2a6838', '#4a8858');
        if (p > 0.5) { this._windowL(ctx, h3x, h3y - 2, 9, h3h * 0.5, 3.5, 3.5); }
        if (p > 0.7) { this._door(ctx, h3x - 1.5, h3y - 9, 3, 6, '#5a3818'); }

        // --- Details (when built) ---
        if (p >= 1) {
            // Trees in yard
            this._treeSmall(ctx, sx - hw * 0.85, sy + hd * 0.3, 13, '#5a3a1a', '#40a040');
            this._treeSmall(ctx, sx + hw * 0.8, sy - hd * 0.2, 11, '#5a3a1a', '#38a838');

            // Fence segments (pagar)
            ctx.strokeStyle = '#b0a080';
            ctx.lineWidth = 0.6;
            // Front fence
            for (let f = 0; f < 6; f++) {
                const fx = sx - hw * 0.3 + f * (hw * 0.2);
                const fy = sy + hd * 0.7 + f * (-hd * 0.08);
                ctx.beginPath();
                ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 4);
                ctx.stroke();
            }
            // Fence horizontal bar
            ctx.beginPath();
            ctx.moveTo(sx - hw * 0.3, sy + hd * 0.7 - 2);
            ctx.lineTo(sx + hw * 0.7, sy + hd * 0.2 - 2);
            ctx.stroke();

            // Parked cars
            // Car 1 (on road)
            const c1x = sx + hw * 0.5, c1y = sy + hd * 0.05;
            ctx.fillStyle = '#2060a0';
            ctx.fillRect(c1x - 3, c1y - 2, 6, 3);
            ctx.fillStyle = '#1850a0';
            ctx.fillRect(c1x - 2, c1y - 3.5, 4, 2);
            // Windshield
            ctx.fillStyle = 'rgba(150,200,240,0.6)';
            ctx.fillRect(c1x - 1.5, c1y - 3.2, 1.5, 1.5);
            // Wheels
            ctx.fillStyle = '#202020';
            ctx.beginPath(); ctx.arc(c1x - 2, c1y + 1, 1, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(c1x + 2, c1y + 1, 1, 0, Math.PI * 2); ctx.fill();

            // Lamppost
            const lpx = sx - hw * 0.1, lpy = sy + hd * 0.7;
            ctx.fillStyle = '#606060';
            ctx.fillRect(lpx - 0.5, lpy - 12, 1, 12);
            ctx.fillStyle = '#808080';
            ctx.fillRect(lpx - 2, lpy - 12.5, 4, 1.5);
            // Light glow
            ctx.fillStyle = 'rgba(255,240,180,0.12)';
            ctx.beginPath();
            ctx.ellipse(lpx, lpy - 8, 6, 3, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    // --- SAWAH (Rice Paddy) ---
    _drawSawah(ctx, sx, sy, p) {
        if (p < 1) return;
        const anim = this.animTime || 0;

        // --- Pematang (mud embankment border) ---
        ctx.fillStyle = '#9a7a48';
        this._tileDiamond(ctx, sx, sy, 58, 29);
        ctx.fill();

        // Inner paddy area (water)
        const waterGrad = ctx.createLinearGradient(sx - 24, sy, sx + 24, sy);
        waterGrad.addColorStop(0, 'rgba(70,140,120,0.35)');
        waterGrad.addColorStop(0.5, 'rgba(90,160,140,0.4)');
        waterGrad.addColorStop(1, 'rgba(60,130,110,0.3)');
        ctx.fillStyle = waterGrad;
        this._tileDiamond(ctx, sx, sy, 52, 26);
        ctx.fill();

        // Water shimmer / ripples
        for (let r = 0; r < 3; r++) {
            const rx = sx - 10 + r * 12 + Math.sin(anim * 0.6 + r) * 2;
            const ry = sy - 3 + r * 3;
            ctx.fillStyle = `rgba(180,220,255,${0.06 + Math.sin(anim * 1.5 + r * 2) * 0.03})`;
            ctx.beginPath();
            ctx.ellipse(rx, ry, 6, 2, 0.2, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Rice seedlings in staggered rows ---
        const growth = (Math.sin(anim * 0.15) + 1) * 0.5; // slow cycle
        for (let r = -3; r <= 3; r++) {
            for (let c = -2; c <= 2; c++) {
                const rx = sx + r * 6 + c * 1.5;
                const ry = sy + c * 4 + r * 1.8;
                // Skip if outside diamond
                if (Math.abs(rx - sx) / 25 + Math.abs(ry - sy) / 13 > 1) continue;
                const h = 3 + growth * 4;
                const sway = Math.sin(anim * 0.7 + r * 0.8 + c * 0.5) * 0.6;
                // Stem
                const green = Math.floor(130 + growth * 60);
                ctx.strokeStyle = `rgb(${70 + Math.floor(growth * 40)},${green},${35})`;
                ctx.lineWidth = 0.6;
                ctx.beginPath();
                ctx.moveTo(rx, ry);
                ctx.quadraticCurveTo(rx + sway * 0.5, ry - h * 0.5, rx + sway, ry - h);
                ctx.stroke();
                // Leaf tip (blade of rice)
                if (growth > 0.3) {
                    ctx.strokeStyle = `rgb(${80 + Math.floor(growth * 50)},${green + 10},${30})`;
                    ctx.lineWidth = 0.4;
                    ctx.beginPath();
                    ctx.moveTo(rx + sway, ry - h);
                    ctx.lineTo(rx + sway + 1.5, ry - h - 1.5);
                    ctx.stroke();
                }
                // Rice grain cluster (when mature)
                if (growth > 0.7 && ((r + c) % 2 === 0)) {
                    ctx.fillStyle = `rgba(220,200,100,${0.4 + growth * 0.3})`;
                    ctx.beginPath();
                    ctx.arc(rx + sway + 0.5, ry - h + 0.5, 1, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // --- Pematang texture (ridge lines) ---
        ctx.strokeStyle = 'rgba(120,90,50,0.18)';
        ctx.lineWidth = 0.6;
        this._tileDiamond(ctx, sx, sy, 55, 27.5);
        ctx.stroke();

        // --- Farmer figure (small) ---
        const farmerX = sx + 8, farmerY = sy - 1;
        const farmerBob = Math.sin(anim * 1.5) * 0.5;
        // Hat (topi caping)
        ctx.fillStyle = '#c8b060';
        ctx.beginPath();
        ctx.ellipse(farmerX, farmerY - 5 + farmerBob, 3, 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Body
        ctx.fillStyle = '#4080c0';
        ctx.fillRect(farmerX - 1, farmerY - 3.5 + farmerBob, 2, 3);
        // Legs
        ctx.strokeStyle = '#6a4a2a';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(farmerX - 0.5, farmerY - 0.5 + farmerBob);
        ctx.lineTo(farmerX - 1, farmerY + 1);
        ctx.moveTo(farmerX + 0.5, farmerY - 0.5 + farmerBob);
        ctx.lineTo(farmerX + 1, farmerY + 1);
        ctx.stroke();

        // --- Irrigation channel (saluran air) ---
        ctx.strokeStyle = 'rgba(60,120,160,0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx - 26, sy + 1);
        ctx.lineTo(sx - 20, sy - 2);
        ctx.stroke();
    },

    // --- LADANG SAYUR ---
    _drawLadang(ctx, sx, sy, p) {
        if (p < 1) return;
        const anim = this.animTime || 0;

        // --- Ground base (tanah) ---
        ctx.fillStyle = '#a08048';
        this._tileDiamond(ctx, sx, sy, 56, 28);
        ctx.fill();

        // Inner plot (darker fertile soil)
        ctx.fillStyle = '#705028';
        this._tileDiamond(ctx, sx, sy, 50, 25);
        ctx.fill();

        // --- Raised bed rows (bedengan) with soil ---
        const rows = 6;
        for (let i = -Math.floor(rows / 2); i <= Math.floor(rows / 2); i++) {
            const rx = sx + i * 7;
            const ry = sy + i * 1.2;
            // Soil bed (raised mound)
            ctx.fillStyle = '#8a6030';
            ctx.beginPath();
            ctx.moveTo(rx - 2, ry + 8);
            ctx.lineTo(rx + 1, ry - 8);
            ctx.lineTo(rx + 3, ry - 8);
            ctx.lineTo(rx, ry + 8);
            ctx.closePath();
            ctx.fill();
            // Darker furrow
            ctx.fillStyle = '#604020';
            ctx.beginPath();
            ctx.moveTo(rx + 3, ry - 8);
            ctx.lineTo(rx + 5, ry - 8);
            ctx.lineTo(rx + 2, ry + 8);
            ctx.lineTo(rx, ry + 8);
            ctx.closePath();
            ctx.fill();

            // Varied plants on each row
            const growth = (Math.sin(anim * 0.15 + i * 1.3) + 1) * 0.5;
            const plantType = ((i + 10) % 3); // rotate types
            for (let j = -2; j <= 2; j++) {
                const px = rx + 1;
                const py = ry + j * 4;
                if (Math.abs(px - sx) / 24 + Math.abs(py - sy) / 12 > 1) continue;
                const sway = Math.sin(anim * 0.5 + i + j * 0.7) * 0.4;

                if (plantType === 0) {
                    // Cabbage / kubis (round green)
                    const sz = 1.8 + growth * 1.2;
                    ctx.fillStyle = `rgb(${50 + Math.floor(growth * 30)},${130 + Math.floor(growth * 50)},${30})`;
                    ctx.beginPath();
                    ctx.arc(px + sway, py - 2 - growth * 1.5, sz, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = `rgb(${70 + Math.floor(growth * 30)},${160 + Math.floor(growth * 40)},${40})`;
                    ctx.beginPath();
                    ctx.arc(px + sway - 0.5, py - 2.5 - growth * 1.5, sz * 0.6, 0, Math.PI * 2);
                    ctx.fill();
                } else if (plantType === 1) {
                    // Tomatoes / tomat (vine plant)
                    ctx.strokeStyle = `rgb(${60 + Math.floor(growth * 30)},${120 + Math.floor(growth * 50)},${30})`;
                    ctx.lineWidth = 0.5;
                    const h = 2.5 + growth * 3;
                    ctx.beginPath();
                    ctx.moveTo(px, py);
                    ctx.quadraticCurveTo(px + sway, py - h * 0.5, px + sway * 0.8, py - h);
                    ctx.stroke();
                    // Leaf clusters
                    ctx.fillStyle = `rgb(${60 + Math.floor(growth * 40)},${140 + Math.floor(growth * 50)},${30})`;
                    ctx.beginPath();
                    ctx.arc(px + sway * 0.8, py - h, 1.5 + growth * 0.5, 0, Math.PI * 2);
                    ctx.fill();
                    // Red tomato fruit
                    if (growth > 0.6) {
                        ctx.fillStyle = '#e04030';
                        ctx.beginPath();
                        ctx.arc(px + sway * 0.8 + 1, py - h + 1.5, 1, 0, Math.PI * 2);
                        ctx.fill();
                    }
                } else {
                    // Chili / cabai (tall thin plant)
                    const h = 2 + growth * 3.5;
                    ctx.strokeStyle = `rgb(${50},${110 + Math.floor(growth * 50)},${25})`;
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(px, py);
                    ctx.lineTo(px + sway, py - h);
                    ctx.stroke();
                    // Leaves
                    ctx.fillStyle = `rgb(${55},${130 + Math.floor(growth * 50)},${28})`;
                    ctx.beginPath();
                    ctx.ellipse(px + sway - 1, py - h * 0.6, 1.5, 0.7, -0.3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.ellipse(px + sway + 1, py - h * 0.7, 1.5, 0.7, 0.3, 0, Math.PI * 2);
                    ctx.fill();
                    // Chili fruits (red/green)
                    if (growth > 0.5) {
                        ctx.fillStyle = growth > 0.7 ? '#d03020' : '#60a030';
                        ctx.beginPath();
                        ctx.ellipse(px + sway + 0.5, py - h * 0.5, 0.5, 1.5, 0.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        }

        // --- Fence (pagar bambu) ---
        this._fence(ctx, sx - 26, sy + 4, sx - 26, sy - 10, '#b09050');
        this._fence(ctx, sx + 26, sy - 4, sx + 26, sy + 10, '#b09050');

        // --- Watering can / ember ---
        ctx.fillStyle = '#5888a8';
        ctx.fillRect(sx + 18, sy + 8, 3, 3);
        ctx.fillStyle = '#4878a0';
        ctx.beginPath();
        ctx.ellipse(sx + 19.5, sy + 8, 1.5, 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        // Handle
        ctx.strokeStyle = '#4070a0';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(sx + 19.5, sy + 7, 2, Math.PI, 0);
        ctx.stroke();

        // --- Scarecrow (orang-orangan sawah) ---
        const scX = sx - 16, scY = sy - 4;
        // Pole
        ctx.strokeStyle = '#8a6a30';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(scX, scY + 3);
        ctx.lineTo(scX, scY - 8);
        ctx.stroke();
        // Arms
        ctx.beginPath();
        ctx.moveTo(scX - 4, scY - 5);
        ctx.lineTo(scX + 4, scY - 5);
        ctx.stroke();
        // Hat
        ctx.fillStyle = '#c8a040';
        ctx.beginPath();
        ctx.ellipse(scX, scY - 8.5, 2.5, 1, 0, 0, Math.PI * 2);
        ctx.fill();
        // Shirt / cloth
        ctx.fillStyle = '#d06040';
        ctx.fillRect(scX - 2, scY - 7, 4, 4);
        // Cloth flap (animated)
        ctx.fillStyle = '#c05030';
        const flap = Math.sin(anim * 1.2) * 1.5;
        ctx.beginPath();
        ctx.moveTo(scX + 4, scY - 6);
        ctx.lineTo(scX + 6 + flap, scY - 5);
        ctx.lineTo(scX + 5 + flap, scY - 3);
        ctx.lineTo(scX + 4, scY - 4);
        ctx.closePath();
        ctx.fill();
    },

    // --- PERKEBUNAN (Plantation, 2x2) ---
    _drawPerkebunan(ctx, sx, sy, p) {
        if (p < 0.5) return;
        const anim = this.animTime || 0;
        this._shadow(ctx, sx, sy, 44, 24);

        // --- Ground base (rich brown soil) ---
        ctx.fillStyle = '#7a6030';
        this._tileDiamond(ctx, sx, sy, 70, 35);
        ctx.fill();

        // Inner grass/cover crop
        ctx.fillStyle = 'rgba(80,140,50,0.25)';
        this._tileDiamond(ctx, sx, sy, 64, 32);
        ctx.fill();

        // --- Dirt path between rows ---
        ctx.fillStyle = 'rgba(140,110,60,0.35)';
        ctx.beginPath();
        ctx.moveTo(sx - 30, sy + 3);
        ctx.lineTo(sx - 28, sy + 1);
        ctx.lineTo(sx + 30, sy - 3);
        ctx.lineTo(sx + 28, sy - 1);
        ctx.closePath();
        ctx.fill();

        // --- Palm trees in organized grid ---
        const positions = [
            [-20, -6], [-6, -10], [8, -8],
            [-14, 2], [0, 0], [14, -2],
            [-8, 8], [6, 6], [20, 2]
        ];
        for (const [ox, oy] of positions) {
            this._palmTree(ctx, sx + ox, sy + oy, 24 + Math.sin(ox * 0.5 + oy * 0.3) * 4, anim);
        }

        // --- Fallen palm fruits (buah sawit) on ground ---
        if (p >= 1) {
            const fruitClusters = [[sx - 5, sy - 6], [sx + 12, sy - 3], [sx - 10, sy + 4]];
            for (const [fx, fy] of fruitClusters) {
                // Cluster of orange-red fruits
                for (let f = 0; f < 4; f++) {
                    ctx.fillStyle = f < 2 ? '#d06020' : '#c08020';
                    ctx.beginPath();
                    ctx.arc(fx + f * 1.3 - 2, fy + Math.sin(f) * 0.5, 1, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // --- Worker collecting harvest ---
            const wkX = sx + 4, wkY = sy + 4;
            const bob = Math.sin(anim * 1.2) * 0.4;
            // Topi
            ctx.fillStyle = '#c8a840';
            ctx.beginPath();
            ctx.ellipse(wkX, wkY - 5 + bob, 2.5, 1, 0, 0, Math.PI * 2);
            ctx.fill();
            // Body
            ctx.fillStyle = '#d06030';
            ctx.fillRect(wkX - 1, wkY - 3.5 + bob, 2, 3);
            // Basket (keranjang)
            ctx.fillStyle = '#a08040';
            ctx.beginPath();
            ctx.ellipse(wkX + 3, wkY + bob, 2, 1.5, 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#d07030';
            ctx.beginPath();
            ctx.arc(wkX + 3, wkY - 0.5 + bob, 1, 0, Math.PI * 2);
            ctx.fill();

            // --- Small shed (gubuk) ---
            const shX = sx - 22, shY = sy + 7;
            ctx.fillStyle = '#8a6830';
            ctx.fillRect(shX - 3, shY - 5, 6, 5);
            ctx.fillStyle = '#6a4820';
            ctx.fillRect(shX - 3.5, shY - 7, 7, 2.5);
            // Shed door
            ctx.fillStyle = '#503018';
            ctx.fillRect(shX - 1, shY - 4, 2.5, 4);
        }
    },

    // --- PETERNAKAN (Livestock Farm) — world-class detail ---
    _drawPeternakan(ctx, sx, sy, p) {
        const anim = this.animTime || 0;

        // ── helpers ──────────────────────────────────────────────────────
        const lerp = (a, b, t) => a + (b - a) * t;

        // ── SHADOW ───────────────────────────────────────────────────────
        this._shadow(ctx, sx, sy, 32, 18);

        // ── TERRAIN ──────────────────────────────────────────────────────
        // Base grass
        ctx.fillStyle = '#58a038';
        ctx.beginPath();
        ctx.moveTo(sx - 2, sy - 28); ctx.lineTo(sx + 40, sy - 6);
        ctx.lineTo(sx + 20, sy + 18); ctx.lineTo(sx - 22, sy - 4);
        ctx.closePath(); ctx.fill();

        // Darker grass clumps (depth)
        ctx.fillStyle = '#4e9030';
        for (let g = 0; g < 7; g++) {
            const gx = sx - 10 + g * 7 + Math.sin(g * 3.7) * 4;
            const gy = sy - 6 + g * 3 + Math.cos(g * 2.1) * 3;
            ctx.beginPath();
            ctx.ellipse(gx, gy, 3.5 + g * 0.4, 1.8, 0.1 * g, 0, Math.PI * 2);
            ctx.fill();
        }

        // Worn dirt path from barn entrance to paddock
        ctx.fillStyle = '#aa8850';
        ctx.beginPath();
        ctx.moveTo(sx + 2, sy - 2); ctx.lineTo(sx + 14, sy + 1);
        ctx.lineTo(sx + 12, sy + 6); ctx.lineTo(sx, sy + 3);
        ctx.closePath(); ctx.fill();

        // Mud patch at barn entrance
        ctx.fillStyle = '#7a5030';
        ctx.beginPath();
        ctx.ellipse(sx + 4, sy + 0.5, 5, 2.5, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // ── BARN STRUCTURE ────────────────────────────────────────────────
        // Positioned slightly left-back
        const bx = sx - 8, by = sy - 3;
        const bhw = 16, bhd = 8, bh = 16 * p;

        // Barn floor shadow
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.beginPath();
        ctx.ellipse(bx, by + 1, bhw + 2, bhd * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- Barn top face ---
        ctx.fillStyle = '#c07038';
        ctx.beginPath();
        ctx.moveTo(bx, by - bhd - bh); ctx.lineTo(bx + bhw, by - bh);
        ctx.lineTo(bx, by + bhd - bh); ctx.lineTo(bx - bhw, by - bh);
        ctx.closePath(); ctx.fill();

        // --- Barn left wall (planked wood) ---
        const lwG = ctx.createLinearGradient(bx - bhw, by - bh, bx - bhw, by);
        lwG.addColorStop(0, '#c06030'); lwG.addColorStop(0.5, '#b05828'); lwG.addColorStop(1, '#a05020');
        ctx.fillStyle = lwG;
        ctx.beginPath();
        ctx.moveTo(bx - bhw, by); ctx.lineTo(bx - bhw, by - bh);
        ctx.lineTo(bx, by - bhd - bh); ctx.lineTo(bx, by - bhd);
        ctx.closePath(); ctx.fill();

        // Vertical plank lines on left wall
        ctx.strokeStyle = 'rgba(60,20,5,0.18)';
        ctx.lineWidth = 0.5;
        for (let pk = 1; pk <= 5; pk++) {
            const t = pk / 6;
            const px1 = bx - bhw + (bhw * 2) * t * 0.5;
            const py1 = by + bhd * t * 0.5;
            ctx.beginPath();
            ctx.moveTo(px1, py1);
            ctx.lineTo(px1, py1 - bh);
            ctx.stroke();
        }

        // Horizontal weathering bands
        ctx.strokeStyle = 'rgba(60,20,5,0.10)';
        ctx.lineWidth = 0.3;
        for (let wb = 1; wb <= 4; wb++) {
            const t = wb / 5;
            const wy = by - bh * t;
            ctx.beginPath();
            ctx.moveTo(bx - bhw, wy); ctx.lineTo(bx, wy - bhd); ctx.stroke();
        }

        // --- Barn right wall ---
        const rwG = ctx.createLinearGradient(bx + bhw, by - bh, bx + bhw, by);
        rwG.addColorStop(0, '#903818'); rwG.addColorStop(0.5, '#882810'); rwG.addColorStop(1, '#802010');
        ctx.fillStyle = rwG;
        ctx.beginPath();
        ctx.moveTo(bx + bhw, by); ctx.lineTo(bx + bhw, by - bh);
        ctx.lineTo(bx, by - bhd - bh); ctx.lineTo(bx, by - bhd);
        ctx.closePath(); ctx.fill();

        // Plank lines on right wall
        ctx.strokeStyle = 'rgba(40,10,0,0.15)';
        ctx.lineWidth = 0.5;
        for (let pk = 1; pk <= 5; pk++) {
            const t = pk / 6;
            const px1 = bx + bhw - (bhw * 2) * t * 0.5;
            const py1 = by + bhd * t * 0.5;
            ctx.beginPath();
            ctx.moveTo(px1, py1); ctx.lineTo(px1, py1 - bh); ctx.stroke();
        }

        // --- Large sliding barn door on left wall ---
        if (p > 0.35) {
            const dx = bx - 8, dy = by - bhd * 0.4;
            const dw = 8, dh = bh * 0.72;
            // Door frame shadow
            ctx.fillStyle = '#3a1808';
            ctx.fillRect(dx - 0.5, dy - dh - 0.5, dw + 1, dh + 1);
            // Door panels
            const dG = ctx.createLinearGradient(dx, dy - dh, dx + dw, dy);
            dG.addColorStop(0, '#6a3010'); dG.addColorStop(1, '#4a2008');
            ctx.fillStyle = dG;
            ctx.fillRect(dx, dy - dh, dw, dh);
            // X-brace cross beams
            ctx.strokeStyle = '#7a3818'; ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(dx, dy - dh); ctx.lineTo(dx + dw, dy); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(dx + dw, dy - dh); ctx.lineTo(dx, dy); ctx.stroke();
            // Metal hinge
            ctx.fillStyle = '#707070';
            ctx.fillRect(dx - 0.5, dy - dh * 0.72, 2, 1.5);
            ctx.fillRect(dx - 0.5, dy - dh * 0.28, 2, 1.5);
        }

        // --- Hayloft window (gable end) ---
        if (p > 0.45) {
            // Left face hayloft
            ctx.fillStyle = '#3a1808';
            ctx.fillRect(bx - bhw * 0.42, by - bh * 0.82, 5.5, 4.5);
            ctx.fillStyle = 'rgba(160,195,215,0.55)';
            ctx.fillRect(bx - bhw * 0.42 + 0.5, by - bh * 0.82 + 0.5, 4.5, 3.5);
            // Warm interior glow (hay inside)
            ctx.fillStyle = 'rgba(240,190,60,0.18)';
            ctx.fillRect(bx - bhw * 0.42 + 0.5, by - bh * 0.82 + 0.5, 4.5, 3.5);
            // Cross divider
            ctx.strokeStyle = 'rgba(40,20,5,0.4)'; ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(bx - bhw * 0.42 + 2.5, by - bh * 0.82 + 0.5);
            ctx.lineTo(bx - bhw * 0.42 + 2.5, by - bh * 0.82 + 4);
            ctx.moveTo(bx - bhw * 0.42 + 0.5, by - bh * 0.82 + 2);
            ctx.lineTo(bx - bhw * 0.42 + 5.5, by - bh * 0.82 + 2);
            ctx.stroke();
        }

        // --- Corrugated metal roof ───────────────────────────────────────
        if (p > 0.15) {
            // Left roof slope
            ctx.fillStyle = '#722210';
            ctx.beginPath();
            ctx.moveTo(bx - bhw - 3, by - bh + bhd * 0.5 + 1);
            ctx.lineTo(bx - 1, by - bhd - bh - 10 * p);
            ctx.lineTo(bx + 1, by - bhd - bh - 10 * p);
            ctx.lineTo(bx, by - bhd - bh);
            ctx.lineTo(bx - bhw, by - bh);
            ctx.closePath(); ctx.fill();

            // Right roof slope
            ctx.fillStyle = '#5a1808';
            ctx.beginPath();
            ctx.moveTo(bx + bhw + 3, by - bh + bhd * 0.5 + 1);
            ctx.lineTo(bx + 1, by - bhd - bh - 10 * p);
            ctx.lineTo(bx - 1, by - bhd - bh - 10 * p);
            ctx.lineTo(bx, by - bhd - bh);
            ctx.lineTo(bx + bhw, by - bh);
            ctx.closePath(); ctx.fill();

            // Front roof face (facing viewer)
            ctx.fillStyle = '#8a3020';
            ctx.beginPath();
            ctx.moveTo(bx + 1, by - bhd - bh - 10 * p);
            ctx.lineTo(bx + bhw + 3, by - bh + bhd * 0.5 + 1);
            ctx.lineTo(bx, by - bh + bhd + 3);
            ctx.lineTo(bx - bhw - 3, by - bh + bhd * 0.5 + 1);
            ctx.closePath(); ctx.fill();

            // Corrugation ridges on front face
            ctx.strokeStyle = 'rgba(120,50,30,0.25)'; ctx.lineWidth = 0.5;
            for (let cr = 1; cr <= 5; cr++) {
                const t = cr / 6;
                const crx1 = bx - bhw - 3 + (bhw + 3) * 2 * t;
                const cry1 = (by - bh + bhd * 0.5 + 1) + ((by - bh + bhd + 3) - (by - bh + bhd * 0.5 + 1)) * t;
                ctx.beginPath();
                ctx.moveTo(crx1, cry1);
                ctx.lineTo(bx + 1 - (bx + 1 - crx1) * 0.15, by - bhd - bh - 10 * p + 1);
                ctx.stroke();
            }
            // Corrugation highlights (shiny metal)
            ctx.strokeStyle = 'rgba(220,150,100,0.12)'; ctx.lineWidth = 0.4;
            for (let cr = 0; cr <= 4; cr++) {
                const t = cr / 5 + 0.1;
                const crx1 = bx - bhw - 3 + (bhw + 3) * 2 * t;
                const cry1 = (by - bh + bhd * 0.5 + 1) + ((by - bh + bhd + 3) - (by - bh + bhd * 0.5 + 1)) * t;
                ctx.beginPath();
                ctx.moveTo(crx1 - 0.5, cry1 - 0.5);
                ctx.lineTo(bx, by - bhd - bh - 10 * p);
                ctx.stroke();
            }

            // Ridge cap (ventilation strip)
            ctx.fillStyle = '#4a1008';
            ctx.fillRect(bx - 2, by - bhd - bh - 10 * p - 1, 4, 2.5);
            ctx.fillStyle = '#686060';
            ctx.fillRect(bx - 1.5, by - bhd - bh - 10 * p - 0.5, 3, 1.5);

            // Weathervane on ridge
            if (p > 0.8) {
                const vx = bx, vy = by - bhd - bh - 10 * p - 3;
                ctx.strokeStyle = '#909090'; ctx.lineWidth = 0.7;
                ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(vx, vy - 5); ctx.stroke();
                // Arrow
                const va = anim * 0.3; // slow rotation
                ctx.strokeStyle = '#b8b8b8'; ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.moveTo(vx + Math.cos(va) * 4, vy - 5 + Math.sin(va) * 1.5);
                ctx.lineTo(vx - Math.cos(va) * 4, vy - 5 - Math.sin(va) * 1.5);
                ctx.stroke();
                ctx.fillStyle = '#d0d0d0';
                ctx.beginPath();
                ctx.arc(vx + Math.cos(va) * 4, vy - 5 + Math.sin(va) * 1.5, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // ── GRAIN SILO ────────────────────────────────────────────────────
        if (p > 0.4) {
            const sx2 = sx + 18, sy2 = sy - 10;
            const sr = 4, sh = 14 * p;
            // Silo shadow
            ctx.fillStyle = 'rgba(0,0,0,0.10)';
            ctx.beginPath();
            ctx.ellipse(sx2, sy2 + 2, sr + 2, (sr + 2) * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();
            // Cylinder body (left face)
            const siloG = ctx.createLinearGradient(sx2 - sr, sy2 - sh, sx2, sy2 - sh);
            siloG.addColorStop(0, '#d0c890'); siloG.addColorStop(0.5, '#e0d8a0'); siloG.addColorStop(1, '#b8b07c');
            ctx.fillStyle = siloG;
            ctx.beginPath();
            ctx.moveTo(sx2 - sr, sy2); ctx.lineTo(sx2 - sr, sy2 - sh);
            ctx.lineTo(sx2, sy2 - sr * 0.45 - sh); ctx.lineTo(sx2, sy2 - sr * 0.45);
            ctx.closePath(); ctx.fill();
            // Cylinder right face
            ctx.fillStyle = '#a0985c';
            ctx.beginPath();
            ctx.moveTo(sx2 + sr, sy2); ctx.lineTo(sx2 + sr, sy2 - sh);
            ctx.lineTo(sx2, sy2 - sr * 0.45 - sh); ctx.lineTo(sx2, sy2 - sr * 0.45);
            ctx.closePath(); ctx.fill();
            // Cylinder top cap
            ctx.fillStyle = '#c8c080';
            ctx.beginPath();
            ctx.ellipse(sx2, sy2 - sh - sr * 0.25, sr, sr * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();
            // Conical silo roof
            ctx.fillStyle = '#788068';
            ctx.beginPath();
            ctx.moveTo(sx2, sy2 - sh - sr * 0.45 - 6 * p);
            ctx.lineTo(sx2 + sr + 1, sy2 - sh + 1);
            ctx.lineTo(sx2 - sr - 1, sy2 - sh + 1);
            ctx.closePath(); ctx.fill();
            // Horizontal banding rings
            ctx.strokeStyle = 'rgba(100,90,50,0.2)'; ctx.lineWidth = 0.4;
            for (let ri = 1; ri <= 4; ri++) {
                const ry = sy2 - sh * (ri / 5);
                ctx.beginPath();
                ctx.moveTo(sx2 - sr, ry); ctx.lineTo(sx2, ry - sr * 0.45); ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(sx2 + sr, ry); ctx.lineTo(sx2, ry - sr * 0.45); ctx.stroke();
            }
            // Ladder rungs
            ctx.strokeStyle = 'rgba(80,70,40,0.3)'; ctx.lineWidth = 0.3;
            for (let ld = 0; ld <= 5; ld++) {
                const ly = sy2 - sh * 0.15 - ld * sh * 0.13;
                ctx.beginPath();
                ctx.moveTo(sx2 + sr * 0.6, ly); ctx.lineTo(sx2 + sr + 1.5, ly); ctx.stroke();
            }
        }

        if (p < 0.5) return;

        // ── WOODEN FENCE (post-and-rail) ──────────────────────────────────
        // Posts arranged around the paddock (right half)
        const posts = [
            [sx + 4,  sy - 8], [sx + 12, sy - 5], [sx + 22, sy - 1],
            [sx + 26, sy + 4], [sx + 22, sy + 9], [sx + 12, sy + 11],
            [sx + 4,  sy + 8]
        ];
        // Back rail first (painter's order)
        ctx.strokeStyle = '#c09a58'; ctx.lineWidth = 0.8;
        for (let pi = 0; pi < posts.length - 1; pi++) {
            const [fx, fy] = posts[pi], [nx, ny] = posts[pi + 1];
            // Top rail
            ctx.beginPath(); ctx.moveTo(fx, fy - 6); ctx.lineTo(nx, ny - 6); ctx.stroke();
            // Bottom rail
            ctx.beginPath(); ctx.moveTo(fx, fy - 3); ctx.lineTo(nx, ny - 3); ctx.stroke();
        }
        // Posts (drawn over rails)
        for (const [fx, fy] of posts) {
            // Post shadow
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            ctx.fillRect(fx + 0.5, fy - 7, 1, 7);
            // Post body (weathered wood)
            const pG = ctx.createLinearGradient(fx - 1, fy - 8, fx + 1, fy - 8);
            pG.addColorStop(0, '#d0a858'); pG.addColorStop(0.5, '#c89848'); pG.addColorStop(1, '#b08838');
            ctx.fillStyle = pG;
            ctx.fillRect(fx - 1, fy - 8, 2, 8);
            // Post cap
            ctx.fillStyle = '#e0b860';
            ctx.fillRect(fx - 1.5, fy - 8, 3, 1);
        }

        // ── ROUND HAY BALE (large cylindrical) ───────────────────────────
        const hbx = sx - 19, hby = sy + 4;
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath(); ctx.ellipse(hbx + 1, hby + 2, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        // Cylinder body
        ctx.fillStyle = '#c8a840';
        ctx.fillRect(hbx - 4, hby - 5, 8, 6);
        // Front circular face
        const hbG = ctx.createLinearGradient(hbx - 4, hby - 5, hbx + 4, hby + 1);
        hbG.addColorStop(0, '#e0c050'); hbG.addColorStop(0.5, '#d8b848'); hbG.addColorStop(1, '#c0a030');
        ctx.fillStyle = hbG;
        ctx.beginPath(); ctx.ellipse(hbx + 4, hby - 2, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
        // Spiral straw pattern on face
        ctx.strokeStyle = 'rgba(160,110,20,0.25)'; ctx.lineWidth = 0.4;
        for (let sr2 = 1; sr2 <= 3; sr2++) {
            ctx.beginPath(); ctx.ellipse(hbx + 4, hby - 2, sr2 * 1.2, sr2 * 1.5, 0, 0, Math.PI * 2); ctx.stroke();
        }
        // Top edge highlight
        ctx.strokeStyle = 'rgba(240,200,80,0.5)'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(hbx - 4, hby - 5); ctx.lineTo(hbx + 4, hby - 5); ctx.stroke();
        // Sisal twine bands
        ctx.strokeStyle = '#8a6018'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(hbx - 1, hby - 5); ctx.lineTo(hbx - 1, hby + 1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(hbx + 2, hby - 5); ctx.lineTo(hbx + 2, hby + 1); ctx.stroke();

        // Second smaller square hay bale stacked
        ctx.fillStyle = '#c09838';
        ctx.fillRect(hbx - 16, hby - 1, 5, 3);
        ctx.fillStyle = '#d8b040';
        ctx.beginPath(); ctx.ellipse(hbx - 13.5, hby - 1, 2.5, 1, 0, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(160,110,20,0.2)'; ctx.lineWidth = 0.3;
        ctx.beginPath(); ctx.moveTo(hbx - 16, hby); ctx.lineTo(hbx - 11, hby); ctx.stroke();

        // ── WATER TROUGH (bak minum ternak) ──────────────────────────────
        const tx = sx + 9, ty = sy + 7;
        // Trough shadow
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.beginPath(); ctx.ellipse(tx + 1, ty + 2, 7, 2, 0, 0, Math.PI * 2); ctx.fill();
        // Trough body (weathered wood/galvanized)
        ctx.fillStyle = '#888070';
        ctx.beginPath();
        ctx.moveTo(tx - 5, ty); ctx.lineTo(tx + 6, ty - 3);
        ctx.lineTo(tx + 6, ty - 5); ctx.lineTo(tx - 5, ty - 2);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#706860';
        ctx.beginPath();
        ctx.moveTo(tx + 6, ty - 3); ctx.lineTo(tx + 8, ty - 2);
        ctx.lineTo(tx + 8, ty - 4); ctx.lineTo(tx + 6, ty - 5);
        ctx.closePath(); ctx.fill();
        // Water surface (animated ripple)
        const wRip = Math.sin(anim * 1.8) * 0.3;
        ctx.fillStyle = 'rgba(80,150,210,0.7)';
        ctx.beginPath();
        ctx.moveTo(tx - 4.5, ty - 2.5 + wRip); ctx.lineTo(tx + 5.5, ty - 5.5 + wRip);
        ctx.lineTo(tx + 5.5, ty - 4 + wRip); ctx.lineTo(tx - 4.5, ty - 1 + wRip);
        ctx.closePath(); ctx.fill();
        // Water glint
        ctx.strokeStyle = 'rgba(180,230,255,0.5)'; ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(tx - 2, ty - 3.5 + wRip * 0.5);
        ctx.lineTo(tx + 2, ty - 5 + wRip * 0.5); ctx.stroke();

        // ── SMALL CHICKEN COOP ────────────────────────────────────────────
        if (p > 0.6) {
            const cx2 = sx - 20, cy2 = sy - 4;
            // Coop body
            this._box(ctx, cx2, cy2, 7, 3.5, 7 * p, '#d8c898', ['#c8b888','#b8a878'], ['#a89868','#988858']);
            // Coop roof (mini gable)
            ctx.fillStyle = '#8a6030';
            ctx.beginPath();
            ctx.moveTo(cx2, cy2 - 3.5 - 7 * p - 4 * p);
            ctx.lineTo(cx2 + 7 + 2, cy2 - 7 * p + 1);
            ctx.lineTo(cx2, cy2 + 3.5 - 7 * p + 1);
            ctx.lineTo(cx2 - 7 - 2, cy2 - 7 * p + 1);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#6a4818';
            ctx.beginPath();
            ctx.moveTo(cx2, cy2 - 3.5 - 7 * p - 4 * p);
            ctx.lineTo(cx2 - 7 - 2, cy2 - 7 * p + 1);
            ctx.lineTo(cx2, cy2 - 7 * p + 3.5 + 1);
            ctx.lineTo(cx2 + 7 + 2, cy2 - 7 * p + 1);
            ctx.closePath(); ctx.fill();
            // Small coop door
            ctx.fillStyle = '#4a2c0a';
            ctx.beginPath();
            ctx.arc(cx2 - 4, cy2 - 2, 1.5, Math.PI, 0);
            ctx.lineTo(cx2 - 2.5, cy2); ctx.lineTo(cx2 - 5.5, cy2);
            ctx.closePath(); ctx.fill();
            // Nesting box ladder
            ctx.strokeStyle = '#b89050'; ctx.lineWidth = 0.5;
            for (let ld = 0; ld < 3; ld++) {
                const ly = cy2 - 1 - ld * 1.5;
                ctx.beginPath(); ctx.moveTo(cx2 - 5, ly); ctx.lineTo(cx2 - 2.5, ly - 0.8); ctx.stroke();
            }
        }

        // ── COWS (sapi Holstein) ──────────────────────────────────────────
        // Cow 1 — facing right, standing
        {
            const c1x = sx + 14, c1y = sy + 1;
            const bob = Math.sin(anim * 0.7) * 0.4;
            const tail = Math.sin(anim * 1.4) * 3;

            // Cow shadow
            ctx.fillStyle = 'rgba(0,0,0,0.10)';
            ctx.beginPath(); ctx.ellipse(c1x, c1y + 4, 5.5, 2, 0, 0, Math.PI * 2); ctx.fill();

            // Hooves (drawn first, behind legs)
            ctx.fillStyle = '#2a2018';
            for (const [hx2, hy2] of [
                [c1x - 2.5, c1y + 5.2], [c1x - 0.8, c1y + 5.2],
                [c1x + 1.8, c1y + 4.8], [c1x + 3.5, c1y + 4.8]
            ]) {
                ctx.beginPath(); ctx.ellipse(hx2, hy2, 1, 0.5, 0, 0, Math.PI * 2); ctx.fill();
            }

            // Legs
            ctx.strokeStyle = '#8a6840'; ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(c1x - 2.5, c1y + 2.5 + bob); ctx.lineTo(c1x - 2.5, c1y + 5);
            ctx.moveTo(c1x - 0.8, c1y + 2.5 + bob); ctx.lineTo(c1x - 0.8, c1y + 5);
            ctx.moveTo(c1x + 1.8, c1y + 2.5 + bob); ctx.lineTo(c1x + 1.8, c1y + 4.8);
            ctx.moveTo(c1x + 3.5, c1y + 2.5 + bob); ctx.lineTo(c1x + 3.5, c1y + 4.8);
            ctx.stroke();

            // Udder
            ctx.fillStyle = '#e8b0b0';
            ctx.beginPath(); ctx.ellipse(c1x + 0.5, c1y + 3.2 + bob, 2, 1, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#d89090';
            ctx.beginPath(); ctx.arc(c1x - 0.5, c1y + 4 + bob, 0.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(c1x + 1.5, c1y + 4 + bob, 0.5, 0, Math.PI * 2); ctx.fill();

            // Body (white Holstein base)
            ctx.fillStyle = '#f0ece4';
            ctx.beginPath(); ctx.ellipse(c1x, c1y + bob, 5.5, 3, 0.08, 0, Math.PI * 2); ctx.fill();
            // Black Holstein patches
            ctx.fillStyle = '#1c1a18';
            ctx.beginPath(); ctx.ellipse(c1x - 2, c1y - 0.5 + bob, 2.2, 1.8, -0.3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(c1x + 1.5, c1y + 1 + bob, 1.5, 1.2, 0.2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(c1x - 0.5, c1y + 1.5 + bob, 1.2, 0.8, 0, 0, Math.PI * 2); ctx.fill();

            // Neck
            ctx.fillStyle = '#e8e2d8';
            ctx.beginPath(); ctx.ellipse(c1x + 4.5, c1y - 0.2 + bob, 1.8, 1.4, -0.25, 0, Math.PI * 2); ctx.fill();
            // Black patch on neck
            ctx.fillStyle = '#1c1a18';
            ctx.beginPath(); ctx.ellipse(c1x + 5, c1y + 0.2 + bob, 1, 0.9, -0.2, 0, Math.PI * 2); ctx.fill();

            // Head
            ctx.fillStyle = '#e0d8cc';
            ctx.beginPath(); ctx.ellipse(c1x + 6.2, c1y - 0.8 + bob, 2, 1.6, 0.1, 0, Math.PI * 2); ctx.fill();
            // Black eye patch
            ctx.fillStyle = '#1c1a18';
            ctx.beginPath(); ctx.ellipse(c1x + 7, c1y - 1.5 + bob, 0.8, 0.6, 0, 0, Math.PI * 2); ctx.fill();
            // Eye
            ctx.fillStyle = '#2a2010';
            ctx.beginPath(); ctx.arc(c1x + 7.3, c1y - 1.6 + bob, 0.45, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.beginPath(); ctx.arc(c1x + 7.5, c1y - 1.8 + bob, 0.15, 0, Math.PI * 2); ctx.fill();
            // Snout / muzzle
            ctx.fillStyle = '#d0b098';
            ctx.beginPath(); ctx.ellipse(c1x + 8, c1y - 0.2 + bob, 1, 0.8, 0.2, 0, Math.PI * 2); ctx.fill();
            // Nostrils
            ctx.fillStyle = '#a07050';
            ctx.beginPath(); ctx.arc(c1x + 8.4, c1y - 0.1 + bob, 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(c1x + 7.7, c1y + 0.2 + bob, 0.3, 0, Math.PI * 2); ctx.fill();
            // Ear
            ctx.fillStyle = '#c8b890';
            ctx.beginPath(); ctx.ellipse(c1x + 5.5, c1y - 2.2 + bob, 1, 0.5, -1.0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#d8907a';
            ctx.beginPath(); ctx.ellipse(c1x + 5.5, c1y - 2.2 + bob, 0.5, 0.3, -1.0, 0, Math.PI * 2); ctx.fill();
            // Horn
            ctx.strokeStyle = '#c0b060'; ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(c1x + 5.8, c1y - 2.4 + bob);
            ctx.quadraticCurveTo(c1x + 5.2, c1y - 4.5 + bob, c1x + 5.8, c1y - 5 + bob);
            ctx.stroke();
            // Tail (animated swish)
            ctx.strokeStyle = '#c0b890'; ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(c1x - 5, c1y - 0.5 + bob);
            ctx.quadraticCurveTo(c1x - 7, c1y + 1 + bob, c1x - 6 + tail * 0.5, c1y + 3 + bob);
            ctx.stroke();
            // Tail tuft
            ctx.fillStyle = '#d8d0b0';
            ctx.beginPath(); ctx.ellipse(c1x - 6 + tail * 0.5, c1y + 3.5 + bob, 1.2, 0.8, 0.4, 0, Math.PI * 2); ctx.fill();
        }

        // Cow 2 — grazing (head down, brown)
        {
            const c2x = sx + 20, c2y = sy + 4;
            const graze = Math.sin(anim * 0.4 + 1.5) * 0.5;

            ctx.fillStyle = 'rgba(0,0,0,0.08)';
            ctx.beginPath(); ctx.ellipse(c2x, c2y + 3.5, 4.5, 1.8, 0, 0, Math.PI * 2); ctx.fill();

            // Legs
            ctx.strokeStyle = '#7a5830'; ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(c2x - 2, c2y + 2); ctx.lineTo(c2x - 2, c2y + 4.5);
            ctx.moveTo(c2x + 2, c2y + 2); ctx.lineTo(c2x + 2, c2y + 4.5);
            ctx.stroke();

            // Body (brown, no spots)
            ctx.fillStyle = '#9a7040';
            ctx.beginPath(); ctx.ellipse(c2x, c2y, 4.5, 2.5, 0.05, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#b08050';
            ctx.beginPath(); ctx.ellipse(c2x - 1, c2y - 0.8, 2.5, 1.5, 0, 0, Math.PI * 2); ctx.fill();

            // Neck down (grazing)
            ctx.fillStyle = '#8a6030';
            ctx.beginPath();
            ctx.moveTo(c2x + 3, c2y - 1);
            ctx.quadraticCurveTo(c2x + 5, c2y + 0.5, c2x + 4.5, c2y + 2.5 + graze);
            ctx.lineTo(c2x + 3.5, c2y + 2.5 + graze);
            ctx.quadraticCurveTo(c2x + 3.8, c2y + 0.5, c2x + 2.2, c2y - 0.5);
            ctx.closePath(); ctx.fill();

            // Head (grazing = angled down)
            ctx.fillStyle = '#9a6838';
            ctx.beginPath(); ctx.ellipse(c2x + 4, c2y + 2.8 + graze, 1.8, 1.2, 0.4, 0, Math.PI * 2); ctx.fill();
            // Eye
            ctx.fillStyle = '#2a1808';
            ctx.beginPath(); ctx.arc(c2x + 4.8, c2y + 2.2 + graze, 0.4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.beginPath(); ctx.arc(c2x + 5, c2y + 2.0 + graze, 0.15, 0, Math.PI * 2); ctx.fill();
            // Muzzle down
            ctx.fillStyle = '#c09870';
            ctx.beginPath(); ctx.ellipse(c2x + 5, c2y + 3.8 + graze, 1, 0.7, 0.5, 0, Math.PI * 2); ctx.fill();

            // Tail
            ctx.strokeStyle = '#b09060'; ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(c2x - 4, c2y - 0.5);
            ctx.quadraticCurveTo(c2x - 6, c2y + 1, c2x - 5.5, c2y + 3.5);
            ctx.stroke();
        }

        // ── CHICKENS (ayam + jago) ─────────────────────────────────────────
        const chickenDefs = [
            { x: sx + 5,  y: sy + 6,  col: '#f0e0b0', wattle: true,  seed: 0   },
            { x: sx + 8,  y: sy + 9,  col: '#d8c890', wattle: false, seed: 1.5 },
            { x: sx + 2,  y: sy + 4,  col: '#e08020', wattle: true,  seed: 0.8 }, // rooster
            { x: sx + 10, y: sy + 5,  col: '#f8f0e0', wattle: false, seed: 2.5 },
        ];
        for (const ch of chickenDefs) {
            const peck = Math.sin(anim * 2.5 + ch.seed) * 1.2;
            const walkX = Math.sin(anim * 1.5 + ch.seed * 2) * 0.8;

            // Chicken shadow
            ctx.fillStyle = 'rgba(0,0,0,0.08)';
            ctx.beginPath(); ctx.ellipse(ch.x + walkX + 0.5, ch.y + 2, 2, 0.8, 0, 0, Math.PI * 2); ctx.fill();

            // Feet
            ctx.strokeStyle = '#c08828'; ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(ch.x + walkX - 0.8, ch.y + 1.5 + peck * 0.2);
            ctx.lineTo(ch.x + walkX - 1.5, ch.y + 2.5);
            ctx.moveTo(ch.x + walkX + 0.8, ch.y + 1.5 + peck * 0.2);
            ctx.lineTo(ch.x + walkX + 1.5, ch.y + 2.5);
            // Toes
            ctx.moveTo(ch.x + walkX - 1.5, ch.y + 2.5);
            ctx.lineTo(ch.x + walkX - 2.5, ch.y + 2.3);
            ctx.moveTo(ch.x + walkX + 1.5, ch.y + 2.5);
            ctx.lineTo(ch.x + walkX + 2.5, ch.y + 2.3);
            ctx.stroke();

            // Body (teardrop shape)
            const bG = ctx.createLinearGradient(ch.x + walkX - 2, ch.y - 1 + peck * 0.1, ch.x + walkX + 1, ch.y + 1.5 + peck * 0.1);
            bG.addColorStop(0, ch.col); bG.addColorStop(1, ch.col.replace(/[0-9a-f]{2}$/i, '60'));
            ctx.fillStyle = ch.col;
            ctx.beginPath(); ctx.ellipse(ch.x + walkX - 0.3, ch.y + 0.5 + peck * 0.1, 2.2, 1.4, -0.2, 0, Math.PI * 2); ctx.fill();

            // Wing detail
            ctx.strokeStyle = `rgba(0,0,0,0.12)`; ctx.lineWidth = 0.4;
            ctx.beginPath();
            ctx.moveTo(ch.x + walkX - 1.8, ch.y + 0 + peck * 0.1);
            ctx.quadraticCurveTo(ch.x + walkX, ch.y + 1.5 + peck * 0.1, ch.x + walkX + 1.5, ch.y + 0.5 + peck * 0.1);
            ctx.stroke();

            // Tail feathers
            ctx.fillStyle = ch.col;
            ctx.beginPath();
            ctx.moveTo(ch.x + walkX - 2.2, ch.y + 0.3 + peck * 0.1);
            ctx.lineTo(ch.x + walkX - 4, ch.y - 0.8 + peck * 0.1);
            ctx.lineTo(ch.x + walkX - 3.5, ch.y + 0.1 + peck * 0.1);
            ctx.closePath(); ctx.fill();
            if (ch.wattle) {  // rooster — extra tail feathers
                ctx.fillStyle = '#d07020';
                ctx.beginPath();
                ctx.moveTo(ch.x + walkX - 2.2, ch.y + 0 + peck * 0.1);
                ctx.lineTo(ch.x + walkX - 4.5, ch.y - 1.5 + peck * 0.1);
                ctx.lineTo(ch.x + walkX - 3.8, ch.y - 0.5 + peck * 0.1);
                ctx.closePath(); ctx.fill();
            }

            // Neck
            ctx.fillStyle = ch.col;
            ctx.beginPath(); ctx.ellipse(ch.x + walkX + 1.6, ch.y - 0.2 + peck * 0.3, 1, 0.9, 0.2, 0, Math.PI * 2); ctx.fill();

            // Head
            ctx.beginPath(); ctx.arc(ch.x + walkX + 2.3, ch.y - 1.1 + peck, 1, 0, Math.PI * 2); ctx.fill();

            // Comb
            ctx.fillStyle = '#d02018';
            ctx.beginPath();
            ctx.moveTo(ch.x + walkX + 1.8, ch.y - 2 + peck);
            ctx.lineTo(ch.x + walkX + 2.1, ch.y - 2.8 + peck);
            ctx.lineTo(ch.x + walkX + 2.4, ch.y - 2 + peck);
            ctx.lineTo(ch.x + walkX + 2.7, ch.y - 2.7 + peck);
            ctx.lineTo(ch.x + walkX + 3, ch.y - 2 + peck);
            ctx.closePath(); ctx.fill();

            // Wattle
            if (ch.wattle) {
                ctx.fillStyle = '#c01810';
                ctx.beginPath(); ctx.ellipse(ch.x + walkX + 2.5, ch.y - 0.6 + peck, 0.5, 0.8, 0.2, 0, Math.PI * 2); ctx.fill();
            }

            // Beak
            ctx.fillStyle = '#c89020';
            ctx.beginPath();
            ctx.moveTo(ch.x + walkX + 3.2, ch.y - 1 + peck);
            ctx.lineTo(ch.x + walkX + 4.0, ch.y - 0.6 + peck);
            ctx.lineTo(ch.x + walkX + 3.2, ch.y - 0.4 + peck);
            ctx.closePath(); ctx.fill();

            // Eye
            ctx.fillStyle = '#181008';
            ctx.beginPath(); ctx.arc(ch.x + walkX + 2.9, ch.y - 1.3 + peck, 0.35, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.beginPath(); ctx.arc(ch.x + walkX + 3.05, ch.y - 1.45 + peck, 0.12, 0, Math.PI * 2); ctx.fill();
        }

        // ── FEED BUCKET near barn door ────────────────────────────────────
        if (p > 0.7) {
            const fbx = sx, fby = sy + 1;
            ctx.fillStyle = '#606870';
            ctx.beginPath();
            ctx.moveTo(fbx - 1.5, fby); ctx.lineTo(fbx + 1.5, fby);
            ctx.lineTo(fbx + 2, fby - 3.5); ctx.lineTo(fbx - 2, fby - 3.5);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#d0b040';
            ctx.beginPath(); ctx.ellipse(fbx, fby - 3.5, 2, 0.8, 0, 0, Math.PI * 2); ctx.fill();
            // Bucket handle
            ctx.strokeStyle = '#808888'; ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.arc(fbx, fby - 3.5, 2.5, Math.PI, 0); ctx.stroke();
        }
    },

    // --- TAMBAK IKAN (Fish Pond, 2x2) ---
    _drawPerikanan(ctx, sx, sy, p) {
        if (p < 0.5) return;
        const anim = this.animTime || 0;
        this._shadow(ctx, sx, sy, 42, 24);

        // --- Embankment / pematang (outer ring) ---
        ctx.fillStyle = '#9a7a48';
        this._tileDiamond(ctx, sx, sy, 70, 35);
        ctx.fill();

        // --- Water pond (inner) ---
        const waterGrad = ctx.createLinearGradient(sx - 28, sy, sx + 28, sy);
        waterGrad.addColorStop(0, '#3a7898');
        waterGrad.addColorStop(0.3, '#4888a8');
        waterGrad.addColorStop(0.7, '#3878a0');
        waterGrad.addColorStop(1, '#2a6888');
        ctx.fillStyle = waterGrad;
        this._tileDiamond(ctx, sx, sy, 60, 30);
        ctx.fill();

        // --- Water surface effects ---
        // Depth gradient (darker center)
        ctx.fillStyle = 'rgba(20,50,80,0.12)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 18, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ripple circles (animated)
        for (let r = 0; r < 3; r++) {
            const rx = sx - 12 + r * 14 + Math.sin(anim * 0.3 + r * 2) * 3;
            const ry = sy - 4 + r * 5;
            const ripSize = 3 + Math.sin(anim * 0.8 + r) * 1.5;
            ctx.strokeStyle = `rgba(140,200,230,${0.12 - r * 0.03})`;
            ctx.lineWidth = 0.4;
            ctx.beginPath();
            ctx.ellipse(rx, ry, ripSize, ripSize * 0.4, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Light shimmer on water
        for (let s = 0; s < 4; s++) {
            const sx2 = sx - 15 + s * 10 + Math.sin(anim * 0.5 + s * 1.5) * 2;
            const sy2 = sy - 3 + s * 2.5;
            ctx.fillStyle = `rgba(200,240,255,${0.04 + Math.sin(anim * 1.2 + s) * 0.02})`;
            ctx.beginPath();
            ctx.ellipse(sx2, sy2, 4, 1.5, 0.2, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Fish visible under water ---
        if (p >= 1) {
            const fishData = [
                [sx - 8, sy - 3, 0, '#e07030'],
                [sx + 6, sy + 2, 1.5, '#d06020'],
                [sx - 2, sy + 5, 3, '#c85828'],
                [sx + 12, sy - 1, 0.8, '#b04818'],
            ];
            for (const [fx, fy, phase, col] of fishData) {
                const swimX = fx + Math.sin(anim * 0.6 + phase) * 4;
                const swimDir = Math.cos(anim * 0.6 + phase) > 0 ? 1 : -1;
                ctx.fillStyle = col;
                ctx.globalAlpha = 0.4;
                // Body
                ctx.beginPath();
                ctx.ellipse(swimX, fy, 2.5, 1, 0, 0, Math.PI * 2);
                ctx.fill();
                // Tail
                ctx.beginPath();
                ctx.moveTo(swimX - 2.5 * swimDir, fy);
                ctx.lineTo(swimX - 4 * swimDir, fy - 1.2);
                ctx.lineTo(swimX - 4 * swimDir, fy + 1.2);
                ctx.closePath();
                ctx.fill();
                ctx.globalAlpha = 1;
            }

            // Bubble from fish (occasional)
            for (let b = 0; b < 2; b++) {
                const bubX = sx - 4 + b * 12;
                const bubY = sy - 2 + b * 3 - (anim * 2 + b * 3) % 6;
                const bubR = 0.5 + Math.sin(anim + b) * 0.2;
                ctx.fillStyle = 'rgba(180,220,250,0.2)';
                ctx.beginPath();
                ctx.arc(bubX, bubY, bubR, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // --- Pematang grass on embankment ---
        ctx.fillStyle = 'rgba(90,150,60,0.3)';
        // Top embankment
        this._tileDiamond(ctx, sx, sy, 68, 34);
        ctx.strokeStyle = 'rgba(100,160,60,0.2)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // --- Aerator / kincir air ---
        if (p >= 1) {
            const aex = sx + 20, aey = sy - 6;
            // Support pole
            ctx.fillStyle = '#606060';
            ctx.fillRect(aex - 0.5, aey - 3, 1, 6);
            // Paddle wheel (rotating)
            const angle = anim * 2;
            ctx.strokeStyle = '#505050';
            ctx.lineWidth = 0.6;
            for (let blade = 0; blade < 4; blade++) {
                const a = angle + (blade * Math.PI / 2);
                ctx.beginPath();
                ctx.moveTo(aex, aey - 3);
                ctx.lineTo(aex + Math.cos(a) * 3, aey - 3 + Math.sin(a) * 1.5);
                ctx.stroke();
                // Paddle tip
                ctx.fillStyle = '#707070';
                ctx.fillRect(
                    aex + Math.cos(a) * 3 - 0.5,
                    aey - 3 + Math.sin(a) * 1.5 - 0.5,
                    1, 1
                );
            }
            // Splash effect
            const splash = Math.sin(anim * 4) > 0.3;
            if (splash) {
                ctx.fillStyle = 'rgba(180,220,250,0.2)';
                ctx.beginPath();
                ctx.arc(aex + 1, aey + 1, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // --- Small hut / pos jaga ---
        if (p >= 1) {
            const hx = sx - 28, hy = sy + 3;
            ctx.fillStyle = '#a08040';
            ctx.fillRect(hx - 3, hy - 5, 6, 5);
            ctx.fillStyle = '#8a6828';
            ctx.fillRect(hx - 3.5, hy - 7, 7, 2.5);
            ctx.fillStyle = '#503018';
            ctx.fillRect(hx - 1, hy - 4.5, 2, 4);
        }

        // --- Feeding platform / tempat pakan ---
        if (p >= 1) {
            const fpX = sx - 10, fpY = sy + 10;
            ctx.fillStyle = '#b09050';
            ctx.fillRect(fpX - 3, fpY - 1, 6, 2);
            // Feed pellets
            ctx.fillStyle = '#c0a050';
            for (let fp = 0; fp < 3; fp++) {
                ctx.beginPath();
                ctx.arc(fpX - 1.5 + fp * 1.5, fpY - 1.5, 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // --- Net (jala) draped on side ---
        if (p >= 1) {
            ctx.strokeStyle = 'rgba(100,100,100,0.15)';
            ctx.lineWidth = 0.3;
            const netX = sx + 25, netY = sy + 8;
            for (let ni = 0; ni < 4; ni++) {
                ctx.beginPath();
                ctx.moveTo(netX, netY - 4);
                ctx.lineTo(netX - 2 + ni * 1.5, netY + 2);
                ctx.stroke();
            }
            for (let ni = 0; ni < 2; ni++) {
                ctx.beginPath();
                ctx.moveTo(netX - 2, netY - 2 + ni * 2);
                ctx.lineTo(netX + 4, netY - 2 + ni * 2);
                ctx.stroke();
            }
        }
    },

    // --- SEKOLAH DASAR (Elementary School, 2x2) — world-class detail ---
    _drawSekolah(ctx, sx, sy, p) {
        const hw = 36, hd = 18, h = 28 * p;
        const anim = this.animTime || 0;
        this._shadow(ctx, sx, sy, 46, 26);

        // ── Schoolyard (lapangan): grass + dirt track ─────────────────────
        ctx.fillStyle = '#6ab848';
        this._tileDiamond(ctx, sx, sy, 80, 40);
        ctx.fill();
        // Central playing field (dirt)
        ctx.fillStyle = '#c0a870';
        ctx.beginPath();
        ctx.moveTo(sx + 10, sy - 5); ctx.lineTo(sx + 36, sy + 9);
        ctx.lineTo(sx + 10, sy + 23); ctx.lineTo(sx - 16, sy + 9);
        ctx.closePath(); ctx.fill();
        // Field line
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(sx + 10, sy - 1); ctx.lineTo(sx + 10, sy + 19);
        ctx.moveTo(sx - 4, sy + 9); ctx.lineTo(sx + 24, sy + 9);
        ctx.stroke();

        // ── Boundary wall / pagar ─────────────────────────────────────────
        if (p > 0.2) {
            ctx.strokeStyle = '#a09080'; ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sx - hw, sy); ctx.lineTo(sx - hw, sy - 4);
            ctx.lineTo(sx + hw, sy - 4 + hd);
            ctx.stroke();
            // Gate posts
            ctx.fillStyle = '#d0c8b0';
            ctx.fillRect(sx - 8, sy - 3 - hd * 0.5, 2.5, 6);
            ctx.fillRect(sx + 5, sy - 3 - hd * 0.5 + 4, 2.5, 6);
        }

        // ── Foundation ───────────────────────────────────────────────────
        this._box(ctx, sx, sy, hw + 3, hd + 1.5, 3,
            '#c8c0b0', ['#b8b0a0','#a8a090'], ['#989080','#888070']);

        // ── Main building: cream/white with blue trim ──────────────────────
        const lwG = ctx.createLinearGradient(sx - hw, sy - 3, sx, sy - 3);
        lwG.addColorStop(0, '#f0e8d0'); lwG.addColorStop(1, '#f8f0e0');
        ctx.fillStyle = lwG;
        ctx.beginPath();
        ctx.moveTo(sx - hw, sy - 3); ctx.lineTo(sx - hw, sy - 3 - h);
        ctx.lineTo(sx, sy - hd - 3 - h); ctx.lineTo(sx, sy - hd - 3);
        ctx.closePath(); ctx.fill();
        const rwG = ctx.createLinearGradient(sx, sy - 3, sx + hw, sy - 3);
        rwG.addColorStop(0, '#e8e0c8'); rwG.addColorStop(1, '#d8d0b8');
        ctx.fillStyle = rwG;
        ctx.beginPath();
        ctx.moveTo(sx + hw, sy - 3); ctx.lineTo(sx + hw, sy - 3 - h);
        ctx.lineTo(sx, sy - hd - 3 - h); ctx.lineTo(sx, sy - hd - 3);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f5edd8';
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd - 3 - h); ctx.lineTo(sx + hw, sy - 3 - h);
        ctx.lineTo(sx, sy + hd - 3 - h); ctx.lineTo(sx - hw, sy - 3 - h);
        ctx.closePath(); ctx.fill();

        // ── Blue accent plinth / base molding ────────────────────────────
        if (p > 0.3) {
            ctx.fillStyle = '#2060a8';
            ctx.beginPath();
            ctx.moveTo(sx - hw, sy - 3 + hd - 3); ctx.lineTo(sx, sy - 3 - 3);
            ctx.lineTo(sx, sy - 3 - 5); ctx.lineTo(sx - hw, sy - 3 + hd - 5);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#1a5098';
            ctx.beginPath();
            ctx.moveTo(sx + hw, sy - 3 + hd - 3); ctx.lineTo(sx, sy - 3 - 3);
            ctx.lineTo(sx, sy - 3 - 5); ctx.lineTo(sx + hw, sy - 3 + hd - 5);
            ctx.closePath(); ctx.fill();
        }

        // ── Roof (clay tiles, deep red-brown) ────────────────────────────
        if (p > 0.2) {
            this._hipRoof(ctx, sx, sy - 3, hw, hd, h, 13 * p, 7,
                '#b83020', '#982010', '#d04030');
            // Ridge cap white
            ctx.fillStyle = '#e8e0d0';
            ctx.fillRect(sx - 3, sy - 3 - hd - h - 13 * p - 1, 6, 2);
            // Roof underside (visible overhang shade)
            ctx.fillStyle = 'rgba(80,40,20,0.15)';
            ctx.beginPath();
            ctx.moveTo(sx - hw, sy - 3 - h); ctx.lineTo(sx - hw - 4, sy - 3 - h + 2);
            ctx.lineTo(sx, sy - hd - 3 - h + 2); ctx.lineTo(sx, sy - hd - 3 - h);
            ctx.closePath(); ctx.fill();
        }

        // ── Windows: large, school-style with bars ────────────────────────
        if (p > 0.35) {
            for (let i = 0; i < 4; i++) {
                const wx = hw * (0.14 + i * 0.23);
                const wy = h * 0.48;
                this._windowL(ctx, sx, sy - 3, wx, wy, 5, 7.5);
                this._windowR(ctx, sx, sy - 3, wx, wy, 5, 7.5);
                // Window bars (teralis)
                const lwxPos = sx - hw + wx * 0.65;
                const lwyPos = sy - 3 + hd * (1 - wx / hw) - wy;
                ctx.strokeStyle = 'rgba(70,50,30,0.35)'; ctx.lineWidth = 0.4;
                for (let b = 0; b < 3; b++) {
                    ctx.beginPath(); ctx.moveTo(lwxPos - 2 + b * 1.8, lwyPos - 7); ctx.lineTo(lwxPos - 2 + b * 1.8, lwyPos); ctx.stroke();
                }
                // Flower pot on sill
                if (i % 2 === 0) {
                    ctx.fillStyle = '#c85020';
                    ctx.fillRect(lwxPos - 1.5, lwyPos + 0.5, 3, 1.5);
                    ctx.fillStyle = '#50c040';
                    ctx.beginPath(); ctx.arc(lwxPos, lwyPos - 0.5, 1.5, Math.PI, 0); ctx.fill();
                }
            }
        }

        // ── Front entrance: teras with pillars ────────────────────────────
        if (p > 0.5) {
            // Portico base
            ctx.fillStyle = '#d0c8b0';
            ctx.fillRect(sx - 12, sy - 3 - hd * 0.6 - h * 0.6, 24, 3);
            // Pillars (4)
            const pillH = h * 0.65;
            for (let pi = -1; pi <= 1; pi += 2) {
                const px = sx + pi * 8;
                const py = sy - 3 - hd * (pi < 0 ? 0.08 : 0.1);
                ctx.fillStyle = '#e8e0d0';
                ctx.fillRect(px - 1.5, py - pillH, 3, pillH);
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.fillRect(px - 1, py - pillH, 0.8, pillH);
                ctx.fillStyle = '#c8c0b0';
                ctx.fillRect(px - 2, py - pillH, 4, 2);
                ctx.fillRect(px - 2, py - 2, 4, 2);
            }
            // Canopy/portico roof (red)
            ctx.fillStyle = '#c03020';
            ctx.beginPath();
            ctx.moveTo(sx - 13, sy - 3 - hd * 0.08 - pillH);
            ctx.lineTo(sx + 13, sy - 3 - hd * 0.1 - pillH);
            ctx.lineTo(sx + 10, sy - 3 - hd * 0.1 - pillH - 5);
            ctx.lineTo(sx, sy - 3 - hd * 0.09 - pillH - 7);
            ctx.lineTo(sx - 10, sy - 3 - hd * 0.08 - pillH - 5);
            ctx.closePath(); ctx.fill();
            // Doors
            this._door(ctx, sx - 6, sy - 3 - hd * 0.08, 4.5, 11, '#5a3010');
            this._door(ctx, sx + 1, sy - 3 - hd * 0.08, 4.5, 11, '#4a2800');
        }

        // ── Indonesian flag + flagpole ────────────────────────────────────
        if (p >= 1) {
            // Concrete base
            ctx.fillStyle = '#c0c0c0'; ctx.fillRect(sx - hw - 2, sy - 3 + hd - 1, 5, 2);
            ctx.strokeStyle = '#808080'; ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sx - hw, sy - 3 + hd - 1);
            ctx.lineTo(sx - hw, sy - 3 + hd - 36);
            ctx.stroke();
            // Gold tip
            ctx.fillStyle = '#d8a020';
            ctx.beginPath(); ctx.arc(sx - hw, sy - 3 + hd - 37, 1.8, 0, Math.PI * 2); ctx.fill();
            // Flag (animated slight wave)
            const wave = Math.sin(anim * 2) * 1.2;
            ctx.fillStyle = '#dc1414';
            ctx.beginPath();
            ctx.moveTo(sx - hw + 1, sy - 3 + hd - 36);
            ctx.quadraticCurveTo(sx - hw + 7, sy - 3 + hd - 36 + wave, sx - hw + 13, sy - 3 + hd - 36);
            ctx.lineTo(sx - hw + 13, sy - 3 + hd - 32);
            ctx.quadraticCurveTo(sx - hw + 7, sy - 3 + hd - 32 + wave, sx - hw + 1, sy - 3 + hd - 32);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#f8f8f8';
            ctx.beginPath();
            ctx.moveTo(sx - hw + 1, sy - 3 + hd - 32);
            ctx.quadraticCurveTo(sx - hw + 7, sy - 3 + hd - 32 + wave, sx - hw + 13, sy - 3 + hd - 32);
            ctx.lineTo(sx - hw + 13, sy - 3 + hd - 28);
            ctx.quadraticCurveTo(sx - hw + 7, sy - 3 + hd - 28 + wave, sx - hw + 1, sy - 3 + hd - 28);
            ctx.closePath(); ctx.fill();
        }

        // ── Sign "SD NEGERI" ──────────────────────────────────────────────
        if (p >= 1) {
            ctx.fillStyle = '#1848a0';
            ctx.fillRect(sx - 18, sy - 3 - hd * 0.6 - h + 4, 36, 7);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 4px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('SD NEGERI', sx, sy - 3 - hd * 0.6 - h + 9.5);
        }

        // ── Children playing (animated) ───────────────────────────────────
        if (p >= 1) {
            // Bouncing ball
            const ballY = sy + 18 + Math.abs(Math.sin(anim * 3.5)) * -5;
            ctx.fillStyle = '#e84040';
            ctx.beginPath(); ctx.arc(sx + 15, ballY, 2, 0, Math.PI * 2); ctx.fill();
            // Two kids
            const kidColors = ['#f0c870', '#d08040'];
            for (let k = 0; k < 2; k++) {
                const kx = sx + 8 + k * 12, ky = sy + 13 + k * 3;
                const kleg = Math.sin(anim * 3 + k * Math.PI) * 1.5;
                ctx.fillStyle = kidColors[k];
                ctx.beginPath(); ctx.arc(kx, ky - 5, 1.8, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = ['#3060c0', '#c03030'][k];
                ctx.fillRect(kx - 1.5, ky - 3.2, 3, 3.5);
                ctx.strokeStyle = '#303030'; ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.moveTo(kx, ky + 0.3); ctx.lineTo(kx - 1.5 + kleg, ky + 3);
                ctx.moveTo(kx, ky + 0.3); ctx.lineTo(kx + 1.5 - kleg, ky + 3);
                ctx.stroke();
            }
        }

        // ── Trees ─────────────────────────────────────────────────────────
        if (p >= 1) {
            this._treeSmall(ctx, sx - hw + 2, sy - 1, 9, '#5a3a1a', '#3a9030');
            this._treeSmall(ctx, sx + hw + 8, sy - 5, 9, '#4a3010', '#42aa38');
            this._treeSmall(ctx, sx - hw - 3, sy + hd - 2, 7, '#5a3818', '#38a030');
        }
    },

    // --- SMP (Junior High, 2x2) ---
    _drawSMP(ctx, sx, sy, p) {
        const hw = 38, hd = 19, h = 32 * p;
        this._shadow(ctx, sx, sy, 44, 24);

        // Foundation
        this._box(ctx, sx, sy, hw + 3, hd + 1.5, 3,
            '#b0a8a0', ['#a09890','#908880'], ['#807870','#706860']);

        // Ground floor walls
        const floor1H = h * 0.5;
        this._box(ctx, sx, sy - 3, hw, hd, floor1H,
            '#e8eef4', ['#dce4ee','#ccd4de'], ['#c0c8d4','#b0b8c4']);

        // Floor separator (concrete band)
        if (p > 0.4) {
            ctx.fillStyle = '#a8b0b8';
            // left face
            ctx.beginPath();
            ctx.moveTo(sx - hw, sy - 3 + hd - floor1H);
            ctx.lineTo(sx, sy - 3 - floor1H);
            ctx.lineTo(sx, sy - 3 - floor1H - 2);
            ctx.lineTo(sx - hw, sy - 3 + hd - floor1H - 2);
            ctx.closePath();
            ctx.fill();
            // right face
            ctx.beginPath();
            ctx.moveTo(sx + hw, sy - 3 + hd - floor1H);
            ctx.lineTo(sx, sy - 3 - floor1H);
            ctx.lineTo(sx, sy - 3 - floor1H - 2);
            ctx.lineTo(sx + hw, sy - 3 + hd - floor1H - 2);
            ctx.closePath();
            ctx.fill();
        }

        // Second floor walls
        this._box(ctx, sx, sy - 3 - floor1H - 2, hw, hd, h - floor1H,
            '#e4eaf0', ['#d8e0ea','#c8d0da'], ['#bcc4d0','#acb4c0']);

        // Roof (blue-gray, modern flat-ish with slight hip)
        this._hipRoof(ctx, sx, sy - 3, hw, hd, h + 2, 8 * p, 5,
            '#2a5a9a', '#1a4a8a', '#3a6ab0');

        // Corridor / selasar (front walkway)
        if (p > 0.5) {
            ctx.fillStyle = 'rgba(180,180,190,0.3)';
            ctx.beginPath();
            ctx.moveTo(sx - hw * 0.8, sy - 3 - hd + 6);
            ctx.lineTo(sx, sy - 3 - hd - 2);
            ctx.lineTo(sx + hw * 0.8, sy - 3 - hd + 6);
            ctx.lineTo(sx + hw * 0.8, sy - 3 - hd + 8);
            ctx.lineTo(sx, sy - 3 - hd);
            ctx.lineTo(sx - hw * 0.8, sy - 3 - hd + 8);
            ctx.closePath();
            ctx.fill();
        }

        // Windows (2 floors, 4 per floor per face)
        if (p > 0.4) {
            for (let floor = 0; floor < 2; floor++) {
                const floorBase = floor === 0 ? 0.25 : 0.6;
                for (let i = 0; i < 4; i++) {
                    const wx = hw * (0.14 + i * 0.22);
                    this._windowL(ctx, sx, sy - 3, wx, h * floorBase, 4.5, 5.5);
                    this._windowR(ctx, sx, sy - 3, wx, h * floorBase, 4.5, 5.5);
                }
            }
        }

        // Main entrance with canopy
        if (p > 0.6) {
            // Modern canopy (flat concrete slab)
            ctx.fillStyle = '#3a6ab0';
            ctx.beginPath();
            ctx.moveTo(sx - 9, sy - 3 - hd - floor1H + 2);
            ctx.lineTo(sx, sy - 3 - hd - floor1H - 3);
            ctx.lineTo(sx + 9, sy - 3 - hd - floor1H + 2);
            ctx.lineTo(sx + 9, sy - 3 - hd - floor1H + 4);
            ctx.lineTo(sx, sy - 3 - hd - floor1H - 1);
            ctx.lineTo(sx - 9, sy - 3 - hd - floor1H + 4);
            ctx.closePath();
            ctx.fill();
            // Entrance pillars
            ctx.fillStyle = '#d0d0d0';
            ctx.fillRect(sx - 7, sy - 3 - hd - floor1H + 4, 2, floor1H - 4);
            ctx.fillRect(sx + 5, sy - 3 - hd - floor1H + 4, 2, floor1H - 4);
            // Glass double door
            ctx.fillStyle = 'rgba(140,190,220,0.5)';
            ctx.fillRect(sx - 4, sy - 3 - hd - 1, 8, 10);
            ctx.strokeStyle = '#4a6a8a';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(sx - 4, sy - 3 - hd - 1, 4, 10);
            ctx.strokeRect(sx, sy - 3 - hd - 1, 4, 10);
        }

        // "SMP NEGERI" sign
        if (p >= 1) {
            ctx.fillStyle = '#2060a0';
            ctx.fillRect(sx - 14, sy - 3 - hd - floor1H - 5, 28, 6);
            ctx.fillStyle = '#f8f8f8';
            ctx.font = 'bold 3px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('SMP NEGERI', sx, sy - 3 - hd - floor1H - 0.5);
        }

        // Flag
        if (p >= 1) {
            ctx.fillStyle = '#b0b0b0';
            ctx.fillRect(sx + hw + 1, sy + 1, 4, 2);
            ctx.strokeStyle = '#505050';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(sx + hw + 3, sy + 1);
            ctx.lineTo(sx + hw + 3, sy - 30);
            ctx.stroke();
            ctx.fillStyle = '#d0a030';
            ctx.beginPath();
            ctx.arc(sx + hw + 3, sy - 31, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#e02020';
            ctx.fillRect(sx + hw + 4, sy - 30, 10, 4);
            ctx.fillStyle = '#f8f8f8';
            ctx.fillRect(sx + hw + 4, sy - 26, 10, 4);
        }
    },

    // --- PUSKESMAS (Community Health Center) — world-class detail ---
    _drawPuskesmas(ctx, sx, sy, p) {
        const hw = 22, hd = 11, h = 24 * p;
        const anim = this.animTime || 0;
        this._shadow(ctx, sx, sy, 30, 18);

        // ── Forecourt / halaman ───────────────────────────────────────────
        ctx.fillStyle = '#d8f0d0';
        this._tileDiamond(ctx, sx + 4, sy + 3, 50, 25);
        ctx.fill();
        // Concrete path to entrance
        ctx.fillStyle = '#d8d0c0';
        ctx.beginPath();
        ctx.moveTo(sx - 5, sy); ctx.lineTo(sx + 5, sy + 6); ctx.lineTo(sx + 5, sy + 12);
        ctx.lineTo(sx - 5, sy + 6); ctx.closePath(); ctx.fill();

        // ── Foundation ───────────────────────────────────────────────────
        this._box(ctx, sx, sy, hw + 2, hd + 1, 3,
            '#d0ccc8', ['#c0bab8','#b0aaa8'], ['#a09898','#908888']);

        // ── Walls: bright white, clinical ─────────────────────────────────
        const lwG = ctx.createLinearGradient(sx - hw, sy - 3, sx - hw, sy - 3 - h);
        lwG.addColorStop(0, '#f0f8f8'); lwG.addColorStop(1, '#ffffff');
        ctx.fillStyle = lwG;
        ctx.beginPath();
        ctx.moveTo(sx - hw, sy - 3); ctx.lineTo(sx - hw, sy - 3 - h);
        ctx.lineTo(sx, sy - hd - 3 - h); ctx.lineTo(sx, sy - hd - 3);
        ctx.closePath(); ctx.fill();
        const rwG = ctx.createLinearGradient(sx + hw, sy - 3, sx + hw, sy - 3 - h);
        rwG.addColorStop(0, '#dce8e8'); rwG.addColorStop(1, '#e8f4f4');
        ctx.fillStyle = rwG;
        ctx.beginPath();
        ctx.moveTo(sx + hw, sy - 3); ctx.lineTo(sx + hw, sy - 3 - h);
        ctx.lineTo(sx, sy - hd - 3 - h); ctx.lineTo(sx, sy - hd - 3);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f5fcfc';
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd - 3 - h); ctx.lineTo(sx + hw, sy - 3 - h);
        ctx.lineTo(sx, sy + hd - 3 - h); ctx.lineTo(sx - hw, sy - 3 - h);
        ctx.closePath(); ctx.fill();

        // ── Green accent stripe (PUSKESMAS identity) ──────────────────────
        if (p > 0.3) {
            const strY = h * 0.3;
            ctx.fillStyle = '#20a040';
            ctx.beginPath();
            ctx.moveTo(sx - hw, sy - 3 + hd - strY);
            ctx.lineTo(sx, sy - 3 - strY); ctx.lineTo(sx, sy - 3 - strY - 3);
            ctx.lineTo(sx - hw, sy - 3 + hd - strY - 3);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#189838';
            ctx.beginPath();
            ctx.moveTo(sx + hw, sy - 3 + hd - strY);
            ctx.lineTo(sx, sy - 3 - strY); ctx.lineTo(sx, sy - 3 - strY - 3);
            ctx.lineTo(sx + hw, sy - 3 + hd - strY - 3);
            ctx.closePath(); ctx.fill();
        }

        // ── Flat roof with parapet ────────────────────────────────────────
        if (p > 0.2) {
            this._hipRoof(ctx, sx, sy - 3, hw, hd, h, 5 * p, 2,
                '#e0e8e8', '#d0d8d8', '#ecf4f4');
            // Parapet / railing
            ctx.strokeStyle = '#c0c8c8'; ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx - hw - 1, sy - 3 - h); ctx.lineTo(sx, sy - hd - 3 - h);
            ctx.lineTo(sx + hw + 1, sy - 3 - h); ctx.stroke();
        }

        // ── Red cross symbol (large, wall-mounted) ────────────────────────
        if (p > 0.45) {
            const crX = sx - hw * 0.5, crY = sy - 3 - h * 0.58;
            const crW = 3.5, crH = 10;
            ctx.fillStyle = '#e81c1c';
            ctx.fillRect(crX - crW * 0.5, crY - crH * 0.5, crW, crH);
            ctx.fillRect(crX - crH * 0.5, crY - crW * 0.5, crH, crW);
            // White border
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.5;
            ctx.strokeRect(crX - crW * 0.5 - 0.5, crY - crH * 0.5 - 0.5, crW + 1, crH + 1);
            // Right wall cross
            const rcrX = sx + hw * 0.42, rcrY = sy - 3 - h * 0.55 + hd * 0.35;
            ctx.fillStyle = '#e81c1c';
            ctx.fillRect(rcrX - crW * 0.5, rcrY - crH * 0.5, crW, crH);
            ctx.fillRect(rcrX - crH * 0.5, rcrY - crW * 0.5, crH, crW);
        }

        // ── Windows: clean medical look ────────────────────────────────────
        if (p > 0.4) {
            this._windowL(ctx, sx, sy - 3, hw * 0.7, h * 0.48, 5, 6);
            this._windowR(ctx, sx, sy - 3, hw * 0.3, h * 0.48, 5, 6);
            this._windowR(ctx, sx, sy - 3, hw * 0.68, h * 0.48, 5, 6);
            // Curtain inside left window
            ctx.fillStyle = 'rgba(255,255,200,0.3)';
            const lwPos = sx - hw + hw * 0.7 * 0.65;
            ctx.fillRect(lwPos - 4, sy - 3 + hd * (1 - hw*0.7/hw) - h * 0.48 - 5.5, 4, 5.5);
        }

        // ── Entrance: sliding glass doors + green awning ──────────────────
        if (p > 0.5) {
            // Awning
            ctx.fillStyle = '#159838';
            ctx.beginPath();
            ctx.moveTo(sx - 9, sy - 3 - hd * 0.05 - h * 0.55);
            ctx.lineTo(sx + 9, sy - 3 - hd * 0.1 - h * 0.55);
            ctx.lineTo(sx + 7, sy - 3 - hd * 0.1 - h * 0.55 - 4);
            ctx.lineTo(sx - 7, sy - 3 - hd * 0.05 - h * 0.55 - 4);
            ctx.closePath(); ctx.fill();
            // White stripe on awning
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(sx - 9, sy - 3 - hd * 0.05 - h * 0.55);
            ctx.lineTo(sx + 9, sy - 3 - hd * 0.1 - h * 0.55);
            ctx.lineTo(sx + 9, sy - 3 - hd * 0.1 - h * 0.55 - 1);
            ctx.lineTo(sx - 9, sy - 3 - hd * 0.05 - h * 0.55 - 1);
            ctx.closePath(); ctx.fill();
            // Glass sliding doors
            const doorY = sy - 3 - hd * 0.06;
            ctx.fillStyle = '#104a20'; ctx.fillRect(sx - 7, doorY - 11, 14, 1);
            ctx.fillStyle = 'rgba(180,240,210,0.7)'; ctx.fillRect(sx - 6.5, doorY - 10, 6, 10);
            ctx.fillStyle = 'rgba(160,230,200,0.6)'; ctx.fillRect(sx + 0.5, doorY - 10, 6, 10);
            ctx.strokeStyle = '#104a20'; ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(sx, doorY - 10); ctx.lineTo(sx, doorY); ctx.stroke();
        }

        // ── "PUSKESMAS" sign ─────────────────────────────────────────────
        if (p >= 1) {
            ctx.fillStyle = '#0e7830';
            ctx.fillRect(sx - hw * 0.85 + 2, sy - 3 - h * 0.32, hw * 1.6, 5.5);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 3.5px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('PUSKESMAS', sx + 2, sy - 3 - h * 0.32 + 4);
        }

        // ── Detailed ambulance ────────────────────────────────────────────
        if (p >= 1) {
            const ax = sx + hw + 1, ay = sy + 1;
            // Body
            ctx.fillStyle = '#f8f8f8';
            ctx.fillRect(ax - 1, ay - 5, 11, 6);
            // Cab
            ctx.fillStyle = '#e8e8e8';
            ctx.beginPath();
            ctx.moveTo(ax + 8, ay - 5); ctx.lineTo(ax + 11, ay - 3);
            ctx.lineTo(ax + 11, ay + 1); ctx.lineTo(ax + 8, ay + 1);
            ctx.closePath(); ctx.fill();
            // Red cross on side
            ctx.fillStyle = '#e01818';
            ctx.fillRect(ax + 2, ay - 4, 1.2, 3.5); ctx.fillRect(ax + 1, ay - 3.2, 3.2, 1.2);
            // Red stripe
            ctx.fillStyle = '#e01818';
            ctx.fillRect(ax - 1, ay - 2, 12, 1);
            // Windows
            ctx.fillStyle = 'rgba(160,220,255,0.7)';
            ctx.fillRect(ax + 9, ay - 4.5, 1.8, 2);
            // Emergency light bar
            const blink = Math.sin(anim * 8) > 0;
            ctx.fillStyle = blink ? '#ff4040' : '#3040ff';
            ctx.fillRect(ax + 1, ay - 6, 3, 1);
            ctx.fillStyle = blink ? '#3040ff' : '#ff4040';
            ctx.fillRect(ax + 5, ay - 6, 3, 1);
            // Wheels
            ctx.fillStyle = '#202020';
            ctx.beginPath(); ctx.arc(ax + 1.8, ay + 2, 1.8, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(ax + 8.5, ay + 2, 1.8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#505050';
            ctx.beginPath(); ctx.arc(ax + 1.8, ay + 2, 0.8, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(ax + 8.5, ay + 2, 0.8, 0, Math.PI * 2); ctx.fill();
        }

        // ── Patient figure waiting outside ────────────────────────────────
        if (p >= 1) {
            const px2 = sx - hw - 2, py2 = sy + 2;
            // Bench
            ctx.fillStyle = '#8a6a3a'; ctx.fillRect(px2 - 4, py2 + 1, 9, 1.5);
            ctx.fillRect(px2 - 3.5, py2 + 2.5, 1, 2); ctx.fillRect(px2 + 3.5, py2 + 2.5, 1, 2);
            // Patient
            ctx.fillStyle = '#f5c880';
            ctx.beginPath(); ctx.arc(px2, py2 - 5, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#4878c0'; ctx.fillRect(px2 - 1.2, py2 - 3.5, 2.4, 3);
        }

        // ── Small garden / shrubs ─────────────────────────────────────────
        if (p >= 1) {
            this._treeSmall(ctx, sx - hw - 1, sy - 4, 6, '#3a2a10', '#38b030');
            this._treeSmall(ctx, sx + hw + 14, sy - 2, 6, '#3a2a10', '#30b028');
        }
    },

    // --- SMA (Senior High, 2x2) ---
    _drawSMA(ctx, sx, sy, p) {
        const hw = 40, hd = 20, h = 35 * p;
        this._shadow(ctx, sx, sy, 46, 25);

        // Foundation
        this._box(ctx, sx, sy, hw + 3, hd + 1.5, 3,
            '#a8a8a8', ['#989898','#888888'], ['#787878','#686868']);

        // Ground floor (main building)
        const floor1H = h * 0.48;
        this._box(ctx, sx, sy - 3, hw, hd, floor1H,
            '#f0f0f0', ['#e4e4e4','#d8d8d8'], ['#cccccc','#c0c0c0']);

        // Floor separator (darker concrete band with blue accent)
        if (p > 0.4) {
            // Blue accent strip
            ctx.fillStyle = '#2858a0';
            ctx.beginPath();
            ctx.moveTo(sx - hw, sy - 3 + hd - floor1H);
            ctx.lineTo(sx, sy - 3 - floor1H);
            ctx.lineTo(sx, sy - 3 - floor1H - 1.5);
            ctx.lineTo(sx - hw, sy - 3 + hd - floor1H - 1.5);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(sx + hw, sy - 3 + hd - floor1H);
            ctx.lineTo(sx, sy - 3 - floor1H);
            ctx.lineTo(sx, sy - 3 - floor1H - 1.5);
            ctx.lineTo(sx + hw, sy - 3 + hd - floor1H - 1.5);
            ctx.closePath();
            ctx.fill();
        }

        // Second floor
        this._box(ctx, sx, sy - 3 - floor1H - 1.5, hw, hd, h - floor1H,
            '#eceef0', ['#e0e2e6','#d4d6da'], ['#c8cace','#bcbec2']);

        // Flat modern roof with parapet
        if (p > 0.2) {
            // Parapet wall
            ctx.fillStyle = '#b8b8c0';
            ctx.beginPath();
            ctx.moveTo(sx - hw, sy - 3 + hd - h - 1.5);
            ctx.lineTo(sx, sy - 3 - hd - h - 1.5);
            ctx.lineTo(sx, sy - 3 - hd - h - 4);
            ctx.lineTo(sx - hw, sy - 3 + hd - h - 4);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#a8a8b0';
            ctx.beginPath();
            ctx.moveTo(sx + hw, sy - 3 + hd - h - 1.5);
            ctx.lineTo(sx, sy - 3 - hd - h - 1.5);
            ctx.lineTo(sx, sy - 3 - hd - h - 4);
            ctx.lineTo(sx + hw, sy - 3 + hd - h - 4);
            ctx.closePath();
            ctx.fill();
            // Flat roof top
            ctx.fillStyle = '#c8c8d0';
            ctx.beginPath();
            ctx.moveTo(sx, sy - 3 - hd - h - 4);
            ctx.lineTo(sx + hw, sy - 3 - h - 4 + hd);
            ctx.lineTo(sx, sy - 3 + hd - h - 4 + hd);
            ctx.lineTo(sx - hw, sy - 3 - h - 4 + hd);
            ctx.closePath();
            ctx.fill();
        }

        // Lab wing (smaller side building)
        if (p > 0.5) {
            const labX = sx + hw * 0.5, labY = sy + hd * 0.5;
            const labH = 14 * p;
            this._box(ctx, labX, labY, 14, 7, labH,
                '#e8eaf0', ['#dce0e8','#d0d4dc'], ['#c4c8d0','#b8bcc4']);
            // Lab roof
            ctx.fillStyle = '#2858a0';
            ctx.beginPath();
            ctx.moveTo(labX, labY - 7 - labH);
            ctx.lineTo(labX + 14, labY - labH);
            ctx.lineTo(labX, labY + 7 - labH);
            ctx.lineTo(labX - 14, labY - labH);
            ctx.closePath();
            ctx.fill();
            // Lab windows
            this._windowL(ctx, labX, labY, 10, labH * 0.5, 3.5, 4);
            // "LAB" sign
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = '2.5px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('LAB', labX - 10, labY + 4 - labH * 0.4);
        }

        // Windows (2 floors, many with regular spacing)
        if (p > 0.4) {
            for (let floor = 0; floor < 2; floor++) {
                const floorBase = floor === 0 ? 0.22 : 0.58;
                for (let i = 0; i < 5; i++) {
                    const wx = hw * (0.1 + i * 0.18);
                    this._windowL(ctx, sx, sy - 3, wx, h * floorBase, 4, 5.5);
                    this._windowR(ctx, sx, sy - 3, wx, h * floorBase, 4, 5.5);
                }
            }
        }

        // Grand entrance with modern canopy
        if (p > 0.6) {
            // Canopy (angular modern design)
            ctx.fillStyle = '#2858a0';
            ctx.beginPath();
            ctx.moveTo(sx - 12, sy - 3 - hd - floor1H + 2);
            ctx.lineTo(sx, sy - 3 - hd - floor1H - 5);
            ctx.lineTo(sx + 12, sy - 3 - hd - floor1H + 2);
            ctx.lineTo(sx + 12, sy - 3 - hd - floor1H + 4);
            ctx.lineTo(sx, sy - 3 - hd - floor1H - 3);
            ctx.lineTo(sx - 12, sy - 3 - hd - floor1H + 4);
            ctx.closePath();
            ctx.fill();
            // Steel pillars
            ctx.fillStyle = '#c0c0c0';
            ctx.fillRect(sx - 9, sy - 3 - hd - floor1H + 4, 1.5, floor1H - 4);
            ctx.fillRect(sx + 8, sy - 3 - hd - floor1H + 4, 1.5, floor1H - 4);
            // Glass doors
            ctx.fillStyle = 'rgba(130,180,220,0.5)';
            ctx.fillRect(sx - 5, sy - 3 - hd - 1, 10, 10);
            ctx.strokeStyle = '#4a6a8a';
            ctx.lineWidth = 0.4;
            ctx.strokeRect(sx - 5, sy - 3 - hd - 1, 5, 10);
            ctx.strokeRect(sx, sy - 3 - hd - 1, 5, 10);
        }

        // "SMA NEGERI" sign
        if (p >= 1) {
            ctx.fillStyle = '#1848a0';
            ctx.fillRect(sx - 16, sy - 3 - hd - floor1H - 7, 32, 6);
            ctx.fillStyle = '#f8f8f8';
            ctx.font = 'bold 3.5px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('SMA NEGERI', sx, sy - 3 - hd - floor1H - 2.5);
        }

        // Flag
        if (p >= 1) {
            ctx.fillStyle = '#b0b0b0';
            ctx.fillRect(sx - hw - 4, sy + 1, 4, 2);
            ctx.strokeStyle = '#505050';
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(sx - hw - 2, sy + 1);
            ctx.lineTo(sx - hw - 2, sy - 34);
            ctx.stroke();
            ctx.fillStyle = '#d0a030';
            ctx.beginPath();
            ctx.arc(sx - hw - 2, sy - 35, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#e02020';
            ctx.fillRect(sx - hw - 1, sy - 34, 10, 4);
            ctx.fillStyle = '#f8f8f8';
            ctx.fillRect(sx - hw - 1, sy - 30, 10, 4);
        }
    },

    // --- MASJID (Mosque) ---
    _drawMasjid(ctx, sx, sy, p) {
        const hw = 22, hd = 11, h = 22 * p;
        this._shadow(ctx, sx, sy, 28, 16);

        // Foundation/platform
        this._box(ctx, sx, sy, hw + 4, hd + 2, 3,
            '#d8d0c8', ['#c8c0b8','#b8b0a8'], ['#a8a098','#988880']);

        // Main building (white with green tint)
        this._box(ctx, sx, sy - 3, hw, hd, h,
            '#f0f0e8', ['#e8e8e0','#dcdcd4'], ['#d4d4cc','#c8c8c0']);

        // Arched windows
        if (p > 0.4) {
            for (let i = 0; i < 2; i++) {
                const ax = sx - hw * (0.35 + i * 0.35);
                const ay = sy - 3 - h * 0.55;
                ctx.fillStyle = '#207848';
                ctx.beginPath();
                ctx.arc(ax, ay - 2, 3, Math.PI, 0);
                ctx.fillRect(ax - 3, ay - 2, 6, 5);
                ctx.fill();
                // Inner light
                ctx.fillStyle = 'rgba(240,220,160,0.5)';
                ctx.beginPath();
                ctx.arc(ax, ay - 1, 2, Math.PI, 0);
                ctx.fillRect(ax - 2, ay - 1, 4, 3.5);
                ctx.fill();
            }
        }

        // Green dome
        if (p > 0.6) {
            const domeY = sy - 3 - h;
            // Dome base
            ctx.fillStyle = '#208850';
            ctx.beginPath();
            ctx.ellipse(sx, domeY - 2, hw * 0.55, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            // Dome
            ctx.fillStyle = '#28a060';
            ctx.beginPath();
            ctx.arc(sx, domeY - 5, hw * 0.4, Math.PI, 0);
            ctx.fill();
            // Dome highlight
            ctx.fillStyle = 'rgba(100,220,140,0.3)';
            ctx.beginPath();
            ctx.arc(sx - 3, domeY - 8, hw * 0.2, Math.PI, 0);
            ctx.fill();
            // Crescent moon
            ctx.fillStyle = '#f0d030';
            ctx.beginPath();
            ctx.arc(sx, domeY - 14, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#28a060';
            ctx.beginPath();
            ctx.arc(sx + 1.5, domeY - 14, 2.5, 0, Math.PI * 2);
            ctx.fill();
            // Spike
            ctx.strokeStyle = '#f0d030';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx, domeY - 17);
            ctx.lineTo(sx, domeY - 11);
            ctx.stroke();
        }

        // Minaret tower (right side)
        if (p > 0.7) {
            const mx = sx + hw + 3, my = sy - 3;
            this._box(ctx, mx, my, 4, 2, h + 10,
                '#e8e8e0', ['#dcdcd4','#d0d0c8'], ['#c8c8c0','#bcbcb4']);
            // Minaret dome
            ctx.fillStyle = '#28a060';
            ctx.beginPath();
            ctx.arc(mx, my - h - 12, 4, Math.PI, 0);
            ctx.fill();
            // Crescent
            ctx.fillStyle = '#f0d030';
            ctx.beginPath();
            ctx.arc(mx, my - h - 18, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Door (arched)
        if (p > 0.7) {
            ctx.fillStyle = '#186840';
            ctx.fillRect(sx - 3, sy - 3 - hd - 7, 6, 7);
            ctx.beginPath();
            ctx.arc(sx, sy - 3 - hd - 7, 3, Math.PI, 0);
            ctx.fill();
        }
    },

    // --- BALAI DESA (Village Hall, 2x2) ---
    _drawBalaiDesa(ctx, sx, sy, p) {
        const hw = 38, hd = 19, h = 22 * p;
        this._shadow(ctx, sx, sy, 44, 24);

        // Stone tile courtyard / halaman
        ctx.fillStyle = 'rgba(180,170,150,0.15)';
        this._tileDiamond(ctx, sx, sy + 4, hw * 2.2, hd * 2.2);
        ctx.fill();

        // Elevated platform with steps
        this._box(ctx, sx, sy, hw + 6, hd + 3, 2,
            '#d0c0a0', ['#c0b090','#b0a080'], ['#a09070','#908060']);
        this._box(ctx, sx, sy - 2, hw + 3, hd + 1.5, 2,
            '#c8b898', ['#b8a888','#a89878'], ['#988868','#887858']);

        // Main building body
        this._box(ctx, sx, sy - 4, hw, hd, h,
            '#f0e8d0', ['#e8dcc0','#dcd0b0'], ['#d0c4a4','#c4b898']);

        // Decorative band / garis hias di dinding
        if (p > 0.3) {
            ctx.strokeStyle = '#b08040';
            ctx.lineWidth = 1;
            const bandY = h * 0.75;
            // left face
            ctx.beginPath();
            ctx.moveTo(sx - hw, sy - 4 + hd - bandY);
            ctx.lineTo(sx, sy - 4 - bandY);
            ctx.stroke();
            // right face
            ctx.beginPath();
            ctx.moveTo(sx + hw, sy - 4 + hd - bandY);
            ctx.lineTo(sx, sy - 4 - bandY);
            ctx.stroke();
        }

        // Large traditional Joglo roof with layered overhangs
        if (p > 0.2) {
            // Lower overhang (wide)
            const roofOH = 10;
            ctx.fillStyle = '#8a4a18';
            ctx.beginPath();
            ctx.moveTo(sx, sy - 4 - hd - h + 2);
            ctx.lineTo(sx + hw + roofOH, sy - 4 - h + hd * 0.3 + 2);
            ctx.lineTo(sx, sy - 4 + hd - h + roofOH);
            ctx.lineTo(sx - hw - roofOH, sy - 4 - h + hd * 0.3 + 2);
            ctx.closePath();
            ctx.fill();

            // Upper ridge (peaked)
            ctx.fillStyle = '#703810';
            ctx.beginPath();
            ctx.moveTo(sx, sy - 4 - hd - h - 8 * p);
            ctx.lineTo(sx + hw * 0.6, sy - 4 - h + hd * 0.2);
            ctx.lineTo(sx, sy - 4 + hd * 0.3 - h);
            ctx.lineTo(sx - hw * 0.6, sy - 4 - h + hd * 0.2);
            ctx.closePath();
            ctx.fill();

            // Roof ridge highlight
            ctx.fillStyle = '#9a5828';
            ctx.beginPath();
            ctx.moveTo(sx, sy - 4 - hd - h - 8 * p);
            ctx.lineTo(sx + hw * 0.3, sy - 4 - h + hd * 0.1 - 2);
            ctx.lineTo(sx, sy - 4 - h + hd * 0.15 - 2);
            ctx.lineTo(sx - hw * 0.3, sy - 4 - h + hd * 0.1 - 2);
            ctx.closePath();
            ctx.fill();

            // Roof ornament (tumpang sari tip)
            ctx.fillStyle = '#d0a030';
            ctx.beginPath();
            ctx.moveTo(sx, sy - 4 - hd - h - 8 * p - 4);
            ctx.lineTo(sx - 2, sy - 4 - hd - h - 8 * p);
            ctx.lineTo(sx + 2, sy - 4 - hd - h - 8 * p);
            ctx.closePath();
            ctx.fill();
        }

        // Pendopo pillars (ornate wooden columns)
        if (p > 0.5) {
            ctx.fillStyle = '#7a5828';
            for (let i = -2; i <= 2; i++) {
                const px = sx + i * 10;
                const py = sy - 4 - hd + 3;
                // Column base
                ctx.fillStyle = '#a09070';
                ctx.fillRect(px - 2.5, py - 1, 5, 2);
                // Column shaft
                ctx.fillStyle = '#7a5828';
                ctx.fillRect(px - 1.5, py - h * 0.65, 3, h * 0.65);
                // Column capital
                ctx.fillStyle = '#8a6838';
                ctx.fillRect(px - 2.5, py - h * 0.65 - 1.5, 5, 2);
            }
        }

        // Windows (arched, traditional style)
        if (p > 0.4) {
            for (let i = 0; i < 3; i++) {
                const wx = hw * (0.2 + i * 0.28);
                const wy = h * 0.45;
                // Left face arched window
                this._windowL(ctx, sx, sy - 4, wx, wy, 4, 6);
                ctx.fillStyle = 'rgba(140,100,50,0.15)';
                ctx.beginPath();
                ctx.arc(sx - hw + wx * 0.65, sy - 4 + hd * (1 - wx / hw) - wy - 3, 2.5, Math.PI, 0);
                ctx.fill();
                // Right face arched window
                this._windowR(ctx, sx, sy - 4, wx, wy, 4, 6);
            }
        }

        // Main entrance (large double door with arch)
        if (p > 0.6) {
            ctx.fillStyle = '#e8dcc4';
            ctx.fillRect(sx - 6, sy - 4 - hd - 14, 12, 4);
            // Arch over door
            ctx.fillStyle = '#8a5020';
            ctx.beginPath();
            ctx.arc(sx, sy - 4 - hd - 12, 6, Math.PI, 0);
            ctx.fill();
            ctx.fillStyle = '#f0e8d0';
            ctx.beginPath();
            ctx.arc(sx, sy - 4 - hd - 12, 4.5, Math.PI, 0);
            ctx.fill();
            // Double door
            this._door(ctx, sx - 4, sy - 4 - hd, 3.5, 10, '#5a3018');
            this._door(ctx, sx + 0.5, sy - 4 - hd, 3.5, 10, '#4a2810');
        }

        // Flag pole with base
        if (p >= 1) {
            // Flag base (concrete)
            ctx.fillStyle = '#b0b0b0';
            ctx.fillRect(sx - hw - 8, sy + 1, 6, 3);
            // Pole
            ctx.strokeStyle = '#505050';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sx - hw - 5, sy + 1);
            ctx.lineTo(sx - hw - 5, sy - 32);
            ctx.stroke();
            // Gold ball on top
            ctx.fillStyle = '#d0a030';
            ctx.beginPath();
            ctx.arc(sx - hw - 5, sy - 33, 2, 0, Math.PI * 2);
            ctx.fill();
            // Indonesian flag (Merah Putih)
            ctx.fillStyle = '#e02020';
            ctx.fillRect(sx - hw - 4, sy - 32, 12, 4);
            ctx.fillStyle = '#f8f8f8';
            ctx.fillRect(sx - hw - 4, sy - 28, 12, 4);
        }

        // Sign "BALAI DESA" (wooden carved sign)
        if (p >= 1) {
            ctx.fillStyle = '#6a4a20';
            ctx.fillRect(sx - 14, sy - 4 - hd - 5, 28, 7);
            ctx.fillStyle = '#7a5a30';
            ctx.fillRect(sx - 13, sy - 4 - hd - 4, 26, 5);
            ctx.fillStyle = '#f0e8c8';
            ctx.font = 'bold 3.5px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('BALAI DESA', sx, sy - 4 - hd);
        }

        // Small garden / tanaman hias
        if (p >= 1) {
            this._treeSmall(ctx, sx + hw + 4, sy - 2, 10, '#5a3a1a', '#40a040');
            this._treeSmall(ctx, sx - hw - 4, sy - 4, 10, '#5a3a1a', '#38a838');
        }
    },

    // --- TAMAN (Park) ---
    _drawTaman(ctx, sx, sy, p) {
        if (p < 0.5) return;
        this._shadow(ctx, sx, sy, 24, 12);

        // Green grass base (already the tile, but add extra green)
        ctx.fillStyle = 'rgba(80,180,60,0.2)';
        this._tileDiamond(ctx, sx, sy, 54, 27);
        ctx.fill();

        // Winding path
        ctx.strokeStyle = 'rgba(180,160,130,0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx - 20, sy + 4);
        ctx.quadraticCurveTo(sx - 5, sy - 4, sx + 5, sy + 2);
        ctx.quadraticCurveTo(sx + 15, sy + 8, sx + 22, sy);
        ctx.stroke();

        // Trees
        this._treeSmall(ctx, sx - 14, sy - 4, 18, '#5a3a1a', '#38a838');
        this._treeSmall(ctx, sx + 12, sy - 6, 16, '#6a4a2a', '#40b040');
        this._treeSmall(ctx, sx - 4, sy + 5, 14, '#5a3a1a', '#50c050');

        // Flower beds
        this._flowers(ctx, sx + 4, sy - 3, 0, this.animTime);
        this._flowers(ctx, sx - 10, sy + 3, 1, this.animTime);
        this._flowers(ctx, sx + 16, sy + 4, 2, this.animTime);

        // Bench
        ctx.fillStyle = '#8a6a3a';
        ctx.fillRect(sx - 1, sy + 1, 8, 2);
        ctx.fillRect(sx - 1, sy + 3, 1.5, 2);
        ctx.fillRect(sx + 5.5, sy + 3, 1.5, 2);
        // Bench back
        ctx.fillRect(sx - 1, sy - 1, 8, 1.5);

        // Fountain (center)
        ctx.fillStyle = '#a0a0a8';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 1, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#70a8d8';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 1.5, 4, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Water spout
        const spoutH = 3 + Math.sin(this.animTime * 3) * 1;
        ctx.strokeStyle = 'rgba(120,180,220,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy - 2);
        ctx.lineTo(sx, sy - 2 - spoutH);
        ctx.stroke();
        // Droplets
        ctx.fillStyle = 'rgba(140,200,240,0.5)';
        for (let i = 0; i < 3; i++) {
            const dy = Math.sin(this.animTime * 4 + i * 2) * 2;
            const dx = Math.cos(this.animTime * 3 + i * 2.5) * 3;
            ctx.beginPath();
            ctx.arc(sx + dx, sy - 2 - spoutH + dy + i, 0.8, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    // --- PASAR (Market) ---
    _drawPasar(ctx, sx, sy, p) {
        const hw = 24, hd = 12, h = 16 * p;
        const anim = this.animTime || 0;
        this._shadow(ctx, sx, sy, 30, 16);

        // --- Ground platform (concrete slab with dirt texture) ---
        ctx.fillStyle = '#c8b880';
        this._tileDiamond(ctx, sx, sy, 54, 27);
        ctx.fill();
        // Inner area (slightly lighter)
        ctx.fillStyle = '#d0c090';
        this._tileDiamond(ctx, sx, sy, 48, 24);
        ctx.fill();

        // --- Stall support poles (bamboo/wood) ---
        if (p > 0.3) {
            const poleCol = '#8a6a30';
            const poles = [
                [sx - hw + 2, sy + hd - 3],
                [sx + hw - 2, sy - hd + 3],
                [sx - hw + 2, sy - 3],
                [sx + hw - 2, sy + 3],
                [sx - 6, sy - hd + 1],
                [sx + 6, sy + hd - 1],
                [sx - 6, sy + 4],
                [sx + 6, sy - 4],
            ];
            ctx.strokeStyle = poleCol;
            ctx.lineWidth = 1.5;
            for (const [px, py] of poles) {
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(px, py - h - 6);
                ctx.stroke();
                // Pole cap
                ctx.fillStyle = '#7a5a20';
                ctx.beginPath();
                ctx.arc(px, py - h - 6, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // --- Terpal / tarp roof (striped, colorful) ---
        if (p > 0.4) {
            // Left stall tarp (blue-white stripes)
            const tarpY = sy - h - 2;
            // Left half — blue & white
            const stripes1 = ['#2868a8', '#e8e8e8', '#2868a8', '#e8e8e8', '#2868a8'];
            for (let s = 0; s < stripes1.length; s++) {
                const t = s / stripes1.length;
                const t2 = (s + 1) / stripes1.length;
                ctx.fillStyle = stripes1[s];
                ctx.beginPath();
                const x1 = sx - hw - 2, x2 = sx;
                ctx.moveTo(x1 + (x2 - x1) * t, tarpY + hd * t);
                ctx.lineTo(x1 + (x2 - x1) * t2, tarpY + hd * t2);
                ctx.lineTo(x1 + (x2 - x1) * t2, tarpY + hd * t2 - 3);
                ctx.lineTo(x1 + (x2 - x1) * t, tarpY + hd * t - 3);
                ctx.closePath();
                ctx.fill();
            }
            // Tarp left face
            ctx.fillStyle = '#2060a0';
            ctx.beginPath();
            ctx.moveTo(sx - hw - 2, tarpY);
            ctx.lineTo(sx, tarpY + hd);
            ctx.lineTo(sx, tarpY + hd - 3);
            ctx.lineTo(sx - hw - 2, tarpY - 3);
            ctx.closePath();
            ctx.fill();

            // Right half — red & yellow
            const stripes2 = ['#d04040', '#e8c030', '#d04040', '#e8c030', '#d04040'];
            for (let s = 0; s < stripes2.length; s++) {
                const t = s / stripes2.length;
                const t2 = (s + 1) / stripes2.length;
                ctx.fillStyle = stripes2[s];
                ctx.beginPath();
                const x1 = sx, x2 = sx + hw + 2;
                ctx.moveTo(x1 + (x2 - x1) * t, tarpY + hd - hd * t);
                ctx.lineTo(x1 + (x2 - x1) * t2, tarpY + hd - hd * t2);
                ctx.lineTo(x1 + (x2 - x1) * t2, tarpY + hd - hd * t2 - 3);
                ctx.lineTo(x1 + (x2 - x1) * t, tarpY + hd - hd * t - 3);
                ctx.closePath();
                ctx.fill();
            }
            // Tarp right face
            ctx.fillStyle = '#c03030';
            ctx.beginPath();
            ctx.moveTo(sx + hw + 2, tarpY);
            ctx.lineTo(sx, tarpY + hd);
            ctx.lineTo(sx, tarpY + hd - 3);
            ctx.lineTo(sx + hw + 2, tarpY - 3);
            ctx.closePath();
            ctx.fill();

            // Tarp drape edges (wavy bottom)
            ctx.strokeStyle = 'rgba(0,0,0,0.08)';
            ctx.lineWidth = 0.4;
            for (let d = 0; d < 8; d++) {
                const dx = sx - hw + d * 6.5;
                const dy = tarpY + hd * (d / 8) + 0.5;
                ctx.beginPath();
                ctx.moveTo(dx, dy);
                ctx.quadraticCurveTo(dx + 1.5, dy + 1.5, dx + 3, dy);
                ctx.stroke();
            }
        }

        // --- Display tables / meja lapak ---
        if (p >= 1) {
            // Table left stall
            const tblCol = '#a08040';
            const tbl1x = sx - 12, tbl1y = sy + 1;
            ctx.fillStyle = tblCol;
            ctx.fillRect(tbl1x - 8, tbl1y - 2, 16, 3);
            ctx.fillStyle = this._darken(tblCol, 15);
            ctx.fillRect(tbl1x - 8, tbl1y + 1, 16, 1);
            // Table legs
            ctx.strokeStyle = '#806020';
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(tbl1x - 7, tbl1y + 1); ctx.lineTo(tbl1x - 7, tbl1y + 4);
            ctx.moveTo(tbl1x + 7, tbl1y + 1); ctx.lineTo(tbl1x + 7, tbl1y + 4);
            ctx.stroke();

            // Table right stall
            const tbl2x = sx + 12, tbl2y = sy - 3;
            ctx.fillStyle = tblCol;
            ctx.fillRect(tbl2x - 8, tbl2y - 2, 16, 3);
            ctx.fillStyle = this._darken(tblCol, 15);
            ctx.fillRect(tbl2x - 8, tbl2y + 1, 16, 1);
            ctx.strokeStyle = '#806020';
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(tbl2x - 7, tbl2y + 1); ctx.lineTo(tbl2x - 7, tbl2y + 4);
            ctx.moveTo(tbl2x + 7, tbl2y + 1); ctx.lineTo(tbl2x + 7, tbl2y + 4);
            ctx.stroke();

            // === Goods on left table (vegetables & fruits) ===
            // Basket of tomatoes
            ctx.fillStyle = '#a07030';
            ctx.beginPath();
            ctx.ellipse(tbl1x - 4, tbl1y - 3, 3, 1.8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#e04030';
            ctx.beginPath();
            ctx.arc(tbl1x - 5, tbl1y - 4, 1.2, 0, Math.PI * 2);
            ctx.arc(tbl1x - 3.5, tbl1y - 4.2, 1, 0, Math.PI * 2);
            ctx.arc(tbl1x - 4.2, tbl1y - 3.3, 0.9, 0, Math.PI * 2);
            ctx.fill();

            // Pile of bananas (yellow)
            ctx.fillStyle = '#e8c820';
            ctx.beginPath();
            ctx.ellipse(tbl1x + 1, tbl1y - 3.5, 2.5, 1, 0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#c0a010';
            ctx.lineWidth = 0.3;
            ctx.beginPath();
            ctx.arc(tbl1x + 1, tbl1y - 3.5, 2, 0.5, Math.PI - 0.5);
            ctx.stroke();

            // Green vegetables (kangkung/sayur)
            ctx.fillStyle = '#408030';
            ctx.beginPath();
            ctx.ellipse(tbl1x + 5, tbl1y - 3, 2.5, 1.5, -0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#50a040';
            ctx.beginPath();
            ctx.ellipse(tbl1x + 5.5, tbl1y - 3.5, 1.5, 0.8, 0, 0, Math.PI * 2);
            ctx.fill();

            // === Goods on right table (spices, fish, meat) ===
            // Basket of chili (red pile)
            ctx.fillStyle = '#a07030';
            ctx.beginPath();
            ctx.ellipse(tbl2x - 5, tbl2y - 3, 2.5, 1.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#c83020';
            for (let ci = 0; ci < 4; ci++) {
                ctx.beginPath();
                ctx.ellipse(tbl2x - 6 + ci * 1, tbl2y - 3.5 - ci * 0.2, 0.4, 1.2, 0.3 + ci * 0.2, 0, Math.PI * 2);
                ctx.fill();
            }

            // Fish (ikan) on tray
            ctx.fillStyle = '#c0c0c0';
            ctx.fillRect(tbl2x, tbl2y - 3, 5, 2.5);
            ctx.fillStyle = '#80a0b0';
            ctx.beginPath();
            ctx.ellipse(tbl2x + 1.5, tbl2y - 2.5, 1.8, 0.7, 0.1, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#7090a0';
            ctx.beginPath();
            ctx.ellipse(tbl2x + 3.5, tbl2y - 1.8, 1.5, 0.6, -0.1, 0, Math.PI * 2);
            ctx.fill();

            // Spice bags (small colored bags)
            const spiceCols = ['#d0a020', '#c06020', '#a08020'];
            for (let sp = 0; sp < 3; sp++) {
                ctx.fillStyle = spiceCols[sp];
                ctx.beginPath();
                ctx.arc(tbl2x + 6 + sp * 1.3, tbl2y - 3 - sp * 0.2, 0.9, 0, Math.PI * 2);
                ctx.fill();
            }

            // === Ground-level goods (on the floor) ===
            // Rice sack (karung beras)
            ctx.fillStyle = '#e8e0c8';
            ctx.beginPath();
            ctx.ellipse(sx - 20, sy + 6, 3, 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#d8d0b8';
            ctx.beginPath();
            ctx.ellipse(sx - 20, sy + 5, 2, 1, 0, 0, Math.PI * 2);
            ctx.fill();
            // "BERAS" text hint
            ctx.fillStyle = 'rgba(100,80,50,0.3)';
            ctx.fillRect(sx - 21.5, sy + 5.5, 3, 1.5);

            // Coconuts (kelapa)
            ctx.fillStyle = '#7a5a30';
            ctx.beginPath();
            ctx.arc(sx + 18, sy - 8, 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(sx + 20, sy - 7.5, 1.6, 0, Math.PI * 2);
            ctx.fill();

            // === Hanging goods (from tarp poles) ===
            // Hanging plastic bags
            const bagCols = ['rgba(200,50,50,0.4)', 'rgba(50,100,200,0.4)', 'rgba(200,180,50,0.4)'];
            for (let bg = 0; bg < 3; bg++) {
                const bx = sx - 16 + bg * 8;
                const by = sy - h - 2 + bg * 1.5;
                const sway = Math.sin(anim * 0.8 + bg * 1.5) * 0.5;
                ctx.fillStyle = bagCols[bg];
                ctx.beginPath();
                ctx.moveTo(bx, by);
                ctx.lineTo(bx - 1.5 + sway, by + 3);
                ctx.lineTo(bx + 1.5 + sway, by + 3);
                ctx.closePath();
                ctx.fill();
            }

            // === Buyers/sellers (people) ===
            // Seller (ibu pedagang) with headscarf
            const sel1x = sx - 12, sel1y = sy + 5;
            // Body
            ctx.fillStyle = '#6048a0';
            ctx.fillRect(sel1x - 1, sel1y - 3, 2, 3);
            // Headscarf (jilbab)
            ctx.fillStyle = '#e0d0f0';
            ctx.beginPath();
            ctx.arc(sel1x, sel1y - 4.5, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#d0c0e0';
            ctx.beginPath();
            ctx.moveTo(sel1x - 1.5, sel1y - 4);
            ctx.lineTo(sel1x, sel1y - 2.5);
            ctx.lineTo(sel1x + 1.5, sel1y - 4);
            ctx.closePath();
            ctx.fill();

            // Buyer walking
            const buy1x = sx + 4, buy1y = sy + 3;
            const buyBob = Math.sin(anim * 1.5) * 0.3;
            ctx.fillStyle = '#c06838';
            ctx.fillRect(buy1x - 1, buy1y - 3 + buyBob, 2, 3);
            ctx.fillStyle = '#f0d0a0';
            ctx.beginPath();
            ctx.arc(buy1x, buy1y - 4.5 + buyBob, 1.3, 0, Math.PI * 2);
            ctx.fill();
            // Carrying bag
            ctx.fillStyle = 'rgba(200,50,50,0.5)';
            ctx.beginPath();
            ctx.ellipse(buy1x + 2, buy1y - 1 + buyBob, 1.5, 1, 0.3, 0, Math.PI * 2);
            ctx.fill();

            // === Scale / timbangan ===
            const scaleX = sx + 12, scaleY = sy - 5;
            ctx.strokeStyle = '#606060';
            ctx.lineWidth = 0.6;
            // Pole
            ctx.beginPath();
            ctx.moveTo(scaleX, scaleY + 2);
            ctx.lineTo(scaleX, scaleY - 2);
            ctx.stroke();
            // Beam
            const tilt = Math.sin(anim * 0.5) * 0.15;
            ctx.beginPath();
            ctx.moveTo(scaleX - 3, scaleY - 2 + tilt);
            ctx.lineTo(scaleX + 3, scaleY - 2 - tilt);
            ctx.stroke();
            // Pans
            ctx.fillStyle = '#808080';
            ctx.beginPath();
            ctx.ellipse(scaleX - 3, scaleY - 1.5 + tilt, 1.5, 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(scaleX + 3, scaleY - 1.5 - tilt, 1.5, 0.6, 0, 0, Math.PI * 2);
            ctx.fill();

            // === Banner / spanduk "PASAR" ===
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillRect(sx - 8, sy - h - 8, 16, 4);
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.lineWidth = 0.3;
            ctx.strokeRect(sx - 8, sy - h - 8, 16, 4);
            ctx.fillStyle = '#c03030';
            ctx.font = 'bold 3px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('PASAR', sx, sy - h - 5.2);
        }
    },

    // --- KOPERASI (Cooperative Store) — detailed ---
    _drawKoperasi(ctx, sx, sy, p) {
        const hw = 22, hd = 11, h = 22 * p;
        const anim = this.animTime || 0;
        this._shadow(ctx, sx, sy, 28, 16);

        // ── Paved forecourt ──────────────────────────────────────────────
        ctx.fillStyle = '#d0c8b0';
        this._tileDiamond(ctx, sx + 6, sy + 5, 40, 20);
        ctx.fill();
        // Paving grid
        ctx.strokeStyle = 'rgba(180,165,130,0.4)'; ctx.lineWidth = 0.3;
        for (let g = 0; g < 4; g++) {
            ctx.beginPath(); ctx.moveTo(sx - 4 + g * 8, sy + 2); ctx.lineTo(sx - 10 + g * 8, sy + 10); ctx.stroke();
        }

        // ── Foundation ───────────────────────────────────────────────────
        this._box(ctx, sx, sy, hw + 2, hd + 1, 3,
            '#9ab0c0', ['#8aa0b0','#7a90a0'], ['#6a8090','#5a7080']);

        // ── Main building walls ───────────────────────────────────────────
        const lwG = ctx.createLinearGradient(sx - hw, sy - 3, sx - hw, sy - 3 - h);
        lwG.addColorStop(0, '#2878b8'); lwG.addColorStop(0.6, '#3888c8'); lwG.addColorStop(1, '#4898d8');
        ctx.fillStyle = lwG;
        ctx.beginPath();
        ctx.moveTo(sx - hw, sy - 3); ctx.lineTo(sx - hw, sy - 3 - h);
        ctx.lineTo(sx, sy - hd - 3 - h); ctx.lineTo(sx, sy - hd - 3);
        ctx.closePath(); ctx.fill();
        const rwG = ctx.createLinearGradient(sx + hw, sy - 3, sx + hw, sy - 3 - h);
        rwG.addColorStop(0, '#1868a8'); rwG.addColorStop(1, '#2878b8');
        ctx.fillStyle = rwG;
        ctx.beginPath();
        ctx.moveTo(sx + hw, sy - 3); ctx.lineTo(sx + hw, sy - 3 - h);
        ctx.lineTo(sx, sy - hd - 3 - h); ctx.lineTo(sx, sy - hd - 3);
        ctx.closePath(); ctx.fill();
        // Top face
        ctx.fillStyle = '#50a0d0';
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd - 3 - h); ctx.lineTo(sx + hw, sy - 3 - h);
        ctx.lineTo(sx, sy + hd - 3 - h); ctx.lineTo(sx - hw, sy - 3 - h);
        ctx.closePath(); ctx.fill();

        // ── White accent band (Indonesian cooperative look) ───────────────
        if (p > 0.3) {
            ctx.fillStyle = '#f0f4f8';
            ctx.beginPath();
            ctx.moveTo(sx - hw, sy - 3 - h * 0.65 + hd);
            ctx.lineTo(sx, sy - 3 - h * 0.65);
            ctx.lineTo(sx, sy - 3 - h * 0.65 - 3);
            ctx.lineTo(sx - hw, sy - 3 - h * 0.65 + hd - 3);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#d8e8f0';
            ctx.beginPath();
            ctx.moveTo(sx + hw, sy - 3 - h * 0.65 + hd);
            ctx.lineTo(sx, sy - 3 - h * 0.65);
            ctx.lineTo(sx, sy - 3 - h * 0.65 - 3);
            ctx.lineTo(sx + hw, sy - 3 - h * 0.65 + hd - 3);
            ctx.closePath(); ctx.fill();
        }

        // ── Roof ─────────────────────────────────────────────────────────
        this._hipRoof(ctx, sx, sy - 3, hw, hd, h, 9 * p, 4,
            '#1050a0', '#0a4090', '#1a60b0');
        // Roof ridge
        ctx.fillStyle = '#0a3880';
        ctx.fillRect(sx - 2, sy - 3 - hd - h - 9 * p, 4, 2);

        // ── Cooperative "KUD" symbol (gear + grain) ───────────────────────
        if (p > 0.45) {
            const symX = sx - hw * 0.45, symY = sy - 3 - h * 0.8;
            ctx.fillStyle = '#f8e840';
            ctx.beginPath(); ctx.arc(symX, symY, 3.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#2060a0';
            ctx.beginPath(); ctx.arc(symX, symY, 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#f8e840';
            ctx.beginPath(); ctx.arc(symX, symY, 1, 0, Math.PI * 2); ctx.fill();
        }

        // ── Windows ───────────────────────────────────────────────────────
        if (p > 0.4) {
            this._windowL(ctx, sx, sy - 3, hw * 0.7, h * 0.42, 5, 6.5);
            this._windowR(ctx, sx, sy - 3, hw * 0.3, h * 0.42, 5, 6.5);
            this._windowR(ctx, sx, sy - 3, hw * 0.65, h * 0.42, 4.5, 6.5);
            // Display window (etalase) on left face
            ctx.fillStyle = 'rgba(180,225,255,0.55)';
            ctx.fillRect(sx - hw + 3, sy - 3 + hd * 0.8 - h * 0.35, 10, 8);
            ctx.strokeStyle = 'rgba(30,80,140,0.4)'; ctx.lineWidth = 0.5;
            ctx.strokeRect(sx - hw + 3, sy - 3 + hd * 0.8 - h * 0.35, 10, 8);
            // Products in display
            ctx.fillStyle = '#e84040'; ctx.fillRect(sx - hw + 5, sy - 3 + hd * 0.8 - h * 0.35 + 2, 2, 4);
            ctx.fillStyle = '#40c040'; ctx.fillRect(sx - hw + 8, sy - 3 + hd * 0.8 - h * 0.35 + 2, 2, 4);
            ctx.fillStyle = '#e8c040'; ctx.fillRect(sx - hw + 11, sy - 3 + hd * 0.8 - h * 0.35 + 2, 1.5, 4);
        }

        // ── Front entrance ────────────────────────────────────────────────
        if (p > 0.55) {
            const ex = sx - 4, ey = sy - 3 - hd;
            // Glass door
            ctx.fillStyle = '#1a5888'; ctx.fillRect(ex - 3.5, ey - 9, 7, 9);
            ctx.fillStyle = 'rgba(180,225,255,0.7)'; ctx.fillRect(ex - 3, ey - 8.5, 3, 8);
            ctx.fillStyle = 'rgba(160,210,250,0.6)'; ctx.fillRect(ex + 0.5, ey - 8.5, 3, 8);
            ctx.strokeStyle = '#1a5888'; ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(ex, ey - 8.5); ctx.lineTo(ex, ey); ctx.stroke();
            // Overhang canopy
            ctx.fillStyle = '#0a4090';
            ctx.beginPath();
            ctx.moveTo(ex - 6, ey - 9); ctx.lineTo(ex + 6, ey - 9);
            ctx.lineTo(ex + 5, ey - 11); ctx.lineTo(ex - 5, ey - 11);
            ctx.closePath(); ctx.fill();
        }

        // ── Sign board ────────────────────────────────────────────────────
        if (p >= 1) {
            ctx.fillStyle = '#f8f0d0';
            ctx.fillRect(sx - hw * 0.55 + 1, sy - 3 - h * 0.68, hw * 1.05, 5.5);
            ctx.strokeStyle = '#c0a020'; ctx.lineWidth = 0.4;
            ctx.strokeRect(sx - hw * 0.55 + 1, sy - 3 - h * 0.68, hw * 1.05, 5.5);
            ctx.fillStyle = '#1040a0';
            ctx.font = 'bold 3.5px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('KOPERASI', sx - hw * 0.02, sy - 3 - h * 0.68 + 4);
        }

        // ── Parked motorbikes ─────────────────────────────────────────────
        if (p >= 1) {
            for (let m = 0; m < 2; m++) {
                const mx = sx + 8 + m * 7, my = sy + 4 + m * 2;
                ctx.fillStyle = ['#e03020','#2050a0'][m];
                ctx.fillRect(mx - 3, my - 3, 6, 2.5);
                ctx.fillStyle = '#202020';
                ctx.beginPath(); ctx.arc(mx - 2, my, 1.5, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(mx + 2, my, 1.5, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#606060'; ctx.lineWidth = 0.5;
                ctx.beginPath(); ctx.moveTo(mx, my - 2.5); ctx.lineTo(mx - 1, my - 4); ctx.stroke();
            }
        }

        // ── Customer figure (animated walking in) ─────────────────────────
        if (p >= 1) {
            const walkX = sx - hw + 5 + ((anim * 8) % 20);
            const legSwing = Math.sin(anim * 4) * 1.5;
            ctx.fillStyle = '#f0c870';
            ctx.beginPath(); ctx.arc(walkX, sy + 1, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#e06020';
            ctx.fillRect(walkX - 1.2, sy + 2.5, 2.4, 3.5);
            ctx.strokeStyle = '#c04010'; ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(walkX, sy + 6); ctx.lineTo(walkX - 1.5 + legSwing, sy + 8.5);
            ctx.moveTo(walkX, sy + 6); ctx.lineTo(walkX + 1.5 - legSwing, sy + 8.5);
            ctx.stroke();
        }
    },

    // --- GUDANG (Warehouse) ---
    _drawGudang(ctx, sx, sy, p) {
        const hw = 24, hd = 12, h = 22 * p;
        const anim = this.animTime || 0;
        this._shadow(ctx, sx, sy, 30, 16);

        // --- Concrete foundation / loading area ---
        ctx.fillStyle = '#989088';
        this._tileDiamond(ctx, sx, sy, 54, 27);
        ctx.fill();
        // Parking lines on concrete
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(sx - 22, sy + 10); ctx.lineTo(sx - 14, sy + 6);
        ctx.moveTo(sx - 20, sy + 12); ctx.lineTo(sx - 12, sy + 8);
        ctx.stroke();

        // --- Foundation step ---
        this._box(ctx, sx, sy, hw + 3, hd + 1.5, 2.5,
            '#908878', ['#807868','#706858'], ['#605848','#504838']);

        // --- Metal walls (corrugated steel) ---
        // Left wall gradient
        const lwGrad = ctx.createLinearGradient(sx - hw, sy, sx - hw, sy - h);
        lwGrad.addColorStop(0, '#889098');
        lwGrad.addColorStop(1, '#a0a8b0');
        ctx.fillStyle = lwGrad;
        ctx.beginPath();
        ctx.moveTo(sx - hw, sy - 2);
        ctx.lineTo(sx, sy - hd - 2);
        ctx.lineTo(sx, sy - hd - 2 - h);
        ctx.lineTo(sx - hw, sy - 2 - h);
        ctx.closePath();
        ctx.fill();

        // Right wall gradient
        const rwGrad = ctx.createLinearGradient(sx + hw, sy, sx + hw, sy - h);
        rwGrad.addColorStop(0, '#787e88');
        rwGrad.addColorStop(1, '#909aa2');
        ctx.fillStyle = rwGrad;
        ctx.beginPath();
        ctx.moveTo(sx + hw, sy - 2);
        ctx.lineTo(sx, sy - hd - 2);
        ctx.lineTo(sx, sy - hd - 2 - h);
        ctx.lineTo(sx + hw, sy - 2 - h);
        ctx.closePath();
        ctx.fill();

        // Corrugated vertical lines on left wall
        ctx.strokeStyle = 'rgba(0,0,0,0.05)';
        ctx.lineWidth = 0.4;
        for (let v = 1; v <= 6; v++) {
            const t = v / 7;
            const vx = sx - hw + (hw) * t;
            const vy = sy - 2 - (hd) * t;
            ctx.beginPath();
            ctx.moveTo(vx, vy);
            ctx.lineTo(vx, vy - h);
            ctx.stroke();
        }
        // Corrugated vertical lines on right wall
        for (let v = 1; v <= 6; v++) {
            const t = v / 7;
            const vx = sx + hw - (hw) * t;
            const vy = sy - 2 - (hd) * t;
            ctx.beginPath();
            ctx.moveTo(vx, vy);
            ctx.lineTo(vx, vy - h);
            ctx.stroke();
        }

        // Horizontal metal sheet seams
        ctx.strokeStyle = 'rgba(0,0,0,0.04)';
        ctx.lineWidth = 0.3;
        for (let hs = 1; hs <= 3; hs++) {
            const hsy = sy - 2 - h * (hs / 4);
            ctx.beginPath();
            ctx.moveTo(sx - hw, hsy + hd * (hs / 4));
            ctx.lineTo(sx, hsy - hd + hd * (hs / 4));
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(sx + hw, hsy + hd * (hs / 4));
            ctx.lineTo(sx, hsy - hd + hd * (hs / 4));
            ctx.stroke();
        }

        // --- Roof (gable, metal sheet, low pitch) ---
        this._gableRoof(ctx, sx, sy - 2, hw, hd, h, 6 * p, 3,
            '#6a7278', '#5a6268', '#7a8288');
        // Roof ridge cap
        ctx.fillStyle = '#8a9298';
        ctx.fillRect(sx - 2, sy - 2 - hd - h - 6 * p, 4, 1.5);
        // Gutter (talang air)
        ctx.strokeStyle = '#686868';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(sx - hw - 2, sy - 2 - h + 1);
        ctx.lineTo(sx, sy - hd - 2 - h + 1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx + hw + 2, sy - 2 - h + 1);
        ctx.lineTo(sx, sy - hd - 2 - h + 1);
        ctx.stroke();
        // Downpipe
        ctx.beginPath();
        ctx.moveTo(sx - hw - 2, sy - 2 - h + 1);
        ctx.lineTo(sx - hw - 2, sy - 2);
        ctx.stroke();

        // --- Large roller shutter door ---
        if (p > 0.5) {
            const doorW = 12, doorH = 13 * p;
            const doorX = sx - doorW / 2 - 1;
            const doorY = sy - 2 - hd;
            // Door frame
            ctx.fillStyle = '#505860';
            ctx.fillRect(doorX - 1, doorY - doorH - 1, doorW + 2, doorH + 2);
            // Shutter (partially open)
            const openH = 3;
            ctx.fillStyle = '#607080';
            ctx.fillRect(doorX, doorY - doorH, doorW, doorH - openH);
            // Shutter segment lines
            ctx.strokeStyle = 'rgba(0,0,0,0.12)';
            ctx.lineWidth = 0.4;
            for (let seg = 0; seg < 6; seg++) {
                const segY = doorY - doorH + seg * ((doorH - openH) / 6);
                ctx.beginPath();
                ctx.moveTo(doorX, segY);
                ctx.lineTo(doorX + doorW, segY);
                ctx.stroke();
            }
            // Dark opening underneath
            ctx.fillStyle = '#181818';
            ctx.fillRect(doorX, doorY - openH, doorW, openH);
            // Door handle
            ctx.fillStyle = '#404040';
            ctx.fillRect(doorX + doorW / 2 - 1, doorY - openH - 0.5, 2, 1);
        }

        // --- Side personnel door ---
        if (p > 0.6) {
            ctx.fillStyle = '#4a5058';
            ctx.fillRect(sx + hw - 6, sy - 2 - h * 0.05, 4, 7 * p);
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.fillRect(sx + hw - 5.5, sy - 2 - h * 0.05 + 0.5, 3, 6 * p);
            // Door knob
            ctx.fillStyle = '#a0a0a0';
            ctx.beginPath();
            ctx.arc(sx + hw - 3, sy - 2 - h * 0.05 + 3.5 * p, 0.4, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Ventilation louvers (high on walls) ---
        if (p > 0.7) {
            // Left wall vent
            ctx.fillStyle = 'rgba(40,40,40,0.2)';
            ctx.fillRect(sx - hw + 4, sy - 2 - h + 4 - hd * 0.3, 5, 3);
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.lineWidth = 0.3;
            for (let lv = 0; lv < 3; lv++) {
                ctx.beginPath();
                ctx.moveTo(sx - hw + 4, sy - 2 - h + 4.8 - hd * 0.3 + lv);
                ctx.lineTo(sx - hw + 9, sy - 2 - h + 4.8 - hd * 0.3 + lv);
                ctx.stroke();
            }
        }

        // --- Outdoor details ---
        if (p >= 1) {
            // === Wooden crates / peti kayu (stacked) ===
            this._box(ctx, sx + 16, sy + 2, 4.5, 2.2, 5,
                '#c8a860', ['#b89850','#a88840'], ['#987830','#886820']);
            // Crate lines
            ctx.strokeStyle = 'rgba(80,50,20,0.15)';
            ctx.lineWidth = 0.3;
            ctx.beginPath();
            ctx.moveTo(sx + 13, sy + 2 - 2.5); ctx.lineTo(sx + 19, sy + 2 - 2.5);
            ctx.stroke();

            this._box(ctx, sx + 13, sy + 4, 3.5, 1.8, 4,
                '#b89858', ['#a88848','#988738'], ['#887828','#786818']);

            // Small crate on top of first
            this._box(ctx, sx + 16, sy + 1.5, 3, 1.5, 3,
                '#d0b068', ['#c0a058','#b09048'], ['#a08038','#907028']);

            // === Oil drum / drum minyak (blue) ===
            const drumX = sx - 17, drumY = sy + 5;
            // Drum body
            const drumGrad = ctx.createLinearGradient(drumX - 3, drumY, drumX + 3, drumY);
            drumGrad.addColorStop(0, '#3868a8');
            drumGrad.addColorStop(0.4, '#4888c8');
            drumGrad.addColorStop(1, '#2858a0');
            ctx.fillStyle = drumGrad;
            ctx.fillRect(drumX - 3, drumY - 5, 6, 6);
            // Drum top
            ctx.fillStyle = '#5898c8';
            ctx.beginPath();
            ctx.ellipse(drumX, drumY - 5, 3, 1.2, 0, 0, Math.PI * 2);
            ctx.fill();
            // Drum bottom
            ctx.fillStyle = '#3060a0';
            ctx.beginPath();
            ctx.ellipse(drumX, drumY + 1, 3, 1.2, 0, 0, Math.PI);
            ctx.fill();
            // Drum bands
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(drumX - 3, drumY - 3.5); ctx.lineTo(drumX + 3, drumY - 3.5);
            ctx.moveTo(drumX - 3, drumY - 0.5); ctx.lineTo(drumX + 3, drumY - 0.5);
            ctx.stroke();

            // Second drum behind
            ctx.fillStyle = '#3070b0';
            ctx.fillRect(drumX + 4, drumY - 4.5, 5, 5);
            ctx.fillStyle = '#5090c0';
            ctx.beginPath();
            ctx.ellipse(drumX + 6.5, drumY - 4.5, 2.5, 1, 0, 0, Math.PI * 2);
            ctx.fill();

            // === Pallet / palet kayu ===
            const palX = sx + 6, palY = sy + 8;
            ctx.fillStyle = '#b09050';
            ctx.fillRect(palX - 4, palY, 8, 1.5);
            ctx.fillRect(palX - 4, palY + 2, 8, 1.5);
            // Pallet slats
            ctx.fillStyle = '#a08040';
            ctx.fillRect(palX - 3.5, palY + 1.5, 1.5, 0.5);
            ctx.fillRect(palX + 2, palY + 1.5, 1.5, 0.5);
            // Sacks on pallet
            ctx.fillStyle = '#d8d0b0';
            ctx.beginPath();
            ctx.ellipse(palX - 1, palY - 1, 2.5, 1.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#c8c0a0';
            ctx.beginPath();
            ctx.ellipse(palX + 2, palY - 0.5, 2, 1.2, 0.2, 0, Math.PI * 2);
            ctx.fill();

            // === Forklift (mini) ===
            const fkX = sx - 5, fkY = sy + 9;
            // Body
            ctx.fillStyle = '#d8a020';
            ctx.fillRect(fkX - 2.5, fkY - 4, 5, 4);
            // Cabin frame
            ctx.strokeStyle = '#b08010';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(fkX - 2.5, fkY - 4, 5, 4);
            // Overhead guard
            ctx.fillStyle = '#c09018';
            ctx.fillRect(fkX - 2.8, fkY - 5, 5.6, 1);
            // Forks
            ctx.fillStyle = '#707070';
            ctx.fillRect(fkX - 3, fkY - 1, 1, 3);
            ctx.fillRect(fkX + 2, fkY - 1, 1, 3);
            // Mast
            ctx.fillStyle = '#606060';
            ctx.fillRect(fkX - 3.5, fkY - 5, 1, 6);
            // Wheels
            ctx.fillStyle = '#282828';
            ctx.beginPath();
            ctx.arc(fkX - 1.5, fkY + 0.5, 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(fkX + 1.5, fkY + 0.5, 1, 0, Math.PI * 2);
            ctx.fill();
            // Seat
            ctx.fillStyle = '#404040';
            ctx.fillRect(fkX - 0.5, fkY - 3, 1.5, 1.5);

            // === Light fixture on wall ===
            ctx.fillStyle = '#e8e0a0';
            ctx.globalAlpha = 0.3 + Math.sin(anim * 2) * 0.05;
            ctx.beginPath();
            ctx.arc(sx - hw + 2, sy - 2 - h * 0.4, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            // Light housing
            ctx.fillStyle = '#484848';
            ctx.fillRect(sx - hw + 1, sy - 2 - h * 0.4 - 1, 2, 2);

            // === Sign "GUDANG" ===
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fillRect(sx - hw + 3, sy - 2 - h + 3 + hd * 0.15, 10, 3);
            ctx.fillStyle = '#303030';
            ctx.font = 'bold 2.5px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('GUDANG', sx - hw + 8, sy - 2 - h + 5 + hd * 0.15);
        }
    },

    // --- PABRIK (Factory, 2x2) ---
    _drawPabrik(ctx, sx, sy, p) {
        const hw = 40, hd = 20, h = 28 * p;
        const anim = this.animTime || 0;
        this._shadow(ctx, sx, sy, 46, 26);

        // --- Concrete yard ---
        ctx.fillStyle = '#909088';
        this._tileDiamond(ctx, sx, sy, 86, 43);
        ctx.fill();

        // --- Concrete foundation ---
        this._box(ctx, sx, sy, hw + 3, hd + 2, 3,
            '#808078', ['#707068','#606058'], ['#585850','#484840']);

        // --- Main building (corrugated metal walls) ---
        // Left wall gradient
        const lwGrad = ctx.createLinearGradient(sx - hw, sy - 3, sx - hw, sy - 3 - h);
        lwGrad.addColorStop(0, '#98a0a8');
        lwGrad.addColorStop(1, '#b0b8c0');
        ctx.fillStyle = lwGrad;
        ctx.beginPath();
        ctx.moveTo(sx - hw, sy - 3);
        ctx.lineTo(sx, sy - hd - 3);
        ctx.lineTo(sx, sy - hd - 3 - h);
        ctx.lineTo(sx - hw, sy - 3 - h);
        ctx.closePath();
        ctx.fill();
        // Right wall gradient
        const rwGrad = ctx.createLinearGradient(sx + hw, sy - 3, sx + hw, sy - 3 - h);
        rwGrad.addColorStop(0, '#808890');
        rwGrad.addColorStop(1, '#9098a2');
        ctx.fillStyle = rwGrad;
        ctx.beginPath();
        ctx.moveTo(sx + hw, sy - 3);
        ctx.lineTo(sx, sy - hd - 3);
        ctx.lineTo(sx, sy - hd - 3 - h);
        ctx.lineTo(sx + hw, sy - 3 - h);
        ctx.closePath();
        ctx.fill();

        // Corrugated vertical lines on left
        ctx.strokeStyle = 'rgba(0,0,0,0.04)';
        ctx.lineWidth = 0.4;
        for (let v = 1; v <= 8; v++) {
            const t = v / 9;
            const vx = sx - hw + hw * t;
            const vy = sy - 3 - hd * t;
            ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(vx, vy - h); ctx.stroke();
        }
        // Corrugated vertical lines on right
        for (let v = 1; v <= 8; v++) {
            const t = v / 9;
            const vx = sx + hw - hw * t;
            const vy = sy - 3 - hd * t;
            ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(vx, vy - h); ctx.stroke();
        }

        // Horizontal seams on both walls
        ctx.strokeStyle = 'rgba(0,0,0,0.03)';
        for (let hs = 1; hs <= 3; hs++) {
            const hsy = sy - 3 - h * (hs / 4);
            ctx.beginPath();
            ctx.moveTo(sx - hw, hsy + hd * (hs / 4));
            ctx.lineTo(sx, hsy - hd + hd * (hs / 4));
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(sx + hw, hsy + hd * (hs / 4));
            ctx.lineTo(sx, hsy - hd + hd * (hs / 4));
            ctx.stroke();
        }

        // --- Roof (gable, metal) ---
        this._gableRoof(ctx, sx, sy - 3, hw, hd, h, 8 * p, 4,
            '#687078', '#586068', '#788088');
        // Ridge cap
        ctx.fillStyle = '#8a9098';
        ctx.fillRect(sx - 3, sy - 3 - hd - h - 8 * p, 6, 2);
        // Skylight panels on roof
        if (p > 0.5) {
            ctx.fillStyle = 'rgba(160,200,220,0.15)';
            ctx.fillRect(sx - 12, sy - 3 - hd - h - 5 * p, 8, 3);
            ctx.fillRect(sx + 4, sy - 3 - hd - h - 5 * p, 8, 3);
        }

        // --- Smokestack / chimney ---
        if (p > 0.6) {
            const chX = sx + hw * 0.45, chY = sy - 3;
            const chH = h + 20;
            // Chimney body
            const chGrad = ctx.createLinearGradient(chX - 4, chY, chX + 4, chY);
            chGrad.addColorStop(0, '#505050');
            chGrad.addColorStop(0.5, '#686868');
            chGrad.addColorStop(1, '#404040');
            ctx.fillStyle = chGrad;
            ctx.fillRect(chX - 4, chY - chH, 8, chH);
            // Red warning stripes
            ctx.fillStyle = '#c04040';
            ctx.fillRect(chX - 4, chY - chH, 8, 2.5);
            ctx.fillRect(chX - 4, chY - chH + 6, 8, 2.5);
            // White stripes
            ctx.fillStyle = '#e0e0e0';
            ctx.fillRect(chX - 4, chY - chH + 2.5, 8, 2.5);
            // Chimney cap ring
            ctx.fillStyle = '#585858';
            ctx.beginPath();
            ctx.ellipse(chX, chY - chH, 5, 2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Animated smoke puffs
            for (let s = 0; s < 5; s++) {
                const smokeT = ((anim * 0.4 + s * 1.1) % 5) / 5;
                const smokeX = chX + Math.sin(anim * 0.5 + s * 0.8) * (3 + smokeT * 6);
                const smokeY = chY - chH - smokeT * 22;
                const smokeR = 2.5 + smokeT * 4;
                ctx.fillStyle = `rgba(160,160,170,${0.22 - smokeT * 0.04})`;
                ctx.beginPath();
                ctx.arc(smokeX, smokeY, smokeR, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // --- Loading dock (raised platform) ---
        if (p > 0.5) {
            const dockX = sx - hw * 0.55, dockY = sy + hd * 0.5;
            this._box(ctx, dockX, dockY, 12, 6, 5,
                '#989898', ['#888888','#787878'], ['#707070','#606060']);
            // Dock bumpers (yellow)
            ctx.fillStyle = '#d0a020';
            ctx.fillRect(dockX - 6, dockY + 3 - 4, 1.5, 3);
            ctx.fillRect(dockX + 5, dockY - 3 - 4, 1.5, 3);
        }

        // --- Windows (industrial high) ---
        if (p > 0.4) {
            for (let i = 0; i < 4; i++) {
                this._windowL(ctx, sx, sy - 3, hw * (0.1 + i * 0.2), h * 0.65, 5, 7);
            }
            for (let i = 0; i < 3; i++) {
                this._windowR(ctx, sx, sy - 3, hw * (0.15 + i * 0.25), h * 0.65, 5, 7);
            }
        }

        // --- Large front roller door ---
        if (p > 0.6) {
            const doorW = 10, doorH = 12;
            ctx.fillStyle = '#505860';
            ctx.fillRect(sx - doorW / 2, sy - 3 - hd - doorH, doorW, doorH);
            // Roller lines
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.lineWidth = 0.3;
            for (let dl = 0; dl < 5; dl++) {
                const dy = sy - 3 - hd - doorH + dl * (doorH / 5);
                ctx.beginPath(); ctx.moveTo(sx - doorW / 2, dy); ctx.lineTo(sx + doorW / 2, dy); ctx.stroke();
            }
            // Door frame
            ctx.strokeStyle = '#404040';
            ctx.lineWidth = 0.6;
            ctx.strokeRect(sx - doorW / 2, sy - 3 - hd - doorH, doorW, doorH);
        }

        // --- Outdoor details ---
        if (p >= 1) {
            // Parked truck
            const trX = sx - hw * 0.6, trY = sy + hd * 0.8;
            ctx.fillStyle = '#3060a0';
            ctx.fillRect(trX - 5, trY - 4, 10, 5);
            ctx.fillStyle = '#d0c8b0';
            ctx.fillRect(trX - 5, trY - 7, 5, 3);
            ctx.fillStyle = 'rgba(160,200,220,0.4)';
            ctx.fillRect(trX - 4.5, trY - 6.5, 3.5, 2);
            ctx.fillStyle = '#282828';
            ctx.beginPath();
            ctx.arc(trX - 3, trY + 1.5, 1.3, 0, Math.PI * 2);
            ctx.arc(trX + 3, trY + 1.5, 1.3, 0, Math.PI * 2);
            ctx.fill();

            // Storage tanks (small cylindrical)
            const tkX = sx + hw * 0.6, tkY = sy - hd * 0.2;
            const tkGrad = ctx.createLinearGradient(tkX - 4, tkY, tkX + 4, tkY);
            tkGrad.addColorStop(0, '#c0c0b8');
            tkGrad.addColorStop(0.5, '#d8d8d0');
            tkGrad.addColorStop(1, '#b0b0a8');
            ctx.fillStyle = tkGrad;
            ctx.fillRect(tkX - 4, tkY - 8, 8, 8);
            ctx.fillStyle = '#d0d0c8';
            ctx.beginPath();
            ctx.ellipse(tkX, tkY - 8, 4, 1.5, 0, 0, Math.PI * 2);
            ctx.fill();
            // Tank band
            ctx.strokeStyle = 'rgba(0,0,0,0.08)';
            ctx.lineWidth = 0.4;
            ctx.beginPath();
            ctx.moveTo(tkX - 4, tkY - 4); ctx.lineTo(tkX + 4, tkY - 4);
            ctx.stroke();

            // Danger sign
            ctx.fillStyle = '#e0c020';
            ctx.fillRect(sx + 2, sy - 3 - hd - 3, 4, 3);
            ctx.fillStyle = '#202020';
            ctx.font = 'bold 2px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('⚡', sx + 4, sy - 3 - hd - 1);

            // Safety bollards (yellow posts)
            const bollards = [[sx - hw - 3, sy + 3], [sx - hw + 3, sy + hd - 1]];
            for (const [bx, by] of bollards) {
                ctx.fillStyle = '#d0a020';
                ctx.fillRect(bx - 0.5, by - 3, 1, 3);
                ctx.fillStyle = '#181818';
                ctx.fillRect(bx - 0.5, by - 2, 1, 0.5);
            }
        }
    },

    // --- BANK — classical Indonesian bank, world-class detail ---
    _drawBank(ctx, sx, sy, p) {
        const hw = 22, hd = 11, h = 28 * p;
        const anim = this.animTime || 0;
        this._shadow(ctx, sx, sy, 30, 18);

        // ── Marble plaza ──────────────────────────────────────────────────
        const plazaG = ctx.createLinearGradient(sx - hw - 3, sy + 1, sx + hw + 3, sy + hd + 1);
        plazaG.addColorStop(0, '#e8e0d0'); plazaG.addColorStop(1, '#d8d0c0');
        ctx.fillStyle = plazaG;
        this._tileDiamond(ctx, sx + 4, sy + 4, 50, 25);
        ctx.fill();
        // Marble grout lines
        ctx.strokeStyle = 'rgba(180,170,150,0.4)'; ctx.lineWidth = 0.3;
        for (let g = 0; g < 5; g++) {
            const gx2 = sx - 18 + g * 9;
            ctx.beginPath(); ctx.moveTo(gx2, sy + 1); ctx.lineTo(gx2 - 6, sy + 9); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(gx2, sy + 1); ctx.lineTo(gx2 + 6, sy + 7); ctx.stroke();
        }

        // ── Stone foundation with steps ───────────────────────────────────
        this._box(ctx, sx, sy, hw + 4, hd + 2, 4,
            '#dcd4c0', ['#ccc4b0','#bcb4a0'], ['#aca490','#9c9480']);
        // Steps (3 steps ascending to entrance)
        for (let s = 0; s < 3; s++) {
            const sOff = s * 2.5;
            ctx.fillStyle = `rgba(200,190,170,${0.2 + s * 0.1})`;
            ctx.beginPath();
            ctx.moveTo(sx - 7 + sOff * 0.5, sy - 3 - hd * 0.06 + sOff);
            ctx.lineTo(sx + 7 - sOff * 0.5, sy - 3 - hd * 0.12 + sOff);
            ctx.lineTo(sx + 7 - sOff * 0.5 - 1, sy - 3 - hd * 0.12 + sOff - 1.5);
            ctx.lineTo(sx - 7 + sOff * 0.5 + 1, sy - 3 - hd * 0.06 + sOff - 1.5);
            ctx.closePath(); ctx.fill();
        }

        // ── Walls: marble/limestone two-tone ──────────────────────────────
        const lwG = ctx.createLinearGradient(sx - hw, sy - 4, sx, sy - 4 - h);
        lwG.addColorStop(0, '#cec6ae'); lwG.addColorStop(0.5, '#e0d8c0'); lwG.addColorStop(1, '#ece4cc');
        ctx.fillStyle = lwG;
        ctx.beginPath();
        ctx.moveTo(sx - hw, sy - 4); ctx.lineTo(sx - hw, sy - 4 - h);
        ctx.lineTo(sx, sy - hd - 4 - h); ctx.lineTo(sx, sy - hd - 4);
        ctx.closePath(); ctx.fill();
        const rwG = ctx.createLinearGradient(sx + hw, sy - 4, sx, sy - 4 - h);
        rwG.addColorStop(0, '#b8b098'); rwG.addColorStop(1, '#ccc4ac');
        ctx.fillStyle = rwG;
        ctx.beginPath();
        ctx.moveTo(sx + hw, sy - 4); ctx.lineTo(sx + hw, sy - 4 - h);
        ctx.lineTo(sx, sy - hd - 4 - h); ctx.lineTo(sx, sy - hd - 4);
        ctx.closePath(); ctx.fill();
        // Top face
        ctx.fillStyle = '#d8d0b8';
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd - 4 - h); ctx.lineTo(sx + hw, sy - 4 - h);
        ctx.lineTo(sx, sy + hd - 4 - h); ctx.lineTo(sx - hw, sy - 4 - h);
        ctx.closePath(); ctx.fill();

        // ── Horizontal rustication bands ──────────────────────────────────
        if (p > 0.3) {
            ctx.strokeStyle = 'rgba(160,148,120,0.3)'; ctx.lineWidth = 0.5;
            for (let r = 1; r <= 3; r++) {
                const ry = sy - 4 - h * r * 0.25;
                ctx.beginPath();
                ctx.moveTo(sx - hw, ry + hd * r * 0.25);
                ctx.lineTo(sx, ry); ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(sx + hw, ry + hd * r * 0.25);
                ctx.lineTo(sx, ry); ctx.stroke();
            }
        }

        // ── Classical columns (Ionic, 4 on front face) ────────────────────
        if (p > 0.4) {
            for (let c = 0; c < 4; c++) {
                const t = (c + 0.5) / 4;
                const colX = sx - hw + hw * t;
                const colY = sy - 4 - hd * t;
                const colH = h - 4;
                // Column shaft gradient
                const cG = ctx.createLinearGradient(colX - 1.5, colY, colX + 1.5, colY);
                cG.addColorStop(0, '#d0c8b0'); cG.addColorStop(0.3, '#ece4cc'); cG.addColorStop(1, '#b8b098');
                ctx.fillStyle = cG;
                ctx.fillRect(colX - 1.3, colY - colH, 2.6, colH);
                // Entasis (slight taper at top)
                ctx.fillStyle = 'rgba(255,255,255,0.08)';
                ctx.fillRect(colX - 0.5, colY - colH, 0.7, colH);
                // Capital (Ionic scroll suggestion)
                ctx.fillStyle = '#c8c0a8';
                ctx.fillRect(colX - 2.5, colY - colH - 0.5, 5, 1.5);
                ctx.fillRect(colX - 2, colY - colH + 1, 4, 1);
                // Base (Attic base)
                ctx.fillStyle = '#c0b8a0';
                ctx.fillRect(colX - 2, colY - 1.5, 4, 1.5);
                ctx.fillRect(colX - 2.5, colY - 0.5, 5, 1);
            }
        }

        // ── Roof: flat with classical cornice ────────────────────────────
        this._hipRoof(ctx, sx, sy - 4, hw, hd, h, 6 * p, 3,
            '#5c4c30', '#4c3c20', '#6c5c40');
        // Cornice (ornate band)
        if (p > 0.45) {
            ctx.fillStyle = '#d4cc98';
            ctx.beginPath();
            ctx.moveTo(sx - hw - 2, sy - 4 - h);
            ctx.lineTo(sx, sy - hd - 4 - h);
            ctx.lineTo(sx, sy - hd - 4 - h - 3);
            ctx.lineTo(sx - hw - 2, sy - 4 - h - 3);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#c8c090';
            ctx.beginPath();
            ctx.moveTo(sx + hw + 2, sy - 4 - h);
            ctx.lineTo(sx, sy - hd - 4 - h);
            ctx.lineTo(sx, sy - hd - 4 - h - 3);
            ctx.lineTo(sx + hw + 2, sy - 4 - h - 3);
            ctx.closePath(); ctx.fill();
            // Dentils on cornice
            ctx.fillStyle = 'rgba(100,90,60,0.25)';
            for (let d = 0; d < 7; d++) {
                const dx = sx - hw + 3 + d * 5;
                const dy = sy - 4 - h + (dx - sx + hw) * hd / hw;
                ctx.fillRect(dx, dy - h + dy - sy + 3, 2.5, 2.5);
            }
        }

        // ── Heavy front door (double, ornate) ────────────────────────────
        if (p > 0.5) {
            const dX = sx - 3, dY = sy - 4 - hd * 0.06;
            const dW = 8, dH = 14;
            // Stone arch frame
            ctx.fillStyle = '#c4bc98';
            ctx.fillRect(dX - dW / 2 - 1, dY - dH - 1, dW + 2, dH + 1);
            // Arch keystone
            ctx.beginPath(); ctx.arc(dX, dY - dH, dW / 2 + 1.5, Math.PI, 0); ctx.fill();
            // Door panels
            ctx.fillStyle = '#3a2c14';
            ctx.fillRect(dX - dW / 2, dY - dH, dW / 2 - 0.5, dH);
            ctx.fillStyle = '#302410';
            ctx.fillRect(dX + 0.5, dY - dH, dW / 2 - 0.5, dH);
            // Door panel recesses
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(dX - dW / 2 + 0.5, dY - dH + 1, dW / 2 - 2, 5);
            ctx.fillRect(dX - dW / 2 + 0.5, dY - dH + 8, dW / 2 - 2, 5);
            ctx.fillRect(dX + 1, dY - dH + 1, dW / 2 - 2, 5);
            ctx.fillRect(dX + 1, dY - dH + 8, dW / 2 - 2, 5);
            // Brass handles
            ctx.fillStyle = '#d4a030';
            ctx.beginPath(); ctx.arc(dX - 1, dY - dH * 0.45, 0.7, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(dX + 1, dY - dH * 0.45, 0.7, 0, Math.PI * 2); ctx.fill();
            // Arch glass window
            ctx.fillStyle = 'rgba(180,210,240,0.4)';
            ctx.beginPath(); ctx.arc(dX, dY - dH, dW / 2, Math.PI, 0); ctx.fill();
            // Fanlight radial lines
            ctx.strokeStyle = '#3a2c14'; ctx.lineWidth = 0.4;
            for (let fl = 0; fl < 5; fl++) {
                const ang = Math.PI + (fl + 1) * Math.PI / 6;
                ctx.beginPath();
                ctx.moveTo(dX, dY - dH);
                ctx.lineTo(dX + Math.cos(ang) * dW * 0.5, dY - dH + Math.sin(ang) * dW * 0.25);
                ctx.stroke();
            }
        }

        // ── Arched windows (tall, classical) ─────────────────────────────
        if (p > 0.45) {
            const drawArchWin = (wX, wY) => {
                const wW = 4.5, wH = 8;
                ctx.fillStyle = '#3a3020';
                ctx.fillRect(wX - wW / 2, wY - wH, wW, wH);
                ctx.beginPath(); ctx.arc(wX, wY - wH, wW / 2, Math.PI, 0); ctx.fill();
                ctx.fillStyle = 'rgba(180,215,240,0.4)';
                ctx.fillRect(wX - wW / 2 + 0.5, wY - wH + 0.5, wW - 1, wH - 0.5);
                ctx.beginPath(); ctx.arc(wX, wY - wH, wW / 2 - 0.5, Math.PI, 0); ctx.fill();
                ctx.strokeStyle = '#3a3020'; ctx.lineWidth = 0.35;
                ctx.beginPath(); ctx.moveTo(wX, wY - wH + 0.5); ctx.lineTo(wX, wY); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(wX - wW / 2 + 0.5, wY - wH * 0.5); ctx.lineTo(wX + wW / 2 - 0.5, wY - wH * 0.5); ctx.stroke();
            };
            // Left face
            for (let w = 0; w < 2; w++) {
                const t = (w + 0.5) / 3;
                drawArchWin(sx - hw + hw * (0.2 + t * 0.6), sy - 4 - hd * (0.2 + t * 0.6) - h * 0.42);
            }
            // Right face
            for (let w = 0; w < 2; w++) {
                const t = (w + 0.5) / 3;
                drawArchWin(sx + hw - hw * (0.2 + t * 0.6), sy - 4 - hd * (0.2 + t * 0.6) - h * 0.42);
            }
        }

        // ── "BANK" brass plaque ───────────────────────────────────────────
        if (p >= 1) {
            ctx.fillStyle = '#c8a028';
            ctx.fillRect(sx - hw * 0.6, sy - 4 - h * 0.75, hw * 1.15, 6);
            ctx.strokeStyle = '#a07820'; ctx.lineWidth = 0.5;
            ctx.strokeRect(sx - hw * 0.6, sy - 4 - h * 0.75, hw * 1.15, 6);
            ctx.fillStyle = '#3a2c10';
            ctx.font = 'bold 3.5px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('BANK', sx - hw * 0.02, sy - 4 - h * 0.75 + 4.5);
        }

        // ── ATM kiosk (detailed) ──────────────────────────────────────────
        if (p >= 1) {
            const atmX = sx + hw - 1, atmY = sy + 1;
            ctx.fillStyle = '#283878';
            ctx.fillRect(atmX - 3, atmY - 8, 6, 8);
            ctx.fillStyle = '#3848a8';
            ctx.fillRect(atmX - 2.5, atmY - 7.5, 5, 3);
            ctx.fillStyle = `rgba(80,160,255,${0.5 + Math.sin(anim * 2) * 0.15})`;
            ctx.fillRect(atmX - 2, atmY - 7, 4, 2);
            ctx.fillStyle = '#404040';
            ctx.fillRect(atmX - 1.5, atmY - 4, 3, 2);
            // Keypad dots
            ctx.fillStyle = '#808080';
            for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
                ctx.beginPath(); ctx.arc(atmX - 1 + c * 1, atmY - 3.5 + r * 0.9, 0.25, 0, Math.PI * 2); ctx.fill();
            }
            // ATM sign
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 2px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('ATM', atmX, atmY - 7.8);
            // Queue person
            ctx.fillStyle = '#f0c870';
            ctx.beginPath(); ctx.arc(atmX - 6, atmY - 3, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#2850b0';
            ctx.fillRect(atmX - 7.2, atmY - 1.5, 2.4, 3);
        }

        // ── Security guard (detailed, standing at door) ───────────────────
        if (p >= 1) {
            const gx = sx + 7, gy = sy - hd * 0.14 + 2;
            ctx.fillStyle = '#f5d090';
            ctx.beginPath(); ctx.arc(gx, gy - 6, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#1a3060';
            ctx.fillRect(gx - 1.5, gy - 4.5, 3, 4);
            ctx.fillStyle = '#0a1a40';
            ctx.fillRect(gx - 1.8, gy - 6.8, 3.6, 1.2);
            ctx.fillStyle = '#c8a030';
            ctx.fillRect(gx - 0.5, gy - 3.5, 1, 0.8);
            ctx.strokeStyle = '#102040'; ctx.lineWidth = 0.6;
            ctx.beginPath(); ctx.moveTo(gx, gy - 0.5); ctx.lineTo(gx - 2, gy + 3); ctx.moveTo(gx, gy - 0.5); ctx.lineTo(gx + 2, gy + 3); ctx.stroke();
        }
    },

    // --- UNIVERSITAS (ITB-style campus, 3x3) ---
    _drawUniversitas(ctx, sx, sy, p) {
        const hw = 50, hd = 25;
        const h1 = 18 * p;   // ground floor height
        const h2 = 14 * p;   // upper floor height
        const baseY = sy - 4; // top of foundation

        this._shadow(ctx, sx, sy, hw + 8, hd + 6);

        // ── Courtyard (grass + stone path) ──────────────────────────────
        ctx.fillStyle = '#5aaa48';
        this._tileDiamond(ctx, sx, sy, 108, 54);
        ctx.fill();
        // Stone paving in front
        ctx.fillStyle = '#c8be9a';
        ctx.beginPath();
        ctx.moveTo(sx - 18, sy + 16);
        ctx.lineTo(sx + 18, sy + 8);
        ctx.lineTo(sx + 14, sy + 18);
        ctx.lineTo(sx - 22, sy + 26);
        ctx.closePath();
        ctx.fill();
        // Dividing lines on paving
        ctx.strokeStyle = 'rgba(160,150,120,0.5)';
        ctx.lineWidth = 0.4;
        ctx.beginPath(); ctx.moveTo(sx - 2, sy + 12); ctx.lineTo(sx + 2, sy + 22); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx - 10, sy + 14); ctx.lineTo(sx - 6, sy + 24); ctx.stroke();

        // Fountain (characteristic of ITB front plaza)
        if (p > 0.65) {
            const fx = sx - 8, fy = sy + 14;
            ctx.fillStyle = '#3a7cc0';
            ctx.beginPath();
            ctx.ellipse(fx, fy, 8, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#5090d0'; ctx.lineWidth = 0.8; ctx.stroke();
            ctx.strokeStyle = '#90c8f0'; ctx.lineWidth = 0.3;
            ctx.beginPath(); ctx.ellipse(fx, fy, 5, 2.5, 0, 0, Math.PI * 2); ctx.stroke();
            // Fountain spray
            const wt = (this.animTime || 0) * 2.5;
            ctx.strokeStyle = 'rgba(160,210,255,0.7)'; ctx.lineWidth = 0.7;
            ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx - 1, fy - 5 - Math.sin(wt) * 0.8); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 1, fy - 4 - Math.cos(wt) * 0.8); ctx.stroke();
        }

        // Tropical trees in courtyard
        if (p > 0.5) {
            this._treeLarge(ctx, sx - hw + 14, sy - 10, 71);
            this._treeLarge(ctx, sx - hw + 26, sy - 6, 133);
            this._treeLarge(ctx, sx + hw - 20, sy - 5, 44);
            this._treeLarge(ctx, sx + hw - 32, sy - 10, 188);
        }

        // ── Stone foundation (dark granite/andesite texture) ────────────
        this._box(ctx, sx, sy, hw + 3, hd + 1.5, 4,
            '#807870', ['#706860','#5e5650'], ['#565048','#484038']);

        // ── Ground floor — main building body ────────────────────────────
        this._box(ctx, sx, baseY, hw, hd, h1,
            '#f0ece0', ['#eee6d0','#e5dcc4'], ['#d8d0bc','#ccc4b0']);

        // ── Stone colonnade pillars on ground floor (characteristic of ITB) ──
        if (p > 0.3) {
            // Left-face pillars (dark andesite stone)
            for (let i = 1; i <= 4; i++) {
                const t = i / 5;
                const px = sx - hw + hw * t;
                const py = baseY + hd * t;
                const ph = h1 * 0.88;
                // Stone shaft (rounded andesite look)
                ctx.fillStyle = '#4a4538';
                ctx.fillRect(px - 1.5, py - ph, 3, ph);
                // Stone capital
                ctx.fillStyle = '#6a6255';
                ctx.fillRect(px - 2.5, py - ph - 1.5, 5, 2);
                // Stone base
                ctx.fillStyle = '#585048';
                ctx.fillRect(px - 2.5, py - 2.5, 5, 2.5);
            }
            // Right-face pillars
            for (let i = 1; i <= 4; i++) {
                const t = i / 5;
                const px = sx + hw - hw * t;
                const py = baseY + hd * t;
                const ph = h1 * 0.88;
                ctx.fillStyle = '#403c30';
                ctx.fillRect(px - 1.5, py - ph, 3, ph);
                ctx.fillStyle = '#605850';
                ctx.fillRect(px - 2.5, py - ph - 1.5, 5, 2);
                ctx.fillStyle = '#504840';
                ctx.fillRect(px - 2.5, py - 2.5, 5, 2.5);
            }
        }

        // Ground floor windows (arched colonial style)
        if (p > 0.4) {
            for (let i = 0; i < 3; i++) {
                const wx = hw * (0.2 + i * 0.28);
                const wy = h1 * 0.38;
                this._windowL(ctx, sx, baseY, wx, wy, 3.5, 5.5);
                this._windowR(ctx, sx, baseY, wx, wy, 3.5, 5.5);
            }
        }

        // ── White horizontal band between floors ─────────────────────────
        if (p > 0.4) {
            ctx.fillStyle = '#d0c8b0';
            ctx.beginPath();
            ctx.moveTo(sx - hw, baseY - h1 + hd);
            ctx.lineTo(sx, baseY - h1);
            ctx.lineTo(sx, baseY - h1 - 2);
            ctx.lineTo(sx - hw, baseY - h1 + hd - 2);
            ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(sx + hw, baseY - h1 + hd);
            ctx.lineTo(sx, baseY - h1);
            ctx.lineTo(sx, baseY - h1 - 2);
            ctx.lineTo(sx + hw, baseY - h1 + hd - 2);
            ctx.closePath(); ctx.fill();
        }

        // ── Upper floor ───────────────────────────────────────────────────
        const upperY = baseY - h1 - 2;
        const uhw = hw * 0.86, uhd = hd * 0.86;
        this._box(ctx, sx, upperY, uhw, uhd, h2,
            '#f4f0e4', ['#f0e8d8','#e8e0cc'], ['#ddd5c2','#d2c9b8']);

        // Upper floor windows
        if (p > 0.5) {
            for (let i = 0; i < 4; i++) {
                const wx = uhw * (0.12 + i * 0.25);
                const wy = h2 * 0.42;
                this._windowL(ctx, sx, upperY, wx, wy, 3, 5);
                this._windowR(ctx, sx, upperY, wx, wy, 3, 5);
            }
        }

        // Balcony / verandah railing on upper floor
        if (p > 0.55) {
            const railY = upperY - h2 * 0.2;
            ctx.strokeStyle = 'rgba(255,250,235,0.75)';
            ctx.lineWidth = 1;
            // Left face railing line
            ctx.beginPath();
            ctx.moveTo(sx - uhw, railY + uhd); ctx.lineTo(sx, railY); ctx.stroke();
            // Right face railing line
            ctx.beginPath();
            ctx.moveTo(sx + uhw, railY + uhd); ctx.lineTo(sx, railY); ctx.stroke();
            // Balusters — left face
            ctx.strokeStyle = 'rgba(240,235,215,0.5)';
            ctx.lineWidth = 0.5;
            for (let i = 0; i <= 7; i++) {
                const t = i / 7;
                const bx = sx - uhw + uhw * t;
                const by = railY + uhd * t;
                ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - h2 * 0.2); ctx.stroke();
            }
            // Balusters — right face
            for (let i = 0; i <= 7; i++) {
                const t = i / 7;
                const bx = sx + uhw - uhw * t;
                const by = railY + uhd * t;
                ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - h2 * 0.2); ctx.stroke();
            }
        }

        if (p < 0.2) return;

        // ── TRADITIONAL SUNDANESE MULTI-PEAKED ROOF (ITB Joglo style) ────
        // Base roof dimensions (extends beyond building walls — wide overhang)
        const rBaseY = upperY - h2;
        const rHw = uhw + 10;  // wide overhang
        const rHd = uhd + 5;
        const rApex = rBaseY - rHd - 12 * p; // roof apex height

        // Left slope (dark brown)
        ctx.fillStyle = '#6b3e18';
        ctx.beginPath();
        ctx.moveTo(sx, rApex);
        ctx.lineTo(sx, rBaseY + rHd + 2);
        ctx.lineTo(sx - rHw, rBaseY + 2);
        ctx.closePath(); ctx.fill();

        // Right slope (darker — in shadow)
        ctx.fillStyle = '#572f10';
        ctx.beginPath();
        ctx.moveTo(sx, rApex);
        ctx.lineTo(sx, rBaseY + rHd + 2);
        ctx.lineTo(sx + rHw, rBaseY + 2);
        ctx.closePath(); ctx.fill();

        // Front slopes (facing viewer — two visible triangular faces)
        ctx.fillStyle = '#7a4a22';
        ctx.beginPath();
        ctx.moveTo(sx, rApex);
        ctx.lineTo(sx + rHw, rBaseY + 2);
        ctx.lineTo(sx, rBaseY + rHd + 2);
        ctx.lineTo(sx - rHw, rBaseY + 2);
        ctx.closePath(); ctx.fill();

        // Eave edge highlight
        ctx.strokeStyle = '#2e1808'; ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(sx - rHw, rBaseY + 2);
        ctx.lineTo(sx, rBaseY + rHd + 8);
        ctx.lineTo(sx + rHw, rBaseY + 2);
        ctx.stroke();

        // ── Multiple triangular ridge peaks (ITB's defining visual feature) ─
        // 4 sharp fins spaced along the ridge, sticking up from the main roof
        if (p > 0.3) {
            const peakCount = 4;
            // Ridge line runs in the X isometric direction (upper-left to lower-right)
            // Ridge center: (sx, rApex). Spread peaks along this line.
            for (let i = 0; i < peakCount; i++) {
                const t = (i - (peakCount - 1) / 2) / (peakCount - 1) * 2; // -1..+1
                // In isometric, X-axis shift: screen x += 8*t, y += 4*t
                const pkx = sx + 11 * t;
                const pky = rApex + 5.5 * t;  // follow isometric X direction
                const pkh = 8 * p;             // peak height above ridge

                // Left triangular fin face
                ctx.fillStyle = '#8a5028';
                ctx.beginPath();
                ctx.moveTo(pkx, pky - pkh);
                ctx.lineTo(pkx - 5, pky + 2);
                ctx.lineTo(pkx + 5, pky + 2);
                ctx.closePath(); ctx.fill();

                // Right fin face (darker)
                ctx.fillStyle = '#6a3818';
                ctx.beginPath();
                ctx.moveTo(pkx, pky - pkh);
                ctx.lineTo(pkx + 5, pky + 2);
                ctx.lineTo(pkx + 7, pky - 1);
                ctx.closePath(); ctx.fill();

                // Gold/copper ornament tip
                ctx.fillStyle = '#c08028';
                ctx.beginPath();
                ctx.arc(pkx, pky - pkh - 1.5, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }

            // Ridge spine connecting all peaks
            ctx.strokeStyle = '#4a2810'; ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx - 11 * 1 - 5, rApex + 5.5 + 2);
            ctx.lineTo(sx + 11 * 1 + 5, rApex - 5.5 + 2);
            ctx.stroke();
        }

        // Entrance canopy / portico (prominent front entrance)
        if (p > 0.6) {
            const entX = sx - 8, entY = baseY + hd * 0.3;
            // Canopy roof (mini version of main roof)
            ctx.fillStyle = '#7a4a22';
            ctx.beginPath();
            ctx.moveTo(entX, entY - h1 - 4);
            ctx.lineTo(entX + 12, entY - h1 + 2);
            ctx.lineTo(entX, entY - h1 + 6);
            ctx.lineTo(entX - 12, entY - h1 + 2);
            ctx.closePath(); ctx.fill();
            // Entrance columns
            ctx.fillStyle = '#4a4538';
            ctx.fillRect(entX - 6, entY - h1 + 6, 2.5, h1 * 0.7);
            ctx.fillRect(entX + 3, entY - h1 + 3, 2.5, h1 * 0.7);
            // Name sign
            ctx.fillStyle = 'rgba(255,245,220,0.85)';
            ctx.font = 'bold 3px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('UNIVERSITAS', entX - 3, entY - h1 * 0.35);
        }
    },

    // --- MALL / PUSAT PERBELANJAAN (3x3) ---
    _drawMall(ctx, sx, sy, p) {
        const hw = 50, hd = 25, h = 38 * p;
        const anim = this.animTime || 0;
        this._shadow(ctx, sx, sy, hw + 6, hd + 6);

        // --- Parking lot ground ---
        ctx.fillStyle = '#888880';
        this._tileDiamond(ctx, sx, sy, 108, 54);
        ctx.fill();
        // Parking lines
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 0.4;
        for (let pl = 0; pl < 5; pl++) {
            ctx.beginPath();
            ctx.moveTo(sx - 45 + pl * 10, sy + 20 - pl * 2);
            ctx.lineTo(sx - 40 + pl * 10, sy + 16 - pl * 2);
            ctx.stroke();
        }

        // --- Foundation / podium level ---
        this._box(ctx, sx, sy, hw + 4, hd + 2, 4,
            '#c8c0b0', ['#b8b0a0','#a8a090'], ['#989080','#888070']);

        // --- Main building (3 floors appearance) ---
        // Left wall
        const lwGrad = ctx.createLinearGradient(sx - hw, sy - 4, sx - hw, sy - 4 - h);
        lwGrad.addColorStop(0, '#c8c0a8');
        lwGrad.addColorStop(0.5, '#d8d0b8');
        lwGrad.addColorStop(1, '#e0d8c0');
        ctx.fillStyle = lwGrad;
        ctx.beginPath();
        ctx.moveTo(sx - hw, sy - 4);
        ctx.lineTo(sx, sy - hd - 4);
        ctx.lineTo(sx, sy - hd - 4 - h);
        ctx.lineTo(sx - hw, sy - 4 - h);
        ctx.closePath();
        ctx.fill();
        // Right wall
        const rwGrad = ctx.createLinearGradient(sx + hw, sy - 4, sx + hw, sy - 4 - h);
        rwGrad.addColorStop(0, '#b0a890');
        rwGrad.addColorStop(0.5, '#c0b8a0');
        rwGrad.addColorStop(1, '#c8c0a8');
        ctx.fillStyle = rwGrad;
        ctx.beginPath();
        ctx.moveTo(sx + hw, sy - 4);
        ctx.lineTo(sx, sy - hd - 4);
        ctx.lineTo(sx, sy - hd - 4 - h);
        ctx.lineTo(sx + hw, sy - 4 - h);
        ctx.closePath();
        ctx.fill();
        // Top
        ctx.fillStyle = '#d8d0c0';
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd - 4 - h); ctx.lineTo(sx + hw, sy - 4 - h);
        ctx.lineTo(sx, sy + hd - 4 - h); ctx.lineTo(sx - hw, sy - 4 - h);
        ctx.closePath();
        ctx.fill();

        // --- Floor separation lines ---
        if (p > 0.3) {
            ctx.strokeStyle = 'rgba(0,0,0,0.06)';
            ctx.lineWidth = 0.5;
            for (let fl = 1; fl <= 3; fl++) {
                const flY = sy - 4 - h * (fl / 4);
                // Left
                ctx.beginPath();
                ctx.moveTo(sx - hw, flY + hd * (fl / 4));
                ctx.lineTo(sx, flY - hd + hd * (fl / 4));
                ctx.stroke();
                // Right
                ctx.beginPath();
                ctx.moveTo(sx + hw, flY + hd * (fl / 4));
                ctx.lineTo(sx, flY - hd + hd * (fl / 4));
                ctx.stroke();
            }
        }

        // --- Glass windows (storefront style, multiple floors) ---
        if (p > 0.4) {
            // Left wall windows (3 rows × 5 cols)
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 5; col++) {
                    const t = (col + 0.5) / 5.5;
                    const wx = sx - hw + hw * (0.05 + t * 0.9);
                    const wy = sy - 4 - hd * (0.05 + t * 0.9);
                    const winY = wy - h * (0.15 + row * 0.28);
                    // Window frame
                    ctx.fillStyle = '#888880';
                    ctx.fillRect(wx - 2.5, winY, 5, 5.5);
                    // Glass (blue tint, reflective)
                    const glassAlpha = 0.3 + Math.sin(anim * 0.3 + col * 0.5 + row) * 0.05;
                    ctx.fillStyle = `rgba(140,190,220,${glassAlpha})`;
                    ctx.fillRect(wx - 2, winY + 0.5, 4, 4.5);
                    // Cross divider
                    ctx.strokeStyle = '#a0a098';
                    ctx.lineWidth = 0.2;
                    ctx.beginPath();
                    ctx.moveTo(wx, winY + 0.5); ctx.lineTo(wx, winY + 5);
                    ctx.moveTo(wx - 2, winY + 3); ctx.lineTo(wx + 2, winY + 3);
                    ctx.stroke();
                }
            }
            // Right wall windows (3 rows × 4 cols)
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 4; col++) {
                    const t = (col + 0.5) / 4.5;
                    const wx = sx + hw - hw * (0.05 + t * 0.85);
                    const wy = sy - 4 - hd * (0.05 + t * 0.85);
                    const winY = wy - h * (0.15 + row * 0.28);
                    ctx.fillStyle = '#808078';
                    ctx.fillRect(wx - 2.5, winY, 5, 5.5);
                    const glassAlpha = 0.25 + Math.sin(anim * 0.3 + col * 0.7 + row) * 0.05;
                    ctx.fillStyle = `rgba(130,180,210,${glassAlpha})`;
                    ctx.fillRect(wx - 2, winY + 0.5, 4, 4.5);
                    ctx.strokeStyle = '#909088';
                    ctx.lineWidth = 0.2;
                    ctx.beginPath();
                    ctx.moveTo(wx, winY + 0.5); ctx.lineTo(wx, winY + 5);
                    ctx.moveTo(wx - 2, winY + 3); ctx.lineTo(wx + 2, winY + 3);
                    ctx.stroke();
                }
            }
        }

        // --- Main entrance (glass doors, canopy) ---
        if (p > 0.5) {
            const entX = sx - 2, entY = sy - 4 - hd;
            // Canopy
            ctx.fillStyle = '#c8a040';
            ctx.beginPath();
            ctx.moveTo(entX - 10, entY - 12);
            ctx.lineTo(entX + 10, entY - 12);
            ctx.lineTo(entX + 12, entY - 10);
            ctx.lineTo(entX - 12, entY - 10);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#b89030';
            ctx.beginPath();
            ctx.moveTo(entX - 12, entY - 10);
            ctx.lineTo(entX + 12, entY - 10);
            ctx.lineTo(entX + 12, entY - 9);
            ctx.lineTo(entX - 12, entY - 9);
            ctx.closePath();
            ctx.fill();
            // Glass revolving door
            ctx.fillStyle = '#505050';
            ctx.fillRect(entX - 6, entY - 10, 12, 10);
            ctx.fillStyle = 'rgba(140,200,230,0.35)';
            ctx.fillRect(entX - 5.5, entY - 9.5, 5, 9);
            ctx.fillRect(entX + 0.5, entY - 9.5, 5, 9);
            // Door divider
            ctx.fillStyle = '#404040';
            ctx.fillRect(entX - 0.3, entY - 10, 0.6, 10);
        }

        // --- Rooftop details ---
        if (p >= 1) {
            // HVAC units
            ctx.fillStyle = '#a0a098';
            ctx.fillRect(sx - 8, sy - hd - 4 - h - 3, 6, 3);
            ctx.fillRect(sx + 4, sy - hd - 4 - h - 2.5, 5, 2.5);
            // Fan grill
            ctx.fillStyle = '#888880';
            ctx.beginPath();
            ctx.arc(sx - 5, sy - hd - 4 - h - 3, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.lineWidth = 0.3;
            ctx.beginPath();
            ctx.moveTo(sx - 7, sy - hd - 4 - h - 3); ctx.lineTo(sx - 3, sy - hd - 4 - h - 3);
            ctx.moveTo(sx - 5, sy - hd - 4 - h - 5); ctx.lineTo(sx - 5, sy - hd - 4 - h - 1);
            ctx.stroke();

            // Roof parapet
            ctx.strokeStyle = 'rgba(160,150,130,0.3)';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(sx - hw + 1, sy - 4 - h - 1);
            ctx.lineTo(sx, sy - hd - 4 - h - 1);
            ctx.lineTo(sx + hw - 1, sy - 4 - h - 1);
            ctx.stroke();
        }

        // --- Sign "MALL" with glow ---
        if (p >= 1) {
            const signY = sy - 4 - h + 5;
            // Sign background
            ctx.fillStyle = 'rgba(200,160,60,0.8)';
            ctx.fillRect(sx - hw * 0.4, signY - hd * 0.3, hw * 0.75, 5);
            // Glow effect
            ctx.fillStyle = `rgba(255,220,100,${0.08 + Math.sin(anim * 0.5) * 0.03})`;
            ctx.fillRect(sx - hw * 0.45, signY - hd * 0.3 - 1, hw * 0.85, 7);
            // Text
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 4px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('MALL', sx - hw * 0.03, signY - hd * 0.3 + 4);
        }

        // --- People at entrance ---
        if (p >= 1) {
            const peoplePosns = [
                [sx - 8, sy - hd + 6, '#e04848'],
                [sx + 3, sy - hd + 4, '#4888c8'],
                [sx - 3, sy - hd + 8, '#48a858'],
            ];
            for (const [px, py, col] of peoplePosns) {
                const bob = Math.sin(anim * 1.2 + px * 0.1) * 0.3;
                // Body
                ctx.fillStyle = col;
                ctx.fillRect(px - 1, py - 3 + bob, 2, 3);
                // Head
                ctx.fillStyle = '#f0d0a0';
                ctx.beginPath();
                ctx.arc(px, py - 4.2 + bob, 1.2, 0, Math.PI * 2);
                ctx.fill();
            }

            // Shopping bags near entrance
            ctx.fillStyle = 'rgba(200,50,50,0.4)';
            ctx.fillRect(sx + 8, sy - hd + 5, 2, 2.5);
            ctx.fillStyle = 'rgba(50,100,200,0.4)';
            ctx.fillRect(sx + 10.5, sy - hd + 5.5, 2, 2);

            // Parked cars in lot
            const carColors = ['#c83030', '#3060b0', '#e8e0d0', '#404040'];
            for (let ci = 0; ci < 4; ci++) {
                const cx = sx - 40 + ci * 12;
                const cy = sy + 16 - ci * 1.5;
                ctx.fillStyle = carColors[ci];
                ctx.fillRect(cx - 3, cy - 1.5, 6, 3);
                ctx.fillStyle = 'rgba(160,200,220,0.3)';
                ctx.fillRect(cx - 1, cy - 2, 3, 1);
                ctx.fillStyle = '#282828';
                ctx.beginPath();
                ctx.arc(cx - 2, cy + 1.8, 0.8, 0, Math.PI * 2);
                ctx.arc(cx + 2, cy + 1.8, 0.8, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    },

    // --- JEMBATAN (Bridge) ---
    // Helper: check if tile has road or bridge
    _hasRoadOrBridge(tx, ty) {
        const size = GameData.MAP_SIZE;
        if (tx < 0 || ty < 0 || tx >= size || ty >= size) return false;
        const tile = Game.map.tiles[ty * size + tx];
        if (tile === GameData.TILE.ROAD || tile === GameData.TILE.BRIDGE) return true;
        const b = Game.map.buildings[ty * size + tx];
        if (b && (b.id === 'jembatan' || b.id === 'jalan')) return true;
        return false;
    },

    _drawJembatan(ctx, sx, sy, p, tileX, tileY) {
        // Check each neighbor individually for conditional arch/railing rendering
        const hasLeft  = this._hasRoadOrBridge(tileX - 1, tileY);
        const hasRight = this._hasRoadOrBridge(tileX + 1, tileY);
        const hasUp    = this._hasRoadOrBridge(tileX, tileY - 1);
        const hasDown  = this._hasRoadOrBridge(tileX, tileY + 1);
        const leftRight = hasLeft || hasRight;
        const upDown    = hasUp   || hasDown;
        const isVert    = upDown && !leftRight;

        // Water underneath (animated shimmer) — full tile diamond
        const wave = Math.sin((this.animTime || 0) * 1.5 + sx * 0.1);
        ctx.fillStyle = `rgba(50,130,200,${0.3 + wave * 0.06})`;
        ctx.beginPath();
        ctx.moveTo(sx, sy - 16);
        ctx.lineTo(sx + 32, sy);
        ctx.lineTo(sx, sy + 16);
        ctx.lineTo(sx - 32, sy);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(80,170,230,0.3)';
        ctx.lineWidth = 0.6;
        for (let i = 0; i < 3; i++) {
            const wt = (this.animTime || 0) * 1.2 + i * 1.5;
            const wy = sy - 5 + i * 5;
            ctx.beginPath();
            ctx.moveTo(sx - 19, wy + Math.sin(wt) * 1.5);
            ctx.quadraticCurveTo(sx, wy + Math.sin(wt + 1) * 2, sx + 19, wy + Math.sin(wt + 2) * 1.5);
            ctx.stroke();
        }

        const deckH = 4 * p;

        if (!isVert) {
            // === HORIZONTAL BRIDGE (grid X axis, tileX-1 ↔ tileX+1) ===
            //
            // In isometric, moving tileX+1 shifts screen by (+32, +16).
            // The shared edge midpoints that MUST be deck endpoints for seamless connection:
            //   left  connecting midpoint: (sx-16, sy-8)
            //   right connecting midpoint: (sx+16, sy+8)
            // Road width perpendicular (Y tile direction offset per 0.5 tile): (-8, +4)
            //
            // Deck corners at tile-surface level (verified: adjacent tiles share these exactly):
            //   LL = (sx- 8, sy-12)  upper-right side, left end
            //   LU = (sx-24, sy- 4)  lower-left  side, left end
            //   RU = (sx+ 8, sy+12)  lower-left  side, right end  ← = adj.tile's LU
            //   RL = (sx+24, sy+ 4)  upper-right side, right end  ← = adj.tile's LL
            const LLx = sx -  8, LLy = sy - 12;
            const LUx = sx - 24, LUy = sy -  4;
            const RUx = sx +  8, RUy = sy + 12;
            const RLx = sx + 24, RLy = sy +  4;
            const lx = sx - 16, ly = sy - 8;   // left connecting center
            const rx = sx + 16, ry = sy + 8;   // right connecting center

            // Stone arch / abutment — only at OPEN ends (no neighbour)
            ctx.fillStyle = '#787068';
            if (!hasLeft) {
                ctx.beginPath();
                ctx.moveTo(LUx + 4, LUy + 3);
                ctx.quadraticCurveTo(lx - 5, ly + 10, LLx + 4, LLy + 5);
                ctx.lineTo(LLx + 4, LLy - 1);
                ctx.lineTo(LUx + 4, LUy - 3);
                ctx.closePath();
                ctx.fill();
            }
            if (!hasRight) {
                ctx.beginPath();
                ctx.moveTo(RUx - 4, RUy + 3);
                ctx.quadraticCurveTo(rx + 5, ry + 10, RLx - 4, RLy + 5);
                ctx.lineTo(RLx - 4, RLy - 1);
                ctx.lineTo(RUx - 4, RUy - 3);
                ctx.closePath();
                ctx.fill();
            }

            // Upper-right face (LL→RL side — drawn behind south face)
            ctx.fillStyle = '#807870';
            ctx.beginPath();
            ctx.moveTo(LLx, LLy);
            ctx.lineTo(RLx, RLy);
            ctx.lineTo(RLx, RLy - deckH);
            ctx.lineTo(LLx, LLy - deckH);
            ctx.closePath();
            ctx.fill();

            // Lower-left face / south face (LU→RU — main visible face)
            ctx.fillStyle = '#908880';
            ctx.beginPath();
            ctx.moveTo(LUx, LUy);
            ctx.lineTo(RUx, RUy);
            ctx.lineTo(RUx, RUy - deckH);
            ctx.lineTo(LUx, LUy - deckH);
            ctx.closePath();
            ctx.fill();

            // Top road surface
            ctx.fillStyle = '#606068';
            ctx.beginPath();
            ctx.moveTo(LLx, LLy - deckH);
            ctx.lineTo(LUx, LUy - deckH);
            ctx.lineTo(RUx, RUy - deckH);
            ctx.lineTo(RLx, RLy - deckH);
            ctx.closePath();
            ctx.fill();

            // Centre dashes
            ctx.strokeStyle = 'rgba(220,200,100,0.5)';
            ctx.lineWidth = 0.8;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(lx, ly - deckH);
            ctx.lineTo(rx, ry - deckH);
            ctx.stroke();
            ctx.setLineDash([]);

            // White edge lines
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(LLx, LLy - deckH);
            ctx.lineTo(RLx, RLy - deckH);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(LUx, LUy - deckH);
            ctx.lineTo(RUx, RUy - deckH);
            ctx.stroke();

            if (p < 0.5) return;

            // Railings
            ctx.fillStyle = '#a09888';
            ctx.strokeStyle = '#b0a898';
            ctx.lineWidth = 1;
            // Upper-right railing (LL→RL)
            for (let i = 0; i < 5; i++) {
                const t = (i + 0.5) / 5;
                ctx.fillRect(LLx + (RLx - LLx) * t - 0.6, LLy + (RLy - LLy) * t - deckH - 5, 1.2, 5);
            }
            ctx.beginPath();
            ctx.moveTo(LLx, LLy - deckH - 4);
            ctx.lineTo(RLx, RLy - deckH - 4);
            ctx.stroke();
            // Lower-left railing (LU→RU)
            for (let i = 0; i < 5; i++) {
                const t = (i + 0.5) / 5;
                ctx.fillRect(LUx + (RUx - LUx) * t - 0.6, LUy + (RUy - LUy) * t - deckH - 5, 1.2, 5);
            }
            ctx.beginPath();
            ctx.moveTo(LUx, LUy - deckH - 4);
            ctx.lineTo(RUx, RUy - deckH - 4);
            ctx.stroke();

        } else {
            // === VERTICAL BRIDGE (grid Y axis, tileY-1 ↔ tileY+1) ===
            //
            // Moving tileY+1 shifts screen by (-32, +16).
            // Connecting midpoints:
            //   up   connecting midpoint: (sx+16, sy-8)
            //   down connecting midpoint: (sx-16, sy+8)
            // Road width perpendicular (X tile direction offset per 0.5 tile): (+8, +4)
            //
            // Deck corners (adjacent tiles share these exactly):
            //   UL = (sx+ 8, sy-12)  left  side, up end
            //   UR = (sx+24, sy- 4)  right side, up end
            //   DR = (sx- 8, sy+12)  right side, down end  ← = adj.tile's UR
            //   DL = (sx-24, sy+ 4)  left  side, down end  ← = adj.tile's UL
            const ULx = sx +  8, ULy = sy - 12;
            const URx = sx + 24, URy = sy -  4;
            const DRx = sx -  8, DRy = sy + 12;
            const DLx = sx - 24, DLy = sy +  4;
            const ux = sx + 16, uy = sy - 8;   // up connecting center
            const dx = sx - 16, dy = sy + 8;   // down connecting center

            // Stone arch / abutment — only at OPEN ends
            ctx.fillStyle = '#787068';
            if (!hasUp) {
                ctx.beginPath();
                ctx.moveTo(URx - 3, URy + 4);
                ctx.quadraticCurveTo(ux + 10, uy + 5, ULx - 3, ULy + 5);
                ctx.lineTo(ULx - 3, ULy - 1);
                ctx.lineTo(URx - 3, URy - 1);
                ctx.closePath();
                ctx.fill();
            }
            if (!hasDown) {
                ctx.beginPath();
                ctx.moveTo(DRx - 3, DRy + 4);
                ctx.quadraticCurveTo(dx + 10, dy + 5, DLx - 3, DLy + 5);
                ctx.lineTo(DLx - 3, DLy - 1);
                ctx.lineTo(DRx - 3, DRy - 1);
                ctx.closePath();
                ctx.fill();
            }

            // Left face (UL→DL side)
            ctx.fillStyle = '#908880';
            ctx.beginPath();
            ctx.moveTo(ULx, ULy);
            ctx.lineTo(DLx, DLy);
            ctx.lineTo(DLx, DLy - deckH);
            ctx.lineTo(ULx, ULy - deckH);
            ctx.closePath();
            ctx.fill();

            // Right face (UR→DR side — main visible face)
            ctx.fillStyle = '#807870';
            ctx.beginPath();
            ctx.moveTo(URx, URy);
            ctx.lineTo(DRx, DRy);
            ctx.lineTo(DRx, DRy - deckH);
            ctx.lineTo(URx, URy - deckH);
            ctx.closePath();
            ctx.fill();

            // Top road surface
            ctx.fillStyle = '#606068';
            ctx.beginPath();
            ctx.moveTo(ULx, ULy - deckH);
            ctx.lineTo(URx, URy - deckH);
            ctx.lineTo(DRx, DRy - deckH);
            ctx.lineTo(DLx, DLy - deckH);
            ctx.closePath();
            ctx.fill();

            // Centre dashes
            ctx.strokeStyle = 'rgba(220,200,100,0.5)';
            ctx.lineWidth = 0.8;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(ux, uy - deckH);
            ctx.lineTo(dx, dy - deckH);
            ctx.stroke();
            ctx.setLineDash([]);

            // White edge lines
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(ULx, ULy - deckH);
            ctx.lineTo(DLx, DLy - deckH);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(URx, URy - deckH);
            ctx.lineTo(DRx, DRy - deckH);
            ctx.stroke();

            if (p < 0.5) return;

            // Railings
            ctx.fillStyle = '#a09888';
            ctx.strokeStyle = '#b0a898';
            ctx.lineWidth = 1;
            // Left railing (UL→DL)
            for (let i = 0; i < 5; i++) {
                const t = (i + 0.5) / 5;
                ctx.fillRect(ULx + (DLx - ULx) * t - 0.6, ULy + (DLy - ULy) * t - deckH - 5, 1.2, 5);
            }
            ctx.beginPath();
            ctx.moveTo(ULx, ULy - deckH - 4);
            ctx.lineTo(DLx, DLy - deckH - 4);
            ctx.stroke();
            // Right railing (UR→DR)
            for (let i = 0; i < 5; i++) {
                const t = (i + 0.5) / 5;
                ctx.fillRect(URx + (DRx - URx) * t - 0.6, URy + (DRy - URy) * t - deckH - 5, 1.2, 5);
            }
            ctx.beginPath();
            ctx.moveTo(URx, URy - deckH - 4);
            ctx.lineTo(DRx, DRy - deckH - 4);
            ctx.stroke();
        }
    },

    // --- BANDARA (Airport, 4x4) ---
    _drawBandara(ctx, sx, sy, p) {
        const hw = 64, hd = 32;
        this._shadow(ctx, sx, sy, hw + 6, hd + 4);

        // Ground/tarmac base
        ctx.fillStyle = '#58606a';
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd);
        ctx.lineTo(sx + hw, sy);
        ctx.lineTo(sx, sy + hd);
        ctx.lineTo(sx - hw, sy);
        ctx.closePath();
        ctx.fill();

        // Runway (diagonal strip across tarmac)
        ctx.fillStyle = '#404850';
        ctx.beginPath();
        ctx.moveTo(sx - hw * 0.85, sy + hd * 0.15);
        ctx.lineTo(sx - hw * 0.75, sy - hd * 0.05);
        ctx.lineTo(sx + hw * 0.85, sy - hd * 0.15);
        ctx.lineTo(sx + hw * 0.75, sy + hd * 0.05);
        ctx.closePath();
        ctx.fill();

        // Runway markings (center dashed line)
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(sx - hw * 0.78, sy + hd * 0.05);
        ctx.lineTo(sx + hw * 0.78, sy - hd * 0.05);
        ctx.stroke();
        ctx.setLineDash([]);

        // Runway threshold stripes (start)
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        for (let i = 0; i < 4; i++) {
            const rx = sx - hw * 0.72 + i * 3;
            const ry = sy + hd * 0.03 - i * 0.4;
            ctx.fillRect(rx, ry - 1.5, 2, 3);
        }
        // Runway threshold stripes (end)
        for (let i = 0; i < 4; i++) {
            const rx = sx + hw * 0.62 + i * 3;
            const ry = sy - hd * 0.02 - i * 0.4;
            ctx.fillRect(rx, ry - 1.5, 2, 3);
        }

        // Taxiway
        ctx.strokeStyle = '#4a5258';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(sx, sy + hd * 0.0);
        ctx.lineTo(sx + hw * 0.15, sy + hd * 0.4);
        ctx.stroke();
        // Taxiway marking
        ctx.strokeStyle = 'rgba(220,200,60,0.4)';
        ctx.lineWidth = 0.6;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + hw * 0.15, sy + hd * 0.4);
        ctx.stroke();
        ctx.setLineDash([]);

        if (p < 0.3) return;

        // Terminal building (main)
        const tH = 16 * p;
        this._box(ctx, sx + hw * 0.15, sy + hd * 0.45, 22, 12, tH,
            '#d0ccc0', ['#c0b8a8', '#b0a898'], ['#a8a090', '#989080']);

        // Terminal curved roof
        ctx.fillStyle = '#8898a8';
        ctx.beginPath();
        ctx.moveTo(sx + hw * 0.15 - 22, sy + hd * 0.45 - tH);
        ctx.quadraticCurveTo(sx + hw * 0.15, sy + hd * 0.45 - 12 - tH + 2, sx + hw * 0.15 + 22, sy + hd * 0.45 - tH);
        ctx.lineTo(sx + hw * 0.15 + 22, sy + hd * 0.45 - tH + 3);
        ctx.quadraticCurveTo(sx + hw * 0.15, sy + hd * 0.45 - 12 - tH + 5, sx + hw * 0.15 - 22, sy + hd * 0.45 - tH + 3);
        ctx.closePath();
        ctx.fill();

        // Terminal windows (glass facade)
        ctx.fillStyle = 'rgba(140,200,240,0.5)';
        for (let i = 0; i < 6; i++) {
            const wx = sx + hw * 0.15 - 18 + i * 7;
            const wy = sy + hd * 0.45 - tH * 0.7;
            ctx.fillRect(wx, wy, 4, 6);
        }

        // Gate bridges (jetway connectors)
        ctx.strokeStyle = '#b0a8a0';
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 3; i++) {
            const gx = sx + hw * 0.15 - 14 + i * 14;
            const gy = sy + hd * 0.45 - tH * 0.3;
            ctx.beginPath();
            ctx.moveTo(gx, gy);
            ctx.lineTo(gx - 8, gy - 6);
            ctx.stroke();
        }

        if (p < 0.5) return;

        // Control tower
        const ctX = sx - hw * 0.3, ctY = sy - hd * 0.4;
        const ctH = 28 * p;
        // Tower shaft
        ctx.fillStyle = '#c8c8c8';
        ctx.fillRect(ctX - 2, ctY - ctH, 4, ctH);
        // Tower cab (octagonal top)
        ctx.fillStyle = '#90b0c0';
        ctx.beginPath();
        ctx.moveTo(ctX - 7, ctY - ctH);
        ctx.lineTo(ctX - 7, ctY - ctH - 7);
        ctx.lineTo(ctX + 7, ctY - ctH - 7);
        ctx.lineTo(ctX + 7, ctY - ctH);
        ctx.closePath();
        ctx.fill();
        // Cab windows (wrap-around glass)
        ctx.fillStyle = 'rgba(100,180,220,0.7)';
        ctx.fillRect(ctX - 6.5, ctY - ctH - 6, 13, 5);
        // Cab roof
        ctx.fillStyle = '#707880';
        ctx.fillRect(ctX - 8, ctY - ctH - 8, 16, 2);
        // Antenna
        ctx.strokeStyle = '#a0a0a0';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(ctX, ctY - ctH - 8);
        ctx.lineTo(ctX, ctY - ctH - 16);
        ctx.stroke();
        // Blinking light
        const blink = Math.sin((this.animTime || 0) * 4) > 0;
        if (blink) {
            ctx.fillStyle = 'rgba(255,60,60,0.8)';
            ctx.beginPath();
            ctx.arc(ctX, ctY - ctH - 16, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        if (p < 0.7) return;

        // Parked airplane
        const planeX = sx - hw * 0.3, planeY = sy + hd * 0.15;
        // Fuselage
        ctx.fillStyle = '#e8e8f0';
        ctx.beginPath();
        ctx.ellipse(planeX, planeY, 12, 3, -0.15, 0, Math.PI * 2);
        ctx.fill();
        // Wings
        ctx.fillStyle = '#d0d0d8';
        ctx.beginPath();
        ctx.moveTo(planeX - 2, planeY);
        ctx.lineTo(planeX - 2, planeY - 10);
        ctx.lineTo(planeX + 2, planeY - 10);
        ctx.lineTo(planeX + 2, planeY);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(planeX - 2, planeY);
        ctx.lineTo(planeX - 2, planeY + 10);
        ctx.lineTo(planeX + 2, planeY + 10);
        ctx.lineTo(planeX + 2, planeY);
        ctx.closePath();
        ctx.fill();
        // Tail
        ctx.fillStyle = '#2060c0';
        ctx.beginPath();
        ctx.moveTo(planeX + 10, planeY);
        ctx.lineTo(planeX + 13, planeY - 5);
        ctx.lineTo(planeX + 14, planeY);
        ctx.closePath();
        ctx.fill();
        // Cockpit windows
        ctx.fillStyle = 'rgba(100,180,220,0.6)';
        ctx.beginPath();
        ctx.ellipse(planeX - 10, planeY + 0.5, 2.5, 2, -0.15, 0, Math.PI * 2);
        ctx.fill();

        // Windsock
        if (p > 0.9) {
            const wsX = sx + hw * 0.6, wsY = sy - hd * 0.3;
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(wsX, wsY);
            ctx.lineTo(wsX, wsY - 10);
            ctx.stroke();
            const windAnim = Math.sin((this.animTime || 0) * 2) * 2;
            ctx.fillStyle = '#e06020';
            ctx.beginPath();
            ctx.moveTo(wsX, wsY - 10);
            ctx.lineTo(wsX + 6 + windAnim, wsY - 9);
            ctx.lineTo(wsX + 5 + windAnim, wsY - 7);
            ctx.lineTo(wsX, wsY - 8);
            ctx.closePath();
            ctx.fill();
        }
    },

    // --- JALAN TOL (Highway, 3x3) — flat road, NOT a building ---
    _drawTol(ctx, sx, sy, p) {
        const hw = 50, hd = 25;

        // Green shoulder/grass under the road
        ctx.fillStyle = '#5a8a48';
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd);
        ctx.lineTo(sx + hw, sy);
        ctx.lineTo(sx, sy + hd);
        ctx.lineTo(sx - hw, sy);
        ctx.closePath();
        ctx.fill();

        // Asphalt road surface (wide, fills most of tile)
        ctx.fillStyle = '#484f58';
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd * 0.85);
        ctx.lineTo(sx + hw * 0.9, sy);
        ctx.lineTo(sx, sy + hd * 0.85);
        ctx.lineTo(sx - hw * 0.9, sy);
        ctx.closePath();
        ctx.fill();

        // Slightly darker asphalt lanes
        ctx.fillStyle = '#424950';
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd * 0.45);
        ctx.lineTo(sx + hw * 0.45, sy);
        ctx.lineTo(sx, sy + hd * 0.45);
        ctx.lineTo(sx - hw * 0.45, sy);
        ctx.closePath();
        ctx.fill();

        // White edge lines (solid)
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1;
        // Left edge
        ctx.beginPath();
        ctx.moveTo(sx - hw * 0.88, sy + hd * 0.04);
        ctx.lineTo(sx + hw * 0.04, sy - hd * 0.88);
        ctx.stroke();
        // Right edge
        ctx.beginPath();
        ctx.moveTo(sx - hw * 0.04, sy + hd * 0.88);
        ctx.lineTo(sx + hw * 0.88, sy - hd * 0.04);
        ctx.stroke();

        // Yellow center dashed line (divider)
        ctx.strokeStyle = 'rgba(240,200,60,0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(sx - hw * 0.44, sy + hd * 0.44);
        ctx.lineTo(sx + hw * 0.44, sy - hd * 0.44);
        ctx.stroke();
        ctx.setLineDash([]);

        // White lane dashes (2 lanes each side)
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 0.6;
        ctx.setLineDash([3, 5]);
        // Lane 1
        ctx.beginPath();
        ctx.moveTo(sx - hw * 0.66, sy + hd * 0.24);
        ctx.lineTo(sx + hw * 0.24, sy - hd * 0.66);
        ctx.stroke();
        // Lane 2
        ctx.beginPath();
        ctx.moveTo(sx - hw * 0.24, sy + hd * 0.66);
        ctx.lineTo(sx + hw * 0.66, sy - hd * 0.24);
        ctx.stroke();
        ctx.setLineDash([]);

        if (p < 0.4) return;

        // Metal road barriers (jersey barriers along edges)
        ctx.fillStyle = '#b0b0b0';
        for (let i = 0; i < 5; i++) {
            const t = (i + 0.5) / 5;
            // Left barrier
            const lx = sx - hw * 0.88 * (1 - t) + hw * 0.04 * t;
            const ly = sy + hd * 0.04 * (1 - t) - hd * 0.88 * t;
            ctx.fillRect(lx - 1, ly - 2, 3, 2.5);
            // Right barrier
            const rx = sx - hw * 0.04 * (1 - t) + hw * 0.88 * t;
            const ry = sy + hd * 0.88 * (1 - t) - hd * 0.04 * t;
            ctx.fillRect(rx - 1, ry - 2, 3, 2.5);
        }

        if (p < 0.6) return;

        // Toll gate area (near one end)
        const gateX = sx - hw * 0.25, gateY = sy + hd * 0.25;
        // Gate canopy (wide roof spanning lanes)
        ctx.fillStyle = '#2858a0';
        ctx.beginPath();
        ctx.moveTo(gateX - 18, gateY + 6);
        ctx.lineTo(gateX, gateY - 6);
        ctx.lineTo(gateX + 18, gateY + 6);
        ctx.lineTo(gateX + 18, gateY + 8);
        ctx.lineTo(gateX, gateY - 4);
        ctx.lineTo(gateX - 18, gateY + 8);
        ctx.closePath();
        ctx.fill();
        // Canopy underside
        ctx.fillStyle = '#1848a0';
        ctx.beginPath();
        ctx.moveTo(gateX - 18, gateY + 8);
        ctx.lineTo(gateX, gateY - 4);
        ctx.lineTo(gateX + 18, gateY + 8);
        ctx.lineTo(gateX + 18, gateY + 9);
        ctx.lineTo(gateX, gateY - 3);
        ctx.lineTo(gateX - 18, gateY + 9);
        ctx.closePath();
        ctx.fill();
        // Support pillars
        ctx.fillStyle = '#c0c0c0';
        ctx.fillRect(gateX - 16, gateY + 6, 2, 6);
        ctx.fillRect(gateX + 14, gateY + 6, 2, 6);
        ctx.fillRect(gateX - 1, gateY - 5, 2, 6);
        // "TOL" sign on canopy
        ctx.fillStyle = '#1040a0';
        ctx.fillRect(gateX - 6, gateY - 1, 12, 4);
        ctx.fillStyle = '#f8f8f8';
        ctx.font = 'bold 3px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TOL', gateX, gateY + 2);

        // Barrier arms (per lane)
        if (p > 0.7) {
            const armOpen = Math.sin((this.animTime || 0) * 0.5) > 0.3;
            for (let lane = 0; lane < 3; lane++) {
                const ax = gateX - 10 + lane * 10;
                const ay = gateY + 3 + lane * 2;
                ctx.save();
                ctx.translate(ax, ay);
                ctx.rotate(armOpen ? -0.8 : 0);
                ctx.fillStyle = '#e04020';
                ctx.fillRect(0, -0.6, 10, 1.2);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(2, -0.6, 1.5, 1.2);
                ctx.fillRect(6, -0.6, 1.5, 1.2);
                ctx.restore();
            }
        }

        // Cars moving on road
        if (p > 0.8) {
            const cars = [
                { t: 0.7, lane: 0.3, col: '#d04040' },
                { t: 0.4, lane: 0.65, col: '#f0f0f0' },
                { t: 0.85, lane: 0.7, col: '#3060c0' },
            ];
            for (const car of cars) {
                const cx = sx + hw * (car.t - 0.5) * 1.4;
                const cy = sy + hd * (car.t - 0.5) * -1.1 + (car.lane - 0.5) * hd * 0.8;
                // Car body
                ctx.fillStyle = car.col;
                ctx.beginPath();
                ctx.ellipse(cx, cy, 4, 2, -0.46, 0, Math.PI * 2);
                ctx.fill();
                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.1)';
                ctx.beginPath();
                ctx.ellipse(cx + 1, cy + 1.5, 4, 1, -0.46, 0, Math.PI * 2);
                ctx.fill();
                // Windshield
                ctx.fillStyle = 'rgba(180,220,255,0.5)';
                ctx.beginPath();
                ctx.ellipse(cx - 2, cy - 0.3, 1.5, 1, -0.46, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Green sign board (overhead)
        if (p >= 1) {
            ctx.fillStyle = '#1a6030';
            ctx.fillRect(sx + hw * 0.15, sy - hd * 0.55, 20, 8);
            ctx.strokeStyle = '#f0f0f0';
            ctx.lineWidth = 0.4;
            ctx.strokeRect(sx + hw * 0.15 + 1, sy - hd * 0.55 + 1, 18, 6);
            ctx.fillStyle = '#f8f8f8';
            ctx.font = '2.5px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('JAKARTA →', sx + hw * 0.15 + 10, sy - hd * 0.55 + 5);
        }
    },

    // --- INSTALASI AIR BERSIH (PDAM Water Treatment, 2x2) — world-class ---
    _drawInstalasi(ctx, sx, sy, p) {
        const hw = 36, hd = 18;
        const anim = this.animTime || 0;
        this._shadow(ctx, sx, sy, hw + 6, hd + 6);

        // ── Concrete compound floor ───────────────────────────────────────
        ctx.fillStyle = '#b8b8b0';
        this._tileDiamond(ctx, sx, sy, 78, 39);
        ctx.fill();
        // Concrete panel lines
        ctx.strokeStyle = 'rgba(150,148,140,0.35)'; ctx.lineWidth = 0.4;
        for (let g = 0; g < 6; g++) {
            const gx2 = sx - 30 + g * 12;
            ctx.beginPath(); ctx.moveTo(gx2, sy - 6); ctx.lineTo(gx2 + 6, sy + 8); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(gx2, sy - 6); ctx.lineTo(gx2 - 6, sy + 8); ctx.stroke();
        }
        // Yellow safety lines near tanks
        ctx.strokeStyle = 'rgba(220,180,0,0.3)'; ctx.lineWidth = 0.6; ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.arc(sx - hw * 0.25, sy + hd * 0.4, 17, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);

        // ── Control building (PDAM office) ────────────────────────────────
        const bX = sx + hw * 0.45, bY = sy - hd * 0.05;
        this._box(ctx, bX, bY, 10, 5, 2, '#c0bab0', ['#b0aaa0','#a09890'], ['#908880','#807878']);
        this._box(ctx, bX, bY - 2, 10, 5, 12 * p,
            '#e8e4dc', ['#d8d4cc','#c8c4bc'], ['#b8b4ac','#a8a4a0']);
        // Office window
        if (p > 0.4) {
            ctx.fillStyle = 'rgba(160,210,240,0.5)';
            ctx.fillRect(bX - 8, bY - 2 - 12 * p * 0.6, 5, 4);
            ctx.strokeStyle = '#a8a090'; ctx.lineWidth = 0.5;
            ctx.strokeRect(bX - 8, bY - 2 - 12 * p * 0.6, 5, 4);
            // Cross bar
            ctx.beginPath(); ctx.moveTo(bX - 5.5, bY - 2 - 12 * p * 0.6); ctx.lineTo(bX - 5.5, bY - 2 - 12 * p * 0.6 + 4); ctx.stroke();
        }
        // Office door
        if (p > 0.5) {
            ctx.fillStyle = '#4a3818'; ctx.fillRect(bX - 2, bY - 2 - 2, 4, 6);
            ctx.fillStyle = 'rgba(160,210,240,0.5)'; ctx.fillRect(bX - 1.5, bY - 2 - 2, 1.7, 5.5);
        }
        // Flat roof
        this._hipRoof(ctx, bX, bY - 2, 10, 5, 12 * p, 3 * p, 1.5,
            '#788090', '#687080', '#88909f');

        // ── Water tower (prominent background feature) ────────────────────
        const twX = sx - hw * 0.55, twY = sy - hd * 0.5;
        const twH = 28 * p;
        if (p > 0.3) {
            // Four lattice legs
            const legPairs = [[-6, twH * 0.85],[-3, twH],[ 6, twH * 0.85],[3, twH]];
            ctx.strokeStyle = '#708090'; ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(twX - 6, twY); ctx.lineTo(twX - 3, twY - twH);
            ctx.moveTo(twX + 6, twY); ctx.lineTo(twX + 3, twY - twH);
            ctx.moveTo(twX - 6, twY); ctx.lineTo(twX + 3, twY - twH);
            ctx.moveTo(twX + 6, twY); ctx.lineTo(twX - 3, twY - twH);
            ctx.stroke();
            // Cross braces
            ctx.lineWidth = 0.6;
            for (let bl = 1; bl <= 3; bl++) {
                const bly = twY - twH * bl * 0.25;
                ctx.beginPath();
                ctx.moveTo(twX - 6 + bl * 0.5, bly + 1); ctx.lineTo(twX + 6 - bl * 0.5, bly - 1);
                ctx.stroke();
            }
            // Tank bowl at top (spherical-cap style)
            const twG = ctx.createLinearGradient(twX - 8, twY - twH - 4, twX + 8, twY - twH - 4);
            twG.addColorStop(0, '#3868a8'); twG.addColorStop(0.4, '#5090c8'); twG.addColorStop(1, '#2858a0');
            ctx.fillStyle = twG;
            ctx.beginPath(); ctx.ellipse(twX, twY - twH, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#70a8d0';
            ctx.beginPath(); ctx.ellipse(twX, twY - twH - 2, 8, 3.5, 0, 0, Math.PI); ctx.fill();
            // Water ripple on tower top
            const twRip = Math.sin(anim * 2) * 0.15;
            ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.ellipse(twX, twY - twH - 1, 5 + twRip * 2, 2 + twRip, 0, 0, Math.PI); ctx.stroke();
            // Ladder
            ctx.strokeStyle = '#404858'; ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(twX + 2.5, twY); ctx.lineTo(twX + 2.5, twY - twH + 1);
            ctx.moveTo(twX + 4.5, twY); ctx.lineTo(twX + 4.5, twY - twH + 1);
            ctx.stroke();
            ctx.lineWidth = 0.3;
            for (let rg = 0; rg < 8; rg++) {
                const ry2 = twY - twH * rg / 8;
                ctx.beginPath(); ctx.moveTo(twX + 2.5, ry2); ctx.lineTo(twX + 4.5, ry2); ctx.stroke();
            }
        }

        // ── Large primary sedimentation tank ─────────────────────────────
        const tankCx = sx - hw * 0.12, tankCy = sy + hd * 0.35;
        const tankR = 15 * p, tankH = 14 * p;
        if (p > 0.1) {
            const tG = ctx.createLinearGradient(tankCx - tankR, tankCy, tankCx + tankR, tankCy);
            tG.addColorStop(0, '#3868a8'); tG.addColorStop(0.5, '#5090cc'); tG.addColorStop(1, '#2858a0');
            ctx.fillStyle = tG;
            ctx.beginPath();
            ctx.ellipse(tankCx, tankCy, tankR, tankR * 0.5, 0, 0, Math.PI);
            ctx.lineTo(tankCx - tankR, tankCy - tankH);
            ctx.ellipse(tankCx, tankCy - tankH, tankR, tankR * 0.5, 0, Math.PI, 0, true);
            ctx.closePath(); ctx.fill();
            // Shiny bands
            ctx.strokeStyle = 'rgba(200,225,245,0.45)'; ctx.lineWidth = 1;
            for (let b = 1; b <= 3; b++) {
                const bY2 = tankCy - tankH * b / 4;
                ctx.beginPath();
                ctx.ellipse(tankCx, bY2, tankR + 0.5, (tankR + 0.5) * 0.5, 0, Math.PI, 0);
                ctx.stroke();
            }
            // Top ellipse
            ctx.fillStyle = '#70a8d8';
            ctx.beginPath(); ctx.ellipse(tankCx, tankCy - tankH, tankR, tankR * 0.5, 0, 0, Math.PI * 2); ctx.fill();
            // Water surface
            ctx.fillStyle = 'rgba(80,160,220,0.65)';
            ctx.beginPath(); ctx.ellipse(tankCx, tankCy - tankH, tankR - 2, (tankR - 2) * 0.5, 0, 0, Math.PI * 2); ctx.fill();
            // Animated concentric ripples
            const ripT = anim * 1.8;
            for (let ri = 0; ri < 3; ri++) {
                const rPhase = (ripT + ri * 2) % 6;
                const rFrac = rPhase / 6;
                ctx.strokeStyle = `rgba(255,255,255,${0.4 - rFrac * 0.35})`;
                ctx.lineWidth = 0.4;
                ctx.beginPath();
                ctx.ellipse(tankCx, tankCy - tankH, (tankR - 3) * rFrac, (tankR - 3) * rFrac * 0.5, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        if (p < 0.5) return;

        // ── Secondary clarifier tank ──────────────────────────────────────
        const sCx = sx + hw * 0.15, sCy = sy + hd * 0.7;
        const sR = 10 * p, sH = 10 * p;
        const sG = ctx.createLinearGradient(sCx - sR, sCy, sCx + sR, sCy);
        sG.addColorStop(0, '#4878a8'); sG.addColorStop(1, '#3060a0');
        ctx.fillStyle = sG;
        ctx.beginPath();
        ctx.ellipse(sCx, sCy, sR, sR * 0.5, 0, 0, Math.PI);
        ctx.lineTo(sCx - sR, sCy - sH);
        ctx.ellipse(sCx, sCy - sH, sR, sR * 0.5, 0, Math.PI, 0, true);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(180,210,240,0.35)'; ctx.lineWidth = 0.7;
        for (let b = 1; b <= 2; b++) {
            ctx.beginPath(); ctx.ellipse(sCx, sCy - sH * b / 3, sR + 0.3, (sR + 0.3) * 0.5, 0, Math.PI, 0); ctx.stroke();
        }
        ctx.fillStyle = '#60a0d0';
        ctx.beginPath(); ctx.ellipse(sCx, sCy - sH, sR, sR * 0.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(80,160,220,0.6)';
        ctx.beginPath(); ctx.ellipse(sCx, sCy - sH, sR - 1.5, (sR - 1.5) * 0.5, 0, 0, Math.PI * 2); ctx.fill();

        // ── Pipe network ──────────────────────────────────────────────────
        ctx.strokeStyle = '#708090'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tankCx + tankR - 1, tankCy - tankH * 0.5);
        ctx.lineTo(sCx - sR + 1, sCy - sH * 0.5);
        ctx.stroke();
        // Pipe joints (flanges)
        [tankCx + tankR - 1, sCx - sR + 1].forEach((jx, i) => {
            const jy = i === 0 ? tankCy - tankH * 0.5 : sCy - sH * 0.5;
            ctx.fillStyle = '#909ca8';
            ctx.beginPath(); ctx.arc(jx, jy, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#606878'; ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.arc(jx, jy, 2.5, 0, Math.PI * 2); ctx.stroke();
        });
        // Pipe from tower down
        if (p > 0.7) {
            ctx.strokeStyle = '#607080'; ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(twX, twY - 2);
            ctx.lineTo(twX, tankCy - tankH + 2);
            ctx.lineTo(tankCx - tankR + 2, tankCy - tankH);
            ctx.stroke();
        }

        if (p < 0.7) return;

        // ── Chemical dosing unit ──────────────────────────────────────────
        const dX = sx - hw * 0.55, dY = sy + hd * 0.85;
        ctx.fillStyle = '#e0d8c0'; ctx.fillRect(dX - 4, dY - 8, 8, 8);
        ctx.fillStyle = '#c8c0a8'; ctx.fillRect(dX - 4, dY - 8, 8, 2);
        ctx.fillStyle = '#ffe8a0'; ctx.fillRect(dX - 3, dY - 6.5, 5, 4);
        // Dosing pump
        ctx.fillStyle = '#4888b0';
        ctx.beginPath(); ctx.arc(dX, dY - 10, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#60a0c8';
        ctx.beginPath(); ctx.arc(dX, dY - 10, 2, Math.PI, 0); ctx.fill();

        // ── Worker technician figure ──────────────────────────────────────
        if (p >= 1) {
            const wx2 = sx + hw * 0.35, wy2 = sy + hd * 1.1;
            ctx.fillStyle = '#f5d080';
            ctx.beginPath(); ctx.arc(wx2, wy2 - 6, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#f8a808';
            ctx.fillRect(wx2 - 1.7, wy2 - 4.5, 3.4, 3.5);
            ctx.fillStyle = '#f0c000';
            ctx.fillRect(wx2 - 1.8, wy2 - 7.2, 3.6, 1.2);
            ctx.strokeStyle = '#c07808'; ctx.lineWidth = 0.7;
            ctx.beginPath(); ctx.moveTo(wx2, wy2 - 1); ctx.lineTo(wx2 - 1.8, wy2 + 2.5); ctx.moveTo(wx2, wy2 - 1); ctx.lineTo(wx2 + 1.8, wy2 + 2.5); ctx.stroke();
            // Clipboard in hand
            ctx.fillStyle = '#f0f0f0'; ctx.fillRect(wx2 + 1.5, wy2 - 4, 2, 2.5);
            ctx.strokeStyle = '#808080'; ctx.lineWidth = 0.3; ctx.strokeRect(wx2 + 1.5, wy2 - 4, 2, 2.5);
        }

        // ── PDAM sign ────────────────────────────────────────────────────
        if (p >= 1) {
            ctx.fillStyle = '#1050a0';
            ctx.fillRect(bX - 8, bY - 2 - 12 * p - 4, 16, 7);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 4px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('PDAM', bX, bY - 2 - 12 * p + 0.5);
        }
    },

    // --- RUMAH SAKIT (Hospital, 3x3) — world-class detail ---
    _drawRumahSakit(ctx, sx, sy, p) {
        const hw = 50, hd = 25, h1 = 22 * p, h2 = 18 * p, h3 = 14 * p;
        const anim = this.animTime || 0;
        this._shadow(ctx, sx, sy, hw + 8, hd + 8);

        // ── Compound: paved grounds + green lawn areas ────────────────────
        ctx.fillStyle = '#b8c8a0';
        this._tileDiamond(ctx, sx, sy, 110, 55);
        ctx.fill();
        // Driveway (concrete)
        ctx.fillStyle = '#c8c4bc';
        ctx.beginPath();
        ctx.moveTo(sx - 5, sy + 2); ctx.lineTo(sx + 5, sy + 8);
        ctx.lineTo(sx + 5, sy + 28); ctx.lineTo(sx - 5, sy + 22);
        ctx.closePath(); ctx.fill();
        // Yellow center line
        ctx.strokeStyle = 'rgba(220,180,0,0.5)'; ctx.lineWidth = 0.5; ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.moveTo(sx, sy + 3); ctx.lineTo(sx, sy + 27); ctx.stroke();
        ctx.setLineDash([]);

        // ── Foundation ───────────────────────────────────────────────────
        this._box(ctx, sx, sy, hw + 4, hd + 2, 4,
            '#d0d0d0', ['#c0c0c0','#b0b0b0'], ['#a0a0a0','#909090']);

        // ── Ground floor ──────────────────────────────────────────────────
        const lwG1 = ctx.createLinearGradient(sx - hw, sy - 4, sx - hw, sy - 4 - h1);
        lwG1.addColorStop(0, '#f4f8f8'); lwG1.addColorStop(1, '#ffffff');
        ctx.fillStyle = lwG1;
        ctx.beginPath();
        ctx.moveTo(sx - hw, sy - 4); ctx.lineTo(sx - hw, sy - 4 - h1);
        ctx.lineTo(sx, sy - hd - 4 - h1); ctx.lineTo(sx, sy - hd - 4);
        ctx.closePath(); ctx.fill();
        const rwG1 = ctx.createLinearGradient(sx + hw, sy - 4, sx + hw, sy - 4 - h1);
        rwG1.addColorStop(0, '#dde8e8'); rwG1.addColorStop(1, '#edf4f4');
        ctx.fillStyle = rwG1;
        ctx.beginPath();
        ctx.moveTo(sx + hw, sy - 4); ctx.lineTo(sx + hw, sy - 4 - h1);
        ctx.lineTo(sx, sy - hd - 4 - h1); ctx.lineTo(sx, sy - hd - 4);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f0f8f8';
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd - 4 - h1); ctx.lineTo(sx + hw, sy - 4 - h1);
        ctx.lineTo(sx, sy + hd - 4 - h1); ctx.lineTo(sx - hw, sy - 4 - h1);
        ctx.closePath(); ctx.fill();

        // Floor separator band
        if (p > 0.35) {
            ctx.fillStyle = '#c0d0d0';
            ctx.beginPath();
            ctx.moveTo(sx - hw - 1, sy - 4 - h1); ctx.lineTo(sx, sy - hd - 4 - h1);
            ctx.lineTo(sx, sy - hd - 4 - h1 - 2.5); ctx.lineTo(sx - hw - 1, sy - 4 - h1 - 2.5);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#b0c0c0';
            ctx.beginPath();
            ctx.moveTo(sx + hw + 1, sy - 4 - h1); ctx.lineTo(sx, sy - hd - 4 - h1);
            ctx.lineTo(sx, sy - hd - 4 - h1 - 2.5); ctx.lineTo(sx + hw + 1, sy - 4 - h1 - 2.5);
            ctx.closePath(); ctx.fill();
        }

        // ── Second floor ──────────────────────────────────────────────────
        if (p > 0.4) {
            const y2 = sy - 4 - h1 - 2.5;
            const lwG2 = ctx.createLinearGradient(sx - hw * 0.9, y2, sx - hw * 0.9, y2 - h2);
            lwG2.addColorStop(0, '#eef6f6'); lwG2.addColorStop(1, '#f8fdfd');
            ctx.fillStyle = lwG2;
            ctx.beginPath();
            ctx.moveTo(sx - hw * 0.9, y2); ctx.lineTo(sx - hw * 0.9, y2 - h2);
            ctx.lineTo(sx, sy - hd - 4 - h1 - h2 - 2.5); ctx.lineTo(sx, sy - hd - 4 - h1 - 2.5);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#dce8e8';
            ctx.beginPath();
            ctx.moveTo(sx + hw * 0.9, y2); ctx.lineTo(sx + hw * 0.9, y2 - h2);
            ctx.lineTo(sx, sy - hd - 4 - h1 - h2 - 2.5); ctx.lineTo(sx, sy - hd - 4 - h1 - 2.5);
            ctx.closePath(); ctx.fill();

            // Floor 2 band
            ctx.fillStyle = '#b8ccd0';
            ctx.beginPath();
            ctx.moveTo(sx - hw * 0.9, y2 - h2); ctx.lineTo(sx, sy - hd - 4 - h1 - h2 - 2.5);
            ctx.lineTo(sx, sy - hd - 4 - h1 - h2 - 5); ctx.lineTo(sx - hw * 0.9, y2 - h2 - 2.5);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#a8bcbc';
            ctx.beginPath();
            ctx.moveTo(sx + hw * 0.9, y2 - h2); ctx.lineTo(sx, sy - hd - 4 - h1 - h2 - 2.5);
            ctx.lineTo(sx, sy - hd - 4 - h1 - h2 - 5); ctx.lineTo(sx + hw * 0.9, y2 - h2 - 2.5);
            ctx.closePath(); ctx.fill();
        }

        // ── Third floor (penthouse/helipad level) ─────────────────────────
        if (p > 0.65) {
            const y3 = sy - 4 - h1 - h2 - 5;
            ctx.fillStyle = '#e8f4f4';
            ctx.beginPath();
            ctx.moveTo(sx - hw * 0.55, y3); ctx.lineTo(sx - hw * 0.55, y3 - h3);
            ctx.lineTo(sx, sy - hd - 4 - h1 - h2 - h3 - 5); ctx.lineTo(sx, y3 - hd * 0.55 * 0);
            ctx.lineTo(sx, sy - hd - 4 - h1 - h2 - 5); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#d0e4e4';
            ctx.beginPath();
            ctx.moveTo(sx + hw * 0.55, y3); ctx.lineTo(sx + hw * 0.55, y3 - h3);
            ctx.lineTo(sx, sy - hd - 4 - h1 - h2 - h3 - 5); ctx.lineTo(sx, sy - hd - 4 - h1 - h2 - 5);
            ctx.closePath(); ctx.fill();
            // Helipad on roof
            const hpY = sy - 4 - h1 - h2 - h3 - 6;
            ctx.fillStyle = '#d8d4c8';
            ctx.beginPath(); ctx.ellipse(sx, hpY, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#e8dc40'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.ellipse(sx, hpY, 9, 4.5, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = '#e8dc40'; ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx - 5, hpY); ctx.lineTo(sx + 5, hpY);
            ctx.moveTo(sx - 2.5, hpY - 2.5 + 0.5); ctx.lineTo(sx + 2.5, hpY + 2.5 - 0.5);
            ctx.moveTo(sx - 2.5, hpY + 2.5 - 0.5); ctx.lineTo(sx + 2.5, hpY - 2.5 + 0.5);
            ctx.stroke();
            ctx.fillStyle = '#e8dc40'; ctx.font = 'bold 4px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('H', sx, hpY + 1.5);
        }

        // ── Windows: clean hospital rows ──────────────────────────────────
        if (p > 0.35) {
            const drawHWin = (wX, wY) => {
                ctx.fillStyle = '#3a4848'; ctx.fillRect(wX - 2.5, wY - 5, 5, 5);
                ctx.fillStyle = 'rgba(180,225,240,0.55)'; ctx.fillRect(wX - 2, wY - 4.5, 4.5, 4.5);
                ctx.strokeStyle = 'rgba(80,120,130,0.4)'; ctx.lineWidth = 0.4;
                ctx.beginPath(); ctx.moveTo(wX, wY - 4.5); ctx.lineTo(wX, wY); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(wX - 2, wY - 2.5); ctx.lineTo(wX + 2.5, wY - 2.5); ctx.stroke();
            };
            // Ground floor left
            for (let i = 0; i < 5; i++) {
                const t = (i + 0.5) / 6;
                drawHWin(sx - hw + hw * t, sy - 4 + hd * (t) - h1 * 0.5);
            }
            // Ground floor right
            for (let i = 0; i < 4; i++) {
                const t = (i + 0.5) / 5;
                drawHWin(sx + hw - hw * t, sy - 4 + hd * t - h1 * 0.5);
            }
        }

        // ── Red cross on wall ─────────────────────────────────────────────
        if (p > 0.4) {
            const crX = sx - hw * 0.45, crY = sy - 4 - h1 * 0.72;
            ctx.fillStyle = '#e81c1c';
            ctx.fillRect(crX - 5, crY - 2, 10, 4); ctx.fillRect(crX - 2, crY - 5, 4, 10);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(crX - 4, crY - 1.5, 8, 3); ctx.fillRect(crX - 1.5, crY - 4, 3, 8);
            ctx.fillStyle = '#e81c1c';
            ctx.fillRect(crX - 3, crY - 1, 6, 2); ctx.fillRect(crX - 1, crY - 3, 2, 6);
        }

        // ── Emergency entrance ────────────────────────────────────────────
        if (p > 0.5) {
            const eX = sx - hw * 0.1, eY = sy - 4 - hd * 0.08;
            // Canopy
            ctx.fillStyle = '#e81c1c';
            ctx.beginPath();
            ctx.moveTo(eX - 14, eY - h1 * 0.5); ctx.lineTo(eX + 14, eY - h1 * 0.5 - hd * 0.14);
            ctx.lineTo(eX + 12, eY - h1 * 0.5 - hd * 0.14 - 5);
            ctx.lineTo(eX - 12, eY - h1 * 0.5 - 5);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#c01010';
            ctx.beginPath();
            ctx.moveTo(eX - 14, eY - h1 * 0.5); ctx.lineTo(eX + 14, eY - h1 * 0.5 - hd * 0.14);
            ctx.lineTo(eX + 14, eY - h1 * 0.5 - hd * 0.14 + 1);
            ctx.lineTo(eX - 14, eY - h1 * 0.5 + 1);
            ctx.closePath(); ctx.fill();
            // Canopy support poles
            ctx.fillStyle = '#c0c8c8';
            ctx.fillRect(eX - 11, eY - h1 * 0.5 - 5, 2, h1 * 0.5);
            ctx.fillRect(eX + 9, eY - h1 * 0.5 - hd * 0.12 - 5, 2, h1 * 0.5);
            // Sliding glass entrance
            ctx.fillStyle = '#1a4848'; ctx.fillRect(eX - 10, eY - 13, 20, 13);
            ctx.fillStyle = 'rgba(180,240,240,0.65)'; ctx.fillRect(eX - 9.5, eY - 12.5, 9, 12.5);
            ctx.fillStyle = 'rgba(160,230,230,0.55)'; ctx.fillRect(eX + 0.5, eY - 12.5, 9, 12.5);
            // "IGD" sign
            const blink2 = Math.sin(anim * 3) > 0.3;
            ctx.fillStyle = blink2 ? '#ff2020' : '#cc1010';
            ctx.fillRect(eX - 10, eY - 16, 20, 5);
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 3px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('IGD EMERGENCY', eX, eY - 12.5);
        }

        // ── "RUMAH SAKIT" sign ────────────────────────────────────────────
        if (p >= 1) {
            ctx.fillStyle = '#1a3c78';
            ctx.fillRect(sx - hw * 0.6, sy - 4 - h1 * 0.28, hw * 1.15, 6.5);
            ctx.strokeStyle = '#c0d0e0'; ctx.lineWidth = 0.4;
            ctx.strokeRect(sx - hw * 0.6, sy - 4 - h1 * 0.28, hw * 1.15, 6.5);
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 4px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('RUMAH SAKIT', sx - hw * 0.02, sy - 4 - h1 * 0.28 + 5);
        }

        // ── Ambulance parked at entrance ──────────────────────────────────
        if (p >= 1) {
            const ax = sx + hw * 0.3, ay = sy + hd * 0.4;
            ctx.fillStyle = '#f8f8f8'; ctx.fillRect(ax - 2, ay - 6, 13, 7);
            ctx.fillStyle = '#e8e8e8';
            ctx.beginPath(); ctx.moveTo(ax + 10, ay - 6); ctx.lineTo(ax + 13, ay - 4); ctx.lineTo(ax + 13, ay + 1); ctx.lineTo(ax + 10, ay + 1); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#e01818'; ctx.fillRect(ax - 2, ay - 2, 15, 1.2);
            ctx.fillStyle = '#e01818'; ctx.fillRect(ax + 2, ay - 5.5, 1.5, 4); ctx.fillRect(ax, ay - 4, 5.5, 1.5);
            ctx.fillStyle = 'rgba(160,220,255,0.7)'; ctx.fillRect(ax + 11, ay - 5.5, 1.8, 2.2);
            const blink3 = Math.sin(anim * 6) > 0;
            ctx.fillStyle = blink3 ? '#ff4040' : '#4040ff';
            ctx.fillRect(ax + 1, ay - 7, 2.5, 1);
            ctx.fillStyle = blink3 ? '#4040ff' : '#ff4040';
            ctx.fillRect(ax + 5, ay - 7, 2.5, 1);
            ctx.fillStyle = '#202020';
            ctx.beginPath(); ctx.arc(ax + 1.5, ay + 2, 1.8, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(ax + 9.5, ay + 2, 1.8, 0, Math.PI * 2); ctx.fill();
        }

        // ── Medical staff & patient ────────────────────────────────────────
        if (p >= 1) {
            // Doctor (white coat)
            const dX = sx - hw + 5, dY = sy - 1;
            ctx.fillStyle = '#f5d080'; ctx.beginPath(); ctx.arc(dX, dY - 6, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffff'; ctx.fillRect(dX - 1.5, dY - 4.5, 3, 3.5);
            ctx.strokeStyle = '#c0c0c0'; ctx.lineWidth = 0.7;
            ctx.beginPath(); ctx.moveTo(dX, dY - 1); ctx.lineTo(dX - 1.8, dY + 2.5); ctx.moveTo(dX, dY - 1); ctx.lineTo(dX + 1.8, dY + 2.5); ctx.stroke();
            // Nurse
            const nX = sx - hw + 12, nY = sy + 1;
            ctx.fillStyle = '#f5d080'; ctx.beginPath(); ctx.arc(nX, nY - 6, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#e8f8f8'; ctx.fillRect(nX - 1.5, nY - 4.5, 3, 3.5);
            ctx.fillStyle = '#e81c1c'; ctx.fillRect(nX - 0.5, nY - 7, 1, 0.8); ctx.fillRect(nX - 0.8, nY - 6.6, 1.6, 0.8);
        }

        // ── Garden / trees ────────────────────────────────────────────────
        if (p >= 1) {
            this._treeSmall(ctx, sx - hw - 3, sy - 3, 9, '#4a3010', '#48b038');
            this._treeSmall(ctx, sx + hw + 12, sy - 8, 9, '#3a2808', '#42b830');
            this._treeSmall(ctx, sx - hw + 4, sy + hd + 3, 7, '#4a3010', '#40a030');
        }
    },

    // --- HOTEL (3-star, 2x2) — world-class detail ---
    _drawHotel(ctx, sx, sy, p) {
        const hw = 36, hd = 18, h1 = 24 * p, h2 = 20 * p, h3 = 16 * p;
        const anim = this.animTime || 0;
        this._shadow(ctx, sx, sy, hw + 6, hd + 6);

        // ── Grounds: manicured landscape ─────────────────────────────────
        ctx.fillStyle = '#70b850';
        this._tileDiamond(ctx, sx, sy, 80, 40);
        ctx.fill();
        // Paved driveway
        ctx.fillStyle = '#c8c0b0';
        ctx.beginPath();
        ctx.moveTo(sx - 6, sy + 2); ctx.lineTo(sx + 6, sy + 8);
        ctx.lineTo(sx + 6, sy + 28); ctx.lineTo(sx - 6, sy + 22);
        ctx.closePath(); ctx.fill();
        // Decorative grass strips
        ctx.strokeStyle = '#58a040'; ctx.lineWidth = 0.5;
        for (let g = 0; g < 4; g++) {
            const gx2 = sx - 28 + g * 14;
            ctx.beginPath(); ctx.moveTo(gx2, sy + 8); ctx.quadraticCurveTo(gx2 + 2, sy + 5, gx2 + 4, sy + 8); ctx.stroke();
        }

        // ── Foundation ───────────────────────────────────────────────────
        this._box(ctx, sx, sy, hw + 3, hd + 1.5, 4,
            '#c8c0a8', ['#b8b098','#a8a088'], ['#989078','#888068']);

        // ── Ground floor: lobby + colonnade ──────────────────────────────
        const lwG1 = ctx.createLinearGradient(sx - hw, sy - 4, sx - hw, sy - 4 - h1);
        lwG1.addColorStop(0, '#e8e0cc'); lwG1.addColorStop(1, '#f0e8d8');
        ctx.fillStyle = lwG1;
        ctx.beginPath();
        ctx.moveTo(sx - hw, sy - 4); ctx.lineTo(sx - hw, sy - 4 - h1);
        ctx.lineTo(sx, sy - hd - 4 - h1); ctx.lineTo(sx, sy - hd - 4);
        ctx.closePath(); ctx.fill();
        const rwG1 = ctx.createLinearGradient(sx + hw, sy - 4, sx + hw, sy - 4 - h1);
        rwG1.addColorStop(0, '#d8d0b8'); rwG1.addColorStop(1, '#e0d8c4');
        ctx.fillStyle = rwG1;
        ctx.beginPath();
        ctx.moveTo(sx + hw, sy - 4); ctx.lineTo(sx + hw, sy - 4 - h1);
        ctx.lineTo(sx, sy - hd - 4 - h1); ctx.lineTo(sx, sy - hd - 4);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ece4d0';
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd - 4 - h1); ctx.lineTo(sx + hw, sy - 4 - h1);
        ctx.lineTo(sx, sy + hd - 4 - h1); ctx.lineTo(sx - hw, sy - 4 - h1);
        ctx.closePath(); ctx.fill();

        // Floor bands (ornate horizontal stripes between floors)
        if (p > 0.35) {
            const drawFloorBand = (baseY, yR) => {
                ctx.fillStyle = '#a89060';
                ctx.beginPath();
                ctx.moveTo(sx - hw - 1, baseY); ctx.lineTo(sx, baseY - hd * 1.0);
                ctx.lineTo(sx, baseY - hd * 1.0 - 2); ctx.lineTo(sx - hw - 1, baseY - 2);
                ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#988050';
                ctx.beginPath();
                ctx.moveTo(sx + hw + 1, baseY + yR); ctx.lineTo(sx, baseY);
                ctx.lineTo(sx, baseY - 2); ctx.lineTo(sx + hw + 1, baseY + yR - 2);
                ctx.closePath(); ctx.fill();
            };
            drawFloorBand(sy - 4 - h1, hd);
        }

        // ── Second floor ──────────────────────────────────────────────────
        if (p > 0.4) {
            const y2 = sy - 4 - h1 - 2;
            const lwG2 = ctx.createLinearGradient(sx - hw * 0.88, y2, sx - hw * 0.88, y2 - h2);
            lwG2.addColorStop(0, '#e8e0cc'); lwG2.addColorStop(1, '#f2eada');
            ctx.fillStyle = lwG2;
            ctx.beginPath();
            ctx.moveTo(sx - hw * 0.88, y2); ctx.lineTo(sx - hw * 0.88, y2 - h2);
            ctx.lineTo(sx, sy - hd - 4 - h1 - h2 - 2); ctx.lineTo(sx, sy - hd - 4 - h1 - 2);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#d4ccb4';
            ctx.beginPath();
            ctx.moveTo(sx + hw * 0.88, y2); ctx.lineTo(sx + hw * 0.88, y2 - h2);
            ctx.lineTo(sx, sy - hd - 4 - h1 - h2 - 2); ctx.lineTo(sx, sy - hd - 4 - h1 - 2);
            ctx.closePath(); ctx.fill();
        }

        // ── Third floor ───────────────────────────────────────────────────
        if (p > 0.6) {
            const y3 = sy - 4 - h1 - h2 - 4;
            ctx.fillStyle = '#e4dcc8';
            ctx.beginPath();
            ctx.moveTo(sx - hw * 0.6, y3); ctx.lineTo(sx - hw * 0.6, y3 - h3);
            ctx.lineTo(sx, sy - hd - 4 - h1 - h2 - h3 - 4); ctx.lineTo(sx, y3 - hd * 0.6);
            ctx.lineTo(sx, sy - hd - 4 - h1 - h2 - 4); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#ccc4b0';
            ctx.beginPath();
            ctx.moveTo(sx + hw * 0.6, y3); ctx.lineTo(sx + hw * 0.6, y3 - h3);
            ctx.lineTo(sx, sy - hd - 4 - h1 - h2 - h3 - 4); ctx.lineTo(sx, sy - hd - 4 - h1 - h2 - 4);
            ctx.closePath(); ctx.fill();
        }

        // ── Roof: hip with decorative elements ───────────────────────────
        const roofH = 10 * p;
        const roofBase = sy - 4 - h1 - h2 - h3 - 5;
        this._hipRoof(ctx, sx, roofBase, hw * 0.6, hd * 0.6, h3, roofH, 5,
            '#b09050', '#987838', '#c8a860');
        // Ridge ornament
        ctx.fillStyle = '#d4b060';
        ctx.fillRect(sx - 2, roofBase - hd * 0.6 - h3 - roofH, 4, 3);

        // ── Balconies (floor 2 & 3) ───────────────────────────────────────
        if (p > 0.55) {
            const drawBalcony = (bX, bY, bW) => {
                ctx.fillStyle = '#f0e8d0'; ctx.fillRect(bX - bW, bY, bW * 2, 1.5);
                ctx.strokeStyle = '#c8b878'; ctx.lineWidth = 0.5;
                for (let bl = 0; bl < 5; bl++) {
                    const blX = bX - bW + bl * bW * 0.5;
                    ctx.beginPath(); ctx.moveTo(blX, bY); ctx.lineTo(blX, bY - 4); ctx.stroke();
                }
                ctx.beginPath(); ctx.moveTo(bX - bW, bY - 4); ctx.lineTo(bX + bW, bY - 4); ctx.stroke();
            };
            for (let b = 0; b < 3; b++) {
                const t = (b + 0.5) / 4;
                drawBalcony(sx - hw * 0.88 + hw * 0.88 * t, sy - 4 - h1 - 2 - h2 * 0.7, 5);
            }
        }

        // ── Hotel room windows ────────────────────────────────────────────
        if (p > 0.35) {
            const drawHotelWin = (wX, wY) => {
                ctx.fillStyle = '#3a3020'; ctx.fillRect(wX - 2.5, wY - 6, 5, 6);
                ctx.fillStyle = `rgba(255,240,180,${0.25 + Math.sin(anim + wX) * 0.1})`;
                ctx.fillRect(wX - 2, wY - 5.5, 4.5, 5.5);
                ctx.strokeStyle = '#3a3020'; ctx.lineWidth = 0.35;
                ctx.beginPath(); ctx.moveTo(wX, wY - 5.5); ctx.lineTo(wX, wY); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(wX - 2, wY - 3); ctx.lineTo(wX + 2.5, wY - 3); ctx.stroke();
            };
            for (let i = 0; i < 4; i++) {
                const t = (i + 0.5) / 5;
                drawHotelWin(sx - hw + hw * t, sy - 4 + hd * (t) - h1 * 0.5);
                drawHotelWin(sx + hw - hw * t, sy - 4 + hd * t - h1 * 0.5);
            }
        }

        // ── Lobby entrance (grand portico) ────────────────────────────────
        if (p > 0.5) {
            const pX = sx - 2, pY = sy - 4 - hd * 0.04;
            // Awning/porte-cochère
            ctx.fillStyle = '#8c6820';
            ctx.beginPath();
            ctx.moveTo(pX - 16, pY - h1 * 0.45); ctx.lineTo(pX + 16, pY - h1 * 0.45 - hd * 0.16);
            ctx.lineTo(pX + 13, pY - h1 * 0.45 - hd * 0.16 - 6);
            ctx.lineTo(pX - 13, pY - h1 * 0.45 - 6);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#c8a030';
            ctx.beginPath();
            ctx.moveTo(pX - 16, pY - h1 * 0.45); ctx.lineTo(pX + 16, pY - h1 * 0.45 - hd * 0.16);
            ctx.lineTo(pX + 16, pY - h1 * 0.45 - hd * 0.16 + 1.5); ctx.lineTo(pX - 16, pY - h1 * 0.45 + 1.5);
            ctx.closePath(); ctx.fill();
            // Canopy posts
            for (let po = -1; po <= 1; po += 2) {
                const pox = pX + po * 12;
                ctx.fillStyle = '#d8c888'; ctx.fillRect(pox - 1.2, pY - h1 * 0.5, 2.4, h1 * 0.5);
                ctx.fillStyle = '#a8a060'; ctx.fillRect(pox - 1.8, pY - h1 * 0.5 - 1, 3.6, 2);
                ctx.fillRect(pox - 1.8, pY - 1, 3.6, 2);
            }
            // Revolving door suggestion
            ctx.fillStyle = '#2a2010'; ctx.fillRect(pX - 6, pY - 12, 12, 12);
            ctx.fillStyle = 'rgba(210,240,250,0.5)'; ctx.fillRect(pX - 5.5, pY - 11.5, 5.5, 11.5);
            ctx.fillStyle = 'rgba(200,235,245,0.45)'; ctx.fillRect(pX + 0.5, pY - 11.5, 5, 11.5);
            // Lobby glow
            ctx.fillStyle = `rgba(255,240,180,${0.15 + Math.sin(anim * 0.5) * 0.05})`;
            ctx.fillRect(pX - 5.5, pY - 11.5, 11, 11.5);
        }

        // ── Neon/LED hotel sign ───────────────────────────────────────────
        if (p >= 1) {
            ctx.fillStyle = '#c8a030';
            ctx.fillRect(sx - hw * 0.7, sy - 4 - h1 * 0.28, hw * 1.35, 6);
            ctx.strokeStyle = '#d8b840'; ctx.lineWidth = 0.5;
            ctx.strokeRect(sx - hw * 0.7, sy - 4 - h1 * 0.28, hw * 1.35, 6);
            const hotelGlow = `rgba(60,30,0,${0.7 + Math.sin(anim * 1.5) * 0.1})`;
            ctx.fillStyle = hotelGlow;
            ctx.font = 'bold 4px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('★ HOTEL ★', sx - hw * 0.0, sy - 4 - h1 * 0.28 + 4.5);
        }

        // ── Taxi + car at entrance ────────────────────────────────────────
        if (p >= 1) {
            // Taxi (yellow)
            const tx = sx + hw * 0.3, ty = sy + hd * 0.3;
            ctx.fillStyle = '#f0c820'; ctx.fillRect(tx - 2, ty - 5, 10, 6);
            ctx.fillStyle = '#d0a810';
            ctx.beginPath(); ctx.moveTo(tx + 7, ty - 5); ctx.lineTo(tx + 10, ty - 3); ctx.lineTo(tx + 10, ty + 1); ctx.lineTo(tx + 7, ty + 1); ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(160,220,255,0.7)'; ctx.fillRect(tx + 8, ty - 4.5, 1.8, 2.2);
            ctx.fillStyle = '#202020';
            ctx.beginPath(); ctx.arc(tx + 1.5, ty + 2, 1.8, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(tx + 7, ty + 2, 1.8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath(); ctx.arc(tx + 1.5, ty + 2, 0.8, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(tx + 7, ty + 2, 0.8, 0, Math.PI * 2); ctx.fill();
        }

        // ── Palm trees ────────────────────────────────────────────────────
        if (p >= 1) {
            this._treeSmall(ctx, sx - hw - 2, sy - 6, 11, '#6a4a18', '#50c030');
            this._treeSmall(ctx, sx + hw + 14, sy - 10, 11, '#5a3a10', '#48b828');
            this._treeSmall(ctx, sx + hw + 5, sy + hd - 2, 8, '#5a3a10', '#48b028');
        }
    },

    // --- STASIUN KERETA (Railway Station, 3x3) — Dutch colonial + modern ---
    _drawStasiun(ctx, sx, sy, p) {
        const hw = 50, hd = 25, h = 26 * p;
        const anim = this.animTime || 0;
        this._shadow(ctx, sx, sy, hw + 8, hd + 8);

        // ── Station compound: platforms + tracks ──────────────────────────
        ctx.fillStyle = '#a8a498';
        this._tileDiamond(ctx, sx, sy, 108, 54);
        ctx.fill();
        // Track ballast (grey gravel)
        ctx.fillStyle = '#8a8880';
        ctx.beginPath();
        ctx.moveTo(sx - hw * 0.8, sy + hd * 0.5); ctx.lineTo(sx, sy + hd * 1.2);
        ctx.lineTo(sx + hw * 0.4, sy + hd * 0.85); ctx.lineTo(sx - hw * 0.4, sy + hd * 0.2);
        ctx.closePath(); ctx.fill();
        // Rail lines
        ctx.strokeStyle = '#606060'; ctx.lineWidth = 0.8;
        for (let t2 = -1; t2 <= 1; t2++) {
            const off = t2 * 4;
            ctx.beginPath();
            ctx.moveTo(sx - hw + off, sy + hd * 0.7 - off * 0.3);
            ctx.lineTo(sx + hw + off, sy + off * 0.3);
            ctx.stroke();
        }
        // Rail sleepers
        ctx.strokeStyle = '#4a3a28'; ctx.lineWidth = 1.5;
        for (let sl = 0; sl < 12; sl++) {
            const st = sl / 12;
            const slX = sx - hw + hw * 2 * st;
            const slY = sy + hd * 0.7 - hd * 0.7 * st;
            ctx.beginPath(); ctx.moveTo(slX - 6, slY + 3); ctx.lineTo(slX + 6, slY - 3); ctx.stroke();
        }
        // Platform
        ctx.fillStyle = '#c8c4b8';
        ctx.beginPath();
        ctx.moveTo(sx - hw * 0.7, sy - hd * 0.1); ctx.lineTo(sx, sy + hd * 0.5);
        ctx.lineTo(sx + hw * 0.5, sy + hd * 0.17);
        ctx.lineTo(sx - hw * 0.2, sy - hd * 0.43);
        ctx.closePath(); ctx.fill();
        // Platform yellow edge
        ctx.strokeStyle = '#e8c040'; ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(sx - hw * 0.7, sy - hd * 0.1); ctx.lineTo(sx, sy + hd * 0.5);
        ctx.lineTo(sx + hw * 0.5, sy + hd * 0.17);
        ctx.stroke();

        // ── Foundation ───────────────────────────────────────────────────
        this._box(ctx, sx, sy, hw + 3, hd + 1.5, 4,
            '#c0b8a8', ['#b0a898','#a09888'], ['#908878','#807868']);

        // ── Main station building: Dutch colonial ────────────────────────
        const lwG = ctx.createLinearGradient(sx - hw, sy - 4, sx - hw, sy - 4 - h);
        lwG.addColorStop(0, '#e8e0cc'); lwG.addColorStop(0.6, '#f0e8d8'); lwG.addColorStop(1, '#f8f0e0');
        ctx.fillStyle = lwG;
        ctx.beginPath();
        ctx.moveTo(sx - hw, sy - 4); ctx.lineTo(sx - hw, sy - 4 - h);
        ctx.lineTo(sx, sy - hd - 4 - h); ctx.lineTo(sx, sy - hd - 4);
        ctx.closePath(); ctx.fill();
        const rwG = ctx.createLinearGradient(sx + hw, sy - 4, sx + hw, sy - 4 - h);
        rwG.addColorStop(0, '#d0c8b4'); rwG.addColorStop(1, '#ddd5c1');
        ctx.fillStyle = rwG;
        ctx.beginPath();
        ctx.moveTo(sx + hw, sy - 4); ctx.lineTo(sx + hw, sy - 4 - h);
        ctx.lineTo(sx, sy - hd - 4 - h); ctx.lineTo(sx, sy - hd - 4);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ede5d1';
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd - 4 - h); ctx.lineTo(sx + hw, sy - 4 - h);
        ctx.lineTo(sx, sy + hd - 4 - h); ctx.lineTo(sx - hw, sy - 4 - h);
        ctx.closePath(); ctx.fill();

        // ── Rustication / stone quoins (Dutch colonial) ───────────────────
        if (p > 0.3) {
            ctx.strokeStyle = 'rgba(160,150,120,0.3)'; ctx.lineWidth = 0.5;
            for (let r = 1; r <= 4; r++) {
                const ry = sy - 4 - h * r / 5;
                ctx.beginPath();
                ctx.moveTo(sx - hw, ry + hd * r / 5); ctx.lineTo(sx, ry); ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(sx + hw, ry + hd * r / 5); ctx.lineTo(sx, ry); ctx.stroke();
            }
        }

        // ── Dutch gable/hip roof (station style) ─────────────────────────
        this._hipRoof(ctx, sx, sy - 4, hw, hd, h, 14 * p, 7,
            '#6a6858', '#5a5848', '#7a7868');
        // Roof ridge cap
        ctx.fillStyle = '#888878'; ctx.fillRect(sx - 3, sy - 4 - hd - h - 14 * p, 6, 2.5);
        // Dormer windows (Dutch style)
        if (p > 0.5) {
            for (let d = -1; d <= 1; d += 2) {
                const dmX = sx + d * hw * 0.3;
                const dmY = sy - 4 - hd - h - 7 * p + (d < 0 ? hd * 0.3 : -hd * 0.3) * 0;
                // Dormer body
                ctx.fillStyle = '#e8e0cc';
                ctx.fillRect(dmX - 4, dmY - 8, 8, 8);
                ctx.fillStyle = '#6a6858';
                ctx.beginPath();
                ctx.moveTo(dmX - 5, dmY - 8); ctx.lineTo(dmX, dmY - 13); ctx.lineTo(dmX + 5, dmY - 8);
                ctx.closePath(); ctx.fill();
                ctx.fillStyle = 'rgba(180,220,240,0.5)'; ctx.fillRect(dmX - 2.5, dmY - 7, 5, 5);
                ctx.strokeStyle = '#4a4838'; ctx.lineWidth = 0.5;
                ctx.beginPath(); ctx.moveTo(dmX, dmY - 7); ctx.lineTo(dmX, dmY - 2); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(dmX - 2.5, dmY - 4.5); ctx.lineTo(dmX + 2.5, dmY - 4.5); ctx.stroke();
            }
        }

        // ── Clock tower (central feature) ────────────────────────────────
        if (p > 0.55) {
            const ctX = sx, ctY = sy - 4 - hd - h + hd * 0;
            const ctH = 18 * p;
            ctx.fillStyle = '#e8e0cc';
            ctx.fillRect(ctX - 5, ctY - ctH - 2, 10, ctH);
            ctx.fillStyle = '#d8d0bc';
            ctx.beginPath(); ctx.moveTo(ctX + 5, ctY - 2); ctx.lineTo(ctX + 5, ctY - ctH - 2); ctx.lineTo(ctX + 5 + hd * 0.1, ctY - ctH - 2 - hd * 0.1); ctx.stroke();
            // Clock face
            ctx.fillStyle = '#f8f4e8';
            ctx.beginPath(); ctx.arc(ctX, ctY - ctH - 5, 5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#3a3828'; ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.arc(ctX, ctY - ctH - 5, 5, 0, Math.PI * 2); ctx.stroke();
            // Clock hands (animated)
            const hrs = ((anim * 0.1) % (Math.PI * 2));
            const mins = ((anim * 0.6) % (Math.PI * 2));
            ctx.strokeStyle = '#1a1810'; ctx.lineWidth = 0.7;
            ctx.beginPath(); ctx.moveTo(ctX, ctY - ctH - 5); ctx.lineTo(ctX + Math.sin(hrs) * 3, ctY - ctH - 5 - Math.cos(hrs) * 3); ctx.stroke();
            ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(ctX, ctY - ctH - 5); ctx.lineTo(ctX + Math.sin(mins) * 4, ctY - ctH - 5 - Math.cos(mins) * 4); ctx.stroke();
            // Tower roof (pyramidal)
            ctx.fillStyle = '#5a5848';
            ctx.beginPath();
            ctx.moveTo(ctX - 6, ctY - ctH - 10); ctx.lineTo(ctX, ctY - ctH - 20);
            ctx.lineTo(ctX + 6, ctY - ctH - 10);
            ctx.closePath(); ctx.fill();
        }

        // ── Arched windows & doors (Dutch colonial) ───────────────────────
        if (p > 0.4) {
            for (let w = 0; w < 4; w++) {
                const t = (w + 0.5) / 5;
                const wX = sx - hw + hw * t;
                const wY = sy - 4 - hd * t - h * 0.45;
                const wW = 4, wH = 7;
                ctx.fillStyle = '#2a2818'; ctx.fillRect(wX - wW / 2, wY - wH, wW, wH);
                ctx.beginPath(); ctx.arc(wX, wY - wH, wW / 2, Math.PI, 0); ctx.fill();
                ctx.fillStyle = 'rgba(160,210,240,0.45)'; ctx.fillRect(wX - wW / 2 + 0.5, wY - wH + 0.5, wW - 1, wH - 0.5);
                ctx.beginPath(); ctx.arc(wX, wY - wH, wW / 2 - 0.5, Math.PI, 0); ctx.fill();
                ctx.strokeStyle = '#2a2818'; ctx.lineWidth = 0.35;
                ctx.beginPath(); ctx.moveTo(wX, wY - wH + 0.5); ctx.lineTo(wX, wY); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(wX - 1.5, wY - 3.5); ctx.lineTo(wX + 1.5, wY - 3.5); ctx.stroke();
            }
        }

        // ── Station entrance archway ──────────────────────────────────────
        if (p > 0.5) {
            const eX = sx - hw * 0.05, eY = sy - 4 - hd * 0.05;
            // Grand arch frame
            ctx.fillStyle = '#c8c0a8';
            ctx.fillRect(eX - 10, eY - 18, 20, 18);
            ctx.beginPath(); ctx.arc(eX, eY - 18, 10, Math.PI, 0); ctx.fill();
            // Arch glass
            ctx.fillStyle = 'rgba(160,220,255,0.4)'; ctx.fillRect(eX - 9, eY - 17, 18, 17);
            ctx.beginPath(); ctx.arc(eX, eY - 18, 9, Math.PI, 0); ctx.fill();
            // Arch keystone
            ctx.fillStyle = '#b8b098';
            ctx.fillRect(eX - 2, eY - 28, 4, 4);
            // Arch radial bars
            ctx.strokeStyle = '#a8a088'; ctx.lineWidth = 0.4;
            for (let ar = 0; ar < 7; ar++) {
                const ang = Math.PI + ar * Math.PI / 8;
                ctx.beginPath();
                ctx.moveTo(eX, eY - 18);
                ctx.lineTo(eX + Math.cos(ang) * 9, eY - 18 + Math.sin(ang) * 9);
                ctx.stroke();
            }
            // Door panels
            ctx.fillStyle = '#3a3020'; ctx.fillRect(eX - 9, eY - 12, 8.5, 12);
            ctx.fillStyle = '#302818'; ctx.fillRect(eX + 0.5, eY - 12, 8.5, 12);
            ctx.fillStyle = 'rgba(180,220,250,0.5)'; ctx.fillRect(eX - 8.5, eY - 11.5, 7.5, 11.5);
            ctx.fillStyle = 'rgba(170,210,245,0.45)'; ctx.fillRect(eX + 1, eY - 11.5, 7.5, 11.5);
        }

        // ── "STASIUN" sign (large) ────────────────────────────────────────
        if (p >= 1) {
            ctx.fillStyle = '#1a2850';
            ctx.fillRect(sx - hw * 0.7, sy - 4 - h * 0.32, hw * 1.35, 7);
            ctx.strokeStyle = '#c0b888'; ctx.lineWidth = 0.5;
            ctx.strokeRect(sx - hw * 0.7, sy - 4 - h * 0.32, hw * 1.35, 7);
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 4.5px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('STASIUN', sx - hw * 0.0, sy - 4 - h * 0.32 + 5.5);
        }

        // ── Train (locomotive + 2 carriages) ─────────────────────────────
        if (p >= 1) {
            // Animated train position (slow slide)
            const trainX = sx - 30 + ((anim * 3) % 90);
            const trainY = sy + hd * 0.65 - trainX * hd * 0.7 / hw;
            const drawLocomotive = (lx, ly) => {
                // Body
                ctx.fillStyle = '#1a3050'; ctx.fillRect(lx, ly - 6, 14, 7);
                ctx.fillStyle = '#263a60';
                ctx.beginPath(); ctx.moveTo(lx + 12, ly - 6); ctx.lineTo(lx + 14, ly - 4); ctx.lineTo(lx + 14, ly + 1); ctx.lineTo(lx + 12, ly + 1); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#d0a020'; ctx.fillRect(lx, ly - 7, 14, 1.2); ctx.fillRect(lx, ly + 1, 14, 1);
                ctx.fillStyle = 'rgba(255,200,80,0.8)'; ctx.fillRect(lx + 12.5, ly - 4.5, 1.2, 2);
                ctx.fillStyle = '#202020';
                ctx.beginPath(); ctx.arc(lx + 2.5, ly + 2.5, 2.2, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(lx + 8, ly + 2.5, 2.2, 0, Math.PI * 2); ctx.fill();
                // Smoke
                if (p >= 1) {
                    const smokeY = ly - 8 - Math.sin(anim * 3 + lx) * 2;
                    ctx.fillStyle = 'rgba(180,180,180,0.4)';
                    ctx.beginPath(); ctx.arc(lx + 4, smokeY, 1.5 + Math.sin(anim * 2) * 0.5, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(lx + 5.5, smokeY - 2.5, 2, 0, Math.PI * 2); ctx.fill();
                }
            };
            const drawCarriage = (cx, cy, clr) => {
                ctx.fillStyle = clr; ctx.fillRect(cx, cy - 5, 12, 6);
                ctx.fillStyle = 'rgba(160,220,255,0.5)'; ctx.fillRect(cx + 1, cy - 4.5, 3, 2.5); ctx.fillRect(cx + 6, cy - 4.5, 3, 2.5);
                ctx.strokeStyle = clr + '88'; ctx.lineWidth = 0.4; ctx.strokeRect(cx, cy - 5, 12, 6);
                ctx.fillStyle = '#1a1a1a';
                ctx.beginPath(); ctx.arc(cx + 2.5, cy + 2, 1.8, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(cx + 8.5, cy + 2, 1.8, 0, Math.PI * 2); ctx.fill();
            };
            if (trainX > -20 && trainX < hw + 20) {
                drawLocomotive(trainX, trainY);
                drawCarriage(trainX - 14, trainY, '#2848a0');
                drawCarriage(trainX - 28, trainY, '#204090');
            }
        }

        // ── Waiting passengers ────────────────────────────────────────────
        if (p >= 1) {
            const passengerColors = ['#e84040', '#2050c0', '#40a040', '#c08020'];
            for (let pp = 0; pp < 3; pp++) {
                const px2 = sx - hw * 0.5 + pp * 12, py2 = sy + hd * 0.2 + pp * 2;
                ctx.fillStyle = '#f5d080'; ctx.beginPath(); ctx.arc(px2, py2 - 6, 1.5, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = passengerColors[pp]; ctx.fillRect(px2 - 1.5, py2 - 4.5, 3, 3.5);
                ctx.strokeStyle = '#303030'; ctx.lineWidth = 0.7;
                ctx.beginPath(); ctx.moveTo(px2, py2 - 1); ctx.lineTo(px2 - 1.8, py2 + 2.5); ctx.moveTo(px2, py2 - 1); ctx.lineTo(px2 + 1.8, py2 + 2.5); ctx.stroke();
            }
        }

        // ── Trees & greenery ──────────────────────────────────────────────
        if (p >= 1) {
            this._treeSmall(ctx, sx - hw - 4, sy - 4, 10, '#5a3818', '#38a030');
            this._treeSmall(ctx, sx + hw + 12, sy - 10, 10, '#4a2e10', '#30a828');
        }
    },

    // --- AGRO INDUSTRI (Agro Processing Plant, 2x2) ---
    _drawAgroIndustri(ctx, sx, sy, p) {
        const hw = 36, hd = 18;
        const anim = this.animTime || 0;
        this._shadow(ctx, sx, sy, hw + 4, hd + 4);

        // --- Industrial compound ground ---
        ctx.fillStyle = '#a0a090';
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd - 1);
        ctx.lineTo(sx + hw + 1, sy);
        ctx.lineTo(sx, sy + hd + 1);
        ctx.lineTo(sx - hw - 1, sy);
        ctx.closePath();
        ctx.fill();
        // Inner area (concrete)
        ctx.fillStyle = '#b8b4a8';
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd);
        ctx.lineTo(sx + hw, sy);
        ctx.lineTo(sx, sy + hd);
        ctx.lineTo(sx - hw, sy);
        ctx.closePath();
        ctx.fill();

        // --- Main Processing Building (warehouse) ---
        const bw = 26 * p, bd = 13 * p, bh = 20 * p;
        const bx = sx - 8, by = sy + 2;

        // Left wall with gradient
        const lwGrad = ctx.createLinearGradient(bx - bw / 2, by, bx - bw / 2, by - bh);
        lwGrad.addColorStop(0, '#c0b888');
        lwGrad.addColorStop(1, '#d0c898');
        ctx.fillStyle = lwGrad;
        ctx.beginPath();
        ctx.moveTo(bx - bw / 2, by);
        ctx.lineTo(bx, by + bd / 2);
        ctx.lineTo(bx, by + bd / 2 - bh);
        ctx.lineTo(bx - bw / 2, by - bh);
        ctx.closePath();
        ctx.fill();

        // Right wall with gradient
        const rwGrad = ctx.createLinearGradient(bx + bw / 2, by, bx + bw / 2, by - bh);
        rwGrad.addColorStop(0, '#a8a070');
        rwGrad.addColorStop(1, '#b8b080');
        ctx.fillStyle = rwGrad;
        ctx.beginPath();
        ctx.moveTo(bx + bw / 2, by);
        ctx.lineTo(bx, by + bd / 2);
        ctx.lineTo(bx, by + bd / 2 - bh);
        ctx.lineTo(bx + bw / 2, by - bh);
        ctx.closePath();
        ctx.fill();

        // Industrial windows on left wall
        if (p > 0.5) {
            for (let w = 0; w < 3; w++) {
                const wy = by - bh * 0.3 - bh * 0.12 * w;
                const wx = bx - bw * 0.35 + w * 1.5;
                ctx.fillStyle = 'rgba(160,200,220,0.3)';
                ctx.fillRect(wx, wy, 3, 3);
                ctx.strokeStyle = 'rgba(100,100,100,0.2)';
                ctx.lineWidth = 0.3;
                ctx.strokeRect(wx, wy, 3, 3);
            }
        }

        // Corrugated metal roof (green)
        ctx.fillStyle = '#508838';
        ctx.beginPath();
        ctx.moveTo(bx - bw / 2 - 3, by - bh);
        ctx.lineTo(bx, by - bd / 2 - bh - 5);
        ctx.lineTo(bx + bw / 2 + 3, by - bh);
        ctx.lineTo(bx, by + bd / 2 - bh);
        ctx.closePath();
        ctx.fill();
        // Roof ridge
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(bx - bw / 2 - 3, by - bh);
        ctx.lineTo(bx, by - bd / 2 - bh - 5);
        ctx.lineTo(bx + bw / 2 + 3, by - bh);
        ctx.stroke();
        // Corrugation lines on roof
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 0.4;
        for (let i = 1; i < 6; i++) {
            const t = i / 6;
            ctx.beginPath();
            ctx.moveTo(bx - bw / 2 * (1 - t), by - bh - t * 2.5);
            ctx.lineTo(bx + bw / 2 * t, by + bd / 2 * (1 - t * 2) - bh);
            ctx.stroke();
        }

        // Large loading doorway
        ctx.fillStyle = '#604830';
        ctx.fillRect(bx - 5, by + bd / 2 - bh + 2, 8, 11 * p);
        ctx.fillStyle = '#201008';
        ctx.fillRect(bx - 4, by + bd / 2 - bh + 3, 6, 9 * p);
        // Roller shutter lines
        ctx.strokeStyle = 'rgba(80,60,30,0.3)';
        ctx.lineWidth = 0.3;
        for (let rl = 0; rl < 5; rl++) {
            const rly = by + bd / 2 - bh + 4 + rl * 1.5;
            ctx.beginPath();
            ctx.moveTo(bx - 4, rly);
            ctx.lineTo(bx + 2, rly);
            ctx.stroke();
        }

        if (p < 0.5) return;

        // --- Primary Silo (tall grain storage) ---
        const siloX = sx + hw * 0.3, siloY = sy - hd * 0.1;
        const siloR = 6.5 * p, siloH = 16 * p;
        // Cylinder body
        const siloGrad = ctx.createLinearGradient(siloX - siloR, siloY, siloX + siloR, siloY);
        siloGrad.addColorStop(0, '#b8b080');
        siloGrad.addColorStop(0.35, '#d8d0a8');
        siloGrad.addColorStop(0.65, '#d0c8a0');
        siloGrad.addColorStop(1, '#a8a070');
        ctx.fillStyle = siloGrad;
        ctx.beginPath();
        ctx.ellipse(siloX, siloY, siloR, siloR * 0.45, 0, 0, Math.PI);
        ctx.lineTo(siloX - siloR, siloY - siloH);
        ctx.ellipse(siloX, siloY - siloH, siloR, siloR * 0.45, 0, Math.PI, 0, true);
        ctx.closePath();
        ctx.fill();
        // Horizontal banding on silo
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 0.3;
        for (let b = 1; b <= 4; b++) {
            ctx.beginPath();
            ctx.ellipse(siloX, siloY - siloH * (b / 5), siloR, siloR * 0.45, 0, 0, Math.PI);
            ctx.stroke();
        }
        // Silo top cap (conical)
        ctx.fillStyle = '#e0d8c0';
        ctx.beginPath();
        ctx.ellipse(siloX, siloY - siloH, siloR, siloR * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c0b890';
        ctx.beginPath();
        ctx.moveTo(siloX, siloY - siloH - 4);
        ctx.lineTo(siloX - siloR * 0.5, siloY - siloH);
        ctx.lineTo(siloX + siloR * 0.5, siloY - siloH);
        ctx.closePath();
        ctx.fill();

        // --- Secondary smaller silo ---
        const s2x = siloX + 11, s2y = siloY + 3;
        const s2r = 5 * p, s2h = 12 * p;
        const s2Grad = ctx.createLinearGradient(s2x - s2r, s2y, s2x + s2r, s2y);
        s2Grad.addColorStop(0, '#c0b888');
        s2Grad.addColorStop(0.5, '#d0c898');
        s2Grad.addColorStop(1, '#b0a878');
        ctx.fillStyle = s2Grad;
        ctx.beginPath();
        ctx.ellipse(s2x, s2y, s2r, s2r * 0.45, 0, 0, Math.PI);
        ctx.lineTo(s2x - s2r, s2y - s2h);
        ctx.ellipse(s2x, s2y - s2h, s2r, s2r * 0.45, 0, Math.PI, 0, true);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#d8d0a8';
        ctx.beginPath();
        ctx.ellipse(s2x, s2y - s2h, s2r, s2r * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        if (p < 0.7) return;

        // --- Conveyor belt (elevated) ---
        ctx.strokeStyle = '#686868';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx + bw / 2, by - bh * 0.45);
        ctx.lineTo(siloX - siloR, siloY - siloH * 0.55);
        ctx.stroke();
        // Belt rollers (animated)
        const convLen = Math.sqrt(Math.pow(siloX - siloR - bx - bw / 2, 2) + Math.pow(siloY - siloH * 0.55 - by + bh * 0.45, 2));
        for (let cr = 0; cr < 5; cr++) {
            const t = ((cr / 5) + (anim * 0.1) % 0.2) % 1;
            const cx = bx + bw / 2 + (siloX - siloR - bx - bw / 2) * t;
            const cy = by - bh * 0.45 + (siloY - siloH * 0.55 - by + bh * 0.45) * t;
            ctx.fillStyle = '#808080';
            ctx.beginPath();
            ctx.arc(cx, cy, 1, 0, Math.PI * 2);
            ctx.fill();
        }
        // Conveyor support legs
        ctx.strokeStyle = '#585858';
        ctx.lineWidth = 0.8;
        for (let cl = 0; cl < 3; cl++) {
            const t = (cl + 0.5) / 3;
            const cx = bx + bw / 2 + (siloX - siloR - bx - bw / 2) * t;
            const cy = by - bh * 0.45 + (siloY - siloH * 0.55 - by + bh * 0.45) * t;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx, cy + 10 + cl * 2);
            ctx.stroke();
        }

        // --- Truck (green cargo) ---
        if (p >= 1) {
            const trX = sx - hw * 0.55, trY = sy + hd * 0.45;
            // Cargo bed
            ctx.fillStyle = '#488030';
            ctx.fillRect(trX - 5, trY - 4, 10, 6);
            ctx.strokeStyle = '#386820';
            ctx.lineWidth = 0.3;
            ctx.strokeRect(trX - 5, trY - 4, 10, 6);
            // Cabin
            ctx.fillStyle = '#d0c080';
            ctx.fillRect(trX - 5, trY - 7, 5, 3);
            // Windshield
            ctx.fillStyle = 'rgba(160,200,220,0.4)';
            ctx.fillRect(trX - 4.5, trY - 6.5, 3, 2);
            // Wheels
            ctx.fillStyle = '#282828';
            ctx.beginPath();
            ctx.arc(trX - 3, trY + 2.5, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(trX + 3, trY + 2.5, 1.5, 0, Math.PI * 2);
            ctx.fill();
            // Hub caps
            ctx.fillStyle = '#606060';
            ctx.beginPath();
            ctx.arc(trX - 3, trY + 2.5, 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(trX + 3, trY + 2.5, 0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Crop sacks stacked near building ---
        if (p >= 1) {
            const sackPositions = [
                [bx - bw / 2 + 3, by + bd / 4],
                [bx - bw / 2 + 7, by + bd / 4 + 0.5],
                [bx - bw / 2 + 5, by + bd / 4 - 2],
                [bx - bw / 2 + 11, by + bd / 4 + 1],
            ];
            for (const [sackX, sackY] of sackPositions) {
                ctx.fillStyle = '#c8b870';
                ctx.beginPath();
                ctx.ellipse(sackX, sackY, 2.5, 2, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(100,80,40,0.2)';
                ctx.lineWidth = 0.3;
                ctx.beginPath();
                ctx.moveTo(sackX - 1.5, sackY); ctx.lineTo(sackX + 1.5, sackY);
                ctx.stroke();
            }
        }

        // --- Smokestack with animated smoke ---
        if (p >= 1) {
            const chX = bx + bw / 2 - 3, chY = by - bh - 2;
            // Chimney
            ctx.fillStyle = '#707060';
            ctx.fillRect(chX - 1.5, chY, 3, 8);
            // Smoke puffs
            for (let s = 0; s < 3; s++) {
                const smokeT = ((anim * 0.4 + s * 1.2) % 4) / 4;
                const smokeX = chX + Math.sin(anim * 0.3 + s) * 2;
                const smokeY = chY - smokeT * 12;
                const smokeR = 1.5 + smokeT * 3;
                ctx.fillStyle = `rgba(180,180,180,${0.2 - smokeT * 0.15})`;
                ctx.beginPath();
                ctx.arc(smokeX, smokeY, smokeR, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    },

    // --- STADION (Stadium, 3x3) ---
    _drawStadion(ctx, sx, sy, p) {
        const hw = 50, hd = 25;
        this._shadow(ctx, sx, sy, hw + 4, hd + 4);

        // Ground/field base
        ctx.fillStyle = '#48a848';
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd);
        ctx.lineTo(sx + hw, sy);
        ctx.lineTo(sx, sy + hd);
        ctx.lineTo(sx - hw, sy);
        ctx.closePath();
        ctx.fill();

        // Playing field (inner green)
        ctx.fillStyle = '#58c058';
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd * 0.55);
        ctx.lineTo(sx + hw * 0.55, sy);
        ctx.lineTo(sx, sy + hd * 0.55);
        ctx.lineTo(sx - hw * 0.55, sy);
        ctx.closePath();
        ctx.fill();

        // Lighter stripes on field
        ctx.fillStyle = 'rgba(80,200,80,0.3)';
        for (let i = 0; i < 4; i++) {
            const t = (i * 2 + 1) / 8;
            ctx.beginPath();
            ctx.moveTo(sx - hw * 0.55 * (1 - t * 2), sy + hd * 0.55 * (1 - t * 0.5));
            ctx.lineTo(sx + hw * 0.55 * t, sy - hd * 0.55 * t * 0.6);
            ctx.lineTo(sx + hw * 0.55 * (t + 0.15), sy - hd * 0.55 * (t + 0.15) * 0.6);
            ctx.lineTo(sx - hw * 0.55 * (1 - (t + 0.15) * 2), sy + hd * 0.55 * (1 - (t + 0.15) * 0.5));
            ctx.closePath();
            ctx.fill();
        }

        // Field center line
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(sx - hw * 0.25, sy + hd * 0.25);
        ctx.lineTo(sx + hw * 0.25, sy - hd * 0.25);
        ctx.stroke();
        // Center circle
        ctx.beginPath();
        ctx.ellipse(sx, sy, 6, 3, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Stadium wall height
        const wallH = 12 * p;

        // Oval seating tiers (back/left)
        ctx.fillStyle = '#c0c8d0';
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd);
        ctx.lineTo(sx - hw, sy);
        ctx.lineTo(sx - hw, sy - wallH);
        ctx.lineTo(sx, sy - hd - wallH);
        ctx.closePath();
        ctx.fill();
        // Front/right seating
        ctx.fillStyle = '#a8b0b8';
        ctx.beginPath();
        ctx.moveTo(sx, sy + hd);
        ctx.lineTo(sx + hw, sy);
        ctx.lineTo(sx + hw, sy - wallH);
        ctx.lineTo(sx, sy + hd - wallH);
        ctx.closePath();
        ctx.fill();
        // Left front
        ctx.fillStyle = '#b0b8c0';
        ctx.beginPath();
        ctx.moveTo(sx, sy + hd);
        ctx.lineTo(sx - hw, sy);
        ctx.lineTo(sx - hw, sy - wallH);
        ctx.lineTo(sx, sy + hd - wallH);
        ctx.closePath();
        ctx.fill();
        // Right back
        ctx.fillStyle = '#b8c0c8';
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd);
        ctx.lineTo(sx + hw, sy);
        ctx.lineTo(sx + hw, sy - wallH);
        ctx.lineTo(sx, sy - hd - wallH);
        ctx.closePath();
        ctx.fill();

        // Top rim of stadium
        ctx.fillStyle = '#d0d4d8';
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd - wallH);
        ctx.lineTo(sx + hw, sy - wallH);
        ctx.lineTo(sx, sy + hd - wallH);
        ctx.lineTo(sx - hw, sy - wallH);
        ctx.closePath();
        ctx.fill();

        // Inner rim / seating visible from top
        ctx.fillStyle = '#e0e4e8';
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd * 0.7 - wallH);
        ctx.lineTo(sx + hw * 0.7, sy - wallH);
        ctx.lineTo(sx, sy + hd * 0.7 - wallH);
        ctx.lineTo(sx - hw * 0.7, sy - wallH);
        ctx.closePath();
        ctx.fill();

        // Colored seats rows (red, blue, yellow)
        const seatColors = ['#c04040', '#3060b0', '#c0a030', '#c04040'];
        for (let r = 0; r < 4; r++) {
            const t = 0.55 + r * 0.04;
            ctx.fillStyle = seatColors[r];
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(sx, sy - hd * t - wallH);
            ctx.lineTo(sx + hw * t, sy - wallH);
            ctx.lineTo(sx, sy + hd * t - wallH);
            ctx.lineTo(sx - hw * t, sy - wallH);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        if (p < 0.6) return;

        // Floodlight towers (4 corners)
        const lights = [
            [sx - hw * 0.85, sy + hd * 0.15],
            [sx + hw * 0.85, sy - hd * 0.15],
            [sx - hw * 0.15, sy - hd * 0.85],
            [sx + hw * 0.15, sy + hd * 0.85],
        ];
        ctx.strokeStyle = '#a0a0a0';
        ctx.lineWidth = 1.2;
        for (const [lx, ly] of lights) {
            ctx.beginPath();
            ctx.moveTo(lx, ly - wallH);
            ctx.lineTo(lx, ly - wallH - 12 * p);
            ctx.stroke();
            // Light head
            ctx.fillStyle = '#e0e0e0';
            ctx.fillRect(lx - 2, ly - wallH - 12 * p - 2, 4, 2.5);
            // Light glow
            ctx.fillStyle = 'rgba(255,240,180,0.2)';
            ctx.beginPath();
            ctx.arc(lx, ly - wallH - 12 * p - 1, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Entrance gate
        if (p >= 1) {
            ctx.fillStyle = '#6878a8';
            ctx.fillRect(sx - 5, sy + hd - wallH - 3, 10, 6);
            ctx.fillStyle = '#f0f0f0';
            ctx.font = '2px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('STADIUM', sx, sy + hd - wallH + 1);
        }
    },

    // --- TAMAN KOTA BESAR (Large City Park, 3x3) ---
    _drawTamanBesar(ctx, sx, sy, p) {
        const hw = 50, hd = 25;

        // Green grass base
        ctx.fillStyle = '#48b848';
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd);
        ctx.lineTo(sx + hw, sy);
        ctx.lineTo(sx, sy + hd);
        ctx.lineTo(sx - hw, sy);
        ctx.closePath();
        ctx.fill();

        // Lighter grass patches
        ctx.fillStyle = '#58c858';
        ctx.beginPath();
        ctx.moveTo(sx - hw * 0.3, sy + hd * 0.3);
        ctx.lineTo(sx + hw * 0.2, sy);
        ctx.lineTo(sx + hw * 0.5, sy - hd * 0.1);
        ctx.lineTo(sx + hw * 0.2, sy + hd * 0.2);
        ctx.closePath();
        ctx.fill();

        // Winding path
        ctx.strokeStyle = '#c0b898';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx - hw * 0.8, sy + hd * 0.2);
        ctx.bezierCurveTo(sx - hw * 0.4, sy - hd * 0.3, sx + hw * 0.1, sy + hd * 0.4, sx + hw * 0.7, sy - hd * 0.1);
        ctx.stroke();
        // Path edge
        ctx.strokeStyle = 'rgba(160,140,110,0.3)';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(sx - hw * 0.8, sy + hd * 0.2);
        ctx.bezierCurveTo(sx - hw * 0.4, sy - hd * 0.3, sx + hw * 0.1, sy + hd * 0.4, sx + hw * 0.7, sy - hd * 0.1);
        ctx.stroke();

        // Small lake
        const lx = sx + hw * 0.15, ly = sy + hd * 0.35;
        const waterGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, 12);
        waterGrad.addColorStop(0, '#4898d0');
        waterGrad.addColorStop(1, '#3880b8');
        ctx.fillStyle = waterGrad;
        ctx.beginPath();
        ctx.ellipse(lx, ly, 12, 6, -0.4, 0, Math.PI * 2);
        ctx.fill();
        // Water reflection
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.ellipse(lx - 2, ly - 1, 5, 2.5, -0.4, 0, Math.PI * 2);
        ctx.fill();
        // Animated ripple
        const ripT = (this.animTime || 0) * 1.2;
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.ellipse(lx, ly, 4 + 2 * Math.sin(ripT), 2 + Math.sin(ripT), -0.4, 0, Math.PI * 2);
        ctx.stroke();

        // Trees around the park
        const trees = [
            { x: sx - hw * 0.6, y: sy - hd * 0.1, s: 1.0, col: '#2a8030' },
            { x: sx - hw * 0.3, y: sy - hd * 0.6, s: 0.8, col: '#38a040' },
            { x: sx + hw * 0.5, y: sy - hd * 0.4, s: 0.9, col: '#2a7028' },
            { x: sx - hw * 0.55, y: sy + hd * 0.55, s: 0.7, col: '#40a848' },
            { x: sx + hw * 0.55, y: sy + hd * 0.3, s: 0.85, col: '#308838' },
        ];
        for (const t of trees) {
            if (p < 0.3) continue;
            const sc = t.s * p;
            // Tree shadow
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.beginPath();
            ctx.ellipse(t.x + 3, t.y + 2, 8 * sc, 4 * sc, 0, 0, Math.PI * 2);
            ctx.fill();
            // Trunk
            ctx.fillStyle = '#6a4a28';
            ctx.fillRect(t.x - 1.5, t.y - 10 * sc, 3, 10 * sc);
            // Canopy
            ctx.fillStyle = t.col;
            ctx.beginPath();
            ctx.arc(t.x, t.y - 12 * sc, 8 * sc, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = this._lighten(t.col, 20);
            ctx.beginPath();
            ctx.arc(t.x - 3 * sc, t.y - 14 * sc, 5 * sc, 0, Math.PI * 2);
            ctx.fill();
        }

        // Flower beds
        if (p > 0.5) {
            const flowerColors = ['#e06080', '#e0c040', '#d060d0', '#f08060'];
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const fx = sx - hw * 0.15 + Math.cos(angle) * 15;
                const fy = sy - hd * 0.15 + Math.sin(angle) * 7;
                ctx.fillStyle = flowerColors[i % flowerColors.length];
                ctx.beginPath();
                ctx.arc(fx, fy, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Park benches
        if (p > 0.7) {
            const benches = [
                [sx - hw * 0.2, sy + hd * 0.05],
                [sx + hw * 0.35, sy + hd * 0.1],
            ];
            for (const [bx, by] of benches) {
                ctx.fillStyle = '#8a6a40';
                ctx.fillRect(bx - 4, by - 1, 8, 2);
                ctx.fillStyle = '#6a4a20';
                ctx.fillRect(bx - 4, by - 3, 1, 2);
                ctx.fillRect(bx + 3, by - 3, 1, 2);
            }
        }

        // Fountain in center area
        if (p >= 1) {
            const fx = sx - hw * 0.1, fy = sy - hd * 0.15;
            // Fountain base
            ctx.fillStyle = '#b0a890';
            ctx.beginPath();
            ctx.ellipse(fx, fy, 5, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();
            // Water column
            ctx.fillStyle = 'rgba(80,170,230,0.4)';
            ctx.fillRect(fx - 0.5, fy - 8, 1, 8);
            // Water spray
            const sprayT = (this.animTime || 0) * 2;
            ctx.fillStyle = 'rgba(100,190,240,0.3)';
            for (let i = 0; i < 5; i++) {
                const a = (i / 5) * Math.PI * 2 + sprayT;
                const dr = 3 + Math.sin(a * 2) * 1;
                ctx.beginPath();
                ctx.arc(fx + Math.cos(a) * dr, fy - 8 + Math.sin(a) * dr * 0.5, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Jogging track (dotted outline)
        if (p > 0.8) {
            ctx.strokeStyle = 'rgba(200,100,60,0.3)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(sx, sy - hd * 0.8);
            ctx.lineTo(sx + hw * 0.8, sy);
            ctx.lineTo(sx, sy + hd * 0.8);
            ctx.lineTo(sx - hw * 0.8, sy);
            ctx.closePath();
            ctx.stroke();
            ctx.setLineDash([]);
        }
    },

    // --- PABRIK BESAR (Large Factory / Industrial Complex, 3x3) ---
    _drawPabrikBesar(ctx, sx, sy, p) {
        const hw = 50, hd = 25;
        this._shadow(ctx, sx, sy, hw + 4, hd + 4);

        // Concrete ground
        ctx.fillStyle = '#909090';
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd);
        ctx.lineTo(sx + hw, sy);
        ctx.lineTo(sx, sy + hd);
        ctx.lineTo(sx - hw, sy);
        ctx.closePath();
        ctx.fill();

        // Main factory building
        const fbw = 38 * p, fbd = 19 * p, fbh = 24 * p;
        const fx = sx - 5, fy = sy + 3;
        // Left wall
        ctx.fillStyle = '#a0a8b0';
        ctx.beginPath();
        ctx.moveTo(fx - fbw / 2, fy);
        ctx.lineTo(fx, fy + fbd / 2);
        ctx.lineTo(fx, fy + fbd / 2 - fbh);
        ctx.lineTo(fx - fbw / 2, fy - fbh);
        ctx.closePath();
        ctx.fill();
        // Right wall
        ctx.fillStyle = '#8890a0';
        ctx.beginPath();
        ctx.moveTo(fx + fbw / 2, fy);
        ctx.lineTo(fx, fy + fbd / 2);
        ctx.lineTo(fx, fy + fbd / 2 - fbh);
        ctx.lineTo(fx + fbw / 2, fy - fbh);
        ctx.closePath();
        ctx.fill();
        // Roof
        ctx.fillStyle = '#505860';
        ctx.beginPath();
        ctx.moveTo(fx - fbw / 2, fy - fbh);
        ctx.lineTo(fx, fy - fbd / 2 - fbh);
        ctx.lineTo(fx + fbw / 2, fy - fbh);
        ctx.lineTo(fx, fy + fbd / 2 - fbh);
        ctx.closePath();
        ctx.fill();

        // Windows grid on left wall
        ctx.fillStyle = 'rgba(150,200,230,0.4)';
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 4; col++) {
                const wx = fx - fbw / 2 + 4 + col * 7;
                const wy = fy - fbh + 4 + row * 6;
                const wshift = (col * 0.5 + row * 0.3) * (fbd / fbw);
                ctx.fillRect(wx, wy + wshift * 5, 4, 3.5);
            }
        }

        // Industrial chimney stacks (3 tall chimneys)
        if (p > 0.4) {
            const chimneys = [
                { cx: sx + hw * 0.2, cy: sy - hd * 0.2, h: 32 * p, r: 4 },
                { cx: sx + hw * 0.35, cy: sy - hd * 0.05, h: 28 * p, r: 3.5 },
                { cx: sx + hw * 0.1, cy: sy - hd * 0.35, h: 25 * p, r: 3 },
            ];
            for (const ch of chimneys) {
                // Chimney body
                const chGrad = ctx.createLinearGradient(ch.cx - ch.r, ch.cy, ch.cx + ch.r, ch.cy);
                chGrad.addColorStop(0, '#808080');
                chGrad.addColorStop(0.5, '#a0a0a0');
                chGrad.addColorStop(1, '#707070');
                ctx.fillStyle = chGrad;
                ctx.fillRect(ch.cx - ch.r, ch.cy - ch.h, ch.r * 2, ch.h);
                // Chimney top ring
                ctx.fillStyle = '#686868';
                ctx.beginPath();
                ctx.ellipse(ch.cx, ch.cy - ch.h, ch.r + 1, (ch.r + 1) * 0.4, 0, 0, Math.PI * 2);
                ctx.fill();
                // Red warning stripe
                ctx.fillStyle = '#c04030';
                ctx.fillRect(ch.cx - ch.r, ch.cy - ch.h + 2, ch.r * 2, 2);
                ctx.fillRect(ch.cx - ch.r, ch.cy - ch.h + 6, ch.r * 2, 2);

                // Smoke animation
                if (p > 0.8) {
                    const t = (this.animTime || 0) * 0.8;
                    ctx.fillStyle = 'rgba(160,160,170,0.25)';
                    for (let s = 0; s < 4; s++) {
                        const st = t + s * 0.8;
                        const smokeY = ch.cy - ch.h - 4 - s * 6 - (st % 3) * 2;
                        const smokeR = 3 + s * 1.5 + Math.sin(st + s) * 1;
                        ctx.beginPath();
                        ctx.arc(ch.cx + Math.sin(st * 0.5 + s) * 3, smokeY, smokeR, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        }

        if (p < 0.6) return;

        // Secondary building (warehouse)
        const sw = 18 * p, sd = 9 * p, sh = 12 * p;
        const s2x = sx - hw * 0.4, s2y = sy - hd * 0.35;
        ctx.fillStyle = '#90a098';
        ctx.beginPath();
        ctx.moveTo(s2x - sw / 2, s2y);
        ctx.lineTo(s2x, s2y + sd / 2);
        ctx.lineTo(s2x, s2y + sd / 2 - sh);
        ctx.lineTo(s2x - sw / 2, s2y - sh);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#809088';
        ctx.beginPath();
        ctx.moveTo(s2x + sw / 2, s2y);
        ctx.lineTo(s2x, s2y + sd / 2);
        ctx.lineTo(s2x, s2y + sd / 2 - sh);
        ctx.lineTo(s2x + sw / 2, s2y - sh);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#606870';
        ctx.beginPath();
        ctx.moveTo(s2x - sw / 2, s2y - sh);
        ctx.lineTo(s2x, s2y - sd / 2 - sh);
        ctx.lineTo(s2x + sw / 2, s2y - sh);
        ctx.lineTo(s2x, s2y + sd / 2 - sh);
        ctx.closePath();
        ctx.fill();
        // Warehouse door
        ctx.fillStyle = '#505050';
        ctx.fillRect(s2x - 3, s2y + sd / 4 - sh + 2, 6, 8 * p);

        // Loading dock area
        if (p > 0.8) {
            // Truck
            const trX = sx - hw * 0.65, trY = sy + hd * 0.4;
            ctx.fillStyle = '#2060a0';
            ctx.fillRect(trX - 6, trY - 4, 12, 6);
            ctx.fillStyle = '#d0d0d0';
            ctx.fillRect(trX - 4, trY - 7, 8, 3);
            ctx.fillStyle = '#282828';
            ctx.beginPath();
            ctx.arc(trX - 4, trY + 2, 1.5, 0, Math.PI * 2);
            ctx.arc(trX + 4, trY + 2, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Perimeter fence
        if (p >= 1) {
            ctx.strokeStyle = 'rgba(100,100,100,0.3)';
            ctx.lineWidth = 0.5;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(sx, sy - hd * 0.95);
            ctx.lineTo(sx + hw * 0.95, sy);
            ctx.lineTo(sx, sy + hd * 0.95);
            ctx.lineTo(sx - hw * 0.95, sy);
            ctx.closePath();
            ctx.stroke();
            ctx.setLineDash([]);
        }
    },

    // --- PEMBANGKIT LISTRIK (Power Plant, 2x2) ---
    _drawPembangkit(ctx, sx, sy, p) {
        const hw = 36, hd = 18;
        this._shadow(ctx, sx, sy, 40, 22);

        // Control building (small)
        this._box(ctx, sx - hw * 0.5, sy + hd * 0.3, 12, 6, 14 * p,
            '#d8d8d8', ['#c8c8c8','#b8b8b8'], ['#b0b0b0','#a0a0a0']);
        this._hipRoof(ctx, sx - hw * 0.5, sy + hd * 0.3, 12, 6, 14 * p, 5 * p, 2,
            '#606870', '#505860', '#707880');

        // Solar panel array
        if (p > 0.4) {
            const panels = [
                [-6, -8], [8, -8], [-6, 0], [8, 0], [-6, 8], [8, 8]
            ];
            for (const [ox, oy] of panels) {
                const px = sx + ox + hw * 0.15;
                const py = sy + oy * 0.5 - hd * 0.2;
                
                // Panel frame
                ctx.fillStyle = '#404850';
                ctx.fillRect(px - 6, py - 5, 12, 7);

                // Solar cells (blue reflective)
                const g = ctx.createLinearGradient(px - 5, py - 4, px + 5, py + 1);
                g.addColorStop(0, '#1860a0');
                g.addColorStop(0.3, '#2878c0');
                g.addColorStop(0.6, '#4090d8');
                g.addColorStop(1, '#1860a0');
                ctx.fillStyle = g;
                ctx.fillRect(px - 5, py - 4, 10, 5.5);

                // Grid lines on panel
                ctx.strokeStyle = 'rgba(60,120,180,0.4)';
                ctx.lineWidth = 0.3;
                ctx.beginPath();
                ctx.moveTo(px, py - 4); ctx.lineTo(px, py + 1.5);
                ctx.moveTo(px - 5, py - 1); ctx.lineTo(px + 5, py - 1);
                ctx.stroke();

                // Reflection
                ctx.fillStyle = `rgba(180,220,255,${0.15 + Math.sin(this.animTime * 2 + ox) * 0.08})`;
                ctx.fillRect(px - 4, py - 3.5, 3, 2);

                // Support pole
                ctx.fillStyle = '#505860';
                ctx.fillRect(px - 0.5, py + 1.5, 1, 3);
            }
        }

        // Window on control building
        if (p > 0.6) {
            this._windowL(ctx, sx - hw * 0.5, sy + hd * 0.3, 8, 8, 4, 4);
        }

        // Electrical lines
        if (p >= 1) {
            ctx.strokeStyle = '#404040';
            ctx.lineWidth = 1.5;
            // Pole
            ctx.beginPath();
            ctx.moveTo(sx + hw * 0.4, sy - hd * 0.5 + 4);
            ctx.lineTo(sx + hw * 0.4, sy - hd * 0.5 - 18);
            ctx.stroke();
            // Cross arm
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx + hw * 0.4 - 6, sy - hd * 0.5 - 16);
            ctx.lineTo(sx + hw * 0.4 + 6, sy - hd * 0.5 - 16);
            ctx.stroke();
            // Wires
            ctx.strokeStyle = '#303030';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(sx + hw * 0.4 - 5, sy - hd * 0.5 - 16);
            ctx.quadraticCurveTo(sx + hw * 0.4 - 15, sy - hd * 0.5 - 10, sx + hw * 0.4 - 25, sy - hd * 0.5 - 14);
            ctx.stroke();
        }

        // Lightning bolt symbol on building
        if (p >= 1) {
            ctx.fillStyle = '#f0d030';
            ctx.beginPath();
            const bx = sx - hw * 0.5 - 6, by = sy + hd * 0.3 - 10;
            ctx.moveTo(bx + 2, by); ctx.lineTo(bx, by + 3);
            ctx.lineTo(bx + 1.5, by + 3); ctx.lineTo(bx, by + 6);
            ctx.lineTo(bx + 3, by + 2.5); ctx.lineTo(bx + 1.5, by + 2.5);
            ctx.lineTo(bx + 3, by);
            ctx.closePath();
            ctx.fill();
        }
    },

    // --- APARTEMEN (Apartment Building, 2x2) ---
    _drawApartemen(ctx, sx, sy, p) {
        const hw = 36, hd = 18;
        const podiumH = 10 * p, totalH = 50 * p;
        const anim = this.animTime || 0;
        const towerHw = hw * 0.82, towerHd = hd * 0.82;
        const towerBase = sy - podiumH;

        this._shadow(ctx, sx, sy, 44, 26);

        // --- PODIUM (parking + commercial level) ---
        // Podium body
        this._box(ctx, sx, sy, hw + 3, hd + 1.5, podiumH,
            '#c0c0c0', ['#b0b0b4','#a0a0a4'], ['#909498','#80848c']);

        // Podium entrance (dark parking opening on left face)
        if (p > 0.3) {
            ctx.fillStyle = '#383c40';
            ctx.beginPath();
            ctx.moveTo(sx - hw * 0.85, sy + hd * 0.05 - 1);
            ctx.lineTo(sx - hw * 0.85, sy + hd * 0.05 - podiumH * 0.7);
            ctx.lineTo(sx - hw * 0.35, sy - hd * 0.2 - podiumH * 0.7);
            ctx.lineTo(sx - hw * 0.35, sy - hd * 0.2 - 1);
            ctx.closePath();
            ctx.fill();
            // "P" parking sign
            ctx.fillStyle = '#4488cc';
            ctx.beginPath();
            ctx.arc(sx - hw * 0.6, sy - hd * 0.08 - podiumH * 0.45, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 2px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('P', sx - hw * 0.6, sy - hd * 0.08 - podiumH * 0.45 + 0.8);
        }

        // Podium shop fronts (right face)
        if (p > 0.4) {
            const shopColors = ['rgba(255,200,100,0.3)', 'rgba(150,200,255,0.3)', 'rgba(200,255,200,0.3)'];
            for (let s = 0; s < 3; s++) {
                const sx2 = sx + towerHw * (0.1 + s * 0.28);
                const sy2 = towerBase + towerHd * (0.9 - s * 0.15) + podiumH * 0.15;
                ctx.fillStyle = shopColors[s];
                ctx.fillRect(sx2, sy2, 5, 6);
                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.lineWidth = 0.3;
                ctx.strokeRect(sx2, sy2, 5, 6);
            }
        }

        // --- MAIN TOWER ---
        // Left face (warm grey concrete)
        const lfGrad = ctx.createLinearGradient(sx - towerHw, towerBase, sx - towerHw, towerBase - totalH);
        lfGrad.addColorStop(0, '#c8c4c0');
        lfGrad.addColorStop(0.5, '#d0ccc8');
        lfGrad.addColorStop(1, '#c4c0bc');
        ctx.fillStyle = lfGrad;
        ctx.beginPath();
        ctx.moveTo(sx - towerHw, towerBase);
        ctx.lineTo(sx - towerHw, towerBase - totalH);
        ctx.lineTo(sx, towerBase - towerHd - totalH);
        ctx.lineTo(sx, towerBase - towerHd);
        ctx.closePath();
        ctx.fill();

        // Right face
        const rfGrad = ctx.createLinearGradient(sx + towerHw, towerBase, sx + towerHw, towerBase - totalH);
        rfGrad.addColorStop(0, '#b4b0ac');
        rfGrad.addColorStop(0.5, '#bcb8b4');
        rfGrad.addColorStop(1, '#b0aca8');
        ctx.fillStyle = rfGrad;
        ctx.beginPath();
        ctx.moveTo(sx + towerHw, towerBase);
        ctx.lineTo(sx + towerHw, towerBase - totalH);
        ctx.lineTo(sx, towerBase - towerHd - totalH);
        ctx.lineTo(sx, towerBase - towerHd);
        ctx.closePath();
        ctx.fill();

        // Top face
        ctx.fillStyle = '#d8d4d0';
        ctx.beginPath();
        ctx.moveTo(sx, towerBase - towerHd - totalH);
        ctx.lineTo(sx + towerHw, towerBase - totalH);
        ctx.lineTo(sx, towerBase + towerHd - totalH);
        ctx.lineTo(sx - towerHw, towerBase - totalH);
        ctx.closePath();
        ctx.fill();

        // --- Floor separator lines ---
        if (p > 0.3) {
            const floorH = 7;
            const floors = Math.floor(totalH / floorH);
            ctx.strokeStyle = 'rgba(0,0,0,0.05)';
            ctx.lineWidth = 0.4;
            for (let f = 1; f < floors; f++) {
                const fy = f * floorH;
                ctx.beginPath();
                ctx.moveTo(sx - towerHw, towerBase - fy);
                ctx.lineTo(sx, towerBase - towerHd - fy);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(sx + towerHw, towerBase - fy);
                ctx.lineTo(sx, towerBase - towerHd - fy);
                ctx.stroke();
            }
        }

        // --- Windows with balconies ---
        if (p > 0.4) {
            const floorH = 7;
            const floors = Math.floor(totalH / floorH);
            for (let f = 1; f < floors; f++) {
                const fy = f * floorH;
                // Left face: 4 windows per floor
                for (let w = 0; w < 4; w++) {
                    const frac = (w + 1) / 5;
                    const wx = sx - towerHw * (1 - frac);
                    const wy = towerBase - fy + towerHd * (1 - frac);
                    // Window
                    const isLit = ((f * 7 + w * 13) % 5) > 1;
                    ctx.fillStyle = isLit ? 'rgba(130,190,230,0.4)' : 'rgba(100,150,190,0.3)';
                    ctx.fillRect(wx, wy - 4.5, 4, 4.5);
                    // Window frame
                    ctx.strokeStyle = 'rgba(80,80,80,0.15)';
                    ctx.lineWidth = 0.3;
                    ctx.strokeRect(wx, wy - 4.5, 4, 4.5);
                    // Balcony slab (every other floor)
                    if (f % 2 === 0) {
                        ctx.fillStyle = 'rgba(180,180,180,0.4)';
                        ctx.fillRect(wx - 0.5, wy, 5, 1);
                        // Railing
                        ctx.strokeStyle = 'rgba(160,160,160,0.35)';
                        ctx.lineWidth = 0.3;
                        ctx.beginPath();
                        ctx.moveTo(wx - 0.5, wy); ctx.lineTo(wx - 0.5, wy + 2.5);
                        ctx.moveTo(wx + 4.5, wy); ctx.lineTo(wx + 4.5, wy + 2.5);
                        ctx.moveTo(wx - 0.5, wy + 1.5); ctx.lineTo(wx + 4.5, wy + 1.5);
                        ctx.stroke();
                    }
                }
                // Right face: 4 windows per floor
                for (let w = 0; w < 4; w++) {
                    const frac = (w + 1) / 5;
                    const wx = sx + towerHw * frac;
                    const wy = towerBase - fy + towerHd * (1 - frac);
                    const isLit = ((f * 3 + w * 11) % 5) > 2;
                    ctx.fillStyle = isLit ? 'rgba(110,170,210,0.35)' : 'rgba(80,130,170,0.25)';
                    ctx.fillRect(wx - 4, wy - 4.5, 4, 4.5);
                    ctx.strokeStyle = 'rgba(70,70,70,0.12)';
                    ctx.lineWidth = 0.3;
                    ctx.strokeRect(wx - 4, wy - 4.5, 4, 4.5);
                }
            }
        }

        // --- Color accent stripe (orange/brown band) ---
        if (p > 0.5) {
            // Left face accent stripe at every 3rd floor
            ctx.fillStyle = 'rgba(200,120,50,0.18)';
            const accentFloors = [3, 6];
            for (const af of accentFloors) {
                const fy = af * 7;
                if (fy > totalH) continue;
                ctx.beginPath();
                ctx.moveTo(sx - towerHw, towerBase - fy + 1);
                ctx.lineTo(sx, towerBase - towerHd - fy + 1);
                ctx.lineTo(sx, towerBase - towerHd - fy - 0.5);
                ctx.lineTo(sx - towerHw, towerBase - fy - 0.5);
                ctx.closePath();
                ctx.fill();
            }
        }

        // --- Entrance lobby ---
        if (p > 0.6) {
            const lobbyX = sx - 1, lobbyY = towerBase - towerHd;
            // Glass door panels
            ctx.fillStyle = 'rgba(120,185,230,0.5)';
            ctx.fillRect(lobbyX - 7, lobbyY, 14, 9);
            ctx.strokeStyle = 'rgba(60,100,140,0.4)';
            ctx.lineWidth = 0.4;
            // Door dividers
            for (let d = 0; d < 3; d++) {
                ctx.beginPath();
                ctx.moveTo(lobbyX - 7 + (d + 1) * 3.5, lobbyY);
                ctx.lineTo(lobbyX - 7 + (d + 1) * 3.5, lobbyY + 9);
                ctx.stroke();
            }
            // Canopy
            ctx.fillStyle = '#686e78';
            ctx.fillRect(lobbyX - 10, lobbyY - 2, 20, 2.5);
            ctx.fillStyle = '#585e68';
            ctx.fillRect(lobbyX - 10, lobbyY - 2.5, 20, 0.8);
            // Awning underside shade
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            ctx.fillRect(lobbyX - 10, lobbyY - 0.5, 20, 1.5);
        }

        // --- Rooftop details ---
        if (p >= 1) {
            const roofY = towerBase - towerHd - totalH;
            // Water tank
            ctx.fillStyle = '#788088';
            this._box(ctx, sx - 5, roofY + towerHd * 0.3, 4, 2, 6,
                '#909898', ['#808890','#707880'], ['#687078','#586068']);
            // AC condensers row
            for (let a = 0; a < 3; a++) {
                const ax = sx + 4 + a * 5;
                const ay = roofY + towerHd * 0.6 + a * (-1);
                ctx.fillStyle = '#b8b8b8';
                ctx.fillRect(ax, ay - 3, 3.5, 3);
                ctx.fillStyle = '#a0a0a0';
                ctx.fillRect(ax + 0.5, ay - 2.5, 2.5, 2);
                // Fan circle
                ctx.strokeStyle = '#888';
                ctx.lineWidth = 0.3;
                ctx.beginPath();
                ctx.arc(ax + 1.75, ay - 1.5, 0.8, 0, Math.PI * 2);
                ctx.stroke();
            }
            // Elevator shaft housing
            ctx.fillStyle = '#909498';
            ctx.fillRect(sx - 2, roofY - 4, 4, 5);
            ctx.fillStyle = '#808488';
            ctx.fillRect(sx - 3, roofY - 5, 6, 1.5);
        }

        // --- Building name sign ---
        if (p >= 1) {
            const signY = towerBase - towerHd - totalH * 0.12;
            ctx.fillStyle = 'rgba(40,80,140,0.8)';
            ctx.fillRect(sx - 11, signY - 2, 22, 4);
            ctx.fillStyle = '#f0f0f0';
            ctx.font = 'bold 2.8px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('APARTEMEN', sx, signY + 0.8);
        }
    },

    // --- GEDUNG PENCAKAR LANGIT (Skyscraper, 3x3) ---
    _drawGedungPencakar(ctx, sx, sy, p) {
        const hw = 52, hd = 26;
        const podiumH = 14 * p, totalH = 85 * p;
        const anim = this.animTime || 0;
        const towerHw = hw * 0.55, towerHd = hd * 0.55;
        const towerBase = sy - podiumH;

        this._shadow(ctx, sx, sy, 60, 34);

        // --- GRAND PODIUM (multi-level base) ---
        // Podium level 1 (widest)
        this._box(ctx, sx, sy, hw + 6, hd + 3, 5,
            '#b8b8c0', ['#a8a8b0','#9898a0'], ['#888890','#787880']);
        // Podium level 2
        this._box(ctx, sx, sy - 5, hw + 2, hd + 1, podiumH - 5,
            '#c0c0c8', ['#b0b0b8','#a0a0a8'], ['#909098','#808088']);

        // Podium shop/lobby windows (front, right face)
        if (p > 0.3) {
            for (let s = 0; s < 4; s++) {
                const sx2 = sx + hw * (0.05 + s * 0.22);
                const sy2 = towerBase + hd * (0.85 - s * 0.12) + 2;
                ctx.fillStyle = 'rgba(160,210,240,0.4)';
                ctx.fillRect(sx2, sy2, 5.5, 7);
                ctx.strokeStyle = 'rgba(60,80,100,0.2)';
                ctx.lineWidth = 0.3;
                ctx.strokeRect(sx2, sy2, 5.5, 7);
                ctx.beginPath();
                ctx.moveTo(sx2 + 2.75, sy2); ctx.lineTo(sx2 + 2.75, sy2 + 7);
                ctx.stroke();
            }
        }

        // --- MAIN TOWER (glass curtain wall) ---
        // Left face — blue glass gradient
        const lfGrad = ctx.createLinearGradient(sx - towerHw, towerBase, sx, towerBase - totalH);
        lfGrad.addColorStop(0, '#5888b8');
        lfGrad.addColorStop(0.3, '#6898c8');
        lfGrad.addColorStop(0.7, '#5080b0');
        lfGrad.addColorStop(1, '#4878a8');
        ctx.fillStyle = lfGrad;
        ctx.beginPath();
        ctx.moveTo(sx - towerHw, towerBase);
        ctx.lineTo(sx - towerHw, towerBase - totalH);
        ctx.lineTo(sx, towerBase - towerHd - totalH);
        ctx.lineTo(sx, towerBase - towerHd);
        ctx.closePath();
        ctx.fill();

        // Right face — darker glass gradient
        const rfGrad = ctx.createLinearGradient(sx + towerHw, towerBase, sx, towerBase - totalH);
        rfGrad.addColorStop(0, '#4070a0');
        rfGrad.addColorStop(0.3, '#5080b0');
        rfGrad.addColorStop(0.7, '#3868a0');
        rfGrad.addColorStop(1, '#306090');
        ctx.fillStyle = rfGrad;
        ctx.beginPath();
        ctx.moveTo(sx + towerHw, towerBase);
        ctx.lineTo(sx + towerHw, towerBase - totalH);
        ctx.lineTo(sx, towerBase - towerHd - totalH);
        ctx.lineTo(sx, towerBase - towerHd);
        ctx.closePath();
        ctx.fill();

        // Top face
        ctx.fillStyle = '#6898c8';
        ctx.beginPath();
        ctx.moveTo(sx, towerBase - towerHd - totalH);
        ctx.lineTo(sx + towerHw, towerBase - totalH);
        ctx.lineTo(sx, towerBase + towerHd - totalH);
        ctx.lineTo(sx - towerHw, towerBase - totalH);
        ctx.closePath();
        ctx.fill();

        // --- GLASS PANEL GRID (mullions) ---
        if (p > 0.3) {
            // Horizontal floor lines — left face
            const floorH = 5.5;
            const floors = Math.floor(totalH / floorH);
            ctx.strokeStyle = 'rgba(30,50,80,0.2)';
            ctx.lineWidth = 0.3;
            for (let f = 1; f < floors; f++) {
                const fy = f * floorH;
                ctx.beginPath();
                ctx.moveTo(sx - towerHw, towerBase - fy);
                ctx.lineTo(sx, towerBase - towerHd - fy);
                ctx.stroke();
            }
            // Vertical mullion lines — left face
            for (let c = 1; c < 6; c++) {
                const t = c / 6;
                const mx = sx - towerHw * (1 - t);
                const my = towerBase + towerHd * (1 - t);
                ctx.beginPath();
                ctx.moveTo(mx, my);
                ctx.lineTo(mx, my - totalH);
                ctx.stroke();
            }
            // Right face grid
            for (let f = 1; f < floors; f++) {
                const fy = f * floorH;
                ctx.beginPath();
                ctx.moveTo(sx + towerHw, towerBase - fy);
                ctx.lineTo(sx, towerBase - towerHd - fy);
                ctx.stroke();
            }
            for (let c = 1; c < 6; c++) {
                const t = c / 6;
                const mx = sx + towerHw * (1 - t);
                const my = towerBase + towerHd * (1 - t);
                ctx.beginPath();
                ctx.moveTo(mx, my);
                ctx.lineTo(mx, my - totalH);
                ctx.stroke();
            }
        }

        // --- REFLECTIVE GLASS HIGHLIGHTS (animated sun glare) ---
        if (p > 0.5) {
            const refOffset = Math.sin(anim * 0.25) * totalH * 0.15;
            // Left face — large reflection band
            ctx.save();
            ctx.globalAlpha = 0.08;
            ctx.fillStyle = '#c0e0ff';
            ctx.beginPath();
            const ry1 = towerBase - totalH * 0.25 - refOffset;
            const ry2 = towerBase - totalH * 0.55 - refOffset;
            ctx.moveTo(sx - towerHw * 0.9, ry1 + towerHd * 0.9);
            ctx.lineTo(sx - towerHw * 0.2, ry1 + towerHd * 0.2);
            ctx.lineTo(sx - towerHw * 0.2, ry2 + towerHd * 0.2);
            ctx.lineTo(sx - towerHw * 0.9, ry2 + towerHd * 0.9);
            ctx.closePath();
            ctx.fill();
            // Right face — smaller reflection
            ctx.globalAlpha = 0.06;
            ctx.fillStyle = '#d0e8ff';
            ctx.beginPath();
            const rr1 = towerBase - totalH * 0.35 + refOffset;
            const rr2 = towerBase - totalH * 0.6 + refOffset;
            ctx.moveTo(sx + towerHw * 0.3, rr1 + towerHd * 0.7);
            ctx.lineTo(sx + towerHw * 0.8, rr1 + towerHd * 0.2);
            ctx.lineTo(sx + towerHw * 0.8, rr2 + towerHd * 0.2);
            ctx.lineTo(sx + towerHw * 0.3, rr2 + towerHd * 0.7);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // --- CROWN / TOP SECTION (tapered crown) ---
        if (p > 0.8) {
            const crownH = 8 * p;
            const crownBase = towerBase - totalH;
            const crownHw = towerHw * 0.7, crownHd = towerHd * 0.7;
            // Crown structure
            ctx.fillStyle = '#7098c0';
            ctx.beginPath();
            ctx.moveTo(sx - crownHw, crownBase);
            ctx.lineTo(sx - crownHw * 0.4, crownBase - crownH);
            ctx.lineTo(sx, crownBase - crownHd - crownH);
            ctx.lineTo(sx, crownBase - crownHd);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#5888b0';
            ctx.beginPath();
            ctx.moveTo(sx + crownHw, crownBase);
            ctx.lineTo(sx + crownHw * 0.4, crownBase - crownH);
            ctx.lineTo(sx, crownBase - crownHd - crownH);
            ctx.lineTo(sx, crownBase - crownHd);
            ctx.closePath();
            ctx.fill();
        }

        // --- SPIRE / ANTENNA ---
        if (p >= 1) {
            const spireX = sx;
            const spireBase = towerBase - totalH - 8;
            // Spire tapered body
            ctx.fillStyle = '#a0a0a8';
            ctx.beginPath();
            ctx.moveTo(spireX - 2.5, spireBase);
            ctx.lineTo(spireX, spireBase - 6);
            ctx.lineTo(spireX + 2.5, spireBase);
            ctx.closePath();
            ctx.fill();
            // Antenna mast
            ctx.strokeStyle = '#909090';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(spireX, spireBase - 6);
            ctx.lineTo(spireX, spireBase - 22);
            ctx.stroke();
            // Antenna cross bars
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(spireX - 3, spireBase - 18);
            ctx.lineTo(spireX + 3, spireBase - 18);
            ctx.moveTo(spireX - 2, spireBase - 14);
            ctx.lineTo(spireX + 2, spireBase - 14);
            ctx.moveTo(spireX - 1.5, spireBase - 10);
            ctx.lineTo(spireX + 1.5, spireBase - 10);
            ctx.stroke();

            // Blinking aviation light
            const blink = Math.sin(anim * 3) > 0;
            if (blink) {
                ctx.fillStyle = 'rgba(255,30,30,0.9)';
                ctx.beginPath();
                ctx.arc(spireX, spireBase - 22, 1.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(255,60,60,0.2)';
                ctx.beginPath();
                ctx.arc(spireX, spireBase - 22, 5, 0, Math.PI * 2);
                ctx.fill();
            }
            // Secondary blink mid-tower
            const blink2 = Math.sin(anim * 2.5 + 1) > 0.3;
            if (blink2) {
                ctx.fillStyle = 'rgba(255,40,40,0.5)';
                ctx.beginPath();
                ctx.arc(sx - towerHw - 1, towerBase - totalH * 0.5, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // --- GRAND LOBBY ENTRANCE ---
        if (p > 0.6) {
            const lobbyY = towerBase - towerHd;
            // Grand glass facade
            const lgGrad = ctx.createLinearGradient(sx - 10, lobbyY, sx + 10, lobbyY + 12);
            lgGrad.addColorStop(0, 'rgba(100,170,220,0.55)');
            lgGrad.addColorStop(1, 'rgba(80,140,190,0.45)');
            ctx.fillStyle = lgGrad;
            ctx.fillRect(sx - 10, lobbyY, 20, 12);
            // Door divisions
            ctx.strokeStyle = 'rgba(40,80,120,0.4)';
            ctx.lineWidth = 0.5;
            for (let d = 0; d < 5; d++) {
                ctx.beginPath();
                ctx.moveTo(sx - 10 + d * 4, lobbyY);
                ctx.lineTo(sx - 10 + d * 4, lobbyY + 12);
                ctx.stroke();
            }
            // Horizontal bar
            ctx.beginPath();
            ctx.moveTo(sx - 10, lobbyY + 6);
            ctx.lineTo(sx + 10, lobbyY + 6);
            ctx.stroke();
            // Grand canopy (isometric triangular)
            ctx.fillStyle = '#606870';
            ctx.beginPath();
            ctx.moveTo(sx - 16, lobbyY - 1);
            ctx.lineTo(sx, lobbyY - 6);
            ctx.lineTo(sx + 16, lobbyY - 1);
            ctx.lineTo(sx + 16, lobbyY + 0.5);
            ctx.lineTo(sx, lobbyY - 4.5);
            ctx.lineTo(sx - 16, lobbyY + 0.5);
            ctx.closePath();
            ctx.fill();
            // Canopy underside
            ctx.fillStyle = 'rgba(0,0,0,0.08)';
            ctx.beginPath();
            ctx.moveTo(sx - 15, lobbyY); ctx.lineTo(sx, lobbyY - 4);
            ctx.lineTo(sx + 15, lobbyY); ctx.lineTo(sx + 15, lobbyY + 1);
            ctx.lineTo(sx, lobbyY - 3); ctx.lineTo(sx - 15, lobbyY + 1);
            ctx.closePath();
            ctx.fill();
        }

        // --- PODIUM LANDSCAPING ---
        if (p >= 1) {
            // Trees
            this._treeSmall(ctx, sx - hw - 4, sy + hd * 0.2, 12, '#5a3a1a', '#40a040');
            this._treeSmall(ctx, sx + hw + 4, sy - hd * 0.1, 12, '#5a3a1a', '#38a838');
            this._treeSmall(ctx, sx - hw * 0.5, sy + hd + 2, 10, '#5a3a1a', '#48a840');

            // Decorative fountain in front of podium
            const fnX = sx + hw * 0.15, fnY = sy + hd + 4;
            ctx.fillStyle = 'rgba(100,160,210,0.3)';
            ctx.beginPath();
            ctx.ellipse(fnX, fnY, 5, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#a0a0a0';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.ellipse(fnX, fnY, 5, 2.5, 0, 0, Math.PI * 2);
            ctx.stroke();
            // Fountain spray
            const spray = Math.sin(anim * 2) * 0.5;
            ctx.strokeStyle = 'rgba(120,180,230,0.35)';
            ctx.lineWidth = 0.4;
            ctx.beginPath();
            ctx.moveTo(fnX, fnY - 1);
            ctx.lineTo(fnX + spray, fnY - 5);
            ctx.moveTo(fnX, fnY - 1);
            ctx.lineTo(fnX - spray * 0.7, fnY - 4);
            ctx.moveTo(fnX, fnY - 1);
            ctx.lineTo(fnX + spray * 0.5, fnY - 3.5);
            ctx.stroke();
        }

        // --- NIGHT WINDOW GLOW (some windows lit, some dark) ---
        if (p >= 1) {
            const floorH = 5.5;
            const floors = Math.floor(totalH / floorH);
            for (let f = 2; f < floors; f++) {
                for (let c = 1; c < 5; c++) {
                    const isLit = ((f * 7 + c * 13) % 11) > 4;
                    if (!isLit) continue;
                    const t = c / 6;
                    const wx = sx - towerHw * (1 - t);
                    const wy = towerBase + towerHd * (1 - t) - f * floorH;
                    ctx.fillStyle = 'rgba(255,240,180,0.06)';
                    ctx.fillRect(wx + 0.5, wy - floorH + 1, 3, floorH - 1.5);
                }
            }
        }
    },

    // --- GENERIC FALLBACK ---
    _drawGeneric(ctx, sx, sy, bData, p) {
        const size = bData.size || 1;
        // Scale building dimensions based on tile size
        const sizeScale = { 1: { hw: 22, hd: 11 }, 2: { hw: 36, hd: 18 }, 3: { hw: 50, hd: 25 }, 4: { hw: 64, hd: 32 } };
        const dims = sizeScale[size] || sizeScale[1];
        const hw = dims.hw;
        const hd = dims.hd;
        const h = (bData.height || 20) * p;

        this._shadow(ctx, sx, sy, hw + 4, hd + 3);

        // For tall buildings (>40), draw a base section and a tower section for visual depth
        if (h > 40) {
            // Base podium
            const baseH = 12 * p;
            this._box(ctx, sx, sy, hw + 4, hd + 2, baseH,
                this._lighten(bData.colors.top, 10),
                [bData.colors.left, this._darken(bData.colors.left, 10)],
                [bData.colors.right, this._darken(bData.colors.right, 10)]);
            
            // Tower
            const towerHw = hw * 0.7;
            const towerHd = hd * 0.7;
            this._box(ctx, sx, sy - baseH, towerHw, towerHd, h - baseH,
                bData.colors.top,
                [bData.colors.left, this._darken(bData.colors.left, 20)],
                [bData.colors.right, this._darken(bData.colors.right, 20)]);

            // Windows on tower
            const windowRows = Math.floor((h - baseH) / 8);
            ctx.fillStyle = 'rgba(180,220,255,0.4)';
            for (let row = 1; row <= windowRows; row++) {
                const wy = sy - baseH - row * 7;
                // Left face windows
                ctx.fillRect(sx - towerHw * 0.6, wy + towerHd * 0.3, 3, 4);
                ctx.fillRect(sx - towerHw * 0.3, wy + towerHd * 0.15, 3, 4);
                // Right face windows
                ctx.fillRect(sx + towerHw * 0.15, wy + towerHd * 0.15, 3, 4);
                ctx.fillRect(sx + towerHw * 0.45, wy + towerHd * 0.3, 3, 4);
            }

            if (bData.roofColors) {
                this._hipRoof(ctx, sx, sy - baseH, towerHw, towerHd, h - baseH, 8 * p, 3,
                    bData.roofColors.left, bData.roofColors.right, bData.roofColors.top);
            }
        } else {
            this._box(ctx, sx, sy, hw, hd, h,
                bData.colors.top,
                [bData.colors.left, this._darken(bData.colors.left, 20)],
                [bData.colors.right, this._darken(bData.colors.right, 20)]);

            // Windows for medium buildings
            if (h > 15) {
                const windowRows = Math.floor(h / 10);
                ctx.fillStyle = 'rgba(180,220,255,0.35)';
                for (let row = 1; row <= windowRows; row++) {
                    const wy = sy - row * 8;
                    ctx.fillRect(sx - hw * 0.5, wy + hd * 0.3, 3, 3);
                    ctx.fillRect(sx + hw * 0.2, wy + hd * 0.2, 3, 3);
                }
            }

            if (bData.roofColors) {
                this._hipRoof(ctx, sx, sy, hw, hd, h, 10 * p, 4,
                    bData.roofColors.left, bData.roofColors.right, bData.roofColors.top);
            }
        }
    },

    // (_lighten already defined above)

    // ==============================
    //  PEOPLE
    // ==============================
    spawnPeople(count) {
        while (this.people.length < count && this.people.length < 150) {
            const bldgs = Game.getBuildingList();
            if (bldgs.length === 0) break;
            const from = bldgs[Math.floor(Math.random() * bldgs.length)];
            const to = bldgs[Math.floor(Math.random() * bldgs.length)];
            const skinTones = ['#deb887','#c68c53','#8d5524','#f1c27d','#e0ac69'];
            const shirtColors = ['#e04050','#4080d0','#40a040','#d0a030','#8040b0','#d06030','#30a0a0'];
            this.people.push({
                fromX: from.x, fromY: from.y, toX: to.x, toY: to.y,
                progress: 0, speed: 0.003 + Math.random() * 0.005,
                skin: skinTones[Math.floor(Math.random() * skinTones.length)],
                shirt: shirtColors[Math.floor(Math.random() * shirtColors.length)],
                hat: Math.random() > 0.6
            });
        }
    },

    updatePeople() {
        for (let i = this.people.length - 1; i >= 0; i--) {
            const p = this.people[i];
            p.progress += p.speed;
            if (p.progress >= 1) {
                const bldgs = Game.getBuildingList();
                if (bldgs.length > 0) {
                    const to = bldgs[Math.floor(Math.random() * bldgs.length)];
                    p.fromX = p.toX; p.fromY = p.toY;
                    p.toX = to.x; p.toY = to.y;
                    p.progress = 0;
                } else {
                    this.people.splice(i, 1);
                }
            }
        }
    },

    renderPeople(ctx) {
        this.updatePeople();
        for (const p of this.people) {
            const cx = p.fromX + (p.toX - p.fromX) * p.progress;
            const cy = p.fromY + (p.toY - p.fromY) * p.progress;
            const scr = this.tileToScreen(cx, cy);
            const sx = scr.x, sy = scr.y;
            const walk = Math.sin(this.animTime * 10 + p.fromX * 3) * 1.5;

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            ctx.beginPath();
            ctx.ellipse(sx, sy + 1, 3, 1.2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Legs
            ctx.strokeStyle = '#4a3a2a';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(sx - 1.2, sy - 3); ctx.lineTo(sx - 1.2 + walk * 0.5, sy);
            ctx.moveTo(sx + 1.2, sy - 3); ctx.lineTo(sx + 1.2 - walk * 0.5, sy);
            ctx.stroke();

            // Body
            ctx.fillStyle = p.shirt;
            ctx.beginPath();
            ctx.ellipse(sx, sy - 5.5, 2.5, 3, 0, 0, Math.PI * 2);
            ctx.fill();

            // Arms
            ctx.strokeStyle = p.shirt;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx - 2.5, sy - 6); ctx.lineTo(sx - 3.5 - walk * 0.3, sy - 3);
            ctx.moveTo(sx + 2.5, sy - 6); ctx.lineTo(sx + 3.5 + walk * 0.3, sy - 3);
            ctx.stroke();

            // Skin (arms)
            ctx.strokeStyle = p.skin;
            ctx.beginPath();
            ctx.moveTo(sx - 3.5 - walk * 0.3, sy - 3);
            ctx.lineTo(sx - 3.5 - walk * 0.3, sy - 1.5);
            ctx.moveTo(sx + 3.5 + walk * 0.3, sy - 3);
            ctx.lineTo(sx + 3.5 + walk * 0.3, sy - 1.5);
            ctx.stroke();

            // Head
            ctx.fillStyle = p.skin;
            ctx.beginPath();
            ctx.arc(sx, sy - 9.5, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Hair
            ctx.fillStyle = '#2a1a0a';
            ctx.beginPath();
            ctx.arc(sx, sy - 10.5, 2.5, Math.PI * 1.2, Math.PI * 1.8);
            ctx.fill();

            // Hat (farmer)
            if (p.hat) {
                ctx.fillStyle = '#c8a860';
                ctx.beginPath();
                ctx.ellipse(sx, sy - 11.5, 4, 1.5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#b89850';
                ctx.fillRect(sx - 2, sy - 13, 4, 2);
            }
        }
    },

    // ==============================
    //  BUTTERFLIES
    // ==============================
    renderButterflies(ctx) {
        for (const b of this.butterflies) {
            b.phase += b.speed;
            b.x += Math.sin(b.phase * 0.7) * 0.02;
            b.y += Math.cos(b.phase * 0.5) * 0.015;

            // Wrap around
            if (b.x < 0) b.x = GameData.MAP_SIZE;
            if (b.x > GameData.MAP_SIZE) b.x = 0;
            if (b.y < 0) b.y = GameData.MAP_SIZE;
            if (b.y > GameData.MAP_SIZE) b.y = 0;

            const scr = this.tileToScreen(b.x, b.y);
            const wingSpan = Math.abs(Math.sin(b.phase * 4)) * 3;

            ctx.fillStyle = b.color;
            ctx.globalAlpha = 0.7;
            // Left wing
            ctx.beginPath();
            ctx.ellipse(scr.x - wingSpan, scr.y - 14, wingSpan, 1.5, -0.3, 0, Math.PI * 2);
            ctx.fill();
            // Right wing
            ctx.beginPath();
            ctx.ellipse(scr.x + wingSpan, scr.y - 14, wingSpan, 1.5, 0.3, 0, Math.PI * 2);
            ctx.fill();
            // Body
            ctx.fillStyle = '#303030';
            ctx.fillRect(scr.x - 0.3, scr.y - 16, 0.6, 3);
            ctx.globalAlpha = 1;
        }
    },

    // ==============================
    //  PARTICLES
    // ==============================
    addParticle(tileX, tileY, type) {
        const scr = this.tileToScreen(tileX, tileY);
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: scr.x, y: scr.y - 10,
                vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 3 - 1,
                life: 1, decay: 0.012 + Math.random() * 0.008,
                color: type === 'build' ? '#7eb8e0' : type === 'positive' ? '#5ab87a' : '#e08080',
                size: 2 + Math.random() * 3
            });
        }
    },

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx; p.y += p.vy;
            p.vy += 0.04; p.life -= p.decay;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    },

    renderParticles(ctx) {
        this.updateParticles();
        for (const p of this.particles) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    },

    // ==============================
    //  MAIN RENDER
    // ==============================
    render(dt) {
        this.animTime += dt;
        // Cap animTime to avoid floating-point precision loss after long sessions
        // 6283 ≈ 1000 * 2π, so all sin/cos animations remain seamless
        if (this.animTime > 6283) this.animTime -= 6283;
        const ctx = this.ctx;
        const w = this.canvas.width, h = this.canvas.height;

        // Sky gradient (warm & bright)
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, '#6cb4e6');
        sky.addColorStop(0.3, '#8cc8f0');
        sky.addColorStop(0.6, '#a8d8f4');
        sky.addColorStop(1, '#c8e8f8');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);

        // Sun
        ctx.fillStyle = 'rgba(255,240,180,0.4)';
        ctx.beginPath();
        ctx.arc(w * 0.85, 60, 35, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,250,220,0.6)';
        ctx.beginPath();
        ctx.arc(w * 0.85, 60, 20, 0, Math.PI * 2);
        ctx.fill();

        // Clouds
        this.renderClouds(ctx, w);

        ctx.save();
        ctx.translate(this.camera.x, this.camera.y);
        ctx.scale(this.camera.zoom, this.camera.zoom);

        // Viewport bounds for culling
        const vpLeft = -this.camera.x / this.camera.zoom - 100;
        const vpTop = -this.camera.y / this.camera.zoom - 100;
        const vpRight = vpLeft + w / this.camera.zoom + 200;
        const vpBottom = vpTop + h / this.camera.zoom + 200;

        // === PASS 1: Tiles ===
        for (let y = 0; y < GameData.MAP_SIZE; y++) {
            for (let x = 0; x < GameData.MAP_SIZE; x++) {
                const scr = this.tileToScreen(x, y);
                if (scr.x < vpLeft || scr.x > vpRight || scr.y < vpTop || scr.y > vpBottom) continue;
                try {
                    this.renderTile(ctx, x, y);
                } catch (e) {
                    // skip broken tile, don't crash
                }
            }
        }

        // === PASS 2: Forest trees + Buildings (back to front for depth) ===
        for (let y = 0; y < GameData.MAP_SIZE; y++) {
            for (let x = 0; x < GameData.MAP_SIZE; x++) {
                const scr = this.tileToScreen(x, y);
                if (scr.x < vpLeft - 100 || scr.x > vpRight + 100 || scr.y < vpTop - 150 || scr.y > vpBottom + 30) continue;

                try {
                    // Forest trees (use sprites if available)
                    if (Game.map.tiles[y * GameData.MAP_SIZE + x] === GameData.TILE.FOREST) {
                        if (!this.spritesLoaded || !this._renderTreeSprite(ctx, scr.x, scr.y, x, y)) {
                            this._treeLarge(ctx, scr.x, scr.y - 4, x * 100 + y);
                        }
                    }

                    // Buildings
                    const building = Game.map.buildings[y * GameData.MAP_SIZE + x];
                    if (building && building.id && building.originX === x && building.originY === y) {
                        this.renderBuilding(ctx, x, y, building);
                    }
                } catch (e) {
                    // skip broken item, don't crash
                }
            }
        }

        // === PASS 3: People ===
        try { this.renderPeople(ctx); } catch(e) {}

        // === PASS 4: Butterflies ===
        try { this.renderButterflies(ctx); } catch(e) {}

        // === PASS 5: Hover / Placement ===
        try {
            this.renderHover(ctx);
            if (Game.selectedBuilding) this.renderPlacementPreview(ctx);
        } catch(e) {}

        // === PASS 6: Particles ===
        this.renderParticles(ctx);

        ctx.restore();

        // Mini map
        this.renderMiniMap();
    },

    renderClouds(ctx, w) {
        for (const c of this.clouds) {
            c.x += c.speed;
            if (c.x > w + 300) c.x = -c.w - 100;

            ctx.fillStyle = `rgba(255,255,255,${c.opacity})`;
            ctx.beginPath();
            ctx.ellipse(c.x, c.y, c.w * 0.5, 12, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(c.x - c.w * 0.2, c.y + 4, c.w * 0.35, 10, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(c.x + c.w * 0.25, c.y + 3, c.w * 0.3, 8, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    renderHover(ctx) {
        const hx = this.hoverTile.x, hy = this.hoverTile.y;
        if (hx < 0 || hy < 0 || hx >= GameData.MAP_SIZE || hy >= GameData.MAP_SIZE) return;
        if (Game.selectedBuilding) return;

        const scr = this.tileToScreen(hx, hy);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        this._tileDiamond(ctx, scr.x, scr.y, this.TW, this.TH);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        this._tileDiamond(ctx, scr.x, scr.y, this.TW, this.TH);
        ctx.fill();
    },

    renderPlacementPreview(ctx) {
        const hx = this.hoverTile.x, hy = this.hoverTile.y;
        if (hx < 0 || hy < 0 || hx >= GameData.MAP_SIZE || hy >= GameData.MAP_SIZE) return;
        const bData = GameData.BUILDINGS[Game.selectedBuilding];
        if (!bData) return;

        const size = bData.size || 1;
        const canPlace = Game.canPlaceAt(hx, hy, bData);

        for (let dy = 0; dy < size; dy++) {
            for (let dx = 0; dx < size; dx++) {
                const tx = hx + dx, ty = hy + dy;
                if (tx >= GameData.MAP_SIZE || ty >= GameData.MAP_SIZE) continue;
                const scr = this.tileToScreen(tx, ty);

                ctx.fillStyle = canPlace ? 'rgba(90,184,122,0.35)' : 'rgba(196,90,90,0.35)';
                ctx.strokeStyle = canPlace ? 'rgba(90,184,122,0.8)' : 'rgba(196,90,90,0.8)';
                ctx.lineWidth = 2;
                this._tileDiamond(ctx, scr.x, scr.y, this.TW, this.TH);
                ctx.fill();
                this._tileDiamond(ctx, scr.x, scr.y, this.TW, this.TH);
                ctx.stroke();
            }
        }

        // Ghost building
        if (canPlace) {
            ctx.globalAlpha = 0.5 + Math.sin(this.animTime * 3) * 0.15;
            this.renderBuilding(ctx, hx, hy, { id: Game.selectedBuilding, originX: hx, originY: hy });
            ctx.globalAlpha = 1;
        }
    },

    renderMiniMap() {
        const mCtx = this.miniCtx;
        const mW = this.miniCanvas.width, mH = this.miniCanvas.height;
        const scale = mW / GameData.MAP_SIZE;

        mCtx.fillStyle = '#1a2a3a';
        mCtx.fillRect(0, 0, mW, mH);

        for (let y = 0; y < GameData.MAP_SIZE; y++) {
            for (let x = 0; x < GameData.MAP_SIZE; x++) {
                const t = Game.map.tiles[y * GameData.MAP_SIZE + x];
                const b = Game.map.buildings[y * GameData.MAP_SIZE + x];

                if (b && b.id && !GameData.BUILDINGS[b.id]?.isTile) {
                    const bd = GameData.BUILDINGS[b.id];
                    mCtx.fillStyle = bd ? bd.colors.top : '#888';
                } else {
                    const colorMap = {
                        0: '#5aab45', 1: '#2d7030', 2: '#3a80c0',
                        3: '#a08558', 4: '#7a8088', 5: '#6aaa38'
                    };
                    mCtx.fillStyle = colorMap[t] || '#333';
                }
                mCtx.fillRect(x * scale, y * scale, scale + 0.5, scale + 0.5);
            }
        }

        // Viewport
        const vx = (-this.camera.x / this.camera.zoom) / this.TW * scale * 0.7;
        const vy = (-this.camera.y / this.camera.zoom) / this.TH * scale * 0.7;
        const vw = (this.canvas.width / this.camera.zoom) / this.TW * scale * 0.5;
        const vh = (this.canvas.height / this.camera.zoom) / this.TH * scale * 0.5;
        mCtx.strokeStyle = 'rgba(255,255,255,0.5)';
        mCtx.lineWidth = 1.5;
        mCtx.strokeRect(vx, vy, vw, vh);
    }
};
