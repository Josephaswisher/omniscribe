import { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Loader2, ArrowLeft, Sparkles, ListTodo, CalendarDays, BarChart3, X } from 'lucide-react';
import { useTheme } from '../theme';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface AssistantChatProps {
  onClose: () => void;
}

const QUICK_ACTIONS = [
  { 
    icon: BarChart3, 
    label: 'Weekly Summary', 
    prompt: 'Summarize my notes from the past week. Highlight key themes, decisions, and action items.' 
  },
  { 
    icon: ListTodo, 
    label: 'Action Items', 
    prompt: 'List all pending action items and to-dos from my recent notes, organized by priority.' 
  },
  { 
    icon: CalendarDays, 
    label: 'Plan Today', 
    prompt: 'Based on my recent notes and pending actions, help me plan what I should focus on today.' 
  },
  { 
    icon: Sparkles, 
    label: 'Key Insights', 
    prompt: 'What are the most important insights or patterns across my recent notes?' 
  }
];

export function AssistantChat({ onClose }: AssistantChatProps) {
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return;

    const userMessage: Message = { 
      role: 'user', 
      content: content.trim(),
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/assistant/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Assistant error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: theme.background,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px',
        borderBottom: `1px solid ${theme.border}`,
        background: theme.surface
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            color: theme.textMuted,
            display: 'flex'
          }}
        >
          <ArrowLeft size={24} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <MessageCircle size={18} color="white" />
          </div>
          <div>
            <h1 style={{ 
              margin: 0, 
              fontSize: '18px', 
              fontWeight: 600,
              color: theme.text 
            }}>
              Ask OmniScribe
            </h1>
            <p style={{ 
              margin: 0, 
              fontSize: '12px', 
              color: theme.textMuted 
            }}>
              AI assistant for your notes
            </p>
          </div>
        </div>
      </header>

      {/* Messages area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px'
      }}>
        {/* Empty state with quick actions */}
        {messages.length === 0 && !loading && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: '24px',
            padding: '24px'
          }}>
            <div style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: `${theme.primary}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles size={36} color={theme.primary} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ 
                margin: '0 0 8px', 
                fontSize: '20px',
                color: theme.text 
              }}>
                How can I help?
              </h2>
              <p style={{ 
                margin: 0, 
                color: theme.textMuted,
                fontSize: '14px'
              }}>
                Ask me anything about your notes
              </p>
            </div>

            {/* Quick action buttons */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              width: '100%',
              maxWidth: '400px'
            }}>
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => sendMessage(action.prompt)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '14px 16px',
                    background: theme.surface,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = theme.surfaceHover;
                    e.currentTarget.style.borderColor = theme.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = theme.surface;
                    e.currentTarget.style.borderColor = theme.border;
                  }}
                >
                  <action.icon size={20} color={theme.primary} />
                  <span style={{ 
                    fontSize: '14px', 
                    fontWeight: 500,
                    color: theme.text 
                  }}>
                    {action.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '16px'
            }}
          >
            <div style={{
              maxWidth: '85%',
              padding: '12px 16px',
              borderRadius: msg.role === 'user' 
                ? '16px 16px 4px 16px' 
                : '16px 16px 16px 4px',
              background: msg.role === 'user' 
                ? theme.primary 
                : theme.surface,
              color: msg.role === 'user' 
                ? 'white' 
                : theme.text,
              border: msg.role === 'assistant' 
                ? `1px solid ${theme.border}` 
                : 'none'
            }}>
              <div style={{ 
                fontSize: '15px', 
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap'
              }}>
                {msg.content}
              </div>
              <div style={{
                fontSize: '11px',
                marginTop: '6px',
                opacity: 0.7
              }}>
                {formatTime(msg.timestamp)}
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            color: theme.textMuted,
            padding: '12px 16px'
          }}>
            <Loader2 size={18} className="animate-spin" style={{
              animation: 'spin 1s linear infinite'
            }} />
            <span style={{ fontSize: '14px' }}>Thinking...</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            background: `${theme.error}15`,
            borderRadius: '8px',
            color: theme.error,
            fontSize: '14px',
            marginBottom: '16px'
          }}>
            <X size={16} />
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form 
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          gap: '12px',
          padding: '16px',
          borderTop: `1px solid ${theme.border}`,
          background: theme.surface
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your notes..."
          disabled={loading}
          style={{
            flex: 1,
            padding: '14px 18px',
            fontSize: '16px',
            border: `1px solid ${theme.border}`,
            borderRadius: '24px',
            background: theme.background,
            color: theme.text,
            outline: 'none'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = theme.primary;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = theme.border;
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            border: 'none',
            background: input.trim() && !loading ? theme.primary : theme.surfaceHover,
            color: input.trim() && !loading ? 'white' : theme.textMuted,
            cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease'
          }}
        >
          <Send size={20} />
        </button>
      </form>

      {/* Spinning animation keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
