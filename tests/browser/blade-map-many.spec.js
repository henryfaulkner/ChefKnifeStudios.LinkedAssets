import {test,expect} from '@playwright/test';
import {interceptGeotab} from './fixtures.js';
test('the actual details blade fits all 25 available member pins on first creation',async({page})=>{
  const devices=Array.from({length:25},(_,i)=>({id:`d${i}`,name:`Map device ${i}`}));
  const data={Device:devices,AssetLink:[{id:'many',linkType:'Automatic',isActive:true}],
    AssetLinkDetails:devices.map((d,i)=>({id:`p${i}`,assetLinkId:'many',device:{id:d.id},activeFrom:'2026-11-01T00:00:00Z'})),DeviceLink:[],
    DeviceStatusInfo:devices.map((d,i)=>({device:{id:d.id},latitude:i-12,longitude:i-12,dateTime:'2026-11-20T12:00:00Z'}))};
  await interceptGeotab(page,data);
  await page.route('**/appsettings.json',r=>r.fulfill({json:{Map:{LightStyleUrl:'/map-light.json',DarkStyleUrl:'/map-dark.json'}}}));
  await page.route('**/map-*.json',r=>r.fulfill({json:{version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#DDD'}}]}}));
  await page.goto('/');await page.getByLabel('Geotab username or email').fill('fixture');await page.getByLabel('Password',{exact:true}).fill('synthetic-only');await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByLabel('Search devices').waitFor();
  await page.evaluate(()=>{const Original=maplibregl.Map;maplibregl.Map=class extends Original{constructor(options){super(options);window.bladeMap=this;}};});
  await page.getByText('Browse links',{exact:true}).click();await page.getByRole('button',{name:/^Automatic:/}).click();
  await expect(page.locator('.member-reports li')).toHaveCount(25);
  await expect.poll(()=>page.locator('.maplibregl-marker').count()).toBe(25);
  await expect.poll(()=>page.evaluate(()=>bladeMap.getLayer('member-pins')?new Set(bladeMap.queryRenderedFeatures({layers:['member-pins']}).map(f=>f.properties.deviceId)).size:0)).toBe(25);
  expect(await page.evaluate(()=>Array.from({length:25},(_,i)=>i-12).every(value=>bladeMap.getBounds().contains([value,value])))).toBe(true);
  expect(await page.evaluate(()=>document.querySelector('.graph-host')._cyreg.cy.edges().length)).toBe(300);
});
