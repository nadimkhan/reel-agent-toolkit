// Scene component — one scene with image + audio + subtitle + Ken Burns animation
import { Audio, AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Img } from 'remotion';
import { Subtitle } from './Subtitle';
import { AnimationType } from '../types';

interface SceneProps {
  imageSrc: string;
  audioSrc: string;
  narration?: string;
  sceneDuration: number;   // frames
  animationType: AnimationType;
  subtitleEnabled: boolean;
  subtitlePosition: 'bottom' | 'top' | 'center';
}

function getKenBurns(frame: number, duration: number, index: number): { scale: number; translateX: number; translateY: number } {
  // Alternate between zoom-in and zoom-out based on scene index
  const isOdd = index % 2 === 1;
  const scaleStart = isOdd ? 1.0 : 1.08;
  const scaleEnd = isOdd ? 1.08 : 1.0;
  const translateX = isOdd ? 20 : -20;
  const translateY = isOdd ? 10 : -10;

  const progress = frame / duration;
  const scale = interpolate(frame, [0, duration], [scaleStart, scaleEnd], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tx = interpolate(progress, [0, 1], [0, translateX], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ty = interpolate(progress, [0, 1], [0, translateY], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return { scale, translateX: tx, translateY: ty };
}

export const Scene: React.FC<SceneProps> = ({
  imageSrc,
  audioSrc,
  narration,
  sceneDuration,
  animationType,
  subtitleEnabled,
  subtitlePosition,
}) => {
  const frame = useCurrentFrame();

  const getTransform = () => {
    switch (animationType) {
      case 'zoom-in': {
        const scale = interpolate(frame, [0, sceneDuration], [1, 1.12], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return { scale, translateX: 0, translateY: 0 };
      }
      case 'zoom-out': {
        const scale = interpolate(frame, [0, sceneDuration], [1.12, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return { scale, translateX: 0, translateY: 0 };
      }
      case 'pan-left': {
        const tx = interpolate(frame, [0, sceneDuration], [0, -30], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return { scale: 1, translateX: tx, translateY: 0 };
      }
      case 'pan-right': {
        const tx = interpolate(frame, [0, sceneDuration], [0, 30], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return { scale: 1, translateX: tx, translateY: 0 };
      }
      case 'pan-up': {
        const ty = interpolate(frame, [0, sceneDuration], [0, -20], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return { scale: 1, translateX: 0, translateY: ty };
      }
      case 'pan-down': {
        const ty = interpolate(frame, [0, sceneDuration], [0, 20], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return { scale: 1, translateX: 0, translateY: ty };
      }
      case 'ken-burns': {
        return getKenBurns(frame, sceneDuration, 0);
      }
      case 'slow-zoom': {
        const scale = interpolate(frame, [0, sceneDuration], [1, 1.05], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return { scale, translateX: 0, translateY: 0 };
      }
      default:
        return { scale: 1, translateX: 0, translateY: 0 };
    }
  };

  const { scale, translateX, translateY } = getTransform();

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Image with animation */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
          transformOrigin: 'center center',
        }}
      >
        <Img
          src={imageSrc}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          alt="Scene"
        />
      </div>

      {/* Audio */}
      <Audio src={audioSrc} />

      {/* Subtitle overlay */}
      {subtitleEnabled && narration && (
        <Subtitle
          narration={narration}
          sceneDuration={sceneDuration}
          position={subtitlePosition}
        />
      )}
    </AbsoluteFill>
  );
};
