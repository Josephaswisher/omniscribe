import React from "react";

interface LanguageBadgeProps {
  languageCode: string;
  detectedLanguage?: string;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
}

const languageToFlag: Record<string, string> = {
  en: "🇺🇸",
  es: "🇪🇸",
  fr: "🇫🇷",
  de: "🇩🇪",
  it: "🇮🇹",
  pt: "🇧🇷",
  zh: "🇨🇳",
  ja: "🇯🇵",
  ko: "🇰🇷",
  ar: "🇸🇦",
  hi: "🇮🇳",
  ru: "🇷🇺",
  nl: "🇳🇱",
  pl: "🇵🇱",
  tr: "🇹🇷",
  vi: "🇻🇳",
  th: "🇹🇭",
  id: "🇮🇩",
  ms: "🇲🇾",
  tl: "🇵🇭",
  sv: "🇸🇪",
  da: "🇩🇰",
  no: "🇳🇴",
  fi: "🇫🇮",
  el: "🇬🇷",
  he: "🇮🇱",
  cs: "🇨🇿",
  hu: "🇭🇺",
  ro: "🇷🇴",
  uk: "🇺🇦",
};

const sizeClasses = {
  sm: "text-xs px-1.5 py-0.5",
  md: "text-sm px-2 py-1",
  lg: "text-base px-2.5 py-1.5",
};

const LanguageBadge: React.FC<LanguageBadgeProps> = ({
  languageCode,
  detectedLanguage,
  size = "sm",
  showTooltip = true,
}) => {
  const flag = languageToFlag[languageCode.toLowerCase()] || "🌐";
  const displayCode = languageCode.toUpperCase();

  return (
    <span
      className={`inline-flex items-center gap-1 bg-slate-700/50 rounded ${sizeClasses[size]} text-slate-300 font-medium`}
      title={showTooltip ? detectedLanguage || languageCode : undefined}
    >
      <span>{flag}</span>
      <span className="uppercase tracking-wide">{displayCode}</span>
    </span>
  );
};

export default LanguageBadge;
