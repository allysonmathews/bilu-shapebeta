import React from 'react';
import { useUser } from '../context/UserContext';
import { Button } from '../components/ui/Button';
import { Chrome } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useUser();

  const handleGoogleLogin = () => {
    // Mock: apenas define isAuthenticated como true
    login();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-deep-bg p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-alien-green mb-2">BILU SHAPE</h1>
          <p className="text-gray-400">Sua jornada fitness começa aqui</p>
        </div>

        <div className="bg-card-bg border border-gray-800 rounded-lg p-8">
          <Button
            variant="primary"
            icon={Chrome}
            onClick={handleGoogleLogin}
            className="w-full text-lg py-3"
          >
            Entrar com Google
          </Button>

          <p className="text-xs text-gray-500 text-center mt-4">
            * Simulação: clique para continuar
          </p>
        </div>
      </div>
    </div>
  );
};
