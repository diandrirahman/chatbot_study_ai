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
- Persistence pengguna: localStorage browser. Upstash Redis hanya menyimpan counter kuota AI dan tidak menyimpan data pengguna.

```text
Browser Vue SPA (Vercel)
  |-- Study Profile, plan, roadmap, sesi, kuis, progress
  |-- localStorage
  `-- HTTPS --> Express API (Render)
                  |-- validator, limiter, dan error handler
                  |-- Upstash Redis: counter kuota AI
                  `-- Gemini: plan, sesi, dan kuis
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
- Daily Upstash limit dinonaktifkan pada environment example lokal. Aktifkan `AI_DAILY_LIMIT=100` hanya setelah kredensial Upstash tersedia.
- Markdown dari AI disanitasi tepat sebelum ditampilkan untuk mencegah HTML atau JavaScript berbahaya dieksekusi.
- localStorage rusak atau tidak valid dipulihkan ke empty state yang aman tanpa crash.
- **Clear Plan** menghapus profile, plan, percakapan, sesi, kuis, serta progress dari browser.
- Aplikasi ini tidak menyediakan login, database data pengguna, kalender, notifikasi, upload materi, atau ujian terproteksi.

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
- **Render sedang bangun:** tunggu status “Menyiapkan StudyMate AI” selesai. Frontend menunggu health hingga sekitar 90 detik dan menyediakan retry tanpa menghapus input.
- **Semua request AI mendapat `AI_SERVICE_ERROR`:** pastikan REST URL dan REST token Upstash benar. Saat counter tidak tersedia, backend sengaja menolak request sebelum Gemini dipanggil.
- **Cron gagal setelah backend lama idle:** request pertama dapat melewati timeout ketika membangunkan Render Free. Periksa bahwa eksekusi berikutnya kembali menerima HTTP 200.

## Deployment: Vercel dan Render

### 1. Counter Upstash Redis

1. Buat database Redis pada Upstash dan pilih region yang dekat dengan Singapore.
2. Salin REST URL dan REST token ke tempat penyimpanan secret. Jangan memasukkannya ke GitHub atau frontend.
3. Upstash hanya dipakai untuk counter global harian. Profile, percakapan, plan, sessions, dan quiz tetap berada di browser pengguna.

### 2. Backend Render

1. Hubungkan repository GitHub ke Render sebagai **Blueprint** menggunakan `render.yaml`, atau buat satu Web Service dengan konfigurasi ekuivalen.
2. Gunakan branch `main`, runtime Node, plan Free, dan region Singapore.
3. Isi secret yang ditandai `sync: false` pada dashboard Render:

   ```text
   GEMINI_API_KEY=<secret>
   ALLOWED_ORIGINS=https://nama-project.vercel.app
   UPSTASH_REDIS_REST_URL=<secret>
   UPSTASH_REDIS_REST_TOKEN=<secret>
   ```

4. Pastikan environment non-secret berikut tersedia:

   ```text
   GEMINI_MODEL=gemini-3.5-flash-lite
   AI_DAILY_LIMIT=100
   AI_HOURLY_IP_LIMIT=20
   APP_TIMEZONE=Asia/Jakarta
   NODE_ENV=production
   ```

5. Deploy lalu pastikan `GET https://URL-RENDER/api/health` mengembalikan HTTP 200 dan body kontrak health yang terdokumentasi.

### 3. Frontend Vercel

1. Import repository GitHub ke Vercel. Konfigurasi build sudah tersedia pada `vercel.json`.
2. Tambahkan `VITE_API_BASE_URL=https://URL-RENDER` pada Environment Variables Vercel.
3. Deploy production dan salin URL production ke `ALLOWED_ORIGINS` Render, lalu deploy ulang backend bila origin berubah.

Frontend langsung memanggil health endpoint ketika halaman dibuka. Form tetap dapat diisi selama Render bangun dari kondisi idle, dan request AI menunggu backend siap tanpa mengirim submit ganda.

### 4. Keep-alive best-effort

1. Buat akun di [cron-job.org](https://cron-job.org/).
2. Tambahkan HTTP GET ke `https://URL-RENDER/api/health` dengan interval setiap 10 menit.
3. Aktifkan notifikasi kegagalan dan pastikan execution history menerima HTTP 200.
4. Jangan arahkan cron ke endpoint chat, sessions, atau quiz karena endpoint tersebut memakai kuota AI.

Render Free dapat tidur atau direstart sewaktu-waktu. Monitor mengurangi kemungkinan cold start, tetapi bukan pengganti SLA instance berbayar. Jika cron pertama membangunkan service dan melewati timeout monitor, request berikutnya seharusnya berhasil setelah service aktif.

### Perlindungan biaya

- Setiap request valid ke chat, session generation, atau quiz generation memakai satu kuota AI.
- Limit global adalah 100 request AI per hari dan disimpan secara atomik di Upstash Redis dengan reset zona waktu `Asia/Jakarta`.
- Limit burst per IP adalah 20 request AI per jam.
- Saat limit tercapai, backend mengembalikan HTTP 429 tanpa memanggil Gemini.
- Health check dan payload invalid tidak memakai kuota. Provider failure tetap memakai satu kuota karena request sudah diizinkan untuk mencapai Gemini.

## Batasan

StudyMate AI adalah alat bantu belajar mandiri. Nilai kuis dan progress merupakan indikator pembelajaran, bukan sertifikat atau evaluasi akademik resmi.
