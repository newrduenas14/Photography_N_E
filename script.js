const PACKAGES = [
  { id:"mini", name:"Mini Session", price:50, durationMinutes:30, editedPhotos:"10", description:"A quick, polished session for simple portraits or small moments." },
  { id:"standard", name:"Standard Session", price:100, durationMinutes:60, editedPhotos:"20", description:"A balanced session for couples, family, birthdays, or personal portraits." },
  { id:"premium", name:"Premium Session", price:150, durationMinutes:120, editedPhotos:"30", description:"A longer session with more variety, creative direction, and flexibility." },
  { id:"deluxe", name:"Deluxe Session", price:300, durationMinutes:240, editedPhotos:"60+", description:"An extended session for events, detailed storytelling, or multiple looks." }
];
const DEPOSIT_RATE = 0.5;

const formatMoney = (n) => `$${n.toFixed(2)}`;
const durationText = (m) => (m === 60 ? "1 hour" : m > 60 ? `${m / 60} hours` : `${m} minutes`);

function renderPackageCards(containerId, bookingLink = "booking.html") {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = PACKAGES.map((pkg) => `
    <article class="card">
      <h3>${pkg.name}</h3>
      <p>${pkg.description}</p>
      <ul>
        <li><strong>Price:</strong> $${pkg.price}</li>
        <li><strong>Duration:</strong> ${durationText(pkg.durationMinutes)}</li>
        <li><strong>Edited Photos:</strong> ${pkg.editedPhotos}</li>
      </ul>
      <a class="button-link" href="${bookingLink}?package=${pkg.id}">Book this package</a>
    </article>
  `).join("");
}

function renderPackageOptions(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = PACKAGES.map((pkg) => `<option value="${pkg.id}">${pkg.name}</option>`).join("");
}

function getPackageById(id) { return PACKAGES.find((p) => p.id === id) || PACKAGES[0]; }

const bookingForm = document.getElementById("bookingForm");
if (bookingForm) {
  renderPackageOptions("packageSelect");
  const params = new URLSearchParams(location.search);
  if (params.get("package")) document.getElementById("packageSelect").value = params.get("package");

  const sessionType = document.getElementById("sessionType");
  const packageSelect = document.getElementById("packageSelect");
  const paymentOption = document.getElementById("paymentOption");
  const addressField = document.getElementById("addressField");
  const locationAddress = document.getElementById("locationAddress");

  const basePriceEl = document.getElementById("basePrice");
  const extraFeeEl = document.getElementById("extraFee");
  const totalAmount = document.getElementById("totalAmount");
  const depositAmount = document.getElementById("depositAmount");
  const balanceDue = document.getElementById("balanceDue");
  const dateInput = document.getElementById("dateInput");
  const timeInput = document.getElementById("timeInput");
  const formMessage = document.getElementById("formMessage");

  function updateSummary() {
    const pkg = getPackageById(packageSelect.value);
    const extra = sessionType.value === "Location" ? 20 : 0;
    const total = pkg.price + extra;
    const deposit = total * DEPOSIT_RATE;
    basePriceEl.textContent = formatMoney(pkg.price);
    extraFeeEl.textContent = `${formatMoney(extra)} (placeholder, range $20-$100 based on distance)`;
    totalAmount.textContent = formatMoney(total);
    depositAmount.textContent = formatMoney(deposit);
    balanceDue.textContent = paymentOption.value === "full" ? formatMoney(0) : formatMoney(total - deposit);
  }

  function toggleAddressField() {
    const show = sessionType.value === "Location";
    addressField.classList.toggle("hidden", !show);
    locationAddress.required = show;
  }

  function validateSchedule() {
    const date = dateInput.value ? new Date(`${dateInput.value}T00:00:00`) : null;
    if (!date) return "Please choose a preferred date.";
    if (date.getDay() === 0) return "Bookings are available Monday through Saturday.";
    if (!timeInput.value) return "Please choose a preferred time.";
    const [h, m] = timeInput.value.split(":").map(Number);
    const mins = h * 60 + m;
    if (mins < 480 || mins > 1200) return "Booking hours are 8:00 AM to 8:00 PM.";
    return "";
  }

  [sessionType, packageSelect, paymentOption].forEach((el) => el.addEventListener("change", () => { toggleAddressField(); updateSummary(); }));
  bookingForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const err = validateSchedule();
    if (err) { formMessage.textContent = err; return; }
    const buffer = sessionType.value === "Studio" ? 30 : 60;
    formMessage.textContent = `Booking request preview saved. ${sessionType.value} buffer: ${buffer} minutes.`;
  });

  toggleAddressField();
  updateSummary();
}

renderPackageCards("homePackages", "packages.html");
renderPackageCards("packagesList", "booking.html");
renderPackageOptions("adminPackageSelect");

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();
