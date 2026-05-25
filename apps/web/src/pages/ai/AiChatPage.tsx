import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';

import { Button } from '@museumquest/ui';

import { useAiChat } from '../../hooks/useAiChat';
import { useAuthStore } from '../../store/authStore';

const API_URL = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3000';

interface SuggestedQuestion {
  text: string;
}

export default function AiChatPage() {
  const { t, i18n } = useTranslation();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const museumId = searchParams.get('museumId') ?? '';
  const artifactId = searchParams.get('artifactId') ?? undefined;

  const { accessToken } = useAuthStore();
  const [input, setInput] = useState('');
  const [suggested, setSuggested] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, isTyping, isConnected, error, sendMessage } = useAiChat({
    sessionId: sessionId ?? '',
    museumId,
  });

  // Load suggested questions for the artifact context
  useEffect(() => {
    if (!artifactId || !accessToken) return;
    const lang = i18n.language.startsWith('tr') ? 'tr' : 'en';
    axios
      .get<string[]>(`${API_URL}/ai/artifacts/${artifactId}/suggested-questions`, {
        params: { lang },
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then((res) => setSuggested(res.data))
      .catch(() => {/* silently ignore */});
  }, [artifactId, accessToken, i18n.language]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!sessionId) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        {t('ai.invalidSession')}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b px-4 py-3 flex items-center gap-3">
        <div className="flex-1">
          <h1 className="font-semibold text-sm">{t('ai.chatTitle')}</h1>
          <span className={`text-xs ${isConnected ? 'text-green-500' : 'text-muted-foreground'}`}>
            {isConnected ? t('ai.connected') : t('ai.connecting')}
          </span>
        </div>
      </header>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isTyping && (
          <div className="text-center text-muted-foreground text-sm py-8">
            {t('ai.startPrompt')}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-muted text-foreground rounded-bl-sm'
              }`}
            >
              {msg.content}
              {msg.streaming && (
                <span className="inline-block w-1 h-4 ml-0.5 bg-current animate-pulse align-middle" />
              )}
            </div>
          </div>
        ))}

        {isTyping && messages.every((m) => !m.streaming) && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Suggested questions */}
      {suggested.length > 0 && messages.length === 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {suggested.map((q, i) => (
            <button
              key={i}
              onClick={() => {
                sendMessage(q);
                setSuggested([]);
              }}
              className="text-xs bg-muted hover:bg-muted/80 rounded-full px-3 py-1.5 text-left transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="border-t p-3 flex gap-2 items-end">
        <textarea
          className="flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[40px] max-h-32"
          placeholder={t('ai.inputPlaceholder')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={!isConnected || isTyping}
        />
        <Button
          onClick={handleSend}
          disabled={!isConnected || isTyping || !input.trim()}
          className="shrink-0"
          size="sm"
        >
          {t('ai.send')}
        </Button>
      </div>
    </div>
  );
}
