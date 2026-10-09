import { CATS, CAT_IDS, EMPTY_CATS, OSDE_CATS, EMPTY_OSDE } from "./constants";
import { catAge, planTier } from "./utils";

// ── CALC BD ───────────────────────────────────────────────────────────────────
function calcBD(emps,map,prices,costos){
  const c={...EMPTY_CATS};
  let validTits=0;
  emps.forEach(e=>{
    const ta=parseInt(e[map.titAge]);if(!isNaN(ta)){c[catAge(ta)]++;validTits++;}
    if(map.spAge){const sa=parseInt(e[map.spAge]);if(!isNaN(sa)&&sa>0)c[catAge(sa)]++;}
    const ku=parseInt(e[map.ku])||0;if(ku>=1)c.h1++;if(ku>=2)c.h2plus+=(ku-1);
    // Hijos >25: cada uno cuenta en su categoría de edad (FAC)
    const facEdades=map.k25?e[map.k25]:null;
    if(Array.isArray(facEdades)){facEdades.forEach(edad=>{c[catAge(edad)]++;});}
    else if(facEdades){const n=parseInt(facEdades)||0;if(n>0)c.s0_25+=n;} // fallback legacy
  });
  const rows=CATS.map(x=>{
    const n=c[x.id],pr=prices[x.id]||0,ct=costos[x.id]||0;
    const fac=n*pr,cos=n*ct,cf=fac>0?cos/fac*100:0;
    return{...x,count:n,precio:pr,costo:ct,fac,cos,cf};
  });
  const tf=rows.reduce((a,r)=>a+r.fac,0),tc=rows.reduce((a,r)=>a+r.cos,0);
  const skipped=emps.length-validTits;
  return{rows,totalFac:tf,totalCosto:tc,cfTotal:tf>0?tc/tf*100:0,totalSocios:emps.length,skipped};
}

// ── MULTIPLICADOR DE AJUSTES ─────────────────────────────────────────────────
// historial: [{mes:"2025-04", pct:5.2, nota:""}] → producto acumulado de (1+pct/100)
function calcMultiplier(historial){
  return (historial||[]).reduce((m,e)=>m*(1+e.pct/100),1);
}

// ── AJUSTE DE PRECIOS ─────────────────────────────────────────────────────────
// Ajuste de un plan cotizado: {modo:"rango059", pct059, pct60} (0-59 y 60+)
// o {modo:"rango", cats:{s0_25:pct,...}} (un % por rango). pct en decimal (-0.1 = -10%).
function pctAjuste(adj,catId){
  if(!adj)return 0;
  if(adj.modo==="rango")return adj.cats?.[catId]||0;
  return (catId==="s60plus"?adj.pct60:adj.pct059)||0;
}

// ── OSDE COMPARISON ───────────────────────────────────────────────────────────
function calcOsdeFromEmps(emps,osdePrices){
  const counts={...EMPTY_OSDE};
  (emps||[]).forEach(row=>{
    const edadTit=parseInt(row.EDAD_TITULAR)||0;
    const edadCon=parseInt(row.EDAD_CONYUGE)||0;
    const hasSpouse=edadCon>0;
    const hijMen=parseInt(row.HIJOS_MENORES_25)||0; // <=25: hijo en ambos
    const hij2627=parseInt(row.OSDE_HIJO_26_27)||0; // 26-27: FAC en Omint, hijo en OSDE
    const hijOsdeIndJoven=parseInt(row.OSDE_IND_JOVEN)||0; // 28-35: ind_joven en OSDE
    const hijOsdeIndMayor=parseInt(row.OSDE_IND_MAYOR)||0; // 36+: ind_mayor en OSDE
    const prefix=hasSpouse?"mat":"ind";
    const suffix=edadTit<28?"neo":edadTit<=35?"joven":"mayor";
    counts[`${prefix}_${suffix}`]++;
    const totalOsdeHijo=hijMen+hij2627;
    if(totalOsdeHijo>=1)counts.hijo1++;
    if(totalOsdeHijo>=2)counts.hijo2plus+=(totalOsdeHijo-1);
    counts.ind_joven+=hijOsdeIndJoven;
    counts.ind_mayor+=hijOsdeIndMayor;
  });
  const total=OSDE_CATS.reduce((sum,cat)=>sum+counts[cat.id]*(osdePrices[cat.id]||0),0);
  return{counts,total};
}

// ── DETECCIÓN INVERSIÓN DE PRECIOS ────────────────────────────────────────────
function checkPriceInversions(results){
  const violations=[];
  const byZona={};
  results.forEach(r=>{if(!byZona[r.zona])byZona[r.zona]=[];byZona[r.zona].push(r);});
  Object.entries(byZona).forEach(([zona,list])=>{
    const sorted=[...list].sort((a,b)=>planTier(a.planId)-planTier(b.planId));
    for(let i=0;i<sorted.length-1;i++){
      for(let j=i+1;j<sorted.length;j++){
        const r1=sorted[i],r2=sorted[j];
        if(planTier(r1.planId)>=planTier(r2.planId))continue;
        CATS.forEach(cat=>{
          const p1=r1.bd.rows.find(r=>r.id===cat.id)?.precio||0;
          const p2=r2.bd.rows.find(r=>r.id===cat.id)?.precio||0;
          if(p1>0&&p2>0&&p1>p2){
            violations.push({zona,cat:cat.label,plan1:r1.cotId||r1.planId,price1:p1,plan2:r2.cotId||r2.planId,price2:p2});
          }
        });
      }
    }
  });
  return violations;
}

export { calcBD, calcMultiplier, pctAjuste, calcOsdeFromEmps, checkPriceInversions };
