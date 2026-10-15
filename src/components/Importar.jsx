import { useState } from "react";
import { FONT, BLUE, BLUE_LT } from "../constants";
import { btnS, card } from "../styles";
import { parsePreciosFile, parseCostosFile } from "../parsers";
import { ordenarBandas } from "../calc";

// ── IMPORTAR ──────────────────────────────────────────────────────────────────
function Importar({onPreciosImport,onCostosImport}){
  const [pS,setPS]=useState(null);const[pM,setPM]=useState("");
  const [cS,setCS]=useState(null);const[cM,setCM]=useState("");
  async function handleP(e){const f=e.target.files[0];if(!f)return;setPS("loading");try{const {precios,bandas}=await parsePreciosFile(f);onPreciosImport(precios,bandas);const planes=new Set(Object.values(precios).flatMap(z=>Object.keys(z)));const rotulos=[...new Set(Object.values(bandas).flatMap(z=>Object.values(z).flatMap(b=>Object.keys(b))))];setPS("ok");setPM(`${Object.keys(precios).length} zonas · ${planes.size} planes · ${rotulos.length} bandas de cápitas: ${ordenarBandas(rotulos).join(" · ")}`);}catch(err){setPS("error");setPM(err.message);}}
  async function handleC(e){const f=e.target.files[0];if(!f)return;setCS("loading");try{const d=await parseCostosFile(f);onCostosImport(d);setCS("ok");setCM(`${Object.keys(d).length} planes importados`);}catch(err){setCS("error");setCM(err.message);}}
  const S=({s,m})=>!s?null:s==="ok"?<span style={{fontSize:12,color:"#16A34A",fontFamily:FONT}}>✓ {m}</span>:s==="error"?<span style={{fontSize:12,color:"#DC2626",fontFamily:FONT}}>✗ {m}</span>:<span style={{fontSize:12,color:"#6B7280",fontFamily:FONT}}>Procesando…</span>;
  return(<div>
    <h2 style={{fontSize:22,fontWeight:700,color:BLUE,marginBottom:4,fontFamily:FONT}}>Importar datos</h2>
    <p style={{fontSize:13,color:"#6B7280",marginBottom:"1.5rem",fontFamily:FONT}}>Subí los archivos mensuales para actualizar precios y costos automáticamente.</p>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      {[{t:"Lista de Precios (.xls)",n:"Lista_de_precios_Empresas_Unificada_...",onChange:handleP,s:pS,m:pM,note:"Sheets 1=AMBA · 2=Córdoba · 7=Mendoza · Importa todas las bandas de cápitas"},
        {t:"Rentabilidad / Costos (.xlsx)",n:"Rentabilidad_objetivo_EE_...",onChange:handleC,s:cS,m:cM,note:'Sheet "Costos Cerrado+Abierto"'}].map(item=>(
        <div key={item.t} style={card()}>
          <p style={{fontSize:14,fontWeight:700,color:BLUE,marginBottom:4,fontFamily:FONT}}>{item.t}</p>
          <p style={{fontSize:11,color:"#9CA3AF",marginBottom:"1rem",fontFamily:FONT}}>{item.note}</p>
          <label style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",border:`2px dashed ${BLUE}`,borderRadius:8,cursor:"pointer",background:BLUE_LT}}>
            <span style={{fontSize:20}}>📂</span><span style={{fontSize:13,color:BLUE,fontWeight:500,fontFamily:FONT}}>Subir archivo</span>
            <input type="file" accept=".xls,.xlsx" onChange={item.onChange} style={{display:"none"}}/>
          </label>
          <div style={{marginTop:10}}><S s={item.s} m={item.m}/></div>
        </div>
      ))}
    </div>
    <div style={{...card(),marginTop:"1.5rem",background:BLUE_LT,border:`1px solid ${BLUE}22`}}>
      <p style={{fontSize:13,fontWeight:600,color:BLUE,marginBottom:4,fontFamily:FONT}}>Flujo mensual de actualización</p>
      <p style={{fontSize:12,color:"#374151",lineHeight:1.7,fontFamily:FONT}}>1. Importá el nuevo XLS de precios → 2. Importá el XLSX de costos → 3. Los valores se guardan automáticamente y se usan en todas las cotizaciones nuevas. Los ajustes manuales que hayas hecho en "Precios Vigentes" o "Costos Vigentes" se reemplazan al reimportar.</p>
    </div>
    <div style={{...card(),marginTop:"1.5rem",border:"1px solid #FCA5A5",background:"#FFF5F5"}}>
      <p style={{fontSize:13,fontWeight:600,color:"#DC2626",marginBottom:"1rem",fontFamily:FONT}}>Eliminar datos</p>
      <div style={{display:"flex",gap:12}}>
        <button onClick={()=>{if(confirm("¿Eliminar todos los precios?"))onPreciosImport({});}} style={{...btnS,color:"#DC2626",borderColor:"#FCA5A5",fontSize:13}}>🗑 Eliminar precios</button>
        <button onClick={()=>{if(confirm("¿Eliminar todos los costos?"))onCostosImport({});}} style={{...btnS,color:"#DC2626",borderColor:"#FCA5A5",fontSize:13}}>🗑 Eliminar costos</button>
      </div>
    </div>
  </div>);
}

export default Importar;
