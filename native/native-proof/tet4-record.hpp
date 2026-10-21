// Bounded prepared-record entry point; same solver adapter in host and WASM.
#include <vector>
#include <set>
#include <algorithm>
#include <array>
inline void native_record_require(bool ok,const char* message){if(!ok)throw std::runtime_error(message);}
inline int run_tet4_record(std::istream& in,const char* runtime){
 auto fail=[](bool ok){native_record_require(ok,"Invalid native Tet4 record");};
 std::string revision,source,meshRevision;double young=0,nu=0;int nn=0,ne=0,nf=0;
 fail(bool(in>>revision>>source>>meshRevision>>young>>nu>>nn>>ne>>nf));
 for(const auto& id:{revision,source,meshRevision})fail(id.size()==64&&id.find_first_not_of("0123456789abcdef")==std::string::npos);
 fail(std::isfinite(young)&&young>0&&young<=1e15&&std::isfinite(nu)&&nu>-1&&nu<.49&&nn>=4&&nn<=512&&ne>0&&ne<=1024&&nf>=3&&nf<=nn);
 std::vector<double> xyz(nn*3),force(nn*3),bases(nn*9,0),u(nn*3),reaction(nn*3,0);std::vector<std::array<int,4>> elements(ne);std::vector<int> fixedNodes(nf),fixed;std::vector<double> values(nf*3,0);
 for(double& x:xyz){fail(bool(in>>x));fail(std::isfinite(x)&&std::abs(x)<=1e6);x*=.001;} // mm -> m exactly once
 std::set<std::array<int,4>> unique;std::vector<bool> used(nn,false);std::vector<std::set<int>> adjacent(nn);
 for(auto& t:elements){
  for(int& i:t){fail(bool(in>>i));fail(i>=0&&i<nn);used[i]=true;}
  auto key=t;std::sort(key.begin(),key.end());fail(std::adjacent_find(key.begin(),key.end())==key.end()&&unique.insert(key).second);
  double e[3][3],s=0;for(int i=0;i<3;i++)for(int k=0;k<3;k++){e[i][k]=xyz[t[i+1]*3+k]-xyz[t[0]*3+k];s=std::max(s,std::abs(e[i][k]));}fail(s>0);for(auto& row:e)for(double& x:row)x/=s;
  double det=e[0][0]*(e[1][1]*e[2][2]-e[1][2]*e[2][1])-e[0][1]*(e[1][0]*e[2][2]-e[1][2]*e[2][0])+e[0][2]*(e[1][0]*e[2][1]-e[1][1]*e[2][0]);fail(std::isfinite(det)&&det>1e-12);
  for(int i:t)for(int j:t)adjacent[i].insert(j);
 }
 fail(std::find(used.begin(),used.end(),false)==used.end());std::set<int> visited{0};std::vector<int> pending{0};while(!pending.empty()){int i=pending.back();pending.pop_back();for(int j:adjacent[i])if(visited.insert(j).second)pending.push_back(j);}fail(int(visited.size())==nn);
 std::set<int> fixedSet;for(int& i:fixedNodes){fail(bool(in>>i));fail(i>=0&&i<nn&&fixedSet.insert(i).second);for(int k=0;k<3;k++)fixed.push_back(i*3+k);}
 bool noncollinear=false;
 for(int i=1;i<nf;i++)for(int j=i+1;j<nf;j++){
  double a[3],b[3],s=0;for(int k=0;k<3;k++){a[k]=xyz[3*fixedNodes[i]+k]-xyz[3*fixedNodes[0]+k];b[k]=xyz[3*fixedNodes[j]+k]-xyz[3*fixedNodes[0]+k];s=std::max(s,std::max(std::abs(a[k]),std::abs(b[k])));}if(s==0)continue;for(int k=0;k<3;k++){a[k]/=s;b[k]/=s;}
  if(std::hypot(std::hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2]),a[0]*b[1]-a[1]*b[0])>1e-12)noncollinear=true;
 }
 fail(noncollinear);for(double& x:force){fail(bool(in>>x));fail(std::isfinite(x)&&std::abs(x)<=1e12);}std::string extra;fail(!(in>>extra));
 std::ostringstream text;text<<std::setprecision(17)<<"MFEM mesh v1.0\n\ndimension\n3\n\nelements\n"<<ne<<'\n';for(auto& t:elements)text<<"1 4 "<<t[0]<<' '<<t[1]<<' '<<t[2]<<' '<<t[3]<<'\n';text<<"\nboundary\n0\n\nvertices\n"<<nn<<"\n3\n";for(int i=0;i<nn;i++)text<<xyz[3*i]<<' '<<xyz[3*i+1]<<' '<<xyz[3*i+2]<<'\n';
 for(int node=0;node<nn;node++)for(int k=0;k<3;k++)bases[node*9+k*3+k]=1;double stats[2]={};
 if(solve_elastic(text.str().c_str(),young,nu,bases.data(),force.data(),fixed.size(),fixed.data(),values.data(),u.data(),stats))throw std::runtime_error(last_error());
 // Independent stiffness application measures reactions; it is not a second solver.
 std::istringstream meshText(text.str());mfem::Mesh mesh(meshText,0,1,true);mfem::H1_FECollection collection(1,3);mfem::FiniteElementSpace space(&mesh,&collection,3,mfem::Ordering::byVDIM);mfem::ConstantCoefficient lambda(young*nu/((1+nu)*(1-2*nu))),mu(young/(2*(1+nu)));mfem::BilinearForm form(&space);form.AddDomainIntegrator(new mfem::ElasticityIntegrator(lambda,mu));form.Assemble();form.Finalize();mfem::Vector solution(nn*3),ku(nn*3);mfem::Array<int> dofs;
 for(int node=0;node<nn;node++){space.GetVertexDofs(node,dofs);for(int k=0;k<3;k++)solution[space.DofToVDof(dofs[0],k)]=u[node*3+k];}form.SpMat().Mult(solution,ku);
 double applied[3]={},balance[3]={};for(int node=0;node<nn;node++){space.GetVertexDofs(node,dofs);for(int k=0;k<3;k++){applied[k]+=force[3*node+k];if(fixedSet.count(node))reaction[3*node+k]=ku[space.DofToVDof(dofs[0],k)]-force[3*node+k];balance[k]+=force[3*node+k]+reaction[3*node+k];}}
 for(int k=0;k<3;k++)fail(std::isfinite(balance[k])&&std::abs(balance[k])<=1e-8+std::abs(applied[k])*1e-7);
 auto array=[](const auto& values){std::cout<<'[';bool first=true;for(double x:values){native_record_require(std::isfinite(x),"Nonfinite native Tet4 result");if(!first)std::cout<<',';std::cout<<x;first=false;}std::cout<<']';};
 std::cout<<std::setprecision(17)<<"{\"schemaVersion\":2,\"kind\":\"prepared-isotropic-tet4\",\"engine\":\"mfem-native\",\"runtime\":\""<<runtime<<"\",\"mfemVersion\":"<<MFEM_VERSION<<",\"recordRevision\":\"sha256:"<<revision<<"\",\"sourceInputRevision\":\"sha256:"<<source<<"\",\"meshRevision\":\"sha256:"<<meshRevision<<"\",\"units\":\"m-N\",\"nodeCount\":"<<nn<<",\"elementCount\":"<<ne<<",\"converged\":true,\"iterations\":"<<int(stats[0])<<",\"verifiedResidual\":"<<stats[1]<<",\"displacementM\":";array(u);std::cout<<",\"reactionsN\":";array(reaction);std::cout<<",\"appliedN\":";array(applied);std::cout<<",\"balanceN\":";array(balance);std::cout<<"}\n";return 0;
}
