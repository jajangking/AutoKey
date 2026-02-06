// Prebuild configuration for Expo
// This file is executed before the build process begins

export default (config) => {
  // Return the config with all properties preserved
  return {
    ...config,
    // Ensure scheme is preserved from app.json
    scheme: config.scheme || "autokey",
  };
};