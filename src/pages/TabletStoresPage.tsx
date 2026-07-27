import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { TabletLayout } from '../components/Layouts';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { Store, ArrowRight } from 'lucide-react';

export const TabletStoresPage = () => {
  const navigate = useNavigate();
  const { currentUser, stores, setCurrentStore } = useStore();

  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.role !== 'Stock') return <Navigate to="/login" replace />;

  const availableStores = currentUser.stores.length > 0
    ? currentUser.stores
    : stores.map(s => s.name);

  return (
    <TabletLayout title="Choisir un magasin">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-3xl p-6 md:p-8 bg-gradient-to-r from-slate-900 via-indigo-900 to-cyan-800 text-white shadow-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-200 font-bold">Mode Tablette</p>
          <h1 className="mt-2 text-2xl md:text-3xl font-black">Choisissez le magasin actif</h1>
          <p className="mt-2 text-slate-200 text-sm md:text-base">Après sélection, vous aurez 2 options: consulter le stock ou ouvrir la messagerie vers le magasin opposé.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          {availableStores.map((store) => (
            <button
              key={store}
              onClick={() => {
                setCurrentStore(store);
                navigate(`/tablet/hub/${encodeURIComponent(store)}`);
              }}
              className={cn(
                'group rounded-2xl border-2 border-slate-200 bg-white p-5 text-left transition-all',
                'hover:border-indigo-400 hover:-translate-y-0.5 hover:shadow-xl'
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Store size={24} />
                </div>
                <ArrowRight size={18} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
              </div>
              <h2 className="mt-4 text-xl font-black text-slate-900">{store}</h2>
              <p className="mt-1 text-sm text-slate-500">Ouvrir ce magasin en mode tablette</p>
            </button>
          ))}
        </div>
      </div>
    </TabletLayout>
  );
};
