import {test} from 'node:test';import assert from 'node:assert/strict';
globalThis.location={search:'?lang=en'};globalThis.localStorage={getItem:()=>null};
const {translate,addTranslations}=await import('../src/i18n.js');
test('English static labels, dynamic counts and API validation messages',()=>{assert.equal(translate('材料カテゴリ'),'Material category');assert.equal(translate('3 三角形を選択'),'3 triangles selected');assert.equal(translate('12 件'),'12 items');assert.equal(translate('ヤング率が有効範囲外です。'),'Young’s modulus is outside the valid range.');assert.equal(translate('my-part.step'),'my-part.step');});
test('task translations prefer complete strings over component replacements',()=>{addTranslations({'材料の数値・単位・出典を登録':'Register material values, units and sources'});assert.equal(translate('材料の数値・単位・出典を登録'),'Register material values, units and sources');});
