#include "mfem.hpp"
#include <cmath>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
extern "C" int solve_elastic(const char*,double,double,const double*,const double*,int,const int*,const double*,double*,double*);
extern "C" const char* last_error();
#include "tet4-record.hpp"

// Deliberately narrow native proof: a 10 x 10 x 40 mm axial bar, nu=0.
// stdin: airpocket-native-proof-v1 <Young modulus Pa> <axial load N>
// stdout: one JSON result. This is not the saved-project/headless interface.
int main() {
 try {
#ifdef __EMSCRIPTEN__
  const char* runtime="wasm-development-check";
#else
  const char* runtime="host-native";
#endif
  std::string payload;char byte;while(std::cin.get(byte)){if(payload.size()>=262144)throw std::runtime_error("Native proof input exceeds 262144 bytes");payload+=byte;}
  std::istringstream in(payload);
  std::string protocol,extra;double young=0,load=0;
  if(!(in>>protocol))throw std::runtime_error("Expected airpocket-native-proof-v1 youngPa loadN");
  if(protocol=="airpocket-native-tet4-v2")return run_tet4_record(in,runtime);
  if(!(in>>young>>load)||protocol!="airpocket-native-proof-v1"||!std::isfinite(young)||young<=0||!std::isfinite(load)||in>>extra)throw std::runtime_error("Expected airpocket-native-proof-v1 youngPa loadN");
  const std::string text="MFEM mesh v1.0\n\ndimension\n3\n\nelements\n6\n1 4 0 1 2 6\n1 4 0 2 3 6\n1 4 0 3 7 6\n1 4 0 7 4 6\n1 4 0 4 5 6\n1 4 0 5 1 6\n\nboundary\n0\n\nvertices\n8\n3\n0 0 0\n.01 0 0\n.01 .01 0\n0 .01 0\n0 0 .04\n.01 0 .04\n.01 .01 .04\n0 .01 .04\n";
  double bases[72]={},force[24]={},values[12]={},u[24]={},stats[2]={};int fixed[12];
  for(int n=0;n<8;n++)for(int k=0;k<3;k++)bases[n*9+k*3+k]=1;
  for(int i=0;i<12;i++)fixed[i]=i;
  force[14]=load/3;force[17]=load/6;force[20]=load/3;force[23]=load/6;
  if(solve_elastic(text.c_str(),young,0,bases,force,12,fixed,values,u,stats))throw std::runtime_error(last_error());
  std::istringstream stream(text);mfem::Mesh mesh(stream,0,1,true);mfem::H1_FECollection collection(1,3);mfem::FiniteElementSpace space(&mesh,&collection,3,mfem::Ordering::byVDIM);
  mfem::ConstantCoefficient lambda(0),mu(young/2);mfem::BilinearForm form(&space);form.AddDomainIntegrator(new mfem::ElasticityIntegrator(lambda,mu));form.Assemble();form.Finalize();
  mfem::Vector solution(24),ku(24);mfem::Array<int> dofs;
  for(int n=0;n<8;n++){space.GetVertexDofs(n,dofs);for(int k=0;k<3;k++)solution[space.DofToVDof(dofs[0],k)]=u[n*3+k];}
  form.SpMat().Mult(solution,ku);double reaction=0;
  for(int n=0;n<4;n++){space.GetVertexDofs(n,dofs);reaction+=ku[space.DofToVDof(dofs[0],2)];}
  const double expected=load*.04/(young*.0001);double error=0;
  for(int n=0;n<8;n++){const double z=n<4?0:.04;for(int k=0;k<3;k++)error=std::max(error,std::abs(u[n*3+k]-(k==2?expected*z/.04:0)));}
  const double balance=std::abs(reaction+load);
  if(error>1e-10+std::abs(expected)*1e-7||balance>1e-8+std::abs(load)*1e-7)throw std::runtime_error("Native axial reference or force balance verification failed");
  std::cout<<std::setprecision(17)<<"{\"schemaVersion\":1,\"engine\":\"mfem-native\",\"runtime\":\""<<runtime<<"\",\"mfemVersion\":"<<MFEM_VERSION<<",\"youngPa\":"<<young<<",\"loadN\":"<<load<<",\"expectedDisplacementM\":"<<expected<<",\"topDisplacementM\":"<<u[14]<<",\"maxDisplacementErrorM\":"<<error<<",\"reactionN\":"<<reaction<<",\"forceBalanceErrorN\":"<<balance<<",\"verifiedResidual\":"<<stats[1]<<"}\n";
  return 0;
 }catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
}
