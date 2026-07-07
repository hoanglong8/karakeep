# Chrome service for Railway deployments

Wraps `gcr.io/zenika-hub/alpine-chrome` for use as the `chrome` service when
self-hosting karakeep on Railway (see `BROWSER_WEB_URL` in the
[environment variables docs](../../docs/docs/03-configuration/01-environment-variables.md)).

The plain upstream image doesn't work as-is on Railway: Chrome's headless
DevTools server won't reliably bind to a non-loopback address on Railway's
private network, and even when reached, it rejects HTTP requests whose
`Host` header isn't `localhost`/an IP (a DNS-rebinding protection). This
image adds a small nginx reverse proxy in front of Chrome to work around
both — see the comment in `nginx.conf` for details.

## Deploying to an existing Railway project

From this directory, with the Railway CLI linked to the target project and
the `chrome` service:

```bash
railway up --service chrome --ci
```

This builds and deploys directly from these two files — no local Docker
needed. Railway's `chrome` service should have no public domain (only
`karakeep`, the web+workers service, needs one); other services reach it at
`http://chrome.railway.internal:9222`, matching what `docker-compose.yml`
expects at `chrome:9222`.
