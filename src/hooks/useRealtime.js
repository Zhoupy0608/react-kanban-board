import { useEffect, useRef } from 'react';
import { createWsUrl } from '../services/api';

/**
 * 订阅看板 / 用户通知 WebSocket。
 * onEvent(payload) 在收到消息时回调。
 */
export function useRealtime({ boardId, enabled = true, onEvent }) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return undefined;

    let ws;
    let closed = false;
    let retryTimer;
    let attempt = 0;

    const connect = async () => {
      if (closed) return;
      try {
        const url = await createWsUrl({ boardId });
        if (!url || closed) return;

        ws = new WebSocket(url);
        ws.onopen = () => {
          attempt = 0;
        };
        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            handlerRef.current?.(data);
          } catch {
            /* ignore */
          }
        };
        ws.onclose = () => {
          if (closed) return;
          attempt += 1;
          const delay = Math.min(8000, 600 * attempt);
          retryTimer = setTimeout(() => {
            void connect();
          }, delay);
        };
        ws.onerror = () => {
          try {
            ws.close();
          } catch {
            /* ignore */
          }
        };
      } catch {
        if (closed) return;
        attempt += 1;
        const delay = Math.min(8000, 600 * attempt);
        retryTimer = setTimeout(() => {
          void connect();
        }, delay);
      }
    };

    void connect();

    return () => {
      closed = true;
      clearTimeout(retryTimer);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  }, [boardId, enabled]);
}
