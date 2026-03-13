const { chromium } = require('playwright');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function login(page, email, playerName) {
  // Click the first login button
  await page.locator('nav button:has-text("ログイン")').first().click();
  await sleep(800);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill('password');
  // Submit via form
  await page.locator('input[type="password"]').press('Enter');
  await page.waitForSelector('text=ルーム一覧', { timeout: 10000 });
  console.log(`[${playerName}] Logged in`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx1 = await browser.newContext();
  const p1 = await ctx1.newPage();
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();

  const URL = 'http://localhost:65456';

  await p1.goto(URL);
  await p1.waitForLoadState('networkidle');
  await login(p1, 'example1@example.com', 'P1');

  await p1.locator('input[placeholder*="ルーム名"]').fill('COMTest');
  await p1.locator('button:has-text("ルーム作成")').click();
  await sleep(2000);

  const roomCard = p1.locator('[class*="roomItem"]', { hasText: 'COMTest' }).first();
  await roomCard.locator('button:has-text("参加")').click();
  await sleep(1500);
  console.log('[P1] Joined room');

  await p1.locator('button:has-text("ゲーム開始")').waitFor({ timeout: 5000 });
  await p1.locator('button:has-text("ゲーム開始")').click();
  await sleep(3000);
  console.log('[P1] Game started');
  await p1.screenshot({ path: '/tmp/p1-game.png' });

  await p2.goto(URL);
  await p2.waitForLoadState('networkidle');
  await login(p2, 'example2@example.com', 'P2');
  await sleep(2000);
  await p2.screenshot({ path: '/tmp/p2-roomlist.png' });

  const p2Room = p2.locator('[class*="roomItem"]', { hasText: 'COMTest' }).first();
  const statusEl = await p2Room.locator('[class*="status"]').textContent().catch(() => 'N/A');
  const joinBtn = p2Room.locator('button:has-text("参加")');
  const joinVisible = await joinBtn.isVisible().catch(() => false);

  console.log('[P2] Room status:', statusEl);
  console.log('[P2] Join button visible:', joinVisible);

  if (!joinVisible) {
    console.error('[FAIL] No join button');
    await p2.screenshot({ path: '/tmp/p2-fail.png' });
    await browser.close();
    process.exit(1);
  }

  await joinBtn.click();
  await sleep(4000);
  await p2.screenshot({ path: '/tmp/p2-after-join.png' });
  await p1.screenshot({ path: '/tmp/p1-after-p2join.png' });

  const p2HandText = await p2.locator('text=/\\d+枚/').first().textContent().catch(() => '0枚');
  const p1HasP2 = await p1.locator('text=/Player2/').first().isVisible().catch(() => false);
  const cardCount = parseInt(p2HandText.replace('枚', ''));

  // Debug: get all visible text on P1's page
  const p1PageText = await p1.evaluate(() => document.body.innerText).catch(() => '');
  const hasPlayer2InDOM = p1PageText.includes('Player2');

  // Full page screenshot
  await p1.screenshot({ path: '/tmp/p1-fullpage.png', fullPage: true });

  console.log('[P2] Hand count:', p2HandText);
  console.log('[P1] Sees Player2 (locator):', p1HasP2);
  console.log('[P1] Player2 in DOM text:', hasPlayer2InDOM);
  console.log('\n=== RESULTS ===');
  console.log('Join button for PLAYING+COM room:', joinVisible ? '✅' : '❌');
  console.log('P2 hand (cards > 0):', cardCount > 0 ? `✅ (${cardCount} cards)` : `❌ (${cardCount} cards)`);
  console.log('P1 sees Player2 name:', (p1HasP2 || hasPlayer2InDOM) ? '✅' : '❌');

  await browser.close();
  process.exit((joinVisible && cardCount > 0 && hasPlayer2InDOM) ? 0 : 1);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
