/**
 * useConfirm — Drop-in replacement for window.confirm().
 *
 * Usage:
 *   const confirm = useConfirm();
 *   const ok = await confirm("Are you sure?", { title: "Delete Item", confirmLabel: "Delete", destructive: true });
 *   if (ok) { ... }
 *
 * You MUST render <ConfirmDialogProvider /> once at the root (already added in App.jsx if using this hook).
 */
import { createContext, useContext, useState, useCallback, useRef } from "react";

const ConfirmContext = createContext(null);

export const ConfirmDialogProvider = ({ children }) => {
  const [state, setState] = useState({ open: false, message: "", title: "", confirmLabel: "Confirm", cancelLabel: "Cancel", destructive: false });
  const resolveRef = useRef(null);

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({
        open: true,
        message,
        title: options.title || "Confirm Action",
        confirmLabel: options.confirmLabel || "Confirm",
        cancelLabel: options.cancelLabel || "Cancel",
        destructive: options.destructive ?? false,
      });
    });
  }, []);

  const handleConfirm = () => {
    setState(s => ({ ...s, open: false }));
    resolveRef.current?.(true);
  };

  const handleCancel = () => {
    setState(s => ({ ...s, open: false }));
    resolveRef.current?.(false);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state.open && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={handleCancel}
          />
          {/* Dialog */}
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-border rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            {/* Top accent */}
            <div className={`h-1 w-full ${state.destructive ? "bg-rose-500" : "bg-emerald-500"}`} />
            <div className="p-6 space-y-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {state.title}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {state.message}
              </p>
            </div>
            <div className="flex gap-2 px-6 pb-6">
              <button
                onClick={handleCancel}
                className="flex-1 py-2.5 border border-border rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                {state.cancelLabel}
              </button>
              <button
                onClick={handleConfirm}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all active:scale-95 shadow-lg ${
                  state.destructive
                    ? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20"
                    : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
                }`}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmDialogProvider>");
  return ctx;
};
