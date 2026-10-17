// 浏览器回归：验证 DATA 变体的内容、比例、对比度与截图加载，不编码视频。
//   node --test tests/regression.mjs
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { launch } from '../scripts/lib/chrome.mjs';
import { SKILL_ROOT, createProject } from '../scripts/lib/project.mjs';

let chrome, project, serial = 0;
before(async () => {
  project = mkdtempSync(join(tmpdir(), 'riso-regression-'));
  createProject(project);
  chrome = await launch();
});
after(async () => {
  await chrome?.close();
  if (project) {
    assert.equal(dirname(project), tmpdir());
    rmSync(project, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});

function fixture(template, patch = {}) {
  const html = readFileSync(join(SKILL_ROOT, 'templates', template + '.html'), 'utf8');
  const block = html.match(/const DATA = (\{[\s\S]*?\n\});/);
  assert.ok(block, '模板必须有 DATA');
  const data = { ...Function('return (' + block[1] + ')')(), ...patch };
  const file = join(project, 'compositions', `${++serial}-${template}.html`);
  writeFileSync(file, html.replace(block[0], 'const DATA = ' + JSON.stringify(data, null, 2) + ';'));
  return file;
}

async function inspect(template, patch, check) {
  const page = await chrome.open(fixture(template, patch), { query: '?render' });
  try {
    await page.seek('end');
    await check(page);
  } finally { await page.close(); }
}

test('compare 保留整数和小数的最终值', async () => {
  for (const value of [40, 0.5, 0.125, 1.23, 1e-7]) {
    await inspect('compare', { before: { label: '以前', value, unit: '秒', base: value } }, async page => {
      assert.equal(await page.evaluate('document.querySelector("#ra .v").textContent'), String(value));
    });
  }
});

test('compare 的小数计数在中间帧也保留原精度', async () => {
  await inspect('compare', { before: { label: '以前', value: 0.5, unit: '秒', base: 0.5 } }, async page => {
    await page.seek(1.24); // 匀速爬升的 40%，应为 0.2
    assert.equal(await page.evaluate('document.querySelector("#ra .v").textContent'), '0.2');
  });
});

test('compare 保留 1000:1 的真实条长比例', async () => {
  await inspect('compare', {
    before: { label: '以前', value: 1000, unit: '秒', base: 1000 },
    after: { label: '现在', value: 1, unit: '秒', base: 1 },
  }, async page => {
    const widths = await page.evaluate('[...document.querySelectorAll(".row .bar")].map(e => e.getBoundingClientRect().width)');
    assert.ok(Math.abs(widths[1] - widths[0] / 1000) < 0.03, widths.join(':')); // 容许浏览器亚像素取整
  });
});

test('compare 的零值为零宽，两个零也不会出现 NaN', async () => {
  for (const [a, b] of [[100, 0], [0, 100], [0, 0]]) {
    await inspect('compare', {
      before: { label: '以前', value: a, unit: '次', base: a },
      after: { label: '现在', value: b, unit: '次', base: b },
    }, async page => {
      const widths = await page.evaluate('[...document.querySelectorAll(".row .bar")].map(e => parseFloat(getComputedStyle(e).width))');
      for (const [i, value] of [a, b].entries()) {
        assert.ok(Number.isFinite(widths[i]));
        if (value === 0) assert.equal(widths[i], 0);
        else assert.ok(widths[i] > 0);
      }
    });
  }
});

test('六步流程在四组色本下都通过 QA', async () => {
  for (const palette of ['pal-blue', 'pal-teal', 'pal-red', 'pal-ink']) {
    await inspect('steps', {
      palette, title: ['只有', 6, '步'],
      steps: ['准备', '选段', '排版', '样帧', '质检', '成片'],
    }, async page => {
      const errors = await page.evaluate('window.__riso.audit().issues.filter(i => i[0] === "error")');
      assert.deepEqual(errors, [], palette);
    });
  }
});

test('shot 缺失图片阻断渲染并指出路径', async () => {
  const file = fixture('shot', { img: '../assets/shots/missing.png' });
  await assert.rejects(chrome.open(file, { query: '?render' }), /图片.*missing\.png/);
});

test('shot 损坏图片阻断渲染', async () => {
  writeFileSync(join(project, 'assets/shots/broken.png'), 'not a PNG');
  const file = fixture('shot', { img: '../assets/shots/broken.png' });
  await assert.rejects(chrome.open(file, { query: '?render' }), /图片.*broken\.png/);
});

test('shot 有效图片完成解码后可渲染', async () => {
  writeFileSync(join(project, 'assets/shots/valid.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="#22308C"/></svg>');
  await inspect('shot', { img: '../assets/shots/valid.svg' }, async page => {
    assert.equal(await page.evaluate('document.querySelector("#plate img").naturalWidth'), 20);
    assert.deepEqual(await page.evaluate('window.__riso.audit().issues.filter(i => i[0] === "error")'), []);
  });
});

test('shot 没有图片时仍显示待替换占位', async () => {
  await inspect('shot', { img: '', note: null }, async page => {
    assert.equal(await page.evaluate('document.images.length'), 0);
    assert.match(await page.evaluate('document.querySelector("#plate").textContent'), /待替换/);
  });
});
