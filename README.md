# StudyMate AI

MVP AI study planner dengan Vue 3 + Vite di frontend dan Express di backend. Aplikasi membuat dan menyesuaikan study plan melalui Gemini API, menyusun learning session dan quiz, memverifikasi progress, menyimpan state di localStorage, serta merender Markdown AI secara tersanitasi.

## Prasyarat

- Node.js 20 atau lebih baru
- npm 10 atau lebih baru

## Menjalankan proyek

1. Salin `server/.env.example` menjadi `server/.env`, lalu isi `GEMINI_API_KEY` dan `GEMINI_MODEL`. Model contoh adalah `gemini-3.5-flash-lite`.
2. Instal dependensi:

   ```bash
   npm install
   ```

3. Jalankan frontend dan backend bersamaan:

   ```bash
   npm run dev
   ```

Frontend tersedia pada `http://localhost:5173`; Vite meneruskan request `/api` ke Express pada `http://localhost:3000`.

## Pemeriksaan

```bash
npm run check
npm run test -w client
npm run test -w server
curl http://localhost:3000/api/health
```

Respons health endpoint:

```json
{
  "success": true,
  "message": "StudyMate AI API is running"
}
```

## Alur learning session

1. Isi Study Profile, lalu pilih **Generate study plan**.
2. Setelah plan Markdown selesai, halaman menampilkan overview berupa target, jadwal, roadmap sesi, milestone, dan dokumen rencana lengkap. Backend kemudian menyusun learning sessions sesuai hari dan waktu belajar pada profile.
3. Pilih sesi dari roadmap atau mulai sesi yang disarankan. Workspace kemudian berfokus pada materi, praktik, quiz, hasil, dan referensi sesi aktif; dokumen rencana lengkap tetap dapat dibuka kembali sebagai referensi.
4. Jawab seluruh lima soal sebelum submit. Nilai terbaik minimal 70% menandai mastery; nilai di bawahnya memberi status **Needs Review** tanpa mengurangi completion.
5. Setelah hasil quiz, lanjutkan langsung ke sesi berikutnya atau ulangi quiz yang sama. Seluruh sesi juga dapat dibuka bebas dari roadmap kurikulum tanpa menunggu jadwal.
6. Pada sesi terakhir, kembali ke ringkasan kemajuan untuk melihat completion dan mastery. Sessions, checklist, quiz, attempts, mode workspace, serta sesi aktif dipulihkan setelah refresh. Label workspace mengikuti bahasa plan yang dipilih.

Endpoint yang tersedia:

- `GET /api/health`
- `POST /api/chat`
- `POST /api/learning/sessions`
- `POST /api/learning/quiz`

## Struktur

```text
client/              Vue SPA (Vite)
  src/
    App.vue          Root view
    styles/          Shared plain CSS
server/              Express API
  src/
    app.js           App dan route registration
    routes/          Chat dan learning endpoints
    validators/      Validasi request API
    services/        Gemini chat, session, dan quiz services
    index.js         Bootstrap server
docs/                Product requirements
```

## Catatan dan troubleshooting

- `GEMINI_API_KEY` dan `GEMINI_MODEL` hanya digunakan backend. Jangan membuat atau menggunakan `VITE_GEMINI_API_KEY`.
- Setelah mengubah `server/.env`, hentikan lalu jalankan kembali `npm run dev` agar konfigurasi backend dimuat ulang.
- Jika Gemini menampilkan error, pastikan key, nama model, akses API, dan kuota provider tersedia. Input pengguna tetap dapat di-retry.
- Profile, history, sessions, checklist progress, quiz, dan attempts disimpan hanya di localStorage browser.
- **Clear Plan** menghapus seluruh profile, plan, conversation, dan learning state dari browser sehingga pengguna memulai dari nol.
- Cache quiz dibatasi agar localStorage tidak terus bertambah; attempts dan skor terbaik tetap dipertahankan selama plan belum dihapus.
- Bila PowerShell memblokir `npm.ps1`, jalankan perintah yang sama menggunakan `npm.cmd`.
