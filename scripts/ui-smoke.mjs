/**
 * Headless smoke test for the KiKiPay frontend.
 * Renders the built app in Chromium and asserts the UI contract:
 *  - wallet panel with connect button (no-wallet state in headless Chrome)
 *  - typed error for the missing wallet
 *  - public ledger fetches from the preprod indexer
 *  - circuit call disabled while disconnected
 *  - private inputs never present in the DOM
 *
 * Usage: node scripts/ui-smoke.mjs [base-url]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || process.env.BASE_URL || 'http://localhost:4173';

const failures = [];
const check = (name, cond) => {
  console.log(`${cond ? '✓' : '✗'} ${name}`);
  if (!cond) failures.push(name);
};

const browser = await chromium.launch();
const page = await browser.newPage();

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));

await page.goto(BASE, { waitUntil: 'networkidle' });

// 1. wallet panel renders in the no-wallet state
const connectBtn = page.getByTestId('connect');
await connectBtn.waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});
check('wallet panel renders with Connect button', await connectBtn.count() > 0);

// 2. typed no-wallet error appears after the detection poll gives up
const walletError = page.getByTestId('wallet-error');
await walletError.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
check(
  'typed "not installed" error shown (headless = no extension)',
  (await walletError.textContent().catch(() => ''))?.includes('No wallet detected') === true,
);

// 3. public ledger values load from the preprod indexer
const ledger = page.getByTestId('ledger');
await ledger.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
const ledgerText = (await ledger.textContent().catch(() => '')) || '';
check('public ledger renders', ledgerText.length > 0);
check('ledger shows potRoot', ledgerText.includes('potRoot'));
check('ledger shows paymentCount', ledgerText.includes('paymentCount'));

// 4. circuit call is disabled while disconnected
const callBtn = page.getByTestId('call-register');
check(
  'circuit call disabled while disconnected',
  (await callBtn.getAttribute('disabled')) !== null,
);

// 5. rubric label present on the action button
check(
  "'Proved without revealing your input' label present",
  ((await callBtn.textContent()) || '').includes('Proved without revealing your input'),
);

// 6. private inputs must never appear in the DOM
const html = await page.content();
for (const secret of ['secret', 'deriveSecret', 'alice-secret', '0x' + '11'.repeat(32)]) {
  check(`private marker "${secret.slice(0, 24)}" absent from DOM`, !html.includes(secret));
}

// 7. no unexpected page errors
check(
  'no page/console errors (beyond wallet-absence warnings)',
  consoleErrors.filter((e) => !/midnight|wallet|WebSocket/i.test(e)).length === 0,
);

await page.screenshot({ path: '/tmp/ui-smoke.png', fullPage: true });
await browser.close();

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nAll UI smoke checks passed.');
