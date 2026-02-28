import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { create } from 'zustand';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
}

let nextToastId = 0;

/**
 * Toast Store
 * 管理全局 Toast 通知狀態
 */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type) => {
    const id = String(++nextToastId);
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/**
 * Toast Helper
 * 快捷方法用於顯示 Toast 通知
 */
export const toast = {
  success: (msg: string) => useToastStore.getState().addToast(msg, 'success'),
  error: (msg: string) => useToastStore.getState().addToast(msg, 'error'),
  info: (msg: string) => useToastStore.getState().addToast(msg, 'info'),
};

/**
 * Toast Container Component
 * 顯示所有活動的 Toast 通知
 */
export function ToastContainer(): React.ReactElement {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toastItem) => (
          <motion.div
            key={toastItem.id}
            initial={{ opacity: 0, x: 100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.8 }}
            className={`glass-card p-4 rounded-xl min-w-[300px] max-w-[400px] pointer-events-auto cursor-pointer border-2 ${
              toastItem.type === 'error'
                ? 'border-red-500 bg-red-500/10'
                : toastItem.type === 'success'
                ? 'border-green-500 bg-green-500/10'
                : 'border-blue-500 bg-blue-500/10'
            }`}
            onClick={() => removeToast(toastItem.id)}
          >
            <div className="flex items-start gap-3">
              <span className="material-icons text-lg">
                {toastItem.type === 'error'
                  ? 'error'
                  : toastItem.type === 'success'
                  ? 'check_circle'
                  : 'info'}
              </span>
              <p className="text-sm text-[var(--color-moonlight)] whitespace-pre-wrap flex-1">
                {toastItem.message}
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
