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
        this._isMobile = this._isIOS || this._isAndroid || window.innerWidth <= 768;
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

        // iOS: show instructions after 5 seconds if in Safari
        if (this._isIOS && !this._isStandalone) {
            const isSafari = /safari/i.test(navigator.userAgent) &&
                             !/chrome|crios|fxios/i.test(navigator.userAgent);
            if (isSafari) {
                setTimeout(() => this._showIOSInstallTip(), 5000);
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

    _showIOSInstallTip() {
        if (localStorage.getItem('ios-tip-dismissed')) return;

        const tip = document.createElement('div');
        tip.id = 'ios-install-tip';
        tip.innerHTML = `
            <div class="ios-tip-handle"></div>
            <div class="ios-tip-body">
                <span class="ios-tip-icon">🏘️</span>
                <div class="ios-tip-text">
                    <strong>Tambah ke Home Screen</strong>
                    <p>Tap <strong>⬆️ Share</strong> lalu pilih<br><strong>"Add to Home Screen"</strong></p>
                    <p class="ios-tip-sub">Game akan terbuka seperti app iPhone!</p>
                </div>
            </div>
            <div class="ios-tip-arrow">▼</div>
            <button class="ios-tip-close">Nanti saja</button>
        `;
        document.body.appendChild(tip);

        requestAnimationFrame(() => tip.classList.add('ios-tip-visible'));

        tip.querySelector('.ios-tip-close').addEventListener('click', () => {
            tip.classList.remove('ios-tip-visible');
            setTimeout(() => tip.remove(), 350);
            localStorage.setItem('ios-tip-dismissed', '1');
        });

        // Auto-dismiss after 12 seconds
        setTimeout(() => {
            if (tip.parentNode) {
                tip.classList.remove('ios-tip-visible');
                setTimeout(() => tip.remove(), 350);
            }
        }, 12000);
    },

    // ── Fullscreen (hide browser chrome) ────────────────────
    _setupFullscreen() {
        if (!this._isMobile || this._isStandalone) return;

        // Request fullscreen on first canvas tap
        const requestFS = () => {
            const el = document.documentElement;
            const rq = el.requestFullscreen || el.webkitRequestFullscreen ||
                       el.mozRequestFullScreen || el.msRequestFullscreen;
            if (rq) rq.call(el).catch(() => {});
        };

        const canvas = document.getElementById('game-canvas');
        if (canvas) {
            canvas.addEventListener('touchstart', requestFS, { once: true });
        }

        // Re-request fullscreen if user exits it accidentally
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement && this._isMobile && !this._isStandalone) {
                setTimeout(requestFS, 2000);
            }
        });
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
