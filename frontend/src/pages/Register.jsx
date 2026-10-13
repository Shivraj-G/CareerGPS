import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, setToken } from '../api/client';
import { UserRound } from 'lucide-react';
import { BrandMark } from '../components/common/BrandMark';

export function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useAuth();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname || "/onboarding";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.register({
        email: form.email,
        password: form.password,
        full_name: form.fullName.trim() || undefined,
      });
      const token = res?.accessToken;
      if (!token) {
        throw new Error("Registration succeeded but no access token was returned.");
      }
      setToken(token);
      await refreshUser();
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        err.status === 409
          ? "An account with this email already exists."
          : err.message || "Registration failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <Link className="brand-link" to="/" aria-label="NaviGoa home" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BrandMark className="brand-logo" />
        </Link>
      </div>
      <div className="auth-card">
        <div className="auth-heading">
          <div className="auth-icon">
            <UserRound />
          </div>
          <h1>Create an account</h1>
          <p>Start your career journey with NaviGoa</p>
        </div>
        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            Full Name
            <input
              type="text"
              placeholder="e.g. Rahul Naik"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </label>
          <label>
            Email address
            <input
              required
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              placeholder="At least 8 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          <label>
            Confirm Password
            <input
              required
              type="password"
              placeholder="Type your password again"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            />
          </label>
          {error && (
            <p style={{ color: "var(--red)", fontSize: 11, margin: 0 }} role="alert">
              {error}
            </p>
          )}
          <button
            className="btn primary full"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
