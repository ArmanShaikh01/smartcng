# Fix: Firebase Auth Error - invalid-app-credential

## 🔴 Error:
```
FirebaseError: Firebase: Error (auth/invalid-app-credential)
```

## 🎯 Root Cause:
Phone Authentication requires proper reCAPTCHA setup in Firebase Console. This error means either:
1. Phone Auth not enabled properly
2. reCAPTCHA site key missing
3. App not verified in Firebase Console

---

## ✅ Complete Fix (Step-by-Step):

### Step 1: Enable Phone Authentication Properly

1. **Go to Firebase Console:** https://console.firebase.google.com/
2. Select your project: **smartcng-c49e1**
3. **Build → Authentication → Sign-in method**
4. Click on **Phone**
5. Make sure it's **ENABLED** (toggle should be ON)
6. Click **Save**

### Step 2: Add Authorized Domains

1. Still in **Authentication** section
2. Go to **Settings** tab (top)
3. Scroll to **Authorized domains**
4. Make sure these are added:
   - `localhost`
   - `smartcng-c49e1.firebaseapp.com`
5. Click **Add domain** if missing

### Step 3: Verify App Registration

1. **Project Settings** (gear icon)
2. Scroll to **Your apps**
3. Should see your web app
4. If not, click **Add app** → Web
5. Register with nickname: `CNG Station Web`

### Step 4: Add Test Phone Numbers (IMPORTANT!)

This bypasses reCAPTCHA completely for testing:

1. **Authentication → Sign-in method → Phone**
2. Scroll down to **Phone numbers for testing**
3. Click **Add phone number**
4. Add these:

```
Phone: +91 9999999999
OTP: 123456

Phone: +91 8888888888
OTP: 654321

Phone: +91 7777777777
OTP: 111111
```

5. Click **Save**

### Step 5: Restart Dev Server

```bash
Ctrl+C
npm run dev
```

### Step 6: Test Login

1. Open: http://localhost:5173
2. Enter test number: `+91 9999999999`
3. Click "Send OTP"
4. Enter OTP: `123456`
5. Should work! ✅

---

## 🔧 Alternative Fix: Update reCAPTCHA Config

If test numbers don't work, update reCAPTCHA:

### In Firebase Console:

1. **Authentication → Sign-in method → Phone**
2. Under **reCAPTCHA verifier**, click **Edit**
3. Select **reCAPTCHA v3** (recommended)
4. Or select **Invisible reCAPTCHA**
5. Save

---

## 🐛 Still Not Working?

### Check Browser Console:

1. Press **F12**
2. **Console** tab
3. Look for specific error
4. Share screenshot

### Verify Firebase Config:

1. Check `.env` file has all values
2. No extra spaces or quotes
3. Restart server after changing `.env`

### Check Firebase Project:

1. Make sure project is on **Spark (Free)** or **Blaze (Pay-as-you-go)** plan
2. Phone Auth requires billing enabled for production
3. But test numbers work on free plan!

---

## ✅ Quick Test Checklist:

- [ ] Phone Auth enabled in Firebase Console
- [ ] Test phone numbers added
- [ ] Authorized domains include `localhost`
- [ ] `.env` file has correct values
- [ ] Dev server restarted
- [ ] Using test phone number: `+91 9999999999`
- [ ] Using test OTP: `123456`

---

## 📞 Test Phone Numbers to Use:

| Phone Number | OTP Code |
|--------------|----------|
| +91 9999999999 | 123456 |
| +91 8888888888 | 654321 |
| +91 7777777777 | 111111 |

**These bypass reCAPTCHA completely!**

---

## 🎯 Most Common Fix:

**Just add test phone numbers in Firebase Console!**

1. Firebase Console
2. Authentication → Sign-in method → Phone
3. Scroll to "Phone numbers for testing"
4. Add: `+91 9999999999` with OTP `123456`
5. Save
6. Test again!

This should fix 99% of cases! 🚀
