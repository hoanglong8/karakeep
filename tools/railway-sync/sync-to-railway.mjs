// One-way, additive, batch sync: LOCAL karakeep -> RAILWAY karakeep.
// Reads all bookmarks from the local instance and creates any that don't
// already exist on Railway, then re-attaches tags by name. Handles all
// three bookmark types (link, text, asset).
//
// Usage:
//   LOCAL_API_KEY=... RAILWAY_API_KEY=... node sync-to-railway.mjs [--dry-run]
//
// Optional overrides (default to this project's local/Railway instances):
//   LOCAL_BASE=http://192.168.50.119:3000/api/v1
//   RAILWAY_BASE=https://karakeep-production-402d.up.railway.app/api/v1
//
// Safe to re-run: the server only dedups type=link bookmarks natively (by
// URL, via createBookmark's alreadyExists check). Text and asset bookmarks
// have no server-side dedup, so this script fingerprints what's already on
// Railway (text: exact text match; asset: fileName+size) and skips those
// client-side -- re-running produces created:0 across the board once
// everything is in sync.

const LOCAL_BASE = process.env.LOCAL_BASE ?? "http://192.168.50.119:3000/api/v1";
const RAILWAY_BASE = process.env.RAILWAY_BASE ?? "https://karakeep-production-402d.up.railway.app/api/v1";

const LOCAL_API_KEY = process.env.LOCAL_API_KEY;
const RAILWAY_API_KEY = process.env.RAILWAY_API_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

if (!LOCAL_API_KEY || !RAILWAY_API_KEY) {
  console.error("Set LOCAL_API_KEY and RAILWAY_API_KEY env vars first.");
  process.exit(1);
}

async function api(base, key, path, opts = {}) {
  const resp = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...opts.headers,
    },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`${opts.method ?? "GET"} ${path} -> ${resp.status}: ${body.slice(0, 300)}`);
  }
  return resp.json();
}

async function downloadAsset(base, key, assetId) {
  const resp = await fetch(`${base}/assets/${assetId}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!resp.ok) {
    throw new Error(`GET /assets/${assetId} -> ${resp.status}`);
  }
  const contentType = resp.headers.get("content-type") ?? "application/octet-stream";
  const blob = await resp.blob();
  return { blob, contentType };
}

async function uploadAsset(base, key, blob, fileName) {
  const form = new FormData();
  form.append("file", blob, fileName ?? "asset");
  const resp = await fetch(`${base}/assets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`POST /assets -> ${resp.status}: ${body.slice(0, 300)}`);
  }
  return resp.json();
}

async function* listAllBookmarks(base, key) {
  let cursor;
  do {
    const qs = new URLSearchParams({ limit: "50", includeContent: "false" });
    if (cursor) qs.set("cursor", cursor);
    const page = await api(base, key, `/bookmarks?${qs}`);
    for (const b of page.bookmarks) yield b;
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
}

// The server only dedups type=link bookmarks (by URL). Asset and text
// bookmarks have no server-side dedup, so re-running this script would
// re-create them every time. Fingerprint what's already on Railway (asset:
// fileName+size, text: exact text) to skip those client-side instead.
async function existingRailwayFingerprints() {
  const assets = new Set();
  const texts = new Set();
  for await (const b of listAllBookmarks(RAILWAY_BASE, RAILWAY_API_KEY)) {
    if (b.content?.type === "asset") {
      assets.add(`${b.content.fileName ?? ""}::${b.content.size ?? ""}`);
    } else if (b.content?.type === "text") {
      texts.add(b.content.text ?? "");
    }
  }
  return { assets, texts };
}

function toCreatePayload(b) {
  const base = {
    title: b.title ?? undefined,
    note: b.note ?? undefined,
    summary: b.summary ?? undefined,
    archived: b.archived,
    favourited: b.favourited,
    createdAt: b.createdAt,
  };
  if (b.content?.type === "link") {
    return { ...base, type: "link", url: b.content.url };
  }
  if (b.content?.type === "text") {
    return { ...base, type: "text", text: b.content.text };
  }
  if (b.content?.type === "asset") {
    return { ...base, type: "asset", asset: b.content };
  }
  return null; // unknown-type bookmarks are skipped
}

async function main() {
  let created = 0;
  let existed = 0;
  let skippedUnknown = 0;
  let assetsReuploaded = 0;
  let tagsAttached = 0;
  let failed = 0;

  const { assets: assetFingerprints, texts: textFingerprints } = DRY_RUN
    ? { assets: new Set(), texts: new Set() }
    : await existingRailwayFingerprints();

  for await (const local of listAllBookmarks(LOCAL_BASE, LOCAL_API_KEY)) {
    const payload = toCreatePayload(local);
    if (!payload) {
      skippedUnknown++;
      console.log(`skip (unknown-type): ${local.id} ${local.title ?? ""}`);
      continue;
    }

    if (DRY_RUN) {
      const desc =
        payload.url ?? payload.text?.slice(0, 60) ?? `asset:${payload.asset?.fileName ?? payload.asset?.assetId}`;
      console.log(`[dry-run] would sync: ${payload.type} ${desc}`);
      continue;
    }

    if (payload.type === "asset") {
      const fp = `${payload.asset.fileName ?? ""}::${payload.asset.size ?? ""}`;
      if (assetFingerprints.has(fp)) {
        existed++;
        continue;
      }
    }

    if (payload.type === "text") {
      if (textFingerprints.has(payload.text ?? "")) {
        existed++;
        continue;
      }
    }

    try {
      let createPayload = payload;
      if (payload.type === "asset") {
        const localAsset = payload.asset;
        const { blob } = await downloadAsset(LOCAL_BASE, LOCAL_API_KEY, localAsset.assetId);
        const uploaded = await uploadAsset(RAILWAY_BASE, RAILWAY_API_KEY, blob, localAsset.fileName);
        assetsReuploaded++;
        assetFingerprints.add(`${localAsset.fileName ?? ""}::${localAsset.size ?? ""}`);
        createPayload = {
          ...payload,
          asset: undefined,
          assetType: localAsset.assetType,
          assetId: uploaded.assetId,
          fileName: localAsset.fileName ?? uploaded.fileName,
          sourceUrl: localAsset.sourceUrl,
          size: uploaded.size,
        };
      }
      if (payload.type === "text") {
        textFingerprints.add(payload.text ?? "");
      }

      const result = await api(RAILWAY_BASE, RAILWAY_API_KEY, "/bookmarks", {
        method: "POST",
        body: JSON.stringify(createPayload),
      });
      if (result.alreadyExists) existed++;
      else created++;

      if (local.tags?.length) {
        await api(RAILWAY_BASE, RAILWAY_API_KEY, `/bookmarks/${result.id}/tags`, {
          method: "POST",
          body: JSON.stringify({
            tags: local.tags.map((t) => ({ tagName: t.name })),
          }),
        });
        tagsAttached += local.tags.length;
      }
    } catch (err) {
      failed++;
      console.error(`failed: ${local.id} ${local.title ?? ""} -> ${err.message}`);
    }
  }

  console.log("\n--- sync summary ---");
  console.log({ created, existed, skippedUnknown, assetsReuploaded, tagsAttached, failed });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
