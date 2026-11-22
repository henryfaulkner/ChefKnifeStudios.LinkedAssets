import fs from 'node:fs';
export const snapshotUtc = '2026-11-21T12:00:00Z';
export const basic = JSON.parse(fs.readFileSync(new URL('../fixtures/geotab/basic.json', import.meta.url)));
export function scaleFixture(count = 500) {
  const data = {Device: [], AssetLink: [], AssetLinkDetails: [], DeviceLink: [], DeviceStatusInfo: []};
  for (let i = 0; i < count; i++) {
    const id = `link-${String(i).padStart(4, '0')}`;
    data.AssetLink.push({id, isActive:true, linkType:i % 2 ? 'Automatic' : 'AssociatedDevice'});
    const members=count===500?(i<214?8:i===214?3:1):4;
    for (let j = 0; j < members; j++) {
      const deviceId = j===0?'shared-device':`device-${i}-${j}`;
      if(j!==0||i===0)data.Device.push({id: deviceId, name:j===0?'Shared device':`Device ${i} / ${j}`});
      data.AssetLinkDetails.push({id:`${id}-${j}`, assetLinkId:id, device:{id:deviceId}, activeFrom:'2026-11-01T00:00:00Z', activeTo:'9999-12-31T23:59:59Z'});
    }
  }
  return data;
}
export async function interceptGeotab(page, data = basic, override = () => undefined) {
  const calls = [];
  await page.route('**/appsettings.json',r=>r.fulfill({json:{Map:{LightStyleUrl:'',DarkStyleUrl:''}}}));
  await page.clock.setFixedTime(new Date(snapshotUtc));
  await page.route('https://**.geotab.com/apiv1', async route => {
    const body = route.request().postDataJSON();
    calls.push({method:body.method, type:body.params?.typeName});
    let result = await override(body);
    if (result === undefined) {
      const p = body.params;
      if (body.method === 'Authenticate') result = {result:{path:'ThisServer', credentials:{database:'synthetic-test',userName:'fixture',sessionId:'test-only'}}};
      else if (body.method === 'GetCountOf') result = {result:data[p.typeName].length};
      else if (body.method === 'Get') {
        let rows = data[p.typeName];
        if (p.typeName === 'AssetLinkDetails') rows = rows.filter(x => p.search.assetLinkIds.includes(x.assetLinkId));
        if (p.typeName === 'DeviceStatusInfo') rows = rows.filter(x => x.device.id === p.search.deviceSearch.id);
        if (p.sort) rows = [...rows].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).filter(x => !p.sort.offset || x.id > p.sort.offset);
        result = {result: rows.slice(0, p.resultsLimit ?? rows.length)};
      } else throw new Error(`Unexpected RPC method ${body.method}`);
    }
    await route.fulfill({json: result, headers:{'access-control-allow-origin':'*'}});
  });
  return calls;
}
