// localStorage helpers (keep in sync with firebase.js exports)
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}
function lsGet(k,def=null){try{const v=localStorage.getItem(k);return v!==null?JSON.parse(v):def;}catch{return def;}}

export { lsSet, lsGet };
