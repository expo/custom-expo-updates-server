module.exports = {
  setupFiles: ['<rootDir>/.jest/setEnvVars.js'],
  preset: 'ts-jest',
  globals: {
    'ts-jest': {
      diagnostics: {
        pathRegex: '/__tests__/.*-test.tsx?$',
        warnOnly: true
      }
    }
  }
};
