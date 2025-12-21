import { useState, useEffect, useRef, RefObject } from 'react';
import { Clock } from 'lucide-react';
import { useTheme } from '../theme';

export interface TranscriptSegment {
  id: string;
  start_ms: number;
  end_ms: number;
  text: string;
  speaker_label?: string;
}

interface TranscriptPlayerProps {
  segments: TranscriptSegment[];
  audioRef: RefObject<HTMLAudioElement | null>;
  fallbackTranscript?: string;
}

export function TranscriptPlayer({ segments, audioRef, fallbackTranscript }: TranscriptPlayerProps) {
  const theme = useTheme();
  const [activeIdx, setActiveIdx] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || segments.length === 0) return;

    const onTimeUpdate = () => {
      const ms = audio.currentTime * 1000;
      const idx = segments.findIndex(s => ms >= s.start_ms && ms < s.end_ms);
      if (idx !== activeIdx) {
        setActiveIdx(idx);
        // Auto-scroll to active segment
        if (idx >= 0 && containerRef.current) {
          const activeEl = containerRef.current.querySelector(`[data-segment-idx="${idx}"]`);
          activeEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setActiveIdx(-1);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [segments, activeIdx, audioRef]);

  const seekTo = (startMs: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = startMs / 1000;
      audio.play();
    }
  };

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  // If no segments, show fallback plain transcript
  if (segments.length === 0) {
    if (fallbackTranscript) {
      return (
        <div 
          ref={containerRef}
          style={{
            padding: '16px',
            fontSize: '15px',
            lineHeight: '1.7',
            color: theme.text,
            whiteSpace: 'pre-wrap'
          }}
        >
          {fallbackTranscript}
        </div>
      );
    }
    return null;
  }

  // Group segments by speaker if available
  const hasSpeakers = segments.some(s => s.speaker_label);

  return (
    <div 
      ref={containerRef}
      style={{
        padding: '16px',
        maxHeight: '400px',
        overflowY: 'auto'
      }}
    >
      {/* Legend */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
        fontSize: '12px',
        color: theme.textMuted
      }}>
        <Clock size={14} />
        <span>Click any segment to jump to that point in the audio</span>
      </div>

      {/* Segments */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
        lineHeight: '1.8'
      }}>
        {segments.map((seg, i) => {
          const isActive = i === activeIdx;
          const showSpeaker = hasSpeakers && (i === 0 || segments[i - 1].speaker_label !== seg.speaker_label);

          return (
            <span key={seg.id || i}>
              {showSpeaker && seg.speaker_label && (
                <span style={{
                  display: 'block',
                  width: '100%',
                  marginTop: i > 0 ? '12px' : 0,
                  marginBottom: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: theme.primary
                }}>
                  {seg.speaker_label}:
                </span>
              )}
              <span
                data-segment-idx={i}
                onClick={() => seekTo(seg.start_ms)}
                title={`${formatTime(seg.start_ms)} - ${formatTime(seg.end_ms)}`}
                style={{
                  display: 'inline',
                  padding: '2px 4px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  transition: 'all 0.15s ease',
                  backgroundColor: isActive 
                    ? `${theme.primary}30` 
                    : 'transparent',
                  color: isActive ? theme.primary : theme.text,
                  fontWeight: isActive ? 500 : 400,
                  boxShadow: isActive 
                    ? `inset 0 -2px 0 ${theme.primary}` 
                    : 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = theme.surfaceHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {seg.text}
              </span>
              {' '}
            </span>
          );
        })}
      </div>

      {/* Timestamp bar when playing */}
      {isPlaying && activeIdx >= 0 && (
        <div style={{
          position: 'sticky',
          bottom: 0,
          marginTop: '16px',
          padding: '8px 12px',
          background: theme.surface,
          borderRadius: '8px',
          border: `1px solid ${theme.border}`,
          fontSize: '13px',
          color: theme.textMuted,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Clock size={14} />
          <span>{formatTime(segments[activeIdx].start_ms)}</span>
          <span style={{ 
            flex: 1, 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap',
            color: theme.text
          }}>
            {segments[activeIdx].text}
          </span>
        </div>
      )}
    </div>
  );
}
