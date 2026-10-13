// Keep core/API errors in English; localize their UI presentation without changing diagnostics.
const messages={
 'Invalid planar rectangle dimensions':'矩形の位置と上下限を確認してください。',
 'Planar rectangle must be covered by one planar display surface':'矩形全体が1枚の平面の内側に入るように指定してください。',
 'Planar rectangle must lie on one external planar CAD face':'矩形は1枚の外側CAD平面に指定してください。',
 'Exact planar patches require a STEP or box solid':'矩形のCAD分割はSTEPか直方体に対応します。',
 'Exact planar patches currently require a single CAD volume':'矩形のCAD分割は単一のCAD部品に対応します。',
 'Exact planar thermal contact patches are not yet supported':'矩形のCAD分割による接触熱抵抗は未対応です。',
 'At most twenty exact planar patches are supported':'矩形のCAD分割は20領域までです。',

 'Internal fluid seed is inside the solid or on its boundary':'指定点は固体内、またはその境界上です。流体空間の内側を指定してください。',
 'Selected fluid leaks to a box face not declared as a port; adjust the cap planes':'指定した流体空間が、ポート以外の箱の面に接続しています。開口を閉じる位置を見直してください。',
 'A declared port does not intersect the selected fluid volume':'指定したポートが流体空間に接していません。端面の位置かポート指定を見直してください。',
 'Seed does not identify exactly one CAD fluid volume':'指定点に対応する流体空間を一つに絞れません。点と箱の位置を見直してください。',
 'Internal fluid domain requires an interior seed and unique box port planes':'箱の内側の点と、重複しないポート面を指定してください。',
 'Internal channel flow requires a CAD-verified straight channel and matching axis':'この流れ計算は、CADで確認した円形・角形の直管だけに対応します。流路の形状と軸を確認してください。',
 'CAD circular channel wall does not match the analysis mesh':'直管のCAD形状とメッシュの壁面が一致しません。領域を作り直してください。',
 'Invalid hollow tube dimensions':'中空管の寸法が不正です。内半径を外半径より小さくしてください。',
 'Load an original solid before extracting internal fluid':'内部領域を取り出す前に、元の部品を読み込んでください。',
 'No fluid volume remains after subtraction':'部品を差し引いた後に流体空間が残りません。箱と部品の位置を確認してください。',
 'Invalid saved internal fluid metadata':'保存した内部流体領域の情報が不正です。',
 'Saved internal fluid mesh does not match its source':'保存した内部流体メッシュと元の設定が一致しません。',
 'Saved port geometry does not match the enclosure':'保存したポートの形状と箱の位置が一致しません。',
 'Saved internal fluid ports are incomplete':'保存した内部流体のポートが不足しています。',
 'Invalid saved CAD channel geometry':'保存した直管の形状情報が不正です。',
 'Positive viscosity, fluid density and sound speed required':'粘度・流体密度・音速には正の値を指定してください。',
 'Channel Reynolds number exceeds the supported conservative laminar limit of 1500':'対応する層流範囲を超えています。Reは1500以下にしてください。',
 'Channel speed exceeds the supported incompressible Mach limit of 0.1':'対応する非圧縮の流れの速度範囲を超えています。Machは0.1以下にしてください。',
 'Modal prototype requires linear CPU structure, homogeneous supports and no gravity, thermal stress or adaptation':'固有振動は線形・CPUの構造計算に対応します。ゼロ変位の拘束だけを使い、重力・熱応力・適応解析を解除してください。',
 'Modal analysis requires linear elasticity and positive density':'固有振動には線形弾性の物性と正の密度が必要です。',
 'Modal analysis accepts homogeneous supports only; remove loads and prescribed motion':'固有振動では荷重とゼロ以外の指定変位を解除してください。',
 'Modal subspace did not converge; no unverified modes returned':'固有振動が収束しませんでした。未確認のモードは表示しません。メッシュか反復上限を見直してください。',
 'Modal prototype limit: 2000 nodes / 8000 tetrahedra':'固有振動の上限は2000節点・8000四面体です。メッシュを粗くしてください。',
 'Modal sound prototype requires the unchanged box solid':'現在の振動音響連成は、形状を変更していない直方体部品だけに対応します。',
 'Modal sound coupling requires exterior frequency acoustics at the saved mode frequency':'振動音響連成には、保存したモードと同じ周波数の外部音響を使ってください。',
 'Prescribed modal velocity exceeds the small-amplitude acoustic limit':'指定振幅の速度が小振幅音響の範囲を超えています。振幅を小さくしてください。',
 'Modal sound prototype uses the complete solid surface; remove manual acoustic boundary conditions':'振動音源は部品表面全体を使います。手動の音圧・吸音条件を解除してください。',
 'Invalid modal acoustic source':'振動音源のデータが不正です。振幅・位相と保存ケースを確認してください。',
 'Modal acoustic box interface is incomplete':'振動音源と空気の界面が不足しています。外部音響領域を作り直してください。',
 'Transient acoustics requires zero harmonic loss and no frequency sweep or far-field calculation':'過渡音響では損失係数を0にし、周波数スイープと遠方界を解除してください。',
 'Transient duration must include the complete 12-width pulse':'計算時間はパルス幅の12倍以上にしてください。',
 'Requested acoustic time step exceeds the conservative stability bound':'時間刻みが安定上限を超えています。0で自動設定するか、刻みを小さくしてください。',
 'Transient acoustic workload limit exceeded; shorten duration or reduce mesh size':'過渡音響の計算量上限を超えています。計算時間を短くするか、節点数を減らしてください。',
 'Transient impedance must be positive, real and constant':'過渡音響の吸音境界は、正の一定抵抗だけに対応します。',
 'Transient acoustic mesh edge exceeds one sixth of the three-sigma pulse bandwidth wavelength':'パルスの帯域に対してメッシュが粗すぎます。メッシュを細かくするか、周波数を下げてください。',
 'Actual acoustic mesh edge exceeds one sixth wavelength; refine the mesh':'波長に対してメッシュの辺が長すぎます。メッシュを細かくしてください。',
 'Specify an acoustic pressure or normal velocity region':'音圧の領域か振動音源を指定してください。',
 'Normal velocity cannot overlap pressure or impedance':'振動音源の領域に音圧・吸音条件を重ねることはできません。',
};
export const errorTranslations=Object.fromEntries(Object.entries(messages).map(([en,jp])=>[jp,en]));
errorTranslations['固有振動の反復 ']='Natural-mode iteration ';
errorTranslations['過渡音響の時間ステップ ']='Transient acoustic time step ';
export function localizeStatus(text){
 for(const [en,jp]of Object.entries(messages))if(text===en||text.startsWith(en+' · '))return jp+text.slice(en.length);
 return text.replace(/^Modal subspace /,'固有振動の反復 ').replace(/^Transient acoustics /,'過渡音響の時間ステップ ');
}
