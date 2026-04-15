import { useState } from "react";
import { FONT, BLUE, BLUE_LT, BORDER, ZONA_IDS, ZONA_COLORS, CATS } from "../constants";
import { fmt } from "../utils";
import { badge, btnP, btnS, inp, numInp, card, TH, TD } from "../styles";

// ── PRECIOS VIGENTES ──────────────────────────────────────────────────────────
function PreciosVigentes({precios,onSave}){
  const allPlans=[...new Set(ZONA_IDS.flatMap(z=>Object.keys(precios?.[z]||{})))].sort();
  const [zona,setZona]=useState(ZONA_IDS[0]);
  const [plan,setPlan]=useState(null);
  const [loc,setLoc]=useState({});const[ok,setOk]=useState(false);
  const planList=Object.keys(precios?.[zona]||{}).sort();
  const selPlan=planList.includes(plan)?plan:(planList[0]||null);
  useEffect(()=>{if(selPlan)setLoc({...EMPTY_CATS,...(precios?.[zona]?.[selPlan]||{})});},[zona,selPlan,precios]);
  function save(){const nxt=JSON.parse(JSON.stringify(precios||{}));if(!nxt[zona])nxt[zona]={};nxt[zona][selPlan]={...loc};onSave(nxt);setOk(true);setTimeout(()=>setOk(false),2500);}
  const zc=ZONA_COLORS[zona]||{c:BLUE,bg:BLUE_LT};
  return(<div>
    <h2 style={{fontSize:22,fontWeight:700,color:BLUE,marginBottom:4,fontFamily:FONT}}>Precios Vigentes</h2>
    <p style={{fontSize:13,color:"#6B7280",marginBottom:"1.5rem",fontFamily:FONT}}>Precios por zona y plan (banda 200-499 cápitas). Podés importarlos o editarlos manualmente.</p>
    {allPlans.length===0&&<div style={{...card(),padding:"2rem",textAlign:"center",color:"#9CA3AF"}}><p style={{fontFamily:FONT}}>No hay precios cargados. Importá el archivo de lista de precios.</p></div>}
    {allPlans.length>0&&<>
      <div style={{display:"flex",gap:8,marginBottom:"0.75rem",flexWrap:"wrap"}}>
        {ZONA_IDS.map(z=>{const zc2=ZONA_COLORS[z];return(<button key={z} onClick={()=>setZona(z)} style={{padding:"7px 16px",fontSize:13,fontFamily:FONT,borderRadius:8,cursor:"pointer",fontWeight:zona===z?700:400,background:zona===z?zc2.c:"#fff",color:zona===z?"#fff":zc2.c,border:`1.5px solid ${zc2.c}`}}>{z}</button>);})}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:"1.25rem",flexWrap:"wrap"}}>
        {planList.map(p=><button key={p} onClick={()=>setPlan(p)} style={{...selPlan===p?{...btnP,background:zc.c,padding:"6px 12px",fontSize:12}:{...btnS,padding:"6px 12px",fontSize:12}}}>{p}</button>)}
      </div>
      {selPlan&&<div style={card()}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:"1rem"}}>
          <span style={{...badge(zc.c,zc.bg),fontSize:11}}>{zona}</span>
          <span style={{...badge("#fff",BLUE),fontSize:11}}>{selPlan}</span>
          <span style={{...badge("#374151","#F3F4F6"),fontSize:11}}>200-499 cápitas</span>
        </div>
        <table style={{borderCollapse:"collapse",fontSize:13,width:"100%",maxWidth:460}}>
          <thead><tr><th style={TH({textAlign:"left"})}>Categoría</th><th style={TH()}>Precio ($)</th></tr></thead>
          <tbody>{CATS.map(c=><tr key={c.id}><td style={TD({fontWeight:500})}>{c.label}</td>
            <td style={TD({textAlign:"right"})}><input type="number" min={0} value={loc[c.id]||0} onChange={e=>setLoc(p=>({...p,[c.id]:parseFloat(e.target.value)||0}))} style={{...inp,width:180,textAlign:"right"}}/></td></tr>)}
          </tbody>
        </table>
        <div style={{marginTop:"1.25rem",display:"flex",gap:12,alignItems:"center"}}>
          <button onClick={save} style={{...btnP,background:zc.c}}>{ok?"✓ Guardado":"Guardar"}</button>
          {ok&&<span style={{fontSize:13,color:"#16a34a",fontFamily:FONT}}>Guardado correctamente</span>}
        </div>
      </div>}
    </>}
  </div>);
}


export default PreciosVigentes;
