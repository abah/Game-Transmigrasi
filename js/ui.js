// ======================================================
// UI.JS - User Interface Management
// ======================================================

const UI = {
    init() {
        this.setupTabs();
        this.setupSpeedButtons();
        this.setupBuildButtons();
        this.setupModalClose();
        this.setupHelpButton();
        this.updateResources();
        this.updateTime();
        this.updateStats();
        this.addEventLog('Selamat datang di kawasan transmigrasi baru! Mulailah membangun pemukiman dan infrastruktur.', 'neutral');
    },

    // ===== TAB NAVIGATION =====
    setupTabs() {
        document.querySelectorAll('.panel-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.panel-content').forEach(c => c.style.display = 'none');
                tab.classList.add('active');
                document.getElementById('tab-' + tab.dataset.tab).style.display = 'block';
            });
        });
    },

    // ===== SPEED CONTROLS =====
    setupSpeedButtons() {
        document.querySelectorAll('.btn-speed').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                Game.speed = parseInt(btn.dataset.speed);
            });
        });
    },

    // ===== BUILD BUTTONS =====
    setupBuildButtons() {
        const categories = {
            housing: document.getElementById('build-housing'),
            farming: document.getElementById('build-farming'),
            public: document.getElementById('build-public'),
            economy: document.getElementById('build-economy'),
            infra: document.getElementById('build-infra')
        };

        const isMobile = () => window.innerWidth <= 768;

        for (let key in GameData.BUILDINGS) {
            const bData = GameData.BUILDINGS[key];
            const container = categories[bData.category];
            if (!container) continue;

            const item = document.createElement('div');
            item.className = 'build-item';
            item.dataset.buildingId = key;

            const costText = [];
            if (bData.cost.dana) costText.push('💰' + (bData.cost.dana / 1000).toFixed(0) + 'K');
            if (bData.cost.material) costText.push('🧱' + bData.cost.material);

            item.innerHTML = `
                <span class="build-icon">${bData.icon}</span>
                <span class="build-name">${bData.name}</span>
                <span class="build-cost">${costText.join(' ')}</span>
                <button class="build-info-btn" aria-label="Info ${bData.name}" title="Info">ℹ️</button>
            `;

            const infoBtn = item.querySelector('.build-info-btn');

            // ── Info button: always opens info sheet (mobile) or tooltip (desktop) ──
            infoBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // prevent triggering item click
                if (isMobile()) {
                    this.showMobileBuildInfo(bData, key);
                } else {
                    this.showBuildTooltip(e, bData);
                    clearTimeout(this._tooltipTimer);
                    this._tooltipTimer = setTimeout(() => {
                        document.getElementById('building-tooltip').style.display = 'none';
                    }, 4000);
                }
            });

            // ── Main card click ───────────────────────────────────────────
            item.addEventListener('click', (e) => {
                // Ignore if info btn was clicked
                if (e.target.classList.contains('build-info-btn')) return;

                if (item.classList.contains('disabled')) {
                    if (isMobile()) {
                        // On mobile: open info sheet to explain why locked
                        this.showMobileBuildInfo(bData, key);
                    } else {
                        this.showBuildTooltip(e, bData);
                        clearTimeout(this._tooltipTimer);
                        this._tooltipTimer = setTimeout(() => {
                            document.getElementById('building-tooltip').style.display = 'none';
                        }, 4000);
                    }
                    return;
                }

                // Toggle selection
                if (Game.selectedBuilding === key) {
                    Game.selectedBuilding = null;
                    document.querySelectorAll('.build-item').forEach(i => i.classList.remove('active'));
                    document.getElementById('game-canvas').classList.remove('placing');
                } else {
                    Game.selectedBuilding = key;
                    document.querySelectorAll('.build-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                    document.getElementById('game-canvas').classList.add('placing');
                }
            });

            // ── Hover tooltip: desktop only ───────────────────────────────
            item.addEventListener('mouseenter', (e) => {
                if (!isMobile()) this.showBuildTooltip(e, bData);
            });
            item.addEventListener('mouseleave', () => {
                if (!isMobile()) document.getElementById('building-tooltip').style.display = 'none';
            });

            container.appendChild(item);
        }

        this.updateBuildButtons();
    },

    // ===== MOBILE BUILD INFO SHEET =====
    showMobileBuildInfo(bData, key) {
        // Remove any existing sheet
        const existing = document.getElementById('mobile-build-info');
        if (existing) existing.remove();

        const res = Game.resources;
        const stageUnlocked = bData.unlockStage <= Simulation.currentStage;
        const canAffordDana = !bData.cost.dana || res.dana >= bData.cost.dana;
        const canAffordMaterial = !bData.cost.material || res.material >= bData.cost.material;
        const isAvailable = stageUnlocked && canAffordDana && canAffordMaterial;
        const isDisabled = !isAvailable;

        // Cost
        const costParts = [];
        if (bData.cost.dana) {
            const ok = res.dana >= bData.cost.dana;
            costParts.push(`<span class="mbi-cost-item ${ok ? 'ok' : 'bad'}">💰 Rp ${bData.cost.dana.toLocaleString('id-ID')}${ok ? '' : ' ✗'}</span>`);
        }
        if (bData.cost.material) {
            const ok = res.material >= bData.cost.material;
            costParts.push(`<span class="mbi-cost-item ${ok ? 'ok' : 'bad'}">🧱 ${bData.cost.material} unit${ok ? '' : ' ✗'}</span>`);
        }

        // Effects
        let effectsHTML = '';
        for (let k in bData.production) {
            if (bData.production[k]) {
                const label = k === 'dana' ? '💰 Pendapatan' : k === 'pangan' ? '🌾 Pangan' : '🧱 Material';
                const val = k === 'dana' ? 'Rp ' + bData.production[k].toLocaleString('id-ID') : bData.production[k];
                effectsHTML += `<span class="mbi-effect positive">+${val}/bln ${label}</span>`;
            }
        }
        for (let k in bData.effects) {
            if (bData.effects[k]) {
                const labels = { maxPopulasi: '👥 Kapasitas', happiness: '😊 Kebahagiaan', education: '📚 Pendidikan', health: '❤️ Kesehatan' };
                effectsHTML += `<span class="mbi-effect positive">+${bData.effects[k]} ${labels[k] || k}</span>`;
            }
        }

        // Requirements (if locked)
        let reqHTML = '';
        if (!stageUnlocked) {
            const reqStage = GameData.STAGES[bData.unlockStage];
            reqHTML += `<div class="mbi-req locked">🔒 Butuh tahap: <strong>${reqStage.name}</strong> (populasi ≥ ${reqStage.minPopulation})</div>`;
        }
        if (!canAffordDana) {
            reqHTML += `<div class="mbi-req locked">💰 Dana kurang Rp ${(bData.cost.dana - res.dana).toLocaleString('id-ID')}</div>`;
        }
        if (!canAffordMaterial) {
            reqHTML += `<div class="mbi-req locked">🧱 Material kurang ${bData.cost.material - res.material} unit</div>`;
        }

        const sheet = document.createElement('div');
        sheet.id = 'mobile-build-info';
        sheet.innerHTML = `
            <div class="mbi-backdrop"></div>
            <div class="mbi-sheet">
                <div class="mbi-handle"></div>
                <div class="mbi-header">
                    <span class="mbi-icon">${bData.icon}</span>
                    <div class="mbi-title-group">
                        <h3 class="mbi-name">${bData.name}</h3>
                        <p class="mbi-desc">${bData.desc}</p>
                    </div>
                    <button class="mbi-close" aria-label="Tutup">✕</button>
                </div>
                <div class="mbi-cost-row">${costParts.join('')}</div>
                ${effectsHTML ? `<div class="mbi-effects">${effectsHTML}</div>` : ''}
                ${reqHTML ? `<div class="mbi-reqs">${reqHTML}</div>` : ''}
                <div class="mbi-actions">
                    ${isAvailable
                        ? `<button class="mbi-btn-select" data-key="${key}">✅ Pilih & Bangun</button>`
                        : `<button class="mbi-btn-locked" disabled>🔒 Belum Tersedia</button>`
                    }
                </div>
            </div>
        `;
        document.body.appendChild(sheet);

        // Animate in
        requestAnimationFrame(() => sheet.querySelector('.mbi-sheet').classList.add('mbi-open'));

        const close = () => {
            const s = sheet.querySelector('.mbi-sheet');
            s.classList.remove('mbi-open');
            s.addEventListener('transitionend', () => sheet.remove(), { once: true });
        };

        sheet.querySelector('.mbi-close').addEventListener('click', close);
        sheet.querySelector('.mbi-backdrop').addEventListener('click', close);

        // "Pilih & Bangun" button
        const selectBtn = sheet.querySelector('.mbi-btn-select');
        if (selectBtn) {
            selectBtn.addEventListener('click', () => {
                const k = selectBtn.dataset.key;
                Game.selectedBuilding = k;
                document.querySelectorAll('.build-item').forEach(i => i.classList.remove('active'));
                const activeItem = document.querySelector(`.build-item[data-building-id="${k}"]`);
                if (activeItem) activeItem.classList.add('active');
                document.getElementById('game-canvas').classList.add('placing');
                close();
                // Also close the bottom sheet panel so canvas is visible
                const panel = document.getElementById('side-panel');
                if (panel) {
                    panel.classList.remove('mobile-open');
                    const toggleBtn = document.getElementById('btn-panel-toggle');
                    if (toggleBtn) {
                        toggleBtn.classList.remove('panel-open');
                        const icon = document.getElementById('btn-panel-icon');
                        const label = document.getElementById('btn-panel-label');
                        if (icon) icon.textContent = '🏗️';
                        if (label) label.textContent = 'Bangun';
                    }
                }
            });
        }

        // Swipe down to close
        let startY = 0;
        const s = sheet.querySelector('.mbi-sheet');
        s.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
        s.addEventListener('touchend', e => {
            if (e.changedTouches[0].clientY - startY > 60) close();
        }, { passive: true });
    },

    showBuildTooltip(e, bData) {
        const tooltip = document.getElementById('building-tooltip');
        document.getElementById('tooltip-title').textContent = bData.icon + ' ' + bData.name;
        document.getElementById('tooltip-desc').textContent = bData.desc;

        // --- Stats (biaya, produksi, efek) ---
        let statsHTML = '';
        const res = Game.resources;

        // Cost with color indicator (red if not enough, normal if enough)
        if (bData.cost.dana) {
            const hasEnough = res.dana >= bData.cost.dana;
            statsHTML += `<div class="tip-stat"><span class="tip-label">Biaya Dana</span><span class="tip-val ${hasEnough ? 'negative' : 'insufficient'}">Rp ${bData.cost.dana.toLocaleString('id-ID')}${!hasEnough ? ' ✗' : ''}</span></div>`;
        }
        if (bData.cost.material) {
            const hasEnough = res.material >= bData.cost.material;
            statsHTML += `<div class="tip-stat"><span class="tip-label">Biaya Material</span><span class="tip-val ${hasEnough ? 'negative' : 'insufficient'}">${bData.cost.material} unit${!hasEnough ? ' ✗' : ''}</span></div>`;
        }
        
        for (let key in bData.production) {
            if (bData.production[key] !== 0) {
                const label = key === 'dana' ? 'Pendapatan' : key === 'pangan' ? 'Produksi Pangan' : 'Produksi Material';
                const val = key === 'dana' ? 'Rp ' + bData.production[key].toLocaleString('id-ID') : bData.production[key];
                statsHTML += `<div class="tip-stat"><span class="tip-label">${label}/bln</span><span class="tip-val positive">+${val}</span></div>`;
            }
        }
        for (let key in bData.effects) {
            if (bData.effects[key] !== 0) {
                const labels = {
                    maxPopulasi: 'Kapasitas', happiness: 'Kebahagiaan',
                    education: 'Pendidikan', health: 'Kesehatan'
                };
                statsHTML += `<div class="tip-stat"><span class="tip-label">${labels[key] || key}</span><span class="tip-val positive">+${bData.effects[key]}</span></div>`;
            }
        }

        document.getElementById('tooltip-stats').innerHTML = statsHTML;

        // --- Requirements section ---
        let reqHTML = '';
        const stageUnlocked = bData.unlockStage <= Simulation.currentStage;
        const canAffordDana = !bData.cost.dana || res.dana >= bData.cost.dana;
        const canAffordMaterial = !bData.cost.material || res.material >= bData.cost.material;
        const isLocked = !stageUnlocked || !canAffordDana || !canAffordMaterial;

        if (isLocked) {
            reqHTML += '<div class="tip-req-header">⚠️ Syarat belum terpenuhi:</div>';

            if (!stageUnlocked) {
                const reqStage = GameData.STAGES[bData.unlockStage];
                const reqPop = reqStage.minPopulation;
                reqHTML += `<div class="tip-req-item locked">🔒 Tahap: ${reqStage.name} (populasi ≥ ${reqPop})</div>`;
                reqHTML += `<div class="tip-req-current">Saat ini: ${GameData.STAGES[Simulation.currentStage].name} (${res.populasi} penduduk)</div>`;
            }

            if (!canAffordDana) {
                reqHTML += `<div class="tip-req-item locked">💰 Dana kurang: butuh Rp ${bData.cost.dana.toLocaleString('id-ID')}, punya Rp ${res.dana.toLocaleString('id-ID')}</div>`;
            }

            if (!canAffordMaterial) {
                reqHTML += `<div class="tip-req-item locked">🧱 Material kurang: butuh ${bData.cost.material}, punya ${res.material}</div>`;
            }
        } else {
            // Show stage info even when unlocked (for context)
            const stageInfo = GameData.STAGES[bData.unlockStage];
            reqHTML += `<div class="tip-req-item unlocked">✅ Tersedia di: ${stageInfo.name}</div>`;
        }

        document.getElementById('tooltip-requirements').innerHTML = reqHTML;

        tooltip.style.display = 'block';
        
        // Position near the element
        const rect = e.target.closest('.build-item').getBoundingClientRect();
        const tooltipLeft = rect.left - 250;
        const tooltipTop = Math.min(rect.top, window.innerHeight - 300);
        tooltip.style.left = Math.max(4, tooltipLeft) + 'px';
        tooltip.style.top = Math.max(4, tooltipTop) + 'px';
    },

    updateBuildButtons() {
        document.querySelectorAll('.build-item').forEach(item => {
            const key = item.dataset.buildingId;
            const bData = GameData.BUILDINGS[key];
            if (!bData) return;

            const res = Game.resources;
            const canAfford = (!bData.cost.dana || res.dana >= bData.cost.dana) &&
                              (!bData.cost.material || res.material >= bData.cost.material);
            const stageUnlocked = bData.unlockStage <= Simulation.currentStage;

            if (!stageUnlocked || !canAfford) {
                item.classList.add('disabled');
                if (!stageUnlocked) {
                    item.title = 'Belum tersedia di tahap ini';
                } else {
                    item.title = 'Sumber daya tidak cukup';
                }
            } else {
                item.classList.remove('disabled');
                item.title = '';
            }
        });
    },

    // ===== RESOURCE DISPLAY =====
    updateResources() {
        const res = Game.resources;
        document.getElementById('res-dana').textContent = 'Rp ' + res.dana.toLocaleString('id-ID');
        document.getElementById('res-pangan').textContent = res.pangan;
        document.getElementById('res-material').textContent = res.material;
        document.getElementById('res-populasi').textContent = res.populasi + '/' + res.maxPopulasi;

        // Status bars
        document.getElementById('bar-happiness').style.width = res.happiness + '%';
        document.getElementById('val-happiness').textContent = Math.round(res.happiness) + '%';
        
        document.getElementById('bar-education').style.width = res.education + '%';
        document.getElementById('val-education').textContent = Math.round(res.education) + '%';
        
        document.getElementById('bar-health').style.width = res.health + '%';
        document.getElementById('val-health').textContent = Math.round(res.health) + '%';
    },

    // ===== TIME DISPLAY =====
    updateTime() {
        const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                           'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        document.getElementById('game-time').textContent = monthNames[Simulation.month] + ', Tahun ' + Simulation.year;
        
        const stage = GameData.STAGES[Simulation.currentStage];
        document.getElementById('game-stage').textContent = stage.name;
        document.getElementById('game-stage').style.borderColor = stage.color;
        document.getElementById('game-stage').style.color = stage.color;
    },

    // ===== STATS PANEL =====
    updateStats() {
        const res = Game.resources;
        const counts = Simulation.getAllBuildingCounts();
        const income = Simulation.getMonthlyIncome();
        
        let html = '';
        
        // General stats
        html += '<div class="stat-row"><span class="stat-label">Tahap</span><span class="stat-value">' + GameData.STAGES[Simulation.currentStage].name + '</span></div>';
        html += '<div class="stat-row"><span class="stat-label">Waktu</span><span class="stat-value">Tahun ' + Simulation.year + ', Bln ' + Simulation.month + '</span></div>';
        html += '<div class="stat-row"><span class="stat-label">Populasi</span><span class="stat-value">' + res.populasi + ' / ' + res.maxPopulasi + '</span></div>';
        
        html += '<div class="stat-row" style="margin-top:10px;border-top:1px solid rgba(126,184,224,0.15);padding-top:8px"><span class="stat-label"><b>Pendapatan/bln</b></span><span class="stat-value"></span></div>';
        html += '<div class="stat-row"><span class="stat-label">Dana</span><span class="stat-value" style="color:' + (income.dana >= 0 ? '#5ab87a' : '#e08080') + '">' + (income.dana >= 0 ? '+' : '') + 'Rp ' + income.dana.toLocaleString('id-ID') + '</span></div>';
        html += '<div class="stat-row"><span class="stat-label">Pangan</span><span class="stat-value" style="color:' + (income.pangan >= 0 ? '#5ab87a' : '#e08080') + '">' + (income.pangan >= 0 ? '+' : '') + income.pangan + '</span></div>';
        html += '<div class="stat-row"><span class="stat-label">Material</span><span class="stat-value" style="color:#5ab87a">+' + income.material + '</span></div>';

        // Building counts
        html += '<div class="stat-row" style="margin-top:10px;border-top:1px solid rgba(126,184,224,0.15);padding-top:8px"><span class="stat-label"><b>Bangunan</b></span><span class="stat-value"></span></div>';
        let totalBuildings = 0;
        for (let key in counts) {
            const bData = GameData.BUILDINGS[key];
            if (bData) {
                html += '<div class="stat-row"><span class="stat-label">' + bData.icon + ' ' + bData.name + '</span><span class="stat-value">' + counts[key] + '</span></div>';
                totalBuildings += counts[key];
            }
        }
        html += '<div class="stat-row"><span class="stat-label"><b>Total</b></span><span class="stat-value"><b>' + totalBuildings + '</b></span></div>';

        document.getElementById('stats-container').innerHTML = html;
    },

    // ===== NOTIFICATIONS =====
    notify(message, type = '') {
        const container = document.getElementById('notifications');
        const notif = document.createElement('div');
        notif.className = 'notification ' + type;
        notif.textContent = message;
        container.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
    },

    // ===== EVENT LOG =====
    addEventLog(text, type = 'neutral') {
        const log = document.getElementById('event-log');
        const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
                           'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
        
        const entry = document.createElement('div');
        entry.className = 'event-entry ' + type;
        entry.innerHTML = `
            <div class="event-time">${monthNames[Simulation.month]} Tahun ${Simulation.year}</div>
            <div class="event-text">${text}</div>
        `;
        
        // Prepend (newest first)
        if (log.firstChild) {
            log.insertBefore(entry, log.firstChild);
        } else {
            log.appendChild(entry);
        }

        // Limit log entries
        while (log.children.length > 50) {
            log.removeChild(log.lastChild);
        }
    },

    // ===== EVENT MODAL =====
    showEventModal(icon, title, desc, effects) {
        document.getElementById('modal-icon').textContent = icon;
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-desc').textContent = desc;

        let effectsHTML = '';
        for (const eff of effects) {
            effectsHTML += `<div class="effect-item ${eff.positive ? 'positive' : 'negative'}">${eff.text}</div>`;
        }
        document.getElementById('modal-effects').innerHTML = effectsHTML;
        document.getElementById('event-modal').style.display = 'flex';

        // Pause game during modal
        this._prevSpeed = Game.speed;
        Game.speed = 0;
    },

    setupModalClose() {
        document.getElementById('modal-close').addEventListener('click', () => {
            document.getElementById('event-modal').style.display = 'none';
            Game.speed = this._prevSpeed || 1;
        });

        document.getElementById('event-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('event-modal')) {
                document.getElementById('event-modal').style.display = 'none';
                Game.speed = this._prevSpeed || 1;
            }
        });
    },

    // ===== HELP / GUIDE POPUP =====
    setupHelpButton() {
        const helpBtn = document.getElementById('btn-help');
        const guideModal = document.getElementById('guide-modal');
        const guideClose = document.getElementById('guide-modal-close');

        if (helpBtn && guideModal) {
            helpBtn.addEventListener('click', () => this.openGuideModal());
        }

        if (guideClose) {
            guideClose.addEventListener('click', () => this.closeGuideModal());
        }

        if (guideModal) {
            guideModal.addEventListener('click', (e) => {
                if (e.target === guideModal) this.closeGuideModal();
            });
        }
    },

    openGuideModal() {
        const modal = document.getElementById('guide-modal');
        if (modal) {
            modal.style.display = 'flex';
            this._guidePrevSpeed = Game.speed;
            Game.speed = 0;
        }
    },

    closeGuideModal() {
        const modal = document.getElementById('guide-modal');
        if (modal) {
            modal.style.display = 'none';
            Game.speed = this._guidePrevSpeed || 1;
        }
    },

    // ===== LOADING SCREEN =====
    updateLoadingBar(percent, text) {
        document.getElementById('loading-bar').style.width = percent + '%';
        if (text) document.getElementById('loading-text').textContent = text;
    },

    hideLoading() {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('intro-screen').style.display = 'flex';
    },

    showGame() {
        document.getElementById('intro-screen').style.display = 'none';
        document.getElementById('game-screen').style.display = 'flex';
    }
};
