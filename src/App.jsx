// Main App component with role-based routing
import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';

// Lazy-loaded pages — reduces initial bundle size
const Login = lazy(() => import('./pages/Login'));
const CustomerHome = lazy(() => import('./pages/CustomerHome'));
const OperatorHome = lazy(() => import('./pages/OperatorHome'));
const OwnerHome = lazy(() => import('./pages/OwnerHome'));
const AdminHome = lazy(() => import('./pages/AdminHome'));
const Profile = lazy(() => import('./pages/Profile'));
const History = lazy(() => import('./pages/History'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Help = lazy(() => import('./pages/Help'));
const Offline = lazy(() => import('./pages/Offline'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
import './App.css';

// Protected route wrapper
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

// Role-based home redirect
const RoleBasedHome = () => {
  const { userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  switch (userRole) {
    case 'customer':
      return <Navigate to="/customer" replace />;
    case 'operator':
      return <Navigate to="/operator" replace />;
    case 'owner':
      return <Navigate to="/owner" replace />;
    case 'admin':
      return <Navigate to="/admin" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
};

function AppRoutes() {
  return (
    <Suspense fallback={<div className="loading-screen"><div className="spinner"></div><p>Loading…</p></div>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RoleBasedHome />} />

        {/* Shared routes - accessible by all authenticated users */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute allowedRoles={['customer', 'operator', 'owner', 'admin']}>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <History />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute allowedRoles={['customer', 'operator', 'owner', 'admin']}>
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/help"
          element={
            <ProtectedRoute allowedRoles={['customer', 'operator', 'owner', 'admin']}>
              <Help />
            </ProtectedRoute>
          }
        />

        {/* Customer routes */}
        <Route
          path="/customer/*"
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <CustomerHome />
            </ProtectedRoute>
          }
        />

        {/* Operator routes */}
        <Route
          path="/operator/*"
          element={
            <ProtectedRoute allowedRoles={['operator']}>
              <OperatorHome />
            </ProtectedRoute>
          }
        />

        {/* Owner routes */}
        <Route
          path="/owner/*"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <OwnerHome />
            </ProtectedRoute>
          }
        />

        {/* Admin routes */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminHome />
            </ProtectedRoute>
          }
        />

        {/* Unauthorized */}
        <Route
          path="/unauthorized"
          element={
            <div className="unauthorized-screen">
              <h1>Unauthorized Access</h1>
              <p>You don't have permission to access this page.</p>
            </div>
          }
        />

        {/* Offline fallback route */}
        <Route path="/offline" element={<Offline />} />

        {/* Public routes — no auth required */}
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div id="recaptcha-container"></div>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
