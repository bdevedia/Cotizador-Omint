import { FONT, BLUE, BLUE_LT, ZONA_COLORS } from "../constants";
import { TH, TD, badge, card, inp } from "../styles";
import { planOsdeDe } from "../calc";

// ── CÓMO VA EN LA PROPUESTA (paso 2) ──────────────────────────────────────────
// Nombre de cada plan cotizado (por zona) y plan OSDE contra el que se compara cada
// plan vigente. Se definen una sola vez acá; la planilla los muestra y Salidas
// permite retocar el nombre antes de enviar.

const campo={...inp,padding:"6px 10px"};

function PlanesPropuesta({grupos,isSim,osde,planCustomNames,setPlanCustomNames,planMappingOsde,setPlanMappingOsde}){
  if(grupos.length===0)return null;
  const multiZona=new Set(grupos.map(g=>g.zona)).size>1;
  const zonaBadge=z=>multiZona&&<span style={{...badge(ZONA_COLORS[z]?.c||BLUE,ZONA_COLORS[z]?.bg||BLUE_LT),fontSize:10,marginRight:6}}>{z}</span>;
  // Un plan cotizado por zona
  const planes=[];
  {const vistos=new Set();grupos.forEach(g=>{const k=`${g.zona}||${g.cotId}`;if(!vistos.has(k)){vistos.add(k);planes.push({...g,adjKey:k});}});}
  const osdePlans=Object.keys(osde||{}).sort();
  const hayOsde=osdePlans.length>0;
  const th=(x={})=>TH({padding:"8px 10px",textAlign:"left",...x});
  const td=(x={})=>TD({padding:"6px 10px",...x});
  const vigentes=planesSinRepetir(grupos);

  return(<div style={{...card({padding:18}),marginTop:"1rem",textAlign:"left"}}>
    <p style={{fontSize:13,fontWeight:600,color:BLUE,marginBottom:4,fontFamily:FONT}}>Cómo va en la propuesta</p>
    <p style={{fontSize:12,color:"#6B7280",marginBottom:12,fontFamily:FONT}}>
      El nombre de cada plan en el PDF, el Excel y la nómina valorizada{hayOsde?", y el plan OSDE contra el que se compara cada plan vigente":""}. Después podés retocar el nombre en Salidas.
    </p>
    <div style={{display:"flex",flexWrap:"wrap",gap:16,alignItems:"flex-start"}}>
      <div style={{flex:"1 1 340px",minWidth:0,overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontFamily:FONT}}>
          <thead><tr><th style={th()}>Plan Omint</th><th style={th()}>Nombre en la propuesta</th></tr></thead>
          <tbody>{planes.map(pl=>(<tr key={pl.adjKey}>
            <td style={td({fontWeight:600,whiteSpace:"nowrap",color:BLUE})}>{zonaBadge(pl.zona)}{pl.cotId}</td>
            <td style={td()}><input value={planCustomNames[pl.adjKey]??pl.cotId} onChange={e=>setPlanCustomNames(p=>({...p,[pl.adjKey]:e.target.value}))}
              aria-label={`Nombre en la propuesta de ${pl.cotId}${multiZona?` (${pl.zona})`:""}`} style={campo}/></td>
          </tr>))}</tbody>
        </table>
      </div>
      {hayOsde&&<div style={{flex:"1 1 340px",minWidth:0,overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontFamily:FONT}}>
          <thead><tr><th style={th()}>{isSim?"Plan Omint":"Plan vigente"}</th><th style={th()}>Comparar con OSDE</th></tr></thead>
          <tbody>{vigentes.map(g=>{
            const osdeKey=`${g.zona}||${g.planVigente}`;
            return(<tr key={osdeKey}>
              <td style={td({fontWeight:600,whiteSpace:"nowrap"})}>{zonaBadge(g.zona)}{g.planVigente}{!isSim&&<span style={{color:"#6B7280",fontWeight:400}}> → {g.cotId}</span>}</td>
              <td style={td()}><select value={planOsdeDe(planMappingOsde,osde,osdeKey,g.planVigente)} onChange={e=>setPlanMappingOsde(p=>({...p,[osdeKey]:e.target.value}))}
                aria-label={`Plan OSDE para ${g.planVigente}${multiZona?` (${g.zona})`:""}`} style={campo}>
                <option value="">Sin comparar</option>{osdePlans.map(p=><option key={p} value={p}>{p}</option>)}
              </select></td>
            </tr>);
          })}</tbody>
        </table>
      </div>}
    </div>
  </div>);
}

// Un renglón por plan vigente y zona (en simulación, por plan cotizado y zona)
function planesSinRepetir(grupos){
  const vistos=new Set();
  return grupos.filter(g=>{const k=`${g.zona}||${g.planVigente}`;if(vistos.has(k))return false;vistos.add(k);return true;});
}

export default PlanesPropuesta;
