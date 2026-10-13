import { useState, Fragment } from "react";
import { FONT, BLUE, BLUE_LT, BORDER, GRAY, CATS, CAT_IDS, ZONA_COLORS, MEJORAS_DEF } from "../constants";
import { cfColor, cfBg, fmt } from "../utils";
import { badge, btnP, btnS, inp, numInp, card, TH, TD } from "../styles";
import { pctAjuste, capitado059, calcOsdeFromEmps } from "../calc";
import AjustePrecios from "./AjustePrecios";

// ── PLANILLA DE COTIZACIÓN (paso 3) ───────────────────────────────────────────
// Misma estructura que el Excel de análisis: Distribución, Precios, Costos y Resultado,
// con todos los planes en filas para compararlos. Herramientas (IA, escenarios, alertas)
// en un panel lateral.

const RANGO={s0_25:"00-25",s26_34:"26-35",s35_54:"36-54",s55_59:"55-59",s60plus:"60+",h1:"Hijo 1",h2plus:"Hijo 2+"};
const HEAD_SECCION={margin:0,padding:"10px 16px",fontSize:13,fontWeight:700,color:"#fff",background:"#17375E",fontFamily:FONT,letterSpacing:"0.02em"};
const fmt0=n=>Math.round(+n||0).toLocaleString("es-AR");
const fmtPct=v=>`${v>0?"+":v<0?"−":""}${Math.abs(Math.round(v*1000)/10).toString().replace(".",",")}%`;

function resumenAjuste(adj,tienePrecioManual){
  if(adj?.modo==="rango"){
    const n=CAT_IDS.filter(id=>pctAjuste(adj,id)).length;
    return n?`Por rango (${n})`:"Por rango";
  }
  if(adj&&(adj.pct059||adj.pct60))return`0-59 ${fmtPct(adj.pct059||0)} · 60+ ${fmtPct(adj.pct60||0)}`;
  return tienePrecioManual?"Precio a mano":"Sin ajuste";
}

function Seccion({titulo,extra,children}){
  return(<section style={{...card({padding:0}),overflow:"hidden"}}>
    <div style={{display:"flex",flexWrap:"wrap",justifyContent:"space-between",alignItems:"center",gap:8,background:HEAD_SECCION.background}}>
      <h3 style={HEAD_SECCION}>{titulo}</h3>
      {extra&&<div style={{padding:"6px 16px"}}>{extra}</div>}
    </div>
    <div style={{overflowX:"auto",padding:"8px 12px 12px"}}>{children}</div>
  </section>);
}

function Planilla(props){
  const {results,isSim,multiSim,simTotals,emps,grandFac,grandCosto,grandCF,inversions,
    precios,mejoras,osde,
    adjPct,adjPrices,adjCostos,setAdjCostos,aplicarAjuste,setPrecioManual,
    setPlanMejoras,planCustomNames,setPlanCustomNames,
    brokerPct,setBrokerPct,planMappingOsde,setPlanMappingOsde,
    empresa,setEmpresa,knownEmpresas,
    chat,chatIn,setChatIn,chatLoading,sendChat,aiLog,setAiLog,
    scenarios,setScenarios,setAdjPrices,setAdjPct,
    guardar,saveMsg,onExportar,onVolver}=props;

  const [showSug,setShowSug]=useState(false);
  const [ajusteAbierto,setAjusteAbierto]=useState(null); // adjKey con el editor de ajuste abierto
  const [mejorasAbierto,setMejorasAbierto]=useState(null); // adjKey con el editor de mejoras abierto

  if(results.length===0)return(<div style={{...card(),textAlign:"center",padding:"3rem",color:"#6B7280"}}>
    <p style={{fontFamily:FONT}}>No hay empleados mapeados a ningún plan Omint.</p>
    <button onClick={onVolver} style={{...btnS,marginTop:"1rem"}}>← Volver</button>
  </div>);

  const zonas=[...new Set(results.map(r=>r.zona))];
  const multiZona=zonas.length>1;
  const nombre=r=>planCustomNames[r.adjKey]||r.cotId;
  const zonaBadge=z=>multiZona&&<span style={{...badge(ZONA_COLORS[z]?.c||BLUE,ZONA_COLORS[z]?.bg||BLUE_LT),fontSize:10,marginRight:6}}>{z}</span>;

  // Un plan cotizado por zona (adjKey): precios, ajustes, costos y mejoras van por plan cotizado
  const planes=[];
  {const vistos=new Set();results.forEach(r=>{if(!vistos.has(r.adjKey)){vistos.add(r.adjKey);planes.push(r);}});}
  const totPorPlan=Object.fromEntries(planes.map(pl=>{
    const rs=results.filter(r=>r.adjKey===pl.adjKey);
    const fac=rs.reduce((a,r)=>a+r.bd.totalFac,0),costo=rs.reduce((a,r)=>a+r.bd.totalCosto,0);
    return[pl.adjKey,{fac,costo,cf:fac>0?costo/fac*100:0}];
  }));

  // Distribución: en simulación la nómina va una vez por zona; en equivalencias, una fila por plan vigente
  const distFilas=isSim?zonas.map(z=>results.find(r=>r.zona===z)):results;
  const cnt=(r,id)=>r.bd.rows.find(x=>x.id===id)?.count||0;
  const distTot=Object.fromEntries(CAT_IDS.map(id=>[id,distFilas.reduce((a,r)=>a+cnt(r,id),0)]));
  const totalSocios=CAT_IDS.reduce((a,id)=>a+distTot[id],0);

  const osdePlans=Object.keys(osde||{}).sort();
  const hayOsde=osdePlans.length>0;

  // Vs. plan anterior (simulación): orden de simTotals
  const simIdx=Object.fromEntries((simTotals||[]).map((t,i)=>[t.cotId,i]));
  const vsAnterior=r=>{
    if(!isSim)return null;
    const i=simIdx[r.cotId];
    const prev=i>0?results.find(x=>x.zona===r.zona&&x.cotId===simTotals[i-1].cotId):null;
    return prev&&prev.bd.totalFac>0?(r.bd.totalFac/prev.bd.totalFac-1)*100:null;
  };

  const cfBadge=cf=><span style={{...badge(cfColor(cf),cfBg(cf)),minWidth:52,textAlign:"center"}}>{cf.toFixed(1).replace(".",",")}%</span>;
  // Celdas compactas: la planilla tiene muchas columnas
  const th=(x={})=>TH({padding:"8px 6px",...x});
  const td=(x={})=>TD({padding:"6px 6px",...x});
  const thL=th({textAlign:"left"});
  const hayAjustes=Object.keys(adjPrices).length>0||Object.keys(adjCostos).length>0;
  const sugerencias=knownEmpresas.filter(e=>e.toLowerCase().includes(empresa.toLowerCase())&&e.toLowerCase()!==empresa.toLowerCase());

  return(<div style={{display:"flex",flexDirection:"column",gap:16,textAlign:"left"}}>
    {/* Barra: empresa y acciones */}
    <div style={{display:"flex",alignItems:"flex-end",gap:12,flexWrap:"wrap"}}>
      <div style={{flex:"1 1 240px",minWidth:200,maxWidth:520,position:"relative"}}>
        <label htmlFor="planilla-empresa" style={{fontSize:11,fontWeight:600,color:"#374151",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.04em",fontFamily:FONT}}>Empresa <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,color:"#4B5563",marginLeft:6}}>{isSim?"Simulación":"Equivalencias"} · {zonas.join(", ")} · {emps?.length||0} familias · {totalSocios} socios</span></label>
        <input id="planilla-empresa" value={empresa} onChange={e=>{setEmpresa(e.target.value);setShowSug(true);}} onBlur={()=>setTimeout(()=>setShowSug(false),150)} onFocus={()=>setShowSug(true)} placeholder="Nombre de la empresa" style={inp}/>
        {showSug&&sugerencias.length>0&&(<div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:10,background:"#fff",border:`1px solid ${BORDER}`,borderRadius:"0 0 8px 8px",boxShadow:"0 4px 16px rgba(0,0,0,0.1)"}}>
          {sugerencias.map(s=><button key={s} onClick={()=>{setEmpresa(s);setShowSug(false);}} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",border:"none",background:"#fff",cursor:"pointer",fontSize:13,fontFamily:FONT,color:"#111827"}}>{s}</button>)}
        </div>)}
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginLeft:"auto"}}>
        <button onClick={onVolver} style={btnS}>← Volver</button>
        {hayAjustes&&<button onClick={()=>{setAdjPrices({});setAdjPct({});setAdjCostos({});}} style={btnS}>↺ Resetear ajustes</button>}
        <button onClick={()=>guardar("abierto")} style={btnS}>Guardar abierto</button>
        <button onClick={()=>guardar("cerrado")} style={btnS}>Guardar cerrado</button>
        <button onClick={onExportar} style={btnP}>Exportar →</button>
      </div>
    </div>
    {saveMsg&&<div style={{padding:"10px 16px",background:"#D1FAE5",borderRadius:8,fontSize:13,color:"#065F46",fontWeight:600,fontFamily:FONT}}>{saveMsg}</div>}

    {/* Resumen por plan */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>
      {!multiSim&&!isSim&&(<div style={{...card({padding:"14px 16px"}),background:BLUE,border:"none"}}>
        <p style={{fontSize:12,fontWeight:700,color:"#D6DCF5",fontFamily:FONT,textTransform:"uppercase",letterSpacing:"0.05em"}}>Total cotización</p>
        <p style={{fontSize:20,fontWeight:700,color:"#fff",fontFamily:FONT,margin:"4px 0"}}>${fmt0(grandFac)}</p>
        <p style={{fontSize:13,color:"#D6DCF5",fontFamily:FONT}}>Costo ${fmt0(grandCosto)} · C/F {grandCF.toFixed(1).replace(".",",")}%</p>
      </div>)}
      {planes.map(pl=>{const t=totPorPlan[pl.adjKey];return(<div key={pl.adjKey} style={card({padding:"14px 16px"})}>
        <p style={{fontSize:13,fontWeight:700,color:BLUE,fontFamily:FONT}}>{zonaBadge(pl.zona)}{nombre(pl)}</p>
        <p style={{fontSize:20,fontWeight:700,color:"#111827",fontFamily:FONT,margin:"4px 0"}}>${fmt0(t.fac)}</p>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,color:"#4B5563",fontFamily:FONT}}>
          <span>Costo ${fmt0(t.costo)}</span>{cfBadge(t.cf)}
        </div>
      </div>);})}
    </div>

    {/* HERRAMIENTAS: IA, escenarios, alertas e historial */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:16,alignItems:"start"}}>
        <div style={{background:BLUE,borderRadius:12,padding:16,display:"flex",flexDirection:"column",gap:10}}>
          <label htmlFor="planilla-ia" style={{fontSize:11,fontWeight:700,color:"#D6DCF5",textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:FONT}}>Ajuste de precios con IA</label>
          <textarea id="planilla-ia" rows={3} value={chatIn} onChange={e=>setChatIn(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat();}}} disabled={chatLoading}
            placeholder='Ej: "Bajá el C/F de 6500_PYME al 75%"' style={{...inp,resize:"vertical",lineHeight:1.5}}/>
          <button onClick={sendChat} disabled={!chatIn.trim()||chatLoading} style={{...btnS,minHeight:44}}>{chatLoading?"Calculando…":"Aplicar"}</button>
          {chat.length>0&&chat[chat.length-1].role==="assistant"&&<p style={{fontSize:12,color:"#fff",lineHeight:1.55,fontFamily:FONT,whiteSpace:"pre-wrap",background:"rgba(255,255,255,0.12)",borderRadius:8,padding:"8px 10px"}}>{chat[chat.length-1].content}</p>}
        </div>

        <div style={card({padding:16})}>
          <p style={{fontSize:11,fontWeight:700,color:"#4B5A9E",textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:FONT,marginBottom:10}}>Escenarios</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {Object.keys(scenarios).map(n=><button key={n} onClick={()=>{setAdjPrices(scenarios[n].adjPrices);setAdjCostos(scenarios[n].adjCostos);setAdjPct(scenarios[n].adjPct||{});}} style={{fontSize:12,padding:"6px 12px",borderRadius:20,border:`1px solid ${BLUE}`,background:"#fff",color:BLUE,cursor:"pointer",fontFamily:FONT}}>{n}</button>)}
            {hayAjustes&&<button onClick={()=>{const n=prompt("Nombre del escenario:");if(n?.trim()){const k=n.trim();if(scenarios[k]&&!confirm(`Ya existe el escenario "${k}". ¿Sobreescribir?`))return;setScenarios(p=>({...p,[k]:{adjPrices:{...adjPrices},adjCostos:{...adjCostos},adjPct:{...adjPct}}}));}}} style={{fontSize:12,padding:"6px 12px",borderRadius:20,border:"1px dashed #9CA3AF",background:"#fff",color:"#4B5563",cursor:"pointer",fontFamily:FONT}}>+ Guardar actual</button>}
          </div>
          {Object.keys(scenarios).length===0&&!hayAjustes&&<p style={{fontSize:12,color:"#6B7280",fontFamily:FONT}}>Ajustá precios y guardá el estado como escenario para comparar.</p>}
        </div>

        <div style={card({padding:16})}>
          <p style={{fontSize:11,fontWeight:700,color:"#4B5A9E",textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:FONT,marginBottom:10}}>Alertas</p>
          <div style={{display:"flex",flexDirection:"column",gap:8,fontSize:12,fontFamily:FONT,lineHeight:1.5}}>
            {isSim&&<p style={{color:"#374151"}}>Simulación: cada plan cotiza toda la nómina.{multiSim&&" Los totales no se suman."}</p>}
            {results.some(r=>r.sinPrecios)&&<p style={{color:"#B42318",fontWeight:600}}>Sin precios cargados para: {results.filter(r=>r.sinPrecios).map(r=>`${r.cotId} en ${r.zona}`).join(", ")}. Esa facturación queda en $0.</p>}
            {inversions.length>0
              ?inversions.map((v,i)=><p key={i} style={{color:"#B42318"}}>Precio invertido en {v.zona} · {v.cat}: {v.plan1} (${fmt0(v.price1)}) es más caro que {v.plan2} (${fmt0(v.price2)}).</p>)
              :<p style={{color:"#374151"}}>Sin precios invertidos entre planes.</p>}
            {results.some(r=>r.bd.skipped>0)&&<p style={{color:"#92400E"}}>Hay filas sin edad válida que no se cotizaron.</p>}
          </div>
        </div>

        {aiLog.length>0&&(<div style={card({padding:16})}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <p style={{fontSize:11,fontWeight:700,color:"#4B5A9E",textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:FONT}}>Historial IA ({aiLog.length})</p>
            <button onClick={()=>setAiLog([])} style={{fontSize:11,color:"#6B7280",background:"none",border:"none",cursor:"pointer",fontFamily:FONT}}>Limpiar</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:200,overflowY:"auto"}}>
            {[...aiLog].reverse().map((e,i)=>(<div key={i} style={{fontSize:11,padding:"6px 10px",background:GRAY,borderRadius:6,fontFamily:FONT}}>
              <span style={{color:"#6B7280",marginRight:6}}>{e.ts}</span><span style={{color:BLUE,fontWeight:600}}>{e.planes}</span>
              <span style={{color:"#374151",display:"block"}}>“{e.pedido}”</span>
            </div>))}
          </div>
        </div>)}
    </div>

    <div style={{display:"flex",flexDirection:"column",gap:16}}>

        {/* 1 · DISTRIBUCIÓN */}
        <Seccion titulo="1 · Distribución de la nómina">
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:640}}>
            <thead><tr><th style={thL}>{isSim?"":"Plan vigente"}</th>{CATS.map(c=><th key={c.id} style={th()}>{RANGO[c.id]}</th>)}<th style={th({color:"#111827"})}>Total</th></tr></thead>
            <tbody>
              {distFilas.map(r=>{const tot=CAT_IDS.reduce((a,id)=>a+cnt(r,id),0);return(<tr key={r.osdeKey}>
                <td style={td({fontWeight:600})}>{zonaBadge(r.zona)}{isSim?"Nómina":<>{r.planVigente}{r.planVigente!==r.cotId&&<span style={{color:"#6B7280",fontWeight:400}}> → {nombre(r)}</span>}</>}</td>
                {CAT_IDS.map(id=><td key={id} style={td({textAlign:"right"})}>{cnt(r,id)}</td>)}
                <td style={td({textAlign:"right",fontWeight:700})}>{tot}</td>
              </tr>);})}
              {distFilas.length>1&&<tr style={{background:BLUE_LT}}><td style={td({fontWeight:700,color:BLUE})}>Total</td>{CAT_IDS.map(id=><td key={id} style={td({textAlign:"right",fontWeight:700})}>{distTot[id]}</td>)}<td style={td({textAlign:"right",fontWeight:700})}>{totalSocios}</td></tr>}
              <tr><td style={td({color:"#6B7280"})}>% del total</td>{CAT_IDS.map(id=><td key={id} style={td({textAlign:"right",color:"#6B7280"})}>{totalSocios?Math.round(distTot[id]/totalSocios*100):0}%</td>)}<td style={td({textAlign:"right",color:"#6B7280"})}>100%</td></tr>
            </tbody>
          </table>
        </Seccion>

        {/* 2 · PRECIOS */}
        <Seccion titulo="2 · Precios (lista × ajuste)" extra={<span style={{fontSize:12,color:"#D6DCF5",fontFamily:FONT}}>Celda celeste = ajustada · escribí el precio o usá el ajuste</span>}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:960}}>
            <thead><tr><th style={thL}>Plan</th>{CATS.map(c=><th key={c.id} style={th()}>{RANGO[c.id]}</th>)}<th style={thL}>Ajuste</th><th style={th()}>Capitados</th></tr></thead>
            <tbody>
              {planes.map(pl=>{
                const base=precios?.[pl.zona]?.[pl.planId]||{};
                const adj=adjPct[pl.adjKey];
                const manual=!!adjPrices[pl.adjKey]&&!adj;
                const abierto=ajusteAbierto===pl.adjKey;
                return(<Fragment key={pl.adjKey}>
                  <tr>
                    <td style={td({fontWeight:700,color:BLUE,whiteSpace:"nowrap"})}>{zonaBadge(pl.zona)}{nombre(pl)}{pl.sinPrecios&&<span style={{color:"#DC2626",fontSize:11,fontWeight:600}}> · sin precios</span>}</td>
                    {CAT_IDS.map(id=>{
                      const row=pl.bd.rows.find(x=>x.id===id);
                      const ajustada=pctAjuste(adj,id)!==0||(adjPrices[pl.adjKey]?.[id]!==undefined&&Math.abs((adjPrices[pl.adjKey][id]||0)-(base[id]||0))>0.005);
                      return(<td key={id} style={td({textAlign:"right",padding:"6px 3px"})}>
                        <input type="number" min={0} className="sin-flechas" aria-label={`Precio ${RANGO[id]} ${nombre(pl)}`} title={`Lista: $${fmt0(base[id])}`}
                          value={Math.round((row?.precio||0)*100)/100}
                          onChange={e=>setPrecioManual(pl,id,parseFloat(e.target.value)||0)}
                          style={{...numInp(74,ajustada),background:ajustada?"#E3EBFF":"#fff"}}/>
                      </td>);
                    })}
                    <td style={td({whiteSpace:"nowrap"})}>
                      <button onClick={()=>setAjusteAbierto(abierto?null:pl.adjKey)} aria-expanded={abierto}
                        style={{fontSize:12,fontFamily:FONT,padding:"5px 10px",borderRadius:6,cursor:"pointer",border:`1px solid ${adj||manual?BLUE:BORDER}`,background:adj||manual?BLUE_LT:"#fff",color:adj||manual?BLUE:"#4B5563",fontWeight:adj||manual?600:400}}>
                        {resumenAjuste(adj,manual)} {abierto?"▲":"▼"}
                      </button>
                    </td>
                    <td style={td({textAlign:"right",whiteSpace:"nowrap",lineHeight:1.4})}>
                      <span style={{display:"block"}}><span style={{color:"#6B7280",fontSize:11}}>0-59 </span><strong>{fmt0(capitado059(pl,results))}</strong></span>
                      <span style={{display:"block"}}><span style={{color:"#6B7280",fontSize:11}}>60+ </span><strong>{fmt0(pl.bd.rows.find(x=>x.id==="s60plus")?.precio)}</strong></span>
                    </td>
                  </tr>
                  {abierto&&<tr><td colSpan={10} style={{padding:"4px 8px 8px"}}><AjustePrecios adj={adj} onChange={a=>aplicarAjuste(pl,a)}/></td></tr>}
                </Fragment>);
              })}
            </tbody>
          </table>
        </Seccion>

        {/* 3 · COSTOS */}
        <Seccion titulo="3 · Costos (lista + mejoras + comisión)" extra={
          <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#fff",fontFamily:FONT}}>Comisión broker
            <input type="number" min="0" max="100" className="sin-flechas" value={brokerPct} onChange={e=>setBrokerPct(e.target.value)} placeholder="0" style={{...numInp(64),fontSize:13}}/> %
          </label>}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:860}}>
            <thead><tr><th style={thL}>Plan</th>{CATS.map(c=><th key={c.id} style={th()}>{RANGO[c.id]}</th>)}<th style={thL}>Mejoras</th></tr></thead>
            <tbody>
              {planes.map(pl=>{
                const opcionesMej=MEJORAS_DEF.filter(m=>Object.keys((mejoras||{})[m.id]||{}).length>0);
                const elegidas=MEJORAS_DEF.filter(m=>pl.mejSel[m.id]).map(m=>`${m.label} ${pl.mejSel[m.id]}`);
                const abierto=mejorasAbierto===pl.adjKey;
                return(<Fragment key={pl.adjKey}>
                  <tr>
                    <td style={td({fontWeight:700,color:BLUE,whiteSpace:"nowrap"})}>{zonaBadge(pl.zona)}{nombre(pl)}</td>
                    {CAT_IDS.map(id=>{
                      const editado=adjCostos[pl.adjKey]?.[id]!==undefined;
                      return(<td key={id} style={td({textAlign:"right",padding:"6px 3px"})}>
                        <input type="number" min={0} className="sin-flechas" aria-label={`Costo ${RANGO[id]} ${nombre(pl)}`}
                          value={Math.round(((pl.baseCostosXLS||{})[id]||0)*100)/100}
                          onChange={e=>{const v=parseFloat(e.target.value)||0;setAdjCostos(prev=>({...prev,[pl.adjKey]:{...(prev[pl.adjKey]||{}),[id]:v}}));}}
                          style={{...numInp(74,editado),background:editado?"#F3E8FF":"#fff"}}/>
                      </td>);
                    })}
                    <td style={td({whiteSpace:"nowrap"})}>
                      {opcionesMej.length===0?<span style={{fontSize:12,color:"#6B7280"}}>Sin mejoras cargadas</span>:(
                        <button onClick={()=>setMejorasAbierto(abierto?null:pl.adjKey)} aria-expanded={abierto}
                          style={{fontSize:12,fontFamily:FONT,padding:"5px 10px",borderRadius:6,cursor:"pointer",border:`1px solid ${elegidas.length?"#16A34A":BORDER}`,background:elegidas.length?"#F0FDF4":"#fff",color:elegidas.length?"#166534":"#4B5563",fontWeight:elegidas.length?600:400}}>
                          {elegidas.length?elegidas.join(" · "):"Ninguna"} {abierto?"▲":"▼"}
                        </button>)}
                    </td>
                  </tr>
                  {abierto&&<tr><td colSpan={9} style={{padding:"4px 8px 8px"}}>
                    <div style={{display:"flex",flexWrap:"wrap",gap:16,padding:"10px 14px",background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:8}}>
                      {opcionesMej.map(m=>{
                        const options=Object.keys(mejoras[m.id]);
                        const sel=pl.mejSel[m.id]||null;
                        const setMej=v=>setPlanMejoras(prev=>({...prev,[pl.adjKey]:{...(prev[pl.adjKey]||pl.mejSel),[m.id]:v}}));
                        return(<div key={m.id} style={{display:"flex",alignItems:"center",gap:8}}>
                          <input type="checkbox" id={`mej-${pl.adjKey}-${m.id}`} checked={!!sel} onChange={e=>setMej(e.target.checked?options[0]:null)}/>
                          <label htmlFor={`mej-${pl.adjKey}-${m.id}`} style={{fontSize:12,fontFamily:FONT}}>{m.label}</label>
                          {!!sel&&options.length>1&&<select value={sel} onChange={e=>setMej(e.target.value)} aria-label={`Opción de ${m.label}`} style={{...inp,width:"auto",fontSize:12,padding:"3px 8px"}}>
                            {options.map(o=><option key={o} value={o}>{o}</option>)}
                          </select>}
                          {!!sel&&options.length===1&&<span style={{fontSize:11,color:"#6B7280",fontFamily:FONT}}>{sel}</span>}
                        </div>);
                      })}
                    </div>
                  </td></tr>}
                </Fragment>);
              })}
            </tbody>
          </table>
        </Seccion>

        {/* 4 · RESULTADO */}
        <Seccion titulo="4 · Resultado">
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:hayOsde?960:720}}>
            <thead><tr>
              {!isSim&&<th style={thL}>Plan vigente</th>}
              <th style={thL}>Plan</th><th style={thL}>Nombre en la propuesta</th>
              <th style={th()}>Socios</th><th style={th()}>Facturación</th><th style={th()}>Costo</th><th style={th()}>C/F</th>
              {isSim&&<th style={th()}>Vs. anterior</th>}
              {hayOsde&&<><th style={thL}>Plan OSDE</th><th style={th()}>Fact. OSDE</th><th style={th()}>Vs. OSDE</th></>}
            </tr></thead>
            <tbody>
              {results.map(r=>{
                const vs=vsAnterior(r);
                const stored=planMappingOsde[r.osdeKey];
                const osdePlan=stored!=null?stored:((osde||{})[r.planVigente]?r.planVigente:"");
                const osdeRes=osdePlan&&(osde||{})[osdePlan]?calcOsdeFromEmps(r.empList,osde[osdePlan]):null;
                const difOsde=osdeRes&&osdeRes.total>0?(r.bd.totalFac/osdeRes.total-1)*100:null;
                return(<tr key={r.osdeKey}>
                  {!isSim&&<td style={td({fontWeight:600})}>{zonaBadge(r.zona)}{r.planVigente}</td>}
                  <td style={td({fontWeight:700,color:BLUE,whiteSpace:"nowrap"})}>{isSim&&zonaBadge(r.zona)}{r.cotId}</td>
                  <td style={td()}><input value={planCustomNames[r.adjKey]??r.cotId} onChange={e=>setPlanCustomNames(prev=>({...prev,[r.adjKey]:e.target.value}))} aria-label={`Nombre en la propuesta de ${r.cotId}`} style={{...inp,padding:"5px 8px",fontSize:12,width:150}}/></td>
                  <td style={td({textAlign:"right",color:"#4B5563"})}>{r.bd.totalSocios}</td>
                  <td style={td({textAlign:"right",fontWeight:700})}>${fmt(r.bd.totalFac)}</td>
                  <td style={td({textAlign:"right",color:"#B42318"})}>${fmt(r.bd.totalCosto)}</td>
                  <td style={td({textAlign:"right"})}>{cfBadge(r.bd.cfTotal)}</td>
                  {isSim&&<td style={td({textAlign:"right",color:"#4B5563"})}>{vs===null?"—":fmtPct(vs/100)}</td>}
                  {hayOsde&&<>
                    <td style={td()}><select value={osdePlan} onChange={e=>setPlanMappingOsde(p=>({...p,[r.osdeKey]:e.target.value}))} aria-label={`Plan OSDE para ${r.planVigente}`} style={{...inp,width:96,fontSize:12,padding:"4px 6px"}}>
                      <option value="">—</option>{osdePlans.map(p=><option key={p} value={p}>{p}</option>)}
                    </select></td>
                    <td style={td({textAlign:"right",color:"#7C3AED"})}>{osdeRes?`$${fmt(osdeRes.total)}`:"—"}</td>
                    <td style={td({textAlign:"right"})}>{difOsde===null?"—":<span style={{...badge(difOsde<0?"#065F46":"#B42318",difOsde<0?"#D1FAE5":"#FEF2F2")}}>{fmtPct(difOsde/100)}</span>}</td>
                  </>}
                </tr>);
              })}
              {!isSim&&results.length>1&&(<tr style={{background:BLUE_LT}}>
                <td style={td({fontWeight:700,color:BLUE})} colSpan={3}>Total</td>
                <td style={td({textAlign:"right",fontWeight:700})}>{results.reduce((a,r)=>a+r.bd.totalSocios,0)}</td>
                <td style={td({textAlign:"right",fontWeight:700})}>${fmt(grandFac)}</td>
                <td style={td({textAlign:"right",fontWeight:700,color:"#B42318"})}>${fmt(grandCosto)}</td>
                <td style={td({textAlign:"right"})}>{cfBadge(grandCF)}</td>
                {hayOsde&&<td colSpan={3} style={td()}/>}
              </tr>)}
            </tbody>
          </table>
        </Seccion>
    </div>
  </div>);
}

export default Planilla;
