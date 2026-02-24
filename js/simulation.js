// ======================================================
// SIMULATION.JS - Game Simulation Logic
// ======================================================

const Simulation = {
    // Time
    month: 1,
    year: 1,
    tickAccumulator: 0,
    monthDuration: 5, // seconds per game month (at speed 1)
    
    // Current stage index
    currentStage: 0,

    // Building counts
    buildingCounts: {},

    // Event cooldown
    eventCooldown: 0,
    eventMinInterval: 15, // months between events minimum

    // Population growth accumulator (for fractional growth)
    popGrowthAccum: 0,

    // Transmigrant immigration timer
    immigrationCooldown: 0,

    init() {
        this.month = 1;
        this.year = 1;
        this.tickAccumulator = 0;
        this.currentStage = 0;
        this.buildingCounts = {};
        this.eventCooldown = 3; // first event after 3 months
        this.popGrowthAccum = 0;
        this.immigrationCooldown = 2; // first wave after 2 months
    },

    update(dt, speed) {
        if (speed === 0) return;

        this.tickAccumulator += dt * speed;

        if (this.tickAccumulator >= this.monthDuration) {
            this.tickAccumulator -= this.monthDuration;
            this.processMonth();
        }
    },

    processMonth() {
        // ===== PRODUCTION =====
        this.processProduction();

        // ===== CONSUMPTION =====
        this.processConsumption();

        // ===== POPULATION GROWTH =====
        this.processPopulationGrowth();

        // ===== HAPPINESS DECAY/GROWTH =====
        this.processHappiness();

        // ===== EDUCATION DECAY =====
        this.processEducation();

        // ===== HEALTH DECAY =====
        this.processHealth();

        // ===== BUILDING CONSTRUCTION =====
        this.processConstruction();

        // ===== CHECK STAGE PROGRESSION =====
        this.checkStageProgression();

        // ===== RANDOM EVENTS =====
        this.processEvents();

        // ===== ADVANCE TIME =====
        this.month++;
        if (this.month > 12) {
            this.month = 1;
            this.year++;
            this.processYearly();
        }

        // ===== UPDATE UI =====
        UI.updateResources();
        UI.updateTime();
        UI.updateBuildButtons();
        UI.updateStats();
    },

    processProduction() {
        const res = Game.resources;
        let totalDana = 0;
        let totalPangan = 0;
        let totalMaterial = 0;

        // Iterate through all buildings
        for (let y = 0; y < GameData.MAP_SIZE; y++) {
            for (let x = 0; x < GameData.MAP_SIZE; x++) {
                const building = Game.map.buildings[y * GameData.MAP_SIZE + x];
                if (!building || !building.id || building.buildTime > 0) continue;
                if (building.originX !== x || building.originY !== y) continue;

                const bData = GameData.BUILDINGS[building.id];
                if (!bData || !bData.production) continue;

                // Production scaled by education level
                const eduBonus = 1 + (res.education / 200); // up to 1.5x at 100%
                const healthPenalty = res.health < 30 ? 0.5 : (res.health < 50 ? 0.75 : 1);

                if (bData.production.dana) totalDana += bData.production.dana * eduBonus * healthPenalty;
                if (bData.production.pangan) totalPangan += bData.production.pangan * eduBonus * healthPenalty;
                if (bData.production.material) totalMaterial += bData.production.material * healthPenalty;
            }
        }

        res.dana += Math.floor(totalDana);
        res.pangan += Math.floor(totalPangan);
        res.material += Math.floor(totalMaterial);

        // Ensure non-negative
        res.dana = Math.max(0, res.dana);
        res.pangan = Math.max(0, res.pangan);
        res.material = Math.max(0, res.material);
    },

    processConsumption() {
        const res = Game.resources;
        // Each person consumes 0.5 food per month
        const foodConsumption = Math.floor(res.populasi * 0.5);
        res.pangan -= foodConsumption;

        if (res.pangan < 0) {
            // Starvation!
            res.happiness -= 5;
            res.health -= 3;
            const deaths = Math.min(Math.ceil(Math.abs(res.pangan) / 2), Math.floor(res.populasi * 0.05));
            if (deaths > 0) {
                res.populasi -= deaths;
                UI.notify('⚠️ Kelaparan! ' + deaths + ' penduduk meninggal.', 'error');
                UI.addEventLog('Kelaparan melanda kawasan! ' + deaths + ' penduduk meninggal.', 'negative');
            }
            res.pangan = 0;
        }
    },

    processPopulationGrowth() {
        const res = Game.resources;

        // === NATURAL BIRTH ===
        // Growth possible when happiness > 40 and health > 30 (lowered thresholds)
        if (res.happiness > 40 && res.health > 30 && res.populasi < res.maxPopulasi) {
            const growthRate = (res.happiness / 100) * (res.health / 100) * 0.08;
            // Use accumulator so fractional growth still counts over time
            this.popGrowthAccum += res.populasi * growthRate;

            if (this.popGrowthAccum >= 1) {
                const growth = Math.min(Math.floor(this.popGrowthAccum), res.maxPopulasi - res.populasi);
                if (growth > 0) {
                    res.populasi += growth;
                    this.popGrowthAccum -= growth;
                    if (growth >= 2) {
                        UI.notify('👶 ' + growth + ' penduduk baru lahir!', 'success');
                    }
                }
            }
        }

        // === TRANSMIGRANT IMMIGRATION WAVES ===
        this.processImmigration();

        // Ensure minimum
        res.populasi = Math.max(5, Math.min(res.populasi, res.maxPopulasi));
    },

    processImmigration() {
        const res = Game.resources;
        this.immigrationCooldown--;
        if (this.immigrationCooldown > 0) return;

        // Available housing capacity
        const freeHousing = res.maxPopulasi - res.populasi;
        if (freeHousing <= 0) return;

        // Immigration chance: higher if more free housing & happiness is decent
        const happinessFactor = res.happiness > 30 ? 1 : 0.3;
        const housingPull = Math.min(freeHousing / 5, 10); // more empty homes = more attractive

        // Base immigrants: 2-5 families at a time, scaled by housing availability
        const baseImmigrants = Math.ceil(2 + Math.random() * 3);
        const immigrants = Math.min(
            Math.ceil(baseImmigrants * happinessFactor * (1 + housingPull * 0.1)),
            freeHousing
        );

        if (immigrants > 0) {
            res.populasi += immigrants;

            const messages = [
                '🚌 ' + immigrants + ' transmigran baru tiba dari Jawa!',
                '🚌 Rombongan ' + immigrants + ' transmigran datang dari Sumatera!',
                '🚌 ' + immigrants + ' keluarga transmigran baru bergabung!',
                '🚌 Program transmigrasi mengirim ' + immigrants + ' penduduk baru!',
                '🚌 ' + immigrants + ' transmigran tiba dengan harapan baru!'
            ];
            const msg = messages[Math.floor(Math.random() * messages.length)];
            UI.notify(msg, 'success');
            UI.addEventLog(msg, 'positive');
        }

        // Next immigration wave: every 3-6 months
        this.immigrationCooldown = 3 + Math.floor(Math.random() * 4);
    },

    processHappiness() {
        const res = Game.resources;
        
        // Natural equilibrium: decay slowly toward 45 (not 50)
        if (res.happiness > 55) {
            res.happiness -= 0.2;
        } else if (res.happiness < 35) {
            res.happiness += 0.3;
        }

        // Overcrowding penalty
        if (res.populasi >= res.maxPopulasi * 0.9) {
            res.happiness -= 0.8;
        }

        // Food satisfaction bonus
        if (res.pangan > res.populasi * 2) {
            res.happiness += 0.5;
        } else if (res.pangan > res.populasi) {
            res.happiness += 0.2;
        }

        // Road bonus: connected roads make people happier
        const roadCount = this.countBuildings(['jalan']);
        if (roadCount > 5) {
            res.happiness += 0.1;
        }

        res.happiness = Math.max(0, Math.min(100, res.happiness));
    },

    processEducation() {
        const res = Game.resources;
        // Education decays slowly without schools
        const schoolCount = this.countBuildings(['sekolah', 'smp']);
        if (schoolCount === 0) {
            res.education = Math.max(0, res.education - 0.2);
        }
        res.education = Math.max(0, Math.min(100, res.education));
    },

    processHealth() {
        const res = Game.resources;
        // Health decays without health facilities (slower decay)
        const healthFacilities = this.countBuildings(['puskesmas']);
        if (healthFacilities === 0) {
            res.health = Math.max(30, res.health - 0.15);
        } else {
            // Health facilities help
            if (res.health < 80) res.health += 0.25 * healthFacilities;
        }

        // Overcrowding reduces health
        if (res.populasi >= res.maxPopulasi * 0.95) {
            res.health -= 0.2;
        }

        res.health = Math.max(0, Math.min(100, res.health));
    },

    processConstruction() {
        for (let y = 0; y < GameData.MAP_SIZE; y++) {
            for (let x = 0; x < GameData.MAP_SIZE; x++) {
                const building = Game.map.buildings[y * GameData.MAP_SIZE + x];
                if (building && building.buildTime > 0) {
                    building.buildTime -= 1;
                    if (building.buildTime <= 0) {
                        building.buildTime = 0;
                        const bData = GameData.BUILDINGS[building.id];
                        if (bData) {
                            UI.notify('🏗️ ' + bData.name + ' selesai dibangun!', 'success');
                            UI.addEventLog(bData.name + ' telah selesai dibangun.', 'positive');
                            Renderer.addParticle(x, y, 'build');
                        }
                    }
                }
            }
        }
    },

    checkStageProgression() {
        const pop = Game.resources.populasi;
        let newStage = 0;
        for (let i = GameData.STAGES.length - 1; i >= 0; i--) {
            if (pop >= GameData.STAGES[i].minPopulation) {
                newStage = i;
                break;
            }
        }
        if (newStage > this.currentStage) {
            this.currentStage = newStage;
            const stage = GameData.STAGES[newStage];
            UI.showEventModal(
                '🎉',
                'Naik Tahap: ' + stage.name,
                'Selamat! Kawasan transmigrasi Anda telah berkembang menjadi ' + stage.name + '! Bangunan baru telah terbuka.',
                [{ text: 'Bangunan baru tersedia!', positive: true }]
            );
            UI.addEventLog('Kawasan naik ke tahap: ' + stage.name + '!', 'positive');
            UI.updateBuildButtons();
        }
    },

    processEvents() {
        this.eventCooldown--;
        if (this.eventCooldown > 0) return;

        // Random chance of event
        if (Math.random() > 0.25) return; // 25% chance per month (when cooldown is 0)

        // Filter eligible events
        const eligible = GameData.EVENTS.filter(e => e.minStage <= this.currentStage);
        if (eligible.length === 0) return;

        const event = eligible[Math.floor(Math.random() * eligible.length)];
        this.triggerEvent(event);
        this.eventCooldown = 3 + Math.floor(Math.random() * 4); // 3-6 months cooldown
    },

    triggerEvent(event) {
        const res = Game.resources;
        const effects = [];

        for (let key in event.effects) {
            const val = event.effects[key];
            if (key === 'populasi') {
                if (val > 0) {
                    // Only add if there's room
                    const added = Math.min(val, res.maxPopulasi - res.populasi);
                    res.populasi += added;
                    if (added > 0) effects.push({ text: '+' + added + ' Penduduk', positive: true });
                } else {
                    res.populasi = Math.max(5, res.populasi + val);
                    effects.push({ text: val + ' Penduduk', positive: false });
                }
            } else if (key === 'dana') {
                res.dana = Math.max(0, res.dana + val);
                effects.push({ text: (val > 0 ? '+' : '') + 'Rp ' + val.toLocaleString('id-ID'), positive: val > 0 });
            } else if (key === 'pangan') {
                res.pangan = Math.max(0, res.pangan + val);
                effects.push({ text: (val > 0 ? '+' : '') + val + ' Pangan', positive: val > 0 });
            } else if (key === 'material') {
                res.material = Math.max(0, res.material + val);
                effects.push({ text: (val > 0 ? '+' : '') + val + ' Material', positive: val > 0 });
            } else if (key === 'happiness') {
                res.happiness = Math.max(0, Math.min(100, res.happiness + val));
                effects.push({ text: (val > 0 ? '+' : '') + val + '% Kebahagiaan', positive: val > 0 });
            } else if (key === 'education') {
                res.education = Math.max(0, Math.min(100, res.education + val));
                effects.push({ text: (val > 0 ? '+' : '') + val + '% Pendidikan', positive: val > 0 });
            } else if (key === 'health') {
                res.health = Math.max(0, Math.min(100, res.health + val));
                effects.push({ text: (val > 0 ? '+' : '') + val + '% Kesehatan', positive: val > 0 });
            }
        }

        UI.showEventModal(event.icon, event.title, event.desc, effects);
        UI.addEventLog(event.title + ': ' + event.desc, event.type === 'positive' ? 'positive' : 'negative');
        UI.updateResources();
    },

    processYearly() {
        // Yearly tax income based on population
        const taxIncome = Game.resources.populasi * 100;
        Game.resources.dana += taxIncome;
        UI.notify('📅 Tahun ' + this.year + ' - Pendapatan pajak: Rp ' + taxIncome.toLocaleString('id-ID'), 'success');
        UI.addEventLog('Tahun ' + this.year + ' dimulai. Pendapatan pajak: Rp ' + taxIncome.toLocaleString('id-ID'), 'neutral');
    },

    countBuildings(ids) {
        let count = 0;
        for (let y = 0; y < GameData.MAP_SIZE; y++) {
            for (let x = 0; x < GameData.MAP_SIZE; x++) {
                const building = Game.map.buildings[y * GameData.MAP_SIZE + x];
                if (building && ids.includes(building.id) && building.originX === x && building.originY === y) {
                    count++;
                }
            }
        }
        return count;
    },

    getAllBuildingCounts() {
        const counts = {};
        for (let y = 0; y < GameData.MAP_SIZE; y++) {
            for (let x = 0; x < GameData.MAP_SIZE; x++) {
                const building = Game.map.buildings[y * GameData.MAP_SIZE + x];
                if (building && building.id && building.originX === x && building.originY === y) {
                    counts[building.id] = (counts[building.id] || 0) + 1;
                }
            }
        }
        return counts;
    },

    getMonthlyIncome() {
        let income = { dana: 0, pangan: 0, material: 0 };
        const res = Game.resources;
        const eduBonus = 1 + (res.education / 200);
        const healthPenalty = res.health < 30 ? 0.5 : (res.health < 50 ? 0.75 : 1);

        for (let y = 0; y < GameData.MAP_SIZE; y++) {
            for (let x = 0; x < GameData.MAP_SIZE; x++) {
                const building = Game.map.buildings[y * GameData.MAP_SIZE + x];
                if (!building || !building.id || building.buildTime > 0) continue;
                if (building.originX !== x || building.originY !== y) continue;

                const bData = GameData.BUILDINGS[building.id];
                if (!bData || !bData.production) continue;

                if (bData.production.dana) income.dana += Math.floor(bData.production.dana * eduBonus * healthPenalty);
                if (bData.production.pangan) income.pangan += Math.floor(bData.production.pangan * eduBonus * healthPenalty);
                if (bData.production.material) income.material += Math.floor(bData.production.material * healthPenalty);
            }
        }

        // Subtract consumption
        income.pangan -= Math.floor(res.populasi * 0.5);

        return income;
    }
};
