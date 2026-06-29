import { STORAGE_BUCKETS, supabase } from "../config/supabase.js";
import { requireRole, signOut } from "../services/auth.service.js";
import { countRows, createRow, deleteRow, listRows, updateRow } from "../services/base.service.js";
import { modules, roleModules, selectOptions } from "./modules.js";

const allowedRoles = (document.body.dataset.role || "").split("|").filter(Boolean);
const pageTitle = document.body.dataset.title || "Dashboard";
const defaultModule = document.body.dataset.defaultModule || "schools";

const state = {
  profile: null,
  activeModule: defaultModule,
  editingId: null,
  rows: [],
  schools: []
};

function moduleDef(name = state.activeModule) {
  return modules[name] || modules.schools;
}

function text(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return value.full_name || value.school_name || value.name || JSON.stringify(value);
  return String(value);
}

function labelFor(value) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function loadSchoolsLookup() {
  if (state.schools.length) return;
  try {
    state.schools = await listRows("schools", "id, school_name, school_code, status", "school_name");
  } catch {
    state.schools = [];
  }
}

function renderShell() {
  const root = document.querySelector("#app");
  root.innerHTML = `
    <div class="wrapper">
      <nav class="main-header navbar navbar-expand navbar-white navbar-light">
        <ul class="navbar-nav">
          <li class="nav-item"><a class="nav-link" data-widget="pushmenu" href="#"><i class="fas fa-bars"></i></a></li>
        </ul>
        <ul class="navbar-nav ms-auto">
          <li class="nav-item"><button class="btn btn-sm btn-outline-secondary me-2" data-hide-navigation title="Hide navigation"><i class="fa-solid fa-eye-slash"></i></button></li>
          <li class="nav-item"><button class="btn btn-sm btn-outline-secondary me-2" data-dark-mode title="Dark mode"><i class="fa-solid fa-moon"></i></button></li>
          <li class="nav-item"><button class="btn btn-sm btn-outline-danger" data-logout><i class="fa-solid fa-right-from-bracket me-1"></i>Logout</button></li>
        </ul>
      </nav>
      <aside class="main-sidebar app-sidebar sidebar-dark-primary elevation-4">
        <a href="#" class="brand-link"><i class="fa-solid fa-graduation-cap ms-3 me-2"></i><span class="brand-text">SCHOOL PORTAL</span></a>
        <div class="sidebar">
          <div class="user-panel mt-3 pb-3 mb-3 d-flex">
            <div class="info">
              <a href="#" class="d-block">${text(state.profile.full_name || state.profile.email)}</a>
              <small>${text(state.profile.role)}</small>
            </div>
          </div>
          <nav class="mt-2"><ul class="nav nav-pills nav-sidebar flex-column main-menu" data-sidebar></ul></nav>
        </div>
      </aside>
      <main class="content-wrapper">
        <section class="content-header">
          <div class="container-fluid">
            <div class="toolbar-row">
              <div>
                <h1 class="mb-0">${pageTitle}</h1>
                <span class="text-secondary">${text(state.profile.email)}</span>
              </div>
              <span class="status-pill">${text(state.profile.role)}</span>
            </div>
          </div>
        </section>
        <section class="content">
          <div class="container-fluid">
            <div class="metric-grid" data-metrics></div>
            <div class="module-grid">
              <div class="card">
                <div class="card-header"><h2 class="card-title" data-form-title></h2></div>
                <div class="card-body"><form class="row g-3" data-module-form></form></div>
              </div>
              <div class="card">
                <div class="card-header toolbar-row">
                  <h2 class="card-title mb-0" data-table-title></h2>
                  <div class="d-flex flex-wrap gap-2" data-module-actions></div>
                </div>
                <div class="card-body table-responsive" data-module-table></div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <button class="btn btn-primary nav-restore" data-show-navigation><i class="fa-solid fa-bars"></i><span>Navigation</span></button>
    </div>
  `;
}

function renderSidebar() {
  const nav = document.querySelector("[data-sidebar]");
  const names = roleModules[state.profile.role] || roleModules.Student;
  nav.innerHTML = `
    <li class="nav-item"><a href="#" class="nav-link ${state.activeModule === "dashboard" ? "active" : ""}" data-dashboard-home><i class="nav-icon fa-solid fa-gauge-high"></i><p>Dashboard</p></a></li>
    <li class="nav-header">Modules</li>
  ` + names.map((name) => {
    const def = moduleDef(name);
    const active = name === state.activeModule ? "active" : "";
    return `<li class="nav-item"><a href="#" class="nav-link ${active}" data-module="${name}"><i class="nav-icon fa-solid ${def.icon}"></i><p>${def.label}</p></a></li>`;
  }).join("");
}

async function renderMetrics() {
  const metrics = document.querySelector("[data-metrics]");
  const items = [
    ["schools", "Schools", "fa-school"],
    ["students", "Students", "fa-user-graduate"],
    ["staff", "Staff", "fa-users"],
    ["clearance_requests", "Clearance", "fa-file-signature"]
  ];
  const html = await Promise.all(items.map(async ([table, label, icon]) => {
    let value = 0;
    try {
      value = await countRows(table);
    } catch {
      value = 0;
    }
    return `<div class="metric-card"><div class="metric-icon"><i class="fa-solid ${icon}"></i></div><div><strong>${value}</strong><span>${label}</span></div></div>`;
  }));
  metrics.innerHTML = html.join("");
}

function fieldHtml(field, row = {}) {
  const [name, type = "text", required = false] = field;
  const id = `field-${name}`;
  const value = row[name] ?? "";
  const requiredAttr = required ? "required" : "";
  const label = `<label class="form-label" for="${id}">${labelFor(name)}</label>`;

  if (type === "textarea") {
    return `<div class="col-12">${label}<textarea class="form-control" id="${id}" name="${name}" rows="3" ${requiredAttr}>${text(value) === "-" ? "" : text(value)}</textarea></div>`;
  }
  if (type === "select") {
    const options = selectOptions[name] || selectOptions.status;
    return `<div class="col-md-6">${label}<select class="form-select" id="${id}" name="${name}" ${requiredAttr}><option value="">Select</option>${options.map((option) => `<option value="${option}" ${String(value) === option ? "selected" : ""}>${option}</option>`).join("")}</select></div>`;
  }
  if (type === "school-select") {
    return `<div class="col-md-6">${label}<select class="form-select" id="${id}" name="${name}" ${requiredAttr}><option value="">Select school</option>${state.schools.map((school) => `<option value="${school.id}" ${String(value) === school.id ? "selected" : ""}>${school.school_name || school.school_code}</option>`).join("")}</select></div>`;
  }
  if (type === "file") {
    return `<div class="col-md-6">${label}<input class="form-control" id="${id}" name="${name}" type="file" ${requiredAttr}>${value ? `<a class="small d-inline-block mt-1" href="${value}" target="_blank" rel="noreferrer">Current file</a>` : ""}</div>`;
  }
  return `<div class="col-md-6">${label}<input class="form-control" id="${id}" name="${name}" type="${type}" value="${text(value) === "-" ? "" : text(value)}" autocomplete="off" ${requiredAttr}></div>`;
}

function renderForm(row = {}) {
  const def = moduleDef();
  const form = document.querySelector("[data-module-form]");
  const formRow = { ...row };
  if (state.activeModule === "profiles" && !state.editingId) {
    formRow.role ||= "School Administrator";
    formRow.status ||= "Active";
  }
  const fields = state.editingId && def.editFields ? def.editFields : def.fields;
  document.querySelector("[data-form-title]").innerHTML = `<i class="fa-solid ${def.icon} me-2"></i>${def.label}`;

  if (def.readOnly) {
    form.innerHTML = `<div class="col-12"><div class="alert alert-info mb-0">This module is read-only in this portal.</div></div>`;
    return;
  }

  form.innerHTML = `
    <input type="hidden" name="id" value="${formRow.id || ""}">
    ${fields.map((field) => fieldHtml(field, formRow)).join("")}
    <div class="col-12 d-flex flex-wrap gap-2">
      <button class="btn btn-primary" type="submit"><i class="fa-solid fa-save me-2"></i>${state.editingId ? "Update" : "Save"}</button>
      <button class="btn btn-outline-secondary" type="button" data-clear-form>Clear</button>
    </div>
  `;
}

function renderModuleActions() {
  const def = moduleDef();
  const target = document.querySelector("[data-module-actions]");
  const actions = def.bulkActions || [];
  const icons = {
    "create-school-admin": "fa-user-plus",
    "create-staff-user": "fa-user-tie",
    "create-student-user": "fa-user-graduate",
    "subscription-report": "fa-receipt",
    "import-csv": "fa-file-import",
    "promote-all": "fa-arrow-up",
    "graduate-final-year": "fa-user-check",
    "assign-privileges": "fa-key",
    "publish-all": "fa-paper-plane",
    "generate-report-cards": "fa-file-invoice",
    "generate-transcript": "fa-file-lines",
    "bulk-upload": "fa-cloud-arrow-up",
    "schedule-announcement": "fa-clock",
    "bulk-sms": "fa-comment-sms",
    "check-sms-balance": "fa-scale-balanced",
    "apply-clearance": "fa-file-signature",
    "clearance-report": "fa-chart-line",
    "upload-assignment": "fa-upload",
    "refresh-statistics": "fa-rotate"
  };
  target.innerHTML = `
    ${actions.map((action) => `<button class="btn btn-sm btn-outline-primary" data-bulk-action="${action}"><i class="fa-solid ${icons[action] || "fa-bolt"} me-1"></i>${labelFor(action)}</button>`).join("")}
    <button class="btn btn-sm btn-outline-secondary" data-refresh><i class="fa-solid fa-rotate me-1"></i>Refresh</button>
  `;
}

async function uploadFile(def, name, file) {
  const bucket = def.bucket || STORAGE_BUCKETS.documents;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${state.profile.school_id || "global"}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) {
    if ((error.message || "").toLowerCase().includes("bucket not found")) {
      throw new Error(`Storage bucket "${bucket}" was not found. Create the required storage buckets first.`);
    }
    throw error;
  }
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

async function payloadFromForm(form) {
  const def = moduleDef();
  const fields = state.editingId && def.editFields ? def.editFields : def.fields;
  const formData = new FormData(form);
  const payload = {};

  for (const [name, type] of fields) {
    if (type === "file") {
      const file = formData.get(name);
      if (file && file.name) payload[name] = await uploadFile(def, name, file);
    } else if (formData.has(name)) {
      const value = formData.get(name);
      payload[name] = value === "" ? null : value;
    }
  }

  if (def.table !== "schools" && state.profile.school_id && !payload.school_id) payload.school_id = state.profile.school_id;
  payload.created_by = state.profile.id;
  payload.status = payload.status || "Active";
  return payload;
}

async function createUserViaFunction(payload) {
  if (!payload.email || !payload.password || !payload.full_name) throw new Error("Full name, email, and password are required.");
  if (payload.role !== "Super Admin" && !payload.school_id) throw new Error("Select the school for this user.");

  const { data, error } = await supabase.functions.invoke("create-user", { body: payload });
  if (error) {
    let detail = "";
    try {
      if (error.context?.json) {
        const body = await error.context.json();
        detail = body?.error?.message || body?.error || JSON.stringify(body);
      }
    } catch {
      detail = "";
    }
    throw new Error(detail || "The create-user Edge Function is not ready. Deploy it and set SERVICE_ROLE_KEY.");
  }
  if (data?.error) throw new Error(data.error.message || data.error);
  return data;
}

async function saveModule(event) {
  event.preventDefault();
  const def = moduleDef();
  if (def.readOnly) return;

  try {
    const payload = await payloadFromForm(event.currentTarget);
    if (state.editingId) {
      delete payload.password;
      await updateRow(def.table, state.editingId, payload);
      Swal.fire("Updated", "Record updated successfully.", "success");
    } else if (def.edgeCreate) {
      await createUserViaFunction(payload);
      Swal.fire("User created", "The user account was created and linked to the selected school.", "success");
    } else {
      await createRow(def.table, payload);
      Swal.fire("Saved", "Record created successfully.", "success");
    }
    state.editingId = null;
    renderForm();
    await renderTable();
    await renderMetrics();
  } catch (error) {
    Swal.fire("Save failed", error.message, "error");
  }
}

function fileCell(value) {
  return value ? `<a href="${value}" target="_blank" rel="noreferrer">Open</a>` : "-";
}

function rowActions(row) {
  const def = moduleDef();
  const custom = (def.actions || []).map((action) => {
    const icon = { publish: "fa-paper-plane", approve: "fa-check", reject: "fa-xmark", certificate: "fa-certificate", "print-report": "fa-print", "print-transcript": "fa-file-lines", "send-sms": "fa-comment-sms", promote: "fa-arrow-up", transfer: "fa-right-left", graduate: "fa-user-check", activate: "fa-toggle-on", deactivate: "fa-toggle-off" }[action] || "fa-bolt";
    return `<button class="btn btn-sm btn-outline-success" data-action="${action}" data-id="${row.id}" title="${labelFor(action)}"><i class="fa-solid ${icon}"></i></button>`;
  }).join("");
  const editDelete = def.readOnly ? "" : `<button class="btn btn-sm btn-outline-primary" data-edit="${row.id}" title="Edit"><i class="fa-solid fa-pen"></i></button><button class="btn btn-sm btn-outline-danger" data-delete="${row.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>`;
  return `<div class="btn-group btn-group-sm">${editDelete}${custom}</div>`;
}

async function renderTable() {
  const def = moduleDef();
  const wrapper = document.querySelector("[data-module-table]");
  document.querySelector("[data-table-title]").textContent = `${def.label} Records`;
  renderModuleActions();

  try {
    state.rows = await listRows(def.table);
  } catch (error) {
    wrapper.innerHTML = `
      <div class="alert alert-warning mb-0">
        <strong>${def.label} is not available.</strong>
        <div class="mt-1">${error.message}</div>
        <div class="mt-2 small">Run <code>database/schema.sql</code>, then <code>database/rls-policies.sql</code>, then <code>database/workflow-enhancements.sql</code> in Supabase SQL Editor.</div>
      </div>
    `;
    return;
  }

  const columns = def.columns || Object.keys(state.rows[0] || {});
  wrapper.innerHTML = `
    <table class="table table-striped table-hover w-100" data-record-table>
      <thead><tr>${columns.map((column) => `<th>${labelFor(column)}</th>`).join("")}<th>Actions</th></tr></thead>
      <tbody>${state.rows.map((row) => `<tr>${columns.map((column) => `<td>${column.endsWith("_url") || column === "file_url" ? fileCell(row[column]) : text(row[column])}</td>`).join("")}<td>${rowActions(row)}</td></tr>`).join("")}</tbody>
    </table>
  `;

  if (window.DataTable) new DataTable("[data-record-table]", { responsive: true, destroy: true, pageLength: 10 });
}

async function runAction(action, id) {
  const def = moduleDef();
  const row = state.rows.find((item) => item.id === id);
  const updates = {
    publish: { status: "Published", published_at: new Date().toISOString() },
    approve: { status: "Approved", final_status: "Approved" },
    reject: { status: "Rejected", final_status: "Rejected" },
    "send-sms": { status: "Sent" },
    "reset-password": { status: "Password Reset Pending" },
    "upload-document": { status: "Document Requested" },
    "create-login": { status: "Login Requested" },
    "assign-subject": { status: "Subject Assignment Pending" },
    "override-approval": { status: "Approved", final_status: "Approved" },
    promote: { status: "Promoted" },
    transfer: { status: "Transferred" },
    graduate: { status: "Graduated" },
    activate: { status: "Active" },
    deactivate: { status: "Inactive" }
  };
  if (updates[action]) {
    await updateRow(def.table, id, updates[action]);
    await renderTable();
    Swal.fire(labelFor(action), "Workflow action completed.", "success");
    return;
  }
  if (["certificate", "print-report", "print-transcript"].includes(action)) {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`<title>${labelFor(action)}</title><style>body{font-family:Arial;padding:32px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:10px;text-align:left}</style><h1>${labelFor(action)}</h1><table>${Object.entries(row || {}).slice(0, 12).map(([key, value]) => `<tr><th>${labelFor(key)}</th><td>${text(value)}</td></tr>`).join("")}</table><script>print()</script>`);
    printWindow.document.close();
  }
}

async function promptAndCreateUser(defaultRole) {
  await loadSchoolsLookup();
  const schoolOptions = state.schools.map((school) => `<option value="${school.id}">${school.school_name || school.school_code}</option>`).join("");
  const result = await Swal.fire({
    title: `Create ${defaultRole}`,
    html: `
      <select id="swal-school" class="swal2-input">${schoolOptions}</select>
      <input id="swal-name" class="swal2-input" placeholder="Full name">
      <input id="swal-email" class="swal2-input" placeholder="Email">
      <input id="swal-phone" class="swal2-input" placeholder="Phone">
      <input id="swal-password" class="swal2-input" type="password" placeholder="Temporary password">
    `,
    focusConfirm: false,
    showCancelButton: true,
    preConfirm: () => ({
      school_id: document.getElementById("swal-school").value,
      full_name: document.getElementById("swal-name").value,
      email: document.getElementById("swal-email").value,
      phone: document.getElementById("swal-phone").value,
      password: document.getElementById("swal-password").value,
      role: defaultRole,
      status: "Active"
    })
  });
  if (!result.isConfirmed) return;
  await createUserViaFunction(result.value);
  Swal.fire("User created", `${defaultRole} account created and linked to the school.`, "success");
  if (moduleDef().table === "profiles") await renderTable();
}

function openPrintReport(title, rows = state.rows) {
  const def = moduleDef();
  const columns = def.columns || [];
  const win = window.open("", "_blank");
  win.document.write(`
    <title>${title}</title>
    <style>body{font-family:Arial;padding:32px}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #ccc;padding:8px;text-align:left}h1{color:#1d4ed8}</style>
    <h1>${title}</h1>
    <table><thead><tr>${columns.map((column) => `<th>${labelFor(column)}</th>`).join("")}</tr></thead><tbody>
    ${rows.map((row) => `<tr>${columns.map((column) => `<td>${text(row[column])}</td>`).join("")}</tr>`).join("")}
    </tbody></table><script>print()</script>
  `);
  win.document.close();
}

async function runBulkAction(action) {
  const def = moduleDef();
  if (action === "create-school-admin") return promptAndCreateUser("School Administrator");
  if (action === "create-staff-user") return promptAndCreateUser("Teaching Staff");
  if (action === "create-student-user") return promptAndCreateUser("Student");
  if (["subscription-report", "generate-report-cards", "clearance-report"].includes(action)) return openPrintReport(labelFor(action));
  if (action === "generate-transcript") return openPrintReport("Transcript Batch");
  if (action === "import-csv") {
    return Swal.fire("Import CSV", "CSV import is ready as a workflow placeholder. Next step is mapping CSV columns to this module fields.", "info");
  }
  if (action === "bulk-upload") {
    return Swal.fire("Bulk Upload", "Use the file field in the form to upload documents. Bulk folder upload can be added after storage rules are finalized.", "info");
  }
  if (action === "check-sms-balance") {
    return Swal.fire("SMS Balance", "SMS balance is read from the SMS Settings module once your provider API is connected.", "info");
  }
  if (action === "refresh-statistics") {
    await createRow("school_statistics", {
      school_id: state.profile.school_id,
      metric: "Last refresh",
      value: state.rows.length,
      group_name: def.label,
      created_by: state.profile.id,
      status: "Active"
    });
    await renderTable();
    return Swal.fire("Statistics refreshed", "A statistics refresh marker was recorded.", "success");
  }
  if (["promote-all", "graduate-final-year", "publish-all"].includes(action)) {
    const status = action === "publish-all" ? "Published" : action === "promote-all" ? "Promoted" : "Graduated";
    await Promise.all(state.rows.map((row) => updateRow(def.table, row.id, { status })));
    await renderTable();
    return Swal.fire(labelFor(action), "Batch workflow completed.", "success");
  }
  if (["schedule-announcement", "bulk-sms", "apply-clearance", "upload-assignment", "assign-privileges"].includes(action)) {
    return Swal.fire(labelFor(action), "Open this module's form, complete the fields, then save to record this workflow.", "info");
  }
}

async function switchModule(name) {
  state.activeModule = name;
  state.editingId = null;
  const def = moduleDef();
  if (def.fields?.some((field) => field[1] === "school-select")) await loadSchoolsLookup();
  renderSidebar();
  renderForm();
  await renderTable();
}

async function showDashboardHome() {
  state.activeModule = "dashboard";
  state.editingId = null;
  renderSidebar();
  const metricValues = [...document.querySelectorAll(".metric-card strong")].map((node) => Number(node.textContent || 0));
  const [schools = 0, students = 0, staff = 0, clearance = 0] = metricValues;
  const schoolTitle = state.profile.school_id ? "SCHOOL MANAGEMENT PORTAL" : "MULTI-SCHOOL MANAGEMENT PORTAL";
  document.querySelector("[data-form-title]").innerHTML = '<i class="fa-solid fa-info-circle me-2"></i>Dashboard';
  document.querySelector("[data-module-form]").innerHTML = `
    <div class="col-12">
      <div class="waec-school-heading"><i class="fa-solid fa-school me-2"></i>${text(state.profile.full_name || state.profile.email)} - ${schoolTitle}</div>
      <div class="waec-top-grid">
        <a href="#" class="waec-top-block" data-module="assessments"><i class="fa-solid fa-star text-success"></i><div>CAPTURE ASSESSMENT</div></a>
        <a href="#" class="waec-top-block" data-module="school_settings"><i class="fa-solid fa-user text-primary"></i><div>UPDATE SCHOOL INFO</div></a>
        <a href="#" class="waec-top-block" data-module="students"><i class="fa-solid fa-star text-danger"></i><div>REGISTER STUDENTS</div></a>
        <a href="#" class="waec-top-block" data-bulk-action="subscription-report"><i class="fa-solid fa-cloud-arrow-down text-primary"></i><div>DOWNLOAD MANUAL</div></a>
      </div>
      <h2 class="waec-portal-title">${schoolTitle}</h2>
      <div class="waec-crest"><i class="fa-solid fa-graduation-cap"></i></div>
      <div class="waec-help">
        <strong>Notice:</strong> Review student names, dates of birth, gender details, photographs, and captured scores carefully before publishing records.
      </div>
    </div>
  `;
  document.querySelector("[data-table-title]").textContent = "Dashboard Statistics";
  document.querySelector("[data-module-actions]").innerHTML = '<button class="btn btn-sm btn-outline-secondary" data-refresh><i class="fa-solid fa-rotate me-1"></i>Refresh</button>';
  document.querySelector("[data-module-table]").innerHTML = `
    <div class="waec-stat-grid">
      <div class="waec-stat"><i class="fa-solid fa-school"></i><span>Total Schools</span><strong>${schools}</strong></div>
      <div class="waec-stat"><i class="fa-solid fa-users"></i><span>Total Students</span><strong>${students}</strong></div>
      <div class="waec-stat"><i class="fa-solid fa-mars"></i><span>Male</span><strong>0</strong></div>
      <div class="waec-stat"><i class="fa-solid fa-venus"></i><span>Female</span><strong>0</strong></div>
      <div class="waec-stat"><i class="fa-solid fa-user-tie"></i><span>Staff</span><strong>${staff}</strong></div>
      <div class="waec-stat"><i class="fa-solid fa-file-signature"></i><span>Clearance</span><strong>${clearance}</strong></div>
    </div>
    <div class="row g-3 mt-2">
      <div class="col-md-6"><div class="well card"><div class="card-body chart-box"><h4 class="text-center">Gender Distribution</h4><canvas id="genderChart"></canvas></div></div></div>
      <div class="col-md-6"><div class="well card"><div class="card-body chart-box"><h4 class="text-center">Year Distribution</h4><canvas id="yearChart"></canvas></div></div></div>
    </div>
  `;
  if (window.Chart) {
    const genderCanvas = document.querySelector("#genderChart");
    const yearCanvas = document.querySelector("#yearChart");
    if (genderCanvas) {
      new Chart(genderCanvas, {
        type: "pie",
        data: { labels: ["Male", "Female"], datasets: [{ data: [0, 0], backgroundColor: ["#1976d2", "#e91e63"] }] },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }
    if (yearCanvas) {
      new Chart(yearCanvas, {
        type: "bar",
        data: { labels: ["Year 1", "Year 2", "Year 3"], datasets: [{ label: "Students", data: [0, 0, 0], backgroundColor: ["#2e7d32", "#f9a825", "#6a1b9a"] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
    }
  }
}

function wireEvents() {
  document.addEventListener("click", async (event) => {
    const moduleLink = event.target.closest("[data-module]");
    if (moduleLink) {
      event.preventDefault();
      await switchModule(moduleLink.dataset.module);
      return;
    }
    if (event.target.closest("[data-dashboard-home]")) {
      event.preventDefault();
      await showDashboardHome();
      return;
    }
    const editButton = event.target.closest("[data-edit]");
    if (editButton) {
      const row = state.rows.find((item) => item.id === editButton.dataset.edit);
      state.editingId = row?.id || null;
      renderForm(row || {});
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const deleteButton = event.target.closest("[data-delete]");
    if (deleteButton) {
      const confirmed = await Swal.fire({ title: "Delete record?", icon: "warning", showCancelButton: true, confirmButtonText: "Delete" });
      if (confirmed.isConfirmed) {
        await deleteRow(moduleDef().table, deleteButton.dataset.delete);
        await renderTable();
      }
      return;
    }
    const actionButton = event.target.closest("[data-action]");
    if (actionButton) {
      await runAction(actionButton.dataset.action, actionButton.dataset.id);
      return;
    }
    const bulkButton = event.target.closest("[data-bulk-action]");
    if (bulkButton) {
      await runBulkAction(bulkButton.dataset.bulkAction);
      return;
    }
    if (event.target.closest("[data-clear-form]")) {
      state.editingId = null;
      renderForm();
      return;
    }
    if (event.target.closest("[data-refresh]")) {
      await renderTable();
      return;
    }
    if (event.target.closest("[data-logout]")) await signOut();
    if (event.target.closest("[data-dark-mode]")) document.documentElement.classList.toggle("dark-mode");
    if (event.target.closest("[data-hide-navigation]")) document.body.classList.add("nav-hidden");
    if (event.target.closest("[data-show-navigation]")) document.body.classList.remove("nav-hidden");
  });

  document.addEventListener("submit", (event) => {
    if (event.target.matches("[data-module-form]")) saveModule(event);
  });
}

async function init() {
  try {
    state.profile = await requireRole(allowedRoles);
    if (!state.profile) return;
    renderShell();
    wireEvents();
    renderSidebar();
    await renderMetrics();
    await showDashboardHome();
  } catch (error) {
    Swal.fire("Dashboard error", error.message, "error");
  }
}

init();
