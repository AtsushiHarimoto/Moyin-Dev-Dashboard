import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { App } from './App';
import { I18nProvider } from './i18n';
import './styles/globals.css';

// Initialize theme from persisted state before render
try {
  const stored = localStorage.getItem('moyin-navigation-storage');
  if (stored) {
    const parsed = JSON.parse(stored);
    const theme = parsed?.state?.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }
} catch { /* use default */ }

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </I18nProvider>
  </React.StrictMode>
);
