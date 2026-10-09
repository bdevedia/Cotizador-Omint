import * as XLSX from "xlsx-js-style";
import { catAge } from "./utils";

// ── NÓMINA VALORIZADA ─────────────────────────────────────────────────────────
// Una fila por integrante (con su nombre si la nómina lo trae): plan y costo actual vs. plan Omint y costo nuevo.
// Los costos van en la fila del titular (por grupo familiar); el costo nuevo usa los
// precios efectivos de la cotización, con la misma lógica de categorías que calcBD.
// Equivalencias: una hoja. Simulación: una hoja por plan simulado.

const FILL_ACTUAL={fgColor:{rgb:"DAE3F3"},patternType:"solid"};
const FILL_NUEVO ={fgColor:{rgb:"C6DEB5"},patternType:"solid"};
const THIN={style:"thin",color:{rgb:"000000"}};
const BORDER={top:THIN,bottom:THIN,left:THIN,right:THIN};
const F ={name:"Calibri",sz:10};
const FB={name:"Calibri",sz:10,bold:true};
const NF_MONEY='"$" #,##0.00;[Red]-"$" #,##0.00';
const HEADER_ROW=5; // fila 6 en Excel, como en el modelo (las primeras filas quedan para el título)

// Precio del grupo familiar: mismas categorías que calcBD
function precioFamilia(e,precios){
  const p=id=>precios[id]||0;
  let tot=p(catAge(e.EDAD_TITULAR));
  if(e.EDAD_CONYUGE>0)tot+=p(catAge(e.EDAD_CONYUGE));
  const ku=parseInt(e.HIJOS_MENORES_25)||0;
  if(ku>=1)tot+=p("h1");
  if(ku>=2)tot+=p("h2plus")*(ku-1);
  (e.HIJOS_MAYORES_25_EDADES||[]).forEach(edad=>{tot+=p(catAge(edad));});
  return tot;
}

function sortGrupo(a,b){
  const na=Number(a.fam.GRUPO),nb=Number(b.fam.GRUPO);
  if(!isNaN(na)&&!isNaN(nb))return na-nb;
  return String(a.fam.GRUPO).localeCompare(String(b.fam.GRUPO));
}

function buildSheet(items,titulo){
  const ws={};
  const put=(c,r,v,{font=F,fill,nf,formula}={})=>{
    const cell={v:v??"",t:typeof v==="number"||formula?"n":"s",s:{font,border:BORDER,alignment:{vertical:"center"}}};
    if(fill)cell.s.fill=fill;
    if(nf)cell.z=nf;
    if(formula)cell.f=formula;
    ws[XLSX.utils.encode_cell({c,r})]=cell;
  };
  const ea=(c,r)=>XLSX.utils.encode_cell({c,r});

  ws[ea(0,1)]={v:titulo,t:"s",s:{font:{name:"Calibri",sz:14,bold:true,color:{rgb:"1B2A7B"}}}};

  ["nsoc","edad","parentesco","nombre"].forEach((h,c)=>put(c,HEADER_ROW,h));
  put(4,HEADER_ROW,"Plan_Med",{fill:FILL_ACTUAL});
  put(5,HEADER_ROW,"Costo Actual",{fill:FILL_ACTUAL});
  put(6,HEADER_ROW,"Nuevo Plan",{fill:FILL_NUEVO});
  put(7,HEADER_ROW,"Nuevo Costo",{fill:FILL_NUEVO});

  let row=HEADER_ROW+1;
  const first=row;
  let totActual=0,totNuevo=0;
  [...items].sort(sortGrupo).forEach(({fam,plan,precio})=>{
    const miembros=[...(fam.MIEMBROS||[{parentesco:"T",edad:fam.EDAD_TITULAR}])].sort((a,b)=>a.edad-b.edad);
    miembros.forEach(m=>{
      const esTit=m.parentesco==="T";
      const nsoc=Number(fam.GRUPO);
      put(0,row,isNaN(nsoc)?fam.GRUPO:nsoc);
      put(1,row,m.edad);
      put(2,row,m.parentesco);
      put(3,row,m.nombre||"");
      put(4,row,fam.PLAN_ACTUAL||"",{fill:FILL_ACTUAL});
      put(5,row,esTit&&fam.COSTO_ACTUAL!=null?fam.COSTO_ACTUAL:"",{fill:FILL_ACTUAL,nf:NF_MONEY});
      put(6,row,plan,{fill:FILL_NUEVO});
      put(7,row,esTit?precio:"",{fill:FILL_NUEVO,nf:NF_MONEY});
      row++;
    });
    totActual+=fam.COSTO_ACTUAL||0;
    totNuevo+=precio;
  });
  const last=row-1;
  const totRow=row;
  put(5,totRow,totActual,{fill:FILL_ACTUAL,nf:NF_MONEY,font:FB,formula:`SUM(${ea(5,first)}:${ea(5,last)})`});
  put(7,totRow,totNuevo,{fill:FILL_NUEVO,nf:NF_MONEY,font:FB,formula:`SUM(${ea(7,first)}:${ea(7,last)})`});

  // Resumen (J7:N10). Los módulos de cobertura quedan en 0 para cargarlos a mano.
  const r0=HEADER_ROW+1;
  put(9,r0,"Facturacion Planes Actuales:",{fill:FILL_ACTUAL});
  put(10,r0,totActual,{fill:FILL_ACTUAL,nf:NF_MONEY,formula:`+${ea(5,totRow)}`});
  put(9,r0+1,"Modulos de Cobertura:",{fill:FILL_ACTUAL});
  put(10,r0+1,0,{fill:FILL_ACTUAL,nf:NF_MONEY});
  put(9,r0+2,"Facturacion Actual Total:",{fill:FILL_ACTUAL});
  put(10,r0+2,totActual,{fill:FILL_ACTUAL,nf:NF_MONEY,font:FB,formula:`+${ea(10,r0)}+${ea(10,r0+1)}`});
  put(12,r0,"Facturacion con Nueva Propuesta:",{fill:FILL_NUEVO});
  put(13,r0,totNuevo,{fill:FILL_NUEVO,nf:NF_MONEY,formula:`+${ea(7,totRow)}`});
  put(12,r0+1,"Modulos con Nueva Propuesta:",{fill:FILL_NUEVO});
  put(13,r0+1,0,{fill:FILL_NUEVO,nf:NF_MONEY});
  put(12,r0+2,"Facturacion Nueva Total:",{fill:FILL_NUEVO});
  put(13,r0+2,totNuevo,{fill:FILL_NUEVO,nf:NF_MONEY,font:FB,formula:`+${ea(13,r0)}+${ea(13,r0+1)}`});
  put(12,r0+3,"Diferencia:",{fill:FILL_NUEVO});
  put(13,r0+3,totNuevo>0?totActual/totNuevo-1:0,{fill:FILL_NUEVO,nf:"0%",font:FB,
    formula:`IF(${ea(13,r0+2)}=0,0,${ea(10,r0+2)}/${ea(13,r0+2)}-1)`});

  ws["!ref"]=XLSX.utils.encode_range({s:{c:0,r:0},e:{c:13,r:totRow}});
  ws["!cols"]=[{wch:11.4},{wch:5},{wch:9.7},{wch:26},{wch:12},{wch:14},{wch:12},{wch:14},{wch:4},{wch:28.3},{wch:14},{wch:4},{wch:30},{wch:14}];
  return ws;
}

function exportNominaValorizadaXLS(results,empresa,planesNombres,fecha){
  const nombre=r=>(planesNombres||{})[r.adjKey]||r.cotId;
  const itemsDe=rs=>rs.flatMap(r=>{
    const precios=Object.fromEntries(r.bd.rows.map(x=>[x.id,x.precio]));
    return r.empList.map(fam=>({fam,plan:nombre(r),precio:precioFamilia(fam,precios)}));
  });
  const titulo=`Nómina Valorizada${empresa?` — ${empresa}`:""}`;
  const wb=XLSX.utils.book_new();
  if(results.some(r=>r.sim)){
    const planes=[...new Set(results.map(r=>r.cotId))];
    const usados=new Set();
    planes.forEach(cotId=>{
      const rs=results.filter(r=>r.cotId===cotId);
      const base=`Valorizada ${nombre(rs[0])}`.replace(/[[\]:*?/\\]/g," ").slice(0,31);
      let name=base;
      for(let i=2;usados.has(name);i++)name=`${base.slice(0,26)} (${i})`;
      usados.add(name);
      XLSX.utils.book_append_sheet(wb,buildSheet(itemsDe(rs),`${titulo} · ${nombre(rs[0])}`),name);
    });
  }else{
    XLSX.utils.book_append_sheet(wb,buildSheet(itemsDe(results),titulo),"Nomina Valorizada");
  }
  const d=fecha?new Date(fecha+"T12:00:00"):new Date();
  const mes=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][d.getMonth()];
  const archivo=`Nomina_Valorizada_${(empresa||"empresa").replace(/[\\/:*?"<>|]/g,"").trim().replace(/\s+/g,"_")}_${mes}_${d.getFullYear()}.xlsx`;
  XLSX.writeFile(wb,archivo);
}

export { exportNominaValorizadaXLS, precioFamilia };
