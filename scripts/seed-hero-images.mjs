// Seeds predefined hero banner images (Phase 5.1).
// Downloads curated bakery photos from the internet into
// store-assets/banners/ so the carousel never depends on hotlinks.
// Idempotent: uploads with upsert, safe to re-run.
import fs from "node:fs";
for (const f of [".env.local", ".env"]) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(l);
    if (!m) continue;
    if (process.env[m[1]] === undefined)
      process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: svc, Authorization: "Bearer " + svc };

const IMAGES = [
  ["predefined-chocolate-cake", "1578985545062-69928b1d9587"],
  ["predefined-cupcakes", "1486427944299-d1955d23e34d"],
  ["predefined-cookies", "1499636136210-6f4ee915583e"],
  ["predefined-bread", "1509440159596-0249088772ff"],
  ["predefined-berry-cake", "1565958011703-44f9829ba187"],
  ["predefined-macarons", "1602351447937-745cb720612f"],
];

(async () => {
  let ok = 0;
  for (const [name, photoId] of IMAGES) {
    const src = `https://images.unsplash.com/photo-${photoId}?w=1600&q=80&auto=format&fit=crop`;
    const res = await fetch(src);
    const buf = Buffer.from(await res.arrayBuffer());
    const isJpeg = buf.length > 10000 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    if (res.status !== 200 || !isJpeg) {
      console.log(`SKIP ${name}: http=${res.status} bytes=${buf.length}`);
      continue;
    }
    const path = `banners/${name}.jpg`;
    const up = await fetch(url + `/storage/v1/object/store-assets/${path}`, {
      method: "POST",
      headers: { ...H, "Content-Type": "image/jpeg", "x-upsert": "true" },
      body: buf,
    });
    console.log(`${up.ok ? "seeded" : "FAILED"} ${path} (${buf.length} bytes)`);
    if (up.ok) ok++;
  }
  console.log(`\n${ok}/${IMAGES.length} predefined banners seeded`);
  process.exitCode = ok === IMAGES.length ? 0 : 1;
})();
