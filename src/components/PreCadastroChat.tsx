import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Send, Dumbbell } from 'lucide-react';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const INITIAL_AI_MESSAGE =
  'Olá! Sou o BiluTrainer. Para montar seu plano de treino e dieta, preciso te conhecer melhor. Qual seu peso e altura atual?';

export const PreCadastroChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: INITIAL_AI_MESSAGE },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Erro: você precisa estar logado para continuar.' },
        ]);
        return;
      }

      const messagesForApi = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: text },
      ];

      const { data, error } = await supabase.functions.invoke('pre-cadastro', {
        body: { messages: messagesForApi },
      });

      if (error) {
        console.error('[PreCadastroChat] Erro na Edge Function:', error);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Ocorreu um erro ao processar sua resposta. Tente novamente.',
          },
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
          aiContent = (data as { choices: { message: { content: string } }[] }).choices[0].message
            .content;
        } else {
          aiContent = 'Desculpe, não consegui processar a resposta. Tente novamente.';
        }
      } else {
        aiContent = 'Desculpe, ocorreu um erro inesperado. Tente novamente.';
      }

      const assistantMessage: ChatMessage = { role: 'assistant', content: aiContent };
      setMessages((prev) => [...prev, assistantMessage]);

      if (aiContent.includes('Perfil salvo com sucesso!')) {
        setProfileSaved(true);
      }
    } catch (err) {
      console.error('[PreCadastroChat] Erro:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Ocorreu um erro. Por favor, tente novamente.',
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
            <h1 className="text-lg font-bold text-white">BiluTrainer</h1>
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
        {profileSaved ? (
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
