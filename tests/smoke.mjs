#!/usr/bin/env node
// 一键自测：把 templates/ 里的全部模板放进一个临时项目，按真实流程跑一遍
//   样帧（--still）→ 成片（mp4）→ 质检（版面 + 成片时长 / 尺寸）→ 时长脚本（估算 + SRT）
// 任何一步失败，退出码 1。产物留在输出目录里，可以直接打开看。
//
//   node tests/smoke.mjs                    → 快速版（成片用 --draft）
//   node tests/smoke.mjs --full             → 成片用正式码率（看效果用这个）
//   node tests/smoke.mjs --alpha            → 另外渲一条透明底 ProRes（体积大，默认不跑）
//   node tests/smoke.mjs --out <目录>        → 指定输出目录（默认在系统临时目录）
//   node tests/smoke.mjs number quote       → 只测指定模板
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const has = f => { const i = args.indexOf(f); if (i < 0) return false; args.splice(i, 1); return true; };
const val = f => { const i = args.indexOf(f); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const FULL = has('--full'), ALPHA = has('--alpha');
const OUT = resolve(val('--out') || mkdtempSync(join(tmpdir(), 'riso-smoke-')));

const all = readdirSync(join(ROOT, 'templates')).filter(f => f.endsWith('.html')).map(f => f.slice(0, -5)).sort();
const names = args.length ? args : all;
const unknown = names.filter(n => !all.includes(n));
if (unknown.length) { console.error('没有这些模板：' + unknown.join(', ') + '\n可选：' + all.join(' ')); process.exit(2); }
if (existsSync(join(OUT, 'compositions'))) { console.error('输出目录里已经有项目了，换一个 --out：' + OUT); process.exit(2); }

// 和 new_project.sh 一样的项目结构：assets 整份拷入，模板放进 compositions/
mkdirSync(join(OUT, 'compositions'), { recursive: true });
cpSync(join(ROOT, 'assets'), join(OUT, 'assets'), { recursive: true });
const comps = names.map(n => {
  const f = join(OUT, 'compositions', n + '.html');
  cpSync(join(ROOT, 'templates', n + '.html'), f);
  return f;
});

const S = join(ROOT, 'scripts');

// shot 模板默认是“待替换”占位。再派生一条带真截图的 shot-image，才看得到截图的双色调效果；
// 截图就用另一个模板的末帧（仓库里不放任何外来图片）
if (names.includes('shot')) {
  const src = all.find(n => n !== 'shot'), shots = join(OUT, 'assets', 'shots');
  mkdirSync(shots, { recursive: true });
  const r = spawnSync(process.execPath, [join(S, 'render.mjs'), join(ROOT, 'templates', src + '.html'), '--still', '-o', join(shots, 'sample.png')], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(1);
  const html = readFileSync(join(ROOT, 'templates', 'shot.html'), 'utf8')
    .replace(/img:\s*'',/, "img: '../assets/shots/sample.png',")
    .replace(/note:\s*null,/, 'note: { x: .08, y: .14, w: .62, h: .2 },')
    .replace(/source:\s*'',/, "source: '截图 · 示例',");
  if (!html.includes('sample.png') || !html.includes('note: {')) { console.error('shot.html 的 DATA 格式变了，自测没法派生 shot-image'); process.exit(1); }
  const f = join(OUT, 'compositions', 'shot-image.html');
  writeFileSync(f, html);
  comps.push(f);
}

const steps = [];
function step(title, script, a) {
  console.log(`\n━━ ${title}`);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [join(S, script), ...a], { stdio: 'inherit' });
  const ok = r.status === 0;
  steps.push([ok, title, ((Date.now() - t0) / 1000).toFixed(1)]);
  return ok;
}

step('样帧（末帧海报 + contact sheet）', 'render.mjs', [...comps, '--still']);
step(`成片 mp4${FULL ? '' : '（--draft）'}`, 'render.mjs', [...comps, ...(FULL ? [] : ['--draft'])]);
step('质检：版面 + 成片时长 / 尺寸', 'qa.mjs', comps);
if (ALPHA) step('透明底 ProRes（' + names[0] + '）', 'render.mjs', [comps[0], '--alpha']);

// 时长脚本：语速估算 + 在一份 SRT 里定位句子
const srt = join(OUT, 'smoke.srt');
writeFileSync(srt, '1\n00:00:01,000 --> 00:00:03,000\n第一句字幕用来测试\n\n2\n00:00:03,000 --> 00:00:06,000\n以前要 8 分钟，现在 30 秒\n');
step('时长：语速估算', 'timing.mjs', ['以前要 8 分钟，现在 30 秒']);
step('时长：SRT 定位', 'timing.mjs', ['--srt', srt, '以前要8分钟，现在30秒']);

const failed = steps.filter(s => !s[0]).length;
console.log('\n━━ 结果');
for (const [ok, title, sec] of steps) console.log(`  ${ok ? '✅' : '❌'} ${title}  ${sec}s`);
console.log(`\n${names.length} 个模板 · ${failed ? failed + ' 步失败' : '全部通过'}`);
console.log(`产物：${OUT}\n  plates/sheet.jpg 末帧一览 · renders/*.mp4 成片 · qa/*-audit.png 质检叠层`);
process.exit(failed ? 1 : 0);
