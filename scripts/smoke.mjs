/**
 * 冒烟测试脚本：对运行中的服务做基础端点检查
 * 用法：先启动服务（npm run dev / npm start），再执行 npm run smoke
 */
const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3000';

const checks = [
  ['GET /api/online', fetch(`${BASE}/api/online`)],
  ['GET /api/tags', fetch(`${BASE}/api/tags`)],
  ['GET /api/posts', fetch(`${BASE}/api/posts`)],
  ['GET /api/search?q=测试', fetch(`${BASE}/api/search?q=${encodeURIComponent('测试')}`)],
  ['GET /', fetch(`${BASE}/`)],
];

let failed = 0;
for (const [name, promise] of checks) {
  try {
    const res = await promise;
    const okFlag = res.ok || res.status === 404 || res.status === 401;
    console.log(`${okFlag ? '✅' : '❌'} ${name} -> ${res.status}`);
    if (!okFlag) failed += 1;
  } catch (err) {
    console.log(`❌ ${name} -> 请求失败: ${err.message}`);
    failed += 1;
  }
}
console.log(failed === 0 ? '\n冒烟测试全部通过 ✅' : `\n${failed} 项检查失败 ❌`);
process.exit(failed === 0 ? 0 : 1);
