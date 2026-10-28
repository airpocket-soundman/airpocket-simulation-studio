# Finite input-history inspector GUI evidence / 入力履歴GUI確認

Stage A at e972ce8b11fa8cf5b6696082b4e96d979081ae77: ordinary main/IAB loaded the exact public synthetic example, replayed it in one owned worker, displayed raw/canonical hashes and five45-cell tables matching the domain oracle at nine significant digits. JA switching retained input/cells. Editing to malformed JSON immediately removed old results; a second actual worker refused FINITE_VISCO_HISTORY_INVALID_INPUT. Clear returned idle. Baseline/final-English272DOM controls, condition text and caseCount0 matched exactly. Japanese condition text differed by localization only. See [independent crosscheck](stage-a/independent-dom-crosscheck.json).

Polish at4c0221081b0a5af9025cc237f24b9c1cc1dace0b: after HMR reload, one new actual worker replayed the public example. All rows match Stage A; protected272DOM controls/condition text/caseCount match its new baseline. Tables are633px wide with23px single-line captions; root inspected the saved image. [Report](report.json) keeps both stages separate.

初回は合成公開例の成功と不正入力拒否の2worker、表示調整後は成功1workerを確認した。5表45セル・日英切替時の入力保持・旧結果消去・クリア・観測したDOM状態の非変更を限定確認した。形式的な内部project/case/analysis入力同一性API、実取消、物理受入/校正、全言語/hidden matrix、公開は証明していない。

Validation scope: full56focused/type28/build3.61s/local28(46816.716ms) belong only to Stage A e972. Polish source has16focused checks(2016.7085ms); its full build/local were not rerun here and final CI is planned. No structural solver, export or codec execution occurred. Packager performed no GUI operation. Original JSON/images/logs remain byte-preserved; inventory lists SHA256 and Git blob identities.
