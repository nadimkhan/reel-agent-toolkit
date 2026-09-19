import { Config } from "@remotion/cli/config";

Config.setChromiumHeadlessMode(true);
Config.setShouldOpenBrowser(false);

// Stability: use swiftshader (software GL renderer) instead of hardware GPU
// This prevents browser crashes on long renders
Config.setChromiumOpenGlRenderer('swiftshader');
