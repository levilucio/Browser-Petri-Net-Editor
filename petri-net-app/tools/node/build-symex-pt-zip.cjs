const fs = require('fs');
const path = require('path');

// NOTE: This project is ESM ("type": "module"), but build scripts are easier to keep as CJS.
const archiver = require('archiver');

const SCRIPT_DIR = __dirname;
const APP_DIR = path.resolve(SCRIPT_DIR, '..', '..'); // petri-net-app/

const ENGINE_SYMEX_DIR = path.resolve(
  APP_DIR,
  '..',
  '..',
  'symbolic-execution-engine',
  'src',
  'symex_engine'
);

const OUT_DIR = path.resolve(APP_DIR, 'public', 'py');
const OUT_ZIP = path.resolve(OUT_DIR, 'symex_engine_pt.zip');
const OUT_META = path.resolve(OUT_DIR, 'symex_engine_pt.meta.json');

const SHOULD_INCLUDE_TOP_LEVEL = new Set(['__init__.py']);
const SHOULD_INCLUDE_DIRS = new Set(['core', 'petri_net']);
const IGNORED_DIRS = new Set(['__pycache__']);

function fail(msg) {
  console.error(`[symex:bundle:pt] ${msg}`);
  process.exit(1);
}

function walkFiles(dirAbs, relPrefix = '') {
  /** @type {string[]} */
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  } catch (e) {
    fail(`Failed to read directory: ${dirAbs} (${e && e.message ? e.message : e})`);
  }

  // Stable order for reproducible zips
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const ent of entries) {
    if (ent.isDirectory()) {
      if (IGNORED_DIRS.has(ent.name)) continue;
      const nextAbs = path.join(dirAbs, ent.name);
      const nextRel = relPrefix ? `${relPrefix}/${ent.name}` : ent.name;
      out.push(...walkFiles(nextAbs, nextRel));
      continue;
    }
    if (!ent.isFile()) continue;
    if (ent.name.endsWith('.pyc')) continue;

    const fpAbs = path.join(dirAbs, ent.name);
    const fpRel = relPrefix ? `${relPrefix}/${ent.name}` : ent.name;
    out.push(`${fpAbs}|||${fpRel}`);
  }
  return out;
}

function collectEngineFiles() {
  if (!fs.existsSync(ENGINE_SYMEX_DIR)) {
    fail(`Engine source directory not found: ${ENGINE_SYMEX_DIR}`);
  }

  /** @type {{abs:string, rel:string}[]} */
  const files = [];

  // Top-level __init__.py
  for (const name of SHOULD_INCLUDE_TOP_LEVEL) {
    const fp = path.join(ENGINE_SYMEX_DIR, name);
    if (!fs.existsSync(fp)) fail(`Missing required file: ${fp}`);
    files.push({ abs: fp, rel: name });
  }

  // Selected subpackages
  for (const d of SHOULD_INCLUDE_DIRS) {
    const dirAbs = path.join(ENGINE_SYMEX_DIR, d);
    if (!fs.existsSync(dirAbs)) fail(`Missing required directory: ${dirAbs}`);
    for (const item of walkFiles(dirAbs, d)) {
      const [abs, rel] = item.split('|||');
      files.push({ abs, rel });
    }
  }

  // Stable ordering
  files.sort((a, b) => a.rel.localeCompare(b.rel));
  return files;
}

function latestMtimeMs(files) {
  let latest = 0;
  for (const f of files) {
    const st = fs.statSync(f.abs);
    if (st.mtimeMs > latest) latest = st.mtimeMs;
  }
  return latest;
}

async function main() {
  // When the engine source is not available (e.g. CI or a checkout without the
  // sibling engine repo), fall back to the vendored bundle committed in the repo.
  if (!fs.existsSync(ENGINE_SYMEX_DIR)) {
    if (fs.existsSync(OUT_ZIP) && fs.statSync(OUT_ZIP).size > 0) {
      console.log(
        `[symex:bundle:pt] Engine source not found; using vendored bundle ${path.relative(APP_DIR, OUT_ZIP)}.`
      );
      return;
    }
    fail(
      `Engine source directory not found and no vendored bundle present: ${ENGINE_SYMEX_DIR}`
    );
  }

  const files = collectEngineFiles();
  if (files.length === 0) fail('No files collected to bundle.');

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const latestSrc = latestMtimeMs(files);
  if (fs.existsSync(OUT_ZIP)) {
    const outSt = fs.statSync(OUT_ZIP);
    if (outSt.size > 0 && outSt.mtimeMs >= latestSrc) {
      // Still refresh meta so it matches current sources
      fs.writeFileSync(
        OUT_META,
        JSON.stringify(
          {
            kind: 'symex_engine_pt_bundle',
            engine_src_dir: ENGINE_SYMEX_DIR,
            out_zip: OUT_ZIP,
            file_count: files.length,
            latest_src_mtime_ms: latestSrc,
            bundled_at_iso: new Date().toISOString(),
            skipped: true,
          },
          null,
          2
        ),
        'utf8'
      );
      console.log(`[symex:bundle:pt] Up-to-date; skipping zip (files=${files.length}).`);
      return;
    }
  }

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(OUT_ZIP);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    output.on('error', reject);
    archive.on('warning', (err) => {
      // Archiver uses warnings for e.g. stat failures; treat them as fatal for correctness.
      reject(err);
    });
    archive.on('error', reject);

    archive.pipe(output);

    for (const f of files) {
      // Keep a package root so imports work: symex_engine.petri_net...
      archive.file(f.abs, { name: `symex_engine/${f.rel}` });
    }

    archive.finalize();
  });

  fs.writeFileSync(
    OUT_META,
    JSON.stringify(
      {
        kind: 'symex_engine_pt_bundle',
        engine_src_dir: ENGINE_SYMEX_DIR,
        out_zip: OUT_ZIP,
        file_count: files.length,
        latest_src_mtime_ms: latestSrc,
        bundled_at_iso: new Date().toISOString(),
        skipped: false,
      },
      null,
      2
    ),
    'utf8'
  );

  const outSt = fs.statSync(OUT_ZIP);
  console.log(`[symex:bundle:pt] Wrote ${path.relative(APP_DIR, OUT_ZIP)} (${outSt.size} bytes, files=${files.length}).`);
}

main().catch((e) => fail(e && e.stack ? e.stack : String(e)));

