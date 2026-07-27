import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar, Header } from './Navigation';
import { useStore } from '../store';

export const AdminLayout = ({ children, title }: { children: React.ReactNode; title: string }) => {
  const { currentUser } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  if (!currentUser) return null;

  const sidebarRole = currentUser.role === 'Administrateur' ? 'admin' : 'employee';

  return (
    <div className="flex h-screen overflow-hidden bg-[#e5e7eb]">
      <Sidebar role={sidebarRole} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={title} user={currentUser as any} />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export const EmployeeLayout = ({ children, title }: { children: React.ReactNode; title: string }) => {
  const { currentUser } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  if (!currentUser) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#e5e7eb]">
      <Sidebar role="employee" />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={title} user={currentUser as any} />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export const TabletLayout = ({ children, title }: { children: React.ReactNode; title: string }) => {
  const { currentUser, logout } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) navigate('/login');
  }, [currentUser, navigate]);

  if (!currentUser) return null;

  return (
    <div className="flex flex-col min-h-screen bg-slate-100">
      {/* Minimal top bar */}
      <header className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-white font-bold text-sm border border-white/10">P</div>
          <span className="font-bold text-base tracking-tight">Phonetastic</span>
          <span className="text-slate-400 text-sm font-medium">— {title}</span>
        </div>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 text-sm font-medium transition-colors cursor-pointer"
        >
          Déconnexion
        </button>
      </header>
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        {children}
      </main>
    </div>
  );
};
