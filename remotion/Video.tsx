// Root Video component — assembles scenes with logo and optional music
import { AbsoluteFill, Sequence, Audio } from 'remotion';
import { Scene } from './Scene';
import { Logo } from './Logo';
import { RenderScene, RenderConfig } from './types';

interface VideoProps {
  scenes: RenderScene[];
  config: RenderConfig;
}

export const Video: React.FC<VideoProps> = ({ scenes, config }) => {
  const totalDuration = scenes.length > 0
    ? scenes[scenes.length - 1].endFrame
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: config.backgroundColor }}>
      {/* Logo — spans full video duration */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
        <Logo
          src={config.logoSrc}
          position={config.logoPosition}
          sizePx={config.logoSizePx}
          marginPx={config.logoMarginPx}
          opacity={0.92}
        />
      </div>

      {/* Scenes */}
      {scenes.map((scene, index) => (
        <Sequence
          key={scene.id}
          from={scene.startFrame}
          durationInFrames={scene.durationInFrames}
        >
          <Scene
            imageSrc={scene.imageSrc}
            audioSrc={scene.audioSrc}
            narration={scene.narration}
            sceneDuration={scene.durationInFrames}
            animationType={scene.animationType}
            subtitleEnabled={config.subtitleEnabled}
            subtitlePosition={config.subtitlePosition}
          />
        </Sequence>
      ))}

      {/* Background music */}
      {config.musicSrc && (
        <Audio src={config.musicSrc} />
      )}
    </AbsoluteFill>
  );
};
