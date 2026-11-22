import {test,expect} from '@playwright/test';
import {basic,interceptGeotab} from './fixtures.js';

test('Refresh is agent-only and repeats source reads without losing the selected link',async({page})=>{
  let slow=false;
  const calls=await interceptGeotab(page,basic,async body=>{
    if(slow&&body.params?.typeName==='AssetLink'){
      await new Promise(resolve=>setTimeout(resolve,1000));
      return {result:basic.AssetLink};
    }
  });
  const refresh=page.getByRole('button',{name:'Refresh',exact:true});
  await page.goto('/');
  await page.getByLabel('Geotab username or email').fill('fixture');
  await page.getByLabel('Password',{exact:true}).fill('synthetic-only');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.querySelector('.graph-host')?._cyreg?.cy?.nodes(':childless').length)).toBe(7);
  await expect(refresh).toHaveCount(0);
  await expect(page.locator('.snapshot-status,.coverage-banner,.navigation-controls,.browse-links')).toHaveCount(0);
  await page.goto('/?agent=false');
  await expect(page.getByLabel('Search devices')).toBeVisible({timeout:15000});
  await expect(refresh).toHaveCount(0);
  await expect(page.locator('.snapshot-status,.coverage-banner,.navigation-controls,.browse-links')).toHaveCount(0);
  await page.goto('/?agent=true');
  await expect(page.getByText('3 / 3 links')).toBeVisible({timeout:15000});
  await expect(refresh).toBeVisible();
  for(const selector of ['.snapshot-status','.coverage-banner','.navigation-controls','.browse-links'])await expect(page.locator(selector)).toBeVisible();
  await page.getByRole('button',{name:'Zoom out',exact:true}).click();
  await page.getByRole('button',{name:'Fit links',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await page.getByText('Browse links',{exact:true}).click();
  await page.getByRole('button',{name:/^Manual:/}).click();
  await expect(page.getByRole('region',{name:'Manual link'})).toBeVisible();
  const reads=calls.filter(c=>c.type==='AssetLink').length;
  slow=true;
  await refresh.click();
  await expect(refresh).toBeDisabled();
  await expect.poll(()=>calls.filter(c=>c.type==='AssetLink').length).toBe(reads+1);
  await expect(refresh).toBeEnabled();
  await expect(page.getByRole('region',{name:'Manual link'})).toBeVisible();
  await expect(page.getByText('3 / 3 links')).toBeVisible();
});
