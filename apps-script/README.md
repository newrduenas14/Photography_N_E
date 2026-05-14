# Photography by Norma & Eduardo - Apps Script Backend

## Files in this folder
- `Code.gs` - Web App endpoints (`doGet`, `doPost`), action routing, auth helpers, admin helpers, and test functions.
- `Backend.gs` - Google Sheet access layer, dynamic header mapping, availability engine, pricing engine, and shared utilities.

## 1) Copy into Google Apps Script
1. Open [script.google.com](https://script.google.com) and create a project.
2. Add two script files:
   - `Code.gs`
   - `Backend.gs`
3. Copy/paste each file from this folder into the matching script file.

## 2) Set Script Properties
In Apps Script:
- **Project Settings** → **Script properties**
- Add:
  - `SPREADSHEET_ID` = your Google Sheet ID
  - `STRIPE_SECRET_KEY` = placeholder for now
  - `STRIPE_WEBHOOK_SECRET` = placeholder for now

> Stripe keys are not implemented yet, but property keys are reserved now.

## 3) Deploy as Web App
1. Click **Deploy** → **New deployment**.
2. Type: **Web app**.
3. Execute as: **Me**.
4. Who has access: as needed (usually "Anyone with link" for public booking use).
5. Deploy and copy the Web App URL.

## 4) Example GET request
```text
APPS_SCRIPT_URL?action=getPackages
```

Other GET actions:
- `getConfig`
- `getDistanceFees`
- `getPromos`
- `getAvailableDates&packageId=...&sessionType=...&areaCode=...&month=...&year=...`
- `getAvailableTimes&date=YYYY-MM-DD&packageId=...&sessionType=...&areaCode=...`
- `getBlockedTimes`
- `getReservations`

## 5) Example POST request
POST JSON body:
```json
{
  "action": "calculatePrice",
  "packageId": "PKG-001",
  "sessionType": "Location",
  "areaCode": "MCALLEN",
  "promoCode": "",
  "paymentOption": "deposit"
}
```

## 6) Functions ready now
- Public data: `getPackages`, `getConfig`, `getDistanceFees`, `getPromos`
- Availability: `getAvailableDates`, `getAvailableTimes`
- Pricing: `calculatePrice`
- Booking flow (pre-Stripe): `createPendingCheckout`, `createReservationForTesting`, `lookupCustomerReservation`
- Admin helpers: `getReservations`, `addManualReservation`, `cancelReservation`, `addBlockedTime`, `getBlockedTimes`, `addPromo`, `logActivity`
- Admin auth support: `loginUser`, `createUser`, `deactivateUser`, `changeUserPassword`, `checkUserSession`, `logoutUser`

## 7) Stripe placeholders
- `createPendingCheckout` writes pending rows with blank Stripe IDs.
- Script properties include Stripe keys for later implementation.
- No real Stripe Checkout Session creation/webhook processing implemented yet.

## 8) Later website integration with `APPS_SCRIPT_URL`
The frontend can later call:
- `getPackages` to render dynamic package cards
- `getAvailableTimes` for live slot options
- `calculatePrice` for up-to-date totals
- `createPendingCheckout` / Stripe flow for checkout

Because this backend reads directly from Google Sheets using header names, changing Sheet data (prices, active flags, buffers, promos, blocked times) updates behavior without frontend code changes.

## Dynamic data behavior (important)
- No column positions are hardcoded.
- The backend reads the first row of each tab as headers and maps by exact column names.
- Reads/writes use header names, so column order can change safely as long as header text remains exact.

## Editor test helpers
Run directly in Apps Script editor:
- `testGetPackages()`
- `testGetDistanceFees()`
- `testCalculatePrice()`
- `testGetAvailableTimes()`
- `testCreateReservationForTesting()`

Check output in **Execution log**.
