import { useState } from "react";
import { FONT, BLUE, BORDER } from "../constants";
import { btnP, inp, card } from "../styles";

// ── CONFIGURACIÓN ─────────────────────────────────────────────────────────────
function Configuracion({apiKey,onSave}){
  const [k,setK]=useState(apiKey||"");const[ok,setOk]=useState(false);
  return(<div>
    <h2 style={{fontSize:22,fontWeight:700,color:BLUE,marginBottom:6,fontFamily:FONT}}>Configuración</h2>
    <div style={card()}>
      <label style={{fontSize:11,fontWeight:600,color:"#374151",display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.04em",fontFamily:FONT}}>API Key de Groq</label>
      <input type="password" value={k} onChange={e=>setK(e.target.value)} placeholder="gsk_..." style={{...inp,maxWidth:480,marginBottom:10}}/>
      <p style={{fontSize:11,color:"#9CA3AF",marginBottom:14,fontFamily:FONT}}>Gratis en <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{color:BLUE}}>console.groq.com</a> → API Keys</p>
      <button onClick={()=>{onSave(k);setOk(true);setTimeout(()=>setOk(false),2500);}} style={btnP}>{ok?"✓ Guardado":"Guardar"}</button>
    </div>
  </div>);
}


export default Configuracion;
