import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve('axe-core/axe.min.js');

const isDesktop = (testInfo) => testInfo.project.name === 'desktop';
const isMobile = (testInfo) => testInfo.project.name === 'mobile';

test.beforeEach(async ({ page }) => {
  // Keep tests offline and deterministic: block the third-party map embed.
  await page.route(/google\.com/, (route) => route.abort());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
});

test('page never scrolls horizontally', async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test('shows inline links on desktop and a menu button on smaller screens', async ({ page }, testInfo) => {
  const nav = page.getByRole('navigation', { name: 'Main' });
  const menuButton = page.getByRole('button', { name: 'Open menu' });

  if (isDesktop(testInfo)) {
    await expect(nav.getByRole('link', { name: 'Schedule' })).toBeVisible();
    await expect(menuButton).toBeHidden();
  } else {
    await expect(nav).toBeHidden();
    await menuButton.click();
    await expect(nav.getByRole('link', { name: 'Schedule' })).toBeVisible();
  }
});

test('paired sections sit side by side from tablet up and stack on phones', async ({ page }, testInfo) => {
  const a = await page.locator('#announcements').boundingBox();
  const s = await page.locator('#schedule').boundingBox();
  if (isMobile(testInfo)) {
    expect(s.y).toBeGreaterThanOrEqual(a.y + a.height);
  } else {
    expect(Math.abs(a.y - s.y)).toBeLessThan(1);
    expect(s.x).toBeGreaterThan(a.x);
  }
});

test('header hides when scrolling down and returns when scrolling up', async ({ page }) => {
  const header = page.locator('.site-header');
  await page.mouse.move(5, 400); // keep the pointer off the header
  await page.mouse.wheel(0, 1200);
  await expect(header).toHaveAttribute('data-hidden', 'true');
  await page.mouse.wheel(0, -300);
  await expect(header).toHaveAttribute('data-hidden', 'false');
});

test('hero doors close past 1/3 scrolled out and reopen above 2/3 visible', async ({ page }) => {
  const doors = page.locator('.hero__doors');
  const heroHeight = (await page.locator('#top').boundingBox()).height;

  await expect(doors).toHaveAttribute('data-closed', 'false');

  await page.evaluate((y) => window.scrollTo(0, y), Math.round(heroHeight * 0.2));
  await expect(doors).toHaveAttribute('data-closed', 'false');

  await page.evaluate((y) => window.scrollTo(0, y), Math.round(heroHeight * 0.5));
  await expect(doors).toHaveAttribute('data-closed', 'true');

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(doors).toHaveAttribute('data-closed', 'false');
});

test('first Tab reaches the skip link, which moves focus to main content', async ({ page }) => {
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});

test('keyboard search jumps to a section and focuses its heading', async ({ page }) => {
  const search = page.getByRole('combobox', { name: 'Jump to a section' });
  await search.focus();
  await page.keyboard.type('fees');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  const heading = page.getByRole('heading', { name: 'Fees', level: 2 });
  await expect(heading).toBeFocused();
  await expect(heading).toBeInViewport();
  await expect(page).toHaveURL(/#fees$/);
});

test('instructor row scrolls sideways', async ({ page }, testInfo) => {
  const track = page.getByRole('region', { name: 'Instructor profiles' });
  await track.scrollIntoViewIfNeeded();
  // How many instructors there are is content, so the row may fit without scrolling.
  const overflows = await track.evaluate((el) => el.scrollWidth > el.clientWidth);
  test.skip(!overflows, 'Too few instructors to overflow the row');
  const before = await track.evaluate((el) => el.scrollLeft);

  if (isMobile(testInfo)) {
    // Arrow buttons are hidden on phones; the focusable row scrolls by keyboard.
    await track.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
  } else {
    await page.getByRole('button', { name: 'Scroll to next instructors' }).click();
  }

  await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(before);
});

test('switching to Vietnamese updates text and html lang, and persists on reload', async ({ page }, testInfo) => {
  if (!isDesktop(testInfo)) await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('button', { name: /Tiếng Việt/ }).click();

  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.getByRole('heading', { name: 'Lịch tập', level: 2 })).toBeVisible();
  await expect(page).toHaveTitle('Võ đường Aikido Tenshinkai');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
});

for (const language of ['en', 'vi']) {
  test(`no accessibility violations including color contrast (${language})`, async ({ page }, testInfo) => {
    // Open the menu on smaller screens so its links and language toggle are scanned too.
    if (!isDesktop(testInfo)) await page.getByRole('button', { name: 'Open menu' }).click();
    if (language === 'vi') await page.getByRole('button', { name: /Tiếng Việt/ }).click();
    await page.addScriptTag({ path: AXE_PATH });
    const violations = await page.evaluate(async () => {
      const results = await window.axe.run(
        { exclude: [['iframe']] },
        { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } },
      );
      return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
    });
    expect(violations).toEqual([]);
  });
}
