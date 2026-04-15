import { ZONA_COLORS, OMINT_LOGO, CATS } from "./constants";
import { fmt, fmtPDF, fechaLarga } from "./utils";

function generateProposalHTML(cfg,results){
  const {empresa,fecha,validez,formato,planesNombres,textoExtra}=cfg;

  function ponderado(result){
    const rows=result.bd.rows;
    const non60=rows.filter(r=>r.id!=="s60plus");
    const total=non60.reduce((a,r)=>a+r.count,0);
    const wavg=total>0?non60.reduce((a,r)=>a+r.precio*r.count,0)/total:0;
    return{precio0_59:Math.round(wavg),precio60plus:rows.find(r=>r.id==="s60plus")?.precio||0};
  }

  // Colores de plan: dorado/ámbar como en los modelos
  const PLAN_BG=["#F5A100","#F5A100","#F5A100","#F5A100","#F5A100"];

  let tableHTML="";

  if(formato==="ponderado"){
    // Formato simplificado: 2 columnas (FLAVOR & FRAGANCES style)
    tableHTML=`<table style="border-collapse:collapse;margin:0 auto;">
      <thead>
        <tr>
          <th style="background:#1B2A7B;color:#fff;padding:8px 18px;font-size:9.5pt;text-align:center;border:1px solid #1B2A7B;min-width:120px;">Plan</th>
          <th style="background:#1B2A7B;color:#fff;padding:8px 28px;font-size:9.5pt;text-align:center;border:1px solid #1B2A7B;min-width:120px;">0 a 59 años</th>
          <th style="background:#1B2A7B;color:#fff;padding:8px 28px;font-size:9.5pt;text-align:center;border:1px solid #1B2A7B;min-width:100px;">60+ años</th>
        </tr>
      </thead>
      <tbody>
        ${results.map((r,i)=>{
          const{precio0_59,precio60plus}=ponderado(r);
          const nombre=planesNombres[r.adjKey]||r.planId;
          return`<tr>
            <td style="background:${PLAN_BG[i%PLAN_BG.length]};padding:7px 18px;font-weight:bold;font-size:9.5pt;border:1px solid #ccc;text-align:center;">${nombre}</td>
            <td style="background:#fff;padding:7px 28px;text-align:center;font-size:9.5pt;border:1px solid #ccc;">${fmtPDF(precio0_59)}</td>
            <td style="background:#fff;padding:7px 28px;text-align:center;font-size:9.5pt;border:1px solid #ccc;">${fmtPDF(precio60plus)}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;
  }else{
    // Formato completo: 7 categorías con separador (HUNTER / AXA style)
    // Columnas adultos: s0_25,s26_34,s35_54,s55_59,s60plus — Hijos: h1,h2plus
    const adultCols=[{id:"s0_25",h:"00 - 25"},{id:"s26_34",h:"26 - 35"},{id:"s35_54",h:"36 - 54"},{id:"s55_59",h:"55 - 59"},{id:"s60plus",h:"60 +"}];
    const hijoCols=[{id:"h1",h:"Hijo 1"},{id:"h2plus",h:"Hijo 2 o +"}];
    const thBase="padding:7px 10px;font-size:9pt;text-align:center;border:1px solid #1B2A7B;white-space:nowrap;";
    const thA=`${thBase}background:#1B2A7B;color:#fff;`;
    const thH=`${thBase}background:#1B2A7B;color:#fff;`;
    const tdBase="padding:7px 9px;text-align:center;font-size:9pt;border:1px solid #ccc;background:#fff;white-space:nowrap;";
    const tdH=`${tdBase}background:#f5f7ff;`;
    tableHTML=`<table style="border-collapse:collapse;margin:0 auto;width:100%;">
      <thead>
        <tr>
          <th rowspan="2" style="${thA}min-width:108px;vertical-align:middle;"></th>
          <th colspan="5" style="${thA}">Adulto / C&oacute;nyuge / FAC / Hijo mayor 25</th>
          <th style="background:#fff;border:none;width:8px;"></th>
          <th colspan="2" style="${thH}">Hijo menor 25</th>
        </tr>
        <tr>
          ${adultCols.map(c=>`<th style="${thA}">${c.h}</th>`).join("")}
          <th style="background:#fff;border:none;width:8px;"></th>
          ${hijoCols.map(c=>`<th style="${thH}">${c.h}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${results.map((r,i)=>{
          const nombre=planesNombres[r.adjKey]||r.planId;
          return`<tr>
            <td style="background:${PLAN_BG[i%PLAN_BG.length]};padding:7px 10px;font-weight:bold;font-size:9pt;border:1px solid #ccc;text-align:center;">${nombre}</td>
            ${adultCols.map(col=>{const row=r.bd.rows.find(x=>x.id===col.id);return`<td style="${tdBase}">${fmtPDF(row?.precio||0)}</td>`;}).join("")}
            <td style="background:#fff;border:none;"></td>
            ${hijoCols.map(col=>{const row=r.bd.rows.find(x=>x.id===col.id);return`<td style="${tdH}">${fmtPDF(row?.precio||0)}</td>`;}).join("")}
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;
  }

  const notas=[];
  notas.push("Los precios no incluyen IVA.");
  if(formato==="ponderado")notas.push("Los valores ofrecidos están sujetos al ingreso masivo del total de la población y a la distribución que fue informada. En caso de sufrir modificaciones, se deberán revisar los precios acorde a la nueva población.");
  if(validez&&validez.trim())notas.push(validez.trim());
  if(textoExtra&&textoExtra.trim())notas.push(textoExtra.trim());

  return`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  @page{size:A4 portrait;margin:20mm 22mm 20mm 22mm;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1a1a1a;background:#fff;}
  .wrap{max-width:170mm;}
  .logo-row{padding-bottom:8px;border-bottom:2.5px solid #1B2A7B;margin-bottom:24px;}
  .logo-row img{height:46px;}
  .date-line{font-style:italic;color:#222;font-size:10.5pt;margin-bottom:40px;}
  .title{text-align:center;color:#1B2A7B;font-size:18pt;font-weight:bold;line-height:1.35;margin-bottom:50px;}
  .section-bar{background:#595959;color:#fff;font-weight:bold;font-size:10.5pt;padding:8px 14px;margin-bottom:30px;}
  .table-outer{display:flex;justify-content:center;margin-bottom:44px;}
  .notes-head{color:#1B2A7B;font-size:11pt;font-weight:normal;margin-bottom:10px;}
  .notes ul{padding-left:22px;}
  .notes li{margin:5px 0;font-size:10pt;line-height:1.55;}
  .pg{position:fixed;bottom:12mm;right:22mm;font-size:9pt;color:#888;}
  @media print{
    *{print-color-adjust:exact;-webkit-print-color-adjust:exact;}
    body{margin:0;}
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="logo-row"><img src="${OMINT_LOGO}" alt="Omint"/></div>
  <div class="date-line">${fechaLarga(fecha)}</div>
  <div class="title">Propuesta Econ&oacute;mica &ndash;<br>${empresa||"—"}</div>
  <div class="section-bar">Precios cotizados</div>
  <div class="table-outer">${tableHTML}</div>
  <div class="notes">
    <p class="notes-head">Notas y aclaraciones</p>
    <ul>${notas.map(n=>`<li>${n}</li>`).join("")}</ul>
  </div>
</div>
<div class="pg">1</div>
</body>
</html>`;
}





export { generateProposalHTML };
