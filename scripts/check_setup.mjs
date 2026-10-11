#!/usr/bin/env node
// 环境自检：Node ≥ 22（自带 WebSocket）、Chrome/Chromium（真的启动一次）、ffmpeg/ffprobe、assets（样式·动效·字体）
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findChrome, launch } from './lib/chrome.mjs';
import { SKILL_ROOT } from './lib/project.mjs';

let pass = 0, fail = 0;
const ok = m => { console.log('  ✅ ' + m); pass++; };
const bad = (m, detail) => { console.log('  ❌ ' + m); if (detail) console.log(detail.replace(/^/gm, '       ')); fail++; };
console.log('eian-riso-broll 环境自检\n');

const major = +process.versions.node.split('.')[0];
major >= 22 ? ok('node ' + process.version) : bad(`node ${process.version} 太旧：需要 ≥ 22（渲染器用 Node 自带的 WebSocket）`);

// 不只找到路径，还真的启动一次：沙箱、缺库这类问题只有启动时才会暴露
try {
  const path = findChrome();
  const c = await launch(); await c.close();
  ok('Chrome: ' + path);
} catch (e) { bad('Chrome 不可用（可用环境变量 CHROME=<路径> 指定）：', e.message); }

for (const bin of ['ffmpeg', 'ffprobe']) {
  const r = spawnSync(bin, ['-version'], { encoding: 'utf8' });
  r.status === 0 ? ok(`${bin} ${r.stdout.split('\n')[0].split(' ')[2]}`) : bad('没有 ' + bin);
}

const assets = ['riso.css', 'riso.js', 'gsap.min.js', ...['serif', 'sans', 'num', 'mono'].map(f => `fonts/riso-${f}.woff2`)];
for (const f of assets) existsSync(join(SKILL_ROOT, 'assets', f)) ? ok('assets/' + f) : bad('缺 assets/' + f);

console.log(fail ? `\n${fail} 项未通过。` : `\n全部通过（${pass} 项）。`);
process.exit(fail ? 1 : 0);
