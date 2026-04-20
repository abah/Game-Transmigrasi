// ======================================================
// MAIN.JS - Game Initialization and Main Loop
// ======================================================

const Game = {
    // State
    map: {
        tiles: [],
        buildings: []
    },
    resources: {},
    selectedBuilding: null,
    speed: 1,
    lastTime: 0,
    running: false,

    // ===== INITIALIZATION =====
    async init() {
        // Show loading progress
        UI.updateLoadingBar(10, 'Menginisialisasi...');
        
        await this.delay(300);
        UI.updateLoadingBar(30, 'Membuat peta...');
        
        this.generateMap();
        
        await this.delay(300);
        UI.updateLoadingBar(50, 'Menyiapkan sumber daya...');
        
        this.initResources();
        
        await this.delay(300);
        UI.updateLoadingBar(60, 'Membangun dunia...');
        
        this.placeInitialStructures();
        
        await this.delay(200);
        UI.updateLoadingBar(70, 'Memuat sprite...');
        
        await Renderer.loadSprites();
        
        await this.delay(200);
        UI.updateLoadingBar(90, 'Menyelesaikan persiapan...');
        
        Simulation.init();
        
        await this.delay(300);
        UI.updateLoadingBar(100, 'Siap!');
        
        await this.delay(500);
        UI.hideLoading();

        // Setup start button
        document.getElementById('btn-start').addEventListener('click', () => {
            UI.showGame();
            Renderer.init();
            UI.init();
            this.running = true;
            this.lastTime = performance.now();
            requestAnimationFrame((t) => this.gameLoop(t));
        });
    },

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    // ===== MAP GENERATION =====
    generateMap() {
        const size = GameData.MAP_SIZE;
        this.map.tiles = new Array(size * size).fill(GameData.TILE.FOREST);
        this.map.buildings = new Array(size * size).fill(null);

        // Create clearing in center (scaled for larger maps)
        const center = Math.floor(size / 2);
        const clearRadius = Math.floor(size * 0.18);
        const mixRadius = Math.floor(size * 0.28);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = x - center;
                const dy = y - center;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < clearRadius) {
                    this.map.tiles[y * size + x] = GameData.TILE.GRASS;
                } else if (dist < mixRadius) {
                    if (Math.random() < 0.6) {
                        this.map.tiles[y * size + x] = GameData.TILE.GRASS;
                    }
                }
            }
        }

        // Generate main river (wider for bigger map)
        let riverX = Math.floor(size * 0.28);
        for (let y = 0; y < size; y++) {
            const offset = Math.floor(Math.sin(y * 0.2) * 3);
            const riverWidth = y > size * 0.6 ? 2 : 1; // river widens downstream
            for (let w = -riverWidth; w <= riverWidth; w++) {
                const rx = riverX + offset + w;
                if (rx >= 0 && rx < size) {
                    this.map.tiles[y * size + rx] = GameData.TILE.WATER;
                }
            }
        }

        // Generate a secondary stream
        let streamY = Math.floor(size * 0.35);
        for (let x = Math.floor(size * 0.28); x < Math.floor(size * 0.7); x++) {
            const offset = Math.floor(Math.sin(x * 0.25) * 2);
            const sy = streamY + offset;
            if (sy >= 0 && sy < size) {
                this.map.tiles[sy * size + x] = GameData.TILE.WATER;
            }
        }

        // Add scattered clearings (more for bigger map)
        const numClearings = Math.floor(size * 0.5);
        for (let i = 0; i < numClearings; i++) {
            const cx = Math.floor(Math.random() * (size - 10)) + 5;
            const cy = Math.floor(Math.random() * (size - 10)) + 5;
            const radius = 2 + Math.floor(Math.random() * 4);
            for (let y = cy - radius; y <= cy + radius; y++) {
                for (let x = cx - radius; x <= cx + radius; x++) {
                    if (x >= 0 && x < size && y >= 0 && y < size) {
                        const d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
                        if (d < radius && this.map.tiles[y * size + x] !== GameData.TILE.WATER) {
                            this.map.tiles[y * size + x] = GameData.TILE.GRASS;
                        }
                    }
                }
            }
        }

        // Add small ponds
        const numPonds = Math.floor(size * 0.15);
        for (let i = 0; i < numPonds; i++) {
            const px = Math.floor(Math.random() * (size - 8)) + 4;
            const py = Math.floor(Math.random() * (size - 8)) + 4;
            const pondSize = 1 + Math.floor(Math.random() * 2);
            for (let dy = -pondSize; dy <= pondSize; dy++) {
                for (let dx = -pondSize; dx <= pondSize; dx++) {
                    if (Math.random() < 0.7 && Math.abs(dx) + Math.abs(dy) <= pondSize + 1) {
                        const idx = (py + dy) * size + (px + dx);
                        if (idx >= 0 && idx < size * size && this.map.tiles[idx] === GameData.TILE.GRASS) {
                            this.map.tiles[idx] = GameData.TILE.WATER;
                        }
                    }
                }
            }
        }
    },

    // ===== INITIAL RESOURCES =====
    initResources() {
        this.resources = { ...GameData.INITIAL_RESOURCES };
    },

    // ===== INITIAL STRUCTURES =====
    placeInitialStructures() {
        const center = Math.floor(GameData.MAP_SIZE / 2);

        // Place starting road
        for (let i = -2; i <= 2; i++) {
            this.setTileAndBuilding(center + i, center, 'jalan');
        }
        for (let i = -2; i <= 2; i++) {
            this.setTileAndBuilding(center, center + i, 'jalan');
        }

        // Place initial houses
        this.placeBuildingDirect(center - 2, center - 2, 'rumah_transmigran');
        this.placeBuildingDirect(center + 1, center - 2, 'rumah_transmigran');
        this.placeBuildingDirect(center - 2, center + 1, 'rumah_transmigran');
        this.placeBuildingDirect(center + 1, center + 1, 'rumah_transmigran');

        // Place initial sawah
        this.placeBuildingDirect(center + 3, center - 1, 'sawah');
        this.placeBuildingDirect(center + 3, center, 'sawah');
        this.placeBuildingDirect(center + 3, center + 1, 'sawah');

        // Update max populasi from initial buildings
        this.recalculateEffects();
    },

    setTileAndBuilding(x, y, buildingId) {
        const size = GameData.MAP_SIZE;
        if (x < 0 || y < 0 || x >= size || y >= size) return;
        const bData = GameData.BUILDINGS[buildingId];
        if (bData && bData.isTile) {
            this.map.tiles[y * size + x] = bData.tileType;
        }
        this.map.buildings[y * size + x] = {
            id: buildingId,
            originX: x,
            originY: y,
            buildTime: 0
        };
    },

    placeBuildingDirect(x, y, buildingId) {
        const size = GameData.MAP_SIZE;
        const bData = GameData.BUILDINGS[buildingId];
        if (!bData) return;

        const s = bData.size || 1;
        for (let dy = 0; dy < s; dy++) {
            for (let dx = 0; dx < s; dx++) {
                const tx = x + dx;
                const ty = y + dy;
                if (tx >= 0 && tx < size && ty >= 0 && ty < size) {
                    this.map.tiles[ty * size + tx] = GameData.TILE.DIRT;
                    this.map.buildings[ty * size + tx] = {
                        id: buildingId,
                        originX: x,
                        originY: y,
                        buildTime: 0
                    };
                }
            }
        }
    },

    recalculateEffects() {
        const size = GameData.MAP_SIZE;
        let totalMaxPop = 20; // base

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const building = this.map.buildings[y * size + x];
                if (!building || !building.id || building.buildTime > 0) continue;
                if (building.originX !== x || building.originY !== y) continue;

                const bData = GameData.BUILDINGS[building.id];
                if (bData && bData.effects.maxPopulasi) {
                    totalMaxPop += bData.effects.maxPopulasi;
                }
            }
        }

        this.resources.maxPopulasi = totalMaxPop;
    },

    // ===== BUILDING PLACEMENT =====
    canPlaceAt(tileX, tileY, bData) {
        const size = GameData.MAP_SIZE;
        const s = bData.size || 1;

        for (let dy = 0; dy < s; dy++) {
            for (let dx = 0; dx < s; dx++) {
                const tx = tileX + dx;
                const ty = tileY + dy;

                // Out of bounds
                if (tx < 0 || ty < 0 || tx >= size || ty >= size) return false;

                const tileType = this.map.tiles[ty * size + tx];
                const existing = this.map.buildings[ty * size + tx];

                // Check if tile requires specific terrain
                if (bData.requiresTile !== undefined) {
                    const allowed = Array.isArray(bData.requiresTile) ? bData.requiresTile : [bData.requiresTile];
                    if (!allowed.includes(tileType)) return false;
                } else {
                    // Can't build on water (unless it's a bridge)
                    if (tileType === GameData.TILE.WATER) return false;
                }

                // Can't build on existing building (roads are ok to build over)
                if (existing && existing.id) {
                    const existingData = GameData.BUILDINGS[existing.id];
                    if (!existingData || !existingData.isTile) return false;
                }
            }
        }

        // Check resources
        const res = this.resources;
        if (bData.cost.dana && res.dana < bData.cost.dana) return false;
        if (bData.cost.material && res.material < bData.cost.material) return false;

        return true;
    },

    pendingPlacement: null, // { tileX, tileY, id } — mobile: shown as ghost awaiting confirm

    // Returns true if we should use the 2-step (preview → confirm) flow instead
    // of committing immediately. Enabled on touch-only devices to prevent
    // accidental taps.
    _useConfirmFlow() {
        if (typeof PWA !== 'undefined' && PWA._isMobile) return true;
        if (matchMedia('(hover: none)').matches) return true;
        return false;
    },

    // Called from canvas tap/drag end when a building is selected.
    // On mobile: stores pending placement + shows confirm bar (no cost deducted).
    // On desktop: passes through to placeBuilding (original behavior).
    requestPlacement(tileX, tileY) {
        if (!this.selectedBuilding) return;
        if (!this._useConfirmFlow()) {
            this.placeBuilding(tileX, tileY);
            return;
        }

        const bData = GameData.BUILDINGS[this.selectedBuilding];
        if (!bData) return;

        // Validate up-front so user doesn't go through confirm then fail.
        if (!this.canPlaceAt(tileX, tileY, bData)) {
            UI.notify('❌ Tidak bisa membangun di sini!', 'error');
            if (typeof PWA !== 'undefined') PWA.hapticError();
            return;
        }

        this.pendingPlacement = {
            tileX,
            tileY,
            id: this.selectedBuilding,
        };
        // Pin the ghost preview at the chosen tile so it stays visible after
        // the finger lifts (renderPlacementPreview reads hoverTile).
        if (typeof Renderer !== 'undefined' && Renderer.hoverTile) {
            Renderer.hoverTile = { x: tileX, y: tileY };
        }
        UI.showPlaceConfirm(bData);
        if (typeof PWA !== 'undefined') PWA.hapticLight();
    },

    confirmPendingPlacement() {
        if (!this.pendingPlacement) return;
        const { tileX, tileY } = this.pendingPlacement;
        this.pendingPlacement = null;
        UI.hidePlaceConfirm();
        this.placeBuilding(tileX, tileY);
    },

    cancelPendingPlacement() {
        this.pendingPlacement = null;
        UI.hidePlaceConfirm();
        if (typeof PWA !== 'undefined') PWA.hapticLight();
    },

    placeBuilding(tileX, tileY) {
        if (!this.selectedBuilding) return;

        const bData = GameData.BUILDINGS[this.selectedBuilding];
        if (!bData) return;

        if (!this.canPlaceAt(tileX, tileY, bData)) {
            UI.notify('❌ Tidak bisa membangun di sini!', 'error');
            if (typeof PWA !== 'undefined') PWA.vibrate([80]);
            return;
        }

        // Deduct costs
        if (bData.cost.dana) this.resources.dana -= bData.cost.dana;
        if (bData.cost.material) this.resources.material -= bData.cost.material;

        // Place building
        const size = GameData.MAP_SIZE;
        const s = bData.size || 1;

        if (bData.isTile) {
            this.map.tiles[tileY * size + tileX] = bData.tileType;
            this.map.buildings[tileY * size + tileX] = {
                id: this.selectedBuilding,
                originX: tileX,
                originY: tileY,
                buildTime: 0
            };
        } else {
            for (let dy = 0; dy < s; dy++) {
                for (let dx = 0; dx < s; dx++) {
                    const tx = tileX + dx;
                    const ty = tileY + dy;
                    // Clear forest when building
                    if (this.map.tiles[ty * size + tx] === GameData.TILE.FOREST) {
                        this.map.tiles[ty * size + tx] = GameData.TILE.DIRT;
                    }
                    if (bData.id === 'sawah' || bData.id === 'ladang') {
                        this.map.tiles[ty * size + tx] = GameData.TILE.FARMLAND;
                    } else if (this.map.tiles[ty * size + tx] !== GameData.TILE.ROAD) {
                        this.map.tiles[ty * size + tx] = GameData.TILE.DIRT;
                    }
                    this.map.buildings[ty * size + tx] = {
                        id: this.selectedBuilding,
                        originX: tileX,
                        originY: tileY,
                        buildTime: bData.isTile ? 0 : 2 // 2 months construction
                    };
                }
            }
        }

        // Apply immediate effects
        if (bData.effects.happiness) this.resources.happiness = Math.min(100, this.resources.happiness + bData.effects.happiness);
        if (bData.effects.education) this.resources.education = Math.min(100, this.resources.education + bData.effects.education);
        if (bData.effects.health) this.resources.health = Math.min(100, this.resources.health + bData.effects.health);

        // Recalculate max population
        this.recalculateEffects();

        // Effects
        Renderer.addParticle(tileX, tileY, 'build');
        if (typeof PWA !== 'undefined') PWA.vibrate([15, 30, 15]);
        UI.notify('🏗️ Membangun ' + bData.name + '...', 'success');
        UI.addEventLog('Pembangunan ' + bData.name + ' dimulai.', 'neutral');
        UI.updateResources();
        UI.updateBuildButtons();
        UI.updateStats();

        // Don't deselect - allow placing multiple
    },

    selectTile(tileX, tileY) {
        // Deselect building mode first
        if (this.selectedBuilding) {
            this.selectedBuilding = null;
            document.querySelectorAll('.build-item').forEach(i => i.classList.remove('active'));
            document.getElementById('game-canvas').classList.remove('placing');
            return;
        }

        // Check if tile has a building
        const size = GameData.MAP_SIZE;
        if (tileX < 0 || tileY < 0 || tileX >= size || tileY >= size) return;

        const entry = this.map.buildings[tileY * size + tileX];
        if (!entry || !entry.id) return;

        const bData = GameData.BUILDINGS[entry.id];
        if (!bData) return;

        // Don't show popup for tiles (roads, bridges)
        if (bData.isTile) return;

        this._showTileActionPopup(entry.originX, entry.originY, bData, entry);
    },

    _showTileActionPopup(originX, originY, bData, entry) {
        const popup = document.getElementById('tile-action-popup');
        if (!popup) return;

        document.getElementById('tap-popup-icon').textContent = bData.icon || '🏠';
        document.getElementById('tap-popup-name').textContent = bData.name;

        const statusEl = document.getElementById('tap-popup-status');
        if (entry.buildTime > 0) {
            statusEl.textContent = `🏗️ Sedang dibangun (${entry.buildTime} bulan tersisa)`;
            statusEl.className = 'tap-popup-status under-construction';
        } else {
            statusEl.textContent = '✅ Beroperasi';
            statusEl.className = 'tap-popup-status operational';
        }

        // Stats
        const statsEl = document.getElementById('tap-popup-stats');
        const lines = [];
        if (bData.effects) {
            if (bData.effects.happiness) lines.push(`😊 Kebahagiaan +${bData.effects.happiness}`);
            if (bData.effects.education) lines.push(`📚 Pendidikan +${bData.effects.education}`);
            if (bData.effects.health) lines.push(`❤️ Kesehatan +${bData.effects.health}`);
            if (bData.effects.maxPopulasi) lines.push(`👥 Kapasitas +${bData.effects.maxPopulasi}`);
        }
        if (bData.production) {
            if (bData.production.dana) lines.push(`💰 Pendapatan ${bData.production.dana >= 0 ? '+' : ''}${bData.production.dana}/bln`);
            if (bData.production.pangan) lines.push(`🌾 Pangan +${bData.production.pangan}/bln`);
            if (bData.production.material) lines.push(`🧱 Material +${bData.production.material}/bln`);
        }
        statsEl.textContent = lines.join('  ·  ');

        // Refund info (50% of cost)
        const refundEl = document.getElementById('tap-popup-refund');
        const refunds = [];
        if (bData.cost.dana) refunds.push(`Rp ${Math.floor(bData.cost.dana * 0.5).toLocaleString('id-ID')}`);
        if (bData.cost.material) refunds.push(`${Math.floor(bData.cost.material * 0.5)} material`);
        refundEl.textContent = refunds.length ? `Pembongkaran mengembalikan 50%: ${refunds.join(', ')}` : '';

        // Store target for demolish button
        popup._targetX = originX;
        popup._targetY = originY;
        popup._bData = bData;

        popup.style.display = 'flex';

        // Close button
        document.getElementById('tap-popup-close').onclick = () => { popup.style.display = 'none'; };
        popup.onclick = (e) => { if (e.target === popup) popup.style.display = 'none'; };

        // Demolish button
        document.getElementById('tap-popup-demolish').onclick = () => {
            popup.style.display = 'none';
            this.demolishBuilding(popup._targetX, popup._targetY, popup._bData);
        };
    },

    demolishBuilding(originX, originY, bData) {
        const size = GameData.MAP_SIZE;
        const s = bData.size || 1;

        // Remove all tiles occupied by this building
        for (let dy = 0; dy < s; dy++) {
            for (let dx = 0; dx < s; dx++) {
                const tx = originX + dx;
                const ty = originY + dy;
                if (tx < 0 || ty < 0 || tx >= size || ty >= size) continue;
                this.map.buildings[ty * size + tx] = null;
                // Restore tile to dirt (keep farmland as dirt too)
                if (this.map.tiles[ty * size + tx] !== GameData.TILE.WATER &&
                    this.map.tiles[ty * size + tx] !== GameData.TILE.ROAD) {
                    this.map.tiles[ty * size + tx] = GameData.TILE.DIRT;
                }
            }
        }

        // Refund 50% of costs
        if (bData.cost.dana) this.resources.dana += Math.floor(bData.cost.dana * 0.5);
        if (bData.cost.material) this.resources.material += Math.floor(bData.cost.material * 0.5);

        // Recalculate
        this.recalculateEffects();
        Renderer.addParticle(originX, originY, 'demolish');
        if (typeof PWA !== 'undefined') PWA.vibrate([40, 20, 40]);
        UI.notify(`🔨 ${bData.name} dibongkar. Dana +50% dikembalikan.`, 'neutral');
        UI.addEventLog(`Pembongkaran ${bData.name} selesai.`, 'neutral');
        UI.updateResources();
        UI.updateBuildButtons();
        UI.updateStats();
    },

    getBuildingList() {
        const buildings = [];
        const size = GameData.MAP_SIZE;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const b = this.map.buildings[y * size + x];
                if (b && b.id && !GameData.BUILDINGS[b.id]?.isTile && b.originX === x && b.originY === y) {
                    buildings.push({ x, y, id: b.id });
                }
            }
        }
        return buildings;
    },

    // ===== GAME LOOP =====
    gameLoop(timestamp) {
        if (!this.running) return;

        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;

        try {
            // Update simulation
            Simulation.update(dt, this.speed);

            // Update people
            const popRatio = Math.floor(this.resources.populasi / 5);
            Renderer.spawnPeople(popRatio);

            // Render
            Renderer.render(dt);
        } catch (err) {
            console.error('[GameLoop Error]', err);
        }

        requestAnimationFrame((t) => this.gameLoop(t));
    }
};

// ===== START =====
window.addEventListener('DOMContentLoaded', () => {
    Game.init();
    initMobileUI();
});

// ===== MOBILE UI =====
function initMobileUI() {
    const panel = document.getElementById('side-panel');
    const toggleBtn = document.getElementById('btn-panel-toggle');
    const toggleIcon = document.getElementById('btn-panel-icon');
    const toggleLabel = document.getElementById('btn-panel-label');
    if (!panel || !toggleBtn) return;

    const isMobile = () => window.innerWidth <= 1024;

    function openPanel() {
        panel.classList.add('mobile-open');
        toggleBtn.classList.add('panel-open');
        toggleIcon.textContent = '✕';
        toggleLabel.textContent = 'Tutup';
    }
    function closePanel() {
        panel.classList.remove('mobile-open');
        toggleBtn.classList.remove('panel-open');
        toggleIcon.textContent = '🏗️';
        toggleLabel.textContent = 'Bangun';
    }
    function togglePanel() {
        if (panel.classList.contains('mobile-open')) closePanel();
        else openPanel();
    }

    toggleBtn.addEventListener('click', togglePanel);

    // Swipe-down on panel drag handle to close
    let sheetTouchY = 0;
    panel.addEventListener('touchstart', e => {
        sheetTouchY = e.touches[0].clientY;
    }, { passive: true });
    panel.addEventListener('touchend', e => {
        const dy = e.changedTouches[0].clientY - sheetTouchY;
        if (dy > 60 && isMobile()) closePanel();
    }, { passive: true });

    // Close panel when a building is selected (auto-close to show map)
    const origSelect = Game.selectBuilding ? Game.selectBuilding.bind(Game) : null;
    if (origSelect) {
        Game.selectBuilding = function(id) {
            origSelect(id);
            if (isMobile()) setTimeout(closePanel, 200);
        };
    }

    // Watch for build buttons to close sheet on tap
    document.querySelectorAll('.build-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (isMobile()) setTimeout(closePanel, 300);
        });
    });

    // Tap on canvas closes panel on mobile
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
        canvas.addEventListener('touchstart', () => {
            if (isMobile() && panel.classList.contains('mobile-open')) closePanel();
        }, { passive: true });
    }

    // Resize: re-check layout
    window.addEventListener('resize', () => {
        if (!isMobile()) {
            panel.classList.remove('mobile-open');
            toggleBtn.classList.remove('panel-open');
        }
    });
}
