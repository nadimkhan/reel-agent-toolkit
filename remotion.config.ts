import { Config } from "@remotion/cli/config";

Config.setChromiumHeadlessMode(true);
Config.setShouldOpenBrowser(false);

// Memory management to prevent browser crashes on long renders
Config.setChromiumAdditionalArgs([
  '--disable-gpu',
  '--disable-gpu-compositing',
  '--disable-software-rasterizer',
  '--disable-dev-shm-usage',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-web-security',
  '--js-flags=--max-old-space-size=2048',
]);
