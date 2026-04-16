import { CATS, CAT_IDS, EMPTY_CATS, OSDE_CATS, EMPTY_OSDE } from "./constants";
import { catAge, planTier } from "./utils";

// ── CALC BD ───────────────────────────────────────────────────────────────────
function calcBD(emps,map,prices,costos){
  const c={...EMPTY_CATS};
  emps.forEach(e=>{
    const ta=parseInt(e[map.titAge]);if(!isNaN(ta))c[catAge(ta)]++;
    if(map.spAge){const sa=parseInt(e[map.spAge]);if(!isNaN(sa)&&sa>0)c[catAge(sa)]++;}
    const ku=parseInt(e[map.ku])||0;if(ku>=1)c.h1++;if(ku>=2)c.h2plus+=(ku-1);
    const k25=map.k25?(parseInt(e[map.k25])||0):0;if(k25>0)c.s0_25+=k25;
  });
  const rows=CATS.map(x=>{
    const n=c[x.id],pr=prices[x.id]||0,ct=costos[x.id]||0;
    const fac=n*pr,cos=n*ct,cf=fac>0?cos/fac*100:0;
    return{...x,count:n,precio:pr,costo:ct,fac,cos,cf};
  });
  const tf=rows.reduce((a,r)=>a+r.fac,0),tc=rows.reduce((a,r)=>a+r.cos,0);
  return{rows,totalFac:tf,totalCosto:tc,cfTotal:tf>0?tc/tf*100:0,totalSocios:emps.length};
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
            violations.push({zona,cat:cat.label,plan1:r1.planId,price1:p1,plan2:r2.planId,price2:p2});
          }
        });
      }
    }
  });
  return violations;
}

export { calcBD, calcOsdeFromEmps, checkPriceInversions };
