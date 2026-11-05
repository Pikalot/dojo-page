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
  const search = page.getByRole('combobox', { name: 'Search sections and instructors' });
  await search.focus();
  await page.keyboard.type('sched');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  const heading = page.getByRole('heading', { name: 'Schedule', level: 2 });
  await expect(heading).toBeFocused();
  await expect(heading).toBeInViewport();
  await expect(page).toHaveURL(/#schedule$/);
});

test('Escape closes the search results first, then clears the text', async ({ page }) => {
  const search = page.getByRole('combobox', { name: 'Search sections and instructors' });
  await search.focus();
  await page.keyboard.type('sched');
  await expect(search).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('Escape');
  await expect(search).toHaveAttribute('aria-expanded', 'false');
  await expect(search).toHaveValue('sched');

  await page.keyboard.press('Escape');
  await expect(search).toHaveValue('');
});

test('a shared section link opens at that section', async ({ page }) => {
  await page.goto('about:blank'); // a new load, not a jump within the open page
  await page.goto('/#instructors');

  const heading = page.getByRole('heading', { name: 'Instructors', level: 2 });
  await expect(heading).toBeFocused();
  await expect(heading).toBeInViewport();
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
  await expect(page).toHaveTitle('Võ đường Aikido Tenshinkai tại San Jose');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
});

// Names and ranks are content, so these read them from the page.
test('searching a name and choosing the person opens their profile', async ({ page }) => {
  const name = await page.locator('.instructor-card__open').first().textContent();
  const search = page.getByRole('combobox', { name: 'Search sections and instructors' });

  await search.fill(name);
  await page.getByRole('option', { name }).first().click();

  const profile = page.getByRole('dialog', { name });
  await expect(profile).toBeVisible();
  await expect(page).toHaveURL(/#instructors$/);

  await page.keyboard.press('Escape');
  await expect(profile).toBeHidden();
  await expect(page.locator('#instructors-title')).toBeFocused();
});

test('searching a rank lists everyone at that rank, and a black belt jumps to the list', async ({ page }) => {
  const group = page.locator('.black-belts__group').first();
  await group.waitFor({ state: 'attached' });
  const rank = await group.locator('.black-belts__rank').textContent();
  const members = await group.locator('li').allTextContents();
  const search = page.getByRole('combobox', { name: 'Search sections and instructors' });

  await search.fill(rank);
  for (const member of members) {
    await expect(page.getByRole('option', { name: member })).toBeVisible();
  }
  await page.getByRole('option', { name: members[0] }).click();

  const chosen = page.locator('#black-belts li', { hasText: members[0] });
  await expect(chosen).toBeFocused();
  await expect(chosen).toHaveAttribute('data-highlighted', 'true');
  await expect(chosen).toBeInViewport();
  await expect(page.locator('#black-belts li[data-highlighted]')).toHaveCount(1);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/#black-belts$/);

  await expect(chosen).not.toHaveAttribute('data-highlighted', 'true', { timeout: 5000 });
});

test('typing a dan number or "black belt" finds people', async ({ page }) => {
  const search = page.getByRole('combobox', { name: 'Search sections and instructors' });
  await search.fill('1st dan');
  await expect(page.getByRole('option').first()).toBeVisible();
  await search.fill('black belt');
  await expect(page.getByRole('option', { name: 'Instructors' })).toBeVisible();
  await expect(page.getByRole('option').nth(1)).toBeVisible();
});

test('the keyboard can reach and choose a person far down a long list', async ({ page }) => {
  const group = page.locator('.black-belts__group').last();
  await group.waitFor({ state: 'attached' });
  const rank = await group.locator('.black-belts__rank').textContent();
  const search = page.getByRole('combobox', { name: 'Search sections and instructors' });

  await search.fill(rank);
  await page.getByRole('option').first().waitFor();
  const count = await page.getByRole('option').count();
  for (let i = 0; i < count; i += 1) await page.keyboard.press('ArrowDown');

  await expect(page.getByRole('option').last()).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('option').last()).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('#black-belts li[data-highlighted]')).toBeFocused();
});

test('quick clicks on the photo arrow are not lost while it scrolls', async ({ page }, testInfo) => {
  test.skip(isMobile(testInfo), 'Arrow buttons are hidden on phones');
  // The bug only shows with the smooth scroll that beforeEach turns off.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('.about__photo-frame').scrollIntoViewIfNeeded();
  const counter = page.locator('.about__photo-frame .carousel__count');
  const total = Number((await counter.textContent()).split('/')[1]);
  test.skip(!(total > 2), 'Needs at least three photos');

  const next = page.getByRole('button', { name: 'Next photo' });
  for (let i = 1; i < total; i += 1) await next.click();

  await expect(counter).toHaveText(`${total} / ${total}`);
  // And it stays there once the scroll has finished.
  await page.waitForTimeout(1200);
  await expect(counter).toHaveText(`${total} / ${total}`);
});

test('closing the photo viewer leaves focus on the photo now showing', async ({ page }) => {
  const photos = page.locator('.carousel__open');
  test.skip((await photos.count()) < 2, 'Needs at least two photos');
  await photos.first().focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.photo-viewer .carousel__count')).toHaveText(/^2 \//);
  await page.keyboard.press('Escape');

  await expect(photos.nth(1)).toBeFocused();
  await expect(page.locator('.about__photo-frame .carousel__count')).toHaveText(/^2 \//);
});

test('the open menu fits a phone in landscape', async ({ page }, testInfo) => {
  test.skip(!isMobile(testInfo), 'Only phones use this layout at this height');
  await page.setViewportSize({ width: 667, height: 320 });
  await page.getByRole('button', { name: 'Open menu' }).click();

  const navBottom = await page.locator('#site-menu').evaluate((el) => el.getBoundingClientRect().bottom);
  expect(navBottom).toBeLessThanOrEqual(320);
  // The last control can be scrolled to and used.
  await page.getByRole('button', { name: /Tiếng Việt/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
});

test('Vietnamese nav links stay on one line just above the desktop breakpoint', async ({ page }, testInfo) => {
  test.skip(!isDesktop(testInfo), 'Desktop layout only');
  await page.setViewportSize({ width: 1120, height: 800 });
  await page.getByRole('button', { name: /Tiếng Việt/ }).click();

  const fit = await page.evaluate(() => {
    const lines = [...document.querySelectorAll('.site-nav__link')].map((link) => {
      const range = document.createRange();
      range.selectNodeContents(link);
      return range.getClientRects().length;
    });
    const search = document.querySelector('.section-search').getBoundingClientRect();
    const nav = document.querySelector('.site-nav').getBoundingClientRect();
    const toggle = document.querySelector('.language-toggle').getBoundingClientRect();
    return {
      wrapped: lines.filter((n) => n > 1).length,
      overlapsSearch: search.right > nav.left,
      offScreen: toggle.right > window.innerWidth,
    };
  });
  expect(fit).toEqual({ wrapped: 0, overlapsSearch: false, offScreen: false });
});

test('printing shows every section, even those not scrolled to yet', async ({ page }) => {
  await page.emulateMedia({ media: 'print', reducedMotion: 'no-preference' });
  for (const id of ['announcements', 'schedule']) {
    await expect(page.locator(`#${id}`)).toHaveCSS('opacity', '1');
  }
  await expect(page.locator('.site-header')).toBeHidden();
  await expect(page.locator('.hero')).toBeHidden();
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
