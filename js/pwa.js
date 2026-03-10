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

    // ── Install prompt (Android) + iOS instructions ──────────
    _setupInstallPrompt() {
        if (this._isStandalone) return; // already installed

        // Android: intercept beforeinstallprompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this._deferredPrompt = e;
            // Show after 4 seconds (don't interrupt loading)
            setTimeout(() => this._showAndroidInstallBanner(), 4000);
        });

        // iOS Safari: fullscreen is IMPOSSIBLE without Add to Home Screen.
        // Show a prominent full-screen guide overlay.
        if (this._isIOS && !this._isStandalone) {
            const isSafari = /safari/i.test(navigator.userAgent) &&
                             !/chrome|crios|fxios/i.test(navigator.userAgent);
            if (isSafari) {
                // Show immediately after game loads (1s delay so game is visible)
                setTimeout(() => this._showIOSFullscreenGuide(), 1000);
            }
        }
    },

    _showAndroidInstallBanner() {
        if (!this._deferredPrompt) return;
        if (localStorage.getItem('pwa-install-dismissed')) return;

        const banner = document.createElement('div');
        banner.id = 'pwa-install-banner';
        banner.innerHTML = `
            <div class="pwa-banner-icon">🏘️</div>
            <div class="pwa-banner-text">
                <strong>Tambah ke Homescreen</strong>
                <span>Main seperti aplikasi native!</span>
            </div>
            <button class="pwa-banner-install">Pasang</button>
            <button class="pwa-banner-close" aria-label="Tutup">✕</button>
        `;
        document.body.appendChild(banner);

        requestAnimationFrame(() => banner.classList.add('pwa-visible'));

        banner.querySelector('.pwa-banner-install').addEventListener('click', async () => {
            banner.remove();
            this._deferredPrompt.prompt();
            const { outcome } = await this._deferredPrompt.userChoice;
            this._deferredPrompt = null;
            if (outcome === 'accepted') this._vibrate([30, 50, 30]);
        });

        banner.querySelector('.pwa-banner-close').addEventListener('click', () => {
            banner.classList.remove('pwa-visible');
            setTimeout(() => banner.remove(), 300);
            localStorage.setItem('pwa-install-dismissed', '1');
        });
    },

    _showIOSFullscreenGuide() {
        if (localStorage.getItem('ios-guide-dismissed')) return;

        const el = document.createElement('div');
        el.id = 'ios-fullscreen-guide';
        el.innerHTML = `
            <div class="ifg-backdrop"></div>
            <div class="ifg-card">
                <div class="ifg-icon">🏘️</div>
                <h2 class="ifg-title">Mainkan Fullscreen<br>di iPhone!</h2>
                <p class="ifg-sub">Safari tidak bisa fullscreen.<br>Simpan ke Home Screen untuk pengalaman<br>seperti app native — tanpa browser bar!</p>

                <div class="ifg-steps">
                    <div class="ifg-step">
                        <span class="ifg-step-num">1</span>
                        <span class="ifg-step-text">Tap ikon <strong>⬆️ Share</strong> di toolbar Safari bawah</span>
                    </div>
                    <div class="ifg-step">
                        <span class="ifg-step-num">2</span>
                        <span class="ifg-step-text">Pilih <strong>"Add to Home Screen"</strong></span>
                    </div>
                    <div class="ifg-step">
                        <span class="ifg-step-num">3</span>
                        <span class="ifg-step-text">Tap <strong>"Add"</strong> — selesai! 🎉</span>
                    </div>
                </div>

                <div class="ifg-benefits">
                    <span>✅ Fullscreen</span>
                    <span>✅ Tanpa browser bar</span>
                    <span>✅ Ikon di homescreen</span>
                    <span>✅ Load lebih cepat</span>
                </div>

                <div class="ifg-arrow-hint">
                    <span class="ifg-arrow-text">Tap ⬆️ Share di bawah</span>
                    <span class="ifg-bounce">↓</span>
                </div>

                <button class="ifg-btn-later">Lanjutkan di browser saja</button>
            </div>
        `;
        document.body.appendChild(el);

        requestAnimationFrame(() => el.classList.add('ifg-visible'));

        el.querySelector('.ifg-btn-later').addEventListener('click', () => {
            el.classList.remove('ifg-visible');
            setTimeout(() => el.remove(), 400);
            localStorage.setItem('ios-guide-dismissed', '1');
        });
    },

    // Keep old method as fallback alias
    _showIOSInstallTip() { this._showIOSFullscreenGuide(); },

    // ── Fullscreen (hide browser chrome) ────────────────────
    _setupFullscreen() {
        if (!this._isMobile || this._isStandalone) return;

        // iOS Safari does NOT support Fullscreen API at all.
        // The ONLY way to get fullscreen on iOS is "Add to Home Screen" (PWA).
        // We show the install tip for iOS in _setupInstallPrompt().
        if (this._isIOS) return;

        const requestFS = () => {
            const el = document.documentElement;
            const rq = el.requestFullscreen ||
                       el.webkitRequestFullscreen ||
                       el.mozRequestFullScreen ||
                       el.msRequestFullscreen;
            if (!rq) return;
            rq.call(el).catch(() => {
                // Fullscreen rejected (e.g. user dismissed) — try again on next interaction
            });
        };

        // Fire on FIRST touch anywhere on the page (not just canvas)
        const onFirstTouch = () => {
            requestFS();
        };
        document.addEventListener('touchstart', onFirstTouch, { once: true, passive: true });
        document.addEventListener('click',      onFirstTouch, { once: true });

        // Re-request fullscreen if user swipes up browser chrome back
        const onFSChange = () => {
            const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
            if (!isFS && this._isMobile && !this._isStandalone) {
                // Wait for next user interaction to re-request (browser requires gesture)
                document.addEventListener('touchstart', requestFS, { once: true, passive: true });
            }
        };
        document.addEventListener('fullscreenchange', onFSChange);
        document.addEventListener('webkitfullscreenchange', onFSChange);
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
