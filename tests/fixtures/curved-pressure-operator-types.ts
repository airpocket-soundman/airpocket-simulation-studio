import {buildCurvedPressureTransferOperator,loadCurvedPressureTransferOperator,applyCurvedPressureTransferOperator,applyCurvedPressureTranspose,evaluateCurvedPressureVirtualWork,type CurvedPressureOperatorGeometry} from '../../src/curved-pressure-operator.js';
const g:CurvedPressureOperatorGeometry={lengthUnit:'mm',surface:'open',nodes:[0,0,0,2,0,0,0,3,0],triangles:[[0,1,2]]};
buildCurvedPressureTransferOperator(g).then(async op=>{
 const pressure={units:'Pa' as const,values:[{real:2,imag:3}]},displacement={units:'m' as const,real:Array(9).fill(0),imag:Array(9).fill(0)};
 const force=await applyCurvedPressureTransferOperator(op,g,pressure);const v=await applyCurvedPressureTranspose(op,g,displacement);const w=await evaluateCurvedPressureVirtualWork(op,g,pressure,displacement);const f:number=force.forceReal[2],volume:'m3'=v.unit,work:'J'=w.unit;void f;void volume;void work;
 // @ts-expect-error immutable operator factors
 op.faces[0].outwardNormal[0]=2;
 // @ts-expect-error force data is not a pressure field
 applyCurvedPressureTransferOperator(op,g,{units:'N',values:pressure.values});
 // @ts-expect-error displacement uses m, not mm
 applyCurvedPressureTranspose(op,g,{...displacement,units:'mm'});
 const loaded=await loadCurvedPressureTransferOperator('{}',g);applyCurvedPressureTransferOperator(loaded.operator,g,pressure);
 // @ts-expect-error loaded metadata wrapper is not the issued operator
 applyCurvedPressureTransferOperator(loaded,g,pressure);
});
