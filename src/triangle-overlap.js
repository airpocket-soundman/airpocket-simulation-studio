// Shared pure 2D triangle overlap geometry. Extracted from the overlap integration
// that already lived inside thermal-contact.js so planar-heat-transfer.js can reuse it
// without duplicating the Sutherland-Hodgman clip / barycentric code. Behaviour is
// unchanged: thermal-contact.js imports these same functions.
export const sub2=(a,b)=>[a[0]-b[0],a[1]-b[1]];
export const cross2=(a,b)=>a[0]*b[1]-a[1]*b[0];
export function clipPolygon(subject,triangle,tolerance){let polygon=subject.map(p=>[...p]),edges=triangle.map(p=>[...p]);if(cross2(sub2(edges[1],edges[0]),sub2(edges[2],edges[0]))<0)edges.reverse();for(let e=0;e<3;e++){const a=edges[e],edge=sub2(edges[(e+1)%3],a),next=[];for(let i=0;i<polygon.length;i++){const p=polygon[i],q=polygon[(i+1)%polygon.length],dp=cross2(edge,sub2(p,a)),dq=cross2(edge,sub2(q,a)),insideP=dp>=-tolerance,insideQ=dq>=-tolerance;if(insideP)next.push(p);if(insideP!==insideQ){const t=dp/(dp-dq);next.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}}polygon=next;if(!polygon.length)break;}return polygon;}
export function barycentric2(p,t){const a=sub2(t[1],t[0]),b=sub2(t[2],t[0]),c=sub2(p,t[0]),den=cross2(a,b);if(Math.abs(den)<1e-14)throw Error('Degenerate overlap triangle');const u=cross2(c,b)/den,v=cross2(a,c)/den;return [1-u-v,u,v];}
