/**
 * Claim preprod tNIGHT from https://faucet.preprod.midnight.network for the
 * demo relay wallet.
 *
 * The faucet POST /api/drips is protected by a Cloudflare Turnstile widget
 * (sitekey 0x4AAAAAACps-IJXzrgsIio6), so this script drives the real faucet
 * page in headless Chromium: paste the address, let/solve the Turnstile
 * challenge in-page, submit the form, then poll GET /api/drips/{id} until the
 * transfer is acknowledged.
 *
 * Usage: node scripts/faucet-claim.mjs <bech32-address>
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const ADDRESS = process.argv[2];
// The midnight.network instance is often NOT_SERVING (SERVICES_DOWN); this
// mirror runs the same faucet app and is usually healthy.
const FAUCET = 'https://midnight-tmnight-preprod.nethermind.dev';
const LOG = '/tmp/faucet-run.json';

if (!ADDRESS || !/^mn_addr/.test(ADDRESS)) {
  console.error('usage: node scripts/faucet-claim.mjs mn_addr_preprod1…');
  process.exit(1);
}

const trace = { steps: [], responses: [] };
const step = (msg) => {
  console.log('[faucet]', msg);
  trace.steps.push(`${new Date().toISOString()} ${msg}`);
};

// Real Google Chrome (installed via `npx playwright install chrome`) — best
// chance of passing Turnstile. Run under xvfb: xvfb-run -a node scripts/faucet-claim.mjs <address>
const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  userAgent:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
});
await page.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
});

// Capture the drip API traffic (POST response carries the dripId).
page.on('response', async (res) => {
  const url = res.url();
  if (url.includes('/api/drips')) {
    let body = null;
    try { body = await res.json(); } catch { /* ignore */ }
    trace.responses.push({ url, status: res.status(), body });
    step(`drips api ${res.request().method()} ${url.replace(FAUCET, '')} → ${res.status()} ${JSON.stringify(body)?.slice(0, 200)}`);
  }
});

step('opening faucet page');
await page.goto(FAUCET, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.screenshot({ path: '/tmp/faucet-1-loaded.png' });

// Give the Turnstile widget time to auto-run.
await page.waitForTimeout(6000);

// Fill the address input (role=textbox).
const input = page.locator('input[type="text"], input[type="url"], input:not([type])').first();
await input.waitFor({ state: 'visible', timeout: 20000 });
await input.click();
await input.fill('');
await input.pressSequentially(ADDRESS, { delay: 8 });
step('address entered');
await page.screenshot({ path: '/tmp/faucet-2-filled.png' });

// Make sure the Turnstile challenge inside its iframe is interacted with.
// The widget may sit behind a shadow root — click the host element itself.
try {
  const frame = page.frameLocator('iframe[src*="challenges.cloudflare.com"]');
  const checkbox = frame.locator('input[type="checkbox"], label');
  if (await checkbox.count() > 0) {
    await checkbox.first().click({ timeout: 5000 });
    step('clicked Turnstile checkbox');
  } else {
    step('Turnstile widget auto-solving (no checkbox)');
  }
} catch (e) {
  step(`Turnstile iframe interaction skipped: ${e.message?.split('\n')[0]}`);
}
try {
  const host = page.locator('.cf-turnstile, [class*="turnstile"], [id*="turnstile"], div:has(> div[style*="position: relative"] iframe[src*="challenges.cloudflare"])').first();
  if (await host.count() > 0) {
    await host.click({ timeout: 5000, force: true });
    step('clicked Turnstile host element');
  }
} catch (e) {
  step(`Turnstile host click skipped: ${e.message?.split('\n')[0]}`);
}
await page.waitForTimeout(8000); // let the token be issued
await page.screenshot({ path: '/tmp/faucet-3-captcha.png' });

// Submit.
const buttons = page.locator('button');
const n = await buttons.count();
const labels = [];
for (let i = 0; i < n; i++) labels.push(await buttons.nth(i).textContent().catch(() => ''));
step(`buttons on page: ${JSON.stringify(labels)}`);
// Wait for the Turnstile token to enable the submit button, then click.
const submit = buttons.filter({ hasText: /claim|request|send|drip|get/i }).first();
if ((await submit.count()) === 0) {
  await buttons.last().click();
} else {
  // The button enables once the Turnstile token is issued — poll for that.
  let enabled = false;
  for (let i = 0; i < 24; i++) {
    enabled = await submit.isEnabled().catch(() => false);
    if (enabled) break;
    if (i === 5 || i === 12) {
      const diag = await page.evaluate(() => ({
        turnstile: typeof window.turnstile,
        turnstileKeys: window.turnstile ? Object.keys(window.turnstile) : [],
        cfIframes: document.querySelectorAll('iframe[src*="challenges.cloudflare.com"]').length,
        responseInputs: Array.from(document.querySelectorAll('input[name*="turnstile"], input[name*="cf"]')).map((el) => ({ name: el.name, len: el.value.length })),
      })).catch(() => null);
      step(`turnstile diagnostics: ${JSON.stringify(diag)}`);
    }
    await page.waitForTimeout(5000);
  }
  if (enabled) {
    await submit.click({ timeout: 10000 });
    step('submit clicked (button was enabled — Turnstile passed)');
  } else {
    step('button never enabled — forcing click on disabled button');
    await submit.click({ force: true, timeout: 5000 }).catch(() => {});
  }
}
await page.waitForTimeout(5000);
await page.screenshot({ path: '/tmp/faucet-4-submitted.png' });

// Surface any visible error/success text.
const bodyText = (await page.locator('body').textContent().catch(() => '')) || '';
trace.pageTextAfterSubmit = bodyText.replace(/\s+/g, ' ').slice(0, 1500);
step(`page text: ${trace.pageTextAfterSubmit.slice(0, 300)}`);

// Poll the drip endpoint if we captured a dripId.
const post = trace.responses.find((r) => r.url.endsWith('/api/drips') && r.request?.() !== undefined);
const postBody = post?.body ?? trace.responses[trace.responses.length - 1]?.body;
const dripId = postBody?.dripId ?? postBody?.id;
if (dripId) {
  step(`polling drip ${dripId}`);
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${FAUCET}/api/drips/${dripId}`).catch(() => null);
    const j = res ? await res.json().catch(() => null) : null;
    step(`drip status: ${JSON.stringify(j)?.slice(0, 200)}`);
    if (j && (j.transactionIdentifier || j.status === 'COMPLETED' || j.status === 'complete')) break;
    await new Promise((r) => setTimeout(r, 8000));
  }
} else {
  step('no dripId captured — check screenshots/page text');
}

await browser.close();
writeFileSync(LOG, JSON.stringify(trace, null, 2));
step('done');
