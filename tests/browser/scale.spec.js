import {test,expect} from '@playwright/test';
import {scaleFixture,interceptGeotab} from './fixtures.js';
test('published WASM app filters all 500 graphs within the measured target',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium','Chromium is the measured performance baseline.');
  await interceptGeotab(page,scaleFixture());
  await page.goto('/');await page.getByLabel('Geotab username or email').fill('fixture');await page.getByLabel('Password',{exact:true}).fill('synthetic-only');await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByText('500 / 500 links')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.querySelector('.graph-host')?._cyreg?.cy?.edges().length)).toBe(5995);
  const measurements=await page.evaluate(async()=>{
    const cy=document.querySelector('.graph-host')._cyreg.cy;const counts={graphs:cy.nodes(':parent').length,nodes:cy.nodes(':childless').length,edges:cy.edges().length};
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const times=[];
    for(let i=0;i<20;i++){
      const input=document.getElementById('device-search'),start=performance.now(),expected=i%2?500:1;
      input.value=i%2?'':'Device 0 /';input.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise((resolve,reject)=>{
        const frame=()=>{if(cy.nodes(':parent').filter(p=>p.visible()).length===expected)requestAnimationFrame(resolve);else if(performance.now()-start>5000)reject(new Error('Filter did not reach renderer'));else requestAnimationFrame(frame);};requestAnimationFrame(frame);
      });times.push(performance.now()-start);
    }
    times.sort((a,b)=>a-b);return{counts,times,p95:times[Math.ceil(times.length*0.95)-1]};
  });
  console.log('WASM filter',JSON.stringify(measurements));
  await testInfo.attach('wasm-filter-timings',{body:JSON.stringify(measurements),contentType:'application/json'});
  expect(measurements.counts).toEqual({graphs:500,nodes:2000,edges:5995});expect(measurements.p95).toBeLessThanOrEqual(150);
});
