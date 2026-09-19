// RemotionRoot — reads inputProps via getInputProps() and passes to Video
import { registerRoot, getInputProps } from 'remotion';
import { Video } from './Video';
import { RenderScene, RenderConfig } from './types';

export const RemotionRoot: React.FC = () => {
  const inputProps = getInputProps<{ scenes: RenderScene[]; config: RenderConfig }>();
  return <Video scenes={inputProps.scenes} config={inputProps.config} />;
};

registerRoot(RemotionRoot);
