// Subtitle overlay — matches ytautomation style
// Bebas Neue font, ALL CAPS, black semi-transparent background, centered
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

interface SubtitleProps {
  narration: string;
  sceneDuration: number; // frames
  position: 'bottom' | 'top' | 'center';
}

function splitIntoPhrases(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  return sentences.map(s => s.trim()).filter(s => s.length > 0);
}

export const Subtitle: React.FC<SubtitleProps> = ({ narration, sceneDuration, position = 'bottom' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phrases = splitIntoPhrases(narration);
  const framesPerPhrase = Math.max(Math.floor(sceneDuration / phrases.length), 1);

  const currentPhraseIndex = Math.min(
    Math.floor(frame / framesPerPhrase),
    phrases.length - 1
  );
  const phraseProgress = (frame - currentPhraseIndex * framesPerPhrase) / framesPerPhrase;

  const fadeIn = interpolate(phraseProgress, [0, 0.15], [0, 1], { extrapolateLeft: 'clamp' });
  const fadeOut = interpolate(phraseProgress, [0.8, 1], [1, 0], { extrapolateRight: 'clamp' });
  const opacity = Math.min(fadeIn, fadeOut);

  const scale = interpolate(phraseProgress, [0, 0.1, 0.5, 0.9, 1], [0.95, 1, 1, 1, 0.95], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const translateY = interpolate(phraseProgress, [0, 0.1, 0.9, 1], [8, 0, 0, 8], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const currentPhrase = (phrases[currentPhraseIndex] || '').toUpperCase();

  const positionStyle: React.CSSProperties = {
    justifyContent: 'center',
    alignItems: 'center',
  };
  if (position === 'bottom') {
    positionStyle.justifyContent = 'flex-end';
    positionStyle.paddingBottom = '12%';
  } else if (position === 'top') {
    positionStyle.justifyContent = 'flex-start';
    positionStyle.paddingTop = '8%';
  }
  // 'center' stays centered

  return (
    <AbsoluteFill style={positionStyle}>
      <div
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          padding: '16px 32px',
          borderRadius: '10px',
          maxWidth: '88%',
          opacity,
          transform: `translateY(${translateY}px) scale(${scale})`,
        }}
      >
        <p
          style={{
            color: '#ffffff',
            fontSize: 44,
            fontFamily: '"Bebas Neue", sans-serif',
            fontWeight: 400,
            textAlign: 'center',
            margin: 0,
            lineHeight: 1.3,
            letterSpacing: '2.5px',
            textShadow: '0 2px 16px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.5)',
          }}
        >
          {currentPhrase}
        </p>
      </div>
    </AbsoluteFill>
  );
};
