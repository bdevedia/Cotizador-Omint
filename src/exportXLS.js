import * as XLSX from "xlsx-js-style";
import { CATS, CAT_IDS, ZONA_IDS } from "./constants";
import { calcOsdeFromEmps } from "./calc";

// ── EXPORTAR EXCEL ANÁLISIS ───────────────────────────────────────────────────
function exportAnalisisXLS(results,empresa,emps,brokerPct,osde,planMappingOsde,masaSalarial){
  const today=new Date().toLocaleDateString("es-AR");
  const mes=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"][new Date().getMonth()];
  const mesAno=`${mes.charAt(0).toUpperCase()+mes.slice(1)} ${new Date().getFullYear()}`;

  // ── Estilos base ──────────────────────────────────────────────────────────
  const FONT_NAME="Aptos Narrow";
  const SZ=9;
  const base=(extra={})=>({font:{name:FONT_NAME,sz:SZ},...extra});
  // fills
  const FILL_DARK_HEADER={fgColor:{rgb:"17375E"},patternType:"solid"};   // azul oscuro encabezados
  const FILL_NAVY     ={fgColor:{rgb:"1F3864"},patternType:"solid"};    // azul marino cotización
  const FILL_GOLD     ={fgColor:{rgb:"FFC000"},patternType:"solid"};    // dorado plan 1
  const FILL_TEAL     ={fgColor:{rgb:"2E75B6"},patternType:"solid"};    // azul plan 2 / 3 / etc
  const FILL_GRAY     ={fgColor:{rgb:"F2F2F2"},patternType:"solid"};    // gris claro filas datos
  const FILL_LIGHTBLUE={fgColor:{rgb:"BDD7EE"},patternType:"solid"};    // azul claro (inputs ajustes)
  const FILL_GREEN    ={fgColor:{rgb:"E2EFDA"},patternType:"solid"};    // verde claro comisión
  const FILL_MED_TEAL ={fgColor:{rgb:"9DC3E6"},patternType:"solid"};    // azul medio (mejoras / costos totales)
  // fonts
  const fWHITE ={name:FONT_NAME,sz:SZ,bold:true,color:{rgb:"FFFFFF"}};
  const fBOLD  ={name:FONT_NAME,sz:SZ,bold:true};
  const fNorm  ={name:FONT_NAME,sz:SZ};
  const fRED   ={name:FONT_NAME,sz:SZ,bold:true,color:{rgb:"FF0000"}};
  const fCAT   ={name:FONT_NAME,sz:SZ,bold:true,color:{rgb:"843C0C"}}; // dark red categoria
  // border thin
  const THIN={style:"thin",color:{rgb:"000000"}};
  const BORDER_ALL={top:THIN,bottom:THIN,left:THIN,right:THIN};
  const BORDER_BOT={bottom:THIN};
  // alignment
  const aL={horizontal:"left",vertical:"center",wrapText:true};
  const aC={horizontal:"center",vertical:"center",wrapText:true};
  const aR={horizontal:"right",vertical:"center"};
  // numFmts
  const NF_MONEY='"$" #,##0;[Red]-"$" #,##0';
  const NF_MONEY2="#,##0.00";
  const NF_PCT  ="0%";
  const NF_PCT1 ="0.0%";
  const NF_INT  ="#,##0";

  // Plan colors — cycling through a palette for N plans
  const PLAN_FILLS=[FILL_GOLD,FILL_TEAL,{fgColor:{rgb:"70AD47"},patternType:"solid"},{fgColor:{rgb:"ED7D31"},patternType:"solid"},{fgColor:{rgb:"A9D18E"},patternType:"solid"}];
  const planFill=(i)=>PLAN_FILLS[i%PLAN_FILLS.length];

  function sc(v,font,fill,alignment,border,numFmt){
    const t=typeof v==="number"?"n":v==null?"z":"s";
    const cell={v:v??null,t,s:{font:font||fNorm,fill:fill||{patternType:"none"},alignment:alignment||aL,border:border||{}}};
    if(numFmt)cell.z=numFmt;
    return cell;
  }

  // Group results by zona
  const zonas=[...new Set(results.map(r=>r.zona))];
  const wb=XLSX.utils.book_new();

  zonas.forEach(zona=>{
    const zResults=results.filter(r=>r.zona===zona);
    const ws={};
    const merges=[];
    let row=0;

    // helper: put cell
    function p(col,r,v,font,fill,align,border,nf){
      ws[XLSX.utils.encode_cell({c:col,r})]= sc(v,font,fill,align,border,nf);
    }
    // helper: put formula cell (f=formula string, v=fallback value)
    function pF(col,r,formula,v,font,fill,align,border,nf){
      const cell=sc(v??0,font,fill,align,border,nf);
      cell.f=formula; cell.t="n";
      ws[XLSX.utils.encode_cell({c:col,r})]=cell;
    }
    // Excel address helper (0-based col/row → "B4")
    const ea=(c,r)=>XLSX.utils.encode_cell({c,r});
    function merge(c1,r1,c2,r2){merges.push({s:{c:c1,r:r1},e:{c:c2,r:r2}});}

    // Col layout: A=0 Plan, B=1 0-25, C=2 26-35, D=3 36-54, E=4 55-59, F=5 60+, G=6 (gap), H=7 H1, I=8 H2+
    // J=9 Precio0-59, K=10 60+, L=11 General  — (same as original cols A-L)
    const CAT_COLS=[1,2,3,4,5,null,7,8]; // B-I skipping G
    const CAT_KEYS=["s0_25","s26_34","s35_54","s55_59","s60plus",null,"h1","h2plus"];
    const CAT_HDR =["00 - 25","26 - 35","36 - 54","55 - 59","60 +",null,"H1","H2+"];
    const CAT_HDR2=["00 - 25","26 - 35","36 - 54","55 - 59","60 +",null,"Hijo 1","Hijo 2 o +"];

    // Compute distribution totals across ALL plans in this zona
    const distTot={s0_25:0,s26_34:0,s35_54:0,s55_59:0,s60plus:0,h1:0,h2plus:0};
    zResults.forEach(res=>{
      CAT_KEYS.filter(Boolean).forEach(k=>{
        const row=res.bd.rows.find(x=>x.id===k);
        distTot[k]+=(row?.count||0);
      });
    });
    const grandTotal=Object.values(distTot).reduce((a,b)=>a+b,0);
    // 0-59 total (no 60+)
    const tot059=distTot.s0_25+distTot.s26_34+distTot.s35_54+distTot.s55_59+distTot.h1+distTot.h2plus;

    // ── SECCIÓN 1: Distribución ──────────────────────────────────────────────
    p(0,row,`Distribución - ${zona}`,fWHITE,FILL_DARK_HEADER,aL,BORDER_ALL);
    merge(0,row,11,row); row++;
    row++; // spacer

    // header row
    ["Plan","0-25","26-35","36-54","55-59","60+",null,"H1","H2+","Total"].forEach((h,ci)=>{
      if(h!=null)p(ci,row,h,fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    });
    row++;

    const distPlanFirstRow=row;
    zResults.forEach((res,pi)=>{
      const fill=pi===0?FILL_GOLD:FILL_TEAL; // simplificado para distribución
      const planName=res.mapping.length>0?res.mapping.map(m=>m.from).join(", "):res.planId;
      p(0,row,planName,fBOLD,FILL_GRAY,aC,BORDER_ALL);
      let planTot=0;
      CAT_KEYS.forEach((k,ci)=>{
        if(k==null)return;
        const cnt=res.bd.rows.find(x=>x.id===k)?.count||0;
        planTot+=cnt;
        p(CAT_COLS[ci],row,cnt,fNorm,FILL_GRAY,aC,BORDER_ALL,NF_INT);
      });
      pF(9,row,`${ea(1,row)}+${ea(2,row)}+${ea(3,row)}+${ea(4,row)}+${ea(7,row)}+${ea(8,row)}`,planTot,fBOLD,FILL_GRAY,aC,BORDER_ALL,NF_INT);
      row++;
    });
    const distPlanLastRow=row-1;

    // Total row
    const distTotalRowIdx=row;
    p(0,row,"Total",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    CAT_KEYS.forEach((k,ci)=>{
      if(k==null)return;
      pF(CAT_COLS[ci],row,`SUM(${ea(CAT_COLS[ci],distPlanFirstRow)}:${ea(CAT_COLS[ci],distPlanLastRow)})`,distTot[k],fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL,NF_INT);
    });
    pF(9,row,`SUM(${ea(9,distPlanFirstRow)}:${ea(9,distPlanLastRow)})`,grandTotal,fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL,NF_INT);
    row++;

    // % row
    const distPctRowIdx=row;
    CAT_KEYS.forEach((k,ci)=>{
      if(k==null)return;
      pF(CAT_COLS[ci],row,`${ea(CAT_COLS[ci],distTotalRowIdx)}/${ea(9,distTotalRowIdx)}`,grandTotal>0?distTot[k]/grandTotal:0,fNorm,null,aC,BORDER_ALL,NF_PCT);
    });
    pF(9,row,`${ea(9,distTotalRowIdx)}/${ea(9,distTotalRowIdx)}`,1,fNorm,null,aC,BORDER_ALL,NF_PCT);
    row++;

    row++; // spacer

    // ── SECCIÓN 2: Rango 0-59 ────────────────────────────────────────────────
    p(0,row,"RANGO 0-59:",fBOLD,FILL_LIGHTBLUE,aL,{right:THIN});
    ["00 - 25","26 - 35","36 - 54","55 - 59",null,null,"H1","H2+","Total"].forEach((h,ci)=>{
      if(h!=null){const col=[1,2,3,4,7,8,9][["00 - 25","26 - 35","36 - 54","55 - 59","H1","H2+","Total"].indexOf(h)];
      if(col!==undefined)p(col,row,h,fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);}
    });
    // simpler: just put them in order
    ["00 - 25","26 - 35","36 - 54","55 - 59"].forEach((h,i)=>p(i+1,row,h,fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL));
    p(7,row,"H1",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    p(8,row,"H2+",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    p(9,row,"Total",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    row++;

    // values 0-59 (no 60+)
    const keys059=["s0_25","s26_34","s35_54","s55_59",null,null,"h1","h2plus"];
    const cols059=[1,2,3,4,null,null,7,8];
    const rango059DataRowIdx=row;
    keys059.forEach((k,ci)=>{
      if(!k)return;
      pF(cols059[ci],row,`+${ea(cols059[ci],distTotalRowIdx)}`,distTot[k],fNorm,FILL_GRAY,aC,BORDER_ALL,NF_INT);
    });
    pF(9,row,`${ea(1,row)}+${ea(2,row)}+${ea(3,row)}+${ea(4,row)}+${ea(7,row)}+${ea(8,row)}`,tot059,fBOLD,FILL_GRAY,aC,BORDER_ALL,NF_INT);
    row++;

    // % row 0-59
    const rango059PctRowIdx=row;
    keys059.forEach((k,ci)=>{
      if(!k)return;
      pF(cols059[ci],row,`${ea(cols059[ci],rango059DataRowIdx)}/${ea(9,rango059DataRowIdx)}`,tot059>0?distTot[k]/tot059:0,fNorm,null,aC,BORDER_ALL,NF_PCT);
    });
    pF(9,row,`${ea(9,rango059DataRowIdx)}/${ea(9,rango059DataRowIdx)}`,1,fNorm,null,aC,BORDER_ALL,NF_PCT);
    row++;

    row++; // spacer

    // ── SECCIÓN 3: Precios Omint ──────────────────────────────────────────────
    p(0,row,`Precios Omint - ${zona} - ${mesAno}`,fWHITE,FILL_DARK_HEADER,aL,BORDER_ALL);
    merge(0,row,11,row); row++;

    // sub-header categorias
    p(1,row,"Adulto / Cónyuge / FAC / Hijo mayor 25",fCAT,null,aL,BORDER_BOT);
    merge(1,row,5,row);
    p(7,row,"Hijo menor 25",fCAT,null,aL,BORDER_BOT);
    merge(7,row,8,row);
    p(9,row,"Precios capitados",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    merge(9,row,11,row);
    row++;

    // col headers
    ["00 - 25","26 - 35","36 - 54","55 - 59","60 +"].forEach((h,i)=>p(i+1,row,h,fBOLD,null,aC,BORDER_ALL));
    p(7,row,"Hijo 1",fBOLD,null,aC,BORDER_ALL);
    p(8,row,"Hijo 2 o +",fBOLD,null,aC,BORDER_ALL);
    p(9,row,"0-59",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    p(10,row,"60+",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    p(11,row,"General",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    row++;

    // Ajustes header row
    p(1,row,"Ajuste",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL); merge(1,row,2,row);
    p(3,row,"Precios capitados",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL); merge(3,row,5,row);
    p(6,row,"Vs. plan anterior",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL); merge(6,row,8,row);
    p(9,row,"C/F",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL); merge(9,row,11,row);
    row++;

    // sub col headers for Ajustes section
    p(1,row,"0-59",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    p(2,row,"60+",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    p(3,row,"0-59",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    p(4,row,"60+",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    p(5,row,"General",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    p(6,row,"0-59",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    p(7,row,"60+",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    p(8,row,"General",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    p(9,row,"0-59",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    p(10,row,"60+",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    p(11,row,"General",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    const adjHeaderRow=row; row++;

    // plan rows prices
    const precioRows=[]; // save for cotizacion section
    const precioRowIdxs=[]; // row indices for formula references
    zResults.forEach((res,pi)=>{
      const pf=planFill(pi);
      const planName=res.mapping.length>0?res.mapping.map(m=>m.from).join(", "):res.planId;
      p(0,row,planName,fBOLD,pf,aC,BORDER_ALL);
      const getP=id=>res.bd.rows.find(x=>x.id===id)?.precio||0;
      [getP("s0_25"),getP("s26_34"),getP("s35_54"),getP("s55_59"),getP("s60plus")].forEach((v,i)=>p(i+1,row,+v.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY));
      p(7,row,+getP("h1").toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      p(8,row,+getP("h2plus").toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);

      // precio capitado 0-59 (SUMPRODUCT con dist 0-59)
      const precio059=tot059>0?["s0_25","s26_34","s35_54","s55_59","h1","h2plus"].reduce((a,k)=>{
        const cnt=distTot[k]; const pr=res.bd.rows.find(x=>x.id===k)?.precio||0; return a+cnt*pr;
      },0)/tot059:0;
      const precio60=getP("s60plus");
      const precioGen=grandTotal>0?CAT_KEYS.filter(Boolean).reduce((a,k)=>{
        const cnt=distTot[k]; const pr=res.bd.rows.find(x=>x.id===k)?.precio||0; return a+cnt*pr;
      },0)/grandTotal:0;

      // ajuste col: compare vs base precio (show pct diff if adjusted)
      p(1,row,"—",fNorm,FILL_LIGHTBLUE,aC,BORDER_ALL); // placeholder — sin formula
      p(2,row,"—",fNorm,FILL_LIGHTBLUE,aC,BORDER_ALL);

      // capitado prices — static values (category prices overwritten in same row)
      p(3,row,+precio059.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      p(4,row,+precio60.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      p(5,row,+precioGen.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);

      // vs plan anterior — formula referencing capitado cells of prev row
      if(pi===0){
        p(6,row,"—",fNorm,FILL_GRAY,aC,BORDER_ALL);
        p(7,row,"—",fNorm,FILL_GRAY,aC,BORDER_ALL);
        p(8,row,"—",fNorm,FILL_GRAY,aC,BORDER_ALL);
      } else {
        const prev=zResults[pi-1];
        const prevP059=tot059>0?["s0_25","s26_34","s35_54","s55_59","h1","h2plus"].reduce((a,k)=>{
          const cnt=distTot[k]; const pr=prev.bd.rows.find(x=>x.id===k)?.precio||0; return a+cnt*pr;
        },0)/tot059:0;
        const prevP60=prev.bd.rows.find(x=>x.id==="s60plus")?.precio||0;
        const prevPGen=grandTotal>0?CAT_KEYS.filter(Boolean).reduce((a,k)=>{
          const cnt=distTot[k]; const pr=prev.bd.rows.find(x=>x.id===k)?.precio||0; return a+cnt*pr;
        },0)/grandTotal:0;
        const prevRowIdx=precioRowIdxs[pi-1];
        pF(6,row,`${ea(3,row)}/${ea(3,prevRowIdx)}-1`,prevP059>0?precio059/prevP059-1:0,fNorm,FILL_GRAY,aC,BORDER_ALL,NF_PCT1);
        pF(7,row,`${ea(4,row)}/${ea(4,prevRowIdx)}-1`,prevP60>0?precio60/prevP60-1:0,fNorm,FILL_GRAY,aC,BORDER_ALL,NF_PCT1);
        pF(8,row,`${ea(5,row)}/${ea(5,prevRowIdx)}-1`,prevPGen>0?precioGen/prevPGen-1:0,fNorm,FILL_GRAY,aC,BORDER_ALL,NF_PCT1);
      }

      const cfGen=precioGen>0?res.bd.cfTotal/100:0;
      // C/F — reference cotización costs/prices (static for now since costs in different section)
      p(9,row,+res.bd.cfTotal.toFixed(1)/100,fNorm,null,aC,BORDER_ALL,NF_PCT1);
      p(10,row,precio60>0?res.bd.rows.find(x=>x.id==="s60plus")?.costo>0?res.bd.rows.find(x=>x.id==="s60plus").costo/precio60:0:0,fNorm,null,aC,BORDER_ALL,NF_PCT1);
      p(11,row,+cfGen.toFixed(4),fNorm,null,aC,BORDER_ALL,NF_PCT1);

      precioRows.push({res,pi,planName,precio059,precio60,precioGen});
      precioRowIdxs.push(row);
      row++;
    });

    row++; // spacer

    // ── SECCIÓN 4: Costos EE ─────────────────────────────────────────────────
    const brokerMult=1+(parseFloat(brokerPct)||0)/100;
    p(0,row,`Costos EE - ${zona} - ${mesAno}`,fWHITE,FILL_DARK_HEADER,aL,BORDER_ALL);
    merge(0,row,11,row); row++;

    if(parseFloat(brokerPct)>0){
      p(0,row,"Comisión:",fBOLD,FILL_GREEN,aL,BORDER_ALL);
      p(1,row,parseFloat(brokerPct)/100,fNorm,FILL_GREEN,aC,BORDER_ALL,NF_PCT);
      row++;
    }

    // sub-headers costos
    p(1,row,"Adulto / Cónyuge / FAC / Hijo mayor 25",fCAT,null,aL,BORDER_BOT);
    merge(1,row,5,row);
    p(7,row,"Hijo menor 25",fCAT,null,aL,BORDER_BOT);
    merge(7,row,8,row);
    p(9,row,"Costos capitados",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    merge(9,row,11,row); row++;

    ["00 - 25","26 - 35","36 - 54","55 - 59","60 +"].forEach((h,i)=>p(i+1,row,h,fBOLD,null,aC,BORDER_ALL));
    p(7,row,"Hijo 1",fBOLD,null,aC,BORDER_ALL);
    p(8,row,"Hijo 2 o +",fBOLD,null,aC,BORDER_ALL);
    p(9,row,"0-59",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    p(10,row,"60+",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    p(11,row,"General",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    row++;

    const costoCapRows=[];
    zResults.forEach((res,pi)=>{
      const pf=planFill(pi);
      const planName=res.mapping.length>0?res.mapping.map(m=>m.from).join(", "):res.planId;
      p(0,row,planName,fBOLD,pf,aC,BORDER_ALL);
      const getC=id=>res.bd.rows.find(x=>x.id===id)?.costo||0;
      [getC("s0_25"),getC("s26_34"),getC("s35_54"),getC("s55_59"),getC("s60plus")].forEach((v,i)=>p(i+1,row,+v.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY));
      p(7,row,+getC("h1").toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      p(8,row,+getC("h2plus").toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);

      const costo059=tot059>0?["s0_25","s26_34","s35_54","s55_59","h1","h2plus"].reduce((a,k)=>{
        const cnt=distTot[k]; const cv=res.bd.rows.find(x=>x.id===k)?.costo||0; return a+cnt*cv;
      },0)/tot059:0;
      const costo60=getC("s60plus");
      const costoGen=grandTotal>0?CAT_KEYS.filter(Boolean).reduce((a,k)=>{
        const cnt=distTot[k]; const cv=res.bd.rows.find(x=>x.id===k)?.costo||0; return a+cnt*cv;
      },0)/grandTotal:0;

      p(9,row,+costo059.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      p(10,row,+costo60.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      p(11,row,+costoGen.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      costoCapRows.push({costo059,costo60,costoGen});
      row++;
    });

    row++; // spacer

    // ── SECCIÓN 5: Mejoras (placeholder ceros) ────────────────────────────────
    p(0,row,"Mejoras",fWHITE,FILL_MED_TEAL,aC,BORDER_ALL);
    merge(0,row,11,row); row++;

    ["00 - 25","26 - 35","36 - 54","55 - 59","60 +"].forEach((h,i)=>p(i+1,row,h,fBOLD,null,aC,BORDER_ALL));
    p(7,row,"Hijo 1",fBOLD,null,aC,BORDER_ALL);
    p(8,row,"Hijo 2 o +",fBOLD,null,aC,BORDER_ALL);
    row++;

    zResults.forEach((res,pi)=>{
      const planName=res.mapping.length>0?res.mapping.map(m=>m.from).join(", "):res.planId;
      p(0,row,planName,fBOLD,planFill(pi),aC,BORDER_ALL);
      [1,2,3,4,5,7,8].forEach(ci=>p(ci,row,0,fNorm,null,aC,BORDER_ALL,NF_MONEY));
      row++;
    });

    row++; // spacer

    // ── SECCIÓN 6: Costos totales (costo + mejoras) ───────────────────────────
    p(0,row,"Costos totales",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    merge(0,row,11,row); row++;

    p(1,row,"Adulto / Cónyuge / FAC / Hijo mayor 25",fCAT,null,aL,BORDER_BOT);
    merge(1,row,5,row);
    p(7,row,"Hijo menor 25",fCAT,null,aL,BORDER_BOT);
    merge(7,row,8,row);
    p(9,row,"Costos capitados",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    merge(9,row,11,row); row++;

    ["00 - 25","26 - 35","36 - 54","55 - 59","60 +"].forEach((h,i)=>p(i+1,row,h,fBOLD,null,aC,BORDER_ALL));
    p(7,row,"Hijo 1",fBOLD,null,aC,BORDER_ALL);
    p(8,row,"Hijo 2 o +",fBOLD,null,aC,BORDER_ALL);
    p(9,row,"0-59",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    p(10,row,"60+",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    p(11,row,"General",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    row++;

    const costoTotRows=[];
    zResults.forEach((res,pi)=>{
      const pf=planFill(pi);
      const planName=res.mapping.length>0?res.mapping.map(m=>m.from).join(", "):res.planId;
      p(0,row,planName,fBOLD,pf,aC,BORDER_ALL);
      const getC=id=>res.bd.rows.find(x=>x.id===id)?.costo||0; // mejoras=0 por ahora
      [getC("s0_25"),getC("s26_34"),getC("s35_54"),getC("s55_59"),getC("s60plus")].forEach((v,i)=>p(i+1,row,+v.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY));
      p(7,row,+getC("h1").toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      p(8,row,+getC("h2plus").toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      p(9,row,+costoCapRows[pi].costo059.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      p(10,row,+costoCapRows[pi].costo60.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      p(11,row,+costoCapRows[pi].costoGen.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      costoTotRows.push({...costoCapRows[pi]});
      row++;
    });

    row++; // spacer

    // ── SECCIÓN 7: COTIZACIÓN ────────────────────────────────────────────────
    const cotLabel=`COTIZACIÓN ${mesAno.toUpperCase()} - ${zona}`;
    p(0,row,cotLabel,fWHITE,FILL_NAVY,aC,BORDER_ALL);
    merge(0,row,8,row); row++;

    // Headers cotización
    ["Plan","Facturación","Plan Omint","Fact. Omint","VS OSDE","Costo","C/F"].forEach((h,i)=>
      p(i,row,h,fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL));
    row++;

    const totalFac=zResults.reduce((a,r)=>a+r.bd.totalFac,0);
    const totalCosto=zResults.reduce((a,r)=>a+r.bd.totalCosto,0);
    let totalOsdeAllPlans=0;

    const cotPlanFirstRow=row;
    const cotPlanRowIdxs=[];
    zResults.forEach((res,pi)=>{
      const pf=planFill(pi);
      const planName=res.mapping.length>0?res.mapping.map(m=>m.from).join(", "):res.planId;
      const mappedOsde=planMappingOsde?.[res.adjKey];
      const osdeResult=mappedOsde&&osde?.[mappedOsde]?calcOsdeFromEmps(res.empList,osde[mappedOsde]):null;
      const osdeFac=osdeResult?osdeResult.total:0;
      totalOsdeAllPlans+=osdeFac;
      const vsOsde=osdeFac>0&&res.bd.totalFac>0?res.bd.totalFac/osdeFac-1:null;

      p(0,row,planName,fBOLD,FILL_GRAY,aC,BORDER_ALL);
      p(1,row,osdeFac>0?+osdeFac.toFixed(2):null,fNorm,FILL_GRAY,aC,BORDER_ALL,NF_MONEY2);
      p(2,row,res.planId,fBOLD,pf,aC,BORDER_ALL);
      p(3,row,+res.bd.totalFac.toFixed(2),fNorm,FILL_GRAY,aC,BORDER_ALL,NF_MONEY2);
      // VS OSDE formula: D/B-1
      if(osdeFac>0){
        pF(4,row,`${ea(3,row)}/${ea(1,row)}-1`,vsOsde!==null?+vsOsde.toFixed(4):null,fNorm,FILL_GRAY,aC,BORDER_ALL,NF_PCT1);
      } else {
        p(4,row,null,fNorm,FILL_GRAY,aC,BORDER_ALL,NF_PCT1);
      }
      p(5,row,+res.bd.totalCosto.toFixed(2),fNorm,FILL_GRAY,aC,BORDER_ALL,NF_MONEY2);
      // C/F formula: F/D
      pF(6,row,`${ea(5,row)}/${ea(3,row)}`,res.bd.totalFac>0?+(res.bd.totalCosto/res.bd.totalFac).toFixed(4):0,fNorm,FILL_GRAY,aC,BORDER_ALL,NF_PCT1);
      cotPlanRowIdxs.push(row);
      row++;
    });

    // Total row
    const cotTotalRowIdx=row;
    const cotPlanLastRow=row-1;
    const totalOsde=totalOsdeAllPlans;
    const vsOsdeTotal=totalOsde>0&&totalFac>0?totalFac/totalOsde-1:null;
    p(0,row,"Total",fWHITE,FILL_NAVY,aC,BORDER_ALL);
    pF(1,row,`SUM(${ea(1,cotPlanFirstRow)}:${ea(1,cotPlanLastRow)})`,totalOsde>0?+totalOsde.toFixed(2):null,fWHITE,FILL_NAVY,aC,BORDER_ALL,NF_MONEY2);
    p(2,row,"",fWHITE,FILL_NAVY,aC,BORDER_ALL);
    pF(3,row,`SUM(${ea(3,cotPlanFirstRow)}:${ea(3,cotPlanLastRow)})`,+totalFac.toFixed(2),fWHITE,FILL_NAVY,aC,BORDER_ALL,NF_MONEY2);
    if(totalOsde>0){
      pF(4,row,`${ea(3,cotTotalRowIdx)}/${ea(1,cotTotalRowIdx)}-1`,vsOsdeTotal!==null?+vsOsdeTotal.toFixed(4):null,fWHITE,FILL_NAVY,aC,BORDER_ALL,NF_PCT1);
    } else {
      p(4,row,null,fWHITE,FILL_NAVY,aC,BORDER_ALL,NF_PCT1);
    }
    pF(5,row,`SUM(${ea(5,cotPlanFirstRow)}:${ea(5,cotPlanLastRow)})`,+totalCosto.toFixed(2),fWHITE,FILL_NAVY,aC,BORDER_ALL,NF_MONEY2);
    pF(6,row,`${ea(5,cotTotalRowIdx)}/${ea(3,cotTotalRowIdx)}`,totalFac>0?+(totalCosto/totalFac).toFixed(4):0,fWHITE,FILL_NAVY,aC,BORDER_ALL,NF_PCT1);
    row++;

    // Masa salarial / aporte
    const masaSal=parseFloat(masaSalarial)||0;
    if(masaSal>0){
      row++;
      const masaSalRowIdx=row;
      p(0,row,"Masa salarial:",fBOLD,null,aL,BORDER_ALL);
      p(1,row,+masaSal.toFixed(2),fNorm,null,aC,BORDER_ALL,NF_MONEY2);
      row++;
      const aporteRowIdx=row;
      const aporte=masaSal*0.09*0.85*(1+1/12);
      p(0,row,"Aporte (9% × 85% × 13/12):",fBOLD,null,aL,BORDER_ALL);
      // formula: masa_sal * 9% * 85% * 13/12
      pF(1,row,`${ea(1,masaSalRowIdx)}*0.09*0.85*(13/12)`,+aporte.toFixed(2),fNorm,null,aC,BORDER_ALL,NF_MONEY2);
      row++;
      const saldo=totalFac-aporte;
      p(0,row,"Saldo a pagar:",fBOLD,null,aL,BORDER_ALL);
      // formula: total Fact. Omint - aporte
      pF(1,row,`${ea(3,cotTotalRowIdx)}-${ea(1,aporteRowIdx)}`,+saldo.toFixed(2),fRED,null,aC,BORDER_ALL,NF_MONEY2);
      row++;
    }

    row++; // spacer

    // ── SECCIÓN 8: Propuesta ─────────────────────────────────────────────────
    p(0,row,"Propuesta",fWHITE,FILL_DARK_HEADER,aL,BORDER_ALL);
    merge(0,row,11,row); row++;

    p(1,row,"Adulto / Cónyuge / FAC / Hijo mayor 25",fCAT,null,aL,BORDER_BOT);
    merge(1,row,5,row);
    p(7,row,"Hijo menor 25",fCAT,null,aL,BORDER_BOT);
    merge(7,row,8,row);
    p(9,row,"Precios capitados",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    merge(9,row,11,row); row++;

    p(0,row,"Plan OMINT",fWHITE,FILL_DARK_HEADER,aL,BORDER_ALL);
    ["00 - 25","26 - 35","36 - 54","55 - 59","60 +"].forEach((h,i)=>p(i+1,row,h,fBOLD,null,aC,BORDER_ALL));
    p(7,row,"Hijo 1",fBOLD,null,aC,BORDER_ALL);
    p(8,row,"Hijo 2 o +",fBOLD,null,aC,BORDER_ALL);
    p(9,row,"0-59",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    p(10,row,"60+",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    p(11,row,"General",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    row++;

    zResults.forEach((res,pi)=>{
      const pf=planFill(pi);
      const planName=res.mapping.length>0?res.mapping.map(m=>m.from).join(", "):res.planId;
      p(0,row,planName,fBOLD,pf,aC,BORDER_ALL);
      const getP=id=>res.bd.rows.find(x=>x.id===id)?.precio||0;
      [getP("s0_25"),getP("s26_34"),getP("s35_54"),getP("s55_59"),getP("s60plus")].forEach((v,i)=>p(i+1,row,+v.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY));
      p(7,row,+getP("h1").toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      p(8,row,+getP("h2plus").toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      p(9,row,+precioRows[pi].precio059.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      p(10,row,+precioRows[pi].precio60.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      p(11,row,+precioRows[pi].precioGen.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      row++;
    });

    // finalize sheet
    ws["!ref"]=XLSX.utils.encode_range({s:{c:0,r:0},e:{c:11,r:row}});
    ws["!merges"]=merges;
    ws["!cols"]=[
      {wch:20},{wch:11},{wch:11},{wch:11},{wch:11},{wch:11},{wch:3},{wch:11},{wch:11},{wch:14},{wch:12},{wch:14}
    ];
    const sheetName=zonas.length>1?`Cot. ${zona}`.slice(0,31):"Cotización";
    XLSX.utils.book_append_sheet(wb,ws,sheetName);
  });

  // Hoja Nómina
  if(emps&&emps.length>0){
    const BASE2={font:{name:"Calibri",sz:10},alignment:{vertical:"center"}};
    const BC={...BASE2,alignment:{horizontal:"center",vertical:"center"}};
    const wsNom=XLSX.utils.json_to_sheet(emps);
    const nomRange=XLSX.utils.decode_range(wsNom["!ref"]||"A1");
    for(let nr=nomRange.s.r;nr<=nomRange.e.r;nr++){
      for(let nc=nomRange.s.c;nc<=nomRange.e.c;nc++){
        const cellRef=XLSX.utils.encode_cell({c:nc,r:nr});
        if(wsNom[cellRef])wsNom[cellRef].s=nr===0?{...BC,font:{name:"Calibri",sz:10,bold:true}}:BC;
      }
    }
    wsNom["!cols"]=Array(10).fill({wch:14});
    XLSX.utils.book_append_sheet(wb,wsNom,"Nómina");
  }

  XLSX.writeFile(wb,`Cotizacion_${empresa||"empresa"}_${today.replace(/\//g,"-")}.xlsx`);
}

export { exportAnalisisXLS };
