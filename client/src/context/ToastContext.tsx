import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, title?: string, duration?: number) => void;
  success: (message: string, title?: string, duration?: number) => void;
  error: (message: string, title?: string, duration?: number) => void;
  info: (message: string, title?: string, duration?: number) => void;
  warning: (message: string, title?: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Global event target for non-hook call sites
type ToastListener = (toast: Omit<ToastItem, 'id'>) => void;
const toastListeners = new Set<ToastListener>();

export interface ToastCallable {
  (
    optsOrMsg:
      | string
      | {
          title?: string;
          message?: string;
          description?: string;
          type?: ToastType;
          duration?: number;
        }
  ): void;
  success: (message: string, title?: string, duration?: number) => void;
  error: (message: string, title?: string, duration?: number) => void;
  info: (message: string, title?: string, duration?: number) => void;
  warning: (message: string, title?: string, duration?: number) => void;
}

const toastFn = ((
  optsOrMsg:
    | string
    | {
        title?: string;
        message?: string;
        description?: string;
        type?: ToastType;
        duration?: number;
      }
) => {
  if (typeof optsOrMsg === 'string') {
    toastListeners.forEach((fn) => fn({ type: 'info', message: optsOrMsg }));
  } else if (optsOrMsg && typeof optsOrMsg === 'object') {
    const type: ToastType = optsOrMsg.type || 'info';
    const message = optsOrMsg.message || optsOrMsg.description || optsOrMsg.title || '';
    const title = optsOrMsg.message || optsOrMsg.description ? optsOrMsg.title : undefined;
    toastListeners.forEach((fn) => fn({ type, message, title, duration: optsOrMsg.duration }));
  }
}) as ToastCallable;

toastFn.success = (message: string, title?: string, duration?: number) => {
  toastListeners.forEach((fn) => fn({ type: 'success', message, title, duration }));
};
toastFn.error = (message: string, title?: string, duration?: number) => {
  toastListeners.forEach((fn) => fn({ type: 'error', message, title, duration }));
};
toastFn.info = (message: string, title?: string, duration?: number) => {
  toastListeners.forEach((fn) => fn({ type: 'info', message, title, duration }));
};
toastFn.warning = (message: string, title?: string, duration?: number) => {
  toastListeners.forEach((fn) => fn({ type: 'warning', message, title, duration }));
};

export const toast = toastFn;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, title?: string, duration = 4500) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastItem = { id, type, message, title, duration };
      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  useEffect(() => {
    const handleGlobalToast: ToastListener = ({ type, message, title, duration }) => {
      showToast(type, message, title, duration);
    };

    toastListeners.add(handleGlobalToast);
    return () => {
      toastListeners.delete(handleGlobalToast);
    };
  }, [showToast]);

  const success = useCallback(
    (msg: string, title?: string, dur?: number) => showToast('success', msg, title, dur),
    [showToast]
  );
  const error = useCallback(
    (msg: string, title?: string, dur?: number) => showToast('error', msg, title, dur),
    [showToast]
  );
  const info = useCallback(
    (msg: string, title?: string, dur?: number) => showToast('info', msg, title, dur),
    [showToast]
  );
  const warning = useCallback(
    (msg: string, title?: string, dur?: number) => showToast('warning', msg, title, dur),
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning, removeToast }}>
      {children}

      {/* Floating Pop-up Toast Container */}
      <div
        className="fixed top-5 right-5 sm:right-6 z-[999999] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-[calc(100vw-2.5rem)] pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={() => removeToast(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastCard: React.FC<{ item: ToastItem; onDismiss: () => void }> = ({ item, onDismiss }) => {
  const { type, message, title, duration = 4500 } = item;

  const config = {
    success: {
      border: 'border-emerald-200',
      bg: 'bg-white',
      accent: 'bg-emerald-500',
      iconBg: 'bg-emerald-50 text-emerald-600',
      titleColor: 'text-emerald-950',
      textColor: 'text-emerald-800',
      shadow: 'shadow-[0_12px_32px_rgba(16,185,129,0.18)]',
      Icon: CheckCircle2,
      defaultTitle: 'Success',
    },
    error: {
      border: 'border-rose-200',
      bg: 'bg-white',
      accent: 'bg-rose-500',
      iconBg: 'bg-rose-50 text-rose-600',
      titleColor: 'text-rose-950',
      textColor: 'text-rose-800',
      shadow: 'shadow-[0_12px_32px_rgba(244,63,94,0.22)]',
      Icon: AlertCircle,
      defaultTitle: 'Action Failed',
    },
    warning: {
      border: 'border-amber-200',
      bg: 'bg-white',
      accent: 'bg-amber-500',
      iconBg: 'bg-amber-50 text-amber-700',
      titleColor: 'text-amber-950',
      textColor: 'text-amber-800',
      shadow: 'shadow-[0_12px_32px_rgba(245,158,11,0.2)]',
      Icon: AlertTriangle,
      defaultTitle: 'Attention',
    },
    info: {
      border: 'border-sky-200',
      bg: 'bg-white',
      accent: 'bg-sky-500',
      iconBg: 'bg-sky-50 text-sky-600',
      titleColor: 'text-sky-950',
      textColor: 'text-sky-800',
      shadow: 'shadow-[0_12px_32px_rgba(14,165,233,0.2)]',
      Icon: Info,
      defaultTitle: 'Notice',
    },
  }[type];

  const IconComponent = config.Icon;

  return (
    <div
      role="alert"
      className={`pointer-events-auto relative overflow-hidden rounded-2xl border ${config.border} ${config.bg} p-4 ${config.shadow} backdrop-blur-md transition-all duration-300 animate-in slide-in-from-top-3 fade-in`}
    >
      {/* Left accent color bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${config.accent}`} />

      <div className="flex items-start gap-3 pl-1">
        {/* Icon pill */}
        <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${config.iconBg}`}>
          <IconComponent className="w-5 h-5" />
        </div>

        {/* Message block */}
        <div className="flex-1 pr-2 pt-0.5 min-w-0">
          <h4 className={`text-xs font-black tracking-wide ${config.titleColor}`}>
            {title || config.defaultTitle}
          </h4>
          <p className={`text-xs font-medium leading-relaxed mt-0.5 break-words ${config.textColor}`}>
            {message}
          </p>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Dismiss toast"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar Animation */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-100 overflow-hidden">
          <div
            className={`h-full ${config.accent} opacity-40`}
            style={{
              animation: `toast-progress ${duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: toast.info,
      success: toast.success,
      error: toast.error,
      info: toast.info,
      warning: toast.warning,
      removeToast: () => {},
    };
  }
  return ctx;
};
