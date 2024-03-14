// Learn more https://docs.expo.dev/guides/monorepos
const { getDefaultConfig } = require('expo/metro-config');
const { FileStore } = require('metro-cache');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

// Enable CSS for Expo.
const config = getDefaultConfig(projectRoot, {
  isCSSEnabled: true,
});

// This is not needed for NativeWind, it is configuration for Metro to understand monorepos
// #1 - Watch all files in the monorepo
config.watchFolders = [workspaceRoot];
// #3 - Force resolving nested modules to the folders below
config.resolver.disableHierarchicalLookup = true;
// #2 - Try resolving with project modules first, then workspace modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Use turborepo to restore the cache when possible
config.cacheStores = [
  new FileStore({ root: path.join(projectRoot, 'node_modules', '.cache', 'metro') }),
];

// Remove console logs
config.transformer.minifierConfig.compress.drop_console = true;

// Enable mjs and cjs for web supoort for some libraries (react-hook-form)
config.resolver.sourceExts = [...config.resolver.sourceExts, "mjs", "cjs"];


// // 2. Enable NativeWind
// const { withNativeWind } = require("nativewind/metro");
// module.exports = withNativeWind(config, {
//   // 3. Set `input` to your CSS file with the Tailwind at-rules
//   input: "global.css",
// });

module.exports = config;