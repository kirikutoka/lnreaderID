# lnreaderID

Repositori plugin [LNReader](https://github.com/LNReader/lnreader) khusus sumber novel berbahasa Indonesia. Repositori utama: [kirikutoka/lnreaderID](https://github.com/kirikutoka/lnreaderID).

## Cakupan

- **Plugin mandiri:** Grensia, IndoWebNovel, MeioNovel, NovelID, NovelRingan, dan SakuraNovel.
- **Madara:** WBNovel, Vanovel, dan NovelBookID.
- **LightNovelWP:** Baca Light Novel dan Sekte Novel.
- **MTLNovel:** MTL Novel (ID).

Generator multisrc hanya memuat sumber berbahasa Indonesia. Kode runtime, playground, dan alat build dipertahankan untuk mengembangkan serta menguji plugin tersebut.

## Pengembangan lokal

Gunakan Node.js 22 atau lebih baru dan npm.

```sh
git clone https://github.com/kirikutoka/lnreaderID.git
cd lnreaderID
npm ci
npm run dev:start
```

Playground tersedia di [localhost:3000](http://localhost:3000).

```sh
npm run lint
npm run format:check
npm run build:full
npm run check:plugin -- plugins/indonesian/novelId.ts
```

`build:full` menghasilkan plugin di `.js/` dan manifest di `.dist/`; perintah ini tidak melakukan push. Hasil generate multisrc, hasil build, serta `.env` tidak perlu dimasukkan ke commit.

## Struktur

- `plugins/indonesian/`: plugin mandiri dan hasil generate multisrc.
- `plugins/multisrc/`: generator, template, dan daftar sumber Indonesia.
- `public/static/src/id/`: ikon serta aset plugin mandiri.
- `public/static/multisrc/`: aset yang dipakai generator Indonesia.
- `src/`: playground, tipe plugin, dan helper runtime.
- `scripts/`: alat build, pemeriksaan situs, dan penerbitan.

## Panduan dan kontribusi

- [Mulai membuat plugin](docs/quickstart.md)
- [API plugin](docs/docs.md)
- [Pengujian plugin](docs/testing.md) dan [playground](docs/website-tutorial.md)
- [Standar kode](CODING_STANDARDS.md)
- [Laporan masalah dan permintaan sumber Indonesia](https://github.com/kirikutoka/lnreaderID/issues)

Proyek ini menggunakan fondasi [LNReader Plugins](https://github.com/LNReader/lnreader-plugins) dan tersedia dengan [lisensi MIT](LICENSE). Pengembang tidak berafiliasi dengan penyedia konten.
