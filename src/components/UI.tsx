import React from 'react';
import { cn } from '../lib/utils';
import { X } from 'lucide-react';

interface ButtonProps extends React.ComponentPropsWithoutRef<'button'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  className, 
  variant = 'primary', 
  size = 'md', 
  children,
  ...props 
}) => {
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/20',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
    outline: 'border border-slate-200/80 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-600',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm shadow-rose-600/20',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => {
  return (
    <input
      className={cn(
        'flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
};

export const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => {
  return (
    <div className={cn('rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm', className)}>
      {children}
    </div>
  );
};

export const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export const Select = ({ 
  className, 
  options, 
  ...props 
}: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) => {
  return (
    <select
      className={cn(
        'flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
};

export const Badge = ({ 
  children, 
  variant = 'default' 
}: { 
  children: React.ReactNode; 
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' 
}) => {
  const variants = {
    default: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200/80',
    success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80',
    warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/80',
    danger: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/80',
    info: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200/80',
  };

  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', variants[variant])}>
      {children}
    </span>
  );
};
