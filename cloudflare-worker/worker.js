/**
 * Cloudflare Worker — Telegram Webhook for Booking Approval
 * 
 * Alur:
 *   Telegram kirim POST ke worker ini setiap ada pesan masuk ke bot.
 *   Worker cek apakah pesan adalah REPLY dari admin ke notifikasi booking.
 *   Jika ya, cari booking di Firestore berdasarkan telegramMsgId, lalu set status = "Approved".
 * 
 * Environment Variables (set di Cloudflare Dashboard > Workers > Settings > Variables):
 *   TELEGRAM_BOT_TOKEN  — token dari @BotFather
 *   TELEGRAM_CHAT_ID    — Chat ID admin (yang berhak approve)
 *   FIREBASE_API_KEY    — apiKey dari firebase-config.js
 *   FIREBASE_PROJECT_ID — projectId dari firebase-config.js
 */

export default {
  async fetch(request, env) {
    // Cloudflare Workers hanya terima POST dari Telegram
    if (request.method !== "POST") {
      return new Response("OK", { status: 200 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    const msg = body?.message;

    // Abaikan jika bukan pesan reply
    if (!msg?.reply_to_message) {
      return new Response("OK", { status: 200 });
    }

    // Pastikan pesan dari chat admin yang diizinkan
    if (String(msg.chat.id) !== String(env.TELEGRAM_CHAT_ID)) {
      return new Response("OK", { status: 200 });
    }

    const replyToMsgId = msg.reply_to_message.message_id;
    console.log(`Reply diterima untuk message_id: ${replyToMsgId}`);

    // ── Cari booking di Firestore via REST API ──
    const firestoreBase = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;

    // Query: bookings where telegramMsgId == replyToMsgId
    // Firebase JS SDK menyimpan number sebagai integerValue di Firestore
    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: "bookings" }],
        where: {
          compositeFilter: {
            op: "OR",
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: "telegramMsgId" },
                  op: "EQUAL",
                  value: { integerValue: String(replyToMsgId) }
                }
              },
              {
                fieldFilter: {
                  field: { fieldPath: "telegramMsgId" },
                  op: "EQUAL",
                  value: { stringValue: String(replyToMsgId) }
                }
              }
            ]
          }
        },
        limit: 1
      }
    };

    const queryRes = await fetch(
      `${firestoreBase}:runQuery?key=${env.FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queryBody)
      }
    );

    const queryData = await queryRes.json();
    console.log("Query result:", JSON.stringify(queryData?.[0]));

    // Firestore runQuery returns array; first element has .document if found
    const found = queryData?.[0]?.document;
    if (!found) {
      console.log("Tidak ada booking yang cocok dengan telegramMsgId:", replyToMsgId);
      return new Response("OK", { status: 200 });
    }

    // Cek status di JS (lebih aman daripada filter Firestore composite)
    const currentStatus = found.fields?.status?.stringValue;
    if (currentStatus !== "Pending") {
      console.log(`Booking ditemukan tapi status sudah: ${currentStatus}`);
      return new Response("OK", { status: 200 });
    }

    // Ambil document path (format: projects/.../databases/.../documents/bookings/DOC_ID)
    const docPath = found.name;
    const bookingId = docPath.split("/").pop();
    const judul   = found.fields?.judul?.stringValue   || "-";
    const bidang  = found.fields?.bidang?.stringValue  || "-";
    const tanggal = found.fields?.tanggal?.stringValue || "-";

    // ── Update status → Approved ──
    // Jika ada kredensial admin, login dulu untuk dapat token
    let authHeader = {};
    if (env.FIREBASE_ADMIN_EMAIL && env.FIREBASE_ADMIN_PASSWORD) {
      const authRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: env.FIREBASE_ADMIN_EMAIL,
            password: env.FIREBASE_ADMIN_PASSWORD,
            returnSecureToken: true
          })
        }
      );
      const authData = await authRes.json();
      if (authData.idToken) {
        authHeader = { "Authorization": `Bearer ${authData.idToken}` };
      } else {
        console.warn("Login Firebase gagal, coba tanpa auth:", JSON.stringify(authData));
      }
    }

    const patchRes = await fetch(
      `${firestoreBase}/bookings/${bookingId}?updateMask.fieldPaths=status&key=${env.FIREBASE_API_KEY}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          fields: { status: { stringValue: "Approved" } }
        })
      }
    );

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      console.error("Gagal update Firestore:", errText);
      return new Response("Firestore Error", { status: 500 });
    }

    console.log(`Booking ${bookingId} berhasil di-Approve!`);

    // ── Kirim konfirmasi balik ke Telegram ──
    await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text:
            `✅ <b>Booking Disetujui!</b>\n` +
            `📝 <b>${judul}</b>\n` +
            `📌 ${bidang} — ${tanggal}`,
          parse_mode: "HTML"
        })
      }
    );

    return new Response("OK", { status: 200 });
  }
};
