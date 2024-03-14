# Custom Expo Updates Server & Client

This repo contains a server and client that implement the [Expo Updates protocol specification](https://docs.expo.dev/technical-specs/expo-updates-0) using [expo-router](https://docs.expo.dev/router/installation/).  It has an express middleware compatible that provides the `manifest` and `assets` api endpoints for the client to fetch updates.

## Using the Exaample

1) Clone the repository `git clone git@github.com:expo/custom-expo-updates-server.git`
2) Install dependencies: `pnpm install`
3) Build the expo client and express middleware: `pnpm build`

### Running the server

In one terminal:

1) Navigate to the expo app directory: `cd apps/example`
2) Export the expo client and server bundles: `pnpm export`
5) Start the server: `pnpm server`

### Build a release app

In another terminal:

1) Navigate to the expo app directory: `cd apps/example`
2) Build a release version of the app: `pnpm ios:release` or `pnpm android:release`

### Push an update

In another terminal:

1) Navigate to the expo app directory: `cd apps/example`
2) Make a text change to the app: `apps/example/app/index.tsx`
3) Export a new build: `pnpm export`
4) Push an update `pnpm expo-publish`

You should be able to click the update button on the release app and see the changes.

## Caveats

1) This exampl only works locally in the simulators. Building a release on your device will not be able to connect to the server being run on localhost:3000.

2) In a real-world environment, the express server will need to be run on a server that is accessible to the internet, and the server will need write ability to the `updates` directory.  The publish script will need to be updated to copy exports to the server.

## Implemenation

This code requires Expo SDK 50 and [expo-router](https://docs.expo.dev/router/installation/) 3.0.0 or later.

### Code Signing:

The code signing keys and certificates were generated using https://github.com/expo/code-signing-certificates.  The server needs the `private-key.pem` and the path can be set with the enviroment variable `PRIVATE_KEY_PATH`. The client needs the `certificate.pem`.

### expo-updates

You will need to configure app.json.  The `updates` key should look something like this:

```
"updates": {
  "url": "http://localhost:3000/api/manifest",
  "enabled": true,
  "fallbackToCacheTimeout": 30000,
  "codeSigningCertificate": "code-signing/certificate.pem",
  "codeSigningMetadata": {
    "keyid": "main",
    "alg": "rsa-v1_5-sha256"
  }
},
```

The url must be the base url of the server.  The `codeSigningCertificate` should be the path to the certificate.pem file.

### expo-router

You will need to install and configre expo-router.  The `expo-router` pludgin will need to be configured key in app.json. You will also need to specify a `scheme` in app.json. You should also configure `web` to output a server bundle, and specify `metro` as the bundler.

```
"scheme": "expoupdatesexample",
"plugins": [
  [
    "expo-router",
    {
      "origin": "http://localhost:3000",
    }
  ]
],
"web": {
  "favicon": "./assets/favicon.png",
  "output": "server",
  "bundler": "metro",
},
```
You will also need to implement an [expo-router express server](https://docs.expo.dev/router/reference/api-routes/#express):

### custom-expo-updates

In order to serve custom updates from your express server, you will need to implement the custom expo-updates package. If you have a monorepo, you can copy the packages to your pacakge directory or install it as a package from github.

```npm install expo/custom-expo-updates-server```

Implement the express middleware in your expo express server:

```
const UpdatesMiddleware = require('custom-expo-updates/server');
app.use(UpdatesMiddleware);
```

## Why

Expo provides a set of service named EAS (Expo Application Services), one of which is EAS Update which can host and serve updates for an Expo app using the [`expo-updates`](https://github.com/expo/expo/tree/main/packages/expo-updates) library.

In some cases more control of how updates are sent to an app may be needed, and one option is to implement a custom updates server that adheres to the specification in order to serve update manifests and assets. This repo contains an example server implementation of the specification and a client app configured to use the example server.

### Updates overview

To understand this repo, it's important to understand some terminology around updates:

- **Runtime version**: Type: String. Runtime version specifies the version of the underlying native code your app is running. You'll want to update the runtime version of an update when it relies on new or changed native code, like when you update the Expo SDK, or add in any native modules into your apps. Failing to update an update's runtime version will cause your end-user's app to crash if the update relies on native code the end-user is not running.
- **Platform**: Type: "ios" or "android". Specifies which platform to to provide an update.
- **Manifest**: Described in the protocol. The manifest is an object that describes assets and other details that an Expo app needs to know to load an update.