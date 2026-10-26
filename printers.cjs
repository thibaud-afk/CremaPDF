const {execFile}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const cache=new Map();
async function capabilities(name){
 if(process.platform!=='win32')return {known:false};
 const previous=cache.get(name);if(previous&&Date.now()-previous.time<60000)return previous.value;
 const script=fs.readFileSync(path.join(__dirname,'printer-capabilities.ps1'),'utf8');
 const value=await new Promise(resolve=>execFile(path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:8000,maxBuffer:65536,env:{...process.env,CREMAPDF_PRINTER:name}},(error,stdout)=>{try{resolve(error?{known:false}:JSON.parse(stdout.replace(/^\uFEFF/,'')));}catch{resolve({known:false});}}));
 cache.set(name,{time:Date.now(),value});return value;
}
function printSettings(settings,printers,capability){
 const printer=printers.find(p=>p.name===settings?.deviceName);if(!printer)throw Error('Choisissez une imprimante installée.');
 const copies=Number(settings.copies);if(!Number.isInteger(copies)||copies<1||copies>99)throw Error('Choisissez entre 1 et 99 exemplaires.');
 if(!['simplex','longEdge','shortEdge'].includes(settings.duplexMode))throw Error('Mode recto verso non valide.');
 if(capability?.known&&settings.duplexMode!=='simplex'&&!capability[settings.duplexMode])throw Error('Le pilote de cette imprimante ne propose pas ce mode recto verso.');
 return {silent:settings.systemDialog!==true,deviceName:printer.name,copies,duplexMode:settings.duplexMode,collate:true,printBackground:true,pageSize:'A4',margins:{marginType:'none'}};
}
module.exports={capabilities,printSettings};
