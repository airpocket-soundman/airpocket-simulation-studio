self.onmessage = async ({data}) => {
  try {
    importScripts(data.base + 'cad/occt-import-js.js');
    const occt = await self.occtimportjs({locateFile: name => data.base + 'cad/' + name});
    const result = occt.ReadStepFile(new Uint8Array(data.buffer), {linearUnit:'millimeter',linearDeflectionType:'bounding_box_ratio',linearDeflection:0.001,angularDeflection:0.2});
    if (!result.success || !result.meshes.length) throw Error('有効な形状がありません。');
    self.postMessage({result});
  } catch (error) { self.postMessage({error:error.message}); }
};
