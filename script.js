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
  if (!document.body.classList.contains('admin-page')) return;
  // TEMP ONLY: Replace this with USERS sheet lookup + hashed password verification in Apps Script.
  const TEMP_USER = { username: 'Norma', password: 'Eduardo' };
  const adminData = {
    reservations: [
      {id:'R-1001',client:'Ana Flores',phone:'956-555-1201',email:'ana@example.com',occasion:'Family',packageId:'standard',packageName:'Standard Session',basePrice:100,duration:60,editedPhotos:'20',sessionType:'Studio',area:'Studio',address:'N/E Studio, Mission, TX',extraFee:0,total:100,paymentOption:'Deposit',depositRequired:50,amountPaid:50,balanceDue:50,date:'2026-05-18',start:'10:00',end:'11:00',bufferEnd:'11:30',reservationStatus:'Needs Review',paymentStatus:'Partial',notes:'Wants neutral backdrop.',internalNotes:'Check kids seating.'},
      {id:'R-1002',client:'Carlos Vega',phone:'956-555-8800',email:'carlos@example.com',occasion:'Graduation',packageId:'premium',packageName:'Premium Session',basePrice:150,duration:120,editedPhotos:'30',sessionType:'Location',area:'McAllen',address:'500 Main St, McAllen, TX',extraFee:20,total:170,paymentOption:'Full',depositRequired:85,amountPaid:170,balanceDue:0,date:'2026-05-20',start:'17:00',end:'19:00',bufferEnd:'21:00',reservationStatus:'Confirmed',paymentStatus:'Paid',notes:'Cap and gown look first.',internalNotes:'Golden hour timing.'},
      {id:'R-1003',client:'Maya Ortiz',phone:'956-555-4421',email:'maya@example.com',occasion:'Couple',packageId:'mini',packageName:'Mini Session',basePrice:50,duration:30,editedPhotos:'10',sessionType:'Location',area:'Weslaco',address:'120 Park Ln, Weslaco, TX',extraFee:70,total:120,paymentOption:'Deposit',depositRequired:60,amountPaid:0,balanceDue:120,date:'2026-05-21',start:'09:30',end:'10:00',bufferEnd:'12:00',reservationStatus:'Pending',paymentStatus:'Pending',notes:'Anniversary photos.',internalNotes:'Awaiting final location pin.'}
    ],
    payments:[{date:'2026-05-01',client:'Ana Flores',reservationId:'R-1001',amount:50,method:'Cash App',type:'Deposit',status:'Cleared',balanceDue:50,reference:'CA-111'},{date:'2026-05-03',client:'Carlos Vega',reservationId:'R-1002',amount:170,method:'Zelle',type:'Full',status:'Cleared',balanceDue:0,reference:'ZL-882'}],
    promos:[{name:'Spring Mini',code:'SPRING10',discountType:'Flat',discountValue:'$10',start:'2026-05-01',end:'2026-05-31',packages:'Mini',active:true}],
    blocked:[{date:'2026-05-24',time:'All day',reason:'Holiday'},{date:'2026-05-28',time:'1:00 PM-4:00 PM',reason:'Equipment maintenance'}],
    clients:[{name:'Ana Flores',phone:'956-555-1201',email:'ana@example.com',totalReservations:2,totalSpent:250,lastSession:'2026-04-14'}],
    activity:[]
  };
  const tabs=['Overview','Calendar','Reservations','Add Reservation','Payments','Promos','Blocked Times','Clients','Settings'];
  const tabEl=document.getElementById('adminTabs');const content=document.getElementById('adminTabContent');
  tabEl.innerHTML=tabs.map((t,i)=>`<button class="admin-tab ${i===0?'active':''}" data-tab="${t}">${t}</button>`).join('');

  const loginForm=document.getElementById('adminLoginForm');
  loginForm.addEventListener('submit',(e)=>{e.preventDefault();const u=adminUsername.value.trim();const p=adminPassword.value.trim();if(u===TEMP_USER.username&&p===TEMP_USER.password){adminLogin.classList.add('hidden');adminDashboard.classList.remove('hidden');renderTab('Overview');}else{adminLoginMessage.textContent='Invalid username or password. Please try again.';}});
  adminLogout.addEventListener('click',()=>{adminDashboard.classList.add('hidden');adminLogin.classList.remove('hidden');loginForm.reset();});
  tabEl.addEventListener('click',(e)=>{const b=e.target.closest('.admin-tab');if(!b) return;document.querySelectorAll('.admin-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderTab(b.dataset.tab);});

  function toast(msg){const t=document.getElementById('adminToast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
  function modal(inner){const d=document.createElement('div');d.className='modal-backdrop';d.innerHTML=`<div class="modal">${inner}<div style="margin-top:.8rem"><button class="btn btn-sm close-modal">Close</button></div></div>`;document.body.appendChild(d);d.addEventListener('click',e=>{if(e.target===d||e.target.classList.contains('close-modal'))d.remove();});}
  function details(r){modal(`<h3>Reservation Details</h3><div class='modal-grid'>
  <section><h4>Client</h4><p>${r.id}<br>${r.client}<br>${r.phone}<br>${r.email}<br>${r.occasion}</p></section>
  <section><h4>Session</h4><p>${r.packageId} · ${r.packageName}<br>${r.basePrice} base · ${r.duration} min · ${r.editedPhotos} photos<br>${r.sessionType}<br>${r.date} ${r.start}-${r.end} (buffer ${r.bufferEnd})</p></section>
  <section><h4>Location</h4><p>${r.area}<br>${r.address}<br>Extra fee: $${r.extraFee}</p></section>
  <section><h4>Payment</h4><p>Option: ${r.paymentOption}<br>Deposit: $${r.depositRequired}<br>Paid: $${r.amountPaid}<br>Balance: $${r.balanceDue}</p></section>
  <section><h4>Status</h4><p>${r.reservationStatus}<br>${r.paymentStatus}</p></section>
  <section><h4>Notes</h4><p>${r.notes}<br><strong>Internal:</strong> ${r.internalNotes}</p></section></div>`)}

  function renderTab(tab){
    if(tab==='Overview'){const rev=adminData.reservations.reduce((a,b)=>a+b.amountPaid,0);const bal=adminData.reservations.reduce((a,b)=>a+b.balanceDue,0);const review=adminData.reservations.filter(r=>r.reservationStatus==='Needs Review');content.innerHTML=`<div class='metric-grid'>
    <div class='metric'><h4>This Month Revenue</h4><p>$${rev}</p></div><div class='metric'><h4>Deposits Collected</h4><p>$${adminData.payments.filter(p=>p.type==='Deposit').reduce((a,b)=>a+b.amount,0)}</p></div><div class='metric'><h4>Balance Due</h4><p>$${bal}</p></div><div class='metric'><h4>Upcoming Sessions</h4><p>${adminData.reservations.length}</p></div><div class='metric'><h4>Pending Payments</h4><p>${adminData.reservations.filter(r=>r.paymentStatus==='Pending').length}</p></div><div class='metric'><h4>Sessions Requiring Review</h4><p>${review.length}</p></div><div class='metric'><h4>Top Package</h4><p>Standard Session</p></div><div class='metric'><h4>Studio vs Location</h4><p>1 / 2</p></div><div class='metric'><h4>Canceled Sessions</h4><p>${adminData.reservations.filter(r=>r.reservationStatus.includes('Declined')).length}</p></div><div class='metric'><h4>Average Booking Value</h4><p>$${Math.round(adminData.reservations.reduce((a,b)=>a+b.total,0)/adminData.reservations.length)}</p></div>
    </div><div class='panel' style='margin-top:1rem'><h3>Needs Review</h3>${review.map(r=>`<div class='session-item'><strong>${r.client}</strong><span>${r.date} · ${r.start} · ${r.packageName}</span><div><button class='btn btn-sm review-details' data-id='${r.id}'>Details</button> <button class='btn btn-sm review-accept' data-id='${r.id}'>Accept</button> <button class='btn btn-sm review-info' data-id='${r.id}'>Request Info</button> <button class='btn btn-sm review-decline' data-id='${r.id}'>Decline</button></div></div>`).join('')||'<p>No items.</p>'}</div>`;
    }
    if(tab==='Calendar'){const byDate={};adminData.reservations.forEach(r=>(byDate[r.date]??=[]).push(r));let days='';for(let d=1;d<=31;d++){const date=`2026-05-${String(d).padStart(2,'0')}`;days+=`<button class='cal-day' data-date='${date}'><div>${d}</div>${byDate[date]?'<span class="cal-dot"></span>':''}</button>`;}content.innerHTML=`<div class='layout-2'><div class='panel'><h3>May 2026</h3><div class='calendar-grid'>${days}</div></div><aside id='dayPanel' class='side-panel'><h4>Day Sessions</h4><p>Select a day.</p></aside></div>`;}
    if(tab==='Reservations'){content.innerHTML=`<div class='panel'><table class='admin-table'><thead><tr><th>Client</th><th>Phone</th><th>Date</th><th>Time</th><th>Package</th><th>Type</th><th>Area</th><th>Payment</th><th>Status</th><th>Balance</th><th></th></tr></thead><tbody>${adminData.reservations.map(r=>`<tr><td>${r.client}</td><td>${r.phone}</td><td>${r.date}</td><td>${r.start}</td><td>${r.packageName}</td><td>${r.sessionType}</td><td>${r.area}</td><td><span class='badge'>${r.paymentStatus}</span></td><td><span class='badge'>${r.reservationStatus}</span></td><td>$${r.balanceDue}</td><td><button class='btn btn-sm row-details' data-id='${r.id}'>Details</button></td></tr>`).join('')}</tbody></table></div>`;}
    if(tab==='Add Reservation'){content.innerHTML=`<div class='panel'><form id='addReservationForm' class='form-panel'><label>Client name<input required name='client'/></label><label>Phone<input required name='phone'/></label><label>Email<input type='email' required name='email'/></label><label>Occasion<input name='occasion'/></label><label>Package<select name='package'><option>Mini Session</option><option>Standard Session</option><option>Premium Session</option><option>Deluxe Session</option></select></label><label>Session type<select id='adminSessionType' name='type'><option>Studio</option><option>Location</option></select></label><label id='cityField'>Area/city<select><option>Mission</option><option>McAllen</option><option>Weslaco</option></select></label><label id='addressFieldAdmin'>Location address<input /></label><label>Session date<input type='date' required name='date'/></label><label>Start time<input type='time' required name='time'/></label><label>Payment option<select><option>Deposit</option><option>Full</option></select></label><label>Amount paid<input type='number' min='0' required/></label><label>Reservation status<select><option>Pending</option><option>Needs Review</option><option>Confirmed</option></select></label><label>Payment status<select><option>Pending</option><option>Partial</option><option>Paid</option></select></label><label>Notes<textarea></textarea></label><label>Internal notes<textarea></textarea></label><button class='btn' type='submit'>Save Demo Reservation</button></form></div>`;}
    if(tab==='Payments'){content.innerHTML=`<div class='panel'><table class='admin-table'><thead><tr><th>Date</th><th>Client</th><th>Reservation ID</th><th>Amount</th><th>Method</th><th>Payment Type</th><th>Status</th><th>Balance Due</th><th></th></tr></thead><tbody>${adminData.payments.map(p=>`<tr><td>${p.date}</td><td>${p.client}</td><td>${p.reservationId}</td><td>$${p.amount}</td><td>${p.method}</td><td>${p.type}</td><td>${p.status}</td><td>$${p.balanceDue}</td><td><button class='btn btn-sm payment-details' data-id='${p.reservationId}'>Details</button></td></tr>`).join('')}</tbody></table></div>`;}
    if(tab==='Promos'){content.innerHTML=`<div class='panel'><button class='btn btn-sm' id='addPromoBtn'>Add Promo</button><table class='admin-table'><thead><tr><th>Promo name</th><th>Code</th><th>Discount type</th><th>Value</th><th>Start</th><th>End</th><th>Packages</th><th>Active</th></tr></thead><tbody>${adminData.promos.map(p=>`<tr><td>${p.name}</td><td>${p.code}</td><td>${p.discountType}</td><td>${p.discountValue}</td><td>${p.start}</td><td>${p.end}</td><td>${p.packages}</td><td>${p.active?'Yes':'No'}</td></tr>`).join('')}</tbody></table></div>`;}
    if(tab==='Blocked Times'){content.innerHTML=`<div class='panel'><button class='btn btn-sm' id='addBlockedBtn'>Add Blocked Time</button><table class='admin-table'><thead><tr><th>Date</th><th>Time</th><th>Reason</th></tr></thead><tbody>${adminData.blocked.map(b=>`<tr><td>${b.date}</td><td>${b.time}</td><td>${b.reason}</td></tr>`).join('')}</tbody></table></div>`;}
    if(tab==='Clients'){content.innerHTML=`<div class='panel'><table class='admin-table'><thead><tr><th>Client</th><th>Phone</th><th>Email</th><th>Total reservations</th><th>Total spent</th><th>Last session date</th><th></th></tr></thead><tbody>${adminData.clients.map(c=>`<tr><td>${c.name}</td><td>${c.phone}</td><td>${c.email}</td><td>${c.totalReservations}</td><td>$${c.totalSpent}</td><td>${c.lastSession}</td><td><button class='btn btn-sm client-details' data-id='${c.email}'>Details</button></td></tr>`).join('')}</tbody></table></div>`;}
    if(tab==='Settings'){content.innerHTML=`<div class='panel'><ul><li>Currency: USD</li><li>Timezone: America/Chicago / RGV Time</li><li>Work days: Monday-Saturday</li><li>Work hours: 8:00 AM-8:00 PM</li><li>Studio buffer: 30 minutes</li><li>Location buffer: 120 minutes</li><li>Deposit: 50%</li><li>Slot interval: 30 minutes</li></ul></div>`;}
  }

  content.addEventListener('click',(e)=>{const id=e.target.dataset.id; if(e.target.classList.contains('row-details')||e.target.classList.contains('review-details')) details(adminData.reservations.find(r=>r.id===id)); if(e.target.classList.contains('review-accept')){const r=adminData.reservations.find(r=>r.id===id);r.reservationStatus='Confirmed';toast('Reservation accepted');renderTab('Overview');} if(e.target.classList.contains('review-info')){modal(`<h3>Request Info</h3><label>Message<textarea id='reqMsg'></textarea></label><button class='btn btn-sm' id='saveReq'>Save</button>`);document.addEventListener('click',function s(ev){if(ev.target.id==='saveReq'){adminData.activity.push({id,message:document.getElementById('reqMsg').value,date:new Date().toISOString()});toast('Info request saved');document.querySelector('.modal-backdrop')?.remove();document.removeEventListener('click',s);}});} if(e.target.classList.contains('review-decline')){const reason=prompt('Reason for decline/cancel?');if(reason){const r=adminData.reservations.find(r=>r.id===id);r.reservationStatus='Declined/Canceled';r.internalNotes+=` | Decline reason: ${reason}`;toast('Reservation declined');renderTab('Overview');}}});
  content.addEventListener('change',(e)=>{if(e.target.id==='adminSessionType'){const show=e.target.value==='Location';document.getElementById('cityField').style.display=show?'grid':'none';document.getElementById('addressFieldAdmin').style.display=show?'grid':'none';}});
  content.addEventListener('submit',(e)=>{if(e.target.id==='addReservationForm'){e.preventDefault();toast('Demo reservation saved locally');}});
}
initAdminDemo();
