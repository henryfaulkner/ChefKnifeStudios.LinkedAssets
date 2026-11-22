import {test,expect} from '@playwright/test';
import {basic,interceptGeotab,withRefreshBoundary,crossRefreshBoundary} from './fixtures.js';
export async function signIn(page){
  await page.goto('/?agent=true');await page.getByLabel('Geotab username or email').fill('fixture');await page.getByLabel('Password',{exact:true}).fill('synthetic-only');await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByText('3 / 3 links')).toBeVisible();
}
async function browse(page,type){await page.getByText('Browse links',{exact:true}).click();await page.getByRole('button',{name:new RegExp(`^${type}:`)}).click();}

for(const filter of ['type','search']){
  test(`${filter} exclusions hide complete graphs and restore their saved layout`,async({page})=>{
    const calls=await interceptGeotab(page);await signIn(page);
    const graphState=()=>page.evaluate(()=>{
      const cy=document.querySelector('.graph-host')._cyreg.cy;
      return {
        parents:cy.nodes(':parent').filter(n=>n.visible()).length,
        nodes:cy.nodes(':childless').filter(n=>n.visible()).length,
        edges:cy.edges().filter(e=>e.visible()).length,
        positions:cy.nodes(':childless').map(n=>({id:n.id(),position:{...n.position()}}))
      };
    });
    await expect.poll(()=>graphState().then(s=>s.edges)).toBe(5);
    const initial=await graphState(),readCount=calls.length;
    if(filter==='type'){
      await page.getByRole('button',{name:'Cold Chain',exact:true}).click();
      await expect.poll(()=>graphState().then(({parents,nodes,edges})=>({parents,nodes,edges})))
        .toEqual({parents:2,nodes:5,edges:4});
      await page.getByRole('button',{name:'Automatic',exact:true}).click();
      await page.getByRole('button',{name:'Manual',exact:true}).click();
    }else{
      await page.getByLabel('Search devices').fill('Sensor');
      // One matching member keeps the complete three-member Automatic graph.
      await expect.poll(()=>graphState().then(({parents,nodes,edges})=>({parents,nodes,edges})))
        .toEqual({parents:1,nodes:3,edges:3});
      await page.getByLabel('Search devices').fill('no matching devices');
    }
    await expect.poll(()=>graphState().then(({parents,nodes,edges})=>({parents,nodes,edges})))
      .toEqual({parents:0,nodes:0,edges:0});
    if(filter==='type'){
      for(const type of ['Automatic','Manual','Cold Chain'])
        await page.getByRole('button',{name:type,exact:true}).click();
    }else await page.getByLabel('Search devices').fill('');
    await expect.poll(graphState).toEqual(initial);
    expect(calls.length).toBe(readCount);
  });
}

test('production graphs, combined filters, overlay, details, sorting and keyboard focus',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const calls=await interceptGeotab(page);await signIn(page);
  const before=await page.locator('.graph-host').boundingBox();
  await expect.poll(()=>page.evaluate(()=>document.querySelector('.graph-host')?._cyreg?.cy?.nodes(':childless').length)).toBe(7);
  expect(await page.evaluate(()=>document.querySelector('.graph-host')._cyreg.cy.edges().length)).toBe(5);
  await browse(page,'Automatic');
  await expect(page.getByRole('region',{name:'Automatic link'})).toBeVisible();
  await expect(page.locator('.member-reports li')).toHaveCount(3);
  await expect(page.getByText('Report time unavailable',{exact:true})).toBeVisible();
  await expect(page.getByText('Position unavailable',{exact:true})).toBeVisible();
  expect(await page.locator('.graph-host').boundingBox()).toEqual(before);
  await page.getByRole('button',{name:/^Cold Chain:/}).click();
  await expect(page.getByRole('region',{name:'Cold Chain link'})).toBeVisible();
  await expect(page.locator('.member-reports li')).toHaveCount(2);
  await page.getByRole('button',{name:'Close details',exact:true}).click();
  await expect(page.getByRole('button',{name:/^Cold Chain:/})).toBeFocused();
  const count=calls.length;
  await page.getByLabel('Search devices').fill(' tRaCtOr ');
  await expect(page.getByText('2 / 3 links')).toBeVisible();
  await page.getByRole('button',{name:'Automatic',exact:true}).click();
  await expect(page.getByText('1 / 3 links')).toBeVisible();
  await expect(page.getByRole('button',{name:'Automatic',exact:true})).toHaveAttribute('aria-pressed','false');
  expect(calls.length).toBe(count);
  await page.getByLabel('Search devices').fill('');
  await page.getByRole('button',{name:'Automatic',exact:true}).click();
  await page.getByRole('button',{name:'Link Type',exact:true}).click();
  await page.getByRole('button',{name:/^Manual:/}).click();
  const initial=await page.evaluate(()=>{const c=document.querySelector('.graph-host')._cyreg.cy;return c.nodes(':parent').filter(n=>n.data('key')==='DeviceLink:same').children().map(n=>({...n.position()}));});
  await page.getByRole('button',{name:/^Manual:/}).press('ArrowRight');
  await expect.poll(()=>page.evaluate(()=>{const c=document.querySelector('.graph-host')._cyreg.cy;return c.nodes(':parent').filter(n=>n.data('key')==='DeviceLink:same').children()[0].position('x');})).toBeCloseTo(initial[0].x+10,1);
  await page.getByRole('button',{name:'Close details',exact:true}).click();
  expect(errors).toEqual([]);expect(calls.every(c=>['Authenticate','Get','GetCountOf'].includes(c.method))).toBe(true);
});
test('partial source failure is explicit and failed refresh retains previous links',async({page})=>{
  let failed=false;
  await interceptGeotab(page,withRefreshBoundary(),body=>failed&&body.method!=='Authenticate'?{error:{name:'SecurityException'}}:undefined);
  await signIn(page);await browse(page,'Manual');failed=true;await crossRefreshBoundary(page);
  await expect(page.getByRole('alert')).toContainText('Both link sources failed');
  await expect(page.getByText('3 / 3 links')).toBeVisible();
});
test('expired reads return to sign-in and erase prior source state',async({page})=>{
  let expired=false;
  await interceptGeotab(page,withRefreshBoundary(),body=>expired&&body.method!=='Authenticate'?{error:{name:'InvalidUserException'}}:undefined);
  await signIn(page);expired=true;await crossRefreshBoundary(page);
  await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
  await expect(page.locator('.graph-host')).toHaveCount(0);
});
