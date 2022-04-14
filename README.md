# Custom Expo Updates Server & Client

This repo contains a server and client that implement the [Expo Updates protocol specification](https://docs.expo.dev/technical-specs/expo-updates-0).

## Why

Expo provides a set of service named EAS (Expo Application Services), one of which is EAS Update which can host and serve updates for an Expo app using the [`expo-updates`](https://github.com/expo/expo/tree/main/packages/expo-updates) library.

In some cases more control of how updates are sent to an app may be needed, and one option is to implement a custom updates server that adheres to the specification in order to serve update manifests and assets. This repo contains an example server implementation of the specification and a client app configured to use the example server.

## Getting started

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

### Create a "release" app

The example Expo project configured for the server is located in **/expo-updates-client**. We can `cd` into that directory, run `yarn` and `npx pod-install` to install packages, and run it locally with `yarn ios`. This app is configured to query this custom server for updates on launch. In **/expo-updates-client/ios/expoupdatesclient/Supporting/Expo.plist**, you'll find a modified Plist that specifies the updates URL to point toward http://localhost:3000/api/manifest. Now we need to create a "release" version of our Expo project.

Open Xcode, then open **/expo-updates-client/ios**. Click on the project's name in the top bar, then click "Edit scheme". In the modal, select "Release" for "Build configuration" (by default it's set to "Debug").

Then, build the app. You should see it open in an iOS simulator.

### Make a change

Let's make a change to the project in /expo-updates-client that we'll want to push as an update from our custom server to the "release" app. `cd` in to **/expo-updates-client**, then make a change in **App.js**. You can see the output of your changes by running `yarn ios` in **/expo-updates-client**.

Once you've made a change you're happy with, inside of **/expo-updates-client**, run:

```
expo export --experimental-bundle
```

This will create a folder named **dist** inside of **/expo-updates-client** with an update.

### Load the update on the server

Back in the parent folder of this custom server, we want to take the update we just made in **/expo-updates-client/dist** and load it into our server. We can accomplish this by copying the contents of **/expo-updates-client/dist** into **expo-update-server/updates/1**. The **1** here stands for the runtime version.

There's also a convenience script in **expo-update-server/package.json** named `yarn expo-publish`. It goes into **expo-updates-client**, exports an update, then places it in the correct spot in **expo-update-server/updates**. To publish to another runtime version, you'll need to edit that script.

### Send an update

Now we're ready to run the update server. Run `yarn dev` or `npm run dev` in the parent folder of this repo to start the server.

In the simulator running the "release" version of the app, force close the app and re-open it. It should make a request to /api/manifest, then requests to /api/assets. After the app loads, it should show any changes you made locally.

## About this server

This server was created with NextJS. You can find the API endpoints in **pages/api/manifest.js** and **pages/api/assets.js**.

We chose to make this example with NextJS so that you can run one command to get the API running, and also so that you could deploy this to Vercel to load updates from a real server. If you choose to deploy this to Vercel, you'll need to find the URL the endpoints exist at, then update the Expo.plist for iOS with the URL under the `EXUpdatesURL` key, then rebuild a "release" app to include the new URL.
