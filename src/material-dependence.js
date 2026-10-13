const finiteTemperature=t=>Number.isFinite(t)&&t>=-273.15;
export function validateMaterialDependence(d){
 if(d===undefined)return;
 if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Invalid material dependence');
 const allowed=['elasticTemperatureTable','strainRateMin','strainRateMax','rateDependent','directionality','axes','testConditions'];
 if(Object.keys(d).some(k=>!allowed.includes(k)))throw Error('Unknown material dependence field');
 if(d.elasticTemperatureTable!==undefined){const table=d.elasticTemperatureTable;if(!Array.isArray(table)||table.length<2||table.length>100)throw Error('Elastic temperature table requires 2–100 rows');let last=-Infinity;for(const row of table){if(!row||Object.keys(row).some(k=>!['temperature','youngModulus','poissonRatio'].includes(k))||!finiteTemperature(row.temperature)||row.temperature<=last||!Number.isFinite(row.youngModulus)||row.youngModulus<=0||!Number.isFinite(row.poissonRatio)||row.poissonRatio<=-1||row.poissonRatio>=.49)throw Error('Invalid elastic temperature row; temperatures must increase and elastic constants must be supported');last=row.temperature;}}
 for(const k of ['strainRateMin','strainRateMax'])if(d[k]!==undefined&&(!Number.isFinite(d[k])||d[k]<0))throw Error('Invalid strain rate envelope');
 if(d.strainRateMin!==undefined&&d.strainRateMax!==undefined&&d.strainRateMin>d.strainRateMax)throw Error('Reversed strain rate envelope');
 if(d.rateDependent!==undefined&&typeof d.rateDependent!=='boolean')throw Error('Invalid rate dependence');
 if(d.directionality!==undefined&&!['isotropic','orthotropic'].includes(d.directionality))throw Error('Invalid material directionality');
 if(d.axes!==undefined||d.directionality==='orthotropic'){const a=d.axes;if(!Array.isArray(a)||a.length!==3||a.some(v=>!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite)||Math.abs(Math.hypot(...v)-1)>1e-8))throw Error('Material axes must be three unit vectors');const dot=(u,v)=>u.reduce((s,x,k)=>s+x*v[k],0),cross=[a[0][1]*a[1][2]-a[0][2]*a[1][1],a[0][2]*a[1][0]-a[0][0]*a[1][2],a[0][0]*a[1][1]-a[0][1]*a[1][0]];if(Math.abs(dot(a[0],a[1]))>1e-8||dot(cross,a[2])<1-1e-8)throw Error('Material axes must be orthogonal and right handed');}
 if(d.testConditions!==undefined&&(typeof d.testConditions!=='string'||d.testConditions.length>10000))throw Error('Invalid material test conditions');
}
export function checkMaterialTemperature(properties,temperature){
 const values=Array.isArray(temperature)?temperature:[temperature];
 if(!values.length||values.some(t=>!finiteTemperature(t)))throw Error('Invalid material evaluation temperature');
 if(values.some(t=>properties.temperatureMin!=null&&t<properties.temperatureMin-1e-6||properties.temperatureMax!=null&&t>properties.temperatureMax+1e-6))throw Error('Temperature is outside the registered material validity range');
}
export function resolveElasticMaterial(properties,temperature=20){
 const d=properties.dependence;validateMaterialDependence(d);checkMaterialTemperature(properties,temperature);
 if(d?.rateDependent)throw Error('Rate-dependent structural constitutive models are not supported');
 if(d?.directionality==='orthotropic')throw Error('Orthotropic structural constitutive models are not supported');
 if(d?.strainRateMin>0)throw Error('Static structure has zero strain rate, outside the registered test envelope');
 const table=d?.elasticTemperatureTable,values=Array.isArray(temperature)?temperature:[temperature],t=values[0];
 if(!table)return {properties:{...properties},evaluation:{temperatureMin:values.reduce((a,b)=>Math.min(a,b),Infinity),temperatureMax:values.reduce((a,b)=>Math.max(a,b),-Infinity),interpolated:false}};
 if(values.some(v=>Math.abs(v-t)>1e-9))throw Error('Temperature-dependent elasticity currently requires a uniform temperature');
 if(t<table[0].temperature||t>table.at(-1).temperature)throw Error('Material temperature table does not allow extrapolation');
 const hi=table.findIndex(row=>row.temperature>=t),b=table[hi],a=table[Math.max(0,hi-1)],q=a===b?0:(t-a.temperature)/(b.temperature-a.temperature);
 return {properties:{...properties,youngModulus:a.youngModulus+q*(b.youngModulus-a.youngModulus),poissonRatio:a.poissonRatio+q*(b.poissonRatio-a.poissonRatio)},evaluation:{temperatureMin:t,temperatureMax:t,interpolated:true,youngModulus:a.youngModulus+q*(b.youngModulus-a.youngModulus),poissonRatio:a.poissonRatio+q*(b.poissonRatio-a.poissonRatio)}};
}
