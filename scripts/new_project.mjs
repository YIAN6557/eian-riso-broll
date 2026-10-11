#!/usr/bin/env node
// 新建项目：node new_project.mjs <项目名>  → 打印项目路径
// 落在 $RISO_PROJECTS_DIR（默认 ~/eian-riso-broll-projects）/<项目名>/；assets 整份拷入，项目自包含
import { join } from 'node:path';
import { createProject, PROJECTS_DIR } from './lib/project.mjs';

const name = process.argv[2];
if (!name) { console.error('用法: new_project.mjs <项目名，如 2026-10-07-第12期>'); process.exit(2); }
try {
  console.log(createProject(join(PROJECTS_DIR, name)));
} catch (e) { console.error(e.message); process.exit(1); }
