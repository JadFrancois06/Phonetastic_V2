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
