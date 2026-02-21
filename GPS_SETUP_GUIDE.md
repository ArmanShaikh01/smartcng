# GPS/Location Setup Guide

## 🎯 Problem
Browser GPS permission not working on localhost!

---

## ✅ Solutions

### **Option 1: Enable Location in Browser (RECOMMENDED)**

#### **Chrome/Edge:**
1. Click **lock icon** 🔒 in address bar (left of URL)
2. Click **Site settings**
3. Find **Location** → Change to **Allow**
4. Refresh page (F5)

#### **Firefox:**
1. Click **i icon** ℹ️ in address bar
2. Click **Permissions** tab
3. Find **Access Your Location** → **Allow**
4. Refresh page

#### **Brave:**
1. Click **lion icon** 🦁 in address bar
2. Click **Site settings**
3. **Location** → **Allow**

---

### **Option 2: Use HTTPS (Production)**

**Why?** Modern browsers require HTTPS for geolocation API (except localhost)

**For Vite:**
```bash
# Install mkcert for local HTTPS
npm install -D @vitejs/plugin-basic-ssl

# Update vite.config.js
import basicSsl from '@vitejs/plugin-basic-ssl'

export default {
  plugins: [react(), basicSsl()],
  server: {
    https: true
  }
}
```

Then access: `https://localhost:5173`

---

### **Option 3: Mock Location for Testing**

**Add to `.env`:**
```
VITE_USE_MOCK_GPS=true
VITE_MOCK_LATITUDE=18.5204
VITE_MOCK_LONGITUDE=73.8567
```

**Code will auto-detect and use mock location in development!**

---

## 🧪 Testing GPS

### **1. Check Browser Support:**
Open browser console (F12) and run:
```javascript
if (navigator.geolocation) {
  console.log('✅ Geolocation supported');
  navigator.geolocation.getCurrentPosition(
    (pos) => console.log('✅ Location:', pos.coords),
    (err) => console.error('❌ Error:', err.message)
  );
} else {
  console.log('❌ Geolocation NOT supported');
}
```

### **2. Check Permission:**
```javascript
navigator.permissions.query({name: 'geolocation'}).then(result => {
  console.log('Permission:', result.state);
  // 'granted', 'denied', or 'prompt'
});
```

---

## 🔧 Common Issues

### **Issue 1: "User denied Geolocation"**
**Fix:** 
- Clear site data (F12 → Application → Clear site data)
- Reload page
- Allow permission when prompted

### **Issue 2: "Geolocation timeout"**
**Fix:**
- Enable high-accuracy GPS on phone/laptop
- Move near window for better GPS signal
- Increase timeout in code (already 10 seconds)

### **Issue 3: "Position unavailable"**
**Fix:**
- Check if GPS is enabled on device
- Try different browser
- Use mock location for testing

---

## 📱 Mobile Testing

### **Android Chrome:**
1. Settings → Site Settings → Location → Allow
2. Enable GPS in phone settings
3. Grant Chrome location permission

### **iOS Safari:**
1. Settings → Safari → Location → While Using
2. Enable Location Services in iOS Settings

---

## 🎯 Quick Test

**After allowing permission, you should see:**
1. Browser shows location icon in address bar
2. "Checking location..." appears when clicking Check-in
3. Either success or distance error (if too far)

**If still not working:**
- Check browser console (F12) for errors
- Try incognito/private mode
- Clear browser cache
- Restart browser

---

## 🚀 Production Deployment

**For production (Vercel/Netlify):**
- ✅ HTTPS is automatic
- ✅ GPS will work on all browsers
- ✅ No special setup needed

**Current localhost issue is ONLY for development!**
