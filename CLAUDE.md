---
project: 互動定位板（四上第一單元）
category: 學科工具集
status: 開發中
version: "v1.2 Codex 二輪 16 條修正 + 可重跑測試 2026-08-23"
url: https://wukolo1206.github.io/place-value-board/
next_action: 到 repo settings 開啟 GitHub Pages，再做實機驗收（教師大屏＋學生 iPad）
updated: 2026-08-23
---

# CLAUDE.md — 互動定位板

康軒數學**四上第一單元「一億以內的數」**的互動教具。純 HTML + CSS，無框架、無 build。

設計文件：`../docs/superpowers/specs/2026-08-22-place-value-board-design.md`
模式分析：`../docs/互動網頁引導模式分析.md`

## 為什麼做這個

教冊（資料篇）p19 明文：「由於大數教學時無法用具體物加以操作，教師教學時需善用**定位板**，
加強學生對於位值概念的理解。」課本四個活動全部使用定位板（附件 2-1、2-2）。
教冊等於直接指定了教具，本專案將它數位化。

## 使用情境

- **教師**：觸控大屏，投影全班共同操作 → **探索**模式
- **學生**：iPad 自行練習 → **練習**模式

兩模式以頂部 tab 切換（沿用 `../time-game/day24.html` 的 `setMode()` 結構）。

## 頁面

| 檔案 | 對應課本 | 內容 |
|---|---|---|
| `index.html` | — | 導覽首頁，四張卡片 |
| `board.html` | 活動一＋二 | 定位板：記數與讀數。滿 10 自動進位；讀法即時生成並標出零的規則 |
| `compose.html` | 活動一⑦–⑪ | 分解與合成，五個關卡（含打亂順序、**跳位**） |
| `compare.html` | 活動三 | 大小比較，逐位點亮找出分勝負的那一位 |
| `calc.html` | 活動四＋素養吧 | 大數加減，逐位直式＋「萬」簡記法＋兩步驟拆解練習 |
| `place-value-core.js` | — | **核心教學邏輯，網頁與測試共用** |
| `place-value-core.test.js` | — | 核心邏輯回歸測試 |
| `e2e.spec.py` | — | 五頁端到端測試 |
| `run-tests.py` | — | 單一執行入口 |

## 核心邏輯：中文讀法

`board.html` 的 `readNumber(n)` 是全專案最關鍵的函式，實作課本教的報讀規則：

- 由右而左**每四位一組**（個、萬、億）
- 每組**中間**連續幾個 0，只讀一個零
- 每組**後面**的 0，都不讀
- **「一十」在整個數的開頭讀成「十」**（課本 p2：100000 讀作「十萬」），
  非開頭則保留（課本 p13：「八千零一十萬零六」）

回傳 token 陣列而非字串，讓 UI 能把「有讀出來的零」標紅色。

**已用課本出現過的每一個標示讀法的數字做過回歸測試（28 例）**，
每筆都標明課本頁碼，見 `place-value-core.test.js`。改動後務必重跑 `python run-tests.py`。

## 技術慣例

- 純 HTML + CSS + 原生 JS，無框架無 build，可直接開啟
- 觸控：`touch-action` 與 pointer events；觸控目標 ≥ 48px
- iPad：`user-scalable=no` 防雙擊縮放；`-webkit-tap-highlight-color: transparent`
- 拖曳與點擊**兩種都支援**（大屏站遠時點擊比拖曳快）
- 題目寫死於各頁，不外接 JSON（同 `../09_統計表-game/table1d.html` 做法）

## 驗收

```bash
python run-tests.py
```

會依序跑：
1. `node place-value-core.test.js` —— 核心教學邏輯（讀法 28 例、分組算理、範圍契約）
2. `python e2e.spec.py` —— 五頁端到端 33 項（自動起關 http server）

**核心邏輯放在 `place-value-core.js`，網頁與測試共用同一份。**
原本邏輯內嵌在 HTML 裡，測試只能用 `node -e "...eval..."` 把 `<script>`
挖出來跑 —— 那測的是複本不是實際執行的程式，而且換行一改就壞。

讀法測試的每一筆期望值都標明課本頁碼，不是自己想的。改 `readNumber` 後務必重跑。

## 不能動的地方

- `readNumber` 的四位一組與零的規則 —— 那是課本明訂的讀法，改了就教錯
- `compose.html` 關卡五「跳位」的題目 —— 缺的位要補 0 是全單元最易錯處
- **不要把核心邏輯搬回 HTML 內嵌** —— 那會讓測試又變成測複本
- **不要把 `showScaffold()` 稱為鷹架** —— 它沒有 contingency／fading／責任移轉，
  三個特徵都沒有，本專案一律稱「表徵重呈」
