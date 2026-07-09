# Deploying this fork to Railway

Railway's Dockerfile builder has no equivalent of `docker build --target`,
so it always builds whichever stage is *last* in the Dockerfile (see
[Railway's build config schema](https://backboard.railway.app/railway.schema.json) —
`dockerfilePath` is the only Dockerfile-related option). The real
`docker/Dockerfile` in this repo ends with the `cli` and `mcp` stages
*after* the `aio` (all-in-one web+workers) stage we actually want, so a
target-less build there would produce the wrong image.

`docker/railway/Dockerfile` is a copy of `docker/Dockerfile` with the `web`,
`workers`, `cli`, and `mcp` stages removed so that `aio` is the last stage
in the file. Keep it in sync by hand if `docker/Dockerfile` changes
upstream — everything through the `aio` stage should stay byte-for-byte
identical between the two files.

`railway.json` at the repo root points Railway's builder at this file
(`build.dockerfilePath: docker/railway/Dockerfile`).

## Deploying

From the repo root, with the Railway CLI linked to the target project and
the `karakeep` service:

```bash
railway up --service karakeep --ci
```

This uploads the repo (respecting `.gitignore`/`.dockerignore`) and builds
directly — no local Docker needed. Takes several minutes (full pnpm
install + Next.js build + workers build). The `karakeep` service's
existing environment variables and volume (`/data`) are untouched by an
image swap; only the app code changes.

See `../railway-chrome/README.md` for the separate `chrome` service.
