#!/usr/bin/env node

// Offline checks for MeioNovel's Laravel chapter API. All page and chapter
// fixtures are synthetic; no real chapter text or network access is required.
// Run with: node --test scripts/test-meionovel.js

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const nodeRequire = createRequire(import.meta.url);
const baseUrl = 'https://meionovels.com';
const novelPath = '/novel/contoh-novel/';
const chapterPath = `${novelPath}volume-1-chapter-0/`;
const contentParts = [
  '<p>Bagian pertama — café 🌙.</p>',
  '<p>Bagian kedua &amp; penutup.</p>',
];

const bundled = await build({
  entryPoints: [path.join(repoRoot, 'plugins/indonesian/meionovel.ts')],
  bundle: true,
  platform: 'node',
  packages: 'external',
  format: 'cjs',
  target: 'node22',
  write: false,
  logLevel: 'silent',
  alias: {
    '@libs': path.join(repoRoot, 'src/libs'),
    '@': path.join(repoRoot, 'src'),
  },
  plugins: [
    {
      name: 'mock-network',
      setup(builder) {
        builder.onResolve({ filter: /^@libs\/fetch$/ }, () => ({
          path: '@libs/fetch',
          external: true,
        }));
      },
    },
  ],
});

function createPlugin(route) {
  const requests = [];
  const fetchApi = async (input, init = {}) => {
    const url = new URL(String(input));
    requests.push({ url, init });
    const response = await route(url, init);
    assert.ok(response instanceof Response, `Unexpected request: ${url}`);
    return response;
  };
  const require = specifier => {
    if (specifier === '@libs/fetch') {
      return {
        fetchApi,
        fetchText: async (...args) => (await fetchApi(...args)).text(),
      };
    }
    return nodeRequire(specifier);
  };
  const module = { exports: {} };
  // These globals are unavailable to the plugin in Hermes. External runtime
  // dependencies retain their own environment, as they do in LNReader.
  new Function(
    'require',
    'module',
    'exports',
    'Buffer',
    'atob',
    'TextDecoder',
    'TextEncoder',
    bundled.outputFiles[0].text,
  )(
    require,
    module,
    module.exports,
    undefined,
    undefined,
    undefined,
    undefined,
  );
  return { plugin: module.exports.default, requests };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function pageResponse(body, session = 'one') {
  const response = new Response(
    `<html><head><meta name="csrf-token" content="csrf-${session}"></head><body>${body}</body></html>`,
    { headers: { 'content-type': 'text/html' } },
  );
  // React Native exposes get('set-cookie'), without Node's getSetCookie().
  // Include an Expires comma so splitting every comma would lose the pairing.
  const headers = response.headers;
  Object.defineProperty(response, 'headers', {
    value: {
      get(name) {
        if (name.toLowerCase() === 'set-cookie') {
          return `XSRF-TOKEN=xsrf-${session}; Expires=Wed, 01 Jan 2031 00:00:00 GMT; Path=/; SameSite=Lax, meionovel_session=session-${session}; Path=/; HttpOnly`;
        }
        return headers.get(name);
      },
    },
  });
  return response;
}

function configExpression(config) {
  const json = JSON.stringify(config).replace(/\//g, '\\/');
  const literal = JSON.stringify(json)
    .slice(1, -1)
    .replace(/\\"/g, '\\u0022')
    .replace(/'/g, '\\u0027');
  return `JSON.parse('${literal}')`;
}

function novelPage(session = 'one') {
  return pageResponse(
    `<main><div><div>Berjalan</div><h1>Contoh Novel</h1>
      <meta property="og:image" content="${baseUrl}/cover.jpg">
      <meta name="description" content="Sinopsis contoh untuk pengujian.">
      <a href="${baseUrl}/novel-author/contoh/">Penulis Contoh</a>
      <div><p>Sinopsis contoh untuk pengujian.</p></div>
      </div>
      <div x-data="chapterList(${configExpression({
        url: `${baseUrl}/baca/daftar`,
        novel: 67,
        token: `list-${session}`,
      })})" x-ref="slot">
        <section id="daftar-chapter">
          <p>Memuat daftar chapter…</p>
          <a class="trap-link" href="${baseUrl}/baca/arsip/contoh-novel/chapter-1">Chapter 1</a>
        </section>
      </div></main>`,
    session,
  );
}

function readerPage(session = 'one', { locked = false } = {}) {
  const token = locked ? 'null' : `'content-${session}'`;
  return pageResponse(
    `<main x-data="reader({
      settings: (() => { throw new Error('Do not execute page expressions'); })(),
      chapterId: 31232,
      novelId: 67,
      contentUrl: 'https:\\/\\/meionovels.com\\/baca\\/isi',
      contentToken: ${token}
    })">
      <h1>Volume 1 Chapter 0 — Prolog</h1>
      <div x-ref="body" class="reader-body">${locked ? 'Chapter terkunci. Masuk untuk membuka chapter ini.' : 'Memuat isi chapter…'}</div>
    </main>`,
    session,
  );
}

function tocPage(page = '1') {
  const chapters =
    page === '1'
      ? `<a id="ch-31232" href="${baseUrl}${chapterPath}">
          <span>Chapter 0</span><span>Volume 1 Chapter 0 — Prolog</span>
          <time datetime="2026-01-01T00:00:00Z">1 Jan 2026</time>
        </a>
        <a id="ch-31233" href="${baseUrl}${novelPath}mtl/chapter-1/">
          <span>Chapter 1</span><span>Permulaan</span>
        </a>`
      : `<a id="ch-31234" href="${baseUrl}${novelPath}htl/chapter-2/">
          <span>Chapter 2</span><span>Langkah berikutnya</span>
        </a>`;
  return `<section id="daftar-chapter"><section><h3><button><span>Volume 1</span></button></h3><div id="vol-1" data-chapter-scroll>
    ${chapters}
    <a id="ch-999" class="trap-link" href="${baseUrl}/baca/arsip/contoh-novel/chapter-999">Chapter jebakan</a>
    <a class="trap-link" href="${baseUrl}${novelPath}chapter-jebakan/">Chapter jebakan lain</a>
    </div></section><nav aria-label="Pagination">
      <a href="${baseUrl}${novelPath}?page=1#daftar-chapter">1</a>
      <a href="${baseUrl}${novelPath}?page=2#daftar-chapter">2</a>
    </nav></section>`;
}

function encodedContent(parts = contentParts) {
  const key = Buffer.from([0, 17, 241, 68, 128]);
  return {
    k: key.toString('base64'),
    p: parts
      .map((text, partIndex) => {
        const bytes = Buffer.from(text, 'utf8');
        for (let index = 0; index < bytes.length; index++) {
          bytes[index] ^= key[(index + partIndex) % key.length];
        }
        return [partIndex, bytes.toString('base64')];
      })
      .reverse(),
  };
}

function assertSessionRequest(init, session) {
  assert.equal(init.method, 'POST');
  const headers = new Headers(init.headers);
  assert.equal(headers.get('x-csrf-token'), `csrf-${session}`);
  assert.equal(headers.get('x-requested-with'), 'XMLHttpRequest');
  assert.match(headers.get('content-type'), /application\/json/);
  const cookie = headers.get('cookie');
  assert.ok(cookie?.includes(`meionovel_session=session-${session}`));
  assert.ok(cookie?.includes(`XSRF-TOKEN=xsrf-${session}`));
  assert.doesNotMatch(cookie, /Path=|Expires=|HttpOnly|SameSite=/i);
}

function pathnameFor(plugin, item, isNovel = false) {
  return new URL(plugin.resolveUrl(item.path, isNovel)).pathname;
}

test('novel keeps real TOC routes, volume names, and paginated chapter groups', async () => {
  const { plugin, requests } = createPlugin((url, init) => {
    if (url.pathname.replace(/\/$/, '') === novelPath.replace(/\/$/, '')) {
      return novelPage();
    }
    if (url.pathname === '/baca/daftar') {
      assertSessionRequest(init, 'one');
      const body = JSON.parse(init.body);
      assert.equal(body.novel, 67);
      assert.equal(body.token, 'list-one');
      assert.equal(body.params.urut, 'asc');
      assert.ok(['1', '2'].includes(body.params.page));
      return jsonResponse({ html: tocPage(body.params.page) });
    }
  });

  const novel = await plugin.parseNovel(novelPath);
  assert.equal(novel.name, 'Contoh Novel');
  assert.equal(novel.author, 'Penulis Contoh');
  assert.equal(novel.status, 'Ongoing');
  assert.equal(novel.summary, 'Sinopsis contoh untuk pengujian.');
  assert.equal(novel.totalPages, 2);
  assert.equal(novel.chapters.length, 2);
  assert.match(novel.chapters[0].name, /Volume 1 Chapter 0/);
  assert.equal(pathnameFor(plugin, novel.chapters[0]), chapterPath);
  assert.equal(
    pathnameFor(plugin, novel.chapters[1]),
    `${novelPath}mtl/chapter-1/`,
  );
  assert.match(novel.chapters[1].name, /Volume 1.*Chapter 1.*Permulaan/);

  const secondPage = await plugin.parsePage(novelPath.slice(1), '2');
  assert.equal(secondPage.chapters.length, 1);
  assert.equal(
    pathnameFor(plugin, secondPage.chapters[0]),
    `${novelPath}htl/chapter-2/`,
  );
  const pageNumbers = requests
    .filter(request => request.url.pathname === '/baca/daftar')
    .map(request => JSON.parse(request.init.body).params.page);
  assert.deepEqual(pageNumbers, ['1', '2']);
});

test('catalog and search use the current site routes with pagination', async () => {
  const { plugin, requests } = createPlugin(url => {
    assert.equal(url.pathname, '/jelajahi');
    return pageResponse(`<main><article>
      <img src="/cover.jpg"><h3><a href="${baseUrl}${novelPath}">Contoh Novel</a></h3>
      </article><article><h3><a href="${baseUrl}${novelPath}">Contoh Novel</a></h3></article></main>`);
  });
  const popular = await plugin.popularNovels(2, { filters: undefined });
  assert.equal(popular.length, 1);
  assert.equal(popular[0].name, 'Contoh Novel');
  assert.equal(popular[0].cover, `${baseUrl}/cover.jpg`);
  assert.equal(pathnameFor(plugin, popular[0], true), novelPath);
  await plugin.popularNovels(3, { filters: undefined, showLatestNovels: true });
  await plugin.searchNovels('langit & laut', 4);
  assert.deepEqual(
    requests.map(({ url }) => Object.fromEntries(url.searchParams)),
    [
      { sort: 'populer', page: '2' },
      { sort: 'terbaru', page: '3' },
      { q: 'langit & laut', page: '4' },
    ],
  );
});

test('legacy leading and trailing novel slashes resolve to the same site path', () => {
  const { plugin } = createPlugin(() => assert.fail('No request expected'));
  for (const input of [
    'novel/contoh-novel',
    '/novel/contoh-novel',
    'novel/contoh-novel/',
    '/novel/contoh-novel/',
    `${baseUrl}/novel/contoh-novel/`,
  ]) {
    const result = new URL(plugin.resolveUrl(input, true));
    assert.equal(result.origin, baseUrl);
    assert.equal(result.pathname.replace(/\/$/, ''), '/novel/contoh-novel');
  }
  for (const input of [
    'https://example.com/novel/contoh-novel/',
    '//example.com/novel/contoh-novel/',
    '/baca/arsip/contoh-novel/chapter-1',
  ]) {
    assert.throws(() => plugin.resolveUrl(input, true), /tidak valid/i);
  }
});

test('reader decodes unordered XOR parts and UTF-8 without evaluating x-data', async () => {
  const { plugin } = createPlugin((url, init) => {
    if (url.pathname === chapterPath) return readerPage();
    if (url.pathname === '/baca/isi') {
      assertSessionRequest(init, 'one');
      assert.deepEqual(JSON.parse(init.body), {
        chapter: 31232,
        token: 'content-one',
      });
      return jsonResponse(encodedContent());
    }
  });

  const content = await plugin.parseChapter(chapterPath);
  assert.equal(content, contentParts.join(''));
  assert.doesNotMatch(content, /Memuat isi|Chapter terkunci/);
});

test('HTTP 419 reloads the reader and retries with the new token and session', async () => {
  let pageCount = 0;
  let postCount = 0;
  const { plugin } = createPlugin((url, init) => {
    if (url.pathname === chapterPath) {
      pageCount++;
      return readerPage(pageCount === 1 ? 'old' : 'new');
    }
    if (url.pathname === '/baca/isi') {
      postCount++;
      const session = postCount === 1 ? 'old' : 'new';
      assertSessionRequest(init, session);
      assert.equal(JSON.parse(init.body).token, `content-${session}`);
      return postCount === 1
        ? jsonResponse({ pesan: 'Sesi kedaluwarsa' }, 419)
        : jsonResponse(encodedContent());
    }
  });

  assert.equal(await plugin.parseChapter(chapterPath), contentParts.join(''));
  assert.equal(pageCount, 2);
  assert.equal(postCount, 2);
});

test('a repeatedly expired TOC fails after one refresh instead of looping', async () => {
  let pageCount = 0;
  let postCount = 0;
  const { plugin } = createPlugin((url, init) => {
    if (url.pathname === novelPath) {
      pageCount++;
      return novelPage(String(pageCount));
    }
    if (url.pathname === '/baca/daftar') {
      postCount++;
      assertSessionRequest(init, String(pageCount));
      return jsonResponse({ pesan: 'Sesi kedaluwarsa' }, 419);
    }
  });

  await assert.rejects(plugin.parseNovel(novelPath), /419/);
  assert.equal(pageCount, 2);
  assert.equal(postCount, 2);
});

test('locked chapters do not request content or return a paywall as chapter text', async () => {
  const { plugin, requests } = createPlugin(url => {
    if (url.pathname === chapterPath) {
      return readerPage('one', { locked: true });
    }
    assert.fail(`Locked chapter must not request ${url}`);
  });

  await assert.rejects(plugin.parseChapter(chapterPath), /terkunci/i);
  assert.equal(requests.length, 1);
});

test('HTTP errors and malformed content are rejected instead of displayed', async t => {
  for (const [name, response, expectedError] of [
    [
      'forbidden',
      () => jsonResponse({ pesan: 'Chapter terkunci' }, 403),
      /403/,
    ],
    [
      'missing parts',
      () => jsonResponse({ pesan: 'Isi tidak tersedia' }),
      /tidak valid/i,
    ],
    ['empty parts', () => jsonResponse({ k: 'AQID', p: [] }), /kosong/i],
  ]) {
    await t.test(name, async () => {
      const { plugin } = createPlugin(url => {
        if (url.pathname === chapterPath) return readerPage();
        if (url.pathname === '/baca/isi') return response();
      });
      await assert.rejects(plugin.parseChapter(chapterPath), expectedError);
    });
  }
});

test('a TOC containing only trap links is not accepted as a usable chapter list', async () => {
  const { plugin } = createPlugin(url => {
    if (url.pathname === novelPath) return novelPage();
    if (url.pathname === '/baca/daftar') {
      return jsonResponse({
        html: `<section id="daftar-chapter"><a class="trap-link" href="${baseUrl}/baca/arsip/contoh-novel/chapter-1">Chapter 1</a></section>`,
      });
    }
  });
  await assert.rejects(plugin.parseNovel(novelPath));
});
