export interface ResultSelectionState {
 /** Capture a private selection lifetime; never persist this guard. */
 capture(): () => boolean;
 /** Cancel pending publication and begin a fresh selection lifetime. */
 invalidate(): void;
 /** Permanently reject all captured and future guards. */
 dispose(): void;
}
export declare function createResultSelectionState(): ResultSelectionState;
