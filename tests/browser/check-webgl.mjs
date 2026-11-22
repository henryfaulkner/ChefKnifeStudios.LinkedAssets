import assert from 'node:assert/strict';
import {chromium,firefox} from '@playwright/test';

for(const [name,engine] of Object.entries({chromium,firefox})){
  const browser=await engine.launch({headless:false});
  try {
    const page=await browser.newPage();
    const renderer=await page.evaluate(()=>{
      const canvas=document.createElement('canvas');
      const gl=canvas.getContext('webgl2')??canvas.getContext('webgl');
      return gl?gl.getParameter(gl.RENDERER):null;
    });
    assert.ok(renderer,`${name} needs a working WebGL context for the map acceptance checks.`);
    console.log(`${name} WebGL renderer: ${renderer}`);
  } finally {await browser.close();}
}
