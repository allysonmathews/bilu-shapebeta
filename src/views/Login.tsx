import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Mail, Sparkles } from 'lucide-react';

type Mode = 'login' | 'signup';

export const Login: React.FC = () => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSignUpSuccess(false);
    if (!email.trim() || !password.trim()) {
      setError('Preencha e-mail e senha.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: { emailRedirectTo: window.location.origin },
        });
        if (signUpError) throw signUpError;
        setSignUpSuccess(true);
        setPassword('');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (signInError) throw signInError;
        // Redirecionamento ocorre via onAuthStateChange no UserContext
      }
    } catch (err: unknown) {
      const msg = err && typeof (err as { message?: string }).message === 'string'
        ? (err as { message: string }).message
        : 'Erro ao autenticar. Tente novamente.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === 'login' ? 'signup' : 'login'));
    setError(null);
    setSignUpSuccess(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-deep-bg p-4 relative overflow-hidden">
      {/* Decoração de fundo neon */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(57, 255, 20, 0.15) 0%, transparent 60%)',
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none opacity-10"
        style={{
          background: 'linear-gradient(to top, rgba(57, 255, 20, 0.2), transparent)',
        }}
      />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-card-bg border border-alien-green/40 mb-4 shadow-[0_0_20px_rgba(57,255,20,0.3)]">
            <Sparkles className="w-7 h-7 text-alien-green" />
          </div>
          <h1 className="text-4xl font-bold text-alien-green mb-2 tracking-tight" style={{ textShadow: '0 0 24px rgba(57, 255, 20, 0.5)' }}>
            BILU SHAPE
          </h1>
          <p className="text-gray-400">
            {mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}
          </p>
        </div>

        <div className="bg-card-bg border border-gray-800 rounded-xl p-6 sm:p-8 shadow-xl shadow-black/30">
          {signUpSuccess ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-alien-green/10 border border-alien-green/50 mb-4">
                <Mail className="w-6 h-6 text-alien-green" />
              </div>
              <p className="text-alien-green font-medium mb-2">
                Verifique seu e-mail para confirmar o cadastro
              </p>
              <p className="text-gray-400 text-sm">
                O Supabase envia um link de confirmação automaticamente. Após clicar no link, faça login na aba &quot;Entrar&quot;.
              </p>
              <Button
                variant="outline"
                className="mt-6 w-full"
                onClick={() => { setSignUpSuccess(false); setMode('login'); }}
              >
                Voltar para Entrar
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                label="E-mail"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
                autoFocus
              />
              <Input
                type="password"
                label="Senha"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                disabled={loading}
              />
              {error && (
                <p className="text-sm text-red-400 bg-red-950/30 border border-red-800/50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                variant="primary"
                className="w-full py-3 text-base"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-deep-bg border-t-transparent rounded-full animate-spin" />
                    {mode === 'login' ? 'Entrando...' : 'Cadastrando...'}
                  </span>
                ) : mode === 'login' ? (
                  'Entrar'
                ) : (
                  'Cadastrar'
                )}
              </Button>
            </form>
          )}

          {!signUpSuccess && (
            <div className="mt-6 pt-4 border-t border-gray-800 text-center">
              <button
                type="button"
                onClick={switchMode}
                className="text-alien-green hover:underline text-sm font-medium"
              >
                {mode === 'login'
                  ? 'Não tem conta? Cadastre-se'
                  : 'Já tem conta? Entrar'}
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-500 text-center mt-6">
          Use e-mail e senha para acessar. Login social desabilitado.
        </p>
      </div>
    </div>
  );
};
