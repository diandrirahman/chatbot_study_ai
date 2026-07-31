# StudyMate AI

StudyMate AI adalah aplikasi perencana belajar berbasis AI. Pengguna membuat Study Profile, menghasilkan rencana belajar yang sesuai waktu dan hari belajarnya, lalu menyelesaikan sesi, praktik, serta kuis untuk memverifikasi kemajuan.

## Fitur utama

- Membuat rencana belajar Markdown berdasarkan subjek, target, level, durasi, waktu harian, hari belajar, gaya belajar, dan intensitas.
- Menyesuaikan rencana melalui asisten tanpa mengubah target utama kecuali diminta secara jelas.
- Mengubah rencana menjadi roadmap sesi belajar dengan materi, praktik, milestone, dan referensi.
- Kuis pilihan ganda lima soal per sesi dengan pembahasan, skor terbaru, dan nilai terbaik.
- Progress completion dan mastery terpisah; skor di bawah 70% memberi status **Perlu dipelajari lagi** tanpa mengunci sesi berikutnya.
- Penyimpanan profile, percakapan, sesi, checklist, kuis, dan attempts melalui localStorage.
- Rendering Markdown AI dengan `marked` dan sanitasi HTML menggunakan `DOMPurify`.

## Teknologi dan arsitektur

- Frontend: Vue 3 dan Vite.
- Backend: Express 5.
- AI: Google Gemini melalui SDK `@google/genai`, hanya dari backend.
- Validasi: validator request pada backend dan validasi form pada frontend.
- Persistence MVP: localStorage browser; tidak menggunakan database atau autentikasi.

```text
Browser Vue SPA
  ├─ Study Profile, plan, roadmap, sesi, kuis, progress
  ├─ localStorage
  └─ /api → Express API
               ├─ validator dan error handler
               └─ Gemini: plan, sesi, dan kuis
```

## Prasyarat

- Node.js 20 atau lebih baru
- npm 10 atau lebih baru
- Gemini API key dengan akses ke model yang dipilih

## Menjalankan aplikasi

1. Salin environment example menjadi file lokal:

   ```powershell
   Copy-Item server/.env.example server/.env
   ```

2. Isi `GEMINI_API_KEY` di `server/.env`. Atur `GEMINI_MODEL` bila diperlukan. Jangan menambahkan awalan `VITE_` pada API key.

3. Instal dependensi:

   ```bash
   npm install
   ```

4. Jalankan frontend dan backend bersamaan:

   ```bash
   npm run dev
   ```

Frontend tersedia di `http://localhost:5173`. Vite meneruskan `/api` ke Express di `http://localhost:3000`.

## Perintah penting

```bash
npm run dev
npm run build
npm run check
npm run test -w client
npm run test -w server
```

Untuk PowerShell yang memblokir `npm.ps1`, gunakan `npm.cmd` sebagai pengganti `npm`.

## Alur penggunaan

1. Isi Study Profile dan pilih **Generate study plan**.
2. Tinjau overview rencana: target, jadwal, milestone, roadmap sesi, dan dokumen plan lengkap.
3. Pilih sesi dari roadmap atau mulai sesi yang disarankan. Semua sesi bebas dibuka tanpa sequential locking.
4. Selesaikan materi dan praktik, lalu buat kuis saat diperlukan. Seluruh lima soal harus dijawab sebelum dikirim.
5. Skor terbaik minimal 70% menandai mastery. Skor di bawah 70% memberi status review, tetapi pengguna tetap dapat melanjutkan atau mengulang kuis yang sama.
6. Gunakan asisten untuk bertanya tentang materi, kuis, ritme belajar, atau menyesuaikan plan. Pergantian target harus dinyatakan secara eksplisit.

Setelah aktivitas dimulai, workspace berfokus pada sesi aktif. Dokumen rencana lengkap tetap tersedia sebagai referensi. Seluruh state belajar dipulihkan setelah refresh selama localStorage browser masih tersedia.

## Endpoint API

| Endpoint | Fungsi |
| --- | --- |
| `GET /api/health` | Memastikan server API berjalan. |
| `POST /api/chat` | Membuat plan, melakukan adjustment, atau menjawab pertanyaan terkait profile. |
| `POST /api/learning/sessions` | Menghasilkan sesi belajar terstruktur dari plan Markdown. |
| `POST /api/learning/quiz` | Menghasilkan kuis lima soal untuk sesi yang dipilih. |

Contoh pemeriksaan health:

```bash
curl http://localhost:3000/api/health
```

```json
{
  "success": true,
  "message": "StudyMate AI API is running"
}
```

Respons API yang gagal menggunakan kontrak aman `success: false` dengan kode error seperti `INVALID_REQUEST`, `RATE_LIMITED`, atau `AI_SERVICE_ERROR`. Detail provider dan stack trace tidak dikirim ke client.

## Penyimpanan dan keamanan

- `GEMINI_API_KEY` dan `GEMINI_MODEL` hanya dibaca server dari `server/.env`.
- `server/.env` tidak boleh di-commit. Repository hanya menyertakan `server/.env.example` dengan placeholder.
- Daily Firestore limit dinonaktifkan pada environment example lokal. Aktifkan `AI_DAILY_LIMIT=100` hanya setelah Firestore/ADC tersedia, seperti pada Cloud Run.
- Markdown dari AI disanitasi tepat sebelum ditampilkan untuk mencegah HTML atau JavaScript berbahaya dieksekusi.
- localStorage rusak atau tidak valid dipulihkan ke empty state yang aman tanpa crash.
- **Clear Plan** menghapus profile, plan, percakapan, sesi, kuis, serta progress dari browser.
- Aplikasi ini tidak menyediakan login, database, kalender, notifikasi, upload materi, atau ujian terproteksi.

## Struktur proyek

```text
client/              Vue SPA (Vite)
  src/components/    Komponen profile, workspace, asisten, sesi, dan kuis
  src/composables/   State plan dan progress belajar
  src/services/      Klien API frontend
  src/utils/         Validasi dan keamanan Markdown
server/              Express API
  src/routes/        Endpoint chat dan learning
  src/validators/    Validasi request
  src/services/      Integrasi Gemini untuk plan, sesi, dan kuis
  src/prompts/       System instruction AI
  src/middleware/    Error contract aman
```

## Troubleshooting

- **Gemini gagal atau timeout:** periksa API key, nama model, kuota, dan akses provider; request yang gagal dapat dicoba ulang dari UI.
- **Plan atau progress tidak muncul setelah refresh:** periksa apakah browser mengizinkan localStorage untuk origin lokal. Menghapus data situs akan menghapus state belajar.
- **Perubahan `.env` tidak terbaca:** hentikan proses `npm run dev`, lalu jalankan kembali agar backend memuat environment terbaru.
- **Health endpoint gagal:** pastikan backend berjalan di port yang sesuai `PORT` pada `server/.env`.

## Deployment: Vercel dan Google Cloud Run

### Backend Cloud Run

1. Buat project Google Cloud, aktifkan Cloud Run, Cloud Build, Artifact Registry, dan Firestore API.
2. Buat Firestore Native di region `asia-southeast2`.
3. Buat service account khusus Cloud Run dan berikan role `Cloud Datastore User` (`roles/datastore.user`). Firestore hanya menyimpan counter harian, bukan data pengguna.
4. Deploy repository menggunakan `Dockerfile` dengan konfigurasi berikut:

   - Region: `asia-southeast2`
   - CPU: 1
   - Memory: 512 MiB
   - Minimum instances: 0
   - Maximum instances: 1
   - Concurrency: 20
   - Request timeout: 60 detik
   - Authentication: allow unauthenticated

5. Tambahkan environment variable Cloud Run tanpa memasukkan nilainya ke GitHub:

   ```text
   GEMINI_API_KEY
   GEMINI_MODEL
   ALLOWED_ORIGINS=https://nama-project.vercel.app
   AI_DAILY_LIMIT=100
   AI_HOURLY_IP_LIMIT=20
   APP_TIMEZONE=Asia/Jakarta
   ```

6. Pastikan `GET https://URL-CLOUD-RUN/api/health` mengembalikan HTTP 200.

### Frontend Vercel

1. Import repository GitHub ke Vercel. Konfigurasi build sudah tersedia pada `vercel.json`.
2. Tambahkan `VITE_API_BASE_URL=https://URL-CLOUD-RUN` pada Environment Variables Vercel.
3. Deploy production dan salin URL production ke `ALLOWED_ORIGINS` Cloud Run, lalu deploy ulang backend.

### Perlindungan biaya

- Setiap request valid ke chat, session generation, atau quiz generation memakai satu kuota AI.
- Limit global adalah 100 request AI per hari dan disimpan secara atomik di Firestore dengan reset zona waktu `Asia/Jakarta`.
- Limit burst per IP adalah 20 request AI per jam.
- Saat limit tercapai, backend mengembalikan HTTP 429 tanpa memanggil Gemini.
- Buat Cloud Billing budget sebesar USD 1 dengan notifikasi pada 50%, 90%, dan 100%. Budget alert tidak otomatis menghentikan service; limit aplikasi adalah pengaman utama.

## Batasan

StudyMate AI adalah alat bantu belajar mandiri. Nilai kuis dan progress merupakan indikator pembelajaran, bukan sertifikat atau evaluasi akademik resmi.
