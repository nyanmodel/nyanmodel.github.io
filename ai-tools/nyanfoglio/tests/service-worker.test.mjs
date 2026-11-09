import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

async function worker(path, scope, keys) {
  const handlers = {};
  const deleted = [];
  const navigated = [];
  const matched = [];
  const cached = new Response('app shell');
  const context = {
    URL, Response, Promise,
    fetch: async () => new Response('network'),
    caches: {
      keys: async () => keys,
      delete: async key => { deleted.push(key); },
      open: async name => ({
        addAll: async paths => {
          for (const path of paths) {
            await readFile(new URL(path === './' ? '../index.html' : `../${path}`, import.meta.url));
          }
        },
        match: async () => { matched.push(name); return cached; }
      })
    },
    self: {
      registration: { scope }, skipWaiting: async () => {},
      clients: {
        claim: async () => {},
        matchAll: async () => [{ url: `${scope}?from=pwa#books`, navigate: async url => { navigated.push(url); } }]
      },
      addEventListener: (type, handler) => { handlers[type] = handler; }
    }
  };
  vm.runInNewContext(await readFile(new URL(path, import.meta.url), 'utf8'), context);
  async function dispatch(type, extra = {}) {
    let result;
    handlers[type]({ waitUntil: promise => { result = promise; }, respondWith: promise => { result = promise; }, ...extra });
    return result;
  }
  return { dispatch, deleted, navigated, matched };
}

test('new worker caches existing shell files and preserves other apps’ caches', async () => {
  const scope = 'https://nyanmodel.com/ai-tools/nyanfoglio/';
  const prefix = `nyanfoglio:${scope}:`;
  const app = await worker('../sw.js', scope, [`${prefix}v18`, `${prefix}v19`, 'workbox-jiro', 'nyanfoglio-v18']);
  await app.dispatch('install');
  await app.dispatch('activate');
  assert.deepEqual(app.deleted, [`${prefix}v18`]);
  const response = await app.dispatch('fetch', { request: { url: `${scope}index.html`, method: 'GET' } });
  assert.equal(await response.text(), 'app shell');
  assert.deepEqual(app.matched, [`${prefix}v19`]);
  assert.equal(await app.dispatch('fetch', { request: { url: 'https://cdn.example/font.woff', method: 'GET' } }), undefined);
});

test('legacy worker redirects cached PWA clients and navigations, retaining query and hash', async () => {
  const scope = 'https://nyanmodel.com/ai-tools/spendle/';
  const app = await worker('../../spendle/sw.js', scope, ['nyanfoglio-v17', 'nyanfoglio-v18', 'workbox-jiro', 'nyanfoglio:new:v19']);
  await app.dispatch('install');
  await app.dispatch('activate');
  assert.deepEqual(app.deleted, ['nyanfoglio-v17', 'nyanfoglio-v18']);
  assert.deepEqual(app.navigated, ['https://nyanmodel.com/ai-tools/nyanfoglio/?from=pwa#books']);
  const response = await app.dispatch('fetch', { request: { url: `${scope}index.html?from=bookmark`, mode: 'navigate' } });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('Location'), 'https://nyanmodel.com/ai-tools/nyanfoglio/?from=bookmark');
  assert.equal(await app.dispatch('fetch', { request: { url: `${scope}js/app.js`, mode: 'cors' } }), undefined);
});
