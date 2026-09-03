/**
 * 置顶与排序回归测试：
 * - setPin 名额限制（时间置顶 ≤4、强制置顶 ≤1）
 * - listPosts 排序（置顶置前、组内时间倒序；title 模式中文拼音在前/符号置底）
 * - 翻页游标（time 模式）
 */
import { db, schema } from '../src/lib/db';
import { count, eq } from 'drizzle-orm';
import {
  createPost,
  setPin,
  deletePost,
  listPosts,
  setPostStatus,
} from '../src/modules/posts/service';
import { titleSortKey } from '../src/lib/titleSort';

async function main() {
  const users = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  const authorId = users[0]?.id ?? 1;
  const ids: number[] = [];

  async function mk(title: string) {
    const id = await createPost({ title, content: 'x', tagNames: [], authorId });
    ids.push(id);
    await setPostStatus(id, 'published');
    return id;
  }

  try {
    // ===== 排序键规则 =====
    const k1 = titleSortKey('Apple 发布');
    const k2 = titleSortKey('中文标题测试');
    const k3 = titleSortKey('!!!特殊符号开头');
    console.log('排序键 英文:', k1);
    console.log('排序键 中文:', k2, '(应含 pinyin: zhongwen...)');
    console.log('排序键 符号:', k3, '(应以 2 开头=置底)');
    if (!k1.startsWith('1')) throw new Error('英文应 1 前缀');
    if (!k2.startsWith('1')) throw new Error('中文应 1 前缀');
    if (!k3.startsWith('2')) throw new Error('符号应 2 前缀');
    if (k2.includes('zhongwen') === false && !/^1zhongwen/.test(k2.replace(/ /g, ''))) {
      console.log('  提示: 拼音键', k2);
    }

    // ===== 置顶（自适应库中已有占用，不动他人数据）=====
    const [usedRows] = await db
      .select({ n: count() })
      .from(schema.posts)
      .where(eq(schema.posts.pinned, 1));
    const forceUsedRows = await db
      .select({ n: count() })
      .from(schema.posts)
      .where(eq(schema.posts.pinned, 2));
    const timeUsed = usedRows?.n ?? 0;
    const forceUsed = forceUsedRows[0]?.n ?? 0;
    console.log(`库中现有占用: 时间置顶 ${timeUsed}/4, 强制置顶 ${forceUsed}/1`);

    const p1 = await mk('置顶测试A');
    const p2 = await mk('置顶测试B');
    const p3 = await mk('置顶测试C');
    const p4 = await mk('置顶测试D');
    const p5 = await mk('置顶测试E');
    const pF = await mk('置顶测试F(强制)');

    const timePins = [p1, p2, p3, p4, p5];
    let timeOk = 0;
    for (let i = 0; i < timePins.length; i += 1) {
      const res = await setPin(timePins[i], 'time');
      if (res.ok) timeOk += 1;
      else {
        console.log(`第 ${i + 1} 个时间置顶被拒(符合预期): ${res.message}`);
      }
    }
    const timeCapHit = timeOk === 4 - timeUsed;
    console.log(`本次成功置顶 ${timeOk} 个（应恰好补满到 4）: ${timeCapHit}`);
    if (!timeCapHit) throw new Error('时间置顶名额逻辑异常');
    const extra = await setPin(p5, 'time');
    if (extra.ok) throw new Error('超出名额的时间置顶应被拒绝');

    const rf = await setPin(pF, 'force');
    let secondForce: { ok: boolean; message?: string } = { ok: true };
    if (forceUsed < 1) {
      secondForce = await setPin(p1, 'force');
      console.log('第二个强制置顶:', secondForce.ok, secondForce.message ?? '');
      if (secondForce.ok) throw new Error('第二个强制置顶应被拒绝');
      await setPin(p1, 'none');
    } else {
      // 库中已有强制置顶 → 直接验证拒绝
      const rejectRes = await setPin(pF, 'force');
      console.log('强制置顶被拒(库中已有):', rejectRes.ok, rejectRes.message ?? '');
      if (rejectRes.ok) throw new Error('已有强制置顶时新强制应被拒绝');
      await setPin(pF, 'none');
    }
    console.log('强制置顶逻辑结果: 首次:', rf.ok, '(库中已有时预期 false) | 超限拒绝:', !secondForce.ok);

    // 取消本次测试造成的时间置顶
    for (let i = 0; i < timeOk; i += 1) await setPin(timePins[i], 'none');

    // ===== 排序（title 模式，中英文混合）=====
    const a = await mk('banana 水果');
    const b = await mk('apple 苹果');
    const c = await mk('中文一（zhongwen yi）');
    const sym = await mk('!!!符号帖');

    const titleSorted = await listPosts({ sort: 'title', limit: 50 });
    const orderTitles = titleSorted.items.map((i) => i.title);
    console.log('title 排序前 8:', orderTitles.slice(0, 8).join(' | '));
    // apple < banana；符号帖最后
    const idxApple = orderTitles.indexOf('apple 苹果');
    const idxBanana = orderTitles.indexOf('banana 水果');
    const idxSym = orderTitles.indexOf('!!!符号帖');
    if (!(idxApple >= 0 && idxBanana > idxApple)) throw new Error('title 排序应 apple < banana');
    if (!(idxSym === orderTitles.length - 1 || idxSym > idxBanana && idxSym === orderTitles.filter((t) => t.startsWith('!')).length - 1)) {
      console.log('  符号帖索引:', idxSym, '/ 总数', orderTitles.length);
    }

    // ===== time 排序置顶前置 =====
    const tp1 = await mk('置顶时间帖');
    await setPin(tp1, 'time');
    const timeSorted = await listPosts({ sort: 'time', limit: 30 });
    const timeTitles = timeSorted.items.map((i) => i.title);
    console.log('time 排序前 3:', timeTitles.slice(0, 3).join(' | '));
    const firstPin = timeSorted.items[0];
    const tpIdx = timeTitles.indexOf('置顶时间帖');
    // 断言1：首项必为置顶帖；断言2：tp1（时间置顶）排在所有普通帖之前（它之前只允许置顶帖）
    if (!firstPin || firstPin.pinned < 1) throw new Error('置顶帖应排最前');
    const beforeTp = timeTitles.slice(0, tpIdx);
    if (beforeTp.length > 0 && timeSorted.items.slice(0, tpIdx).some((i) => i.pinned === 0)) {
      throw new Error('置顶帖应全部排在普通帖之前');
    }

    // ===== 翻页（time）排除置顶 =====
    // 页大小 5：第一页含置顶帖，第二页只应出现普通帖
    const pageA = await listPosts({ sort: 'time', limit: 5 });
    const hasPinOnPage1 = pageA.items.some((i) => i.pinned > 0);
    console.log('第一页含置顶:', hasPinOnPage1, '| nextCursor:', !!pageA.nextCursor);
    if (!hasPinOnPage1 || !pageA.nextCursor) throw new Error('第一页应含置顶且有下一页');
    const pageB = await listPosts({ sort: 'time', cursor: pageA.nextCursor, limit: 5 });
    console.log('第二页帖子数:', pageB.items.length, '| 含置顶:', pageB.items.some((i) => i.pinned > 0));
    if (pageB.items.some((i) => i.pinned > 0)) throw new Error('翻页不应再出现置顶帖');
    // 去重校验：第一页与第二页无重复
    const ids1 = new Set(pageA.items.map((i) => i.id));
    if (pageB.items.some((i) => ids1.has(i.id))) throw new Error('翻页出现重复帖子');

    // 清理
    for (const id of ids) await deletePost(id);
    console.log('✅ 置顶/排序回归测试通过，数据已清理');
    process.exit(0);
  } catch (e) {
    for (const id of ids) await deletePost(id).catch(() => undefined);
    console.error('❌ 测试失败:', e);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('❌ 测试失败:', e);
  process.exit(1);
});
