// Shared package data and business rules for calculations.
const packagePrices = {
  50: { name: "Mini Session", price: 50 },
  100: { name: "Standard Session", price: 100 },
  150: { name: "Premium Session", price: 150 },
  300: { name: "Deluxe Session", price: 300 },
};

const depositRate = 0.5; // 50% deposit rule

// Helper function to format numbers as dollars.
function formatCurrency(value) {
  return `$${value.toFixed(2)}`;
}

// Booking page functionality only runs when booking form exists.
const bookingForm = document.getElementById("bookingForm");
if (bookingForm) {
  const sessionType = document.getElementById("sessionType");
  const packageSelect = document.getElementById("packageSelect");
  const paymentOption = document.getElementById("paymentOption");
  const addressField = document.getElementById("addressField");
  const locationAddress = document.getElementById("locationAddress");

  const totalAmount = document.getElementById("totalAmount");
  const depositAmount = document.getElementById("depositAmount");
  const balanceDue = document.getElementById("balanceDue");
  const dateInput = document.getElementById("dateInput");
  const timeInput = document.getElementById("timeInput");
  const formMessage = document.getElementById("formMessage");

  function updateSummary() {
    const selectedPrice = Number(packageSelect.value);
    const total = packagePrices[selectedPrice].price;
    const deposit = total * depositRate;
    const isFull = paymentOption.value === "full";

    totalAmount.textContent = formatCurrency(total);
    depositAmount.textContent = formatCurrency(deposit);
    balanceDue.textContent = isFull ? formatCurrency(0) : formatCurrency(total - deposit);
  }

  function toggleAddressField() {
    const isLocation = sessionType.value === "Location";
    addressField.classList.toggle("hidden", !isLocation);
    locationAddress.required = isLocation;
  }

  // Validate date/time against business schedule rules.
  function validateSchedule() {
    const selectedDate = dateInput.value ? new Date(`${dateInput.value}T00:00:00`) : null;
    if (!selectedDate) return "Please choose a date.";

    const day = selectedDate.getDay(); // Sunday=0, Monday=1, ... Saturday=6
    if (day === 0) {
      return "We book sessions Monday through Saturday only.";
    }

    const selectedTime = timeInput.value;
    if (!selectedTime) return "Please choose a session time.";

    const [hour, minute] = selectedTime.split(":").map(Number);
    const minutesFromMidnight = hour * 60 + minute;
    const open = 8 * 60;
    const close = 20 * 60;

    if (minutesFromMidnight < open || minutesFromMidnight > close) {
      return "Session time must be between 8:00 AM and 8:00 PM.";
    }

    return "";
  }

  sessionType.addEventListener("change", () => {
    toggleAddressField();
    updateSummary();
  });
  packageSelect.addEventListener("change", updateSummary);
  paymentOption.addEventListener("change", updateSummary);

  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const scheduleError = validateSchedule();

    if (scheduleError) {
      formMessage.textContent = scheduleError;
      formMessage.style.color = "#b91c1c";
      return;
    }

    const buffer = sessionType.value === "Studio" ? 30 : 60;

    // In Phase 1 we only display confirmation text; no backend yet.
    formMessage.textContent = `Booking request received. ${sessionType.value} sessions require a ${buffer}-minute buffer. We will contact you soon to confirm and apply any location travel fee if needed.`;
    formMessage.style.color = "#166534";

    // TODO: In Phase 2, send booking data to backend / Google Apps Script.
    // TODO: In Phase 2, create payment intent via Stripe.
  });

  toggleAddressField();
  updateSummary();
}

// Set dynamic year in footer on pages where the element exists.
const yearEl = document.getElementById("year");
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}
