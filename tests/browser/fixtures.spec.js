import {test, expect} from '@playwright/test';
import {basic, scaleFixture, interceptGeotab} from './fixtures.js';
test('test fixtures have deterministic identities, counts and wire envelopes', async ({page}) => {
  expect(basic.AssetLink).toHaveLength(2);
  expect(basic.AssetLinkDetails).toHaveLength(7);
  expect(basic.DeviceLink[0].id).toBe(basic.AssetLink[0].id);
  const scale = scaleFixture();
  expect(scale.AssetLink).toHaveLength(500);
  expect(scale.AssetLinkDetails).toHaveLength(2000);
  expect(scale.AssetLink.reduce((sum,link)=>{const n=scale.AssetLinkDetails.filter(p=>p.assetLinkId===link.id).length;return sum+n*(n-1)/2;},0)).toBe(5995);
  await interceptGeotab(page);
  await page.goto('/');
  const body = await page.evaluate(async () => {
    const response = await fetch('https://my.geotab.com/apiv1', {method:'POST',body:JSON.stringify({method:'Get', params:{typeName:'Device'}})});
    return response.json();
  });
  expect(body.result).toHaveLength(7);
});
