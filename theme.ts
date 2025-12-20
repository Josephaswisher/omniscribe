import { ThemeColors, ThemeMode } from './types';

export const lightTheme: ThemeColors = {
  background: '#ffffff',
  surface: '#f8fafc',
  surfaceHover: '#f1f5f9',
  text: '#0f172a',
  textMuted: '#64748b',
  textSecondary: '#94a3b8',
  border: '#e2e8f0',
  primary: '#6366f1',
  primaryHover: '#4f46e5',
  accent: '#8b5cf6',
  error: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
};

export const darkTheme: ThemeColors = {
  background: '#0f172a',
  surface: '#1e293b',
  surfaceHover: '#334155',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  textSecondary: '#64748b',
  border: '#334155',
  primary: '#818cf8',
  primaryHover: '#6366f1',
  accent: '#a78bfa',
  error: '#f87171',
  success: '#34d399',
  warning: '#fbbf24',
};

export const getTheme = (mode: ThemeMode): ThemeColors => {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? darkTheme : lightTheme;
  }
  return mode === 'dark' ? darkTheme : lightTheme;
};

export const applyTheme = (theme: ThemeColors) => {
  const root = document.documentElement;
  Object.entries(theme).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value);
  });
};

export const folderColors = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', 
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
];

export const tagColors = [
  '#ef4444', '#f59e0b', '#10b981', '#3b82f6', 
  '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6',
];

export const priorityColors = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
};

export const statusColors = {
  pending: '#f59e0b',
  processing: '#3b82f6',
  completed: '#10b981',
  error: '#ef4444',
};
