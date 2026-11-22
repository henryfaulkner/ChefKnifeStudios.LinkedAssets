import {test,expect} from '@playwright/test';
import {basic,interceptGeotab} from './fixtures.js';
test('initial measured layout is repeatable and keeps long labels in separate graph bounds',async({page})=>{
  const data=structuredClone(basic);data.Device.find(d=>d.id==='d2').name='A long source device label that remains visible in every independent link graph';
  await interceptGeotab(page,data);await page.goto('/');
  await page.getByLabel('Geotab username or email').fill('fixture');await page.getByLabel('Password',{exact:true}).fill('synthetic-only');await page.getByRole('button',{name:'Sign in',exact:true}).click();
  const geometry=async()=>{
    await expect.poll(()=>page.evaluate(()=>document.querySelector('.graph-host')?._cyreg?.cy?.nodes(':childless').length)).toBe(7);
    return page.evaluate(()=>{const cy=document.querySelector('.graph-host')._cyreg.cy;return{bounds:cy.nodes(':parent').map(n=>n.boundingBox({includeLabels:true})),positions:cy.nodes(':childless').map(n=>({id:n.id(),x:n.position('x'),y:n.position('y')}))};});
  };
  const before=await geometry();
  for(let i=0;i<before.bounds.length;i++)for(let j=i+1;j<before.bounds.length;j++){
    const a=before.bounds[i],b=before.bounds[j];expect(a.x2<b.x1||b.x2<a.x1||a.y2<b.y1||b.y2<a.y1).toBe(true);
  }
  await page.reload();const after=await geometry();expect(after.positions).toEqual(before.positions);
});
