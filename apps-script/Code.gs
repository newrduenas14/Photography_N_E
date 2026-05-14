function jsonSuccess_(data) {
  return ContentService.createTextOutput(JSON.stringify({ success: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}
function jsonError_(err) {
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message || String(err) }))
    .setMimeType(ContentService.MimeType.JSON);
}

function parsePostPayload_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  var raw = e.postData.contents;
  try { return JSON.parse(raw); } catch (_) { return e.parameter || {}; }
}

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || '';
    if (action === 'getPackages') return jsonSuccess_(getPackages());
    if (action === 'getConfig') return jsonSuccess_(getConfig());
    if (action === 'getDistanceFees') return jsonSuccess_(getDistanceFees());
    if (action === 'getPromos') return jsonSuccess_(getPromos());
    if (action === 'getAvailableDates') return jsonSuccess_(getAvailableDates(e.parameter));
    if (action === 'getAvailableTimes') return jsonSuccess_(getAvailableTimes(e.parameter));
    if (action === 'getBlockedTimes') return jsonSuccess_(getBlockedTimes());
    if (action === 'getReservations') return jsonSuccess_(getReservations(e.parameter || {}));
    return jsonError_(new Error('Unknown GET action: ' + action));
  } catch (err) { return jsonError_(err); }
}

function doPost(e) {
  try {
    var payload = parsePostPayload_(e);
    var action = payload.action || (e.parameter && e.parameter.action);
    if (action === 'calculatePrice') return jsonSuccess_(calculatePrice(payload));
    if (action === 'createPendingCheckout') return jsonSuccess_(createPendingCheckout(payload));
    if (action === 'createReservationForTesting') return jsonSuccess_(createReservationForTesting(payload));
    if (action === 'lookupCustomerReservation') return jsonSuccess_(lookupCustomerReservation(payload));
    if (action === 'addManualReservation') return jsonSuccess_(addManualReservation(payload));
    if (action === 'cancelReservation') return jsonSuccess_(cancelReservation(payload.reservationId, payload.reason, payload.userId));
    if (action === 'addBlockedTime') return jsonSuccess_(addBlockedTime(payload));
    if (action === 'addPromo') return jsonSuccess_(addPromo(payload));
    if (action === 'loginUser') return jsonSuccess_(loginUser(payload));
    if (action === 'createUser') return jsonSuccess_(createUser(payload));
    if (action === 'deactivateUser') return jsonSuccess_(deactivateUser(payload.userId));
    if (action === 'changeUserPassword') return jsonSuccess_(changeUserPassword(payload));
    if (action === 'checkUserSession') return jsonSuccess_(checkUserSession(payload.sessionToken));
    if (action === 'logoutUser') return jsonSuccess_(logoutUser(payload.sessionToken));
    return jsonError_(new Error('Unknown POST action: ' + action));
  } catch (err) { return jsonError_(err); }
}

function createPendingCheckout(payload) {
  ['clientName', 'phone', 'email', 'packageId', 'sessionType', 'sessionDate', 'startTime', 'paymentOption'].forEach(function (k) { if (!payload[k]) throw new Error('Missing required field: ' + k); });
  var times = getAvailableTimes({ date: payload.sessionDate, packageId: payload.packageId, sessionType: payload.sessionType, areaCode: payload.areaCode || '' });
  if (times.indexOf(payload.startTime) === -1) throw new Error('Selected time is no longer available.');
  var price = calculatePrice(payload);
  var config = getConfig();
  var duration = Number(getPackageById_(payload.packageId)['Duration Minutes']);
  var startMin = timeToMinutes_(payload.startTime), endTime = minutesToTime_(startMin + duration);
  var buffer = String(payload.sessionType).toLowerCase() === 'location' ? Number(config.location_buffer_minutes || 120) : Number(config.studio_buffer_minutes || 30);
  var bufferEnd = minutesToTime_(startMin + duration + buffer);
  var created = new Date();
  var expires = new Date(created.getTime() + Number(config.pending_checkout_expiration_minutes || 30) * 60000);
  var id = generateId_('PEND', true);
  appendObjectRow_(SHEET_NAMES.PENDING_CHECKOUTS, {
    'Pending ID': id, 'Created At': nowIso_(), 'Expires At': Utilities.formatDate(expires, APP_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss"),
    'Client Name': payload.clientName, 'Phone': payload.phone, 'Email': payload.email, 'Occasion': payload.occasion || '',
    'Package ID': price.packageId, 'Package Name': price.packageName, 'Session Type': payload.sessionType, 'Area Code': payload.areaCode || '', 'Area Name': payload.areaName || '',
    'Location Address': payload.locationAddress || '', 'Session Date': payload.sessionDate, 'Start Time': payload.startTime,
    'End Time': endTime, 'Buffer End Time': bufferEnd, 'Base Price': price.basePrice, 'Extra Fee': price.extraFee,
    'Promo ID': price.promoId, 'Promo Code': price.promoCode, 'Discount Amount': price.discountAmount, 'Total Price': price.totalPrice,
    'Payment Option': payload.paymentOption, 'Amount Due Now': price.amountDueNow, 'Stripe Checkout Session ID': '', 'Status': 'Pending', 'Notes': payload.notes || ''
  });
  return { pendingId: id, expiresAt: Utilities.formatDate(expires, APP_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss"), stripeImplemented: false };
}

function createReservationForTesting(payload) { return addManualReservation(payload, true); }
function addManualReservation(payload, isTest) { /* simplified shared path */
  ['clientName', 'phone', 'email', 'packageId', 'sessionType', 'sessionDate', 'startTime', 'paymentOption'].forEach(function (k) { if (!payload[k]) throw new Error('Missing required field: ' + k); });
  var today = formatDate_(new Date());
  if (payload.sessionDate >= today) {
    var avail = getAvailableTimes({ date: payload.sessionDate, packageId: payload.packageId, sessionType: payload.sessionType, areaCode: payload.areaCode || '' });
    if (avail.indexOf(payload.startTime) === -1) throw new Error('Selected time is unavailable.');
  }
  var client = upsertClient_(payload.clientName, payload.phone, payload.email, payload.sessionDate);
  var price = calculatePrice(payload);
  var pkg = getPackageById_(payload.packageId);
  var cfg = getConfig();
  var start = timeToMinutes_(payload.startTime), duration = Number(pkg['Duration Minutes']);
  var end = minutesToTime_(start + duration);
  var buffer = String(payload.sessionType).toLowerCase() === 'location' ? Number(cfg.location_buffer_minutes || 120) : Number(cfg.studio_buffer_minutes || 30);
  var bufferEnd = minutesToTime_(start + duration + buffer);
  var reservationId = generateId_('RES', true);
  var amountPaid = Number(payload.amountPaid || price.amountDueNow || 0);
  appendObjectRow_(SHEET_NAMES.RESERVATIONS, {
    'Reservation ID': reservationId, 'Client ID': client.clientId, 'Created At': nowIso_(), 'Updated At': nowIso_(), 'Created Source': isTest ? 'Testing API' : 'Admin',
    'Created By': payload.userId || 'SYSTEM', 'Client Name': payload.clientName, 'Phone': payload.phone, 'Email': payload.email, 'Occasion': payload.occasion || '',
    'Package ID': price.packageId, 'Package Name': price.packageName, 'Base Price': price.basePrice, 'Duration Minutes': duration, 'Edited Photos': pkg['Edited Photos'],
    'Session Type': payload.sessionType, 'Area Code': payload.areaCode || '', 'Area Name': payload.areaName || '', 'Location Address': payload.locationAddress || '',
    'Extra Fee': price.extraFee, 'Promo ID': price.promoId, 'Promo Code': price.promoCode, 'Discount Amount': price.discountAmount, 'Total Price': price.totalPrice,
    'Payment Option': payload.paymentOption, 'Deposit Required': price.depositRequired, 'Amount Paid': amountPaid, 'Balance Due': Math.max(0, price.totalPrice - amountPaid),
    'Payment Status': amountPaid >= price.totalPrice ? 'Paid' : (amountPaid > 0 ? 'Partially Paid' : 'Pending'), 'Payment Date': amountPaid > 0 ? nowIso_() : '',
    'Stripe Checkout Session ID': '', 'Stripe Payment Intent ID': '', 'Session Date': payload.sessionDate, 'Start Time': payload.startTime, 'End Time': end, 'Buffer End Time': bufferEnd,
    'Reservation Status': 'Confirmed', 'Canceled At': '', 'Cancellation Reason': '', 'Notes': payload.notes || '', 'Internal Notes': isTest ? 'Created by test helper.' : ''
  });
  if (amountPaid > 0) appendObjectRow_(SHEET_NAMES.PAYMENTS, {'Payment ID': generateId_('PAY', true), 'Reservation ID': reservationId, 'Client ID': client.clientId, 'Payment Date': nowIso_(), 'Payment Type': 'Charge', 'Amount': amountPaid, 'Payment Method': 'Manual/Test', 'Payment Option': payload.paymentOption, 'Payment Status': 'Paid', 'Stripe Checkout Session ID': '', 'Stripe Payment Intent ID': '', 'Manual Reference': 'TEST', 'Collected By': payload.userId || 'SYSTEM', 'Created At': nowIso_(), 'Refunded Amount': 0, 'Refund Reason': '', 'Notes': 'Test/manual payment'});
  logActivity('RESERVATION_CREATED', reservationId, JSON.stringify({ test: !!isTest, sessionDate: payload.sessionDate }), payload.userId || 'SYSTEM');
  return { reservationId: reservationId, clientId: client.clientId };
}

function lookupCustomerReservation(payload) { var rows=getRowsAsObjects_(SHEET_NAMES.RESERVATIONS); var r=rows.find(function(x){return String(x['Reservation ID'])===String(payload.reservationId)&&((payload.email&&String(x['Email']).toLowerCase()===String(payload.email).toLowerCase())||(payload.phone&&String(x['Phone'])===String(payload.phone)));}); if(!r) throw new Error('Reservation not found.'); return {'Reservation ID':r['Reservation ID'],'Client Name':r['Client Name'],'Package Name':r['Package Name'],'Session Date':r['Session Date'],'Start Time':r['Start Time'],'End Time':r['End Time'],'Session Type':r['Session Type'],'Area Name':r['Area Name'],'Location Address':r['Location Address'],'Total Price':r['Total Price'],'Amount Paid':r['Amount Paid'],'Balance Due':r['Balance Due'],'Payment Status':r['Payment Status'],'Reservation Status':r['Reservation Status'],'Notes':r['Notes']}; }
function getReservations(filters){var rows=getRowsAsObjects_(SHEET_NAMES.RESERVATIONS);var today=formatDate_(new Date());return rows.filter(function(r){if(filters.status&&String(r['Reservation Status'])!==String(filters.status))return false; if(filters.paymentStatus&&String(r['Payment Status'])!==String(filters.paymentStatus))return false; if(filters.dateFrom&&String(r['Session Date'])<String(filters.dateFrom))return false; if(filters.dateTo&&String(r['Session Date'])>String(filters.dateTo))return false; if(filters.when==='upcoming'&&String(r['Session Date'])<today)return false; if(filters.when==='past'&&String(r['Session Date'])>=today)return false; return true;});}
function cancelReservation(reservationId, reason, userId){var rows=getRowsAsObjects_(SHEET_NAMES.RESERVATIONS);var row=rows.find(function(r){return String(r['Reservation ID'])===String(reservationId);}); if(!row) throw new Error('Reservation not found.'); updateRowByRowNum_(SHEET_NAMES.RESERVATIONS,row.__rowNum,{'Reservation Status':'Canceled','Canceled At':nowIso_(),'Cancellation Reason':reason||''}); logActivity('RESERVATION_CANCELED',reservationId,reason||'',userId||'SYSTEM'); return {reservationId:reservationId,canceled:true};}
function addBlockedTime(payload){var id=generateId_('BLK',true);appendObjectRow_(SHEET_NAMES.BLOCKED_TIMES,{'Block ID':id,'Block Type':payload.blockType,'Date':payload.date,'Start Time':payload.startTime||'','End Time':payload.endTime||'','Reason':payload.reason||'','Active':'active','Created By':payload.userId||'SYSTEM','Created At':nowIso_(),'Updated At':nowIso_(),'Notes':payload.notes||''}); logActivity('BLOCKED_TIME_ADDED',id,payload.reason||'',payload.userId||'SYSTEM'); return {blockId:id};}
function getBlockedTimes(){return getRowsAsObjects_(SHEET_NAMES.BLOCKED_TIMES).filter(function(r){return normalizeActive_(r['Active']);});}
function addPromo(payload){var id=payload.promoId||generateId_('PRO',true);appendObjectRow_(SHEET_NAMES.PROMOS,{'Promo ID':id,'Promo Name':payload.promoName,'Promo Code':payload.promoCode,'Discount Type':payload.discountType,'Discount Value':payload.discountValue,'Start Date':payload.startDate||'','End Date':payload.endDate||'','Applies To Package IDs':payload.appliesToPackageIds||'','Auto Apply':payload.autoApply||'No','Active':'active','Created By':payload.userId||'SYSTEM','Created At':nowIso_(),'Updated At':nowIso_(),'Notes':payload.notes||''}); logActivity('PROMO_ADDED',id,payload.promoCode,payload.userId||'SYSTEM'); return {promoId:id};}
function logActivity(actionType, relatedId, details, userId){appendObjectRow_(SHEET_NAMES.ACTIVITY_LOG,{'Log ID':generateId_('LOG',true),'Timestamp':nowIso_(),'User ID':userId||'SYSTEM','User Name':userId||'SYSTEM','Action Type':actionType,'Related ID':relatedId||'','Details':details||'','IP / Device':'N/A'});}

function createUser(payload){var id=generateId_('USR',false);appendObjectRow_(SHEET_NAMES.USERS,{'User ID':id,'Name':payload.name,'Email / Username':payload.emailOrUsername,'Password Hash':hashPassword_(payload.password),'Role':payload.role||'admin','Active':'active','Created At':nowIso_(),'Last Login':'','Notes':payload.notes||''}); return {userId:id};}
function loginUser(payload){var user=getRowsAsObjects_(SHEET_NAMES.USERS).find(function(u){return String(u['Email / Username']).toLowerCase()===String(payload.emailOrUsername).toLowerCase()&&normalizeActive_(u['Active']);}); if(!user||user['Password Hash']!==hashPassword_(payload.password)) throw new Error('Invalid credentials.'); var token=Utilities.getUuid(); CacheService.getScriptCache().put('session_'+token, JSON.stringify({'User ID':user['User ID'],'Name':user['Name'],'Role':user['Role'],'Active':user['Active']}), 21600); updateRowByRowNum_(SHEET_NAMES.USERS,user.__rowNum,{'Last Login':nowIso_()}); return {sessionToken:token,user:{'User ID':user['User ID'],'Name':user['Name'],'Role':user['Role'],'Active':user['Active']}};}
function checkUserSession(sessionToken){var raw=CacheService.getScriptCache().get('session_'+sessionToken); if(!raw) return {valid:false}; return {valid:true,user:JSON.parse(raw)};}
function logoutUser(sessionToken){CacheService.getScriptCache().remove('session_'+sessionToken); return {loggedOut:true};}
function deactivateUser(userId){var user=getRowsAsObjects_(SHEET_NAMES.USERS).find(function(u){return String(u['User ID'])===String(userId);}); if(!user) throw new Error('User not found.'); updateRowByRowNum_(SHEET_NAMES.USERS,user.__rowNum,{'Active':'inactive'}); return {userId:userId,active:'inactive'};}
function changeUserPassword(payload){var user=getRowsAsObjects_(SHEET_NAMES.USERS).find(function(u){return String(u['User ID'])===String(payload.userId);}); if(!user) throw new Error('User not found.'); updateRowByRowNum_(SHEET_NAMES.USERS,user.__rowNum,{'Password Hash':hashPassword_(payload.newPassword)}); return {userId:payload.userId,changed:true};}

function upsertClient_(name, phone, email, lastSessionDate) { var rows=getRowsAsObjects_(SHEET_NAMES.CLIENTS); var c=rows.find(function(x){return (email&&String(x['Email']).toLowerCase()===String(email).toLowerCase())||(phone&&String(x['Phone'])===String(phone));}); if(c){ updateRowByRowNum_(SHEET_NAMES.CLIENTS,c.__rowNum,{'Updated At':nowIso_(),'Client Name':name,'Phone':phone,'Email':email,'Last Session Date':lastSessionDate}); return {clientId:c['Client ID']}; } var id=generateId_('CLI',false); appendObjectRow_(SHEET_NAMES.CLIENTS,{'Client ID':id,'Created At':nowIso_(),'Updated At':nowIso_(),'Client Name':name,'Phone':phone,'Email':email,'Total Reservations':0,'Total Spent':0,'Last Session Date':lastSessionDate,'Notes':''}); return {clientId:id}; }

// Test helpers
function testGetPackages(){Logger.log(JSON.stringify(getPackages(),null,2));}
function testGetDistanceFees(){Logger.log(JSON.stringify(getDistanceFees(),null,2));}
function testCalculatePrice(){Logger.log(JSON.stringify(calculatePrice({packageId:'PKG-001',sessionType:'Location',areaCode:'MCALLEN',promoCode:'',paymentOption:'deposit'}),null,2));}
function testGetAvailableTimes(){Logger.log(JSON.stringify(getAvailableTimes({date:formatDate_(new Date(Date.now()+86400000)),packageId:'PKG-001',sessionType:'Studio',areaCode:'MCALLEN'}),null,2));}
function testCreateReservationForTesting(){Logger.log(JSON.stringify(createReservationForTesting({clientName:'Test User',phone:'5550000000',email:'test@example.com',occasion:'Test',packageId:'PKG-001',sessionType:'Studio',areaCode:'MCALLEN',areaName:'McAllen',locationAddress:'',sessionDate:formatDate_(new Date(Date.now()+172800000)),startTime:'10:00',paymentOption:'deposit',amountPaid:50,notes:'test booking'}),null,2));}

/**
 * Security note:
 * Session token + SHA-256 hashing here are basic and should be replaced with
 * stronger production-grade auth controls before real launch.
 */
