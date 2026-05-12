const APPS_SCRIPT_URL = "";

const BUSINESS_CONFIG = {
  currency: "USD",
  timezone: "America/Chicago",
  openingMinutes: 8 * 60,
  closingMinutes: 20 * 60,
  slotIntervalMinutes: 30,
  studioBufferMinutes: 30,
  locationBufferMinutes: 120,
  depositRate: 0.5,
};

const FALLBACK_DATA = {
  packages: [
    { id: "mini", name: "Mini Session", basePrice: 50, durationMinutes: 30, editedPhotos: "10", allowStudio: true, allowLocation: true, active: true, description: "A quick, polished session for simple portraits or small moments." },
    { id: "standard", name: "Standard Session", basePrice: 100, durationMinutes: 60, editedPhotos: "20", allowStudio: true, allowLocation: true, active: true, description: "A balanced session for couples, family, birthdays, or personal portraits." },
    { id: "premium", name: "Premium Session", basePrice: 150, durationMinutes: 120, editedPhotos: "30", allowStudio: true, allowLocation: true, active: true, description: "A longer session with more variety, creative direction, and flexibility." },
    { id: "deluxe", name: "Deluxe Session", basePrice: 300, durationMinutes: 240, editedPhotos: "60+", allowStudio: true, allowLocation: true, active: true, description: "A full extended session for events, detailed storytelling, or multiple looks." }
  ],
  areaFees: [
    ["MISSION",0,false],["PALMVIEW",0,false],["MCALLEN",20,false],["LA JOYA",30,false],["EDINGBURG",50,false],["PHARR",50,false],["ALAMO",50,false],["SAN JUAN",50,false],["HIDALGO",50,false],["WESLACO",70,false],["DONNA",70,false],["RIO GRANDE CITY",70,false],["MERCEDES",90,true],["ROMA",90,true],["BROWNSVILLE",110,true],["HARLINGEN",110,true],["SAN BENITO",110,true],["LOS FRESNOS",110,true],["PORT ISABEL",110,true],["SOUTH PADRE ISLAND",110,true],["LAGUNA VISTA",110,true],["RAYMONDVILLE",110,true],["LYFORD",110,true],["SAN PERLITA",110,true]
  ].map(([code, fee, manualReview]) => ({ code, fee, manualReview, active: true })),
  blockedDates: ["2026-05-17", "2026-05-24", "2026-06-07"],
};

const state = { packages: [], areaFees: [], unavailableDates: new Set(), blockedDates: new Set(FALLBACK_DATA.blockedDates) };

const formatCurrency = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: BUSINESS_CONFIG.currency }).format(value || 0);
const toMinutes = (hhmm) => { const [h,m] = hhmm.split(":").map(Number); return (h*60)+m; };
const toTimeLabel = (mins) => new Date(2000,0,1,Math.floor(mins/60),mins%60).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

async function apiGet(endpoint) {
  if (!APPS_SCRIPT_URL) return { success: false };
  const res = await fetch(`${APPS_SCRIPT_URL}?endpoint=${encodeURIComponent(endpoint)}`);
  return res.json();
}

async function loadPackages() {
  // Future Apps Script call: GET packages
  const response = APPS_SCRIPT_URL ? await apiGet("packages") : { success: false };
  state.packages = response.success ? response.data : FALLBACK_DATA.packages.filter((p) => p.active);
  renderPackages(state.packages);
  populatePackageDropdown(state.packages);
}

function renderPackages(packages) {
  const grid = document.getElementById("packagesGrid");
  if (!grid) return;
  grid.innerHTML = packages.map((pkg) => `<article class="card"><h3>${pkg.name}</h3><p>${pkg.description || ""}</p><ul><li>${pkg.durationMinutes} min</li><li>${pkg.editedPhotos} edited photos</li><li>${formatCurrency(pkg.basePrice)}</li></ul><a class="button-link" href="booking.html">Book this package</a></article>`).join("");
}

function populatePackageDropdown(packages) {
  const select = document.getElementById("packageSelect");
  if (!select) return;
  select.innerHTML = '<option value="">Select a package</option>' + packages.map((pkg) => `<option value="${pkg.id}">${pkg.name} (${formatCurrency(pkg.basePrice)})</option>`).join("");
}

async function loadAreaFees() {
  // Future Apps Script call: GET distanceFees
  const response = APPS_SCRIPT_URL ? await apiGet("distanceFees") : { success: false };
  state.areaFees = response.success ? response.data : FALLBACK_DATA.areaFees.filter((a) => a.active);
  populateAreaDropdown(state.areaFees);
}

function populateAreaDropdown(areaFees) {
  const areaCode = document.getElementById("areaCode");
  if (!areaCode) return;
  areaCode.innerHTML = '<option value="">Select area/city</option>' + areaFees.map((area) => `<option value="${area.code}">${area.code} (+${formatCurrency(area.fee)})</option>`).join("");
}

async function loadAvailableDates() {
  // Future Apps Script call: GET availableDates
  const dateInput = document.getElementById("dateInput");
  if (!dateInput) return;
  const today = new Date();
  dateInput.min = today.toISOString().split("T")[0];
  const help = document.getElementById("dateHelp");
  if (help) help.textContent = `Sundays and blocked dates are unavailable. Blocked: ${[...state.blockedDates].join(", ")}`;
}

async function loadAvailableTimes(date, packageId, sessionType, areaCode) {
  // Future Apps Script call: GET availableTimes
  const pkg = state.packages.find((p) => p.id === packageId);
  if (!pkg || !date || !sessionType) return [];
  const d = new Date(`${date}T00:00:00`);
  if (d.getDay() === 0 || state.blockedDates.has(date)) return [];
  const buffer = sessionType === "Location" ? BUSINESS_CONFIG.locationBufferMinutes : BUSINESS_CONFIG.studioBufferMinutes;
  const blockMinutes = pkg.durationMinutes + buffer;
  const times = [];
  for (let t = BUSINESS_CONFIG.openingMinutes; t <= BUSINESS_CONFIG.closingMinutes; t += BUSINESS_CONFIG.slotIntervalMinutes) {
    if ((t + blockMinutes) <= BUSINESS_CONFIG.closingMinutes) times.push(`${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`);
  }
  return times;
}

function populateAvailableTimes(times) {
  const timeInput = document.getElementById("timeInput");
  if (!timeInput) return;
  timeInput.innerHTML = '<option value="">Select a time</option>' + times.map((t) => `<option value="${t}">${toTimeLabel(toMinutes(t))}</option>`).join("");
}

async function calculatePricePreview(packageId, sessionType, areaCode, promoCode) {
  // Future Apps Script call: POST calculatePrice
  const pkg = state.packages.find((p) => p.id === packageId);
  if (!pkg) return { total: 0, deposit: 0, balanceDue: 0, manualReview: false };
  const area = state.areaFees.find((a) => a.code === areaCode);
  const locationFee = sessionType === "Location" ? (area?.fee || 0) : 0;
  const promoDiscount = promoCode && promoCode.trim().toUpperCase() === "DEMO10" ? 10 : 0;
  const total = Math.max(0, pkg.basePrice + locationFee - promoDiscount);
  const deposit = total * BUSINESS_CONFIG.depositRate;
  return { total, deposit, balanceDue: total - deposit, manualReview: Boolean(area?.manualReview && sessionType === "Location") };
}

function updateLocationFieldsVisibility() {
  const sessionType = document.getElementById("sessionType");
  const addressField = document.getElementById("addressField");
  const areaField = document.getElementById("areaField");
  const address = document.getElementById("locationAddress");
  const areaCode = document.getElementById("areaCode");
  if (!sessionType) return;
  const show = sessionType.value === "Location";
  addressField.classList.toggle("hidden", !show);
  areaField.classList.toggle("hidden", !show);
  if (address) address.required = show;
  if (areaCode) areaCode.required = show;
}

function validateBookingForm() {
  const form = document.getElementById("bookingForm");
  const date = document.getElementById("dateInput").value;
  if (!form.checkValidity()) return "Please complete all required fields.";
  const selected = new Date(`${date}T00:00:00`);
  const today = new Date(); today.setHours(0,0,0,0);
  if (selected < today) return "Past dates are unavailable.";
  if (selected.getDay() === 0) return "Sunday is unavailable. Please pick Monday-Saturday.";
  if (state.blockedDates.has(date)) return "This date is blocked. Please choose another date.";
  return "";
}

async function refreshTimesAndPrice() {
  const date = document.getElementById("dateInput")?.value;
  const packageId = document.getElementById("packageSelect")?.value;
  const sessionType = document.getElementById("sessionType")?.value;
  const areaCode = document.getElementById("areaCode")?.value;
  const promoCode = document.getElementById("promoCode")?.value;
  const paymentOption = document.getElementById("paymentOption")?.value;
  const times = await loadAvailableTimes(date, packageId, sessionType, areaCode);
  populateAvailableTimes(times);
  const summary = await calculatePricePreview(packageId, sessionType, areaCode, promoCode);
  document.getElementById("totalAmount").textContent = formatCurrency(summary.total);
  document.getElementById("depositAmount").textContent = formatCurrency(summary.deposit);
  document.getElementById("balanceDue").textContent = paymentOption === "full" ? formatCurrency(0) : formatCurrency(summary.balanceDue);
  document.getElementById("manualReviewMessage").classList.toggle("hidden", !summary.manualReview);
}

(async function init() {
  await loadPackages();
  await loadAreaFees();
  await loadAvailableDates();

  const bookingForm = document.getElementById("bookingForm");
  if (bookingForm) {
    ["packageSelect","dateInput","sessionType","areaCode","promoCode","paymentOption"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", async () => { updateLocationFieldsVisibility(); await refreshTimesAndPrice(); });
    });
    updateLocationFieldsVisibility();
    await refreshTimesAndPrice();
    bookingForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formMessage = document.getElementById("formMessage");
      const error = validateBookingForm();
      if (error) {
        formMessage.textContent = error;
        formMessage.style.color = "#ff7b7b";
        return;
      }
      // Future Apps Script call: POST createPendingCheckout
      formMessage.textContent = "Validation complete. Backend connection pending (Google Apps Script endpoint not connected yet).";
      formMessage.style.color = "#e0c79c";
    });
  }

  const revealItems = document.querySelectorAll('.reveal');
  if (revealItems.length) {
    const io = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('show'); io.unobserve(entry.target); } }), { threshold: 0.14 });
    revealItems.forEach((el) => io.observe(el));
  }

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
