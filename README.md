# Panduan Instalasi & Penggunaan PrintOps SaaS

PrintOps adalah sistem pemantauan printer real-time yang dirancang untuk bisnis percetakan. Sistem ini terdiri dari tiga komponen utama: **Backend Cloud**, **Dashboard Frontend**, dan **Local Agent**.

## 🏗️ Arsitektur Sistem

1.  **Local Agent (Node.js)**: Berjalan di komputer dalam jaringan lokal (LAN) yang sama dengan printer. Agent ini mengambil data langsung dari printer via IP dan mengirimkannya ke Cloud.
2.  **Backend (Express + Firebase)**: Menerima data dari Agent, menyimpannya di database, dan menyediakan API untuk Dashboard.
3.  **Frontend (React)**: Dashboard visual untuk memantau status, tinta, dan riwayat produksi.

---

## 🚀 Langkah Instalasi

### 1. Persiapan Backend & Database
Aplikasi ini menggunakan **Firebase** sebagai database.
*   Pastikan file `firebase-applet-config.json` sudah terisi dengan konfigurasi Firebase Anda (API Key, Project ID, dll).
*   Deploy aturan keamanan Firestore menggunakan file `firestore.rules` yang tersedia.

### 2. Menjalankan Server Utama (Backend & Frontend)
Di lingkungan pengembangan ini, server berjalan otomatis. Jika Anda ingin menjalankan di server sendiri:
```bash
# Install dependensi
npm install

# Jalankan server
npm run dev
```
Aplikasi akan tersedia di `http://localhost:3000`.

### 3. Instalasi Local Agent (PENTING)
Agent harus diinstal di komputer yang terhubung ke jaringan printer (LAN).

1.  Salin file `agent.ts` dan `package.json` ke komputer lokal.
2.  Pastikan Node.js sudah terinstal.
3.  Buka terminal di folder tersebut dan jalankan:
    ```bash
    # Install dependensi yang dibutuhkan agent
    npm install axios cheerio typescript tsx

    # Konfigurasi URL Backend (Ganti dengan URL aplikasi Anda)
    export APP_URL="https://url-aplikasi-anda.com"

    # Jalankan Agent
    npx tsx agent.ts
    ```

---

## 📖 Panduan Penggunaan

### 1. Menambah Mesin
Saat ini, daftar mesin dikonfigurasi di dalam file `agent.ts` pada variabel `PRINTERS`.
*   Buka `agent.ts`.
*   Tambahkan IP printer Anda (contoh: `192.168.1.201`).
*   Restart Agent.

### 2. Memantau Dashboard
*   **Fleet Overview**: Lihat status semua mesin (Running, Idle, Error).
*   **Indikator Tinta**: Jika level tinta < 20%, akan muncul ikon peringatan merah di kartu mesin.
*   **Real-time Alerts**: Notifikasi akan muncul otomatis di pojok kanan atas jika ada masalah.
*   **Last Seen**: Jika mesin "Last Seen" lebih dari 5 menit, teks akan berubah merah (menandakan Agent atau Printer offline).

### 3. Melihat Riwayat (Machine History)
*   Klik menu **Machine History** di sidebar.
*   Pilih mesin dari dropdown.
*   Anda dapat melihat log perubahan counter (jumlah cetak) dan status dari waktu ke waktu.
*   Kolom **Production** menunjukkan berapa banyak lembar yang dicetak di antara dua interval waktu.

### 4. Fitur Khusus SC170
Untuk mesin tipe Revoria SC170, dashboard akan menampilkan **Active Job Queue** yang menunjukkan antrean cetak yang sedang berjalan.

---

## 🚨 Troubleshooting
*   **Status Error Terus Menempel**: Pastikan IP printer di `agent.ts` benar dan komputer agent bisa melakukan `ping` ke IP tersebut.
*   **Data Tidak Muncul**: Pastikan `APP_URL` di konfigurasi Agent sudah mengarah ke URL backend yang benar.
*   **WebSocket Error**: Abaikan error WebSocket di konsol browser, itu adalah fitur HMR yang dinonaktifkan dan tidak mengganggu aplikasi.
