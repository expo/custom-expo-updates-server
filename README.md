# Custom EAS Update server

- Protocol of updates
- Explain RTV, branch, channel, platform, etc?

## Getting started

### Overview

sqlite
/assets

### The setup

### Creating and saving an update

1. Build a release version of the app.
2. Make a change locally.
3. expo export --experimental-bundle --force
4. Run `yarn expo-export client/dist 1`
5. Reload the release app.

This repo contains an Expo app in **/client**. In that directory, `yarn` or `npm install`, then run `yarn ios` to make a change to the app. Once we've made a change we're happy with, it's time to build a "release" version of the app so that we can test that updates are working.

### Sending an update locally

...

- `yarn dev` to start your local updates server.

### Using this as a guide

- [ ] Stuff you'd want to do, if you want to make this a real thing that works for you.
