# APIと高速な検証

[English](en/testing.md)

`npm test` で、ブラウザを起動せず共通APIのライフサイクルを検証する。CIも同じテストを実行する。`npm run check:project -- project.json` で保存データの整合性と選択面積を確認できる。

Nodeからは src/studio-api.js の createStudioApi をimportする。ブラウザでは `window.studioApi` を使う。HTTPサーバーや認証キーは不要で、操作は開いたアプリ内のローカル状態に限定される。

```js
const api = window.studioApi;
api.getSummary();
api.selectTriangles(0, [0, 1]);
api.addCondition({type: 'fixed'});
api.selectTriangles(0, [20, 21]);
api.addCondition({type: 'force', value: 100, direction: [0, -1, 0]});
const project = api.exportProject();
api.loadProject(project);
```

番号は現在の表示メッシュの番号。getSummary / exportProject / loadProject / selectTriangles / clearSelection / addCondition / removeCondition / selectCondition / setMaterial を公開する。返却データはコピーとし、失敗した命令は状態を変更しない。APIはバージョン1。

UIの条件登録・削除・再選択・保存復元はこのAPIを経由する。マウスからのブラシ領域算出には別途、可視性と投影を含むブラウザ確認が必要。APIテストだけで3D操作・WASM・GPU・解析精度を検証したとはしない。ソルバー追加時は同じ設計で入力・実行・結果取得と参照解テストを増やす。

材料API: setMaterialPropertiesでSIの物性（E・強度はPa）を登録。UIはMPaで表示。カテゴリ変更時は物性をクリアします。

進捗更新: `npm run task:status -- ID STATUS "記録" [証跡]` を実行し、src/progress.jsonをcommit・pushします。開発管理ボードは表示中に20秒ごとに取得します。更新は実際の作業の区切りで行い、バックグラウンドで自動開発する仕組みではありません。

計算APIと検証例は[解析ガイド](analysis-guide.md)を参照。体積メッシュ・構造・熱・適応ループもNodeから直接検証する。
