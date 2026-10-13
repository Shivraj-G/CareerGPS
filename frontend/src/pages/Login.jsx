import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, setToken } from '../api/client';
import { Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';
import logo from '../assets/brand/navigoa-logo.jpg';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname || "/dashboard";

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setEmailError("");
    setPasswordError("");
    setGeneralError("");
    setSubmitting(true);
    try {
      const res = await api.login({
        email: form.email,
        password: form.password,
      });
      const token = res?.accessToken;
      if (!token)
        throw new Error("Login succeeded but no access token was returned.");
      setToken(token);
      await refreshUser();
      navigate(from, { replace: true });
    } catch (err) {
      if (err.code === "UNKNOWN_EMAIL") {
        setEmailError("This email is not registered with NaviGoa.");
      } else if (err.code === "INVALID_PASSWORD") {
        setPasswordError("Incorrect password. Please try again.");
      } else {
        setGeneralError(err.message || "Login failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-brand-header">
          <Link to="/" className="brand-link" aria-label="NaviGoa home">
            <img
              className="auth-logo-img"
              src={logo}
              alt="NaviGoa — Navigate, Build, Grow"
              width="210"
              height="140"
            />
          </Link>
        </div>

        <div className="auth-card">
          <div className="auth-heading">
            <h1>Welcome back</h1>
            <p>Sign in to continue your NaviGoa career journey.</p>
          </div>

          <form className="form-stack" onSubmit={handleSubmit} noValidate>
            <label htmlFor="login-email-page">
              Email address
              <input
                id="login-email-page"
                name="email"
                required
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                aria-invalid={!!emailError}
                aria-describedby={emailError ? "login-email-error-page" : undefined}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value });
                  if (emailError) setEmailError("");
                  if (generalError) setGeneralError("");
                }}
              />
              {emailError && (
                <p id="login-email-error-page" className="auth-error-text" role="alert">
                  {emailError}
                </p>
              )}
            </label>

            <label htmlFor="login-password-page">
              Password
              <div className="auth-password-wrapper">
                <input
                  id="login-password-page"
                  name="password"
                  required
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={form.password}
                  aria-invalid={!!passwordError}
                  aria-describedby={passwordError ? "login-password-error-page" : undefined}
                  onChange={(e) => {
                    setForm({ ...form, password: e.target.value });
                    if (passwordError) setPasswordError("");
                    if (generalError) setGeneralError("");
                  }}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordError && (
                <p id="login-password-error-page" className="auth-error-text" role="alert">
                  {passwordError}
                </p>
              )}
            </label>

            {generalError && (
              <div className="auth-general-error" role="alert">
                <AlertCircle size={16} />
                <span>{generalError}</span>
              </div>
            )}

            <button
              className="btn primary full auth-submit-btn"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Signing in..." : "Log In"}
            </button>
          </form>

          <p className="auth-footer">
            New to NaviGoa? <Link to="/signup">Create an account</Link>
          </p>
        </div>

        <Link to="/" className="auth-back-link">
          <ArrowLeft size={15} /> Back to home
        </Link>
      </div>
    </div>
  );
}
