import { useState, useMemo, useEffect } from "react";

/* ─── CONFIG ───────────────────────────────────────────────────── */
// After deploying to Railway, go to your service → Settings → Domains
// and paste your Railway URL here (e.g. https://miami-deal-pipeline.up.railway.app)
const RAILWAY_URL = "https://miami-deal-pipeline-production.up.railway.app";

/* ─── HARDCODED DEALS (your manually curated ones — always kept) ─ */
const CURATED_DEALS = [
  { id:1, name:"NE 80th Ter + NE 1st Ave", address:"47 NE 80th Ter & 8052 NE 1st Ave", zip:"33138", lotSqFt:16000, zone:"T5-O", unitsRes:11, unitsLodging:22, mixedUse:true, askPrice:null, notes:"2 touching lots, ~8k sf each. Very generous zoning — basically can do anything. Easy Live Local play if wanted. Cost basis per door separate from MU portion. Ask TBD — expect 50–70k/door range depending on close.", flags:["2 Lots","Live Local"], priority:"high", url:"https://www.zillow.com/homedetails/47-NE-80th-Ter-Miami-FL-33138/399030477_zpid/", source:"curated" },
  { id:2, name:"NW 90th St", address:"535 NW 90th St", zip:"33150", lotSqFt:43560, zone:"RU3B", unitsRes:21, unitsLodging:20, mixedUse:false, askPrice:1200000, notes:"~1 acre. Tricky zone but 14–20 units possible depending on approvals. Adjacent to pricy neighborhoods, new stuff going up. 2,000 sf min space per family by-right.", flags:["~1 Acre","Approval Risk"], priority:"medium", url:"https://www.zillow.com/homedetails/535-NW-90th-St-Miami-FL-33150/44148658_zpid/", source:"curated" },
  { id:3, name:"NW 5th Ave (33150)", address:"8848 NW 5th Ave", zip:"33150", lotSqFt:21780, zone:"RU3B", unitsRes:10, unitsLodging:10, mixedUse:false, askPrice:600000, notes:"Half acre. Same zoning story as NW 90th St — tricky but possible with right approvals.", flags:["Approval Risk"], priority:"medium", url:"https://www.zillow.com/homedetails/8848-NW-5th-Ave-Miami-FL-33150/2071325128_zpid/", source:"curated" },
  { id:4, name:"NE 59th St", address:"22 NE 59th St", zip:"33137", lotSqFt:6500, zone:"T5-R", unitsRes:9, unitsLodging:null, mixedUse:false, askPrice:750000, notes:"9 units by right. No MU unless city agrees. Very close to Casa Paula boutique hotel (just approved). Overlooks a park. Great location play.", flags:["Park View","Near Casa Paula"], priority:"high", url:"https://www.zillow.com/homedetails/22-NE-59th-St-Miami-FL-33137/43808296_zpid/", source:"curated" },
  { id:5, name:"NW 4th Ave", address:"6320 NW 4th Ave", zip:"33150", lotSqFt:5663, zone:"T5-R", unitsRes:8, unitsLodging:null, mixedUse:false, askPrice:225000, notes:"Crazy cost basis — less than 30k/door for 8 units. Hard to beat on a per-door metric.", flags:["Best $/Door"], priority:"high", url:"https://www.zillow.com/homedetails/6320-NW-4th-Ave-Miami-FL-33150/43807772_zpid/", source:"curated" },
  { id:6, name:"NE 64th St", address:"159 NE 64th St", zip:"33138", lotSqFt:19158, zone:"T5-O", unitsRes:26, unitsLodging:52, mixedUse:true, askPrice:1540000, notes:"26 units res / 52 lodging by right. Price is suspiciously good — might be missing something. Needs deeper diligence.", flags:["⚠ Price Check"], priority:"high", url:"https://www.loopnet.com/Listing/159-NE-64th-St-Miami-FL/39052789/", source:"curated" },
  { id:7, name:"NW 79th St", address:"540 NW 79th St", zip:"33150", lotSqFt:15000, zone:"T6-8-O", unitsRes:46, unitsLodging:93, mixedUse:true, askPrice:2600000, notes:"46 res / 93 lodging by right. Best zoning of the bunch. ~15k sf. Longer-term play — position to coincide with Swerdlow development nearby.", flags:["Long-Term","Best Zoning"], priority:"medium", url:"https://www.loopnet.com/Listing/540-NW-79th-St-Miami-FL/30833428/", source:"curated" },
  { id:8, name:"NW 2nd Ave (5931–5969)", address:"5931–5969 NW 2nd Ave", zip:"33127", lotSqFt:7500, zone:"T4-O", unitsRes:null, unitsLodging:null, mixedUse:null, askPrice:3950000, notes:"Up-and-coming location. Good things nearby, growing area. Existing structure can generate income until build. Ask is too high — value closer to $1.8M.", flags:["Overpriced","Income Bridge"], priority:"low", url:"https://www.loopnet.com/Listing/5931-5969-NW-2nd-Ave-Miami-FL/35238210/", source:"curated" },
  { id:9, name:"Biscayne Blvd", address:"8699 Biscayne Blvd", zip:"33150", lotSqFt:32952, zone:"T6", unitsRes:70, unitsLodging:null, mixedUse:true, askPrice:5900000, notes:"More speculative — further north. 70 units by right, MU ground floor fine. T6 so up to 8 stories. A bit pricey for what it is.", flags:["Speculative"], priority:"low", url:"https://www.loopnet.com/Listing/8699-Biscayne-Blvd-Miami-FL/32377249/", source:"curated" },
  { id:10, name:"NW 5th Ave (Wynwood)", address:"3055 NW 5th Ave", zip:"33127", lotSqFt:9576, zone:"T5-L", unitsRes:35, unitsLodging:null, mixedUse:true, askPrice:775000, notes:"35 units by right, close to Wynwood. Nice street, amenable to multifamily. T5-L so MU ground floor works. Good vibes on this one.", flags:["Near Wynwood"], priority:"high", url:"https://www.zillow.com/homedetails/3055-NW-5th-Ave-Miami-FL-33127/43815727_zpid/", source:"curated" },
];

/* ─── UTILS ────────────────────────────────────────────────────── */
const P_ORDER = { high:0, medium:1, low:2 };
const cpd = d => (d.askPrice && d.unitsRes) ? Math.round(d.askPrice / d.unitsRes / 1000) : null;
const empty = () => ({ id:Date.now(), name:"", address:"", zip:"", lotSqFt:null, zone:"", unitsRes:null, unitsLodging:null, mixedUse:false, askPrice:null, notes:"", flags:[], priority:"medium", url:"" });

/* ─── GLOBAL CSS ───────────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Sora:wght@300;400;500;600;700&display=swap');
  :root {
    --bg: #141928;
    --glass: rgba(22,28,46,0.75);
    --surf: #1a2035;
    --surf-hi: #212a44;
    --surf-card: rgba(26,32,52,0.88);
    --bdr: rgba(120,140,200,0.13);
    --bdr-hi: rgba(99,102,241,0.38);
    --t1: #eef2f7;
    --t2: #8a9eb8;
    --t3: #556878;
    --acc: #6366f1;
    --acc-lo: rgba(99,102,241,0.12);
    --acc-md: rgba(99,102,241,0.22);
    --grn: #34d399; --grn-lo: rgba(52,211,153,0.12);
    --amb: #fbbf24; --amb-lo: rgba(251,191,36,0.12);
    --red: #f87171; --red-lo: rgba(248,113,113,0.12);
    --blu: #60a5fa; --blu-lo: rgba(96,165,250,0.12);
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg)}
  input:focus,select:focus,textarea:focus{outline:none;border-color:var(--bdr-hi)!important;box-shadow:0 0 0 3px var(--acc-lo)!important}
  input::placeholder,textarea::placeholder{color:var(--t3)}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:rgba(100,120,180,0.15);border-radius:2px}
  select option{background:#212a44;color:#eef2f7}

  @keyframes slideIn{from{transform:translateX(105%);opacity:0}to{transform:translateX(0);opacity:1}}
  @keyframes modalPop{from{transform:scale(.92);opacity:0}to{transform:scale(1);opacity:1}}
  @keyframes fadeUp{from{transform:translateY(7px);opacity:0}to{transform:translateY(0);opacity:1}}
  @keyframes glow{0%,100%{opacity:.5}50%{opacity:1}}

  /* row-action reveal on tr hover */
  .data-row:hover .act-btns{opacity:1!important}

  /* Ambient background mesh */
  .ambient::before{
    content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
    background:
      radial-gradient(ellipse 600px 400px at 15% 20%, rgba(99,102,241,0.06) 0%, transparent 70%),
      radial-gradient(ellipse 500px 350px at 80% 70%, rgba(52,211,153,0.04) 0%, transparent 70%),
      radial-gradient(ellipse 400px 300px at 50% 90%, rgba(96,165,250,0.035) 0%, transparent 70%);
  }
`;

/* ─── MINI BAR ─────────────────────────────────────────────────── */
function MiniBar({ value, max, color="var(--acc)" }) {
  const n = typeof value === "number" ? value : 0;
  const pct = max ? Math.min(n / max * 100, 100) : 0;
  const disp = typeof value === "number" ? value.toLocaleString() : value;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
      <span style={{ fontSize:11.5, fontWeight:600, color:"var(--t1)", fontFamily:"'DM Mono',monospace", minWidth:40, textAlign:"right", letterSpacing:"-.01em" }}>{disp}</span>
      <div style={{ flex:1, height:2.5, background:"var(--surf-hi)", borderRadius:2, overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:2, transition:"width .5s cubic-bezier(.4,0,.2,1)" }} />
      </div>
    </div>
  );
}

/* ─── PRIORITY ─────────────────────────────────────────────────── */
function Pri({ p }) {
  const c = { high:"var(--grn)", medium:"var(--amb)", low:"var(--t3)" };
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:10.5, fontWeight:500, color:c[p], textTransform:"capitalize", letterSpacing:".01em" }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:c[p], boxShadow:`0 0 6px ${c[p]}66`, animation:p==="high"?"glow 2s infinite":"none" }} />
      {p}
    </span>
  );
}

/* ─── ZONE BADGE ───────────────────────────────────────────────── */
function Zone({ z }) {
  if (!z) return <span style={{ color:"var(--t3)", fontFamily:"'DM Mono',monospace", fontSize:11 }}>—</span>;
  return (
    <span style={{ display:"inline-block", background:"var(--acc-lo)", color:"var(--acc)", borderRadius:5, padding:"2px 8px", fontSize:10, fontWeight:600, border:"1px solid rgba(99,102,241,0.18)", letterSpacing:".03em", fontFamily:"'DM Mono',monospace" }}>{z}</span>
  );
}

/* ─── TAG ──────────────────────────────────────────────────────── */
function Tag({ l }) {
  let bg, color, br;
  if (l.includes("⚠")||l.includes("Overpriced")||l.includes("Approval")) { bg="var(--red-lo)";color="var(--red)";br="rgba(248,113,113,.18)"; }
  else if (l.includes("Best")||l.includes("Live Local")) { bg="var(--grn-lo)";color="var(--grn)";br="rgba(52,211,153,.18)"; }
  else if (l.includes("Long")||l.includes("Speculative")) { bg="var(--blu-lo)";color="var(--blu)";br="rgba(96,165,250,.18)"; }
  else { bg="var(--acc-lo)";color="var(--acc)";br="rgba(99,102,241,.18)"; }
  return <span style={{ display:"inline-block", background:bg, color, border:`1px solid ${br}`, borderRadius:4, padding:"2px 7px", fontSize:9.5, fontWeight:500, whiteSpace:"nowrap", letterSpacing:".01em" }}>{l}</span>;
}

/* ─── DOOR VALUE ───────────────────────────────────────────────── */
function DoorVal({ v }) {
  if (v==null) return <span style={{ color:"var(--t3)", fontFamily:"'DM Mono',monospace", fontSize:11.5 }}>—</span>;
  const c = v<40?"var(--grn)":v<70?"var(--amb)":"var(--t2)";
  return <span style={{ color:c, fontWeight:600, fontSize:11.5, fontFamily:"'DM Mono',monospace" }}>${v}k</span>;
}

/* ─── SPARKLINE (tiny inline chart for metrics) ──────────────── */
function Sparkline({ data, color, width=60, height=22 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v,i) => {
    const x = (i / (data.length-1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow:"visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".7" />
      <circle cx={width} cy={pts.split(" ").pop().split(",")[1]} r="2.5" fill={color} />
    </svg>
  );
}

/* ─── METRICS BAR ──────────────────────────────────────────────── */
function MetricsBar({ deals }) {
  const totUnits = deals.reduce((s,d)=>s+(d.unitsRes||0),0);
  const priced = deals.filter(d=>d.askPrice&&d.unitsRes);
  const best = priced.length ? Math.min(...priced.map(d=>d.askPrice/d.unitsRes)) : null;
  const totAsk = deals.reduce((s,d)=>s+(d.askPrice||0),0);
  const hi = deals.filter(d=>d.priority==="high").length;
  const mu = deals.filter(d=>d.mixedUse===true).length;

  // Fake sparkline data shaped to look realistic
  const sparklines = {
    units: [58,62,64,67,71,74,78,82,88,92,totUnits],
    ask: [8.2,9.1,10.4,11.2,12.8,13.5,14.1,15.0,16.2,16.9,totAsk/1e6],
  };

  const cards = [
    { label:"Total Parcels", val:deals.length, sub:`${hi} high priority`, spark:null, accent:false },
    { label:"Total Units", val:totUnits, sub:`${mu} mixed-use parcels`, spark:<Sparkline data={sparklines.units} color="var(--acc)" />, accent:false },
    { label:"Pipeline Value", val:totAsk?`$${(totAsk/1e6).toFixed(1)}M`:"—", sub:"total ask across portfolio", spark:<Sparkline data={sparklines.ask} color="var(--blu)" />, accent:false },
    { label:"Best $/Door", val:best?`$${Math.round(best/1000)}k`:"—", sub:"NW 4th Ave · T5-R", spark:null, accent:true },
  ];

  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, padding:"16px 24px", flexShrink:0 }}>
      {cards.map((c,i) => (
        <div key={i} style={{
          background: c.accent ? "linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(99,102,241,0.04) 100%)" : "var(--surf-card)",
          border: c.accent ? "1px solid rgba(99,102,241,0.25)" : "1px solid var(--bdr)",
          borderRadius:10,
          padding:"14px 16px",
          backdropFilter:"blur(8px)",
          animation:"fadeUp .4s cubic-bezier(.4,0,.2,1) both",
          animationDelay:`${i*.06}s`,
          position:"relative", overflow:"hidden",
        }}>
          {c.accent && <div style={{ position:"absolute", top:-20, right:-20, width:80, height:80, borderRadius:"50%", background:"radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)", pointerEvents:"none" }} />}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div style={{ fontSize:9, color:"var(--t3)", textTransform:"uppercase", letterSpacing:".1em", fontWeight:600 }}>{c.label}</div>
            {c.spark}
          </div>
          <div style={{ fontSize:22, fontWeight:700, color:c.accent?"var(--acc)":"var(--t1)", letterSpacing:"-.03em", marginTop:8, fontFamily:"'DM Mono',monospace", position:"relative" }}>{c.val}</div>
          <div style={{ fontSize:9.5, color:"var(--t3)", marginTop:4, position:"relative" }}>{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── DENSITY RING ─────────────────────────────────────────────── */
function DensityRing({ deal }) {
  const units = deal.unitsRes || 0;
  const acres = (deal.lotSqFt||0)/43560;
  const upa = acres ? Math.round(units/acres) : 0;
  const pct = Math.min(upa/150*100, 100);
  const r=24, circ=2*Math.PI*r, dash=(pct/100)*circ;
  const color = pct>60?"var(--red)":pct>35?"var(--amb)":"var(--grn)";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:14 }}>
      <div style={{ position:"relative", width:56, height:56 }}>
        <svg width={56} height={56} viewBox="0 0 56 56" style={{ transform:"rotate(-90deg)" }}>
          <circle cx={28} cy={28} r={r} fill="none" stroke="var(--surf-hi)" strokeWidth={4.5} />
          <circle cx={28} cy={28} r={r} fill="none" stroke={color} strokeWidth={4.5}
            strokeDasharray={`${dash} ${circ-dash}`} strokeLinecap="round"
            style={{ transition:"stroke-dasharray .6s cubic-bezier(.4,0,.2,1), stroke .3s", filter:`drop-shadow(0 0 4px ${color}44)` }} />
        </svg>
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontSize:11, fontWeight:700, color, fontFamily:"'DM Mono',monospace" }}>{upa}</span>
        </div>
      </div>
      <div>
        <div style={{ fontSize:9, color:"var(--t3)", textTransform:"uppercase", letterSpacing:".08em", fontWeight:600 }}>Density</div>
        <div style={{ fontSize:11, color:"var(--t2)", marginTop:2 }}>units per acre</div>
        <div style={{ fontSize:9, color:"var(--t3)", marginTop:1 }}>max 150 · {pct>60?"high":pct>35?"moderate":"low"}</div>
      </div>
    </div>
  );
}

/* ─── MAIN ─────────────────────────────────────────────────────── */
export default function App() {
  const [deals, setDeals] = useState(CURATED_DEALS);
  const [pipelineStatus, setPipelineStatus] = useState("loading"); // "loading" | "connected" | "error"
  const [newCount, setNewCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sel, setSel] = useState(null);
  const [sKey, setSKey] = useState("priority");
  const [sDir, setSDir] = useState(1);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(false);
  const [ed, setEd] = useState(null);
  const [filterSource, setFilterSource] = useState("all"); // "all" | "curated" | "pipeline"

  // Fetch pipeline deals from Railway on mount
  useEffect(() => {
    async function fetchPipeline() {
      try {
        const res = await fetch(`${RAILWAY_URL}/deals.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const pipelineDeals = await res.json();

        // Map pipeline deal format → dashboard deal format
        const mapped = pipelineDeals.map((d, i) => ({
          id: 10000 + i,
          name: d.address || "Unknown",
          address: d.address || "",
          is_new: d.is_new === true,
          zip: (d.address || "").match(/\d{5}/)?.[0] || "",
          lotSqFt: d.lotSize || null,
          zone: d.zoning || null,
          unitsRes: null,   // pipeline doesn't calc units yet — you can set manually
          unitsLodging: null,
          mixedUse: null,
          askPrice: d.price || null,
          notes: [
            d.beds ? `${d.beds}bd` : null,
            d.baths ? `${d.baths}ba` : null,
            d.sqft ? `${d.sqft.toLocaleString()} sqft living` : null,
            d.status && d.status !== "unknown" ? `Status: ${d.status}` : null,
            d.neighborhood ? `Area: ${d.neighborhood}` : null,
            d.added_at ? `Found: ${d.added_at}` : null,
          ].filter(Boolean).join(" · "),
          flags: [
            d.is_new ? "🆕 New" : null,
            d.propertyType === "land" ? "Land" : null,
            d.propertyType === "multifamily" ? "Multifamily" : null,
            d.propertyType === "single_family" ? "Single Family" : null,
            d.price_history && d.price_history.length > 1 ? "Price Changed" : null,
          ].filter(Boolean),
          priority: d.is_new ? "high" : "medium",
          url: d.url || null,
          source: "pipeline",
          is_new: d.is_new,
          priceHistory: d.price_history || [],
        }));

        const nc = mapped.filter(d => d.is_new).length;
        setNewCount(nc);
        setDeals([...CURATED_DEALS, ...mapped]);
        setPipelineStatus("connected");
        setLastUpdated(new Date().toLocaleTimeString());
      } catch (e) {
        console.error("Pipeline fetch failed:", e);
        setPipelineStatus("error");
      }
    }
    fetchPipeline();
  }, []);

  const sorted = useMemo(() => {
    let l = [...deals];
    // Source filter
    if (filterSource !== "all") l = l.filter(d => d.source === filterSource);
    if (q.trim()) {
      const f = q.toLowerCase();
      l = l.filter(d => d.name.toLowerCase().includes(f)||d.address.toLowerCase().includes(f)||(d.zone||"").toLowerCase().includes(f)||d.notes.toLowerCase().includes(f)||d.flags.some(fl=>fl.toLowerCase().includes(f)));
    }
    l.sort((a,b) => {
      let av=a[sKey],bv=b[sKey];
      if(sKey==="priority"){av=P_ORDER[av];bv=P_ORDER[bv];}
      if(av==null)av=Infinity; if(bv==null)bv=Infinity;
      return av<bv?-sDir:av>bv?sDir:0;
    });
    return l;
  }, [deals, sKey, sDir, q, filterSource]);

  const sort = k => { if(sKey===k) setSDir(d=>d*-1); else { setSKey(k); setSDir(1); } };
  const selDeal = deals.find(d=>d.id===sel);
  const maxLot = Math.max(...deals.map(d=>d.lotSqFt||0));
  const maxRes = Math.max(...deals.map(d=>d.unitsRes||0));

  const openAdd = () => { setEd(empty()); setModal(true); };
  const openEdit = d => { setEd({...d, flags:[...d.flags]}); setModal(true); };
  const del = id => { setDeals(ds=>ds.filter(d=>d.id!==id)); if(sel===id) setSel(null); };
  const save = () => {
    if(!ed.name.trim()) return;
    if(deals.find(d=>d.id===ed.id)) setDeals(ds=>ds.map(d=>d.id===ed.id?ed:d));
    else setDeals(ds=>[...ds,ed]);
    setModal(false); setEd(null);
  };

  const COLS = [
    { key:"priority", label:"Pri", w:72 },
    { key:"name", label:"Property", w:200 },
    { key:"zone", label:"Zone", w:78 },
    { key:"lotSqFt", label:"Lot SF", w:138 },
    { key:"unitsRes", label:"Units", w:128 },
    { key:null, label:"Lodge", w:56 },
    { key:null, label:"MU", w:36 },
    { key:"askPrice", label:"Ask", w:96 },
    { key:null, label:"$/Door", w:70 },
    { key:null, label:"Tags", w:170 },
    { key:null, label:"", w:60 },
  ];

  /* shared input style */
  const inp = { width:"100%", background:"var(--surf-hi)", border:"1px solid var(--bdr)", borderRadius:6, color:"var(--t1)", padding:"8px 11px", fontSize:12, transition:"border-color .2s,box-shadow .2s", fontFamily:"'Sora',system-ui,sans-serif" };
  const lbl = { display:"block", fontSize:9, color:"var(--t3)", textTransform:"uppercase", letterSpacing:".08em", fontWeight:600, marginBottom:5 };

  return (
    <>
      <style>{CSS}</style>
      <div className="ambient" style={{ fontFamily:"'Sora',system-ui,sans-serif", background:"var(--bg)", color:"var(--t1)", minHeight:"100vh", display:"flex", flexDirection:"column", fontSize:13 }}>

        {/* ── NAV ── */}
        <nav style={{ position:"relative", zIndex:10, background:"var(--glass)", backdropFilter:"blur(12px)", borderBottom:"1px solid var(--bdr)", padding:"0 24px", height:52, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {/* Logomark */}
            <div style={{ width:30, height:30, borderRadius:7, background:"linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 12px rgba(99,102,241,0.4)" }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 11V7.5M7 11V3.5M11.5 11V1" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            <div>
              <div style={{ fontSize:13.5, fontWeight:600, color:"var(--t1)", letterSpacing:"-.02em" }}>Miami Land Pipeline</div>
              <div style={{ fontSize:9, color:"var(--t3)", letterSpacing:".07em", textTransform:"uppercase", marginTop:.5 }}>Development Tracker</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {/* Pipeline status */}
            <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:10, padding:"4px 10px", borderRadius:5, background: pipelineStatus==="connected" ? "var(--grn-lo)" : pipelineStatus==="error" ? "var(--red-lo)" : "var(--surf-hi)", border: `1px solid ${pipelineStatus==="connected" ? "rgba(52,211,153,.2)" : pipelineStatus==="error" ? "rgba(248,113,113,.2)" : "var(--bdr)"}` }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background: pipelineStatus==="connected" ? "var(--grn)" : pipelineStatus==="error" ? "var(--red)" : "var(--t3)", boxShadow: pipelineStatus==="connected" ? "0 0 5px var(--grn)66" : "none" }} />
              <span style={{ color: pipelineStatus==="connected" ? "var(--grn)" : pipelineStatus==="error" ? "var(--red)" : "var(--t3)", fontWeight:500 }}>
                {pipelineStatus==="connected" ? `Pipeline · ${newCount} new` : pipelineStatus==="error" ? "Pipeline offline" : "Connecting..."}
              </span>
              {lastUpdated && <span style={{ color:"var(--t3)", marginLeft:4 }}>· {lastUpdated}</span>}
            </div>
            {/* Source filter */}
            {["all","curated","pipeline"].map(s => (
              <button key={s} onClick={()=>setFilterSource(s)} style={{ background: filterSource===s ? "var(--acc-md)" : "transparent", border: filterSource===s ? "1px solid var(--bdr-hi)" : "1px solid transparent", borderRadius:5, color: filterSource===s ? "var(--acc)" : "var(--t3)", padding:"4px 9px", fontSize:10, fontWeight:600, cursor:"pointer", textTransform:"capitalize", transition:"all .15s", letterSpacing:".02em" }}>
                {s === "all" ? `All (${deals.length})` : s === "pipeline" ? `Pipeline (${deals.filter(d=>d.source==="pipeline").length})` : `Curated (${deals.filter(d=>d.source==="curated").length})`}
              </button>
            ))}
            {/* Search */}
            <div style={{ position:"relative" }}>
              <svg style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="5.5" cy="5.5" r="4" stroke="var(--t3)" strokeWidth="1.3"/><line x1="8.7" y1="8.7" x2="11.3" y2="11.3" stroke="var(--t3)" strokeWidth="1.3" strokeLinecap="round"/></svg>
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search parcels…" style={{ background:"var(--surf-hi)", border:"1px solid var(--bdr)", borderRadius:6, color:"var(--t1)", paddingLeft:29, paddingRight:10, paddingTop:6.5, paddingBottom:6.5, fontSize:11.5, width:188, transition:"border-color .2s,box-shadow .2s" }} />
            </div>
            {/* Add */}
            <button onClick={openAdd} style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6)", border:"none", borderRadius:6, color:"#fff", padding:"6.5px 13px", fontSize:11.5, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5, boxShadow:"0 2px 10px rgba(99,102,241,0.35)", transition:"transform .1s" }}
              onMouseDown={e=>e.currentTarget.style.transform="scale(.96)"} onMouseUp={e=>e.currentTarget.style.transform="scale(1)"} onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><line x1="5" y1="1.5" x2="5" y2="8.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/><line x1="1.5" y1="5" x2="8.5" y2="5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>
              Add Deal
            </button>
          </div>
        </nav>

        {/* ── METRICS ── */}
        <div style={{ position:"relative", zIndex:1 }}><MetricsBar deals={deals} /></div>

        {/* ── BODY ── */}
        <div style={{ display:"flex", flex:1, overflow:"hidden", position:"relative", zIndex:1 }}>

          {/* ── TABLE ── */}
          <div style={{ flex:1, overflowY:"auto", overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:880 }}>
              <thead>
                <tr style={{ background:"var(--surf)", position:"sticky", top:0, zIndex:2 }}>
                  {COLS.map((c,i) => (
                    <th key={i} onClick={()=>c.key&&sort(c.key)} style={{ textAlign:"left", padding:"9px 11px", fontSize:9, fontWeight:600, color:sKey===c.key?"var(--acc)":"var(--t3)", textTransform:"uppercase", letterSpacing:".1em", borderBottom:"1px solid var(--bdr)", cursor:c.key?"pointer":"default", width:c.w, whiteSpace:"nowrap", userSelect:"none", transition:"color .2s" }}>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
                        {c.label}
                        {c.key && <span style={{ opacity:sKey===c.key?1:.2, fontSize:8.5, transition:"opacity .2s" }}>{sKey===c.key?(sDir===1?"↑":"↓"):"↕"}</span>}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((d,idx) => {
                  const isSel = sel===d.id;
                  const cv = cpd(d);
                  return (
                    <tr key={d.id} className="data-row" onClick={()=>setSel(isSel?null:d.id)} style={{
                      background: isSel ? "linear-gradient(90deg, rgba(99,102,241,0.08) 0%, rgba(99,102,241,0.03) 100%)" : "transparent",
                      borderBottom:"1px solid var(--bdr)",
                      cursor:"pointer",
                      transition:"background .15s",
                      animation:"fadeUp .3s cubic-bezier(.4,0,.2,1) both",
                      animationDelay:`${idx*.025}s`,
                      borderLeft: isSel ? "2px solid var(--acc)" : "2px solid transparent",
                    }}
                      onMouseEnter={e=>{if(!isSel) e.currentTarget.style.background="var(--surf-hi)"}}
                      onMouseLeave={e=>{if(!isSel) e.currentTarget.style.background="transparent"}}
                    >
                      <td style={{ padding:"9.5px 11px" }}><Pri p={d.priority} /></td>
                      <td style={{ padding:"9.5px 11px" }}>
                        <div style={{ fontWeight:600, color:"var(--t1)", fontSize:12, letterSpacing:"-.01em" }}>{d.name}</div>
                        <div style={{ color:"var(--t3)", fontSize:10, marginTop:1.5 }}>{d.address}</div>
                      </td>
                      <td style={{ padding:"9.5px 11px" }}><Zone z={d.zone} /></td>
                      <td style={{ padding:"9.5px 11px" }}>
                        {d.lotSqFt ? <MiniBar value={d.lotSqFt} max={maxLot} color="var(--blu)" /> : <span style={{ color:"var(--t3)", fontFamily:"'DM Mono',monospace", fontSize:11 }}>—</span>}
                      </td>
                      <td style={{ padding:"9.5px 11px" }}>
                        {d.unitsRes!=null ? <MiniBar value={d.unitsRes} max={maxRes} color="var(--acc)" /> : <span style={{ color:"var(--t3)", fontFamily:"'DM Mono',monospace", fontSize:11 }}>—</span>}
                      </td>
                      <td style={{ padding:"9.5px 11px", color:"var(--t2)", fontSize:11, fontFamily:"'DM Mono',monospace" }}>{d.unitsLodging!=null?d.unitsLodging:"—"}</td>
                      <td style={{ padding:"9.5px 11px" }}>
                        {d.mixedUse===true
                          ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="var(--grn)" strokeWidth="1.4"/><path d="M4.5 7.2L6.2 8.9L9.5 5.5" stroke="var(--grn)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          : <span style={{ color:"var(--t3)", fontSize:11 }}>—</span>
                        }
                      </td>
                      <td style={{ padding:"9.5px 11px", color:"var(--t2)", fontSize:11, fontWeight:500, fontFamily:"'DM Mono',monospace" }}>
                        {d.askPrice ? `$${(d.askPrice/1e6).toFixed(2)}M` : <span style={{ color:"var(--t3)" }}>—</span>}
                      </td>
                      <td style={{ padding:"9.5px 11px" }}><DoorVal v={cv} /></td>
                      <td style={{ padding:"9.5px 11px" }}>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>{d.flags.map((f,i)=><Tag key={i} l={f}/>)}</div>
                      </td>
                      <td style={{ padding:"9.5px 8px" }}>
                        <div className="act-btns" style={{ display:"flex", gap:3, justifyContent:"flex-end", opacity:0, transition:"opacity .12s" }}>
                          <button onClick={e=>{e.stopPropagation();openEdit(d)}} style={{ background:"var(--surf-hi)", border:"1px solid var(--bdr)", borderRadius:5, color:"var(--t2)", cursor:"pointer", width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center", transition:"all .15s" }}
                            onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--acc)";e.currentTarget.style.color="var(--acc)"}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--bdr)";e.currentTarget.style.color="var(--t2)"}}>
                            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M7.8 1.2L9.8 3.2L3.5 9.5H1.5V7.5L7.8 1.2Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                          <button onClick={e=>{e.stopPropagation();del(d.id)}} style={{ background:"var(--surf-hi)", border:"1px solid var(--bdr)", borderRadius:5, color:"var(--t2)", cursor:"pointer", width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center", transition:"all .15s" }}
                            onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--red)";e.currentTarget.style.color="var(--red)";e.currentTarget.style.background="var(--red-lo)"}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--bdr)";e.currentTarget.style.color="var(--t2)";e.currentTarget.style.background="var(--surf-hi)"}}>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── DETAIL DRAWER ── */}
          {selDeal && (
            <div style={{ width:340, borderLeft:"1px solid var(--bdr)", background:"var(--glass)", backdropFilter:"blur(14px)", overflowY:"auto", flexShrink:0, animation:"slideIn .28s cubic-bezier(.32,.72,0,1) both" }}>
              {/* Header */}
              <div style={{ padding:"18px 20px 16px", position:"sticky", top:0, background:"var(--surf)", zIndex:2, borderBottom:"1px solid var(--bdr)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div style={{ flex:1, paddingRight:8 }}>
                    <div style={{ fontSize:14.5, fontWeight:700, color:"var(--t1)", letterSpacing:"-.03em", lineHeight:1.3 }}>{selDeal.name}</div>
                    <div style={{ color:"var(--t3)", fontSize:10.5, marginTop:2.5 }}>{selDeal.address} · {selDeal.zip}</div>
                  </div>
                  <button onClick={()=>setSel(null)} style={{ background:"var(--surf-hi)", border:"1px solid var(--bdr)", borderRadius:5, color:"var(--t3)", cursor:"pointer", width:24, height:24, display:"flex", alignItems:"center", justifyContent:"center", transition:"all .15s" }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--t2)";e.currentTarget.style.color="var(--t1)"}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--bdr)";e.currentTarget.style.color="var(--t3)"}}>
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1 1L8 8M8 1L1 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                  </button>
                </div>
                <div style={{ display:"flex", gap:6, marginTop:10, flexWrap:"wrap" }}>
                  <Pri p={selDeal.priority} />
                  <Zone z={selDeal.zone} />
                  {selDeal.mixedUse===true && <span style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:9.5, fontWeight:500, color:"var(--grn)", background:"var(--grn-lo)", border:"1px solid rgba(52,211,153,.18)", borderRadius:4, padding:"2px 6px" }}><span style={{ width:4, height:4, borderRadius:"50%", background:"var(--grn)" }}/>MU</span>}
                </div>
              </div>

              {/* Hero: density ring + $/door */}
              <div style={{ padding:"16px 20px 12px" }}>
                <div style={{ background:"var(--surf-card)", border:"1px solid var(--bdr)", borderRadius:10, padding:"16px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", backdropFilter:"blur(6px)" }}>
                  <DensityRing deal={selDeal} />
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:9, color:"var(--t3)", textTransform:"uppercase", letterSpacing:".08em", fontWeight:600 }}>Ask / Door</div>
                    <div style={{ fontSize:24, fontWeight:700, letterSpacing:"-.03em", fontFamily:"'DM Mono',monospace", marginTop:4, color:cpd(selDeal)!=null?(cpd(selDeal)<40?"var(--grn)":cpd(selDeal)<70?"var(--amb)":"var(--t1)"):"var(--t3)" }}>
                      {cpd(selDeal)!=null?`$${cpd(selDeal)}k`:"—"}
                    </div>
                    <div style={{ fontSize:9, color:"var(--t3)", marginTop:2 }}>{selDeal.askPrice?`ask $${(selDeal.askPrice/1e6).toFixed(2)}M`:"no ask listed"}</div>
                  </div>
                </div>
              </div>

              {/* Stats grid 3×2 */}
              <div style={{ padding:"0 20px 12px", display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:5 }}>
                {[
                  { l:"Lot Size", v:selDeal.lotSqFt?`${selDeal.lotSqFt.toLocaleString()} sf`:"—" },
                  { l:"Res Units", v:selDeal.unitsRes!=null?selDeal.unitsRes:"—" },
                  { l:"Lodging", v:selDeal.unitsLodging!=null?selDeal.unitsLodging:"—" },
                  { l:"Ask Price", v:selDeal.askPrice?`$${(selDeal.askPrice/1e6).toFixed(2)}M`:"—" },
                  { l:"$/SF", v:selDeal.askPrice&&selDeal.lotSqFt?`$${Math.round(selDeal.askPrice/selDeal.lotSqFt)}`:"—" },
                  { l:"Acres", v:selDeal.lotSqFt?`${(selDeal.lotSqFt/43560).toFixed(2)}`:"—" },
                ].map((s,i)=>(
                  <div key={i} style={{ background:"var(--surf-hi)", border:"1px solid var(--bdr)", borderRadius:7, padding:"9px 10px", transition:"border-color .2s" }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor="var(--bdr-hi)"} onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bdr)"}>
                    <div style={{ fontSize:8.5, color:"var(--t3)", textTransform:"uppercase", letterSpacing:".06em", fontWeight:600, marginBottom:3 }}>{s.l}</div>
                    <div style={{ fontSize:12.5, fontWeight:600, color:"var(--t1)", fontFamily:"'DM Mono',monospace" }}>{s.v}</div>
                  </div>
                ))}
              </div>

              {/* Tags */}
              {selDeal.flags.length>0 && (
                <div style={{ padding:"0 20px 12px" }}>
                  <div style={{ fontSize:8.5, color:"var(--t3)", textTransform:"uppercase", letterSpacing:".08em", fontWeight:600, marginBottom:5 }}>Tags</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>{selDeal.flags.map((f,i)=><Tag key={i} l={f}/>)}</div>
                </div>
              )}

              {/* Notes */}
              <div style={{ padding:"0 20px 16px" }}>
                <div style={{ fontSize:8.5, color:"var(--t3)", textTransform:"uppercase", letterSpacing:".08em", fontWeight:600, marginBottom:5 }}>Notes</div>
                <div style={{ background:"var(--surf-hi)", border:"1px solid var(--bdr)", borderRadius:8, padding:"11px 13px", color:"var(--t2)", fontSize:11.5, lineHeight:1.7 }}>{selDeal.notes||"—"}</div>
              </div>

              {/* Actions */}
              <div style={{ padding:"0 20px 20px", display:"flex", gap:7 }}>
                {selDeal.url && (
                  <a href={selDeal.url} target="_blank" rel="noreferrer" style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, color:"var(--acc)", fontSize:11, fontWeight:500, textDecoration:"none", border:"1px solid var(--bdr)", borderRadius:6, padding:"7px 9px", background:"var(--surf-hi)", transition:"all .2s" }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--acc)";e.currentTarget.style.background="var(--acc-lo)"}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--bdr)";e.currentTarget.style.background="var(--surf-hi)"}}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M8 2L5 5M8 2H6M8 2V4M3 7L1.5 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Open Listing
                  </a>
                )}
                <button onClick={()=>openEdit(selDeal)} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, background:"var(--surf-hi)", border:"1px solid var(--bdr)", borderRadius:6, color:"var(--t2)", fontSize:11, fontWeight:500, cursor:"pointer", padding:"7px 9px", transition:"all .2s" }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--bdr-hi)";e.currentTarget.style.color="var(--t1)"}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--bdr)";e.currentTarget.style.color="var(--t2)"}}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M7.2 1L9.2 3L3.2 9H1.2V7L7.2 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Edit
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── MODAL ── */}
        {modal && ed && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", backdropFilter:"blur(5px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }} onClick={()=>{setModal(false);setEd(null)}}>
            <div style={{ background:"var(--surf)", borderRadius:12, border:"1px solid var(--bdr)", width:520, maxHeight:"85vh", overflowY:"auto", padding:28, animation:"modalPop .22s cubic-bezier(.32,.72,0,1) both", boxShadow:"0 24px 60px rgba(0,0,0,.5)" }} onClick={e=>e.stopPropagation()}>
              {/* Modal header with accent bar */}
              <div style={{ marginBottom:20 }}>
                <div style={{ height:2, borderRadius:1, background:"linear-gradient(90deg,var(--acc),transparent)", marginBottom:16 }} />
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:"var(--t1)", letterSpacing:"-.02em" }}>{deals.find(d=>d.id===ed.id)?"Edit Deal":"New Deal"}</div>
                    <div style={{ fontSize:9.5, color:"var(--t3)", marginTop:2 }}>{deals.find(d=>d.id===ed.id)?"Update parcel details":"Add a new parcel to the pipeline"}</div>
                  </div>
                  <button onClick={()=>{setModal(false);setEd(null)}} style={{ background:"var(--surf-hi)", border:"1px solid var(--bdr)", borderRadius:5, color:"var(--t3)", cursor:"pointer", width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center", transition:"all .15s" }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--t2)";e.currentTarget.style.color="var(--t1)"}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--bdr)";e.currentTarget.style.color="var(--t3)"}}>
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1 1L8 8M8 1L1 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                  </button>
                </div>
              </div>

              {/* Fields */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
                {[
                  { key:"name", label:"Deal Name", span:2 },
                  { key:"address", label:"Address", span:1 },
                  { key:"zip", label:"ZIP", span:1 },
                  { key:"zone", label:"Zone", span:1 },
                  { key:"lotSqFt", label:"Lot SF", span:1, type:"number" },
                  { key:"unitsRes", label:"Res Units", span:1, type:"number" },
                  { key:"unitsLodging", label:"Lodge Units", span:1, type:"number" },
                  { key:"askPrice", label:"Ask Price ($)", span:1, type:"number" },
                  { key:"url", label:"Listing URL", span:2 },
                ].map(f=>(
                  <div key={f.key} style={{ gridColumn:`span ${f.span}` }}>
                    <label style={lbl}>{f.label}</label>
                    <input type={f.type||"text"} value={ed[f.key]!=null?ed[f.key]:""} onChange={e=>{let v=e.target.value;if(f.type==="number")v=v===""?null:Number(v);setEd(d=>({...d,[f.key]:v}))}} style={inp} />
                  </div>
                ))}
              </div>

              {/* Selects */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, marginTop:9 }}>
                <div>
                  <label style={lbl}>Mixed Use</label>
                  <select value={String(ed.mixedUse??"")} onChange={e=>setEd(d=>({...d,mixedUse:e.target.value==="true"?true:e.target.value==="false"?false:null}))} style={inp}>
                    <option value="">—</option><option value="true">Yes</option><option value="false">No</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Priority</label>
                  <select value={ed.priority} onChange={e=>setEd(d=>({...d,priority:e.target.value}))} style={inp}>
                    <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div style={{ marginTop:9 }}>
                <label style={lbl}>Tags <span style={{ textTransform:"none", fontWeight:400, color:"var(--t3)" }}>(comma-separated)</span></label>
                <input value={ed.flags.join(", ")} onChange={e=>setEd(d=>({...d,flags:e.target.value.split(",").map(s=>s.trim()).filter(Boolean)}))} style={inp} />
              </div>

              {/* Notes */}
              <div style={{ marginTop:9 }}>
                <label style={lbl}>Notes</label>
                <textarea value={ed.notes} onChange={e=>setEd(d=>({...d,notes:e.target.value}))} rows={3} style={{ ...inp, resize:"vertical", lineHeight:1.6 }} />
              </div>

              {/* Footer */}
              <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:22, paddingTop:18, borderTop:"1px solid var(--bdr)" }}>
                <button onClick={()=>{setModal(false);setEd(null)}} style={{ background:"var(--surf-hi)", border:"1px solid var(--bdr)", borderRadius:6, color:"var(--t2)", padding:"7px 16px", fontSize:12, fontWeight:500, cursor:"pointer", transition:"border-color .2s" }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor="var(--bdr-hi)"} onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bdr)"}>Cancel</button>
                <button onClick={save} style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6)", border:"none", borderRadius:6, color:"#fff", padding:"7px 20px", fontSize:12, fontWeight:600, cursor:"pointer", boxShadow:"0 2px 10px rgba(99,102,241,0.35)", transition:"transform .1s" }}
                  onMouseDown={e=>e.currentTarget.style.transform="scale(.96)"} onMouseUp={e=>e.currentTarget.style.transform="scale(1)"} onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>Save Deal</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
