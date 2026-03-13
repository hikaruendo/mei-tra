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
  const ctx1 = await browser.newContext();
  const p1 = await ctx1.newPage();
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();

  const URL = 'http://localhost:65456';

  // Both browsers navigate and login
  await p1.goto(URL);
  await p1.waitForLoadState('networkidle');
  await login(p1, 'example1@example.com', 'P1');

  await p2.goto(URL);
  await p2.waitForLoadState('networkidle');
  await login(p2, 'example2@example.com', 'P2');

  // P1 creates room
  await p1.locator('input[placeholder*="ルーム名"]').fill('WaitingTest');
  await p1.locator('button:has-text("ルーム作成")').click();
  await sleep(2000);

  // P1 joins the room
  const p1Room = p1.locator('[class*="roomItem"]', { hasText: 'WaitingTest' }).first();
  await p1Room.locator('button:has-text("参加")').click();
  await sleep(1500);
  console.log('[P1] Joined room');

  // P2 joins the same room
  await sleep(1000);
  const p2Room = p2.locator('[class*="roomItem"]', { hasText: 'WaitingTest' }).first();
  await p2Room.locator('button:has-text("参加")').click();
  await sleep(2000);
  console.log('[P2] Joined room');

  // Take screenshots
  await p1.screenshot({ path: '/tmp/wait-p1.png', fullPage: true });
  await p2.screenshot({ path: '/tmp/wait-p2.png', fullPage: true });

  // Check what each player sees at the bottom (self) position
  const p1BottomText = await p1.evaluate(() => {
    const bottomSeat = document.querySelector('[class*="bottom"] [class*="name"]');
    return bottomSeat?.textContent || 'NOT FOUND';
  });
  const p2BottomText = await p2.evaluate(() => {
    const bottomSeat = document.querySelector('[class*="bottom"] [class*="name"]');
    return bottomSeat?.textContent || 'NOT FOUND';
  });

  // Check isHost display
  const p1IsHost = await p1.locator('button:has-text("ゲーム開始")').isVisible().catch(() => false);
  const p2IsHost = await p2.locator('button:has-text("ゲーム開始")').isVisible().catch(() => 
    p2.locator('button:has-text("Start Game")').isVisible().catch(() => false));

  console.log('[P1] Bottom player shown as:', p1BottomText);
  console.log('[P2] Bottom player shown as:', p2BottomText);
  console.log('[P1] Has Start button (is host):', p1IsHost);
  console.log('[P2] Has Start button (is host):', p2IsHost);

  console.log('\n=== RESULTS ===');
  console.log('P1 self-identifies as Player1:', p1BottomText === 'Player1' ? '✅' : `❌ (shows: ${p1BottomText})`);
  console.log('P2 self-identifies as Player2:', p2BottomText === 'Player2' ? '✅' : `❌ (shows: ${p2BottomText})`);
  console.log('P1 is host:', p1IsHost ? '✅' : '❌');
  console.log('P2 is not host:', !p2IsHost ? '✅' : '❌');

  await browser.close();
  const ok = (p1BottomText === 'Player1') && (p2BottomText === 'Player2') && p1IsHost && !p2IsHost;
  process.exit(ok ? 0 : 1);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
