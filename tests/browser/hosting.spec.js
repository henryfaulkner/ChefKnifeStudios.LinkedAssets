import {test,expect} from '@playwright/test';
test('static host fallback and missing runtime assets are distinct',async({request})=>{
  test.skip(process.env.LA_STATIC_HOST!=='1','Run against tests/browser/static-server.py with LA_STATIC_HOST=1.');
  const deep=await request.get('/links/review');expect(deep.status()).toBe(200);expect(await deep.text()).toContain('Linked Assets');
  expect(deep.headers()['blazor-environment']).toBe('Production');
  for(const path of ['/_framework/missing.wasm','/_framework/missing.js','/_content/missing.js','/vendor/missing.js','/missing.wasm'])expect((await request.get(path)).status()).toBe(404);
});
