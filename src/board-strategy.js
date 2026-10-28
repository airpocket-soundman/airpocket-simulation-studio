import direction from '../docs/product-direction.md?raw';
import competition from '../docs/competitive-landscape.md?raw';
import viewer from '../docs/result-viewer-direction.md?raw';
import agent from '../docs/agent-operation.md?raw';
import measurement from '../docs/printed-material-measurement.md?raw';

const documents=[['製品仕様', 'product-direction.md', direction], ['競合比較', 'competitive-landscape.md', competition], ['結果ビューア・出力仕様', 'result-viewer-direction.md', viewer], ['LLM運用・API仕様', 'agent-operation.md', agent], ['3Dプリント材料・造形条件の測定企画', 'printed-material-measurement.md', measurement]];
const element=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};

export function renderStrategy(root,repo){
 root.classList.add('strategy-panel');
 root.append(element('p','自分のエージェントと計算資源で、設計と解析を反復するOSS CAE。仕様案・現状・目標を区別して表示します。'));
 for(const [title,path,source] of documents){
  const section=element('details');section.open=title==='競合比較';
  section.append(element('summary',title));
  const link=element('a','GitHubで文書を開く ↗');link.href=`${repo}/blob/main/docs/${path}`;link.target='_blank';link.rel='noopener';section.append(link);
  const lines=source.split(/\r?\n/);
  for(let i=0;i<lines.length;i++){
   const line=lines[i].trim();if(!line)continue;
   if(line.startsWith('|')){
    const rows=[];while(i<lines.length&&lines[i].trim().startsWith('|'))rows.push(lines[i++].trim());i--;
    const wrapper=element('div');wrapper.className='strategy-table';wrapper.tabIndex=0;wrapper.setAttribute('role','region');wrapper.setAttribute('aria-label',title+'の表');
    const table=element('table');
    rows.filter(row=>!/^\|[\s:|\-]+\|$/.test(row)).forEach((row,index)=>{const tr=element('tr');for(const cell of row.slice(1,-1).split('|'))tr.append(element(index===0?'th':'td',cell.trim()));table.append(tr);});
    wrapper.append(table);section.append(wrapper);continue;
   }
   const heading=line.match(/^(#{1,6})\s+(.*)$/);
   if(heading){section.append(element(heading[1].length===1?'h3':'h4',heading[2]));continue;}
   section.append(element('p',line));
  }
  root.append(section);
 }
}
