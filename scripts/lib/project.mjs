// 项目目录：一条视频一个自包含的文件夹（assets 整份拷入，换机器也能渲）
//   <项目>/compositions/NN-名字.html   plates/ 样帧   renders/ 成片   qa/ 质检图   assets/ 样式·动效·字体·截图
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const PROJECTS_DIR = process.env.RISO_PROJECTS_DIR || join(homedir(), 'eian-riso-broll-projects');

// composition 所在的项目根：compositions/x.html → 项目根；散放的 x.html → 它所在的目录
export const projectOf = file => basename(dirname(file)) === 'compositions' ? dirname(dirname(file)) : dirname(file);

const STORYBOARD = `# 分镜表

| # | 原话落点 | 模板 | 色本 | 时长 | 屏幕文字（只用原话） | 截图锚点 |
|---|---|---|---|---|---|---|

落选段：
`;

// 新建项目目录；已存在且非空时报错，不覆盖
export function createProject(dir) {
  if (existsSync(join(dir, 'compositions'))) throw new Error('已存在: ' + dir);
  for (const d of ['compositions', 'plates', 'renders', 'qa', 'assets/shots']) mkdirSync(join(dir, d), { recursive: true });
  cpSync(join(SKILL_ROOT, 'assets'), join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'STORYBOARD.md'), STORYBOARD);
  return dir;
}

// 把模板拷进项目：addTemplate(proj, 'number', '03-number') → compositions/03-number.html
export function addTemplate(dir, template, name = template) {
  const f = join(dir, 'compositions', name + '.html');
  cpSync(join(SKILL_ROOT, 'templates', template + '.html'), f);
  return f;
}
