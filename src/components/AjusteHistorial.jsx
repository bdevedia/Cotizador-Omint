import { useState } from "react";
import { FONT, BLUE, BORDER } from "../constants";
import { btnP, btnS, inp, card } from "../styles";

// ── AJUSTE HISTORIAL ──────────────────────────────────────────────────────────
// historial : [{mes:"2025-04", pct:5.2, nota:""}]
// baseRef   : precio de referencia para modo "ajustar a precio"
// onUpdate  : fn(nuevoHistorial)
// accentColor, titulo

export function calcMultiplier(historial){
  return (historial||[]).reduce((m,e)=>m*(1+e.pct/100),1);
}

function fmtMes(m){
  if(!m)return"";
  const [y,mo]=m.split("-");
  const meses=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return`${meses[parseInt(mo)-1]} ${y}`;
}

function AjusteHistorial({historial=[],onUpdate,baseRef=0,accentColor=BLUE,titulo="Ajuste mensual"}){
  const today=new Date();
  const mesActual=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;

  const [mes,setMes]=useState(mesActual);
  const [pct,setPct]=useState("");
  const [nota,setNota]=useState("");
  const [refNuevo,setRefNuevo]=useState("");
  const [mode,setMode]=useState("pct"); // "pct" | "ref"

  const multiplierTotal=calcMultiplier(historial);
  const efectivoRef=baseRef?Math.round(baseRef*multiplierTotal):0;

  const pctFromRef=refNuevo&&efectivoRef
    ?((parseFloat(refNuevo)/efectivoRef-1)*100).toFixed(2)
    :"";

  const pctToApply=mode==="ref"?(parseFloat(pctFromRef)||null):(parseFloat(pct)||null);
  const canApply=pctToApply!==null&&!isNaN(pctToApply);

  function aplicar(){
    if(!canApply)return;
    const nuevaEntrada={mes,pct:parseFloat(pctToApply.toFixed(4)),nota:nota.trim()};
    const nuevo=[...historial.filter(e=>e.mes!==mes),nuevaEntrada]
      .sort((a,b)=>a.mes.localeCompare(b.mes));
    onUpdate(nuevo);
    setPct("");setRefNuevo("");setNota("");
  }

  function eliminar(mesEntry){
    if(!confirm(`¿Eliminar el ajuste de ${fmtMes(mesEntry)}?`))return;
    onUpdate(historial.filter(e=>e.mes!==mesEntry));
  }

  // Historial con acumulado corrido
  let runCum=1;
  const histCum=historial.map(e=>{
    runCum*=(1+e.pct/100);
    return{...e,cumAcum:runCum};
  });

  const thS={padding:"8px 12px",fontFamily:FONT,fontWeight:600,color:"#6B7280",fontSize:11,
    textTransform:"uppercase",letterSpacing:"0.04em",border:"1px solid #E5E7EB",background:"#F9FAFB"};
  const tdS=(extra={})=>({padding:"7px 12px",fontFamily:FONT,border:"1px solid #E5E7EB",...extra});

  return(
    <div style={{marginTop:"2rem",borderTop:`2px solid ${BORDER}`,paddingTop:"1.5rem"}}>
      <h3 style={{fontSize:15,fontWeight:700,color:accentColor,fontFamily:FONT,marginBottom:"1rem"}}>
        📈 {titulo}
      </h3>

      {/* Banner resumen */}
      {historial.length>0&&(
        <div style={{display:"flex",gap:28,padding:"10px 18px",background:`${accentColor}14`,
          borderRadius:8,marginBottom:"1.25rem",alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <p style={{fontSize:11,color:accentColor,fontWeight:700,textTransform:"uppercase",
              letterSpacing:"0.04em",fontFamily:FONT,marginBottom:2}}>Acumulado desde base</p>
            <p style={{fontSize:22,fontWeight:800,color:accentColor,fontFamily:FONT,lineHeight:1}}>
              {((multiplierTotal-1)*100).toFixed(2)}%
            </p>
          </div>
          <div>
            <p style={{fontSize:11,color:"#6B7280",fontWeight:600,textTransform:"uppercase",
              letterSpacing:"0.04em",fontFamily:FONT,marginBottom:2}}>Multiplicador</p>
            <p style={{fontSize:20,fontWeight:700,color:"#374151",fontFamily:FONT,lineHeight:1}}>
              ×{multiplierTotal.toFixed(4)}
            </p>
          </div>
          {baseRef>0&&(
            <div>
              <p style={{fontSize:11,color:"#6B7280",fontWeight:600,textTransform:"uppercase",
                letterSpacing:"0.04em",fontFamily:FONT,marginBottom:2}}>Precio ref. vigente</p>
              <p style={{fontSize:20,fontWeight:700,color:"#374151",fontFamily:FONT,lineHeight:1}}>
                ${efectivoRef.toLocaleString("es-AR")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Formulario nuevo ajuste */}
      <div style={{...card(),marginBottom:"1.25rem",padding:"1rem 1.25rem"}}>
        <p style={{fontSize:12,fontWeight:700,color:"#374151",fontFamily:FONT,marginBottom:10,
          textTransform:"uppercase",letterSpacing:"0.04em"}}>Agregar ajuste</p>

        {/* Toggle modo */}
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          {[{v:"pct",l:"Ingresar %"},{v:"ref",l:"Ajustar a precio"}].map(o=>(
            <button key={o.v} onClick={()=>setMode(o.v)}
              style={{...mode===o.v?{...btnP,background:accentColor}:btnS,padding:"5px 12px",fontSize:12}}>
              {o.l}
            </button>
          ))}
        </div>

        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"#6B7280",fontFamily:FONT,display:"block",marginBottom:4}}>Mes</label>
            <input type="month" value={mes} onChange={e=>setMes(e.target.value)} style={{...inp,width:150}}/>
          </div>

          {mode==="pct"?(
            <div>
              <label style={{fontSize:11,fontWeight:600,color:"#6B7280",fontFamily:FONT,display:"block",marginBottom:4}}>Porcentaje</label>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <input type="number" step="0.01" value={pct} onChange={e=>setPct(e.target.value)}
                  placeholder="ej: 5.2" style={{...inp,width:100}}/>
                <span style={{fontSize:13,color:"#6B7280",fontFamily:FONT}}>%</span>
              </div>
            </div>
          ):(
            <div>
              <label style={{fontSize:11,fontWeight:600,color:"#6B7280",fontFamily:FONT,display:"block",marginBottom:4}}>
                Precio objetivo
                {baseRef>0&&<span style={{color:"#9CA3AF",fontWeight:400,marginLeft:5}}>(ref. actual: ${efectivoRef.toLocaleString("es-AR")})</span>}
              </label>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="number" step="1" value={refNuevo} onChange={e=>setRefNuevo(e.target.value)}
                  placeholder="ej: 12500" style={{...inp,width:130}}/>
                {pctFromRef&&(
                  <span style={{fontSize:13,fontWeight:700,color:parseFloat(pctFromRef)>=0?"#059669":"#DC2626",
                    fontFamily:FONT,whiteSpace:"nowrap"}}>
                    → {parseFloat(pctFromRef)>=0?"+":""}{pctFromRef}%
                  </span>
                )}
              </div>
            </div>
          )}

          <div>
            <label style={{fontSize:11,fontWeight:600,color:"#6B7280",fontFamily:FONT,display:"block",marginBottom:4}}>Nota (opcional)</label>
            <input type="text" value={nota} onChange={e=>setNota(e.target.value)}
              placeholder="ej: Lista feb 2026" style={{...inp,width:200}}/>
          </div>

          <button onClick={aplicar} disabled={!canApply}
            style={{...btnP,background:accentColor,opacity:canApply?1:0.45,cursor:canApply?"pointer":"default"}}>
            Aplicar
          </button>
        </div>
      </div>

      {/* Tabla historial */}
      {historial.length>0?(
        <div style={card()}>
          <p style={{fontSize:12,fontWeight:700,color:"#374151",fontFamily:FONT,marginBottom:10,
            textTransform:"uppercase",letterSpacing:"0.04em"}}>Historial de ajustes</p>
          <div style={{overflowX:"auto"}}>
            <table style={{borderCollapse:"collapse",width:"100%",fontSize:13}}>
              <thead>
                <tr>
                  <th style={{...thS,textAlign:"left"}}>Mes</th>
                  <th style={{...thS,textAlign:"right"}}>Ajuste del mes</th>
                  <th style={{...thS,textAlign:"right"}}>Acumulado</th>
                  {baseRef>0&&<th style={{...thS,textAlign:"right"}}>Precio ref.</th>}
                  <th style={{...thS,textAlign:"left"}}>Nota</th>
                  <th style={{...thS,textAlign:"center",width:40}}></th>
                </tr>
              </thead>
              <tbody>
                {histCum.map((e,i)=>(
                  <tr key={e.mes} style={{background:i%2===0?"#fff":"#FAFAFA"}}>
                    <td style={tdS({fontWeight:600})}>{fmtMes(e.mes)}</td>
                    <td style={tdS({textAlign:"right",fontWeight:700,
                      color:e.pct>=0?"#059669":"#DC2626"})}>
                      {e.pct>=0?"+":""}{e.pct}%
                    </td>
                    <td style={tdS({textAlign:"right",fontWeight:600,color:accentColor})}>
                      {((e.cumAcum-1)*100).toFixed(2)}%
                    </td>
                    {baseRef>0&&(
                      <td style={tdS({textAlign:"right"})}>
                        ${Math.round(baseRef*e.cumAcum).toLocaleString("es-AR")}
                      </td>
                    )}
                    <td style={tdS({color:"#6B7280",fontSize:12})}>{e.nota||"—"}</td>
                    <td style={tdS({textAlign:"center"})}>
                      <button onClick={()=>eliminar(e.mes)} title="Eliminar ajuste"
                        style={{border:"none",background:"none",cursor:"pointer",
                          color:"#DC2626",fontSize:14,padding:"2px 5px",lineHeight:1}}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ):(
        <p style={{fontSize:13,color:"#9CA3AF",fontFamily:FONT,fontStyle:"italic"}}>
          No hay ajustes registrados todavía.
        </p>
      )}
    </div>
  );
}

export default AjusteHistorial;
