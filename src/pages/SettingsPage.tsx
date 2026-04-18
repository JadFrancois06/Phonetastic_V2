import React, { useState } from 'react';
import { AdminLayout } from '../components/Layouts';
import { Button, Input, Modal } from '../components/UI';
import { Settings, Store, Shield, Bell, Globe, Save, CheckCircle2, Plus, Edit, Trash2, Building2, Mail, MapPin, Trash, RefreshCw, AlertTriangle, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import { useStore } from '../store';
import { StoreLocation } from '../types';
import { cn } from '../lib/utils';

export const SettingsPage = () => {
  const { stores, addStore, updateStore, deleteStore, sales, clearSales } = useStore();
  const [isGeneralSaveModalOpen, setIsGeneralSaveModalOpen] = useState(false);
  const [isAddStoreModalOpen, setIsAddStoreModalOpen] = useState(false);
  const [isEditStoreModalOpen, setIsEditStoreModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreLocation | null>(null);
  const [clearingSales, setClearingSales] = useState(false);
  const [salesCleared, setSalesCleared] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const [storeForm, setStoreForm] = useState({ name: '', location: '' });

  const handleDownloadSalesPDF = () => {
    if (sales.length === 0) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Registre des Ventes — Phonetastic', margin, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(`Genere le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}  |  ${sales.length} vente${sales.length !== 1 ? 's' : ''}`, margin, y);
    y += 10;

    // Table header
    doc.setDrawColor(200);
    doc.setFillColor(245, 245, 250);
    doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80);
    const cols = [margin, margin + 8, margin + 50, margin + 90, margin + 110, margin + 135, margin + 160];
    const headers = ['#', 'Telephone', 'Modele', 'Etat', 'Prix', 'Magasin', 'Vendeur'];
    headers.forEach((h, i) => doc.text(h, cols[i], y + 5.5));
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(50);

    sales.forEach((sale, idx) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      const row = [
        String(idx + 1),
        sale.phoneBrand,
        sale.phoneModel,
        sale.phoneCondition,
        `${sale.price.toFixed(2)} EUR`,
        sale.store,
        sale.soldByName,
      ];
      if (idx % 2 === 0) {
        doc.setFillColor(250, 250, 252);
        doc.rect(margin, y - 3.5, pageWidth - margin * 2, 7, 'F');
      }
      row.forEach((cell, i) => doc.text(cell, cols[i], y));

      // Date below row
      doc.setFontSize(5.5);
      doc.setTextColor(150);
      doc.text(new Date(sale.soldAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }), cols[1], y + 3.5);
      doc.setFontSize(7);
      doc.setTextColor(50);
      y += 9;
    });

    // Total
    y += 4;
    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    const total = sales.reduce((s, v) => s + v.price, 0);
    doc.text(`Total : ${total.toFixed(2)} EUR`, margin, y);

    doc.save(`ventes-phonetastic-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleClearSales = async () => {
    setClearingSales(true);
    setShowClearConfirm(false);
    const ok = await clearSales();
    setClearingSales(false);
    if (ok) {
      setSalesCleared(true);
      setTimeout(() => setSalesCleared(false), 3000);
    }
  };

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneralSaveModalOpen(true);
  };

  const handleAddStore = (e: React.FormEvent) => {
    e.preventDefault();
    addStore(storeForm);
    setIsAddStoreModalOpen(false);
    setStoreForm({ name: '', location: '' });
  };

  const handleEditStore = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStore) {
      updateStore(editingStore.id, storeForm);
    }
    setIsEditStoreModalOpen(false);
    setEditingStore(null);
  };

  const openEditStore = (store: StoreLocation) => {
    setEditingStore(store);
    setStoreForm({ name: store.name, location: store.location });
    setIsEditStoreModalOpen(true);
  };

  return (
    <AdminLayout title="Paramètres">
      <div className="space-y-8">

        {/* ─── General Settings ─── */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-sm shadow-indigo-600/20">
              <Settings size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Informations générales</h3>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Entreprise & contact</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <form onSubmit={handleSaveGeneral}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 size={12} /> Nom de l'entreprise
                  </label>
                  <input
                    defaultValue="Phonetastic"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Mail size={12} /> Email de contact
                  </label>
                  <input
                    type="email"
                    defaultValue="contact@phonetastic.fr"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all"
                >
                  <Save size={16} />
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* ─── Store Management ─── */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-sm shadow-emerald-600/20">
              <Store size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Gestion des magasins</h3>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{stores.length} magasin{stores.length !== 1 ? 's' : ''} configuré{stores.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stores.map(store => (
              <div key={store.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex items-center justify-between group hover:shadow-md hover:border-slate-300/80 transition-all">
                <div className="flex items-center gap-3.5">
                  <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center text-emerald-600 border border-emerald-200/60">
                    <Store size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{store.name}</h4>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><MapPin size={10} className="shrink-0" /> {store.location}</p>
                  </div>
                </div>
                <button
                  onClick={() => openEditStore(store)}
                  className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Edit size={16} />
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                setStoreForm({ name: '', location: '' });
                setIsAddStoreModalOpen(true);
              }}
              className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-5 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all min-h-[88px] cursor-pointer"
            >
              <div className="h-9 w-9 rounded-xl bg-slate-200/60 flex items-center justify-center">
                <Plus size={18} />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider">Ajouter un magasin</span>
            </button>
          </div>
        </section>

        {/* ─── System Preferences ─── */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white shadow-sm shadow-violet-600/20">
              <Shield size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Préférences système</h3>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Notifications & langue</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden divide-y divide-slate-100">
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center text-amber-600 border border-amber-200/60">
                  <Bell size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Notifications par email</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Recevoir un rapport quotidien des absences.</p>
                </div>
              </div>
              <div className="h-7 w-12 bg-slate-200 rounded-full relative cursor-pointer transition-colors hover:bg-slate-300 shrink-0">
                <div className="absolute left-1 top-1 h-5 w-5 bg-white rounded-full shadow-sm transition-transform" />
              </div>
            </div>
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center text-blue-600 border border-blue-200/60">
                  <Globe size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Langue de l'interface</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Français (France)</p>
                </div>
              </div>
              <button className="px-3.5 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
                Modifier
              </button>
            </div>
          </div>
        </section>

        {/* ─── Data Management ─── */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center text-white shadow-sm shadow-rose-600/20">
              <Trash size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Gestion des données</h3>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Nettoyage & réinitialisation</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-50 to-rose-100 flex items-center justify-center text-rose-600 border border-rose-200/60">
                  <RefreshCw size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Réinitialiser les ventes</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Supprimer toutes les ventes de la base de données ({sales.length} vente{sales.length !== 1 ? 's' : ''})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleDownloadSalesPDF}
                  disabled={sales.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download size={15} />
                  Télécharger PDF
                </button>
                {salesCleared ? (
                  <span className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-emerald-700 bg-emerald-50 rounded-xl">
                    <CheckCircle2 size={16} /> Supprimées
                  </span>
                ) : (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    disabled={clearingSales || sales.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-rose-600/25 hover:shadow-rose-600/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={15} />
                    {clearingSales ? 'Suppression...' : 'Tout supprimer'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ─── Modals ─── */}
      <Modal
        isOpen={isGeneralSaveModalOpen}
        onClose={() => setIsGeneralSaveModalOpen(false)}
        title="Modifications enregistrées"
      >
        <div className="flex flex-col items-center justify-center py-4 space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/25">
            <CheckCircle2 size={32} />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-base font-bold text-slate-900">Succès !</h3>
            <p className="text-sm text-slate-500">Les informations générales ont été mises à jour.</p>
          </div>
          <button
            onClick={() => setIsGeneralSaveModalOpen(false)}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all mt-2"
          >
            Fermer
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isAddStoreModalOpen}
        onClose={() => setIsAddStoreModalOpen(false)}
        title="Ajouter un magasin"
      >
        <form onSubmit={handleAddStore} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Store size={12} /> Nom du magasin
            </label>
            <input 
              required 
              placeholder="Ex: Phonetastic 3"
              value={storeForm.name}
              onChange={e => setStoreForm({...storeForm, name: e.target.value})}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin size={12} /> Localisation
            </label>
            <input 
              required 
              placeholder="Ex: Marseille, France"
              value={storeForm.location}
              onChange={e => setStoreForm({...storeForm, location: e.target.value})}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setIsAddStoreModalOpen(false)} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all font-semibold text-sm">
              Annuler
            </button>
            <button type="submit" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all">
              <Plus size={16} />
              Ajouter
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isEditStoreModalOpen}
        onClose={() => setIsEditStoreModalOpen(false)}
        title="Modifier le magasin"
      >
        <form onSubmit={handleEditStore} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Store size={12} /> Nom du magasin
            </label>
            <input 
              required 
              value={storeForm.name}
              onChange={e => setStoreForm({...storeForm, name: e.target.value})}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin size={12} /> Localisation
            </label>
            <input 
              required 
              value={storeForm.location}
              onChange={e => setStoreForm({...storeForm, location: e.target.value})}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
            />
          </div>
          <div className="flex justify-between items-center pt-4">
            <button 
              type="button" 
              onClick={() => {
                if (editingStore && window.confirm('Êtes-vous sûr de vouloir supprimer ce magasin ?')) {
                  deleteStore(editingStore.id);
                  setIsEditStoreModalOpen(false);
                  setEditingStore(null);
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-rose-600/25 hover:shadow-rose-600/40 transition-all"
            >
              <Trash2 size={15} />
              Supprimer
            </button>
            <div className="flex gap-3">
              <button type="button" onClick={() => setIsEditStoreModalOpen(false)} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all font-semibold text-sm">
                Annuler
              </button>
              <button type="submit" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all">
                <Save size={15} />
                Enregistrer
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Clear Sales Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowClearConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/60 w-full max-w-sm p-6 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center">
              <div className="p-3 rounded-2xl bg-rose-50 mb-4">
                <AlertTriangle size={24} className="text-rose-500" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">Supprimer toutes les ventes ?</h3>
              <p className="text-sm text-slate-500 mb-1">Cette action est <span className="font-bold text-rose-600">irréversible</span>.</p>
              <p className="text-sm text-slate-500 mb-6">{sales.length} vente{sales.length !== 1 ? 's' : ''} seront définitivement supprimée{sales.length !== 1 ? 's' : ''} de la base de données.</p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border-2 border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handleClearSales}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 text-white text-sm font-bold shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 transition-all"
                >
                  Tout supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
};
