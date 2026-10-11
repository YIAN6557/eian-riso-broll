#!/usr/bin/env node
// 时长：B-roll 的长度由口播决定，不是固定 5 秒。
//
//   node timing.mjs "做一张信息图，以前要 40 分钟，现在 2 分钟"
//       → 按语速估算（默认 4.5 字/秒，--rate 改）
//   node timing.mjs --srt examples/demo.srt "能挑出 12 处值得配画面的信息" "以前要 40 分钟，现在 2 分钟"
//       → 在字幕里找到这句话（忽略标点空格），给出精确的入点 / 出点 / 时长
//
// 建议 composition 时长 = 口播时长 + 0.6s（前后各留一点给剪辑点）；最短 3s。
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const take = f => { const i = args.indexOf(f); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const srtPath = take('--srt'), rate = +(take('--rate') || 4.5);
if (!args.length) { console.error('用法: timing.mjs [--srt file.srt] [--rate 4.5] "台词" ["台词" ...]'); process.exit(2); }

const norm = s => s.replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();
// 读音单位：一个汉字 = 1；一串英文/数字按“读出来”的长度粗估
function units(s) {
  let n = 0;
  for (const m of s.matchAll(/[一-鿿]|[a-z]+|\d+(?:\.\d+)?/gi)) {
    const w = m[0];
    if (/[一-鿿]/.test(w)) n += 1;
    else if (/^\d/.test(w)) n += Math.min(6, Math.max(1, w.replace('.', '').length * .8));   // 1800 ≈ “一千八” 3 字
    else n += Math.max(1, w.length / 3);
  }
  return n;
}
const suggest = d => Math.max(3, Math.round((d + .6) * 2) / 2);
const ts = t => { const m = Math.floor(t / 60), s = (t % 60).toFixed(2).padStart(5, '0'); return `${m}:${s}`; };

if (!srtPath) {
  for (const q of args) {
    const d = units(q) / rate;
    console.log(`“${q}”\n   ≈ ${units(q).toFixed(1)} 字 / ${rate} 字每秒 = 口播 ${d.toFixed(2)}s → 建议 duration: ${suggest(d)}`);
  }
  process.exit(0);
}

// 解析 SRT
const toSec = s => { const [h, m, r] = s.split(':'); return +h * 3600 + +m * 60 + +r.replace(',', '.'); };
const cues = readFileSync(srtPath, 'utf8').replace(/\r/g, '').split(/\n\n+/).map(b => {
  const l = b.trim().split('\n'); const i = l.findIndex(x => x.includes('-->'));
  if (i < 0) return null;
  const [a, z] = l[i].split('-->').map(x => toSec(x.trim()));
  return { a, z, text: norm(l.slice(i + 1).join('')) };
}).filter(Boolean);
// 拼成一条长串，记住每个字属于哪条字幕、在那条里的位置 → 句中入点按字数线性插值
let all = '', map = [];
cues.forEach((c, k) => { for (let j = 0; j < c.text.length; j++) map.push([k, j]); all += c.text; });
const at = (idx, end) => { const [k, j] = map[idx], c = cues[k], n = c.text.length; return c.a + (c.z - c.a) * ((j + (end ? 1 : 0)) / n); };

let miss = 0;
for (const q of args) {
  const nq = norm(q), i = all.indexOf(nq);
  if (i < 0) { console.log(`“${q}”\n   ✗ 字幕里没找到（检查错别字 / 数字写法：SRT 里可能是“一千八”而不是“1800”）`); miss++; continue; }
  const a = at(i, false), z = at(i + nq.length - 1, true), d = z - a;
  console.log(`“${q}”\n   入点 ${ts(a)}  出点 ${ts(z)}  口播 ${d.toFixed(2)}s → 建议 duration: ${suggest(d)}（剪辑台从 ${ts(Math.max(0, a - .3))} 放入）`);
}
process.exit(miss ? 1 : 0);
