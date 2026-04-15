// Funciones utilitarias
function catAge(a){if(a<=25)return"s0_25";if(a<=35)return"s26_34";if(a<=54)return"s35_54";if(a<=59)return"s55_59";return"s60plus";}
function cfColor(cf){return cf<=70?"#16A34A":cf<=82?"#CA8A04":"#DC2626";}
function cfBg(cf){return cf<=70?"#D1FAE5":cf<=82?"#FEF3C7":"#FEF2F2";}
function cfLabel(cf){return cf<=70?"Excelente":cf<=82?"Aceptable":"Alto";}
const fmt=n=>(+n).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtD=d=>new Date(d).toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"});
function exJSON(t){const m=t.match(/```json\s*([\s\S]*?)```/);if(m){try{return JSON.parse(m[1]);}catch{}}try{const m2=t.match(/\{[\s\S]*?\}/);if(m2)return JSON.parse(m2[0]);}catch{}return null;}
function stripJ(t){return t.replace(/```json[\s\S]*?```/g,"").replace(/\{[^}]*\}/g,"").trim();}
function planTier(id){const m=String(id).match(/^(\d+)/);return m?parseInt(m[1]):0;}
function fechaLarga(d){
  if(!d)d=new Date();
  const months=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const date=typeof d==="string"?new Date(d+"T12:00:00"):d;
  const mes=months[date.getMonth()];
  return`${date.getDate()} de ${mes.charAt(0).toUpperCase()+mes.slice(1)} ${date.getFullYear()}`;
}

// Formato de precio igual al PDF: $ 138.826 (punto de miles, sin decimales)
function fmtPDF(n){return"$ "+(Math.round(+n)).toLocaleString("es-AR");}

export { catAge, cfColor, cfBg, cfLabel, fmt, fmtD,
  exJSON, stripJ, planTier,
  fechaLarga, fmtPDF };
