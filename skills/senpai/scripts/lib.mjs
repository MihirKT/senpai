// Shared page settling + screenshot logic so capture and verify shoot pages identically.
export const parseArgs = argv => Object.fromEntries(argv.map(a => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.length ? v.join('=') : '1'];
}));

export const viewportsFrom = s => (s || '1440x900,390x844').split(',').map(v => {
  const [width, height] = v.split('x').map(Number);
  return { width, height };
});

export const slugFor = url => {
  const p = new URL(url).pathname.replace(/\/+$/, '');
  return p ? p.slice(1).replace(/[^\w.-]+/g, '_') : 'index';
};

// Scroll whole page so lazy images load and scroll-reveal animations reach their end state.
export async function settle(page, { steps = 12, pause = 250, onStep } = {}) {
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = page.viewportSize().height;
  const n = Math.min(steps * 4, Math.max(steps, Math.ceil(h / vh)));
  for (let i = 1; i <= n; i++) {
    await page.evaluate(y => window.scrollTo(0, y), (h * i) / n);
    await page.waitForTimeout(pause);
    if (onStep) await onStep(i, n);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
}

export async function shoot(page, file) {
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled', caret: 'hide' });
}
