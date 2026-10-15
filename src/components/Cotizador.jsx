import { useState, useRef, useEffect, Fragment } from "react";
import * as XLSX from "xlsx-js-style";
import { FONT, BLUE, BLUE_LT, BORDER, GRAY,
  CATS, CAT_IDS, EMPTY_CATS,
  ZONA_IDS, ZONA_COLORS,
  OSDE_CATS, EMPTY_OSDE, MEJORAS_DEF } from "../constants";
import { fmt, planTier } from "../utils";
import { badge, btnP, btnS, inp, card, TH, TD } from "../styles";
import { parseNominaFija, downloadTemplate } from "../parsers";
import { calcBD, pctAjuste, checkPriceInversions, bandaPorCapitas, ordenarBandas, rangoBanda } from "../calc";
import Salidas from "./Salidas";
import NominaResumen from "./NominaResumen";
import PlanesPropuesta from "./PlanesPropuesta";
import Planilla from "./Planilla";

// ── MODAL TITULARES DUPLICADOS ────────────────────────────────────────────────
function DuplicadosModal({items,onResolve}){
  const [resoluciones,setResoluciones]=useState(()=>Object.fromEntries(items.map(d=>[d.gid,"desestimar"])));
  const [globalOp,setGlobalOp]=useState("");

  function aplicarGlobal(op){
    setGlobalOp(op);
    setResoluciones(Object.fromEntries(items.map(d=>[d.gid,op])));
  }

  const overlay={position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"};
  const modal={background:"#fff",borderRadius:14,padding:"1.75rem",width:"min(680px,96vw)",maxHeight:"88vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",fontFamily:FONT};
  const rowStyle={display:"grid",gridTemplateColumns:"1fr 1fr 180px",alignItems:"center",gap:"10px",padding:"10px 0",borderBottom:"1px solid #F3F4F6"};

  return(
    <div style={overlay}>
      <div style={modal}>
        <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:"1.25rem"}}>
          <span style={{fontSize:26,lineHeight:1}}>⚠️</span>
          <div>
            <h3 style={{fontSize:16,fontWeight:700,color:BLUE,marginBottom:4}}>Titulares duplicados en el archivo</h3>
            <p style={{fontSize:13,color:"#374151",lineHeight:1.5}}>
              Se encontraron <strong>{items.length} grupo{items.length>1?"s familiares":""} familiar{items.length===1?"":""}</strong> con dos filas marcadas como <em>Titular</em>. Elegí qué hacer con cada uno.
            </p>
          </div>
        </div>

        {/* Aplicar a todos */}
        <div style={{display:"flex",gap:8,marginBottom:"1rem",padding:"10px 14px",background:"#F9FAFB",borderRadius:8,alignItems:"center"}}>
          <span style={{fontSize:12,fontWeight:600,color:"#6B7280",marginRight:4}}>Aplicar a todos:</span>
          {[{v:"desestimar",l:"Desestimar el 2°"},{v:"conyuge",l:"Incluir como cónyuge"}].map(o=>(
            <button key={o.v} onClick={()=>aplicarGlobal(o.v)}
              style={{...globalOp===o.v?btnP:btnS,padding:"5px 14px",fontSize:12}}>
              {o.l}
            </button>
          ))}
        </div>

        {/* Encabezado tabla */}
        <div style={{...rowStyle,borderBottom:"2px solid #E5E7EB",paddingBottom:6,marginBottom:2}}>
          <span style={{fontSize:11,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:"0.04em"}}>Grupo / 1° Titular</span>
          <span style={{fontSize:11,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:"0.04em"}}>2° Titular (duplicado)</span>
          <span style={{fontSize:11,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:"0.04em"}}>¿Qué hacer?</span>
        </div>

        {items.map(d=>(
          <div key={d.gid} style={rowStyle}>
            <div>
              <span style={{fontSize:11,color:"#9CA3AF"}}>Grupo {d.gid}</span><br/>
              <span style={{fontWeight:600,fontSize:13,color:"#111827"}}>{d.nombre1}</span>
              {d.edad1!=null&&<span style={{fontSize:12,color:"#6B7280",marginLeft:6}}>{d.edad1} años</span>}
            </div>
            <div>
              <span style={{fontWeight:600,fontSize:13,color:"#111827"}}>{d.nombre2}</span>
              {d.edad2!=null&&<span style={{fontSize:12,color:"#6B7280",marginLeft:6}}>{d.edad2} años</span>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              {[{v:"desestimar",l:"Desestimar",desc:"No incluir al 2°"},{v:"conyuge",l:"Como cónyuge",desc:"Suma su edad al grupo"}].map(o=>(
                <label key={o.v} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,color:resoluciones[d.gid]===o.v?"#1B2A7B":"#374151",fontWeight:resoluciones[d.gid]===o.v?600:400}}>
                  <input type="radio" name={`dup-${d.gid}`} value={o.v}
                    checked={resoluciones[d.gid]===o.v}
                    onChange={()=>{setGlobalOp("");setResoluciones(p=>({...p,[d.gid]:o.v}));}}
                    style={{accentColor:BLUE}}/>
                  <span>{o.l}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        <div style={{display:"flex",gap:10,marginTop:"1.5rem",justifyContent:"flex-end"}}>
          <button onClick={()=>onResolve(resoluciones)} style={{...btnP,padding:"9px 28px",fontSize:14}}>
            Confirmar y cargar nómina
          </button>
        </div>
      </div>
    </div>
  );
}

// ── COTIZADOR ─────────────────────────────────────────────────────────────────
function Cotizador({precios:preciosLista,preciosBandas,costos,osde,mejoras,onSaveQuote,knownEmpresas,apiKey}){
  const [sub,setSub]=useState(1);
  const [emps,setEmps]=useState(null);
  const [map,setMap]=useState({titAge:"",spAge:"",ku:"",k25:"",name:"",planCol:"",zonaCol:""});
  const [forcedZona,setForcedZona]=useState(null);
  const [planMapping,setPlanMapping]=useState({});
  const [adjPrices,setAdjPrices]=useState({});
  const [adjCostos,setAdjCostos]=useState({});
  const [adjPct,setAdjPct]=useState({}); // {adjKey: ajuste} — ver pctAjuste en calc.js; lo usa el Excel
  const [empresa,setEmpresa]=useState("");
  const [salidaCfg,setSalidaCfg]=useState({fecha:new Date().toISOString().split("T")[0],validez:"La propuesta tiene validez por un mes desde la fecha de presentación.",formato:"nchoice",textoExtra:"",masaSalarial:""});
  const [chat,setChat]=useState([]);
  const [chatIn,setChatIn]=useState("");
  const [chatLoading,setCL]=useState(false);
  const [saveMsg,setSaveMsg]=useState("");
  const [aiLog,setAiLog]=useState([]); // log de cambios de IA
  const [scenarios,setScenarios]=useState({}); // {name: {adjPrices, adjCostos}}
  const [nomErrors,setNomErrors]=useState([]); // validación de nómina
  const [spouseWarning,setSpouseWarning]=useState(null); // advertencia cónyuges múltiples
  const [dupWarning,setDupWarning]=useState(null); // {items, rawRows, rawCols} — titulares duplicados
  const [brokerPct,setBrokerPct]=useState(""); // comisión del broker (%)
  const [planMappingOsde,setPlanMappingOsde]=useState({});
  const [planMejoras,setPlanMejoras]=useState({});
  const [planCustomNames,setPlanCustomNames]=useState({});
  // Tipo de propuesta: "equivalencia" (cada plan vigente → plan Omint equivalente)
  // o "simulacion" (toda la nómina cotizada en cada uno de los planes elegidos)
  const [modo,setModo]=useState("equivalencia");
  const [planesSim,setPlanesSim]=useState([]); // ids de planes cotizados (plan Omint u opción con mejoras)
  // Copias de planes: el mismo plan Omint cotizado otra vez como un plan aparte (ej. 8500_PYME-2,
  // para cotizarlo con otras mejoras o ajustes). {id, planId, mejoras}
  const [variantes,setVariantes]=useState([]);
  const [planADuplicar,setPlanADuplicar]=useState("");
  const [bandaForzada,setBandaForzada]=useState(""); // banda de cápitas elegida a mano ("" = automática)
  const chatEnd=useRef(null);
  useEffect(()=>{chatEnd.current?.scrollIntoView({behavior:"smooth"});},[chat]);

  // ── BANDA DE CÁPITAS ──
  // La lista trae un precio por banda de cápitas (tamaño de la nómina). Se usa la banda que
  // corresponde a los socios de toda la nómina, salvo que se elija otra a mano.
  const capitas=emps&&map.titAge?calcBD(emps,map,{},{}).rows.reduce((a,r)=>a+r.count,0):0;
  const bandasDisp=ordenarBandas([...new Set(Object.values(preciosBandas||{}).flatMap(z=>Object.values(z||{}).flatMap(b=>Object.keys(b||{}))))]);
  const bandaAuto=bandasDisp.length&&capitas>0?bandaPorCapitas(bandasDisp,capitas):"";
  const bandaUsada=bandasDisp.includes(bandaForzada)?bandaForzada:bandaAuto;
  // Cada plan toma la banda entre las suyas: los PYME no tienen "1 a 10", así que con pocas
  // cápitas usan su primera banda ("11 a 99"). Sin bandas, el precio de la lista (200-499).
  const capitasBanda=bandaForzada&&bandasDisp.includes(bandaForzada)?(rangoBanda(bandaForzada)?.lo??capitas):capitas;
  const precios=bandaUsada?Object.fromEntries(Object.entries(preciosLista||{}).map(([z,planes])=>[z,
    Object.fromEntries(Object.entries(planes||{}).map(([pl,cats])=>{
      const bs=preciosBandas?.[z]?.[pl];
      const labels=Object.keys(bs||{});
      return[pl,labels.length?bs[bandaPorCapitas(labels,capitasBanda)]:cats];
    }))])):preciosLista;
  // Planes que no tienen la banda general y usan otra (ej. PYME con 10 cápitas o menos)
  const otraBanda={};
  if(bandaUsada)Object.values(preciosBandas||{}).forEach(planes=>Object.entries(planes||{}).forEach(([pl,bs])=>{
    const labels=Object.keys(bs||{});
    const l=labels.length?bandaPorCapitas(labels,capitasBanda):null;
    if(l&&l!==bandaUsada)otraBanda[pl]=l;
  }));
  const banda={capitas,disponibles:bandasDisp,auto:bandaAuto,usada:bandaUsada,forzada:bandasDisp.includes(bandaForzada)?bandaForzada:"",setForzada:setBandaForzada,otraBanda};

  const isOmintPlan=p=>Object.values(precios||{}).some(z=>z[p]);
  const externalPlans=emps&&map.planCol?[...new Set(emps.map(e=>e[map.planCol]).filter(Boolean))]:[];
  const needsMapeo=externalPlans.some(p=>!isOmintPlan(p));
  // El paso 2 se muestra siempre que haya planes en la nómina: ahí también se arman las opciones con mejoras
  const pasoPlanes=modo==="simulacion"||externalPlans.length>0;
  const allOmintPlans=[...new Set(ZONA_IDS.flatMap(z=>Object.keys(precios?.[z]||{})))].sort((a,b)=>planTier(a)-planTier(b)||a.localeCompare(b));
  const isSim=modo==="simulacion";
  const varPorId=Object.fromEntries(variantes.map(v=>[v.id,v]));
  // Planes que se pueden elegir al mapear o simular: planes Omint + opciones con mejoras
  const opcionesCot=[...allOmintPlans,...variantes.map(v=>v.id)];
  // id de plan cotizado → {planId base (precios/costos), cotId}
  function resolverCot(id){
    if(!id)return null;
    const v=varPorId[id];
    return v?{planId:v.planId,cotId:v.id}:{planId:id,cotId:id};
  }
  function duplicarPlan(planId){
    if(!planId)return;
    let n=2;
    while(varPorId[`${planId}-${n}`]||allOmintPlans.includes(`${planId}-${n}`))n++;
    const id=`${planId}-${n}`;
    setVariantes(prev=>[...prev,{id,planId,mejoras:{}}]);
    if(isSim)setPlanesSim(prev=>[...prev,id]); // en simulación la copia queda elegida
    setPlanADuplicar("");
  }
  function quitarVariante(id){
    setVariantes(prev=>prev.filter(v=>v.id!==id));
    setPlanesSim(prev=>prev.filter(p=>p!==id));
    setPlanMapping(prev=>Object.fromEntries(Object.entries(prev).filter(([,v])=>v!==id)));
  }
  // Con más de un plan simulado los totales no se suman: cada plan es una alternativa para toda la nómina
  const multiSim=isSim&&planesSim.length>1;

  // Aplica un ajuste de precios (0-59/60+ o por rango) a un plan cotizado, sobre su precio de lista
  function aplicarAjuste(r,adj){
    const base=precios?.[r.zona]?.[r.planId]||{};
    const sinAjuste=CAT_IDS.every(id=>!pctAjuste(adj,id));
    if(sinAjuste){
      // Sin %: precios de lista. Se recuerda el modo "por rango" para que no vuelva solo a 0-59/60+
      setAdjPrices(prev=>{const n={...prev};delete n[r.adjKey];return n;});
      setAdjPct(prev=>{const n={...prev};if(adj?.modo==="rango")n[r.adjKey]=adj;else delete n[r.adjKey];return n;});
      return;
    }
    const u=Object.fromEntries(CAT_IDS.map(id=>[id,Math.round((base[id]||0)*(1+pctAjuste(adj,id))*100)/100]));
    setAdjPrices(prev=>({...prev,[r.adjKey]:u}));
    setAdjPct(prev=>({...prev,[r.adjKey]:adj}));
  }
  // Precio escrito a mano en la tabla: se guarda como % de ese rango para que el Excel lo refleje
  function setPrecioManual(r,catId,v){
    const b=precios?.[r.zona]?.[r.planId]?.[catId]||0;
    if(b<=0){setAdjPrices(prev=>({...prev,[r.adjKey]:{...(prev[r.adjKey]||{}),[catId]:v}}));return;}
    const cur=adjPct[r.adjKey];
    const cats=Object.fromEntries(CAT_IDS.map(id=>[id,pctAjuste(cur,id)]));
    cats[catId]=v/b-1;
    aplicarAjuste(r,{modo:"rango",cats});
  }

  function getEmpZona(e){
    if(forcedZona) return forcedZona;
    const col=map.zonaCol;
    if(col&&e[col]&&e[col].toString().trim()){const z=e[col].toString().trim();return ZONA_IDS.find(zi=>zi.toLowerCase()===z.toLowerCase())||"AMBA";}
    return "AMBA";
  }

  function buildGroups(){
    if(!emps||!map.titAge||!map.ku)return[];
    const gmap={};
    if(isSim){
      // Simulación: cada empleado entra en todos los planes elegidos, ignorando su plan vigente
      emps.forEach(e=>{
        const zona=getEmpZona(e);
        planesSim.forEach(id=>{
          const cot=resolverCot(id);
          if(!cot)return;
          const key=`${zona}||${cot.cotId}`;
          if(!gmap[key])gmap[key]={zona,planVigente:cot.cotId,...cot,empList:[]};
          gmap[key].empList.push(e);
        });
      });
      return Object.values(gmap).sort((a,b)=>planTier(a.planId)-planTier(b.planId)||a.cotId.localeCompare(b.cotId)||a.zona.localeCompare(b.zona));
    }
    emps.forEach(e=>{
      const zona=getEmpZona(e);
      if(!map.planCol||!e[map.planCol])return;
      const ext=String(e[map.planCol]).trim();
      const cot=resolverCot(planMapping[ext]||(isOmintPlan(ext)?ext:null));
      if(!cot)return;
      // Agrupar por plan VIGENTE: cada plan original tiene su propia distribución
      const planVigente=ext;
      const key=`${zona}||${planVigente}`;
      if(!gmap[key])gmap[key]={zona,planVigente,...cot,empList:[]};
      gmap[key].empList.push(e);
    });
    return Object.values(gmap).sort((a,b)=>a.zona.localeCompare(b.zona)||planTier(a.planId)-planTier(b.planId)||a.cotId.localeCompare(b.cotId));
  }

  function buildResults(){
    const brokerMult=1+(parseFloat(brokerPct)||0)/100;
    return buildGroups().map(({zona,planId,cotId,planVigente,empList})=>{
      // adjKey por plan COTIZADO (plan Omint u opción con mejoras): ajustes, mejoras y nombres
      // van por opción; precios y costos base salen del plan Omint (planId)
      const adjKey=`${zona}||${cotId}`;
      const basePrices=precios?.[zona]?.[planId]||{};
      const adjP=adjPrices[adjKey]||{};
      const effPrices=Object.fromEntries(CAT_IDS.map(c=>[c,adjP[c]!==undefined?adjP[c]:basePrices[c]||0]));
      const baseCostos=costos?.[planId]||{};
      const adjC=adjCostos[adjKey]||{};
      // Mejoras: las elegidas a mano para esta opción o, si no, las fijas de la opción
      const mejSel=planMejoras[adjKey]||varPorId[cotId]?.mejoras||{};
      const effCostos=Object.fromEntries(CAT_IDS.map(c=>{
        const base=adjC[c]!==undefined?adjC[c]:baseCostos[c]||0;
        let mejCost=0;
        MEJORAS_DEF.forEach(m=>{
          const optKey=mejSel[m.id];
          if(!optKey)return;
          const opt=(mejoras||{})[m.id]?.[optKey];
          if(opt==null)return;
          mejCost+=m.type==="pmpm"?(typeof opt==="number"?opt:0):(opt[c]||0);
        });
        return[c,(base+mejCost)*brokerMult];
      }));
      const bd=calcBD(empList,map,effPrices,effCostos);
      // mapping: plan vigente → plan Omint (si son distintos)
      const mapping=planVigente!==cotId?[{from:planVigente,to:cotId}]:[];
      // baseCostosXLS: costo sin mejoras ni comisión (para que Excel pueda desglosar correctamente)
      const baseCostosXLS=Object.fromEntries(CAT_IDS.map(c=>[c,adjC[c]!==undefined?adjC[c]:baseCostos[c]||0]));
      // basePreciosXLS: precio original sin ajuste IA (para que Excel aplique la fórmula *(1+adj) sin doble ajuste)
      const basePreciosXLS=Object.fromEntries(CAT_IDS.map(c=>[c,basePrices[c]||0]));
      // osdeKey: clave para comparación OSDE (por plan vigente, no por plan Omint)
      const osdeKey=`${zona}||${planVigente}`;
      const sinPrecios=Object.keys(basePrices).length===0;
      return{zona,planId,cotId,mejSel,planVigente,empList,bd,mapping,adjKey,osdeKey,sim:isSim,sinPrecios,hasAdjP:Object.keys(adjP).length>0,hasAdjC:Object.keys(adjC).length>0,baseCostosXLS,basePreciosXLS};
    });
  }

  const results=sub===3||sub==="salidas"?buildResults():[];
  const grandFac=results.reduce((a,r)=>a+r.bd.totalFac,0);
  const grandCosto=results.reduce((a,r)=>a+r.bd.totalCosto,0);
  const grandCF=grandFac>0?grandCosto/grandFac*100:0;
  const gruposPaso2=sub==="mapeo"?buildGroups():[];
  const inversions=sub===3||sub==="salidas"?checkPriceInversions(results):[];
  // Totales por plan simulado (sumando zonas)
  const simTotals=isSim?planesSim.map(cotId=>{
    const rs=results.filter(r=>r.cotId===cotId);
    const planId=rs[0]?.planId||cotId;
    const fac=rs.reduce((a,r)=>a+r.bd.totalFac,0),costo=rs.reduce((a,r)=>a+r.bd.totalCosto,0);
    return{planId,cotId,adjKeys:rs.map(r=>r.adjKey),fac,costo,cf:fac>0?costo/fac*100:0};
  }).sort((a,b)=>planTier(a.planId)-planTier(b.planId)||a.cotId.localeCompare(b.cotId)):[];

  function handleFile(e){
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();
    r.onload=ev=>{
      try{
        const wb=XLSX.read(ev.target.result,{type:"binary"});
        // Intentar hoja "Nómina" o "Hoja1" o la primera disponible
        const preferidas=["Nómina","Nomina","Hoja1","Sheet1","Data","nómina"];
        const sheetName=preferidas.find(s=>wb.SheetNames.includes(s))||wb.SheetNames[0];
        const raw=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{raw:false,defval:null});
        if(!raw||raw.length===0){setNomErrors([{tipo:"error",msg:"El archivo está vacío."}]);return;}
        const rawCols=Object.keys(raw[0]);
        const result=parseNominaFija(raw,rawCols);
        if(result.error){
          setNomErrors([{tipo:"error",msg:result.error}]);
          setEmps(null);return;
        }
        // Éxito — cargar con mapeo fijo (sin paso de configuración)
        if(result.rows.length===0){setNomErrors([{tipo:"error",msg:"El archivo no tiene filas de datos. Revisá que tenga al menos una fila de empleados."}]);setEmps(null);return;}
        // Si hay titulares duplicados sin resolver, mostrar modal antes de cargar
        if(result.titularDuplicados&&result.titularDuplicados.length>0){
          setDupWarning({items:result.titularDuplicados,rawRows:raw,rawCols});
          return; // esperar decisión del usuario
        }
        applyParsedResult(result);
      }catch{
        setNomErrors([{tipo:"error",msg:"Error al leer el archivo. Revisá el template."}]);
      }
    };
    r.readAsBinaryString(f);
  }

  function applyParsedResult(result){
        setBandaForzada("");
        setEmps(result.rows);
        setMap({titAge:"EDAD_TITULAR",spAge:"EDAD_CONYUGE",ku:"HIJOS_MENORES_25",k25:"HIJOS_MAYORES_25_EDADES",name:"NOMBRE",planCol:"PLAN_ACTUAL",zonaCol:"ZONA"});
        const info=`✓ ${result.rows.length} familias cargadas (${result.totalRaw} filas procesadas${result.filasIgnoradas>0?`, ${result.filasIgnoradas} ignoradas`:""})`;
        const warns=[];
        if(result.hijosEdadInvalida&&result.hijosEdadInvalida.length>0){
          const n=result.hijosEdadInvalida.length;
          warns.push({tipo:"warning",msg:`${n} hijo${n>1?"s":""} sin edad válida en el archivo (no incluido${n>1?"s":""} en el cálculo). Grupos: ${[...new Set(result.hijosEdadInvalida)].join(", ")}`});
        }
        setNomErrors([{tipo:"info",msg:info},...warns]);
        if(result.conyugesMultiples&&result.conyugesMultiples.length>0){
          setSpouseWarning({count:result.conyugesMultiples.length,familias:result.conyugesMultiples.map(x=>x.familia)});
        }else{setSpouseWarning(null);}
  }

  function resolveDuplicados(resoluciones){
    // Re-parsear el archivo con las resoluciones elegidas por el usuario
    if(!dupWarning)return;
    const result=parseNominaFija(dupWarning.rawRows,dupWarning.rawCols,resoluciones);
    setDupWarning(null);
    if(result.error){setNomErrors([{tipo:"error",msg:result.error}]);setEmps(null);return;}
    applyParsedResult(result);
  }

  async function sendChat(){
    if(!chatIn.trim()||chatLoading||!results.length)return;
    if(!apiKey){alert("Configurá tu API key en Configuración.");return;}
    const m=chatIn.trim();setChatIn("");
    const hist=[...chat,{role:"user",content:m}];setChat(hist);setCL(true);

    // Construir tabla de precios actuales EFECTIVOS (ya con ajustes aplicados)
    const preciosActuales=results.map(r=>{
      const cats=CAT_IDS.map(id=>{
        const precio=r.bd.rows.find(x=>x.id===id)?.precio||0;
        return`${id}=${Math.round(precio)}`;
      }).join(", ");
      return`${r.zona}/${r.cotId}: ${cats} | C/F=${r.bd.cfTotal.toFixed(1)}%`;
    }).join("\n");

    const sys=`Sos un motor de ajuste de precios para cotizaciones de medicina prepaga Omint.

INSTRUCCIONES CRÍTICAS:
1. Los precios que ves abajo son los precios ACTUALES de esta cotización. Calculá SIEMPRE desde estos valores.
2. "subir X%" = precio_actual * (1 + X/100). "bajar X%" = precio_actual * (1 - X/100).
3. Si modificás solo algunas categorías, las demás deben quedar con pct059=0 y pct60=0.
4. Nunca uses porcentajes que no pediste explícitamente.
5. Respondé con un bloque por cada plan modificado. Sin explicaciones largas.
6. IMPORTANTE: devolvé SIEMPRE el porcentaje de ajuste exacto que te pidieron, no el precio final.

CATEGORÍAS (para referencia): s0_25=0-25, s26_34=26-35, s35_54=36-54, s55_59=55-59, s60plus=60+, h1=Hijo1, h2plus=Hijo2+

FORMATO DE RESPUESTA (repetir por cada plan):
Confirmación breve.
ZONA: [zona exacta]
PLAN: [plan exacto]
\`\`\`json
{"pct059": PORCENTAJE_DECIMAL_0_59, "pct60": PORCENTAJE_DECIMAL_60}
\`\`\`
Ejemplos: bajar 12% → pct059=-0.12 | subir 5% → pct059=0.05 | sin cambio → pct059=0
Si solo se modifica 60+, poner pct059=0. Si solo 0-59, poner pct60=0. Si ambos igual, mismo valor.

PRECIOS ACTUALES DE ESTA COTIZACIÓN (usá estos como base para cualquier cálculo):
${preciosActuales}
${multiSim
  ?`MODO SIMULACIÓN: cada plan es una alternativa que cotiza TODA la nómina; no sumes planes entre sí.\n${simTotals.map(t=>`TOTAL ${t.cotId}: fac=$${fmt(t.fac)}, C/F=${t.cf.toFixed(1)}%`).join("\n")}\n(≤70% excelente, 70-82% aceptable, >82% alto)`
  :`TOTAL: fac=$${fmt(grandFac)}, C/F=${grandCF.toFixed(1)}% (≤70% excelente, 70-82% aceptable, >82% alto)`}
Planes disponibles: ${[...new Set(results.map(r=>r.cotId))].join(", ")}
Zonas disponibles: ${[...new Set(results.map(r=>r.zona))].join(", ")}`;

    try{
      // SIN historial — cada request es independiente para evitar confusión en cálculos
      const res=await fetch("https://api.groq.com/openai/v1/chat/completions",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${apiKey}`},
        body:JSON.stringify({
          model:"llama-3.3-70b-versatile",
          max_tokens:1500,
          temperature:0.1, // baja temperatura = más preciso en cálculos
          messages:[
            {role:"system",content:sys},
            {role:"user",content:m}
          ]
        })
      });
      const data=await res.json();
      const full=data.choices?.[0]?.message?.content||data.error?.message||"Error.";

      // Parsear todos los bloques ZONA/PLAN/JSON de la respuesta
      const allMatches=[...full.matchAll(/ZONA:\s*(\S+)[\s\S]*?PLAN:\s*(\S+)[\s\S]*?```json\s*([\s\S]*?)```/g)];
      let updCount=0;
      if(allMatches.length>0){
        allMatches.forEach(match=>{
          const zona=match[1].trim(),planId=match[2].trim();
          const ak=`${zona}||${planId}`;
          try{
            const jsonData=JSON.parse(match[3].trim());
            const res=results.find(r=>r.adjKey===ak);
            if(!res)return;
            const basePricesForPlan=precios?.[zona]?.[res.planId]||{};
            const pct059=typeof jsonData.pct059==="number"?jsonData.pct059:0;
            const pct60=typeof jsonData.pct60==="number"?jsonData.pct60:0;
            // Aplicar porcentaje exacto sobre precios base (no sobre precios ya ajustados)
            const u={};
            CAT_IDS.forEach(id=>{
              const base=basePricesForPlan[id]||0;
              const pct=id==="s60plus"?pct60:pct059;
              u[id]=Math.round(base*(1+pct)*100)/100;
            });
            setAdjPrices(prev=>({...prev,[ak]:u}));
            setAdjPct(prev=>({...prev,[ak]:{modo:"rango059",pct059,pct60}}));
            updCount++;
          }catch(e){console.error("JSON parse error",e);}
        });
      }
      const expl=full.replace(/```json[\s\S]*?```/g,"").replace(/ZONA:\s*\S+/g,"").replace(/PLAN:\s*\S+/g,"").trim()||"✓ Precios actualizados";
      if(updCount>0){
        setAiLog(prev=>[...prev,{ts:new Date().toLocaleTimeString("es-AR"),pedido:m,resultado:expl,planes:allMatches.map(x=>x[2]).join(", ")}]);
      }
      setChat([...hist,{role:"assistant",content:expl,upd:updCount>0}]);
    }catch(err){setChat([...hist,{role:"assistant",content:"Error: "+err.message}]);}
    setCL(false);
  }

  function guardar(status){
    // Guardar snapshot completo incluyendo precios ajustados y log de IA
    const snapshot=results.map(r=>({
      zona:r.zona,planId:r.cotId,socios:r.bd.totalSocios,
      fac:r.bd.totalFac,costo:r.bd.totalCosto,cf:r.bd.cfTotal,
      precios:Object.fromEntries(CAT_IDS.map(id=>[id,r.bd.rows.find(x=>x.id===id)?.precio||0])),
    }));
    onSaveQuote({
      id:Date.now().toString(),empresa:empresa.trim()||"Sin nombre",status,
      fecha:new Date().toISOString(),
      // En simulación con varios planes no hay un total único: se guardan los totales por plan
      ...(multiSim
        ?{total:null,totalFac:null,totalCosto:null,cfTotal:null,
          simulaciones:simTotals.map(({cotId,fac,costo,cf})=>({planId:cotId,fac,costo,cf}))}
        :{total:grandFac,totalFac:grandFac,totalCosto:grandCosto,cfTotal:grandCF}),
      modo,socios:emps?.length||0,bandaPrecios:bandaUsada||null,
      adjPrices:{...adjPrices},adjCostos:{...adjCostos},
      aiLog:[...aiLog],snapshot,
    });
    setSaveMsg(status==="cerrado"?"✓ Guardado como cerrado":"✓ Guardado como abierto");
    setTimeout(()=>setSaveMsg(""),2500);
  }

  const stepN=sub===1?1:sub==="mapeo"?2:sub===3?3:4;
  const sDef=[{n:1,l:"Nómina"},{n:2,l:isSim?"Planes":"Mapeo"},{n:3,l:"Planilla"},{n:4,l:"Salidas"}];

  return(<div>
    {dupWarning&&<DuplicadosModal items={dupWarning.items} onResolve={resolveDuplicados}/>}

    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:"2rem"}}>
      {sDef.map((s,i)=>(<Fragment key={s.n}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,fontFamily:FONT,background:stepN>=s.n?BLUE:"#E5E7EB",color:stepN>=s.n?"#fff":"#9CA3AF"}}>{s.n}</span>
          <span style={{fontSize:13,fontFamily:FONT,color:stepN===s.n?BLUE:"#9CA3AF",fontWeight:stepN===s.n?700:400}}>{s.l}</span>
        </div>
        {i<sDef.length-1&&<span style={{color:"#D1D5DB",fontSize:16,margin:"0 4px"}}>›</span>}
      </Fragment>))}
    </div>

    {/* STEP 1 */}
    {sub===1&&(<div style={{textAlign:"left"}}>
      <div style={{...card(),marginBottom:"1.5rem",padding:"14px 16px"}}>
        <p style={{fontSize:11,fontWeight:600,color:"#374151",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.04em",fontFamily:FONT}}>Tipo de propuesta</p>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {[{v:"equivalencia",l:"Equivalencias",d:"Cada plan vigente de la nómina se cotiza con su plan Omint equivalente."},
            {v:"simulacion",l:"Simulación de planes",d:"Toda la nómina se cotiza en uno o varios planes Omint, como alternativas."}].map(o=>{
            const sel=modo===o.v;
            return(<button key={o.v} onClick={()=>setModo(o.v)} style={{flex:"1 1 240px",textAlign:"left",padding:"10px 14px",borderRadius:10,cursor:"pointer",fontFamily:FONT,
              border:`1.5px solid ${sel?BLUE:BORDER}`,background:sel?BLUE_LT:"#fff"}}>
              <span style={{display:"block",fontSize:13,fontWeight:700,color:sel?BLUE:"#374151",marginBottom:2}}>{sel?"● ":"○ "}{o.l}</span>
              <span style={{display:"block",fontSize:12,color:"#6B7280",lineHeight:1.4}}>{o.d}</span>
            </button>);
          })}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1.25rem"}}>
        <div><h3 style={{fontSize:16,fontWeight:700,color:BLUE,marginBottom:4,fontFamily:FONT}}>Cargar nómina</h3><p style={{fontSize:13,color:"#6B7280",fontFamily:FONT}}>Subí el Excel con el formato del template. Las columnas se detectan automáticamente.</p></div>
        <button onClick={downloadTemplate} style={{...btnS,fontSize:12}}>↓ Template</button>
      </div>
      {!emps?(<div>
        <label style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12,padding:"3rem",border:`2px dashed ${BLUE}`,borderRadius:12,cursor:"pointer",background:BLUE_LT}}>
          <div style={{width:56,height:56,borderRadius:12,background:BLUE,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>📂</div>
          <div style={{textAlign:"center"}}>
            <p style={{fontSize:15,fontWeight:600,color:BLUE,marginBottom:4,fontFamily:FONT}}>Subir Excel o CSV</p>
            <p style={{fontSize:12,color:"#6B7280",fontFamily:FONT}}>.xlsx · .xls · .csv</p>
          </div>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{display:"none"}}/>
        </label>
        <div style={{marginTop:"1rem",padding:"12px 16px",background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:10}}>
          <p style={{fontSize:12,fontWeight:600,color:"#166534",marginBottom:6,fontFamily:FONT}}>📋 Formato esperado — una fila por miembro:</p>
          <div style={{overflowX:"auto"}}>
            <table style={{borderCollapse:"collapse",fontSize:11,fontFamily:FONT,background:"#fff",borderRadius:6,overflow:"hidden"}}>
              <thead><tr style={{background:"#166534",color:"#fff"}}>
                {["Grupo Familiar","Fecha de Nacimiento","Edad","Nombre","Tipo benef","Plan de contratación","Zona (opcional)","Costo actual (opcional)"].map(h=><th key={h} style={{padding:"5px 10px",fontWeight:600,whiteSpace:"nowrap"}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {[["1","08.12.1961","64","García Juan","Titular","4500_PYME","AMBA","1.250.000"],
                  ["1","01.03.1965","61","García Ana","Conyuge","4500_PYME","AMBA",""],
                  ["1","18.12.2014","","García Lucas","Hijo","4500_PYME","AMBA",""],
                  ["2","05.09.1960","65","López Pedro","Titular","6500_PYME","",""],
                ].map((row,i)=><tr key={i} style={{background:i%2===0?"#F0FDF4":"#fff"}}>
                  {row.map((v,j)=><td key={j} style={{padding:"4px 10px",color:"#374151"}}>{v}</td>)}
                </tr>)}
              </tbody>
            </table>
          </div>
          <p style={{fontSize:11,color:"#374151",marginTop:8,fontFamily:FONT}}>
            Tipo benef acepta: <strong>Titular</strong>, <strong>Conyuge</strong>, <strong>Hijo</strong>. 
            Si Edad está vacía se calcula desde Fecha de Nacimiento. 
            Zona es opcional (si no está, se elige globalmente).
            Costo actual es opcional: lo que paga hoy el grupo familiar (en la fila del titular); se usa en la nómina valorizada.
          </p>
        </div>
      </div>):(<div>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",background:"#D1FAE5",borderRadius:8,marginBottom:"1.25rem",border:"1px solid #A7F3D0"}}>
          <span>✅</span><span style={{fontSize:13,color:"#065F46",fontWeight:600,fontFamily:FONT}}>{emps.length} empleados cargados</span>
          <button onClick={()=>{setEmps(null);setMap({titAge:"",spAge:"",ku:"",k25:"",name:"",planCol:"",zonaCol:""});setPlanMapping({});setNomErrors([]);}} style={{marginLeft:"auto",border:"none",background:"none",fontSize:12,cursor:"pointer",color:"#9CA3AF",fontFamily:FONT}}>✕ Cambiar</button>
        </div>
      </div>)}

      {/* Zona buttons — always visible in step 1 */}
      <div style={{padding:"12px 16px",background:BLUE_LT,borderRadius:8,marginBottom:"1rem",border:`1px solid ${BORDER}`,marginTop:"0.75rem"}}>
        <p style={{fontSize:12,color:BLUE,fontWeight:600,marginBottom:8,fontFamily:FONT}}>Forzar zona (opcional):</p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{ZONA_IDS.map(z=>{const zc2=ZONA_COLORS[z];const sel=forcedZona===z;return(<button key={z} onClick={()=>setForcedZona(sel?null:z)} style={{padding:"6px 14px",fontSize:13,fontFamily:FONT,borderRadius:8,cursor:"pointer",fontWeight:sel?700:400,background:sel?zc2.c:"#fff",color:sel?"#fff":zc2.c,border:`1.5px solid ${zc2.c}`}}>{z}</button>);})}</div>
        {forcedZona?<p style={{fontSize:11,color:BLUE,marginTop:6,fontFamily:FONT}}>Zona forzada: <strong>{forcedZona}</strong> (sobreescribe la columna del template)</p>:<p style={{fontSize:11,color:"#6B7280",marginTop:6,fontFamily:FONT}}>Sin forzar — se usará la columna de zona del template, o AMBA por defecto.</p>}
      </div>
      {/* Alertas de nómina */}
      {nomErrors.length>0&&<div style={{marginTop:"1rem",display:"flex",flexDirection:"column",gap:6}}>
        {nomErrors.map((e,i)=>{
          const isErr=e.tipo==="error";
          return(<div key={i} style={{padding:"12px 16px",borderRadius:10,fontSize:13,fontFamily:FONT,fontWeight:isErr?600:400,
            background:isErr?"#FEF2F2":e.tipo==="warning"?"#FEF3C7":"#EFF6FF",
            color:isErr?"#DC2626":e.tipo==="warning"?"#92400E":"#1D4ED8",
            border:`1.5px solid ${isErr?"#FECACA":e.tipo==="warning"?"#FDE68A":"#BFDBFE"}`,
            display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:isErr?20:14}}>{isErr?"❌":e.tipo==="warning"?"⚠️":"✅"}</span>
            <span>{isErr?<><strong>Error:</strong> {e.msg}</>:e.msg}</span>
          </div>);
        })}
      </div>}

      {spouseWarning&&(<div style={{marginTop:"1rem",padding:"12px 16px",borderRadius:10,fontSize:13,fontFamily:FONT,background:"#FEF3C7",color:"#92400E",border:"1.5px solid #FDE68A"}}>
        <p style={{fontWeight:600,marginBottom:4}}><span style={{fontSize:16,marginRight:6}}>⚠️</span>Se encontraron {spouseWarning.count} grupos familiares con más de 1 cónyuge. Se tomó el primero en cada caso.</p>
        <p style={{fontSize:12}}>Familias afectadas: {spouseWarning.familias.join(", ")}</p>
      </div>)}

      {emps&&map.titAge&&map.ku&&<NominaResumen emps={emps} map={map} getEmpZona={getEmpZona} isSim={isSim} banda={banda}/>}

      {emps&&map.titAge&&map.ku&&(<button onClick={()=>pasoPlanes?setSub("mapeo"):setSub(3)} style={{...btnP,marginTop:"1.5rem"}}>{isSim?"Continuar: elegir planes →":needsMapeo?"Continuar: mapear planes →":"Continuar →"}</button>)}
    </div>)}

    {/* STEP 2 (SIMULACIÓN): ELEGIR PLANES */}
    {sub==="mapeo"&&isSim&&(<div style={{textAlign:"left"}}>
      <h3 style={{fontSize:16,fontWeight:700,color:BLUE,marginBottom:4,fontFamily:FONT}}>Planes a simular</h3>
      <p style={{fontSize:13,color:"#6B7280",marginBottom:"1.5rem",fontFamily:FONT}}>Elegí uno o varios planes Omint. Cada plan se cotiza con toda la nómina ({emps?.length||0} familias); el plan vigente de cada empleado no se tiene en cuenta.</p>
      <div style={card()}>
        {allOmintPlans.length===0
          ?<p style={{fontSize:13,color:"#9CA3AF",fontFamily:FONT}}>No hay planes Omint cargados. Cargalos en "Importar datos" o "Precios Vigentes".</p>
          :(<div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {opcionesCot.map(id=>{
              const sel=planesSim.includes(id);
              const base=resolverCot(id).planId;
              const zonasConPrecio=ZONA_IDS.filter(z=>precios?.[z]?.[base]);
              return(<label key={id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:8,cursor:"pointer",fontFamily:FONT,fontSize:13,
                border:`1.5px solid ${sel?BLUE:BORDER}`,background:sel?BLUE_LT:"#fff",color:sel?BLUE:"#374151",fontWeight:sel?700:500}}>
                <input type="checkbox" checked={sel} onChange={()=>setPlanesSim(prev=>sel?prev.filter(p=>p!==id):[...prev,id])}/>
                {id}
                <span style={{fontSize:10,color:"#9CA3AF",fontWeight:400}}>{zonasConPrecio.join(" · ")}</span>
              </label>);
            })}
          </div>)}
      </div>
      {/* DUPLICAR PLAN */}
      <div style={{...card(),marginTop:"1rem"}}>
        <p style={{fontSize:13,fontWeight:600,color:BLUE,marginBottom:4,fontFamily:FONT}}>Duplicar plan</p>
        <p style={{fontSize:12,color:"#6B7280",marginBottom:10,fontFamily:FONT}}>Para cotizar el mismo plan dos veces (ej. 8500_PYME y 8500_PYME con Farmacia 60%). La copia es un plan aparte: abajo le ponés el nombre que va en la propuesta y en la planilla le elegís mejoras y ajustes.</p>
        {variantes.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10}}>
          {variantes.map(v=><span key={v.id} style={{...badge(BLUE,BLUE_LT),fontSize:12,display:"inline-flex",alignItems:"center",gap:6}}>
            {v.id}<button onClick={()=>quitarVariante(v.id)} title="Quitar copia" style={{border:"none",background:"none",cursor:"pointer",color:"#9CA3AF",fontSize:12}}>✕</button>
          </span>)}
        </div>}
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <select value={planADuplicar} onChange={e=>setPlanADuplicar(e.target.value)} style={{...inp,width:200}}>
            <option value="">Elegí un plan…</option>
            {allOmintPlans.map(id=><option key={id} value={id}>{id}</option>)}
          </select>
          <button onClick={()=>duplicarPlan(planADuplicar)} disabled={!planADuplicar} style={{...btnS,fontSize:12,opacity:planADuplicar?1:0.5}}>⧉ Duplicar</button>
        </div>
      </div>
      <PlanesPropuesta grupos={gruposPaso2} isSim={isSim} osde={osde} planCustomNames={planCustomNames} setPlanCustomNames={setPlanCustomNames} planMappingOsde={planMappingOsde} setPlanMappingOsde={setPlanMappingOsde}/>
      <div style={{display:"flex",gap:10,marginTop:"1.5rem"}}>
        <button onClick={()=>setSub(1)} style={btnS}>← Volver</button>
        <button onClick={()=>setSub(3)} disabled={planesSim.length===0} style={{...btnP,opacity:planesSim.length===0?0.5:1,cursor:planesSim.length===0?"not-allowed":"pointer"}}>Continuar →</button>
      </div>
    </div>)}

    {/* STEP 2: MAPEO */}
    {sub==="mapeo"&&!isSim&&(<div style={{textAlign:"left"}}>
      <h3 style={{fontSize:16,fontWeight:700,color:BLUE,marginBottom:4,fontFamily:FONT}}>Mapeo de planes</h3>
      <p style={{fontSize:13,color:"#6B7280",marginBottom:"1.5rem",fontFamily:FONT}}>Asigná cada plan externo al plan Omint equivalente.</p>
      <div style={card()}>
        <div style={{overflowX:"auto"}}>
          <table style={{borderCollapse:"collapse",fontSize:13,width:"100%",minWidth:460}}>
            <thead><tr><th style={TH({textAlign:"left"})}>Plan en la nómina</th><th style={TH({textAlign:"right"})}>Empleados</th><th style={TH({textAlign:"left"})}>Mapear a plan Omint</th></tr></thead>
            <tbody>{externalPlans.map(ext=>{
              const count=emps.filter(e=>e[map.planCol]===ext).length,alreadyOmint=isOmintPlan(ext);
              return(<tr key={ext}>
                <td style={TD({fontWeight:500})}>{ext}{alreadyOmint&&<span style={{...badge(BLUE,BLUE_LT),marginLeft:8,fontSize:10}}>Omint</span>}</td>
                <td style={TD({textAlign:"right",color:"#6B7280"})}>{count}</td>
                <td style={TD()}>
                  <select value={planMapping[ext]||(alreadyOmint?ext:"")} onChange={e=>setPlanMapping(p=>({...p,[ext]:e.target.value}))} style={{...inp,width:230}}>
                    {!alreadyOmint&&<option value="">No cotizar</option>}
                    {opcionesCot.map(id=><option key={id} value={id}>{id}</option>)}
                  </select>
                </td>
              </tr>);
            })}</tbody>
          </table>
        </div>
      </div>
      {/* DUPLICAR PLAN */}
      <div style={{...card(),marginTop:"1rem"}}>
        <p style={{fontSize:13,fontWeight:600,color:BLUE,marginBottom:4,fontFamily:FONT}}>Duplicar plan</p>
        <p style={{fontSize:12,color:"#6B7280",marginBottom:10,fontFamily:FONT}}>Para cotizar el mismo plan dos veces (ej. 8500_PYME y 8500_PYME con Farmacia 60%). La copia es un plan aparte: abajo le ponés el nombre que va en la propuesta y en la planilla le elegís mejoras y ajustes.</p>
        {variantes.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10}}>
          {variantes.map(v=><span key={v.id} style={{...badge(BLUE,BLUE_LT),fontSize:12,display:"inline-flex",alignItems:"center",gap:6}}>
            {v.id}<button onClick={()=>quitarVariante(v.id)} title="Quitar copia" style={{border:"none",background:"none",cursor:"pointer",color:"#9CA3AF",fontSize:12}}>✕</button>
          </span>)}
        </div>}
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <select value={planADuplicar} onChange={e=>setPlanADuplicar(e.target.value)} style={{...inp,width:200}}>
            <option value="">Elegí un plan…</option>
            {allOmintPlans.map(id=><option key={id} value={id}>{id}</option>)}
          </select>
          <button onClick={()=>duplicarPlan(planADuplicar)} disabled={!planADuplicar} style={{...btnS,fontSize:12,opacity:planADuplicar?1:0.5}}>⧉ Duplicar</button>
        </div>
      </div>
      <PlanesPropuesta grupos={gruposPaso2} isSim={isSim} osde={osde} planCustomNames={planCustomNames} setPlanCustomNames={setPlanCustomNames} planMappingOsde={planMappingOsde} setPlanMappingOsde={setPlanMappingOsde}/>
      <div style={{display:"flex",gap:10,marginTop:"1.5rem"}}>
        <button onClick={()=>setSub(1)} style={btnS}>← Volver</button>
        <button onClick={()=>setSub(3)} style={btnP}>Continuar →</button>
      </div>
    </div>)}

    {/* STEP 3: PLANILLA DE COTIZACIÓN */}
    {sub===3&&<Planilla banda={banda}
      results={results} isSim={isSim} multiSim={multiSim} simTotals={simTotals} emps={emps}
      grandFac={grandFac} grandCosto={grandCosto} grandCF={grandCF} inversions={inversions}
      precios={precios} mejoras={mejoras} osde={osde}
      adjPct={adjPct} adjPrices={adjPrices} adjCostos={adjCostos} setAdjCostos={setAdjCostos}
      aplicarAjuste={aplicarAjuste} setPrecioManual={setPrecioManual}
      setPlanMejoras={setPlanMejoras}
      planCustomNames={planCustomNames}
      brokerPct={brokerPct} setBrokerPct={setBrokerPct}
      planMappingOsde={planMappingOsde}
      empresa={empresa} setEmpresa={setEmpresa} knownEmpresas={knownEmpresas}
      chat={chat} chatIn={chatIn} setChatIn={setChatIn} chatLoading={chatLoading} sendChat={sendChat}
      aiLog={aiLog} setAiLog={setAiLog}
      scenarios={scenarios} setScenarios={setScenarios} setAdjPrices={setAdjPrices} setAdjPct={setAdjPct}
      guardar={guardar} saveMsg={saveMsg} onExportar={()=>setSub("salidas")} onVolver={()=>setSub(pasoPlanes?"mapeo":1)}
    />}

    {/* STEP 4: SALIDAS */}
    {sub==="salidas"&&<Salidas results={results} empresa={empresa} setEmpresa={setEmpresa} cfg={salidaCfg} setCfg={setSalidaCfg}
      emps={emps} brokerPct={brokerPct} osde={osde} planMappingOsde={planMappingOsde} planMejoras={planMejoras} mejoras={mejoras||{}}
      planCustomNames={planCustomNames} setPlanCustomNames={setPlanCustomNames} adjPct={adjPct} listas={{precios,costos}}
      guardar={guardar} saveMsg={saveMsg} onVolver={()=>setSub(3)}/>}
  </div>);
}


export default Cotizador;
