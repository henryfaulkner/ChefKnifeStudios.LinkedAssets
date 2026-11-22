import {test,expect} from '@playwright/test';
import {basic,interceptGeotab} from './fixtures.js';
test.use({timezoneId:'America/New_York',locale:'en-US'});
async function login(page){await page.goto('/');await page.getByLabel('Geotab username or email').fill('fixture');await page.getByLabel('Password',{exact:true}).fill('synthetic-only');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByText('3 / 3 links')).toBeVisible();}
test('DST repeated local times retain timezone and distinct UTC details',async({page})=>{
  const data=structuredClone(basic);data.DeviceStatusInfo.find(s=>s.device.id==='d1').dateTime='2026-11-01T05:30:00Z';data.DeviceStatusInfo.find(s=>s.device.id==='d5').dateTime='2026-11-01T06:30:00Z';
  await interceptGeotab(page,data);await login(page);await page.getByText('Browse links',{exact:true}).click();await page.getByRole('button',{name:/^Manual:/}).click();
  await expect(page.locator('time').filter({hasText:'EDT'})).toContainText('1:30:00 AM');
  await expect(page.locator('time').filter({hasText:'EST'})).toContainText('1:30:00 AM');
  const utc=await page.locator('time').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('title')));
  expect(utc).toContain('UTC: 2026-11-01T05:30:00.0000000+00:00');expect(utc).toContain('UTC: 2026-11-01T06:30:00.0000000+00:00');
});
test('key and every graph dot and segment share the type color in both themes',async({page})=>{
  await interceptGeotab(page);await login(page);
  for(const dark of [false,true]){
    if(dark)await page.getByRole('button',{name:'Dark theme',exact:true}).click();
    const expected=dark?['#FF8A80','#81C784','#90CAF9']:['#C62828','#2E7D32','#1565C0'];
    await expect.poll(()=>page.evaluate(()=>{
      const c=document.querySelector('.graph-host')._cyreg.cy;
      return ['Automatic','Manual','Cold Chain'].map((label,i)=>{
        const key=[...document.querySelectorAll('.key-toggle')].find(b=>b.textContent.trim()===label);
        const source=['AssetLink:same','DeviceLink:same','AssetLink:cold'][i];
        const parent=c.nodes(':parent').filter(n=>n.data('key')===source);
        return{key:key.style.getPropertyValue('--link-color'),colors:[...new Set([...parent.children(),...parent.children().connectedEdges()].map(e=>e.data('color')))]};
      });
    })).toEqual(expected.map(color=>({key:color,colors:[color]})));
  }
});
