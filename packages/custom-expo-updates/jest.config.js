module.exports = {
  testMatch: ['**/?(*.)+(test).+(js|ts)'],
  preset: 'ts-jest',
  testEnvironment: 'node'
};

process.env = Object.assign(process.env, {
  HOSTNAME: "http://localhost:3000",
  PRIVATE_KEY_PATH: "code-signing/private-key.pem",
  UPDATES_ASSET_PATH: "support/updates/",
});