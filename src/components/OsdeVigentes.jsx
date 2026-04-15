import { useState } from "react";
import { FONT, BLUE, BORDER, OSDE_CATS } from "../constants";
import { btnP, btnS, inp, numInp, card, TH, TD } from "../styles";
import { parseOsdeFile, downloadOsdeTemplate } from "../parsers";

// ── OSDE VIGENTES ─────────────────────────────────────────────────────────────
function OsdeVigentes({osde,onSave}){
  const plans=Object.keys(osde||{}).sort();
  const [plan,setPlan]=useState(plans[0]||null);
  const [newPlan,setNewPlan]=useState("");
  const [loc,setLoc]=useState({...EMPTY_OSDE});
  const [ok,setOk]=useState(false);
  const [importStatus,setImportStatus]=useState(null);
  const [importMsg,setImportMsg]=useState("");
  const selPlan=plans.includes(plan)?plan:(plans[0]||null);
  useEffect(()=>{if(selPlan)setLoc({...EMPTY_OSDE,...(osde[selPlan]||{})});},[selPlan,osde]);
  function save(){
    if(!selPlan)return;
    const nxt={...(osde||{})};nxt[selPlan]={...loc};onSave(nxt);
    setOk(true);setTimeout(()=>setOk(false),2500);
  }
  function addPlan(){
    const n=newPlan.trim();if(!n)return;
    const nxt={...(osde||{}),[n]:{...EMPTY_OSDE}};onSave(nxt);setPlan(n);setNewPlan("");
  }
  function deletePlan(){
    if(!selPlan||!confirm(`¿Eliminar plan OSDE "${selPlan}"?`))return;
    const nxt={...(osde||{})};delete nxt[selPlan];onSave(nxt);setPlan(Object.keys(nxt)[0]||null);
  }
  async function handleOsdeFile(e){
    const f=e.target.files[0];if(!f)return;
    setImportStatus("loading");
    try{
      const data=await parseOsdeFile(f);
      onSave({...(osde||{}),...data});
      setImportStatus("ok");
      setImportMsg(`${Object.keys(data).length} plan(es) importados: ${Object.keys(data).join(", ")}`);
      if(Object.keys(data).length>0)setPlan(Object.keys(data)[0]);
    }catch(err){setImportStatus("error");setImportMsg(err.message);}
  }
  return(<div>
    <h2 style={{fontSize:22,fontWeight:700,color:BLUE,marginBottom:4,fontFamily:FONT}}>Precios OSDE</h2>
    <p style={{fontSize:13,color:"#6B7280",marginBottom:"1rem",fontFamily:FONT}}>Precios de referencia de OSDE para comparación en el análisis.</p>
    {/* Import por Excel */}
    <div style={{...card(),marginBottom:"1rem",padding:"12px 16px",background:"#FAF5FF",border:"1px solid #DDD6FE"}}>
      <p style={{fontSize:12,fontWeight:600,color:"#7C3AED",marginBottom:8,fontFamily:FONT}}>Importar precios desde Excel</p>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <label style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",border:"1.5px solid #7C3AED",borderRadius:8,cursor:"pointer",background:"#fff",fontSize:12,fontFamily:FONT,color:"#7C3AED",fontWeight:500}}>
          <span>📂</span><span>Subir Excel</span>
          <input type="file" accept=".xlsx,.xls" onChange={handleOsdeFile} style={{display:"none"}}/>
        </label>
        <button onClick={downloadOsdeTemplate} style={{...btnS,fontSize:12,padding:"7px 14px",color:"#7C3AED",borderColor:"#DDD6FE"}}>↓ Bajar template</button>
        {importStatus==="ok"&&<span style={{fontSize:12,color:"#16A34A",fontFamily:FONT}}>✓ {importMsg}</span>}
        {importStatus==="error"&&<span style={{fontSize:12,color:"#DC2626",fontFamily:FONT}}>✗ {importMsg}</span>}
        {importStatus==="loading"&&<span style={{fontSize:12,color:"#6B7280",fontFamily:FONT}}>Procesando…</span>}
      </div>
    </div>
    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
      {plans.map(p=>(<button key={p} onClick={()=>setPlan(p)} style={{...btnP,background:p===selPlan?"#7C3AED":"#fff",color:p===selPlan?"#fff":"#7C3AED",border:"1.5px solid #7C3AED",fontSize:12}}>{p}</button>))}
      <div style={{display:"flex",gap:6}}>
        <input value={newPlan} onChange={e=>setNewPlan(e.target.value)} placeholder="Nombre del plan (ej: 210)" style={{...inp,width:140,fontSize:12}}/>
        <button onClick={addPlan} style={{...btnP,background:"#7C3AED",fontSize:12,padding:"6px 12px"}}>+ Agregar</button>
      </div>
      {selPlan&&<button onClick={deletePlan} style={{...btnP,background:"#fff",color:"#DC2626",border:"1px solid #FCA5A5",fontSize:12}}>🗑 Eliminar</button>}
    </div>
    {selPlan?(<div style={card()}>
      <p style={{fontSize:13,fontWeight:600,color:"#7C3AED",marginBottom:12,fontFamily:FONT}}>Plan: {selPlan}</p>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <tbody>{OSDE_CATS.map(cat=>(<tr key={cat.id}>
          <td style={{...TD(),color:"#374151",fontWeight:500}}>{cat.label}</td>
          <td style={{...TD(),textAlign:"right",width:130}}>
            <input type="number" value={loc[cat.id]||""} onChange={e=>setLoc(p=>({...p,[cat.id]:parseFloat(e.target.value)||0}))} style={numInp(120)} placeholder="0"/>
          </td>
        </tr>))}</tbody>
      </table>
      <div style={{display:"flex",gap:10,marginTop:12}}>
        <button onClick={save} style={btnP}>Guardar</button>
        {ok&&<span style={{fontSize:12,color:"#16A34A",alignSelf:"center",fontFamily:FONT}}>✓ Guardado</span>}
      </div>
    </div>):(<div style={{...card(),color:"#6B7280",fontSize:13,fontFamily:FONT}}>Agregá un plan OSDE para comenzar.</div>)}
  </div>);
}


export default OsdeVigentes;
