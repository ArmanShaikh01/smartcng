# CNG Station Smart Queue & Booking Management System

A modern SaaS platform for managing CNG station queues with real-time updates, GPS-based check-ins, and guaranteed fueling.

## 🚀 Features

### Customer Features
- Phone OTP authentication
- Vehicle registration and management
- Real-time queue visualization
- GPS-based check-in
- Live queue position tracking
- Booking management

### Operator Features
- Large-screen optimized interface
- GAS ON/OFF controls
- BOOKING ON/OFF controls
- NEXT button for queue advancement
- Visual queue with check-in indicators
- Awareness panel (current/next vehicle)

### Station Owner Features
- Station management dashboard
- Analytics and reporting
- Operator management
- Queue configuration

### Admin Features
- Multi-station management
- System-wide analytics
- User management
- Audit logs

## 🛠️ Tech Stack

- **Frontend**: React.js + Vite (PWA)
- **Authentication**: Firebase Authentication (Phone OTP)
- **Database**: Firebase Firestore
- **Realtime**: Firestore listeners
- **Routing**: React Router DOM
- **Styling**: Vanilla CSS with design system

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Firebase project with:
  - Authentication enabled (Phone)
  - Firestore database
  - Cloud Messaging (optional for push notifications)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd smart-cng-station
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - Create a `.env` file in the root directory
   - Copy contents from `.env.example`
   - Add your Firebase configuration values:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:5173
   ```

## 📁 Project Structure

```
src/
├── firebase/
│   ├── config.js          # Firebase initialization
│   ├── auth.js            # Authentication helpers
│   └── firestore.js       # Firestore helpers
├── hooks/
│   ├── useAuth.jsx        # Authentication hook
│   ├── useRealtimeQueue.js # Queue listener hook
│   └── useGeolocation.js  # GPS tracking hook
├── pages/
│   ├── Login.jsx          # Login page
│   ├── CustomerHome.jsx   # Customer dashboard
│   ├── OperatorHome.jsx   # Operator dashboard
│   ├── OwnerHome.jsx      # Owner dashboard
│   └── AdminHome.jsx      # Admin dashboard
├── components/            # Shared components (coming soon)
├── App.jsx               # Main app with routing
└── App.css               # Global styles
```

## 🔐 User Roles

1. **Customer** - Books CNG, tracks queue, checks in via GPS
2. **Operator** - Manages station operations, advances queue
3. **Owner** - Manages station, views analytics
4. **Admin** - Manages entire SaaS platform

## 🗄️ Firestore Collections

- `users` - User profiles and roles
- `stations` - CNG station data
- `bookings` - Queue bookings
- `queue_logs` - Audit trail
- `notifications` - User notifications

## 🚦 Queue States

- `waiting` - Booked, position > 10
- `eligible` - Position ≤ 10, can check-in
- `checked_in` - GPS verified, present at station
- `fueling` - Currently being fueled
- `completed` - Fueling finished
- `skipped` - Missed turn, moved to end
- `cancelled` - Booking cancelled

## 📱 PWA Support

This app is built as a Progressive Web App (PWA) for:
- Offline capability
- App-like experience
- Push notifications
- Home screen installation

## 🔒 Security

- Phone OTP authentication
- Firestore security rules
- Role-based access control
- GPS-enforced check-ins
- Immutable audit logs

## 🧪 Testing

```bash
# Run tests (coming soon)
npm test

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📄 License

Proprietary - All rights reserved

## 👥 Support

For support, contact the development team.

---

**Status**: 🚧 In Development

**Version**: 0.1.0 (MVP Phase)
