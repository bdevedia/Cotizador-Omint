import * as XLSX from "xlsx-js-style";
import { OSDE_CATS, EMPTY_OSDE, BANDA, PRECIO_COLS, ZONA_IDS } from "./constants";


// ── PARSER DE NÓMINA (formato fijo) ─────────────────────────────────────────
// Columnas requeridas: "Grupo Familiar", "Tipo benef", y al menos una de "Edad" | "Fecha de Nacimiento"
// Columnas opcionales: "Nombre", "Plan de contratación", "Zona"
// Tipo benef acepta: Titular/T, Conyuge/Cónyuge/C, Hijo/H

const REQUIRED_COLS_HINTS=[
  ["grupo familiar","grupo","nsoc","familia","id familia"],
  ["tipo benef","parentesco","tipo","relacion","beneficiario"],
];
const PLAN_COL_HINTS=["plan de contratación","plan contratacion","plan de contratacion","plan","equivalencia","plan_med"];
const EDAD_COL_HINTS=["edad","age","años"];
const FECHA_COL_HINTS=["fecha de nacimiento","fecha nacimiento","fecha_nacimiento","nacimiento","birth","fecha nac","fec nac"];
const ZONA_COL_HINTS=["zona","provincia","region","localidad"];
const NOMBRE_COL_HINTS=["nombre","name","titular","apellido","empleado","apellido y nombre"];

function findColHints(cols,hints){
  const low=cols.map(x=>String(x).toLowerCase().trim());
  for(const h of hints){const i=low.findIndex(c=>c===h||c.includes(h));if(i>=0)return cols[i];}
  return null;
}

function calcEdadDesde(fechaStr){
  if(!fechaStr)return null;
  const s=String(fechaStr).trim();
  // Soporta: DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD, timestamp numérico Excel
  let d;
  const parts=s.split(/[.\-\/]/);
  if(parts.length===3){
    if(parts[0].length===4)d=new Date(+parts[0],+parts[1]-1,+parts[2]);
    else d=new Date(+parts[2],+parts[1]-1,+parts[0]);
  }else{d=new Date(s);}
  if(isNaN(d.getTime()))return null;
  const hoy=new Date();
  let edad=hoy.getFullYear()-d.getFullYear();
  if(hoy.getMonth()<d.getMonth()||(hoy.getMonth()===d.getMonth()&&hoy.getDate()<d.getDate()))edad--;
  return edad>0&&edad<120?edad:null;
}

function parseNominaFija(rawRows,rawCols){
  // Validar columnas requeridas
  for(const hints of REQUIRED_COLS_HINTS){
    if(!findColHints(rawCols,hints)){
      return{error:`Columna faltante. Se necesita una columna con alguno de estos nombres: "${hints.slice(0,2).join('" o "')}". Revisá el template.`};
    }
  }
  const hasEdad=!!findColHints(rawCols,EDAD_COL_HINTS);
  const hasFecha=!!findColHints(rawCols,FECHA_COL_HINTS);
  if(!hasEdad&&!hasFecha){
    return{error:'Se necesita la columna "Edad" o "Fecha de Nacimiento". Revisá el template.'};
  }

  const colGrupo=findColHints(rawCols,["grupo familiar","grupo","nsoc","familia","id familia"]);
  const colTipo=findColHints(rawCols,["tipo benef","parentesco","tipo","relacion","beneficiario"]);
  const colEdad=findColHints(rawCols,EDAD_COL_HINTS);
  const colFecha=findColHints(rawCols,FECHA_COL_HINTS);
  const colPlan=findColHints(rawCols,PLAN_COL_HINTS);
  const colZona=findColHints(rawCols,ZONA_COL_HINTS);
  const colNombre=findColHints(rawCols,NOMBRE_COL_HINTS);

  function getEdad(row){
    if(colEdad){
      const v=parseInt(row[colEdad]);
      if(!isNaN(v)&&v>0&&v<120)return v;
    }
    if(colFecha)return calcEdadDesde(row[colFecha]);
    return null;
  }

  function getTipo(row){
    const t=String(row[colTipo]||"").trim().toLowerCase();
    if(t==="titular"||t==="t"||t.startsWith("tit"))return"T";
    if(t==="conyuge"||t==="cónyuge"||t==="c"||t.startsWith("con")||t.startsWith("esp"))return"C";
    if(t==="hijo"||t==="hija"||t==="h"||t.startsWith("hij")||t==="menor")return"H";
    return null;
  }

  const familias={};
  let filasIgnoradas=0;
  const hijosEdadInvalida=[];
  rawRows.forEach(row=>{
    if(!row||row[colGrupo]==null)return;
    const gid=String(row[colGrupo]).trim();
    const tipo=getTipo(row);
    if(!tipo){filasIgnoradas++;return;}
    const edad=getEdad(row);
    const plan=colPlan?String(row[colPlan]||"").trim():"";
    const zona=colZona?String(row[colZona]||"").trim():"";
    const nombre=colNombre?String(row[colNombre]||"").trim():"";
    if(!familias[gid])familias[gid]={GRUPO:gid,NOMBRE:nombre,EDAD_TITULAR:null,
      CONYUGES:[],  // lista de TODAS las edades de conyuges
      HIJOS_MENORES_25:0,HIJOS_MAYORES_25_EDADES:[],PLAN_ACTUAL:"",ZONA:zona,
      OSDE_HIJO_26_27:0,OSDE_IND_JOVEN:0,OSDE_IND_MAYOR:0};
    if(tipo==="T"){
      if(edad!==null)familias[gid].EDAD_TITULAR=edad;
      if(plan)familias[gid].PLAN_ACTUAL=plan;
      if(zona)familias[gid].ZONA=zona;
      if(nombre&&nombre!=="-")familias[gid].NOMBRE=nombre;
    }else if(tipo==="C"){
      // Guardar TODOS los conyuges (puede haber duplicados en el archivo)
      if(edad!==null)familias[gid].CONYUGES.push(edad);
    }else if(tipo==="H"){
      if(edad===null){filasIgnoradas++;hijosEdadInvalida.push(gid);return;}
      if(true){
        if(edad<=25)familias[gid].HIJOS_MENORES_25++;
        else familias[gid].HIJOS_MAYORES_25_EDADES.push(edad);
        // OSDE usa 28 como corte: <28 = hijo, >=28 = individual
        if(edad<28){
          if(edad>25)familias[gid].OSDE_HIJO_26_27++; // 26-27: FAC en Omint, hijo en OSDE
        }else if(edad<=35){familias[gid].OSDE_IND_JOVEN++;}
        else{familias[gid].OSDE_IND_MAYOR++;}
      }
    }
  });

  // Convertir a filas: 1 fila por familia, solo el primer cónyuge
  const rows=[];
  const conyugesMultiples=[];
  Object.values(familias).forEach(f=>{
    if(f.EDAD_TITULAR===null)return;
    const primerConyuge=f.CONYUGES.length>0?f.CONYUGES[0]:0;
    // Si hay más de 1 cónyuge, registrar advertencia e ignorar extras
    if(f.CONYUGES.length>1){
      conyugesMultiples.push({familia:f.GRUPO,count:f.CONYUGES.length});
      filasIgnoradas+=(f.CONYUGES.length-1);
    }
    rows.push({
      GRUPO:f.GRUPO,NOMBRE:f.NOMBRE,
      EDAD_TITULAR:f.EDAD_TITULAR,
      EDAD_CONYUGE:primerConyuge,
      HIJOS_MENORES_25:f.HIJOS_MENORES_25,
      HIJOS_MAYORES_25_EDADES:f.HIJOS_MAYORES_25_EDADES,
      PLAN_ACTUAL:f.PLAN_ACTUAL,ZONA:f.ZONA,
      OSDE_HIJO_26_27:f.OSDE_HIJO_26_27,
      OSDE_IND_JOVEN:f.OSDE_IND_JOVEN,
      OSDE_IND_MAYOR:f.OSDE_IND_MAYOR,
    });
  });

  if(rows.length===0)return{error:"No se encontraron titulares con edad válida. Revisá el template."};
  return{rows,filasIgnoradas,conyugesMultiples,hijosEdadInvalida,totalRaw:rawRows.length};
}

// ── PARSERS ───────────────────────────────────────────────────────────────────
function parsePreciosSheet(rows){
  const plans={};let cur=null;
  rows.forEach(row=>{
    if(!row||row[0]==null)return;
    const v=String(row[0]).trim();
    if(v.startsWith("Plan ")){cur=v.slice(5).trim();plans[cur]=null;}
    else if(cur&&v.includes("200")){
      const nums=PRECIO_COLS.map(i=>{const x=row[i];return typeof x==="number"?Math.round(x):0;});
      if(nums.some(x=>x>0)){
        plans[cur]={s0_25:nums[0],s26_34:nums[1],s35_54:nums[2],s55_59:nums[3],s60plus:nums[4],h1:nums[5],h2plus:nums[6]};
        cur=null; // tomamos solo el primer "200" encontrado por plan
      }
    }
  });
  // eliminar planes sin datos
  return Object.fromEntries(Object.entries(plans).filter(([,v])=>v!==null));
}

function parsePreciosFile(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();r.onerror=rej;
    r.onload=e=>{
      try{
        const wb=XLSX.read(e.target.result,{type:"binary"});
        const map={AMBA:"1",Córdoba:"2",Mendoza:"7"};
        const result={};
        Object.entries(map).forEach(([z,s])=>{
          const ws=wb.Sheets[s];if(!ws)return;
          result[z]=parsePreciosSheet(XLSX.utils.sheet_to_json(ws,{header:1,defval:null}));
        });
        res(result);
      }catch(err){rej(err);}
    };
    r.readAsBinaryString(file);
  });
}

function parseCostosFile(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();r.onerror=rej;
    r.onload=e=>{
      try{
        const wb=XLSX.read(e.target.result,{type:"binary"});
        const ws=wb.Sheets["Costos Cerrado+Abierto"];
        if(!ws){rej(new Error('Sheet "Costos Cerrado+Abierto" no encontrada'));return;}
        const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
        const costs={};
        rows.forEach(row=>{
          if(!row||row[0]==null)return;
          const v=String(row[0]).trim();
          if(v.startsWith("Plan ")){
            const pid=v.slice(5).trim();
            const nums=PRECIO_COLS.map(i=>{const x=row[i];return typeof x==="number"?Math.round(x):0;});
            if(nums.some(x=>x>0))costs[pid]={s0_25:nums[0],s26_34:nums[1],s35_54:nums[2],s55_59:nums[3],s60plus:nums[4],h1:nums[5],h2plus:nums[6]};
          }
        });
        res(costs);
      }catch(err){rej(err);}
    };
    r.readAsBinaryString(file);
  });
}

function parseOsdeFile(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();r.onerror=rej;
    r.onload=e=>{
      try{
        const wb=XLSX.read(e.target.result,{type:"binary"});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
        const result={};
        rows.forEach(row=>{
          if(!row||row[0]==null)return;
          const planName=String(row[0]).trim();
          // Saltar filas de encabezado
          if(!planName||/^(plan|nombre|categoria)/i.test(planName))return;
          const prices={};
          OSDE_CATS.forEach((cat,ci)=>{
            const v=row[ci+1];
            prices[cat.id]=typeof v==="number"?Math.round(v):parseFloat(String(v||"0").replace(/[^0-9.]/g,""))||0;
          });
          if(Object.values(prices).some(v=>v>0))result[planName]=prices;
        });
        if(Object.keys(result).length===0)rej(new Error("No se encontraron planes con precios. Usá el template."));
        else res(result);
      }catch(err){rej(err);}
    };
    r.readAsBinaryString(file);
  });
}

function downloadOsdeTemplate(){
  const headers=["Plan",...OSDE_CATS.map(c=>c.label)];
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet([
    headers,
    ["210",12000,15000,18000,22000,26000,30000,8000,7000],
    ["410",20000,25000,30000,36000,42000,50000,13000,11000],
  ]);
  ws["!cols"]=[{wch:10},...OSDE_CATS.map(()=>({wch:22}))];
  XLSX.utils.book_append_sheet(wb,ws,"Precios OSDE");
  XLSX.writeFile(wb,"template_precios_osde.xlsx");
}

function downloadTemplate(){
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet([
    ["Grupo Familiar","Fecha de Nacimiento","Edad","Nombre","Tipo benef","Plan de contratación","Zona"],
    [1,"08.12.1961",64,"García Juan","Titular","4500_PYME","AMBA"],
    [1,"01.03.1965",61,"García Ana","Conyuge","4500_PYME","AMBA"],
    [1,"18.12.2014","","García Lucas","Hijo","4500_PYME","AMBA"],
    [2,"05.09.1960",65,"López Pedro","Titular","6500_PYME","Córdoba"],
    [2,"","","-","Conyuge","6500_PYME","Córdoba"],
    [3,"10.11.1980",45,"Martínez Rosa","Titular","Osde 210","AMBA"],
    [3,"15.06.1982",42,"Martínez Marcos","Conyuge","Osde 210","AMBA"],
    [3,"20.03.2008","","Martínez Sofía","Hijo","Osde 210","AMBA"],
  ]);
  ws["!cols"]=[{wch:15},{wch:20},{wch:6},{wch:22},{wch:12},{wch:22},{wch:12}];
  XLSX.utils.book_append_sheet(wb,ws,"Nómina");
  XLSX.writeFile(wb,"template_nomina_omint.xlsx");
}

export { parseNominaFija, downloadTemplate, parsePreciosSheet, parsePreciosFile, parseCostosFile,
  parseOsdeFile, downloadOsdeTemplate };
