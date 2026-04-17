import { useState, Fragment } from "react";
import { FONT, BLUE, BLUE_LT, BORDER, GRAY, ZONA_COLORS } from "../constants";
import { fmt, fmtD, cfColor, cfBg } from "../utils";
import { badge, btnP, btnS, card, TH, TD } from "../styles";

// ── HISTORIAL ─────────────────────────────────────────────────────────────────
function Historial({quotes,onUpdate,onDelete,onRenameEmpresa}){
  const [open,setOpen]=useState({});
  const [expandedSnaps,setExpandedSnaps]=useState({});
  const [renamingEmpresa,setRenamingEmpresa]=useState(null); // empresa name being renamed
  const [renameVal,setRenameVal]=useState("");

  const groups={};
  quotes.forEach(q=>{const k=(q.empresa||"Sin nombre").trim();if(!groups[k])groups[k]=[];groups[k].push(q);});
  Object.values(groups).forEach(g=>g.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)));
  const empresas=Object.keys(groups).sort();

  const toggleSnap=id=>setExpandedSnaps(p=>({...p,[id]:!p[id]}));

  function startRename(name){setRenamingEmpresa(name);setRenameVal(name);}
  function confirmRename(){
    const newName=renameVal.trim();
    if(newName&&newName!==renamingEmpresa&&onRenameEmpresa)onRenameEmpresa(renamingEmpresa,newName);
    setRenamingEmpresa(null);
  }

  function handleDeleteQuote(id){
    if(!confirm("¿Eliminar esta cotización?"))return;
    onDelete&&onDelete(id);
  }

  function handleDeleteEmpresa(name){
    if(!confirm(`¿Eliminar la carpeta "${name}" y todas sus cotizaciones?`))return;
    groups[name].forEach(q=>onDelete&&onDelete(q.id));
  }

  if(!empresas.length)return(<div><h2 style={{fontSize:22,fontWeight:700,color:BLUE,marginBottom:"1.25rem",fontFamily:FONT}}>Historial</h2><div style={{...card(),textAlign:"center",padding:"3rem",color:"#9CA3AF"}}><div style={{fontSize:40,marginBottom:12}}>📁</div><p style={{fontFamily:FONT}}>No hay cotizaciones todavía.</p></div></div>);

  return(<div>
    <h2 style={{fontSize:22,fontWeight:700,color:BLUE,marginBottom:6,fontFamily:FONT}}>Historial</h2>
    <p style={{fontSize:13,color:"#6B7280",marginBottom:"1.25rem",fontFamily:FONT}}>{empresas.length} empresa{empresas.length>1?"s":""} · {quotes.length} cotizaciones</p>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {empresas.map(name=>{
        const list=groups[name],isOpen=open[name];
        const nAb=list.filter(q=>q.status==="abierto").length,nCe=list.filter(q=>q.status==="cerrado").length;
        const isRenaming=renamingEmpresa===name;
        return(
          <div key={name} style={{border:`1px solid ${BORDER}`,borderRadius:12,overflow:"hidden",background:"#fff"}}>
            {/* Carpeta header */}
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"14px 18px",background:isOpen?BLUE_LT:"#fff",borderBottom:isOpen?`1px solid ${BORDER}`:"none"}}>
              <button onClick={()=>setOpen(p=>({...p,[name]:!p[name]}))} style={{display:"flex",alignItems:"center",gap:10,flex:1,border:"none",background:"none",textAlign:"left",cursor:"pointer",fontFamily:FONT,padding:0,minWidth:0}}>
                <span style={{fontSize:18}}>{isOpen?"📂":"📁"}</span>
                {!isRenaming&&<span style={{fontSize:14,fontWeight:700,color:BLUE,fontFamily:FONT,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</span>}
                {isRenaming&&<span style={{flex:1}}/>}
              </button>
              {/* Rename inline input */}
              {isRenaming&&(
                <input
                  autoFocus
                  value={renameVal}
                  onChange={e=>setRenameVal(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter")confirmRename();if(e.key==="Escape")setRenamingEmpresa(null);}}
                  onBlur={confirmRename}
                  style={{fontSize:13,fontFamily:FONT,fontWeight:600,color:BLUE,border:`1.5px solid ${BLUE}`,borderRadius:6,padding:"3px 8px",outline:"none",width:200,background:"#fff"}}
                  onClick={e=>e.stopPropagation()}
                />
              )}
              <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                {nAb>0&&<span style={badge("#92400E","#FEF3C7")}>{nAb} ab.</span>}
                {nCe>0&&<span style={badge("#065F46","#D1FAE5")}>{nCe} ce.</span>}
                <span style={{fontSize:11,color:"#9CA3AF",fontFamily:FONT,marginLeft:2}}>{list.length} cot.</span>
                {/* Rename button */}
                {!isRenaming&&<button onClick={e=>{e.stopPropagation();startRename(name);}} title="Renombrar carpeta" style={{border:`1px solid ${BORDER}`,background:"#fff",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#374151",fontFamily:FONT}}>✏️</button>}
                {/* Delete folder button */}
                <button onClick={e=>{e.stopPropagation();handleDeleteEmpresa(name);}} title="Eliminar carpeta" style={{border:"1px solid #FCA5A5",background:"#fff",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#DC2626",fontFamily:FONT}}>🗑</button>
                <span style={{fontSize:11,color:"#9CA3AF",marginLeft:2}}>{isOpen?"▲":"▼"}</span>
              </div>
            </div>

            {/* Cotizaciones table */}
            {isOpen&&<div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead><tr>{["Fecha","Socios","Facturación","Costo","C/F","Estado",""].map((h,i)=><th key={h+i} style={TH({textAlign:i===0?"left":"right"})}>{h}</th>)}</tr></thead>
                <tbody>{list.map(q=>{
                  const cf=q.cfTotal||0;
                  const expSnap=!!expandedSnaps[q.id];
                  return(<Fragment key={q.id}>
                    <tr>
                      <td style={TD({})}>{fmtD(q.fecha)}</td>
                      <td style={TD({textAlign:"right",color:"#6B7280"})}>{q.socios||"—"}</td>
                      <td style={TD({textAlign:"right",fontWeight:600,color:BLUE})}>${fmt(q.totalFac||q.total)}</td>
                      <td style={TD({textAlign:"right",color:"#DC2626"})}>${fmt(q.totalCosto||0)}</td>
                      <td style={TD({textAlign:"right"})}>{cf>0&&<span style={{...badge(cfColor(cf),cfBg(cf)),minWidth:52,display:"inline-block",textAlign:"center"}}>{cf.toFixed(1)}%</span>}</td>
                      <td style={TD({textAlign:"right"})}><span style={badge(q.status==="cerrado"?"#065F46":"#92400E",q.status==="cerrado"?"#D1FAE5":"#FEF3C7")}>{q.status==="cerrado"?"Cerrado":"Abierto"}</span></td>
                      <td style={TD({textAlign:"right"})}>
                        <div style={{display:"flex",gap:4,justifyContent:"flex-end"}}>
                          {q.snapshot&&<button onClick={()=>toggleSnap(q.id)} style={{fontSize:11,padding:"4px 8px",border:`1px solid ${BORDER}`,borderRadius:6,cursor:"pointer",background:"#fff",color:"#374151",fontFamily:FONT}}>{expSnap?"▲":"▼"}</button>}
                          {q.status==="abierto"&&onUpdate&&<button onClick={()=>onUpdate(q.id,{status:"cerrado"})} style={{fontSize:11,padding:"4px 10px",border:`1px solid ${BORDER}`,borderRadius:6,cursor:"pointer",background:"#fff",color:BLUE,fontWeight:500,fontFamily:FONT}}>Cerrar</button>}
                          <button onClick={()=>handleDeleteQuote(q.id)} title="Eliminar cotización" style={{fontSize:11,padding:"4px 8px",border:"1px solid #FCA5A5",borderRadius:6,cursor:"pointer",background:"#fff",color:"#DC2626",fontFamily:FONT}}>🗑</button>
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
        );
      })}
    </div>
  </div>);
}


export default Historial;
