# Panduan Setup Cloudflare Worker — Telegram Approve Booking

## Yang Dibutuhkan
- Akun Cloudflare (gratis): https://dash.cloudflare.com/sign-up
- Node.js sudah terinstall

---
  
## Langkah 1 — Install Wrangler CLI

Buka terminal di folder `cloudflare-worker/`:

```bash
npm install -g wrangler
wrangler login
```

Browser akan terbuka untuk login ke akun Cloudflare.

---

## Langkah 2 — Deploy Worker

```bash
cd cloudflare-worker
wrangler deploy
```

Setelah berhasil, kamu akan dapat URL seperti:
```
https://rapattt-telegram-webhook.<username>.workers.dev
```

Catat URL ini, dipakai di Langkah 4.

---

## Langkah 3 — Set Environment Variables

Buka **Cloudflare Dashboard** → **Workers & Pages** → pilih `rapattt-telegram-webhook` → **Settings** → **Variables**.

Tambahkan 4 variabel berikut (klik "Add variable", lalu "Encrypt" untuk yang sensitif):

| Variable Name        | Value                                      |
|----------------------|--------------------------------------------|
| `TELEGRAM_BOT_TOKEN` | `8474317488:AAHDMpznNa4eFjiNmSEC1oM1oYjQB7GnZq4` |
| `TELEGRAM_CHAT_ID`   | `634857836`                                |
| `FIREBASE_API_KEY`   | `AIzaSyBxb0yvohCVn3XI7B9UC1Jtl2yLzNwa9TE` |
| `FIREBASE_PROJECT_ID`| `rapat-49334`                              |

Klik **Save and Deploy**.

---

## Langkah 4 — Daftarkan Webhook ke Telegram

Buka URL ini di browser (ganti `WORKER_URL` dengan URL dari Langkah 2):

```
https://api.telegram.org/bot8474317488:AAHDMpznNa4eFjiNmSEC1oM1oYjQB7GnZq4/setWebhook?url=https://rapattt-telegram-webhook.<username>.workers.dev
```

Harus muncul response:
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

---

## Cara Pakai (Setelah Setup Selesai)

1. User submit booking → notifikasi otomatis masuk ke Telegram kamu
2. **Balas (Reply) pesan notifikasi tersebut** dengan teks apapun (misalnya "ok", "acc", "disetujui")
3. Worker otomatis update status booking → **Approved** di Firestore
4. Bot mengirim konfirmasi balik ke Telegram kamu

> ⚠️ Yang boleh approve hanya Chat ID `634857836`. Reply dari orang lain diabaikan.

---

## Verifikasi Worker Berjalan

Cek log real-time:
```bash
wrangler tail
```
