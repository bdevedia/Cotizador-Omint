import { useState, useEffect } from "react";
import { FONT, BLUE, BORDER, CATS, EMPTY_CATS } from "../constants";
import { fmt } from "../utils";
import { btnP, btnS, inp, numInp, card, TH, TD } from "../styles";
import AjusteHistorial from "./AjusteHistorial";

// ── COSTOS VIGENTES ───────────────────────────────────────────────────────────
function CostosVigentes({costos,onSave,ajustes=[],onAjusteUpdate}){
  const plans=Object.keys(costos||{}).sort();
  const [plan,setPlan]=useState(plans[0]||null);
  const [loc,setLoc]=useState({});const[ok,setOk]=useState(false);
  const selPlan=plans.includes(plan)?plan:(plans[0]||null);
  useEffect(()=>{setLoc({...EMPTY_CATS,...(costos?.[selPlan]||{})});},[selPlan,costos]);
  function save(){const nxt={...costos,[selPlan]:{...loc}};onSave(nxt);setOk(true);setTimeout(()=>setOk(false),2500);}
  return(<div>
    <h2 style={{fontSize:22,fontWeight:700,color:"#7C3AED",marginBottom:4,fontFamily:FONT}}>Costos Vigentes</h2>
    <p style={{fontSize:13,color:"#6B7280",marginBottom:"1.5rem",fontFamily:FONT}}>Costos (Cerrado+Abierto) por plan, iguales para todas las zonas.</p>
    {plans.length===0&&<div style={{...card(),padding:"2rem",textAlign:"center",color:"#9CA3AF"}}><p style={{fontFamily:FONT}}>No hay costos cargados. Importá el archivo de rentabilidad.</p></div>}
    {plans.length>0&&<>
      <div style={{display:"flex",gap:6,marginBottom:"1.25rem",flexWrap:"wrap"}}>
        {plans.map(p=><button key={p} onClick={()=>setPlan(p)} style={{...selPlan===p?{...btnP,background:"#7C3AED",padding:"6px 12px",fontSize:12}:{...btnS,padding:"6px 12px",fontSize:12}}}>{p}</button>)}
      </div>
      {selPlan&&<div style={card()}>
        <table style={{borderCollapse:"collapse",fontSize:13,width:"100%",maxWidth:460}}>
          <thead><tr><th style={TH({textAlign:"left"})}>Categoría</th><th style={TH({color:"#7C3AED"})}>Costo C+A ($)</th></tr></thead>
          <tbody>{CATS.map(c=><tr key={c.id}><td style={TD({fontWeight:500})}>{c.label}</td>
            <td style={TD({textAlign:"right"})}><input type="number" min={0} value={loc[c.id]||0} onChange={e=>setLoc(p=>({...p,[c.id]:parseFloat(e.target.value)||0}))} style={{...inp,width:180,textAlign:"right"}}/></td></tr>)}
          </tbody>
        </table>
        <div style={{marginTop:"1.25rem",display:"flex",gap:12,alignItems:"center"}}>
          <button onClick={save} style={{...btnP,background:"#7C3AED"}}>{ok?"✓ Guardado":"Guardar"}</button>
          {ok&&<span style={{fontSize:13,color:"#16a34a",fontFamily:FONT}}>Guardado correctamente</span>}
        </div>
      </div>}
    </>}
  <AjusteHistorial
    historial={ajustes}
    onUpdate={onAjusteUpdate}
    baseRef={costos?.[plans[0]]?.s0_25||0}
    accentColor="#7C3AED"
    titulo="Ajuste mensual — Costos"
  />
  </div>);
}


export default CostosVigentes;
