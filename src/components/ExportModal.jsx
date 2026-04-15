import { useState } from "react";
import { FONT, BLUE, BLUE_LT, BORDER, ZONA_COLORS } from "../constants";
import { fmt, fmtD } from "../utils";
import { badge, btnP, btnS, inp } from "../styles";
import { generateProposalHTML } from "../exportHTML";
import { exportAnalisisXLS } from "../exportXLS";

// ── MODAL EXPORTAR ────────────────────────────────────────────────────────────
function ExportModal({results,empresa,empsRef,onClose,brokerPct,osde,planMappingOsde}){
  const [cfg,setCfg]=useState({
    empresa:empresa||"",
    fecha:new Date().toISOString().split("T")[0],
    validez:"La propuesta tiene validez por 30 días.",
    formato:"completo",
    planesNombres:Object.fromEntries(results.map(r=>[r.adjKey,r.planId])),
    textoExtra:"",
    masaSalarial:"",
  });
  function upd(k,v){setCfg(p=>({...p,[k]:v}));}

  function exportPDF(){
    const html=generateProposalHTML(cfg,results);
    const blob=new Blob([html],{type:"text/html;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const w=window.open(url,"_blank");
    // Auto-print cuando carga
    if(w){
      w.addEventListener("load",()=>{
        setTimeout(()=>{w.print();},300);
      });
    }
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }

  const overlay={position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"};
  const modal={background:"#fff",borderRadius:16,padding:"2rem",width:"min(640px,95vw)",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"};

  return(
    <div style={overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={modal}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
          <h3 style={{fontSize:17,fontWeight:700,color:BLUE,fontFamily:FONT}}>Exportar propuesta</h3>
          <button onClick={onClose} style={{border:"none",background:"none",fontSize:20,cursor:"pointer",color:"#6B7280"}}>✕</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"1.25rem"}}>
          {[{k:"empresa",l:"Empresa",t:"text"},{k:"fecha",l:"Fecha de la propuesta",t:"date"},{k:"validez",l:"Texto de validez",t:"text"}].map(f=>(
            <div key={f.k}>
              <label style={{fontSize:11,fontWeight:600,color:"#374151",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.04em",fontFamily:FONT}}>{f.l}</label>
              <input type={f.t} value={cfg[f.k]} onChange={e=>upd(f.k,e.target.value)} style={inp}/>
            </div>
          ))}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"#374151",display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.04em",fontFamily:FONT}}>Formato de precios</label>
            <div style={{display:"flex",gap:10}}>
              {[{v:"completo",l:"Completo (7 categorías)"},{v:"ponderado",l:"Ponderado (0-59 y 60+)"}].map(o=>(
                <button key={o.v} onClick={()=>upd("formato",o.v)} style={{...cfg.formato===o.v?btnP:btnS,flex:1,textAlign:"center"}}>{o.l}</button>
              ))}
            </div>
            {cfg.formato==="ponderado"&&<p style={{fontSize:11,color:"#6B7280",marginTop:6,fontFamily:FONT}}>El precio "0 a 59" se calcula como promedio ponderado según la distribución de la nómina.</p>}
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"#374151",display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.04em",fontFamily:FONT}}>Nombre de planes (en la propuesta)</label>
            {results.map(r=>(
              <div key={r.adjKey} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <span style={{...badge(ZONA_COLORS[r.zona]?.c||BLUE,ZONA_COLORS[r.zona]?.bg||BLUE_LT),fontSize:11,minWidth:64}}>{r.zona}</span>
                <span style={{fontSize:12,color:"#6B7280",fontFamily:FONT,minWidth:90}}>{r.planId}</span>
                <span style={{fontSize:12,color:"#9CA3AF",fontFamily:FONT}}>→</span>
                <input value={cfg.planesNombres[r.adjKey]||r.planId} onChange={e=>setCfg(p=>({...p,planesNombres:{...p.planesNombres,[r.adjKey]:e.target.value}}))} style={{...inp,flex:1,padding:"6px 10px",fontSize:13}}/>
              </div>
            ))}
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"#374151",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.04em",fontFamily:FONT}}>Masa salarial (opcional)</label>
            <input type="number" value={cfg.masaSalarial} onChange={e=>upd("masaSalarial",e.target.value)} placeholder="Ej: 1239337852" style={inp}/>
            {cfg.masaSalarial&&parseFloat(cfg.masaSalarial)>0&&(()=>{
              const ms=parseFloat(cfg.masaSalarial);
              const aporte=ms*0.09*0.85*(1+1/12);
              const totalFac=results.reduce((a,r)=>a+r.bd.totalFac,0);
              return(<p style={{fontSize:11,color:"#6B7280",marginTop:5,fontFamily:FONT}}>
                Aporte estimado: <strong>${Math.round(aporte).toLocaleString("es-AR")}</strong> · Saldo: <strong style={{color:totalFac-aporte>0?"#DC2626":"#16A34A"}}>${Math.round(totalFac-aporte).toLocaleString("es-AR")}</strong>
              </p>);
            })()}
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"#374151",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.04em",fontFamily:FONT}}>Texto adicional (opcional)</label>
            <textarea value={cfg.textoExtra} onChange={e=>upd("textoExtra",e.target.value)} rows={3} placeholder="Se agrega como bullet adicional en notas..." style={{...inp,resize:"vertical",lineHeight:1.5}}/>
          </div>
          <div style={{display:"flex",gap:10,marginTop:"0.5rem"}}>
            <button onClick={exportPDF} style={{...btnP,flex:1}}>📄 Exportar PDF</button>
            <button onClick={()=>{try{exportAnalisisXLS(results,cfg.empresa,empsRef,brokerPct,osde,planMappingOsde,cfg.masaSalarial);onClose();}catch(e){alert("Error al exportar Excel: "+e.message);}}} style={{...btnS,flex:1}}>📊 Exportar Excel</button>
          </div>
          <p style={{fontSize:11,color:"#9CA3AF",fontFamily:FONT,textAlign:"center"}}>El PDF se abre en una nueva pestaña → usá Ctrl+P o Cmd+P para guardar como PDF</p>
        </div>
      </div>
    </div>
  );
}


export default ExportModal;
