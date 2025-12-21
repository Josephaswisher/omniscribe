import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Info,
  RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = "error" | "success" | "warning" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  action?: ToastAction;
  duration?: number; // 0 = persistent
}

interface ToastContextValue {
  toasts: ToastMessage[];
  showToast: (toast: Omit<ToastMessage, "id">) => string;
  hideToast: (id: string) => void;
  showError: (
    title: string,
    description?: string,
    retryAction?: () => void,
  ) => string;
  showSuccess: (title: string, description?: string) => string;
  showWarning: (title: string, description?: string) => string;
  showInfo: (title: string, description?: string) => string;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
};

// ─── Icons ────────────────────────────────────────────────────────────────────

const iconMap: Record<ToastType, React.ElementType> = {
  error: AlertCircle,
  success: CheckCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap: Record<
  ToastType,
  { bg: string; border: string; icon: string }
> = {
  error: {
    bg: "bg-red-500/10",
    border: "border-rgb-red",
    icon: "text-rgb-red",
  },
  success: {
    bg: "bg-green-500/10",
    border: "border-rgb-green",
    icon: "text-rgb-green",
  },
  warning: {
    bg: "bg-yellow-500/10",
    border: "border-rgb-yellow",
    icon: "text-rgb-yellow",
  },
  info: {
    bg: "bg-cyan-500/10",
    border: "border-rgb-cyan",
    icon: "text-rgb-cyan",
  },
};

// ─── Toast Item Component ─────────────────────────────────────────────────────

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const Icon = iconMap[toast.type];
  const colors = colorMap[toast.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`${colors.bg} ${colors.border} border rounded-lg p-4 shadow-lg backdrop-blur-sm max-w-sm w-full`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${colors.icon} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-semibold text-white">
            {toast.title}
          </p>
          {toast.description && (
            <p className="mt-1 text-xs font-mono text-neutral-400 leading-relaxed">
              {toast.description}
            </p>
          )}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className={`mt-2 flex items-center gap-1.5 text-xs font-mono font-semibold ${colors.icon} hover:underline`}
            >
              <RefreshCw className="w-3 h-3" />
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-neutral-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};

// ─── Toast Container ──────────────────────────────────────────────────────────

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
}) => {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onDismiss={() => onDismiss(toast.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// ─── Toast Provider ───────────────────────────────────────────────────────────

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastMessage, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const newToast: ToastMessage = { ...toast, id };

      setToasts((prev) => [...prev, newToast]);

      // Auto-dismiss after duration (default 5s, 0 = persistent)
      const duration = toast.duration ?? 5000;
      if (duration > 0) {
        setTimeout(() => hideToast(id), duration);
      }

      return id;
    },
    [hideToast],
  );

  const showError = useCallback(
    (title: string, description?: string, retryAction?: () => void) => {
      return showToast({
        type: "error",
        title,
        description,
        action: retryAction
          ? { label: "Try again", onClick: retryAction }
          : undefined,
        duration: retryAction ? 0 : 5000, // Persistent if has retry
      });
    },
    [showToast],
  );

  const showSuccess = useCallback(
    (title: string, description?: string) => {
      return showToast({
        type: "success",
        title,
        description,
        duration: 3000,
      });
    },
    [showToast],
  );

  const showWarning = useCallback(
    (title: string, description?: string) => {
      return showToast({
        type: "warning",
        title,
        description,
        duration: 4000,
      });
    },
    [showToast],
  );

  const showInfo = useCallback(
    (title: string, description?: string) => {
      return showToast({
        type: "info",
        title,
        description,
        duration: 4000,
      });
    },
    [showToast],
  );

  const value: ToastContextValue = {
    toasts,
    showToast,
    hideToast,
    showError,
    showSuccess,
    showWarning,
    showInfo,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={hideToast} />
    </ToastContext.Provider>
  );
};

// ─── Upload Error Messages ────────────────────────────────────────────────────

export const UploadErrors = {
  UNSUPPORTED_FORMAT: (formats: string[]) => ({
    title: "Unsupported file format",
    description: `Please use: ${formats.join(", ")}`,
  }),
  FILE_TOO_LARGE: (sizeMB: number, maxMB: number) => ({
    title: "File too large",
    description: `Your file is ${sizeMB.toFixed(1)}MB. Maximum allowed is ${maxMB}MB.`,
  }),
  DURATION_TOO_LONG: (durationMin: number, maxMin: number) => ({
    title: "Recording too long",
    description: `Your recording is ${durationMin.toFixed(1)} minutes. Maximum allowed is ${maxMin} minutes.`,
  }),
  CORRUPTED_FILE: {
    title: "Cannot read audio file",
    description:
      "The file may be corrupted or in an unsupported format. Please try a different file.",
  },
  PROCESSING_FAILED: {
    title: "Failed to process file",
    description:
      "An error occurred while processing your audio. Please try again.",
  },
  NETWORK_ERROR: {
    title: "Connection error",
    description: "Please check your internet connection and try again.",
  },
};

export default ToastProvider;
