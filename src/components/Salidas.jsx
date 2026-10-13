import { FONT, BLUE, BLUE_LT, BORDER, ZONA_COLORS } from "../constants";
import { badge, btnP, btnS, inp, card } from "../styles";
import { generateProposalHTML } from "../exportHTML";
import { exportNominaValorizadaXLS } from "../exportNominaValorizada";
import { exportAnalisisXLS } from "../exportXLS";

// ── SALIDAS (paso 4) ──────────────────────────────────────────────────────────
// Configuración de la propuesta con vista previa del PDF, y descargas: PDF, Excel de
// análisis y nómina valorizada. La empresa y los nombres de los planes son los mismos
// de la planilla; la configuración (cfg) vive en el Cotizador para no perderse al volver.

const FORMATOS=[
  {v:"nchoice",l:"N-Choice",d:"7 categorías"},
  {v:"capitados2",l:"Capitados",d:"0-59 · 60+"},
  {v:"capitados",l:"Capitados",d:"0-54 · 55-59 · 60+"},
];
const AYUDA_FORMATO={
  capitados2:"El 0-59 es ponderado: el precio de cada rango menor de 60 (hijos incluidos) por la proporción de la nómina en ese rango. En la nómina valorizada cada integrante se cobra según su edad: 0-59 o 60+.",
  capitados:"El 0-54 es ponderado: el precio de 00-25, 26-35 y 36-54 por la proporción de la nómina en cada rango. En la nómina valorizada cada integrante (hijos incluidos) se cobra según su edad: 0-54, 55-59 o 60+.",
};
// A4 a 96 dpi y escala de la vista previa
const A4_W=794,A4_H=1123,ESCALA=0.7;

// inp ocupa el 100%: con border-box no se sale de la tarjeta
const campo={...inp,boxSizing:"border-box"};
const lbl={fontSize:11,fontWeight:600,color:"#374151",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.04em",fontFamily:FONT};

function Salidas({results,empresa,setEmpresa,cfg,setCfg,emps,brokerPct,osde,planMappingOsde,planMejoras,mejoras,
  planCustomNames,setPlanCustomNames,adjPct,listas,guardar,saveMsg,onVolver}){
  const upd=(k,v)=>setCfg(p=>({...p,[k]:v}));
  const planesNombres=Object.fromEntries(results.map(r=>[r.adjKey,planCustomNames[r.adjKey]||r.cotId]));
  const propuesta={...cfg,empresa,planesNombres};
  const html=generateProposalHTML(propuesta,results);

  // Un plan cotizado por zona, para editar su nombre una sola vez
  const planes=[];
  {const vistos=new Set();results.forEach(r=>{if(!vistos.has(r.adjKey)){vistos.add(r.adjKey);planes.push(r);}});}
  const multiZona=new Set(results.map(r=>r.zona)).size>1;

  function descargarPDF(){
    const blob=new Blob([html],{type:"text/html;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const w=window.open(url,"_blank");
    if(w){
      // Esperar a que carguen las fuentes de la propuesta antes de imprimir
      w.addEventListener("load",()=>{
        const imprimir=()=>setTimeout(()=>w.print(),300);
        (w.document.fonts?.ready||Promise.resolve()).then(imprimir,imprimir);
      });
    }
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  function descargarExcel(){
    try{exportAnalisisXLS(results,empresa,emps,brokerPct,osde,planMappingOsde,cfg.masaSalarial,mejoras,planMejoras,planesNombres,adjPct,listas);}
    catch(e){alert("Error al exportar el Excel: "+e.message);}
  }
  function descargarValorizada(){
    try{exportNominaValorizadaXLS(results,empresa,planesNombres,cfg.fecha,cfg.formato);}
    catch(e){alert("Error al exportar la nómina valorizada: "+e.message);}
  }

  const ms=parseFloat(cfg.masaSalarial)||0;
  const aporte=ms*0.09*0.85*(1+1/12);
  const totalFac=results.reduce((a,r)=>a+r.bd.totalFac,0);

  if(results.length===0)return(<div style={{...card(),textAlign:"center",padding:"3rem",color:"#6B7280"}}>
    <p style={{fontFamily:FONT}}>No hay planes cotizados.</p>
    <button onClick={onVolver} style={{...btnS,marginTop:"1rem"}}>← Volver a la planilla</button>
  </div>);

  return(<div style={{display:"flex",flexDirection:"column",gap:16,textAlign:"left"}}>
    <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:8,justifyContent:"space-between"}}>
      <div>
        <h3 style={{fontSize:18,fontWeight:700,color:BLUE,fontFamily:FONT}}>Salidas</h3>
        <p style={{fontSize:13,color:"#4B5563",fontFamily:FONT}}>Revisá la propuesta y descargá lo que vas a enviar.</p>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button onClick={onVolver} style={btnS}>← Volver a la planilla</button>
        <button onClick={()=>guardar("abierto")} style={btnS}>Guardar abierto</button>
        <button onClick={()=>guardar("cerrado")} style={btnP}>Guardar cerrado</button>
      </div>
    </div>
    {saveMsg&&<div style={{padding:"10px 16px",background:"#D1FAE5",borderRadius:8,fontSize:13,color:"#065F46",fontWeight:600,fontFamily:FONT}}>{saveMsg}</div>}

    <div style={{display:"flex",flexWrap:"wrap",gap:16,alignItems:"flex-start"}}>
      {/* CONFIGURACIÓN Y DESCARGAS */}
      <div style={{flex:"1 1 380px",minWidth:0,display:"flex",flexDirection:"column",gap:16}}>
        <div style={card({padding:18})}>
          <p style={{...lbl,marginBottom:10}}>Formato de precios <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,color:"#6B7280"}}>(PDF y nómina valorizada)</span></p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8}} role="radiogroup" aria-label="Formato de precios">
            {FORMATOS.map(o=>{const sel=cfg.formato===o.v;return(
              <button key={o.v} role="radio" aria-checked={sel} onClick={()=>upd("formato",o.v)}
                style={{fontFamily:FONT,textAlign:"left",padding:"10px 12px",minHeight:44,borderRadius:10,cursor:"pointer",border:`1.5px solid ${sel?BLUE:BORDER}`,background:sel?BLUE_LT:"#fff"}}>
                <span style={{display:"block",fontSize:13,fontWeight:700,color:sel?BLUE:"#374151"}}>{o.l}</span>
                <span style={{display:"block",fontSize:12,color:"#6B7280"}}>{o.d}</span>
              </button>);})}
          </div>
          {AYUDA_FORMATO[cfg.formato]&&<p style={{fontSize:12,color:"#4B5563",marginTop:8,fontFamily:FONT,lineHeight:1.5}}>{AYUDA_FORMATO[cfg.formato]}</p>}
        </div>

        <div style={{...card({padding:18}),display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <label htmlFor="sal-empresa" style={lbl}>Empresa</label>
            <input id="sal-empresa" value={empresa} onChange={e=>setEmpresa(e.target.value)} placeholder="Nombre de la empresa" style={campo}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,2fr)",gap:12}}>
            <div>
              <label htmlFor="sal-fecha" style={lbl}>Fecha</label>
              <input id="sal-fecha" type="date" value={cfg.fecha} onChange={e=>upd("fecha",e.target.value)} style={campo}/>
            </div>
            <div>
              <label htmlFor="sal-validez" style={lbl}>Validez</label>
              <input id="sal-validez" value={cfg.validez} onChange={e=>upd("validez",e.target.value)} style={campo}/>
            </div>
          </div>
          <div>
            <p style={lbl}>Nombre de los planes en la propuesta</p>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {planes.map(r=>(<div key={r.adjKey} style={{display:"flex",alignItems:"center",gap:8}}>
                {multiZona&&<span style={{...badge(ZONA_COLORS[r.zona]?.c||BLUE,ZONA_COLORS[r.zona]?.bg||BLUE_LT),fontSize:10}}>{r.zona}</span>}
                <span style={{fontSize:12,color:"#4B5563",fontFamily:FONT,minWidth:110}}>{r.cotId}</span>
                <input value={planCustomNames[r.adjKey]??r.cotId} onChange={e=>setPlanCustomNames(p=>({...p,[r.adjKey]:e.target.value}))}
                  aria-label={`Nombre en la propuesta de ${r.cotId}`} style={{...campo,flex:1,padding:"6px 10px"}}/>
              </div>))}
            </div>
          </div>
          <div>
            <label htmlFor="sal-extra" style={lbl}>Texto adicional <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,color:"#6B7280"}}>(nota extra en el PDF)</span></label>
            <textarea id="sal-extra" value={cfg.textoExtra} onChange={e=>upd("textoExtra",e.target.value)} rows={2} style={{...campo,resize:"vertical",lineHeight:1.5}}/>
          </div>
          <div>
            <label htmlFor="sal-masa" style={lbl}>Masa salarial <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,color:"#6B7280"}}>(opcional, para el Excel)</span></label>
            <input id="sal-masa" type="number" className="sin-flechas" value={cfg.masaSalarial} onChange={e=>upd("masaSalarial",e.target.value)} placeholder="Ej: 1239337852" style={campo}/>
            {ms>0&&<p style={{fontSize:12,color:"#4B5563",marginTop:6,fontFamily:FONT}}>
              Aporte estimado: <strong>${Math.round(aporte).toLocaleString("es-AR")}</strong> · Saldo: <strong style={{color:totalFac-aporte>0?"#B42318":"#166534"}}>${Math.round(totalFac-aporte).toLocaleString("es-AR")}</strong>
            </p>}
          </div>
        </div>

        <div style={{...card({padding:18}),display:"flex",flexDirection:"column",gap:10}}>
          <p style={{...lbl,marginBottom:2}}>Descargas</p>
          <button onClick={descargarPDF} style={{...btnP,minHeight:44,textAlign:"left"}}>Propuesta en PDF <span style={{fontWeight:400,opacity:0.85}}>· se abre para imprimir o guardar como PDF</span></button>
          <button onClick={descargarExcel} style={{...btnS,minHeight:44,textAlign:"left"}}>Excel de análisis <span style={{color:"#6B7280",fontWeight:400}}>· Cotización, Nómina, Lista de Costos y Lista de Precios</span></button>
          <button onClick={descargarValorizada} style={{...btnS,minHeight:44,textAlign:"left"}}>Nómina valorizada <span style={{color:"#6B7280",fontWeight:400}}>· con el formato de precios elegido</span></button>
        </div>
      </div>

      {/* VISTA PREVIA DEL PDF */}
      <div style={{flex:"1 1 560px",minWidth:0,...card({padding:16}),display:"flex",flexDirection:"column",gap:10,alignItems:"center"}}>
        <p style={{...lbl,alignSelf:"flex-start",marginBottom:0}}>Vista previa del PDF</p>
        <div style={{width:A4_W*ESCALA,height:A4_H*ESCALA,maxWidth:"100%",overflow:"hidden",borderRadius:8,boxShadow:"0 4px 20px rgba(0,0,0,0.15)",background:"#15193C"}}>
          <iframe title="Vista previa de la propuesta en PDF" srcDoc={html} sandbox="allow-same-origin"
            style={{width:A4_W,height:A4_H,border:"none",transform:`scale(${ESCALA})`,transformOrigin:"0 0",display:"block"}}/>
        </div>
      </div>
    </div>
  </div>);
}

export default Salidas;
