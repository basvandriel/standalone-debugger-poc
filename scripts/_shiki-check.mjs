import { createHighlighter } from 'shiki';
import fs from 'node:fs';

const highlighter = await createHighlighter({
  themes: ['css-variables'],
  langs: ['rust']
});

const code = fs.readFileSync('./fixtures/loop-demo/src/main.rs', 'utf8');
const html = highlighter.codeToHtml(code, { lang: 'rust', theme: 'css-variables' });

console.log(html.slice(0, 1500));
console.log('---');
console.log('total length:', html.length);
console.log('line span count:', (html.match(/<span class="line">/g) || []).length);
console.log('actual newlines in source:', code.split('\n').length);
