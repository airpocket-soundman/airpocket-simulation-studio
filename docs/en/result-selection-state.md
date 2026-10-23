# Result selection lifetimes and asynchronous cancellation (MOD1 / order 69)

[日本語](../result-selection-state.md)

When result inspection is hashing, switching A→B→the identical A cannot be detected from final object identity and content alone. The DOM-free `src/result-selection-state.js` retains only a lifetime guard, invalidation and disposal. It retains no mesh/result arrays, case IDs or credentials. Private identity objects avoid counter rollover and prevent an earlier guard from becoming valid when the same result is reselected.

Main injects this boundary into the internal resultViewApi adapter. Clearing analysis, including saved-case restoration, invalidates old requests; GUI calculation cancellation and pagehide also invalidate them. The API checks guards after hashing and before setting presentation state, refusing old get/probe/set operations. The color-range handler preserves its original guard across get→set and does not restore newer controls in response to an obsolete error. Pagehide invalidates rather than permanently disposes the boundary so fresh requests work after bfcache restoration.

`dispose()` permanently invalidates current and future guards when a host is destroyed. `invalidate()` cancels publication of asynchronous results; existing analysis-job cancellation still owns solver termination. Public API responses, result/physical revisions, saved schemas, tool names and visible messages remain unchanged. Existing adapters without a lifetime provider retain their prior behavior.

Synthetic regressions cover A→B→A, late edits/probes, immediate reselection after cancellation, responses after disposal and switching between chained inspection/edit calls. Four of the initial six tests failed before the API fix; rejection and fresh selection succeed afterward. Normal values/revisions match the legacy adapter exactly and source input stays unchanged. Existing named-view and case restoration tests are also run. Module registration and a normal-test positive/negative TypeScript fixture cover the public runtime helper import.

Actual Chrome Japanese/English case switching remains unverified. DOM-free tests and existing UI fixtures do not establish that browser condition, MOD1 completion or publication acceptance. This unit handles one result-selection/presentation path without a broad main-file decomposition or changes to general asynchronous processing.
