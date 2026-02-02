import { useState, useEffect, useCallback, useRef } from 'react';

interface Chapter {
  id: string;
  title: string;
  filename: string;
  content: string;
  raw?: string;
  metadata?: Record<string, unknown>;
}

interface WebSocketMessage {
  type: 'init' | 'chapter_updated' | 'pong';
  chapters?: Chapter[];
  chapter?: Chapter;
}

const WS_URL = 'ws://localhost:8001/ws';
const API_URL = 'http://localhost:8001/api';

export function useBookData() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);

        if (data.type === 'init' && data.chapters) {
          setChapters(data.chapters);
          setLoading(false);
        } else if (data.type === 'chapter_updated' && data.chapter) {
          setChapters((prev) =>
            prev.map((ch) =>
              ch.id === data.chapter!.id ? data.chapter! : ch
            )
          );
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, []);

  // Initial connection
  useEffect(() => {
    connect();

    // Ping to keep connection alive
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  // Fallback fetch if WebSocket fails
  const fetchBook = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/book`);
      const data = await response.json();
      setChapters(data.chapters);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch book:', error);
    }
  }, []);

  useEffect(() => {
    // Fallback if WS doesn't connect in 5 seconds
    const timeout = setTimeout(() => {
      if (loading && !connected) {
        fetchBook();
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [loading, connected, fetchBook]);

  return { chapters, loading, connected };
}
