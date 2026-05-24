const API_URL = "https://script.google.com/macros/s/AKfycbwG1CqIWCTxUns_w1mbkyU01fdDhnRqD3UtHwFWL69dOpM7UKlsGNLu5oN4q2hfCTqlGw/exec";

const BUSINESS = {
  currency: "USD",
  studioAddress: "704 E Griffin Pkwy, Mission, TX 78572",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=704%20E%20Griffin%20Pkwy%2C%20Mission%2C%20TX%2078572",
};

const FALLBACK_DATA = {
  packages: [
    { packageId: "PKG-001", packageName: "Mini Session", basePrice: 50, durationMinutes: 30, editedPhotos: "10", allowStudio: true, allowLocation: true, description: "A quick, polished session for simple portraits or small moments." },
    { packageId: "PKG-002", packageName: "Standard Session", basePrice: 100, durationMinutes: 60, editedPhotos: "20", allowStudio: true, allowLocation: true, description: "A balanced session for couples, family, birthdays, or personal portraits." },
    { packageId: "PKG-003", packageName: "Premium Session", basePrice: 150, durationMinutes: 120, editedPhotos: "30", allowStudio: true, allowLocation: true, description: "A longer session with more variety, creative direction, and flexibility." },
    { packageId: "PKG-004", packageName: "Deluxe Session", basePrice: 300, durationMinutes: 240, editedPhotos: "60+", allowStudio: true, allowLocation: true, description: "A full extended session for events, detailed storytelling, or multiple looks." }
  ],
  areaFees: []
};

const state = {
  packages: [],
  areaFees: [],
  currentPrice: null,
  admin: {
    sessionToken: localStorage.getItem("normaAdminSession") || "",
    user: null,
    data: null,
    currentTab: "Calendar / Reservations",
    calendarDate: new Date(),
    selectedDate: toDateInputValue(new Date()),
  }
};

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: BUSINESS.currency }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toDateInputValue(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayIso() {
  return toDateInputValue(new Date());
}

function normalizePkgId(pkg) {
  return pkg.packageId || pkg.id || pkg["Package ID"] || "";
}

function packageName(pkg) {
  return pkg.packageName || pkg.name || pkg["Package Name"] || "Package";
}

function packagePrice(pkg) {
  return Number(pkg.basePrice || pkg["Base Price"] || 0);
}

async function apiGet(action, params = {}) {
  const url = new URL(API_URL);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  const res = await fetch(url.toString());
  return res.json();
}

async function apiPost(payload) {
  // Avoid custom Content-Type so Apps Script web apps do not trigger CORS preflight from GitHub Pages.
  const res = await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });
  return res.json();
}

function getFriendlyError(response, fallback = "Something went wrong. Please try again.") {
  return response?.error || fallback;
}

async function loadPackages() {
  try {
    const response = await apiGet("getPackages");
    state.packages = response.success ? response.data : FALLBACK_DATA.packages;
  } catch (err) {
    state.packages = FALLBACK_DATA.packages;
  }
  renderPackages(state.packages);
  populatePackageDropdown(state.packages);
}

function renderPackages(packages) {
  const grid = document.getElementById("packagesGrid");
  if (!grid) return;
  grid.innerHTML = packages.map((pkg) => {
    const id = normalizePkgId(pkg);
    const name = packageName(pkg);
    return `<article class="card package-card" id="${escapeHtml(id)}-session">
      <h3>${escapeHtml(name)}</h3>
      <p>${escapeHtml(pkg.description || pkg["Description"] || "")}</p>
      <ul>
        <li>${escapeHtml(pkg.durationMinutes || pkg["Duration Minutes"] || "")} min</li>
        <li>${escapeHtml(pkg.editedPhotos || pkg["Edited Photos"] || "")} edited photos</li>
        <li>${formatCurrency(packagePrice(pkg))}</li>
      </ul>
      <a class="text-link" href="booking.html?package=${encodeURIComponent(id)}">View package</a>
    </article>`;
  }).join("");
}

function populatePackageDropdown(packages) {
  const select = document.getElementById("packageSelect");
  if (!select) return;
  select.innerHTML = '<option value="">Select a package</option>' + packages.map((pkg) => {
    const id = normalizePkgId(pkg);
    return `<option value="${escapeHtml(id)}">${escapeHtml(packageName(pkg))} (${formatCurrency(packagePrice(pkg))})</option>`;
  }).join("");
  const packageParam = new URLSearchParams(window.location.search).get("package");
  if (packageParam) {
    const normalized = packageParam.replace(/-session$/, "");
    if (packages.some((pkg) => normalizePkgId(pkg) === normalized)) select.value = normalized;
  }
}

async function loadAreaFees() {
  try {
    const response = await apiGet("getDistanceFees");
    state.areaFees = response.success ? response.data : FALLBACK_DATA.areaFees;
  } catch (err) {
    state.areaFees = FALLBACK_DATA.areaFees;
  }
  populateAreaDropdown(state.areaFees);
}

function populateAreaDropdown(areaFees) {
  const areaCode = document.getElementById("areaCode");
  if (!areaCode) return;
  areaCode.innerHTML = '<option value="">Select area/city</option>' + areaFees.map((area) => {
    return `<option value="${escapeHtml(area.areaCode)}">${escapeHtml(area.areaName)} (+${formatCurrency(area.extraFee)})</option>`;
  }).join("");
}

async function loadAvailableDates() {
  const dateInput = document.getElementById("dateInput");
  if (dateInput) dateInput.min = todayIso();
}

async function loadAvailableTimes(date, packageId, sessionType) {
  if (!date || !packageId || !sessionType) return [];
  const response = await apiGet("getAvailableTimes", { date, packageId, sessionType });
  return response.success ? (response.data || []) : [];
}

function populateAvailableTimes(times) {
  const timeInput = document.getElementById("timeInput");
  const formMessage = document.getElementById("formMessage");
  if (!timeInput) return;
  const previous = timeInput.value;
  timeInput.innerHTML = '<option value="">Select a time</option>' + times.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
  if (times.includes(previous)) timeInput.value = previous;
  if (formMessage && times.length === 0 && document.getElementById("dateInput")?.value) {
    formMessage.textContent = "No available times for this date. Please choose another date.";
    formMessage.style.color = "#b00020";
  }
}

async function calculatePricePreview() {
  const selectedPackageId = document.getElementById("packageSelect")?.value;
  const selectedSessionType = document.getElementById("sessionType")?.value;
  const selectedAreaCode = document.getElementById("areaCode")?.value;
  const selectedPromoCode = document.getElementById("promoCode")?.value;
  const selectedPaymentOption = document.getElementById("paymentOption")?.value;

  if (!selectedPackageId || !selectedSessionType) return null;
  if (selectedSessionType === "Location" && !selectedAreaCode) return null;

  const result = await apiPost({
    action: "calculatePrice",
    packageId: selectedPackageId,
    sessionType: selectedSessionType,
    areaCode: selectedSessionType === "Location" ? selectedAreaCode : "",
    promoCode: selectedPromoCode || "",
    paymentOption: selectedPaymentOption || "deposit"
  });

  if (!result.success) throw new Error(getFriendlyError(result, "Unable to calculate price right now."));
  state.currentPrice = result.data;
  return result.data;
}

function updateLocationFieldsVisibility() {
  const sessionType = document.getElementById("sessionType");
  const addressField = document.getElementById("addressField");
  const areaField = document.getElementById("areaField");
  const locationAddress = document.getElementById("locationAddress");
  const areaCode = document.getElementById("areaCode");
  const manualReviewMessage = document.getElementById("manualReviewMessage");
  if (!sessionType || !addressField || !areaField) return;

  const isLocation = sessionType.value === "Location";
  addressField.classList.toggle("hidden", !isLocation);
  areaField.classList.toggle("hidden", !isLocation);
  if (locationAddress) {
    locationAddress.required = isLocation;
    if (!isLocation) locationAddress.value = "";
  }
  if (areaCode) {
    areaCode.required = isLocation;
    if (!isLocation) areaCode.value = "";
  }
  if (manualReviewMessage && !isLocation) manualReviewMessage.classList.add("hidden");
}

function validateBookingForm() {
  const form = document.getElementById("bookingForm");
  const date = document.getElementById("dateInput")?.value;
  if (!form.checkValidity()) return "Please complete all required fields.";
  const selected = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (selected < today) return "Past dates are unavailable.";
  if (selected.getDay() === 0) return "Sunday is unavailable. Please pick Monday-Saturday.";
  return "";
}

async function refreshTimesAndPrice() {
  const date = document.getElementById("dateInput")?.value;
  const selectedPackageId = document.getElementById("packageSelect")?.value;
  const selectedSessionType = document.getElementById("sessionType")?.value;
  const selectedAreaCode = document.getElementById("areaCode")?.value;
  const formMessage = document.getElementById("formMessage");

  if (date && selectedPackageId && selectedSessionType) {
    try {
      const times = await loadAvailableTimes(date, selectedPackageId, selectedSessionType);
      populateAvailableTimes(times);
    } catch (err) {
      if (formMessage) {
        formMessage.textContent = "Available times could not be loaded.";
        formMessage.style.color = "#b00020";
      }
    }
  }

  if (!selectedPackageId || !selectedSessionType || (selectedSessionType === "Location" && !selectedAreaCode)) {
    ["basePriceAmount", "locationFeeAmount", "discountAmount", "totalAmount", "depositAmount", "balanceDue"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = formatCurrency(0);
    });
    return;
  }

  try {
    const summary = await calculatePricePreview();
    if (!summary) return;
    document.getElementById("basePriceAmount").textContent = formatCurrency(summary.basePrice || 0);
    document.getElementById("locationFeeAmount").textContent = formatCurrency(selectedSessionType === "Studio" ? 0 : (summary.extraFee || 0));
    document.getElementById("discountAmount").textContent = formatCurrency(summary.discountAmount || 0);
    document.getElementById("totalAmount").textContent = formatCurrency(summary.totalPrice || 0);
    document.getElementById("depositAmount").textContent = formatCurrency(summary.amountDueNow || 0);
    document.getElementById("balanceDue").textContent = formatCurrency(summary.balanceDue || 0);

    const manualReviewMessage = document.getElementById("manualReviewMessage");
    if (manualReviewMessage) {
      manualReviewMessage.textContent = "This area may require manual review. Your reservation will still be saved and the time will be blocked while Norma reviews it.";
      manualReviewMessage.classList.toggle("hidden", !summary.manualReviewRequired);
    }
    if (formMessage) formMessage.textContent = "";
  } catch (err) {
    if (formMessage) {
      formMessage.textContent = err.message;
      formMessage.style.color = "#b00020";
    }
  }
}

function bookingPayload() {
  const sessionType = document.getElementById("sessionType").value;
  const areaCode = sessionType === "Studio" ? "" : document.getElementById("areaCode").value;
  const area = state.areaFees.find((a) => a.areaCode === areaCode);
  return {
    action: "createPublicReservationNoStripe",
    clientName: document.getElementById("name").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    email: document.getElementById("email").value.trim(),
    occasion: "",
    packageId: document.getElementById("packageSelect").value,
    sessionType,
    areaCode,
    areaName: sessionType === "Studio" ? "Studio" : (area?.areaName || ""),
    locationAddress: sessionType === "Studio" ? "" : document.getElementById("locationAddress").value.trim(),
    sessionDate: document.getElementById("dateInput").value,
    startTime: document.getElementById("timeInput").value,
    paymentOption: document.getElementById("paymentOption").value,
    promoCode: document.getElementById("promoCode")?.value.trim() || "",
    notes: document.getElementById("notes").value.trim()
  };
}

async function initBookingForm() {
  const bookingForm = document.getElementById("bookingForm");
  if (!bookingForm) return;

  ["packageSelect", "dateInput", "sessionType", "areaCode", "promoCode", "paymentOption"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", async () => {
      updateLocationFieldsVisibility();
      await refreshTimesAndPrice();
    });
  });

  updateLocationFieldsVisibility();
  await refreshTimesAndPrice();

  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formMessage = document.getElementById("formMessage");
    const submitButton = document.getElementById("submitBookingButton");
    const error = validateBookingForm();
    if (error) {
      formMessage.textContent = error;
      formMessage.style.color = "#b00020";
      return;
    }
    submitButton.disabled = true;
    submitButton.textContent = "Saving...";
    try {
      const response = await apiPost(bookingPayload());
      if (!response.success) throw new Error(getFriendlyError(response, "Unable to save booking."));
      const status = response.data?.reservationStatus || "Confirmed";
      formMessage.textContent = status === "Pending Approval"
        ? "Reservation saved. This area requires manual review, so Norma will confirm or cancel it after review."
        : "Reservation saved successfully. Your time has been blocked.";
      formMessage.style.color = "#2f6b3f";
      bookingForm.reset();
      updateLocationFieldsVisibility();
      await refreshTimesAndPrice();
    } catch (err) {
      formMessage.textContent = err.message;
      formMessage.style.color = "#b00020";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Continue Booking";
    }
  });
}

/* =========================
   ADMIN
========================= */

function adminTabsForUser(user) {
  const tabs = ["Calendar / Reservations", "Add Manual Reservation", "Blocked Times", "Packages", "Promos", "Payments / Balances"];
  if (String(user?.Role || user?.role || "").toLowerCase() === "owner") tabs.push("Users");
  return tabs;
}

function getUserRole() {
  return String(state.admin.user?.Role || state.admin.user?.role || "").toLowerCase();
}

function showAdminMessage(message, isError = false) {
  const msg = document.getElementById("adminLoginMessage");
  if (msg) {
    msg.textContent = message;
    msg.style.color = isError ? "#b00020" : "#2f6b3f";
  }
  const toast = document.getElementById("adminToast");
  if (toast) {
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2400);
  }
}

async function adminPost(action, payload = {}) {
  const response = await apiPost({ action, sessionToken: state.admin.sessionToken, ...payload });
  if (!response.success) throw new Error(getFriendlyError(response));
  return response.data;
}

async function loadAdminData() {
  state.admin.data = await adminPost("getAdminBootstrapData");
}

function reservationId(r) { return r["Reservation ID"] || r.reservationId || ""; }
function reservationDate(r) { return r["Session Date"] || r.sessionDate || ""; }
function reservationStatus(r) { return r["Reservation Status"] || r.reservationStatus || ""; }
function paymentStatus(r) { return r["Payment Status"] || r.paymentStatus || ""; }
function reservationClient(r) { return r["Client Name"] || r.clientName || ""; }
function reservationTotal(r) { return Number(r["Total Price"] || r.totalPrice || 0); }
function reservationPaid(r) { return Number(r["Amount Paid"] || r.amountPaid || 0); }
function reservationBalance(r) { return Number(r["Balance Due"] || r.balanceDue || 0); }

function renderAdminShell() {
  const login = document.getElementById("adminLogin");
  const dashboard = document.getElementById("adminDashboard");
  if (!login || !dashboard) return;
  login.classList.add("hidden");
  dashboard.classList.remove("hidden");

  const tabs = adminTabsForUser(state.admin.user);
  if (!tabs.includes(state.admin.currentTab)) state.admin.currentTab = tabs[0];
  document.getElementById("adminTabs").innerHTML = tabs.map((tab) => {
    return `<button class="admin-tab ${tab === state.admin.currentTab ? "active" : ""}" type="button" data-tab="${escapeHtml(tab)}">${escapeHtml(tab)}</button>`;
  }).join("");
  renderAdminTab();
}

function renderAdminTab() {
  const tab = state.admin.currentTab;
  const content = document.getElementById("adminTabContent");
  if (!content || !state.admin.data) return;
  if (tab === "Calendar / Reservations") renderCalendarReservations(content);
  if (tab === "Add Manual Reservation") renderManualReservation(content);
  if (tab === "Blocked Times") renderBlockedTimes(content);
  if (tab === "Packages") renderAdminPackages(content);
  if (tab === "Promos") renderPromos(content);
  if (tab === "Payments / Balances") renderPayments(content);
  if (tab === "Users") renderUsers(content);
}

function renderCalendarReservations(content) {
  const reservations = state.admin.data.reservations || [];
  const selected = state.admin.selectedDate;
  const date = new Date(state.admin.calendarDate);
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const prevMonthDays = new Date(date.getFullYear(), date.getMonth(), 0).getDate();
  const monthLabel = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const byDate = reservations.reduce((acc, r) => {
    const d = reservationDate(r);
    if (!acc[d]) acc[d] = [];
    acc[d].push(r);
    return acc;
  }, {});

  let cells = "";
  for (let i = 0; i < 42; i += 1) {
    let cellDate;
    let dayNum;
    let outside = false;
    if (i < startWeekday) {
      dayNum = prevMonthDays - startWeekday + i + 1;
      cellDate = new Date(date.getFullYear(), date.getMonth() - 1, dayNum);
      outside = true;
    } else if (i >= startWeekday + daysInMonth) {
      dayNum = i - (startWeekday + daysInMonth) + 1;
      cellDate = new Date(date.getFullYear(), date.getMonth() + 1, dayNum);
      outside = true;
    } else {
      dayNum = i - startWeekday + 1;
      cellDate = new Date(date.getFullYear(), date.getMonth(), dayNum);
    }
    const iso = toDateInputValue(cellDate);
    const sessions = byDate[iso] || [];
    const needsReview = sessions.some((r) => reservationStatus(r) === "Pending Approval");
    cells += `<button class="cal-day ${outside ? "outside" : ""} ${iso === todayIso() ? "today" : ""} ${iso === selected ? "selected" : ""}" data-date="${iso}" type="button">
      <span class="day-num">${dayNum}</span>
      ${sessions.length ? `<span class="day-meta">${sessions.length} session${sessions.length > 1 ? "s" : ""}</span>` : ""}
      ${sessions.length ? `<span class="day-meta">${formatCurrency(sessions.reduce((sum, r) => sum + reservationTotal(r), 0))}</span>` : ""}
      ${needsReview ? `<span class="badge badge-soft">Review</span>` : ""}
    </button>`;
  }

  const selectedRows = (byDate[selected] || []).sort((a, b) => String(a["Start Time"] || "").localeCompare(String(b["Start Time"] || "")));
  content.innerHTML = `<div class="admin-summary-row">
      <div class="metric"><h4>Total Reservations</h4><p>${reservations.length}</p></div>
      <div class="metric"><h4>Pending Approval</h4><p>${reservations.filter((r) => reservationStatus(r) === "Pending Approval").length}</p></div>
      <div class="metric"><h4>Pending Payments</h4><p>${reservations.filter((r) => paymentStatus(r) !== "Paid").length}</p></div>
      <div class="metric"><h4>Revenue Booked</h4><p>${formatCurrency(reservations.reduce((sum, r) => sum + reservationTotal(r), 0))}</p></div>
    </div>
    <div class="layout-2">
      <div class="panel">
        <div class="calendar-head">
          <h3>${escapeHtml(monthLabel)}</h3>
          <div><button class="btn btn-sm" data-admin-action="prevMonth" type="button">Previous</button> <button class="btn btn-sm" data-admin-action="today" type="button">Today</button> <button class="btn btn-sm" data-admin-action="nextMonth" type="button">Next</button></div>
        </div>
        <div class="weekday-row"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
        <div class="calendar-grid">${cells}</div>
      </div>
      <aside class="side-panel">
        <h3>${escapeHtml(selected)}</h3>
        ${selectedRows.length ? selectedRows.map(reservationCard).join("") : `<p class="muted-text">No reservations for this date.</p>`}
      </aside>
    </div>
    <div class="panel admin-table-wrap"><h3>All Reservations</h3>${reservationsTable(reservations)}</div>`;
}

function reservationCard(r) {
  const id = reservationId(r);
  return `<div class="session-item">
    <strong>${escapeHtml(r["Start Time"] || "")} · ${escapeHtml(reservationClient(r))}</strong>
    <span>${escapeHtml(r["Package Name"] || "")} · ${escapeHtml(r["Session Type"] || "")} · <span class="badge">${escapeHtml(reservationStatus(r))}</span></span>
    <span>${escapeHtml(paymentStatus(r))} · Balance ${formatCurrency(reservationBalance(r))}</span>
    <div class="admin-inline-actions">
      <button class="btn btn-sm btn-light" data-admin-action="viewReservation" data-id="${escapeHtml(id)}" type="button">View / Edit</button>
      ${paymentStatus(r) !== "Paid" ? `<button class="btn btn-sm" data-admin-action="markPaid" data-id="${escapeHtml(id)}" type="button">Mark Fully Paid</button>` : ""}
      <button class="btn btn-sm btn-light" data-admin-action="cancelReservation" data-id="${escapeHtml(id)}" type="button">Cancel</button>
    </div>
  </div>`;
}

function reservationsTable(reservations) {
  if (!reservations.length) return `<p class="muted-text">No reservations found.</p>`;
  return `<table class="admin-table"><thead><tr><th>Client</th><th>Date</th><th>Time</th><th>Package</th><th>Type</th><th>Status</th><th>Payment</th><th>Total</th><th>Balance</th><th>Actions</th></tr></thead><tbody>
    ${reservations.map((r) => `<tr>
      <td><strong>${escapeHtml(reservationClient(r))}</strong><br><span class="muted-text">${escapeHtml(r.Email || "")} · ${escapeHtml(r.Phone || "")}</span></td>
      <td>${escapeHtml(reservationDate(r))}</td>
      <td>${escapeHtml(r["Start Time"] || "")}</td>
      <td>${escapeHtml(r["Package Name"] || "")}</td>
      <td>${escapeHtml(r["Session Type"] || "")}</td>
      <td><span class="badge">${escapeHtml(reservationStatus(r))}</span></td>
      <td><span class="badge">${escapeHtml(paymentStatus(r))}</span></td>
      <td>${formatCurrency(reservationTotal(r))}</td>
      <td>${formatCurrency(reservationBalance(r))}</td>
      <td><div class="admin-inline-actions table-actions"><button class="btn btn-sm btn-light" data-admin-action="viewReservation" data-id="${escapeHtml(reservationId(r))}" type="button">View / Edit</button>${paymentStatus(r) !== "Paid" ? `<button class="btn btn-sm" data-admin-action="markPaid" data-id="${escapeHtml(reservationId(r))}" type="button">Paid</button>` : ""}</div></td>
    </tr>`).join("")}
  </tbody></table>`;
}


function findReservationById(id) {
  return (state.admin.data?.reservations || []).find((r) => String(reservationId(r)) === String(id));
}

function detailValue(r, key) {
  return r?.[key] ?? "";
}

function renderReservationDetailModal(r) {
  if (!r) return;
  document.querySelector(".modal-backdrop[data-admin-modal='reservation']")?.remove();
  const id = reservationId(r);
  const canMarkPaid = paymentStatus(r) !== "Paid";
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.dataset.adminModal = "reservation";
  modal.innerHTML = `<div class="modal reservation-modal" role="dialog" aria-modal="true" aria-label="Reservation details">
    <div class="modal-head">
      <div>
        <p class="eyebrow">Reservation Details</p>
        <h3>${escapeHtml(id)}</h3>
      </div>
      <button class="btn btn-sm btn-light" data-admin-action="closeReservationModal" type="button">Close</button>
    </div>
    <form id="adminReservationDetailForm" class="form-panel">
      <input type="hidden" name="reservationId" value="${escapeHtml(id)}">
      <div class="reservation-detail-summary">
        <div><span>Total</span><strong>${formatCurrency(reservationTotal(r))}</strong></div>
        <div><span>Amount Paid</span><strong>${formatCurrency(reservationPaid(r))}</strong></div>
        <div><span>Balance Due</span><strong>${formatCurrency(reservationBalance(r))}</strong></div>
        <div><span>Payment</span><strong>${escapeHtml(paymentStatus(r))}</strong></div>
      </div>
      <div class="modal-grid">
        <label>Client name<input name="clientName" value="${escapeHtml(detailValue(r, "Client Name"))}" required></label>
        <label>Phone<input name="phone" value="${escapeHtml(detailValue(r, "Phone"))}" required></label>
        <label>Email<input name="email" type="email" value="${escapeHtml(detailValue(r, "Email"))}" required></label>
        <label>Occasion<input name="occasion" value="${escapeHtml(detailValue(r, "Occasion"))}"></label>
        <label>Reservation status<select name="reservationStatus">
          ${["Confirmed", "Pending Approval", "Canceled", "Completed"].map((status) => `<option value="${status}" ${reservationStatus(r) === status ? "selected" : ""}>${status}</option>`).join("")}
        </select></label>
        <label>Payment status<input value="${escapeHtml(paymentStatus(r))}" disabled></label>
        <label>Package<input value="${escapeHtml(detailValue(r, "Package Name"))}" disabled></label>
        <label>Session type<input value="${escapeHtml(detailValue(r, "Session Type"))}" disabled></label>
        <label>Date<input value="${escapeHtml(reservationDate(r))}" disabled></label>
        <label>Time<input value="${escapeHtml(detailValue(r, "Start Time"))} - ${escapeHtml(detailValue(r, "End Time"))}" disabled></label>
        <label>Area / city<input value="${escapeHtml(detailValue(r, "Area Name") || detailValue(r, "Area Code"))}" disabled></label>
        <label>Location address<input name="locationAddress" value="${escapeHtml(detailValue(r, "Location Address"))}"></label>
      </div>
      <label>Client notes<textarea name="notes">${escapeHtml(detailValue(r, "Notes"))}</textarea></label>
      <label>Internal notes<textarea name="internalNotes">${escapeHtml(detailValue(r, "Internal Notes"))}</textarea></label>
      <div class="modal-actions">
        <button class="btn" type="submit">Save Changes</button>
        ${canMarkPaid ? `<button class="btn btn-light" data-admin-action="markPaid" data-id="${escapeHtml(id)}" type="button">Mark Fully Paid</button>` : ""}
        <button class="btn btn-light" data-admin-action="cancelReservation" data-id="${escapeHtml(id)}" type="button">Cancel Reservation</button>
      </div>
    </form>
  </div>`;
  document.getElementById("adminTabContent")?.appendChild(modal);
}

function renderManualReservation(content) {
  content.innerHTML = `<div class="panel"><h3>Add Manual Reservation</h3>
    <p class="muted-text">This creates a real reservation in Google Sheets and blocks the selected time.</p>
    <form id="adminManualReservationForm" class="form-panel admin-form-grid">
      <label>Client name<input name="clientName" required></label>
      <label>Phone<input name="phone" required></label>
      <label>Email<input name="email" type="email" required></label>
      <label>Occasion<input name="occasion"></label>
      <label>Package<select name="packageId" required>${(state.admin.data.packages || []).map((p) => `<option value="${escapeHtml(p.packageId)}">${escapeHtml(p.packageName)} (${formatCurrency(p.basePrice)})</option>`).join("")}</select></label>
      <label>Session type<select name="sessionType" id="adminManualSessionType" required><option value="Studio">Studio</option><option value="Location">Location</option></select></label>
      <label class="admin-location-only hidden">Area/city<select name="areaCode"><option value="">Select area/city</option>${(state.admin.data.distanceFees || []).map((a) => `<option value="${escapeHtml(a.areaCode)}">${escapeHtml(a.areaName)} (+${formatCurrency(a.extraFee)})</option>`).join("")}</select></label>
      <label class="admin-location-only hidden">Location address<input name="locationAddress"></label>
      <label>Session date<input name="sessionDate" type="date" min="${todayIso()}" required></label>
      <label>Start time<input name="startTime" type="time" required></label>
      <label>Payment option<select name="paymentOption"><option value="deposit">Deposit</option><option value="full">Full</option></select></label>
      <label>Amount paid<input name="amountPaid" type="number" min="0" step="0.01" value="0"></label>
      <label>Notes<textarea name="notes"></textarea></label>
      <label>Internal notes<textarea name="internalNotes"></textarea></label>
      <button class="btn" type="submit">Add Reservation</button>
    </form></div>`;
}

function renderBlockedTimes(content) {
  const blocked = state.admin.data.blockedTimes || [];
  content.innerHTML = `<div class="panel"><h3>Add Blocked Time</h3>
    <form id="adminBlockedForm" class="form-panel admin-form-grid compact-form">
      <label>Block type<select name="blockType"><option value="Full Day">Full Day</option><option value="Partial Day">Partial Day</option></select></label>
      <label>Date<input name="date" type="date" required></label>
      <label>Start time<input name="startTime" type="time"></label>
      <label>End time<input name="endTime" type="time"></label>
      <label>Reason<input name="reason"></label>
      <label>Notes<input name="notes"></label>
      <button class="btn" type="submit">Add Blocked Time</button>
    </form></div>
    <div class="panel admin-table-wrap"><h3>Blocked Times</h3>${blocked.length ? `<table class="admin-table"><thead><tr><th>Date</th><th>Type</th><th>Start</th><th>End</th><th>Reason</th></tr></thead><tbody>${blocked.map((b) => `<tr><td>${escapeHtml(b.Date || b.date || "")}</td><td>${escapeHtml(b["Block Type"] || "")}</td><td>${escapeHtml(b["Start Time"] || "")}</td><td>${escapeHtml(b["End Time"] || "")}</td><td>${escapeHtml(b.Reason || "")}</td></tr>`).join("")}</tbody></table>` : `<p class="muted-text">No blocked times.</p>`}</div>`;
}

function renderAdminPackages(content) {
  const packages = state.admin.data.packages || [];
  content.innerHTML = `<div class="panel"><h3>Packages</h3><p class="muted-text">View-only. Change package names, prices, and durations directly in Google Sheets.</p>
    <div class="cards package-grid">${packages.map((p) => `<article class="card package-card"><h3>${escapeHtml(p.packageName)}</h3><p>${escapeHtml(p.description || "")}</p><ul><li>${escapeHtml(p.durationMinutes)} min</li><li>${escapeHtml(p.editedPhotos)} edited photos</li><li>${formatCurrency(p.basePrice)}</li></ul></article>`).join("")}</div></div>`;
}

function renderPromos(content) {
  const promos = state.admin.data.promos || [];
  content.innerHTML = `<div class="panel"><h3>Add Promo</h3>
    <form id="adminPromoForm" class="form-panel admin-form-grid compact-form">
      <label>Promo name<input name="promoName" required></label>
      <label>Promo code<input name="promoCode" required></label>
      <label>Discount type<select name="discountType"><option value="percent">Percent</option><option value="flat">Flat</option></select></label>
      <label>Discount value<input name="discountValue" type="number" min="0" step="0.01" required></label>
      <label>Start date<input name="startDate" type="date"></label>
      <label>End date<input name="endDate" type="date"></label>
      <label>Applies to package IDs<input name="appliesToPackageIds" placeholder="Optional, comma-separated"></label>
      <label>Notes<input name="notes"></label>
      <button class="btn" type="submit">Add Promo</button>
    </form></div>
    <div class="panel admin-table-wrap"><h3>Promos</h3>${promos.length ? `<table class="admin-table"><thead><tr><th>Name</th><th>Code</th><th>Type</th><th>Value</th><th>Start</th><th>End</th><th>Active</th></tr></thead><tbody>${promos.map((p) => `<tr><td>${escapeHtml(p["Promo Name"] || "")}</td><td>${escapeHtml(p["Promo Code"] || "")}</td><td>${escapeHtml(p["Discount Type"] || "")}</td><td>${escapeHtml(p["Discount Value"] || "")}</td><td>${escapeHtml(p["Start Date"] || "")}</td><td>${escapeHtml(p["End Date"] || "")}</td><td>${escapeHtml(p.Active || "")}</td></tr>`).join("")}</tbody></table>` : `<p class="muted-text">No promos.</p>`}</div>`;
}

function renderPayments(content) {
  const reservations = state.admin.data.reservations || [];
  const payments = state.admin.data.payments || [];
  const unpaid = reservations.filter((r) => paymentStatus(r) !== "Paid");
  content.innerHTML = `<div class="admin-summary-row"><div class="metric"><h4>Unpaid / Partial</h4><p>${unpaid.length}</p></div><div class="metric"><h4>Open Balance</h4><p>${formatCurrency(unpaid.reduce((sum, r) => sum + reservationBalance(r), 0))}</p></div></div>
    <div class="panel admin-table-wrap"><h3>Balances</h3>${reservationsTable(unpaid)}</div>
    <div class="panel admin-table-wrap"><h3>Payment Log</h3>${payments.length ? `<table class="admin-table"><thead><tr><th>Date</th><th>Reservation</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead><tbody>${payments.map((p) => `<tr><td>${escapeHtml(p["Payment Date"] || "")}</td><td>${escapeHtml(p["Reservation ID"] || "")}</td><td>${formatCurrency(p.Amount || 0)}</td><td>${escapeHtml(p["Payment Method"] || "")}</td><td>${escapeHtml(p["Payment Status"] || "")}</td></tr>`).join("")}</tbody></table>` : `<p class="muted-text">No payments yet.</p>`}</div>`;
}

function renderUsers(content) {
  const users = state.admin.data.users || [];
  content.innerHTML = `<div class="panel"><h3>Create User</h3>
    <form id="adminUserForm" class="form-panel admin-form-grid compact-form">
      <label>Name<input name="name" required></label>
      <label>Username / Email<input name="emailOrUsername" required></label>
      <label>Password<input name="password" type="password" required></label>
      <label>Role<select name="role"><option value="admin">admin</option><option value="owner">owner</option></select></label>
      <label>Notes<input name="notes"></label>
      <button class="btn" type="submit">Create User</button>
    </form></div>
    <div class="panel admin-table-wrap"><h3>Users</h3><table class="admin-table"><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Active</th><th>Last Login</th><th>Actions</th></tr></thead><tbody>${users.map((u) => `<tr>
      <td>${escapeHtml(u.Name || "")}</td><td>${escapeHtml(u["Email / Username"] || "")}</td><td>${escapeHtml(u.Role || "")}</td><td>${escapeHtml(u.Active || "")}</td><td>${escapeHtml(u["Last Login"] || "")}</td>
      <td><button class="btn btn-sm" data-admin-action="resetPassword" data-id="${escapeHtml(u["User ID"])}" type="button">Reset Password</button> ${String(u.Active).toLowerCase() === "active" ? `<button class="btn btn-sm btn-light" data-admin-action="deactivateUser" data-id="${escapeHtml(u["User ID"])}" type="button">Deactivate</button>` : ""}</td>
    </tr>`).join("")}</tbody></table></div>`;
}

async function refreshAdmin() {
  await loadAdminData();
  renderAdminShell();
}

function formToObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function handleAdminClick(event) {
  const tabButton = event.target.closest(".admin-tab");
  if (tabButton) {
    state.admin.currentTab = tabButton.dataset.tab;
    renderAdminShell();
    return;
  }
  const btn = event.target.closest("[data-admin-action]");
  if (!btn) return;
  const action = btn.dataset.adminAction;
  const id = btn.dataset.id;
  try {
    if (action === "prevMonth") {
      state.admin.calendarDate = new Date(state.admin.calendarDate.getFullYear(), state.admin.calendarDate.getMonth() - 1, 1);
      state.admin.selectedDate = toDateInputValue(state.admin.calendarDate);
      renderAdminTab();
    }
    if (action === "nextMonth") {
      state.admin.calendarDate = new Date(state.admin.calendarDate.getFullYear(), state.admin.calendarDate.getMonth() + 1, 1);
      state.admin.selectedDate = toDateInputValue(state.admin.calendarDate);
      renderAdminTab();
    }
    if (action === "today") {
      state.admin.calendarDate = new Date();
      state.admin.selectedDate = todayIso();
      renderAdminTab();
    }
    if (action === "viewReservation") {
      renderReservationDetailModal(findReservationById(id));
      return;
    }
    if (action === "closeReservationModal") {
      document.querySelector(".modal-backdrop[data-admin-modal='reservation']")?.remove();
      return;
    }
    if (action === "markPaid") {
      if (!confirm("Mark this reservation as fully paid?")) return;
      await adminPost("markReservationFullyPaid", { reservationId: id });
      showAdminMessage("Reservation marked fully paid.");
      document.querySelector(".modal-backdrop[data-admin-modal='reservation']")?.remove();
      await refreshAdmin();
    }
    if (action === "cancelReservation") {
      const reason = prompt("Cancellation reason:");
      if (!reason) return;
      await adminPost("cancelReservation", { reservationId: id, reason });
      showAdminMessage("Reservation canceled.");
      document.querySelector(".modal-backdrop[data-admin-modal='reservation']")?.remove();
      await refreshAdmin();
    }
    if (action === "deactivateUser") {
      if (!confirm("Deactivate this user?")) return;
      await adminPost("deactivateUser", { userId: id });
      showAdminMessage("User deactivated.");
      await refreshAdmin();
    }
    if (action === "resetPassword") {
      const newPassword = prompt("New password for this user:");
      if (!newPassword) return;
      await adminPost("changeUserPassword", { userId: id, newPassword });
      showAdminMessage("Password reset.");
      await refreshAdmin();
    }
  } catch (err) {
    showAdminMessage(err.message, true);
  }
}

function handleCalendarDateClick(event) {
  const day = event.target.closest(".cal-day");
  if (!day) return;
  state.admin.selectedDate = day.dataset.date;
  renderAdminTab();
}


async function handleAdminChange(event) {
  if (event.target.id === "adminManualSessionType") {
    const show = event.target.value === "Location";
    document.querySelectorAll(".admin-location-only").forEach((el) => el.classList.toggle("hidden", !show));
  }
}

async function handleAdminSubmit(event) {
  const form = event.target;
  try {
    if (form.id === "adminLoginForm") {
      event.preventDefault();
      const response = await apiPost({ action: "loginUser", emailOrUsername: document.getElementById("adminUsername").value.trim(), password: document.getElementById("adminPassword").value });
      if (!response.success) throw new Error(getFriendlyError(response, "Invalid login."));
      state.admin.sessionToken = response.data.sessionToken;
      state.admin.user = response.data.user;
      localStorage.setItem("normaAdminSession", state.admin.sessionToken);
      await refreshAdmin();
    }
    if (form.id === "adminReservationDetailForm") {
      event.preventDefault();
      await adminPost("updateReservationFromAdmin", formToObject(form));
      showAdminMessage("Reservation updated.");
      document.querySelector(".modal-backdrop[data-admin-modal='reservation']")?.remove();
      await refreshAdmin();
    }
    if (form.id === "adminManualReservationForm") {
      event.preventDefault();
      await adminPost("addManualReservation", formToObject(form));
      showAdminMessage("Manual reservation added.");
      await refreshAdmin();
    }
    if (form.id === "adminBlockedForm") {
      event.preventDefault();
      await adminPost("addBlockedTime", formToObject(form));
      showAdminMessage("Blocked time added.");
      await refreshAdmin();
    }
    if (form.id === "adminPromoForm") {
      event.preventDefault();
      await adminPost("addPromo", formToObject(form));
      showAdminMessage("Promo added.");
      await refreshAdmin();
    }
    if (form.id === "adminUserForm") {
      event.preventDefault();
      await adminPost("createUser", formToObject(form));
      showAdminMessage("User created.");
      await refreshAdmin();
    }
  } catch (err) {
    showAdminMessage(err.message, true);
  }
}

async function initAdmin() {
  if (!document.body.classList.contains("admin-page")) return;
  document.getElementById("adminTabContent")?.addEventListener("click", handleAdminClick);
  document.getElementById("adminTabContent")?.addEventListener("click", handleCalendarDateClick);
  document.getElementById("adminTabContent")?.addEventListener("submit", handleAdminSubmit);
  document.getElementById("adminTabContent")?.addEventListener("change", handleAdminChange);
  document.getElementById("adminTabs")?.addEventListener("click", handleAdminClick);
  document.getElementById("adminLoginForm")?.addEventListener("submit", handleAdminSubmit);
  document.getElementById("adminLogout")?.addEventListener("click", async () => {
    try { await apiPost({ action: "logoutUser", sessionToken: state.admin.sessionToken }); } catch (_) {}
    localStorage.removeItem("normaAdminSession");
    state.admin.sessionToken = "";
    state.admin.user = null;
    document.getElementById("adminDashboard")?.classList.add("hidden");
    document.getElementById("adminLogin")?.classList.remove("hidden");
  });

  if (state.admin.sessionToken) {
    try {
      const check = await apiPost({ action: "checkUserSession", sessionToken: state.admin.sessionToken });
      if (check.success && check.data.valid) {
        state.admin.user = check.data.user;
        await refreshAdmin();
      }
    } catch (_) {
      localStorage.removeItem("normaAdminSession");
    }
  }
}

function initMobileNav() {
  const btn = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".mobile-menu");
  if (!btn || !nav) return;
  btn.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
    nav.setAttribute("aria-hidden", String(!open));
    btn.textContent = open ? "×" : "☰";
  });
  nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => {
    nav.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    nav.setAttribute("aria-hidden", "true");
    btn.textContent = "☰";
  }));
}

(async function init() {
  await loadPackages();
  await loadAreaFees();
  await loadAvailableDates();
  await initBookingForm();
  await initAdmin();
  initMobileNav();
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
