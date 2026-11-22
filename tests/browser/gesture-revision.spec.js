import {test,expect} from '@playwright/test';
import {interceptGeotab} from './fixtures.js';
test('pointer cancellation restores pan and arranging during drag rejects later deltas',async({page})=>{
  await interceptGeotab(page);await page.goto('/');await page.getByLabel('Geotab username or email').fill('fixture');await page.getByLabel('Password',{exact:true}).fill('synthetic-only');await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.querySelector('.graph-host')?._cyreg?.cy?.nodes(':childless').length)).toBe(7);
  const point=await page.evaluate(()=>document.querySelector('.graph-host')._cyreg.cy.nodes(':childless')[0].renderedPosition());
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+20,point.y+20,{steps:5});
  await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointercancel')));await page.mouse.up();
  expect(await page.evaluate(()=>document.querySelector('.graph-host')._cyreg.cy.userPanningEnabled())).toBe(true);
  const current=await page.evaluate(()=>document.querySelector('.graph-host')._cyreg.cy.nodes(':childless')[0].renderedPosition());
  await page.mouse.move(current.x,current.y);await page.mouse.down();await page.mouse.move(current.x+20,current.y+20,{steps:5});
  // Click through the real control while a pointer gesture is pending.
  await page.getByRole('button',{name:'Link Type',exact:true}).dispatchEvent('click');
  await page.waitForTimeout(150);
  const arranged=await page.evaluate(()=>document.querySelector('.graph-host')._cyreg.cy.nodes(':childless').map(n=>({...n.position()})));
  await page.mouse.move(current.x+60,current.y+60,{steps:5});await page.mouse.up();
  expect(await page.evaluate(()=>document.querySelector('.graph-host')._cyreg.cy.nodes(':childless').map(n=>({...n.position()})))).toEqual(arranged);
});
