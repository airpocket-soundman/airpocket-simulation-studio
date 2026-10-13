#include "mfem.hpp"
#include <emscripten/emscripten.h>
#include <sstream>
#include <string>
#include <vector>
#include <cmath>
#include <stdexcept>
static std::string error_text;
extern "C" {
EMSCRIPTEN_KEEPALIVE const char* last_error(){ return error_text.c_str(); }
EMSCRIPTEN_KEEPALIVE int adapter_abi(){ return 1; }
EMSCRIPTEN_KEEPALIVE int mfem_version(){ return MFEM_VERSION; }
EMSCRIPTEN_KEEPALIVE int solve_elastic(const char* text, double young, double nu, const double* bases, const double* force, int count, const int* fixed, const double* values, double* output, double* stats){
 try {
  error_text.clear(); if(!(young>0)||!std::isfinite(young)||!std::isfinite(nu)||nu<=-1||nu>=.49)throw std::runtime_error("Invalid MFEM material");
  std::istringstream stream(text); mfem::Mesh mesh(stream,0,1,true); if(mesh.Dimension()!=3||mesh.GetNE()>30000)throw std::runtime_error("Invalid MFEM mesh size");
  mfem::H1_FECollection collection(1,3); mfem::FiniteElementSpace space(&mesh,&collection,3,mfem::Ordering::byVDIM); const int nodes=mesh.GetNV(),n=nodes*3;
  if(space.GetVSize()!=n||count<1||count>n)throw std::runtime_error("Invalid MFEM degree count");
  std::vector<int> canonical(n,-1); mfem::Array<int> vertex;
  for(int i=0;i<nodes;i++){space.GetVertexDofs(i,vertex);if(vertex.Size()!=1)throw std::runtime_error("MFEM requires linear vertex degrees");for(int k=0;k<3;k++)canonical[space.DofToVDof(vertex[0],k)]=3*i+k;}
  mfem::ConstantCoefficient lambda(young*nu/((1+nu)*(1-2*nu))),mu(young/(2*(1+nu)));mfem::BilinearForm form(&space);form.AddDomainIntegrator(new mfem::ElasticityIntegrator(lambda,mu));form.Assemble();form.Finalize();
  const mfem::SparseMatrix &global=form.SpMat();mfem::SparseMatrix local(n);const int *rows=global.GetI(),*cols=global.GetJ();const double *data=global.GetData();
  for(int row=0;row<n;row++){const int r=canonical[row];if(r<0)throw std::runtime_error("Invalid MFEM vertex mapping");for(int at=rows[row];at<rows[row+1];at++){const int c=canonical[cols[at]];for(int i=0;i<3;i++)for(int j=0;j<3;j++){const double value=data[at]*bases[(r/3)*9+i*3+r%3]*bases[(c/3)*9+j*3+c%3];if(value!=0)local.Add((r/3)*3+i,(c/3)*3+j,value);}}}local.Finalize();
  mfem::Vector prescribed(n),kg(n),rhs(n),delta(n),u(n),ku(n);prescribed=0.;std::vector<bool> mask(n,false);for(int i=0;i<count;i++){if(fixed[i]<0||fixed[i]>=n||!std::isfinite(values[i]))throw std::runtime_error("Invalid MFEM constraint");prescribed[fixed[i]]=values[i];mask[fixed[i]]=true;}
  local.Mult(prescribed,kg);double norm=0.;for(int i=0;i<n;i++){rhs[i]=mask[i]?0.:force[i]-kg[i];norm+=rhs[i]*rhs[i];}mfem::SparseMatrix reduced(local);for(int i=0;i<count;i++)reduced.EliminateRowCol(fixed[i]);
  delta=0.;int iterations=0;if(norm>0){mfem::GSSmoother preconditioner(reduced);mfem::CGSolver cg;cg.SetOperator(reduced);cg.SetPreconditioner(preconditioner);cg.SetRelTol(1e-10);cg.SetAbsTol(0.);cg.SetMaxIter(2500);cg.SetPrintLevel(-1);cg.Mult(rhs,delta);if(!cg.GetConverged())throw std::runtime_error("MFEM did not converge");iterations=cg.GetNumIterations();}
  for(int i=0;i<n;i++){u[i]=prescribed[i]+delta[i];if(!std::isfinite(u[i]))throw std::runtime_error("MFEM nonfinite solution");output[i]=u[i];}local.Mult(u,ku);double error=0.;for(int i=0;i<n;i++)if(!mask[i])error+=(ku[i]-force[i])*(ku[i]-force[i]);const double residual=norm?std::sqrt(error/norm):std::sqrt(error);if(!std::isfinite(residual)||residual>2e-8)throw std::runtime_error("MFEM failed residual verification");stats[0]=iterations;stats[1]=residual;return 0;
 }catch(const std::exception &e){error_text=e.what();return 1;}
}
}
