// P2 creates room, P1 joins (reverse of normal flow)
const { chromium } = require('playwright');
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function login(page, email, playerName) {
  await page.locator('nav button:has-text("ログイン")').first().click();
  await sleep(800);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill('password');
  await page.locator('input[type="password"]').press('Enter');
  await page.waitForSelector('text=ルーム一覧', { timeout: 10000 });
  console.log(`[${playerName}] Logged in`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const [ctx1, ctx2] = [await browser.newContext(), await browser.newContext()];
  const [p1, p2] = [await ctx1.newPage(), await ctx2.newPage()];
  const URL = 'http://localhost:65456';

  await p1.goto(URL); await p1.waitForLoadState('networkidle');
  await login(p1, 'example1@example.com', 'P1');
  await p2.goto(URL); await p2.waitForLoadState('networkidle');
  await login(p2, 'example2@example.com', 'P2');

  // P2 creates room this time
  await p2.locator('input[placeholder*="ルーム名"]').fill('ReverseTest');
  await p2.locator('button:has-text("ルーム作成")').click();
  await sleep(1500);
  const p2Room = p2.locator('[class*="roomItem"]', { hasText: 'ReverseTest' }).first();
  await p2Room.locator('button:has-text("参加")').click();
  await sleep(1500);
  console.log('[P2] Created & joined room');

  // P1 joins — wait for room to appear in list first
  const p1Room = p1.locator('[class*="roomItem"]', { hasText: 'ReverseTest' }).first();
  await p1Room.waitFor({ timeout: 10000 });
  await p1Room.locator('button:has-text("参加")').waitFor({ timeout: 10000 });
  await p1Room.locator('button:has-text("参加")').click();
  await sleep(2000);
  console.log('[P1] Joined room');

  await p1.screenshot({ path: '/tmp/rev-p1.png', fullPage: true });
  await p2.screenshot({ path: '/tmp/rev-p2.png', fullPage: true });

  const p1DOM = await p1.evaluate(() => document.body.innerText);
  const p2DOM = await p2.evaluate(() => document.body.innerText);
  const p1HasSelf = p1DOM.includes('Player1');
  const p2HasSelf = p2DOM.includes('Player2');
  const p2IsHost = await p2.locator('button:has-text("ゲーム開始"), button:has-text("Start Game")').isVisible().catch(() => false);
  const p1IsNotHost = await p1.locator('[class*="waitingText"]').isVisible().catch(() => false);

  console.log('[P1] Shows Player1:', p1HasSelf ? '✅' : '❌');
  console.log('[P2] Shows Player2:', p2HasSelf ? '✅' : '❌');
  console.log('[P2] Is host:', p2IsHost ? '✅' : '❌');
  console.log('[P1] Is not host:', p1IsNotHost ? '✅' : '❌');

  await browser.close();
}

main().catch(e => { console.error(e.message); process.exit(1); });
