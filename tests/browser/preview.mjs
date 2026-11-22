import {chromium} from '@playwright/test';
import {interceptGeotab} from './fixtures.js';

const appUrl = new URL(process.env.LA_PREVIEW_URL ?? 'http://localhost:5180');
if (!['localhost', '127.0.0.1', '[::1]'].includes(appUrl.hostname)) {
  throw new Error('The mock preview must target a local app. Set LA_PREVIEW_URL to a localhost URL.');
}

const browser = await chromium.launch({headless:false});
const closed = new Promise(resolve => browser.once('disconnected', resolve));
process.once('SIGINT', () => browser.close());
process.once('SIGTERM', () => browser.close());

try {
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  // Block other Geotab traffic; the fixture handler registered next handles API calls locally.
  await page.route('https://**.geotab.com/**', route => route.abort());
  await interceptGeotab(page);
  await page.route('**/appsettings.json', route => route.fulfill({json:{Map:{
    LightStyleUrl:'https://tiles.openfreemap.org/styles/liberty',
    DarkStyleUrl:'https://tiles.openfreemap.org/styles/dark'
  }}}));
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const notice = document.createElement('div');
      notice.setAttribute('role', 'status');
      notice.textContent = 'MOCK DATA · Local preview · No Geotab connection · Live street map';
      Object.assign(notice.style, {
        position:'fixed', top:'0', left:'0', right:'0', zIndex:'1000',
        background:'#fff3cd', color:'#422006', textAlign:'center',
        font:'12px/16px sans-serif', pointerEvents:'none'
      });
      document.body.append(notice);
    });
  });
  await page.goto(appUrl.href);
  await page.getByLabel('Geotab username or email').fill('fixture');
  await page.getByLabel('Password', {exact:true}).fill('synthetic-only');
  await page.getByRole('button', {name:'Sign in',exact:true}).click();
  await page.getByText('3 / 3 links').waitFor({timeout:45000});
  await page.waitForFunction(() =>
    document.querySelector('.graph-host')?._cyreg?.cy?.nodes(':childless').length === 7);
  await page.evaluate(() => { document.title = 'Linked Assets — MOCK DATA'; });
  console.log(`Mock preview ready at ${appUrl.origin}: 3 links, 7 visual nodes.`);
  console.log('Explore the graphs, filters and details. No real credentials are needed.');
  console.log('After Sign out, use any nonempty username/password to reenter this mock preview.');
  console.log('Close the preview browser or press Ctrl+C to stop. Other browser windows use real sign-in.');
  await closed;
} catch (error) {
  console.error(`Mock preview failed: ${error.message}`);
  console.error('Start the app first using the Run locally command in README.md.');
  process.exitCode = 1;
} finally {
  await browser.close();
}
