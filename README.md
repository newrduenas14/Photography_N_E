# Photography by Norma & Eduardo - Phase 1

This is a static website (HTML/CSS/JavaScript) designed for GitHub Pages.

## Files
- `index.html` - Homepage and package overview
- `booking.html` - Client booking form with scheduling and payment estimate logic
- `admin.html` - Admin dashboard layout (UI only in Phase 1)
- `style.css` - Shared responsive styles
- `script.js` - Shared frontend interactions and booking rules

## Business Rules Included
- Deposit is 50%
- Booking days: Monday to Saturday
- Booking hours: 8:00 AM to 8:00 PM
- Studio sessions include 30-minute buffer
- Location sessions include 60-minute buffer
- Location fee notice shown for locations more than 10 minutes away ($20-$100)

## Notes for Phase 2
- Add Stripe checkout/payment integration (no live keys in frontend)
- Add backend or Google Apps Script endpoint for reservations
- Add real admin authentication and persistent booking storage
