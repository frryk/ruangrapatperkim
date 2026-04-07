// js/admin.js (Admin) — Tailwind-ready (UI dinamis sudah diganti ke Tailwind)
import { signInWithEmailAndPassword, onAuthStateChanged, setPersistence, browserLocalPersistence, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDoc, deleteDoc, where, getDocs, deleteField } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { app, auth, db } from "./firebase-config.js";
import { $, tailwindAlertHTML, toMinutes, isOverlap, isWithinWorkingHours, formatTanggalID, formatJam, paginate } from "./utils.js";


// === Whitelist Admin ===
const ALLOWED_ADMINS = ["frryk404@gmail.com"]; // tambah email lain bila perlu

// === Elemen ===
const loginCard = $("#loginCard");
const dashboard = $("#dashboard");
const adminEmail = $("#adminEmail");
const adminTbody = $("#adminTbody");
const adminCountInfo = $("#adminCountInfo");
const adminPagination = document.getElementById("adminPagination") || (() => {
  const div = document.createElement("div");
  div.id = "adminPagination";
  div.className = "m-3 text-center";
  adminTbody?.parentElement?.parentElement?.appendChild(div);
  return div;
})();

// Edit modal fields
const eRuang = $("#eRuang");
const eBidang = $("#eBidang");
const eJudul = $("#eJudul");
const eTanggal = $("#eTanggal");
const eJamMulai = $("#eJamMulai");
const eJamSelesai = $("#eJamSelesai");
const eStatus = $("#eStatus");
const editAlert = $("#editAlert");

let EDITING_ID = null;

// ===== Helpers (UI Tailwind) =====

function showLoginAlert(type, msg) {
  const box = document.getElementById("loginAlert");
  if (!box) return;
  box.id = "loginAlert"; // ensure id
  box.innerHTML = tailwindAlertHTML(type, msg, "loginAlert");
}
function showEditAlert(type, msg) {
  if (!editAlert) return;
  editAlert.id = "editAlert";
  editAlert.innerHTML = tailwindAlertHTML(type, msg, "editAlert");
}


// ===== Pagination (admin) =====
let adminAllRows = [];
let adminPage = 1;
const ADMIN_PAGE_SIZE = 10;

// ===== Filter UI (Tailwind) =====
let aFilterMonth = "";
let aFilterYear = "";
let aFilterTitle = "";
let aFilterBidang = "";
let aFilterStatus = ""; // "", "Approved", "Pending", "Canceled"

function twSelectBase() { return "w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"; }
function twInputBase() { return "w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"; }
function twBtnGhost() { return "rounded-lg border px-4 py-2 hover:bg-gray-50"; }
function twBtnPrimary() { return "rounded-lg bg-blue-600 text-white px-4 py-2 hover:bg-blue-700"; }
function twBtnOutline() { return "rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50"; }
function twBtnSmallOutline() { return "rounded-md border border-gray-300 px-2.5 py-1 text-sm hover:bg-gray-50"; }
function twBadge(color) {
  const colors = {
    green: "bg-green-100 text-green-800 border-green-200",
    red: "bg-red-100 text-red-800 border-red-200",
    amber: "bg-amber-100 text-amber-800 border-amber-200"
  };
  return `inline-block rounded-full border px-2.5 py-1 text-xs font-medium ${colors[color]}`;
}

function buildAdminFiltersBar() {
  if (document.getElementById("adminFiltersBar")) return;
  const bar = document.createElement("div");
  bar.id = "adminFiltersBar";
  bar.className = "bg-white rounded-xl shadow border border-gray-100 my-3";
  bar.innerHTML = `
    <div class="px-4 py-4">
      <div class="grid grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <div>
          <label class="block text-sm font-medium mb-1">Bulan</label>
          <select id="afMonth" class="${twSelectBase()}">
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
          <select id="afYear" class="${twSelectBase()}">
            <option value="">Semua</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Judul Rapat</label>
          <input id="afTitle" class="${twInputBase()}" placeholder="Cari judul..."/>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Bidang</label>
          <select id="afBidang" class="${twSelectBase()}">
            <option value="">Semua</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Status</label>
          <select id="afStatus" class="${twSelectBase()}">
            <option value="">Semua</option>
            <option value="Approved">Approved</option>
            <option value="Pending">Pending</option>
            <option value="Canceled">Canceled</option>
          </select>
        </div>
        <div>
          <button id="afClear" class="${twBtnOutline()} w-full">Reset Filter</button>
        </div>
      </div>
    </div>
  `;
  const tbl = adminTbody?.closest(".table-responsive") || dashboard;
  tbl.parentElement.insertBefore(bar, tbl);

  // events
  bar.querySelector("#afMonth").addEventListener("change", (e) => { aFilterMonth = e.target.value; adminPage = 1; renderRows(); });
  bar.querySelector("#afYear").addEventListener("change", (e) => { aFilterYear = e.target.value; adminPage = 1; renderRows(); });
  bar.querySelector("#afTitle").addEventListener("input", (e) => { aFilterTitle = e.target.value.trim().toLowerCase(); adminPage = 1; renderRows(); });
  bar.querySelector("#afBidang").addEventListener("change", (e) => { aFilterBidang = e.target.value; adminPage = 1; renderRows(); });
  bar.querySelector("#afStatus").addEventListener("change", (e) => { aFilterStatus = e.target.value; adminPage = 1; renderRows(); });
  bar.querySelector("#afClear").addEventListener("click", () => {
    aFilterMonth = ""; aFilterYear = ""; aFilterTitle = ""; aFilterBidang = ""; aFilterStatus = "";
    bar.querySelector("#afMonth").value = "";
    bar.querySelector("#afYear").value = "";
    bar.querySelector("#afTitle").value = "";
    bar.querySelector("#afBidang").value = "";
    bar.querySelector("#afStatus").value = "";
    adminPage = 1; renderRows();
  });

  // Export CSV (mengikuti filter aktif)
  const btnExport = document.getElementById("btnExport");
  if (btnExport) {
    btnExport.addEventListener("click", () => {
      const rows = getFilteredAdminRows();
      if (!rows || rows.length === 0) {
        alert("Tidak ada data (sesuai filter) untuk diexport.");
        return;
      }
      exportCSV(rows);
    });
  }
}
function refreshAdminFilterOptions(rows) {
  const years = Array.from(new Set(rows.map(r => r.tanggal?.slice(0, 4)).filter(Boolean))).sort().reverse();
  const bidangs = Array.from(new Set(rows.map(r => r.bidang).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'id'));
  const ySel = document.getElementById("afYear");
  const bSel = document.getElementById("afBidang");
  if (ySel) {
    const keep = ySel.value;
    ySel.innerHTML = `<option value="">Semua</option>` + years.map(y => `<option value="${y}">${y}</option>`).join("");
    if (years.includes(keep)) ySel.value = keep;
  }
  if (bSel) {
    const keep = bSel.value;
    bSel.innerHTML = `<option value="">Semua</option>` + bidangs.map(b => `<option value="${b}">${b}</option>`).join("");
    if (bidangs.includes(keep)) bSel.value = keep;
  }
}
function adminMatchFilters(item) {
  const y = item.tanggal?.slice(0, 4) || "";
  const m = item.tanggal?.slice(5, 7) || "";
  if (aFilterYear && y !== aFilterYear) return false;
  if (aFilterMonth && m !== aFilterMonth) return false;
  if (aFilterTitle) {
    const hay = (item.judul || "").toLowerCase();
    if (!hay.includes(aFilterTitle)) return false;
  }
  if (aFilterBidang && item.bidang !== aFilterBidang) return false;
  if (aFilterStatus && item.status !== aFilterStatus) return false;
  return true;
}
function getFilteredAdminRows() {
  return adminAllRows.filter(adminMatchFilters);
}

// ===== Export CSV =====
function csvEscape(val = "") {
  const s = String(val ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}
function download(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function exportCSV(rows) {
  const header = ["Tanggal", "Jam", "Judul", "Bidang"];
  const lines = [header.map(csvEscape).join(",")];
  rows.forEach(b => {
    lines.push([formatTanggalID(b.tanggal), formatJam(b.jamMulai, b.jamSelesai), b.judul || "", b.bidang || ""].map(csvEscape).join(","));
  });
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const fname = `bookings-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.csv`;
  download(fname, lines.join("\r\n"));
}

// ===== Render =====
function renderRows() {
  const filtered = getFilteredAdminRows ? getFilteredAdminRows() : adminAllRows;
  adminCountInfo.textContent = `${filtered.length} data`;

  const totalPages = Math.max(1, Math.ceil(filtered.length / ADMIN_PAGE_SIZE));
  if (adminPage > totalPages) adminPage = totalPages;
  const pageRows = paginate(filtered, ADMIN_PAGE_SIZE, adminPage);

  adminTbody.innerHTML = pageRows.map(item => {
    // Badge status Tailwind
    const statusBadge = `<span class="${twBadge(
      item.status === 'Approved' ? 'green' :
        item.status === 'Canceled' ? 'red' : 'amber'
    )}">${item.status}</span>`;

    // Tampilkan tombol Form Bukti HANYA jika Approved
    let formBuktiCell = `<span class="text-gray-400">—</span>`;
    if (item.status === "Approved") {
      if (item.buktiFoto || item.buktiFotoUrls || item.buktiAbsen) {
        let links = [];
        const fotoData = item.buktiFotoUrls || item.buktiFoto;
        if (fotoData) {
          const count = Array.isArray(fotoData) ? fotoData.length : 1;
          const name = count > 1 ? `${count} Foto Rapat` : (item.buktiFotoName || "Foto Rapat");
          const arg = Array.isArray(fotoData) ? `['${fotoData.join("','")}']` : `'${fotoData}'`;

          links.push(`
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="text-xs truncate max-w-[120px]" title="${name}">${name}</span>
              <button type="button" class="text-gray-500 hover:text-blue-600 transition p-1" onclick="window.openPreviewModal(${arg}, '${name}', false)" aria-label="Preview Foto">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              </button>
            </div>
          `);
        }
        if (item.buktiAbsen) {
          const name = item.buktiAbsenName || "Absensi Rapat";
          const isPdf = name.toLowerCase().endsWith('.pdf');
          links.push(`
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs truncate max-w-[120px]" title="${name}">${name}</span>
              <button type="button" class="text-gray-500 hover:text-blue-600 transition p-1" onclick="window.openPreviewModal('${item.buktiAbsen}', '${name}', ${isPdf})" aria-label="Preview Absen">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              </button>
            </div>
          `);
        }
        links.push(`
          <div class="mt-2 pt-2 border-t border-gray-100">
             <button type="button" class="inline-flex items-center w-full justify-center rounded-md text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-300 px-2 py-1 text-xs font-medium transition" data-action="resetBukti">Reset Bukti</button>
          </div>
        `);
        formBuktiCell = links.join('');
      } else {
        const proofLink = `proof.html?token=${item.id}`;
        formBuktiCell = `
          <button class="inline-flex items-center justify-center rounded-md border border-blue-600 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white px-2.5 py-1.5 text-sm transition font-medium w-full"
                  onclick="window.open('${proofLink}', 'proofPopup', 'width=500,height=750,left=100,top=100')">Isi Bukti Rapat</button>
        `;
      }
    }
    return `<tr data-id="${item.id}">
      <td class="align-middle">${formatTanggalID(item.tanggal)}</td>
      <td class="align-middle">${formatJam(item.jamMulai, item.jamSelesai)}</td>
      <td class="align-middle">${item.ruang}</td>
      <td class="align-middle">${item.judul}</td>
      <td class="align-middle">${item.bidang}</td>
      <td class="align-middle">${statusBadge}</td>
      <td class="align-middle whitespace-nowrap">${formBuktiCell}</td>
      <td class="align-middle whitespace-nowrap">
        <button class="inline-flex items-center rounded-md bg-blue-600 text-white px-2.5 py-1 text-sm hover:bg-blue-700 mr-2" data-action="edit">Edit</button><br class="md:hidden">
        <button class="inline-flex items-center rounded-md bg-red-600 text-white px-2.5 py-1 text-sm hover:bg-red-700 mt-1" data-action="delete">Hapus</button>
      </td>
    </tr>`;
  }).join("");

  adminPagination.innerHTML = `
    <button class="${twBtnSmallOutline()} mr-2" ${adminPage <= 1 ? "disabled" : ""} data-page="${adminPage - 1}">Prev</button>
    <span class="text-sm">Halaman ${adminPage} / ${totalPages}</span>
    <button class="${twBtnSmallOutline()} ml-2" ${adminPage >= totalPages ? "disabled" : ""} data-page="${adminPage + 1}">Next</button>
  `;
}
adminPagination.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-page]");
  if (!btn) return;
  adminPage = Number(btn.dataset.page);
  renderRows();
});

// ===== Auth =====
onAuthStateChanged(auth, (user) => {
  const headerAuth = document.getElementById("headerAuth");
  if (user && ALLOWED_ADMINS.includes(user.email)) {
    loginCard?.classList.add("d-none");
    dashboard?.classList.remove("hidden", "d-none");
    if (headerAuth) {
      headerAuth.classList.remove("hidden");
      headerAuth.classList.add("flex");
    }
    if (adminEmail) adminEmail.textContent = user.email;

    buildAdminFiltersBar();
    const filtersBar = document.getElementById("adminFiltersBar");
    if (filtersBar) filtersBar.classList.remove("hidden", "d-none");

    const q = query(collection(db, "bookings"), orderBy("sortKey", "desc")); // DESC: terbaru dulu
    onSnapshot(q, (snap) => {
      adminAllRows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      refreshAdminFilterOptions(adminAllRows);
      renderRows();
    });
  } else {
    if (adminEmail) adminEmail.textContent = "";
    if (headerAuth) {
      headerAuth.classList.add("hidden");
      headerAuth.classList.remove("flex");
    }
    dashboard?.classList.add("hidden");
    loginCard?.classList.remove("d-none");
    const filtersBar = document.getElementById("adminFiltersBar");
    if (filtersBar) filtersBar.classList.add("hidden", "d-none");
  }
});

// ===== Table actions =====
adminTbody.addEventListener("click", async (e) => {
  const tr = e.target.closest("tr[data-id]");
  if (!tr) return;
  const id = tr.getAttribute("data-id");
  const actionBtn = e.target.closest("button,[href]");
  if (!actionBtn) return;

  const action = actionBtn.getAttribute("data-action");
  if (action === "edit") {
    await openEditModal(id);
  } else if (action === "delete") {
    if (confirm("Hapus booking ini?")) {
      try { await deleteDoc(doc(db, "bookings", id)); } catch { alert("Gagal menghapus"); }
    }
  } else if (action === "copy") {
    const link = actionBtn.getAttribute("data-link");
    try {
      await navigator.clipboard.writeText(link);
      const old = actionBtn.textContent;
      actionBtn.textContent = "Tersalin!";
      setTimeout(() => actionBtn.textContent = old, 1200);
    } catch {
      alert("Gagal menyalin");
    }
  } else if (action === "resetBukti") {
    if (confirm("Hapus bukti rapat ini? Bukti lama akan dihapus dan pengguna harus mengisi ulang buktinya.")) {
      try {
        await updateDoc(doc(db, "bookings", id), {
          buktiFoto: deleteField(),
          buktiFotoUrls: deleteField(),
          buktiAbsen: deleteField(),
          buktiFotoName: deleteField(),
          buktiAbsenName: deleteField()
        });
      } catch (err) {
        console.error(err);
        alert("Gagal menghapus bukti rapat.");
      }
    }
  }
});

// ===== Modal edit (pakai shim bootstrap.Modal dari admin.html) =====
async function openEditModal(id) {
  EDITING_ID = id;
  if (editAlert) editAlert.innerHTML = "";
  try {
    const snap = await getDoc(doc(db, "bookings", id));
    if (!snap.exists()) { showEditAlert("danger", "Data tidak ditemukan"); return; }
    const d = snap.data();
    eRuang.value = d.ruang || "Ruang Rapat Disperkimtan";
    eBidang.value = d.bidang || "";
    eJudul.value = d.judul || "";
    eTanggal.value = d.tanggal || "";
    eJamMulai.value = d.jamMulai ? `${d.jamMulai.slice(0, 2)}:${d.jamMulai.slice(2, 4)}` : "";
    eJamSelesai.value = d.jamSelesai ? `${d.jamSelesai.slice(0, 2)}:${d.jamSelesai.slice(2, 4)}` : "";
    eStatus.value = d.status || "Pending";
    new bootstrap.Modal(document.getElementById("editModal")).show();
  } catch (err) {
    console.error(err);
    showEditAlert("danger", "Gagal memuat data");
  }
}

// ===== Simpan edit =====
document.getElementById("editForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!EDITING_ID) return;

  const ruang = eRuang.value.trim();
  const bidang = eBidang.value.trim();
  const judul = eJudul.value.trim();
  const tanggal = eTanggal.value;
  const jamMulai = eJamMulai.value.replace(":", "");
  const jamSelesai = eJamSelesai.value.replace(":", "");
  const status = eStatus.value;

  if (!ruang || !bidang || !judul || !tanggal || !jamMulai || !jamSelesai) {
    showEditAlert("warning", "Mohon lengkapi semua field wajib.");
    return;
  }
  if (jamSelesai <= jamMulai) {
    showEditAlert("warning", "Jam selesai harus lebih besar dari jam mulai.");
    return;
  }
  if (!isWithinWorkingHours(tanggal, jamMulai, jamSelesai)) {
    showEditAlert("warning", "Di luar jam kerja. Sen–Kam 07.30–16.00, Jum’at 07.30–16.30.");
    return;
  }

  // cek bentrok (exclude dokumen sendiri & abaikan Canceled)
  try {
    const qCheck = query(collection(db, "bookings"), where("tanggal", "==", tanggal), where("ruang", "==", ruang));
    const snap = await getDocs(qCheck);
    const nS = toMinutes(jamMulai), nE = toMinutes(jamSelesai);
    for (const d of snap.docs) {
      if (d.id === EDITING_ID) continue;
      const x = d.data();
      if (x.status === "Canceled") continue;
      const s = toMinutes(x.jamMulai), e2 = toMinutes(x.jamSelesai);
      if (isOverlap(nS, nE, s, e2)) {
        const msg = `Jadwal Bentrok dengan <em>${x.judul} (${formatTanggalID(x.tanggal)} | ${formatJam(x.jamMulai, x.jamSelesai)})</em>, silahkan Hubungi Admin`;
        showEditAlert("danger", msg);
        return;
      }
    }
  } catch (err) {
    console.error(err);
    showEditAlert("danger", "Gagal memeriksa bentrok jadwal.");
    return;
  }

  // update
  try {
    await updateDoc(doc(db, "bookings", EDITING_ID), {
      ruang, bidang, judul, tanggal, jamMulai, jamSelesai, status,
      sortKey: tanggal.replaceAll("-", "") + jamMulai
    });
    showEditAlert("success", "Perubahan tersimpan.");
    setTimeout(() => bootstrap.Modal.getInstance(document.getElementById("editModal"))?.hide(), 400);
  } catch (err) {
    console.error(err);
    showEditAlert("danger", "Gagal menyimpan perubahan.");
  }
});

// ===== Login/Logout =====
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const pass = document.getElementById("password").value;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch {
    showLoginAlert("danger", "Login gagal. Periksa email/password.");
  }
});
document.getElementById("btnLogout")?.addEventListener("click", () => signOut(auth));
