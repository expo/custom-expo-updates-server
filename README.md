# Custom Expo Updates Server & Client

This repo contains a server and client that implement the [Expo Updates protocol specification](https://docs.expo.dev/technical-specs/expo-updates-0).

## Why

Expo provides a set of service named EAS (Expo Application Services), one of which is EAS Update which can host and serve updates for an Expo app using the [`expo-updates`](https://github.com/expo/expo/tree/main/packages/expo-updates) library.

In some cases more control of how updates are sent to an app may be needed, and one option is to implement a custom updates server that adheres to the specification in order to serve update manifests and assets. This repo contains an example server implementation of the specification and a client app configured to use the example server.

## Getting started

1) Clone the repository `git clone git@github.com:expo/custom-expo-updates-server.git`
2) Install dependencies: `pnpm install`
3) Run the client and server: `pnpm build`

The ios simulator should open and load the app. You should see a screen that says "Hello from Expo Updates!".

4) Edit `apps/client/App.js` and change the text to "Hello from Expo Updates! I've been updated!".
5) Run `pnpm expo-publish` to publish the update to the server.
6) Click the "Fetch update" button in the app to fetch the update from the server.

The ios simulator should update and the screen should say "Hello from Expo Updates! I've been updated!".

### Updates overview

To understand this repo, it's important to understand some terminology around updates:

- **Runtime version**: Type: String. Runtime version specifies the version of the underlying native code your app is running. You'll want to update the runtime version of an update when it relies on new or changed native code, like when you update the Expo SDK, or add in any native modules into your apps. Failing to update an update's runtime version will cause your end-user's app to crash if the update relies on native code the end-user is not running.
- **Platform**: Type: "ios" or "android". Specifies which platform to to provide an update.
- **Manifest**: Described in the protocol. The manifest is an object that describes assets and other details that an Expo app needs to know to load an update.

### How the `expo-update-server` works

The flow for creating an update is as follows:

1. Configure and build a "release" version of an app, then run it on a simulator or deploy to an app store.
2. Run the project locally, make changes, then export the app as an update.
3. In the server repo, we'll copy the update made in #2 to the **expo-update-server/updates** directory, under a corresponding runtime version sub-directory.
4. In the "release" app, force close and reopen the app to make a request for an update from the custom update server. The server will return a manifest that matches the requests platform and runtime version.
5. Once the "release" app receives the manifest, it will then make requests for each asset, which will also be served from this server.
6. Once the app has all the required assets it needs from the server, it will load the update.

## The setup

Note: The app is configured to load updates from the server running at http://localhost:3000. If you prefer to load them from a different base URL (for example, in an Android emulator):
1. Update `.env.local` in the server.
2. Update `updates.url` in `app.json` and then run `npx expo prebuild` to sync the changes with the generated native code.

### Create a "release" app

The example Expo project configured for the server is located in **/apps/client**.

Expo updates are configured in app.json.

```
    "updates": {
      "url": "http://localhost:3000/api/manifest",
      "enabled": true,
      "fallbackToCacheTimeout": 30000,
      "codeSigningCertificate": "./code-signing/certificate.pem",
      "codeSigningMetadata": {
        "keyid": "main",
        "alg": "rsa-v1_5-sha256"
      }
    },
```

Running `npx expo prebuild` will configure expo-updates and install the necessary native libraries.

#### iOS

To create an iOS "release" version of the app, `npx expo run:ios -d --configuration Release`. This will create a release build that can be run in a simulator to test updates.

#### Android

To create an Android "release" version of the app, `npx expo run:android -d --configuration Release`. This will create a release build that can be run in a simulator to test updates.

You may need to add `android:usesCleartextTraffic="true"` to the `AndroidManifest.xml` applicaiton element.

### Make a change

Let's make a change to the project in /apps/client that we'll want to push as an over-the-air update from our custom server to the "release" app. `cd` in to **/apps/client**, then make a change in **App.js**.

Once you've made a change you're happy with, inside of **/apps/server**, run `pnpm expo-publish`. Under the hood, this script runs `npx expo export` in the client, copies the exported app to the server, and then copies the Expo config to the server as well.

### Send an update

Now we're ready to run the update server. Run `yarn dev` in the server folder of this repo to start the server.

In the simulator running the "release" version of the app, force close the app and re-open it. It should make a request to /api/manifest, then requests to /api/assets. After the app loads, it should show any changes you made locally.

## About this server

This server was created with NextJS. You can find the API endpoints in **pages/api/manifest.js** and **pages/api/assets.js**.

The code signing keys and certificates were generated using https://github.com/expo/code-signing-certificates.

We chose to make this example with NextJS so that you can run one command to get the API running, and also so that you could deploy this to Vercel to load updates from a real server. If you choose to deploy this to Vercel, you'll need to find the URL the endpoints exist at, then update the Expo.plist for iOS with the URL under the `EXUpdatesURL` key, then rebuild a "release" app to include the new URL.
