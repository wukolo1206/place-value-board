/* place-value-core.js —— 四上 U1「一億以內的數」的核心教學邏輯
 *
 * 抽出來讓網頁與測試共用同一份，測試才能真的重跑。
 * （原本邏輯內嵌在 board.html／calc.html 裡，測試只能用 node -e "...eval..."
 *   把 <script> 挖出來執行，換行一改就壞，等於沒有可重跑的測試。）
 *
 * 沿用 happy-division/division-core.js 的 UMD 包法。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.PlaceValueCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  var NAMES = ['個位', '十位', '百位', '千位', '萬位', '十萬位', '百萬位', '千萬位', '億位'];
  var CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  var SMALL = ['', '十', '百', '千'];

  /* 本工具支援的上限。超過就不可靜默產出貌似合理的錯字串 —— 那會直接教錯。 */
  var READ_MAX = 999999999;

  /* 把 0~9999 讀成中文，回傳 token 陣列 {t: 文字, k: 'd'|'keep'}
     k='keep' 表示這個「零」是依規則要讀出來的，UI 會標色。 */
  function read4(n) {
    if (n === 0) return [];
    var s = String(n), L = s.length, out = [], pendingZero = false;
    for (var i = 0; i < L; i++) {
      var d = +s.charAt(i), pos = L - 1 - i;
      if (d === 0) { pendingZero = true; continue; }
      if (pendingZero && out.length) out.push({ t: '零', k: 'keep' });
      pendingZero = false;
      out.push({ t: CN[d], k: 'd' });
      if (pos > 0) out.push({ t: SMALL[pos], k: 'd' });
    }
    return out;
  }

  /* 完整讀法：由右而左每四位一組（個、萬、億），這正是課本教的報讀策略。
     規則（課本 p8）：
       每組「中間」連續幾個 0，只讀一個零
       每組「後面」的 0，都不讀
     另（課本 p2）：「一十」在整個數的開頭讀成「十」，非開頭保留
       （課本 p13「八千零一十萬零六」即為非開頭的例子） */
  function readNumber(n) {
    if (typeof n !== 'number' || !isFinite(n) || n < 0 || Math.floor(n) !== n) {
      return [{ t: '（不是非負整數）', k: 'd' }];
    }
    if (n > READ_MAX) {
      return [{ t: '（超過本工具支援的 ' + READ_MAX + '）', k: 'd' }];
    }
    if (n === 0) return [{ t: '零', k: 'd' }];

    var out = [];
    var yi = Math.floor(n / 100000000), rest = n % 100000000;
    if (yi > 0) {
      out = out.concat(read4(yi));
      out.push({ t: '億', k: 'd' });
      if (rest > 0 && rest < 10000000) out.push({ t: '零', k: 'keep' });
    }
    var wan = Math.floor(rest / 10000), low = rest % 10000;
    if (wan > 0) {
      out = out.concat(read4(wan));
      out.push({ t: '萬', k: 'd' });
      if (low > 0 && low < 1000) out.push({ t: '零', k: 'keep' });
    }
    if (low > 0) out = out.concat(read4(low));

    if (out.length >= 2 && out[0].t === '一' && out[1].t === '十') out.shift();
    return out;
  }

  function readText(n) {
    return readNumber(n).map(function (x) { return x.t; }).join('');
  }

  /* 有幾個 0 依規則沒被讀出來（UI 用來提示零的規則） */
  function countSkippedZeros(v) {
    if (v === 0 || v > READ_MAX) return 0;
    var zeros = String(v).split('').filter(function (c) { return c === '0'; }).length;
    var spoken = readNumber(v).filter(function (t) { return t.t === '零'; }).length;
    return zeros - spoken;
  }

  /* 由右而左每四位一組。九位數要分成 1 2345 6789，不是 12345 6789。 */
  function groupStr(v) {
    var s = String(v), out = '';
    while (s.length > 4) { out = ' ' + s.slice(-4) + out; s = s.slice(0, -4); }
    return s + out;
  }

  /* 分組法（課本 p12 素養吧）的算理：
       低組必須正規化成 0~9999，進位／借位反映到高組。
       加法：low = (la+lb) % 10000，若 la+lb >= 10000 則 high 多 1
       減法：la < lb 時 low = la+10000-lb，high 少 1 */
  function groupCalc(a, b, op) {
    var la = a % 10000, lb = b % 10000;
    var ha = Math.floor(a / 10000), hb = Math.floor(b / 10000);
    var r = { la: la, lb: lb, ha: ha, hb: hb, carryNote: '' };
    if (op === '+') {
      var s = la + lb;
      var carry = s >= 10000 ? 1 : 0;
      r.low = s % 10000;
      r.high = ha + hb + carry;
      r.lowExplain = '相加是 ' + s + (carry ? '，超過 10000 要進位' : '');
      r.highExplain = ha + ' ＋ ' + hb + (carry ? ' ＋ 進位的 1' : '');
      if (carry) {
        r.carryNote = '（' + s + ' 超過 10000，個那組留下 ' + r.low + '，進位 1 到萬那組）';
      }
    } else {
      var borrow = la < lb ? 1 : 0;
      r.low = la - lb + borrow * 10000;
      r.high = ha - hb - borrow;
      r.lowExplain = borrow
        ? ('不夠減，向萬那組借 1 萬：' + (la + 10000) + ' － ' + lb)
        : ('相減是 ' + (la - lb));
      r.highExplain = ha + ' － ' + hb + (borrow ? ' － 借走的 1' : '');
      if (borrow) r.carryNote = '（不夠減，已向萬那組借 1 萬）';
    }
    return r;
  }

  /* 定位板可切換的位數。介面只有這三個按鈕，
     自動展開時必須映射到合法值，不可傳入 7 這種不存在的 preset。 */
  var PRESETS = [6, 8, 9];

  function fitRange(need) {
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i] >= need) return PRESETS[i];
    return PRESETS[PRESETS.length - 1];
  }

  return {
    NAMES: NAMES,
    READ_MAX: READ_MAX,
    PRESETS: PRESETS,
    read4: read4,
    readNumber: readNumber,
    readText: readText,
    countSkippedZeros: countSkippedZeros,
    groupStr: groupStr,
    groupCalc: groupCalc,
    fitRange: fitRange
  };
});
