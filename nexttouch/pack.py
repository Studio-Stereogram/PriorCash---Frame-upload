import numpy as np, base64, json
d=np.load('/home/claude/out/geo.npz'); V=d['MV'];T=d['MT'];MP=d['MP'];names=[str(n) for n in d['names']];S=d['segs']
def layer(n):
    if n in('BOTTOM-CASE','TOP-CASE-PANEL-TYPE','BATTERY-COVER','SILICON-DECORATION'): return 0
    if n=='10INCH-TOUCH-SCREEN': return 1
    if n in('4P93-INCH-LCD','PANEL-RIGHT','PANEL-LEFT'): return 2
    if n.startswith('PAPER-BIN') or n=='FISCO-PAPER-CUT': return 3
    return 4
LY=np.array([layer(n) for n in names])
lo=np.minimum(V.min(0),S[:,:6].reshape(-1,3).min(0)); hi=np.maximum(V.max(0),S[:,:6].reshape(-1,3).max(0)); c=(lo+hi)/2; SC=150.0
def xf(P): P=(P-c)/SC; return np.stack([P[:,0],P[:,2],-P[:,1]],1)
def xn(N): return np.stack([N[:,0],N[:,2],-N[:,1]],1)
q=lambda P: np.clip(np.round(P*32767),-32767,32767).astype('<i2')
qn=lambda N: np.clip(np.round(N*127),-127,127).astype('i1')
# weld
key=np.round(V/0.02).astype(np.int64); u,inv=np.unique(key,axis=0,return_inverse=True); inv=inv.ravel()
W=np.zeros((len(u),3)); W[inv]=V; T2=inv[T]
ok=(T2[:,0]!=T2[:,1])&(T2[:,1]!=T2[:,2])&(T2[:,0]!=T2[:,2]); T2=T2[ok]; TL=LY[MP[ok]]
a,b,cc=W[T2[:,0]],W[T2[:,1]],W[T2[:,2]]; n=np.cross(b-a,cc-a); n/=np.linalg.norm(n,axis=1)[:,None]+1e-12
E={}
for ti,t in enumerate(T2):
    for i in range(3):
        k=(min(t[i],t[(i+1)%3]),max(t[i],t[(i+1)%3])); E.setdefault(k,[]).append(ti)
rows=[]
for (i,j),ts in E.items():
    if len(ts)!=2: continue
    d_=n[ts[0]]@n[ts[1]]
    if d_<0.5 or d_>0.99995: continue
    rows.append((*W[i],*W[j],*n[ts[0]],*n[ts[1]],255,TL[ts[0]],0))
M=np.array(rows); print('mesh sil edges',len(M),'verts',len(W),'tris',len(T2))
B=np.concatenate([S[:,:12],np.minimum(S[:,12:13],255),LY[S[:,13].astype(int)][:,None],np.ones((len(S),1))],1)
A=np.concatenate([B,M])
n_=len(A); buf=np.zeros(n_,dtype=[('p0','<i2',3),('p1','<i2',3),('nA','i1',3),('nB','i1',3),('len','u1'),('ly','u1'),('kind','u1'),('pad','u1')])
buf['p0']=q(xf(A[:,0:3]));buf['p1']=q(xf(A[:,3:6]));buf['nA']=qn(xn(A[:,6:9]));buf['nB']=qn(xn(A[:,9:12]));buf['len']=A[:,12];buf['ly']=A[:,13];buf['kind']=A[:,14]
print('segs',n_,buf.itemsize)
vt=q(xf(W)); idx=T2.astype('<u2' if len(W)<65536 else '<u4')
def quad(pts): return xf(np.array(pts,float)).round(4).tolist()
out=dict(n=n_,nv=len(W),nt=len(T2),i32=len(W)>=65536,
 segs=base64.b64encode(buf.tobytes()).decode(),verts=base64.b64encode(vt.tobytes()).decode(),idx=base64.b64encode(idx.tobytes()).decode(),
 big=quad([(1138.4,-81.2,-18.3),(1374.2,-81.2,-18.3),(1374.2,-219.7,-68.7),(1138.4,-219.7,-68.7)]),
 small=quad([(1256.3,-29.4,-15.6),(1150.8,-29.4,-15.6),(1150.8,28.8,-49.2),(1256.3,28.8,-49.2)]),
 bbox=[xf(np.array([lo])).tolist()[0],xf(np.array([hi])).tolist()[0]])
js='window.GEO='+json.dumps(out)+';'
open('/home/claude/out/geo.js','w').write(js); print(len(js)/1e6,'MB', out['big'], out['small'], out['bbox'])
