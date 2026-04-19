import { useEffect, useRef, useState } from 'react';
import { WS_URL } from '../utils/constants';

export function useWebSocket({ onMessage, onStatusChange }) {
  const wsRef = useRef(null);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  useEffect(() => {
    let reconnectTimer;

    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      setStatus('connecting');

      ws.onopen = () => setStatus('connected');
      ws.onclose = () => {
        setStatus('disconnected');
        reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => {};

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          onMessage?.(msg);
        } catch (e) {
          console.error("Failed to parse WebSocket message", e);
        }
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [onMessage]);

  return { wsRef, status };
}
