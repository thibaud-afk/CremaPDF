export function choosePages(mode,range,total,current){
 if(mode==='all')return Array.from({length:total},(_,i)=>i+1);
 if(mode==='current')return [current];
 const pages=new Set();if(!range.trim())throw Error('Indiquez les pages à imprimer, par exemple 1-3, 5.');
 for(const token of range.replace(/[–—]/g,'-').split(',')){const match=token.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);if(!match)throw Error('Format attendu : 1-3, 5, 7-9.');const a=Number(match[1]),b=Number(match[2]||match[1]);if(a<1||b>total||b<a)throw Error('Les numéros doivent être compris entre 1 et '+total+', dans l’ordre croissant.');for(let n=a;n<=b;n++)pages.add(n);}
 return [...pages].sort((a,b)=>a-b);
}
