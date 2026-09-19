// Logo overlay component
// Position: top-left with configurable margin
import { Img } from 'remotion';

interface LogoProps {
  src: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  sizePx: number;
  marginPx: number;
  opacity?: number;
}

export const Logo: React.FC<LogoProps> = ({
  src,
  position,
  sizePx,
  marginPx,
  opacity = 1,
}) => {
  // Compute top/left based on position
  // top-left: top=margin, left=margin
  // top-right: top=margin, right=margin
  // bottom-left: bottom=margin, left=margin
  // bottom-right: bottom=margin, right=margin
  const style: React.CSSProperties = {
    position: 'absolute',
    zIndex: 100,
    opacity,
  };

  switch (position) {
    case 'top-left':
      style.top = marginPx;
      style.left = marginPx;
      break;
    case 'top-right':
      style.top = marginPx;
      style.right = marginPx;
      break;
    case 'bottom-left':
      style.bottom = marginPx;
      style.left = marginPx;
      break;
    case 'bottom-right':
      style.bottom = marginPx;
      style.right = marginPx;
      break;
  }

  return (
    <div style={style}>
      <Img
        src={src}
        style={{
          width: sizePx,
          height: 'auto',
          display: 'block',
        }}
        alt="Logo"
      />
    </div>
  );
};
