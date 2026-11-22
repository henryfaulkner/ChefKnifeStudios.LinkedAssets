import {test, expect} from '@playwright/test';
import {interceptGeotab} from './fixtures.js';
test('minimal authentication restores within tab and sign-out clears session', async ({page})=> {
  const calls=await interceptGeotab(page);
  await page.goto('/');
  await page.getByLabel('Geotab username or email').fill('fixture');
  await page.getByLabel('Password',{exact:true}).fill('synthetic-only');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByLabel('Search devices')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Search devices')).toBeVisible();
  expect(calls.filter(x=>x.method==='Authenticate')).toHaveLength(1);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.reload();
  await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
});
test('authentication failure clears password and offers a useful database prompt', async ({page})=> {
  await interceptGeotab(page, undefined, body=>body.method==='Authenticate'?{error:{name:'InvalidUserException'}}:undefined);
  await page.goto('/');
  await page.getByLabel('Geotab username or email').fill('fixture');
  await page.getByLabel('Password',{exact:true}).fill('synthetic-only');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Enter a database');
  await expect(page.getByLabel('Password',{exact:true})).toHaveValue('');
});
