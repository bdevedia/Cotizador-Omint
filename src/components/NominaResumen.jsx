import { FONT, BLUE, BLUE_LT, BORDER, CATS, CAT_IDS, ZONA_COLORS } from "../constants";
import { TH, TD, badge, card } from "../styles";
import { calcBD } from "../calc";

// ── RESUMEN DE LA NÓMINA (paso 1) ─────────────────────────────────────────────
// Familias, socios y distribución por rango apenas se carga la nómina, antes de cotizar.
// Usa el mismo conteo que la planilla (calcBD), así los números coinciden en el paso 3.

const RANGO={s0_25:"00-25",s26_34:"26-35",s35_54:"36-54",s55_59:"55-59",s60plus:"60+",h1:"Hijo 1",h2plus:"Hijo 2+"};

function NominaResumen({emps,map,getEmpZona,isSim}){
  // Filas: por zona y, en equivalencias, por plan vigente
  const grupos={};
  emps.forEach(e=>{
    const zona=getEmpZona(e);
    const plan=isSim?"":(map.planCol&&e[map.planCol]?String(e[map.planCol]).trim():"Sin plan");
    const key=`${zona}||${plan}`;
    (grupos[key]||(grupos[key]={zona,plan,list:[]})).list.push(e);
  });
  const filas=Object.values(grupos)
    .sort((a,b)=>a.zona.localeCompare(b.zona)||a.plan.localeCompare(b.plan,undefined,{numeric:true}))
    .map(g=>{const bd=calcBD(g.list,map,{},{});return{...g,cnt:Object.fromEntries(bd.rows.map(r=>[r.id,r.count]))};});
  const tot=Object.fromEntries(CAT_IDS.map(id=>[id,filas.reduce((a,f)=>a+f.cnt[id],0)]));
  const socios=CAT_IDS.reduce((a,id)=>a+tot[id],0);
  const zonas=[...new Set(filas.map(f=>f.zona))];
  const planes=new Set(filas.map(f=>f.plan).filter(p=>p&&p!=="Sin plan"));
  const pct=n=>socios?Math.round(n/socios*100):0;
  const menores60=CAT_IDS.filter(id=>id!=="s60plus").reduce((a,id)=>a+tot[id],0);

  const kpis=[
    {l:"Familias",v:emps.length},
    {l:"Socios",v:socios},
    {l:"0-59",v:menores60,d:`${pct(menores60)}% de la nómina`},
    {l:"60+",v:tot.s60plus,d:`${pct(tot.s60plus)}% de la nómina`},
    {l:zonas.length>1?"Zonas":"Zona",v:zonas.join(" · ")},
    ...(!isSim&&planes.size>0?[{l:"Planes vigentes",v:planes.size}]:[]),
  ];
  const th=(x={})=>TH({padding:"8px 8px",...x});
  const td=(x={})=>TD({padding:"6px 8px",...x});
  const multiFila=filas.length>1;

  return(<div style={{...card({padding:18}),marginTop:"1rem",textAlign:"left"}}>
    <p style={{fontSize:11,fontWeight:600,color:"#374151",marginBottom:12,textTransform:"uppercase",letterSpacing:"0.04em",fontFamily:FONT}}>Resumen de la nómina</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:16}}>
      {kpis.map(k=>(<div key={k.l} style={{padding:"10px 12px",borderRadius:10,background:BLUE_LT,border:`1px solid ${BORDER}`}}>
        <p style={{fontSize:11,color:"#4B5563",fontFamily:FONT,marginBottom:2}}>{k.l}</p>
        <p style={{fontSize:typeof k.v==="number"?20:15,fontWeight:700,color:BLUE,fontFamily:FONT,lineHeight:1.3}}>{typeof k.v==="number"?k.v.toLocaleString("es-AR"):k.v}</p>
        {k.d&&<p style={{fontSize:11,color:"#6B7280",fontFamily:FONT}}>{k.d}</p>}
      </div>))}
    </div>
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:620,fontFamily:FONT}}>
        <thead><tr>
          <th style={th({textAlign:"left"})}>{isSim?"Zona":"Plan vigente"}</th>
          {CATS.map(c=><th key={c.id} style={th()}>{RANGO[c.id]}</th>)}
          <th style={th({color:"#111827"})}>Total</th>
        </tr></thead>
        <tbody>
          {filas.map(f=>{const t=CAT_IDS.reduce((a,id)=>a+f.cnt[id],0);return(<tr key={`${f.zona}||${f.plan}`}>
            <td style={td({fontWeight:600,whiteSpace:"nowrap"})}>
              {(zonas.length>1||isSim)&&<span style={{...badge(ZONA_COLORS[f.zona]?.c||BLUE,ZONA_COLORS[f.zona]?.bg||BLUE_LT),fontSize:10,marginRight:6}}>{f.zona}</span>}
              {isSim?"Nómina":<span style={{color:f.plan==="Sin plan"?"#B42318":undefined}}>{f.plan}</span>}
            </td>
            {CAT_IDS.map(id=><td key={id} style={td({textAlign:"right"})}>{f.cnt[id]}</td>)}
            <td style={td({textAlign:"right",fontWeight:700})}>{t}</td>
          </tr>);})}
          {multiFila&&<tr style={{background:BLUE_LT}}>
            <td style={td({fontWeight:700,color:BLUE})}>Total</td>
            {CAT_IDS.map(id=><td key={id} style={td({textAlign:"right",fontWeight:700})}>{tot[id]}</td>)}
            <td style={td({textAlign:"right",fontWeight:700})}>{socios}</td>
          </tr>}
          <tr>
            <td style={td({color:"#6B7280"})}>% del total</td>
            {CAT_IDS.map(id=><td key={id} style={td({textAlign:"right",color:"#6B7280"})}>{pct(tot[id])}%</td>)}
            <td style={td({textAlign:"right",color:"#6B7280"})}>100%</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>);
}

export default NominaResumen;
