import {choosePages} from './print-pages.mjs';
export function initPrint({pdfjs,getDocument,getPage,buildPdf,status,guard}){
 const $=id=>document.getElementById(id),dialog=$('printDialog');
 let prepared=null,previewIndex=0,revision=0,printing=false,deviceRevision=0,capabilityLoading=false;
 const selection=()=>choosePages($('printChoice').value,$('printRange').value,getDocument().numPages,getPage());
 const ensureDocument=()=>prepared??=(async()=>{const pdf=await buildPdf();return pdfjs.getDocument({data:await pdf.save(),isEvalSupported:false}).promise;})();
 function release(){revision++;const old=prepared;prepared=null;old?.then(d=>d.destroy()).catch(()=>{});}
 function updateSummary(){
  $('rangeLabel').hidden=$('printChoice').value!=='range';
  try{const pages=selection(),copies=Number($('printCopies').value);if(!Number.isInteger(copies)||copies<1||copies>99)throw Error('Choisissez entre 1 et 99 exemplaires.');
   const sheets=($('printDuplex').value==='simplex'?pages.length:Math.ceil(pages.length/2))*copies;
   $('printSummary').textContent=`${pages.length} page(s) sur ${getDocument().numPages} · ${copies} exemplaire(s) · ${sheets} feuille(s) A4`;
   $('printConfirm').disabled=$('printSystem').disabled=printing||capabilityLoading||!$('printPrinter').value;return pages;
  }catch(error){$('printSummary').textContent=error.message;$('printConfirm').disabled=$('printSystem').disabled=true;return null;}
 }
 async function preview(){const current=++revision,pages=updateSummary();if(!pages){$('previewPrev').disabled=$('previewNext').disabled=true;$('printPreviewCanvas').hidden=true;$('printPreviewLabel').textContent='Vérifiez les pages sélectionnées.';return;}
  previewIndex=Math.min(previewIndex,pages.length-1);$('previewPrev').disabled=previewIndex===0;$('previewNext').disabled=previewIndex===pages.length-1;
  $('printPreviewLabel').textContent='Préparation de l’aperçu…';
  try{const doc=await ensureDocument();if(current!==revision||!dialog.open)return;const page=await doc.getPage(pages[previewIndex]),natural=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(1.5,800/natural.width)});
   const buffer=document.createElement('canvas');buffer.width=Math.ceil(viewport.width);buffer.height=Math.ceil(viewport.height);await page.render({canvasContext:buffer.getContext('2d'),viewport}).promise;
   if(current!==revision||!dialog.open)return;const canvas=$('printPreviewCanvas');canvas.width=420;canvas.height=594;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,420,594);const margin=420*8/210,factor=Math.min((420-margin*2)/buffer.width,(594-margin*2)/buffer.height);ctx.drawImage(buffer,(420-buffer.width*factor)/2,(594-buffer.height*factor)/2,buffer.width*factor,buffer.height*factor);canvas.hidden=false;
   $('printPreviewLabel').textContent=`Page ${pages[previewIndex]} du PDF · aperçu ${previewIndex+1} / ${pages.length}`;
  }catch(error){if(current===revision){$('printPreviewLabel').textContent='Aperçu indisponible : '+error.message;$('printConfirm').disabled=$('printSystem').disabled=true;}}
 }
 async function loadCapabilities(){const current=++deviceRevision,name=$('printPrinter').value;capabilityLoading=true;updateSummary();$('printDuplex').value='simplex';for(const option of $('printDuplex').options)option.disabled=false;$('printDuplex').disabled=true;$('printDriverNote').textContent='Lecture des options du pilote…';
  try{const capability=name?await window.desktop.printerCapabilities(name):{known:true,longEdge:false,shortEdge:false};if(current!==deviceRevision)return;
   for(const value of ['longEdge','shortEdge'])$('printDuplex').querySelector(`option[value="${value}"]`).disabled=capability.known&&!capability[value];
   $('printDuplex').disabled=capability.known&&!capability.longEdge&&!capability.shortEdge;
   const remembered=localStorage.getItem('print-duplex:'+name);if(remembered&&['simplex','longEdge','shortEdge'].includes(remembered)&&(!capability.known||remembered==='simplex'||capability[remembered]))$('printDuplex').value=remembered;
   $('printDriverNote').textContent=!name?'Aucune imprimante disponible.':!capability.known?'Le pilote n’a pas répondu pour le recto verso. Choisissez le mode souhaité ou ouvrez les options Windows.':capability.longEdge||capability.shortEdge?'Recto verso disponible avec ce pilote.':'Recto verso non disponible avec le pilote sélectionné.';
  }catch(error){if(current===deviceRevision){$('printDuplex').disabled=false;$('printDriverNote').textContent='Options non détectées. Utilisez les options Windows si nécessaire.';}}
  finally{if(current===deviceRevision){capabilityLoading=false;updateSummary();}}
 }
 $('print').onclick=guard(async()=>{if(!getDocument()||dialog.open)return;release();previewIndex=0;$('printCopies').value='1';$('printPrinter').replaceChildren(new Option('Chargement des imprimantes…',''));$('printCount').textContent=`Ce document contient ${getDocument().numPages} page(s). Page actuelle : ${getPage()}.`;
  dialog.showModal();preview();try{const printers=await window.desktop.printers();if(!dialog.open)return;$('printPrinter').replaceChildren(...printers.map(p=>new Option((p.displayName||p.name)+(p.isDefault?' — par défaut':''),p.name)));
   if(!printers.length)$('printPrinter').append(new Option('Aucune imprimante installée',''));
   const remembered=localStorage.getItem('print-printer');$('printPrinter').value=printers.find(p=>p.name===remembered)?.name||printers.find(p=>p.isDefault)?.name||printers[0]?.name||'';await loadCapabilities();
  }catch(error){$('printDriverNote').textContent='Impossible de lire les imprimantes : '+error.message;updateSummary();}});
 $('printChoice').onchange=$('printRange').oninput=()=>{previewIndex=0;preview();};
 $('printPrinter').onchange=()=>loadCapabilities();$('printCopies').oninput=$('printDuplex').onchange=()=>updateSummary();
 $('previewPrev').onclick=()=>{previewIndex=Math.max(0,previewIndex-1);preview();};$('previewNext').onclick=()=>{const pages=selection();previewIndex=Math.min(pages.length-1,previewIndex+1);preview();};
 $('printCancel').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{deviceRevision++;if(!printing)release();});
 async function submit(systemDialog){if(printing||capabilityLoading)return;const chosen=selection(),settings={deviceName:$('printPrinter').value,copies:Number($('printCopies').value),duplexMode:$('printDuplex').value,systemDialog};if(!settings.deviceName)throw Error('Choisissez une imprimante.');
  printing=true;revision++;dialog.close();$('print').disabled=true;localStorage.setItem('print-printer',settings.deviceName);localStorage.setItem('print-duplex:'+settings.deviceName,settings.duplexMode);
  try{const doc=await ensureDocument(),images=[];for(let i=0;i<chosen.length;i++){status(`Préparation de l’impression : ${i+1} / ${chosen.length}…`);const page=await doc.getPage(chosen[i]),viewport=page.getViewport({scale:2.5}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;images.push(canvas.toDataURL('image/png'));canvas.width=canvas.height=0;}const result=await window.desktop.print(images,settings);status(result.success?'Impression transmise à '+settings.deviceName+'.':'Impression non effectuée : '+(result.reason||'annulée.'));}
  finally{release();printing=false;$('print').disabled=!getDocument();}
 }
 $('printConfirm').onclick=guard(()=>submit(false));$('printSystem').onclick=guard(()=>submit(true));
}
