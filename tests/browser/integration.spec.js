import {test,expect} from '@playwright/test';
import {basic,interceptGeotab,withRefreshBoundary,crossRefreshBoundary} from './fixtures.js';
async function login(page){await page.goto('/?agent=true');await page.getByLabel('Geotab username or email').fill('fixture');await page.getByLabel('Password',{exact:true}).fill('synthetic-only');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByText('3 / 3 links')).toBeVisible();}
async function openBrowse(page){await page.getByText('Browse links',{exact:true}).click();}
test('AssetLink blades show recorded addition times even when full history is unverified',async({page})=>{
  await interceptGeotab(page);await login(page);await openBrowse(page);
  for(const [type,date] of [['Automatic','2026-11-01 00:00:00Z'],['Cold Chain','2026-11-01 00:00:00Z']]) {
    await page.getByRole('button',{name:new RegExp(`^${type}:`)}).click();
    const details=page.getByRole('region',{name:`${type} link`});
    await expect(details.getByText('Latest recorded addition',{exact:true})).toBeVisible();
    await expect(details.getByText(date,{exact:true})).toBeVisible();
    await expect(details.getByText('Full history not verified',{exact:true})).toBeVisible();
  }
});
test('filters preserve hidden coordinates and clear a hidden selection without moving input focus',async({page})=>{
  const calls=await interceptGeotab(page,withRefreshBoundary());await login(page);await openBrowse(page);
  await page.getByRole('button',{name:/^Automatic:/}).click();
  const positions=await page.evaluate(()=>document.querySelector('.graph-host')._cyreg.cy.nodes(':childless').map(n=>({id:n.id(),p:{...n.position()}})));
  await page.getByLabel('Search devices').fill('no such device');
  await expect(page.getByRole('region',{name:'Automatic link'})).toHaveCount(0);
  await expect(page.getByLabel('Search devices')).toBeFocused();
  await expect(page.getByText('No matching links',{exact:true})).toBeVisible();
  await page.getByLabel('Search devices').fill('');
  await expect.poll(()=>page.evaluate(()=>document.querySelector('.graph-host')._cyreg.cy.nodes(':childless').map(n=>({id:n.id(),p:{...n.position()}})))).toEqual(positions);
  const loads=calls.filter(c=>c.type==='AssetLink').length;
  await crossRefreshBoundary(page);
  await expect.poll(()=>calls.filter(c=>c.type==='AssetLink').length).toBe(loads+1);
  await expect(page.getByText(/Reading Geotab links/)).toHaveCount(0);
  await expect(page.locator('.details-blade')).toHaveCount(0);
});
test('slow obsolete selection cannot replace the current member reports',async({page})=>{
  await interceptGeotab(page,basic,async body=>{
    if(body.params?.typeName==='DeviceStatusInfo'&&body.params.search.deviceSearch.id==='d3'){
      await new Promise(resolve=>setTimeout(resolve,600));return{result:[{device:{id:'d3'},latitude:20,longitude:30,dateTime:'2026-11-21T10:00:00Z'}]};
    }
  });
  await login(page);await openBrowse(page);
  await page.getByRole('button',{name:/^Automatic:/}).click();
  await page.getByRole('button',{name:/^Cold Chain:/}).click();
  await expect(page.getByRole('region',{name:'Cold Chain link'})).toBeVisible();
  await expect(page.locator('.member-reports')).toContainText('Cold Box Delta');
  await page.waitForTimeout(700);
  await expect(page.locator('.member-reports')).not.toContainText('Sensor Charlie');
  await expect(page.locator('.member-reports li')).toHaveCount(2);
});
test('pointer selection updates the same overlay and sorting preserves each graph shape',async({page})=>{
  await interceptGeotab(page);await login(page);
  const geometry=()=>page.evaluate(()=>{const cy=document.querySelector('.graph-host')._cyreg.cy;return cy.nodes(':parent').map(p=>({key:p.data('key'),nodes:p.children().map(n=>({...n.position()})),point:p.children()[0].renderedPosition()}));});
  const initial=await geometry();
  for(const graph of initial.slice(0,2)){
    await page.mouse.click(Math.round(graph.point.x),Math.round(graph.point.y));
    await expect(page.locator('.details-blade')).toBeVisible();
    await expect(page.locator('.metadata')).toContainText(graph.key.split(':')[1]);
  }
  await page.getByRole('button',{name:'Close details'}).click();
  await page.getByRole('button',{name:'Link Type',exact:true}).click();
  const arranged=await geometry();
  for(const graph of arranged){const prior=initial.find(g=>g.key===graph.key);for(let i=1;i<graph.nodes.length;i++){
    expect(graph.nodes[i].x-graph.nodes[0].x).toBeCloseTo(prior.nodes[i].x-prior.nodes[0].x,4);
    expect(graph.nodes[i].y-graph.nodes[0].y).toBeCloseTo(prior.nodes[i].y-prior.nodes[0].y,4);
  }}
});
test('blade stays an overlay on narrow screens and Escape returns keyboard focus',async({page})=>{
  await page.setViewportSize({width:390,height:844});await interceptGeotab(page);await login(page);await openBrowse(page);
  const before=await page.locator('.graph-host').boundingBox();
  await page.getByRole('button',{name:/^Manual:/}).click();
  await expect(page.getByRole('region',{name:'Manual link'})).toBeVisible();
  expect(await page.locator('.graph-host').boundingBox()).toEqual(before);
  await page.getByText('Browse links',{exact:true}).click();
  await page.getByText('Browse links',{exact:true}).click();
  await page.getByRole('button',{name:/^Cold Chain:/}).click();
  await expect(page.getByRole('region',{name:'Cold Chain link'})).toBeVisible();
  await page.getByRole('button',{name:'Close details'}).focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('.details-blade')).toHaveCount(0);
  await expect(page.getByRole('button',{name:/^Cold Chain:/})).toBeFocused();
});
test('local map styles and reports render in the actual blade in both themes',async({page})=>{
  await interceptGeotab(page);
  await page.route('**/appsettings.json',r=>r.fulfill({json:{Map:{LightStyleUrl:'/map-light.json',DarkStyleUrl:'/map-dark.json'}}}));
  await page.route('**/map-*.json',r=>r.fulfill({json:{version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':r.request().url().includes('dark')?'#263238':'#DDD'}}]}}));
  await login(page);await openBrowse(page);
  await page.evaluate(()=>{const Original=maplibregl.Map;maplibregl.Map=class extends Original{constructor(options){super(options);window.currentBladeMap=this;}};});
  for(const dark of [false,true]) {
    if(dark)await page.getByRole('button',{name:'Dark theme',exact:true}).click();
    await page.getByRole('button',{name:/^Manual:/}).click();
    await expect.poll(()=>page.evaluate(()=>window.currentBladeMap?.getLayer('background')?currentBladeMap.getPaintProperty('background','background-color'):null)).toBe(dark?'#263238':'#DDD');
    await expect.poll(()=>page.evaluate(()=>currentBladeMap.getLayer('member-pins')?new Set(currentBladeMap.queryRenderedFeatures({layers:['member-pins']}).map(f=>f.properties.deviceId)).size:0)).toBe(2);
    await expect(page.locator('.maplibregl-marker')).toHaveCount(2);
    await expect(page.locator('.member-reports li')).toHaveCount(2);
    await expect(page.locator('time').first()).toHaveAttribute('title',/^UTC: /);
    await page.getByRole('button',{name:'Close details'}).click();
  }
});
