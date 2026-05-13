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
  ].map(([areaCode, extraFee, requiresManualReview]) => ({ areaCode, areaName: areaCode, extraFee, requiresManualReview: Boolean(requiresManualReview), active: true })),
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
  grid.innerHTML = packages.map((pkg) => `<article class="card"><h3>${pkg.name}</h3><div class="package-summary"><span><strong>Price:</strong> ${formatCurrency(pkg.basePrice)}</span><span><strong>Duration:</strong> ${pkg.durationMinutes} min</span><span><strong>Edited:</strong> ${pkg.editedPhotos}</span></div><button class="text-link package-toggle" type="button" data-package="${pkg.id}">View details</button><p class="package-details" id="details-${pkg.id}">${pkg.description || ""}</p><div class="card-actions"><a href="packages.html">View Package</a><a href="booking.html">Book</a></div></article>`).join("");
  initPackageDetailToggles();
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
  areaCode.innerHTML = '<option value="">Select area/city</option>' + areaFees.map((area) => `<option value="${area.areaCode}">${area.areaName} (+${formatCurrency(area.extraFee)})</option>`).join("");
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
  const bufferMinutes = sessionType === "Location" ? BUSINESS_CONFIG.locationBufferMinutes : BUSINESS_CONFIG.studioBufferMinutes;
  const times = [];
  for (let t = BUSINESS_CONFIG.openingMinutes; t <= BUSINESS_CONFIG.closingMinutes; t += BUSINESS_CONFIG.slotIntervalMinutes) {
    const sessionEnd = t + pkg.durationMinutes;
    const bufferEnd = sessionEnd + bufferMinutes; // For backend blocking use later, not closing-time validation
    void bufferEnd;
    if (sessionEnd <= BUSINESS_CONFIG.closingMinutes) times.push(`${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`);
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
  const area = state.areaFees.find((a) => a.areaCode === areaCode);
  const locationFee = sessionType === "Location" ? (area?.extraFee || 0) : 0;
  const promoDiscount = promoCode && promoCode.trim().toUpperCase() === "DEMO10" ? 10 : 0;
  const total = Math.max(0, pkg.basePrice + locationFee - promoDiscount);
  const deposit = total * BUSINESS_CONFIG.depositRate;
  return { total, deposit, balanceDue: total - deposit, manualReview: Boolean(sessionType === "Location" && area?.requiresManualReview === true) };
}

function updateLocationFieldsVisibility() {
  const sessionType = document.getElementById("sessionType");
  const addressField = document.getElementById("addressField");
  const areaField = document.getElementById("areaField");
  const address = document.getElementById("locationAddress");
  const areaCode = document.getElementById("areaCode");
  const manualReviewMessage = document.getElementById("manualReviewMessage");
  if (!sessionType) return;
  const show = sessionType.value === "Location";
  if (addressField) addressField.style.display = show ? "block" : "none";
  if (areaField) areaField.style.display = show ? "block" : "none";
  if (address) {
    address.required = show;
    if (!show) address.value = "";
  }
  if (areaCode) {
    areaCode.required = show;
    if (!show) areaCode.value = "";
  }
  if (manualReviewMessage && !show) manualReviewMessage.style.display = "none";
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
  const manualReviewMessage = document.getElementById("manualReviewMessage");
  if (manualReviewMessage) {
    manualReviewMessage.style.display = summary.manualReview ? "block" : "none";
  }
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

function initAdminDemo() {
  if (!document.body.classList.contains("admin-page")) return;
  // TEMP ONLY: Replace with USERS tab lookup + hashed password verification via Apps Script.
  const TEMP_USER = { username: "Norma", password: "Eduardo" };
  const adminData = {
    reservations: [
      {id:"R-1001",client:"Ana Flores",phone:"956-555-1201",email:"ana@example.com",occasion:"Family",packageId:"standard",packageName:"Standard Session",basePrice:100,duration:60,editedPhotos:"20",sessionType:"Studio",area:"Studio",address:"N/E Studio, Mission, TX",extraFee:0,total:100,paymentOption:"Deposit",depositRequired:50,amountPaid:50,balanceDue:50,date:"2026-05-18",start:"10:00",end:"11:00",bufferEnd:"11:30",reservationStatus:"Needs Review",paymentStatus:"Partial",notes:"Wants neutral backdrop.",internalNotes:"Check kids seating."},
      {id:"R-1002",client:"Carlos Vega",phone:"956-555-8800",email:"carlos@example.com",occasion:"Graduation",packageId:"premium",packageName:"Premium Session",basePrice:150,duration:120,editedPhotos:"30",sessionType:"Location",area:"McAllen",address:"500 Main St, McAllen, TX",extraFee:20,total:170,paymentOption:"Full",depositRequired:85,amountPaid:170,balanceDue:0,date:"2026-05-20",start:"17:00",end:"19:00",bufferEnd:"21:00",reservationStatus:"Confirmed",paymentStatus:"Paid",notes:"Cap and gown look first.",internalNotes:"Golden hour timing."},
      {id:"R-1003",client:"Maya Ortiz",phone:"956-555-4421",email:"maya@example.com",occasion:"Couple",packageId:"mini",packageName:"Mini Session",basePrice:50,duration:30,editedPhotos:"10",sessionType:"Location",area:"Weslaco",address:"120 Park Ln, Weslaco, TX",extraFee:70,total:120,paymentOption:"Deposit",depositRequired:60,amountPaid:0,balanceDue:120,date:"2026-05-20",start:"09:30",end:"10:00",bufferEnd:"12:00",reservationStatus:"Pending",paymentStatus:"Pending",notes:"Anniversary photos.",internalNotes:"Awaiting location pin."},
      {id:"R-1004",client:"Lena Cruz",phone:"956-555-3390",email:"lena@example.com",occasion:"Maternity",packageId:"deluxe",packageName:"Deluxe Session",basePrice:300,duration:240,editedPhotos:"60+",sessionType:"Studio",area:"Studio",address:"N/E Studio, Mission, TX",extraFee:0,total:300,paymentOption:"Deposit",depositRequired:150,amountPaid:150,balanceDue:150,date:"2026-06-03",start:"14:00",end:"18:00",bufferEnd:"18:30",reservationStatus:"Confirmed",paymentStatus:"Partial",notes:"Bring white dress.",internalNotes:"Prep fan and stool."}
    ],
    blocked:[{date:"2026-05-24",time:"All day",reason:"Holiday"},{date:"2026-06-07",time:"All day",reason:"Studio maintenance"}],
    promos:[{name:"Spring Mini",code:"SPRING10",discountType:"Flat",discountValue:"$10",start:"2026-05-01",end:"2026-05-31",packages:"Mini",active:true}],
    payments:[{date:"2026-05-01",client:"Ana Flores",reservationId:"R-1001",amount:50,method:"Cash App",type:"Deposit",status:"Cleared",balanceDue:50,reference:"CA-111"}],
    clients:[{name:"Ana Flores",phone:"956-555-1201",email:"ana@example.com",totalReservations:2,totalSpent:250,lastSession:"2026-04-14"}],
    activity:[]
  };
  const tabs=["Overview","Calendar","Reservations","Add Reservation","Payments","Promos","Blocked Times","Clients","Settings"];
  const tabEl=document.getElementById("adminTabs"); const content=document.getElementById("adminTabContent");
  let selectedDateIso = new Date().toISOString().slice(0,10); let viewDate = new Date(selectedDateIso+"T12:00:00");

  const fmtMoney=(n)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n||0);
  const iso=(d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const monthLabel=(d)=>d.toLocaleDateString("en-US",{month:"long",year:"numeric"});

  tabEl.innerHTML=tabs.map((t,i)=>`<button class="admin-tab ${i===0?"active":""}" data-tab="${t}">${t}</button>`).join("");

  adminLoginForm.addEventListener("submit",(e)=>{e.preventDefault();if(adminUsername.value.trim()===TEMP_USER.username&&adminPassword.value.trim()===TEMP_USER.password){adminLogin.classList.add("hidden");adminDashboard.classList.remove("hidden");renderTab("Overview");}else adminLoginMessage.textContent="Invalid username or password. Please try again.";});
  adminLogout.addEventListener("click",()=>{adminDashboard.classList.add("hidden");adminLogin.classList.remove("hidden");adminLoginForm.reset();});
  tabEl.addEventListener("click",(e)=>{const b=e.target.closest(".admin-tab");if(!b) return;document.querySelectorAll(".admin-tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderTab(b.dataset.tab);});

  function toast(msg){adminToast.textContent=msg;adminToast.classList.add("show");setTimeout(()=>adminToast.classList.remove("show"),1800);}
  function modal(inner){const d=document.createElement("div");d.className="modal-backdrop";d.innerHTML=`<div class="modal">${inner}<div style="margin-top:.8rem"><button class="btn btn-sm close-modal" type="button">Close</button></div></div>`;document.body.appendChild(d);d.addEventListener("click",(e)=>{if(e.target===d||e.target.classList.contains("close-modal")) d.remove();});}
  function getReservation(id){return adminData.reservations.find(r=>r.id===id);}  
  function openDetails(r){modal(`<h3>Reservation Details</h3><div class="modal-grid"><section><h4>Client</h4><p>ID: ${r.id}<br>${r.client}<br>${r.phone}<br>${r.email}<br>${r.occasion}</p></section><section><h4>Session</h4><p>${r.packageId} · ${r.packageName}<br>Base ${fmtMoney(r.basePrice)} · ${r.duration} min · ${r.editedPhotos} photos<br>${r.sessionType}<br>${r.date} ${r.start}-${r.end} (buffer ${r.bufferEnd})</p></section><section><h4>Location</h4><p>${r.area}<br>${r.address}<br>Extra fee: ${fmtMoney(r.extraFee)}</p></section><section><h4>Payment</h4><p>Option: ${r.paymentOption}<br>Deposit: ${fmtMoney(r.depositRequired)}<br>Paid: ${fmtMoney(r.amountPaid)}<br>Balance: ${fmtMoney(r.balanceDue)}</p></section><section><h4>Status</h4><p>${r.reservationStatus}<br>${r.paymentStatus}</p></section><section><h4>Notes</h4><p>${r.notes}<br><strong>Internal:</strong> ${r.internalNotes}</p></section></div>`);}

  function renderOverview(){
    const review=adminData.reservations.filter(r=>r.reservationStatus==="Needs Review");
    const pending=adminData.reservations.filter(r=>r.paymentStatus==="Pending");
    const canceled=adminData.reservations.filter(r=>r.reservationStatus==="Declined/Canceled");
    const upcoming=adminData.reservations.filter(r=>new Date(r.date+"T00:00:00")>=new Date(new Date().toDateString()));
    const monthNow=new Date();
    const monthRevenue=adminData.reservations.filter(r=>{const d=new Date(r.date+"T00:00:00"); return d.getMonth()===monthNow.getMonth()&&d.getFullYear()===monthNow.getFullYear();}).reduce((a,b)=>a+b.amountPaid,0);
    const deposits=adminData.reservations.reduce((a,b)=>a+Math.min(b.amountPaid,b.depositRequired||0),0);
    const balanceDue=adminData.reservations.reduce((a,b)=>a+b.balanceDue,0);
    const avgValue=adminData.reservations.length?adminData.reservations.reduce((a,b)=>a+b.total,0)/adminData.reservations.length:0;
    const packageCounts=adminData.reservations.reduce((a,r)=>((a[r.packageName]=(a[r.packageName]||0)+1),a),{});
    const topPackage=Object.entries(packageCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]||"No data yet";
    const studioCount=adminData.reservations.filter(r=>r.sessionType==="Studio").length;
    const locationCount=adminData.reservations.filter(r=>r.sessionType==="Location").length;
    const metrics=[
      ["This Month Revenue", fmtMoney(monthRevenue),"Pending backend connection for live totals."],
      ["Deposits Collected", fmtMoney(deposits),"Demo data only until backend sync."],
      ["Balance Due", fmtMoney(balanceDue),"Outstanding balances across reservations."],
      ["Upcoming Sessions", String(upcoming.length),"Scheduled from today onward."],
      ["Pending Payments", String(pending.length),"Requires follow-up."],
      ["Sessions Requiring Review", String(review.length),"Needs manual confirmation."],
      ["Top Package", topPackage, adminData.reservations.length?"Most booked in current dataset.":"No data yet"],
      ["Studio vs Location", `${studioCount} / ${locationCount}`,"Studio count vs location count."],
      ["Canceled Sessions", String(canceled.length),"Declined/Canceled reservations."],
      ["Average Booking Value", fmtMoney(avgValue), adminData.reservations.length?"Average from demo reservations.":"No data yet"]
    ];
    content.innerHTML=`<div class="metric-grid">${metrics.map(m=>`<div class="metric"><h4>${m[0]}</h4><p>${m[1]||"No data yet"}</p><p class="metric-note">${m[2]||"Pending backend connection"}</p></div>`).join("")}</div><div class="panel" style="margin-top:1rem"><h3>Needs Review</h3>${review.map(r=>`<div class="session-item"><strong>${r.client}</strong><span>${r.phone} · ${r.date} · ${r.start}</span><span>${r.packageName} · ${r.area} · <span class="badge">${r.paymentStatus}</span> <span class="badge">${r.reservationStatus}</span></span><div><button class="btn btn-sm review-details" data-id="${r.id}" type="button">Details</button> <button class="btn btn-sm review-accept" data-id="${r.id}" type="button">Accept</button> <button class="btn btn-sm review-info" data-id="${r.id}" type="button">Request Info</button> <button class="btn btn-sm review-decline" data-id="${r.id}" type="button">Decline</button></div></div>`).join("")||"<p>No items.</p>"}</div>`;
  }

  function calendarData(dateIso){const sessions=adminData.reservations.filter(r=>r.date===dateIso);const blocked=adminData.blocked.find(b=>b.date===dateIso);const revenue=sessions.reduce((a,b)=>a+b.amountPaid,0);const needsReview=sessions.some(s=>["Needs Review","Pending"].includes(s.reservationStatus)||s.paymentStatus==="Pending");return {sessions,blocked,revenue,needsReview};}

  function renderDayPanel(dateIso){const panel=document.getElementById("dayPanel"); if(!panel) return; const d=calendarData(dateIso); const title=new Date(dateIso+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"}); panel.innerHTML=`<h4>${title}</h4>${d.blocked?`<p><span class="badge">Blocked</span> ${d.blocked.reason}</p>`:""}${d.sessions.length?d.sessions.map(s=>`<div class="session-item"><strong>${s.start} · ${s.client}</strong><span>${s.phone} · ${s.packageName}</span><span>${s.area} · <span class="badge">${s.paymentStatus}</span> <span class="badge">${s.reservationStatus}</span></span><button class="btn btn-sm day-details" data-id="${s.id}" type="button">Details</button></div>`).join(""):`<p class="muted-text">No sessions scheduled for this day.</p>`}`;}

  function renderCalendar(){const monthStart=new Date(viewDate.getFullYear(),viewDate.getMonth(),1);const startWeekday=monthStart.getDay();const daysInMonth=new Date(viewDate.getFullYear(),viewDate.getMonth()+1,0).getDate();const prevMonthDays=new Date(viewDate.getFullYear(),viewDate.getMonth(),0).getDate(); let cells=""; for(let i=0;i<42;i++){let dayNum, cellDate, outside=false; if(i<startWeekday){dayNum=prevMonthDays-startWeekday+i+1; cellDate=new Date(viewDate.getFullYear(),viewDate.getMonth()-1,dayNum); outside=true;} else if(i>=startWeekday+daysInMonth){dayNum=i-(startWeekday+daysInMonth)+1; cellDate=new Date(viewDate.getFullYear(),viewDate.getMonth()+1,dayNum); outside=true;} else {dayNum=i-startWeekday+1; cellDate=new Date(viewDate.getFullYear(),viewDate.getMonth(),dayNum);} const dateIso=iso(cellDate);const d=calendarData(dateIso);const isToday=dateIso===iso(new Date());const isSelected=dateIso===selectedDateIso;cells+=`<button class="cal-day ${outside?"outside":""} ${isToday?"today":""} ${isSelected?"selected":""}" data-date="${dateIso}" type="button"><div class="day-num">${dayNum}</div>${!outside&&d.blocked?`<span class="badge badge-soft">Blocked</span>`:""}${!outside&&d.sessions.length?`<div class="day-meta">${d.sessions.length} session${d.sessions.length>1?"s":""}</div><div class="day-meta">${fmtMoney(d.revenue)}</div>`:""}${!outside&&d.needsReview?`<span class="badge badge-soft">Review</span>`:""}</button>`;}
    content.innerHTML=`<div class="layout-2"><div class="panel"><div class="calendar-head"><h3>${monthLabel(viewDate)}</h3><div><button class="btn btn-sm cal-prev" type="button">Previous Month</button> <button class="btn btn-sm cal-today" type="button">Today</button> <button class="btn btn-sm cal-next" type="button">Next Month</button></div></div><div class="weekday-row"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div><div class="calendar-grid">${cells}</div></div><aside id="dayPanel" class="side-panel"></aside></div>`;
    renderDayPanel(selectedDateIso);
  }

  function renderTab(tab){if(tab==="Overview") return renderOverview(); if(tab==="Calendar") return renderCalendar(); if(tab==="Reservations") content.innerHTML=`<div class="panel"><table class="admin-table"><thead><tr><th>Client</th><th>Phone</th><th>Date</th><th>Time</th><th>Package</th><th>Type</th><th>Area</th><th>Payment</th><th>Status</th><th>Balance</th><th></th></tr></thead><tbody>${adminData.reservations.map(r=>`<tr><td>${r.client}</td><td>${r.phone}</td><td>${r.date}</td><td>${r.start}</td><td>${r.packageName}</td><td>${r.sessionType}</td><td>${r.area}</td><td><span class="badge">${r.paymentStatus}</span></td><td><span class="badge">${r.reservationStatus}</span></td><td>${fmtMoney(r.balanceDue)}</td><td><button class="btn btn-sm row-details" data-id="${r.id}">Details</button></td></tr>`).join("")}</tbody></table></div>`; if(tab==="Add Reservation") content.innerHTML=`<div class="panel"><form id="addReservationForm" class="form-panel"><label>Client name<input required/></label><label>Phone<input required/></label><label>Email<input type="email" required/></label><label>Occasion<input/></label><label>Package<select><option>Mini Session</option><option>Standard Session</option><option>Premium Session</option><option>Deluxe Session</option></select></label><label>Session type<select id="adminSessionType"><option>Studio</option><option>Location</option></select></label><label id="cityField">Area/city<select><option>Mission</option><option>McAllen</option><option>Weslaco</option></select></label><label id="addressFieldAdmin">Location address<input/></label><label>Session date<input type="date" required/></label><label>Start time<input type="time" required/></label><label>Payment option<select><option>Deposit</option><option>Full</option></select></label><label>Amount paid<input type="number" min="0" required/></label><label>Reservation status<select><option>Pending</option><option>Needs Review</option><option>Confirmed</option></select></label><label>Payment status<select><option>Pending</option><option>Partial</option><option>Paid</option></select></label><label>Notes<textarea></textarea></label><label>Internal notes<textarea></textarea></label><button class="btn" type="submit">Add Reservation</button></form></div>`; if(tab==="Payments") content.innerHTML=`<div class="panel"><table class="admin-table"><thead><tr><th>Date</th><th>Client</th><th>Reservation ID</th><th>Amount</th><th>Method</th><th>Payment Type</th><th>Status</th><th>Balance Due</th><th></th></tr></thead><tbody>${adminData.payments.map(p=>`<tr><td>${p.date}</td><td>${p.client}</td><td>${p.reservationId}</td><td>${fmtMoney(p.amount)}</td><td>${p.method}</td><td>${p.type}</td><td>${p.status}</td><td>${fmtMoney(p.balanceDue)}</td><td><button class="btn btn-sm payment-details" data-id="${p.reservationId}">Details</button></td></tr>`).join("")}</tbody></table></div>`; if(tab==="Promos") content.innerHTML=`<div class="panel"><button class="btn btn-sm" id="addPromoBtn" type="button">Add Promo</button><table class="admin-table"><thead><tr><th>Promo name</th><th>Code</th><th>Discount type</th><th>Value</th><th>Start</th><th>End</th><th>Packages</th><th>Active</th></tr></thead><tbody>${adminData.promos.map(p=>`<tr><td>${p.name}</td><td>${p.code}</td><td>${p.discountType}</td><td>${p.discountValue}</td><td>${p.start}</td><td>${p.end}</td><td>${p.packages}</td><td>${p.active?"Yes":"No"}</td></tr>`).join("")}</tbody></table></div>`; if(tab==="Blocked Times") content.innerHTML=`<div class="panel"><button class="btn btn-sm" id="addBlockedBtn" type="button">Add Blocked Time</button><table class="admin-table"><thead><tr><th>Date</th><th>Time</th><th>Reason</th></tr></thead><tbody>${adminData.blocked.map(b=>`<tr><td>${b.date}</td><td>${b.time}</td><td>${b.reason}</td></tr>`).join("")}</tbody></table></div>`; if(tab==="Clients") content.innerHTML=`<div class="panel"><table class="admin-table"><thead><tr><th>Client</th><th>Phone</th><th>Email</th><th>Total reservations</th><th>Total spent</th><th>Last session date</th><th></th></tr></thead><tbody>${adminData.clients.map(c=>`<tr><td>${c.name}</td><td>${c.phone}</td><td>${c.email}</td><td>${c.totalReservations}</td><td>${fmtMoney(c.totalSpent)}</td><td>${c.lastSession}</td><td><button class="btn btn-sm client-details" data-id="${c.email}">Details</button></td></tr>`).join("")}</tbody></table></div>`; if(tab==="Settings") content.innerHTML=`<div class="panel"><ul><li>Currency: USD</li><li>Timezone: America/Chicago / RGV Time</li><li>Work days: Monday-Saturday</li><li>Work hours: 8:00 AM-8:00 PM</li><li>Studio buffer: 30 minutes</li><li>Location buffer: 120 minutes</li><li>Deposit: 50%</li><li>Slot interval: 30 minutes</li></ul><button class="btn btn-sm" id="saveSettingsBtn" type="button">Save Settings (Demo)</button></div>`;}

  content.addEventListener("click",(e)=>{const t=e.target; const id=t.dataset.id; if(t.classList.contains("row-details")||t.classList.contains("review-details")||t.classList.contains("day-details")||t.classList.contains("payment-details")){const r=getReservation(id); if(r) openDetails(r);} if(t.classList.contains("review-accept")){const r=getReservation(id); if(r){r.reservationStatus="Confirmed"; toast("Reservation accepted"); renderOverview();}} if(t.classList.contains("review-info")){modal(`<h3>Request Info</h3><label>Message<textarea id="reqMsg"></textarea></label><button class="btn btn-sm" id="saveReq" type="button">Save</button>`);} if(t.id==="saveReq"){adminData.activity.push({id:"manual",message:document.getElementById("reqMsg")?.value||"",date:new Date().toISOString()});document.querySelector(".modal-backdrop")?.remove();toast("Info request saved");} if(t.classList.contains("review-decline")){const reason=prompt("Reason for decline/cancel?"); if(reason){const r=getReservation(id); r.reservationStatus="Declined/Canceled"; r.internalNotes+=` | Decline reason: ${reason}`; toast("Reservation declined"); renderOverview();}} if(t.id==="addPromoBtn"){modal("<h3>Add Promo (Demo)</h3><p>Promo action saved in demo mode.</p>");} if(t.id==="addBlockedBtn"){modal("<h3>Add Blocked Time (Demo)</h3><p>Blocked time action is ready for Apps Script integration.</p>");} if(t.id==="saveSettingsBtn") toast("Settings saved in demo mode"); if(t.classList.contains("cal-prev")){viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth()-1,1);selectedDateIso=iso(viewDate);renderCalendar();} if(t.classList.contains("cal-next")){viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth()+1,1);selectedDateIso=iso(viewDate);renderCalendar();} if(t.classList.contains("cal-today")){const today=new Date();viewDate=new Date(today.getFullYear(),today.getMonth(),1);selectedDateIso=iso(today);renderCalendar();} const day=t.closest(".cal-day"); if(day){selectedDateIso=day.dataset.date; renderCalendar();}});
  content.addEventListener("change",(e)=>{if(e.target.id==="adminSessionType"){const show=e.target.value==="Location";document.getElementById("cityField").style.display=show?"grid":"none";document.getElementById("addressFieldAdmin").style.display=show?"grid":"none";}});
  content.addEventListener("submit",(e)=>{if(e.target.id==="addReservationForm"){e.preventDefault();toast("Demo reservation saved locally");}});
}
initAdminDemo();


function initMobileNav(){
  const btn=document.querySelector(".menu-toggle");
  const nav=document.querySelector(".mobile-menu");
  if(!btn||!nav)return;
  btn.addEventListener("click",()=>{
    const open=nav.classList.toggle("open");
    btn.setAttribute("aria-expanded",String(open));
    nav.setAttribute("aria-hidden",String(!open));
    btn.textContent=open?"×":"☰";
  });
  nav.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{
    nav.classList.remove("open");
    btn.setAttribute("aria-expanded","false");
    nav.setAttribute("aria-hidden","true");
    btn.textContent="☰";
  }));
}

function initPackageDetailToggles(){
  document.querySelectorAll('.package-toggle').forEach((btn)=>{
    btn.addEventListener('click',()=>{
      const details=document.getElementById(`details-${btn.dataset.package}`);
      if(!details) return;
      const open=details.classList.toggle('open');
      btn.textContent=open?'Hide details':'View details';
    });
  });
}

initMobileNav();
initPackageDetailToggles();
