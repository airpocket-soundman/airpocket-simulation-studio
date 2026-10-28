# PR2001ed cancelled CI / 途中終了記録

Run40375346866 for head1edc6642d6e1882e3bcd74d89c23ce0cb7635571 was cancelled during prepared tests after the next head was pushed. It has no complete suite counts. Its partial log contains the obsolete viewer-source assertion failure already diagnosed under aa06. Do not label this run completed-success or completed-failure. Build/local checks were skipped. The automatic artifact was downloaded once; all four raw files are byte/SHA inventoried.

新headへの交代時に取り消された実行。旧assertの失敗行は途中logにあるが、全体件数を推定せずcancelledとして保持する。build/local未実施。追加run/retryなし、4rawのGit保存byte/SHAを固定する。
