// Turns the single-file build into a page fragment for a hosted preview:
// keeps <title>, font links and inlined CSS/JS, drops the document skeleton.
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('dist-single/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const keep = [
  head.match(/<title>[\s\S]*?<\/title>/)[0],
  '<meta name="claude:viewport-fit-sides" content="cover">',
  ...head.match(/<link rel="preconnect"[^>]*>|<link href="https:\/\/fonts[^>]*>/g),
  ...head.match(/<style[\s\S]*?<\/style>/g),
  ...head.match(/<script type="module"[\s\S]*?<\/script>/g),
];
writeFileSync('dist-single/mote-preview.html', keep.join('\n') + '\n' + body.trim() + '\n');
console.log('wrote dist-single/mote-preview.html');
