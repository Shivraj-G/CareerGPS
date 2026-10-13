import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Clock3 } from 'lucide-react';

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="app-shell">
        <main className="page-content" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="empty-state loading-pulse">
            <Clock3 size={24} />
            <h2>Loading your account...</h2>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
