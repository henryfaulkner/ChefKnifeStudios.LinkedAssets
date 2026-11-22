import {test,expect} from '@playwright/test';
import {interceptGeotab} from './fixtures.js';
test('Space activates Browse links and a chosen member can move independently',async({page})=>{
  await interceptGeotab(page);await page.goto('/?agent=true');await page.getByLabel('Geotab username or email').fill('fixture');await page.getByLabel('Password',{exact:true}).fill('synthetic-only');await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByText('Browse links',{exact:true}).focus();await page.keyboard.press('Space');
  await page.getByRole('button',{name:/^Manual:/}).click();await page.getByLabel('Move with arrow keys').selectOption('d1');
  const positions=()=>page.evaluate(()=>{const p=document.querySelector('.graph-host')._cyreg.cy.nodes(':parent').filter(n=>n.data('key')==='DeviceLink:same');return p.children().map(n=>({id:n.data('deviceId'),x:n.position('x'),y:n.position('y')}));});
  const before=await positions();await page.getByRole('button',{name:'Move right',exact:true}).click();
  await expect.poll(positions).toEqual(before.map(p=>p.id==='d1'?{...p,x:p.x+10}:p));
});
