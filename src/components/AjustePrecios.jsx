import { useState } from "react";
import { FONT, BLUE, BLUE_LT, BORDER, CATS, CAT_IDS } from "../constants";
import { pctAjuste } from "../calc";

// Porcentaje editable: guarda un borrador mientras se escribe y aplica al salir o con Enter
function PctInput({value,onCommit,label}){
  const fmtPct=v=>v?String(Math.round(v*10000)/100):"";
  const [draft,setDraft]=useState(fmtPct(value));
  const [synced,setSynced]=useState(value);
  if(synced!==value){setSynced(value);setDraft(fmtPct(value));}
  function commit(){
    const n=parseFloat(String(draft).replace(",","."));
    const v=isNaN(n)?0:n/100;
    if(v!==value)onCommit(v);
    else setDraft(fmtPct(value));
  }
  return(<label style={{display:"flex",flexDirection:"column",gap:3,fontSize:10.5,color:"#6B7280",fontFamily:FONT,fontWeight:600}}>
    {label}
    <span style={{display:"flex",alignItems:"center",gap:3}}>
      <input value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>e.key==="Enter"&&e.currentTarget.blur()}
        placeholder="0" inputMode="decimal"
        style={{width:58,textAlign:"right",fontSize:12,padding:"4px 6px",border:`1px solid ${value?BLUE:BORDER}`,borderRadius:6,fontFamily:FONT,color:value?BLUE:"#111827",background:"#fff",colorScheme:"light"}}/>
      <span style={{fontSize:12,color:"#6B7280"}}>%</span>
    </span>
  </label>);
}

const RANGO_LABEL={s0_25:"00-25",s26_34:"26-35",s35_54:"36-54",s55_59:"55-59",s60plus:"60+",h1:"Hijo 1",h2plus:"Hijo 2+"};

// ── AJUSTE DE PRECIOS DE UN PLAN ──────────────────────────────────────────────
// adj: {modo:"rango059",pct059,pct60} | {modo:"rango",cats:{...}} — onChange(nuevoAdj)
function AjustePrecios({adj,onChange}){
  const modo=adj?.modo==="rango"?"rango":"rango059";
  function cambiarModo(m){
    if(m===modo)return;
    if(m==="rango"){
      // Pasar a por rango sin cambiar precios: cada rango toma el % que tiene hoy
      onChange({modo:"rango",cats:Object.fromEntries(CAT_IDS.map(id=>[id,pctAjuste(adj,id)]))});
    }else{
      // Volver a 0-59/60+: si todos los rangos 0-59 tienen el mismo %, se conserva
      const p059=CAT_IDS.filter(id=>id!=="s60plus").map(id=>pctAjuste(adj,id));
      onChange({modo:"rango059",pct059:p059.every(v=>v===p059[0])?p059[0]:0,pct60:pctAjuste(adj,"s60plus")});
    }
  }
  const btn=act=>({fontSize:11,padding:"4px 10px",borderRadius:6,cursor:"pointer",fontFamily:FONT,fontWeight:600,
    border:`1px solid ${act?BLUE:BORDER}`,background:act?BLUE:"#fff",color:act?"#fff":BLUE});
  return(<div style={{display:"flex",alignItems:"flex-end",gap:14,flexWrap:"wrap",padding:"10px 14px",marginBottom:"0.75rem",background:BLUE_LT,borderRadius:8,border:`1px solid ${BORDER}`}}>
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      <span style={{fontSize:11,fontWeight:700,color:BLUE,fontFamily:FONT,textTransform:"uppercase",letterSpacing:"0.04em"}}>Ajuste de precios</span>
      <div style={{display:"flex",gap:4}}>
        <button onClick={()=>cambiarModo("rango059")} style={btn(modo==="rango059")}>0-59 / 60+</button>
        <button onClick={()=>cambiarModo("rango")} style={btn(modo==="rango")}>Por rango</button>
      </div>
    </div>
    {modo==="rango059"?(<>
      <PctInput label="0-59" value={adj?.pct059||0} onCommit={v=>onChange({modo:"rango059",pct059:v,pct60:adj?.pct60||0})}/>
      <PctInput label="60+" value={adj?.pct60||0} onCommit={v=>onChange({modo:"rango059",pct059:adj?.pct059||0,pct60:v})}/>
    </>):CATS.map(c=>(
      <PctInput key={c.id} label={RANGO_LABEL[c.id]} value={adj?.cats?.[c.id]||0}
        onCommit={v=>onChange({modo:"rango",cats:{...(adj?.cats||{}),[c.id]:v}})}/>
    ))}
    <span style={{fontSize:11,color:"#6B7280",fontFamily:FONT,flexBasis:"100%"}}>Sobre el precio de lista. Ej: -10 baja 10%. También podés escribir el precio en la tabla.</span>
  </div>);
}

export default AjustePrecios;
