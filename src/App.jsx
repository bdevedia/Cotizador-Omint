/**
 * OmintCotizador — versión standalone
 * Reemplazá el contenido de src/App.jsx con este archivo completo.
 *
 * Dependencias: npm install xlsx
 */

import { useState, useRef, useEffect, Fragment } from "react";
import * as XLSX from "xlsx";
import "./App.css";

/* ─── Persistencia con localStorage ─── */
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
function lsGet(k)    { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } }

/* ─── Categorías ─── */
const CATS = [
  { id: "s0_25",   label: "Socio 0–25"    },
  { id: "s26_34",  label: "Socio 26–34"   },
  { id: "s35_54",  label: "Socio 35–54"   },
  { id: "s55_59",  label: "Socio 55–59"   },
  { id: "s60plus", label: "Socio 60+"     },
  { id: "h1",      label: "Hijo 1 (H1)"   },
  { id: "h2plus",  label: "Hijo 2+ (H2+)" },
];
const EMPTY_P = { s0_25:0, s26_34:0, s35_54:0, s55_59:0, s60plus:0, h1:0, h2plus:0 };

function catAge(a) {
  if (a <= 25) return "s0_25";
  if (a <= 34) return "s26_34";
  if (a <= 54) return "s35_54";
  if (a <= 59) return "s55_59";
  return "s60plus";
}

function calcBD(emps, map, lp, ap) {
  const c = {}; CATS.forEach(x => { c[x.id] = 0; });
  emps.forEach(e => {
    const ta = parseInt(e[map.titAge]); if (!isNaN(ta)) c[catAge(ta)]++;
    if (map.spAge) { const sa = parseInt(e[map.spAge]); if (!isNaN(sa) && sa > 0) c[catAge(sa)]++; }
    const ku = parseInt(e[map.ku]) || 0; if (ku >= 1) c.h1++; if (ku >= 2) c.h2plus += (ku - 1);
    const k25 = map.k25 ? (parseInt(e[map.k25]) || 0) : 0; if (k25 > 0) c.s0_25 += k25;
  });
  const rows = CATS.map(x => { const n = c[x.id], l = lp[x.id]||0, a = ap[x.id]!==undefined?ap[x.id]:l; return {...x,count:n,lp:l,ap:a,ls:n*l,as:n*a}; });
  const lt = rows.reduce((a,r)=>a+r.ls,0), at = rows.reduce((a,r)=>a+r.as,0);
  return { rows, lt, at, margin: lt>0?(at-lt)/lt*100:0 };
}

const fmt  = n => (+n).toLocaleString("es-AR", { minimumFractionDigits:2, maximumFractionDigits:2 });
const fmtD = d => new Date(d).toLocaleDateString("es-AR", { day:"2-digit", month:"2-digit", year:"numeric" });
const pct  = (a, b) => b > 0 ? (a-b)/b*100 : 0;

function exJSON(t) {
  const m = t.match(/```json\s*([\s\S]*?)```/); if (m) { try { return JSON.parse(m[1]); } catch {} }
  const m2 = t.match(/\{[\s\S]*?\}/); if (m2) { try { return JSON.parse(m2[0]); } catch {} }
  return null;
}
function stripJ(t) { return t.replace(/```json[\s\S]*?```/g,"").replace(/\{[^}]*\}/g,"").trim(); }

/* ─── Estilos inline reutilizables ─── */
const TD = (x={}) => ({ padding:"8px 12px", borderBottom:"1px solid #e5e7eb", ...x });
const TH = (x={}) => ({ padding:"8px 12px", fontWeight:600, fontSize:11, color:"#6b7280", borderBottom:"1px solid #d1d5db", textAlign:"right", background:"#f9fafb", ...x });

/* ════════════════════════════════════════════
   PRECIOS VIGENTES
════════════════════════════════════════════ */
function PreciosVigentes({ prices, onSave }) {
  const [loc, setLoc] = useState({ ...EMPTY_P, ...(prices||{}) });
  const [ok,  setOk]  = useState(false);
  return (
    <div>
      <h2 style={{ fontSize:18, fontWeight:600, marginBottom:6 }}>Precios Vigentes</h2>
      <p style={{ fontSize:13, color:"#6b7280", marginBottom:"1.5rem" }}>
        Actualizalos cada vez que cambien. Son la base de todas las cotizaciones.
      </p>
      <table style={{ borderCollapse:"collapse", fontSize:13, width:"100%", maxWidth:440, marginBottom:"1.25rem" }}>
        <thead><tr><th style={TH({ textAlign:"left" })}>Categoría</th><th style={TH()}>Precio ($)</th></tr></thead>
        <tbody>
          {CATS.map(c => (
            <tr key={c.id}>
              <td style={TD()}>{c.label}</td>
              <td style={TD({ textAlign:"right" })}>
                <input type="number" min={0} value={loc[c.id]||0}
                  onChange={e => setLoc(p => ({...p,[c.id]:parseFloat(e.target.value)||0}))}
                  style={{ width:150, textAlign:"right", border:"1px solid #d1d5db", borderRadius:6, padding:"5px 8px", fontSize:13 }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={() => { onSave({...loc}); setOk(true); setTimeout(()=>setOk(false),2500); }}
        style={{ padding:"9px 20px", fontWeight:600, background:"#111827", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontSize:13 }}
      >
        {ok ? "✓ Guardado" : "Guardar precios vigentes"}
      </button>
      <p style={{ fontSize:11, color:"#9ca3af", marginTop:10 }}>
        H1 = primer hijo &lt;25 · H2+ = hijos adicionales &lt;25 · Hijos ≥25 → Socio 0–25
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════
   HISTORIAL CON CARPETAS
════════════════════════════════════════════ */
function Historial({ quotes, onUpdate }) {
  const [open, setOpen] = useState({});
  const groups = {};
  quotes.forEach(q => { const k = (q.empresa||"Sin nombre").trim(); if (!groups[k]) groups[k]=[]; groups[k].push(q); });
  Object.values(groups).forEach(g => g.sort((a,b) => new Date(b.fecha)-new Date(a.fecha)));
  const empresas = Object.keys(groups).sort();

  if (empresas.length === 0) return (
    <div>
      <h2 style={{ fontSize:18, fontWeight:600, marginBottom:"1.25rem" }}>Historial</h2>
      <p style={{ fontSize:13, color:"#9ca3af" }}>No hay cotizaciones guardadas todavía.</p>
    </div>
  );

  return (
    <div>
      <h2 style={{ fontSize:18, fontWeight:600, marginBottom:6 }}>Historial</h2>
      <p style={{ fontSize:13, color:"#6b7280", marginBottom:"1.25rem" }}>
        {empresas.length} {empresas.length===1?"empresa":"empresas"} · {quotes.length} cotizaciones
      </p>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {empresas.map(name => {
          const list = groups[name], isOpen = open[name];
          const nAb = list.filter(q=>q.status==="abierto").length;
          const nCe = list.filter(q=>q.status==="cerrado").length;
          return (
            <div key={name} style={{ border:"1px solid #e5e7eb", borderRadius:10, overflow:"hidden" }}>
              <button
                onClick={() => setOpen(p=>({...p,[name]:!p[name]}))}
                style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"11px 14px", border:"none", textAlign:"left", background:isOpen?"#f9fafb":"#fff", cursor:"pointer" }}
              >
                <span style={{ fontSize:16 }}>{isOpen?"📂":"📁"}</span>
                <span style={{ fontSize:14, fontWeight:600, flex:1 }}>{name}</span>
                <span style={{ fontSize:11, color:"#9ca3af" }}>{list.length} cotización{list.length>1?"es":""}</span>
                <div style={{ display:"flex", gap:6, marginLeft:8 }}>
                  {nAb>0 && <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, background:"#fef3c7", color:"#92400e" }}>{nAb} abierto{nAb>1?"s":""}</span>}
                  {nCe>0 && <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, background:"#d1fae5", color:"#065f46" }}>{nCe} cerrado{nCe>1?"s":""}</span>}
                </div>
                <span style={{ fontSize:11, color:"#9ca3af", marginLeft:6 }}>{isOpen?"▲":"▼"}</span>
              </button>
              {isOpen && (
                <div style={{ borderTop:"1px solid #e5e7eb" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12.5 }}>
                    <thead>
                      <tr>{["Fecha","Total cotizado","Var. lista","Estado","Acción"].map((h,i)=>(
                        <th key={h} style={TH({ textAlign:i===0?"left":"right" })}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {list.map(q => {
                        const m = q.margin||0;
                        return (
                          <tr key={q.id}>
                            <td style={TD()}>{fmtD(q.fecha)}</td>
                            <td style={TD({ textAlign:"right", fontWeight:600 })}>${fmt(q.total)}</td>
                            <td style={TD({ textAlign:"right", fontSize:11, color:m<-8?"#dc2626":m>0?"#16a34a":"#9ca3af" })}>
                              {m>=0?"+":""}{m.toFixed(1)}%
                            </td>
                            <td style={TD({ textAlign:"right" })}>
                              <span style={{ display:"inline-block", padding:"2px 9px", borderRadius:20, fontSize:11,
                                background:q.status==="cerrado"?"#d1fae5":"#fef3c7",
                                color:q.status==="cerrado"?"#065f46":"#92400e" }}>
                                {q.status==="cerrado"?"Cerrado":"Abierto"}
                              </span>
                            </td>
                            <td style={TD({ textAlign:"right" })}>
                              {q.status==="abierto" && onUpdate && (
                                <button onClick={()=>onUpdate(q.id,{status:"cerrado"})}
                                  style={{ fontSize:11, padding:"3px 9px", border:"1px solid #d1d5db", borderRadius:6, cursor:"pointer", background:"#fff" }}>
                                  Cerrar
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   TABLA DE COSTOS (abiertos / cerrados)
════════════════════════════════════════════ */
function CostosTable({ quotes, title, emptyMsg, onUpdate }) {
  return (
    <div>
      <h2 style={{ fontSize:18, fontWeight:600, marginBottom:"1.25rem" }}>{title}</h2>
      {quotes.length===0 ? <p style={{ fontSize:13, color:"#9ca3af" }}>{emptyMsg}</p> : (
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr>{["Empresa","Fecha","Total","Var. lista","Estado","Acción"].map((h,i)=>(
              <th key={h} style={TH({ textAlign:i===0?"left":"right" })}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {quotes.map(q => {
              const m = q.margin||0;
              return (
                <tr key={q.id}>
                  <td style={TD()}>{q.empresa||"Sin nombre"}</td>
                  <td style={TD({ textAlign:"right", color:"#6b7280" })}>{fmtD(q.fecha)}</td>
                  <td style={TD({ textAlign:"right", fontWeight:600 })}>${fmt(q.total)}</td>
                  <td style={TD({ textAlign:"right", fontSize:11, color:m<-8?"#dc2626":m>0?"#16a34a":"#9ca3af" })}>
                    {m>=0?"+":""}{m.toFixed(1)}%
                  </td>
                  <td style={TD({ textAlign:"right" })}>
                    <span style={{ display:"inline-block", padding:"2px 9px", borderRadius:20, fontSize:11,
                      background:q.status==="cerrado"?"#d1fae5":"#fef3c7",
                      color:q.status==="cerrado"?"#065f46":"#92400e" }}>
                      {q.status==="cerrado"?"Cerrado":"Abierto"}
                    </span>
                  </td>
                  <td style={TD({ textAlign:"right" })}>
                    {q.status==="abierto" && onUpdate && (
                      <button onClick={()=>onUpdate(q.id,{status:"cerrado"})}
                        style={{ fontSize:11, padding:"3px 9px", border:"1px solid #d1d5db", borderRadius:6, cursor:"pointer", background:"#fff" }}>
                        Cerrar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   COTIZADOR
════════════════════════════════════════════ */
function Cotizador({ vigentePrices, onSaveQuote, knownEmpresas, apiKey }) {
  const [sub, setSub]         = useState(1);
  const [emps, setEmps]       = useState(null);
  const [cols, setCols]       = useState([]);
  const [map, setMap]         = useState({ titAge:"", spAge:"", ku:"", k25:"", name:"" });
  const [listP, setListP]     = useState({...EMPTY_P});
  const [adjP, setAdjP]       = useState({});
  const [empresa, setEmpresa] = useState("");
  const [showSug, setShowSug] = useState(false);
  const [chat, setChat]       = useState([]);
  const [chatIn, setChatIn]   = useState("");
  const [chatLoading, setCL]  = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const chatEnd = useRef(null);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior:"smooth" }); }, [chat]);

  const effP = {}; CATS.forEach(c => { effP[c.id] = adjP[c.id]!==undefined ? adjP[c.id] : (listP[c.id]||0); });
  const bd = emps && map.titAge && map.ku ? calcBD(emps, map, listP, effP) : null;
  const suggestions = empresa.trim().length>0 ? knownEmpresas.filter(e=>e.toLowerCase().includes(empresa.toLowerCase())&&e.toLowerCase()!==empresa.toLowerCase()) : [];
  const isKnown = knownEmpresas.includes(empresa.trim());

  function handleFile(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      const wb = XLSX.read(ev.target.result, { type:"binary" });
      const d = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw:false });
      if (d.length>0) { setCols(Object.keys(d[0])); setEmps(d); }
    };
    r.readAsBinaryString(f);
  }

  async function sendChat() {
    if (!chatIn.trim() || chatLoading || !bd) return;
    if (!apiKey) { alert("Configurá tu API key de Anthropic en Configuración (sidebar)."); return; }
    const m = chatIn.trim(); setChatIn("");
    const hist = [...chat, { role:"user", content:m }]; setChat(hist); setCL(true);
    const sys = `Sos el asistente comercial de Omint.
TARIFARIO: ${CATS.map(c=>`${c.label}: lista=$${fmt(listP[c.id]||0)}, cotizado=$${fmt(effP[c.id]||0)}`).join(" | ")}
EMPRESA "${empresa||"empresa"}": total=$${fmt(bd.at)}, var=${bd.margin.toFixed(1)}%
Al ajustar precios respondé con explicación corta + JSON con los 7 valores:
\`\`\`json
{"s0_25":0,"s26_34":0,"s35_54":0,"s55_59":0,"s60plus":0,"h1":0,"h2plus":0}
\`\`\``;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
        body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:700, system:sys, messages:hist.map(x=>({role:x.role,content:x.content})) })
      });
      const data = await res.json();
      const full = data.content?.map(b=>b.text||"").join("")||"Error.";
      const json = exJSON(full); const expl = stripJ(full)||full;
      if (json) { const u={}; CATS.forEach(c=>{u[c.id]=json[c.id]!==undefined?parseFloat(json[c.id])||0:effP[c.id];}); setAdjP(u); }
      setChat([...hist, { role:"assistant", content:expl, upd:!!json }]);
    } catch { setChat([...hist, { role:"assistant", content:"Error de conexión." }]); }
    setCL(false);
  }

  async function guardar(status) {
    if (!bd) return;
    onSaveQuote({ id:Date.now().toString(), empresa:empresa.trim()||"Sin nombre", status, fecha:new Date().toISOString(), total:bd.at, margin:bd.margin });
    setSaveMsg(status==="cerrado"?"✓ Guardado como cerrado":"✓ Guardado como abierto");
    setTimeout(()=>setSaveMsg(""),2500);
  }

  function exportXLSX() {
    if (!bd) return;
    const wb = XLSX.utils.book_new();
    const rows = [[`COTIZACIÓN OMINT — ${(empresa||"EMPRESA").toUpperCase()}`],[],["Categoría","Cantidad","Precio Lista","Precio Cotizado","Subtotal","Var. %"]];
    bd.rows.forEach(r=>{rows.push([r.label,r.count,+r.lp.toFixed(2),+r.ap.toFixed(2),+r.as.toFixed(2),r.lp>0?pct(r.ap,r.lp).toFixed(1)+"%":"–"]);});
    rows.push([],["Total lista","","","",(+bd.lt.toFixed(2)),""],[`Total cotizado`,"","","",(+bd.at.toFixed(2)),`${bd.margin.toFixed(1)}%`]);
    const ws = XLSX.utils.aoa_to_sheet(rows); ws["!cols"]=[{wch:20},{wch:10},{wch:14},{wch:14},{wch:14},{wch:10}];
    XLSX.utils.book_append_sheet(wb,ws,"Cotización");
    if (emps) XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(emps),"Nómina");
    XLSX.writeFile(wb,`Cotizacion_${empresa||"empresa"}.xlsx`);
  }

  const stepN = sub==="manual"?2:sub;
  const sDef  = [{n:1,l:"Nómina"},{n:2,l:"Precios"},{n:3,l:"Cotización"}];
  const btn   = (extra={}) => ({ border:"1px solid #d1d5db", borderRadius:6, padding:"7px 14px", fontSize:13, cursor:"pointer", background:"#fff", ...extra });

  return (
    <div>
      {/* Steps */}
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:"1.75rem" }}>
        {sDef.map((s,i) => (
          <Fragment key={s.n}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ width:20, height:20, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:600, background:stepN>=s.n?"#111827":"#e5e7eb", color:stepN>=s.n?"#fff":"#9ca3af" }}>{s.n}</span>
              <span style={{ fontSize:13, color:stepN===s.n?"#111827":"#9ca3af", fontWeight:stepN===s.n?600:400 }}>{s.l}</span>
            </div>
            {i<2 && <span style={{ color:"#d1d5db", fontSize:12, margin:"0 2px" }}>›</span>}
          </Fragment>
        ))}
      </div>

      {/* STEP 1 */}
      {sub===1 && (
        <div>
          <p style={{ fontSize:13, color:"#6b7280", marginBottom:"1.5rem" }}>Subí el Excel con la nómina del grupo familiar.</p>
          {!emps ? (
            <label style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10, padding:"2.5rem", border:"2px dashed #e5e7eb", borderRadius:12, cursor:"pointer", background:"#f9fafb" }}>
              <div style={{ fontSize:28 }}>📂</div>
              <span style={{ fontSize:14, color:"#374151" }}>Subir Excel o CSV</span>
              <span style={{ fontSize:12, color:"#9ca3af" }}>.xlsx · .xls · .csv</span>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display:"none" }}/>
            </label>
          ) : (
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px", background:"#d1fae5", borderRadius:8, marginBottom:"1.25rem" }}>
                <span>✓</span><span style={{ fontSize:13, color:"#065f46" }}>{emps.length} filas cargadas</span>
                <button onClick={()=>{setEmps(null);setCols([]);setMap({titAge:"",spAge:"",ku:"",k25:"",name:""});}} style={{ marginLeft:"auto", border:"none", background:"none", fontSize:12, cursor:"pointer" }}>Cambiar</button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:"1.25rem" }}>
                {[{k:"name",l:"Nombre",req:false},{k:"titAge",l:"Edad titular *",req:true},{k:"spAge",l:"Edad cónyuge",req:false},{k:"ku",l:"N° hijos <25 *",req:true},{k:"k25",l:"N° hijos ≥25",req:false}].map(({k,l,req})=>(
                  <div key={k}>
                    <label style={{ fontSize:12, color:"#6b7280", display:"block", marginBottom:4 }}>{l}</label>
                    <select value={map[k]} onChange={e=>setMap(p=>({...p,[k]:e.target.value}))} style={{ width:"100%", border:"1px solid #d1d5db", borderRadius:6, padding:"6px 8px", fontSize:13 }}>
                      <option value="">{req?"Seleccionar…":"No aplica"}</option>
                      {cols.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              {map.titAge&&map.ku&&(
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                    <thead><tr>{cols.map(c=>{const m=Object.values(map).includes(c);return<th key={c} style={{ padding:"5px 8px", textAlign:"left", fontWeight:500, fontSize:11, color:m?"#1d4ed8":"#6b7280", borderBottom:"1px solid #e5e7eb", background:m?"#eff6ff":"#f9fafb" }}>{c}</th>;})}</tr></thead>
                    <tbody>{emps.slice(0,4).map((e,i)=><tr key={i} style={{ borderBottom:"1px solid #e5e7eb" }}>{cols.map(c=><td key={c} style={{ padding:"5px 8px" }}>{e[c]}</td>)}</tr>)}</tbody>
                  </table>
                  {emps.length>4&&<p style={{ fontSize:11, color:"#9ca3af", marginTop:5 }}>…y {emps.length-4} más</p>}
                </div>
              )}
            </div>
          )}
          {emps&&map.titAge&&map.ku&&<button onClick={()=>setSub(2)} style={{ ...btn({background:"#111827",color:"#fff",border:"none",fontWeight:600}), marginTop:"1.5rem" }}>Continuar →</button>}
        </div>
      )}

      {/* STEP 2 */}
      {sub===2&&(
        <div>
          <p style={{ fontSize:15, fontWeight:600, marginBottom:"0.5rem" }}>¿Querés usar la lista de precios vigente?</p>
          <p style={{ fontSize:13, color:"#6b7280", marginBottom:"1.75rem" }}>Podés usar los precios guardados y ajustarlos con la IA, o ingresar precios manualmente.</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, maxWidth:580, marginBottom:"1.5rem" }}>
            <div style={{ border:`1px solid ${vigentePrices?"#d1d5db":"#e5e7eb"}`, borderRadius:12, padding:"1.25rem", opacity:vigentePrices?1:0.55 }}>
              <p style={{ fontSize:14, fontWeight:600, marginBottom:8 }}>Sí, usar vigentes</p>
              {vigentePrices?(
                <>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, marginBottom:"1rem" }}>
                    <tbody>{CATS.map(c=><tr key={c.id}><td style={{ padding:"3px 0", fontSize:11, color:"#6b7280" }}>{c.label}</td><td style={{ padding:"3px 0", textAlign:"right", fontWeight:600 }}>${fmt(vigentePrices[c.id]||0)}</td></tr>)}</tbody>
                  </table>
                  <button onClick={()=>{setListP({...vigentePrices});setAdjP({});setSub(3);}} style={btn({ width:"100%", fontWeight:600, background:"#111827", color:"#fff", border:"none" })}>Usar estos precios →</button>
                </>
              ):<p style={{ fontSize:12, color:"#9ca3af" }}>No hay precios vigentes guardados aún.</p>}
            </div>
            <div style={{ border:"1px solid #d1d5db", borderRadius:12, padding:"1.25rem" }}>
              <p style={{ fontSize:14, fontWeight:600, marginBottom:8 }}>No, ingresar manualmente</p>
              <p style={{ fontSize:12, color:"#6b7280", marginBottom:"1rem" }}>Completá los precios para esta cotización en particular.</p>
              <button onClick={()=>{setListP({...EMPTY_P});setAdjP({});setSub("manual");}} style={btn({ width:"100%" })}>Ingresar precios</button>
            </div>
          </div>
          <button onClick={()=>setSub(1)} style={btn()}>← Volver</button>
        </div>
      )}

      {/* MANUAL PRICES */}
      {sub==="manual"&&(
        <div>
          <p style={{ fontSize:13, color:"#6b7280", marginBottom:"1.5rem" }}>Ingresá los precios para esta cotización:</p>
          <table style={{ borderCollapse:"collapse", fontSize:13, width:"100%", maxWidth:440, marginBottom:"1.25rem" }}>
            <thead><tr><th style={TH({ textAlign:"left" })}>Categoría</th><th style={TH()}>Precio ($)</th></tr></thead>
            <tbody>{CATS.map(c=>(
              <tr key={c.id}><td style={TD()}>{c.label}</td>
              <td style={TD({ textAlign:"right" })}><input type="number" min={0} value={listP[c.id]||0} onChange={e=>setListP(p=>({...p,[c.id]:parseFloat(e.target.value)||0}))} style={{ width:150, textAlign:"right", border:"1px solid #d1d5db", borderRadius:6, padding:"5px 8px", fontSize:13 }}/></td></tr>
            ))}</tbody>
          </table>
          <div style={{ display:"flex", gap:8 }}><button onClick={()=>setSub(2)} style={btn()}>← Volver</button><button onClick={()=>setSub(3)} style={btn({ fontWeight:600, background:"#111827", color:"#fff", border:"none" })}>Ver cotización →</button></div>
        </div>
      )}

      {/* STEP 3 */}
      {sub===3&&bd&&(
        <div>
          <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:"1rem", flexWrap:"wrap" }}>
            <div style={{ flex:"1 1 180px", minWidth:150, position:"relative" }}>
              <label style={{ fontSize:12, color:"#6b7280", display:"block", marginBottom:4 }}>Empresa</label>
              <input value={empresa} onChange={e=>{setEmpresa(e.target.value);setShowSug(true);}}
                onBlur={()=>setTimeout(()=>setShowSug(false),150)} onFocus={()=>setShowSug(true)}
                placeholder="Nombre de la empresa"
                style={{ border:"1px solid #d1d5db", borderRadius:6, padding:"6px 10px", fontSize:13, width:"100%" }}/>
              {showSug&&suggestions.length>0&&(
                <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:10, background:"#fff", border:"1px solid #e5e7eb", borderRadius:"0 0 8px 8px", boxShadow:"0 4px 12px rgba(0,0,0,0.08)" }}>
                  {suggestions.map(s=>(
                    <button key={s} onClick={()=>{setEmpresa(s);setShowSug(false);}} style={{ display:"block", width:"100%", textAlign:"left", padding:"8px 12px", border:"none", background:"#fff", cursor:"pointer", fontSize:13 }}>📁 {s}</button>
                  ))}
                </div>
              )}
              {empresa&&isKnown&&<p style={{ fontSize:11, color:"#1d4ed8", marginTop:4 }}>📁 Se agregará a la carpeta existente de {empresa.trim()}</p>}
              {empresa&&!isKnown&&empresa.trim().length>0&&<p style={{ fontSize:11, color:"#9ca3af", marginTop:4 }}>📂 Se creará una carpeta nueva</p>}
            </div>
            <div style={{ display:"flex", gap:7, paddingTop:20, flexWrap:"wrap" }}>
              {Object.keys(adjP).length>0&&<button onClick={()=>{setAdjP({});setChat([]);}} style={btn({ fontSize:12, color:"#6b7280" })}>↺</button>}
              <button onClick={exportXLSX} style={btn({ fontWeight:600, background:"#111827", color:"#fff", border:"none" })}>↓ .xlsx</button>
              <button onClick={()=>guardar("abierto")} style={btn({ fontSize:12 })}>Guardar abierto</button>
              <button onClick={()=>guardar("cerrado")} style={btn({ fontSize:12, fontWeight:600 })}>Guardar cerrado</button>
            </div>
          </div>
          {saveMsg&&<p style={{ fontSize:12, color:"#16a34a", marginBottom:"0.75rem" }}>{saveMsg}</p>}

          <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1.15fr) minmax(0,0.85fr)", gap:16, alignItems:"start" }}>
            {/* Breakdown */}
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:"1.25rem" }}>
                {[{l:"Socios",v:emps.length},{l:"Total cotizado",v:`$${fmt(bd.at)}`},{l:"Var. vs lista",v:`${bd.margin>=0?"+":""}${bd.margin.toFixed(1)}%`,c:bd.margin<-8?"#dc2626":bd.margin>0?"#16a34a":"#111827"}].map(c=>(
                  <div key={c.l} style={{ background:"#f9fafb", borderRadius:8, padding:"0.7rem 0.9rem", border:"1px solid #e5e7eb" }}>
                    <p style={{ fontSize:11, color:"#6b7280", marginBottom:3 }}>{c.l}</p>
                    <p style={{ fontSize:15, fontWeight:600, color:c.c||"#111827" }}>{c.v}</p>
                  </div>
                ))}
              </div>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12.5 }}>
                <thead><tr>{["Categoría","N°","Lista","Cotizado","Subtotal","Var."].map((h,i)=><th key={h} style={TH({ textAlign:i===0?"left":"right" })}>{h}</th>)}</tr></thead>
                <tbody>
                  {bd.rows.map(r=>{
                    const d=pct(r.ap,r.lp),ha=adjP[r.id]!==undefined;
                    return(
                      <tr key={r.id} style={{ opacity:r.count===0?0.32:1 }}>
                        <td style={TD()}>{r.label}</td>
                        <td style={TD({ textAlign:"right", color:"#6b7280" })}>{r.count}</td>
                        <td style={TD({ textAlign:"right", color:"#9ca3af", fontSize:11 })}>${fmt(r.lp)}</td>
                        <td style={TD({ textAlign:"right" })}>
                          <input type="number" min={0} value={r.ap} onChange={e=>setAdjP(p=>({...p,[r.id]:parseFloat(e.target.value)||0}))}
                            style={{ width:86, textAlign:"right", fontSize:12, padding:"3px 6px", border:"1px solid #d1d5db", borderRadius:6, color:ha?"#1d4ed8":"#111827" }}/>
                        </td>
                        <td style={TD({ textAlign:"right", fontWeight:600 })}>${fmt(r.as)}</td>
                        <td style={TD({ textAlign:"right", fontSize:11, color:d<-8?"#dc2626":d>0?"#16a34a":"#9ca3af" })}>
                          {r.lp>0?`${d>=0?"+":""}${d.toFixed(1)}%`:"–"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td style={{ padding:"9px 12px", fontWeight:600, borderTop:"1px solid #d1d5db" }}>Total</td>
                    <td style={{ borderTop:"1px solid #d1d5db" }}/><td style={{ padding:"9px 12px", textAlign:"right", fontSize:11, color:"#9ca3af", borderTop:"1px solid #d1d5db" }}>${fmt(bd.lt)}</td>
                    <td style={{ borderTop:"1px solid #d1d5db" }}/><td style={{ padding:"9px 12px", textAlign:"right", fontWeight:600, fontSize:14, borderTop:"1px solid #d1d5db" }}>${fmt(bd.at)}</td>
                    <td style={{ padding:"9px 12px", textAlign:"right", fontSize:12, borderTop:"1px solid #d1d5db", color:bd.margin<-8?"#dc2626":bd.margin>0?"#16a34a":"#9ca3af" }}>{bd.margin>=0?"+":""}{bd.margin.toFixed(1)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {/* Chat */}
            <div style={{ border:"1px solid #e5e7eb", borderRadius:12, display:"flex", flexDirection:"column", height:450 }}>
              <div style={{ padding:"10px 14px", borderBottom:"1px solid #e5e7eb", background:"#f9fafb" }}>
                <p style={{ fontSize:13, fontWeight:600 }}>Negociación de precios</p>
                <p style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>Los precios se actualizan en tiempo real.</p>
              </div>
              <div style={{ flex:1, overflowY:"auto", padding:"12px 14px", display:"flex", flexDirection:"column", gap:8 }}>
                {chat.length===0&&(
                  <div style={{ color:"#9ca3af", fontSize:12, textAlign:"center", margin:"auto", lineHeight:2 }}>
                    <p style={{ fontWeight:600, marginBottom:4 }}>Ejemplos</p>
                    {["8% de descuento en todo","60+ a lista, resto -5%","H1 y H2+ subirlos 3%"].map(ex=>(
                      <p key={ex} onClick={()=>setChatIn(ex)} style={{ cursor:"pointer", fontSize:11 }}>"{ex}"</p>
                    ))}
                  </div>
                )}
                {chat.map((m,i)=>(
                  <div key={i} style={{ alignSelf:m.role==="user"?"flex-end":"flex-start", maxWidth:"92%", padding:"7px 11px", borderRadius:10, background:m.role==="user"?"#f3f4f6":"#fff", border:m.role==="assistant"?"1px solid #e5e7eb":"none", fontSize:12.5, lineHeight:1.55 }}>
                    {m.upd&&<span style={{ fontSize:11, color:"#16a34a", display:"block", marginBottom:3 }}>✓ Actualizado</span>}
                    {m.content}
                  </div>
                ))}
                {chatLoading&&<div style={{ alignSelf:"flex-start", fontSize:12, color:"#9ca3af" }}>Calculando…</div>}
                <div ref={chatEnd}/>
              </div>
              <div style={{ padding:"10px 12px", borderTop:"1px solid #e5e7eb", display:"flex", gap:7 }}>
                <input value={chatIn} onChange={e=>setChatIn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendChat()}
                  placeholder="Pedí un ajuste…" disabled={chatLoading}
                  style={{ flex:1, fontSize:12, padding:"6px 10px", border:"1px solid #d1d5db", borderRadius:6 }}/>
                <button onClick={sendChat} disabled={!chatIn.trim()||chatLoading}
                  style={{ padding:"6px 11px", fontSize:12, fontWeight:600, background:"#111827", color:"#fff", border:"none", borderRadius:6, cursor:"pointer" }}>→</button>
              </div>
            </div>
          </div>
          <button onClick={()=>setSub(2)} style={{ ...btn(), marginTop:"1.25rem" }}>← Volver</button>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   CONFIGURACIÓN (API Key)
════════════════════════════════════════════ */
function Configuracion({ apiKey, onSave }) {
  const [k, setK]   = useState(apiKey||"");
  const [ok, setOk] = useState(false);
  return (
    <div>
      <h2 style={{ fontSize:18, fontWeight:600, marginBottom:6 }}>Configuración</h2>
      <p style={{ fontSize:13, color:"#6b7280", marginBottom:"1.5rem" }}>
        La API key se guarda localmente en tu navegador y se usa solo para el chat de negociación de precios.
      </p>
      <label style={{ fontSize:12, color:"#6b7280", display:"block", marginBottom:6 }}>API Key de Anthropic</label>
      <input type="password" value={k} onChange={e=>setK(e.target.value)} placeholder="sk-ant-..."
        style={{ width:"100%", maxWidth:440, border:"1px solid #d1d5db", borderRadius:6, padding:"8px 10px", fontSize:13, marginBottom:"1rem" }}/>
      <p style={{ fontSize:11, color:"#9ca3af", marginBottom:"1rem" }}>
        Conseguila en <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color:"#1d4ed8" }}>console.anthropic.com</a> → API Keys
      </p>
      <button onClick={()=>{onSave(k);setOk(true);setTimeout(()=>setOk(false),2500);}}
        style={{ padding:"9px 20px", fontWeight:600, background:"#111827", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontSize:13 }}>
        {ok?"✓ Guardado":"Guardar API key"}
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════
   APP SHELL
════════════════════════════════════════════ */
export default function App() {
  const [sec,    setSec]    = useState("cotizador");
  const [vp,     setVp]     = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [apiKey, setApiKey] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setVp(lsGet("omint-vp"));
    setQuotes(lsGet("omint-quotes") || []);
    setApiKey(lsGet("omint-apikey") || "");
    setLoaded(true);
  }, []);

  function saveVp(p)         { setVp(p);                        lsSet("omint-vp", p); }
  function saveQuote(q)      { const nq=[q,...quotes]; setQuotes(nq); lsSet("omint-quotes", nq); }
  function updQuote(id, upd) { const nq=quotes.map(q=>q.id===id?{...q,...upd}:q); setQuotes(nq); lsSet("omint-quotes", nq); }
  function saveApiKey(k)     { setApiKey(k);                    lsSet("omint-apikey", k); }

  const knownEmpresas = [...new Set(quotes.map(q=>q.empresa).filter(Boolean))];

  const nav = [
    { id:"cotizador", label:"Cotizador",               strong:true  },
    { id:"vigente",   label:"Precios Vigentes",         strong:false },
    { id:"cerrados",  label:"Costos Cerrados Vigentes", strong:false },
    { id:"abiertos",  label:"Costos Abiertos Vigentes", strong:false },
    { id:"historial", label:"Historial",                strong:false },
    { id:"config",    label:"Configuración",            strong:false },
  ];

  return (
    <div style={{ display:"flex", fontFamily:"system-ui, -apple-system, sans-serif", minHeight:"100vh", background:"#fff" }}>
      {/* SIDEBAR */}
      <div style={{ width:200, borderRight:"1px solid #e5e7eb", flexShrink:0, paddingTop:"1rem", background:"#fff" }}>
        <div style={{ padding:"0 1rem 0.875rem", borderBottom:"1px solid #e5e7eb", marginBottom:"0.5rem" }}>
          <p style={{ fontSize:11, fontWeight:600, color:"#9ca3af", letterSpacing:"0.08em" }}>OMINT</p>
        </div>
        {nav.map(item => (
          <button key={item.id} onClick={()=>setSec(item.id)} style={{
            display:"block", width:"100%", textAlign:"left", padding:"9px 1rem",
            border:"none", borderRadius:0, cursor:"pointer", lineHeight:1.4,
            background: sec===item.id ? "#f3f4f6" : "#fff",
            color:      item.strong||sec===item.id ? "#111827" : "#6b7280",
            fontWeight: item.strong ? 600 : sec===item.id ? 600 : 400,
            fontSize:   item.strong ? 14 : 13,
            borderLeft: sec===item.id ? "2px solid #111827" : "2px solid transparent",
          }}>
            {item.label}
          </button>
        ))}
        {loaded && (
          <p style={{ fontSize:11, color:"#9ca3af", padding:"1rem 1rem 0", lineHeight:1.7 }}>
            {quotes.filter(q=>q.status==="abierto").length} abiertos<br/>
            {quotes.filter(q=>q.status==="cerrado").length} cerrados<br/>
            {knownEmpresas.length} empresas
          </p>
        )}
      </div>
      {/* CONTENT */}
      <div style={{ flex:1, padding:"1.75rem 2rem", overflowY:"auto", minWidth:0 }}>
        {!loaded && <p style={{ fontSize:13, color:"#9ca3af" }}>Cargando…</p>}
        {loaded && sec==="cotizador" && <Cotizador vigentePrices={vp} onSaveQuote={saveQuote} knownEmpresas={knownEmpresas} apiKey={apiKey}/>}
        {loaded && sec==="vigente"   && <PreciosVigentes prices={vp} onSave={saveVp}/>}
        {loaded && sec==="cerrados"  && <CostosTable quotes={quotes.filter(q=>q.status==="cerrado")} title="Costos Cerrados Vigentes" emptyMsg="No hay costos cerrados todavía." onUpdate={updQuote}/>}
        {loaded && sec==="abiertos"  && <CostosTable quotes={quotes.filter(q=>q.status==="abierto")} title="Costos Abiertos Vigentes" emptyMsg="No hay costos abiertos todavía." onUpdate={updQuote}/>}
        {loaded && sec==="historial" && <Historial quotes={quotes} onUpdate={updQuote}/>}
        {loaded && sec==="config"    && <Configuracion apiKey={apiKey} onSave={saveApiKey}/>}
      </div>
    </div>
  );
}
