import React from 'react';

interface LanguageBadgeProps {
  languageCode?: string;
  detectedLanguage?: string;
  size?: 'sm' | 'md';
  showTooltip?: boolean;
}

// Language code to flag emoji mapping (using regional indicator symbols)
const languageToFlag: Record<string, string> = {
  en: '🇺🇸',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  it: '🇮🇹',
  pt: '🇧🇷',
  zh: '🇨🇳',
  ja: '🇯🇵',
  ko: '🇰🇷',
  ar: '🇸🇦',
  hi: '🇮🇳',
  ru: '🇷🇺',
  nl: '🇳🇱',
  pl: '🇵🇱',
  tr: '🇹🇷',
  vi: '🇻🇳',
  th: '🇹🇭',
  id: '🇮🇩',
  ms: '🇲🇾',
  sv: '🇸🇪',
  da: '🇩🇰',
  no: '🇳🇴',
  fi: '🇫🇮',
  el: '🇬🇷',
  he: '🇮🇱',
  cs: '🇨🇿',
  ro: '🇷🇴',
  hu: '🇭🇺',
  uk: '🇺🇦',
  bn: '🇧🇩',
  ta: '🇮🇳',
  te: '🇮🇳',
  mr: '🇮🇳',
  und: '🌐', // Undetermined
};

// Common language names for fallback display
const languageNames: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  hi: 'Hindi',
  ru: 'Russian',
};

const LanguageBadge: React.FC<LanguageBadgeProps> = ({
  languageCode,
  detectedLanguage,
  size = 'sm',
  showTooltip = true,
}) => {
  if (!languageCode || languageCode === 'und') {
    return null;
  }

  const flag = languageToFlag[languageCode.toLowerCase()] || '🌐';
  const displayName = detectedLanguage || languageNames[languageCode.toLowerCase()] || languageCode.toUpperCase();

  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5'
    : 'text-xs px-2 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 ${sizeClasses} bg-slate-700/50 text-slate-300 rounded font-medium uppercase tracking-wider`}
      title={showTooltip ? displayName : undefined}
    >
      <span className="text-sm leading-none">{flag}</span>
      <span>{languageCode.toUpperCase()}</span>
    </span>
  );
};

export default LanguageBadge;
