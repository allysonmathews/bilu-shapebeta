import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Send, Bot, User } from 'lucide-react';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const INITIAL_AI_MESSAGE =
  'Fala! Bem-vindo ao Bilu Shape. Sou sua IA pessoal. Antes de montarmos seu plano, me conta: qual é o seu nome e qual o seu maior objetivo hoje?';

// Contorno 503 Hostinger: conexão direta ao backend na porta 3001
const API_URL = 'http://46.202.145.27:3001/api/chat/onboarding';

export const OnboardingChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: INITIAL_AI_MESSAGE },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    console.log('Tentando conectar em:', API_URL);
    const text = inputValue.trim();
    if (!text || isLoading) return;

    setError(null);
    const userMessage: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const messagesForApi = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: text },
      ];

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ messages: messagesForApi }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Erro ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') {
              next[next.length - 1] = { ...last, content: fullContent };
            } else {
              next.push({ role: 'assistant', content: fullContent });
            }
            return next;
          });
        }
      }

      console.log('CONTEÚDO RECEBIDO DA IA:', fullContent);

      if (!fullContent) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Desculpe, não recebi resposta. Tente novamente.' },
        ]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ocorreu um erro. Tente novamente.';
      console.error('[OnboardingChat] Erro:', err);
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: msg,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full min-h-[500px] flex-col rounded-2xl bg-deep-bg/95 shadow-xl border border-gray-800/50 overflow-hidden">
      {/* Header - estilo WhatsApp/ChatGPT */}
      <header className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-card-bg/80 border-b border-gray-800/60 backdrop-blur-sm">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-alien-green/30 to-bilu-purple/30 border border-alien-green/40">
          <Bot className="h-5 w-5 text-alien-green" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-white">Bilu Shape AI</h2>
          <p className="truncate text-xs text-gray-400">Sua IA pessoal de treino e nutrição</p>
        </div>
      </header>

      {/* Área de mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  msg.role === 'user'
                    ? 'bg-alien-green/20 text-alien-green'
                    : 'bg-gray-700/60 text-gray-300'
                }`}
              >
                {msg.role === 'user' ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>

              {/* Balão */}
              <div
                className={`group relative max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'rounded-tr-md bg-gradient-to-br from-alien-green to-emerald-500 text-black shadow-lg shadow-alien-green/20'
                    : 'rounded-tl-md bg-gray-800/80 text-gray-100 border border-gray-700/50 shadow-md'
                }`}
              >
                <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                  {msg.content}
                </p>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-700/60">
                <Bot className="h-4 w-4 text-gray-400" />
              </div>
              <div className="rounded-2xl rounded-tl-md bg-gray-800/80 border border-gray-700/50 px-4 py-3">
                <div className="flex gap-1.5">
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-alien-green"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-alien-green"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-alien-green"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Erro (limpo ao enviar) */}
      {error && (
        <div className="flex-shrink-0 px-4 py-2 bg-red-900/20 border-t border-red-800/40">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-800/60 bg-card-bg/50 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            disabled={isLoading}
            rows={1}
            className="flex-1 min-h-[48px] resize-none rounded-xl border border-gray-700/60 bg-gray-900/60 px-4 py-3 text-white placeholder-gray-500 focus:border-alien-green/50 focus:outline-none focus:ring-1 focus:ring-alien-green/30 disabled:opacity-60"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !inputValue.trim()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-alien-green to-emerald-500 text-black shadow-lg shadow-alien-green/20 transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
