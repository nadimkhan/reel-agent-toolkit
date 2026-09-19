// RemotionRoot — explicitly registers Video as a Composition with dynamic duration
import { registerRoot, Composition, getInputProps } from 'remotion';
import { Video } from './Video';
import { RenderScene, RenderConfig } from './types';
import { useEffect, useState } from 'react';

export const RemotionRoot: React.FC = () => {
  // Read dynamic totalFrames from render script via getInputProps
  const inputProps = getInputProps<{ scenes: RenderScene[]; config: RenderConfig }>();
  const { scenes = [], config } = inputProps || {};

  // Compute actual total frames from the scene timeline
  const totalFrames = scenes.length > 0
    ? scenes[scenes.length - 1].endFrame
    : 30 * 60; // fallback 30s

  // Load Bebas Neue font from Google Fonts
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = 'https://fonts.googleapis.com';
    document.head.appendChild(link);

    const link2 = document.createElement('link');
    link2.rel = 'preconnect';
    link2.href = 'https://fonts.gstatic.com';
    link2.crossOrigin = 'anonymous';
    document.head.appendChild(link2);

    const link3 = document.createElement('link');
    link3.rel = 'stylesheet';
    link3.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap';
    document.head.appendChild(link3);

    document.title = config?.title || 'Reel';

    return () => {
      [link, link2, link3].forEach(el => {
        if (el.parentNode) el.parentNode.removeChild(el);
      });
    };
  }, [config?.title]);

  return (
    <>
      <Composition
        id="Video"
        component={Video as any}
        durationInFrames={totalFrames}
        fps={30}
        width={config?.width || 1920}
        height={config?.height || 1080}
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
