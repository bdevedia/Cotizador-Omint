import { FONT, BLUE, BLUE_LT, BORDER, GRAY } from "./constants";

// ── ESTILOS ───────────────────────────────────────────────────────────────────
const card=(x={})=>({background:"#fff",border:`1px solid ${BORDER}`,borderRadius:12,padding:"1.5rem",...x});
const TH=(x={})=>({padding:"8px 11px",fontWeight:600,fontSize:10.5,color:"#6B7280",borderBottom:`1px solid ${BORDER}`,textAlign:"right",background:GRAY,letterSpacing:"0.04em",textTransform:"uppercase",fontFamily:FONT,whiteSpace:"nowrap",...x});
const TD=(x={})=>({padding:"8px 11px",borderBottom:`1px solid ${BORDER}`,fontSize:13,fontFamily:FONT,...x});
const badge=(c,bg)=>({display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,color:c,background:bg,fontFamily:FONT});
const btnP={background:BLUE,color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:FONT};
const btnS={background:"#fff",color:BLUE,border:`1px solid ${BORDER}`,borderRadius:8,padding:"9px 18px",fontWeight:500,fontSize:13,cursor:"pointer",fontFamily:FONT};
const inp={border:`1px solid ${BORDER}`,borderRadius:8,padding:"8px 12px",fontSize:13,width:"100%",outline:"none",fontFamily:FONT};
const numInp=(w=90,adj=false)=>({width:w,textAlign:"right",fontSize:12,padding:"3px 6px",border:`1px solid ${adj?BLUE:BORDER}`,borderRadius:6,fontFamily:FONT,color:adj?BLUE:"#111827"});

export { card, TH, TD, badge, btnP, btnS, inp, numInp };
