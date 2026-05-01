import React, { useState } from 'react';
import { AdminLayout } from '../components/Layouts';
import { Badge, Button, Input, Modal, Select } from '../components/UI';
import { Search, Plus, Edit, Trash2, UserPlus, Save, Eye, Users, UserCheck, UserX, ChevronRight, Shield, Store as StoreIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { User, Role, Store, Status, UserPermissions } from '../types';

export const EmployeesPage = () => {
  const navigate = useNavigate();
  const { users, addUser, updateUser, deleteUser } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    password: '',
    role: 'Employé' as Role,
    stores: ['Phonetastic 1'] as Store[],
    hourlyRate: 15,
    mealRate: 5,
    status: 'Actif' as Status,
    permissions: { canAccessInventory: false, canAccessSpareParts: false } as UserPermissions,
  });

  const filteredUsers = users.filter(user => 
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = users.filter(u => u.status === 'Actif').length;
  const inactiveCount = users.filter(u => u.status === 'Inactif').length;
  const adminCount = users.filter(u => u.role === 'Administrateur').length;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addUser(formData);
    setIsAddModalOpen(false);
    setFormData({
      fullName: '',
      username: '',
      password: '',
      role: 'Employé',
      stores: ['Phonetastic 1'],
      hourlyRate: 15,
      mealRate: 5,
      status: 'Actif',
      permissions: { canAccessInventory: false, canAccessSpareParts: false },
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      const { password, ...rest } = formData;
      const updates = password ? { ...rest, password } : rest;
      updateUser(editingUser.id, updates);
      setIsEditModalOpen(false);
      setEditingUser(null);
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      fullName: user.fullName,
      username: user.username,
      password: user.password || '',
      role: user.role,
      stores: user.stores,
      hourlyRate: user.hourlyRate,
      mealRate: user.mealRate ?? 5,
      status: user.status,
      permissions: user.permissions ?? { canAccessInventory: false, canAccessSpareParts: false },
    });
    setIsEditModalOpen(true);
  };

  const handleStoreToggle = (store: Store) => {
    setFormData(prev => {
      const stores = prev.stores.includes(store)
        ? prev.stores.filter(s => s !== store)
        : [...prev.stores, store];
      return { ...prev, stores };
    });
  };

  const renderEmployeeForm = (onSubmit: (e: React.FormEvent) => void, submitLabel: string, SubmitIcon: React.ElementType) => (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nom complet</label>
          <Input required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nom d'utilisateur</label>
          <Input required value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Mot de passe {editingUser && <span className="text-slate-400 font-normal normal-case">(vide = inchangé)</span>}
          </label>
          <Input 
            type="password"
            required={!editingUser}
            placeholder={editingUser ? '••••••••' : ''}
            value={formData.password} 
            onChange={e => setFormData({...formData, password: e.target.value})}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rôle</label>
          <Select 
            options={[{ value: 'Employé', label: 'Employé' }, { value: 'Administrateur', label: 'Administrateur' }, { value: 'Stock', label: 'Stock (Tablette)' }]}
            value={formData.role}
            onChange={e => setFormData({...formData, role: e.target.value as Role})}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Magasins assignés</label>
          <div className="flex gap-3 mt-1">
            {(['Phonetastic 1', 'Phonetastic 2'] as Store[]).map(store => (
              <button
                key={store}
                type="button"
                onClick={() => handleStoreToggle(store)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200',
                  formData.stores.includes(store)
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                )}
              >
                <StoreIcon size={14} />
                {store}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Taux horaire (€)</label>
          <Input type="number" required value={formData.hourlyRate} onChange={e => setFormData({...formData, hourlyRate: Number(e.target.value)})} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Valeur repas (€)</label>
          <Input type="number" step="0.5" required value={formData.mealRate} onChange={e => setFormData({...formData, mealRate: Number(e.target.value)})} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</label>
          <Select 
            options={[{ value: 'Actif', label: 'Actif' }, { value: 'Inactif', label: 'Inactif' }]}
            value={formData.status}
            onChange={e => setFormData({...formData, status: e.target.value as Status})}
          />
        </div>
        {formData.role === 'Employé' && (
          <div className="space-y-2 sm:col-span-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Autorisations</label>
            <div className="flex flex-col gap-3 mt-1 p-4 bg-slate-50/80 rounded-xl border border-slate-200/80">
              {[
                { key: 'canAccessInventory' as const, label: 'Accès au Stock Téléphones' },
                { key: 'canAccessSpareParts' as const, label: 'Accès aux Pièces Détachées' },
              ].map(perm => (
                <label key={perm.key} className="flex items-center gap-3 cursor-pointer group">
                  <div className={cn(
                    'h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all',
                    formData.permissions[perm.key] ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 group-hover:border-slate-400'
                  )} onClick={() => setFormData({...formData, permissions: {...formData.permissions, [perm.key]: !formData.permissions[perm.key]}})}>
                    {formData.permissions[perm.key] && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    )}
                  </div>
                  <span className="text-sm font-medium text-slate-700">{perm.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
        <Button type="button" variant="outline" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}>Annuler</Button>
        <Button type="submit" className="gap-2" disabled={formData.stores.length === 0}>
          <SubmitIcon size={16} />
          {submitLabel}
        </Button>
      </div>
    </form>
  );

  return (
    <AdminLayout title="Employés">
      <div className="space-y-6">

        {/* ═══ Stats Row ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-5 text-white shadow-lg shadow-blue-600/20">
            <div className="relative z-10">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm w-fit">
                <Users size={18} />
              </div>
              <p className="text-3xl font-black mt-3 tabular-nums">{users.length}</p>
              <p className="text-blue-100 text-xs font-medium mt-1">Total employés</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-white/10" />
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-lg shadow-emerald-500/20">
            <div className="relative z-10">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm w-fit">
                <UserCheck size={18} />
              </div>
              <p className="text-3xl font-black mt-3 tabular-nums">{activeCount}</p>
              <p className="text-emerald-100 text-xs font-medium mt-1">Actifs</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-white/10" />
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 p-5 text-white shadow-lg shadow-slate-700/20">
            <div className="relative z-10">
              <div className="p-2 rounded-xl bg-white/15 backdrop-blur-sm w-fit">
                <Shield size={18} />
              </div>
              <p className="text-3xl font-black mt-3 tabular-nums">{adminCount}</p>
              <p className="text-slate-300 text-xs font-medium mt-1">Administrateurs</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-white/5" />
          </div>
        </div>

        {/* ═══ Search + Add ═══ */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:flex-1 sm:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              className="w-full rounded-xl border border-slate-200/80 bg-white pl-11 pr-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all duration-200"
              placeholder="Rechercher un employé..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-sm font-bold shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200"
          >
            <Plus size={16} />
            Ajouter un employé
          </button>
        </div>

        {/* ═══ Employees Table ═══ */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employé</th>
                  <th className="px-4 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Identifiant</th>
                  <th className="px-4 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Magasins</th>
                  <th className="px-4 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Taux</th>
                  <th className="px-4 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Statut</th>
                  <th className="px-4 py-3.5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-sm">
                          {user.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{user.fullName}</p>
                          <p className="text-[11px] text-slate-400 flex items-center gap-1">
                            {user.role === 'Administrateur' && <Shield size={10} className="text-indigo-500" />}
                            {user.role}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-slate-600 font-mono bg-slate-50 px-2 py-1 rounded-lg">{user.username}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1.5 min-w-[120px]">
                        {user.stores.map(store => (
                          <span key={store} className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 ring-1 ring-indigo-200/80 px-2 py-0.5 rounded-full">
                            <StoreIcon size={10} />
                            {store.replace('Phonetastic ', 'P')}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-black text-slate-800 tabular-nums">{user.hourlyRate}€</span>
                      <span className="text-[11px] text-slate-400"> /h</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className={cn("h-2 w-2 rounded-full", user.status === 'Actif' ? "bg-emerald-400" : "bg-slate-300")} />
                        <Badge variant={user.status === 'Actif' ? 'success' : 'danger'}>
                          {user.status}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => navigate(`/admin/employee/${user.id}`)} 
                          title="Voir le registre"
                          className="p-2 rounded-lg text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-all"
                        >
                          <Eye size={15} />
                        </button>
                        <button 
                          onClick={() => openEditModal(user)} 
                          title="Modifier"
                          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                        >
                          <Edit size={15} />
                        </button>
                        <button 
                          onClick={() => setDeleteConfirmUser(user.id)}
                          title="Supprimer"
                          className="p-2 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-slate-400">Aucun employé trouvé.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <p className="text-xs text-slate-400 font-medium">{filteredUsers.length} sur {users.length} employés</p>
          </div>
        </div>

        {/* ═══ Add Modal ═══ */}
        <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Ajouter un nouvel employé">
          {renderEmployeeForm(handleAddSubmit, 'Ajouter', UserPlus)}
        </Modal>

        {/* ═══ Edit Modal ═══ */}
        <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Modifier l'employé">
          {renderEmployeeForm(handleEditSubmit, 'Enregistrer', Save)}
        </Modal>

        {/* ═══ Delete Confirmation ═══ */}
        {deleteConfirmUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDeleteConfirmUser(null)}>
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/60 w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col items-center text-center">
                <div className="p-3 rounded-2xl bg-rose-50 mb-4">
                  <Trash2 size={24} className="text-rose-500" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Supprimer l'employé ?</h3>
                <p className="text-sm text-slate-500 mb-6">Cette action est irréversible. Toutes les données associées seront perdues.</p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setDeleteConfirmUser(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => { if (deleteConfirmUser) { deleteUser(deleteConfirmUser); setDeleteConfirmUser(null); } }}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 text-white text-sm font-bold shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 transition-all"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
