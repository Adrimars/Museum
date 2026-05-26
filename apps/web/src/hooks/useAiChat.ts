import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { useAuthStore } from '../store/authStore';

function findLastStreamingIndex(msgs: ChatMessage[]): number {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i]!.streaming) return i;
  }
  return -1;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

interface UseAiChatOptions {
  sessionId: string;
  museumId: string;
}

const WS_URL = import.meta.env['VITE_WS_URL'] ?? 'http://localhost:3000';

export function useAiChat({ sessionId, museumId }: UseAiChatOptions) {
  const { accessToken } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !sessionId) return;

    const socket = io(`${WS_URL}/ws/ai`, {
      auth: { token: accessToken },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', () => {
      setError('Connection failed. Please check your session.');
    });

    socket.on('ai:typing_start', () => {
      setIsTyping(true);
      setMessages((prev) => [
        ...prev,
        { id: `streaming-${Date.now()}`, role: 'assistant', content: '', streaming: true },
      ]);
    });

    socket.on('ai:token', ({ token }: { token: string }) => {
      setMessages((prev) => {
        const idx = findLastStreamingIndex(prev);
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = { ...updated[idx]!, content: updated[idx]!.content + token };
        return updated;
      });
    });

    socket.on('ai:typing_end', ({ content }: { content: string }) => {
      setIsTyping(false);
      setMessages((prev) => {
        const idx = findLastStreamingIndex(prev);
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx]!,
          content,
          streaming: false,
          id: `assistant-${Date.now()}`,
        };
        return updated;
      });
    });

    socket.on('ai:error', ({ message: msg }: { message: string }) => {
      setIsTyping(false);
      setError(msg);
      setMessages((prev) => prev.filter((m) => !m.streaming));
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken, sessionId]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!socketRef.current?.connected || !content.trim()) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: content.trim(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setError(null);

      socketRef.current.emit('ai:send_message', {
        sessionId,
        message: content.trim(),
      });
    },
    [sessionId],
  );

  return {
    messages,
    isTyping,
    isConnected,
    error,
    sendMessage,
    museumId,
  };
}
