import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, getToken, setToken, clearToken } from "../api/client.js";

const AuthContext = React.createContext({
  user: null,
  loading: true,
  refreshUser: async () => {},
  logout: () => {},
});

export function useAuth() {
  return React.useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());
  // We can't use useNavigate here if AuthProvider is outside the RouterProvider,
  // but if we wrap it inside RouterProvider, we can. Wait, it's better to provide logout 
  // that just clears state and redirects, or handle redirect in the component.
  
  async function refreshUser() {
    // If no token, maybe we have a refresh token in httpOnly cookie? 
    // We should try to call /auth/refresh first if there's no access token but we want to restore session.
    // The instructions say: "Session restoration on application reload using the existing backend/client contract."
    let token = getToken();
    
    setLoading(true);
    try {
      if (!token) {
        const res = await api.refresh();
        if (res && res.accessToken) {
          setToken(res.accessToken);
        } else {
          setUser(null);
          setLoading(false);
          return;
        }
      }
      
      const data = await api.me();
      setUser(data?.data ?? data ?? {});
    } catch (err) {
      if (err.status === 401) {
        clearToken();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearToken();
    setUser(null);
    // Let the protected route or UI handle redirection, or use window.location
    window.location.href = "/login";
  }

  useEffect(() => {
    refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
