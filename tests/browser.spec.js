import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

test('WebGL arena renders and supports play, steering, cameras, pause and restart', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.clock.install();
  await page.goto('/');
  await expect(page.locator('#overlay-title')).toHaveText('Mitten im Spiel.');
  expect(await page.locator('#game').evaluate(canvas => !!canvas.getContext('webgl2'))).toBe(true);
  await page.screenshot({ path: 'test-results/arena-preview.png' });
  await page.getByRole('button', { name: 'Spiel starten' }).click();
  await expect(page.locator('#status')).toHaveText('IM FLOW');
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.id)).toBe('game');
  await page.clock.runFor(1800);
  await expect(page.locator('#score')).toHaveText('010');
  await expect(page.locator('#length')).toHaveText('8 Meter');
  await expect(page.locator('#eaten')).toHaveText('1 Energie');
  await expect(page.locator('#combo-value')).toHaveText('×1');
  await expect(page.locator('#pickup-feedback')).toContainText('+10');
  await page.screenshot({ path: 'test-results/ego.png' });
  await page.keyboard.press('c');
  await expect(page.locator('#camera')).toHaveText('VERFOLGER ↗');
  await page.keyboard.down('d'); await page.clock.runFor(450); await page.keyboard.up('d');
  await page.mouse.move(800, 460);
  await page.screenshot({ path: 'test-results/chase.png' });
  await page.keyboard.press('Space');
  await expect(page.locator('#status')).toHaveText('KURZ DURCHATMEN');
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  const pausedScore = await page.locator('#score').textContent();
  const pausedCombo = await page.locator('#combo-clock').textContent();
  const pausedGold = await page.locator('#gold-status').textContent();
  await page.clock.runFor(3000);
  await expect(page.locator('#score')).toHaveText(pausedScore);
  await expect(page.locator('#combo-clock')).toHaveText(pausedCombo);
  await expect(page.locator('#gold-status')).toHaveText(pausedGold);
  await page.getByRole('button', { name: 'Weiterspielen' }).click();
  await expect(page.locator('#status')).toHaveText('IM FLOW');
  await page.clock.runFor(15000);
  await expect(page.locator('#status')).toHaveText('LEBEN VERLOREN');
  await expect(page.locator('#lives-hud')).toHaveAttribute('aria-label', '2 von 3 Leben');
  await page.getByRole('button', { name: 'Level 1 wiederholen' }).click();
  await expect(page.locator('#score')).toHaveText('000');
  await expect(page.locator('#best')).toHaveText('000');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('#best')).toHaveText('000');
  expect(errors).toEqual([]);
});

test('mobile layout exposes touch controls and switching camera', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3000');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Spiel starten' }).tap();
  await expect(page.locator('#status')).toHaveText('IM FLOW');
  await expect(page.getByRole('button', { name: 'Links lenken' })).toBeVisible();
  const arena = await page.locator('.arena').boundingBox();
  const control = await page.getByRole('button', { name: 'Links lenken' }).boundingBox();
  expect(control.y + control.height).toBeLessThan(arena.y + arena.height);
  await page.locator('#camera').tap();
  await expect(page.locator('#camera')).toHaveText('VERFOLGER ↗');
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  await context.close();
});

test('missing WebGL produces an actionable message', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.startsWith('webgl') ? null : original.call(this, type, ...args);
    };
  });
  await page.goto('/');
  await expect(page.locator('#overlay-title')).toHaveText('Die 3D-Arena braucht WebGL.');
  await expect(page.locator('#start')).toBeDisabled();
});

test('bundled game starts directly from the local HTML file', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  await expect(page.locator('#overlay-title')).toHaveText('Mitten im Spiel.');
  await page.getByRole('button', { name: 'Spiel starten' }).click();
  await expect(page.locator('#status')).toHaveText('IM FLOW');
  expect(errors).toEqual([]);
});

// Expose the simulation only in an in-memory test bundle; the shipped game has no test controls.
test('campaign unlocks portals, advances by click and keyboard, and restarts after victory', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const source = (await readFile('src/game.js', 'utf8')).replace('const game = new SnakeSimulation();', 'const game = window.testGame = new SnakeSimulation(() => .5);');
  const bundle = await build({ stdin: { contents: source, resolveDir: path.resolve('src'), loader: 'js' }, bundle: true, format: 'iife', write: false });
  await page.route('**/game.js', route => route.fulfill({ contentType: 'text/javascript', body: bundle.outputFiles[0].text }));
  await page.clock.install(); await page.goto('/');
  await page.getByRole('button', { name: 'Spiel starten' }).click();
  let previousScore = 0;
  for (let level = 1; level <= 3; level++) {
    await expect(page.locator('#level-hud')).toContainText(`L${level}`);
    await expect(page.locator('#level-progress')).toContainText('0 / 10');
    await expect(page.locator('#score')).toHaveText(String(previousScore).padStart(3, '0'));
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => { window.testGame.foods[0] = { ...window.testGame.head }; });
      await page.clock.runFor(60);
    }
    await expect(page.locator('#level-progress')).toContainText('PORTAL OFFEN');
    await expect(page.locator('#food-direction')).toContainText('PORTAL');
    await expect(page.locator('#status')).toHaveText('ZUM PORTAL');
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: 'Weiterspielen' }).click();
    await expect(page.locator('#status')).toHaveText('ZUM PORTAL');
    await page.screenshot({ path: `test-results/level-${level}-portal.png` });
    await page.evaluate(() => { window.testGame.head = { ...window.testGame.level.portal }; });
    await page.clock.runFor(60);
    await expect(page.locator('#overlay')).toBeVisible();
    previousScore = Number(await page.locator('#score').textContent());
    await expect(page.locator('#overlay-copy')).toContainText('Unfallfrei: +100 Bonuspunkte!');
    await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
    if (level < 3) {
      await expect(page.locator('#status')).toHaveText('LEVEL GESCHAFFT');
      await expect(page.locator('#overlay-copy')).toContainText('Beste Combo ×5');
      const progress = await page.evaluate(() => JSON.stringify(window.testGame));
      await page.clock.runFor(3000);
      expect(await page.evaluate(() => JSON.stringify(window.testGame))).toBe(progress);
      if (level === 2) await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: `test-results/level-${level}-complete.png` });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.getByRole('button', { name: `Level ${level + 1} starten` })).toBeInViewport();
      if (level === 1) await page.getByRole('button', { name: 'Level 2 starten' }).click();
      else await page.keyboard.press('Space');
      await expect(page.locator('#length')).toHaveText(`${6 + level} Meter`);
      await expect(page.locator('#combo-value')).toHaveText('×1');
      await page.keyboard.press('Space');
      await expect(page.locator('#status')).toHaveText('KURZ DURCHATMEN');
      await page.getByRole('button', { name: 'Weiterspielen' }).click();
      await expect(page.locator('#level-hud')).toContainText(`L${level + 1}`);
    }
  }
  await expect(page.locator('#status')).toHaveText('ALLE LEVEL GEMEISTERT');
  await expect(page.locator('#overlay-title')).toHaveText('Drei Arenen. Ein Champion.');
  await page.getByRole('button', { name: 'Nochmal spielen' }).click();
  await expect(page.locator('#level-hud')).toContainText('L1');
  await expect(page.locator('#score')).toHaveText('000');
  await expect(page.locator('#best')).toHaveText(String(previousScore));
  expect(errors).toEqual([]);
});

test('lives preserve later levels, revoke attempt points and end after the third collision', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const source = (await readFile('src/game.js', 'utf8')).replace('const game = new SnakeSimulation();', 'const game = window.testGame = new SnakeSimulation(() => .5);');
  const bundle = await build({ stdin: { contents: source, resolveDir: path.resolve('src'), loader: 'js' }, bundle: true, format: 'iife', write: false });
  await page.route('**/game.js', route => route.fulfill({ contentType: 'text/javascript', body: bundle.outputFiles[0].text }));
  await page.clock.install(); await page.goto('/');
  await page.getByRole('button', { name: 'Spiel starten' }).click();
  async function collectMany(count) {
    for (let i = 0; i < count; i++) {
      await page.evaluate(() => { window.testGame.foods[0] = { ...window.testGame.head }; });
      await page.clock.runFor(60);
    }
  }
  async function exitLevel() {
    await page.evaluate(() => { window.testGame.head = { ...window.testGame.level.portal }; });
    await page.clock.runFor(60);
  }
  async function hitWall() {
    await page.evaluate(() => { window.testGame.head = { x: 17.49, z: 0 }; window.testGame.yaw = Math.PI / 2; });
    await page.clock.runFor(60);
    await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  }
  await collectMany(10); await exitLevel();
  await expect(page.locator('#score')).toHaveText('500');
  await page.getByRole('button', { name: 'Level 2 starten' }).click();
  await collectMany(2); await expect(page.locator('#score')).toHaveText('530');
  await hitWall();
  await expect(page.locator('#status')).toHaveText('LEBEN VERLOREN');
  await expect(page.locator('#lives-hud')).toHaveAttribute('aria-label', '2 von 3 Leben');
  await expect(page.locator('#score')).toHaveText('500');
  await expect(page.locator('#best')).toHaveText('500');
  await expect(page.locator('#overlay-copy')).toContainText('30 Versuchspunkte verworfen');
  await page.clock.runFor(3000); await expect(page.locator('#lives-value')).toHaveText('2 / 3');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/retry-mobile.png' });
  await expect(page.getByRole('button', { name: 'Level 2 wiederholen' })).toBeInViewport();
  await page.getByRole('button', { name: 'Level 2 wiederholen' }).click();
  await expect(page.locator('#level-hud')).toContainText('L2');
  await expect(page.locator('#level-progress')).toContainText('0 / 10');
  await expect(page.locator('#length')).toHaveText('7 Meter');
  await expect(page.locator('#clean-bonus')).toContainText('verloren');
  await collectMany(10); await exitLevel();
  await expect(page.locator('#score')).toHaveText('900');
  await expect(page.locator('#overlay-copy')).toContainText('Kein Unfallfrei-Bonus');
  await page.getByRole('button', { name: 'Level 3 starten' }).click();
  await expect(page.locator('#clean-bonus')).toContainText('+100');
  await hitWall(); await expect(page.locator('#lives-value')).toHaveText('1 / 3');
  await page.keyboard.press('Space');
  await expect(page.locator('#level-hud')).toContainText('L3');
  await hitWall();
  await expect(page.locator('#status')).toHaveText('RUN BEENDET');
  await expect(page.locator('#lives-value')).toHaveText('0 / 3');
  await expect(page.locator('#overlay-copy')).toContainText('Keine Leben mehr');
  await expect(page.locator('#score')).toHaveText('900');
  await page.getByRole('button', { name: 'Nochmal spielen' }).click();
  await expect(page.locator('#level-hud')).toContainText('L1');
  await expect(page.locator('#lives-value')).toHaveText('3 / 3');
  await expect(page.locator('#score')).toHaveText('000');
  await expect(page.locator('#best')).toHaveText('900');
  expect(errors).toEqual([]);
});

test('tempo presets double movement speed and acceleration and braking apply to each', async ({ page }) => {
  const source = (await readFile('src/game.js', 'utf8')).replace('const game = new SnakeSimulation();', 'const game = window.testGame = new SnakeSimulation(() => .5);');
  const bundle = await build({ stdin: { contents: source, resolveDir: path.resolve('src'), loader: 'js' }, bundle: true, format: 'iife', write: false });
  await page.route('**/game.js', route => route.fulfill({ contentType: 'text/javascript', body: bundle.outputFiles[0].text }));
  await page.clock.install();
  for (const [preset, expected] of [['chill', 2.4], ['flow', 4.8], ['rush', 9.6]]) {
    await page.goto('/');
    await page.locator(`[data-speed="${preset}"]`).click();
    await expect(page.locator(`[data-speed="${preset}"]`)).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Spiel starten' }).click();
    for (const [key, multiplier] of [[null, 1], ['w', 1.4], ['s', .58]]) {
      await page.evaluate(() => window.testGame.reset());
      if (key) await page.keyboard.down(key);
      const before = await page.evaluate(() => window.testGame.travel);
      await page.clock.runFor(1000);
      const moved = await page.evaluate(() => window.testGame.travel);
      expect(Math.abs(moved - before - expected * multiplier)).toBeLessThan(expected * multiplier * .04);
      expect(await page.evaluate(() => window.testGame.alive)).toBe(true);
      if (key) await page.keyboard.up(key);
    }
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: 'Weiterspielen' }).click();
    await expect(page.locator(`[data-speed="${preset}"]`)).toHaveAttribute('aria-pressed', 'true');
  }
});

test('sound starts with gameplay, generates a signal, and remembers mute across reloads', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    window.audioProbe = { contexts: [], frequencies: [], peak: 0 };
    window.AudioContext = class extends Original {
      constructor(...args) {
        super(...args); window.audioProbe.contexts.push(this);
        this.probe = this.createAnalyser(); this.probe.fftSize = 256;
        const data = new Float32Array(256);
        const sample = () => {
          this.probe.getFloatTimeDomainData(data);
          for (const value of data) window.audioProbe.peak = Math.max(window.audioProbe.peak, Math.abs(value));
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }
      createGain() {
        const gain = super.createGain(); gain.connect(this.probe); return gain;
      }
      createOscillator() {
        const oscillator = super.createOscillator(), start = oscillator.start.bind(oscillator);
        oscillator.start = (...args) => { window.audioProbe.frequencies.push(oscillator.frequency.value); start(...args); };
        return oscillator;
      }
    };
  });
  await page.goto('/');
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.audioProbe.contexts.length)).toBe(0);
  await page.getByRole('button', { name: 'Spiel starten' }).click();
  await expect.poll(() => page.evaluate(() => window.audioProbe.peak)).toBeGreaterThan(.001);
  await expect.poll(() => page.evaluate(() => window.audioProbe.frequencies.includes(650))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.audioProbe.contexts[0].state)).toBe('running');
  await page.keyboard.press('m');
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
  const tones = await page.evaluate(() => window.audioProbe.frequencies.length);
  await expect(page.locator('#status')).toHaveText('LEBEN VERLOREN', { timeout: 10000 });
  expect(await page.evaluate(() => window.audioProbe.frequencies.length)).toBe(tones);
  await page.reload();
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Spiel starten' }).click();
  expect(await page.evaluate(() => window.audioProbe.contexts.length)).toBe(0);
  await page.keyboard.press('m');
  await expect.poll(() => page.evaluate(() => window.audioProbe.frequencies.includes(660))).toBe(true);
  await page.keyboard.press('Space');
  await page.evaluate(() => window.audioProbe.contexts[0].suspend());
  await page.getByRole('button', { name: 'Weiterspielen' }).click();
  await expect.poll(() => page.evaluate(() => window.audioProbe.contexts[0].state)).toBe('running');
  await page.keyboard.press('Escape'); await page.reload();
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});
test('audio activation failures can be retried without breaking gameplay', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const Original = window.AudioContext; window.failAudio = true;
    window.AudioContext = class extends Original {
      get state() { return window.failAudio ? 'suspended' : super.state; }
      resume() { return window.failAudio ? Promise.reject(new Error('Audio blocked')) : super.resume(); }
    };
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Spiel starten' }).click();
  await expect(page.locator('#sound')).toHaveAccessibleName('Ton erneut aktivieren (M)');
  await expect(page.locator('#status')).toHaveText('IM FLOW');
  await page.evaluate(() => { window.failAudio = false; });
  await page.keyboard.press('m');
  await expect(page.locator('#sound')).toHaveAccessibleName('Ton ausschalten (M)');
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('start menu can launch a fresh run directly in level three and remembers the choice', async ({ page }) => {
  await page.goto('/');
  const shortcut = page.locator('#direct-level3');
  await expect(shortcut).not.toBeChecked();
  await page.getByText('Direkt in Level 3 starten').click();
  await page.getByRole('button', { name: 'Spiel starten' }).click();
  await expect(page.locator('#level-hud')).toContainText('L3');
  await expect(page.locator('#level-name')).toContainText('3 / 3');
  await expect(page.locator('#score')).toHaveText('000');
  await expect(page.locator('#lives-value')).toHaveText('3 / 3');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('#direct-level3')).toBeChecked();
  await page.getByRole('button', { name: 'Spiel starten' }).click();
  await expect(page.locator('#level-hud')).toContainText('L3');
  await page.keyboard.press('m');
});
