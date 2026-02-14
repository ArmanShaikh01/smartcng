// Main App component with role-based routing
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import CustomerHome from './pages/CustomerHome';
import OperatorHome from './pages/OperatorHome';
import OwnerHome from './pages/OwnerHome';
import AdminHome from './pages/AdminHome';
import Profile from './pages/Profile';
import History from './pages/History';
import Notifications from './pages/Notifications';
import Help from './pages/Help';
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

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
