# Soundify Stability Audit (April 30, 2026)

## Ringkasan Temuan Utama

1. **Error handling frontend masih banyak silent fail** (`catch {}` kosong, `console.log` dipakai di production).
2. **Backend belum fail-fast & observability minim** (tanpa structured logging, tanpa timeout wrapper, CORS wildcard).
3. **Offline/PWA strategy belum robust** (network-first tanpa fallback HTML, cache versioning manual, belum ada stale-while-revalidate).
4. **Resiko race/state issue** pada player control dan IndexedDB update.
5. **Security baseline perlu dinaikkan** (CORS terlalu longgar, belum ada input constraint, belum ada security headers).

---

## Detail Masalah yang Berpotensi Menjadi Bug Produksi

## 1) Frontend (public/script.js)

- **Silent failure di async boundary**
  - `playNextSimilarSong()` menelan error tanpa logging (`catch (error) {}`), sehingga debugging di perangkat user jadi buta.
- **`console.log` di jalur produksi**
  - `onPlayerReady` dan catch service worker masih memakai `console.log`, tidak ada severity/correlation context.
- **Potensi null access pada DOM references**
  - Beberapa handler mengasumsikan elemen selalu ada (`mainPlayBtn`, `miniPlayBtn`, `installAppBtn`) tanpa guard menyeluruh di semua jalur.
- **Race condition UI player**
  - State `isPlaying`, `currentTrack`, repeat/shuffle, dan callback YouTube state change bisa overlap saat user klik cepat (next/pause/play) pada jaringan lambat.

## 2) Backend (api/index.py)

- **CORS terlalu permisif**
  - `allow_origins=["*"]` membuka seluruh origin; cocok untuk dev, berisiko untuk prod.
- **No input contract validation**
  - `query` belum diberi batas panjang/min chars; bisa men-trigger request mahal/abusive.
- **Error response tidak standardized untuk observability**
  - Return `{status: error, message}` ada, tapi tanpa `error_code`, `trace_id`, `timestamp`.
- **No timeout/circuit handling ke dependency**
  - `ytmusic.search()` dipanggil langsung; jika hang/slow, request thread tertahan.

## 3) Service Worker (public/sw.js)

- **API fallback terlalu minim konteks**
  - Saat offline, hanya return `{status:'error', data:[]}` tanpa reason/error type.
- **Fetch strategy network-first murni**
  - Tidak ada stale-while-revalidate untuk static assets → UX lambat di koneksi buruk.
- **Belum ada fallback dokumen**
  - Bila request HTML gagal dan cache miss, user bisa blank/failed load.

## 4) Integritas Data & Storage

- **Retention history kurang deterministik**
  - Saat `count > 50`, cursor menghapus satu item per event, tapi tidak memastikan pruning sampai batas tepat.
- **IndexedDB init failure path minim**
  - Tidak ada `request.onerror` handling eksplisit untuk memberi feedback ke UI.

---

## Prioritas Update Berikutnya (Next Sprint Recommendation)

## P0 (wajib dulu)
1. Tambahkan **structured logger** frontend+backend (severity, timestamp, context, trace id).
2. Ganti silent catches menjadi **error-as-data** + toast/user feedback.
3. Kunci **CORS allowlist** ke domain production.
4. Tambahkan **validation** untuk query API (min/max length, sanitization, rate limit sederhana).

## P1
1. Implement **timeout wrapper + retry budget** untuk call ke `ytmusic`.
2. Perkuat service worker: **stale-while-revalidate** untuk aset + offline fallback page.
3. Refactor player state machine agar transisi play/pause/next lebih deterministik.

## P2
1. Tambahkan **health endpoint** + basic metrics (request latency histogram).
2. Tambahkan pipeline quality gate: lint + type check + smoke test sebelum deploy.
3. Tambahkan security headers (CSP minimal, X-Content-Type-Options, Referrer-Policy).

---

## Definisi Selesai (DoD) untuk Update Selanjutnya

- Tidak ada `catch {}` kosong.
- Tidak ada `console.log` untuk jalur production.
- Semua endpoint punya input validation + standardized error envelope.
- Semua async critical path punya timeout.
- PWA tetap menampilkan UI fallback saat offline total.
