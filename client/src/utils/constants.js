// In production Electron (file:// protocol), window.location.hostname is "".
// Fall back to "localhost" since the server is always local.
export const CURRENT_HOST =
  window.location.hostname !== "" ? window.location.hostname : "localhost";
export const WS_URL = `ws://${CURRENT_HOST}:3001`;
export const API_URL = `http://${CURRENT_HOST}:3001`;
export const ALERT_THRESHOLD = 80; // % — show notification
export function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
