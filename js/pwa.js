// ============================================================
// PWA.JS — Native App Feel: install, orientation, fullscreen,
//          offline banner, safe area, haptic
// ============================================================

const PWA = {
    _deferredPrompt: null,
    _isStandalone: false,
    _isIOS: false,
    _isAndroid: false,

    init() {
        this._detect();
        this._registerSW();
        this._handleOrientation();
        this._preventBrowserDefaults();
        this._setupInstallPrompt();
        this._setupFullscreen();
        this._watchOnlineStatus();
    },

    // ── Platform detection ───────────────────────────────────
    _detect() {
        const ua = navigator.userAgent;
        this._isIOS = /iphone|ipad|ipod/i.test(ua);
        this._isAndroid = /android/i.test(ua);
        // iOS Safari only (excludes Chrome/Firefox/Opera on iOS which have their own menus)
        this._isIOSSafari = this._isIOS &&
            /safari/i.test(ua) &&
            !/CriOS|FxiOS|OPiOS|EdgiOS|mercury/i.test(ua);
        this._isMobile = this._isIOS || this._isAndroid || window.innerWidth <= 1024;
        this._isStandalone =
            window.navigator.standalone === true ||
            window.matchMedia('(display-mode: standalone)').matches ||
            window.matchMedia('(display-mode: fullscreen)').matches;

        document.documentElement.classList.toggle('is-ios', this._isIOS);
        document.documentElement.classList.toggle('is-android', this._isAndroid);
        document.documentElement.classList.toggle('is-mobile', this._isMobile);
        document.documentElement.classList.toggle('is-standalone', this._isStandalone);
    },

    // ── Service Worker registration ──────────────────────────
    _registerSW() {
        if (!('serviceWorker' in navigator)) return;
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then((reg) => {
                    // Check for updates
                    reg.addEventListener('updatefound', () => {
                        const nw = reg.installing;
                        nw.addEventListener('statechange', () => {
                            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                                this._showUpdateBanner();
                            }
                        });
                    });
                })
                .catch(err => console.warn('[PWA] SW registration failed:', err));
        });
    },

    // ── Orientation lock + portrait warning ──────────────────
    _handleOrientation() {
        if (!this._isMobile) return;

        // Create portrait warning overlay
        const overlay = document.createElement('div');
        overlay.id = 'portrait-warning';
        overlay.innerHTML = `
            <div class="pw-inner">
                <div class="pw-icon">📱</div>
                <div class="pw-arrow">↻</div>
                <h2>Putar Layarmu</h2>
                <p>Game ini lebih seru dalam mode <strong>landscape</strong> (horizontal)</p>
            </div>
        `;
        document.body.appendChild(overlay);

        const check = () => {
            const isPortrait = window.innerHeight > window.innerWidth;
            overlay.style.display = isPortrait ? 'flex' : 'none';
        };

        window.addEventListener('resize', check);
        window.addEventListener('orientationchange', () => setTimeout(check, 150));
        check();

        // Try to lock orientation via API
        const tryLock = () => {
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').catch(() => {});
            }
        };

        // Lock on first user interaction (iOS requires gesture)
        document.addEventListener('touchstart', tryLock, { once: true });
        document.addEventListener('click', tryLock, { once: true });
    },

    // ── Prevent all browser default mobile behaviors ─────────
    _preventBrowserDefaults() {
        // Prevent pull-to-refresh
        document.body.style.overscrollBehavior = 'none';

        // Prevent context menu on long-press (on canvas/game area)
        document.addEventListener('contextmenu', e => {
            if (e.target.tagName === 'CANVAS' || e.target.closest('#game-area')) {
                e.preventDefault();
            }
        });

        // Prevent double-tap zoom
        let lastTap = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTap < 300 && e.target.tagName === 'CANVAS') {
                e.preventDefault();
            }
            lastTap = now;
        }, { passive: false });

        // Prevent pinch zoom on non-canvas areas
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length > 1 && !e.target.closest('#game-canvas')) {
                e.preventDefault();
            }
        }, { passive: false });
    },

    // ── Capture Android install prompt silently ──────────────
    _setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this._deferredPrompt = e;
        });
    },

    // ── Fullscreen gate: shown every session until in fullscreen/standalone ──
    _setupFullscreen() {
        if (!this._isMobile) return;
        if (this._isStandalone) return; // already running as installed app

        // Show the fullscreen gate after a short delay (game needs to load first)
        setTimeout(() => this._showFullscreenGate(), 800);
    },

    _showFullscreenGate() {
        // Don't show if already fullscreen (Android achieved it)
        if (document.fullscreenElement || document.webkitFullscreenElement) return;

        const el = document.createElement('div');
        el.id = 'fs-gate';

        if (this._isAndroid) {
            el.innerHTML = `
                <div class="fsg-bg"></div>
                <div class="fsg-card">
                    <div class="fsg-icon">🏘️</div>
                    <h2 class="fsg-title">Transmigrasi:<br>Membangun Negeri</h2>
                    <p class="fsg-sub">Untuk pengalaman terbaik,<br>mainkan dalam mode <strong>layar penuh</strong></p>
                    <button class="fsg-btn-main" id="fsg-btn-fs">
                        ⛶ &nbsp;Mainkan Fullscreen
                    </button>
                    <button class="fsg-btn-skip" id="fsg-btn-skip">Lanjutkan biasa</button>
                </div>
            `;
            document.body.appendChild(el);
            requestAnimationFrame(() => el.classList.add('fsg-visible'));

            el.querySelector('#fsg-btn-fs').addEventListener('click', () => {
                const rq = document.documentElement.requestFullscreen ||
                           document.documentElement.webkitRequestFullscreen;
                if (rq) {
                    rq.call(document.documentElement).then(() => {
                        el.classList.remove('fsg-visible');
                        setTimeout(() => el.remove(), 400);
                        // Re-enter fullscreen automatically if user exits
                        this._watchFullscreenAndroid();
                    }).catch(() => {
                        el.classList.remove('fsg-visible');
                        setTimeout(() => el.remove(), 400);
                    });
                } else {
                    el.classList.remove('fsg-visible');
                    setTimeout(() => el.remove(), 400);
                }
            });

            el.querySelector('#fsg-btn-skip').addEventListener('click', () => {
                el.classList.remove('fsg-visible');
                setTimeout(() => el.remove(), 400);
            });

        } else if (this._isIOSSafari) {
            // iOS Safari only: Add to Home Screen guide (Chrome/Firefox iOS punya menu sendiri)
            el.innerHTML = `
                <div class="fsg-bg"></div>
                <div class="fsg-card">
                    <div class="fsg-icon">🏘️</div>
                    <h2 class="fsg-title">Mainkan Seperti<br>App iPhone!</h2>
                    <p class="fsg-sub">Untuk menyembunyikan browser bar,<br>simpan game ke <strong>Home Screen</strong> dulu</p>
                    <div class="fsg-steps">
                        <div class="fsg-step">
                            <span class="fsg-num">1</span>
                            <span>Tap <strong>⬆️ Share</strong> di toolbar bawah Safari</span>
                        </div>
                        <div class="fsg-step">
                            <span class="fsg-num">2</span>
                            <span>Pilih <strong>"Add to Home Screen"</strong></span>
                        </div>
                        <div class="fsg-step">
                            <span class="fsg-num">3</span>
                            <span>Tap <strong>"Add"</strong>, lalu buka dari ikon di homescreen</span>
                        </div>
                    </div>
                    <div class="fsg-arrow">
                        <span>Tap ⬆️ Share sekarang</span>
                        <span class="fsg-bounce">↓</span>
                    </div>
                    <button class="fsg-btn-skip" id="fsg-btn-skip">Mainkan di Safari (ada browser bar)</button>
                </div>
            `;
            document.body.appendChild(el);
            requestAnimationFrame(() => el.classList.add('fsg-visible'));

            el.querySelector('#fsg-btn-skip').addEventListener('click', () => {
                el.classList.remove('fsg-visible');
                setTimeout(() => el.remove(), 400);
            });
        }
    },

    _watchFullscreenAndroid() {
        const reEnter = () => {
            const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
            if (!isFS && this._isAndroid && !this._isStandalone) {
                document.addEventListener('touchstart', () => {
                    const rq = document.documentElement.requestFullscreen ||
                               document.documentElement.webkitRequestFullscreen;
                    if (rq) rq.call(document.documentElement).catch(() => {});
                }, { once: true, passive: true });
            }
        };
        document.addEventListener('fullscreenchange', reEnter);
        document.addEventListener('webkitfullscreenchange', reEnter);
    },

    // ── Online/offline notification ──────────────────────────
    _watchOnlineStatus() {
        const showOffline = () => {
            const existing = document.getElementById('offline-banner');
            if (existing) return;
            const b = document.createElement('div');
            b.id = 'offline-banner';
            b.textContent = '📶 Offline — game tetap bisa dimainkan!';
            document.body.appendChild(b);
            requestAnimationFrame(() => b.classList.add('offline-visible'));
        };
        const hideOffline = () => {
            const b = document.getElementById('offline-banner');
            if (b) {
                b.classList.remove('offline-visible');
                setTimeout(() => b.remove(), 400);
            }
        };

        window.addEventListener('offline', showOffline);
        window.addEventListener('online', hideOffline);
        if (!navigator.onLine) showOffline();
    },

    // ── App update banner ────────────────────────────────────
    _showUpdateBanner() {
        const b = document.createElement('div');
        b.id = 'update-banner';
        b.innerHTML = `
            <span>🆕 Versi baru tersedia!</span>
            <button onclick="window.location.reload()">Perbarui</button>
        `;
        document.body.appendChild(b);
        requestAnimationFrame(() => b.classList.add('update-visible'));
    },

    // ── Haptic feedback ──────────────────────────────────────
    vibrate(pattern) {
        if (navigator.vibrate) navigator.vibrate(pattern);
    },

    _vibrate(pattern) { this.vibrate(pattern); },
};

// Auto-init when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PWA.init());
} else {
    PWA.init();
}
