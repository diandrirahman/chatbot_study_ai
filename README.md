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
  `-- same origin --> Express API (Vercel Function)
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
- **API production tidak tersedia:** periksa deployment Vercel Functions dan environment production. Frontend menyediakan retry tanpa menghapus input.
- **Semua request AI mendapat `AI_SERVICE_ERROR`:** pastikan REST URL dan REST token Upstash benar. Saat counter tidak tersedia, backend sengaja menolak request sebelum Gemini dipanggil.

## Perlindungan biaya

- Setiap request valid ke chat, session generation, atau quiz generation memakai satu kuota AI.
- Limit global adalah 100 request AI per hari dan disimpan secara atomik di Upstash Redis dengan reset zona waktu `Asia/Jakarta`.
- Limit burst per IP adalah 20 request AI per jam.
- Saat limit tercapai, backend mengembalikan HTTP 429 tanpa memanggil Gemini.
- Health check dan payload invalid tidak memakai kuota. Provider failure tetap memakai satu kuota karena request sudah diizinkan untuk mencapai Gemini.

## Batasan

StudyMate AI adalah alat bantu belajar mandiri. Nilai kuis dan progress merupakan indikator pembelajaran, bukan sertifikat atau evaluasi akademik resmi.
