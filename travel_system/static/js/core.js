// ---------- helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const csrf = () => (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || "";
let CURRENCY = "OMR";

const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = v => `${CURRENCY} ${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
const fdate = d => d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const label = s => String(s || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

async function api(path, { method = "GET", body, params } = {}) {
  let url = "/api/" + path;
  if (params) {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null));
    if ([...q].length) url += (url.includes("?") ? "&" : "?") + q;
  }
  const r = await fetch(url, {
    method, credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-CSRFToken": csrf() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = r.status === 204 ? null : await r.json().catch(() => null);
  if ((r.status === 401 || r.status === 403) && data && /credentials were not provided/i.test(data.detail || "")) { location.href = "/login/"; }
  if (!r.ok) { const e = new Error("Request failed"); e.status = r.status; e.data = data; throw e; }
  return data;
}

function errText(e) {
  const d = e.data;
  if (!d) return "Something went wrong. Please try again.";
  if (typeof d === "string") return d;
  if (d.detail) return d.detail;
  return Object.entries(d).map(([k, v]) => `${label(k)}: ${Array.isArray(v) ? v.join(" ") : JSON.stringify(v)}`).join("\n");
}

function toast(msg, kind = "ok") {
  const el = document.createElement("div");
  el.className = `pointer-events-auto ml-auto max-w-sm px-4 py-3 rounded-xl shadow-lg text-sm text-white whitespace-pre-line ${kind === "ok" ? "bg-emerald-600" : "bg-red-600"}`;
  el.textContent = msg; $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function debounce(fn, ms = 300) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
const loading = () => `<div class="spin"></div>`;
const empty = (m = "Nothing to show yet.") => `<div class="text-center text-slate-500 py-12 text-sm">${m}</div>`;

// ---------- modal ----------
function openModal(title, html) {
  $("#modalTitle").textContent = title; $("#modalBody").innerHTML = html;
  $("#modal").classList.remove("hidden"); $("#modal").classList.add("flex");
}
function closeModal() { $("#modal").classList.add("hidden"); $("#modal").classList.remove("flex"); }
$("#modalClose").onclick = closeModal;
$("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

function confirmBox(msg) {
  return new Promise(res => {
    openModal("Please confirm", `<p class="text-sm mb-5">${esc(msg)}</p>
      <div class="flex justify-end gap-2"><button class="btn" id="cNo">Cancel</button><button class="btn btn-dark" id="cYes">Yes, continue</button></div>`);
    $("#cNo").onclick = () => { closeModal(); res(false); };
    $("#cYes").onclick = () => { closeModal(); res(true); };
  });
}

// ---------- form builder ----------
// field: {name,label,type: text|number|date|select|fk|textarea|checkbox|email|password, options, endpoint, optLabel, required, step, full, default}
async function buildForm(fields, values = {}) {
  const fkData = {};
  await Promise.all(fields.filter(f => f.type === "fk").map(async f => {
    const d = await api(f.endpoint, { params: { page_size: 500 } });
    fkData[f.name] = d.results || d;
  }));
  const html = fields.map(f => {
    const v = values[f.name] ?? f.default ?? (f.type === "date" && f.required ? new Date().toISOString().slice(0, 10) : "");
    const id = "f_" + f.name;
    let input;
    if (f.type === "select") {
      input = `<select id="${id}" class="inp">${f.options.map(([k, l]) => `<option value="${esc(k)}" ${String(v) === String(k) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
    } else if (f.type === "fk") {
      input = `<select id="${id}" class="inp">${f.required ? "" : '<option value="">— None —</option>'}${fkData[f.name].map(o =>
        `<option value="${o.id}" ${String(v) === String(o.id) ? "selected" : ""}>${esc(o[f.optLabel || "name"])}</option>`).join("")}</select>`;
    } else if (f.type === "textarea") {
      input = `<textarea id="${id}" rows="3" class="inp">${esc(v)}</textarea>`;
    } else if (f.type === "checkbox") {
      input = `<label class="flex items-center gap-2 min-h-[40px]"><input id="${id}" type="checkbox" class="w-4 h-4" ${v === true || v === "true" ? "checked" : ""}> <span class="text-sm">${esc(f.hint || "Yes")}</span></label>`;
    } else {
      input = `<input id="${id}" type="${f.type || "text"}" class="inp" value="${esc(v)}" ${f.step ? `step="${f.step}"` : f.type === "number" ? 'step="any"' : ""} ${f.required ? "required" : ""} ${f.type === "password" ? 'autocomplete="new-password"' : ""}>`;
    }
    return `<div class="${f.full ? "sm:col-span-2" : ""}"><label class="lbl" for="${id}">${esc(f.label)}${f.required ? " *" : ""}</label>${input}<p class="text-xs text-red-600 mt-1 hidden" id="e_${f.name}"></p></div>`;
  }).join("");
  return `<form id="mf" class="grid grid-cols-1 sm:grid-cols-2 gap-4">${html}
    <div class="sm:col-span-2 flex justify-end gap-2 pt-2"><button type="button" class="btn" id="mCancel">Cancel</button><button class="btn btn-dark" id="mSave">Save</button></div></form>`;
}

function readForm(fields) {
  const out = {};
  fields.forEach(f => {
    const el = $("#f_" + f.name); if (!el) return;
    if (f.type === "checkbox") out[f.name] = el.checked;
    else if (el.value === "") out[f.name] = (f.type === "fk" || f.type === "date") ? null : (f.type === "number" ? null : "");
    else out[f.name] = el.value;
  });
  return out;
}

async function openForm({ title, fields, values, endpoint, id, extra, onSaved }) {
  openModal(title, loading());
  $("#modalBody").innerHTML = await buildForm(fields, values);
  $("#mCancel").onclick = closeModal;
  $("#mf").addEventListener("submit", async e => {
    e.preventDefault();
    $$("[id^=e_]").forEach(x => x.classList.add("hidden"));
    const body = { ...readForm(fields), ...(extra ? extra() : {}) };
    $("#mSave").disabled = true;
    try {
      await api(id ? `${endpoint}/${id}/` : `${endpoint}/`, { method: id ? "PATCH" : "POST", body });
      closeModal(); toast(id ? "Saved changes." : "Created successfully."); onSaved && onSaved();
    } catch (err) {
      $("#mSave").disabled = false;
      const d = err.data;
      if (d && typeof d === "object" && !d.detail) {
        let shown = false;
        Object.entries(d).forEach(([k, v]) => { const p = $("#e_" + k); if (p) { p.textContent = [].concat(v).join(" "); p.classList.remove("hidden"); shown = true; } });
        if (!shown) toast(errText(err), "err");
      } else toast(errText(err), "err");
    }
  });
}

// ---------- shell ----------
const NAV = [
  ["dashboard", "Dashboard", "M3 12l9-9 9 9M5 10v10h14V10"],
  ["customers", "Customers", "M17 20h5v-2a4 4 0 00-3-3.9M9 20H4v-2a4 4 0 014-4h2a4 4 0 014 4v2zM12 7a3 3 0 11-6 0 3 3 0 016 0z"],
  ["vehicles", "Vehicles", "M3 13l2-6h11l3 4h2v5h-2M7 18a2 2 0 100-4 2 2 0 000 4zm9 0a2 2 0 100-4 2 2 0 000 4z"],
  ["trips", "Trips", "M9 20l-5-2V5l5 2m0 13l6-2m-6 2V7m6 11l5 2V7l-5-2m0 13V5M9 7l6-2"],
  ["payments", "Payments", "M12 8c-2 0-3 1-3 2s1 2 3 2 3 1 3 2-1 2-3 2m0-10V6m0 12v-2"],
  ["drivers", "Drivers", "M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21v-1a6 6 0 0112 0v1"],
  ["salaries", "Salaries", "M3 7h18v10H3zM3 11h18"],
  ["driver-expenses", "Driver Expenses", "M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v14l-3-2-2 2-2-2-2 2-2-2-3 2V6a2 2 0 012-2z"],
  ["trailer-rents", "Trailer Rents", "M4 7l8-4 8 4-8 4zM4 12l8 4 8-4M4 17l8 4 8-4"],
  ["invoices", "Invoices", "M7 3h8l4 4v14H7zM14 3v5h5M10 13h6M10 17h6"],
  ["expenses", "Expenses", "M12 6v12m-4-4l4 4 4-4"],
  ["maintenance", "Maintenance", "M14 7l3-3 3 3-3 3M3 21l9-9M12 12l-2-2 4-4 4 4-4 4z"],
  ["reports", "Reports", "M4 20V10M10 20V4M16 20v-8M22 20H2"],
  ["user-management", "User Management", "M12 11a4 4 0 100-8 4 4 0 000 8zM5 21a7 7 0 0114 0M18 8l2 2 3-3"],
];
const ICON = p => `<svg class="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="${p}"/></svg>`;

function openSidebar(open) {
  $("#sidebar").classList.toggle("-translate-x-full", !open);
  $("#overlay").classList.toggle("hidden", !open);
}

async function initShell() {
  const me = await api("auth/me/");
  CURRENCY = me.company.currency || "OMR";
  $("#companyName").textContent = me.company.name;
  $("#uName").textContent = me.username; $("#uMail").textContent = me.email || "";
  $("#uBtnName").textContent = me.username; $("#uInit").textContent = me.username[0].toUpperCase();
  window.ME = me;
  $("#nav").innerHTML = NAV.filter(n => n[0] !== "user-management" || me.is_admin).map(([k, l, p]) =>
    `<a href="/${k}/" class="navlink ${window.MODULE === k ? "active" : ""}">${ICON(p)}<span>${l}</span></a>`).join("");
  $("#menuBtn").onclick = () => openSidebar(true);
  $("#overlay").onclick = () => openSidebar(false);
  $("#userBtn").onclick = e => { e.stopPropagation(); $("#userMenu").classList.toggle("hidden"); };
  document.addEventListener("click", () => $("#userMenu").classList.add("hidden"));
  $("#logout").onclick = async () => { await api("auth/logout/", { method: "POST" }); location.href = "/login/"; };
}
