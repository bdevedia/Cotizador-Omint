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
  const [loaded,setLoaded]=useState(false);
  const [syncStatus,setSyncStatus]=useState("idle"); // idle | syncing | ok | error

  useEffect(()=>{
    (async()=>{
      const p=await dbGet("precios",lsGet("omint-precios",{}));
      const c=await dbGet("costos",lsGet("omint-costos",{}));
      const o=await dbGet("osde",lsGet("omint-osde",{}));
      const mej=await dbGet("mejoras",lsGet("omint-mejoras",{}));
      setPrecios(p);setCostos(c);setOsde(o);setMejoras(mej);
      setQuotes(lsGet("omint-quotes",[]));setApiKey(lsGet("omint-apikey",""));
      setLoaded(true);
      // Suscribir actualizaciones en tiempo real
      dbSubscribe("precios",v=>{setPrecios(v||{});});
      dbSubscribe("costos",v=>{setCostos(v||{});});
      dbSubscribe("osde",v=>{setOsde(v||{});});
      dbSubscribe("mejoras",v=>{setMejoras(v||{});});
    })();
  },[]);

  async function savePre(p){setPrecios(p);lsSet("omint-precios",p);setSyncStatus("syncing");try{await dbSet("precios",p);setSyncStatus("ok");setTimeout(()=>setSyncStatus("idle"),2000);}catch(e){console.warn("Firebase sync error (precios):",e);setSyncStatus("error");setTimeout(()=>setSyncStatus("idle"),4000);}}
  async function saveCos(c){setCostos(c);lsSet("omint-costos",c);setSyncStatus("syncing");try{await dbSet("costos",c);setSyncStatus("ok");setTimeout(()=>setSyncStatus("idle"),2000);}catch(e){console.warn("Firebase sync error (costos):",e);setSyncStatus("error");setTimeout(()=>setSyncStatus("idle"),4000);}}
  async function saveMejoras(m){setMejoras(m);lsSet("omint-mejoras",m);setSyncStatus("syncing");try{await dbSet("mejoras",m);setSyncStatus("ok");setTimeout(()=>setSyncStatus("idle"),2000);}catch(e){console.warn(e);setSyncStatus("error");setTimeout(()=>setSyncStatus("idle"),4000);}}
  function saveOsde(o){setOsde(o);lsSet("omint-osde",o);dbSet("osde",o);}
  function saveQuote(q){const nq=[q,...quotes];setQuotes(nq);lsSet("omint-quotes",nq);}
  function updQuote(id,upd){const nq=quotes.map(q=>q.id===id?{...q,...upd}:q);setQuotes(nq);lsSet("omint-quotes",nq);}
  function saveApiKey(k){setApiKey(k);lsSet("omint-apikey",k);}

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
      {loaded&&sec==="cotizador"&&<Cotizador precios={precios||{}} costos={costos||{}} osde={osde||{}} mejoras={mejoras||{}} onSaveQuote={saveQuote} knownEmpresas={knownEmpresas} apiKey={apiKey}/>}
      {loaded&&sec==="importar"&&<Importar onPreciosImport={savePre} onCostosImport={saveCos}/>}
      {loaded&&sec==="precios"&&<PreciosVigentes precios={precios} onSave={savePre}/>}
      {loaded&&sec==="costos"&&<CostosVigentes costos={costos} onSave={saveCos}/>}
      {loaded&&sec==="mejoras"&&<MejorasVigentes mejoras={mejoras||{}} onSave={saveMejoras}/>}
      {loaded&&sec==="osde"&&<OsdeVigentes osde={osde||{}} onSave={saveOsde}/>}
      {loaded&&sec==="historial"&&<Historial quotes={quotes} onUpdate={updQuote}/>}
      {loaded&&sec==="config"&&<Configuracion apiKey={apiKey} onSave={saveApiKey}/>}
    </div>
  </div>);
}

export default App;
