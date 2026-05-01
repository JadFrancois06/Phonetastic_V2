import React, { useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { TabletLayout } from '../components/Layouts';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { MessageSquare, Package, ArrowLeftRight, ArrowRight } from 'lucide-react';

export const TabletHubPage = () => {
  const navigate = useNavigate();
  const { storeName } = useParams();
  const { currentUser, stores, setCurrentStore } = useStore();

  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.role !== 'Stock') return <Navigate to="/login" replace />;

  const activeStore = decodeURIComponent(storeName || '');
  const allStores = stores.map(s => s.name);

  if (!activeStore) return <Navigate to="/tablet/stores" replace />;

  const targetStore = useMemo(() => {
    const fromUserAssigned = currentUser.stores.find(s => s !== activeStore);
    if (fromUserAssigned) return fromUserAssigned;
    const fromAll = allStores.find(s => s !== activeStore);
    return fromAll || '';
  }, [activeStore, allStores, currentUser.stores]);

  return (
    <TabletLayout title={`Magasin actif: ${activeStore}`}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-3xl p-6 md:p-8 bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">
            <ArrowLeftRight size={14} />
            Flux Magasins
          </div>
          <h1 className="mt-2 text-2xl md:text-3xl font-black text-slate-900">{activeStore}</h1>
          <p className="mt-2 text-slate-500">
            Messagerie orientée vers: <span className="font-bold text-slate-800">{targetStore || 'Magasin opposé non trouvé'}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <button
            onClick={() => {
              setCurrentStore(activeStore);
              navigate(`/tablet/stock/${encodeURIComponent(activeStore)}`);
            }}
            className={cn(
              'group rounded-2xl p-6 text-left border-2 border-slate-200 bg-gradient-to-br from-white to-slate-50',
              'hover:border-indigo-400 hover:shadow-xl transition-all'
            )}
          >
            <div className="h-12 w-12 rounded-2xl bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center">
              <Package size={24} />
            </div>
            <h2 className="mt-4 text-xl font-black text-slate-900">Stock</h2>
            <p className="mt-1 text-sm text-slate-500">Consulter le stock du magasin opposé et envoyer des demandes de transfert avec réservation.</p>
            <div className="mt-4 flex items-center gap-2 text-indigo-700 font-bold text-sm">
              Ouvrir
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          <button
            onClick={() => {
              setCurrentStore(activeStore);
              navigate(`/tablet/chat/${encodeURIComponent(activeStore)}`);
            }}
            className={cn(
              'group rounded-2xl p-6 text-left border-2 border-slate-200 bg-gradient-to-br from-white to-cyan-50',
              'hover:border-cyan-400 hover:shadow-xl transition-all'
            )}
          >
            <div className="h-12 w-12 rounded-2xl bg-cyan-100 text-cyan-700 border border-cyan-200 flex items-center justify-center">
              <MessageSquare size={24} />
            </div>
            <h2 className="mt-4 text-xl font-black text-slate-900">Messagerie</h2>
            <p className="mt-1 text-sm text-slate-500">Conversation prioritaire avec le magasin opposé ({targetStore || 'non défini'}).</p>
            <div className="mt-4 flex items-center gap-2 text-cyan-700 font-bold text-sm">
              Ouvrir
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        </div>
      </div>
    </TabletLayout>
  );
};
