TODOs:

1. Work towards 2 RTVs in this example

Leave out:

1. Rollouts

---

# Developer flow

1. Have a project: eas-app
2. Create a bundle of my app: expo bundle -- .... => JS assets and image assets in /dist
3. script, where maybe it's called "publish", 1. create the manifest, 2. add to the table, 3. store the files in the right spots (like in /updates/assets/...) OR we have a /publish POST endpoint, verify structure, do all 3 steps. We need branch and RTV as well.

{
rtv: ..
branch: ...
dist: [dist ouptut from expo export ...]
}

---

# Getting a manifest

assets/[sha-256 + key]

SQL table schema:
RTV, Platform, Branch (expo-channel-name), Created At, Group ID, manifest (JSON stringified)

then: /api/manifest endpoint: do a lookup for SELECT manifest FROM table WHERE RTV = rtv; platform = paltfom; branch = channel-name; ORDER_BY: created_at ASC (something); LIMIT: 1;

/updates/assets/[sha256(sha256(asset-name) + content-type))] <-- might need to add an extension here so that we can provide a content type header on the api/assets endpoint.
/updates/assets/android or ios-[sha256(sha256(asset-name) + content-type))] <-- might need to add an extension here so that we can provide a content type header on the api/assets endpoint.

---

# /api/manifests endpoint

provide: RTV, branch, platform

---

# /api/assets endpoint

content-type: mimetype

locahost:3000/api/assets/[sha256(sha256(asset-name) + content-type))]

---

"key" in the Assets object is suppose to be the assets/ID_here from the /dist metadata.json. the launch assets dont need to have the "key" set, since they're launch assets.

---

# Publish stuff

reads metadata.json, if not metro bundler, throw an error

---

# Tasks

- [ ] Stuff you'd want to do, if you want to make this a real thing that works for you.
