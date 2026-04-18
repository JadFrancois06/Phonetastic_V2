import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  FileText, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  User as UserIcon,
  Timer,
  History,
  BarChart3,
  Package,
  MessageSquare,
  ClipboardList,
  Wrench,
  ChevronRight,
  Bell
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store';
import { supabase } from '../lib/supabase';
import { fetchUnreadCountFromDB } from '../lib/authService';
import { backgrounds, nav, text, badge, avatar } from '../theme/colors';

interface SidebarItem {
  label: string;
  href: string;
  icon: React.ElementType;
  group?: string;
}

const adminItems: SidebarItem[] = [
  { label: 'Tableau de bord', href: '/admin/dashboard', icon: LayoutDashboard, group: 'Principal' },
  { label: 'Employés', href: '/admin/employees', icon: Users, group: 'Principal' },
  { label: 'Présence du jour', href: '/admin/attendance', icon: Clock, group: 'Gestion' },
  { label: 'Registres employés', href: '/admin/records', icon: ClipboardList, group: 'Gestion' },
  { label: 'Rapports mensuels', href: '/admin/reports', icon: FileText, group: 'Gestion' },
  { label: 'Stock', href: '/admin/inventory', icon: Package, group: 'Inventaire' },
  { label: 'Pièces détachées', href: '/admin/spare-parts', icon: Wrench, group: 'Inventaire' },
  { label: 'Messages', href: '/admin/chat', icon: MessageSquare, group: 'Communication' },
  { label: 'Factures M2', href: '/admin/invoice-editor_m1', icon: FileText, group: 'Facturation' },
  { label: 'Factures M1', href: '/admin/invoice-editor_m2', icon: FileText, group: 'Facturation' },
  { label: 'Paramètres', href: '/admin/settings', icon: Settings, group: 'Système' },
];

const employeeItems: SidebarItem[] = [
  { label: 'Tableau de bord', href: '/employee/dashboard', icon: LayoutDashboard, group: 'Principal' },
  { label: 'Pointage', href: '/employee/pointage', icon: Timer, group: 'Principal' },
  { label: 'Historique', href: '/employee/history', icon: History, group: 'Suivi' },
  { label: 'Mes heures', href: '/employee/hours', icon: BarChart3, group: 'Suivi' },
  { label: 'Stock', href: '/employee/inventory', icon: Package, group: 'Inventaire' },
  { label: 'Pièces détachées', href: '/employee/spare-parts', icon: Wrench, group: 'Inventaire' },
  { label: 'Messages', href: '/employee/chat', icon: MessageSquare, group: 'Communication' },
];

/** Group items by their `group` property while preserving order */
function groupItems(items: SidebarItem[]): { group: string; items: SidebarItem[] }[] {
  const groups: { group: string; items: SidebarItem[] }[] = [];
  let lastGroup = '';
  for (const item of items) {
    const g = item.group ?? '';
    if (g !== lastGroup) {
      groups.push({ group: g, items: [] });
      lastGroup = g;
    }
    groups[groups.length - 1].items.push(item);
  }
  return groups;
}

export const Sidebar = ({ role }: { role: 'admin' | 'employee' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const { logout, currentUser } = useStore();
  const navigate = useNavigate();
  const items = role === 'admin' ? adminItems : employeeItems;
  const grouped = groupItems(items);
  const notifChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load initial unread count
  useEffect(() => {
    if (!currentUser) return;
    fetchUnreadCountFromDB(currentUser.id).then(counts => {
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      setTotalUnread(total);
    });
  }, [currentUser]);

  // Listen for new messages via Broadcast
  useEffect(() => {
    if (!currentUser) return;
    if (notifChannelRef.current) { supabase.removeChannel(notifChannelRef.current); }

    const ch = supabase
      .channel('phonetastic-messages')
      .on('broadcast', { event: 'new-message' }, ({ payload }: any) => {
        if (payload?.receiverId === currentUser.id) {
          const onChat = window.location.pathname.endsWith('/chat');
          if (!onChat) setTotalUnread(prev => prev + 1);
        }
      })
      .subscribe();

    notifChannelRef.current = ch;
    return () => { supabase.removeChannel(ch); notifChannelRef.current = null; };
  }, [currentUser]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Toggle */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="fixed top-3.5 left-4 z-50 rounded-xl bg-slate-900 p-2.5 shadow-lg lg:hidden"
        >
          <Menu size={18} className="text-white" />
        </button>
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-[270px] transform transition-transform duration-300 ease-in-out flex flex-col lg:static lg:translate-x-0",
        backgrounds.sidebar,
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo area */}
          <div className="px-5 pt-6 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <div>
                <h1 className="text-[15px] font-bold tracking-tight text-white">Phonetastic</h1>
                <p className="text-[10px] text-slate-500 font-medium tracking-wide">DASHBOARD</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="lg:hidden p-2 -mr-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Divider */}
          <div className="mx-5 border-t border-slate-700/60" />

          {/* Navigation */}
          <nav className="flex-1 px-3 pt-4 pb-2 overflow-y-auto space-y-5 scrollbar-thin">
            {grouped.map(({ group, items: groupedNavItems }) => (
              <div key={group}>
                {group && (
                  <p className={nav.sidebarLabel}>{group}</p>
                )}
                <div className="space-y-0.5">
                  {groupedNavItems.map((item) => {
                    const isMessages = item.label === 'Messages';
                    return (
                      <NavLink
                        key={item.href}
                        to={item.href}
                        onClick={() => { setIsOpen(false); if (isMessages) setTotalUnread(0); }}
                        className={({ isActive }) => cn(
                          isActive ? nav.sidebarActive : nav.sidebarItem
                        )}
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                        <span className="truncate">{item.label}</span>
                        {isMessages && totalUnread > 0 && (
                          <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold rounded-full h-5 min-w-5 flex items-center justify-center px-1.5 shadow-sm">
                            {totalUnread > 99 ? '99+' : totalUnread}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* User info + Logout */}
          <div className="mx-3 border-t border-slate-700/60" />
          <div className="p-3">
            {currentUser && (
              <NavLink 
                to="/profile"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-200 mb-1"
              >
                <div className={cn(avatar.base, avatar.sm, "bg-indigo-500/20 text-indigo-400")}>
                  {currentUser.fullName?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate">{currentUser.fullName}</p>
                  <p className="text-[10px] text-slate-500">{currentUser.role}</p>
                </div>
                <ChevronRight size={14} className="text-slate-600 shrink-0" />
              </NavLink>
            )}
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-rose-400 rounded-xl hover:bg-rose-500/10 hover:text-rose-300 transition-all duration-200"
            >
              <LogOut className="h-[18px] w-[18px]" />
              Déconnexion
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className={cn("fixed inset-0 z-30 lg:hidden backdrop-blur-sm", backgrounds.overlay)}
        />
      )}
    </>
  );
};

export const Header = ({ title, user }: { title: string; user: any }) => {
  const [headerUnread, setHeaderUnread] = useState(0);
  const headerChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load initial unread count
  useEffect(() => {
    if (!user?.id) return;
    fetchUnreadCountFromDB(user.id).then(counts => {
      setHeaderUnread(Object.values(counts).reduce((a, b) => a + b, 0));
    });
  }, [user?.id]);

  // Broadcast listener for incoming messages
  useEffect(() => {
    if (!user?.id) return;
    if (headerChannelRef.current) { supabase.removeChannel(headerChannelRef.current); }

    const ch = supabase
      .channel('phonetastic-messages')
      .on('broadcast', { event: 'new-message' }, ({ payload }: any) => {
        if (payload?.receiverId === user.id) {
          const onChat = window.location.pathname.endsWith('/chat');
          if (!onChat) setHeaderUnread(prev => prev + 1);
        }
      })
      .subscribe();

    headerChannelRef.current = ch;
    return () => { supabase.removeChannel(ch); headerChannelRef.current = null; };
  }, [user?.id]);

  const chatHref = user?.role === 'Admin' ? '/admin/chat' : '/employee/chat';

  return (
    <header className={cn(
      "h-16 border-b border-slate-200/60 px-4 lg:px-8 pl-16 lg:pl-8 flex items-center justify-between sticky top-0 z-20 gap-4",
      backgrounds.header
    )}>
      <div className="flex-1 min-w-0">
        <h2 className={cn(text.pageTitle, "text-xl")}>{title}</h2>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {/* Message notification */}
        <NavLink
          to={chatHref}
          onClick={() => setHeaderUnread(0)}
          className="relative p-2.5 rounded-xl hover:bg-slate-100 transition-all duration-200"
        >
          <MessageSquare size={20} className="text-slate-500" />
          {headerUnread > 0 && (
            <>
              <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
              <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
            </>
          )}
        </NavLink>

        {/* Divider */}
        <div className="h-8 w-px bg-slate-200 mx-2 hidden sm:block" />

        {/* User profile */}
        <NavLink to="/profile" className="flex items-center gap-3 hover:bg-slate-50 py-1.5 px-2.5 rounded-xl transition-all duration-200 cursor-pointer">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-800 truncate max-w-37.5">{user.fullName}</p>
            <p className="text-[11px] text-slate-400 font-medium">{user.role}</p>
          </div>
          <div className={cn(avatar.base, avatar.md, avatar.colors, "ring-2 ring-indigo-100 shrink-0")}>
            {user.fullName?.charAt(0)?.toUpperCase() || <UserIcon size={18} />}
          </div>
        </NavLink>
      </div>
    </header>
  );
};
