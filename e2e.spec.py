"""e2e.spec.py —— 五頁端到端測試

執行：python run-tests.py        （會自動起 http server）
或：  python -m http.server 8899 --bind 127.0.0.1
      python e2e.spec.py 8899

不能用 file:// 開 —— 頁面用 <script src> 載入 place-value-core.js，
且 Playwright 的 elementFromPoint 在 file:// 下行為不一致。
"""
import sys
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

PORT = sys.argv[1] if len(sys.argv) > 1 else '8899'
BASE = 'http://127.0.0.1:%s/' % PORT

failed = []


def ck(cond, name):
    print(('  PASS ' if cond else '  FAIL ') + name)
    if not cond:
        failed.append(name)


def run(pg, errs):
    # ───────── index ─────────
    print('== index.html')
    pg.goto(BASE + 'index.html'); pg.wait_for_load_state('networkidle')
    links = pg.eval_on_selector_all('a.card', 'e=>e.map(x=>x.getAttribute("href"))')
    ck(links == ['board.html', 'compose.html', 'compare.html', 'calc.html'],
       '四張卡片連到正確頁面')

    # ───────── board 探索 ─────────
    print('== board.html 探索')
    pg.goto(BASE + 'board.html'); pg.wait_for_load_state('networkidle')
    ck(pg.evaluate('typeof PlaceValueCore') == 'object', 'core 模組已載入')

    labs = pg.eval_on_selector_all('.bill', 'e=>e.map(x=>x.textContent)')
    ck('1000 元' in labs, '鈔票區含 1000 元（課本 p2 的具體物起點）')

    for _ in range(10):
        pg.click('#c3')
    pg.wait_for_timeout(300)
    ck(pg.inner_text('#oNum').strip() == '10000', '10 張 1000 元 → 10000')
    ck('紮成一疊' in pg.inner_text('.hint'), '千→萬的提示講「紮成一疊」')

    pg.click('text=清空')
    for _ in range(10):
        pg.click('#c4')
    pg.wait_for_timeout(300)
    ck('紮成一疊' not in pg.inner_text('.hint'), '萬→十萬不再說紮成一疊')

    # 溢位不可靜默丟失
    pg.click('#r6')
    pg.evaluate('digits=[9,9,9,9,9,9,0,0,0]; update()')
    pg.evaluate('addAt(0,1)'); pg.wait_for_timeout(200)
    ck(pg.evaluate('range') in (6, 8, 9), '自動展開後 range 是合法 preset')
    ck(pg.eval_on_selector_all('#bd td', 'e=>e.length') == pg.evaluate('range'),
       '畫面欄數與 range 一致')
    ck(pg.evaluate('value()') == 1000000, '999999+1 = 1000000（不再倒退）')

    pg.click('#r9')
    pg.evaluate('digits=[9,9,9,9,9,9,9,9,9]; update()')
    before = pg.evaluate('value()')
    pg.evaluate('addAt(0,1)')
    ck(pg.evaluate('value()') == before, '到上限時保留原值')
    ck('上限' in pg.inner_text('.hint'), '  並顯示上限提示')

    pg.evaluate('digits=[9,8,7,6,5,4,3,2,1]; grouping=true; drawBoard(); update()')
    ck(pg.inner_text('#oNum').strip() == '1 2345 6789', '九位數四位一組')
    ck('一億二千三百四十五萬六千七百八十九' in pg.inner_text('#oRead'), '九位數讀法')

    # ───────── board 練習：關卡把關 ─────────
    print('== board.html 練習')
    pg.click('#tabQz')
    n = pg.evaluate('QS[0].length')
    for _ in range(n):
        pg.click('#pQz button:has-text("下一題")')
        pg.wait_for_timeout(120)
    pg.wait_for_timeout(900)
    ck(pg.evaluate('stage') == 0, '未答完不能過關')
    ck('沒答對' in pg.inner_text('#qFb'), '  並提示還有幾題')

    for a in ['290000', '38050000', '4090000', '10600000']:
        pg.fill('#qAns', a)
        pg.click('#pQz >> text=確認')
        pg.click('#pQz >> text=下一題')
        pg.wait_for_timeout(120)
    pg.wait_for_timeout(1000)
    ck(pg.evaluate('stage') == 1, '全部答對後進入下一關')

    # ───────── compose ─────────
    print('== compose.html')
    pg.goto(BASE + 'compose.html'); pg.wait_for_load_state('networkidle')
    ck(pg.eval_on_selector_all('.part', 'e=>e.length') == 3, '40980 分解出 3 塊（0 不顯示）')
    pg.click('#tabQz')
    pg.click('#s4')
    pg.fill('#iA', '389')
    pg.click('#pQz >> text=確認')
    ck(pg.is_visible('#scaf'), '跳位答錯 → 表徵重呈（叫出定位板）')
    pg.click('#scTbl td[data-p="2"]')
    ck('沒有提到' in pg.inner_text('#scMsg'), '  點題目沒提到的位 → 提示補 0')
    pg.click('text=我看懂了，再答一次')
    pg.fill('#iA', '38009')
    pg.click('#pQz >> text=確認')
    ck('答對' in pg.inner_text('#qFb'), '  重呈後再答一次答對')

    # 轉場競態：700ms 內切關不可被舊回呼拉回
    pg.click('#s0')
    n0 = pg.evaluate('QS[0].length')
    for _ in range(n0):
        pg.click('#pQz button:has-text("下一題")')
    pg.wait_for_timeout(180)
    pg.click('#s1')
    pg.wait_for_timeout(900)
    ck(pg.evaluate('stage') == 1, '轉場中切關不被舊 timer 拉回')

    # ───────── compare ─────────
    print('== compare.html')
    pg.goto(BASE + 'compare.html'); pg.wait_for_load_state('networkidle')
    pg.click('text=▶ 逐位比比看')
    ck('位數不同' in pg.inner_text('#eVer'), '探索：位數不同直接用位數判定')

    pg.click('#tabQz')
    for _ in range(8):
        if pg.evaluate('PQ[qi]') == [9000009, 10000001]:
            break
        pg.click('#pQz >> text=下一題')
    pg.click('.op >> nth=2')
    rows = pg.evaluate("""()=>{const rs=document.querySelectorAll('#cbQz tr');
        const f=r=>[...r.querySelectorAll('td')].slice(1)
            .filter(t=>!t.classList.contains('dim')).map(t=>t.className);
        return {a:f(rs[1]), b:f(rs[2])};}""")
    ck(set(rows['a']) == {'lose'} and set(rows['b']) == {'win'},
       '位數不同時整列標示（短數字的高位不可標成勝）')

    # ───────── calc ─────────
    print('== calc.html')
    pg.goto(BASE + 'calc.html'); pg.wait_for_load_state('networkidle')
    for _ in range(8):
        pg.click('text=▶ 一位一位算')
    ck('4690000' in pg.inner_text('#eHint'), '探索：逐位計算得出答案')

    pg.click('#tabQz')
    ck('素養吧' in pg.inner_text('#qMethod'), '非萬倍數用分組法')
    for v, sel in [('8986', '#i1'), ('13', '#i2'), ('138986', '#i3')]:
        pg.fill(sel, v)
        pg.click('#pQz >> text=確認')
    ck('完全正確' in pg.inner_text('#qFb'), '  分組法（不進位）三步完成')

    for _ in range(2):
        pg.click('#pQz >> text=下一題')
    pg.fill('#i1', '10881')
    pg.click('#pQz >> text=確認')
    ck('❌' in pg.inner_text('#qFb'), '  未正規化的低組 10881 被拒絕')
    for v, sel in [('881', '#i1'), ('19', '#i2'), ('190881', '#i3')]:
        pg.fill(sel, v)
        pg.click('#pQz >> text=確認')
    ck('完全正確' in pg.inner_text('#qFb'), '  分組法（有進位）三步完成')

    for _ in range(1):
        pg.click('#pQz >> text=下一題')
    ck('活動四' in pg.inner_text('#qMethod'), '萬倍數改用簡記法')

    # ───────── 挑戰分頁 ─────────
    print('== 挑戰分頁（考古題）')
    for f, n in [('board.html', 3), ('compose.html', 2),
                 ('compare.html', 1), ('calc.html', 5)]:
        pg.goto(BASE + f); pg.wait_for_load_state('networkidle')
        pg.click('#tabCh')
        good = True
        for _ in range(n):
            a = pg.evaluate('CHAL[CH_I].a')
            pg.click('.chopt >> nth=%d' % (a - 1))
            if '答對' not in pg.inner_text('#chFb'):
                good = False
            pg.click('#pCh >> text=下一題')
        ck(good, '%s 的 %d 題判定正確' % (f, n))

    # ───────── 觸控目標 ─────────
    print('== 觸控目標尺寸')
    for f in ['board.html', 'compose.html', 'compare.html', 'calc.html']:
        pg.goto(BASE + f); pg.wait_for_load_state('networkidle')
        small = pg.evaluate("""()=>{const o=[];
            document.querySelectorAll('.back,.tab,.btn,.st,.op,.bill,.chopt').forEach(e=>{
                const b=e.getBoundingClientRect();
                if(b.height>0 && b.height<48) o.push(e.className.split(' ')[0]);});
            return o;}""")
        ck(len(small) == 0, '%s 無小於 48px 的觸控目標 %s' % (f, small if small else ''))

    ck(len(errs) == 0, '全程無 JS 例外 %s' % (errs[:2] if errs else ''))


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        pg = b.new_context(viewport={'width': 1200, 'height': 1050},
                           has_touch=True).new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console:' + m.text)
              if m.type == 'error' else None)
        try:
            run(pg, errs)
        finally:
            b.close()

    print()
    if failed:
        print('FAILED %d 項：' % len(failed))
        for f in failed:
            print('   - ' + f)
        sys.exit(1)
    print('全部通過')


if __name__ == '__main__':
    main()
