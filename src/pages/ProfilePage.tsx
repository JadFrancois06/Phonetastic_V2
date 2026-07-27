import React, { useState, useEffect } from 'react';
import { AdminLayout, EmployeeLayout } from '../components/Layouts';
import { Modal } from '../components/UI';
import { User as UserIcon, Save, CheckCircle2, Lock, KeyRound, AtSign, BadgeCheck } from 'lucide-react';
import { useStore } from '../store';

export const ProfilePage = () => {
  const { currentUser, updateUser } = useStore();
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (currentUser) {
      setFormData({
        fullName: currentUser.fullName,
        username: currentUser.username,
        password: '',
        confirmPassword: ''
      });
    }
  }, [currentUser]);

  if (!currentUser) return null;

  const Layout = currentUser.role === 'Administrateur' ? AdminLayout : EmployeeLayout;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password && formData.password !== formData.confirmPassword) {
      alert("Les mots de passe ne correspondent pas.");
      return;
    }

    const updates: any = {
      fullName: formData.fullName,
      username: formData.username,
    };

    if (formData.password) {
      updates.password = formData.password;
    }

    updateUser(currentUser.id, updates);
    setIsSaveModalOpen(true);
    setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
  };

  return (
    <Layout title="Mon Profil">
      <div className="max-w-7xl mx-auto space-y-6 pt-6 px-4">

        {/* ─── Profile Header ─── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-600/20 shrink-0">
              <span className="text-xl font-bold text-white">
                {currentUser.fullName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{currentUser.fullName}</h2>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  <BadgeCheck size={11} /> {currentUser.role}
                </span>
                {currentUser.stores && currentUser.stores.length > 0 && (
                  <span className="text-xs text-slate-500">{currentUser.stores.join(', ')}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Personal Info ─── */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-sm shadow-indigo-600/20">
                <UserIcon size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Informations personnelles</h3>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Nom & identifiant</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <UserIcon size={12} /> Nom complet
                </label>
                <input 
                  required 
                  value={formData.fullName}
                  onChange={e => setFormData({...formData, fullName: e.target.value})}
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AtSign size={12} /> Nom d'utilisateur
                </label>
                <input 
                  required 
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* ─── Security ─── */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-sm shadow-amber-600/20">
                <Lock size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Sécurité</h3>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Mot de passe</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-5 pl-12">Laissez vide si vous ne souhaitez pas modifier votre mot de passe.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound size={12} /> Nouveau mot de passe
                </label>
                <input 
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound size={12} /> Confirmer le mot de passe
                </label>
                <input 
                  type="password"
                  value={formData.confirmPassword}
                  onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* ─── Submit ─── */}
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all"
            >
              <Save size={16} />
              Enregistrer les modifications
            </button>
          </div>
        </form>
      </div>

      {/* ─── Success Modal ─── */}
      <Modal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        title="Profil mis à jour"
      >
        <div className="flex flex-col items-center justify-center py-4 space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/25">
            <CheckCircle2 size={32} />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-base font-bold text-slate-900">Succès !</h3>
            <p className="text-sm text-slate-500">Vos informations ont été mises à jour.</p>
          </div>
          <button
            onClick={() => setIsSaveModalOpen(false)}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all mt-2"
          >
            Fermer
          </button>
        </div>
      </Modal>
    </Layout>
  );
};
