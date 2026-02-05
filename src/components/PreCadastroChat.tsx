import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { usePlan } from '../context/PlanContext';
import { Send, Dumbbell } from 'lucide-react';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const INITIAL_AI_MESSAGE =
  'Olá! Sou o Bilu Shape AI. Para montar seu plano de treino e dieta, preciso te conhecer melhor. Qual seu nome?';

// Subdomínio app.bilushape.com: usar sempre caminho relativo (sem absoluto nem localhost)
const API_URL = '/api/chat/onboarding';

/** Frases que indicam que o perfil foi salvo com sucesso (IA confirma conclusão). */
const PROFILE_COMPLETE_PHRASES = [
  'perfil salvo com sucesso',
  'salvo com sucesso',
  'salvei todas as suas informações',
  'salvei todas as informações',
  'tudo pronto',
  'finalizamos',
  'perfeito! salvei',
  'pronto, salvei',
  'posso montar seu plano',
];

function isProfileComplete(content: string): boolean {
  const lower = content.toLowerCase();
  return PROFILE_COMPLETE_PHRASES.some((p) => lower.includes(p));
}

export const PreCadastroChat: React.FC = () => {
  const { refreshProfileFromSupabase, setPlan } = useUser();
  const { generatePlanAsync } = usePlan();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: INITIAL_AI_MESSAGE },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  /** Redirecionamento automático: ao detectar perfil salvo, aguarda 2s e atualiza estado para exibir o app principal. */
  useEffect(() => {
    if (!profileSaved || isRedirecting) return;
    const timer = setTimeout(async () => {
      setIsRedirecting(true);
      sessionStorage.setItem('bilu_initial_tab', 'evolucao');
      const { data: { session } } = await supabase.auth.getSession();
      refreshProfileFromSupabase(async (data) => {
        try {
          const plan = await generatePlanAsync(data, session?.access_token ?? null);
          setPlan(plan);
        } catch (e) {
          console.error('Erro ao gerar plano:', e);
        }
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [profileSaved, isRedirecting, refreshProfileFromSupabase, generatePlanAsync, setPlan]);

  const handleSend = async () => {
    console.log('CHAMANDO API...');
    const text = inputValue.trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const messagesForApi = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: text },
      ];

      // Nova API Next.js com streaming
      console.log('Tentando conectar em:', API_URL);

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

        if (!fullContent) {
          setMessages((prev) => [...prev, { role: 'assistant', content: 'Desculpe, não recebi resposta. Tente novamente.' }]);
        }

        if (isProfileComplete(fullContent)) {
          setProfileSaved(true);
        }
      } else {
        // Supabase Edge Function (sem streaming)
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: 'Erro: você precisa estar logado para continuar.' },
          ]);
          return;
        }

        const { data, error } = await supabase.functions.invoke('pre-cadastro', {
          body: { messages: messagesForApi },
        });

        if (error) {
          console.error('[PreCadastroChat] Erro na Edge Function:', error);
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: 'Ocorreu um erro ao processar sua resposta. Tente novamente.' },
          ]);
          return;
        }

        let aiContent: string;
        if (typeof data === 'object' && data !== null) {
          if ('content' in data && typeof (data as { content: string }).content === 'string') {
            aiContent = (data as { content: string }).content;
          } else if (
            'choices' in data &&
            Array.isArray((data as { choices: unknown[] }).choices) &&
            (data as { choices: { message?: { content?: string } }[] }).choices[0]?.message?.content
          ) {
            aiContent = (data as { choices: { message: { content: string } }[] }).choices[0].message.content;
          } else {
            aiContent = 'Desculpe, não consegui processar a resposta. Tente novamente.';
          }
        } else {
          aiContent = 'Desculpe, ocorreu um erro inesperado. Tente novamente.';
        }

        setMessages((prev) => [...prev, { role: 'assistant', content: aiContent }]);
        if (isProfileComplete(aiContent)) {
          setProfileSaved(true);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ocorreu um erro. Tente novamente.';
      console.error('[PreCadastroChat] Erro:', err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: msg },
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

  const handleAccessDashboard = () => {
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#000000]">
      {/* Header */}
      <header className="flex-shrink-0 px-4 py-3 border-b border-[#00FF00]/30 bg-[#000000]">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-[#00FF00]/20 flex items-center justify-center border border-[#00FF00]/50">
            <Dumbbell size={22} className="text-[#00FF00]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Bilu Shape AI</h1>
            <p className="text-xs text-gray-400">Preencha seu perfil via chat</p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-[#00FF00] text-black'
                  : 'bg-[#1a1a1a] text-gray-100 border border-[#00FF00]/40'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#1a1a1a] border border-[#00FF00]/40 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-[#00FF00] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#00FF00] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#00FF00] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input or CTA */}
      <div className="flex-shrink-0 p-4 bg-[#000000] border-t border-gray-800">
        {isRedirecting ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-[#00FF00] animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-[#00FF00] animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-[#00FF00] animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-sm text-gray-400">Redirecionando para seu plano...</p>
          </div>
        ) : profileSaved ? (
          <button
            onClick={handleAccessDashboard}
            className="w-full py-4 px-6 rounded-2xl font-bold text-lg bg-[#00FF00] text-black hover:bg-[#00DD00] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,255,0,0.3)]"
          >
            Acessar meu Plano de Treino
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua resposta..."
              disabled={isLoading}
              className="flex-1 px-4 py-3 rounded-xl bg-[#1a1a1a] border-2 border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF00] transition-colors disabled:opacity-60"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !inputValue.trim()}
              className="p-3 rounded-xl bg-[#00FF00] text-black hover:bg-[#00DD00] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Send size={22} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
