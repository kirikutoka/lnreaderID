const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const manifestPath = path.join(root, '.dist/plugins.json');

function writeIfChanged(relativePath, contents) {
  const target = path.join(root, relativePath);
  if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') === contents) {
    console.log(`${relativePath} is up to date.`);
    return;
  }
  fs.writeFileSync(target, contents);
  console.log(`Updated ${relativePath}.`);
}

function main() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      'Local plugin manifest is missing. Run npm run build:full first.',
    );
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const plugins = manifest
    .filter(plugin => plugin.lang === 'Bahasa Indonesia')
    .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  if (plugins.length === 0) {
    throw new Error('The local manifest contains no Indonesian plugins.');
  }

  const keys = {};
  for (const plugin of plugins) {
    const key = `${plugin.lang}: ${plugin.name}`;
    if (Object.hasOwn(keys, key)) {
      throw new Error(`Duplicate plugin display name: ${key}`);
    }
    keys[key] = plugin.id;
  }

  const template = fs.readFileSync(
    path.join(root, '.github/scripts/blank_report_issue.yml'),
    'utf8',
  );
  const options = Object.keys(keys)
    .map(key => `- '${key.replace(/'/g, "''")}'`)
    .join('\n        ');

  writeIfChanged(
    '.github/scripts/keys.json',
    `${JSON.stringify(keys, null, 2)}\n`,
  );
  writeIfChanged(
    '.github/ISSUE_TEMPLATE/report_issue.yml',
    template.replace('- PLUGIN_OPTIONS_PLACEHOLDER', options),
  );
  console.log(
    `Generated issue options for ${plugins.length} Indonesian plugins.`,
  );
}

try {
  main();
} catch (error) {
  console.error('Error generating issue template options:', error.message);
  process.exitCode = 1;
}
