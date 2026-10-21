import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

// Module-level hooks that the provider fills in on mount
let registerAlert = null;
let registerConfirm = null;

// Shows a styled notice. Used automatically for every window.alert() call.
export const showAppAlert = (message) => {
  if (registerAlert) registerAlert(message);
  else console.warn(message);
};

// Shows a styled confirm dialog. Resolves true for OK, false for Cancel.
// Usage: if (!(await confirmDialog('Delete this item?'))) return;
export const confirmDialog = (message, options = {}) =>
  new Promise((resolve) => {
    if (registerConfirm) registerConfirm(message, options, resolve);
    else resolve(false);
  });

// Picks a visual tone from the message text
const detectTone = (message = '') => {
  const text = String(message).toLowerCase();
  if (/fail|error|cannot|insufficient|no stock|not found|invalid|locked/.test(text)) return 'danger';
  if (/⚠|must|please|no valid|no material|select|required|warning/.test(text)) return 'warning';
  if (/success|saved|submitted|generated|created|finalized|registered/.test(text)) return 'success';
  return 'info';
};

const TONES = {
  success: {
    icon: CheckCircle2,
    iconWrap: 'bg-emerald-50 text-emerald-700',
    accent: 'bg-emerald-600',
    title: 'Success',
    primaryBtn: 'bg-emerald-700 hover:bg-emerald-800 text-white'
  },
  warning: {
    icon: AlertTriangle,
    iconWrap: 'bg-amber-50 text-amber-700',
    accent: 'bg-amber-500',
    title: 'Warning',
    primaryBtn: 'bg-amber-500 hover:bg-amber-600 text-white'
  },
  danger: {
    icon: XCircle,
    iconWrap: 'bg-rose-50 text-rose-700',
    accent: 'bg-rose-600',
    title: 'Error',
    primaryBtn: 'bg-rose-600 hover:bg-rose-700 text-white'
  },
  info: {
    icon: Info,
    iconWrap: 'bg-slate-100 text-slate-700',
    accent: 'bg-slate-700',
    title: 'Notice',
    primaryBtn: 'bg-slate-900 hover:bg-slate-800 text-white'
  }
};

export const AppDialogProvider = ({ children }) => {
  // Dialogs are shown one after another
  const [queue, setQueue] = useState([]);
  const current = queue[0];

  const enqueue = useCallback((item) => {
    setQueue((q) => [...q, item]);
  }, []);

  // Closes the current dialog and resolves its promise
  const finish = useCallback((result) => {
    setQueue((q) => {
      if (q[0] && q[0].resolve) q[0].resolve(result);
      return q.slice(1);
    });
  }, []);

  // Connects the module-level helpers and replaces window.alert
  useEffect(() => {
    registerAlert = (message) => {
      const cleanMessage = String(message).replace(/^⚠️\s*/, '');
      enqueue({ type: 'alert', message: cleanMessage, tone: detectTone(message), resolve: null });
    };

    registerConfirm = (message, options, resolve) => {
      enqueue({
        type: 'confirm',
        message: String(message),
        tone: options.tone || 'warning',
        title: options.title,
        confirmText: options.confirmText || 'OK',
        cancelText: options.cancelText || 'Cancel',
        resolve
      });
    };

    const originalAlert = window.alert;
    window.alert = (message) => registerAlert(message);

    return () => {
      registerAlert = null;
      registerConfirm = null;
      window.alert = originalAlert;
    };
  }, [enqueue]);

  // Keyboard support: Enter confirms, Escape cancels
  useEffect(() => {
    if (!current) return;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') finish(false);
      if (e.key === 'Enter') finish(true);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [current, finish]);

  const tone = current ? (TONES[current.tone] || TONES.info) : null;
  const Icon = tone?.icon;

  return (
    <>
      {children}

      {current && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200"
          >
            <div className={`h-1 w-full ${tone.accent}`} />

            <div className="p-6 flex gap-4">
              <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${tone.iconWrap}`}>
                <Icon size={22} />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-slate-900">
                  {current.title || tone.title}
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 whitespace-pre-line break-words leading-relaxed">
                  {current.message}
                </p>
              </div>
            </div>

            <div className="px-6 pb-6 flex justify-end gap-2">
              {current.type === 'confirm' && (
                <button
                  type="button"
                  onClick={() => finish(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer border-none"
                >
                  {current.cancelText}
                </button>
              )}
              <button
                type="button"
                autoFocus
                onClick={() => finish(true)}
                className={`px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors cursor-pointer border-none ${tone.primaryBtn}`}
              >
                {current.type === 'confirm' ? current.confirmText : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AppDialogProvider;