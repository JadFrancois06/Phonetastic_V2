import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Card } from '../components/UI';
import { Phone, Lock, User, Store } from 'lucide-react';
import { useStore } from '../store';
import { loginWithCredentials } from '../lib/authService';
import { Store as StoreType } from '../types';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { currentUser, setCurrentStore, setCurrentUserDirectly } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await loginWithCredentials(username, password);
      if (user) {
        setCurrentUserDirectly(user);
      } else {
        setError('Identifiants incorrects');
      }
    } catch {
      setError('Erreur de connexion. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const handleStoreSelect = (store: StoreType) => {
    setCurrentStore(store);
  };

  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'Administrateur') {
        navigate('/admin/dashboard');
      } else if (currentUser.role === 'Stock') {
        navigate('/tablet/stores');
      } else if (currentUser.currentStore) {
        navigate('/employee/dashboard');
      }
    }
  }, [currentUser, navigate]);

  if (currentUser && currentUser.role === 'Employé' && !currentUser.currentStore) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <div className="mx-auto h-12 w-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
              <Store size={24} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Choisissez votre magasin</h1>
            <p className="text-slate-500">Sélectionnez le magasin où vous travaillez aujourd'hui</p>
          </div>

          <Card className="p-8 space-y-4">
            {currentUser.stores.length > 0 ? (
              currentUser.stores.map((store) => (
                <Button 
                  key={store} 
                  variant="outline" 
                  className="w-full h-14 text-lg justify-start gap-4"
                  onClick={() => handleStoreSelect(store)}
                >
                  <Store size={20} className="text-slate-400" />
                  {store}
                </Button>
              ))
            ) : (
              <div className="text-center text-slate-500 py-4">
                Aucun magasin ne vous a été assigné. Veuillez contacter votre administrateur.
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
            <Phone size={24} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Phonetastic</h1>
          <p className="text-slate-500">Système de gestion du temps</p>
        </div>

        <Card className="p-8 space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-semibold text-slate-900">Connexion</h2>
            <p className="text-sm text-slate-500">Entrez vos identifiants pour accéder à votre espace</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium text-center">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Nom d'utilisateur</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input 
                  className="pl-10" 
                  placeholder="votre_nom" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input 
                  className="pl-10" 
                  type="password" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-slate-400">
          &copy; 2026 Phonetastic. Tous droits réservés.
        </p>
      </div>
    </div>
  );
};
