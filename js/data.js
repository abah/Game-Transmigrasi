// ======================================================
// DATA.JS - Game Configuration, Building Data, Events
// ======================================================

const GameData = {
    // ===== MAP CONFIG =====
    MAP_SIZE: 50,
    TILE_WIDTH: 64,
    TILE_HEIGHT: 32,
    
    // ===== TILE TYPES =====
    TILE: {
        GRASS: 0,
        FOREST: 1,
        WATER: 2,
        DIRT: 3,
        ROAD: 4,
        FARMLAND: 5
    },

    // Tile colors
    TILE_COLORS: {
        0: { top: '#5a9e4b', left: '#4a8e3b', right: '#3a7e2b' },          // Grass
        1: { top: '#3d7a30', left: '#2d6a20', right: '#1d5a10' },          // Forest
        2: { top: '#3a7cc0', left: '#2a6cb0', right: '#1a5ca0' },          // Water
        3: { top: '#a08060', left: '#907050', right: '#806040' },          // Dirt
        4: { top: '#808890', left: '#707880', right: '#606870' },          // Road
        5: { top: '#7aae3b', left: '#6a9e2b', right: '#5a8e1b' },          // Farmland
    },

    // ===== INITIAL RESOURCES =====
    INITIAL_RESOURCES: {
        dana: 75000,
        pangan: 150,
        material: 100,
        populasi: 20,
        maxPopulasi: 20,
        happiness: 65,
        education: 5,
        health: 55
    },

    // ===== BUILDING CATEGORIES =====
    CATEGORIES: {
        housing: 'Pemukiman',
        farming: 'Pertanian',
        public: 'Fasilitas Umum',
        economy: 'Ekonomi',
        infra: 'Infrastruktur'
    },

    // ===== BUILDING DEFINITIONS =====
    BUILDINGS: {
        // --- PEMUKIMAN ---
        rumah_transmigran: {
            id: 'rumah_transmigran',
            name: 'Rumah Transmigran',
            icon: '🏠',
            category: 'housing',
            desc: 'Rumah sederhana untuk keluarga transmigran. Menampung 5 penduduk.',
            cost: { dana: 5000, material: 15 },
            size: 1,
            height: 20,
            colors: { top: '#d4a76a', left: '#b8905a', right: '#9c784a' },
            roofColors: { top: '#c45a3a', left: '#a44a2a', right: '#84321a' },
            effects: { maxPopulasi: 5, happiness: 1 },
            production: {},
            unlockStage: 0
        },
        rumah_layak: {
            id: 'rumah_layak',
            name: 'Rumah Layak Huni',
            icon: '🏡',
            category: 'housing',
            desc: 'Rumah yang lebih baik dengan fasilitas memadai. Menampung 8 penduduk.',
            cost: { dana: 12000, material: 30 },
            size: 1,
            height: 26,
            colors: { top: '#e0c090', left: '#c8a878', right: '#b09060' },
            roofColors: { top: '#5a7cc4', left: '#4a6cb4', right: '#3a5ca4' },
            effects: { maxPopulasi: 8, happiness: 3 },
            production: {},
            unlockStage: 1
        },
        perumahan: {
            id: 'perumahan',
            name: 'Komplek Perumahan',
            icon: '🏘️',
            category: 'housing',
            desc: 'Komplek perumahan modern. Menampung 20 penduduk.',
            cost: { dana: 35000, material: 60 },
            size: 2,
            height: 34,
            colors: { top: '#d0d8e0', left: '#b8c0c8', right: '#a0a8b0' },
            roofColors: { top: '#4a80c0', left: '#3a70b0', right: '#2a60a0' },
            effects: { maxPopulasi: 20, happiness: 5 },
            production: {},
            unlockStage: 2
        },
        apartemen: {
            id: 'apartemen',
            name: 'Apartemen',
            icon: '🏢',
            category: 'housing',
            desc: 'Bangunan apartemen bertingkat. Menampung 50 penduduk.',
            cost: { dana: 80000, material: 120 },
            size: 2,
            height: 55,
            colors: { top: '#c8d0d8', left: '#a8b0b8', right: '#909aa5' },
            roofColors: { top: '#5888b8', left: '#4878a8', right: '#386898' },
            effects: { maxPopulasi: 50, happiness: 4 },
            production: {},
            unlockStage: 3
        },
        gedung_pencakar: {
            id: 'gedung_pencakar',
            name: 'Gedung Pencakar Langit',
            icon: '🏙️',
            category: 'housing',
            desc: 'Gedung tinggi mewah. Menampung 120 penduduk dan menghasilkan pendapatan sewa.',
            cost: { dana: 200000, material: 250 },
            size: 3,
            height: 80,
            colors: { top: '#b8c8d8', left: '#98a8b8', right: '#788898' },
            roofColors: { top: '#4070a8', left: '#306098', right: '#205088' },
            effects: { maxPopulasi: 120, happiness: 6 },
            production: { dana: 8000 },
            unlockStage: 4
        },

        // --- PERTANIAN ---
        sawah: {
            id: 'sawah',
            name: 'Sawah',
            icon: '🌾',
            category: 'farming',
            desc: 'Sawah padi untuk produksi pangan utama.',
            cost: { dana: 3000, material: 5 },
            size: 1,
            height: 2,
            colors: { top: '#7aae3b', left: '#6a9e2b', right: '#5a8e1b' },
            roofColors: null,
            effects: { happiness: 1 },
            production: { pangan: 8 },
            unlockStage: 0
        },
        ladang: {
            id: 'ladang',
            name: 'Ladang Sayur',
            icon: '🥬',
            category: 'farming',
            desc: 'Ladang sayuran dan palawija.',
            cost: { dana: 2000, material: 3 },
            size: 1,
            height: 2,
            colors: { top: '#6aae5b', left: '#5a9e4b', right: '#4a8e3b' },
            roofColors: null,
            effects: { happiness: 1, health: 1 },
            production: { pangan: 5, dana: 500 },
            unlockStage: 0
        },
        perkebunan: {
            id: 'perkebunan',
            name: 'Perkebunan',
            icon: '🌴',
            category: 'farming',
            desc: 'Perkebunan kelapa sawit atau karet. Menghasilkan dana.',
            cost: { dana: 8000, material: 10 },
            size: 2,
            height: 4,
            colors: { top: '#4a8e2b', left: '#3a7e1b', right: '#2a6e0b' },
            roofColors: null,
            effects: {},
            production: { dana: 2000 },
            unlockStage: 1
        },
        peternakan: {
            id: 'peternakan',
            name: 'Peternakan',
            icon: '🐄',
            category: 'farming',
            desc: 'Peternakan sapi dan ayam untuk pangan.',
            cost: { dana: 6000, material: 15 },
            size: 1,
            height: 14,
            colors: { top: '#c8a870', left: '#b09858', right: '#988840' },
            roofColors: { top: '#8a6a3a', left: '#7a5a2a', right: '#6a4a1a' },
            effects: { health: 1 },
            production: { pangan: 6, dana: 300 },
            unlockStage: 1
        },
        perikanan: {
            id: 'perikanan',
            name: 'Tambak Ikan',
            icon: '🐟',
            category: 'farming',
            desc: 'Tambak ikan air tawar untuk produksi pangan dan pendapatan.',
            cost: { dana: 12000, material: 20 },
            size: 2,
            height: 3,
            colors: { top: '#4a90b8', left: '#3a80a8', right: '#2a7098' },
            roofColors: null,
            effects: { health: 2 },
            production: { pangan: 12, dana: 1500 },
            unlockStage: 2
        },
        agro_industri: {
            id: 'agro_industri',
            name: 'Agro Industri',
            icon: '🌿',
            category: 'farming',
            desc: 'Pengolahan hasil pertanian skala besar. Nilai tambah tinggi.',
            cost: { dana: 60000, material: 80 },
            size: 2,
            height: 28,
            colors: { top: '#90a878', left: '#809868', right: '#708858' },
            roofColors: { top: '#506838', left: '#405828', right: '#304818' },
            effects: { education: 2 },
            production: { dana: 6000, pangan: 15 },
            unlockStage: 3
        },

        // --- FASILITAS UMUM ---
        sekolah: {
            id: 'sekolah',
            name: 'Sekolah Dasar',
            icon: '🏫',
            category: 'public',
            desc: 'Sekolah untuk mencerdaskan anak-anak transmigran.',
            cost: { dana: 15000, material: 35 },
            size: 2,
            height: 24,
            colors: { top: '#e8e0d0', left: '#d0c8b8', right: '#b8b0a0' },
            roofColors: { top: '#c45040', left: '#a44030', right: '#843020' },
            effects: { education: 8, happiness: 3 },
            production: {},
            unlockStage: 1
        },
        smp: {
            id: 'smp',
            name: 'SMP',
            icon: '📚',
            category: 'public',
            desc: 'Sekolah menengah untuk pendidikan lanjutan.',
            cost: { dana: 25000, material: 45 },
            size: 2,
            height: 28,
            colors: { top: '#e0e8f0', left: '#c8d0d8', right: '#b0b8c0' },
            roofColors: { top: '#4070b0', left: '#3060a0', right: '#205090' },
            effects: { education: 12, happiness: 4 },
            production: {},
            unlockStage: 2
        },
        puskesmas: {
            id: 'puskesmas',
            name: 'Puskesmas',
            icon: '🏥',
            category: 'public',
            desc: 'Pusat kesehatan masyarakat.',
            cost: { dana: 12000, material: 30 },
            size: 1,
            height: 22,
            colors: { top: '#f0f0f0', left: '#d8d8d8', right: '#c0c0c0' },
            roofColors: { top: '#e05050', left: '#c04040', right: '#a03030' },
            effects: { health: 10, happiness: 3 },
            production: {},
            unlockStage: 1
        },
        masjid: {
            id: 'masjid',
            name: 'Masjid',
            icon: '🕌',
            category: 'public',
            desc: 'Tempat ibadah dan kegiatan keagamaan.',
            cost: { dana: 10000, material: 25 },
            size: 1,
            height: 30,
            colors: { top: '#f0f0e8', left: '#d8d8d0', right: '#c0c0b8' },
            roofColors: { top: '#40a070', left: '#309060', right: '#208050' },
            effects: { happiness: 8, education: 2 },
            production: {},
            unlockStage: 0
        },
        balai_desa: {
            id: 'balai_desa',
            name: 'Balai Desa',
            icon: '🏛️',
            category: 'public',
            desc: 'Pusat pemerintahan dan administrasi desa.',
            cost: { dana: 20000, material: 40 },
            size: 2,
            height: 22,
            colors: { top: '#e0d8c8', left: '#c8c0b0', right: '#b0a898' },
            roofColors: { top: '#a08050', left: '#907040', right: '#806030' },
            effects: { happiness: 5, education: 3 },
            production: { dana: 1000 },
            unlockStage: 1
        },
        taman: {
            id: 'taman',
            name: 'Taman Kota',
            icon: '🌳',
            category: 'public',
            desc: 'Ruang terbuka hijau untuk rekreasi warga.',
            cost: { dana: 8000, material: 10 },
            size: 1,
            height: 3,
            colors: { top: '#50b850', left: '#40a840', right: '#309830' },
            roofColors: null,
            effects: { happiness: 6, health: 2 },
            production: {},
            unlockStage: 1
        },
        sma: {
            id: 'sma',
            name: 'SMA',
            icon: '🎓',
            category: 'public',
            desc: 'Sekolah menengah atas untuk persiapan perguruan tinggi.',
            cost: { dana: 40000, material: 55 },
            size: 2,
            height: 30,
            colors: { top: '#d8e0e8', left: '#c0c8d0', right: '#a8b0b8' },
            roofColors: { top: '#3870b0', left: '#2860a0', right: '#185090' },
            effects: { education: 15, happiness: 4 },
            production: {},
            unlockStage: 2
        },
        universitas: {
            id: 'universitas',
            name: 'Universitas',
            icon: '🏛️',
            category: 'public',
            desc: 'Perguruan tinggi untuk pendidikan dan riset. Meningkatkan kualitas SDM.',
            cost: { dana: 120000, material: 150 },
            size: 3,
            height: 40,
            colors: { top: '#e8e0d0', left: '#d0c8b8', right: '#b8b0a0' },
            roofColors: { top: '#8a4040', left: '#7a3030', right: '#6a2020' },
            effects: { education: 25, happiness: 8 },
            production: { dana: 3000 },
            unlockStage: 3
        },
        rumah_sakit: {
            id: 'rumah_sakit',
            name: 'Rumah Sakit',
            icon: '🏥',
            category: 'public',
            desc: 'Rumah sakit lengkap dengan dokter spesialis dan fasilitas modern.',
            cost: { dana: 100000, material: 130 },
            size: 3,
            height: 42,
            colors: { top: '#f0f0f0', left: '#d8d8d8', right: '#c0c0c0' },
            roofColors: { top: '#d04040', left: '#b03030', right: '#902020' },
            effects: { health: 25, happiness: 8 },
            production: {},
            unlockStage: 3
        },
        stadion: {
            id: 'stadion',
            name: 'Stadion',
            icon: '🏟️',
            category: 'public',
            desc: 'Stadion olahraga untuk event dan hiburan warga kota.',
            cost: { dana: 180000, material: 200 },
            size: 3,
            height: 25,
            colors: { top: '#c8d0d8', left: '#b0b8c0', right: '#98a0a8' },
            roofColors: { top: '#3868a0', left: '#285890', right: '#184880' },
            effects: { happiness: 20, health: 8 },
            production: { dana: 5000 },
            unlockStage: 4
        },
        taman_besar: {
            id: 'taman_besar',
            name: 'Taman Kota Besar',
            icon: '🏞️',
            category: 'public',
            desc: 'Taman kota berskala besar dengan danau buatan dan jogging track.',
            cost: { dana: 50000, material: 40 },
            size: 3,
            height: 4,
            colors: { top: '#48b848', left: '#38a838', right: '#289828' },
            roofColors: null,
            effects: { happiness: 15, health: 8 },
            production: {},
            unlockStage: 3
        },

        // --- EKONOMI ---
        pasar: {
            id: 'pasar',
            name: 'Pasar Tradisional',
            icon: '🏪',
            category: 'economy',
            desc: 'Pasar untuk jual beli hasil pertanian dan kebutuhan pokok.',
            cost: { dana: 10000, material: 20 },
            size: 1,
            height: 16,
            colors: { top: '#d8a050', left: '#c09040', right: '#a88030' },
            roofColors: { top: '#c04830', left: '#a03820', right: '#802810' },
            effects: { happiness: 4 },
            production: { dana: 1500 },
            unlockStage: 0
        },
        koperasi: {
            id: 'koperasi',
            name: 'Koperasi',
            icon: '🏦',
            category: 'economy',
            desc: 'Koperasi simpan pinjam untuk pemberdayaan ekonomi.',
            cost: { dana: 15000, material: 25 },
            size: 1,
            height: 20,
            colors: { top: '#5090d0', left: '#4080c0', right: '#3070b0' },
            roofColors: { top: '#3060a0', left: '#205090', right: '#104080' },
            effects: { happiness: 3, education: 2 },
            production: { dana: 2500 },
            unlockStage: 1
        },
        gudang: {
            id: 'gudang',
            name: 'Gudang',
            icon: '🏭',
            category: 'economy',
            desc: 'Gudang penyimpanan hasil pertanian dan material.',
            cost: { dana: 8000, material: 30 },
            size: 1,
            height: 18,
            colors: { top: '#a0a8b0', left: '#909098', right: '#808088' },
            roofColors: { top: '#707880', left: '#606870', right: '#505860' },
            effects: {},
            production: { material: 5 },
            unlockStage: 0
        },
        pabrik: {
            id: 'pabrik',
            name: 'Pabrik Kecil',
            icon: '🏭',
            category: 'economy',
            desc: 'Industri kecil pengolahan hasil pertanian.',
            cost: { dana: 40000, material: 50 },
            size: 2,
            height: 30,
            colors: { top: '#b0b8c0', left: '#98a0a8', right: '#808890' },
            roofColors: { top: '#606870', left: '#505860', right: '#404850' },
            effects: { education: 2 },
            production: { dana: 5000, material: 3 },
            unlockStage: 2
        },
        bank: {
            id: 'bank',
            name: 'Bank',
            icon: '🏦',
            category: 'economy',
            desc: 'Bank daerah untuk layanan keuangan dan investasi warga.',
            cost: { dana: 35000, material: 45 },
            size: 1,
            height: 26,
            colors: { top: '#d0c8b0', left: '#b8b098', right: '#a09880' },
            roofColors: { top: '#6a5a3a', left: '#5a4a2a', right: '#4a3a1a' },
            effects: { happiness: 3, education: 2 },
            production: { dana: 4000 },
            unlockStage: 2
        },
        mall: {
            id: 'mall',
            name: 'Pusat Perbelanjaan',
            icon: '🛍️',
            category: 'economy',
            desc: 'Mall modern dengan berbagai toko, restoran, dan hiburan.',
            cost: { dana: 120000, material: 150 },
            size: 3,
            height: 38,
            colors: { top: '#d8d0c0', left: '#c0b8a8', right: '#a8a090' },
            roofColors: { top: '#c8a050', left: '#b89040', right: '#a88030' },
            effects: { happiness: 12 },
            production: { dana: 12000 },
            unlockStage: 3
        },
        pabrik_besar: {
            id: 'pabrik_besar',
            name: 'Pabrik Besar',
            icon: '🏭',
            category: 'economy',
            desc: 'Kawasan industri besar dengan produksi massal.',
            cost: { dana: 100000, material: 130 },
            size: 3,
            height: 36,
            colors: { top: '#a0a8b0', left: '#8890a0', right: '#707890' },
            roofColors: { top: '#505860', left: '#404850', right: '#303840' },
            effects: { education: 5 },
            production: { dana: 15000, material: 10 },
            unlockStage: 3
        },
        hotel: {
            id: 'hotel',
            name: 'Hotel',
            icon: '🏨',
            category: 'economy',
            desc: 'Hotel bintang tiga untuk wisatawan dan pengunjung kota.',
            cost: { dana: 90000, material: 100 },
            size: 2,
            height: 45,
            colors: { top: '#e0d8c8', left: '#c8c0b0', right: '#b0a898' },
            roofColors: { top: '#a08848', left: '#907838', right: '#806828' },
            effects: { happiness: 6 },
            production: { dana: 8000 },
            unlockStage: 3
        },
        bandara: {
            id: 'bandara',
            name: 'Bandara',
            icon: '✈️',
            category: 'economy',
            desc: 'Bandara untuk konektivitas dan perdagangan antar kota.',
            cost: { dana: 300000, material: 300 },
            size: 4,
            height: 20,
            colors: { top: '#c0c8d0', left: '#a8b0b8', right: '#9098a0' },
            roofColors: { top: '#d8d8d8', left: '#c0c0c0', right: '#a8a8a8' },
            effects: { happiness: 15, education: 5 },
            production: { dana: 25000 },
            unlockStage: 4
        },

        // --- INFRASTRUKTUR ---
        jalan: {
            id: 'jalan',
            name: 'Jalan',
            icon: '🛤️',
            category: 'infra',
            desc: 'Jalan penghubung antar bangunan.',
            cost: { dana: 1000, material: 5 },
            size: 1,
            height: 1,
            colors: { top: '#808890', left: '#707880', right: '#606870' },
            roofColors: null,
            effects: { happiness: 0.5 },
            production: {},
            unlockStage: 0,
            isTile: true,
            tileType: 4
        },
        jembatan: {
            id: 'jembatan',
            name: 'Jembatan',
            icon: '🌉',
            category: 'infra',
            desc: 'Jembatan untuk menyeberangi sungai.',
            cost: { dana: 8000, material: 20 },
            size: 1,
            height: 8,
            colors: { top: '#a0a0a0', left: '#888888', right: '#707070' },
            roofColors: null,
            effects: { happiness: 2 },
            production: {},
            unlockStage: 1,
            requiresTile: 2 // water
        },
        pembangkit: {
            id: 'pembangkit',
            name: 'Pembangkit Listrik',
            icon: '⚡',
            category: 'infra',
            desc: 'Pembangkit listrik tenaga surya untuk kawasan.',
            cost: { dana: 30000, material: 40 },
            size: 2,
            height: 12,
            colors: { top: '#4070a0', left: '#306090', right: '#205080' },
            roofColors: { top: '#3090d0', left: '#2080c0', right: '#1070b0' },
            effects: { happiness: 5, education: 3, health: 2 },
            production: { dana: 1000 },
            unlockStage: 2
        },
        stasiun: {
            id: 'stasiun',
            name: 'Stasiun Kereta',
            icon: '🚉',
            category: 'infra',
            desc: 'Stasiun kereta api untuk transportasi massal dan logistik.',
            cost: { dana: 80000, material: 100 },
            size: 3,
            height: 22,
            colors: { top: '#d0c8b8', left: '#b8b0a0', right: '#a09888' },
            roofColors: { top: '#707880', left: '#606870', right: '#505860' },
            effects: { happiness: 10, education: 3 },
            production: { dana: 5000 },
            unlockStage: 3
        },
        menara_telkom: {
            id: 'menara_telkom',
            name: 'Menara Telekomunikasi',
            icon: '📡',
            category: 'infra',
            desc: 'Menara BTS untuk jaringan internet dan telekomunikasi.',
            cost: { dana: 25000, material: 35 },
            size: 1,
            height: 50,
            colors: { top: '#c0c0c0', left: '#a8a8a8', right: '#909090' },
            roofColors: { top: '#e05050', left: '#c04040', right: '#a03030' },
            effects: { happiness: 4, education: 5 },
            production: { dana: 2000 },
            unlockStage: 2
        },
        pdam: {
            id: 'pdam',
            name: 'Instalasi Air Bersih',
            icon: '💧',
            category: 'infra',
            desc: 'PDAM untuk distribusi air bersih ke seluruh kota.',
            cost: { dana: 45000, material: 60 },
            size: 2,
            height: 16,
            colors: { top: '#6090c0', left: '#5080b0', right: '#4070a0' },
            roofColors: { top: '#4080c0', left: '#3070b0', right: '#2060a0' },
            effects: { health: 12, happiness: 5 },
            production: {},
            unlockStage: 2
        },
        tol: {
            id: 'tol',
            name: 'Jalan Tol',
            icon: '🛣️',
            category: 'infra',
            desc: 'Jalan tol untuk akses cepat ke kota lain.',
            cost: { dana: 150000, material: 180 },
            size: 3,
            height: 6,
            colors: { top: '#606870', left: '#505860', right: '#404850' },
            roofColors: null,
            effects: { happiness: 10 },
            production: { dana: 8000 },
            unlockStage: 4
        }
    },

    // ===== GAME STAGES =====
    STAGES: [
        { name: 'Tahap Perintisan', minPopulation: 0, color: '#a08060' },
        { name: 'Desa Berkembang', minPopulation: 50, color: '#60a060' },
        { name: 'Kota Kecil', minPopulation: 300, color: '#6090d0' },
        { name: 'Kota Maju', minPopulation: 800, color: '#d0a040' },
        { name: 'Kota Metropolitan', minPopulation: 1500, color: '#c060d0' }
    ],

    // ===== RANDOM EVENTS =====
    EVENTS: [
        {
            id: 'panen_raya',
            title: 'Panen Raya!',
            icon: '🌾',
            desc: 'Musim panen yang sangat baik! Hasil pertanian melimpah ruah.',
            effects: { pangan: 50, dana: 5000, happiness: 5 },
            type: 'positive',
            minStage: 0
        },
        {
            id: 'bantuan_pemerintah',
            title: 'Bantuan Pemerintah',
            icon: '🏛️',
            desc: 'Pemerintah pusat mengirimkan bantuan dana dan material untuk pembangunan.',
            effects: { dana: 20000, material: 30 },
            type: 'positive',
            minStage: 0
        },
        {
            id: 'transmigran_baru',
            title: 'Kedatangan Transmigran',
            icon: '👥',
            desc: 'Rombongan transmigran baru datang dari Jawa untuk memulai kehidupan baru.',
            effects: { populasi: 10, happiness: 3 },
            type: 'positive',
            minStage: 0
        },
        {
            id: 'gotong_royong',
            title: 'Gotong Royong',
            icon: '🤝',
            desc: 'Warga bergotong royong membersihkan dan memperbaiki lingkungan.',
            effects: { material: 15, happiness: 8 },
            type: 'positive',
            minStage: 0
        },
        {
            id: 'festival_budaya',
            title: 'Festival Budaya',
            icon: '🎉',
            desc: 'Warga dari berbagai daerah mengadakan festival budaya bersama.',
            effects: { happiness: 12, education: 3 },
            type: 'positive',
            minStage: 1
        },
        {
            id: 'hujan_lebat',
            title: 'Hujan Lebat',
            icon: '🌧️',
            desc: 'Hujan deras mengguyur kawasan. Beberapa infrastruktur rusak.',
            effects: { material: -10, happiness: -3 },
            type: 'negative',
            minStage: 0
        },
        {
            id: 'banjir',
            title: 'Banjir!',
            icon: '🌊',
            desc: 'Banjir melanda kawasan! Sebagian pangan dan material rusak.',
            effects: { pangan: -20, material: -15, happiness: -8, health: -5 },
            type: 'negative',
            minStage: 0
        },
        {
            id: 'wabah',
            title: 'Wabah Penyakit',
            icon: '🦠',
            desc: 'Wabah penyakit menyerang kawasan. Perlu peningkatan fasilitas kesehatan.',
            effects: { health: -12, happiness: -6, populasi: -3 },
            type: 'negative',
            minStage: 0
        },
        {
            id: 'hama',
            title: 'Serangan Hama',
            icon: '🐛',
            desc: 'Hama menyerang area pertanian, mengurangi hasil panen.',
            effects: { pangan: -25, dana: -2000 },
            type: 'negative',
            minStage: 0
        },
        {
            id: 'kunjungan_pejabat',
            title: 'Kunjungan Pejabat',
            icon: '🎖️',
            desc: 'Pejabat daerah berkunjung dan memberikan bantuan tambahan.',
            effects: { dana: 15000, happiness: 5 },
            type: 'positive',
            minStage: 1
        },
        {
            id: 'pelatihan',
            title: 'Program Pelatihan',
            icon: '📝',
            desc: 'Program pelatihan keterampilan untuk warga transmigran.',
            effects: { education: 8, happiness: 4, dana: -3000 },
            type: 'positive',
            minStage: 1
        },
        {
            id: 'investor',
            title: 'Investor Datang',
            icon: '💼',
            desc: 'Investor tertarik berinvestasi di kawasan transmigrasi.',
            effects: { dana: 30000, happiness: 5 },
            type: 'positive',
            minStage: 2
        },
        {
            id: 'kekeringan',
            title: 'Musim Kemarau Panjang',
            icon: '☀️',
            desc: 'Kemarau panjang mengurangi sumber air dan hasil pertanian.',
            effects: { pangan: -15, health: -5, happiness: -4 },
            type: 'negative',
            minStage: 0
        },
        {
            id: 'expo_nasional',
            title: 'Expo Nasional',
            icon: '🎪',
            desc: 'Kota terpilih menjadi tuan rumah Expo Nasional. Pemasukan melonjak!',
            effects: { dana: 80000, happiness: 15 },
            type: 'positive',
            minStage: 3
        },
        {
            id: 'kunjungan_wisatawan',
            title: 'Boom Wisatawan',
            icon: '🧳',
            desc: 'Gelombang wisatawan datang ke kota yang semakin maju.',
            effects: { dana: 40000, happiness: 10 },
            type: 'positive',
            minStage: 3
        },
        {
            id: 'beasiswa',
            title: 'Program Beasiswa',
            icon: '🎓',
            desc: 'Pemerintah memberikan beasiswa untuk warga berprestasi.',
            effects: { education: 15, happiness: 8, dana: -10000 },
            type: 'positive',
            minStage: 2
        },
        {
            id: 'demo_buruh',
            title: 'Demo Buruh',
            icon: '📢',
            desc: 'Para pekerja pabrik melakukan unjuk rasa menuntut kenaikan upah.',
            effects: { happiness: -10, dana: -15000 },
            type: 'negative',
            minStage: 3
        },
        {
            id: 'gempa',
            title: 'Gempa Bumi',
            icon: '🌍',
            desc: 'Gempa bumi mengguncang kawasan. Beberapa bangunan rusak.',
            effects: { material: -30, happiness: -12, health: -8 },
            type: 'negative',
            minStage: 1
        },
        {
            id: 'investasi_asing',
            title: 'Investasi Asing Masuk',
            icon: '🌐',
            desc: 'Investor asing tertarik dengan potensi ekonomi kota.',
            effects: { dana: 150000, happiness: 8, education: 5 },
            type: 'positive',
            minStage: 4
        },
        {
            id: 'kebakaran',
            title: 'Kebakaran Lahan',
            icon: '🔥',
            desc: 'Kebakaran lahan terjadi di pinggiran kota.',
            effects: { pangan: -30, health: -10, happiness: -8 },
            type: 'negative',
            minStage: 0
        },
        {
            id: 'kemacetan',
            title: 'Kemacetan Parah',
            icon: '🚗',
            desc: 'Kemacetan lalu lintas mengganggu produktivitas warga.',
            effects: { happiness: -8, dana: -5000 },
            type: 'negative',
            minStage: 3
        },
        {
            id: 'festival_kuliner',
            title: 'Festival Kuliner',
            icon: '🍜',
            desc: 'Festival kuliner nusantara menarik pengunjung dari berbagai daerah.',
            effects: { dana: 20000, happiness: 10, pangan: -10 },
            type: 'positive',
            minStage: 2
        }
    ],

    // ===== ACTIVITY MESSAGES (for people animation) =====
    ACTIVITIES: [
        'Bertani di sawah',
        'Berbelanja di pasar',
        'Bekerja di ladang',
        'Belajar di sekolah',
        'Beribadah di masjid',
        'Berkumpul di balai desa',
        'Membangun rumah',
        'Bermain di taman',
        'Berobat di puskesmas',
        'Bergotong royong',
        'Belanja di mall',
        'Kuliah di universitas',
        'Bekerja di pabrik',
        'Menginap di hotel',
        'Jogging di taman kota',
        'Menonton pertandingan di stadion',
        'Naik kereta ke kota',
        'Berobat di rumah sakit',
        'Meeting di bank',
        'Mancing di tambak'
    ]
};
