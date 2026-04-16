import { useState } from "react";
import { FONT, BLUE, BLUE_LT, BORDER, GRAY, CATS, CAT_IDS, MEJORAS_DEF, EMPTY_MEJORAS } from "../constants";
import { btnP, btnS, inp, card, TH, TD } from "../styles";

// ── MEJORAS VIGENTES ──────────────────────────────────────────────────────────
function MejorasVigentes({mejoras,onSave}){
  const [loc,setLoc]=useState(()=>{
    const base={...EMPTY_MEJORAS};
    MEJORAS_DEF.forEach(m=>{base[m.id]={...(mejoras[m.id]||{})};});
    return base;
  });
  const [ok,setOk]=useState(false);

  function save(){
    onSave(loc);
    setOk(true);
    setTimeout(()=>setOk(false),2500);
  }

  function addOption(mId){
    const name=prompt("Nombre de la opción:");
    if(!name?.trim())return;
    const key=name.trim();
    const mDef=MEJORAS_DEF.find(m=>m.id===mId);
    if(!mDef)return;
    setLoc(prev=>{
      const existing=prev[mId]||{};
      if(existing[key]!==undefined){alert("Ya existe esa opción.");return prev;}
      const defVal=mDef.type==="pmpm"?0:Object.fromEntries(CAT_IDS.map(c=>[c,0]));
      return {...prev,[mId]:{...existing,[key]:defVal}};
    });
  }

  function removeOption(mId,optKey){
    setLoc(prev=>({...prev,[mId]:Object.fromEntries(Object.entries(prev[mId]||{}).filter(([k])=>k!==optKey))}));
  }

  function renameOption(mId,oldKey,newKey){
    if(!newKey.trim()||newKey===oldKey)return;
    setLoc(prev=>{
      const opts={...prev[mId]};
      if(opts[newKey]!==undefined){alert("Ya existe esa opción.");return prev;}
      const val=opts[oldKey];
      const entries=Object.entries(opts);
      const idx=entries.findIndex(([k])=>k===oldKey);
      entries[idx]=[newKey,val];
      return {...prev,[mId]:Object.fromEntries(entries)};
    });
  }

  function setOptVal(mId,optKey,catKey,val){
    const mDef=MEJORAS_DEF.find(m=>m.id===mId);
    if(!mDef)return;
    setLoc(prev=>{
      const opts={...prev[mId]};
      if(mDef.type==="pmpm"){
        opts[optKey]=parseFloat(val)||0;
      } else {
        opts[optKey]={...(opts[optKey]||{}), [catKey]:parseFloat(val)||0};
      }
      return {...prev,[mId]:opts};
    });
  }

  // Single-option mejoras that use "default" key (pyt has type=cats but is single toggle)
  const SINGLE_KEY_IDS=["optica"];

  return(<div>
    <h2 style={{fontSize:22,fontWeight:700,color:"#059669",marginBottom:4,fontFamily:FONT}}>Mejoras / Beneficios adicionales</h2>
    <p style={{fontSize:13,color:"#6B7280",marginBottom:"1.5rem",fontFamily:FONT}}>Configurá los costos de cada mejora opcional. Estas se pueden activar por plan en el Cotizador.</p>

    <div style={{display:"flex",flexDirection:"column",gap:"1.5rem"}}>
      {MEJORAS_DEF.map(m=>{
        const opts=loc[m.id]||{};
        const optEntries=Object.entries(opts);
        const isSingle=SINGLE_KEY_IDS.includes(m.id);

        return(<div key={m.id} style={card()}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.75rem"}}>
            <h3 style={{fontSize:14,fontWeight:700,color:"#059669",fontFamily:FONT}}>{m.label}</h3>
            {!isSingle&&<button onClick={()=>addOption(m.id)} style={{...btnS,fontSize:11,padding:"4px 10px",color:"#059669",border:"1px solid #059669"}}>＋ Agregar opción</button>}
            {isSingle&&optEntries.length===0&&<button onClick={()=>setLoc(prev=>({...prev,[m.id]:{default:0}}))} style={{...btnS,fontSize:11,padding:"4px 10px",color:"#059669",border:"1px solid #059669"}}>＋ Activar</button>}
          </div>

          {optEntries.length===0&&<p style={{fontSize:12,color:"#9CA3AF",fontFamily:FONT,fontStyle:"italic"}}>Sin opciones configuradas.</p>}

          {optEntries.map(([optKey,optVal])=>{
            const isDefault=optKey==="default";
            return(<div key={optKey} style={{marginBottom:"0.75rem",padding:"10px 12px",background:GRAY,borderRadius:8,border:`1px solid ${BORDER}`}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:m.type==="cats"?8:0}}>
                <input
                  type="text"
                  value={isDefault?"Estándar":optKey}
                  disabled={isDefault}
                  onChange={e=>renameOption(m.id,optKey,e.target.value)}
                  onBlur={e=>{if(!isDefault)renameOption(m.id,optKey,e.target.value.trim());}}
                  style={{...inp,maxWidth:220,fontSize:12,padding:"4px 8px",background:isDefault?"#F3F4F6":"#fff",color:isDefault?"#6B7280":"#111827"}}
                />
                {m.type==="pmpm"&&(
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:11,color:"#6B7280",fontFamily:FONT}}>PMPM $</span>
                    <input type="number" min={0} value={optVal} onChange={e=>setOptVal(m.id,optKey,null,e.target.value)} style={{...inp,width:120,textAlign:"right",fontSize:12,padding:"4px 8px"}}/>
                  </div>
                )}
                {!isDefault&&<button onClick={()=>removeOption(m.id,optKey)} style={{marginLeft:"auto",border:"none",background:"none",cursor:"pointer",color:"#DC2626",fontSize:16,lineHeight:1}} title="Eliminar">✕</button>}
                {isDefault&&<button onClick={()=>removeOption(m.id,optKey)} style={{marginLeft:"auto",border:"none",background:"none",cursor:"pointer",color:"#DC2626",fontSize:16,lineHeight:1}} title="Desactivar">✕</button>}
              </div>

              {m.type==="cats"&&(
                <div style={{overflowX:"auto"}}>
                  <table style={{borderCollapse:"collapse",fontSize:11,width:"100%",minWidth:540}}>
                    <thead><tr>
                      {CATS.map(c=><th key={c.id} style={{padding:"4px 6px",background:"#059669",color:"#fff",fontWeight:600,textAlign:"center",fontFamily:FONT,whiteSpace:"nowrap"}}>{c.label}</th>)}
                    </tr></thead>
                    <tbody><tr>
                      {CATS.map(c=><td key={c.id} style={{padding:"3px 4px",textAlign:"center"}}>
                        <input type="number" min={0} value={(optVal||{})[c.id]||0} onChange={e=>setOptVal(m.id,optKey,c.id,e.target.value)} style={{...inp,width:72,textAlign:"right",fontSize:11,padding:"3px 5px"}}/>
                      </td>)}
                    </tr></tbody>
                  </table>
                </div>
              )}
            </div>);
          })}
        </div>);
      })}
    </div>

    <div style={{marginTop:"1.5rem",display:"flex",gap:12,alignItems:"center"}}>
      <button onClick={save} style={{...btnP,background:"#059669"}}>{ok?"✓ Guardado":"Guardar"}</button>
      {ok&&<span style={{fontSize:13,color:"#059669",fontFamily:FONT}}>Guardado correctamente</span>}
    </div>
  </div>);
}


export default MejorasVigentes;
