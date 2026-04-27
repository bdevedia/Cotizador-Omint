import { useState, useEffect } from "react";
import "./App.css";
import { dbGet, dbSet, dbSubscribe } from "./firebase";
import { lsGet, lsSet } from "./db";
import { FONT, BLUE, BLUE_LT, BORDER, GRAY, OMINT_LOGO } from "./constants";
import { badge, btnP, btnS, card } from "./styles";
import Cotizador from "./components/Cotizador";
import Importar from "./components/Importar";
import PreciosVigentes from "./components/PreciosVigentes";
import CostosVigentes from "./components/CostosVigentes";
import MejorasVigentes from "./components/MejorasVigentes";
import Historial from "./components/Historial";
import OsdeVigentes from "./components/OsdeVigentes";
import Configuracion from "./components/Configuracion";

// ── APP SHELL ─────────────────────────────────────────────────────────────────
function App(){
  const [sec,setSec]=useState("cotizador");
  const [precios,setPrecios]=useState(null);
  const [costos,setCostos]=useState(null);
  const [osde,setOsde]=useState(null);
  const [mejoras,setMejoras]=useState(null);
  const [quotes,setQuotes]=useState([]);
  const [apiKey,setApiKey]=useState("");
  const [globalAjuste,setGlobalAjuste]=useState(0); // % ajuste mensual sobre lista base
  const [loaded,setLoaded]=useState(false);
  const [syncStatus,setSyncStatus]=useState("idle"); // idle | syncing | ok | error

  useEffect(()=>{
    (async()=>{
      // Helper: load from Firebase; if missing, migrate from localStorage → Firebase
      async function loadSync(fbKey,lsKey,setter,def={}){
        const fbVal=await dbGet(fbKey,null);
        if(fbVal!==null){setter(fbVal);lsSet(lsKey,fbVal);}
        else{const lsVal=lsGet(lsKey,def);setter(lsVal);if(JSON.stringify(lsVal)!==JSON.stringify(def))dbSet(fbKey,lsVal);}
      }
      // Quotes: Firebase stores arrays as numeric-keyed objects → normalise
      const fbQ=await dbGet("quotes",null);
      if(fbQ!==null){const arr=Array.isArray(fbQ)?fbQ:Object.values(fbQ);setQuotes(arr);lsSet("omint-quotes",arr);}
      else{const lsQ=lsGet("omint-quotes",[]);setQuotes(lsQ);if(lsQ.length>0)dbSet("quotes",lsQ);}

      await Promise.all([
        loadSync("precios","omint-precios",setPrecios),
        loadSync("costos","omint-costos",setCostos),
        loadSync("osde","omint-osde",setOsde),
        loadSync("mejoras","omint-mejoras",setMejoras),
      ]);
      setApiKey(lsGet("omint-apikey",""));
      setGlobalAjuste(lsGet("omint-ajuste",0));
      setLoaded(true);
      // Suscribir actualizaciones en tiempo real (también actualizan localStorage)
      dbSubscribe("precios",v=>{setPrecios(v||{});lsSet("omint-precios",v||{});});
      dbSubscribe("costos",v=>{setCostos(v||{});lsSet("omint-costos",v||{});});
      dbSubscribe("osde",v=>{setOsde(v||{});lsSet("omint-osde",v||{});});
      dbSubscribe("mejoras",v=>{setMejoras(v||{});lsSet("omint-mejoras",v||{});});
      dbSubscribe("quotes",v=>{if(!v)return;const arr=Array.isArray(v)?v:Object.values(v);setQuotes(arr);lsSet("omint-quotes",arr);});
    })();
  },[]);

  async function sync(fn){setSyncStatus("syncing");try{await fn();setSyncStatus("ok");setTimeout(()=>setSyncStatus("idle"),2000);}catch(e){console.warn("Firebase sync error:",e);setSyncStatus("error");setTimeout(()=>setSyncStatus("idle"),4000);}}
  async function savePre(p){setPrecios(p);lsSet("omint-precios",p);sync(()=>dbSet("precios",p));}
  async function saveCos(c){setCostos(c);lsSet("omint-costos",c);sync(()=>dbSet("costos",c));}
  async function saveOsde(o){setOsde(o);lsSet("omint-osde",o);sync(()=>dbSet("osde",o));}
  async function saveMejoras(m){setMejoras(m);lsSet("omint-mejoras",m);sync(()=>dbSet("mejoras",m));}
  function saveQuote(q){const nq=[q,...quotes];setQuotes(nq);lsSet("omint-quotes",nq);sync(()=>dbSet("quotes",nq));}
  function updQuote(id,upd){const nq=quotes.map(q=>q.id===id?{...q,...upd}:q);setQuotes(nq);lsSet("omint-quotes",nq);sync(()=>dbSet("quotes",nq));}
  function deleteQuote(id){const nq=quotes.filter(q=>q.id!==id);setQuotes(nq);lsSet("omint-quotes",nq);sync(()=>dbSet("quotes",nq));}
  function renameEmpresa(oldName,newName){const nq=quotes.map(q=>q.empresa===oldName?{...q,empresa:newName}:q);setQuotes(nq);lsSet("omint-quotes",nq);sync(()=>dbSet("quotes",nq));}
  function saveApiKey(k){setApiKey(k);lsSet("omint-apikey",k);}
  function saveAjuste(v){const n=parseFloat(v)||0;setGlobalAjuste(n);lsSet("omint-ajuste",n);}

  // Aplica el ajuste % a cualquier árbol de precios numéricos (precios/costos/osde)
  function applyAjuste(data){
    if(!data||!globalAjuste)return data;
    const m=1+globalAjuste/100;
    function mult(obj){
      if(typeof obj==="number")return Math.round(obj*m);
      if(obj&&typeof obj==="object")return Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,mult(v)]));
      return obj;
    }
    return mult(data);
  }
  const preciosAdj=applyAjuste(precios||{});
  const costosAdj=applyAjuste(costos||{});
  const osdeAdj=applyAjuste(osde||{});

  const knownEmpresas=[...new Set(quotes.map(q=>q.empresa).filter(Boolean))];
  const nav=[
    {id:"cotizador",label:"Cotizador",strong:true},
    {id:"importar",label:"Importar datos",strong:false},
    {id:"precios",label:"Precios Vigentes",strong:false},
    {id:"costos",label:"Costos Vigentes",strong:false},
    {id:"mejoras",label:"Mejoras",strong:false},
    {id:"osde",label:"Precios OSDE",strong:false},
    {id:"historial",label:"Historial",strong:false},
    {id:"config",label:"Configuración",strong:false},
  ];

  return(<div style={{display:"flex",fontFamily:FONT,minHeight:"100vh",background:GRAY}}>
    <div style={{width:220,background:"#fff",borderRight:`1px solid ${BORDER}`,flexShrink:0,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"1.25rem",borderBottom:`1px solid ${BORDER}`}}>
        <img src={OMINT_LOGO} alt="Grupo Omint" style={{width:"100%",maxWidth:150,height:"auto"}}/>
      </div>
      <nav style={{padding:"0.5rem 0",flex:1}}>
        {nav.map(item=>(<button key={item.id} onClick={()=>setSec(item.id)} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 1.25rem",border:"none",borderRadius:0,cursor:"pointer",lineHeight:1.4,fontFamily:FONT,
          background:sec===item.id?BLUE_LT:"transparent",color:sec===item.id?BLUE:item.strong?"#111827":"#6B7280",
          fontWeight:item.strong?700:sec===item.id?600:400,fontSize:item.strong?14:13,
          borderLeft:sec===item.id?`3px solid ${BLUE}`:"3px solid transparent"}}>{item.label}</button>))}
      </nav>
      {loaded&&(<div style={{padding:"0.875rem 1.25rem",borderTop:`1px solid ${BORDER}`,background:"#FFFBF0"}}>
        <p style={{fontSize:11,fontWeight:700,color:"#92400E",textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:FONT,marginBottom:7}}>Ajuste de lista</p>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <input
            type="number"
            value={globalAjuste===0?"":globalAjuste}
            onChange={e=>saveAjuste(e.target.value)}
            placeholder="0"
            step="0.1"
            style={{width:64,padding:"5px 8px",border:`1.5px solid ${globalAjuste?`#F59E0B`:BORDER}`,borderRadius:6,fontSize:13,fontFamily:FONT,textAlign:"right",background:"#fff",color:"#111827",outline:"none"}}
          />
          <span style={{fontSize:13,color:"#6B7280",fontFamily:FONT}}>%</span>
          {globalAjuste!==0&&<button onClick={()=>saveAjuste(0)} title="Quitar ajuste" style={{marginLeft:"auto",border:"none",background:"none",cursor:"pointer",fontSize:14,color:"#9CA3AF",padding:"2px 4px",lineHeight:1}}>✕</button>}
        </div>
        {globalAjuste!==0&&<p style={{fontSize:11,color:"#92400E",marginTop:5,fontFamily:FONT}}>
          {globalAjuste>0?"▲":"▼"} Todos los precios ajustados <strong>{globalAjuste>0?"+":""}{globalAjuste}%</strong>
        </p>}
      </div>)}
      {loaded&&(<div style={{padding:"1rem 1.25rem",borderTop:`1px solid ${BORDER}`,background:BLUE_LT}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
          <p style={{fontSize:11,fontWeight:600,color:BLUE,textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:FONT}}>Resumen</p>
          <span style={{fontSize:9,padding:"2px 7px",borderRadius:10,fontFamily:FONT,fontWeight:600,
            background:syncStatus==="ok"?"#D1FAE5":syncStatus==="syncing"?"#FEF3C7":syncStatus==="error"?"#FEF2F2":"#F3F4F6",
            color:syncStatus==="ok"?"#065F46":syncStatus==="syncing"?"#92400E":syncStatus==="error"?"#DC2626":"#9CA3AF"}}>
            {syncStatus==="ok"?"✓ Sync":syncStatus==="syncing"?"↻ Sync...":syncStatus==="error"?"✗ Error":"● Local"}
          </span>
        </div>
        {[{l:"Abiertos",v:quotes.filter(q=>q.status==="abierto").length,c:"#92400E",bg:"#FEF3C7"},{l:"Cerrados",v:quotes.filter(q=>q.status==="cerrado").length,c:"#065F46",bg:"#D1FAE5"},{l:"Empresas",v:knownEmpresas.length,c:BLUE,bg:"#fff"}].map(s=>(<div key={s.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><span style={{fontSize:12,color:"#6B7280",fontFamily:FONT}}>{s.l}</span><span style={{...badge(s.c,s.bg),fontSize:11}}>{s.v}</span></div>))}
      </div>)}
    </div>
    <div style={{flex:1,padding:"2rem 2.5rem",overflowY:"auto",minWidth:0}}>
      {!loaded&&<p style={{fontSize:13,color:"#9CA3AF",fontFamily:FONT}}>Cargando…</p>}
      {loaded&&sec==="cotizador"&&<Cotizador precios={preciosAdj} costos={costosAdj} osde={osdeAdj} mejoras={mejoras||{}} onSaveQuote={saveQuote} knownEmpresas={knownEmpresas} apiKey={apiKey}/>}
      {loaded&&sec==="importar"&&<Importar onPreciosImport={savePre} onCostosImport={saveCos}/>}
      {loaded&&sec==="precios"&&<PreciosVigentes precios={precios} onSave={savePre}/>}
      {loaded&&sec==="costos"&&<CostosVigentes costos={costos} onSave={saveCos}/>}
      {loaded&&sec==="mejoras"&&<MejorasVigentes mejoras={mejoras||{}} onSave={saveMejoras}/>}
      {loaded&&sec==="osde"&&<OsdeVigentes osde={osde||{}} onSave={saveOsde}/>}
      {loaded&&sec==="historial"&&<Historial quotes={quotes} onUpdate={updQuote} onDelete={deleteQuote} onRenameEmpresa={renameEmpresa}/>}
      {loaded&&sec==="config"&&<Configuracion apiKey={apiKey} onSave={saveApiKey}/>}
    </div>
  </div>);
}

export default App;
