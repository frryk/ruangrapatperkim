// ====== Shared Helpers ======

export const $ = (s) => document.querySelector(s);

export function tailwindAlertHTML(type, msg, idToClose) {
  const color = type === "success" ? "green" : type === "warning" ? "amber" : "red";
  return `
    <div class="rounded-lg border border-${color}-200 bg-${color}-50 text-${color}-900 px-4 py-3 relative">
      <div class="pr-6">${msg}</div>
      <button type="button" aria-label="Tutup"
        class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-black/5"
        onclick="(function(){const el=document.getElementById('${idToClose}'); if(el){el.innerHTML='';}})()">
        ✕
      </button>
    </div>
  `;
}

export function toMinutes(hhmm) { 
  if(!hhmm) return 0; 
  return Number(hhmm.slice(0,2))*60 + Number(hhmm.slice(2,4)); 
}

export function isOverlap(aStart, aEnd, bStart, bEnd) { 
  return (aStart < bEnd) && (aEnd > bStart); 
}

export function isWithinWorkingHours(dateStr, startHHmm, endHHmm) {
  const [y,m,d] = dateStr.split("-").map(Number);
  const day = new Date(y,m-1,d).getDay(); // 5=Jumat
  const start = toMinutes(startHHmm), end = toMinutes(endHHmm);
  const open = 7*60+30; const close = (day===5) ? 16*60+30 : 16*60;
  return start >= open && end <= close;
}

export function formatTanggalID(yyyy_mm_dd) {
  const [y,m,d] = yyyy_mm_dd.split("-").map(Number);
  return new Date(y,m-1,d).toLocaleDateString("id-ID", {weekday:"long", day:"numeric", month:"long", year:"numeric"});
}

export function humanJam(hhmm) { 
  return `${hhmm?.slice(0,2).padStart(2,"0")}.${hhmm?.slice(2,4)}`; 
}

export function formatJam(j1, j2) { 
  return `${humanJam(j1)} - ${humanJam(j2)}`; 
}

export function paginate(arr, size, page) { 
  return arr.slice((page-1)*size, page*size); 
}
