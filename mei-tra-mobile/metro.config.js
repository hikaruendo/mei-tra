const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Import .svg files as React components (react-native-svg) rather than as
// static asset URIs, which is what metro does by default and which native
// cannot draw. The `/expo` entry point delegates non-SVG files to
// @expo/metro-config's transformer, so tsconfig `paths` and the React Compiler
// keep working.
config.transformer.babelTransformerPath = require.resolve(
  'react-native-svg-transformer/expo',
);
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== 'svg',
);
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

module.exports = config;
