import { OMINT_LOGO_WHITE } from "./logoWhite";
import { fmtPDF } from "./utils";

// ── PROPUESTA ECONÓMICA (PDF) ─────────────────────────────────────────────────
// Dos modalidades, según la empresa:
//  - "nchoice":   precios por las 7 categorías (adultos por rango de edad + hijos)
//  - "capitados": precios capitados 0-54 / 55-59 / 60+
//    El 0-54 es el promedio de 00-25, 26-35 y 36-54 ponderado por la distribución de la nómina.

const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function esc(s){
  return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function vigencia(fecha){
  const d=fecha?new Date(fecha+"T12:00:00"):new Date();
  return isNaN(d.getTime())?"":`Vigencia ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

// "2500_24" → número destacado + sufijo atenuado, como en la propuesta
function planHTML(nombre){
  const s=String(nombre||"");
  const i=s.indexOf("_");
  if(i<=0)return`<span class="pn">${esc(s)}</span>`;
  return`<span class="pn">${esc(s.slice(0,i))}</span><span class="ps">${esc(s.slice(i))}</span>`;
}

function precio(r,id){return r.bd.rows.find(x=>x.id===id)?.precio||0;}

// Precio capitado 0-54: promedio ponderado por la cantidad de socios en 00-25, 26-35 y 36-54
// del plan (sumando todas sus zonas). Sin socios en esos rangos, promedio simple.
function capitado054(r,results){
  const ids=["s0_25","s26_34","s35_54"];
  const counts=ids.map(id=>results.filter(x=>x.planId===r.planId)
    .reduce((a,x)=>a+(x.bd.rows.find(y=>y.id===id)?.count||0),0));
  const tot=counts.reduce((a,b)=>a+b,0);
  if(tot===0)return ids.reduce((a,id)=>a+precio(r,id),0)/ids.length;
  return ids.reduce((a,id,i)=>a+precio(r,id)*counts[i],0)/tot;
}

function generateProposalHTML(cfg,results){
  const {empresa,fecha,validez,formato,planesNombres,textoExtra}=cfg;
  const capitados=formato==="capitados";

  // Deduplicar por plan Omint (planId) — igual que Excel: precios únicos por plan cotizado
  const seen=new Set();
  const planes=results.filter(r=>{if(seen.has(r.planId))return false;seen.add(r.planId);return true;});
  const nombre=r=>(planesNombres||{})[r.adjKey]||r.planId;

  let tabla;
  if(capitados){
    tabla=`<table class="t tc">
      <thead><tr><th class="l">Plan Omint</th><th>0 &ndash; 54</th><th>55 &ndash; 59</th><th>60 +</th></tr></thead>
      <tbody>${planes.map((r,i)=>`<tr class="${i%2?"odd":"even"}">
        <td class="l">${planHTML(nombre(r))}</td>
        <td>${fmtPDF(capitado054(r,results))}</td>
        <td>${fmtPDF(precio(r,"s55_59"))}</td>
        <td>${fmtPDF(precio(r,"s60plus"))}</td>
      </tr>`).join("")}</tbody>
    </table>`;
  }else{
    const adultos=[["s0_25","00-25"],["s26_34","26-35"],["s35_54","36-54"],["s55_59","55-59"],["s60plus","60 +"]];
    const hijos=[["h1","Hijo 1"],["h2plus","Hijo 2 o +"]];
    tabla=`<table class="t tn">
      <thead>
        <tr class="grp"><th></th><th colspan="5">Adulto / C&oacute;nyuge / FAC / Hijo mayor 25</th><th class="gap"></th><th colspan="2">Hijo menor 25</th></tr>
        <tr><th class="l">Plan</th>${adultos.map(([,h])=>`<th>${h}</th>`).join("")}<th class="gap"></th>${hijos.map(([,h])=>`<th class="h">${h}</th>`).join("")}</tr>
      </thead>
      <tbody>${planes.map((r,i)=>`<tr class="${i%2?"odd":"even"}">
        <td class="l">${planHTML(nombre(r))}</td>
        ${adultos.map(([id])=>`<td>${fmtPDF(precio(r,id))}</td>`).join("")}
        <td class="gap"></td>
        ${hijos.map(([id])=>`<td class="h">${fmtPDF(precio(r,id))}</td>`).join("")}
      </tr>`).join("")}</tbody>
    </table>`;
  }

  const notas=[
    "Los precios no incluyen IVA.",
    "Los valores ofrecidos están sujetos al ingreso masivo del total de la población y a la distribución que fue informada. En caso de sufrir modificaciones, se deberán revisar los precios acordes a la nueva población.",
  ];
  if(validez&&validez.trim())notas.push(validez.trim());
  if(textoExtra&&textoExtra.trim())notas.push(textoExtra.trim());

  return`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Propuesta Económica - ${esc(empresa||"Grupo Omint")}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap" rel="stylesheet"/>
<style>
  @page{size:A4 portrait;margin:0;}
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{background:#15193C;}
  body{font-family:"Hanken Grotesk",Arial,sans-serif;color:#E8E9F5;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .page{width:210mm;min-height:297mm;padding:17mm 14mm;background:#15193C;}
  .head{display:flex;justify-content:space-between;align-items:center;gap:10mm;}
  .head img{width:46mm;height:auto;display:block;}
  .who{text-align:right;max-width:85mm;}
  .kicker{font-size:8.5pt;font-weight:600;letter-spacing:.28em;text-transform:uppercase;color:#A99BE6;}
  .empresa{font-family:"Newsreader",Georgia,serif;font-weight:500;font-size:25pt;line-height:1.02;color:#fff;margin:2mm 0 3mm;text-wrap:balance;}
  .vig{font-size:9.5pt;color:#9EA2CC;}
  .rule{height:3px;border-radius:2px;margin:7mm 0 9mm;background:linear-gradient(90deg,#3C4795,#8E80BB);}
  .sec{display:flex;align-items:baseline;gap:4mm;margin-bottom:6mm;}
  .sec h2{font-family:"Newsreader",Georgia,serif;font-weight:400;font-size:24pt;color:#fff;}
  .sec span{font-size:9.5pt;color:#9EA2CC;}
  .t{width:100%;border-collapse:separate;border-spacing:0 2mm;}
  .t th{font-size:9.5pt;font-weight:600;color:#fff;background:#2A3168;padding:3.3mm 2mm;text-align:center;}
  .t th.l,.t td.l{text-align:left;padding-left:4mm;}
  .t tr.grp th{background:none;font-size:7.5pt;letter-spacing:.14em;text-transform:uppercase;color:#A3A7CF;padding:0 0 1.5mm;border-bottom:1px solid #2A3168;}
  .t tr.grp th:first-child{border-bottom:none;}
  .t td{font-size:10.5pt;color:#E8E9F5;text-align:center;padding:4.4mm 2mm;}
  .t tr.even td{background:#1E2350;}
  .t tr.odd td{background:#191D44;}
  .t th.h{background:#343D7A;}
  .t tr.even td.h{background:#262C5E;color:#8F94C4;}
  .t tr.odd td.h{background:#22264F;color:#8F94C4;}
  .t .gap,.t tr td.gap,.t tr th.gap{background:none!important;width:4mm;padding:0;border:none;}
  .t thead tr:last-child th:first-child,.t tbody td:first-child{border-radius:2.2mm 0 0 2.2mm;}
  .t thead tr:last-child th:last-child,.t tbody td:last-child{border-radius:0 2.2mm 2.2mm 0;}
  .tn thead tr:last-child th:nth-child(6),.tn tbody td:nth-child(6){border-radius:0 2.2mm 2.2mm 0;}
  .tn thead tr:last-child th:nth-child(8),.tn tbody td:nth-child(8){border-radius:2.2mm 0 0 2.2mm;}
  .tc td{font-size:13pt;font-weight:500;color:#fff;padding:5.5mm 2mm;}
  .tc td.l,.tc th.l{width:28%;}
  .pn{font-weight:700;color:#B1A6F0;font-size:11.5pt;}
  .ps{color:#7E83B6;font-size:10pt;}
  .notes{margin-top:9mm;}
  .notes h3{font-family:"Newsreader",Georgia,serif;font-weight:400;font-size:16pt;color:#fff;margin-bottom:4mm;}
  .notes li{list-style:none;position:relative;padding-left:5mm;margin-bottom:3mm;font-size:10pt;line-height:1.6;color:#D6D8EE;}
  .notes li::before{content:"";position:absolute;left:0;top:2.3mm;width:1.6mm;height:1.6mm;border-radius:50%;background:#7E83B6;}
</style>
</head>
<body>
<div class="page">
  <div class="head">
    <img src="${OMINT_LOGO_WHITE}" alt="Omint"/>
    <div class="who">
      <p class="kicker">Cotizaci&oacute;n &middot; Planes corporativos</p>
      <p class="empresa">${esc(empresa||"—")}</p>
      <p class="vig">${vigencia(fecha)}</p>
    </div>
  </div>
  <div class="rule"></div>
  <div class="sec"><h2>${capitados?"Precios capitados":"Precios cotizados"}</h2><span>valor mensual por integrante &middot; ARS sin IVA</span></div>
  ${tabla}
  <div class="notes">
    <h3>Notas y aclaraciones</h3>
    <ul>${notas.map(n=>`<li>${esc(n)}</li>`).join("")}</ul>
  </div>
</div>
</body>
</html>`;
}

export { generateProposalHTML, capitado054 };
