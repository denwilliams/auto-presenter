'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { ServerTextMessage, ClientMessage, ToneId } from '@/types/messages';

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected';

export interface UseWebSocketReturn {
  status: WebSocketStatus;
  send: (message: ClientMessage) => void;
  sendStart: (markdown: string, objectives: string, slideCount: number, tone: ToneId) => void;
  sendAck: (type: 'slide_displayed' | 'speech_complete') => void;
  onTextMessage: React.MutableRefObject<((msg: ServerTextMessage) => void) | null>;
  onBinaryMessage: React.MutableRefObject<((data: ArrayBuffer) => void) | null>;
}

export function useWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const onTextMessage = useRef<((msg: ServerTextMessage) => void) | null>(null);
  const onBinaryMessage = useRef<((data: ArrayBuffer) => void) | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => {
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        onBinaryMessage.current?.(event.data);
      } else {
        try {
          const msg: ServerTextMessage = JSON.parse(event.data);
          onTextMessage.current?.(msg);
        } catch {
          // Ignore non-JSON
        }
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
    };

    ws.onerror = () => {
      setStatus('disconnected');
    };

    return () => {
      ws.close();
    };
  }, []);

  const send = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendStart = useCallback(
    (markdown: string, objectives: string, slideCount: number, tone: ToneId) => {
      send({ type: 'start', markdown, objectives, slideCount, tone });
    },
    [send],
  );

  const sendAck = useCallback(
    (type: 'slide_displayed' | 'speech_complete') => {
      send({ type } as ClientMessage);
    },
    [send],
  );

  return { status, send, sendStart, sendAck, onTextMessage, onBinaryMessage };
}
