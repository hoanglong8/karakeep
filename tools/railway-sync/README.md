# Local → Railway bookmark sync

One-way, additive batch sync from a local karakeep instance to a
Railway-hosted one. Written for a setup with no direct DB access between the
two (self-hosted local + Railway), so it goes through each instance's REST
API instead.

## Usage

Create an API key on each instance (Settings → API Keys):

- Local: `Bookmarks:Read`, `Tags:Read` is enough.
- Railway: `Bookmarks:Read/Write`, `Tags:Read/Write`.

```bash
LOCAL_API_KEY=... RAILWAY_API_KEY=... node sync-to-railway.mjs --dry-run
LOCAL_API_KEY=... RAILWAY_API_KEY=... node sync-to-railway.mjs
```

Override the instance URLs if they differ from this project's defaults:

```bash
LOCAL_BASE=http://192.168.50.119:3000/api/v1 \
RAILWAY_BASE=https://karakeep-production-402d.up.railway.app/api/v1 \
LOCAL_API_KEY=... RAILWAY_API_KEY=... node sync-to-railway.mjs
```

## What it does

For every bookmark on the local instance: create it on Railway if it isn't
there yet (matched by URL for links, exact text for text bookmarks, and
fileName+size for assets — assets are downloaded from local and re-uploaded
to Railway), then re-attach its tags by name.

Safe to re-run. The server only dedups `link`-type bookmarks natively (by
URL). `text` and `asset` bookmarks have no server-side dedup, so this script
fingerprints what's already on Railway and skips those client-side — without
that, every re-run would create a fresh duplicate of every text/asset
bookmark. A prior version of this script (before that fix) did exactly that
and left 2 duplicate text bookmarks on Railway, since cleaned up manually.

## Known limitation

Asset-type bookmarks are re-uploaded as new, standalone assets on Railway —
if the same file is intentionally re-added under a different fileName it
won't be recognized as a duplicate.
