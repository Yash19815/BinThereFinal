/**
 * @fileoverview LoginPage – Full-screen authentication form for BinThere
 *
 * Renders a premium-styled login card with username and password fields.
 * On submit it calls the `login()` function from AuthContext.
 * Toast notifications are handled inside AuthContext, not here.
 */

import { useState } from "react";
import { useAuth } from "./AuthContext";
import binThereLogo from "./assets/logo.png";

/**
 * Full-screen login page shown when the user is not authenticated.
 *
 * @returns {JSX.Element}
 */
export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    const ok = await login(username.trim(), password);
    setLoading(false);
    if (!ok) {
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
  };

  return (
    <div className="login-page">
      {/* Background blobs for visual depth */}
      <div className="login-blob login-blob--1" />
      <div className="login-blob login-blob--2" />

      <div className={`login-card${shake ? " login-card--shake" : ""}`}>
        {/* Logo / Brand */}
        <div className="login-brand">
          <img src={binThereLogo} alt="BinThere logo" className="login-logo" />
          <h1 className="login-title">BinThere</h1>
          <p className="login-subtitle">Smart Dustbin Monitoring</p>
        </div>

        {/* Divider */}
        <div className="login-divider" />

        {/* Form */}
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="login-username">
              Username
            </label>
            <div className="input-wrap">
              <span className="input-icon">👤</span>
              <input
                id="login-username"
                className="form-input"
                type="text"
                autoComplete="username"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Password
            </label>
            <div className="input-wrap">
              <span className="input-icon">🔒</span>
              <input
                id="login-password"
                className="form-input"
                type={showPass ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
              <button
                type="button"
                className="input-eye"
                onClick={() => setShowPass((p) => !p)}
                aria-label={showPass ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPass ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={loading || !username.trim() || !password}
          >
            {loading ? (
              <span className="login-spinner" />
            ) : (
              <>Sign In &nbsp;→</>
            )}
          </button>
        </form>

        <p className="login-hint">
          Default credentials: <code>admin</code> / <code>admin123</code>
        </p>
      </div>
    </div>
  );
}
