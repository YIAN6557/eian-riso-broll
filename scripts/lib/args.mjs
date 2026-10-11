// 命令行参数：从 argv 里取走开关和带值选项，剩下的就是位置参数（文件名、台词……）
//   const a = cli(); const draft = a.has('--draft'), out = a.val('-o'); const files = a.rest;
export function cli(argv = process.argv.slice(2)) {
  const a = [...argv];
  return {
    has(flag) { const i = a.indexOf(flag); if (i < 0) return false; a.splice(i, 1); return true; },
    val(flag) { const i = a.indexOf(flag); if (i < 0) return null; const v = a[i + 1]; a.splice(i, 2); return v; },
    get rest() { return a; },
  };
}
