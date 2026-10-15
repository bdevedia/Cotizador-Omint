import { CAT_IDS, MEJORAS_DEF } from "./constants";
import { calcBD, planDeCosto } from "./calc";
import { planTier } from "./utils";

// ── CÁLCULO DE UNA COTIZACIÓN ─────────────────────────────────────────────────
// Función pura: a partir del estado de la cotización y de las listas (precios ya con la banda
// de cápitas aplicada, costos y mejoras) arma un resultado por grupo. La usa el Cotizador y
// también el Historial, para volver a generar los archivos de una cotización guardada.
//
// estado: {emps, map, modo, zona, planesSim, variantes, planMapping, adjPrices, adjCostos,
//          ajusteCostos, planMejoras, brokerPct}
// listas: {precios: {zona:{plan:cats}}, costos: {plan:cats}, mejoras}

// id de plan cotizado → {planId base (precios/costos), cotId}
function resolverCot(id,variantes){
  if(!id)return null;
  const v=(variantes||[]).find(x=>x.id===id);
  return v?{planId:v.planId,cotId:v.id}:{planId:id,cotId:id};
}

function construirGrupos(est,listas){
  const {emps,map,modo,zona,planesSim=[],variantes=[],planMapping={}}=est;
  if(!emps||!map?.titAge||!map?.ku)return[];
  const isOmintPlan=p=>Object.values(listas.precios||{}).some(z=>z?.[p]);
  const gmap={};
  if(modo==="simulacion"){
    // Simulación: toda la nómina entra en cada plan elegido, sin importar su plan vigente
    planesSim.forEach(id=>{
      const cot=resolverCot(id,variantes);
      if(!cot)return;
      gmap[`${zona}||${cot.cotId}`]={zona,planVigente:cot.cotId,...cot,empList:[...emps]};
    });
    return Object.values(gmap).sort((a,b)=>planTier(a.planId)-planTier(b.planId)||a.cotId.localeCompare(b.cotId));
  }
  emps.forEach(e=>{
    if(!map.planCol||!e[map.planCol])return;
    const ext=String(e[map.planCol]).trim();
    const cot=resolverCot(planMapping[ext]||(isOmintPlan(ext)?ext:null),variantes);
    if(!cot)return;
    // Agrupar por plan VIGENTE: cada plan original tiene su propia distribución
    const key=`${zona}||${ext}`;
    if(!gmap[key])gmap[key]={zona,planVigente:ext,...cot,empList:[]};
    gmap[key].empList.push(e);
  });
  return Object.values(gmap).sort((a,b)=>planTier(a.planId)-planTier(b.planId)||a.cotId.localeCompare(b.cotId));
}

function construirResultados(est,listas){
  const {map,modo,variantes=[],adjPrices={},adjCostos={},ajusteCostos={},planMejoras={},brokerPct}=est;
  const {precios,costos,mejoras}=listas;
  const isSim=modo==="simulacion";
  const brokerMult=1+(parseFloat(brokerPct)||0)/100;
  return construirGrupos(est,listas).map(({zona,planId,cotId,planVigente,empList})=>{
    // adjKey por plan COTIZADO (plan Omint o copia): ajustes, mejoras y nombres van por plan
    // cotizado; precios y costos base salen del plan Omint (planId)
    const adjKey=`${zona}||${cotId}`;
    const basePrices=precios?.[zona]?.[planId]||{};
    const adjP=adjPrices[adjKey]||{};
    const effPrices=Object.fromEntries(CAT_IDS.map(c=>[c,adjP[c]!==undefined?adjP[c]:basePrices[c]||0]));
    const baseCostos=costos?.[planDeCosto(costos,planId)]||{};
    const adjC=adjCostos[adjKey]||{};
    const ajC=ajusteCostos[adjKey]||{};
    // Mejoras: las elegidas a mano para este plan o, si no, las fijas de la copia
    const mejSel=planMejoras[adjKey]||variantes.find(v=>v.id===cotId)?.mejoras||{};
    const effCostos=Object.fromEntries(CAT_IDS.map(c=>{
      const base=adjC[c]!==undefined?adjC[c]:baseCostos[c]||0;
      let mejCost=0;
      MEJORAS_DEF.forEach(m=>{
        const optKey=mejSel[m.id];
        if(!optKey)return;
        const opt=(mejoras||{})[m.id]?.[optKey];
        if(opt==null)return;
        mejCost+=m.type==="pmpm"?(typeof opt==="number"?opt:0):(opt[c]||0);
      });
      return[c,(base*(1+(ajC.pct||0))+(ajC.cats?.[c]||0)+mejCost)*brokerMult];
    }));
    const bd=calcBD(empList,map,effPrices,effCostos);
    // baseCostosXLS: costo sin mejoras ni comisión (para que el Excel pueda desglosar)
    const baseCostosXLS=Object.fromEntries(CAT_IDS.map(c=>[c,adjC[c]!==undefined?adjC[c]:baseCostos[c]||0]));
    // basePreciosXLS: precio de lista sin ajuste (el Excel aplica la fórmula *(1+ajuste))
    const basePreciosXLS=Object.fromEntries(CAT_IDS.map(c=>[c,basePrices[c]||0]));
    // osdeKey: comparación OSDE por plan vigente
    const osdeKey=`${zona}||${planVigente}`;
    const sinPrecios=Object.keys(basePrices).length===0;
    return{zona,planId,cotId,mejSel,planVigente,empList,bd,adjKey,osdeKey,sim:isSim,sinPrecios,ajC,baseCostosXLS,basePreciosXLS};
  });
}

export { construirResultados, construirGrupos, resolverCot };
