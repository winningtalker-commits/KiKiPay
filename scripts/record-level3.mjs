#!/usr/bin/env node
/**
 * Assembles docs/demo/kikipay-level3.mp4 — the Level 3 one-minute demo:
 *   1. Title card
 *   2. LIVE Vercel dApp (fresh capture, honest no-wallet state)
 *   3. The connected dApp session, Preprod deploy and on-chain verification
 *      — the owner's real committed screenshots (docs/screenshots/)
 *   4. Real `npm test` output (14 passing) as a terminal frame
 *   5. The real GitHub README with the green CI badge
 *   6. Closing card
 * Every frame is a genuine capture; assembled with ffmpeg (libx264).
 */
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'demo', 'level3');
const FINAL = join(ROOT, 'docs', 'demo', 'kikipay-level3.mp4');
const TEST_OUT = '/tmp/kikipay-test-output.txt';

mkdirSync(OUT, { recursive: true, force: true });

const shots = [];
const add = (path, dur) => shots.push({ path, dur });

async function card(browser, name, title, lines, accent = '#7c5cff') {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = lines
    .map((l, i) => {
      const mono = l.startsWith('  ');
      return `<text x="640" y="${290 + i * 50}" text-anchor="middle" font-family="${mono ? 'monospace' : 'sans-serif'}" font-size="${mono ? 22 : 32}" fill="${mono ? '#aab' : '#fff'}">${esc(l)}</text>`;
    })
    .join('\n');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800">
    <rect width="1280" height="800" fill="#0b0d14"/>
    <rect x="0" y="0" width="1280" height="6" fill="${accent}"/>
    <text x="640" y="180" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="54" fill="#fff">${esc(title)}</text>
    ${body}
  </svg>`;
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
  await new Promise((ok) => setTimeout(ok, 250));
  const p = join(OUT, `${name}.png`);
  await page.screenshot({ path: p });
  await page.close();
  add(p, 4);
}

const browser = await chromium.launch();

// ---------- 1. title ----------
await card(browser, 'card-title', 'KiKiPay — Level 3 demo', [
  'Private payroll & splits on Midnight',
  '',
  '  1 · live dApp — private payroll pot on preprod',
  '  2 · npm test — 14 circuit tests passing',
  '  3 · README with the green CI badge',
  '',
  '  every frame is a real capture',
]);

// ---------- 2. live Vercel dApp, as it renders right now ----------
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('https://kikipay.vercel.app', { waitUntil: 'networkidle', timeout: 90_000 });
  await new Promise((ok) => setTimeout(ok, 2000));
  const p = join(OUT, 'live-dapp.png');
  await page.screenshot({ path: p });
  await page.close();
  add(p, 7);
}

// ---------- 3. owner's real committed screenshots ----------
for (const [name, dur] of [
  ['demo', 7],       // connected dApp session
  ['deploy', 6],     // Preprod deploy with address
  ['verify', 6],     // on-chain verification
]) {
  const src = join(ROOT, 'docs', 'screenshots', `${name}.png`);
  add(src, dur);
}

// ---------- 4. real test output as a terminal frame ----------
{
  const text = readFileSync(TEST_OUT, 'utf8')
    .split('\n')
    .filter((l) => !l.includes('Sourcemap'))
    .join('\n');
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<!doctype html><html><body style="margin:0;background:#0d1117">
    <div style="padding:28px 36px">
      <div style="color:#8b949e;font-family:sans-serif;font-size:26px;margin-bottom:18px">npm test — real compiled circuits, in-process</div>
      <pre style="color:#3fb950;font-family:monospace;font-size:21px;line-height:1.5;margin:0;white-space:pre-wrap">${esc(text.trim())}</pre>
    </div>
  </body></html>`;
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.setContent(html);
  await new Promise((ok) => setTimeout(ok, 300));
  const p = join(OUT, 'tests.png');
  await page.screenshot({ path: p });
  await page.close();
  add(p, 8);
}

// ---------- 5. real GitHub README with the CI badge ----------
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('https://github.com/winningtalker-commits/KiKiPay', {
    waitUntil: 'networkidle',
    timeout: 90_000,
  });
  await new Promise((ok) => setTimeout(ok, 2500));
  const p = join(OUT, 'readme-badge.png');
  await page.screenshot({ path: p });
  await page.close();
  add(p, 6);
}

// ---------- 6. closing card ----------
await card(
  browser,
  'card-close',
  'Payments verifiable. Payers unwatchable.',
  ['github.com/winningtalker-commits/KiKiPay', 'kikipay.vercel.app', '', '  preprod contract 0xcbeb5ef7…8450b1ca5'],
  '#3fb950',
);

await browser.close();

// ---------- assemble ----------
const list = join(OUT, 'frames.txt');
writeFileSync(
  list,
  shots.map((s) => `file '${s.path}'\nduration ${s.dur}`).join('\n') + `\nfile '${shots[shots.length - 1].path}'\n`,
);
const r = spawnSync(
  'ffmpeg',
  ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=25,format=yuv420p,scale=1280:800:force_original_aspect_ratio=decrease,pad=1280:800:(ow-iw)/2:(oh-ih)/2', '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-movflags', '+faststart', FINAL],
  { stdio: 'pipe' },
);
if (r.status !== 0) {
  console.error(r.stderr.toString().slice(-600));
  throw new Error('ffmpeg assembly failed');
}
console.log('video:', FINAL, `(${shots.length} frames)`);
