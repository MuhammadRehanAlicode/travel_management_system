// Declarative config for each CRUD module. The generic page engine in pages.js renders them.
const badge = (t, c = "gray") => `<span class="badge b-${c}">${esc(t)}</span>`;
const stateBadge = s => s === "expired" ? badge("Expired", "red") : s === "expiring" ? badge("Expiring Soon", "yellow") : s === "valid" ? badge("Valid", "green") : "";
const statusColor = { completed: "green", active: "green", paid: "green", done: "green", returned: "gray", pending: "yellow", draft: "gray",
  in_progress: "blue", scheduled: "blue", sent: "blue", partial: "yellow", cancelled: "red", inactive: "gray", overdue: "red", maintenance: "yellow" };
const sBadge = s => badge(label(s), statusColor[s] || "gray");
const kv = (k, v) => `<div><span class="text-slate-500">${k}:</span> <span class="font-medium">${v}</span></div>`;
const OPT = (o) => Object.entries(o);

const MODULES_CFG = {
  customers: {
    title: "Customer Management", subtitle: "Manage your customers, view ledgers, and track balances", addLabel: "Add Customer",
    endpoint: "customers", singular: "Customer", layout: "cards",
    summary: { endpoint: "customers/summary/", cards: [
      ["Total Customers", d => d.total, ""], ["Receivable", d => money(d.receivable), "text-emerald-600"],
      ["Payable", d => money(d.payable), "text-red-600"], ["Active Customers", d => d.active, "text-blue-600"]] },
    search: "Search customers by name, email or phone…",
    tabs: { param: "balance", items: [["", "All"], ["receivable", "Receivable"], ["payable", "Payable"]] },
    fields: [
      { name: "name", label: "Customer name", required: true, full: true }, { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Phone" }, { name: "address", label: "Address", full: true },
      { name: "is_active", label: "Status", type: "checkbox", hint: "Active customer", default: true }],
    card: c => `<div class="flex justify-between gap-2"><h3 class="font-semibold leading-snug">${esc(c.name)}</h3></div>
      <div class="flex gap-1.5 flex-wrap mt-1">${badge(c.is_active ? "Active" : "Inactive", c.is_active ? "dark" : "gray")}${badge(Number(c.balance) < 0 ? "Payable" : "Receivable")}</div>
      ${c.email ? `<div class="text-xs text-slate-500 mt-2 truncate">✉ ${esc(c.email)}</div>` : ""}${c.phone ? `<div class="text-xs text-slate-500 truncate">☎ ${esc(c.phone)}</div>` : ""}
      <div class="mt-3 text-sm flex justify-between items-center"><span class="text-slate-500">Current Balance:</span><span class="font-bold ${Number(c.balance) > 0 ? "text-emerald-600" : Number(c.balance) < 0 ? "text-red-600" : ""}">${money(c.balance)}</span></div>
      <div class="grid grid-cols-3 gap-2 mt-3 text-center text-xs bg-slate-50 rounded-lg p-2">
        <div><b class="text-base block">${c.trips_count}</b>Trips</div><div><b class="text-base block">${c.payments_count}</b>Payments</div><div><b class="text-base block">${c.invoices_count}</b>Invoices</div></div>`,
    actions: [["view", "View"], ["ledger", "Ledger"], ["edit", "Edit"], ["delete", "Delete"]],
    detail: c => [["Name", c.name], ["Email", c.email || "—"], ["Phone", c.phone || "—"], ["Address", c.address || "—"],
      ["Status", c.is_active ? "Active" : "Inactive"], ["Balance", money(c.balance)], ["Trips", c.trips_count], ["Payments", c.payments_count], ["Invoices", c.invoices_count]],
  },

  vehicles: {
    title: "Vehicles", subtitle: "Manage your fleet and track document expiry", addLabel: "Add Vehicle", endpoint: "vehicles", singular: "Vehicle", layout: "cards",
    search: "Search by number, make, model…",
    filters: [["status", "All Status", [["active", "Active"], ["inactive", "Inactive"], ["maintenance", "Maintenance"]]],
      ["vehicle_type", "All Types", [["truck", "Truck"], ["trailer", "Trailer"], ["pickup", "Pickup"], ["bus", "Bus"], ["other", "Other"]]]],
    fields: [
      { name: "number", label: "Vehicle number", required: true }, { name: "owner_name", label: "Owner / Company" },
      { name: "make_model", label: "Make / Model" },
      { name: "vehicle_type", label: "Type", type: "select", options: [["truck", "Truck"], ["trailer", "Trailer"], ["pickup", "Pickup"], ["bus", "Bus"], ["other", "Other"]] },
      { name: "capacity_tons", label: "Capacity (tons)", type: "number", default: 0 }, { name: "fuel_type", label: "Fuel type", default: "Diesel" },
      { name: "status", label: "Status", type: "select", options: [["active", "Active"], ["inactive", "Inactive"], ["maintenance", "Maintenance"]] },
      { name: "insurance_expiry", label: "Insurance expiry", type: "date" }, { name: "fitness_expiry", label: "Fitness expiry", type: "date" },
      { name: "permit_expiry", label: "Permit expiry", type: "date" }, { name: "mulkiya_expiry", label: "Mulkiya expiry", type: "date" },
      { name: "operating_card_expiry", label: "Operating card expiry", type: "date" }, { name: "notes", label: "Notes", type: "textarea", full: true }],
    card: v => `<div class="flex justify-between items-start"><div><h3 class="font-bold text-lg leading-tight">${esc(v.number)}</h3><div class="text-xs text-slate-500">${esc(v.owner_name || v.make_model)}</div></div>${sBadge(v.status)}</div>
      <div class="grid grid-cols-2 gap-1 text-sm mt-3">${kv("Type", label(v.vehicle_type))}${kv("Capacity", v.capacity_tons + " TONS")}${kv("Fuel", esc(v.fuel_type))}${kv("Trips", v.trips_count)}</div>
      <div class="mt-3 text-xs rounded-lg px-3 py-2 ${v.doc_issues.length ? (v.doc_issues.some(i => i.state === "expired") ? "bg-red-50 text-red-700 border border-red-200" : "bg-yellow-50 text-yellow-800 border border-yellow-200") : "bg-green-50 text-green-700 border border-green-200"}">
        ${v.doc_issues.length ? v.doc_issues.map(i => `${i.doc} ${i.state === "expired" ? "Expired" : "Expiring"}`).join(", ") : "All Valid"}</div>
      ${v.notes ? `<div class="text-xs text-slate-500 mt-2 line-clamp-2"><b>Notes:</b> ${esc(v.notes)}</div>` : ""}`,
    actions: [["view", "👁"], ["edit", "✎"], ["delete", "🗑"]], iconActions: true,
    detail: v => [["Number", v.number], ["Owner", v.owner_name || "—"], ["Make/Model", v.make_model || "—"], ["Type", label(v.vehicle_type)], ["Capacity", v.capacity_tons + " tons"],
      ["Fuel", v.fuel_type], ["Status", label(v.status)], ["Insurance", fdate(v.insurance_expiry)], ["Fitness", fdate(v.fitness_expiry)], ["Permit", fdate(v.permit_expiry)],
      ["Mulkiya", fdate(v.mulkiya_expiry)], ["Operating Card", fdate(v.operating_card_expiry)], ["Trips", v.trips_count], ["Notes", v.notes || "—"]],
  },

  trips: {
    title: "Trips", subtitle: "Manage and track all transportation trips", addLabel: "New Trip", endpoint: "trips", singular: "Trip", layout: "cards",
    extraButton: ["Multi-Stop Trip", "multistop"],
    search: "Search trips…", dateRange: true,
    filters: [["status", "All Statuses", [["pending", "Pending"], ["in_progress", "In Progress"], ["completed", "Completed"], ["cancelled", "Cancelled"]]],
      ["customer", "All Customers", "fk:customers"]],
    fields: [
      { name: "trip_date", label: "Trip date", type: "date", required: true },
      { name: "status", label: "Status", type: "select", options: [["pending", "Pending"], ["in_progress", "In Progress"], ["completed", "Completed"], ["cancelled", "Cancelled"]] },
      { name: "origin", label: "From", required: true }, { name: "destination", label: "To", required: true },
      { name: "customer", label: "Customer", type: "fk", endpoint: "customers", required: true },
      { name: "load_type", label: "Load type", type: "select", options: [["receiving", "Receiving"], ["delivery", "Delivery"]] },
      { name: "vehicle", label: "Vehicle", type: "fk", endpoint: "vehicles", optLabel: "number" },
      { name: "external_vehicle", label: "External vehicle (if hired)" },
      { name: "driver", label: "Driver", type: "fk", endpoint: "drivers" },
      { name: "direction", label: "Direction", type: "select", options: [["Inbound", "Inbound"], ["Outbound", "Outbound"]] },
      { name: "load_tons", label: "Load (tons)", type: "number", default: 0 }, { name: "distance_km", label: "Distance (km)", type: "number", default: 0 },
      { name: "total_amount", label: "Total amount", type: "number", step: "0.001", default: 0 }, { name: "notes", label: "Notes", type: "textarea", full: true }],
    card: t => `<div class="flex justify-between items-start"><div><h3 class="font-bold">${esc(t.trip_no)}</h3><div class="text-xs text-slate-500">${fdate(t.trip_date)}</div></div>${sBadge(t.status)}</div>
      <div class="text-sm mt-3 space-y-1.5">
        <div>📍 <span class="text-slate-500">Route:</span> <b>${esc(t.origin)} → ${esc(t.destination)}</b>${t.is_multi_stop ? " " + badge(t.stops.length + " stops", "blue") : ""}</div>
        <div>👤 <span class="text-slate-500">Customer:</span> ${esc(t.customer_name)}</div>
        <div class="flex gap-1.5 flex-wrap items-center">📦 <span class="text-slate-500">Load Type:</span> ${badge(label(t.load_type), "dark")} ${badge(t.direction)}</div>
        <div>🚚 <span class="text-slate-500">Vehicle:</span> ${esc(t.vehicle_number || t.external_vehicle || "—")}</div>
        <div>🧑‍✈️ <span class="text-slate-500">Driver:</span> ${esc(t.driver_name || "—")}</div>
        <div>⚖ <span class="text-slate-500">Load:</span> ${t.load_tons} tons</div></div>
      <div class="mt-3 pt-3 border-t text-sm space-y-0.5"><div class="flex justify-between"><span class="text-slate-500">Total Amount:</span><b class="text-emerald-600">${money(t.total_amount)}</b></div>
        <div class="flex justify-between"><span class="text-slate-500">Balance:</span><b class="${Number(t.balance) > 0 ? "text-red-600" : ""}">${money(t.balance)}</b></div></div>`,
    actions: [["view", "👁"], ["edit", "✎"], ["delete", "🗑"]], iconActions: true,
    detail: t => [["Trip #", t.trip_no], ["Date", fdate(t.trip_date)], ["Status", label(t.status)], ["Route", `${t.origin} → ${t.destination}`], ["Customer", t.customer_name],
      ["Load type", label(t.load_type)], ["Vehicle", t.vehicle_number || t.external_vehicle || "—"], ["Driver", t.driver_name || "—"], ["Load", t.load_tons + " tons"],
      ["Distance", t.distance_km + " km"], ["Total", money(t.total_amount)], ["Paid", money(t.paid_amount)], ["Balance", money(t.balance)],
      ...t.stops.map(s => [`Stop ${s.sequence}`, `${s.location} · ${s.load_tons}t · ${money(s.amount)}`]), ["Notes", t.notes || "—"]],
  },

  payments: {
    title: "Payments", subtitle: "Manage customer payments and financial transactions", addLabel: "Add Payment", endpoint: "payments", singular: "Payment", layout: "list",
    summary: { endpoint: "payments/summary/", cards: [["Total Payments", d => d.count, ""], ["Total Received", d => money(d.received), "text-emerald-600"],
      ["Total Paid", d => money(d.paid), "text-red-600"], ["Net Amount", d => money(d.net), ""]], useFilters: true },
    search: "Search by customer, reference…", dateRange: true,
    filters: [["payment_type", "All Types", [["received", "Received"], ["paid", "Paid"]]], ["mode", "All Modes", [["cash", "Cash"], ["bank_transfer", "Bank Transfer"], ["cheque", "Cheque"], ["card", "Card"]]]],
    fields: [
      { name: "customer", label: "Customer", type: "fk", endpoint: "customers" }, { name: "title", label: "Title / Purpose" },
      { name: "payment_type", label: "Type", type: "select", options: [["received", "Received"], ["paid", "Paid"]] },
      { name: "mode", label: "Mode", type: "select", options: [["cash", "Cash"], ["bank_transfer", "Bank Transfer"], ["cheque", "Cheque"], ["card", "Card"]] },
      { name: "amount", label: "Amount", type: "number", step: "0.001", required: true }, { name: "payment_date", label: "Date", type: "date", required: true },
      { name: "trip", label: "Linked trip", type: "fk", endpoint: "trips", optLabel: "trip_no" },
      { name: "reference", label: "Reference", full: true }, { name: "notes", label: "Notes", type: "textarea", full: true }],
    row: p => `<div class="flex items-start gap-3 flex-1 min-w-0"><div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${p.payment_type === "received" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}">${p.payment_type === "received" ? "↗" : "↘"}</div>
      <div class="min-w-0"><div class="flex flex-wrap items-center gap-1.5"><b class="text-sm">${esc(p.customer_name || p.title || "Payment")}</b>${badge(label(p.payment_type), p.payment_type === "received" ? "green" : "red")}${badge(label(p.mode), "blue")}</div>
      <div class="text-xs text-slate-500 mt-0.5">${fdate(p.payment_date)}${p.reference ? " · Ref: " + esc(p.reference) : ""}</div></div></div>
      <b class="${p.payment_type === "received" ? "text-emerald-600" : "text-red-600"} whitespace-nowrap">${p.payment_type === "received" ? "+" : "-"}${money(p.amount)}</b>`,
    actions: [["view", "👁"], ["edit", "✎"], ["delete", "🗑"]], iconActions: true,
    detail: p => [["Customer", p.customer_name || "—"], ["Title", p.title || "—"], ["Type", label(p.payment_type)], ["Mode", label(p.mode)], ["Amount", money(p.amount)],
      ["Date", fdate(p.payment_date)], ["Trip", p.trip_no || "—"], ["Reference", p.reference || "—"], ["Notes", p.notes || "—"]],
  },

  drivers: {
    title: "Drivers", subtitle: "Manage driver information and track performance", addLabel: "Add Driver", endpoint: "drivers", singular: "Driver", layout: "list",
    summary: { endpoint: "drivers/summary/", cards: [["Total Drivers", d => d.total, ""], ["Active Drivers", d => d.active, "text-emerald-600"],
      ["License Expiring Soon", d => d.license_expiring, "text-yellow-600"], ["Expired Licenses", d => d.license_expired, "text-red-600"], ["Labor Card Expiring", d => d.labor_expiring, "text-yellow-600"]] },
    search: "Search by name, phone, license…",
    filters: [["is_active", "All Statuses", [["true", "Active"], ["false", "Inactive"]]],
      ["license_status", "All License Statuses", [["valid", "Valid"], ["expiring", "Expiring Soon"], ["expired", "Expired"]]],
      ["labor_status", "All Labor Card Statuses", [["valid", "Valid"], ["expiring", "Expiring Soon"], ["expired", "Expired"]]]],
    fields: [
      { name: "name", label: "Full name", required: true }, { name: "phone", label: "Phone" },
      { name: "license_no", label: "License number" }, { name: "license_expiry", label: "License expiry", type: "date" },
      { name: "labor_card_no", label: "Labor card number" }, { name: "labor_card_expiry", label: "Labor card expiry", type: "date" },
      { name: "joined_date", label: "Joined date", type: "date" }, { name: "is_active", label: "Status", type: "checkbox", hint: "Active driver", default: true },
      { name: "notes", label: "Notes", type: "textarea", full: true }],
    row: d => `<div class="flex items-start gap-3 flex-1 min-w-0"><div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${d.license_state === "expired" ? "bg-red-100 text-red-600" : d.license_state === "expiring" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}">${d.license_state === "valid" ? "✓" : "!"}</div>
      <div class="min-w-0"><div class="flex flex-wrap items-center gap-1.5"><b>${esc(d.name)}</b>${badge(d.is_active ? "Active" : "Inactive", d.is_active ? "dark" : "gray")}${stateBadge(d.license_state === "valid" ? "" : d.license_state)}</div>
      <div class="text-xs text-slate-600 mt-1">License: ${esc(d.license_no || "—")} · Expires: ${fdate(d.license_expiry)}${d.license_days_left != null ? ` (${d.license_days_left} days)` : ""}</div>
      <div class="text-xs text-slate-600">Labor Card: ${esc(d.labor_card_no || "—")} · Expires: ${fdate(d.labor_card_expiry)}</div>
      <div class="text-xs text-slate-500">Joined: ${fdate(d.joined_date)} · Trips: ${d.trips_count} · Completed: ${d.completed_trips} · Earnings: ${money(d.earnings)}</div>
      ${d.notes ? `<div class="text-xs text-slate-500 truncate">${esc(d.notes)}</div>` : ""}</div></div>`,
    actions: [["view", "👁"], ["edit", "✎"], ["toggle", "Toggle"], ["delete", "🗑"]], iconActions: true, toggleField: "is_active",
    detail: d => [["Name", d.name], ["Phone", d.phone || "—"], ["Status", d.is_active ? "Active" : "Inactive"], ["License #", d.license_no || "—"], ["License expiry", fdate(d.license_expiry)],
      ["Labor card #", d.labor_card_no || "—"], ["Labor card expiry", fdate(d.labor_card_expiry)], ["Joined", fdate(d.joined_date)], ["Trips", d.trips_count],
      ["Completed", d.completed_trips], ["Earnings", money(d.earnings)], ["Expense balance", money(d.expense_balance)], ["Notes", d.notes || "—"]],
  },

  salaries: {
    title: "Salaries", subtitle: "Manage driver salaries and payouts", addLabel: "Add Salary", endpoint: "salaries", singular: "Salary", layout: "list",
    search: "Search by driver…", filters: [["is_paid", "All", [["true", "Paid"], ["false", "Unpaid"]]], ["driver", "All Drivers", "fk:drivers"]],
    fields: [
      { name: "driver", label: "Driver", type: "fk", endpoint: "drivers", required: true }, { name: "month", label: "Month (1st day)", type: "date", required: true },
      { name: "basic", label: "Basic", type: "number", step: "0.001", default: 0 }, { name: "allowance", label: "Allowance", type: "number", step: "0.001", default: 0 },
      { name: "deduction", label: "Deduction", type: "number", step: "0.001", default: 0 }, { name: "is_paid", label: "Paid", type: "checkbox", hint: "Mark as paid" },
      { name: "paid_date", label: "Paid on", type: "date" }, { name: "notes", label: "Notes", full: true }],
    row: s => `<div class="flex-1 min-w-0"><div class="flex flex-wrap items-center gap-1.5"><b>${esc(s.driver_name)}</b>${badge(s.is_paid ? "Paid" : "Unpaid", s.is_paid ? "green" : "yellow")}</div>
      <div class="text-xs text-slate-500">${new Date(s.month + "T00:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" })} · Basic ${money(s.basic)} · Allow. ${money(s.allowance)} · Ded. ${money(s.deduction)}</div></div>
      <b class="whitespace-nowrap">${money(s.net)}</b>`,
    actions: [["pay", "Pay"], ["edit", "✎"], ["delete", "🗑"]], iconActions: true, payIf: s => !s.is_paid,
  },

  "driver-expenses": {
    title: "Driver Expenses", subtitle: "Manage driver expenses with ledger-style tracking", endpoint: "drivers", singular: "Driver", layout: "ledgerlist",
    summary: { endpoint: "driver-expenses/summary/", cards: [["Active Drivers", d => d.active_drivers, ""], ["Total Balance", d => money(d.total_balance), ""],
      ["Total Expenses", d => d.total_expenses, ""], ["Avg Balance", d => money(d.avg_balance), ""]] },
    search: "Search drivers…",
    expenseFields: [
      { name: "expense_date", label: "Date", type: "date", required: true },
      { name: "entry_type", label: "Entry type", type: "select", options: [["debit", "Debit (spent by driver)"], ["credit", "Credit (given to driver)"]] },
      { name: "category", label: "Category (Fuel, Toll, Food…)" }, { name: "amount", label: "Amount", type: "number", step: "0.001", required: true },
      { name: "description", label: "Description", full: true }],
  },

  "trailer-rents": {
    title: "Trailer Rents", subtitle: "Track trailers rented to customers", addLabel: "New Rent", endpoint: "trailer-rents", singular: "Trailer rent", layout: "cards",
    search: "Search trailer or customer…", filters: [["status", "All Statuses", [["active", "Active"], ["returned", "Returned"], ["overdue", "Overdue"]]]],
    fields: [
      { name: "trailer", label: "Trailer", type: "fk", endpoint: "vehicles", optLabel: "number", required: true },
      { name: "customer", label: "Customer", type: "fk", endpoint: "customers", required: true },
      { name: "start_date", label: "Start date", type: "date", required: true }, { name: "end_date", label: "End date", type: "date" },
      { name: "daily_rate", label: "Daily rate", type: "number", step: "0.001", default: 0 },
      { name: "status", label: "Status", type: "select", options: [["active", "Active"], ["returned", "Returned"], ["overdue", "Overdue"]] }, { name: "notes", label: "Notes", full: true }],
    card: r => `<div class="flex justify-between"><h3 class="font-bold">${esc(r.trailer_number)}</h3>${sBadge(r.status)}</div>
      <div class="text-sm mt-2 space-y-1">${kv("Customer", esc(r.customer_name))}${kv("From", fdate(r.start_date))}${kv("To", r.end_date ? fdate(r.end_date) : "Ongoing")}${kv("Daily rate", money(r.daily_rate))}</div>
      <div class="mt-3 pt-3 border-t flex justify-between text-sm"><span class="text-slate-500">Total</span><b class="text-emerald-600">${money(r.total_amount)}</b></div>`,
    actions: [["edit", "✎"], ["delete", "🗑"]], iconActions: true,
  },

  invoices: {
    title: "Invoices", subtitle: "Create invoices and track what customers still owe", addLabel: "New Invoice", endpoint: "invoices", singular: "Invoice", layout: "list",
    search: "Search invoice # or customer…", dateRange: true, filters: [["status", "All Statuses", [["draft", "Draft"], ["sent", "Sent"], ["partial", "Partially Paid"], ["paid", "Paid"], ["overdue", "Overdue"]]]],
    fields: [
      { name: "customer", label: "Customer", type: "fk", endpoint: "customers", required: true }, { name: "trip", label: "Trip", type: "fk", endpoint: "trips", optLabel: "trip_no" },
      { name: "issue_date", label: "Issue date", type: "date", required: true }, { name: "due_date", label: "Due date", type: "date" },
      { name: "amount", label: "Amount", type: "number", step: "0.001", required: true }, { name: "paid_amount", label: "Paid so far", type: "number", step: "0.001", default: 0 },
      { name: "status", label: "Status", type: "select", options: [["draft", "Draft"], ["sent", "Sent"], ["partial", "Partially Paid"], ["paid", "Paid"], ["overdue", "Overdue"]] },
      { name: "notes", label: "Notes", full: true }],
    row: i => `<div class="flex-1 min-w-0"><div class="flex flex-wrap items-center gap-1.5"><b>${esc(i.number)}</b>${sBadge(i.status)}</div>
      <div class="text-sm">${esc(i.customer_name)}</div><div class="text-xs text-slate-500">Issued ${fdate(i.issue_date)} · Due ${fdate(i.due_date)}</div></div>
      <div class="text-right whitespace-nowrap"><b>${money(i.amount)}</b><div class="text-xs ${Number(i.balance) > 0 ? "text-red-600" : "text-emerald-600"}">Balance ${money(i.balance)}</div></div>`,
    actions: [["recordpay", "Pay"], ["edit", "✎"], ["delete", "🗑"]], iconActions: true, payIf: i => i.status !== "paid",
  },

  expenses: {
    title: "Expenses", subtitle: "Track company and vehicle expenses", addLabel: "Add Expense", endpoint: "expenses", singular: "Expense", layout: "list",
    search: "Search expenses…", dateRange: true, filters: [["category", "All Categories", [["fuel", "Fuel"], ["toll", "Toll"], ["office", "Office"], ["salary", "Salary"], ["rent", "Rent"], ["insurance", "Insurance"], ["other", "Other"]]]],
    fields: [
      { name: "expense_date", label: "Date", type: "date", required: true },
      { name: "category", label: "Category", type: "select", options: [["fuel", "Fuel"], ["toll", "Toll"], ["office", "Office"], ["salary", "Salary"], ["rent", "Rent"], ["insurance", "Insurance"], ["other", "Other"]] },
      { name: "vehicle", label: "Vehicle", type: "fk", endpoint: "vehicles", optLabel: "number" }, { name: "amount", label: "Amount", type: "number", step: "0.001", required: true },
      { name: "description", label: "Description", full: true }],
    row: e => `<div class="flex-1 min-w-0"><div class="flex flex-wrap items-center gap-1.5"><b>${esc(label(e.category))}</b>${e.vehicle_number ? badge(e.vehicle_number, "blue") : ""}</div>
      <div class="text-xs text-slate-500">${fdate(e.expense_date)}${e.description ? " · " + esc(e.description) : ""}</div></div><b class="text-red-600 whitespace-nowrap">${money(e.amount)}</b>`,
    actions: [["edit", "✎"], ["delete", "🗑"]], iconActions: true,
  },

  maintenance: {
    title: "Maintenance", subtitle: "Service history and upcoming maintenance", addLabel: "Add Record", endpoint: "maintenance", singular: "Maintenance record", layout: "list",
    search: "Search vehicle, vendor…", dateRange: true, filters: [["status", "All Statuses", [["scheduled", "Scheduled"], ["in_progress", "In Progress"], ["done", "Done"]]],
      ["maintenance_type", "All Types", [["service", "Service"], ["repair", "Repair"], ["tyres", "Tyres"], ["oil", "Oil Change"], ["other", "Other"]]]],
    fields: [
      { name: "vehicle", label: "Vehicle", type: "fk", endpoint: "vehicles", optLabel: "number", required: true }, { name: "service_date", label: "Date", type: "date", required: true },
      { name: "maintenance_type", label: "Type", type: "select", options: [["service", "Service"], ["repair", "Repair"], ["tyres", "Tyres"], ["oil", "Oil Change"], ["other", "Other"]] },
      { name: "status", label: "Status", type: "select", options: [["done", "Done"], ["scheduled", "Scheduled"], ["in_progress", "In Progress"]] },
      { name: "cost", label: "Cost", type: "number", step: "0.001", default: 0 }, { name: "vendor", label: "Vendor / Garage" },
      { name: "next_due", label: "Next due", type: "date" }, { name: "description", label: "Description", full: true }],
    row: x => `<div class="flex-1 min-w-0"><div class="flex flex-wrap items-center gap-1.5"><b>${esc(x.vehicle_number)}</b>${badge(label(x.maintenance_type), "blue")}${sBadge(x.status)}</div>
      <div class="text-xs text-slate-500">${fdate(x.service_date)}${x.vendor ? " · " + esc(x.vendor) : ""}${x.next_due ? " · Next due " + fdate(x.next_due) : ""}${x.description ? " · " + esc(x.description) : ""}</div></div><b class="whitespace-nowrap">${money(x.cost)}</b>`,
    actions: [["edit", "✎"], ["delete", "🗑"]], iconActions: true,
  },

  "user-management": {
    title: "User Management", subtitle: "Create and manage who can sign in", addLabel: "Add User", endpoint: "users", singular: "User", layout: "list", search: "Search users…",
    fields: [
      { name: "username", label: "Username", required: true }, { name: "email", label: "Email", type: "email" },
      { name: "first_name", label: "First name" }, { name: "last_name", label: "Last name" },
      { name: "role", label: "Role", type: "select", options: [["staff", "Staff"], ["admin", "Admin"]] },
      { name: "password", label: "Password (leave blank to keep)", type: "password" }, { name: "is_active", label: "Status", type: "checkbox", hint: "Account active", default: true }],
    row: u => `<div class="flex-1 min-w-0"><div class="flex flex-wrap items-center gap-1.5"><b>${esc(u.username)}</b>${badge(label(u.role), u.role === "admin" ? "dark" : "gray")}${badge(u.is_active ? "Active" : "Disabled", u.is_active ? "green" : "red")}</div>
      <div class="text-xs text-slate-500">${esc(u.email || "No email")} · Last login: ${u.last_login ? new Date(u.last_login).toLocaleString() : "never"}</div></div>`,
    actions: [["edit", "✎"], ["delete", "🗑"]], iconActions: true,
  },
};
