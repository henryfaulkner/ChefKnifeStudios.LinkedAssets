import {test,expect} from '@playwright/test';
import {basic,interceptGeotab} from './fixtures.js';
test('a known activity boundary refreshes membership and keeps moved nodes in place',async({page})=>{
  const data=structuredClone(basic);
  data.AssetLinkDetails.find(p=>p.assetLinkId==='same'&&p.device.id==='d3').activeFrom='2026-11-21T12:00:01Z';
  const calls=await interceptGeotab(page,data);
  await page.goto('/');await page.getByLabel('Geotab username or email').fill('fixture');await page.getByLabel('Password',{exact:true}).fill('synthetic-only');await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.querySelector('.graph-host')?._cyreg?.cy?.nodes(':childless').length)).toBe(6);
  const midpoint=await page.evaluate(()=>{const c=document.querySelector('.graph-host')._cyreg.cy,p=c.nodes(':parent').filter(n=>n.data('key')==='AssetLink:same'),children=p.children();const a=children[0].renderedPosition(),b=children[1].renderedPosition();return{x:Math.round((a.x+b.x)/2),y:Math.round((a.y+b.y)/2)};});
  await page.mouse.move(midpoint.x,midpoint.y);await page.mouse.down();await page.mouse.move(midpoint.x+350,midpoint.y+100,{steps:10});await page.mouse.up();
  const positions=await page.evaluate(()=>{const c=document.querySelector('.graph-host')._cyreg.cy;return c.nodes(':parent').filter(n=>n.data('key')==='AssetLink:same').children().map(n=>({id:n.data('deviceId'),x:n.position('x'),y:n.position('y')}));});
  await page.clock.setFixedTime(new Date('2026-11-21T12:00:02Z'));
  await expect.poll(()=>calls.filter(c=>c.type==='AssetLink').length).toBe(2);
  await expect.poll(()=>page.evaluate(()=>document.querySelector('.graph-host')._cyreg.cy.nodes(':childless').length)).toBe(7);
  const after=await page.evaluate(()=>{const c=document.querySelector('.graph-host')._cyreg.cy;return c.nodes(':parent').filter(n=>n.data('key')==='AssetLink:same').children().map(n=>({id:n.data('deviceId'),x:n.position('x'),y:n.position('y')}));});
  for(const prior of positions)expect(after.find(p=>p.id===prior.id)).toEqual(prior);
  expect(after.find(p=>p.id==='d3').x).toBeGreaterThan(300);
});
