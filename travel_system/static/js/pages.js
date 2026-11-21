// ---------- generic list page ----------
async function renderModule(key) {
  const cfg = MODULES_CFG[key];
  const app = $("#app");
  const state = { page: 1, search: "", filters: {}, tab: "", date_from: "", date_to: "" };
  const fkOpts = {};

  // pre-load FK filter options
  for (const f of cfg.filters || []) {
    if (typeof f[2] === "string" && f[2].startsWith("fk:")) {
      const d = await api(f[2].slice(3), { params: { page_size: 500 } });
      fkOpts[f[0]] = (d.results || d).map(o => [o.id, o.name || o.number || o.trip_no]);
    }
  }
  const optsOf = f => fkOpts[f[0]] || f[2];

  app.innerHTML = `
    <div class="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div><h1 class="text-2xl sm:text-3xl font-bold">${cfg.title}</h1><p class="text-sm text-slate-500">${cfg.subtitle}</p></div>
      <div class="flex gap-2 flex-wrap">
        ${cfg.extraButton ? `<button id="btnExtra" class="btn btn-dark">⇆ ${cfg.extraButton[0]}</button>` : ""}
        ${cfg.addLabel ? `<button id="btnAdd" class="btn ${cfg.extraButton ? "" : "btn-dark"}">＋ ${cfg.addLabel}</button>` : ""}
      </div></div>
    <div id="summary" class="grid grid-cols-2 lg:grid-cols-${cfg.summary ? Math.min(cfg.summary.cards.length, 5) : 4} gap-3 mb-5"></div>
    <div class="card p-4 mb-5">
      <div class="font-semibold mb-3">Search &amp; Filters</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div class="sm:col-span-2 lg:col-span-1"><label class="lbl">Search</label><input id="q" class="inp" placeholder="${esc(cfg.search || "Search…")}"></div>
        ${(cfg.filters || []).map(f => `<div><label class="lbl">${esc(f[1].replace(/^All /, ""))}</label><select class="inp flt" data-k="${f[0]}"><option value="">${esc(f[1])}</option>${optsOf(f).map(([k, l]) => `<option value="${esc(k)}">${esc(l)}</option>`).join("")}</select></div>`).join("")}
        ${cfg.dateRange ? `<div><label class="lbl">From</label><input type="date" id="df" class="inp"></div><div><label class="lbl">To</label><input type="date" id="dt" class="inp"></div>` : ""}
        <div><button id="clear" class="btn w-full">Clear Filters</button></div>
      </div>
      ${cfg.tabs ? `<div class="mt-3 inline-flex rounded-lg bg-slate-100 p-1 gap-1" id="tabs">${cfg.tabs.items.map(([k, l], i) => `<button data-t="${k}" class="px-3 py-1.5 rounded-md text-sm ${i === 0 ? "bg-slate-900 text-white" : ""}">${l}</button>`).join("")}</div>` : ""}
    </div>
    <div id="count" class="text-sm text-slate-500 mb-3"></div>
    <div id="items"></div>
    <div id="pager" class="flex items-center justify-between mt-5 gap-2"></div>`;

  const params = () => ({ page: state.page, search: state.search, ...state.filters, date_from: state.date_from, date_to: state.date_to,
    ...(cfg.tabs ? { [cfg.tabs.param]: state.tab } : {}) });

  async function loadSummary() {
    if (!cfg.summary) return;
    try {
      const d = await api(cfg.summary.endpoint, { params: cfg.summary.useFilters ? { ...state.filters, search: state.search, date_from: state.date_from, date_to: state.date_to } : {} });
      $("#summary").innerHTML = cfg.summary.cards.map(([l, fn, cls]) => `<div class="card p-4"><div class="text-xs text-slate-500">${l}</div><div class="text-xl sm:text-2xl font-bold mt-1 ${cls}">${fn(d)}</div></div>`).join("");
    } catch (e) { /* summary is optional */ }
  }

  async function load() {
    $("#items").innerHTML = loading();
    let data;
    try { data = await api(cfg.endpoint + "/", { params: cfg.layout === "ledgerlist" ? { ...params(), page_size: 200 } : params() }); }
    catch (e) { $("#items").innerHTML = empty("Could not load data."); toast(errText(e), "err"); return; }
    const list = data.results || data;
    window.__list = list;
    const total = data.count ?? list.length;
    const ps = 15, from = total ? (state.page - 1) * ps + 1 : 0, to = Math.min(state.page * ps, total);
    $("#count").textContent = cfg.layout === "ledgerlist" ? `${total} drivers` : `Showing ${from} to ${to} of ${total} ${cfg.singular.toLowerCase()}${total === 1 ? "" : "s"}`;
    if (!list.length) { $("#items").innerHTML = empty("No records found. Try clearing the filters."); $("#pager").innerHTML = ""; return; }

    const acts = it => (cfg.actions || []).filter(a => !(a[0] === "pay" || a[0] === "recordpay") || cfg.payIf(it)).map(([a, l]) => {
      const txt = cfg.iconActions && l.length <= 2 ? l : l;
      const cls = a === "delete" ? "btn btn-sm btn-red" : "btn btn-sm";
      const text = a === "toggle" ? (it[cfg.toggleField] ? "Deactivate" : "Activate") : txt;
      return `<button class="${cls}" data-a="${a}" data-id="${it.id}" title="${label(a)}">${text}</button>`;
    }).join("");

    if (cfg.layout === "cards") {
      $("#items").innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">${list.map(it =>
        `<div class="card p-4 flex flex-col hover:shadow-md transition"><div class="flex-1">${cfg.card(it)}</div><div class="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-100 justify-end">${acts(it)}</div></div>`).join("")}</div>`;
    } else if (cfg.layout === "ledgerlist") {
      $("#items").innerHTML = `<div class="card p-4"><div class="font-semibold">Driver Expense Ledgers</div><div class="text-xs text-slate-500 mb-3">Click a driver to view their ledger and manage credit/debit entries</div><div class="space-y-2">${list.map(d =>
        `<div class="border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-3 justify-between"><div class="flex items-center gap-3 min-w-0"><div class="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">👤</div>
        <div class="min-w-0"><div class="flex items-center gap-2 flex-wrap"><b>${esc(d.name)}</b>${badge(d.is_active ? "Active" : "Inactive", d.is_active ? "dark" : "gray")}</div><div class="text-xs text-slate-500">☎ ${esc(d.phone || "—")} · License: ${esc(d.license_no || "—")}</div></div></div>
        <div class="flex items-center gap-3 flex-wrap"><div class="text-right text-sm"><div>Balance: <b class="${Number(d.expense_balance) < 0 ? "text-red-600" : ""}">${money(d.expense_balance)}</b></div><div class="text-xs text-slate-500">${d.expenses_count} expenses</div></div>
        <button class="btn btn-sm" data-a="ledger" data-id="${d.id}">👁 View Ledger</button><button class="btn btn-sm btn-dark" data-a="addexp" data-id="${d.id}">＋ Add Expense</button></div></div>`).join("")}</div></div>`;
    } else {
      $("#items").innerHTML = `<div class="card divide-y divide-slate-100">${list.map(it =>
        `<div class="p-3 sm:p-4 flex flex-wrap sm:flex-nowrap items-center gap-3 justify-between">${cfg.row(it)}<div class="flex gap-1.5 flex-wrap">${acts(it)}</div></div>`).join("")}</div>`;
    }

    const pages = Math.max(1, Math.ceil(total / ps));
    $("#pager").innerHTML = cfg.layout === "ledgerlist" ? "" : `<button class="btn btn-sm" id="prev" ${state.page <= 1 ? "disabled style='opacity:.4'" : ""}>← Previous</button><span class="text-sm text-slate-500">Page ${state.page} of ${pages}</span><button class="btn btn-sm" id="next" ${state.page >= pages ? "disabled style='opacity:.4'" : ""}>Next →</button>`;
    if ($("#prev")) $("#prev").onclick = () => { if (state.page > 1) { state.page--; load(); scrollTo(0, 0); } };
    if ($("#next")) $("#next").onclick = () => { if (state.page < pages) { state.page++; load(); scrollTo(0, 0); } };
  }
  const refresh = () => { load(); loadSummary(); };

  // events
  $("#q").addEventListener("input", debounce(e => { state.search = e.target.value; state.page = 1; refresh(); }));
  $$(".flt").forEach(s => s.onchange = () => { state.filters[s.dataset.k] = s.value; state.page = 1; refresh(); });
  if ($("#df")) { $("#df").onchange = e => { state.date_from = e.target.value; state.page = 1; refresh(); }; $("#dt").onchange = e => { state.date_to = e.target.value; state.page = 1; refresh(); }; }
  if ($("#tabs")) $$("#tabs button").forEach(b => b.onclick = () => {
    state.tab = b.dataset.t; state.page = 1;
    $$("#tabs button").forEach(x => x.className = "px-3 py-1.5 rounded-md text-sm"); b.className = "px-3 py-1.5 rounded-md text-sm bg-slate-900 text-white"; refresh();
  });
  $("#clear").onclick = () => { renderModule(key); };
  if ($("#btnAdd")) $("#btnAdd").onclick = () => openForm({ title: "Add " + cfg.singular, fields: cfg.fields, endpoint: cfg.endpoint, onSaved: refresh });
  if ($("#btnExtra")) $("#btnExtra").onclick = () => multiStopForm(refresh);

  $("#items").addEventListener("click", async e => {
    const b = e.target.closest("button[data-a]"); if (!b) return;
    const id = +b.dataset.id, a = b.dataset.a, it = (window.__list || []).find(x => x.id === id);
    if (a === "edit") return openForm({ title: "Edit " + cfg.singular, fields: cfg.fields, values: it, endpoint: cfg.endpoint, id, onSaved: refresh });
    if (a === "view") return openModal(cfg.singular + " details", `<dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">${cfg.detail(it).map(([k, v]) => `<div><dt class="text-xs text-slate-500">${esc(k)}</dt><dd class="font-medium break-words">${typeof v === "string" && v.startsWith("<") ? v : esc(v)}</dd></div>`).join("")}</dl>`);
    if (a === "delete") { if (await confirmBox(`Delete this ${cfg.singular.toLowerCase()}? This cannot be undone.`)) { try { await api(`${cfg.endpoint}/${id}/`, { method: "DELETE" }); toast("Deleted."); if (window.__list.length === 1 && state.page > 1) state.page--; refresh(); } catch (er) { toast(er.status === 500 ? "This record is in use by other records and cannot be deleted." : errText(er), "err"); } } return; }
    if (a === "toggle") { await api(`drivers/${id}/toggle/`, { method: "POST" }); toast("Status updated."); return refresh(); }
    if (a === "pay") { await api(`salaries/${id}/pay/`, { method: "POST" }); toast("Salary marked as paid."); return refresh(); }
    if (a === "recordpay") return payInvoiceForm(it, refresh);
    if (a === "ledger") return key === "customers" ? showLedger("customers", id, it.name) : showDriverLedger(id, it.name, refresh);
    if (a === "addexp") return openForm({ title: "Add Expense – " + it.name, fields: cfg.expenseFields, endpoint: "driver-expenses", extra: () => ({ driver: id }), onSaved: refresh });
  });
  refresh();
}

async function showLedger(kind, id, name) {
  openModal(`Ledger – ${name}`, loading());
  const d = await api(`${kind}/${id}/ledger/`);
  $("#modalBody").innerHTML = `<div class="flex justify-between mb-3 text-sm"><span class="text-slate-500">Closing balance</span><b>${money(d.balance)}</b></div>
    <div class="overflow-x-auto"><table class="tbl"><thead><tr><th>Date</th><th>Ref</th><th>Description</th><th class="text-right">Debit</th><th class="text-right">Credit</th><th class="text-right">Balance</th></tr></thead><tbody>${d.rows.map(r =>
      `<tr><td class="whitespace-nowrap">${fdate(r.date)}</td><td>${esc(r.ref)}</td><td>${esc(r.desc)}</td><td class="text-right">${Number(r.debit) ? money(r.debit) : ""}</td><td class="text-right">${Number(r.credit) ? money(r.credit) : ""}</td><td class="text-right font-medium">${money(r.balance)}</td></tr>`).join("") || `<tr><td colspan="6">${empty("No transactions yet.")}</td></tr>`}</tbody></table></div>`;
}

async function showDriverLedger(id, name, refresh) {
  openModal(`Expense Ledger – ${name}`, loading());
  const d = await api(`drivers/${id}/ledger/`);
  $("#modalBody").innerHTML = `<div class="flex justify-between mb-3 text-sm"><span class="text-slate-500">Balance (credit − debit)</span><b>${money(d.balance)}</b></div>
    <div class="overflow-x-auto"><table class="tbl"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th class="text-right">Credit</th><th class="text-right">Debit</th><th class="text-right">Balance</th><th></th></tr></thead><tbody>${d.rows.map(r =>
      `<tr><td class="whitespace-nowrap">${fdate(r.date)}</td><td>${esc(r.category)}</td><td>${esc(r.desc)}</td><td class="text-right text-emerald-600">${Number(r.credit) ? money(r.credit) : ""}</td><td class="text-right text-red-600">${Number(r.debit) ? money(r.debit) : ""}</td><td class="text-right font-medium">${money(r.balance)}</td><td><button class="btn btn-sm btn-red" data-del="${r.id}">🗑</button></td></tr>`).join("") || `<tr><td colspan="7">${empty("No entries yet.")}</td></tr>`}</tbody></table></div>`;
  $$("[data-del]").forEach(b => b.onclick = async () => {
    if (await confirmBox("Delete this ledger entry?")) { await api(`driver-expenses/${b.dataset.del}/`, { method: "DELETE" }); toast("Entry deleted."); refresh(); showDriverLedger(id, name, refresh); }
  });
}

function payInvoiceForm(inv, refresh) {
  openModal("Record payment – " + inv.number, `<form id="pf" class="space-y-4"><p class="text-sm text-slate-500">Outstanding: <b>${money(inv.balance)}</b></p>
    <div><label class="lbl">Amount</label><input id="pamt" type="number" step="0.001" class="inp" value="${inv.balance}" required></div>
    <div><label class="lbl">Mode</label><select id="pmode" class="inp"><option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option><option value="cheque">Cheque</option></select></div>
    <div class="flex justify-end gap-2"><button type="button" class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-dark">Record</button></div></form>`);
  $("#pf").onsubmit = async e => { e.preventDefault(); try { await api(`invoices/${inv.id}/record_payment/`, { method: "POST", body: { amount: $("#pamt").value, mode: $("#pmode").value } }); closeModal(); toast("Payment recorded."); refresh(); } catch (er) { toast(errText(er), "err"); } };
}

async function multiStopForm(refresh) {
  const base = MODULES_CFG.trips.fields.filter(f => ["trip_date", "customer", "vehicle", "driver", "origin", "status"].includes(f.name));
  openModal("Multi-Stop Trip", loading());
  $("#modalBody").innerHTML = await buildForm(base, {});
  const form = $("#mf"), actions = form.lastElementChild;
  const wrap = document.createElement("div"); wrap.className = "sm:col-span-2";
  wrap.innerHTML = `<div class="flex justify-between items-center mb-2"><label class="lbl m-0">Stops</label><button type="button" class="btn btn-sm" id="addStop">＋ Add stop</button></div><div id="stops" class="space-y-2"></div>`;
  form.insertBefore(wrap, actions);
  const addRow = () => { const r = document.createElement("div"); r.className = "grid grid-cols-12 gap-2 stop";
    r.innerHTML = `<input class="inp col-span-12 sm:col-span-5 s-loc" placeholder="Location"><input class="inp col-span-5 sm:col-span-2 s-t" type="number" step="any" placeholder="Tons"><input class="inp col-span-5 sm:col-span-3 s-a" type="number" step="0.001" placeholder="Amount"><button type="button" class="btn btn-red col-span-2">✕</button>`;
    r.querySelector("button").onclick = () => r.remove(); $("#stops").appendChild(r); };
  addRow(); addRow(); $("#addStop").onclick = addRow; $("#mCancel").onclick = closeModal;
  form.onsubmit = async e => {
    e.preventDefault();
    const stops = $$(".stop").map((r, i) => ({ sequence: i + 1, location: r.querySelector(".s-loc").value.trim(), load_tons: r.querySelector(".s-t").value || 0, amount: r.querySelector(".s-a").value || 0 })).filter(s => s.location);
    if (stops.length < 2) return toast("Add at least two stops.", "err");
    const body = { ...readForm(base), stops, destination: stops[stops.length - 1].location, load_tons: stops.reduce((a, s) => a + +s.load_tons, 0),
      total_amount: stops.reduce((a, s) => a + +s.amount, 0), is_multi_stop: true };
    try { await api("trips/", { method: "POST", body }); closeModal(); toast("Multi-stop trip created."); refresh(); } catch (er) { toast(errText(er), "err"); }
  };
}

// ---------- dashboard ----------
async function renderDashboard() {
  $("#app").innerHTML = loading();
  const d = await api("dashboard/");
  const stat = (t, v, sub, cls = "",icon = "📊") => `<div class="dash-stat"><div class="flex items-center justify-between gap-3"><span class="text-xs font-medium text-slate-500">${t}</span><span class="dash-stat-icon ${cls}">${icon}</span></div><div class="text-2xl sm:text-3xl font-semibold tracking-tight mt-3 ${cls}">${v}</div><div class="text-xs text-slate-500 mt-1">${sub}</div></div>`;
  const alertList = (items, kind) => items.length ? items.slice(0, 10).map(i => `<div class="dash-alert-row"><div class="min-w-0"><b class="block truncate text-slate-800">${esc(i.name)}</b><span class="text-xs text-slate-500">${esc(i.doc)} — ${kind === "x" ? `Expired ${i.days} day${i.days === 1 ? "" : "s"} ago` : `${i.days} day${i.days === 1 ? "" : "s"} remaining`}</span></div><span class="badge ${kind === "x" ? "b-red" : "b-yellow"} whitespace-nowrap">${fdate(i.date)}</span></div>`).join("") : `<div class="text-sm text-slate-500 py-5 text-center">Here’s All clear — nothing needs attention.what’s</div>`;
  const quick = [["Customer Management", "Add, edit, and manage customer information", "Manage Customers", "/customers/"], ["Trip Planning", "Create and manage transportation routes", "Plan Trips", "/trips/"], ["Vehicle Management", "Manage fleet and track documents", "Manage Vehicles", "/vehicles/"]];
  $("#app").innerHTML = `
    <section class="dash-hero mb-6"><div class="relative z-10 max-w-2xl"><div class="dash-eyebrow"><span class="dash-live-dot"></span> OPERATIONS OVERVIEW</div><h1 class="text-3xl sm:text-4xl font-semibold tracking-tight mt-3">Good to see you.</h1><p class="text-sm sm:text-base text-slate-300 mt-2">Here’s what’s happening across your logistics operation today.</p></div><div class="dash-hero-mark" aria-hidden="true">L</div><div class="dash-hero-orb" aria-hidden="true"></div></section>
    <div class="flex items-center justify-between mb-3"><h2 class="dash-section-title">Performance snapshot</h2><span class="text-xs text-slate-500">Your business at a glance</span></div>
    <div class="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
      ${stat("Trips this month", d.trips.this_month, `${d.trips.total} total — ${d.trips.completed} completed`, "text-blue-700", "?")}
      ${stat("Fleet vehicles", d.vehicles.total, `${d.vehicles.active} active`, "text-amber-700", "?")}
      ${stat("Drivers", d.drivers.total, `${d.drivers.active} active`, "text-violet-700", "?")}
      ${stat("Customer balances", money(Number(d.customers.receivable) + Number(d.customers.payable)), `${money(d.customers.receivable)} receivable`, "text-pink-700", "?")}
      ${stat("Revenue this month", money(d.revenue_month), "From trips", "text-emerald-700", "?")}
      ${stat("Pending trips", d.trips.pending, "Pending or in progress", "text-slate-700", "?")}
      ${stat("Overdue invoices", d.overdue_invoices, "Past due date", d.overdue_invoices ? "text-red-700" : "text-slate-700", "!")}
      ${stat("Payable", money(d.customers.payable), "Owed to customers", "text-rose-700", "-")}</div>
    <div class="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-6">
      <div class="dash-panel xl:col-span-3"><div class="flex items-start justify-between gap-3 mb-5"><div><h2 class="dash-section-title">Trip activity</h2><p class="text-xs text-slate-500 mt-1">Trips across the last six months</p></div><span class="dash-soft-tag">LAST 6 MONTHS</span></div>${d.monthly.length ? `<div class="dash-chart">${(() => { const mx = Math.max(...d.monthly.map(m => m.trips), 1); return d.monthly.map(m => `<div class="dash-bar-group"><span class="dash-bar-value">${m.trips}</span><div class="dash-bar-track"><div class="dash-bar" style="height:${Math.max(m.trips / mx * 100, 4)}%"></div></div><span class="dash-bar-label">${new Date(m.month + "T00:00:00").toLocaleDateString("en-GB", { month: "short" })}</span></div>`).join(""); })()}</div>` : empty("No trips yet.")}</div>
      <div class="dash-panel xl:col-span-2"><div class="flex items-start justify-between gap-3 mb-3"><div><h2 class="dash-section-title">Needs attention</h2><p class="text-xs text-slate-500 mt-1">Document expiry tracking</p></div><span class="dash-count">${d.expired.length + d.expiring.length}</span></div>
        <div class="dash-alert-section"><div class="flex items-center justify-between mb-2"><span class="dash-alert-heading text-red-700">Expired</span><span class="dash-alert-count text-red-700">${d.expired.length}</span></div><div class="space-y-2 max-h-52 overflow-y-auto">${alertList(d.expired, "x")}</div>${d.expired.length > 10 ? `<div class="text-center text-xs text-red-700 mt-2">Showing 10 of ${d.expired.length} expired items</div>` : ""}</div>
        <div class="dash-alert-section mt-4"><div class="flex items-center justify-between mb-2"><span class="dash-alert-heading text-amber-700">Expiring within 30 days</span><span class="dash-alert-count text-amber-700">${d.expiring.length}</span></div><div class="space-y-2 max-h-52 overflow-y-auto">${alertList(d.expiring, "e")}</div></div></div>
    </div>
    <div class="flex items-center justify-between mb-3"><h2 class="dash-section-title">Quick actions</h2><span class="text-xs text-slate-500">Jump back into your workflow</span></div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">${quick.map((q, i) => `<div class="dash-action"><div class="dash-action-icon dash-action-icon-${i}">${["+", "?", "?"][i]}</div><div class="flex-1"><div class="font-semibold text-sm">${q[0]}</div><div class="text-xs text-slate-500 mt-1 mb-3">${q[1]}</div><a href="${q[3]}" class="dash-action-link">${q[2]} <span>?</span></a></div></div>`).join("")}</div>`;
}
// ---------- reports ----------
async function renderReports() {
  $("#app").innerHTML = `<h1 class="text-2xl sm:text-3xl font-bold">Reports</h1><p class="text-sm text-slate-500 mb-5">Profit &amp; loss and performance summaries</p>
    <div class="card p-4 mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"><div><label class="lbl">From</label><input type="date" id="rf" class="inp"></div><div><label class="lbl">To</label><input type="date" id="rt" class="inp"></div>
    <div class="flex gap-2"><button class="btn btn-dark flex-1" id="rgo">Apply</button><button class="btn flex-1" onclick="window.print()">Print</button></div></div><div id="rout"></div>`;
  const run = async () => {
    $("#rout").innerHTML = loading();
    const d = await api("reports/", { params: { date_from: $("#rf").value, date_to: $("#rt").value } });
    const s = d.summary, box = (t, v, c = "") => `<div class="card p-4"><div class="text-xs text-slate-500">${t}</div><div class="text-xl font-bold mt-1 ${c}">${v}</div></div>`;
    const tbl = (title, rows) => `<div class="card p-4"><div class="font-semibold mb-2">${title}</div>${rows.length ? `<div class="overflow-x-auto"><table class="tbl"><thead><tr><th>Name</th><th class="text-right">Trips</th><th class="text-right">Amount</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.name)}</td><td class="text-right">${r.trips}</td><td class="text-right">${money(r.amount)}</td></tr>`).join("")}</tbody></table></div>` : empty("No data for this period.")}</div>`;
    $("#rout").innerHTML = `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">${box("Revenue (trips)", money(s.revenue), "text-emerald-600")}${box("Total costs", money(s.total_cost), "text-red-600")}${box("Net profit", money(s.profit), s.profit >= 0 ? "text-emerald-600" : "text-red-600")}${box("Trips", s.trips)}
      ${box("Expenses", money(s.expenses))}${box("Maintenance", money(s.maintenance))}${box("Driver expenses", money(s.driver_expenses))}${box("Salaries paid", money(s.salaries))}</div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">${tbl("Top customers", d.by_customer)}${tbl("Top vehicles", d.by_vehicle)}${tbl("Top drivers", d.by_driver)}
      <div class="card p-4"><div class="font-semibold mb-2">Expenses by category</div>${d.expense_categories.length ? d.expense_categories.map(c => `<div class="flex justify-between text-sm py-1.5 border-b border-slate-100"><span>${label(c.category)}</span><b>${money(c.amount)}</b></div>`).join("") : empty("No expenses.")}</div></div>`;
  };
  $("#rgo").onclick = run; run();
}

// ---------- settings ----------
function renderSettings() {
  $("#app").innerHTML = `<h1 class="text-2xl sm:text-3xl font-bold mb-5">Settings</h1><div class="card p-5 max-w-lg"><div class="font-semibold mb-3">Change password</div>
    <form id="pw" class="space-y-3"><div><label class="lbl">Current password</label><input id="pc" type="password" class="inp" required></div><div><label class="lbl">New password</label><input id="pn" type="password" class="inp" minlength="6" required></div>
    <button class="btn btn-dark">Update password</button></form></div>`;
  $("#pw").onsubmit = async e => { e.preventDefault(); try { await api("auth/change-password/", { method: "POST", body: { current: $("#pc").value, new: $("#pn").value } }); toast("Password updated."); e.target.reset(); } catch (er) { toast(errText(er), "err"); } };
}
async function renderCompany() {
  const c = await api("company/"), ro = !window.ME.is_admin ? "disabled" : "";
  $("#app").innerHTML = `<h1 class="text-2xl sm:text-3xl font-bold mb-5">Company settings</h1><div class="card p-5 max-w-lg"><form id="cf" class="space-y-3">
    ${[["name", "Company name"], ["currency", "Currency code"], ["phone", "Phone"], ["email", "Email"], ["address", "Address"]].map(([k, l]) => `<div><label class="lbl">${l}</label><input id="c_${k}" class="inp" value="${esc(c[k])}" ${ro}></div>`).join("")}
    ${ro ? '<p class="text-xs text-slate-500">Only admins can edit company settings.</p>' : '<button class="btn btn-dark">Save</button>'}</form></div>`;
  $("#cf").onsubmit = async e => { e.preventDefault(); try { await api("company/", { method: "PUT", body: Object.fromEntries(["name", "currency", "phone", "email", "address"].map(k => [k, $("#c_" + k).value])) }); toast("Company settings saved."); setTimeout(() => location.reload(), 600); } catch (er) { toast(errText(er), "err"); } };
}

// ---------- boot ----------
(async function () {
  try { await initShell(); } catch (e) { return; }
  const m = window.MODULE;
  try {
    if (m === "dashboard") await renderDashboard();
    else if (m === "reports") await renderReports();
    else if (m === "settings") renderSettings();
    else if (m === "company") await renderCompany();
    else if (MODULES_CFG[m]) await renderModule(m);
    else $("#app").innerHTML = empty("Page not found.");
  } catch (e) { $("#app").innerHTML = empty("Something went wrong loading this page."); console.error(e); }
})();
