import {validateOpeningCaps} from '../fluid-opening-caps.js';
const translations={
 '明示的な平面cap（任意）':'Explicit planar caps (optional)',
 'capを追加':'Add cap','capを削除':'Remove cap','cap ID':'Cap ID',
 '箱全体を平面で切ります。開口wireの自動認識や部分面の蓋、複数体積の結合ではありません。保持側は dot(normal, x-point) <= 0。法線は外向き単位ベクトルを入力し、流体内の点を厳密に内側へ置いてください。自動反転・正規化はしません。箱面ポートを使わない場合は全て解除します。':'Planes clip the whole enclosure. This does not recognize opening wires, add local partial-face lids or join volumes. Retained side: dot(normal, x-point) <= 0. Enter explicit outward unit normals with the fluid seed strictly inward. Normals are never automatically reversed or normalized. Disable all box-face ports when none are used.',
 'capは最大6件です。':'At most six caps are supported.',
 'capの全ての点・法線成分を数値で入力してください。':'Enter every cap point and normal component as a number.',
 'capのIDは英字で始まる64文字以内の英数字・_・-にし、重複させないでください。':'Cap IDs must be unique, start with a letter and contain at most 64 letters, digits, _ or -.',
 '法線は外向きの単位ベクトルで指定してください。自動補正は行いません。':'Enter an outward unit normal. No automatic correction is applied.',
 'capの点は箱内に置き、流体内の点をcapの内側へ1e-6 mmより大きい余裕で置いてください。':'Place the cap point in the box and retain the fluid seed inward by more than 1e-6 mm.',
 '各capは箱を横断する平面にしてください。':'Each cap plane must cut through the enclosure.',
 '同じcap平面を重複させないでください。':'Do not duplicate a cap plane.',
 'capの箱・点・法線の値を確認してください。':'Check cap enclosure, point and normal values.'
};
export function createInternalOpeningCapsUi({host,document:doc=globalThis.document,language=()=> 'ja',translate=()=>{}}){
 translate(translations);const tr=text=>language()==='en'?(translations[text]??text):text;
 const element=(tag,text)=>{const e=doc.createElement(tag);if(text)e.textContent=text;return e;};
 const heading=element('h3','明示的な平面cap（任意）'),note=element('p'),list=element('div'),add=element('button','capを追加'),status=element('p');
 // Keep the explanatory contract independent of ordering in the translation map.
 note.textContent='箱全体を平面で切ります。開口wireの自動認識や部分面の蓋、複数体積の結合ではありません。保持側は dot(normal, x-point) <= 0。法線は外向き単位ベクトルを入力し、流体内の点を厳密に内側へ置いてください。自動反転・正規化はしません。箱面ポートを使わない場合は全て解除します。';
 list.id='internal-cap-list';add.id='internal-cap-add';add.type='button';status.id='internal-cap-status';status.setAttribute('role','status');host.append(heading,note,list,add,status);let rows=[],serial=0;
 const clear=control=>{control.removeAttribute?.('aria-invalid');control.removeAttribute?.('aria-errormessage');status.textContent='';};
 const fail=(control,message)=>{const error=Error(tr(message));status.textContent=message;if(control){control.setAttribute('aria-invalid','true');control.setAttribute('aria-errormessage',status.id);control.focus?.();}throw error;};
 const input=(parent,text,value,type='number')=>{const label=element('label'),control=element('input');label.textContent=text;control.type=type;control.value=value===undefined?'':String(value);if(type==='number')control.step='any';else{control.maxLength=64;control.pattern='[A-Za-z][A-Za-z0-9_-]{0,63}';}control.setAttribute('aria-label',text);control.oninput=()=>clear(control);label.append(control);parent.append(label);return control;};
 function append(cap){
  if(rows.length>=6)return;const fieldset=element('fieldset'),legend=element('legend','cap ID');fieldset.style.minWidth='0';fieldset.style.margin='10px 0';fieldset.style.padding='8px';const row={fieldset};fieldset.append(legend);const key=++serial;translations['cap ID '+key]='Cap ID '+key;translate({['cap ID '+key]:'Cap ID '+key});row.id=input(fieldset,'cap ID '+key,cap?.id,'text');row.point=[];row.normal=[];
  for(const [name,controls]of [['point',row.point],['normal',row.normal]]){const group=element('div');group.className='direction';for(const [i,axis]of ['X','Y','Z'].entries()){const ja=(name==='point'?'capの点':'外向き単位法線')+' '+axis+' '+key+(name==='point'?' (mm)':''),en=(name==='point'?'Cap point':'Outward unit normal')+' '+axis+' '+key+(name==='point'?' (mm)':'');translations[ja]=en;translate({[ja]:en});controls.push(input(group,ja,cap?.[name]?.[i]));};fieldset.append(group);}
  const remove=element('button','capを削除');remove.type='button';translations['capを削除 '+key]='Remove cap '+key;translate({['capを削除 '+key]:'Remove cap '+key});remove.setAttribute('aria-label','capを削除 '+key);remove.onclick=()=>{const i=rows.indexOf(row);rows.splice(i,1);fieldset.remove();add.disabled=false;status.textContent='';(rows[Math.min(i,rows.length-1)]?.id??add).focus?.();};fieldset.append(remove);rows.push(row);list.append(fieldset);add.disabled=rows.length>=6;
 }
 add.onclick=()=>{if(rows.length>=6){status.textContent='capは最大6件です。';return;}append();rows.at(-1).id.focus?.();};
 function read(geometry){
  if(!rows.length)return undefined;
  for(const row of rows)for(const c of [row.id,...row.point,...row.normal])clear(c);
  const ids=new Set(),caps=rows.map(row=>{
   if(!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(row.id.value)||ids.has(row.id.value))fail(row.id,'capのIDは英字で始まる64文字以内の英数字・_・-にし、重複させないでください。');ids.add(row.id.value);
   const vector=controls=>controls.map(c=>{if(!c.value.trim()||!Number.isFinite(Number(c.value)))fail(c,'capの全ての点・法線成分を数値で入力してください。');return Number(c.value);});
   const cap={id:row.id.value,point:vector(row.point),normal:vector(row.normal)};if(Math.abs(Math.hypot(...cap.normal)-1)>1e-8)fail(row.normal[0],'法線は外向きの単位ベクトルで指定してください。自動補正は行いません。');return cap;
  });
  try{validateOpeningCaps({mode:'internal',...geometry,openingCaps:caps});}catch(error){const message=/Duplicate/.test(error.message)?'同じcap平面を重複させないでください。':/retain the seed/.test(error.message)?'capの点は箱内に置き、流体内の点をcapの内側へ1e-6 mmより大きい余裕で置いてください。':/cut through/.test(error.message)?'各capは箱を横断する平面にしてください。':'capの箱・点・法線の値を確認してください。';fail(rows[0].point[0],message);}return structuredClone(caps);
 }
 function restore(caps){if(caps!==undefined&&(!Array.isArray(caps)||caps.length<1||caps.length>6))throw Error('Invalid restored opening caps');rows=[];list.replaceChildren();serial=0;status.textContent='';add.disabled=false;for(const cap of caps??[])append(cap);}
 return Object.freeze({read,restore});
}
