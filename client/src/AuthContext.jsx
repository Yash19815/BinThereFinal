/**
 * @fileoverview AuthContext – Global authentication state for BinThere
 *
 * Provides { user, token, login, logout, loading } via React Context.
 *
 * On mount, the provider attempts to rehydrate the session from the JWT
 * stored in localStorage by calling GET /api/auth/me. If the token is
 * missing or expired the user is silently left as null.
 *
 * Usage:
 *   import { useAuth } from './AuthContext';
 *   const { user, login, logout } = useAuth();
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import toast from "react-hot-toast";

const CURRENT_HOST = window.location.hostname || import.meta.env.VITE_API_URL;

// Prioritize .env values, otherwise use the auto-detected host
const API_URL = `http://${CURRENT_HOST}:3001`;

/** @type {React.Context<AuthContextValue>} */
const AuthContext = createContext(null);

/**
 * Provides authentication state to the component tree.
 *
 * @param {{ children: React.ReactNode }} props
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("bt_token"));
  const [loading, setLoading] = useState(true);

  // ── Rehydrate session on mount ───────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.status === "success") {
          setUser(json.user);
        } else {
          // Token invalid / expired — clear it silently
          localStorage.removeItem("bt_token");
          setToken(null);
        }
      })
      .catch(() => {
        // Server unreachable — keep token, retry later
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Login ────────────────────────────────────────────────────────────────
  /**
   * Authenticates the user with username/password.
   * Shows a success toast on success, error toast on failure.
   *
   * @param {string} username
   * @param {string} password
   * @returns {Promise<boolean>} true if login succeeded
   */
  const login = useCallback(async (username, password) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();

      if (json.status === "success") {
        localStorage.setItem("bt_token", json.token);
        setToken(json.token);
        setUser(json.user);
        toast.success(`Welcome back, ${json.user.username}! 👋`, {
          duration: 3000,
          icon: "🗑️",
        });
        return true;
      } else {
        toast.error(json.message || "Invalid credentials", { duration: 4000 });
        return false;
      }
    } catch {
      toast.error("Cannot reach the server. Is it running?", {
        duration: 4000,
      });
      return false;
    }
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────
  /**
   * Clears the stored token and user state, then shows a logout toast.
   */
  const logout = useCallback(() => {
    localStorage.removeItem("bt_token");
    setToken(null);
    setUser(null);
    toast.success("Logged out successfully", {
      duration: 3000,
      icon: "👋",
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Convenience hook to consume AuthContext.
 *
 * @returns {{ user: object|null, token: string|null, login: Function, logout: Function, loading: boolean }}
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
