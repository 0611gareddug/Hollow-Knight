// 빌드: src → (esbuild 번들) → (난독화) → docs/
// 사용: node tools/build.mjs        (배포용, 난독화 + 보호)
//       node tools/build.mjs --dev  (개발용, 난독화 없음 → .build/dev)
import { build } from 'esbuild';
import JavaScriptObfuscator from 'javascript-obfuscator';
import CleanCSS from 'clean-css';
import fs from 'fs';
import path from 'path';

const dev = process.argv.includes('--dev');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = dev ? path.join(root, '.build/dev') : path.join(root, 'docs');
fs.mkdirSync(out, { recursive: true });

const res = await build({
  entryPoints: [path.join(root, 'src/js/main.js')],
  bundle: true,
  format: 'iife',
  target: ['es2019'],
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  write: false,
  define: { __PROD__: dev ? 'false' : 'true' },
  legalComments: 'none',
});
let code = res.outputFiles[0].text;

if (!dev) {
  const t0 = Date.now();
  code = JavaScriptObfuscator.obfuscate(code, {
    compact: true,
    simplify: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    debugProtection: true,
    debugProtectionInterval: 3000,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    selfDefending: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.8,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 1,
    splitStrings: false,
    transformObjectKeys: false,
    unicodeEscapeSequence: false,
    numbersToExpressions: false,
    target: 'browser',
  }).getObfuscatedCode();
  console.log(`obfuscated in ${Date.now() - t0}ms`);
}
fs.writeFileSync(path.join(out, 'game.js'), code);

const css = fs.readFileSync(path.join(root, 'src/style.css'), 'utf8');
fs.writeFileSync(path.join(out, 'style.css'), dev ? css : new CleanCSS({ level: 1 }).minify(css).styles);
let html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
const ver = Date.now().toString(36);
html = html.replace('style.css"', `style.css?v=${ver}"`).replace('game.js"', `game.js?v=${ver}"`);
fs.writeFileSync(path.join(out, 'index.html'), html);
if (!dev) fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log(`built → ${path.relative(root, out)}  (${(code.length / 1024).toFixed(0)} KB)`);
