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

// 3. public ledger values load from the preprod indexer.
//    The app retries the indexer with backoff for ~45s before showing its
//    graceful offline message. The public indexer occasionally 503s during
//    maintenance windows — in that case the ledger checks are SKIPPED (infra
//    failure, not an app defect) but the graceful-error behavior is asserted.
const ledger = page.getByTestId('ledger');
let ledgerVisible = await ledger.waitFor({ state: 'visible', timeout: 55000 }).then(() => true).catch(() => false);
if (!ledgerVisible) {
  const graceful = await page
    .getByTestId('ledger-error')
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  check(
    'graceful offline message when indexer unreachable (no raw errors)',
    graceful,
  );
}
if (ledgerVisible) {
  const ledgerText = (await ledger.textContent().catch(() => '')) || '';
  check('public ledger renders', ledgerText.length > 0);
  check('ledger shows potRoot', ledgerText.includes('potRoot'));
  check('ledger shows paymentCount', ledgerText.includes('paymentCount'));
} else {
  const unreachable = await page.getByTestId('ledger-error').isVisible().catch(() => false);
  console.log(
    unreachable
      ? '⚠ SKIPPED ledger checks — public Preprod indexer unreachable (infra outage, not an app failure)'
      : '⚠ SKIPPED ledger checks — ledger never rendered and no graceful error shown',
  );
  if (!unreachable) failures.push('ledger neither rendered nor showed a graceful error');
}

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

// 7. no unexpected page errors. Network failures to the indexer (CORS/503/
//    timeouts) are infrastructure, not app defects — filtered here.
check(
  'no page/console errors (beyond wallet-absence + indexer-network warnings)',
  consoleErrors.filter(
    (e) =>
      !/midnight|wallet|WebSocket/i.test(e) &&
      !/indexer\.(preprod|preview)\.midnight\.network/.test(e) &&
      !/Failed to fetch|Failed to load resource|net::ERR|CORS/i.test(e),
  ).length === 0,
);

await page.screenshot({ path: '/tmp/ui-smoke.png', fullPage: true });
await browser.close();

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nAll UI smoke checks passed.');
