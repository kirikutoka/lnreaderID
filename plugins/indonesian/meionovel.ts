import { load, CheerioAPI } from 'cheerio';
import { fetchApi } from '@libs/fetch';
import { NovelStatus } from '@libs/novelStatus';
import { Plugin } from '@/types/plugin';

type PageContext = {
  url: string;
  html: CheerioAPI;
  csrf: string;
  cookie: string;
  fetchedAt: number;
};

type ListConfig = { url: string; novel: number; token: string };
type ContentPayload = { k: string; n?: number; p: [number, string][] };

// Decode only JavaScript string literals supplied in Alpine's configuration.
// Never evaluate page scripts or the surrounding x-data expression.
function decodeLiteral(value: string): string {
  return JSON.parse('"' + value.replace(/\\'/g, "'") + '"');
}

function decodeBase64(value: string): Uint8Array {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const text = value.replace(/\s/g, '').replace(/=+$/, '');
  if (!/^[A-Za-z0-9+/]*$/.test(text) || text.length % 4 === 1) {
    throw new Error('MeioNovel: data bab tidak valid.');
  }
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of text) {
    buffer = (buffer << 6) | alphabet.indexOf(character);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 255);
    }
  }
  return new Uint8Array(bytes);
}

function decodeContent(payload: ContentPayload): string {
  if (!payload || typeof payload.k !== 'string' || !Array.isArray(payload.p)) {
    throw new Error('MeioNovel: respons isi bab tidak valid.');
  }
  const key = decodeBase64(payload.k);
  if (!key.length || !payload.p.length) {
    throw new Error('MeioNovel: isi bab kosong.');
  }
  const parts = payload.p.slice().sort((a, b) => a[0] - b[0]);
  const seen = new Set<number>();
  return parts
    .map(([index, part]) => {
      if (!Number.isInteger(index) || index < 0 || seen.has(index)) {
        throw new Error('MeioNovel: urutan data bab tidak valid.');
      }
      seen.add(index);
      const bytes = decodeBase64(part);
      let utf8 = '';
      for (let offset = 0; offset < bytes.length; offset++) {
        const byte = bytes[offset] ^ key[(offset + index) % key.length];
        utf8 += '%' + ('0' + byte.toString(16)).slice(-2);
      }
      return decodeURIComponent(utf8);
    })
    .join('');
}

class MeioNovel implements Plugin.PagePlugin {
  id = 'meionovel';
  name = 'MeioNovel';
  site = 'https://meionovels.com';
  version = '3.0.0';
  icon = 'src/id/meionovel/icon.png';

  private cachedPage?: PageContext;

  private normalizePath(value: string): string {
    const url = new URL(value, this.site + '/');
    if (url.origin !== this.site || !url.pathname.startsWith('/novel/')) {
      throw new Error('MeioNovel: alamat novel atau bab tidak valid.');
    }
    const path = url.pathname.replace(/^\/+|\/+$/g, '') + '/';
    const track = url.searchParams.get('jalur');
    return path + (track === 'mtl' || track === 'htl' ? `?jalur=${track}` : '');
  }

  resolveUrl(path: string): string {
    return `${this.site}/${this.normalizePath(path)}`;
  }

  private httpError(status: number): Error {
    const message =
      status === 403 || status === 503
        ? 'Buka MeioNovel di WebView untuk memeriksa akses situs.'
        : status === 419
          ? 'Sesi MeioNovel kedaluwarsa. Muat ulang atau buka situs di WebView.'
          : status === 429
            ? 'Terlalu banyak permintaan ke MeioNovel. Coba lagi nanti.'
            : 'Permintaan ke MeioNovel gagal.';
    return Object.assign(new Error(`${message} (HTTP ${status})`), { status });
  }

  private async getPage(url: string, refresh = false): Promise<PageContext> {
    if (
      !refresh &&
      this.cachedPage?.url === url &&
      Date.now() - this.cachedPage.fetchedAt < 60_000
    ) {
      return this.cachedPage;
    }
    const response = await fetchApi(url);
    if (!response.ok) throw this.httpError(response.status);
    const html = load(await response.text());
    // Browser/Android cookie jars handle this automatically. Node's checker
    // needs the anonymous session returned with the matching CSRF token.
    const setCookie = response.headers.get('set-cookie') || '';
    const cookies: string[] = [];
    const cookiePattern = /(?:^|,)\s*([^=;,\s]+)=([^;]*)/g;
    let match: RegExpExecArray | null;
    while ((match = cookiePattern.exec(setCookie))) {
      cookies.push(`${match[1]}=${match[2]}`);
    }
    const page = {
      url,
      html,
      csrf: html('meta[name="csrf-token"]').attr('content') || '',
      cookie: cookies.join('; '),
      fetchedAt: Date.now(),
    };
    this.cachedPage = page;
    return page;
  }

  private async pageRequest<T>(
    pageUrl: string,
    request: (html: CheerioAPI) => { url: string; body: object },
    refresh = false,
  ): Promise<{ page: PageContext; data: T }> {
    const page = await this.getPage(pageUrl, refresh);
    const spec = request(page.html);
    const endpoint = new URL(spec.url, this.site);
    if (
      endpoint.origin !== this.site ||
      !/^\/baca\/(daftar|isi)\/?$/.test(endpoint.pathname)
    ) {
      throw new Error('MeioNovel: alamat pemuatan bab tidak valid.');
    }
    if (!page.csrf) {
      throw new Error('MeioNovel: token sesi tidak ditemukan. Buka WebView.');
    }
    const response = await fetchApi(endpoint.href, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-TOKEN': page.csrf,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': pageUrl,
        ...(page.cookie ? { Cookie: page.cookie } : {}),
      },
      body: JSON.stringify(spec.body),
    });
    if (response.status === 419 && !refresh) {
      return this.pageRequest(pageUrl, request, true);
    }
    if (!response.ok) throw this.httpError(response.status);
    return { page, data: (await response.json()) as T };
  }

  private async catalog(url: string): Promise<Plugin.NovelItem[]> {
    const { html: $ } = await this.getPage(url);
    const novels: Plugin.NovelItem[] = [];
    const seen = new Set<string>();
    $('main article').each((_, element) => {
      const card = $(element);
      const link = card.find('h3 a[href*="/novel/"]').first();
      const href = link.attr('href');
      const name = link.text().trim();
      if (!href || !name) return;
      const path = this.normalizePath(href);
      if (seen.has(path)) return;
      seen.add(path);
      const image = card.find('img').first().attr('src');
      novels.push({
        path,
        name,
        cover: image ? new URL(image, this.site).href : undefined,
      });
    });
    return novels;
  }

  async popularNovels(
    page: number,
    options: Plugin.PopularNovelsOptions,
  ): Promise<Plugin.NovelItem[]> {
    const sort = options.showLatestNovels ? 'terbaru' : 'populer';
    return this.catalog(`${this.site}/jelajahi?sort=${sort}&page=${page}`);
  }

  async searchNovels(term: string, page: number): Promise<Plugin.NovelItem[]> {
    return this.catalog(
      `${this.site}/jelajahi?q=${encodeURIComponent(term)}&page=${page}`,
    );
  }

  private async chapterList(novelPath: string, pageNumber: number) {
    const url = this.resolveUrl(novelPath);
    const result = await this.pageRequest<{ html: string }>(url, $ => {
      const expression = $('[x-data^="chapterList("]').attr('x-data') || '';
      const match = expression.match(
        /^chapterList\(JSON\.parse\('((?:\\.|[^'\\])*)'\)\)$/,
      );
      if (!match) throw new Error('MeioNovel: konfigurasi daftar bab berubah.');
      const config: ListConfig = JSON.parse(decodeLiteral(match[1]));
      if (!config.novel || !config.token) {
        throw new Error('MeioNovel: konfigurasi daftar bab tidak lengkap.');
      }
      const params: Record<string, string> = {
        page: String(pageNumber),
        urut: 'asc',
      };
      const track = new URL(url).searchParams.get('jalur');
      if (track) params.jalur = track;
      return {
        url: config.url,
        body: { novel: config.novel, token: config.token, params },
      };
    });
    if (typeof result.data.html !== 'string') {
      throw new Error('MeioNovel: respons daftar bab tidak valid.');
    }
    const $ = load(result.data.html);
    const chapters: Plugin.ChapterItem[] = [];
    const seen = new Set<string>();
    const novelPrefix = new URL(url).pathname.replace(/\/+$/, '') + '/';
    $('a[id^="ch-"]').each((_, element) => {
      const link = $(element);
      if (link.hasClass('trap-link')) return;
      const href = link.attr('href');
      if (!href) return;
      const target = new URL(href, this.site);
      if (
        target.origin !== this.site ||
        !target.pathname.startsWith(novelPrefix) ||
        target.pathname === novelPrefix
      ) {
        return;
      }
      const path = this.normalizePath(href);
      if (seen.has(path)) return;
      seen.add(path);
      const spans = link.children('span');
      const label = spans.eq(0).text().trim();
      const title = spans.eq(1).text().trim();
      let name = title
        ? title.includes(label)
          ? title
          : `${label} — ${title}`
        : label;
      const volume = link
        .closest('[id^="vol-"]')
        .parent()
        .find('h3 button > span')
        .first()
        .text()
        .trim();
      if (volume && !name.toLowerCase().startsWith(volume.toLowerCase())) {
        name = `${volume} — ${name}`;
      }
      if (link.find('[title*="terkunci"], [title*="VIP"]').length) {
        name = '🔒 ' + name;
      }
      chapters.push({
        name,
        path,
        chapterNumber: (pageNumber - 1) * 100 + chapters.length + 1,
        releaseTime: link.find('time[datetime]').attr('datetime'),
        scanlator: /\/htl\//.test(target.pathname)
          ? 'HTL'
          : /\/mtl\//.test(target.pathname)
            ? 'MTL'
            : undefined,
      });
    });
    let totalPages = 1;
    $('nav a[href], select option[value]').each((_, element) => {
      const href = $(element).attr('href') || $(element).attr('value');
      if (!href) return;
      const page = Number(new URL(href, this.site).searchParams.get('page'));
      if (Number.isInteger(page) && page > totalPages) totalPages = page;
    });
    return { chapters, totalPages, html: result.page.html };
  }

  async parseNovel(
    novelPath: string,
  ): Promise<Plugin.SourceNovel & { totalPages: number }> {
    const path = this.normalizePath(novelPath);
    const { chapters, totalPages, html: $ } = await this.chapterList(path, 1);
    if (!chapters.length) {
      throw new Error(
        'MeioNovel: daftar bab tidak ditemukan. Periksa halaman novel di WebView.',
      );
    }
    const heading = $('main h1').first();
    const box = heading.parent();
    const name = heading.text().trim();
    if (!name) throw new Error('MeioNovel: judul novel tidak ditemukan.');
    const statusText = box.children('div').first().text();
    const status = /Tamat/i.test(statusText)
      ? NovelStatus.Completed
      : /Berjalan/i.test(statusText)
        ? NovelStatus.Ongoing
        : /Hiatus/i.test(statusText)
          ? NovelStatus.OnHiatus
          : /Dihentikan/i.test(statusText)
            ? NovelStatus.Cancelled
            : NovelStatus.Unknown;
    const summary = box
      .children('div')
      .filter((_, element) => $(element).children('p').length > 0)
      .first()
      .children('p')
      .map((_, element) => $(element).text().trim())
      .get()
      .join('\n\n');
    const cover = $('meta[property="og:image"]').attr('content');
    return {
      path,
      name,
      cover: cover ? new URL(cover, this.site).href : undefined,
      author: box.find('a[href*="/novel-author/"]').text().trim() || undefined,
      artist: box.find('a[href*="/novel-artist/"]').text().trim() || undefined,
      genres: box
        .find('a[href*="/novel-genre/"]')
        .map((_, element) => $(element).text().trim())
        .get()
        .join(', '),
      summary,
      status,
      chapters,
      totalPages,
    };
  }

  async parsePage(novelPath: string, page: string): Promise<Plugin.SourcePage> {
    const pageNumber = Number(page);
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      throw new Error('MeioNovel: nomor halaman tidak valid.');
    }
    const { chapters } = await this.chapterList(novelPath, pageNumber);
    return { chapters };
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const url = this.resolveUrl(chapterPath);
    const { data } = await this.pageRequest<ContentPayload>(url, $ => {
      const config = $('[x-data^="reader("]').attr('x-data') || '';
      const chapter = config.match(/\bchapterId\s*:\s*(\d+)/)?.[1];
      const endpoint = config.match(
        /\bcontentUrl\s*:\s*'((?:\\.|[^'\\])*)'/,
      )?.[1];
      const token = config.match(
        /\bcontentToken\s*:\s*'((?:\\.|[^'\\])*)'/,
      )?.[1];
      if (!token) {
        const message = /Chapter ini terkunci|Masuk untuk membuka/i.test(
          $('main').text(),
        )
          ? 'Bab ini terkunci. Buka situs di WebView untuk memeriksa akses akun.'
          : 'Konfigurasi isi bab tidak ditemukan. Muat ulang atau buka WebView.';
        throw new Error(`MeioNovel: ${message}`);
      }
      if (!chapter || !endpoint) {
        throw new Error('MeioNovel: konfigurasi pembaca tidak lengkap.');
      }
      return {
        url: decodeLiteral(endpoint),
        body: { chapter: Number(chapter), token: decodeLiteral(token) },
      };
    });
    const $ = load(decodeContent(data), null, false);
    $(
      'script, style, iframe, form, button, .trap-link, .adsbygoogle, ins',
    ).remove();
    $('img[src]').each((_, element) => {
      const image = $(element);
      const src = new URL(image.attr('src') || '', this.site);
      if (src.protocol === 'https:' || src.protocol === 'http:') {
        image.attr('src', src.href);
      } else {
        image.remove();
      }
    });
    const html = $.html().trim();
    if (!$.root().text().trim() && !$('img').length) {
      throw new Error('MeioNovel: isi bab kosong.');
    }
    return html;
  }
}

export default new MeioNovel();
