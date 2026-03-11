// js/app.js (Publik) — Tailwind-ready (UI dinamis sudah diganti ke Tailwind)
import { collection, addDoc, query, orderBy, onSnapshot, where, getDocs } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { $, tailwindAlertHTML, toMinutes, isOverlap, isWithinWorkingHours, formatTanggalID, formatJam, paginate } from "./utils.js";


// ====== Elemen ======

const bookingForm = $("#bookingForm");
const formAlert = $("#formAlert");
const tbody = $("#tbody");
const countInfo = $("#countInfo");
const pager = $("#pagination");

// 👉 SET nomor WA admin (format internasional tanpa “+”)
const ADMIN_WHATSAPP = "6282385752398"; // ganti nomor admin

// ====== Helpers (UI Tailwind) ======

function showAlert(type, msg) {
  formAlert.id = "formAlert";
  formAlert.innerHTML = tailwindAlertHTML(type, msg, "formAlert");
}

function parseLocalDate(yyyy_mm_dd) { const [y, m, d] = yyyy_mm_dd.split("-").map(Number); return new Date(y, m - 1, d); }
function diffDaysFromToday(yyyy_mm_dd) {
  const t = new Date(); const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  const target = parseLocalDate(yyyy_mm_dd);
  return Math.round((target - today) / (1000 * 60 * 60 * 24)); // 1=H-1, 0=H
}
function waButtonIfNeeded(item) {
  const dd = diffDaysFromToday(item.tanggal); // 1 = H-1, 0 = H
  const shouldShow = (dd === 1 || dd === 0) && item.status === "Approved";
  if (!shouldShow) return "";
  const msg = encodeURIComponent(
    `Halo Admin, mohon persiapan ruang rapat:\n` +
    `Tanggal: ${formatTanggalID(item.tanggal)}\n` +
    `Jam: ${formatJam(item.jamMulai, item.jamSelesai)}\n` +
    `Ruang: ${item.ruang}\n` +
    `Judul: ${item.judul}\n` +
    `Bidang: ${item.bidang}`
  );
  return `<a class="inline-flex items-center rounded-md bg-emerald-600 text-white px-2.5 py-1 text-sm hover:bg-emerald-700"
            target="_blank" rel="noopener" href="https://wa.me/${ADMIN_WHATSAPP}?text=${msg}">Hubungi Admin</a>`;
}
function buildSortKey(yyyy_mm_dd, hhmm) { return yyyy_mm_dd.replaceAll('-', '') + (hhmm ?? '0000'); }


// ====== Filter UI (Tailwind) ======
let filterMonth = ""; // "01".."12" atau ""
let filterYear = ""; // "2025" atau ""
let filterTitle = ""; // substring judul
let filterBidang = ""; // exact bidang atau ""

function twSelectBase() { return "w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"; }
function twInputBase() { return "w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"; }
function twBtnOutline() { return "rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50"; }
function buildFiltersBar() {
  if (document.getElementById("filtersBar")) return;
  const card = document.createElement("div");
  card.id = "filtersBar";
  card.className = "bg-white rounded-xl shadow border border-gray-100 mb-3";
  card.innerHTML = `
    <div class="px-4 py-4 overflow-x-auto">
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3 items-end">
        <div>
          <label class="block text-sm font-medium mb-1">Bulan</label>
          <select id="fMonth" class="${twSelectBase()}">
            <option value="">Semua</option>
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => {
    const v = String(n).padStart(2, "0");
    const label = new Date(2020, n - 1, 1).toLocaleString("id-ID", { month: "long" });
    return `<option value="${v}">${label}</option>`;
  }).join("")}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Tahun</label>
          <select id="fYear" class="${twSelectBase()}">
            <option value="">Semua</option>
          </select>
        </div>
        <div class="md:col-span-3">
          <label class="block text-sm font-medium mb-1">Judul Rapat</label>
          <input id="fTitle" class="${twInputBase()}" placeholder="Cari judul..."/>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Bidang</label>
          <select id="fBidang" class="${twSelectBase()}">
            <option value="">Semua</option>
          </select>
        </div>
        <div class="md:col-span-1">
          <button id="fClear" class="${twBtnOutline()} w-full">Reset</button>
        </div>
      </div>
    </div>
  `;
  // sisipkan sebelum card daftar booking (tepat sebelum tabel)
  const listCard = tbody?.closest(".bg-white.rounded-xl.shadow.border") || tbody?.closest(".card") || document.body;
  listCard.parentElement.insertBefore(card, listCard);

  // events
  card.querySelector("#fMonth").addEventListener("change", (e) => { filterMonth = e.target.value; currentPage = 1; render(); });
  card.querySelector("#fYear").addEventListener("change", (e) => { filterYear = e.target.value; currentPage = 1; render(); });
  card.querySelector("#fTitle").addEventListener("input", (e) => { filterTitle = e.target.value.trim().toLowerCase(); currentPage = 1; render(); });
  card.querySelector("#fBidang").addEventListener("change", (e) => { filterBidang = e.target.value; currentPage = 1; render(); });
  card.querySelector("#fClear").addEventListener("click", () => {
    filterMonth = ""; filterYear = ""; filterTitle = ""; filterBidang = "";
    card.querySelector("#fMonth").value = "";
    card.querySelector("#fYear").value = "";
    card.querySelector("#fTitle").value = "";
    card.querySelector("#fBidang").value = "";
    currentPage = 1; render();
  });
}

function refreshFilterOptionsFromData(rows) {
  // isi opsi tahun & bidang berdasarkan data
  const years = Array.from(new Set(rows.map(r => r.tanggal?.slice(0, 4)).filter(Boolean))).sort().reverse();
  const bidangs = Array.from(new Set(rows.map(r => r.bidang).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'id'));

  const yearSel = document.getElementById("fYear");
  const bidangSel = document.getElementById("fBidang");
  if (yearSel) {
    const keep = yearSel.value;
    yearSel.innerHTML = `<option value="">Semua</option>` + years.map(y => `<option value="${y}">${y}</option>`).join("");
    if (years.includes(keep)) yearSel.value = keep;
  }
  if (bidangSel) {
    const keep = bidangSel.value;
    bidangSel.innerHTML = `<option value="">Semua</option>` + bidangs.map(b => `<option value="${b}">${b}</option>`).join("");
    if (bidangs.includes(keep)) bidangSel.value = keep;
  }
}

function matchFilters(item) {
  const y = item.tanggal?.slice(0, 4) || "";
  const m = item.tanggal?.slice(5, 7) || "";
  if (filterYear && y !== filterYear) return false;
  if (filterMonth && m !== filterMonth) return false;
  if (filterTitle) {
    const hay = (item.judul || "").toLowerCase();
    if (!hay.includes(filterTitle)) return false;
  }
  if (filterBidang && item.bidang !== filterBidang) return false;
  return true;
}

// ====== State & Pagination ======
let allRows = [];
let currentPage = 1;
const PAGE_SIZE = 5;

function badgeStatusTailwind(status) {
  const map = {
    Approved: "bg-green-100 text-green-800 border-green-200",
    Canceled: "bg-red-100 text-red-800 border-red-200",
    Pending: "bg-amber-100 text-amber-800 border-amber-200"
  };
  return `<span class="inline-block rounded-full border px-2.5 py-1 text-xs font-medium ${map[status] || map.Pending}">${status}</span>`;
}

function render() {
  const filtered = allRows.filter(matchFilters);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  countInfo.textContent = `Jumlah Booking Ruang Rapat: ${filtered.length}`;
  const pageRows = paginate(filtered, PAGE_SIZE, currentPage);

  tbody.innerHTML = pageRows.map(item => `
    <tr>
      <td class="align-middle">${formatTanggalID(item.tanggal)}</td>
      <td class="align-middle">${formatJam(item.jamMulai, item.jamSelesai)}</td>
      <td class="align-middle">${item.ruang}</td>
      <td class="align-middle">${item.judul}</td>
      <td class="align-middle">${item.bidang}</td>
      <td class="align-middle">${badgeStatusTailwind(item.status)}</td>
      <td class="align-middle">${waButtonIfNeeded(item) || '<span class="text-gray-400">—</span>'}</td>
    </tr>
  `).join("");

  pager.innerHTML = `
    <button class="rounded-md border border-gray-300 px-2.5 py-1 text-sm hover:bg-gray-50 mr-2" ${currentPage <= 1 ? "disabled" : ""} data-page="${currentPage - 1}">Prev</button>
    <span class="text-sm">Halaman ${currentPage} / ${totalPages}</span>
    <button class="rounded-md border border-gray-300 px-2.5 py-1 text-sm hover:bg-gray-50 ml-2" ${currentPage >= totalPages ? "disabled" : ""} data-page="${currentPage + 1}">Next</button>
  `;
}
pager.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-page]");
  if (!btn) return;
  currentPage = Number(btn.dataset.page);
  render();
});

// ====== Realtime (DESC: terbaru di atas) ======
buildFiltersBar();
const q = query(collection(db, "bookings"), orderBy("sortKey", "desc"));
onSnapshot(q, async (snap) => {
  allRows = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Auto-Approve Check
  // Jika masih Pending padahal rapatnya adalah untuk besok atau setelahnya, otomatis ubah db
  for (const row of allRows) {
    if (row.status === "Pending" && diffDaysFromToday(row.tanggal) >= 1) {
      try {
        const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js");
        await updateDoc(doc(db, "bookings", row.id), { status: "Approved" });
        row.status = "Approved"; // Update lokal selagi nunggu trigger onSnapshot berikutnya
      } catch (e) {
        console.error("Gagal auto-approve:", e);
      }
    }
  }

  refreshFilterOptionsFromData(allRows);
  render();
});

// ====== Submit Booking ======
bookingForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const ruang = $("#ruang").value;
  const bidang = $("#bidang").value;
  const judul = $("#judul").value.trim();
  const tanggal = $("#tanggal").value;
  const jamMulai = $("#jamMulai").value.replace(":", "");
  const jamSelesai = $("#jamSelesai").value.replace(":", "");

  if (!ruang || !bidang || !judul || !tanggal || !jamMulai || !jamSelesai) {
    showAlert("warning", "Mohon lengkapi semua field!");
    return;
  }
  if (jamSelesai <= jamMulai) {
    showAlert("warning", "Jam selesai harus lebih besar dari jam mulai!");
    return;
  }
  if (!isWithinWorkingHours(tanggal, jamMulai, jamSelesai)) {
    showAlert("warning", "Di luar jam kerja. Sen–Kam 07.30–16.00, Jum’at 07.30–16.30.");
    return;
  }

  // cek bentrok (ruang & tanggal sama)
  try {
    const qCheck = query(collection(db, "bookings"), where("tanggal", "==", tanggal), where("ruang", "==", ruang));
    const snap = await getDocs(qCheck);
    const nS = toMinutes(jamMulai), nE = toMinutes(jamSelesai);
    for (const d of snap.docs) {
      const x = d.data();
      if (x.status === "Canceled") continue;
      const s = toMinutes(x.jamMulai), e2 = toMinutes(x.jamSelesai);
      if (isOverlap(nS, nE, s, e2)) {
        const msg = `Jadwal Bentrok dengan <em>${x.judul} (${formatTanggalID(x.tanggal)} | ${formatJam(x.jamMulai, x.jamSelesai)})</em>, silahkan Hubungi Admin`;
        showAlert("danger", msg);
        return;
      }
    }
  } catch (err) {
    console.error(err);
    showAlert("danger", "Gagal memeriksa bentrok jadwal.");
    return;
  }

  // simpan
  try {
    await addDoc(collection(db, "bookings"), {
      ruang, bidang, judul, tanggal, jamMulai, jamSelesai,
      status: "Pending",
      sortKey: buildSortKey(tanggal, jamMulai)
    });
    bookingForm.reset();
    showAlert("success", "Booking tersimpan");

    // Kirim notifikasi email ke Admin via EmailJS
    try {
      // Data template yang akan digantikan ke {{variabel}} di EmailJS Template
      const templateParams = {
        admin_email: "ferrykurniawanpublic@gmail.com", // Ganti dengan email asli admin
        nama_bidang: bidang,
        judul_rapat: judul,
        ruang_rapat: ruang,
        tanggal_rapat: formatTanggalID(tanggal),
        jam_rapat: formatJam(jamMulai, jamSelesai)
      };

      // Parameter: service_id, template_id, template_params
      await emailjs.send('service_ano4foj', 'template_2ldamix', templateParams);
      console.log("Email notifikasi berhasil dikirim ke Admin!");
    } catch (emailErr) {
      console.error("Gagal mengirim email notifikasi EmailJS:", emailErr);
      // Opsional: munculkan pesan jika email spesifik gagal, tapi data sudah masuk db.
      // showAlert("warning", "Booking tersimpan, tetapi gagal mengirim email ke Admin.");
    }

  } catch (err) {
    console.error(err);
    showAlert("danger", "Gagal menyimpan booking.");
  }
});
