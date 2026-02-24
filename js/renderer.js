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
        const sp = document.getElementById('side-panel');
        this.canvas.width = window.innerWidth - (sp ? sp.offsetWidth : 260);
        this.canvas.height = window.innerHeight - 52;
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

    // Subtle grass detail overlay (on top of sprite)
    _addGrassDetails(ctx, sx, sy, tx, ty) {
        const rng = this._seededRandom(tx * 31 + ty * 17);
        if (rng() > 0.7) {
            // Small flower
            ctx.fillStyle = rng() > 0.5 ? '#e8e060' : '#e080a0';
            ctx.beginPath();
            ctx.arc(sx + (rng() - 0.5) * 18, sy + (rng() - 0.5) * 6, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    // Water animation overlay (on top of sprite)
    _addWaterEffects(ctx, sx, sy, tx, ty) {
        const wave = Math.sin(this.animTime * 1.5 + tx * 0.7 + ty * 0.5);
        const wave2 = Math.sin(this.animTime * 2.2 + tx * 0.3 - ty * 0.8);

        // Shimmer/reflection
        ctx.fillStyle = `rgba(180,220,255,${0.12 + wave2 * 0.06})`;
        ctx.beginPath();
        ctx.ellipse(sx + wave * 3, sy - 2 + wave2 * 1.5, 7, 2, 0.3, 0, Math.PI * 2);
        ctx.fill();

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

    // Render forest tree — hybrid sprite + canvas with high variation
    _renderTreeSprite(ctx, sx, sy, tx, ty) {
        const rng = this._seededRandom(tx * 137 + ty * 59);
        const typeRoll = rng();
        const ox = (rng() - 0.5) * 12;
        const oy = (rng() - 0.5) * 5;
        const px = sx + ox, py = sy + oy;
        const anim = this.animTime || 0;

        // Ground details (grass tufts, small stones, fallen leaves)
        this._groundDetail(ctx, px, py, rng);

        // Decide tree variety (10 types)
        if (typeRoll < 0.15) {
            // Sprite: treeTall
            return this._drawSpriteTree(ctx, px, py, 'treeTall', rng, anim);
        } else if (typeRoll < 0.25) {
            // Sprite: coniferTall
            return this._drawSpriteTree(ctx, px, py, 'coniferTall', rng, anim);
        } else if (typeRoll < 0.33) {
            // Sprite: coniferAltTall
            return this._drawSpriteTree(ctx, px, py, 'coniferAltTall', rng, anim);
        } else if (typeRoll < 0.40) {
            // Sprite: coniferShort
            return this._drawSpriteTree(ctx, px, py, 'coniferShort', rng, anim);
        } else if (typeRoll < 0.46) {
            // Sprite: coniferAltShort
            return this._drawSpriteTree(ctx, px, py, 'coniferAltShort', rng, anim);
        } else if (typeRoll < 0.56) {
            // Canvas: Tropical / Banyan tree
            this._treeBanyan(ctx, px, py, rng, anim);
            return true;
        } else if (typeRoll < 0.64) {
            // Canvas: Birch tree
            this._treeBirch(ctx, px, py, rng, anim);
            return true;
        } else if (typeRoll < 0.72) {
            // Canvas: Bamboo cluster
            this._treeBamboo(ctx, px, py, rng, anim);
            return true;
        } else if (typeRoll < 0.80) {
            // Canvas: Flowering tree
            this._treeFlowering(ctx, px, py, rng, anim);
            return true;
        } else if (typeRoll < 0.88) {
            // Canvas: Acacia / spreading tree
            this._treeAcacia(ctx, px, py, rng, anim);
            return true;
        } else {
            // Canvas: Dense bush / shrub
            this._treeBush(ctx, px, py, rng, anim);
            return true;
        }
    },

    // Draw a sprite-based tree with color tinting and sway
    _drawSpriteTree(ctx, px, py, spriteKey, rng, anim) {
        const sprite = this.spriteImages[spriteKey];
        if (!sprite) return false;

        const targetHeight = 50 + rng() * 25;
        const treeScale = targetHeight / sprite.height;
        const w = sprite.width * treeScale;
        const h = sprite.height * treeScale;

        // Subtle sway
        const sway = Math.sin(anim * 0.6 + px * 0.05) * 1.2;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(px, py + 2, w * 0.45, h * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw with slight tint variation
        ctx.save();
        ctx.translate(px, py - h + 4);
        ctx.transform(1, 0, sway * 0.01, 1, 0, 0); // subtle skew for sway
        ctx.drawImage(sprite, -w / 2, 0, w, h);
        ctx.restore();

        return true;
    },

    // Ground details: grass tufts, small stones, fallen leaves
    _groundDetail(ctx, px, py, rng) {
        const detailType = rng();
        if (detailType < 0.4) {
            // Grass tufts
            const tufts = 2 + Math.floor(rng() * 3);
            for (let i = 0; i < tufts; i++) {
                const gx = px + (rng() - 0.5) * 16;
                const gy = py + (rng() - 0.5) * 6;
                const gh = 3 + rng() * 3;
                ctx.strokeStyle = rng() > 0.5 ? '#4a8a30' : '#5a9a38';
                ctx.lineWidth = 0.7;
                ctx.beginPath();
                ctx.moveTo(gx, gy);
                ctx.lineTo(gx - 1.5, gy - gh);
                ctx.moveTo(gx + 1, gy);
                ctx.lineTo(gx + 2, gy - gh * 0.8);
                ctx.moveTo(gx - 1, gy);
                ctx.lineTo(gx - 3, gy - gh * 0.6);
                ctx.stroke();
            }
        } else if (detailType < 0.6) {
            // Small stones
            ctx.fillStyle = 'rgba(130,120,100,0.4)';
            ctx.beginPath();
            ctx.ellipse(px + (rng() - 0.5) * 10, py + rng() * 3, 2, 1.2, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (detailType < 0.8) {
            // Fallen leaves
            const leafColors = ['rgba(140,100,30,0.3)', 'rgba(180,130,40,0.25)', 'rgba(100,80,20,0.3)'];
            for (let i = 0; i < 3; i++) {
                ctx.fillStyle = leafColors[i % leafColors.length];
                ctx.beginPath();
                ctx.ellipse(px + (rng() - 0.5) * 14, py + (rng() - 0.3) * 5, 1.8, 1, rng() * Math.PI, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        // else: bare ground, no decoration
    },

    // === BANYAN / Large tropical tree ===
    _treeBanyan(ctx, x, y, rng, anim) {
        const h = 28 + rng() * 15;
        const sway = Math.sin(anim * 0.4 + x * 0.03) * 1;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(x, y + 2, 14, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main trunk (thick, gnarled)
        const tw = 3.5 + rng() * 1.5;
        ctx.fillStyle = '#5a4020';
        ctx.beginPath();
        ctx.moveTo(x - tw, y);
        ctx.quadraticCurveTo(x - tw * 0.8, y - h * 0.3, x - tw * 0.5 + sway * 0.3, y - h * 0.55);
        ctx.lineTo(x + tw * 0.5 + sway * 0.3, y - h * 0.55);
        ctx.quadraticCurveTo(x + tw * 0.8, y - h * 0.3, x + tw, y);
        ctx.closePath();
        ctx.fill();

        // Bark texture lines
        ctx.strokeStyle = 'rgba(80,50,15,0.3)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 3; i++) {
            const lx = x + (rng() - 0.5) * tw;
            ctx.beginPath();
            ctx.moveTo(lx, y - h * 0.1);
            ctx.lineTo(lx + sway * 0.2, y - h * 0.5);
            ctx.stroke();
        }

        // Aerial roots
        ctx.strokeStyle = '#6a5030';
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 3; i++) {
            const rx = x + (rng() - 0.5) * 10 + sway * 0.5;
            ctx.beginPath();
            ctx.moveTo(rx, y - h * 0.4);
            ctx.quadraticCurveTo(rx + (rng() - 0.5) * 4, y - h * 0.15, rx + (rng() - 0.5) * 2, y);
            ctx.stroke();
        }

        // Large, layered canopy
        const greens = ['#1a6820', '#247828', '#2e8830', '#389838', '#42a840'];
        for (let i = 0; i < 6; i++) {
            const cx = x + (rng() - 0.5) * 12 + sway;
            const cy = y - h * 0.55 - rng() * h * 0.3;
            const r = 7 + rng() * 7;
            ctx.fillStyle = greens[Math.floor(rng() * greens.length)];
            ctx.beginPath();
            ctx.ellipse(cx, cy, r, r * 0.7, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Light dapples
        ctx.fillStyle = 'rgba(180,230,100,0.2)';
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(x + (rng() - 0.5) * 10 + sway, y - h * 0.6 - rng() * h * 0.2, 3 + rng() * 2, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    // === BIRCH tree (white trunk, delicate leaves) ===
    _treeBirch(ctx, x, y, rng, anim) {
        const h = 26 + rng() * 12;
        const sway = Math.sin(anim * 0.7 + x * 0.04) * 1.5;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.ellipse(x, y + 2, 8, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // White trunk with dark marks
        ctx.fillStyle = '#e8e0d0';
        ctx.beginPath();
        ctx.moveTo(x - 1.8, y);
        ctx.lineTo(x - 1.2 + sway * 0.15, y - h * 0.7);
        ctx.lineTo(x + 1.2 + sway * 0.15, y - h * 0.7);
        ctx.lineTo(x + 1.8, y);
        ctx.closePath();
        ctx.fill();

        // Bark marks
        ctx.fillStyle = 'rgba(60,50,40,0.35)';
        for (let i = 0; i < 5; i++) {
            const my = y - h * (0.1 + rng() * 0.55);
            ctx.fillRect(x - 1.5, my, 3, 1);
        }

        // Delicate drooping branches
        const leafColors = ['#6ab838', '#78c848', '#84d450', '#5aaa30'];
        for (let i = 0; i < 5; i++) {
            const bx = x + sway * (0.5 + i * 0.1);
            const by = y - h * (0.45 + rng() * 0.35);
            const bendX = bx + (rng() - 0.5) * 16;
            const bendY = by + 6 + rng() * 8;

            ctx.strokeStyle = '#90a060';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.quadraticCurveTo(bendX, by + 2, bendX, bendY);
            ctx.stroke();

            // Leaf clusters along branch
            ctx.fillStyle = leafColors[i % leafColors.length];
            for (let j = 0; j < 4; j++) {
                const t = j / 3;
                const lx = bx + (bendX - bx) * t;
                const ly = by + (bendY - by) * t * t;
                ctx.beginPath();
                ctx.ellipse(lx, ly, 3.5 + rng(), 2.5 + rng(), rng(), 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Top canopy
        ctx.fillStyle = '#5ab030';
        ctx.beginPath();
        ctx.ellipse(x + sway, y - h * 0.75, 6, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#70c840';
        ctx.beginPath();
        ctx.ellipse(x + sway - 2, y - h * 0.8, 4, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
    },

    // === BAMBOO cluster ===
    _treeBamboo(ctx, x, y, rng, anim) {
        const stalks = 4 + Math.floor(rng() * 4);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.beginPath();
        ctx.ellipse(x, y + 1, 8 + stalks, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        for (let i = 0; i < stalks; i++) {
            const bx = x + (rng() - 0.5) * 12;
            const h = 20 + rng() * 18;
            const sway = Math.sin(anim * 0.9 + i * 1.5 + bx * 0.05) * 2.5;

            // Stalk (segmented)
            const segments = 4 + Math.floor(rng() * 3);
            const stalkColor = rng() > 0.5 ? '#5a8a30' : '#4a7a28';
            const nodeColor = '#6a9a38';
            ctx.strokeStyle = stalkColor;
            ctx.lineWidth = 1.8 + rng() * 0.5;

            let prevX = bx, prevY = y;
            for (let s = 1; s <= segments; s++) {
                const t = s / segments;
                const nx = bx + sway * t * t;
                const ny = y - h * t;
                ctx.beginPath();
                ctx.moveTo(prevX, prevY);
                ctx.lineTo(nx, ny);
                ctx.stroke();

                // Node ring
                ctx.fillStyle = nodeColor;
                ctx.fillRect(nx - 2, ny, 4, 1.5);
                prevX = nx;
                prevY = ny;
            }

            // Leaf sprays at top and nodes
            if (rng() > 0.3) {
                const lx = bx + sway;
                const ly = y - h;
                ctx.fillStyle = rng() > 0.5 ? '#48882a' : '#58a832';
                for (let l = 0; l < 3; l++) {
                    const angle = (rng() - 0.5) * Math.PI * 0.8;
                    const leafLen = 6 + rng() * 5;
                    ctx.beginPath();
                    ctx.ellipse(
                        lx + Math.cos(angle) * leafLen * 0.6,
                        ly + Math.sin(angle) * leafLen * 0.3 - 2,
                        leafLen * 0.5, 1.5, angle, 0, Math.PI * 2
                    );
                    ctx.fill();
                }
            }
        }
    },

    // === FLOWERING tree (tropical, with flowers) ===
    _treeFlowering(ctx, x, y, rng, anim) {
        const h = 22 + rng() * 10;
        const sway = Math.sin(anim * 0.5 + x * 0.04) * 1;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.14)';
        ctx.beginPath();
        ctx.ellipse(x, y + 2, 10, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Trunk
        ctx.fillStyle = '#6a4828';
        const tw = 2.2 + rng();
        ctx.beginPath();
        ctx.moveTo(x - tw, y);
        ctx.quadraticCurveTo(x - tw * 0.6 + sway * 0.2, y - h * 0.4, x - 1 + sway * 0.3, y - h * 0.6);
        ctx.lineTo(x + 1 + sway * 0.3, y - h * 0.6);
        ctx.quadraticCurveTo(x + tw * 0.6 + sway * 0.2, y - h * 0.4, x + tw, y);
        ctx.closePath();
        ctx.fill();

        // Branches
        ctx.strokeStyle = '#5a3a1a';
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 3; i++) {
            const bx = x + (rng() - 0.5) * 4 + sway * 0.3;
            const by = y - h * (0.4 + rng() * 0.2);
            const ex = bx + (rng() - 0.5) * 14;
            const ey = by - 4 - rng() * 6;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.quadraticCurveTo((bx + ex) / 2, ey - 3, ex, ey);
            ctx.stroke();
        }

        // Foliage clusters
        const leafColors = ['#2a7828', '#388838', '#309830'];
        for (let i = 0; i < 5; i++) {
            ctx.fillStyle = leafColors[i % leafColors.length];
            ctx.beginPath();
            ctx.ellipse(
                x + (rng() - 0.5) * 14 + sway,
                y - h * 0.55 - rng() * h * 0.3,
                5 + rng() * 4, 4 + rng() * 3,
                rng(), 0, Math.PI * 2
            );
            ctx.fill();
        }

        // Flowers (colorful dots)
        const flowerPalettes = [
            ['#e85080', '#f070a0', '#ff90b0'],  // pink
            ['#e0a020', '#f0c040', '#ffe060'],  // yellow
            ['#c040d0', '#d060e0', '#e080f0'],  // purple
            ['#e04040', '#f06050', '#ff8060'],  // red-orange
        ];
        const palette = flowerPalettes[Math.floor(rng() * flowerPalettes.length)];
        for (let i = 0; i < 8; i++) {
            ctx.fillStyle = palette[Math.floor(rng() * palette.length)];
            ctx.beginPath();
            ctx.arc(
                x + (rng() - 0.5) * 16 + sway,
                y - h * 0.5 - rng() * h * 0.35,
                1.2 + rng() * 1.5, 0, Math.PI * 2
            );
            ctx.fill();
        }
    },

    // === ACACIA / flat-topped spreading tree ===
    _treeAcacia(ctx, x, y, rng, anim) {
        const h = 24 + rng() * 10;
        const sway = Math.sin(anim * 0.35 + x * 0.03) * 0.8;

        // Shadow (wide)
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(x, y + 3, 16, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Thin trunk with slight curve
        ctx.fillStyle = '#5a3818';
        ctx.beginPath();
        ctx.moveTo(x - 1.5, y);
        ctx.quadraticCurveTo(x + 2, y - h * 0.5, x + sway, y - h * 0.7);
        ctx.lineTo(x + 2 + sway, y - h * 0.7);
        ctx.quadraticCurveTo(x + 4, y - h * 0.4, x + 1.5, y);
        ctx.closePath();
        ctx.fill();

        // Main branches spreading out
        ctx.strokeStyle = '#5a3818';
        ctx.lineWidth = 1.5;
        const branches = [[-14, -6], [12, -4], [-8, -10], [10, -9], [0, -12]];
        for (const [dx, dy] of branches) {
            ctx.beginPath();
            ctx.moveTo(x + sway, y - h * 0.7);
            ctx.quadraticCurveTo(x + dx * 0.5 + sway, y - h * 0.7 + dy * 0.3, x + dx + sway, y - h * 0.7 + dy);
            ctx.stroke();
        }

        // Flat, wide canopy (multiple overlapping ellipses)
        const greens = ['#2a6a18', '#347828', '#3e8830', '#488838'];
        for (let i = 0; i < 7; i++) {
            ctx.fillStyle = greens[Math.floor(rng() * greens.length)];
            ctx.beginPath();
            ctx.ellipse(
                x + (rng() - 0.5) * 18 + sway,
                y - h * 0.72 - rng() * 8,
                8 + rng() * 6, 3 + rng() * 3,
                0, 0, Math.PI * 2
            );
            ctx.fill();
        }

        // Light highlight on top
        ctx.fillStyle = 'rgba(160,210,80,0.2)';
        ctx.beginPath();
        ctx.ellipse(x + sway - 3, y - h * 0.85, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();
    },

    // === Dense bush / shrub ===
    _treeBush(ctx, x, y, rng, anim) {
        const h = 10 + rng() * 8;
        const sway = Math.sin(anim * 0.8 + x * 0.06) * 0.6;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.ellipse(x, y + 1, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Short trunk (barely visible)
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(x - 1, y - 3, 2, 4);

        // Multiple dense foliage balls
        const bushColors = ['#2a6a1a', '#388a28', '#307828', '#449838', '#287020'];
        for (let i = 0; i < 5 + Math.floor(rng() * 3); i++) {
            ctx.fillStyle = bushColors[Math.floor(rng() * bushColors.length)];
            const bx = x + (rng() - 0.5) * 14 + sway;
            const by = y - h * 0.3 - rng() * h * 0.5;
            const r = 4 + rng() * 5;
            ctx.beginPath();
            ctx.ellipse(bx, by, r, r * 0.75, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Some berries or small flowers on bushes
        if (rng() > 0.5) {
            const berryColor = rng() > 0.5 ? '#c03030' : '#3030c0';
            for (let i = 0; i < 4; i++) {
                ctx.fillStyle = berryColor;
                ctx.beginPath();
                ctx.arc(x + (rng() - 0.5) * 12 + sway, y - rng() * h * 0.6, 1.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    },

    // ==============================
    //  COORDINATE CONVERSION
    // ==============================
    tileToScreen(tx, ty) {
        return { x: (tx - ty) * this.tileWHalf, y: (tx + ty) * this.tileHHalf };
    },
    screenToTile(sx, sy) {
        const wx = (sx - this.camera.x) / this.camera.zoom;
        const wy = (sy - this.camera.y) / this.camera.zoom;
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
            const dx = e.clientX - this.dragStart.x, dy = e.clientY - this.dragStart.y;
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
        const r = this.canvas.getBoundingClientRect();
        const mx = e.clientX - r.left, my = e.clientY - r.top;
        const old = this.camera.zoom;
        this.camera.zoom = Math.max(0.3, Math.min(2.5, old * (e.deltaY > 0 ? 0.9 : 1.1)));
        const ratio = this.camera.zoom / old;
        this.camera.x = mx - (mx - this.camera.x) * ratio;
        this.camera.y = my - (my - this.camera.y) * ratio;
    },
    onTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            this.isDragging = true;
            this.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            this.cameraStart = { x: this.camera.x, y: this.camera.y };
            this.dragDistance = 0;
        }
    },
    onTouchMove(e) {
        e.preventDefault();
        if (this.isDragging && e.touches.length === 1) {
            const dx = e.touches[0].clientX - this.dragStart.x;
            const dy = e.touches[0].clientY - this.dragStart.y;
            this.dragDistance = Math.sqrt(dx * dx + dy * dy);
            this.camera.x = this.cameraStart.x + dx;
            this.camera.y = this.cameraStart.y + dy;
        }
    },
    onTouchEnd(e) {
        if (this.dragDistance < 10) {
            const r = this.canvas.getBoundingClientRect();
            const t = e.changedTouches[0];
            const tile = this.screenToTile(t.clientX - r.left, t.clientY - r.top);
            if (Game && Game.selectedBuilding) Game.placeBuilding(tile.x, tile.y);
        }
        this.isDragging = false;
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

    // Large forest tree — canvas fallback with variety
    _treeLarge(ctx, x, y, seed) {
        const rng = this._seededRandom(seed);
        const anim = this.animTime || 0;
        const typeRoll = rng();

        // Ground details
        this._groundDetail(ctx, x, y, this._seededRandom(seed + 999));

        if (typeRoll < 0.25) {
            // Deciduous / rounded
            this._treeLargeRound(ctx, x, y, rng, anim);
        } else if (typeRoll < 0.45) {
            // Conifer
            this._treeLargeConifer(ctx, x, y, rng, anim);
        } else if (typeRoll < 0.58) {
            // Banyan
            this._treeBanyan(ctx, x, y, rng, anim);
        } else if (typeRoll < 0.70) {
            // Birch
            this._treeBirch(ctx, x, y, rng, anim);
        } else if (typeRoll < 0.80) {
            // Acacia
            this._treeAcacia(ctx, x, y, rng, anim);
        } else if (typeRoll < 0.90) {
            // Bush
            this._treeBush(ctx, x, y, rng, anim);
        } else {
            // Flowering
            this._treeFlowering(ctx, x, y, rng, anim);
        }
    },

    // Classic rounded deciduous tree
    _treeLargeRound(ctx, x, y, rng, anim) {
        const h = 22 + rng() * 14;
        const sway = Math.sin(anim * 0.5 + x * 0.04) * 1;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.14)';
        ctx.beginPath();
        ctx.ellipse(x, y + 2, 10, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Trunk with taper
        const tw = 2.2 + rng() * 1.2;
        ctx.fillStyle = '#5a3a18';
        ctx.beginPath();
        ctx.moveTo(x - tw, y);
        ctx.quadraticCurveTo(x - tw * 0.7, y - h * 0.3, x - tw * 0.4 + sway * 0.2, y - h * 0.5);
        ctx.lineTo(x + tw * 0.4 + sway * 0.2, y - h * 0.5);
        ctx.quadraticCurveTo(x + tw * 0.7, y - h * 0.3, x + tw, y);
        ctx.closePath();
        ctx.fill();

        // Bark detail
        ctx.strokeStyle = 'rgba(40,25,8,0.2)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, y - 2);
        ctx.lineTo(x + sway * 0.15, y - h * 0.45);
        ctx.stroke();

        // Multi-layer foliage
        const palettes = [
            ['#2d8030', '#3a9a40', '#45a848', '#58b858', '#68c868'],
            ['#1a6828', '#288838', '#329840', '#40a850', '#50b860'],
            ['#3a7830', '#488840', '#589848', '#68a858', '#78b868'],
        ];
        const palette = palettes[Math.floor(rng() * palettes.length)];
        for (let i = 0; i < 5; i++) {
            const ox = (rng() - 0.5) * 8 + sway;
            const oy = rng() * 6;
            const r = 5.5 + rng() * 5.5;
            ctx.fillStyle = palette[i % palette.length];
            ctx.beginPath();
            ctx.ellipse(x + ox, y - h * 0.55 - oy, r, r * 0.85, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Highlight
        ctx.fillStyle = 'rgba(160,230,100,0.25)';
        ctx.beginPath();
        ctx.ellipse(x - 2 + sway, y - h * 0.72, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
    },

    // Classic conifer tree
    _treeLargeConifer(ctx, x, y, rng, anim) {
        const h = 24 + rng() * 14;
        const sway = Math.sin(anim * 0.45 + x * 0.03) * 0.8;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.ellipse(x, y + 2, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Trunk
        const tw = 1.8 + rng() * 0.8;
        ctx.fillStyle = '#5a3a18';
        ctx.fillRect(x - tw / 2, y - h * 0.35, tw, h * 0.38);

        // Layered triangular foliage (more layers = more realistic)
        const layers = 4 + Math.floor(rng() * 2);
        const greens = ['#1a5a18', '#1e6820', '#247828', '#2a8830'];
        for (let i = 0; i < layers; i++) {
            const t = i / layers;
            const baseY = y - h * 0.25 - t * h * 0.15;
            const tipY = baseY - h * 0.2;
            const bw = (9 - i * 1.2) + rng() * 2;
            ctx.fillStyle = greens[i % greens.length];
            ctx.beginPath();
            ctx.moveTo(x + sway * (1 + t), tipY);
            ctx.lineTo(x + bw + sway * t, baseY);
            ctx.lineTo(x - bw + sway * t, baseY);
            ctx.closePath();
            ctx.fill();
        }

        // Snow on top (random - makes it interesting)
        if (rng() > 0.85) {
            ctx.fillStyle = 'rgba(240,245,255,0.5)';
            ctx.beginPath();
            ctx.moveTo(x + sway, y - h - 2);
            ctx.lineTo(x + 4 + sway, y - h * 0.8);
            ctx.lineTo(x - 4 + sway, y - h * 0.8);
            ctx.closePath();
            ctx.fill();
        }
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
        // Base gradient
        const g = ctx.createLinearGradient(sx - tw/2, sy, sx + tw/2, sy);
        g.addColorStop(0, '#5aab45');
        g.addColorStop(0.5, '#68bf50');
        g.addColorStop(1, '#52a03e');
        this._tileDiamond(ctx, sx, sy, tw, th);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = 'rgba(80,140,60,0.3)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Grass tufts (deterministic based on position)
        const rng = this._seededRandom(tx * 31 + ty * 17);
        if (rng() > 0.4) {
            ctx.fillStyle = 'rgba(80,170,55,0.4)';
            const gx = sx + (rng() - 0.5) * 20;
            const gy = sy + (rng() - 0.5) * 8;
            ctx.fillRect(gx, gy - 3, 1, 3);
            ctx.fillRect(gx + 2, gy - 2.5, 1, 2.5);
        }
        if (rng() > 0.7) {
            // Small flower
            ctx.fillStyle = rng() > 0.5 ? '#e8e060' : '#e080a0';
            ctx.beginPath();
            ctx.arc(sx + (rng() - 0.5) * 18, sy + (rng() - 0.5) * 6, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    _renderForest(ctx, sx, sy, tw, th, tx, ty) {
        // Dark green ground
        const g = ctx.createLinearGradient(sx - tw/2, sy, sx + tw/2, sy);
        g.addColorStop(0, '#3a7830');
        g.addColorStop(0.5, '#448838');
        g.addColorStop(1, '#326a28');
        this._tileDiamond(ctx, sx, sy, tw, th);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = 'rgba(50,90,40,0.3)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
    },

    _renderWater(ctx, sx, sy, tw, th, tx, ty) {
        const wave = Math.sin(this.animTime * 1.5 + tx * 0.7 + ty * 0.5);
        const wave2 = Math.sin(this.animTime * 2.2 + tx * 0.3 - ty * 0.8);

        // Base water
        const g = ctx.createLinearGradient(sx, sy - th/2, sx, sy + th/2);
        g.addColorStop(0, `rgb(${55 + wave * 8},${140 + wave * 10},${210 + wave * 8})`);
        g.addColorStop(0.5, `rgb(${65 + wave2 * 5},${160 + wave2 * 8},${225 + wave2 * 5})`);
        g.addColorStop(1, `rgb(${50 + wave * 6},${130 + wave * 8},${200 + wave * 6})`);
        this._tileDiamond(ctx, sx, sy, tw, th);
        ctx.fillStyle = g;
        ctx.fill();

        // Shimmer/reflection
        ctx.fillStyle = `rgba(180,220,255,${0.15 + wave2 * 0.08})`;
        ctx.beginPath();
        ctx.ellipse(sx + wave * 4, sy - 2 + wave2 * 2, 8, 2, 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Edge highlight
        ctx.strokeStyle = 'rgba(100,180,240,0.25)';
        ctx.lineWidth = 0.8;
        this._tileDiamond(ctx, sx, sy, tw, th);
        ctx.stroke();

        // Shore effect - check adjacent tiles for land
        this._drawShoreEffect(ctx, sx, sy, tw, th, tx, ty);
    },

    _drawShoreEffect(ctx, sx, sy, tw, th, tx, ty) {
        const size = GameData.MAP_SIZE;
        const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
        for (const [dx, dy] of dirs) {
            const nx = tx + dx, ny = ty + dy;
            if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
                const nt = Game.map.tiles[ny * size + nx];
                if (nt !== GameData.TILE.WATER) {
                    // Draw foam/shore
                    ctx.fillStyle = 'rgba(180,220,200,0.2)';
                    const ox = dx * 8, oy = dy * 4;
                    ctx.beginPath();
                    ctx.ellipse(sx + ox, sy + oy, 6, 2.5, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    },

    _renderDirt(ctx, sx, sy, tw, th, tx, ty) {
        const g = ctx.createLinearGradient(sx - tw/2, sy, sx + tw/2, sy);
        g.addColorStop(0, '#a08558');
        g.addColorStop(0.5, '#b09568');
        g.addColorStop(1, '#987a4e');
        this._tileDiamond(ctx, sx, sy, tw, th);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,100,70,0.25)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Pebbles
        const rng = this._seededRandom(tx * 23 + ty * 41);
        if (rng() > 0.5) {
            ctx.fillStyle = 'rgba(140,120,90,0.4)';
            ctx.beginPath();
            ctx.arc(sx + (rng() - 0.5) * 16, sy + (rng() - 0.5) * 6, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
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
        // Rich soil base
        const g = ctx.createLinearGradient(sx - tw/2, sy, sx + tw/2, sy);
        g.addColorStop(0, '#6aaa38');
        g.addColorStop(0.5, '#78c042');
        g.addColorStop(1, '#5e9a30');
        this._tileDiamond(ctx, sx, sy, tw, th);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = 'rgba(70,120,40,0.3)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Crop rows
        ctx.strokeStyle = 'rgba(90,140,50,0.35)';
        ctx.lineWidth = 0.8;
        for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(sx + i * 6 - 3, sy + 6);
            ctx.lineTo(sx + i * 6 + 3, sy - 6);
            ctx.stroke();
        }
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

        // Road tile — skip 3D render
        if (bData.isTile) return;

        ctx.save();
        if (progress < 1) ctx.globalAlpha = 0.5 + progress * 0.5;

        // Dispatch to specific renderer
        switch (building.id) {
            case 'rumah_transmigran': this._drawRumahTransmigran(ctx, sx, sy, progress); break;
            case 'rumah_layak': this._drawRumahLayak(ctx, sx, sy, progress); break;
            case 'perumahan': this._drawPerumahan(ctx, sx, sy, progress); break;
            case 'sawah': this._drawSawah(ctx, sx, sy, progress); break;
            case 'ladang': this._drawLadang(ctx, sx, sy, progress); break;
            case 'perkebunan': this._drawPerkebunan(ctx, sx, sy, progress); break;
            case 'peternakan': this._drawPeternakan(ctx, sx, sy, progress); break;
            case 'sekolah': this._drawSekolah(ctx, sx, sy, progress); break;
            case 'smp': this._drawSMP(ctx, sx, sy, progress); break;
            case 'puskesmas': this._drawPuskesmas(ctx, sx, sy, progress); break;
            case 'masjid': this._drawMasjid(ctx, sx, sy, progress); break;
            case 'balai_desa': this._drawBalaiDesa(ctx, sx, sy, progress); break;
            case 'taman': this._drawTaman(ctx, sx, sy, progress); break;
            case 'pasar': this._drawPasar(ctx, sx, sy, progress); break;
            case 'koperasi': this._drawKoperasi(ctx, sx, sy, progress); break;
            case 'gudang': this._drawGudang(ctx, sx, sy, progress); break;
            case 'pabrik': this._drawPabrik(ctx, sx, sy, progress); break;
            case 'jembatan': this._drawJembatan(ctx, sx, sy, progress); break;
            case 'pembangkit': this._drawPembangkit(ctx, sx, sy, progress); break;
            default: this._drawGeneric(ctx, sx, sy, bData, progress); break;
        }

        // Construction scaffolding
        if (progress < 1) {
            ctx.strokeStyle = 'rgba(180,140,70,0.6)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx - 18, sy + 2); ctx.lineTo(sx - 18, sy - 28);
            ctx.moveTo(sx + 18, sy + 2); ctx.lineTo(sx + 18, sy - 28);
            ctx.moveTo(sx - 20, sy - 14); ctx.lineTo(sx + 20, sy - 14);
            ctx.stroke();
        }

        ctx.restore();
    },

    // ==============================
    //  PER-BUILDING RENDERERS
    // ==============================

    // --- RUMAH TRANSMIGRAN ---
    _drawRumahTransmigran(ctx, sx, sy, p) {
        const hw = 20, hd = 10, h = 20 * p;
        this._shadow(ctx, sx, sy, 22, 12);

        // Foundation (slightly elevated)
        this._box(ctx, sx, sy, hw + 2, hd + 1, 2,
            '#a09080', ['#908070','#807060'], ['#706050','#605040']);

        // Walls (wooden planks)
        this._box(ctx, sx, sy - 2, hw, hd, h,
            '#d4a868', ['#c89858','#b08040'], ['#a07838','#886828']);

        // Plank lines on walls
        ctx.strokeStyle = 'rgba(100,70,30,0.15)';
        ctx.lineWidth = 0.5;
        for (let i = 1; i <= 3; i++) {
            const ly = sy - 2 - h * (i / 4);
            ctx.beginPath();
            ctx.moveTo(sx - hw, ly + hd * (i/4)); ctx.lineTo(sx, ly - hd + hd * (i/4));
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(sx + hw, ly + hd * (i/4)); ctx.lineTo(sx, ly - hd + hd * (i/4));
            ctx.stroke();
        }

        // Roof
        this._gableRoof(ctx, sx, sy - 2, hw, hd, h, 10 * p, 4,
            '#c04830', '#a03820', '#d85840');

        // Window
        if (p > 0.5) {
            this._windowL(ctx, sx, sy - 2, hw * 0.5, h * 0.55, 5, 4);
            this._windowR(ctx, sx, sy - 2, hw * 0.25, h * 0.55, 5, 4);
        }

        // Door
        if (p > 0.7) {
            this._door(ctx, sx - 2, sy - 2 - hd, 4, 7, '#5a3a18');
        }

        // Small potted plant
        if (p >= 1) {
            ctx.fillStyle = '#8a5a30';
            ctx.fillRect(sx + hw * 0.6, sy - hd - 1, 3, 3);
            ctx.fillStyle = '#40a030';
            ctx.beginPath();
            ctx.arc(sx + hw * 0.6 + 1.5, sy - hd - 3, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    // --- RUMAH LAYAK HUNI ---
    _drawRumahLayak(ctx, sx, sy, p) {
        const hw = 22, hd = 11, h = 24 * p;
        this._shadow(ctx, sx, sy, 25, 14);

        // Foundation
        this._box(ctx, sx, sy, hw + 3, hd + 2, 3,
            '#b0a090', ['#a09080','#908070'], ['#807060','#706050']);

        // Walls (plastered)
        this._box(ctx, sx, sy - 3, hw, hd, h,
            '#f0e8d0', ['#e8dcc0','#d8ccb0'], ['#d0c4a8','#c0b498']);

        // Trim line
        ctx.strokeStyle = 'rgba(160,140,110,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx - hw, sy - 3 - h * 0.85 + hd * 0.15);
        ctx.lineTo(sx, sy - 3 - hd - h * 0.85);
        ctx.lineTo(sx + hw, sy - 3 - h * 0.85 + hd * 0.15);
        ctx.stroke();

        // Roof (blue tiles)
        this._hipRoof(ctx, sx, sy - 3, hw, hd, h, 12 * p, 5,
            '#3a6ab0', '#2a5a9a', '#4a7ac0');

        // Windows (2 on each side)
        if (p > 0.5) {
            this._windowL(ctx, sx, sy - 3, hw * 0.65, h * 0.55, 5, 5);
            this._windowL(ctx, sx, sy - 3, hw * 0.25, h * 0.55, 5, 5);
            this._windowR(ctx, sx, sy - 3, hw * 0.2, h * 0.55, 5, 5);
            this._windowR(ctx, sx, sy - 3, hw * 0.55, h * 0.55, 5, 5);
        }

        // Door with small porch
        if (p > 0.7) {
            // Porch roof
            ctx.fillStyle = '#4a7ac0';
            ctx.fillRect(sx - 5, sy - 3 - hd - 10, 10, 2);
            this._door(ctx, sx - 2, sy - 3 - hd, 4, 8, '#6a4020');
        }

        // Garden flowers
        if (p >= 1) {
            this._flowers(ctx, sx + hw * 0.5, sy + hd * 0.3, 0, this.animTime);
            this._flowers(ctx, sx - hw * 0.6, sy, 1, this.animTime);
        }
    },

    // --- KOMPLEK PERUMAHAN ---
    _drawPerumahan(ctx, sx, sy, p) {
        const hw = 38, hd = 20, h = 30 * p;
        this._shadow(ctx, sx, sy, 42, 22);

        // Foundation
        this._box(ctx, sx, sy, hw + 3, hd + 2, 3,
            '#b8b0a8', ['#a8a098','#989088'], ['#888078','#787068']);

        // Main building
        this._box(ctx, sx, sy - 3, hw, hd, h,
            '#e8e4e0', ['#dcd8d4','#ccc8c4'], ['#c4c0bc','#b4b0ac']);

        // Second floor line
        if (p > 0.6) {
            ctx.strokeStyle = 'rgba(0,0,0,0.06)';
            ctx.lineWidth = 1;
            const mid = h * 0.5;
            ctx.beginPath();
            ctx.moveTo(sx - hw, sy - 3 - mid + hd * 0.5);
            ctx.lineTo(sx, sy - 3 - hd - mid);
            ctx.lineTo(sx + hw, sy - 3 - mid + hd * 0.5);
            ctx.stroke();
        }

        // Roof segments (multi-colored)
        this._hipRoof(ctx, sx - hw * 0.35, sy - 3 - 2, hw * 0.7, hd * 0.7, h - 2, 10 * p, 4,
            '#3a6ab0', '#2a5a9a', '#4a7ac0');
        this._hipRoof(ctx, sx + hw * 0.35, sy - 3 + 2, hw * 0.7, hd * 0.7, h - 2, 10 * p, 4,
            '#b04040', '#903030', '#c05050');

        // Windows (many)
        if (p > 0.5) {
            for (let i = 0; i < 3; i++) {
                this._windowL(ctx, sx, sy - 3, hw * (0.2 + i * 0.25), h * 0.35, 4, 4);
                this._windowL(ctx, sx, sy - 3, hw * (0.2 + i * 0.25), h * 0.7, 4, 4);
                this._windowR(ctx, sx, sy - 3, hw * (0.15 + i * 0.25), h * 0.35, 4, 4);
                this._windowR(ctx, sx, sy - 3, hw * (0.15 + i * 0.25), h * 0.7, 4, 4);
            }
        }

        // Trees in courtyard
        if (p >= 1) {
            this._treeSmall(ctx, sx - 6, sy + 8, 14, '#6a4a2a', '#40a040');
            this._treeSmall(ctx, sx + 8, sy + 6, 12, '#6a4a2a', '#38a838');
        }
    },

    // --- SAWAH (Rice Paddy) ---
    _drawSawah(ctx, sx, sy, p) {
        if (p < 1) return;
        
        // Water in paddy (animated)
        const wave = Math.sin(this.animTime * 1.2 + sx * 0.1) * 2;
        ctx.fillStyle = `rgba(80,160,130,0.3)`;
        this._tileDiamond(ctx, sx, sy, 56, 28);
        ctx.fill();

        // Rice seedlings in rows
        const growth = (Math.sin(this.animTime * 0.3) + 1) * 0.5;
        for (let r = -3; r <= 3; r++) {
            for (let c = -1; c <= 1; c++) {
                const rx = sx + r * 6 + c * 2;
                const ry = sy + c * 4 + r * 1.5;
                const h = 3 + growth * 3;
                ctx.strokeStyle = `rgb(${80 + growth * 60},${150 + growth * 50},${40})`;
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.moveTo(rx, ry);
                ctx.lineTo(rx + Math.sin(this.animTime * 0.8 + r) * 0.5, ry - h);
                ctx.stroke();
            }
        }

        // Water reflection shimmer
        ctx.fillStyle = `rgba(180,220,255,${0.08 + Math.sin(this.animTime * 2) * 0.04})`;
        ctx.beginPath();
        ctx.ellipse(sx + wave, sy - 1, 10, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Mud border
        ctx.strokeStyle = 'rgba(120,90,50,0.25)';
        ctx.lineWidth = 1.5;
        this._tileDiamond(ctx, sx, sy, 52, 26);
        ctx.stroke();
    },

    // --- LADANG SAYUR ---
    _drawLadang(ctx, sx, sy, p) {
        if (p < 1) return;

        // Soil rows
        for (let i = -3; i <= 3; i++) {
            const rx = sx + i * 7;
            ctx.fillStyle = '#8a6838';
            ctx.beginPath();
            ctx.moveTo(rx - 2, sy + 6);
            ctx.lineTo(rx + 2, sy - 6);
            ctx.lineTo(rx + 3, sy - 6);
            ctx.lineTo(rx - 1, sy + 6);
            ctx.closePath();
            ctx.fill();

            // Plants on rows
            const growth = (Math.sin(this.animTime * 0.2 + i) + 1) * 0.5;
            for (let j = -1; j <= 1; j++) {
                const px = rx + 0.5;
                const py = sy + j * 5;
                // Leaves
                ctx.fillStyle = `rgb(${60 + growth * 40},${140 + growth * 60},${30 + growth * 20})`;
                ctx.beginPath();
                ctx.arc(px, py - 2 - growth * 2, 2 + growth, 0, Math.PI * 2);
                ctx.fill();
                // Some vegetables (red/orange)
                if (growth > 0.6 && j === 0) {
                    ctx.fillStyle = i % 3 === 0 ? '#e06040' : '#e0a020';
                    ctx.beginPath();
                    ctx.arc(px + 1, py - 1, 1.2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // Small fence
        this._fence(ctx, sx - 24, sy + 3, sx - 24, sy - 8, '#a08050');
    },

    // --- PERKEBUNAN (Plantation, 2x2) ---
    _drawPerkebunan(ctx, sx, sy, p) {
        if (p < 0.5) return;
        this._shadow(ctx, sx, sy, 40, 20);

        // Palm trees in rows
        const positions = [[-14, -4], [0, -8], [14, -4], [-8, 4], [8, 4]];
        for (const [ox, oy] of positions) {
            this._palmTree(ctx, sx + ox, sy + oy, 28 + Math.sin(ox) * 4, this.animTime);
        }

        // Ground path between trees
        ctx.strokeStyle = 'rgba(140,110,70,0.25)';
        ctx.lineWidth = 3;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(sx - 20, sy + 2);
        ctx.lineTo(sx + 20, sy - 2);
        ctx.stroke();
        ctx.setLineDash([]);
    },

    // --- PETERNAKAN (Ranch) ---
    _drawPeternakan(ctx, sx, sy, p) {
        const hw = 22, hd = 11, h = 16 * p;
        this._shadow(ctx, sx, sy, 26, 14);

        // Barn
        this._box(ctx, sx - 4, sy - 2, hw * 0.7, hd * 0.7, h,
            '#c06838', ['#b05828','#983818'], ['#884020','#703010']);

        // Barn roof
        this._gableRoof(ctx, sx - 4, sy - 2, hw * 0.7, hd * 0.7, h, 8 * p, 3,
            '#8a3020', '#6a2010', '#9a4030');

        // Barn door (large)
        if (p > 0.5) {
            ctx.fillStyle = '#703818';
            ctx.fillRect(sx - 7, sy - 2 - hd * 0.7 - 8, 6, 8);
            // X on door
            ctx.strokeStyle = '#905830';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(sx - 7, sy - 2 - hd * 0.7 - 8);
            ctx.lineTo(sx - 1, sy - 2 - hd * 0.7);
            ctx.moveTo(sx - 1, sy - 2 - hd * 0.7 - 8);
            ctx.lineTo(sx - 7, sy - 2 - hd * 0.7);
            ctx.stroke();
        }

        // Fence area
        if (p >= 1) {
            this._fence(ctx, sx + 8, sy - 5, sx + 22, sy + 1, '#c0a870');
            this._fence(ctx, sx + 22, sy + 1, sx + 14, sy + 8, '#c0a870');
            this._fence(ctx, sx + 8, sy - 5, sx + 2, sy + 4, '#c0a870');

            // Cows (simple)
            ctx.fillStyle = '#8a6a4a';
            ctx.beginPath();
            ctx.ellipse(sx + 14, sy + 2, 4, 2.5, 0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#f0e8d8';
            ctx.beginPath();
            ctx.ellipse(sx + 14 + 3, sy + 1.5, 1.5, 1.2, 0, 0, Math.PI * 2);
            ctx.fill();
            // Legs
            ctx.strokeStyle = '#6a4a2a';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(sx + 12, sy + 3.5); ctx.lineTo(sx + 12, sy + 5.5);
            ctx.moveTo(sx + 16, sy + 3); ctx.lineTo(sx + 16, sy + 5);
            ctx.stroke();

            // Chickens
            ctx.fillStyle = '#e0d0b0';
            ctx.beginPath();
            ctx.arc(sx + 10, sy + 5, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#e04030';
            ctx.beginPath();
            ctx.arc(sx + 10, sy + 3.5, 0.6, 0, Math.PI * 2);
            ctx.fill();

            // Hay bale
            ctx.fillStyle = '#d0b060';
            ctx.fillRect(sx - 18, sy + 4, 5, 4);
            ctx.fillStyle = '#c0a050';
            ctx.beginPath();
            ctx.ellipse(sx - 15.5, sy + 4, 2.5, 1.5, 0, Math.PI, Math.PI * 2);
            ctx.fill();
        }
    },

    // --- SEKOLAH (School, 2x2) ---
    _drawSekolah(ctx, sx, sy, p) {
        const hw = 36, hd = 18, h = 26 * p;
        this._shadow(ctx, sx, sy, 40, 22);

        // Foundation
        this._box(ctx, sx, sy, hw + 2, hd + 1, 3,
            '#c0b8b0', ['#b0a8a0','#a09890'], ['#908880','#807870']);

        // Main building
        this._box(ctx, sx, sy - 3, hw, hd, h,
            '#f8f0e0', ['#f0e8d4','#e0d8c4'], ['#d8d0c0','#c8c0b0']);

        // Roof (red)
        this._hipRoof(ctx, sx, sy - 3, hw, hd, h, 12 * p, 5,
            '#c04030', '#a03020', '#d05040');

        // Windows in rows
        if (p > 0.4) {
            for (let i = 0; i < 4; i++) {
                this._windowL(ctx, sx, sy - 3, hw * (0.15 + i * 0.22), h * 0.5, 4, 5);
                this._windowR(ctx, sx, sy - 3, hw * (0.12 + i * 0.22), h * 0.5, 4, 5);
            }
        }

        // Door (main entrance)
        if (p > 0.6) {
            ctx.fillStyle = '#e8e0d0';
            ctx.fillRect(sx - 4, sy - 3 - hd - 12, 8, 3);
            this._door(ctx, sx - 2.5, sy - 3 - hd, 5, 9, '#5a3018');
        }

        // Flag pole with Indonesian flag
        if (p >= 1) {
            ctx.strokeStyle = '#606060';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(sx + hw - 5, sy - 3 - hd + 2);
            ctx.lineTo(sx + hw - 5, sy - 3 - hd - 22);
            ctx.stroke();
            // Red
            ctx.fillStyle = '#e02020';
            ctx.fillRect(sx + hw - 4, sy - 3 - hd - 22, 10, 4);
            // White
            ctx.fillStyle = '#f8f8f8';
            ctx.fillRect(sx + hw - 4, sy - 3 - hd - 18, 10, 4);
            // Ball on top
            ctx.fillStyle = '#d0b040';
            ctx.beginPath();
            ctx.arc(sx + hw - 5, sy - 3 - hd - 23, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // "SD" sign
        if (p >= 1) {
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillRect(sx - 6, sy - 3 - hd - 2, 12, 5);
            ctx.fillStyle = '#303030';
            ctx.font = '4px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('SD', sx, sy - 3 - hd + 2);
        }
    },

    // --- SMP (Junior High, 2x2) ---
    _drawSMP(ctx, sx, sy, p) {
        const hw = 38, hd = 19, h = 32 * p;
        this._shadow(ctx, sx, sy, 42, 22);

        // Foundation
        this._box(ctx, sx, sy, hw + 2, hd + 1, 3,
            '#a8a0a0', ['#989090','#888080'], ['#787070','#686060']);

        // Walls (light blue-gray, modern)
        this._box(ctx, sx, sy - 3, hw, hd, h,
            '#e0e8f0', ['#d0d8e4','#c0c8d4'], ['#b8c0cc','#a8b0bc']);

        // Floor divider
        if (p > 0.5) {
            const mid = h * 0.5;
            ctx.strokeStyle = 'rgba(0,0,0,0.08)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sx - hw, sy - 3 - mid + hd * 0.5);
            ctx.lineTo(sx, sy - 3 - hd - mid);
            ctx.lineTo(sx + hw, sy - 3 - mid + hd * 0.5);
            ctx.stroke();
        }

        // Roof (blue)
        this._hipRoof(ctx, sx, sy - 3, hw, hd, h, 10 * p, 5,
            '#2a5a9a', '#1a4a8a', '#3a6ab0');

        // Windows (2 floors, many)
        if (p > 0.4) {
            for (let floor = 0; floor < 2; floor++) {
                for (let i = 0; i < 4; i++) {
                    this._windowL(ctx, sx, sy - 3, hw * (0.15 + i * 0.22), h * (0.3 + floor * 0.35), 4, 5);
                    this._windowR(ctx, sx, sy - 3, hw * (0.12 + i * 0.22), h * (0.3 + floor * 0.35), 4, 5);
                }
            }
        }

        // Main entrance
        if (p > 0.6) {
            // Entrance canopy
            ctx.fillStyle = '#3a6ab0';
            ctx.fillRect(sx - 6, sy - 3 - hd - 14, 12, 3);
            ctx.fillStyle = '#2a5a9a';
            ctx.fillRect(sx - 7, sy - 3 - hd - 14, 14, 1.5);
            this._door(ctx, sx - 3, sy - 3 - hd, 6, 10, '#4a3018');
        }

        // Flag
        if (p >= 1) {
            ctx.strokeStyle = '#505050';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(sx + hw - 4, sy - 3 - hd + 2);
            ctx.lineTo(sx + hw - 4, sy - 3 - hd - 26);
            ctx.stroke();
            ctx.fillStyle = '#e02020';
            ctx.fillRect(sx + hw - 3, sy - 3 - hd - 26, 10, 4);
            ctx.fillStyle = '#f8f8f8';
            ctx.fillRect(sx + hw - 3, sy - 3 - hd - 22, 10, 4);
        }
    },

    // --- PUSKESMAS (Health Clinic) ---
    _drawPuskesmas(ctx, sx, sy, p) {
        const hw = 22, hd = 11, h = 22 * p;
        this._shadow(ctx, sx, sy, 26, 14);

        // Foundation
        this._box(ctx, sx, sy, hw + 2, hd + 1, 2,
            '#c0b8b0', ['#b0a8a0','#a09890'], ['#908880','#807870']);

        // White building
        this._box(ctx, sx, sy - 2, hw, hd, h,
            '#f8f8f8', ['#f0f0f0','#e4e4e4'], ['#dcdcdc','#d0d0d0']);

        // Roof
        this._hipRoof(ctx, sx, sy - 2, hw, hd, h, 8 * p, 4,
            '#e8e8e8', '#d8d8d8', '#f0f0f0');

        // Red Cross
        if (p > 0.5) {
            // On left wall
            ctx.fillStyle = '#e03030';
            const cx = sx - hw * 0.5, cy = sy - 2 - h * 0.55;
            ctx.fillRect(cx - 1, cy - 4, 3, 8);
            ctx.fillRect(cx - 3, cy - 1.5, 7, 3);
        }

        // Windows
        if (p > 0.4) {
            this._windowL(ctx, sx, sy - 2, hw * 0.75, h * 0.5, 4, 5);
            this._windowR(ctx, sx, sy - 2, hw * 0.3, h * 0.5, 4, 5);
            this._windowR(ctx, sx, sy - 2, hw * 0.65, h * 0.5, 4, 5);
        }

        // Entrance with red awning
        if (p > 0.7) {
            ctx.fillStyle = '#d03030';
            ctx.fillRect(sx - 5, sy - 2 - hd - 11, 10, 2.5);
            ctx.fillStyle = '#c02020';
            ctx.beginPath();
            ctx.moveTo(sx - 6, sy - 2 - hd - 8.5);
            ctx.lineTo(sx + 6, sy - 2 - hd - 8.5);
            ctx.lineTo(sx + 5, sy - 2 - hd - 7);
            ctx.lineTo(sx - 5, sy - 2 - hd - 7);
            ctx.closePath();
            ctx.fill();
            this._door(ctx, sx - 2, sy - 2 - hd, 4, 8, '#404040');
        }

        // Ambulance (small)
        if (p >= 1) {
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(sx + 14, sy + 2, 8, 5);
            ctx.fillStyle = '#e03030';
            ctx.fillRect(sx + 16, sy + 3, 1, 3);
            ctx.fillRect(sx + 15, sy + 4, 3, 1);
            // Wheels
            ctx.fillStyle = '#303030';
            ctx.beginPath();
            ctx.arc(sx + 15, sy + 7, 1.2, 0, Math.PI * 2);
            ctx.arc(sx + 21, sy + 7, 1.2, 0, Math.PI * 2);
            ctx.fill();
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
        this._shadow(ctx, sx, sy, 42, 22);

        // Elevated platform
        this._box(ctx, sx, sy, hw + 4, hd + 2, 4,
            '#c0a880', ['#b09870','#a08860'], ['#907850','#806840']);

        // Main building
        this._box(ctx, sx, sy - 4, hw, hd, h,
            '#e8dcc0', ['#dcd0b4','#ccc4a4'], ['#c0b498','#b0a488']);

        // Traditional roof (large overhang)
        this._hipRoof(ctx, sx, sy - 4, hw, hd, h, 14 * p, 8,
            '#8a5020', '#703810', '#9a6030');

        // Pendopo (open pillars at front)
        if (p > 0.6) {
            ctx.strokeStyle = '#8a7050';
            ctx.lineWidth = 2;
            for (let i = -2; i <= 2; i++) {
                const px = sx + i * 12;
                ctx.beginPath();
                ctx.moveTo(px, sy - 4 - hd + 4);
                ctx.lineTo(px, sy - 4 - hd - h * 0.6);
                ctx.stroke();
            }
        }

        // Windows
        if (p > 0.4) {
            for (let i = 0; i < 3; i++) {
                this._windowL(ctx, sx, sy - 4, hw * (0.2 + i * 0.27), h * 0.5, 5, 5);
                this._windowR(ctx, sx, sy - 4, hw * (0.17 + i * 0.27), h * 0.5, 5, 5);
            }
        }

        // Flag pole
        if (p >= 1) {
            ctx.strokeStyle = '#505050';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sx - hw - 6, sy + 2);
            ctx.lineTo(sx - hw - 6, sy - 28);
            ctx.stroke();
            ctx.fillStyle = '#e02020';
            ctx.fillRect(sx - hw - 5, sy - 28, 10, 4);
            ctx.fillStyle = '#f8f8f8';
            ctx.fillRect(sx - hw - 5, sy - 24, 10, 4);
        }

        // Village sign
        if (p >= 1) {
            ctx.fillStyle = '#e8dcc0';
            ctx.fillRect(sx - 10, sy - 4 - hd - 4, 20, 6);
            ctx.strokeStyle = '#8a7050';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(sx - 10, sy - 4 - hd - 4, 20, 6);
            ctx.fillStyle = '#4a3a20';
            ctx.font = '3.5px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('BALAI DESA', sx, sy - 4 - hd);
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
        const hw = 22, hd = 11, h = 14 * p;
        this._shadow(ctx, sx, sy, 26, 14);

        // Platform
        this._box(ctx, sx, sy, hw + 2, hd + 1, 2,
            '#c0a870', ['#b09860','#a08850'], ['#907840','#806830']);

        // Tent/tarp structure - colorful striped
        const cols = ['#e04040','#e0a020','#e04040','#e0a020'];
        for (let i = 0; i < 4; i++) {
            const seg = hw * 2 / 4;
            const lx = sx - hw + i * seg;
            const rx = lx + seg;
            ctx.fillStyle = cols[i];
            ctx.beginPath();
            ctx.moveTo(lx, sy - 2 + (i - 1.5) * hd / 2);
            ctx.lineTo(rx, sy - 2 + (i - 0.5) * hd / 2 - hd);
            ctx.lineTo(rx, sy - 2 - h + (i - 0.5) * hd / 2 - hd - 4);
            ctx.lineTo(lx, sy - 2 - h + (i - 1.5) * hd / 2 - 4);
            ctx.closePath();
            ctx.fill();
        }

        // Simplified tent top
        ctx.fillStyle = '#e8a030';
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd - h - 8);
        ctx.lineTo(sx + hw + 3, sy - h + 2);
        ctx.lineTo(sx, sy + hd - h + 2);
        ctx.lineTo(sx - hw - 3, sy - h + 2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#d04040';
        ctx.beginPath();
        ctx.moveTo(sx, sy - hd - h - 8);
        ctx.lineTo(sx - hw - 3, sy - h + 2);
        ctx.lineTo(sx, sy - hd - h);
        ctx.closePath();
        ctx.fill();

        // Support poles
        if (p > 0.5) {
            ctx.strokeStyle = '#8a6a3a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(sx - hw + 2, sy + hd - 4); ctx.lineTo(sx - hw + 2, sy - h - 2);
            ctx.moveTo(sx + hw - 2, sy - hd + 6); ctx.lineTo(sx + hw - 2, sy - h - 2);
            ctx.stroke();
        }

        // Goods on display
        if (p >= 1) {
            // Baskets of fruits
            const goods = ['#e06030','#f0e030','#40b040','#e08040'];
            for (let i = 0; i < 4; i++) {
                ctx.fillStyle = '#a08050';
                const gx = sx - 10 + i * 7, gy = sy - 4 + (i - 1.5) * 2;
                ctx.beginPath();
                ctx.ellipse(gx, gy, 3, 2, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = goods[i];
                ctx.beginPath();
                ctx.arc(gx - 1, gy - 1.5, 1.3, 0, Math.PI * 2);
                ctx.arc(gx + 1, gy - 1, 1.3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    },

    // --- KOPERASI ---
    _drawKoperasi(ctx, sx, sy, p) {
        const hw = 22, hd = 11, h = 22 * p;
        this._shadow(ctx, sx, sy, 26, 14);

        // Foundation
        this._box(ctx, sx, sy, hw + 2, hd + 1, 2,
            '#607898', ['#506888','#406078'], ['#385870','#304860']);

        // Building (blue-green)
        this._box(ctx, sx, sy - 2, hw, hd, h,
            '#4890c0', ['#3880b0','#2870a0'], ['#2068a0','#185890']);

        // Roof
        this._hipRoof(ctx, sx, sy - 2, hw, hd, h, 8 * p, 4,
            '#1a5a8a', '#104a7a', '#2a6a9a');

        // Windows
        if (p > 0.4) {
            this._windowL(ctx, sx, sy - 2, hw * 0.5, h * 0.5, 5, 5);
            this._windowR(ctx, sx, sy - 2, hw * 0.3, h * 0.5, 5, 5);
            this._windowR(ctx, sx, sy - 2, hw * 0.65, h * 0.5, 5, 5);
        }

        // Door with counter
        if (p > 0.6) {
            this._door(ctx, sx - 2, sy - 2 - hd, 4, 8, '#2a4a6a');
            // Counter window
            ctx.fillStyle = '#305878';
            ctx.fillRect(sx + 4, sy - 2 - hd - 5, 6, 5);
            ctx.fillStyle = 'rgba(180,220,255,0.6)';
            ctx.fillRect(sx + 4.5, sy - 2 - hd - 4.5, 5, 4);
        }

        // Sign "KOPERASI"
        if (p >= 1) {
            ctx.fillStyle = '#f0e8c0';
            ctx.fillRect(sx - hw * 0.6, sy - 2 - h + 2, hw * 1.1, 5);
            ctx.fillStyle = '#1a4a7a';
            ctx.font = '3px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('KOPERASI', sx - hw * 0.05, sy - 2 - h + 5.5);
        }
    },

    // --- GUDANG (Warehouse) ---
    _drawGudang(ctx, sx, sy, p) {
        const hw = 24, hd = 12, h = 20 * p;
        this._shadow(ctx, sx, sy, 28, 16);

        // Concrete base
        this._box(ctx, sx, sy, hw + 2, hd + 1, 2,
            '#908880', ['#807870','#706860'], ['#606058','#505048']);

        // Metal walls
        this._box(ctx, sx, sy - 2, hw, hd, h,
            '#a0a8b0', ['#909aa0','#808a90'], ['#788088','#687078']);

        // Corrugated wall texture
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 0.5;
        for (let i = 1; i <= 5; i++) {
            const ly = sy - 2 - h * (i / 6);
            ctx.beginPath();
            ctx.moveTo(sx - hw, ly + hd * (i/6));
            ctx.lineTo(sx, ly - hd + hd * (i/6));
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(sx + hw, ly + hd * (i/6));
            ctx.lineTo(sx, ly - hd + hd * (i/6));
            ctx.stroke();
        }

        // Roof (flat with slight angle)
        this._gableRoof(ctx, sx, sy - 2, hw, hd, h, 5 * p, 2,
            '#788088', '#687078', '#8890a0');

        // Large rolling door
        if (p > 0.5) {
            ctx.fillStyle = '#606870';
            ctx.fillRect(sx - 5, sy - 2 - hd - 10, 10, 10);
            // Door segments
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 0.5;
            for (let i = 1; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(sx - 5, sy - 2 - hd - 10 + i * 2.5);
                ctx.lineTo(sx + 5, sy - 2 - hd - 10 + i * 2.5);
                ctx.stroke();
            }
        }

        // Crates outside
        if (p >= 1) {
            this._box(ctx, sx + 16, sy + 3, 4, 2, 5,
                '#c0a060', ['#b09050','#a08040'], ['#907030','#806020']);
            this._box(ctx, sx + 12, sy + 5, 3, 1.5, 4,
                '#b09858', ['#a08848','#907838'], ['#806828','#705818']);
            // Barrel
            ctx.fillStyle = '#8a6838';
            ctx.beginPath();
            ctx.ellipse(sx - 16, sy + 4, 3.5, 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#7a5828';
            ctx.fillRect(sx - 19.5, sy + 2, 7, 4);
            ctx.fillStyle = '#6a7878';
            ctx.fillRect(sx - 19.5, sy + 3, 7, 1);
        }
    },

    // --- PABRIK (Factory, 2x2) ---
    _drawPabrik(ctx, sx, sy, p) {
        const hw = 40, hd = 20, h = 28 * p;
        this._shadow(ctx, sx, sy, 44, 24);

        // Concrete foundation
        this._box(ctx, sx, sy, hw + 3, hd + 2, 3,
            '#808080', ['#707070','#606060'], ['#585858','#484848']);

        // Main building
        this._box(ctx, sx, sy - 3, hw, hd, h,
            '#b0b8c0', ['#a0a8b0','#909aa2'], ['#8890a0','#788090']);

        // Corrugated walls
        ctx.strokeStyle = 'rgba(0,0,0,0.05)';
        ctx.lineWidth = 0.5;
        for (let i = 1; i <= 6; i++) {
            const ly = sy - 3 - h * (i / 7);
            ctx.beginPath();
            ctx.moveTo(sx - hw, ly + hd * (i/7));
            ctx.lineTo(sx, ly - hd + hd * (i/7));
            ctx.stroke();
        }

        // Roof
        this._gableRoof(ctx, sx, sy - 3, hw, hd, h, 8 * p, 3,
            '#687078', '#586068', '#788088');

        // Chimney
        if (p > 0.6) {
            const cx = sx + hw * 0.5, cy = sy - 3;
            this._box(ctx, cx, cy, 4, 2, h + 18,
                '#606060', ['#505050','#404040'], ['#383838','#282828']);
            // Red stripes on chimney
            ctx.fillStyle = '#c04040';
            ctx.fillRect(cx - 4, cy - h - 16, 8, 2);
            ctx.fillRect(cx - 4, cy - h - 10, 8, 2);

            // Animated smoke
            const st = this.animTime;
            for (let i = 0; i < 5; i++) {
                const smokeY = cy - h - 20 - i * 7 - Math.sin(st * 1.5 + i) * 3;
                const smokeX = cx + Math.sin(st * 0.8 + i * 0.7) * (4 + i * 2);
                const r = 3 + i * 2;
                ctx.fillStyle = `rgba(160,160,170,${0.25 - i * 0.04})`;
                ctx.beginPath();
                ctx.arc(smokeX, smokeY, r, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Loading dock
        if (p > 0.5) {
            this._box(ctx, sx - hw * 0.6, sy + hd * 0.5, 10, 5, 4,
                '#909898', ['#808888','#707878'], ['#687070','#586060']);
        }

        // Windows
        if (p > 0.4) {
            for (let i = 0; i < 4; i++) {
                this._windowL(ctx, sx, sy - 3, hw * (0.1 + i * 0.2), h * 0.6, 5, 6);
            }
            for (let i = 0; i < 3; i++) {
                this._windowR(ctx, sx, sy - 3, hw * (0.15 + i * 0.25), h * 0.6, 5, 6);
            }
        }

        // Door
        if (p > 0.6) {
            ctx.fillStyle = '#505860';
            ctx.fillRect(sx - 4, sy - 3 - hd - 10, 8, 10);
        }
    },

    // --- JEMBATAN (Bridge) ---
    _drawJembatan(ctx, sx, sy, p) {
        // Try sprite first
        if (this.spritesLoaded) {
            const sprite = this.spriteImages.bridgeEW;
            if (sprite) {
                const scale = this.TW / this.SPRITE_BASE_WIDTH;
                const drawW = sprite.width * scale;
                const drawH = sprite.height * scale;
                const anchorX = (sprite.width / 2) * scale;
                const anchorY = this.SPRITE_ANCHOR_Y * scale;
                ctx.drawImage(sprite, sx - anchorX, sy - anchorY - 4, drawW, drawH);
                return;
            }
        }

        // Canvas fallback
        const hw = 24, hd = 12;
        
        // Bridge deck
        this._box(ctx, sx, sy - 4, hw, hd, 3,
            '#a0a0a0', ['#909090','#808080'], ['#787878','#686868']);

        // Road surface on bridge
        ctx.fillStyle = '#808890';
        ctx.beginPath();
        ctx.moveTo(sx, sy - 4 - hd - 3);
        ctx.lineTo(sx + hw * 0.8, sy - 7);
        ctx.lineTo(sx, sy + hd * 0.8 - 7);
        ctx.lineTo(sx - hw * 0.8, sy - 7);
        ctx.closePath();
        ctx.fill();

        // Railings
        ctx.strokeStyle = '#909090';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx - hw, sy - 4);
        ctx.lineTo(sx - hw, sy - 10);
        ctx.lineTo(sx, sy - hd - 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx + hw, sy - 4);
        ctx.lineTo(sx + hw, sy - 10);
        ctx.lineTo(sx, sy - hd - 10);
        ctx.stroke();
        for (let i = 0; i < 3; i++) {
            const t = i / 2;
            const lx = sx - hw + (hw) * t;
            const ly = sy - 4 + (-hd + 4) * t;
            ctx.fillStyle = '#888888';
            ctx.fillRect(lx - 1, ly - 8, 2, 6);
            const rx = sx + hw - (hw) * t;
            ctx.fillRect(rx - 1, ly - 8, 2, 6);
        }

        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy + 2, 14, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
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
                this.renderTile(ctx, x, y);
            }
        }

        // === PASS 2: Forest trees + Buildings (back to front for depth) ===
        for (let y = 0; y < GameData.MAP_SIZE; y++) {
            for (let x = 0; x < GameData.MAP_SIZE; x++) {
                const scr = this.tileToScreen(x, y);
                if (scr.x < vpLeft - 100 || scr.x > vpRight + 100 || scr.y < vpTop - 150 || scr.y > vpBottom + 30) continue;

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
            }
        }

        // === PASS 3: People ===
        this.renderPeople(ctx);

        // === PASS 4: Butterflies ===
        this.renderButterflies(ctx);

        // === PASS 5: Hover / Placement ===
        this.renderHover(ctx);
        if (Game.selectedBuilding) this.renderPlacementPreview(ctx);

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
