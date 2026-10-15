import { useState, useEffect } from "react";
import { dbGet, dbSet, dbSubscribe } from "./firebase";
import { lsGet, lsSet } from "./db";
import { FONT, BLUE, BLUE_LT, BORDER, GRAY, OMINT_LOGO } from "./constants";
import { badge } from "./styles";
import { calcMultiplier } from "./calc";
import Cotizador from "./components/Cotizador";
import Importar from "./components/Importar";
import PreciosVigentes from "./components/PreciosVigentes";
import CostosVigentes from "./components/CostosVigentes";
import MejorasVigentes from "./components/MejorasVigentes";
import Historial from "./components/Historial";
import OsdeVigentes from "./components/OsdeVigentes";
import Configuracion from "./components/Configuracion";

const DEF_AJUSTES={precios:[],costos:[],osde:[]};

// Si Firebase devuelve los precios sin las bandas de cápitas (por ejemplo, porque rechazó la
// escritura), se conservan las que este navegador ya tenía guardadas
function conBandasLocales(v){
  if(!v||v._bandas)return v;
  const locales=lsGet("omint-precios",null)?._bandas;
  return locales?{...v,_bandas:locales}:v;
}

// ── APP SHELL ─────────────────────────────────────────────────────────────────
function App(){
  const [sec,setSec]=useState("cotizador");
  const [precios,setPrecios]=useState(null);
  const [costos,setCostos]=useState(null);
  const [osde,setOsde]=useState(null);
  const [mejoras,setMejoras]=useState(null);
  const [quotes,setQuotes]=useState([]);
  const [apiKey,setApiKey]=useState("");
  const [ajustes,setAjustes]=useState(DEF_AJUSTES); // {precios:[], costos:[], osde:[]}
  const [loaded,setLoaded]=useState(false);
  const [syncStatus,setSyncStatus]=useState("idle"); // idle | syncing | ok | error

  useEffect(()=>{
    (async()=>{
      async function loadSync(fbKey,lsKey,setter,def={},ajustar=v=>v){
        const fbRaw=await dbGet(fbKey,null);
        const fbVal=fbRaw!==null?ajustar(fbRaw):null;
        if(fbVal!==null){setter(fbVal);lsSet(lsKey,fbVal);}
        else{const lsVal=lsGet(lsKey,def);setter(lsVal);if(JSON.stringify(lsVal)!==JSON.stringify(def))dbSet(fbKey,lsVal);}
      }
      const fbQ=await dbGet("quotes",null);
      if(fbQ!==null){const arr=Array.isArray(fbQ)?fbQ:Object.values(fbQ);setQuotes(arr);lsSet("omint-quotes",arr);}
      else{const lsQ=lsGet("omint-quotes",[]);setQuotes(lsQ);if(lsQ.length>0)dbSet("quotes",lsQ);}

      await Promise.all([
        loadSync("precios","omint-precios",setPrecios,{},conBandasLocales),
        loadSync("costos","omint-costos",setCostos),
        loadSync("osde","omint-osde",setOsde),
        loadSync("mejoras","omint-mejoras",setMejoras),
        loadSync("ajustes","omint-ajustes",v=>setAjustes({...DEF_AJUSTES,...v}),DEF_AJUSTES),
      ]);
      setApiKey(lsGet("omint-apikey",""));
      setLoaded(true);
      dbSubscribe("precios",v=>{const p=conBandasLocales(v||{});setPrecios(p);lsSet("omint-precios",p);});
      dbSubscribe("costos",v=>{setCostos(v||{});lsSet("omint-costos",v||{});});
      dbSubscribe("osde",v=>{setOsde(v||{});lsSet("omint-osde",v||{});});
      dbSubscribe("mejoras",v=>{setMejoras(v||{});lsSet("omint-mejoras",v||{});});
      dbSubscribe("ajustes",v=>{if(v){const a={...DEF_AJUSTES,...v};setAjustes(a);lsSet("omint-ajustes",a);}});
      dbSubscribe("quotes",v=>{if(!v)return;const arr=Array.isArray(v)?v:Object.values(v);setQuotes(arr);lsSet("omint-quotes",arr);});
    })();
  },[]);

  // Devuelve el mensaje de error de Firebase, o null si se guardó bien
  async function sync(fn){setSyncStatus("syncing");try{await fn();setSyncStatus("ok");setTimeout(()=>setSyncStatus("idle"),2000);return null;}catch(e){console.warn("Firebase sync error:",e);setSyncStatus("error");setTimeout(()=>setSyncStatus("idle"),4000);return String(e?.message||e);}}
  // Las bandas de cápitas viajan dentro de "precios" (precios._bandas): así se guardan en la
  // misma clave de Firebase que ya tiene permisos. Sin bandas nuevas se conservan las que había.
  async function savePre(p,bandas){
    const full={...p};delete full._bandas;
    let b=bandas;
    if(b===undefined&&precios?._bandas){
      // Edición en Precios Vigentes: lo editado es la banda 200-499, así que se copia a esa banda
      // (la cotización toma los precios de las bandas cuando el plan las tiene)
      b=Object.fromEntries(Object.entries(precios._bandas).map(([z,planes])=>[z,Object.fromEntries(Object.entries(planes||{}).map(([pl,bs])=>{
        const l200=Object.keys(bs||{}).find(l=>l.includes("200"));
        return[pl,l200&&full[z]?.[pl]?{...bs,[l200]:full[z][pl]}:bs];
      }))]));
    }
    if(b&&Object.keys(b).length)full._bandas=b;
    setPrecios(full);lsSet("omint-precios",full);return sync(()=>dbSet("precios",full));
  }
  async function saveCos(c){setCostos(c);lsSet("omint-costos",c);sync(()=>dbSet("costos",c));}
  async function saveOsde(o){setOsde(o);lsSet("omint-osde",o);sync(()=>dbSet("osde",o));}
  async function saveMejoras(m){setMejoras(m);lsSet("omint-mejoras",m);sync(()=>dbSet("mejoras",m));}
  function saveQuote(q){const nq=[q,...quotes];setQuotes(nq);lsSet("omint-quotes",nq);sync(()=>dbSet("quotes",nq));}
  function updQuote(id,upd){const nq=quotes.map(q=>q.id===id?{...q,...upd}:q);setQuotes(nq);lsSet("omint-quotes",nq);sync(()=>dbSet("quotes",nq));}
  function deleteQuote(id){const nq=quotes.filter(q=>q.id!==id);setQuotes(nq);lsSet("omint-quotes",nq);sync(()=>dbSet("quotes",nq));}
  function renameEmpresa(oldName,newName){const nq=quotes.map(q=>q.empresa===oldName?{...q,empresa:newName}:q);setQuotes(nq);lsSet("omint-quotes",nq);sync(()=>dbSet("quotes",nq));}
  function saveApiKey(k){setApiKey(k);lsSet("omint-apikey",k);}

  function saveAjuste(tipo,newHistorial){
    const a={...ajustes,[tipo]:newHistorial};
    setAjustes(a);lsSet("omint-ajustes",a);sync(()=>dbSet("ajustes",a));
  }

  // Aplica el multiplicador acumulado del historial a cualquier árbol de precios
  function applyAjuste(data,historial){
    const m=calcMultiplier(historial);
    if(!data||m===1)return data;
    function mult(obj){
      if(typeof obj==="number")return Math.round(obj*m);
      if(obj&&typeof obj==="object")return Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,mult(v)]));
      return obj;
    }
    return mult(data);
  }
  const {_bandas:preciosBandas,...preciosSolo}=precios||{}; // {zona:{plan:{"11 a 99 cápitas":cats,...}}}
  const preciosAdj=applyAjuste(preciosSolo,ajustes.precios);
  const bandasAdj=applyAjuste(preciosBandas||{},ajustes.precios);
  const costosAdj=applyAjuste(costos||{},ajustes.costos);
  const osdeAdj=applyAjuste(osde||{},ajustes.osde);

  // Multiplicadores acumulados (para mostrar en sidebar)
  const mP=calcMultiplier(ajustes.precios);
  const mC=calcMultiplier(ajustes.costos);
  const mO=calcMultiplier(ajustes.osde);

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

  // Sidebar: indicadores de ajuste activo
  const ajustesInfo=[
    {l:"Precios",m:mP,color:BLUE},
    {l:"Costos",m:mC,color:"#7C3AED"},
    {l:"OSDE",m:mO,color:"#059669"},
  ];
  const hayAjuste=mP!==1||mC!==1||mO!==1;

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

      {/* Indicadores de ajuste activo */}
      {loaded&&hayAjuste&&(
        <div style={{padding:"0.875rem 1.25rem",borderTop:`1px solid ${BORDER}`,background:"#FFFBF0"}}>
          <p style={{fontSize:10,fontWeight:700,color:"#92400E",textTransform:"uppercase",
            letterSpacing:"0.05em",fontFamily:FONT,marginBottom:6}}>Ajustes activos</p>
          {ajustesInfo.map(a=>{
            const pct=((a.m-1)*100);
            if(pct===0)return null;
            return(
              <div key={a.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                <span style={{fontSize:12,color:"#6B7280",fontFamily:FONT}}>{a.l}</span>
                <span style={{fontSize:12,fontWeight:700,color:pct>0?"#059669":"#DC2626",fontFamily:FONT}}>
                  {pct>0?"+":""}{pct.toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
      )}

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
      {loaded&&sec==="cotizador"&&<Cotizador precios={preciosAdj} preciosBandas={bandasAdj} costos={costosAdj} osde={osdeAdj} mejoras={mejoras||{}} onSaveQuote={saveQuote} knownEmpresas={knownEmpresas} apiKey={apiKey}/>}
      {loaded&&sec==="importar"&&<Importar onPreciosImport={(p,b)=>savePre(p,b)} onCostosImport={saveCos}/>}
      {loaded&&sec==="precios"&&<PreciosVigentes precios={preciosSolo} onSave={p=>savePre(p)} ajustes={ajustes.precios} onAjusteUpdate={h=>saveAjuste("precios",h)}/>}
      {loaded&&sec==="costos"&&<CostosVigentes costos={costos} onSave={saveCos} ajustes={ajustes.costos} onAjusteUpdate={h=>saveAjuste("costos",h)}/>}
      {loaded&&sec==="mejoras"&&<MejorasVigentes mejoras={mejoras||{}} onSave={saveMejoras}/>}
      {loaded&&sec==="osde"&&<OsdeVigentes osde={osde||{}} onSave={saveOsde} ajustes={ajustes.osde} onAjusteUpdate={h=>saveAjuste("osde",h)}/>}
      {loaded&&sec==="historial"&&<Historial quotes={quotes} onUpdate={updQuote} onDelete={deleteQuote} onRenameEmpresa={renameEmpresa}/>}
      {loaded&&sec==="config"&&<Configuracion apiKey={apiKey} onSave={saveApiKey}/>}
    </div>
  </div>);
}

export default App;
