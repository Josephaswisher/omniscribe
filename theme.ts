import { ThemeColors, ThemeMode } from './types';

// Terminal-inspired with RGB accents (Claude UI inspired)
export const lightTheme: ThemeColors = {
  background: '#fafafa',
  surface: '#ffffff',
  surfaceHover: '#f5f5f5',
  text: '#171717',
  textMuted: '#525252',
  textSecondary: '#737373',
  border: '#e5e5e5',
  primary: '#0ea5e9',      // Cyan
  primaryHover: '#0284c7',
  accent: '#10b981',       // Emerald
  error: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
};

export const darkTheme: ThemeColors = {
  background: '#0a0a0a',   // Near black - terminal style
  surface: '#141414',      // Slightly lighter
  surfaceHover: '#1f1f1f', 
  text: '#fafafa',
  textMuted: '#a3a3a3',
  textSecondary: '#737373',
  border: '#262626',
  primary: '#22d3ee',      // Cyan RGB accent
  primaryHover: '#06b6d4',
  accent: '#4ade80',       // Green RGB accent  
  error: '#f87171',
  success: '#4ade80',
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
