# Complete Testing Guide - CNG Station SaaS

## 🎯 Prerequisites

Before testing, make sure:
1. ✅ Firebase project created
2. ✅ Phone Authentication enabled
3. ✅ Firestore database created (test mode)
4. ✅ `.env` file updated with Firebase credentials
5. ✅ Dev server running (`npm run dev`)

---

## 📋 Testing Checklist

### Phase 1: Firebase Setup Verification ✓

**Step 1: Check .env File**
```bash
# Open .env and verify all values are filled:
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
# ... etc
```

**Step 2: Restart Server**
```bash
Ctrl+C
npm run dev
```

**Step 3: Open App**
- Go to: http://localhost:5173
- Should see login page (no errors in console)

---

### Phase 2: Authentication Testing 🔐

#### Test 1: New User Signup

**Steps:**
1. Open http://localhost:5173
2. Enter phone: `+91 9999999999` (if test number added)
3. Click "Send OTP"
4. Enter OTP: `123456` (test OTP)
5. **Should see signup form**
6. Enter name: "Test User"
7. Enter vehicle: "MH12AB1234"
8. Click "Complete Signup"

**Expected Result:**
- ✅ Redirects to customer home
- ✅ Shows vehicle selection screen
- ✅ User created in Firestore `users` collection

**Verify in Firebase Console:**
- Go to Firestore Database
- Check `users` collection
- Should see new document with:
  - `phoneNumber: "+91 9999999999"`
  - `name: "Test User"`
  - `role: "customer"`
  - `vehicles: ["MH12AB1234"]`

#### Test 2: Existing User Login

**Steps:**
1. Logout (click logout in navbar)
2. Enter same phone: `+91 9999999999`
3. Click "Send OTP"
4. Enter OTP: `123456`

**Expected Result:**
- ✅ **Skips signup form**
- ✅ Directly logs in
- ✅ Shows customer home with existing data

---

### Phase 3: Customer Module Testing 🚗

#### Test 3: Create Test Station (Admin Task)

**Manual Firestore Setup:**
1. Go to Firebase Console → Firestore Database
2. Click "Start collection"
3. Collection ID: `stations`
4. Document ID: `station_001`
5. Add fields:

```javascript
stationId: "station_001" (string)
name: "Test CNG Station - Andheri" (string)
address: "Andheri West, Mumbai, Maharashtra" (string)
location: (map)
  - latitude: 19.1197 (number)
  - longitude: 72.8464 (number)
gasOn: true (boolean)
bookingOn: true (boolean)
checkInRadius: 15 (number)
ownerId: "" (string)
operatorIds: [] (array)
maxPhysicalVehicles: 10 (number)
graceWindowMinutes: 5 (number)
totalVehiclesServed: 0 (number)
totalSkips: 0 (number)
```

6. Click "Save"

#### Test 4: Customer Booking Flow

**Steps:**
1. Login as customer
2. **Vehicle Selection:**
   - Should show "MH12AB1234" (from signup)
   - Click "Continue with MH12AB1234"

3. **Station Selection:**
   - Should see "Test CNG Station - Andheri"
   - Status: "Gas ON", "Booking Open"
   - Click on station card

4. **Booking Confirmation:**
   - Review details
   - Click "Confirm Booking"

**Expected Result:**
- ✅ Booking created
- ✅ Shows "My Booking" screen
- ✅ Queue position: #1
- ✅ Status: "Eligible" (if position ≤ 10)

**Verify in Firestore:**
- Check `bookings` collection
- Should see new booking with:
  - `vehicleNumber: "MH12AB1234"`
  - `stationId: "station_001"`
  - `status: "eligible"`
  - `queuePosition: 1`

#### Test 5: Live Queue View

**Expected:**
- ✅ See your vehicle in queue
- ✅ Green indicator (if checked in) or Red (not arrived)
- ✅ Position #1 displayed
- ✅ Estimated wait time shown

#### Test 6: Cancel Booking

**Steps:**
1. Click "Cancel Booking"
2. Confirm cancellation

**Expected Result:**
- ✅ Booking cancelled
- ✅ Returns to vehicle selection
- ✅ Firestore booking status: "cancelled"

---

### Phase 4: Operator Module Testing 👨‍💼

#### Test 7: Create Operator User

**Manual Firestore Setup:**
1. Firestore → `users` collection
2. Create new document (auto-ID)
3. Add fields:

```javascript
userId: "operator_test_001" (string)
phoneNumber: "+91 8888888888" (string)
name: "Test Operator" (string)
role: "operator" (string)
stationId: "station_001" (string)
```

#### Test 8: Operator Login & Controls

**Steps:**
1. Logout
2. Login with operator phone: `+91 8888888888`
3. OTP: `123456`

**Expected Result:**
- ✅ Redirects to operator dashboard
- ✅ Shows station name
- ✅ Control panel visible

**Test Controls:**
1. **GAS Toggle:**
   - Click "GAS" button
   - Should toggle ON/OFF
   - Verify in Firestore: `stations/station_001/gasOn`

2. **BOOKING Toggle:**
   - Click "BOOKING" button
   - Should toggle ON/OFF
   - Verify in Firestore: `stations/station_001/bookingOn`

3. **NEXT Button:**
   - Create a booking first (as customer)
   - As operator, click "NEXT"
   - Should mark current booking as completed
   - Queue advances

**Verify:**
- ✅ Awareness panel shows current/next vehicle
- ✅ Queue updates in real-time
- ✅ Actions logged in `queue_logs` collection

---

### Phase 5: Owner Module Testing 👔

#### Test 9: Create Owner User

**Firestore:**
```javascript
userId: "owner_test_001"
phoneNumber: "+91 7777777777"
name: "Test Owner"
role: "owner"
stationId: "station_001"
```

#### Test 10: Owner Dashboard

**Steps:**
1. Login as owner
2. Check dashboard

**Expected:**
- ✅ Station controls visible
- ✅ Analytics showing:
  - Total served
  - Today's count
  - Skipped count
  - Success rate
- ✅ Queue overview
- ✅ Live queue display

**Test:**
- Toggle gas/booking (should work)
- Verify analytics update after bookings

---

### Phase 6: Admin Module Testing 🔧

#### Test 11: Create Admin User

**Firestore:**
```javascript
userId: "admin_test_001"
phoneNumber: "+91 6666666666"
name: "Test Admin"
role: "admin"
stationId: null
```

#### Test 12: Station Management

**Steps:**
1. Login as admin
2. Go to "Station Management" tab

**Test Create:**
1. Click "+ Add New Station"
2. Fill form:
   - Station ID: `station_002`
   - Name: "Test Station 2"
   - Address: "Bandra West, Mumbai"
   - Latitude: `19.0596`
   - Longitude: `72.8295`
3. Click "Create Station"

**Expected:**
- ✅ Station created
- ✅ Shows in list
- ✅ Saved in Firestore

**Test Edit:**
1. Click "Edit" on station
2. Change name
3. Click "Update Station"

**Test Delete:**
1. Click "Delete"
2. Confirm
3. Station removed

#### Test 13: System Logs

**Steps:**
1. Go to "System Logs" tab
2. Check logs

**Expected:**
- ✅ Shows all actions (booked, completed, gas_on, etc.)
- ✅ Filters work (All, Queue, Gas, Booking)
- ✅ Timestamps displayed
- ✅ User IDs and roles shown

---

## 🧪 Advanced Testing

### Test 14: Real-time Updates

**Setup:**
1. Open app in 2 browser windows
2. Window 1: Login as customer
3. Window 2: Login as operator

**Test:**
1. Customer creates booking
2. **Operator window should update immediately**
3. Operator clicks NEXT
4. **Customer window should update queue position**

**Expected:**
- ✅ Real-time sync works
- ✅ No page refresh needed

### Test 15: GPS Check-in (Localhost)

**Note:** GPS only works on localhost or HTTPS

**Steps:**
1. Create booking (position ≤ 10)
2. Status should be "eligible"
3. Click "Check-in Now"
4. Allow location access
5. **Will fail if not at station** (expected)

**Mock Test:**
- Edit `useGeolocation.js` to return mock location
- Or test in production with actual GPS

### Test 16: Multiple Bookings

**Test:**
1. Create 5 bookings (different vehicles/users)
2. Check queue positions (1, 2, 3, 4, 5)
3. Operator clicks NEXT
4. All positions shift up (2→1, 3→2, etc.)

**Expected:**
- ✅ Queue positions update correctly
- ✅ Status changes (waiting → eligible at position 10)

---

## 🐛 Common Issues & Fixes

### Issue 1: "Firebase: Error (auth/invalid-api-key)"
**Fix:** Check `.env` file, restart server

### Issue 2: "Permission denied" in Firestore
**Fix:** Firestore → Rules → Set to test mode

### Issue 3: OTP not received
**Fix:** Use test phone numbers in Firebase Console

### Issue 4: Page shows loading forever
**Fix:** Check browser console for errors, verify Firebase config

### Issue 5: Real-time updates not working
**Fix:** Check Firestore listeners, verify collection names

---

## ✅ Final Verification Checklist

- [ ] Login works (phone OTP)
- [ ] Signup collects name + vehicle
- [ ] Customer can create booking
- [ ] Customer can see live queue
- [ ] Customer can cancel booking
- [ ] Operator can toggle gas/booking
- [ ] Operator can advance queue (NEXT)
- [ ] Owner can view analytics
- [ ] Owner can control station
- [ ] Admin can create/edit/delete stations
- [ ] Admin can view system logs
- [ ] Real-time updates work
- [ ] All roles route correctly
- [ ] Firestore data saves correctly

---

## 📊 Test Data Summary

**Test Users:**
- Customer: `+91 9999999999` (OTP: 123456)
- Operator: `+91 8888888888` (OTP: 123456)
- Owner: `+91 7777777777` (OTP: 123456)
- Admin: `+91 6666666666` (OTP: 123456)

**Test Station:**
- ID: `station_001`
- Name: "Test CNG Station - Andheri"
- Location: 19.1197, 72.8464

---

## 🚀 Quick Test Script

**5-Minute Test:**
1. ✅ Login as customer → Create booking
2. ✅ Login as operator → Click NEXT
3. ✅ Login as owner → Check analytics
4. ✅ Login as admin → View logs
5. ✅ All working? MVP ready! 🎉

---

**Need help with any specific test? Let me know!** 😊
https://prod.liveshare.vsengsaas.visualstudio.com/join?577201401E38DB17AE71EC5B8AEE79D5CF3C