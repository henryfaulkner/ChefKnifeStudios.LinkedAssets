import {test,expect} from '@playwright/test';
import {basic,interceptGeotab} from './fixtures.js';
async function login(page){await page.goto('/');await page.getByLabel('Geotab username or email').fill('fixture');await page.getByLabel('Password',{exact:true}).fill('synthetic-only');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByText('3 / 3 links')).toBeVisible();}
test('sign-out during refresh cannot restore the previous account snapshot',async({page})=>{
  let slow=false;
  await interceptGeotab(page,basic,async body=>{if(slow&&body.params?.typeName==='AssetLink'){await new Promise(r=>setTimeout(r,500));return{result:basic.AssetLink};}});
  await login(page);slow=true;await page.getByRole('button',{name:'Refresh',exact:true}).click();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.waitForTimeout(600);
  await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
  await expect(page.locator('.graph-host')).toHaveCount(0);
});
test('storage failures retain a usable in-memory session and theme',async({page})=>{
  await page.addInitScript(()=>{Storage.prototype.getItem=function(){throw new Error('test storage unavailable');};Storage.prototype.setItem=function(){throw new Error('test storage unavailable');};Storage.prototype.removeItem=function(){throw new Error('test storage unavailable');};});
  await interceptGeotab(page);await login(page);
  await page.getByRole('button',{name:'Dark theme',exact:true}).click();await expect(page.locator('.mj-dark')).toBeVisible();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
});
test('denied member status is distinct from a missing report and map configuration failure',async({page})=>{
  await interceptGeotab(page,basic,body=>body.params?.typeName==='DeviceStatusInfo'?{error:{name:'SecurityException'}}:undefined);
  await login(page);await page.getByText('Browse links',{exact:true}).click();await page.getByRole('button',{name:/^Automatic:/}).click();
  await expect(page.locator('.member-reports li')).toHaveCount(3);
  await expect(page.locator('.member-reports')).toContainText('Access denied');
  await expect(page.locator('.member-reports')).not.toContainText('Report time unavailable');
  await expect(page.locator('.map-message')).toContainText('Map styles are not configured');
});
test('successful empty source reads show a confirmed empty state',async({page})=>{
  await interceptGeotab(page,Object.fromEntries(Object.keys(basic).map(type=>[type,[]])));
  await page.goto('/');await page.getByLabel('Geotab username or email').fill('fixture');await page.getByLabel('Password',{exact:true}).fill('synthetic-only');await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('heading',{name:'No active links',exact:true})).toBeVisible();
  await expect(page.getByText('Partial or unverified source coverage',{exact:true})).toHaveCount(0);
});
