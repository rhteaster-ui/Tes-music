/**
 * R_hmt ofc - Web Music Player
 * ✧･ﾟ: [𝙍]𝙝𝙢𝙏 | 𝘾𝙤𝙙𝙚⚙️𝘼𝙄 𝙡 :･ﾟ✧
 */

// --- 0. KONFIGURASI & PWA ---
let deferredPrompt;
const DEV_PROFILE_IMG = "https://res.cloudinary.com/dwiozm4vz/image/upload/v1772959730/ootglrvfmykn6xsto7rq.png";

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW Error:', err));
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) installBtn.style.display = 'flex';
});

// --- 1. DATABASE (IndexedDB) ---
let db;
const requestDB = indexedDB.open("RHmtMusicDB", 2);

requestDB.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains('playlists')) db.createObjectStore('playlists', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('liked')) db.createObjectStore('liked', { keyPath: 'videoId' });
};

requestDB.onsuccess = (e) => {
    db = e.target.result;
    console.log("Database R_hmt Ready");
    renderLibrary();
};

// --- 2. PLAYER CORE (YouTube API) ---
let player;
let isPlaying = false;
let currentTrack = null;
let currentQueue = [];
let isShuffle = false;
let progressInterval;

function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtube-player', {
        height: '0', width: '0',
        playerVars: { 'autoplay': 0, 'controls': 0, 'disablekb': 1 },
        events: {
            'onReady': () => console.log("Player R_hmt Siap"),
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerStateChange(event) {
    const mainPlayBtn = document.getElementById('mainPlayBtn');
    const miniPlayBtn = document.getElementById('miniPlayBtn');
    
    // Icon Logic
    const playIcon = "▶";
    const pauseIcon = "⏸";

    if (event.data == YT.PlayerState.PLAYING) {
        isPlaying = true;
        mainPlayBtn.innerText = pauseIcon;
        miniPlayBtn.innerHTML = `<svg viewBox="0 0 24 24" style="fill:white; width:28px;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>`;
        startProgressBar();
        updateMediaSession();
    } else {
        isPlaying = false;
        mainPlayBtn.innerText = playIcon;
        miniPlayBtn.innerHTML = `<svg viewBox="0 0 24 24" style="fill:white; width:28px;"><path d="M8 5v14l11-7z"></path></svg>`;
        stopProgressBar();
    }

    if (event.data == YT.PlayerState.ENDED) {
        nextTrack();
    }
}

// --- 3. FUNGSI PEMUTARAN ---
function playMusic(videoId, encodedData) {
    currentTrack = JSON.parse(decodeURIComponent(encodedData));
    
    // Update UI
    document.getElementById('miniPlayer').style.display = 'flex';
    document.getElementById('miniPlayerImg').src = currentTrack.img;
    document.getElementById('miniPlayerTitle').innerText = currentTrack.title;
    document.getElementById('miniPlayerArtist').innerText = currentTrack.artist;

    document.getElementById('playerArt').src = currentTrack.img;
    document.getElementById('playerTitle').innerText = currentTrack.title;
    document.getElementById('playerArtist').innerText = currentTrack.artist;
    document.getElementById('playerBg').style.backgroundImage = `url('${currentTrack.img}')`;

    player.loadVideoById(videoId);
    checkIfLiked(videoId);
    
    // Tambahkan ke Antrean (Queue) jika belum ada
    if (!currentQueue.find(t => t.videoId === videoId)) {
        currentQueue.push(currentTrack);
    }
}

function togglePlay() {
    if (!player) return;
    isPlaying ? player.pauseVideo() : player.playVideo();
}

function nextTrack() {
    if (currentQueue.length > 1) {
        let nextIdx;
        if (isShuffle) {
            nextIdx = Math.floor(Math.random() * currentQueue.length);
        } else {
            const currentIdx = currentQueue.findIndex(t => t.videoId === currentTrack.videoId);
            nextIdx = (currentIdx + 1) % currentQueue.length;
        }
        const next = currentQueue[nextIdx];
        playMusic(next.videoId, encodeURIComponent(JSON.stringify(next)));
    } else {
        // Auto-play lagu serupa jika antrean habis
        playSimilar();
    }
}

async function playSimilar() {
    if (!currentTrack) return;
    try {
        const res = await fetch(`/api/search?query=${encodeURIComponent(currentTrack.artist + " hits")}`);
        const json = await res.json();
        if (json.status === 'success' && json.data.length > 0) {
            const randomTrack = json.data[Math.floor(Math.random() * json.data.length)];
            const trackData = {
                videoId: randomTrack.videoId,
                title: randomTrack.title,
                artist: randomTrack.artist,
                img: getHighResImg(randomTrack.thumbnail)
            };
            playMusic(randomTrack.videoId, encodeURIComponent(JSON.stringify(trackData)));
        }
    } catch (e) { console.log("Similiar search failed"); }
}

function toggleShuffle() {
    isShuffle = !isShuffle;
    const btn = document.getElementById('shuffleBtn');
    btn.style.color = isShuffle ? "#00d2ff" : "#fff";
    showToast(isShuffle ? "Shuffle Nyala" : "Shuffle Mati");
}

// --- 4. UI & NAVIGASI ---
function switchView(view) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + view).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    // Map nav active state logic here...
    window.scrollTo(0,0);
}

function expandPlayer() { document.getElementById('playerModal').style.display = 'flex'; }
function minimizePlayer() { document.getElementById('playerModal').style.display = 'none'; }

// --- 5. DATA FETCHING (Home & Search) ---
async function loadHome() {
    try {
        const res = await fetch('/api/home');
        const json = await res.json();
        if (json.status === 'success') {
            renderRow(json.data.recent, 'recentList', 'list');
            
            // Render row lainnya secara dinamis
            const container = document.getElementById('homeRows');
            container.innerHTML = ''; // Clear
            
            Object.keys(json.data).forEach(key => {
                if (key === 'recent') return;
                const rowHtml = `
                    <div class="section-container">
                        <h2 class="section-title" style="text-transform:capitalize;">${key}</h2>
                        <div class="horizontal-scroll" id="row-${key}"></div>
                    </div>
                `;
                container.innerHTML += rowHtml;
                renderRow(json.data[key], `row-${key}`, 'card');
            });
        }
    } catch (e) { showToast("Gagal memuat data beranda"); }
}

function renderRow(data, containerId, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let html = '';
    data.forEach(t => {
        const img = getHighResImg(t.thumbnail);
        const trackData = encodeURIComponent(JSON.stringify({
            videoId: t.videoId, title: t.title, artist: t.artist, img: img
        }));
        
        if (type === 'list') {
            html += `
                <div class="v-item" onclick="playMusic('${t.videoId}', '${trackData}')">
                    <img src="${img}" class="v-img" loading="lazy">
                    <div class="v-info">
                        <div class="v-title">${t.title}</div>
                        <div class="v-sub">${t.artist}</div>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="h-card" onclick="playMusic('${t.videoId}', '${trackData}')" style="width:140px; flex-shrink:0; margin-right:15px;">
                    <img src="${img}" style="width:140px; height:140px; border-radius:10px; object-fit:cover; margin-bottom:8px;">
                    <div class="v-title" style="font-size:13px; font-weight:600;">${t.title}</div>
                    <div class="v-sub" style="font-size:11px;">${t.artist}</div>
                </div>
            `;
        }
    });
    container.innerHTML = html;
}

// --- 6. PENCARIAN ---
let searchTimer;
document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const query = e.target.value;
    if (query.length < 2) return;

    searchTimer = setTimeout(async () => {
        document.getElementById('searchResultsUI').style.display = 'block';
        document.getElementById('searchResults').innerHTML = '<p style="padding:20px; color:#aaa;">Mencari...</p>';
        
        const res = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
        const json = await res.json();
        if (json.status === 'success') {
            renderRow(json.data, 'searchResults', 'list');
        }
    }, 600);
});

// --- 7. UTILS & SOCIAL ---
function getHighResImg(url) {
    return url ? url.replace(/s\d+-c/g, "s512-c").replace(/=w\d+-h\d+/g, "=w512-h512") : DEV_PROFILE_IMG;
}

function showToast(msg) {
    const t = document.getElementById('customToast');
    t.innerText = msg;
    t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 2500);
}

async function shareSong() {
    if (!currentTrack) return;
    try {
        await navigator.share({
            title: currentTrack.title,
            text: `Lagi dengerin ${currentTrack.title} oleh ${currentTrack.artist} di R_hmt Music ofc!`,
            url: window.location.href
        });
    } catch (e) { showToast("Gagal share / Browser tidak support"); }
}

// Media Session (Kontrol dari lockscreen HP)
function updateMediaSession() {
    if ('mediaSession' in navigator && currentTrack) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: currentTrack.title,
            artist: currentTrack.artist,
            artwork: [{ src: currentTrack.img, sizes: '512x512', type: 'image/png' }]
        });
        navigator.mediaSession.setActionHandler('play', togglePlay);
        navigator.mediaSession.setActionHandler('pause', togglePlay);
        navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
    }
}

// Progress Bar Logic
function startProgressBar() {
    stopProgressBar();
    progressInterval = setInterval(() => {
        if (player && player.getCurrentTime) {
            const curr = player.getCurrentTime();
            const dur = player.getDuration();
            const perc = (curr / dur) * 100;
            document.getElementById('progressBar').value = perc || 0;
            document.getElementById('currentTime').innerText = formatTime(curr);
            document.getElementById('totalTime').innerText = formatTime(dur);
        }
    }, 1000);
}

function stopProgressBar() { clearInterval(progressInterval); }

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function seekTo(val) {
    const dur = player.getDuration();
    player.seekTo((val / 100) * dur);
}

// Start Aplikasi
window.onload = () => {
    loadHome();
};
