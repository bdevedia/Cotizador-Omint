import * as XLSX from "xlsx-js-style";
import { CATS, CAT_IDS, ZONA_IDS } from "./constants";
import { calcOsdeFromEmps } from "./calc";

// ── EXPORTAR EXCEL ANÁLISIS ───────────────────────────────────────────────────
function exportAnalisisXLS(results,empresa,emps,brokerPct,osde,planMappingOsde,masaSalarial){
  const today=new Date().toLocaleDateString("es-AR");
  const mes=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"][new Date().getMonth()];
  const mesAno=`${mes.charAt(0).toUpperCase()+mes.slice(1)} ${new Date().getFullYear()}`;

  const FONT_NAME="Aptos Narrow";
  const SZ=9;
  const FILL_DARK_HEADER={fgColor:{rgb:"17375E"},patternType:"solid"};
  const FILL_NAVY     ={fgColor:{rgb:"1F3864"},patternType:"solid"};
  const FILL_GOLD     ={fgColor:{rgb:"FFC000"},patternType:"solid"};
  const FILL_TEAL     ={fgColor:{rgb:"2E75B6"},patternType:"solid"};
  const FILL_GRAY     ={fgColor:{rgb:"F2F2F2"},patternType:"solid"};
  const FILL_LIGHTBLUE={fgColor:{rgb:"BDD7EE"},patternType:"solid"};
  const FILL_GREEN    ={fgColor:{rgb:"E2EFDA"},patternType:"solid"};
  const FILL_MED_TEAL ={fgColor:{rgb:"9DC3E6"},patternType:"solid"};
  const fWHITE ={name:FONT_NAME,sz:SZ,bold:true,color:{rgb:"FFFFFF"}};
  const fBOLD  ={name:FONT_NAME,sz:SZ,bold:true};
  const fNorm  ={name:FONT_NAME,sz:SZ};
  const fRED   ={name:FONT_NAME,sz:SZ,bold:true,color:{rgb:"FF0000"}};
  const fCAT   ={name:FONT_NAME,sz:SZ,bold:true,color:{rgb:"843C0C"}};
  const THIN={style:"thin",color:{rgb:"000000"}};
  const BORDER_ALL={top:THIN,bottom:THIN,left:THIN,right:THIN};
  const BORDER_BOT={bottom:THIN};
  const aL={horizontal:"left",vertical:"center",wrapText:true};
  const aC={horizontal:"center",vertical:"center",wrapText:true};
  const NF_MONEY='"$" #,##0;[Red]-"$" #,##0';
  const NF_MONEY2="#,##0.00";
  const NF_PCT  ="0%";
  const NF_PCT1 ="0.0%";
  const NF_INT  ="#,##0";

  const PLAN_FILLS=[FILL_GOLD,FILL_TEAL,{fgColor:{rgb:"70AD47"},patternType:"solid"},{fgColor:{rgb:"ED7D31"},patternType:"solid"},{fgColor:{rgb:"A9D18E"},patternType:"solid"}];
  const planFill=(i)=>PLAN_FILLS[i%PLAN_FILLS.length];

  function sc(v,font,fill,alignment,border,numFmt){
    const t=typeof v==="number"?"n":v==null?"z":"s";
    const cell={v:v??null,t,s:{font:font||fNorm,fill:fill||{patternType:"none"},alignment:alignment||aL,border:border||{}}};
    if(numFmt)cell.z=numFmt;
    return cell;
  }

  const zonas=[...new Set(results.map(r=>r.zona))];
  const wb=XLSX.utils.book_new();

  zonas.forEach(zona=>{
    const zResults=results.filter(r=>r.zona===zona);
    const ws={};
    const merges=[];
    let row=0;

    function p(col,r,v,font,fill,align,border,nf){
      ws[XLSX.utils.encode_cell({c:col,r})]= sc(v,font,fill,align,border,nf);
    }
    function pF(col,r,formula,v,font,fill,align,border,nf){
      const cell=sc(v??0,font,fill,align,border,nf);
      cell.f=formula; cell.t="n";
      ws[XLSX.utils.encode_cell({c:col,r})]=cell;
    }
    const ea=(c,r)=>XLSX.utils.encode_cell({c,r});
    function merge(c1,r1,c2,r2){merges.push({s:{c:c1,r:r1},e:{c:c2,r:r2}});}

    // Col layout: A=0, B=1(s0_25), C=2(s26_34), D=3(s35_54), E=4(s55_59), F=5(s60plus), G=6(gap), H=7(h1), I=8(h2plus)
    // J=9, K=10, L=11
    const CAT_KEYS=["s0_25","s26_34","s35_54","s55_59","s60plus",null,"h1","h2plus"];
    const CAT_COLS=[1,2,3,4,5,null,7,8];

    // Distribution totals across ALL plans
    const distTot={s0_25:0,s26_34:0,s35_54:0,s55_59:0,s60plus:0,h1:0,h2plus:0};
    zResults.forEach(res=>{
      CAT_KEYS.filter(Boolean).forEach(k=>{
        const r=res.bd.rows.find(x=>x.id===k);
        distTot[k]+=(r?.count||0);
      });
    });
    const grandTotal=Object.values(distTot).reduce((a,b)=>a+b,0);
    const tot059=distTot.s0_25+distTot.s26_34+distTot.s35_54+distTot.s55_59+distTot.h1+distTot.h2plus;

    // ── SECCIÓN 1: Distribución ──────────────────────────────────────────────
    p(0,row,`Distribución - ${zona}`,fWHITE,FILL_DARK_HEADER,aL,BORDER_ALL);
    merge(0,row,11,row); row++;
    row++;

    ["Plan","0-25","26-35","36-54","55-59","60+",null,"H1","H2+","Total"].forEach((h,ci)=>{
      if(h!=null)p(ci,row,h,fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    });
    row++;

    const distPlanFirstRow=row;
    zResults.forEach((res,pi)=>{
      p(0,row,res.planId,fBOLD,FILL_GRAY,aC,BORDER_ALL);
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

    const distTotalRowIdx=row;
    p(0,row,"Total",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    CAT_KEYS.forEach((k,ci)=>{
      if(k==null)return;
      pF(CAT_COLS[ci],row,`SUM(${ea(CAT_COLS[ci],distPlanFirstRow)}:${ea(CAT_COLS[ci],distPlanLastRow)})`,distTot[k],fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL,NF_INT);
    });
    pF(9,row,`SUM(${ea(9,distPlanFirstRow)}:${ea(9,distPlanLastRow)})`,grandTotal,fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL,NF_INT);
    row++;

    const distPctRowIdx=row;
    CAT_KEYS.forEach((k,ci)=>{
      if(k==null)return;
      pF(CAT_COLS[ci],row,`${ea(CAT_COLS[ci],distTotalRowIdx)}/IF(${ea(9,distTotalRowIdx)}=0,1,${ea(9,distTotalRowIdx)})`,grandTotal>0?distTot[k]/grandTotal:0,fNorm,null,aC,BORDER_ALL,NF_PCT);
    });
    pF(9,row,`${ea(9,distTotalRowIdx)}/IF(${ea(9,distTotalRowIdx)}=0,1,${ea(9,distTotalRowIdx)})`,1,fNorm,null,aC,BORDER_ALL,NF_PCT);
    row++;
    row++;

    // ── SECCIÓN 2: Rango 0-59 ────────────────────────────────────────────────
    p(0,row,"RANGO 0-59:",fBOLD,FILL_LIGHTBLUE,aL,{right:THIN});
    ["00 - 25","26 - 35","36 - 54","55 - 59"].forEach((h,i)=>p(i+1,row,h,fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL));
    p(7,row,"H1",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    p(8,row,"H2+",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    p(9,row,"Total",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    row++;

    const keys059=["s0_25","s26_34","s35_54","s55_59",null,null,"h1","h2plus"];
    const cols059=[1,2,3,4,null,null,7,8];
    const rango059DataRowIdx=row;
    keys059.forEach((k,ci)=>{
      if(!k)return;
      pF(cols059[ci],row,`+${ea(cols059[ci],distTotalRowIdx)}`,distTot[k],fNorm,FILL_GRAY,aC,BORDER_ALL,NF_INT);
    });
    pF(9,row,`${ea(1,row)}+${ea(2,row)}+${ea(3,row)}+${ea(4,row)}+${ea(7,row)}+${ea(8,row)}`,tot059,fBOLD,FILL_GRAY,aC,BORDER_ALL,NF_INT);
    row++;

    const rango059PctRowIdx=row;
    keys059.forEach((k,ci)=>{
      if(!k)return;
      pF(cols059[ci],row,`${ea(cols059[ci],rango059DataRowIdx)}/IF(${ea(9,rango059DataRowIdx)}=0,1,${ea(9,rango059DataRowIdx)})`,tot059>0?distTot[k]/tot059:0,fNorm,null,aC,BORDER_ALL,NF_PCT);
    });
    pF(9,row,`${ea(9,rango059DataRowIdx)}/IF(${ea(9,rango059DataRowIdx)}=0,1,${ea(9,rango059DataRowIdx)})`,1,fNorm,null,aC,BORDER_ALL,NF_PCT);
    row++;
    row++;

    // ── SECCIÓN 3: Precios Omint ──────────────────────────────────────────────
    p(0,row,`Precios Omint - ${zona} - ${mesAno}`,fWHITE,FILL_DARK_HEADER,aL,BORDER_ALL);
    merge(0,row,11,row); row++;

    p(1,row,"Adulto / Cónyuge / FAC / Hijo mayor 25",fCAT,null,aL,BORDER_BOT);
    merge(1,row,5,row);
    p(7,row,"Hijo menor 25",fCAT,null,aL,BORDER_BOT);
    merge(7,row,8,row);
    p(9,row,"Precios capitados",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    merge(9,row,11,row); row++;

    ["00 - 25","26 - 35","36 - 54","55 - 59","60 +"].forEach((h,i)=>p(i+1,row,h,fBOLD,null,aC,BORDER_ALL));
    p(7,row,"Hijo 1",fBOLD,null,aC,BORDER_ALL);
    p(8,row,"Hijo 2 o +",fBOLD,null,aC,BORDER_ALL);
    p(9,row,"0-59",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    p(10,row,"60+",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    p(11,row,"General",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL);
    row++;

    p(1,row,"Ajuste",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL); merge(1,row,2,row);
    p(3,row,"Precios capitados",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL); merge(3,row,5,row);
    p(6,row,"Vs. plan anterior",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL); merge(6,row,8,row);
    p(9,row,"C/F",fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL); merge(9,row,11,row);
    row++;

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
    row++;

    // Pre-calcular índices de filas sec 3 (bpr=base, adj=ajuste, 2 filas por plan)
    const basePriceRowIdxs=zResults.map((_,pi)=>row+pi*2);
    const adjRowIdxs=zResults.map((_,pi)=>row+pi*2+1);

    zResults.forEach((res,pi)=>{
      const pf=planFill(pi);
      const getP=id=>res.bd.rows.find(x=>x.id===id)?.precio||0;

      // ── Base prices row: precio_cotizador * (1 + ajuste) ──
      const bpr=basePriceRowIdxs[pi];
      const adj=adjRowIdxs[pi];
      p(0,row,res.planId,fBOLD,pf,aC,BORDER_ALL);
      // 0-59 cats usan adj 0-59 (col 1), 60+ usa adj 60+ (col 2)
      [getP("s0_25"),getP("s26_34"),getP("s35_54"),getP("s55_59")].forEach((v,i)=>
        pF(i+1,row,`${+v.toFixed(0)}*(1+${ea(1,adj)})`,+v.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY));
      pF(5,row,`${+getP("s60plus").toFixed(0)}*(1+${ea(2,adj)})`,+getP("s60plus").toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      pF(7,row,`${+getP("h1").toFixed(0)}*(1+${ea(1,adj)})`,+getP("h1").toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      pF(8,row,`${+getP("h2plus").toFixed(0)}*(1+${ea(1,adj)})`,+getP("h2plus").toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      row++;

      // ── Ajuste row ──
      p(0,row,"Ajuste",fBOLD,pf,aC,BORDER_ALL);

      // Adjustment inputs (editable, start at 0)
      p(1,row,0,fNorm,FILL_LIGHTBLUE,aC,BORDER_ALL,NF_PCT1); // adj 0-59
      p(2,row,0,fNorm,FILL_LIGHTBLUE,aC,BORDER_ALL,NF_PCT1); // adj 60+

      // Capitado: bpr ya tiene precios ajustados (precio_base*(1+adj)), solo ponderar
      const precio059=tot059>0?["s0_25","s26_34","s35_54","s55_59","h1","h2plus"].reduce((a,k)=>a+(distTot[k]||0)*(getP(k)||0),0)/tot059:0;
      const precio60=getP("s60plus");
      const precioGen=grandTotal>0?CAT_KEYS.filter(Boolean).reduce((a,k)=>a+(distTot[k]||0)*(getP(k)||0),0)/grandTotal:0;

      const dP=distPctRowIdx;
      const rP=rango059PctRowIdx;

      // cap059 = SUMPRODUCT(precios_ajustados_059, pct_059)
      pF(3,row,`SUMPRODUCT(${ea(1,bpr)}:${ea(8,bpr)},${ea(1,rP)}:${ea(8,rP)})`,+precio059.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      // cap60 = precio_60_ajustado
      pF(4,row,`+${ea(5,bpr)}`,+precio60.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      // capGen = SUMPRODUCT(precios_ajustados, pct_total)
      pF(5,row,`SUMPRODUCT(${ea(1,bpr)}:${ea(8,bpr)},${ea(1,dP)}:${ea(8,dP)})`,+precioGen.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);

      // Vs plan anterior
      if(pi===0){
        p(6,row,"—",fNorm,FILL_GRAY,aC,BORDER_ALL);
        p(7,row,"—",fNorm,FILL_GRAY,aC,BORDER_ALL);
        p(8,row,"—",fNorm,FILL_GRAY,aC,BORDER_ALL);
      } else {
        const prevAdj=adjRowIdxs[pi-1];
        const prev=zResults[pi-1];
        const prevP059=tot059>0?["s0_25","s26_34","s35_54","s55_59","h1","h2plus"].reduce((a,k)=>a+(distTot[k]||0)*(prev.bd.rows.find(x=>x.id===k)?.precio||0),0)/tot059:0;
        const prevP60=prev.bd.rows.find(x=>x.id==="s60plus")?.precio||0;
        const prevPGen=grandTotal>0?CAT_KEYS.filter(Boolean).reduce((a,k)=>a+(distTot[k]||0)*(prev.bd.rows.find(x=>x.id===k)?.precio||0),0)/grandTotal:0;
        pF(6,row,`${ea(3,adj)}/${ea(3,prevAdj)}-1`,prevP059>0?precio059/prevP059-1:0,fNorm,FILL_GRAY,aC,BORDER_ALL,NF_PCT1);
        pF(7,row,`${ea(4,adj)}/${ea(4,prevAdj)}-1`,prevP60>0?precio60/prevP60-1:0,fNorm,FILL_GRAY,aC,BORDER_ALL,NF_PCT1);
        pF(8,row,`${ea(5,adj)}/${ea(5,prevAdj)}-1`,prevPGen>0?precioGen/prevPGen-1:0,fNorm,FILL_GRAY,aC,BORDER_ALL,NF_PCT1);
      }

      // C/F cols 9,10,11 — will be updated with formulas after sec 6 is written
      p(9,row,0,fNorm,null,aC,BORDER_ALL,NF_PCT1);
      p(10,row,0,fNorm,null,aC,BORDER_ALL,NF_PCT1);
      p(11,row,0,fNorm,null,aC,BORDER_ALL,NF_PCT1);
      row++;
    });

    row++;

    // ── SECCIÓN 4: Costos EE ─────────────────────────────────────────────────
    p(0,row,`Costos EE - ${zona} - ${mesAno}`,fWHITE,FILL_DARK_HEADER,aL,BORDER_ALL);
    merge(0,row,11,row); row++;

    let brokerCellRef=null;
    if(parseFloat(brokerPct)>0){
      p(0,row,"Comisión:",fBOLD,FILL_GREEN,aL,BORDER_ALL);
      brokerCellRef=ea(1,row);
      p(1,row,parseFloat(brokerPct)/100,fNorm,FILL_GREEN,aC,BORDER_ALL,NF_PCT);
      row++;
    }

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

    const costoEERowIdxs=[];
    zResults.forEach((res,pi)=>{
      const pf=planFill(pi);
      costoEERowIdxs.push(row);
      p(0,row,res.planId,fBOLD,pf,aC,BORDER_ALL);
      const getC=id=>res.bd.rows.find(x=>x.id===id)?.costo||0;
      [getC("s0_25"),getC("s26_34"),getC("s35_54"),getC("s55_59"),getC("s60plus")].forEach((v,i)=>p(i+1,row,+v.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY));
      p(7,row,+getC("h1").toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      p(8,row,+getC("h2plus").toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);

      const costo059=tot059>0?["s0_25","s26_34","s35_54","s55_59","h1","h2plus"].reduce((a,k)=>a+(distTot[k]||0)*(getC(k)||0),0)/tot059:0;
      const costo60=getC("s60plus");
      const costoGen=grandTotal>0?CAT_KEYS.filter(Boolean).reduce((a,k)=>a+(distTot[k]||0)*(getC(k)||0),0)/grandTotal:0;
      p(9,row,+costo059.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      p(10,row,+costo60.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      p(11,row,+costoGen.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      row++;
    });

    row++;

    // ── SECCIÓN 5: Mejoras ────────────────────────────────────────────────────
    p(0,row,"Mejoras",fWHITE,FILL_MED_TEAL,aC,BORDER_ALL);
    merge(0,row,11,row); row++;

    ["00 - 25","26 - 35","36 - 54","55 - 59","60 +"].forEach((h,i)=>p(i+1,row,h,fBOLD,null,aC,BORDER_ALL));
    p(7,row,"Hijo 1",fBOLD,null,aC,BORDER_ALL);
    p(8,row,"Hijo 2 o +",fBOLD,null,aC,BORDER_ALL);
    row++;

    const mejoraRowIdxs=[];
    zResults.forEach((res,pi)=>{
      mejoraRowIdxs.push(row);
      p(0,row,res.planId,fBOLD,planFill(pi),aC,BORDER_ALL);
      [1,2,3,4,5,7,8].forEach(ci=>p(ci,row,0,fNorm,FILL_LIGHTBLUE,aC,BORDER_ALL,NF_MONEY));
      row++;
    });

    row++;

    // ── SECCIÓN 6: Costos totales ─────────────────────────────────────────────
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

    const costoTotRowIdxs=[];
    zResults.forEach((res,pi)=>{
      const pf=planFill(pi);
      const eer=costoEERowIdxs[pi];
      const mer=mejoraRowIdxs[pi];
      const ctr=row;
      costoTotRowIdxs.push(ctr);
      p(0,row,res.planId,fBOLD,pf,aC,BORDER_ALL);
      const getC=id=>res.bd.rows.find(x=>x.id===id)?.costo||0;
      const brokerFactor=brokerCellRef?`(1+${brokerCellRef})`:`${1+(parseFloat(brokerPct)||0)/100}`;
      // Each cat = (costoEE + mejora) × (1 + comisión)
      [1,2,3,4,5,7,8].forEach(ci=>{
        const key=CAT_KEYS[CAT_COLS.indexOf(ci)];
        const baseVal=+(getC(key||"s0_25")||0).toFixed(0);
        pF(ci,row,`(${ea(ci,eer)}+${ea(ci,mer)})*${brokerFactor}`,baseVal,fNorm,null,aC,BORDER_ALL,NF_MONEY);
      });

      // Capitado 0-59: SUMPRODUCT(costoTot × pct_059)
      const dP=distPctRowIdx;
      const rP=rango059PctRowIdx;
      const costo059=tot059>0?["s0_25","s26_34","s35_54","s55_59","h1","h2plus"].reduce((a,k)=>a+(distTot[k]||0)*(getC(k)||0),0)/tot059:0;
      const costo60=getC("s60plus");
      const costoGen=grandTotal>0?CAT_KEYS.filter(Boolean).reduce((a,k)=>a+(distTot[k]||0)*(getC(k)||0),0)/grandTotal:0;
      pF(9,row,`SUMPRODUCT(${ea(1,ctr)}:${ea(8,ctr)},${ea(1,rP)}:${ea(8,rP)})`,+costo059.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      pF(10,row,`+${ea(5,ctr)}`,+costo60.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      pF(11,row,`(${ea(1,ctr)}*${ea(1,dP)}+${ea(2,ctr)}*${ea(2,dP)}+${ea(3,ctr)}*${ea(3,dP)}+${ea(4,ctr)}*${ea(4,dP)}+${ea(7,ctr)}*${ea(7,dP)}+${ea(8,ctr)}*${ea(8,dP)})+${ea(5,ctr)}*${ea(5,dP)}`,+costoGen.toFixed(0),fNorm,null,aC,BORDER_ALL,NF_MONEY);
      row++;
    });

    // ── Retroalimentar C/F en sec 3 (ahora que tenemos costoTotRowIdxs) ──────
    zResults.forEach((_,pi)=>{
      const adj=adjRowIdxs[pi];
      const ctr=costoTotRowIdxs[pi];
      pF(9,adj,`IF(${ea(3,adj)}=0,0,${ea(9,ctr)}/${ea(3,adj)})`,0,fNorm,null,aC,BORDER_ALL,NF_PCT1);
      pF(10,adj,`IF(${ea(4,adj)}=0,0,${ea(10,ctr)}/${ea(4,adj)})`,0,fNorm,null,aC,BORDER_ALL,NF_PCT1);
      pF(11,adj,`IF(${ea(5,adj)}=0,0,${ea(11,ctr)}/${ea(5,adj)})`,0,fNorm,null,aC,BORDER_ALL,NF_PCT1);
    });

    row++;

    // ── SECCIÓN 7: COTIZACIÓN ────────────────────────────────────────────────
    const hasOsde=zResults.some(res=>{
      const mo=planMappingOsde?.[res.adjKey];
      return mo&&osde?.[mo];
    });

    const CC=hasOsde
      ?{plan:0,osdeFac:1,omintPlan:2,omintFac:3,vsOsde:4,costo:5,cf:6,last:6}
      :{plan:0,omintPlan:1,omintFac:2,costo:3,cf:4,last:4};

    const cotLabel=`COTIZACIÓN ${mesAno.toUpperCase()} - ${zona}`;
    p(0,row,cotLabel,fWHITE,FILL_NAVY,aC,BORDER_ALL);
    merge(0,row,CC.last,row); row++;

    if(hasOsde){
      ["Plan","Facturación","Plan Omint","Fact. Omint","VS OSDE","Costo","C/F"].forEach((h,i)=>
        p(i,row,h,fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL));
    } else {
      ["Plan","Plan Omint","Fact. Omint","Costo","C/F"].forEach((h,i)=>
        p(i,row,h,fWHITE,FILL_DARK_HEADER,aC,BORDER_ALL));
    }
    row++;

    const totalFac=zResults.reduce((a,r)=>a+r.bd.totalFac,0);
    const totalCosto=zResults.reduce((a,r)=>a+r.bd.totalCosto,0);
    let totalOsdeAllPlans=0;

    const cotPlanFirstRow=row;
    const cotPlanRowIdxs=[];
    zResults.forEach((res,pi)=>{
      const pf=planFill(pi);
      const mappedOsde=planMappingOsde?.[res.adjKey];
      const osdeResult=mappedOsde&&osde?.[mappedOsde]?calcOsdeFromEmps(res.empList,osde[mappedOsde]):null;
      const osdeFac=osdeResult?osdeResult.total:0;
      totalOsdeAllPlans+=osdeFac;
      const vsOsde=osdeFac>0&&res.bd.totalFac>0?res.bd.totalFac/osdeFac-1:null;

      p(CC.plan,row,res.planId,fBOLD,FILL_GRAY,aC,BORDER_ALL);
      if(hasOsde){
        p(CC.osdeFac,row,osdeFac>0?+osdeFac.toFixed(2):null,fNorm,FILL_GRAY,aC,BORDER_ALL,NF_MONEY2);
      }
      p(CC.omintPlan,row,res.planId,fBOLD,pf,aC,BORDER_ALL);

      // Fact. Omint = SUMPRODUCT(precios_ajustados_por_cat × conteos_del_plan)
      // = (059_cats × adj1 + 60+ × adj2) por los conteos de este plan
      const bpr=basePriceRowIdxs[pi];
      const adj=adjRowIdxs[pi];
      const pd=distPlanFirstRow+pi; // fila de distribución de este plan
      const factFallback=+res.bd.totalFac.toFixed(2);
      pF(CC.omintFac,row,
        `(${ea(1,bpr)}*${ea(1,pd)}+${ea(2,bpr)}*${ea(2,pd)}+${ea(3,bpr)}*${ea(3,pd)}+${ea(4,bpr)}*${ea(4,pd)}+${ea(7,bpr)}*${ea(7,pd)}+${ea(8,bpr)}*${ea(8,pd)})*(1+${ea(1,adj)})+${ea(5,bpr)}*${ea(5,pd)}*(1+${ea(2,adj)})`,
        factFallback,fNorm,FILL_GRAY,aC,BORDER_ALL,NF_MONEY2);

      if(hasOsde){
        if(osdeFac>0){
          pF(CC.vsOsde,row,`${ea(CC.omintFac,row)}/${ea(CC.osdeFac,row)}-1`,vsOsde!==null?+vsOsde.toFixed(4):null,fNorm,FILL_GRAY,aC,BORDER_ALL,NF_PCT1);
        } else {
          p(CC.vsOsde,row,null,fNorm,FILL_GRAY,aC,BORDER_ALL,NF_PCT1);
        }
      }

      // Costo = SUMPRODUCT(costoTot_por_cat × conteos_del_plan)
      const ctr=costoTotRowIdxs[pi];
      const costoFallback=+res.bd.totalCosto.toFixed(2);
      pF(CC.costo,row,
        `SUMPRODUCT(${ea(1,ctr)}:${ea(8,ctr)},${ea(1,pd)}:${ea(8,pd)})`,
        costoFallback,fNorm,FILL_GRAY,aC,BORDER_ALL,NF_MONEY2);

      // C/F
      pF(CC.cf,row,`IF(${ea(CC.omintFac,row)}=0,0,${ea(CC.costo,row)}/${ea(CC.omintFac,row)})`,
        res.bd.totalFac>0?+(res.bd.totalCosto/res.bd.totalFac).toFixed(4):0,fNorm,FILL_GRAY,aC,BORDER_ALL,NF_PCT1);

      cotPlanRowIdxs.push(row);
      row++;
    });

    const cotTotalRowIdx=row;
    const cotPlanLastRow=row-1;
    const totalOsde=totalOsdeAllPlans;
    const vsOsdeTotal=totalOsde>0&&totalFac>0?totalFac/totalOsde-1:null;
    p(CC.plan,row,"Total",fWHITE,FILL_NAVY,aC,BORDER_ALL);
    if(hasOsde){
      pF(CC.osdeFac,row,`SUM(${ea(CC.osdeFac,cotPlanFirstRow)}:${ea(CC.osdeFac,cotPlanLastRow)})`,totalOsde>0?+totalOsde.toFixed(2):null,fWHITE,FILL_NAVY,aC,BORDER_ALL,NF_MONEY2);
      p(CC.omintPlan,row,"",fWHITE,FILL_NAVY,aC,BORDER_ALL);
    }
    pF(CC.omintFac,row,`SUM(${ea(CC.omintFac,cotPlanFirstRow)}:${ea(CC.omintFac,cotPlanLastRow)})`,+totalFac.toFixed(2),fWHITE,FILL_NAVY,aC,BORDER_ALL,NF_MONEY2);
    if(hasOsde){
      if(totalOsde>0){
        pF(CC.vsOsde,row,`${ea(CC.omintFac,cotTotalRowIdx)}/${ea(CC.osdeFac,cotTotalRowIdx)}-1`,vsOsdeTotal!==null?+vsOsdeTotal.toFixed(4):null,fWHITE,FILL_NAVY,aC,BORDER_ALL,NF_PCT1);
      } else {
        p(CC.vsOsde,row,null,fWHITE,FILL_NAVY,aC,BORDER_ALL,NF_PCT1);
      }
    }
    pF(CC.costo,row,`SUM(${ea(CC.costo,cotPlanFirstRow)}:${ea(CC.costo,cotPlanLastRow)})`,+totalCosto.toFixed(2),fWHITE,FILL_NAVY,aC,BORDER_ALL,NF_MONEY2);
    pF(CC.cf,row,`IF(${ea(CC.omintFac,cotTotalRowIdx)}=0,0,${ea(CC.costo,cotTotalRowIdx)}/${ea(CC.omintFac,cotTotalRowIdx)})`,totalFac>0?+(totalCosto/totalFac).toFixed(4):0,fWHITE,FILL_NAVY,aC,BORDER_ALL,NF_PCT1);
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
      pF(1,row,`${ea(1,masaSalRowIdx)}*0.09*0.85*(13/12)`,+aporte.toFixed(2),fNorm,null,aC,BORDER_ALL,NF_MONEY2);
      row++;
      const saldo=totalFac-aporte;
      p(0,row,"Saldo a pagar:",fBOLD,null,aL,BORDER_ALL);
      pF(1,row,`${ea(CC.omintFac,cotTotalRowIdx)}-${ea(1,aporteRowIdx)}`,+saldo.toFixed(2),fRED,null,aC,BORDER_ALL,NF_MONEY2);
      row++;
    }

    row++;

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
      const bpr=basePriceRowIdxs[pi];
      const adj=adjRowIdxs[pi];
      p(0,row,res.planId,fBOLD,pf,aC,BORDER_ALL);
      // Precios individuales = referencia directa a bpr (que ya tiene ajuste aplicado)
      [1,2,3,4,5,7,8].forEach(ci=>pF(ci,row,`+${ea(ci,bpr)}`,0,fNorm,null,aC,BORDER_ALL,NF_MONEY));
      // Capitado prices reference adj row
      pF(9,row,`+${ea(3,adj)}`,0,fNorm,null,aC,BORDER_ALL,NF_MONEY);
      pF(10,row,`+${ea(4,adj)}`,0,fNorm,null,aC,BORDER_ALL,NF_MONEY);
      pF(11,row,`+${ea(5,adj)}`,0,fNorm,null,aC,BORDER_ALL,NF_MONEY);
      row++;
    });

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
    const BC={font:{name:"Calibri",sz:10},alignment:{horizontal:"center",vertical:"center"}};
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
