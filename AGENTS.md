# AGENTS.md — 互動定位板

## 專案定位
康軒數學四上第一單元「一億以內的數」的互動教具。教師觸控大屏投影 + 學生 iPad 自學。

## 動手前必讀
1. `CLAUDE.md` —— 尤其「核心邏輯：中文讀法」一節
2. `../docs/superpowers/specs/2026-08-22-place-value-board-design.md` —— 設計依據
3. `PITFALLS.md`

## 硬性規則
- **改 `readNumber` 必須重跑讀法回歸測試**（28 例，見 CHANGELOG）。那是課本明訂的報讀規則
- 改任何 `.html` 前先備份為 `檔名.html.bak`
- 純 HTML/CSS/JS，**不要引入框架或 build 工具**
- 觸控目標維持 ≥ 48px；不要移除 `user-scalable=no`
- 題目取自課本，不要自行編造數字；新增題目須標明對應課本頁次
