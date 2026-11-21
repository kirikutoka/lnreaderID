# Quick start

lnreaderID accepts plugins for Indonesian-language novel sources. Shared generators and runtime
helpers are retained to support these sources.

1. [Requirements](#requirements)
2. [Single plugin guide](#single-plugin-guide)
3. [Multi-source guide](#creating-multi-source-plugins)
4. [Testing your plugin](./testing.md)

### Requirements

- [git](https://git-scm.com/doc/ext) basics
- TypeScript or JavaScript basics
- Node.js >= 22
- Install the dependencies with `npm ci`

### Single plugin guide

1. Create your plugin script in `plugins/indonesian/` [<span style="font-size: 0.8rem;">(learn more)</span>](#creating-plugin-script)
2. Copy the code from [plugin-template.ts](./plugin-template.ts)
3. Start coding [<span style="font-size:0.8rem">(documentation)</span>](./docs.md)
4. Run `npm run check:plugin -- plugins/indonesian/yourPlugin.ts` before opening a PR — see [Testing your plugin](./testing.md)

#### Creating plugin script

1. Create your plugin inside `plugins/indonesian/`. This repository only includes sources
   serving novels in Indonesian.
2. The file should have the `.ts` extension.
   Existing example: [`plugins/indonesian/novelId.ts`](../plugins/indonesian/novelId.ts).
3. Follow the standard template structure ([`docs/plugin-template.ts`](./plugin-template.ts)):
   - **Coding style (`camelCase`)**: All code lines, properties, variables, methods, and parameters inside the plugin code must strictly follow `camelCase` (e.g. `popularNovels`, `pageNo`, `showLatestNovels`, `novelPath`, `chapterPath`, `releaseTime`, `chapterNumber`).
   - **Plugin ID**: `camelCase` or lowercase alphanumeric (`myNovelSite`, `novelId`), unique across the repo. Preserve existing IDs when updating plugins.
   - **Plugin class**: `PascalCase` (`MyNovelSitePlugin implements Plugin.PluginBase`).
   - **Export**: Always export an instantiated instance (`export default new MyNovelSitePlugin();`), not the class.
4. Add a 96x96px icon at `public/static/src/id/<plugin-name>/icon.png`, then reference it from
   your plugin as `icon = 'src/id/<plugin-name>/icon.png'` (without the `public/static` prefix
   — see [PluginBase::icon](./docs.md#pluginbaseicon)).

   > [!WARNING]
   > Icons use the **short** language code `id`, while plugin scripts use the full language
   > name `indonesian`.

### Creating multi-source plugins

Some sites run on the same off-the-shelf CMS/theme (WordPress themes, Madara, etc.), so instead of
writing a near-identical plugin by hand for each one, this repo generates them from a shared
template. That system lives in `plugins/multisrc/`, where each subfolder is one **generator** —
for example `plugins/multisrc/lightnovelwp/` covers sites using the LightNovel WordPress theme, and
`plugins/multisrc/madara/` covers sites using the Madara theme.

**Adding a new source to an existing generator** (the common case — check `plugins/multisrc/` first
to see if a generator already matches your target site's CMS):

1. Open the generator's folder, e.g. `plugins/multisrc/lightnovelwp/`, and add an entry for your
   site to its `sources.json`. Set `options.lang` to `Indonesian`.
2. Run `npm run build:multisrc` to materialize the actual plugin file(s) into
   `plugins/indonesian/<name>[<generator>].ts`. These files are generated; edit the generator's
   inputs instead of editing or committing the generated files.
3. Follow the generator's own `README.md` for anything specific to it — icon handling, available
   filters, and `sources.json` fields differ between generators (compare
   `plugins/multisrc/lightnovelwp/README.md` and `plugins/multisrc/madara/README.md` for examples).
4. [Test your plugin](./testing.md) the same way you would a single-source one.

**Adding a new generator** (only if no existing generator's CMS matches your target site) is a
larger undertaking — read an existing generator's `generator.js` and `template.ts` first to see the
shape expected by `plugins/multisrc/generate-multisrc-plugins.js`, which drives all generators via
`npm run build:multisrc`.
