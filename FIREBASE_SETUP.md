# Firebase Setup Guide

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project"
3. Enter project name: `cng-station-saas` (or your choice)
4. Disable Google Analytics (optional for MVP)
5. Click "Create Project"

## Step 2: Enable Authentication

1. In Firebase Console, go to **Build → Authentication**
2. Click "Get Started"
3. Go to **Sign-in method** tab
4. Enable **Phone** authentication
   - Click on "Phone"
   - Toggle "Enable"
   - Click "Save"

## Step 3: Create Firestore Database

1. Go to **Build → Firestore Database**
2. Click "Create database"
3. Select **Start in test mode** (we'll add security rules later)
4. Choose location: `asia-south1` (Mumbai) or closest to you
5. Click "Enable"

## Step 4: Register Web App

1. Go to **Project Settings** (gear icon)
2. Scroll down to "Your apps"
3. Click on **Web** icon (`</>`)
4. Register app:
   - App nickname: `CNG Station Web`
   - **Check** "Also set up Firebase Hosting" (optional)
   - Click "Register app"

## Step 5: Copy Firebase Config

You'll see a config object like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890",
  measurementId: "G-XXXXXXXXXX"
};
```

## Step 6: Update .env File

Open `.env` file in your project and update with your values:

```env
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

## Step 7: Create Test Data (Optional)

### Create a Test Station

1. Go to **Firestore Database**
2. Click "Start collection"
3. Collection ID: `stations`
4. Add first document:
   - Document ID: `station_001`
   - Fields:
     ```
     stationId: "station_001" (string)
     name: "Test CNG Station - Andheri" (string)
     address: "Andheri West, Mumbai, Maharashtra" (string)
     location: (map)
       - latitude: 19.1234 (number)
       - longitude: 72.8367 (number)
     gasOn: true (boolean)
     bookingOn: true (boolean)
     checkInRadius: 15 (number)
     ownerId: "" (string - leave empty for now)
     operatorIds: [] (array - leave empty)
     maxPhysicalVehicles: 10 (number)
     graceWindowMinutes: 5 (number)
     totalVehiclesServed: 0 (number)
     totalSkips: 0 (number)
     ```

## Step 8: Test the App

1. **Restart dev server** (important for env variables):
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. Open browser: `http://localhost:5173`

3. You should see the login page

4. **Test Login Flow:**
   - Enter phone number with country code: `+91 9876543210`
   - Click "Send OTP"
   - Check your phone for OTP
   - Enter OTP and verify

## Step 9: Verify User Creation

After successful login:
1. Go to **Firestore Database**
2. You should see a new collection: `users`
3. Your user document should be created with:
   - `phoneNumber`
   - `role: "customer"`
   - `vehicles: []`

## Troubleshooting

### Issue: "Firebase: Error (auth/invalid-api-key)"
**Solution:** Check that your API key in `.env` is correct

### Issue: "Firebase: Error (auth/quota-exceeded)"
**Solution:** You've exceeded free tier SMS quota. Upgrade to Blaze plan.

### Issue: OTP not received
**Solution:** 
- Check phone number format includes country code (+91)
- Verify Phone Authentication is enabled in Firebase Console
- Check Firebase Console → Authentication → Usage for errors

### Issue: "Permission denied" in Firestore
**Solution:** Make sure Firestore is in **test mode** (allows all reads/writes)

### Issue: Changes not reflecting
**Solution:** 
- Restart dev server after changing `.env`
- Clear browser cache
- Check browser console for errors

## Next Steps

Once Firebase is working:
1. ✅ Test customer booking flow
2. ✅ Add more test stations
3. ✅ Test GPS check-in (requires HTTPS or localhost)
4. 🔧 Build operator module
5. 🔧 Add Firestore security rules

## Important Notes

⚠️ **Test Mode Security**: Firestore is currently in test mode (open to all). This is fine for development but **MUST** be secured before production.

⚠️ **SMS Costs**: Firebase charges for SMS OTPs. Free tier includes limited SMS. Monitor usage in Firebase Console.

⚠️ **GPS Testing**: GPS check-in works on:
- `localhost` (development)
- HTTPS domains (production)
- May not work on HTTP non-localhost

---

**Need Help?** Check Firebase documentation or console error messages for specific issues.
