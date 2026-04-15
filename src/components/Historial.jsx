import { useState } from "react";
import { FONT, BLUE, BLUE_LT, BORDER, GRAY, ZONA_COLORS } from "../constants";
import { fmt, fmtD, cfColor, cfBg } from "../utils";
import { badge, btnP, btnS, card, TH, TD } from "../styles";

// ── HISTORIAL ─────────────────────────────────────────────────────────────────
function Historial({quotes,onUpdate}){
  const [open,setOpen]=useState({});
  const [expandedSnaps,setExpandedSnaps]=useState({}); // {quoteId: bool} — fuera del map
  const groups={};quotes.forEach(q=>{const k=(q.empresa||"Sin nombre").trim();if(!groups[k])groups[k]=[];groups[k].push(q);});
  Object.values(groups).forEach(g=>g.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)));
  const empresas=Object.keys(groups).sort();
  const toggleSnap=id=>setExpandedSnaps(p=>({...p,[id]:!p[id]}));
  if(!empresas.length)return(<div><h2 style={{fontSize:22,fontWeight:700,color:BLUE,marginBottom:"1.25rem",fontFamily:FONT}}>Historial</h2><div style={{...card(),textAlign:"center",padding:"3rem",color:"#9CA3AF"}}><div style={{fontSize:40,marginBottom:12}}>📁</div><p style={{fontFamily:FONT}}>No hay cotizaciones todavía.</p></div></div>);
  return(<div>
    <h2 style={{fontSize:22,fontWeight:700,color:BLUE,marginBottom:6,fontFamily:FONT}}>Historial</h2>
    <p style={{fontSize:13,color:"#6B7280",marginBottom:"1.25rem",fontFamily:FONT}}>{empresas.length} empresa{empresas.length>1?"s":""} · {quotes.length} cotizaciones</p>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {empresas.map(name=>{const list=groups[name],isOpen=open[name],nAb=list.filter(q=>q.status==="abierto").length,nCe=list.filter(q=>q.status==="cerrado").length;return(
        <div key={name} style={{border:`1px solid ${BORDER}`,borderRadius:12,overflow:"hidden",background:"#fff"}}>
          <button onClick={()=>setOpen(p=>({...p,[name]:!p[name]}))} style={{display:"flex",alignItems:"center",gap:12,width:"100%",padding:"14px 18px",border:"none",textAlign:"left",background:isOpen?BLUE_LT:"#fff",cursor:"pointer",fontFamily:FONT}}>
            <span style={{fontSize:18}}>{isOpen?"📂":"📁"}</span><span style={{fontSize:14,fontWeight:700,flex:1,color:BLUE,fontFamily:FONT}}>{name}</span>
            <span style={{fontSize:11,color:"#9CA3AF",fontFamily:FONT}}>{list.length} cotización{list.length>1?"es":""}</span>
            <div style={{display:"flex",gap:6,marginLeft:8}}>{nAb>0&&<span style={badge("#92400E","#FEF3C7")}>{nAb} ab.</span>}{nCe>0&&<span style={badge("#065F46","#D1FAE5")}>{nCe} ce.</span>}</div>
            <span style={{fontSize:11,color:"#9CA3AF",marginLeft:6}}>{isOpen?"▲":"▼"}</span>
          </button>
          {isOpen&&<div style={{borderTop:`1px solid ${BORDER}`}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr>{["Fecha","Socios","Facturación","Costo","C/F","Estado",""].map((h,i)=><th key={h} style={TH({textAlign:i===0?"left":"right"})}>{h}</th>)}</tr></thead>
              <tbody>{list.map(q=>{
                const cf=q.cfTotal||0;
                const expSnap=!!expandedSnaps[q.id];
                return(<Fragment key={q.id}>
                  <tr>
                    <td style={TD({})}>{fmtD(q.fecha)}</td><td style={TD({textAlign:"right",color:"#6B7280"})}>{q.socios||"—"}</td>
                    <td style={TD({textAlign:"right",fontWeight:600,color:BLUE})}>${fmt(q.totalFac||q.total)}</td>
                    <td style={TD({textAlign:"right",color:"#DC2626"})}>${fmt(q.totalCosto||0)}</td>
                    <td style={TD({textAlign:"right"})}>{cf>0&&<span style={{...badge(cfColor(cf),cfBg(cf)),minWidth:52,display:"inline-block",textAlign:"center"}}>{cf.toFixed(1)}%</span>}</td>
                    <td style={TD({textAlign:"right"})}><span style={badge(q.status==="cerrado"?"#065F46":"#92400E",q.status==="cerrado"?"#D1FAE5":"#FEF3C7")}>{q.status==="cerrado"?"Cerrado":"Abierto"}</span></td>
                    <td style={TD({textAlign:"right"})}>
                      <div style={{display:"flex",gap:4,justifyContent:"flex-end"}}>
                        {q.snapshot&&<button onClick={()=>toggleSnap(q.id)} style={{fontSize:11,padding:"4px 8px",border:`1px solid ${BORDER}`,borderRadius:6,cursor:"pointer",background:"#fff",color:"#374151",fontFamily:FONT}}>{expSnap?"▲":"▼"}</button>}
                        {q.status==="abierto"&&onUpdate&&<button onClick={()=>onUpdate(q.id,{status:"cerrado"})} style={{fontSize:11,padding:"4px 10px",border:`1px solid ${BORDER}`,borderRadius:6,cursor:"pointer",background:"#fff",color:BLUE,fontWeight:500,fontFamily:FONT}}>Cerrar</button>}
                      </div>
                    </td>
                  </tr>
                  {expSnap&&q.snapshot&&<tr><td colSpan={7} style={{padding:"8px 16px",background:GRAY,borderBottom:`1px solid ${BORDER}`}}>
                    <div style={{fontSize:11,fontFamily:FONT,color:"#374151",marginBottom:6,fontWeight:600}}>Detalle de precios cotizados:</div>
                    <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                      {q.snapshot.map((s,si)=><div key={si} style={{padding:"8px 12px",background:"#fff",borderRadius:8,border:`1px solid ${BORDER}`,minWidth:180}}>
                        <p style={{fontSize:11,fontWeight:700,color:BLUE,fontFamily:FONT,marginBottom:4}}>{s.zona} · {s.planId}</p>
                        <p style={{fontSize:11,color:"#6B7280",fontFamily:FONT}}>{s.socios} socios · C/F {s.cf?.toFixed(1)}%</p>
                        <p style={{fontSize:11,color:BLUE,fontFamily:FONT}}>Fac: ${fmt(s.fac)}</p>
                      </div>)}
                    </div>
                    {q.aiLog?.length>0&&<div style={{marginTop:8}}><p style={{fontSize:11,fontWeight:600,color:"#374151",fontFamily:FONT,marginBottom:4}}>Ajustes IA:</p>{q.aiLog.map((l,li)=><p key={li} style={{fontSize:11,color:"#6B7280",fontFamily:FONT}}>• {l.ts} — {l.pedido}</p>)}</div>}
                  </td></tr>}
                </Fragment>);
              })}</tbody>
            </table>
          </div>}
        </div>
      );})}
    </div>
  </div>);
}


export default Historial;
