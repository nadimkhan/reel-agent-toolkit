// Reel Agent Toolkit — Remotion Types & Config
// Dimensions: 16:9 → 1920x1080, 9:16 → 1080x1920

export type AnimationType =
  | 'none'
  | 'zoom-in'
  | 'zoom-out'
  | 'pan-left'
  | 'pan-right'
  | 'pan-up'
  | 'pan-down'
  | 'ken-burns'
  | 'slow-zoom';

export type LogoPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type SubtitlePosition = 'bottom' | 'top' | 'center';

export interface RenderScene {
  id: string;
  imageSrc: string;
  audioSrc: string;
  narration?: string;
  // Pre-computed by render script from audio duration
  startFrame: number;
  durationInFrames: number;
  endFrame: number;
  animationType: AnimationType;
}

export interface RenderConfig {
  title?: string;
  logoSrc: string;        // absolute path or relative to public/
  logoPosition: LogoPosition;
  logoSizePx: number;      // e.g. 60
  logoMarginPx: number;    // e.g. 15
  subtitlePosition: SubtitlePosition;
  subtitleEnabled: boolean;
  musicSrc?: string;
  outputFilename: string;
  fps: number;
  // 16:9 or 9:16
  width: number;
  height: number;
  // Background color
  backgroundColor: string;
}

export const DIMENSIONS = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
} as const;

export type AspectRatio = keyof typeof DIMENSIONS;
