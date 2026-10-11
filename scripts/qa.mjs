#!/usr/bin/env node
// 质检：node qa.mjs compositions/*.html
//   1. 版面（末帧，镜头归零后的版面坐标）：安全区、右侧按钮栏、字号、对比度、文字互压、fit 溢出 —— 由页面里的 __riso.audit() 计算
//   2. 成片（renders/<id>.mp4 存在时）：时长、尺寸
// 每条输出 qa/<id>-audit.png：安全区叠层 + 红框标出问题元素。有 error 时退出码 1。
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { launch } from './lib/chrome.mjs';

const files = process.argv.slice(2).map(f => resolve(f));
if (!files.length) { console.error('用法: qa.mjs <composition.html> [...]'); process.exit(2); }
const projectOf = f => basename(dirname(f)) === 'compositions' ? dirname(dirname(f)) : dirname(f);

const OVERLAY = issues => `(() => {
  const o = document.createElement('div'); o.id = '__qa';
  o.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;font:600 22px monospace';
  const box = (x, y, w, h, css) => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;left:'+x+'px;top:'+y+'px;width:'+w+'px;height:'+h+'px;'+css; o.appendChild(d); return d; };
  box(0, 0, 1080, 168, 'background:rgba(255,0,0,.10)');
  box(0, 1330, 1080, 590, 'background:repeating-linear-gradient(45deg,rgba(0,0,0,.10) 0 12px,transparent 12px 24px)');
  box(56, 168, 968, 1162, 'outline:3px dashed rgba(0,160,90,.9)');
  box(930, 880, 150, 620, 'background:rgba(255,140,0,.16);outline:2px solid rgba(255,140,0,.6)');
  const t = box(0, 1340, 1080, 40, 'color:#000;text-align:center'); t.textContent = '字幕床（只放装饰）';
  ${JSON.stringify(issues)}.forEach(([lv, who, msg, r], i) => { if (!r) return;
    const b = box(r[0] - 4, r[1] - 4, r[2] + 8, r[3] + 8, 'outline:5px solid ' + (lv === 'error' ? '#E00' : '#F80'));
    const l = document.createElement('div'); l.textContent = (i + 1); l.style.cssText = 'position:absolute;left:-4px;top:-34px;background:#E00;color:#fff;padding:2px 8px'; b.appendChild(l); });
  document.body.appendChild(o);
})()`;

const probe = (args) => spawnSync(args[0], args.slice(1), { encoding: 'utf8' });
let errors = 0, warns = 0;
const chrome = await launch();
try {
  for (const file of files) {
    const page = await chrome.open(file, { query: '?render' });
    const m = await page.meta();
    await page.seek('end');
    const a = await page.evaluate('window.__riso.audit()');
    const issues = a.issues;

    // 成片检查
    const mp4 = join(projectOf(file), 'renders', m.id + '.mp4');
    if (existsSync(mp4)) {
      const p = probe(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'format=duration:stream=width,height', '-of', 'json', mp4]);
      const j = JSON.parse(p.stdout || '{}'), v = (j.streams || [])[0] || {};
      const dur = +j.format?.duration;
      if (Math.abs(dur - m.duration) > .1) issues.push(['warn', 'render', `成片时长 ${dur?.toFixed(2)}s ≠ composition ${m.duration}s（改过时长没重渲？）`]);
      if (v.width !== 1080 || v.height !== 1920) issues.push(['error', 'render', `成片尺寸 ${v.width}×${v.height}，应为 1080×1920`]);
    } else issues.push(['info', 'render', '还没有成片（只检查了版面）']);

    // 叠层截图
    const out = join(projectOf(file), 'qa', m.id + '-audit.png');
    mkdirSync(dirname(out), { recursive: true });
    await page.evaluate(OVERLAY(issues));
    writeFileSync(out, await page.shot('png'));
    await page.close();

    const e = issues.filter(i => i[0] === 'error').length, w = issues.filter(i => i[0] === 'warn').length;
    errors += e; warns += w;
    console.log(`${e ? '✗' : w ? '△' : '✓'} ${m.id}  ${m.duration}s · ${a.texts} 个文字元素  → ${out}`);
    issues.forEach(([lv, who, msg, r], i) => console.log(`   ${lv === 'error' ? 'ERROR' : lv === 'warn' ? 'warn ' : 'info '} ${r ? '[' + (i + 1) + '] ' : ''}${who}: ${msg}`));
  }
} finally { await chrome.close(); }
console.log(`\n${files.length} 条 · ${errors} error · ${warns} warn`);
process.exit(errors ? 1 : 0);
