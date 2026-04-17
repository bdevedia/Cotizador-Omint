import { useState, useRef, useEffect, Fragment } from "react";
import * as XLSX from "xlsx-js-style";
import { FONT, BLUE, BLUE_LT, BORDER, GRAY,
  CATS, CAT_IDS, EMPTY_CATS,
  ZONA_IDS, ZONA_COLORS,
  OSDE_CATS, EMPTY_OSDE, MEJORAS_DEF } from "../constants";
import { catAge, cfColor, cfBg, cfLabel, fmt, fmtD, exJSON, stripJ, planTier } from "../utils";
import { badge, btnP, btnS, inp, numInp, card, TH, TD } from "../styles";
import { parseNominaFija, downloadTemplate } from "../parsers";
import { calcBD, calcOsdeFromEmps, checkPriceInversions } from "../calc";
import ExportModal from "./ExportModal";

// ── COTIZADOR ─────────────────────────────────────────────────────────────────
function Cotizador({precios,costos,osde,mejoras,onSaveQuote,knownEmpresas,apiKey}){
  const [sub,setSub]=useState(1);
  const [emps,setEmps]=useState(null);
  const [cols,setCols]=useState([]);
  const [map,setMap]=useState({titAge:"",spAge:"",ku:"",k25:"",name:"",planCol:"",zonaCol:""});
  const [globalZona,setGlobalZona]=useState("AMBA");
  const [forcedZona,setForcedZona]=useState(null);
  const [planMapping,setPlanMapping]=useState({});
  const [adjPrices,setAdjPrices]=useState({});
  const [adjCostos,setAdjCostos]=useState({});
  const [empresa,setEmpresa]=useState("");
  const [showSug,setShowSug]=useState(false);
  const [showExport,setShowExport]=useState(false);
  const [chat,setChat]=useState([]);
  const [chatIn,setChatIn]=useState("");
  const [chatLoading,setCL]=useState(false);
  const [saveMsg,setSaveMsg]=useState("");
  const [aiLog,setAiLog]=useState([]); // log de cambios de IA
  const [scenarios,setScenarios]=useState({}); // {name: {adjPrices, adjCostos}}
  const [showScenarios,setShowScenarios]=useState(false);
  const [nomErrors,setNomErrors]=useState([]); // validación de nómina
  const [spouseWarning,setSpouseWarning]=useState(null); // advertencia cónyuges múltiples
  const [brokerPct,setBrokerPct]=useState(""); // comisión del broker (%)
  const [compareOsde,setCompareOsde]=useState(false);
  const [planMappingOsde,setPlanMappingOsde]=useState({});
  const [planMejoras,setPlanMejoras]=useState({});
  const [planCustomNames,setPlanCustomNames]=useState({});
  const chatEnd=useRef(null);
  useEffect(()=>{chatEnd.current?.scrollIntoView({behavior:"smooth"});},[chat]);

  const isOmintPlan=p=>Object.values(precios||{}).some(z=>z[p]);
  const externalPlans=emps&&map.planCol?[...new Set(emps.map(e=>e[map.planCol]).filter(Boolean))]:[];
  const hasZonaCol=map.zonaCol&&map.zonaCol!=="";
  const needsMapeo=externalPlans.some(p=>!isOmintPlan(p));

  function getEmpZona(e){
    if(forcedZona) return forcedZona;
    const col=map.zonaCol;
    if(col&&e[col]&&e[col].toString().trim()){const z=e[col].toString().trim();return ZONA_IDS.find(zi=>zi.toLowerCase()===z.toLowerCase())||"AMBA";}
    return "AMBA";
  }
  function getEmpPlan(e){
    if(!map.planCol||!e[map.planCol])return null;
    const ext=e[map.planCol];return isOmintPlan(ext)?ext:(planMapping[ext]||null);
  }

  function buildGroups(){
    if(!emps||!map.titAge||!map.ku)return[];
    const gmap={};
    emps.forEach(e=>{
      const zona=getEmpZona(e),planId=getEmpPlan(e);if(!planId)return;
      const key=`${zona}||${planId}`;
      if(!gmap[key])gmap[key]={zona,planId,empList:[]};
      gmap[key].empList.push(e);
    });
    return Object.values(gmap).sort((a,b)=>a.zona.localeCompare(b.zona)||planTier(a.planId)-planTier(b.planId));
  }

  function buildResults(){
    const brokerMult=1+(parseFloat(brokerPct)||0)/100;
    return buildGroups().map(({zona,planId,empList})=>{
      const adjKey=`${zona}||${planId}`;
      const basePrices=precios?.[zona]?.[planId]||{};
      const adjP=adjPrices[adjKey]||{};
      const effPrices=Object.fromEntries(CAT_IDS.map(c=>[c,adjP[c]!==undefined?adjP[c]:basePrices[c]||0]));
      const baseCostos=costos?.[planId]||{};
      const adjC=adjCostos[adjKey]||{};
      const mejSel=planMejoras[adjKey]||{};
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
      const mapping=map.planCol?externalPlans.filter(p=>(planMapping[p]===planId)&&!isOmintPlan(p)).map(p=>({from:p,to:planId})):[];
      return{zona,planId,empList,bd,mapping,adjKey,hasAdjP:Object.keys(adjP).length>0,hasAdjC:Object.keys(adjC).length>0};
    });
  }

  const results=sub===3?buildResults():[];
  const grandFac=results.reduce((a,r)=>a+r.bd.totalFac,0);
  const grandCosto=results.reduce((a,r)=>a+r.bd.totalCosto,0);
  const grandCF=grandFac>0?grandCosto/grandFac*100:0;
  const inversions=sub===3?checkPriceInversions(results):[];

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
        setEmps(result.rows);
        setCols(Object.keys(result.rows[0]));
        setMap({titAge:"EDAD_TITULAR",spAge:"EDAD_CONYUGE",ku:"HIJOS_MENORES_25",k25:"HIJOS_MAYORES_25",name:"NOMBRE",planCol:"PLAN_ACTUAL",zonaCol:"ZONA"});
        const info=`✓ ${result.rows.length} familias cargadas (${result.totalRaw} filas procesadas${result.filasIgnoradas>0?`, ${result.filasIgnoradas} ignoradas`:""})`;
        setNomErrors([{tipo:"info",msg:info}]);
        if(result.conyugesMultiples&&result.conyugesMultiples.length>0){
          setSpouseWarning({count:result.conyugesMultiples.length,familias:result.conyugesMultiples.map(x=>x.familia)});
        }else{setSpouseWarning(null);}
      }catch(err){
        setNomErrors([{tipo:"error",msg:"Error al leer el archivo. Revisá el template."}]);
      }
    };
    r.readAsBinaryString(f);
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
      return`${r.zona}/${r.planId}: ${cats} | C/F=${r.bd.cfTotal.toFixed(1)}%`;
    }).join("\n");

    const sys=`Sos un motor de ajuste de precios para cotizaciones de medicina prepaga Omint.

INSTRUCCIONES CRÍTICAS:
1. Los precios que ves abajo son los precios ACTUALES de esta cotización. Calculá SIEMPRE desde estos valores.
2. "subir X%" = precio_actual * (1 + X/100). "bajar X%" = precio_actual * (1 - X/100).
3. Si modificás solo algunas categorías, las demás deben quedar con su precio actual SIN CAMBIOS.
4. Nunca pongas 0 en ninguna categoría a menos que el usuario lo pida explícitamente.
5. Respondé con un bloque por cada plan modificado. Sin explicaciones largas.

CATEGORÍAS: s0_25=Socio 0-25, s26_34=Socio 26-35, s35_54=Socio 36-54, s55_59=Socio 55-59, s60plus=Socio 60+, h1=Hijo 1, h2plus=Hijo 2+

FORMATO DE RESPUESTA (repetir por cada plan):
Confirmación breve.
ZONA: [zona exacta]
PLAN: [plan exacto]
\`\`\`json
{"s0_25":VALOR,"s26_34":VALOR,"s35_54":VALOR,"s55_59":VALOR,"s60plus":VALOR,"h1":VALOR,"h2plus":VALOR}
\`\`\`

PRECIOS ACTUALES DE ESTA COTIZACIÓN (usá estos como base para cualquier cálculo):
${preciosActuales}
TOTAL: fac=$${fmt(grandFac)}, C/F=${grandCF.toFixed(1)}% (≤70% excelente, 70-82% aceptable, >82% alto)
Planes disponibles: ${[...new Set(results.map(r=>r.planId))].join(", ")}
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
            const currentRows=results.find(r=>r.adjKey===ak)?.bd.rows||[];
            const u={};
            CAT_IDS.forEach(id=>{
              const aiVal=jsonData[id];
              const curPrecio=currentRows.find(r=>r.id===id)?.precio||0;
              // Solo usar valor de la IA si es un número positivo válido
              if(aiVal!==undefined&&aiVal!==null&&typeof aiVal==="number"&&aiVal>0){
                u[id]=Math.round(aiVal);
              } else {
                u[id]=Math.round(curPrecio);
              }
            });
            setAdjPrices(prev=>({...prev,[ak]:u}));
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
      zona:r.zona,planId:r.planId,socios:r.bd.totalSocios,
      fac:r.bd.totalFac,costo:r.bd.totalCosto,cf:r.bd.cfTotal,
      precios:Object.fromEntries(CAT_IDS.map(id=>[id,r.bd.rows.find(x=>x.id===id)?.precio||0])),
    }));
    onSaveQuote({
      id:Date.now().toString(),empresa:empresa.trim()||"Sin nombre",status,
      fecha:new Date().toISOString(),total:grandFac,totalFac:grandFac,
      totalCosto:grandCosto,cfTotal:grandCF,socios:emps?.length||0,
      adjPrices:{...adjPrices},adjCostos:{...adjCostos},
      aiLog:[...aiLog],snapshot,
    });
    setSaveMsg(status==="cerrado"?"✓ Guardado como cerrado":"✓ Guardado como abierto");
    setTimeout(()=>setSaveMsg(""),2500);
  }

  const stepN=sub===1?1:sub==="mapeo"?2:sub==="comision"?3:4;
  const sDef=[{n:1,l:"Nómina"},{n:2,l:"Mapeo"},{n:3,l:"Comisión"},{n:4,l:"Cotización"}];

  return(<div>
    {showExport&&<ExportModal results={results} empresa={empresa} empsRef={emps} onClose={()=>setShowExport(false)} brokerPct={brokerPct} osde={osde} planMappingOsde={planMappingOsde} planMejoras={planMejoras} mejoras={mejoras||{}} planCustomNames={planCustomNames}/>}

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
    {sub===1&&(<div>
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
                {["Grupo Familiar","Fecha de Nacimiento","Edad","Nombre","Tipo benef","Plan de contratación","Zona (opcional)"].map(h=><th key={h} style={{padding:"5px 10px",fontWeight:600,whiteSpace:"nowrap"}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {[["1","08.12.1961","64","García Juan","Titular","4500_PYME","AMBA"],
                  ["1","01.03.1965","61","García Ana","Conyuge","4500_PYME","AMBA"],
                  ["1","18.12.2014","","García Lucas","Hijo","4500_PYME","AMBA"],
                  ["2","05.09.1960","65","López Pedro","Titular","6500_PYME",""],
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
          </p>
        </div>
      </div>):(<div>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",background:"#D1FAE5",borderRadius:8,marginBottom:"1.25rem",border:"1px solid #A7F3D0"}}>
          <span>✅</span><span style={{fontSize:13,color:"#065F46",fontWeight:600,fontFamily:FONT}}>{emps.length} empleados cargados</span>
          <button onClick={()=>{setEmps(null);setCols([]);setMap({titAge:"",spAge:"",ku:"",k25:"",name:"",planCol:"",zonaCol:""});setPlanMapping({});setNomErrors([]);}} style={{marginLeft:"auto",border:"none",background:"none",fontSize:12,cursor:"pointer",color:"#9CA3AF",fontFamily:FONT}}>✕ Cambiar</button>
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

      {emps&&map.titAge&&map.ku&&(<button onClick={()=>needsMapeo?setSub("mapeo"):setSub("comision")} style={{...btnP,marginTop:"1.5rem"}}>{needsMapeo?"Continuar: mapear planes →":"Continuar →"}</button>)}
    </div>)}

    {/* STEP 2: MAPEO */}
    {sub==="mapeo"&&(<div>
      <h3 style={{fontSize:16,fontWeight:700,color:BLUE,marginBottom:4,fontFamily:FONT}}>Mapeo de planes</h3>
      <p style={{fontSize:13,color:"#6B7280",marginBottom:"1.5rem",fontFamily:FONT}}>Asigná cada plan externo al plan Omint equivalente.</p>
      <div style={card()}>
        <div style={{overflowX:"auto"}}>
          <table style={{borderCollapse:"collapse",fontSize:13,width:"100%",minWidth:460}}>
            <thead><tr><th style={TH({textAlign:"left"})}>Plan en la nómina</th><th style={TH({textAlign:"right"})}>Empleados</th><th style={TH({textAlign:"left"})}>Mapear a plan Omint</th></tr></thead>
            <tbody>{externalPlans.map(ext=>{
              const count=emps.filter(e=>e[map.planCol]===ext).length,alreadyOmint=isOmintPlan(ext);
              const allOmintPlans=[...new Set(ZONA_IDS.flatMap(z=>Object.keys(precios?.[z]||{})))].sort();
              return(<tr key={ext}>
                <td style={TD({fontWeight:500})}>{ext}{alreadyOmint&&<span style={{...badge(BLUE,BLUE_LT),marginLeft:8,fontSize:10}}>Omint</span>}</td>
                <td style={TD({textAlign:"right",color:"#6B7280"})}>{count}</td>
                <td style={TD()}>{alreadyOmint?<span style={{fontSize:12,color:"#6B7280",fontFamily:FONT}}>→ {ext}</span>:(
                  <select value={planMapping[ext]||""} onChange={e=>setPlanMapping(p=>({...p,[ext]:e.target.value}))} style={{...inp,width:180}}>
                    <option value="">No cotizar</option>
                    {allOmintPlans.map(id=><option key={id} value={id}>{id}</option>)}
                  </select>
                )}</td>
              </tr>);
            })}</tbody>
          </table>
        </div>
      </div>
      <div style={{display:"flex",gap:10,marginTop:"1.5rem"}}>
        <button onClick={()=>setSub(1)} style={btnS}>← Volver</button>
        <button onClick={()=>setSub("comision")} style={btnP}>Continuar →</button>
      </div>
    </div>)}

    {/* STEP: COMISIÓN BROKER */}
    {sub==="comision"&&(<div>
      <h3 style={{fontSize:16,fontWeight:700,color:BLUE,marginBottom:4,fontFamily:FONT}}>¿Hay comisión del broker?</h3>
      <p style={{fontSize:13,color:"#6B7280",marginBottom:"1.5rem",fontFamily:FONT}}>Si el broker cobra una comisión mensual, ingresá el porcentaje. Se sumará al costo de todos los planes en el análisis interno.</p>
      <div style={card()}>
        <label style={{fontSize:11,fontWeight:600,color:"#374151",display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.04em",fontFamily:FONT}}>Comisión del broker (%)</label>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <input type="number" value={brokerPct} onChange={e=>setBrokerPct(e.target.value)} placeholder="Ej: 4" min="0" max="100" style={{...inp,maxWidth:140,textAlign:"right"}}/>
          <span style={{fontSize:13,color:"#374151",fontFamily:FONT}}>%</span>
        </div>
        <p style={{fontSize:12,color:"#6B7280",marginTop:8,fontFamily:FONT}}>Dejá vacío o en 0 si no hay comisión.</p>
      </div>
      <div style={{display:"flex",gap:10,marginTop:"1.5rem"}}>
        <button onClick={()=>setSub(needsMapeo?"mapeo":1)} style={btnS}>← Anterior</button>
        <button onClick={()=>setSub(3)} style={btnP}>Ver cotización →</button>
      </div>
    </div>)}

    {/* STEP 3: COTIZACIÓN */}
    {sub===3&&(<div>
      {/* ALERTA INVERSIÓN DE PRECIOS */}
      {inversions.length>0&&(
        <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,padding:"14px 18px",marginBottom:"1.25rem"}}>
          <p style={{fontSize:13,fontWeight:700,color:"#DC2626",marginBottom:8,fontFamily:FONT}}>⚠️ Problema de precios detectado</p>
          <p style={{fontSize:12,color:"#991B1B",marginBottom:8,fontFamily:FONT}}>Los siguientes precios están invertidos: un plan de mayor categoría tiene precio menor que uno de categoría inferior.</p>
          {inversions.map((v,i)=>(
            <p key={i} style={{fontSize:12,color:"#7F1D1D",fontFamily:FONT,marginBottom:4}}>
              • <strong>{v.zona}</strong> · {v.cat}: <strong>{v.plan1}</strong> (${fmt(v.price1)}) &gt; <strong>{v.plan2}</strong> (${fmt(v.price2)}) — el plan {v.plan2} debería ser más caro que {v.plan1}.
            </p>
          ))}
        </div>
      )}

      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:"1.25rem",flexWrap:"wrap"}}>
        <div style={{flex:"1 1 200px",minWidth:160,position:"relative"}}>
          <label style={{fontSize:11,fontWeight:600,color:"#374151",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.04em",fontFamily:FONT}}>Empresa</label>
          <input value={empresa} onChange={e=>{setEmpresa(e.target.value);setShowSug(true);}} onBlur={()=>setTimeout(()=>setShowSug(false),150)} onFocus={()=>setShowSug(true)} placeholder="Nombre de la empresa" style={inp}/>
          {showSug&&knownEmpresas.filter(e=>e.toLowerCase().includes(empresa.toLowerCase())&&e.toLowerCase()!==empresa.toLowerCase()).length>0&&(
            <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:10,background:"#fff",border:`1px solid ${BORDER}`,borderRadius:"0 0 8px 8px",boxShadow:"0 4px 16px rgba(0,0,0,0.1)"}}>
              {knownEmpresas.filter(e=>e.toLowerCase().includes(empresa.toLowerCase())&&e.toLowerCase()!==empresa.toLowerCase()).map(s=><button key={s} onClick={()=>{setEmpresa(s);setShowSug(false);}} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",border:"none",background:"#fff",cursor:"pointer",fontSize:13,fontFamily:FONT}}>📁 {s}</button>)}
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:8,paddingTop:26,flexWrap:"wrap"}}>
          {(Object.keys(adjPrices).length>0||Object.keys(adjCostos).length>0)&&<button onClick={()=>{setAdjPrices({});setAdjCostos({});setChat([]);}} style={{...btnS,fontSize:12}}>↺ Resetear</button>}
          <button onClick={()=>setShowExport(true)} style={{...btnP,background:"#374151"}}>↓ Exportar propuesta</button>
          <button onClick={()=>guardar("abierto")} style={btnS}>Guardar abierto</button>
          <button onClick={()=>guardar("cerrado")} style={btnP}>Guardar cerrado</button>
        </div>
      </div>
      {saveMsg&&<div style={{padding:"10px 16px",background:"#D1FAE5",borderRadius:8,fontSize:13,color:"#065F46",fontWeight:600,marginBottom:"1rem",fontFamily:FONT}}>{saveMsg}</div>}

      {/* AI LOG PANEL */}
      {aiLog.length>0&&(<div style={{...card(),marginBottom:"1rem",padding:"12px 16px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <p style={{fontSize:12,fontWeight:600,color:"#374151",fontFamily:FONT}}>📋 Historial de ajustes IA ({aiLog.length})</p>
          <button onClick={()=>setAiLog([])} style={{fontSize:11,color:"#9CA3AF",background:"none",border:"none",cursor:"pointer",fontFamily:FONT}}>Limpiar</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:160,overflowY:"auto"}}>
          {[...aiLog].reverse().map((e,i)=>(
            <div key={i} style={{fontSize:11,padding:"6px 10px",background:GRAY,borderRadius:6,fontFamily:FONT}}>
              <span style={{color:"#9CA3AF",marginRight:8}}>{e.ts}</span>
              <span style={{color:BLUE,fontWeight:600}}>{e.planes}</span>
              <span style={{color:"#374151",marginLeft:6}}>← "{e.pedido}"</span>
            </div>
          ))}
        </div>
      </div>)}

      {/* ESCENARIOS */}
      <div style={{...card(),marginBottom:"1rem",padding:"12px 16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <p style={{fontSize:12,fontWeight:600,color:"#374151",fontFamily:FONT,marginRight:4}}>🎭 Escenarios:</p>
          {Object.keys(scenarios).map(name=>(
            <button key={name} onClick={()=>{setAdjPrices(scenarios[name].adjPrices);setAdjCostos(scenarios[name].adjCostos);}} style={{fontSize:11,padding:"4px 10px",borderRadius:20,border:`1px solid ${BLUE}`,background:"#fff",color:BLUE,cursor:"pointer",fontFamily:FONT}}>{name}</button>
          ))}
          {(Object.keys(adjPrices).length>0||Object.keys(adjCostos).length>0)&&(<button onClick={()=>{const name=prompt("Nombre del escenario:");if(name?.trim()){const k=name.trim();if(scenarios[k]&&!confirm(`Ya existe el escenario "${k}". ¿Sobreescribir?`))return;setScenarios(p=>({...p,[k]:{adjPrices:{...adjPrices},adjCostos:{...adjCostos}}}));}}} style={{fontSize:11,padding:"4px 10px",borderRadius:20,border:`1px dashed #9CA3AF`,background:"#fff",color:"#374151",cursor:"pointer",fontFamily:FONT}}>+ Guardar escenario</button>)}
          {Object.keys(scenarios).length===0&&Object.keys(adjPrices).length===0&&<span style={{fontSize:11,color:"#9CA3AF",fontFamily:FONT}}>Ajustá precios y guardá como escenario para comparar</span>}
        </div>
      </div>

      {/* IA */}
      <div style={{background:BLUE,borderRadius:12,padding:"16px 20px",marginBottom:"1.5rem"}}>
        <p style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.6)",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:FONT}}>Ajuste de precios con IA</p>
        <div style={{display:"flex",gap:8}}>
          <input value={chatIn} onChange={e=>setChatIn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendChat()} placeholder='Ej: "Bajá el C/F de AMBA 6500_PYME al 75%"' disabled={chatLoading} style={{...inp,flex:1,background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff"}}/>
          <button onClick={sendChat} disabled={!chatIn.trim()||chatLoading} style={{...btnP,background:"rgba(255,255,255,0.18)",border:"1px solid rgba(255,255,255,0.3)",padding:"8px 20px",whiteSpace:"nowrap"}}>{chatLoading?"...":"Enviar →"}</button>
        </div>
        {chat.length>0&&(()=>{const last=chat[chat.length-1];if(last.role!=="assistant")return null;return(<div style={{marginTop:12,padding:"10px 14px",background:"rgba(255,255,255,0.1)",borderRadius:8,fontSize:13,color:"rgba(255,255,255,0.9)",lineHeight:1.55,fontFamily:FONT}}>{last.upd&&<span style={{fontSize:11,color:"#34D399",display:"block",marginBottom:4,fontWeight:600}}>✓ Precios actualizados</span>}{last.content}</div>);})()}
      </div>

      {/* OSDE Comparison Toggle */}
      <div style={{...card(),marginBottom:"1rem",padding:"12px 16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:compareOsde?12:0}}>
          <button onClick={()=>setCompareOsde(v=>!v)} style={{...compareOsde?btnP:btnS,fontSize:12,padding:"6px 14px",background:compareOsde?"#7C3AED":"#fff",color:compareOsde?"#fff":"#7C3AED",border:"1.5px solid #7C3AED"}}>
            {compareOsde?"✓ Comparando con OSDE":"Comparar con OSDE"}
          </button>
        </div>
        {compareOsde&&(Object.keys(osde||{}).length===0
          ?<span style={{fontSize:12,color:"#9CA3AF",fontFamily:FONT}}>No hay planes OSDE cargados. Cargalos en "Precios OSDE".</span>
          :results.length===0
            ?<span style={{fontSize:12,color:"#9CA3AF",fontFamily:FONT}}>Cargá una nómina y configurá los planes para ver la comparación.</span>
            :(()=>{
              const osdePlans=Object.keys(osde||{}).sort();
              const rows=results.map(r=>{
                const mappedPlan=planMappingOsde[r.adjKey]||"";
                const osdeResult=mappedPlan&&(osde||{})[mappedPlan]?calcOsdeFromEmps(r.empList,(osde||{})[mappedPlan]):null;
                return{r,mappedPlan,osdeResult};
              });
              const totalOmint=rows.reduce((a,{r})=>a+r.bd.totalFac,0);
              const totalOsde=rows.reduce((a,{osdeResult})=>a+(osdeResult?osdeResult.total:0),0);
              const hasSomeOsde=rows.some(x=>x.osdeResult);
              const diffTotal=totalOsde-totalOmint;
              const diffPctTotal=totalOmint>0?diffTotal/totalOmint*100:0;
              return(<div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:560}}>
                  <thead><tr>
                    <th style={TH({textAlign:"left"})}>Plan Omint</th>
                    <th style={TH({textAlign:"left",color:"#7C3AED"})}>Plan OSDE</th>
                    <th style={TH()}>Total Omint</th>
                    <th style={TH({color:"#7C3AED"})}>Total OSDE</th>
                    <th style={TH()}>Diferencia</th>
                    <th style={TH()}>%</th>
                  </tr></thead>
                  <tbody>
                    {rows.map(({r,mappedPlan,osdeResult})=>{
                      const diff=osdeResult?osdeResult.total-r.bd.totalFac:null;
                      const pct=diff!==null&&r.bd.totalFac>0?diff/r.bd.totalFac*100:null;
                      const zc2=ZONA_COLORS[r.zona]||{c:BLUE,bg:BLUE_LT};
                      return(<tr key={r.adjKey}>
                        <td style={TD({fontWeight:600})}>
                          <span style={{...badge(zc2.c,zc2.bg),fontSize:10,marginRight:6}}>{r.zona}</span>{r.planId}
                        </td>
                        <td style={TD()}>
                          <select value={mappedPlan} onChange={e=>setPlanMappingOsde(p=>({...p,[r.adjKey]:e.target.value}))} style={{...inp,width:130,fontSize:12,padding:"4px 8px"}}>
                            <option value="">—</option>
                            {osdePlans.map(p=><option key={p} value={p}>{p}</option>)}
                          </select>
                        </td>
                        <td style={TD({textAlign:"right",fontWeight:600,color:BLUE})}>${fmt(r.bd.totalFac)}</td>
                        <td style={TD({textAlign:"right",fontWeight:600,color:"#7C3AED"})}>{osdeResult?`$${fmt(osdeResult.total)}`:"—"}</td>
                        <td style={TD({textAlign:"right",color:diff===null?"#9CA3AF":diff>0?"#16A34A":"#DC2626",fontWeight:diff!==null?600:400})}>
                          {diff!==null?`${diff>0?"+":""}$${fmt(Math.abs(diff))}`:"—"}
                        </td>
                        <td style={TD({textAlign:"right"})}>
                          {pct!==null&&<span style={{...badge(pct>0?"#16A34A":"#DC2626",pct>0?"#D1FAE5":"#FEF2F2"),fontSize:11}}>
                            {pct>0?"+":""}{pct.toFixed(1)}%
                          </span>}
                        </td>
                      </tr>);
                    })}
                    {hasSomeOsde&&(<tr style={{background:"#F5F3FF",borderTop:`2px solid #7C3AED`}}>
                      <td style={{padding:"10px 12px",fontWeight:700,color:"#7C3AED",fontFamily:FONT}} colSpan={2}>TOTAL</td>
                      <td style={{padding:"10px 12px",textAlign:"right",fontWeight:700,color:BLUE,fontFamily:FONT}}>${fmt(totalOmint)}</td>
                      <td style={{padding:"10px 12px",textAlign:"right",fontWeight:700,color:"#7C3AED",fontFamily:FONT}}>${fmt(totalOsde)}</td>
                      <td style={{padding:"10px 12px",textAlign:"right",fontWeight:700,color:diffTotal>0?"#16A34A":"#DC2626",fontFamily:FONT}}>
                        {diffTotal>0?"+":""}${fmt(Math.abs(diffTotal))}
                      </td>
                      <td style={{padding:"10px 12px",textAlign:"right",fontFamily:FONT}}>
                        <span style={{...badge(diffPctTotal>0?"#16A34A":"#DC2626",diffPctTotal>0?"#D1FAE5":"#FEF2F2"),fontWeight:700}}>
                          {diffPctTotal>0?"+":""}{diffPctTotal.toFixed(1)}%
                        </span>
                      </td>
                    </tr>)}
                  </tbody>
                </table>
              </div>);
            })()
        )}
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:"1.5rem"}}>
        {[{l:"Socios",v:emps?.length||0,bg:"#fff"},{l:"Facturación",v:`$${fmt(grandFac)}`,bg:BLUE,white:true},{l:"Costo",v:`$${fmt(grandCosto)}`,c:"#DC2626",bg:"#FEF2F2"},{l:"C/F global",v:`${grandCF.toFixed(1)}%`,sub:cfLabel(grandCF),c:cfColor(grandCF),bg:cfBg(grandCF)}].map(c=>(<div key={c.l} style={{background:c.bg,border:`1px solid ${c.bg==="#fff"?BORDER:"transparent"}`,borderRadius:12,padding:"1rem 1.25rem"}}>
          <p style={{fontSize:11,fontWeight:600,color:c.white?"rgba(255,255,255,0.7)":"#6B7280",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.04em",fontFamily:FONT}}>{c.l}</p>
          <p style={{fontSize:18,fontWeight:700,color:c.white?"#fff":c.c||BLUE,fontFamily:FONT}}>{c.v}</p>
          {c.sub&&<p style={{fontSize:11,color:c.c,marginTop:2,fontWeight:500,fontFamily:FONT}}>{c.sub}</p>}
        </div>))}
      </div>

      {/* Resumen */}
      {results.length>1&&(<div style={{...card(),marginBottom:"1.5rem"}}>
        <p style={{fontSize:13,fontWeight:600,color:BLUE,marginBottom:"1rem",fontFamily:FONT}}>Resumen por zona y plan</p>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:500}}>
          <thead><tr>{["Zona","Plan","Socios","Facturación","Costo","C/F"].map((h,i)=><th key={h} style={TH({textAlign:i<2?"left":"right"})}>{h}</th>)}</tr></thead>
          <tbody>{results.map(r=>{const zc2=ZONA_COLORS[r.zona]||{c:BLUE,bg:BLUE_LT};return(<tr key={r.adjKey}>
            <td style={TD()}><span style={{...badge(zc2.c,zc2.bg),fontSize:11}}>{r.zona}</span></td>
            <td style={TD({fontWeight:600,color:BLUE})}>{r.planId}</td>
            <td style={TD({textAlign:"right",color:"#6B7280"})}>{r.bd.totalSocios}</td>
            <td style={TD({textAlign:"right",fontWeight:600})}>${fmt(r.bd.totalFac)}</td>
            <td style={TD({textAlign:"right",color:"#DC2626"})}>${fmt(r.bd.totalCosto)}</td>
            <td style={TD({textAlign:"right"})}><span style={{...badge(cfColor(r.bd.cfTotal),cfBg(r.bd.cfTotal)),minWidth:52,display:"inline-block",textAlign:"center"}}>{r.bd.cfTotal.toFixed(1)}%</span></td>
          </tr>);})}</tbody>
        </table></div>
      </div>)}

      {/* Desglose por grupo */}
      {results.map(r=>{
        const zc2=ZONA_COLORS[r.zona]||{c:BLUE,bg:BLUE_LT};
        return(<div key={r.adjKey} style={{...card(),marginBottom:"1.5rem"}}>
          {(()=>{
            const hasMej=MEJORAS_DEF.some(m=>planMejoras[r.adjKey]?.[m.id]);
            return(<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:"0.75rem",flexWrap:"wrap"}}>
              <span style={{...badge(zc2.c,zc2.bg),fontSize:12}}>{r.zona}</span>
              <span style={{...badge("#fff",BLUE),fontSize:12}}>{r.planId}</span>
              <span style={{fontSize:12,color:"#6B7280",fontFamily:FONT}}>{r.bd.totalSocios} socios · banda 200-499</span>
              {r.mapping.length>0&&<span style={{fontSize:11,color:"#9CA3AF",fontFamily:FONT}}>← {r.mapping.map(m=>m.from).join(", ")}</span>}
              <span style={{marginLeft:"auto",...badge(cfColor(r.bd.cfTotal),cfBg(r.bd.cfTotal)),fontSize:11}}>C/F {r.bd.cfTotal.toFixed(1)}%</span>
              {(adjPrices[r.adjKey]||adjCostos[r.adjKey])&&<button onClick={()=>{setAdjPrices(prev=>{const n={...prev};delete n[r.adjKey];return n;});setAdjCostos(prev=>{const n={...prev};delete n[r.adjKey];return n;});}} style={{fontSize:11,padding:"3px 10px",borderRadius:6,border:`1px solid #DC2626`,background:"#FEF2F2",color:"#DC2626",cursor:"pointer",fontFamily:FONT,fontWeight:500}}>↺ Restaurar</button>}
              {hasMej&&<div style={{display:"flex",alignItems:"center",gap:6,width:"100%",marginTop:4}}>
                <span style={{fontSize:11,color:"#166534",fontFamily:FONT,fontWeight:600,whiteSpace:"nowrap"}}>Nombre del plan cotizado:</span>
                <input
                  value={planCustomNames[r.adjKey]??r.planId}
                  onChange={e=>setPlanCustomNames(prev=>({...prev,[r.adjKey]:e.target.value}))}
                  placeholder={r.planId}
                  style={{flex:1,fontSize:12,padding:"4px 8px",border:"1.5px solid #BBF7D0",borderRadius:6,fontFamily:FONT,background:"#F0FDF4",color:"#166534",outline:"none",maxWidth:320}}
                />
              </div>}
            </div>);
          })()}
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5,minWidth:660}}>
              <thead><tr>
                <th style={TH({textAlign:"left"})}>Categoría</th><th style={TH()}>N°</th>
                <th style={TH({color:BLUE})}>Precio ($)</th><th style={TH({color:"#7C3AED"})}>Costo ($)</th>
                <th style={TH()}>Facturación</th><th style={TH({color:"#DC2626"})}>Costo Total</th><th style={TH()}>C/F</th>
              </tr></thead>
              <tbody>
                {r.bd.rows.map(row=>{
                  const hadjP=adjPrices[r.adjKey]?.[row.id]!==undefined;
                  const hadjC=adjCostos[r.adjKey]?.[row.id]!==undefined;
                  return(<tr key={row.id} style={{opacity:row.count===0?0.3:1}}>
                    <td style={TD({fontWeight:500})}>{row.label}</td>
                    <td style={TD({textAlign:"right",color:"#6B7280"})}>{row.count}</td>
                    <td style={TD({textAlign:"right"})}><div style={{display:"flex",alignItems:"center",gap:2,justifyContent:"flex-end"}}><span style={{fontSize:11,color:hadjP?BLUE:"#6B7280",fontFamily:FONT}}>$</span><input type="number" min={0} value={row.precio} onChange={e=>{const v=parseFloat(e.target.value)||0;setAdjPrices(prev=>({...prev,[r.adjKey]:{...(prev[r.adjKey]||{}),[row.id]:v}}));}} style={{...numInp(80,hadjP),textAlign:"right"}}/></div></td>
                    <td style={TD({textAlign:"right"})}><div style={{display:"flex",alignItems:"center",gap:2,justifyContent:"flex-end"}}><span style={{fontSize:11,color:hadjC?"#7C3AED":"#6B7280",fontFamily:FONT}}>$</span><input type="number" min={0} value={row.costo} onChange={e=>{const v=parseFloat(e.target.value)||0;setAdjCostos(prev=>({...prev,[r.adjKey]:{...(prev[r.adjKey]||{}),[row.id]:v}}));}} style={{...numInp(80,hadjC),textAlign:"right"}}/></div></td>
                    <td style={TD({textAlign:"right",fontWeight:600,color:BLUE})}>${fmt(row.fac)}</td>
                    <td style={TD({textAlign:"right",color:"#DC2626"})}>${fmt(row.cos)}</td>
                    <td style={TD({textAlign:"right"})}>{row.fac>0&&<span style={{...badge(cfColor(row.cf),cfBg(row.cf)),minWidth:44,display:"inline-block",textAlign:"center",fontSize:11}}>{row.cf.toFixed(0)}%</span>}</td>
                  </tr>);
                })}
                <tr style={{background:BLUE_LT}}>
                  <td style={{padding:"10px 12px",fontWeight:700,color:BLUE,borderTop:`2px solid ${BLUE}`,fontFamily:FONT}}>Total</td>
                  <td style={{borderTop:`2px solid ${BLUE}`}}/><td style={{borderTop:`2px solid ${BLUE}`}}/><td style={{borderTop:`2px solid ${BLUE}`}}/>
                  <td style={{padding:"10px 12px",textAlign:"right",fontWeight:700,color:BLUE,borderTop:`2px solid ${BLUE}`,fontFamily:FONT}}>${fmt(r.bd.totalFac)}</td>
                  <td style={{padding:"10px 12px",textAlign:"right",fontWeight:700,color:"#DC2626",borderTop:`2px solid ${BLUE}`,fontFamily:FONT}}>${fmt(r.bd.totalCosto)}</td>
                  <td style={{padding:"10px 12px",textAlign:"right",borderTop:`2px solid ${BLUE}`}}><span style={{...badge(cfColor(r.bd.cfTotal),cfBg(r.bd.cfTotal)),fontWeight:700,fontSize:12}}>{r.bd.cfTotal.toFixed(1)}%</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* MEJORAS per plan */}
          {(()=>{
            const hasAnyOpts=MEJORAS_DEF.some(m=>Object.keys((mejoras||{})[m.id]||{}).length>0);
            if(!hasAnyOpts)return null;
            return(<div style={{marginTop:"1rem",padding:"12px 14px",background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:8}}>
              <p style={{fontSize:12,fontWeight:600,color:"#166534",marginBottom:8,fontFamily:FONT}}>Mejoras opcionales</p>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {MEJORAS_DEF.map(m=>{
                  const options=Object.keys((mejoras||{})[m.id]||{});
                  if(options.length===0)return null;
                  const selected=planMejoras[r.adjKey]?.[m.id]||null;
                  return(<div key={m.id} style={{display:"flex",alignItems:"center",gap:10}}>
                    <input type="checkbox"
                      checked={!!selected}
                      onChange={e=>{
                        const firstOpt=options[0];
                        setPlanMejoras(prev=>({...prev,[r.adjKey]:{...(prev[r.adjKey]||{}),[m.id]:e.target.checked?firstOpt:null}}));
                      }}
                      id={`mej-${r.adjKey}-${m.id}`}
                    />
                    <label htmlFor={`mej-${r.adjKey}-${m.id}`} style={{fontSize:12,fontFamily:FONT,minWidth:120}}>{m.label}</label>
                    {!!selected&&options.length>1&&(
                      <select value={selected} onChange={e=>setPlanMejoras(prev=>({...prev,[r.adjKey]:{...(prev[r.adjKey]||{}),[m.id]:e.target.value}}))} style={{fontSize:12,padding:"3px 8px",borderRadius:6,border:"1px solid #D1D5DB",fontFamily:FONT}}>
                        {options.map(o=><option key={o} value={o}>{o}</option>)}
                      </select>
                    )}
                    {!!selected&&options.length===1&&(
                      <span style={{fontSize:11,color:"#6B7280",fontFamily:FONT}}>{selected}</span>
                    )}
                  </div>);
                })}
              </div>
            </div>);
          })()}
          {/* Comparación con precios vigentes */}
          {adjPrices[r.adjKey]&&(()=>{
            const base=precios?.[r.zona]?.[r.planId]||{};
            const hasChanges=CAT_IDS.some(id=>adjPrices[r.adjKey]?.[id]!==undefined&&Math.round(adjPrices[r.adjKey][id])!==Math.round(base[id]||0));
            if(!hasChanges)return null;
            return(<div style={{marginTop:"1rem",padding:"12px 14px",background:"#F8FAFF",border:`1px solid ${BORDER}`,borderRadius:8}}>
              <p style={{fontSize:11,fontWeight:600,color:"#6B7280",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.04em",fontFamily:FONT}}>Comparación con precios vigentes</p>
              <div style={{overflowX:"auto"}}>
                <table style={{borderCollapse:"collapse",fontSize:12,width:"100%"}}>
                  <thead><tr>
                    <th style={TH({textAlign:"left",fontSize:10})}>Categoría</th>
                    <th style={TH({fontSize:10})}>Vigente</th>
                    <th style={TH({fontSize:10})}>Cotización</th>
                    <th style={TH({fontSize:10})}>Diferencia</th>
                  </tr></thead>
                  <tbody>{CATS.map(cat=>{
                    const vigente=base[cat.id]||0;
                    const cotiz=adjPrices[r.adjKey]?.[cat.id]??vigente;
                    if(vigente===0&&cotiz===0)return null;
                    const diff=cotiz-vigente;
                    const pct=vigente>0?((cotiz-vigente)/vigente*100):0;
                    const changed=Math.round(cotiz)!==Math.round(vigente);
                    return(<tr key={cat.id} style={{background:changed?"#FFF7ED":"transparent"}}>
                      <td style={TD({fontWeight:changed?600:400,fontSize:12})}>{cat.label}</td>
                      <td style={TD({textAlign:"right",fontSize:12,color:"#6B7280"})}>$ {Math.round(vigente).toLocaleString("es-AR")}</td>
                      <td style={TD({textAlign:"right",fontSize:12,fontWeight:changed?600:400,color:changed?(diff>0?"#16A34A":"#DC2626"):"#111827"})}>$ {Math.round(cotiz).toLocaleString("es-AR")}</td>
                      <td style={TD({textAlign:"right",fontSize:12})}>{changed?<span style={{color:diff>0?"#16A34A":"#DC2626",fontWeight:600}}>{diff>0?"+":""}{pct.toFixed(1)}%</span>:<span style={{color:"#9CA3AF"}}>—</span>}</td>
                    </tr>);
                  })}</tbody>
                </table>
              </div>
            </div>);
          })()}
        </div>);
      })}
      {results.length===0&&(<div style={{...card(),textAlign:"center",padding:"3rem",color:"#9CA3AF"}}><p style={{fontFamily:FONT}}>No hay empleados mapeados a ningún plan Omint.</p></div>)}
      <button onClick={()=>setSub("comision")} style={{...btnS,marginTop:"0.5rem"}}>← Volver</button>
    </div>)}
  </div>);
}


export default Cotizador;
