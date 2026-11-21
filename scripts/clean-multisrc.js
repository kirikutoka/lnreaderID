import fs from 'node:fs';
import path from 'node:path';

// Only generated plugin files are disposable; keep the generator sources.
const clean = directory => {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      clean(filename);
    } else if (entry.isFile() && /\[[^\]]+\]\.(ts|js)$/.test(entry.name)) {
      fs.unlinkSync(filename);
    }
  }
};

for (const directory of ['plugins', '.js/plugins', '.js/src/plugins']) {
  clean(directory);
}
