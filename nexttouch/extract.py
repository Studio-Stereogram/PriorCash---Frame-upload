import sys, time, json, numpy as np
from OCP.STEPCAFControl import STEPCAFControl_Reader
from OCP.XCAFApp import XCAFApp_Application
from OCP.TDocStd import TDocStd_Document
from OCP.TCollection import TCollection_ExtendedString
from OCP.XCAFDoc import XCAFDoc_DocumentTool
from OCP.TDF import TDF_Label
from OCP.collections import Sequence_TDF_Label as TDF_LabelSequence
from OCP.TDataStd import TDataStd_Name
from OCP.TopLoc import TopLoc_Location
from OCP.TopAbs import TopAbs_FACE, TopAbs_EDGE, TopAbs_REVERSED
from OCP.TopExp import TopExp_Explorer
from OCP.TopoDS import TopoDS
from OCP.BRep import BRep_Tool
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.BRepAdaptor import BRepAdaptor_Curve
from OCP.GCPnts import GCPnts_QuasiUniformDeflection
from OCP.BRepLProp import BRepLProp_SLProps
from OCP.BRepAdaptor import BRepAdaptor_Surface
from OCP.IFSelect import IFSelect_RetDone

src, out = sys.argv[1], sys.argv[2]
t0 = time.time()
doc = TDocStd_Document(TCollection_ExtendedString("x"))
rd = STEPCAFControl_Reader(); rd.SetNameMode(True)
assert rd.ReadFile(src) == IFSelect_RetDone
rd.Transfer(doc)
print("read", time.time() - t0, flush=True)
st = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())

def name(l):
    n = TDataStd_Name()
    return n.Get().ToExtString() if l.FindAttribute(TDataStd_Name.GetID_s(), n) else ""

leaves = []  # (name, located shape)
def walk(label, loc, path):
    ref = TDF_Label()
    if st.IsReference_s(label):
        st.GetReferredShape_s(label, ref)
        loc = loc.Multiplied(st.GetLocation_s(label))
        label = ref
    nm = name(label)
    if st.IsAssembly_s(label):
        seq = TDF_LabelSequence(); st.GetComponents_s(label, seq)
        for i in range(1, seq.Length() + 1): walk(seq.Value(i), loc, path + [nm])
    else:
        leaves.append((nm, st.GetShape_s(label).Moved(loc)))
roots = TDF_LabelSequence(); st.GetFreeShapes(roots)
for i in range(1, roots.Length() + 1): walk(roots.Value(i), TopLoc_Location(), [])
print("leaves", len(leaves), flush=True)

LIN, ANG = float(sys.argv[3]) if len(sys.argv) > 3 else 0.6, 0.45
faces = []  # dict(part, face, V, T)
for pi, (nm, shp) in enumerate(leaves):
    BRepMesh_IncrementalMesh(shp, LIN, False, ANG, True)
    ex = TopExp_Explorer(shp, TopAbs_FACE)
    while ex.More():
        f = TopoDS.Face(ex.Current()); ex.Next()
        loc = TopLoc_Location()
        tri = BRep_Tool.Triangulation_s(f, loc)
        if tri is None: continue
        trsf = loc.Transformation()
        V = np.array([[*(lambda p: (p.X(), p.Y(), p.Z()))(tri.Node(i).Transformed(trsf))] for i in range(1, tri.NbNodes() + 1)])
        T = np.array([tri.Triangle(i).Get() for i in range(1, tri.NbTriangles() + 1)], dtype=np.int64) - 1
        if f.Orientation() == TopAbs_REVERSED: T = T[:, ::-1]
        faces.append(dict(part=pi, face=f, V=V, T=T))
print("faces", len(faces), "tris", sum(len(f["T"]) for f in faces), time.time() - t0, flush=True)

allV = np.concatenate([f["V"] for f in faces])
lo, hi = allV.min(0), allV.max(0); ctr = (lo + hi) / 2; R = np.linalg.norm(hi - lo) / 2
print("bbox", lo, hi, flush=True)

# --- visibility by point-splat depth buffers ---
rng = np.random.default_rng(1)
DENS = 5.0  # samples / mm^2
pts, pf = [], []
for fi, f in enumerate(faces):
    a, b, c = f["V"][f["T"][:, 0]], f["V"][f["T"][:, 1]], f["V"][f["T"][:, 2]]
    area = 0.5 * np.linalg.norm(np.cross(b - a, c - a), axis=1)
    n = np.maximum(1, np.ceil(area * DENS)).astype(int)
    idx = np.repeat(np.arange(len(a)), n)
    u, v = rng.random(len(idx)), rng.random(len(idx))
    m = u + v > 1; u[m], v[m] = 1 - u[m], 1 - v[m]
    pts.append(a[idx] + (b[idx] - a[idx]) * u[:, None] + (c[idx] - a[idx]) * v[:, None])
    pf.append(np.full(len(idx), fi))
pts = np.concatenate(pts).astype(np.float32) - ctr.astype(np.float32); pf = np.concatenate(pf)
print("samples", len(pts), flush=True)
dirs = []
gold = np.pi * (3 - 5 ** 0.5)
N = 60
for i in range(N):
    y = 1 - 2 * (i + 0.5) / N; r = (1 - y * y) ** 0.5
    dirs.append((np.cos(gold * i) * r, y, np.sin(gold * i) * r))
RES = 420; px = 2 * R / RES
vis = np.zeros(len(faces), dtype=np.int64)
for d in dirs:
    d = np.array(d, dtype=np.float32)
    up = np.array([0, 1, 0], np.float32) if abs(d[1]) < 0.9 else np.array([1, 0, 0], np.float32)
    x = np.cross(up, d); x /= np.linalg.norm(x); y = np.cross(d, x)
    ix = np.clip(((pts @ x + R) / px).astype(np.int64), 0, RES - 1)
    iy = np.clip(((pts @ y + R) / px).astype(np.int64), 0, RES - 1)
    z = pts @ d  # larger = closer to viewer at +d
    key = ix * RES + iy
    zb = np.full(RES * RES, -1e9, np.float32); np.maximum.at(zb, key, z)
    ok = z >= zb[key] - 0.9
    vis += np.bincount(pf[ok], minlength=len(faces))
tot = np.bincount(pf, minlength=len(faces))
keep = (vis >= 6) & (vis / np.maximum(tot, 1) / N > 0.004)
print("visible faces", keep.sum(), "of", len(faces), time.time() - t0, flush=True)

# --- export mesh (kept faces) ---
MV, MT, MF = [], [], []; off = 0
for fi, f in enumerate(faces):
    if not keep[fi]: continue
    MV.append(f["V"]); MT.append(f["T"] + off); MF.append(np.full(len(f["T"]), fi)); off += len(f["V"])
MV = np.concatenate(MV); MT = np.concatenate(MT); MF = np.concatenate(MF)

# --- BRep edges with adjacent-face normals ---
emap = {}  # edge hash -> list of (edge, fi)
for fi, f in enumerate(faces):
    if not keep[fi]: continue
    ex = TopExp_Explorer(f["face"], TopAbs_EDGE)
    while ex.More():
        e = TopoDS.Edge(ex.Current()); ex.Next()
        k = hash(e)
        lst = emap.setdefault(k, [])
        for it in lst:
            if it[0].IsSame(e): it[1].append(fi); break
        else: lst.append((e, [fi]))
def nrm(face, e, t):
    try:
        c2 = BRep_Tool.CurveOnSurface_s(e, face, 0.0, 0.0)
        uv = c2.Value(t)
        pr = BRepLProp_SLProps(BRepAdaptor_Surface(face), uv.X(), uv.Y(), 1, 1e-6)
        if not pr.IsNormalDefined(): return None
        n = pr.Normal(); v = np.array([n.X(), n.Y(), n.Z()])
        return -v if face.Orientation() == TopAbs_REVERSED else v
    except Exception: return None
segs = []  # p0(3) p1(3) nA(3) nB(3) kind
nb = 0
for lst in emap.values():
    for e, fis in lst:
        if BRep_Tool.Degenerated_s(e): continue
        try:
            ad = BRepAdaptor_Curve(e)
            dis = GCPnts_QuasiUniformDeflection(ad, 0.12)
            if not dis.IsDone() or dis.NbPoints() < 2: continue
        except Exception: continue
        ts = [dis.Parameter(i) for i in range(1, dis.NbPoints() + 1)]
        P = [(lambda p: (p.X(), p.Y(), p.Z()))(ad.Value(t)) for t in ts]
        fa = faces[fis[0]]["face"]; fb = faces[fis[1]]["face"] if len(fis) > 1 else None
        L = float(sum(np.linalg.norm(np.subtract(P[i+1],P[i])) for i in range(len(P)-1)))
        for i in range(len(ts) - 1):
            tm = (ts[i] + ts[i + 1]) / 2
            na = nrm(fa, e, tm)
            if na is None: continue
            if fb is None or fb.IsSame(fa) and len(fis) < 2: nB = -na; nb += 1
            else:
                nB = nrm(fb, e, tm)
                if nB is None: nB = -na
            segs.append((*P[i], *P[i + 1], *na, *nB, L, faces[fis[0]]['part']))
segs = np.array(segs)
print("brep segs", len(segs), "boundary", nb, time.time() - t0, flush=True)
names = [l[0] for l in leaves]
np.savez_compressed(out, MV=MV, MT=MT, MF=MF, MP=np.array([faces[i]["part"] for i in MF]), segs=segs, ctr=ctr, names=np.array(names))
print("done", MV.shape, MT.shape, flush=True)
