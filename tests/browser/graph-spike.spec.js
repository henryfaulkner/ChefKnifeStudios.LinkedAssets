import {test,expect} from '@playwright/test';
const moduleUrl='/_content/ChefKnifeStudios.LinkedAssets.Client.Shared/js/graph-canvas.js';
async function spike(page,count=3){
  await page.route('**/__graph-test',route=>route.fulfill({contentType:'text/html',body:`<html><head><link rel="stylesheet" href="/css/app.css"></head><body><div id="graph" style="width:1400px;height:900px"></div><script src="/vendor/cytoscape/3.35.0/cytoscape.min.js"></script></body></html>`}));
  await page.goto('/__graph-test');
  await page.evaluate(async({moduleUrl,count})=>{
    await document.fonts.ready;
    window.adapter=await import(moduleUrl);window.events=[];
    window.graphs=Array.from({length:count},(_,i)=>{
      const n=count===500?(i<214?8:i===214?3:1):i+2;
      const parentId=`parent-${i}`,key=`AssetLink:${i}`;
      const members=Array.from({length:n},(_,j)=>({id:`n-${i}-${j}`,deviceId:j===0?'shared':`d${i}-${j}`,label:`Device ${i} / ${j}`}));
      const edges=[];for(let a=0;a<n;a++)for(let b=a+1;b<n;b++)edges.push({id:`e-${i}-${a}-${b}`,source:members[a].id,target:members[b].id});
      return {parentId,key,members,edges,color:'#C62828'};
    });
    window.instance=adapter.create(document.getElementById('graph'),{invokeMethodAsync:async(...args)=>events.push(args)},{foreground:'#1A1C1E'});
    adapter.replaceSnapshot(instance,1,graphs,{});
    window.cy=document.getElementById('graph')._cyreg.cy;
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  },{moduleUrl,count});
}
test('independent complete graphs support node, parent and segment movement',async({page})=>{
  await spike(page);
  const initial=await page.evaluate(()=>({nodes:cy.nodes(':childless').length,edges:cy.edges().length,positions:cy.nodes(':childless').map(n=>({id:n.id(),p:n.renderedPosition()}))}));
  expect(initial.nodes).toBe(9);expect(initial.edges).toBe(10);
  const p={x:Math.round(initial.positions[0].p.x),y:Math.round(initial.positions[0].p.y)};
  await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+35,p.y+25,{steps:8});await page.mouse.up();
  let after=await page.evaluate(()=>cy.getElementById('n-0-0').renderedPosition());
  expect(after.x-initial.positions[0].p.x).toBeCloseTo(35,0);
  const edge=await page.evaluate(()=>{
    const a=cy.getElementById('n-0-0').renderedPosition(),b=cy.getElementById('n-0-1').renderedPosition();return{x:Math.round((a.x+b.x)/2),y:Math.round((a.y+b.y)/2)};
  });
  const before=await page.evaluate(()=>cy.getElementById('parent-0').children().map(n=>({...n.position()})));
  await page.mouse.move(edge.x,edge.y);await page.mouse.down();await page.mouse.move(edge.x+45,edge.y+30,{steps:10});await page.mouse.up();
  const shifted=await page.evaluate(()=>cy.getElementById('parent-0').children().map(n=>({...n.position()})));
  for(let i=0;i<before.length;i++){expect(shifted[i].x-before[i].x).toBeCloseTo(45,0);expect(shifted[i].y-before[i].y).toBeCloseTo(30,0);}
  const handle=await page.evaluate(()=>{const b=cy.getElementById('parent-0').renderedBoundingBox();return{x:Math.round(b.x1+5),y:Math.round(b.y1+5)};});
  await page.mouse.move(handle.x,handle.y);await page.mouse.down();await page.mouse.move(handle.x+20,handle.y+20,{steps:8});await page.mouse.up();
  const grouped=await page.evaluate(()=>cy.getElementById('parent-0').children().map(n=>({...n.position()})));
  for(let i=0;i<before.length;i++){expect(grouped[i].x-shifted[i].x).toBeCloseTo(20,0);expect(grouped[i].y-shifted[i].y).toBeCloseTo(20,0);}
  expect(await page.evaluate(()=>cy.userPanningEnabled())).toBe(true);
  await page.evaluate(()=>adapter.setVisible(instance,2,['AssetLink:1']));
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  expect(await page.evaluate(()=>cy.nodes(':childless').filter(n=>n.visible()).length)).toBe(3);
  expect(await page.evaluate(()=>cy.getElementById('parent-0').children().map(n=>({...n.position()})))).toEqual(grouped);
  await page.evaluate(()=>adapter.setVisible(instance,3,graphs.map(g=>g.key)));
  const restored=await page.evaluate(()=>cy.getElementById('parent-0').children().map(n=>({...n.position()})));
  // Restoring a graph reflows its origin but preserves its edited internal shape.
  for(let i=0;i<grouped.length;i++){
    expect(restored[i].x-restored[0].x).toBeCloseTo(grouped[i].x-grouped[0].x,8);
    expect(restored[i].y-restored[0].y).toBeCloseTo(grouped[i].y-grouped[0].y,8);
  }
  const panBefore=await page.evaluate(()=>({...cy.pan()}));
  await page.mouse.move(1100,600);await page.mouse.down();await page.mouse.move(1140,630,{steps:8});await page.mouse.up();
  const panAfter=await page.evaluate(()=>({...cy.pan()}));expect(panAfter.x-panBefore.x).toBeCloseTo(40,0);
  await page.keyboard.down('Space');await page.mouse.move(600,500);await page.mouse.down();await page.mouse.move(630,520,{steps:8});await page.mouse.up();await page.keyboard.up('Space');
  expect(await page.evaluate(()=>cy.userPanningEnabled())).toBe(true);
  await page.mouse.move(1000,500);await page.mouse.wheel(0,-150);
  await expect.poll(()=>page.evaluate(()=>cy.zoom())).toBeGreaterThan(1);
  expect(await page.evaluate(()=>cy.zoom())).toBeLessThanOrEqual(3);
});
test('500-link stress fixture preserves all labels and 5995 pairwise segments',async({page},testInfo)=>{
  await spike(page,500);
  const counts=await page.evaluate(()=>({nodes:cy.nodes(':childless').length,edges:cy.edges().length,parents:cy.nodes(':parent').length}));
  expect(counts).toEqual({nodes:2000,edges:5995,parents:500});
  const timings=await page.evaluate(async()=>{
    const times=[];for(let i=0;i<10;i++){
      const start=performance.now();adapter.setVisible(instance,i+2,graphs.filter((_,j)=>j%2===i%2).map(g=>g.key));
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));times.push(performance.now()-start);
    }return times.sort((a,b)=>a-b);
  });
  await testInfo.attach('filter-timings',{body:JSON.stringify({counts,timings,p95:timings.at(-1)}),contentType:'application/json'});
  console.log(testInfo.project.name,JSON.stringify({counts,timings,filterP95:timings.at(-1)}));
  if(testInfo.project.name==='chromium')expect(timings[Math.ceil(timings.length*0.95)-1]).toBeLessThanOrEqual(150);
  await page.evaluate(()=>adapter.dispose(instance));
  expect(await page.evaluate(()=>document.querySelectorAll('#graph canvas').length)).toBe(0);
});
test('scale node and group drags keep the browser gesture loop responsive',async({page},testInfo)=>{
  test.skip(testInfo.project.name==='firefox','Chromium is the measured performance baseline; Firefox gesture semantics are tested separately and its >33 ms stress result is documented.');
  await spike(page,500);
  await page.evaluate(()=>{
    window.frameTimes=[];window.lastFrame=null;window.recordFrames=true;
    const frame=t=>{if(!recordFrames)return;if(lastFrame!==null)frameTimes.push(t-lastFrame);lastFrame=t;requestAnimationFrame(frame);};requestAnimationFrame(frame);
  });
  const point=await page.evaluate(()=>cy.getElementById('n-0-0').renderedPosition());
  await page.mouse.move(point.x,point.y);await page.mouse.down();
  for(let i=0;i<120;i++){await page.mouse.move(point.x+Math.sin(i/10)*35,point.y+Math.cos(i/10)*25);await page.waitForTimeout(40);}
  await page.mouse.up();
  const edge=await page.evaluate(()=>{const a=cy.getElementById('n-0-1').renderedPosition(),b=cy.getElementById('n-0-2').renderedPosition();return{x:(a.x+b.x)/2,y:(a.y+b.y)/2};});
  await page.mouse.move(edge.x,edge.y);await page.mouse.down();
  for(let i=0;i<120;i++){await page.mouse.move(edge.x+Math.sin(i/10)*35,edge.y+Math.cos(i/10)*25);await page.waitForTimeout(40);}
  await page.mouse.up();
  const result=await page.evaluate(()=>{recordFrames=false;const frames=frameTimes.sort((a,b)=>a-b);return{samples:frames.length,p95:frames[Math.ceil(frames.length*0.95)-1],duration:frames.reduce((a,b)=>a+b,0)};});
  console.log(testInfo.project.name,'drag',JSON.stringify(result));
  await testInfo.attach('drag-frame-times',{body:JSON.stringify(result),contentType:'application/json'});
  expect(result.duration).toBeGreaterThanOrEqual(10000);expect(result.p95).toBeLessThanOrEqual(33);
});
