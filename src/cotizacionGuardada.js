import * as XLSX from "xlsx-js-style";
import { parseNominaFija, MAP_NOMINA } from "./parsers";
import { construirResultados } from "./cotizacion";
import { generateProposalHTML, abrirPropuestaPDF } from "./exportHTML";
import { exportAnalisisXLS } from "./exportXLS";
import { exportNominaValorizadaXLS } from "./exportNominaValorizada";

// ── COTIZACIÓN GUARDADA ───────────────────────────────────────────────────────
// Cada cotización del historial guarda en "datos" (texto JSON, para que Firebase no toque
// claves ni listas): {version, estado, listas, nomina}. Con eso se vuelve a armar igual que
// cuando se guardó (mismos precios y costos) y se regeneran sus archivos.

function leerCotizacion(q){
  if(!q?.datos)return null;
  let d;
  try{d=typeof q.datos==="string"?JSON.parse(q.datos):q.datos;}catch{return null;}
  if(!d?.estado||!d?.listas)return null;
  const nom=d.nomina;
  const emps=nom?parseNominaFija(nom.rows,nom.cols,nom.resoluciones||undefined).rows:(d.emps||null);
  return{...d,emps,map:MAP_NOMINA};
}

function armar(q){
  const d=leerCotizacion(q);
  if(!d)throw new Error("Esta cotización se guardó antes de que el historial guardara los archivos.");
  const e=d.estado;
  const results=construirResultados({...e,emps:d.emps,map:d.map},d.listas);
  const planesNombres=Object.fromEntries(results.map(r=>[r.adjKey,e.planCustomNames?.[r.adjKey]||r.cotId]));
  return{d,e,results,planesNombres};
}

function descargarPDFGuardado(q){
  const {e,results,planesNombres}=armar(q);
  abrirPropuestaPDF(generateProposalHTML({...e.salidaCfg,empresa:e.empresa,planesNombres},results));
}
function descargarExcelGuardado(q){
  const {d,e,results,planesNombres}=armar(q);
  exportAnalisisXLS(results,e.empresa,d.emps,e.brokerPct,d.listas.osde||{},e.planMappingOsde||{},e.salidaCfg?.masaSalarial,
    d.listas.mejoras||{},planesNombres,e.adjPct||{},{precios:d.listas.precios,costos:d.listas.costos});
}
function descargarValorizadaGuardada(q){
  const {e,results,planesNombres}=armar(q);
  exportNominaValorizadaXLS(results,e.empresa,planesNombres,e.salidaCfg?.fecha,e.salidaCfg?.formato);
}
function descargarNominaOriginal(q){
  const d=leerCotizacion(q);
  if(!d?.nomina)throw new Error("Esta cotización no tiene la nómina original guardada.");
  const {nombre,rows,cols}=d.nomina;
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows,{header:cols}),"Nómina");
  XLSX.writeFile(wb,(nombre||"nomina").replace(/\.(xlsx|xls|csv)$/i,"")+".xlsx");
}

export { leerCotizacion, descargarPDFGuardado, descargarExcelGuardado, descargarValorizadaGuardada, descargarNominaOriginal };
