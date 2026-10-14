import {validateCatalogSelection} from './catalog-provenance.js';
import {validatePlasticity} from './plasticity-material.js';
import {validateFractureData} from './fracture-core.js';
import {validateFatigueData} from './fatigue-material.js';
import {validateHyperelastic} from './hyperelastic-material.js';
import {validateMaterialDependence} from './material-dependence.js';
export const materialFields=[
 {key:'youngModulus',label:'ヤング率',unit:'MPa',scale:1e6,min:0,exclusive:true},
 {key:'poissonRatio',label:'ポアソン比',unit:'',scale:1,min:-1,max:.5,exclusive:true},
 {key:'density',label:'密度',unit:'kg/m³',scale:1,min:0,exclusive:true},
 {key:'strength',label:'評価用の強度',unit:'MPa',scale:1e6,min:0,exclusive:true},
 {key:'conductivity',label:'熱伝導率',unit:'W/(m·K)',scale:1,min:0,exclusive:true},
 {key:'specificHeat',label:'比熱',unit:'J/(kg·K)',scale:1,min:0,exclusive:true},
 {key:'expansion',label:'線膨張係数',unit:'1/K',scale:1},
 {key:'temperatureMin',label:'有効温度の下限',unit:'°C',scale:1,min:-273.15},
 {key:'temperatureMax',label:'有効温度の上限',unit:'°C',scale:1,min:-273.15}
];
export function validateMaterialProperties(p){
 if(!p||typeof p!=='object'||Array.isArray(p))throw Error('物性データが不正です。');
 for(const f of materialFields){const v=p[f.key];if(v===undefined||v===null)continue;if(!Number.isFinite(v)||(f.min!==undefined&&(f.exclusive?v<=f.min:v<f.min))||(f.max!==undefined&&(f.exclusive?v>=f.max:v>f.max)))throw Error(f.label+'が有効範囲外です。');}
 if(p.temperatureMin!=null&&p.temperatureMax!=null&&p.temperatureMin>p.temperatureMax)throw Error('有効温度の上下限が逆です。');
 for(const k of ['source','grade','notes'])if(p[k]!==undefined&&(typeof p[k]!=='string'||p[k].length>10000))throw Error('材料の記録が不正です。');
 validateMaterialDependence(p.dependence);
 validateHyperelastic(p.hyperelastic);
 validatePlasticity(p.plasticity);
 validateFatigueData(p.fatigueData);
 validateFractureData(p.fractureData);
 if(p.fractureData&&(p.plasticity||p.hyperelastic))throw Error('Fracture toughness requires a linear elastic material');
 validateCatalogSelection(p.catalogSelection,p);
 if(p.plasticity&&p.hyperelastic)throw Error('Plasticity cannot be combined with hyperelasticity');
 if(p.plasticity&&p.dependence?.elasticTemperatureTable)throw Error('Plasticity cannot be combined with an elastic temperature table');
 if(p.hyperelastic&&p.dependence?.elasticTemperatureTable)throw Error('Hyperelastic parameters cannot be combined with a linear elastic temperature table');
 return p;
}
export function materialReadiness(category,p={}){
 validateMaterialProperties(p);
 return {linearElasticMissing:['youngModulus','poissonRatio'].filter(k=>p[k]==null),thermalMissing:['conductivity','density','specificHeat'].filter(k=>p[k]==null),note:category==='ゴム'?'大変形には超弾性モデルと試験データが必要です。':category==='ガラス'?'強度だけでは欠陥や表面状態を含む破壊予測はできません。':category==='樹脂'?'温度・速度・方向による物性の変化を確認してください。':'強度の意味と試験条件を記録してください。'};
}
