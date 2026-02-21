# Fix: Duplicate User Creation Issue

## Problem:
Har login pe naya user document ban raha hai instead of existing user ko use karna.

## Root Cause:
`createDocument()` function `addDoc()` use kar raha hai jo auto-generated ID deta hai.
Humein `setDoc()` use karna chahiye with Firebase Auth UID as document ID.

## Solution:

### File: `src/pages/Login.jsx`

**Line 107 ko replace karo:**

**OLD CODE:**
```javascript
await createDocument(COLLECTIONS.USERS, newUserData);
```

**NEW CODE:**
```javascript
import { setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

// In handleSignup function, replace line 107 with:
await setDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid), {
  ...newUserData,
  createdAt: new Date()
});
```

## Complete Fixed handleSignup Function:

```javascript
const handleSignup = async (e) => {
  e.preventDefault();
  setError('');
  setLoading(true);

  try {
    const firebaseUser = user || (await verifyOTP(confirmationResult, otp)).user;

    const newUserData = {
      userId: firebaseUser.uid,
      phoneNumber: firebaseUser.phoneNumber,
      name: signupData.name,
      role: 'customer',
      stationId: null,
      defaultVehicle: signupData.vehicleNumber.toUpperCase(),
      vehicles: [signupData.vehicleNumber.toUpperCase()],
      noShowCount: 0,
      isBanned: false,
      bannedUntil: null
    };

    // Use setDoc with Firebase UID as document ID
    const { setDoc, doc } = await import('firebase/firestore');
    const { db } = await import('../firebase/config');
    
    await setDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid), {
      ...newUserData,
      createdAt: new Date()
    });
    
    setUserProfile(newUserData);
    setUserRole('customer');
    setLoading(false);
    navigate('/');
  } catch (err) {
    console.error('Error creating user:', err);
    setError('Failed to create account. Please try again.');
    setLoading(false);
  }
};
```

## Steps to Fix:

1. Open `src/pages/Login.jsx`
2. Find `handleSignup` function (around line 86)
3. Replace the entire function with code above
4. Save file
5. Refresh browser

## After Fix:

1. **Delete duplicate users from Firestore:**
   - Firebase Console → Firestore → users
   - Delete extra documents
   - Keep only one per phone number

2. **Test:**
   - Logout
   - Login again
   - Should NOT create duplicate! ✅

## Make Admin:

1. Firestore → users → your document
2. Edit `role` field → change to `admin`
3. Save
4. Logout & login
5. Admin dashboard! 🎉
