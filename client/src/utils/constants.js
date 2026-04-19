export const CURRENT_HOST = window.location.hostname;
export const WS_URL = `ws://${CURRENT_HOST}:3001` || import.meta.env.VITE_WS_URL;
export const API_URL = `http://${CURRENT_HOST}:3001` || import.meta.env.VITE_API_URL;

export const ALERT_THRESHOLD = 80; // % — show notification

export function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
