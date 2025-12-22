import { useState, useEffect, useRef, RefObject } from "react";
import { Clock, User } from "lucide-react";
import { useTheme } from "../theme";

export interface TranscriptSegment {
  id: string;
  start_ms: number;
  end_ms: number;
  text: string;
  speaker_label?: string;
}

// Speaker colors for diarization
const SPEAKER_COLORS = [
  { bg: "#6366f120", text: "#818cf8", border: "#6366f150" }, // Indigo
  { bg: "#22c55e20", text: "#4ade80", border: "#22c55e50" }, // Green
  { bg: "#f59e0b20", text: "#fbbf24", border: "#f59e0b50" }, // Amber
  { bg: "#ec489920", text: "#f472b6", border: "#ec489950" }, // Pink
  { bg: "#06b6d420", text: "#22d3ee", border: "#06b6d450" }, // Cyan
  { bg: "#8b5cf620", text: "#a78bfa", border: "#8b5cf650" }, // Violet
];

interface TranscriptPlayerProps {
  segments: TranscriptSegment[];
  audioRef: RefObject<HTMLAudioElement | null>;
  fallbackTranscript?: string;
}

export function TranscriptPlayer({
  segments,
  audioRef,
  fallbackTranscript,
}: TranscriptPlayerProps) {
  const theme = useTheme();
  const [activeIdx, setActiveIdx] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || segments.length === 0) return;

    const onTimeUpdate = () => {
      const ms = audio.currentTime * 1000;
      const idx = segments.findIndex((s) => ms >= s.start_ms && ms < s.end_ms);
      if (idx !== activeIdx) {
        setActiveIdx(idx);
        // Auto-scroll to active segment
        if (idx >= 0 && containerRef.current) {
          const activeEl = containerRef.current.querySelector(
            `[data-segment-idx="${idx}"]`,
          );
          activeEl?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setActiveIdx(-1);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
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
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  // If no segments, show fallback plain transcript
  if (segments.length === 0) {
    if (fallbackTranscript) {
      return (
        <div
          ref={containerRef}
          style={{
            padding: "16px",
            fontSize: "15px",
            lineHeight: "1.7",
            color: theme.text,
            whiteSpace: "pre-wrap",
          }}
        >
          {fallbackTranscript}
        </div>
      );
    }
    return null;
  }

  // Group segments by speaker if available
  const hasSpeakers = segments.some((s) => s.speaker_label);

  // Build speaker color map
  const speakerColorMap = new Map<string, (typeof SPEAKER_COLORS)[0]>();
  let colorIndex = 0;
  segments.forEach((seg) => {
    if (seg.speaker_label && !speakerColorMap.has(seg.speaker_label)) {
      speakerColorMap.set(
        seg.speaker_label,
        SPEAKER_COLORS[colorIndex % SPEAKER_COLORS.length],
      );
      colorIndex++;
    }
  });

  const getSpeakerColor = (speaker?: string) => {
    if (!speaker) return null;
    return speakerColorMap.get(speaker) || SPEAKER_COLORS[0];
  };

  return (
    <div
      ref={containerRef}
      style={{
        padding: "16px",
        maxHeight: "400px",
        overflowY: "auto",
      }}
    >
      {/* Legend */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
          fontSize: "12px",
          color: theme.textMuted,
        }}
      >
        <Clock size={14} />
        <span>Click any segment to jump to that point in the audio</span>
      </div>

      {/* Speaker Legend (if multiple speakers) */}
      {hasSpeakers && speakerColorMap.size > 1 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            marginBottom: "16px",
            padding: "8px 12px",
            background: theme.surface,
            borderRadius: "8px",
            border: `1px solid ${theme.border}`,
          }}
        >
          <User size={14} style={{ color: theme.textMuted }} />
          {Array.from(speakerColorMap.entries()).map(([speaker, colors]) => (
            <span
              key={speaker}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 8px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 500,
                backgroundColor: colors.bg,
                color: colors.text,
                border: `1px solid ${colors.border}`,
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: colors.text,
                }}
              />
              {speaker}
            </span>
          ))}
        </div>
      )}

      {/* Segments */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "4px",
          lineHeight: "1.8",
        }}
      >
        {segments.map((seg, i) => {
          const isActive = i === activeIdx;
          const showSpeaker =
            hasSpeakers &&
            (i === 0 || segments[i - 1].speaker_label !== seg.speaker_label);
          const speakerColor = getSpeakerColor(seg.speaker_label);

          return (
            <span key={seg.id || i}>
              {showSpeaker && seg.speaker_label && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    width: "100%",
                    marginTop: i > 0 ? "16px" : 0,
                    marginBottom: "6px",
                    paddingBottom: "6px",
                    borderBottom: `1px solid ${speakerColor?.border || theme.border}`,
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "2px 10px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      backgroundColor: speakerColor?.bg || theme.surface,
                      color: speakerColor?.text || theme.primary,
                      border: `1px solid ${speakerColor?.border || theme.border}`,
                    }}
                  >
                    <User size={12} />
                    {seg.speaker_label}
                  </span>
                </div>
              )}
              <span
                data-segment-idx={i}
                onClick={() => seekTo(seg.start_ms)}
                title={`${formatTime(seg.start_ms)} - ${formatTime(seg.end_ms)}`}
                style={{
                  display: "inline",
                  padding: "2px 4px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "15px",
                  transition: "all 0.15s ease",
                  backgroundColor: isActive
                    ? speakerColor?.bg || `${theme.primary}30`
                    : "transparent",
                  color: isActive
                    ? speakerColor?.text || theme.primary
                    : theme.text,
                  fontWeight: isActive ? 500 : 400,
                  boxShadow: isActive
                    ? `inset 0 -2px 0 ${speakerColor?.text || theme.primary}`
                    : "none",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = theme.surfaceHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                {seg.text}
              </span>{" "}
            </span>
          );
        })}
      </div>

      {/* Timestamp bar when playing */}
      {isPlaying && activeIdx >= 0 && (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            marginTop: "16px",
            padding: "8px 12px",
            background: theme.surface,
            borderRadius: "8px",
            border: `1px solid ${theme.border}`,
            fontSize: "13px",
            color: theme.textMuted,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Clock size={14} />
          <span>{formatTime(segments[activeIdx].start_ms)}</span>
          <span
            style={{
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: theme.text,
            }}
          >
            {segments[activeIdx].text}
          </span>
        </div>
      )}
    </div>
  );
}
