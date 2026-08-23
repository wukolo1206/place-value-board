/* place-value-core.test.js —— 核心教學邏輯回歸測試
 *
 * 執行：node place-value-core.test.js
 *
 * 讀法的每一筆期望值都取自課本實際標示的讀法，不是我自己想的。
 * 改動 readNumber 後務必重跑。
 */
const assert = require('assert');
const core = require('./place-value-core.js');

let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('PASS ' + name);
  } catch (e) {
    console.error('FAIL ' + name);
    console.error('     ' + e.message);
    failed++;
    process.exitCode = 1;
  }
}

/* ═══ 讀法：期望值全部來自課本 ═══ */
const READ_CASES = [
  // 課本 p2：10 個 10000 合起來是 100000，讀作「十萬」
  [100000, '十萬', 'p2'],
  [110000, '十一萬', 'p2 延伸'],
  [10, '十', '一般規則'],
  [15, '十五', '一般規則'],
  [10000, '一萬', 'p2'],
  // 課本 p13 連連看：「一十」在非開頭要保留
  [80100006, '八千零一十萬零六', 'p13'],
  [80001006, '八千萬一千零六', 'p13'],
  [81060000, '八千一百零六萬', 'p13'],
  // 課本 p3：中間連續的 0 只讀一個零
  [29100, '二萬九千一百', 'p3'],
  [30100, '三萬零一百', 'p3'],
  [38005, '三萬八千零五', 'p3'],
  // 課本 p8 捷運人次：每組中間連續 0 只讀一個零、每組後面的 0 不讀
  [48014008, '四千八百零一萬四千零八', 'p8'],
  [47980009, '四千七百九十八萬零九', 'p8'],
  [46500000, '四千六百五十萬', 'p8'],
  [48004000, '四千八百萬四千', 'p8'],
  // 課本 p7
  [23264640, '二千三百二十六萬四千六百四十', 'p7'],
  [23400000, '二千三百四十萬', 'p6'],
  // 課本 p8 做做看（國字 → 數字的反向驗證）
  [8010007, '八百零一萬零七', 'p8 做做看'],
  [60220000, '六千零二十二萬', 'p8 做做看'],
  [41000900, '四千一百萬零九百', 'p8 做做看'],
  // 課本 p7：一億
  [100000000, '一億', 'p7'],
  // 課本 p9 車站人次
  [9490995, '九百四十九萬零九百九十五', 'p9'],
  // 課本 p4、p5
  [21005, '二萬一千零五', 'p4'],
  [40980, '四萬零九百八十', 'p5'],
  [51957, '五萬一千九百五十七', 'p5'],
  // 課本 p10 故宮參觀人次
  [10555381, '一千零五十五萬五千三百八十一', 'p10'],
  [6422163, '六百四十二萬二千一百六十三', 'p10'],
  [2910000, '二百九十一萬', '一般'],
];

test('讀法：課本標示過的每一個數（' + READ_CASES.length + ' 例）', () => {
  READ_CASES.forEach(([n, want, src]) => {
    assert.strictEqual(core.readText(n), want,
      `${n} 應讀作「${want}」（課本 ${src}），實得「${core.readText(n)}」`);
  });
});

test('讀法：範圍契約 —— 超出上限不可靜默給錯字串', () => {
  assert.strictEqual(core.readText(999999999), '九億九千九百九十九萬九千九百九十九');
  assert.ok(core.readText(1000000000).includes('超過'), '10 億應提示超過範圍');
  assert.ok(core.readText(1e12).includes('超過'), '1 兆應提示超過範圍');
  assert.ok(core.readText(-5).includes('不是非負整數'));
  assert.ok(core.readText(3.7).includes('不是非負整數'));
});

test('讀法：零的規則標記', () => {
  // 48014008「四千八百零一萬四千零八」有兩個零被讀出來
  const toks = core.readNumber(48014008);
  const keep = toks.filter(t => t.k === 'keep').length;
  assert.strictEqual(keep, 2, '48014008 應有 2 個依規則讀出來的零');
  // 48004000「四千八百萬四千」——每組後面的 0 都不讀
  assert.strictEqual(core.readText(48004000), '四千八百萬四千');
  assert.strictEqual(core.countSkippedZeros(48004000), 5);
});

/* ═══ 四位一組分組 ═══ */
test('分組：由右而左每四位一組', () => {
  assert.strictEqual(core.groupStr(123456789), '1 2345 6789', '九位數要分三組');
  assert.strictEqual(core.groupStr(48014008), '4801 4008');
  assert.strictEqual(core.groupStr(1234), '1234', '四位以內不分組');
  assert.strictEqual(core.groupStr(12345), '1 2345');
});

/* ═══ 分組法算理（課本 p12 素養吧）═══ */
const CALC_CASES = [
  [72097, 66889, '+', '課本 p12 原題，低組不進位'],
  [123992, 66889, '+', '低組進位'],
  [189665, 123992, '-', '課本 p12 原題，低組不借位'],
  [830640, 81000, '-', '108年第5題，低組要借位'],
  [190700, 125300, '-', '114年第5題，低組要借位'],
  [10000, 1, '-', '邊界：借位後低組為 9999'],
];

test('分組法：低組必須正規化為 0~9999，且重組後等於正解', () => {
  CALC_CASES.forEach(([a, b, op, note]) => {
    const g = core.groupCalc(a, b, op);
    const total = op === '+' ? a + b : a - b;
    assert.ok(g.low >= 0 && g.low < 10000,
      `${a}${op}${b}（${note}）低組 ${g.low} 應在 0~9999`);
    assert.strictEqual(g.high * 10000 + g.low, total,
      `${a}${op}${b}（${note}）重組 ${g.high * 10000 + g.low} 應等於 ${total}`);
  });
});

test('分組法：進位／借位要反映到高組', () => {
  const add = core.groupCalc(123992, 66889, '+');
  assert.strictEqual(add.low, 881, '3992+6889=10881，低組留 881');
  assert.strictEqual(add.high, 19, '12+6 再加進位 1 = 19');

  const sub = core.groupCalc(190700, 125300, '-');
  assert.strictEqual(sub.low, 5400, '0700 不夠減 5300，借位後 10700-5300');
  assert.strictEqual(sub.high, 6, '19-12 再減借走的 1 = 6');
});

/* ═══ 定位板範圍 ═══ */
test('定位板：自動展開只能映射到合法 preset', () => {
  core.PRESETS.forEach(p => {
    assert.ok(core.PRESETS.includes(core.fitRange(p)), `${p} 本身應合法`);
  });
  assert.strictEqual(core.fitRange(7), 8, '7 位要放進 8 欄，不可傳 7');
  assert.strictEqual(core.fitRange(5), 6);
  assert.strictEqual(core.fitRange(9), 9);
  assert.strictEqual(core.fitRange(99), 9, '超出最大 preset 時回傳最大值');
});

console.log('\n' + (failed === 0
  ? '✅ 全部通過'
  : `❌ ${failed} 組測試失敗`));
