// RemotionRoot — explicitly registers Video as a Composition
import { registerRoot, Composition } from 'remotion';
import { Video } from './Video';
import { RenderScene, RenderConfig } from './types';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Video"
        component={Video as any}
        durationInFrames={30 * 60}   // 30fps * 60s = fallback 30s
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          scenes: [] as RenderScene[],
          config: {
            title: '',
            logoSrc: '/images/logos/rw_logo.png',
            logoPosition: 'top-left' as const,
            logoSizePx: 60,
            logoMarginPx: 15,
            subtitleEnabled: true,
            subtitlePosition: 'bottom' as const,
            musicSrc: undefined,
            outputFilename: '',
            fps: 30,
            width: 1920,
            height: 1080,
            backgroundColor: '#000000',
          } as RenderConfig,
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
