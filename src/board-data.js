import initial from './progress.json' with {type:'json'};
import {validateProgress} from './progress.js';
export let {release,tasks,solvers,updatedAt,publicationMilestone}=validateProgress(initial);
export function applyProgress(p){validateProgress(p);if(Date.parse(p.updatedAt)<Date.parse(updatedAt))return false;({release,tasks,solvers,updatedAt,publicationMilestone}=p);return true;}
export const stages=[["queued","順番を待っている","未実装の残作業"],["building","つくっている","実装中"],["checking","確かめている","検証中"],["fixing","直している","修正中"],["ready","次の版を待っている","検証済み・未公開"],["released","公開版に入っている","公開版への反映を確認済み"]];
