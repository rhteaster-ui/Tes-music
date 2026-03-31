// --- 0. NAVIGASI BACK, SPLASH SCREEN & PWA ---
window.addEventListener('load', () => {
    history.replaceState({ view: 'home' }, '', '#home');

    if (!sessionStorage.getItem('splashShown')) {
        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            if(splash) {
                splash.style.opacity = '0';
                setTimeout(() => { 
                    splash.style.display = 'none'; 
                    splash.remove(); 
                }, 500);
            }
        }, 7500);
        sessionStorage.setItem('splashShown', 'true');
    } else {
        const splash = document.getElementById('splash-screen');
        if(splash) {
            splash.style.display = 'none';
            splash.remove();
        }
    }

    // --- LOGIC AUTO-UPDATE PWA BARU ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            // Paksa browser ngecek update ke server setiap kali user buka app
            reg.update();
        }).catch(err => console.log('PWA error:', err));

        // Deteksi kalau ada Service Worker baru yang ter-install
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                // Refresh paksa diam-diam biar user dapet UI terbaru!
                window.location.reload(); 
            }
        });
    }
    
    loadHomeData();
    renderSearchCategories();
});

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
// ... (SISA KODE SCRIPT.JS LU KE BAWAH TETAP SAMA, JANGAN DIHAPUS) ...
