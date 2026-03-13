import { test, expect, Page, BrowserContext } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

// Test credentials (created by scripts/create-test-users.sh)
const PLAYER1 = { email: 'example1@example.com', password: 'password', name: 'Player1' };
const PLAYER2 = { email: 'example2@example.com', password: 'password', name: 'Player2' };

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/** Log in via the landing page CTA → AuthModal */
async function login(page: Page, user: typeof PLAYER1) {
  await page.goto(`${BASE_URL}/ja`, { waitUntil: 'domcontentloaded' });

  // Click the primary "ログイン" CTA on the landing page
  await page.getByRole('button', { name: 'ログイン' }).first().click();

  // Fill credentials using label-associated IDs
  await page.locator('#email').fill(user.email);
  await page.locator('#password').fill(user.password);

  // Submit (the last "ログイン" button inside the form)
  await page.locator('button[type="submit"]').click();

  // Wait for room list to appear — proof of successful login
  await expect(page.getByRole('heading', { name: 'ルーム一覧' })).toBeVisible({ timeout: 20_000 });

  // Wait for the backend HTTP status to show running
  await expect(page.getByText('サーバー稼働中')).toBeVisible({ timeout: 15_000 });

  // Wait for WebSocket to actually connect:
  // Phase 1: "ソケット未接続" (isConnected=false, isConnecting=false) must disappear
  //          — this phase is brief right after page load, before the useSocket effect runs
  // Phase 2: "サーバーに接続中..." (isConnecting=true) must disappear
  //          — this phase ends when the socket handshake with the backend completes
  // React Strict Mode causes a double-invocation of the SocialSocketProvider effect, which
  // creates a disconnect-then-reconnect cycle. Use toPass() with retries to handle this
  // gracefully, ensuring the socket is stably connected before proceeding.
  await expect(async () => {
    await expect(page.getByText('ソケット未接続')).not.toBeVisible();
    await expect(page.getByText('サーバーに接続中...')).not.toBeVisible();
  }).toPass({ timeout: 30_000 });

  // Brief stability pause to ensure the reconnect cycle has settled
  await page.waitForTimeout(500);
}

/** Create a room then click join, wait for PreGameTable to appear */
async function createRoom(page: Page, roomName: string) {
  await page.getByPlaceholder('ルーム名を入力').fill(roomName);
  await page.getByRole('button', { name: 'ルーム作成' }).click();

  // Wait for the room to appear in the list, then join it
  const row = page.locator('[class*="roomItem"]').filter({ hasText: roomName });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.getByRole('button', { name: '参加' }).click();

  await expect(page.locator('[class*="playerPositions"]')).toBeVisible({ timeout: 15_000 });
}

/** Find the room row and click join */
async function joinRoom(page: Page, roomName: string) {
  await expect(page.getByText(roomName, { exact: false })).toBeVisible({ timeout: 15_000 });
  // The join button is in the row that contains the room name
  const row = page.locator('[class*="roomItem"]').filter({ hasText: roomName });
  await row.getByRole('button', { name: '参加' }).click();
  await expect(page.locator('[class*="playerPositions"]')).toBeVisible({ timeout: 15_000 });
}

/** Collect text of non-COM seats from the PreGameTable */
async function getRealPlayerNames(page: Page): Promise<string[]> {
  const seats = page.locator('[class*="playerSeat"]');
  const count = await seats.count();
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = ((await seats.nth(i).textContent()) ?? '').trim();
    // COM players render as "🤖COM" (emoji + name), real players render as just their name.
    // Filter by !includes('COM') to exclude all COM seats regardless of emoji prefix.
    if (text && !text.includes('COM')) {
      names.push(text);
    }
  }
  return names;
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

// Use serial mode to avoid port/room collisions between tests
test.describe.configure({ mode: 'serial' });

test.describe('Waiting Room', () => {
  let ctx1: BrowserContext;
  let ctx2: BrowserContext;
  let page1: Page;
  let page2: Page;

  test.beforeEach(async ({ browser }) => {
    ctx1 = await browser.newContext();
    ctx2 = await browser.newContext();
    page1 = await ctx1.newPage();
    page2 = await ctx2.newPage();

    // Log browser errors only to aid CI debugging
    page1.on('console', (msg) => {
      if (msg.type() === 'error') console.error(`[P1]`, msg.text());
    });
    page2.on('console', (msg) => {
      if (msg.type() === 'error') console.error(`[P2]`, msg.text());
    });
  });

  test.afterEach(async () => {
    await ctx1.close();
    await ctx2.close();
  });

  // ────────────────────────────────────────────
  test('balanced teams (2:2) when room is created with 1 real player + 3 COMs', async () => {
    await login(page1, PLAYER1);

    const roomName = `TeamBalance-${Date.now()}`;
    await createRoom(page1, roomName);

    // Seat positions: bottom + top → team0, left + right → team1
    const team0Seats = page1.locator(
      '[class*="playerSeat"][class*="bottom"], [class*="playerSeat"][class*="top"]',
    );
    const team1Seats = page1.locator(
      '[class*="playerSeat"][class*="left"], [class*="playerSeat"][class*="right"]',
    );

    await expect(team0Seats).toHaveCount(2);
    await expect(team1Seats).toHaveCount(2);
  });

  // ────────────────────────────────────────────
  test('Player1 creates room and Player2 joins — both visible to each other', async () => {
    await Promise.all([login(page1, PLAYER1), login(page2, PLAYER2)]);

    const roomName = `MutualVisible-${Date.now()}`;
    await createRoom(page1, roomName);
    await joinRoom(page2, roomName);

    // Player1 sees Player2
    await expect(async () => {
      const names = await getRealPlayerNames(page1);
      expect(names.some((n) => n.includes(PLAYER2.name))).toBe(true);
    }).toPass({ timeout: 15_000 });

    // Player2 sees Player1
    await expect(async () => {
      const names = await getRealPlayerNames(page2);
      expect(names.some((n) => n.includes(PLAYER1.name))).toBe(true);
    }).toPass({ timeout: 15_000 });

    // Both should see exactly 2 real players
    const names1 = await getRealPlayerNames(page1);
    const names2 = await getRealPlayerNames(page2);
    expect(names1).toHaveLength(2);
    expect(names2).toHaveLength(2);
  });

  // ────────────────────────────────────────────
  test('No ghost COMs — total seat count is always 4 after Player2 joins', async () => {
    await Promise.all([login(page1, PLAYER1), login(page2, PLAYER2)]);

    const roomName = `GhostCOM-${Date.now()}`;
    await createRoom(page1, roomName);
    await joinRoom(page2, roomName);

    // Wait for state to settle
    await page1.waitForTimeout(2000);
    await page2.waitForTimeout(2000);

    // Each view must show exactly 4 seats (never 5+)
    await expect(page1.locator('[class*="playerSeat"]')).toHaveCount(4);
    await expect(page2.locator('[class*="playerSeat"]')).toHaveCount(4);
  });

  // ────────────────────────────────────────────
  test('Player leaving waiting room does not make remaining player disappear', async () => {
    await Promise.all([login(page1, PLAYER1), login(page2, PLAYER2)]);

    const roomName = `LeaveRoom-${Date.now()}`;
    await createRoom(page1, roomName);
    await joinRoom(page2, roomName);

    // Confirm mutual visibility first
    await expect(async () => {
      const names = await getRealPlayerNames(page1);
      expect(names.some((n) => n.includes(PLAYER2.name))).toBe(true);
    }).toPass({ timeout: 15_000 });

    // Player2 leaves
    await page2.getByRole('button', { name: '退出' }).click();

    // Give time for leave-room event to propagate
    await page1.waitForTimeout(2000);

    // Player1 must still see themselves (not all-COM)
    const namesAfterLeave = await getRealPlayerNames(page1);
    expect(namesAfterLeave.some((n) => n.includes(PLAYER1.name))).toBe(true);

    // Total seats must still be 4
    await expect(page1.locator('[class*="playerSeat"]')).toHaveCount(4);
  });
});
