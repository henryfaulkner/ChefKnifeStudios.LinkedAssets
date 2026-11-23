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
  await expect(page.getByLabel('Search devices')).toBeVisible({timeout:15000});
  expect(calls.filter(x=>x.method==='Authenticate')).toHaveLength(1);
  const signOut=page.getByRole('button',{name:'Sign out',exact:true});
  await expect(page.getByRole('button',{name:'Refresh',exact:true})).toHaveCount(0);
  await expect(page.locator('.utility-controls')).toHaveCount(0);
  await expect(signOut).toHaveClass(/mdc-fab--mini/);
  await expect(signOut).toHaveAttribute('title','Sign out');
  await expect(signOut.locator('.material-icons')).toHaveText('exit_to_app');
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:900});
    for(const theme of ['Dark theme','Light theme']) {
      const themeFab=page.getByRole('button',{name:theme,exact:true});
      await expect(themeFab).toHaveClass(/mdc-fab--mini/);
      await themeFab.focus();
      await themeFab.press('Enter');
      const toggled=page.getByRole('button',{name:theme==='Dark theme'?'Light theme':'Dark theme',exact:true});
      await expect(toggled.locator('.material-icons')).toHaveText(theme==='Dark theme'?'dark_mode':'light_mode');
      await expect(toggled).toHaveCSS('box-shadow','none');
      const themeBounds=await toggled.boundingBox();
      const footerBounds=await page.getByRole('contentinfo').boundingBox();
      expect(themeBounds.width).toBe(40);expect(themeBounds.height).toBe(40);
      expect(themeBounds.x).toBe(width-64);expect(themeBounds.y+themeBounds.height).toBeLessThan(footerBounds.y);
      const bounds=await signOut.boundingBox();
      expect(bounds.width).toBe(40);expect(bounds.height).toBe(40);
      expect(bounds.x).toBe(width-114);expect(bounds.y+bounds.height).toBeLessThan(footerBounds.y);
      await expect(signOut).toHaveCSS('box-shadow','none');
      await expect(signOut).toHaveCSS('border-radius','50%');
      await expect(signOut).toBeInViewport();
    }
  }
  await page.goto('/?agent=true');
  await expect(page.getByLabel('Search devices')).toBeVisible({timeout:15000});
  await page.getByText('Browse links',{exact:true}).click();
  const themeFab=page.getByRole('button',{name:'Dark theme',exact:true});
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:900});
    await page.getByRole('button',{name:/^Automatic:/}).click();
    const close=page.getByRole('button',{name:'Close details'});
    await expect(close).toBeVisible();
    await expect(signOut).toHaveCount(0);
    await expect(themeFab).toHaveCount(0);
    await close.click();
    await expect(signOut).toBeVisible();
    await expect(themeFab).toBeVisible();
  }
  await signOut.focus();
  await expect(signOut).toBeFocused();
  await signOut.press('Enter');
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
