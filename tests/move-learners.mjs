import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser = await chromium.launch(process.env.CHROMIUM ? {executablePath: process.env.CHROMIUM} : {});
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({viewport: {width, height: 850}, locale: 'ja-JP'});
    await page.route(/^https?:/, route => route.abort());
    await page.goto(new URL('../dist/index.html#/move/197', import.meta.url).href);
    const more = page.locator('.move-learners-more');
    const blaziken = more.getByText('バシャーモ', {exact: true});
    assert.equal(await page.locator('.gdoc h2').textContent(), 'みきり');
    assert.equal(await more.locator('summary').textContent(), '残り19匹を表示');
    assert.equal(await blaziken.isVisible(), false);
    await more.locator('summary').click();
    assert.equal(await more.locator('a.row').count(), 19);
    assert.equal(await blaziken.isVisible(), true);
    assert.equal(await blaziken.locator('xpath=ancestor::a').getAttribute('href'), '#/p/257');
    await page.close();
  }
  console.log('Move learners: Detect includes Blaziken at 390px and 1280px');
} finally {
  await browser.close();
}
