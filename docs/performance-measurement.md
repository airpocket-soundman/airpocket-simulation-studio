# Node側の性能測定ハーネス (PERF1 / P2 第1スライス)

English: [en/performance-measurement.md](en/performance-measurement.md)

`scripts/perf-measure.mjs` は、リポジトリ内の代表モデルをNodeのWorker(WASM, CPU)で解析し、時間・メッシュ規模・ピークメモリをJSONで記録する。**測定値であり、対応規模の上限や性能保証ではない。** PERF1(ブラウザごとのメモリ・時間・中止応答の測定と上限表示)およびP2の性能測定は未完了であり、このハーネスだけでは完了にならない。

## 測定するもの

- ケース: 10x10x40 mmの直方体(ワーカーパイプラインのテストと同じ形状)を、構造(メッシュサイズ違いで複数)、定常熱、調和音響で解析する。`--list`で一覧を出す。
- 各ケースの節点数・要素数。
- 時間(ms): 全体、Worker起動からメッシュ生成開始まで、メッシュ生成、境界条件転送、解析段階、ソルバー本体(ソルバー報告の`solveMs`)、後処理(解析段階からソルバー本体を引いた残り。結果組立とメッセージ複製を含む)。段階境界はホスト側のイベント受信時刻から求めた近似である。
- 冷間と温間: ケースごとに専用の子プロセスを起動し、その最初の実行を冷間、続く`--repeats`回(既定3)を温間とする。温間は中央値・最小・最大を記録する。温間でも毎回新しいWorkerを起動する。
- ピークRSS: 子プロセスの`process.resourceUsage().maxRSS`(Node本体・Worker・WASMメモリを含むプロセス全体の最大値)。
- 環境: Nodeとv8のバージョン、OS・アーキテクチャ、CPUモデル・論理CPU数、総メモリ、gitのリビジョン・ブランチ・未コミット変更の有無。

## 測定しないもの

- ブラウザ(Chrome等)でのメモリ・時間・中止応答。PERF1の本体であり別途測定が必要。
- WebGPU・GPU。
- ネットワーク、転送量、配布物サイズ、回線条件。
- ブラウザのキャッシュ冷温(ここでの冷間はプロセス起動直後の意味で、ディスクやHTTPキャッシュは制御しない)。
- メモリ上限・メモリ不足時の挙動、解析の中止応答。
- 実機・端末差の網羅。1台1回の測定は代表値ではない。

## 実行方法

```
node scripts/perf-measure.mjs                      # 全ケース、.qa/perf-report.json へ出力
node scripts/perf-measure.mjs --out <file> --repeats 1 --cases structural-tiny,thermal-steady
node scripts/perf-measure.mjs --list
```

`.qa/`はgit管理外である。レポートは`schemaVersion: 1`、`scope: "node-worker-wasm-cpu; not browser, not GPU, not network"`を持つ。失敗したケースは`status: "failed"`と`error`を記録し、終了コードは1になる。テスト`tests/perf-measure.test.mjs`は最小ケースでスキーマと必須項目のみを検証し、時間の閾値は持たない。

## 解釈上の注意

レポートの値は、その環境・その時点のビルドでの測定結果であり、対応規模の上限、性能目標、保証として扱わない。対応規模の決定にはブラウザ測定を含む後続作業が必要である。ここの数値をドキュメントや画面に保証として書かない。
