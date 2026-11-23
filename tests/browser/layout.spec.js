import {test,expect} from '@playwright/test';
import {basic,interceptGeotab,scaleFixture} from './fixtures.js';
test('initial measured layout is repeatable and keeps long labels in separate graph bounds',async({page})=>{
  const data=structuredClone(basic);data.Device.find(d=>d.id==='d2').name='A long source device label that remains visible in every independent link graph';
  await interceptGeotab(page,data);await page.goto('/');
  await page.getByLabel('Geotab username or email').fill('fixture');await page.getByLabel('Password',{exact:true}).fill('synthetic-only');await page.getByRole('button',{name:'Sign in',exact:true}).click();
  const geometry=async()=>{
    // Published WASM session restore measured 6.4s locally; use the existing session-test startup budget.
    await expect.poll(()=>page.evaluate(()=>document.querySelector('.graph-host')?._cyreg?.cy?.nodes(':childless').length),{timeout:15000}).toBe(7);
    return page.evaluate(()=>{const cy=document.querySelector('.graph-host')._cyreg.cy;return{bounds:cy.nodes(':parent').map(n=>n.boundingBox({includeLabels:true})),positions:cy.nodes(':childless').map(n=>({id:n.id(),x:n.position('x'),y:n.position('y')}))};});
  };
  const before=await geometry();
  for(let i=0;i<before.bounds.length;i++)for(let j=i+1;j<before.bounds.length;j++){
    const a=before.bounds[i],b=before.bounds[j];expect(a.x2<b.x1||b.x2<a.x1||a.y2<b.y1||b.y2<a.y1).toBe(true);
  }
  await page.reload();const after=await geometry();expect(after.positions).toEqual(before.positions);
});

async function visibleGeometry(page){
  return page.evaluate(()=>{const cy=document.querySelector('.graph-host')?._cyreg?.cy;if(!cy)return[];return cy.nodes(':parent').filter(p=>p.visible()).map(p=>{
    const b=p.boundingBox({includeLabels:true}),origin=p.children()[0].position();
    return{key:p.data('key'),x:Math.round(b.x1*1e5)/1e5,y:Math.round(b.y1*1e5)/1e5,
      right:b.x2,bottom:b.y2,shape:p.children().map(n=>({id:n.id(),x:Math.round((n.position('x')-origin.x)*1e5)/1e5,y:Math.round((n.position('y')-origin.y)*1e5)/1e5}))};
  }).sort((a,b)=>a.x-b.x||a.y-b.y);});
}
function expectGrid(graphs,keys){
  expect(graphs.map(g=>g.key)).toEqual(keys);
  const columns=new Map();for(const g of graphs){if(!columns.has(g.x))columns.set(g.x,[]);columns.get(g.x).push(g);}
  const first=[...columns.values()][0];
  // Fixed four-row grid read column-major: sorted order fills each column
  // top-to-bottom before continuing right, with N = ceil(count/4) columns.
  expect(columns.size).toBe(Math.ceil(graphs.length/4));
  expect(first.length).toBe(Math.min(4,graphs.length));
  for(const column of columns.values())expect(column.length).toBeLessThanOrEqual(4);
  for(const column of columns.values())column.forEach((g,row)=>expect(g.y).toBeCloseTo(first[row].y,4));
  for(let i=0;i<graphs.length;i++)for(let j=i+1;j<graphs.length;j++){
    const a=graphs[i],b=graphs[j];expect(a.right<b.x||b.right<a.x||a.bottom<b.y||b.bottom<a.y).toBe(true);
  }
}

test('close zoom fits many complete links even with one long device name',async({page},testInfo)=>{
  await page.setViewportSize({width:1440,height:900});
  const data=scaleFixture(32);
  data.AssetLinkDetails=data.AssetLinkDetails.filter(d=>/[01]$/.test(d.id));
  data.Device.find(d=>d.id==='device-1-1').name='A long source device name that still needs to fit entirely within its column';
  await interceptGeotab(page,data);
  await page.goto('/');
  await page.getByLabel('Geotab username or email').fill('fixture');
  await page.getByLabel('Password',{exact:true}).fill('synthetic-only');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect.poll(()=>visibleGeometry(page).then(g=>g.length),{timeout:15000}).toBe(32);
  const displayed=await page.evaluate(()=>{
    const cy=document.querySelector('.graph-host')._cyreg.cy;
    // Pan the grid just clear of the search, legend and sort overlays.
    cy.viewport({zoom:1.5,pan:{x:100,y:-195}});
    return cy.nodes(':parent').filter(p=>{
      const b=p.renderedBoundingBox({includeLabels:true});
      return b.x1>=0&&b.y1>=0&&b.x2<=cy.width()&&b.y2<=cy.height();
    }).length;
  });
  expect(displayed).toBeGreaterThanOrEqual(12);
  const graphs=await visibleGeometry(page);
  expectGrid(graphs,[...Array.from({length:16},(_,i)=>2*i+1),...Array.from({length:16},(_,i)=>2*i)]
    .map(i=>`AssetLink:link-${String(i).padStart(4,'0')}`));
  await page.screenshot({path:`../../artifacts/validation/compact-grid-${testInfo.project.name}.png`});
});

for(const width of [1440,390]){
  test(`search, type toggles and both sort modes reflow aligned grid at ${width}px`,async({page},testInfo)=>{
    await page.setViewportSize({width,height:900});
    const data=scaleFixture(9);
    // Mix sizes and a manual link with known recency; AssetLink history stays unverified.
    data.AssetLinkDetails=data.AssetLinkDetails.filter(d=>Number(d.id.slice(-1))<(Number(d.assetLinkId.slice(-1))%3===0?1:Number(d.assetLinkId.slice(-1))%3===1?2:4));
    data.DeviceLink.push({id:'manual',linkType:'Manual',sourceDevice:{id:'shared-device'},destinationDevice:{id:'device-2-1'},fromDate:'2026-11-15T00:00:00Z',toDate:'9999-12-31T23:59:59Z'});
    const calls=await interceptGeotab(page,data);
    await page.goto('/');await page.getByLabel('Geotab username or email').fill('fixture');await page.getByLabel('Password',{exact:true}).fill('synthetic-only');await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect.poll(()=>visibleGeometry(page).then(g=>g.length)).toBe(10);
    const key=i=>`AssetLink:link-${String(i).padStart(4,'0')}`;
    const recent=['DeviceLink:manual',...[1,3,5,7,0,2,4,6,8].map(key)],byType=[...[1,3,5,7].map(key),'DeviceLink:manual',...[0,2,4,6,8].map(key)];
    const initial=await visibleGeometry(page),readCount=calls.length;
    expectGrid(initial,recent);
    const point=await page.evaluate(()=>document.querySelector('.graph-host')._cyreg.cy.nodes(':parent').filter(p=>p.data('key')==='DeviceLink:manual').children()[0].renderedPosition());
    await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+140,point.y+80,{steps:6});await page.mouse.up();
    await expect.poll(()=>visibleGeometry(page).then(g=>g.find(g=>g.key==='DeviceLink:manual').shape)).not.toEqual(initial[0].shape);
    const edited=await visibleGeometry(page);
    await page.getByRole('button',{name:'Link Type',exact:true}).click();
    await expect.poll(()=>visibleGeometry(page).then(g=>g.map(g=>g.key))).toEqual(byType);
    expectGrid(await visibleGeometry(page),byType);
    await page.getByLabel('Search devices').fill('Device 8 /');
    await expect.poll(()=>visibleGeometry(page).then(g=>g.map(g=>g.key))).toEqual([key(8)]);
    const match=(await visibleGeometry(page))[0];expect(match.x).toBeCloseTo(initial[0].x,4);expect(match.y).toBeCloseTo(initial[0].y,4);
    await page.getByLabel('Search devices').fill('');
    await expect.poll(()=>visibleGeometry(page).then(g=>g.map(g=>g.key))).toEqual(byType);
    await page.getByRole('button',{name:'Automatic',exact:true}).click();
    const withoutAutomatic=['DeviceLink:manual',...[0,2,4,6,8].map(key)];
    await expect.poll(()=>visibleGeometry(page).then(g=>g.map(g=>g.key))).toEqual(withoutAutomatic);
    expectGrid(await visibleGeometry(page),withoutAutomatic);
    await page.getByRole('button',{name:'Automatic',exact:true}).click();
    await expect.poll(()=>visibleGeometry(page).then(g=>g.map(g=>g.key))).toEqual(byType);
    await page.getByRole('button',{name:'Most Recent',exact:true}).click();
    await expect.poll(()=>visibleGeometry(page).then(g=>g.map(g=>g.key))).toEqual(recent);
    const final=await visibleGeometry(page);expectGrid(final,recent);
    for(const g of final)expect(g.shape).toEqual(edited.find(prior=>prior.key===g.key).shape);
    expect(calls.length).toBe(readCount);
    if(width===1440)await page.screenshot({path:`../../artifacts/validation/grid-reflow-${testInfo.project.name}.png`});
  });
}
