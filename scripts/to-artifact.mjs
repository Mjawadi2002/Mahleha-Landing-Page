// Turns dist/index.html into a page body for a claude.ai Artifact
// (the host adds its own doctype/html/head/body), and lists the files to publish with it.
import fs from 'node:fs';
import path from 'node:path';
const dist = path.resolve('dist');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta charset[^>]*>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .replace(/<title>[\s\S]*?<\/title>/, '<title>Mahleha</title>');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
fs.writeFileSync(path.join(dist, 'mahleha.html'), head.trim() + '\n' + body.trim() + '\n');
const files = {};
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else { const rel = path.relative(dist, p).split(path.sep).join('/'); if (!['index.html', 'mahleha.html', 'files.json'].includes(rel) && !/Phosphor-.*.(svg|ttf)$/.test(rel)) files[rel] = 'dist/' + rel; } } };
walk(dist);
fs.writeFileSync(path.join(dist, 'files.json'), JSON.stringify(files));
console.log(Object.keys(files).length, 'files');
