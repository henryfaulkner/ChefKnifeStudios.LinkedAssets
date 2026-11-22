import {test,expect} from '@playwright/test';
test('MapLibre fits all 25 pins, antimeridian, coincident points, theme and projection failures',async({page})=>{
  await page.route('**/__map-test',r=>r.fulfill({contentType:'text/html',body:`<html><head><link rel="stylesheet" href="/vendor/maplibre/4.7.1/maplibre-gl.css"></head><body><div id="map" style="width:380px;height:250px"></div><script src="/vendor/maplibre/4.7.1/maplibre-gl.js"></script></body></html>`}));
  await page.route('**/test-style*.json',r=>r.fulfill({json:{version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#F5F5F5'}}]}}));
  await page.goto('/__map-test');
  await page.evaluate(async()=>{
    window.mapAdapter=await import('/_content/ChefKnifeStudios.LinkedAssets.Client.Shared/js/recent-positions-map.js');
    window.mapMessages=[];
    const Original=maplibregl.Map;
    maplibregl.Map=class extends Original {constructor(options){super(options);window.testMap=this;}};
    window.mapId=mapAdapter.create(document.getElementById('map'),{invokeMethodAsync:async(_,msg,revision)=>mapMessages.push({msg,revision})},
      {lightStyleUrl:'/test-style.json',darkStyleUrl:'/test-style-dark.json'},false);
    window.points=Array.from({length:25},(_,i)=>({deviceId:`d${i}`,label:`Device ${i}`,longitude:i-12,latitude:i-12}));
    mapAdapter.update(mapId,1,points);
  });
  await expect.poll(()=>page.evaluate(()=>window.testMap?.getSource('members')?._data?.features?.length)).toBe(25);
  await expect.poll(()=>page.evaluate(()=>testMap.getLayer('member-pins')?new Set(testMap.queryRenderedFeatures({layers:['member-pins']}).map(f=>f.properties.deviceId)).size:0)).toBe(25);
  const inBounds=await page.evaluate(()=>points.every(p=>testMap.getBounds().contains([p.longitude,p.latitude])));
  expect(inBounds).toBe(true);
  await page.evaluate(()=>mapAdapter.update(mapId,2,[{deviceId:'a',label:'A',longitude:179,latitude:10},{deviceId:'b',label:'B',longitude:-179,latitude:12}]));
  await expect.poll(()=>page.evaluate(()=>testMap.getBounds().getEast()-testMap.getBounds().getWest())).toBeLessThan(10);
  await page.evaluate(()=>{mapAdapter.setTheme(mapId,true);mapAdapter.update(mapId,3,[{deviceId:'c',label:'Current',longitude:0,latitude:0},{deviceId:'d',label:'Coincident',longitude:0,latitude:0}]);});
  await expect.poll(()=>page.evaluate(()=>testMap.getSource('members')?._data?.features?.[0]?.properties?.deviceId)).toBe('c');
  expect(await page.evaluate(()=>testMap.getZoom())).toBeLessThanOrEqual(14);
  await page.evaluate(()=>mapAdapter.update(mapId,4,[{deviceId:'polar',label:'Polar',longitude:0,latitude:89}]));
  await expect.poll(()=>page.evaluate(()=>mapMessages.at(-1)?.msg)).toContain('outside this map projection');
  await page.evaluate(()=>mapAdapter.dispose(mapId));
  expect(await page.locator('#map canvas').count()).toBe(0);
});
