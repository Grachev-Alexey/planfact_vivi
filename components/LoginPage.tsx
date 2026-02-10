import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/Button';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (res.ok) {
        login(data);
        navigate('/');
      } else {
        setError(data.error || 'Ошибка входа');
      }
    } catch (err) {
      setError('Нет соединения с сервером');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-100 animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
            <div className="inline-block bg-teal-600 rounded-xl px-8 py-3 shadow-lg shadow-teal-600/20 mb-4">
                <h1 className="text-2xl font-bold text-white tracking-wide">ViVi Finance</h1>
            </div>
            <p className="text-slate-500 mt-2">Вход в систему управления финансами</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Имя пользователя</label>
                <input 
                    type="text" 
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400"
                    placeholder="admin"
                    required
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Пароль</label>
                <input 
                    type="password" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400"
                    placeholder="••••••"
                    required
                />
            </div>

            {error && (
                <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-sm text-center font-medium">
                    {error}
                </div>
            )}

            <Button type="submit" disabled={isLoading} className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white text-base shadow-lg shadow-teal-600/20">
                {isLoading ? 'Вход...' : 'Войти'}
            </Button>
        </form>
      </div>
      <div className="mt-8 text-center text-sm text-slate-400">
         &copy; {new Date().getFullYear()} ViVi Network
      </div>
    </div>
  );
};