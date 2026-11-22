import {test,expect} from '@playwright/test';
import {interceptGeotab} from './fixtures.js';
test('20 selection, close and theme cycles dispose maps and callbacks',async({page},testInfo)=>{
  await interceptGeotab(page);
  await page.route('**/appsettings.json',r=>r.fulfill({json:{Map:{LightStyleUrl:'/map-light.json',DarkStyleUrl:'/map-dark.json'}}}));
  await page.route('**/map-*.json',r=>r.fulfill({json:{version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#DDD'}}]}}));
  await page.goto('/');await page.getByLabel('Geotab username or email').fill('fixture');await page.getByLabel('Password',{exact:true}).fill('synthetic-only');await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByText('Browse links',{exact:true}).click();
  await page.evaluate(()=>{
    window.activeMaps=0;const Original=maplibregl.Map;
    maplibregl.Map=class extends Original{constructor(options){super(options);activeMaps++;}remove(){if(!this.testRemoved){this.testRemoved=true;activeMaps--;}return super.remove();}};
  });
  for(let i=0;i<20;i++){
    await page.getByRole('button',{name:/^Manual:/}).click();
    await expect(page.locator('.positions-map canvas')).toHaveCount(1);
    await page.getByRole('button',{name:i%2?'Light theme':'Dark theme',exact:true}).click();
    await page.getByRole('button',{name:'Close details'}).click();
    await expect(page.locator('.positions-map canvas')).toHaveCount(0);
    expect(await page.evaluate(()=>activeMaps)).toBe(0);
    await expect(page.locator('.graph-host canvas')).toHaveCount(3);
  }
  await testInfo.attach('lifecycle',{body:'20 map create/style-change/dispose cycles passed; one Cytoscape canvas owner remained.',contentType:'text/plain'});
});
