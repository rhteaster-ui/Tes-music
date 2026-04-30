# Next Update Plan (Concrete, Low-Halu)

Tanggal: 30 April 2026

## Fokus Update Berikutnya (langsung bisa dikerjakan)

## 1) Backend hardening dulu (paling berdampak)
File: `api/index.py`

Perubahan:
- Batasi input `query` (min 2, max 100 karakter).
- Tambah response error standar: `status`, `error_code`, `message`, `timestamp`.
- Tambah timeout wrapper untuk call `ytmusic.search`.
- Ganti CORS wildcard ke allowlist dari env (default localhost untuk dev).

Kriteria selesai:
- Request invalid dapat HTTP 422 dengan payload error standar.
- Request timeout dapat HTTP 504 dengan payload error standar.
- Origin selain allowlist ditolak.

## 2) Frontend error visibility (jangan silent fail)
File: `public/script.js`

Perubahan:
- Hapus `catch {}` kosong di fungsi async kritikal.
- Tambah helper `reportError(context, error)` (tanpa `console.log` di production).
- Tampilkan feedback user (toast sederhana) saat fetch gagal.

Kriteria selesai:
- Tidak ada `catch` kosong.
- Gagal API tetap menampilkan UI fallback, bukan diam.

## 3) Service worker offline fallback yang jelas
File: `public/sw.js`

Perubahan:
- Tambahkan fallback halaman offline untuk request dokumen.
- Untuk endpoint `/api/`, return error JSON dengan `error_code` dan `message` yang jelas.
- Tetap cache static assets agar first paint stabil di jaringan jelek.

Kriteria selesai:
- Saat offline total, user tetap dapat halaman fallback.
- API offline response konsisten strukturnya.

---

## Urutan eksekusi yang disarankan
1. Backend hardening
2. Frontend error visibility
3. SW offline fallback
4. Baru lanjut fitur baru

## Kenapa urutan ini
- Menurunkan risiko crash/silent failure paling cepat.
- Memudahkan debugging karena error jadi terstruktur.
- Mengurangi komplain user saat jaringan buruk.
