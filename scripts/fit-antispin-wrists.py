"""Fit a continuous cyclic hand pose, not independent per-frame solutions."""
import json, sys
import numpy as np
from scipy.optimize import least_squares
from scipy.sparse import lil_matrix

data=json.load(open(sys.argv[1]));result={}
for side,rows in data.items():
    n=len(rows)
    axis=np.array([x['axis']for x in rows]);forward=np.array([x['forward']for x in rows]);prior=np.array([x['prior']for x in rows])
    def residual(flat):
        q=flat.reshape(n,3);a,p,d=q.T
        sa,ca,sp,cp,sd,cd=np.sin(a),np.cos(a),np.sin(p),np.cos(p),np.sin(d),np.cos(d)
        normal=np.stack([sp*ca,-sa,cp*ca],1)
        fingers=np.stack([-cp*sd+sp*cd*sa,cd*ca,sp*sd+cp*cd*sa],1)
        plane=(axis*normal).sum(1)[:,None]*12
        target=(fingers-forward)*1.3
        anchor=(q-prior)*.5
        velocity=(q-np.roll(q,1,axis=0))*6
        acceleration=(np.roll(q,1,axis=0)-2*q+np.roll(q,-1,axis=0))*35
        return np.concatenate([plane,target,anchor,velocity,acceleration],axis=1).ravel()
    # Each frame depends only on itself and its cyclic neighbours.
    sparsity=lil_matrix((n*13,n*3),dtype=int)
    for i in range(n):
        for j in [(i-1)%n,i,(i+1)%n]:sparsity[i*13:(i+1)*13,j*3:(j+1)*3]=1
    lo=np.tile(np.deg2rad([-80,-90,-25]),n);hi=-lo
    fit=least_squares(residual,prior.ravel(),bounds=(lo,hi),jac_sparsity=sparsity.tocsr(),max_nfev=180,ftol=1e-7,xtol=1e-7,gtol=1e-7)
    q=fit.x.reshape(n,3);result[side]=q.tolist()+[q[0].tolist()]
    print(side,'cost',round(fit.cost,3),'max step degrees',np.rad2deg(abs(q-np.roll(q,1,axis=0))).max(),flush=True)
json.dump(result,open(sys.argv[2],'w'))
