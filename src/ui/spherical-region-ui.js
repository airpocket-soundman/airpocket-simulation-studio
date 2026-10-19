// Limited dimensional panel for the existing exact spherical sector API.
// It only collects mesh/center/axis/reference/radius/tolerance/latitude/start/sweep,
// refuses blank or non-finite drafts before any API call, and delegates every
// geometric decision (frame normalization, range checks, area) to
// api.selectSphericalRegion. No area formula or selection math is duplicated here.
const translations={
 '球面を緯度・経度で選ぶ':'Select sphere by latitude and longitude',
 '部品番号（0から）':'Part index (from 0)',
 '中心 X / Y / Z（mm）':'Center X / Y / Z (mm)','中心X':'Center X','中心Y':'Center Y','中心Z':'Center Z',
 '極軸 X / Y / Z（無次元）':'Polar axis X / Y / Z (unitless)','極軸X':'Polar axis X','極軸Y':'Polar axis Y','極軸Z':'Polar axis Z',
 '経度0°の基準方向 X / Y / Z（無次元）':'Reference for 0° longitude X / Y / Z (unitless)','基準方向X':'Reference X','基準方向Y':'Reference Y','基準方向Z':'Reference Z',
 '半径（mm）':'Radius (mm)','半径許容差（mm）':'Radial tolerance (mm)',
 '緯度の下限 / 上限（°）':'Latitude min / max (degrees)','緯度下限':'Latitude minimum','緯度上限':'Latitude maximum',
 '開始経度 / 経度幅（°）':'Start longitude / longitude span (degrees)','開始経度':'Start longitude','経度幅':'Longitude span',
 '数値指定で球面を選ぶ':'Select spherical region',
 '球面の数値領域を選択しました。':'Spherical region selected.',
 '選択に失敗しました。入力は保持しています。':'Selection failed. The draft was retained.',
 '全ての項目を空欄でない有限の数値で入力してください。':'Enter every field as a non-blank finite number.',
 '部品番号は0以上の整数で入力してください。':'Enter the part index as an integer of 0 or greater.',
 '長さはmm、角度はdegreeです。非零の極軸を正規化し、経度0°の基準方向は極軸へ直交投影して正規化します。基準方向が極軸に平行な入力は拒否します。緯度は極軸に対する赤道基準で-90〜90、経度幅は0より大きく360以下です。単一のSTEP球・組込み球にのみ対応し、一般UV曲面は未対応です。':'Lengths are mm and angles degrees. A nonzero polar axis is normalized; the 0° reference is projected perpendicular to it and normalized. A reference parallel to the axis is refused. Latitude is measured from the equator about the polar axis (-90 to 90) and the longitude span is greater than 0 and at most 360. Only one built-in sphere or STEP solid is supported; general UV surfaces are unsupported.'
};
const defaults={mesh:0,center:[0,0,0],axis:[0,0,1],reference:[1,0,0],radius:10,tolerance:.01,latitudeMin:-30,latitudeMax:30,startDegrees:315,sweepDegrees:90};
const scalars=[['spherical-radius','radius'],['spherical-tolerance','tolerance'],['spherical-latitude-min','latitudeMin'],['spherical-latitude-max','latitudeMax'],['spherical-start','startDegrees'],['spherical-sweep','sweepDegrees']];
const vectors=[['spherical-center','center'],['spherical-axis','axis'],['spherical-reference','reference']];
export function createSphericalRegionUi({host,document:doc=globalThis.document,language=()=> 'ja',translate=()=>{},onSelect=async()=>{}}){
 translate(translations);const tr=text=>language()==='en'?(translations[text]??text):text;
 const element=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const heading=element('h3','球面を緯度・経度で選ぶ'),groupLabels=[],fields={};
 const note=element('p','長さはmm、角度はdegreeです。非零の極軸を正規化し、経度0°の基準方向は極軸へ直交投影して正規化します。基準方向が極軸に平行な入力は拒否します。緯度は極軸に対する赤道基準で-90〜90、経度幅は0より大きく360以下です。単一のSTEP球・組込み球にのみ対応し、一般UV曲面は未対応です。');
 const status=element('p');status.id='spherical-region-status';status.setAttribute('role','status');
 const numberField=(parent,text,id,value,attrs={})=>{const label=element('label',text),control=element('input');label.append(control);for(const [key,val]of Object.entries(attrs))control.setAttribute(key,String(val));control.id=id;control.type='number';control.step='any';control.value=value===undefined||value===null?'':String(value);control.setAttribute('aria-label',text);control.oninput=()=>{control.removeAttribute?.('aria-invalid');control.removeAttribute?.('aria-errormessage');status.textContent='';};parent.append(label);fields[id]=control;return control;};
 const vectorField=(text,prefix,arias,values)=>{const legend=element('label',text);groupLabels.push(legend);host.append(legend);const group=element('div');group.className='direction';for(const [i,axis]of ['x','y','z'].entries())numberField(group,arias[i],prefix+'-'+axis,values[i]);host.append(group);};
 const select=element('button','数値指定で球面を選ぶ');select.id='spherical-select';select.type='button';
 host.append(heading,note);
 numberField(host,'部品番号（0から）','spherical-mesh',defaults.mesh,{min:0,step:1});
 vectorField('中心 X / Y / Z（mm）','spherical-center',['中心X','中心Y','中心Z'],defaults.center);
 vectorField('極軸 X / Y / Z（無次元）','spherical-axis',['極軸X','極軸Y','極軸Z'],defaults.axis);
 vectorField('経度0°の基準方向 X / Y / Z（無次元）','spherical-reference',['基準方向X','基準方向Y','基準方向Z'],defaults.reference);
 numberField(host,'半径（mm）','spherical-radius',defaults.radius,{min:0});
 numberField(host,'半径許容差（mm）','spherical-tolerance',defaults.tolerance,{min:0});
 for(const [text,ids,arias,keys]of [['緯度の下限 / 上限（°）',['spherical-latitude-min','spherical-latitude-max'],['緯度下限','緯度上限'],['latitudeMin','latitudeMax']],['開始経度 / 経度幅（°）',['spherical-start','spherical-sweep'],['開始経度','経度幅'],['startDegrees','sweepDegrees']]]){const legend=element('label',text);groupLabels.push(legend);host.append(legend);const group=element('div');group.className='direction';for(const [i,id]of ids.entries())numberField(group,arias[i],id,defaults[keys[i]]);host.append(group);}
 host.append(select,status);
 const clearMarks=()=>{for(const control of Object.values(fields)){control.removeAttribute?.('aria-invalid');control.removeAttribute?.('aria-errormessage');}};
 // Mark the offending control, expose the message through the shared status line and throw.
 const fail=(control,message)=>{clearMarks();status.textContent=tr(message);if(control){control.setAttribute('aria-invalid','true');control.setAttribute('aria-errormessage',status.id);control.focus?.();}throw Error(tr(message));};
 // Blank or non-finite drafts are refused here, before any API call, so Number('')=0 never leaks.
 const pick=id=>{const control=fields[id],raw=control.value;if(typeof raw!=='string'||!raw.trim()||!Number.isFinite(Number(raw)))fail(control,'全ての項目を空欄でない有限の数値で入力してください。');return Number(raw);};
 function read(){
  const mesh=pick('spherical-mesh');if(!Number.isInteger(mesh)||mesh<0)fail(fields['spherical-mesh'],'部品番号は0以上の整数で入力してください。');
  const spec={exactCad:true};
  for(const [prefix,key]of vectors)spec[key]=['x','y','z'].map(axis=>pick(prefix+'-'+axis));
  for(const [id,key]of scalars)spec[key]=pick(id);
  status.textContent='';return {mesh,spec};
 }
 function restore(spec){
  if(spec!==undefined){
   const valid=spec!==null&&typeof spec==='object'&&!Array.isArray(spec)&&Number.isInteger(spec.mesh)&&spec.mesh>=0&&scalars.every(([,key])=>Number.isFinite(spec[key]))&&vectors.every(([,key])=>Array.isArray(spec[key])&&spec[key].length===3&&spec[key].every(Number.isFinite));
   // Validate the whole restored spec before touching any control.
   if(!valid)throw Error('Invalid restored spherical dimensions');
  }
  const source=spec??defaults;fields['spherical-mesh'].value=String(source.mesh);for(const [prefix,key]of vectors)source[key].forEach((value,i)=>fields[prefix+'-'+'xyz'[i]].value=String(value));for(const [id,key]of scalars)fields[id].value=String(source[key]);clearMarks();status.textContent='';
 }
 async function run(){let parsed;try{parsed=read();}catch{return;}try{await onSelect(parsed.mesh,parsed.spec);status.textContent=tr('球面の数値領域を選択しました。');}catch(error){status.textContent=tr('選択に失敗しました。入力は保持しています。')+' '+error.message;}}
 select.onclick=run;
 return Object.freeze({read,restore,run});
}
