// Package data (single source of truth): update names, prices, durations, and edited photo counts here.
const packageCatalog = {
  50: { name: "Mini Session", price: 50, duration: "30 minutes", editedPhotos: "10" },
  100: { name: "Standard Session", price: 100, duration: "1 hour", editedPhotos: "20" },
  150: { name: "Premium Session", price: 150, duration: "2 hours", editedPhotos: "30" },
  300: { name: "Deluxe Session", price: 300, duration: "4 hours", editedPhotos: "60+" },
};
const depositRate = 0.5;

function formatCurrency(value) {
  return `$${value.toFixed(2)}`;
}

// Premium but subtle reveal animations for cards/sections.
const revealItems = document.querySelectorAll('.reveal');
if (revealItems.length) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('show');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14 });
  revealItems.forEach((el) => io.observe(el));
}

// Booking page behavior only when form exists.
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
    const total = packageCatalog[Number(packageSelect.value)].price;
    const deposit = total * depositRate;
    totalAmount.textContent = formatCurrency(total);
    depositAmount.textContent = formatCurrency(deposit);
    balanceDue.textContent = paymentOption.value === "full" ? formatCurrency(0) : formatCurrency(total - deposit);
  }

  function toggleAddressField() {
    const isLocation = sessionType.value === "Location";
    addressField.classList.toggle("hidden", !isLocation);
    locationAddress.required = isLocation;
  }

  function validateSchedule() {
    const selectedDate = dateInput.value ? new Date(`${dateInput.value}T00:00:00`) : null;
    if (!selectedDate) return "Please choose a date.";
    if (selectedDate.getDay() === 0) return "We book sessions Monday through Saturday only.";

    const selectedTime = timeInput.value;
    if (!selectedTime) return "Please choose a session time.";

    const [hour, minute] = selectedTime.split(":").map(Number);
    const minutes = hour * 60 + minute;
    if (minutes < 480 || minutes > 1200) return "Session time must be between 8:00 AM and 8:00 PM.";
    return "";
  }

  sessionType.addEventListener("change", () => { toggleAddressField(); updateSummary(); });
  packageSelect.addEventListener("change", updateSummary);
  paymentOption.addEventListener("change", updateSummary);

  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const scheduleError = validateSchedule();
    if (scheduleError) {
      formMessage.textContent = scheduleError;
      formMessage.style.color = "#ff7b7b";
      return;
    }
    const buffer = sessionType.value === "Studio" ? 30 : 60;
    formMessage.textContent = `Booking request received. ${sessionType.value} sessions require a ${buffer}-minute buffer.`;
    formMessage.style.color = "#e0c79c";
  });

  toggleAddressField();
  updateSummary();
}

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();
