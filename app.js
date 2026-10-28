import * as pdfjs from "./vendor/pdfjs/pdf.mjs";
import {initPrint} from './print-ui.mjs';
import {arrowMove} from './placement.mjs';
pdfjs.GlobalWorkerOptions.workerSrc =
  "./vendor/pdfjs/pdf.worker.mjs";
const $ = (id) => document.getElementById(id),
  status = (t) => ($("status").textContent = t);
let source,
  doc,
  name,
  page = 1,
  scale = 1,
  tool = "select",
  signature,
  selected = null,
  items = [],
  dirty = false,
  renderVersion = 0,
  viewport,
  textContent,
  searchResults = [],
  searchIndex = -1;
const overlay = $("overlay");
const welcome = $("welcome");
welcome.querySelector("h1").innerHTML =
  "Bienvenue Thibaud.<br>Votre atelier PDF est prêt.";
$("welcomeopen").textContent = "＋ Importer un PDF";
$("welcomeopen").classList.add("large");
const defaultButton = document.createElement("button");
defaultButton.id = "defaultapp";
defaultButton.textContent = "Définir CremaPDF comme lecteur PDF par défaut";
defaultButton.onclick = guard(async () => {
  await window.desktop.defaultApp();
  status(
    "Dans les paramètres Windows, recherchez .pdf puis choisissez CremaPDF. Le logiciel doit être installé au préalable.",
  );
});
welcome.append(defaultButton);
$("signatureDialog").querySelector("h2").textContent =
  "Bienvenue Thibaud. Choisis ta signature.";
$("confirm").textContent = "Conserver ma signature · C’est parti !";
const skipLabel = document.createElement("label");
skipLabel.className = "skip";
skipLabel.innerHTML =
  '<input id="skipwelcome" type="checkbox"> Ne plus afficher cet accueil';
$("signatureDialog").insertBefore(skipLabel, $("confirm").parentElement);
$("skipwelcome").checked = localStorage.getItem("skipwelcome") === "yes";
$("skipwelcome").onchange = () =>
  localStorage.setItem("skipwelcome", $("skipwelcome").checked ? "yes" : "no");
const nameLabel = document.createElement("label");
nameLabel.innerHTML =
  'Comment souhaitez-vous être appelé ?<input id="preferredname" type="text" maxlength="60" placeholder="Votre prénom">';
$("signatureDialog").insertBefore(nameLabel, document.querySelector('.pad-wrap'));
$("preferredname").value = localStorage.getItem("preferredname") || "";
function personalize() {
  const preferred = localStorage.getItem("preferredname") || "";
  welcome.querySelector("h1").textContent =
    localStorage.getItem("skipwelcome") === "yes"
      ? "Ouvrir un PDF"
      : preferred
        ? `Bienvenue ${preferred}.`
        : "Bienvenue dans CremaPDF.";
  $("signatureDialog").querySelector("h2").textContent = preferred
    ? `Bienvenue ${preferred}. Choisissez votre signature.`
    : "Bienvenue ! Configurez votre atelier PDF.";
}
personalize();
$("text").value = "";
$("preferredname").oninput = () => {
  localStorage.setItem("preferredname", $("preferredname").value.trim());
  personalize();
};
$("skipwelcome").addEventListener("change", personalize);
const credit = document.createElement("p");
credit.className = "muted";
credit.textContent = "Offert avec plaisir par Thibaud CREMADES";
welcome.append(credit);
const creditDialog = credit.cloneNode(true);
$("signatureDialog").append(creditDialog);
const settings = document.createElement("button");
settings.textContent = "Accueil et réglages";
settings.onclick = () => {
  $("signatureDialog").showModal();
};
document.querySelector("aside").append(settings);
const defaultSettings = document.createElement("button");
defaultSettings.textContent = "Lecteur PDF par défaut";
defaultSettings.onclick = defaultButton.onclick;
document.querySelector("aside").append(defaultSettings);
const pan = document.createElement("button");
pan.textContent = "✋ Déplacer la vue";
pan.dataset.tool = "pan";
document.querySelector('[data-tool="select"]').after(pan);
const extra = document.createElement("div");
extra.innerHTML =
  '<hr><div class="label">SURLIGNAGE</div><button id="highlight">▰ Surligner des mots</button><button id="area">▱ Surligner une zone</button><label>Couleur <select id="color"><option value="#ffe34d">Jaune</option><option value="#78e5a7">Vert</option><option value="#7cc9ff">Bleu</option><option value="#ff93c1">Rose</option></select></label>';
document.querySelector("aside").insertBefore(extra, $("text").parentElement);
const searchbar = document.createElement("div");
searchbar.className = "searchbar";
searchbar.innerHTML =
  '<input id="query" placeholder="Rechercher un mot…" aria-label="Rechercher dans le PDF"><button id="search">Rechercher</button><button id="searchprev" title="Résultat précédent">↑</button><button id="searchnext" title="Résultat suivant">↓</button><span id="results"></span>';
document.querySelector(".workspace").insertBefore(searchbar, $("scroll"));
const textLayer = document.createElement("div");
textLayer.id = "textlayer";
$("paper").insertBefore(textLayer, overlay);
function guard(fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (e) {
      console.error(e);
      status("Erreur : " + e.message);
    }
  };
}
function setTool(t) {
  tool = t;
  document
    .querySelectorAll("[data-tool]")
    .forEach((b) => b.classList.toggle("active", b.dataset.tool === t));
  $("highlight").classList.toggle("active", t === "highlight");
  $("area").classList.toggle("active", t === "area");
  overlay.style.pointerEvents = t === "highlight" ? "none" : "auto";
  textLayer.style.pointerEvents = t === "highlight" ? "auto" : "none";
  $("actionHint").hidden = t !== "signature";
  $("actionHint").textContent = "Cliquez maintenant dans le PDF à l’endroit où poser votre signature. Vous pourrez ensuite la déplacer et la redimensionner.";
  overlay.style.cursor = t === "signature" ? "crosshair" : "default";
  status(
    t === "highlight"
      ? "Sélectionnez les mots avec la souris : le surlignage est ajouté au relâchement."
      : t === "area"
        ? "Dessinez un rectangle à surligner."
        : t === "signature" ? "Indiquez maintenant l’endroit où poser la signature : cliquez dans le PDF." : "Déplacez à la souris ou avec les flèches. Maj + flèches : déplacement rapide. Suppr : supprimer.",
  );
}
document.querySelectorAll("[data-tool]").forEach(
  (b) =>
    (b.onclick = () =>
      guard(async () => {
        if (b.dataset.tool === "signature" && !signature) {
          $("signatureDialog").showModal();
          return;
        }
        setTool(b.dataset.tool);
      })()),
);
$("highlight").onclick = () => setTool("highlight");
$("area").onclick = () => setTool("area");
async function open(provided) {
  if (
    dirty &&
    !confirm("Ouvrir un autre PDF et abandonner les ajouts non enregistrés ?")
  )
    return;
  const f = provided?.bytes ? provided : await window.desktop.open();
  if (!f) return;
  const bytes = new Uint8Array(f.bytes);
  const test = await PDFLib.PDFDocument.load(bytes);
  if (test.isEncrypted)
    throw Error("Ce PDF est protégé. Utilisez une copie déverrouillée.");
  const next = await pdfjs.getDocument({
    data: bytes.slice(),
    isEvalSupported: false,
  }).promise;
  source = bytes;
  doc = next;
  name = f.name;
  page = 1;
  items = [];
  dirty = false;
  selected = null;
  searchResults = [];
  searchIndex = -1;
  $("results").textContent = "";
  $("filename").textContent = name;
  $("welcome").hidden = true;
  $("paper").hidden = false;
  $("save").disabled = false;
  $('print').disabled=false;
  await render();
  status("Document ouvert. Choisissez un outil à gauche.");
}
$("open").onclick = $("welcomeopen").onclick = guard(open);
async function render() {
  if (!doc) return;
  const version = ++renderVersion,
    p = await doc.getPage(page);
  if (version !== renderVersion) return;
  viewport = p.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await p.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  if (version !== renderVersion) return;
  const visible = $("pdf");
  visible.width = canvas.width;
  visible.height = canvas.height;
  visible.getContext("2d").drawImage(canvas, 0, 0);
  $("paper").style.width = viewport.width + "px";
  $("paper").style.height = viewport.height + "px";
  $("pagecount").textContent = `Page ${page} / ${doc.numPages}`;
  $("zoom").textContent = Math.round(scale * 100) + " %";
  $("prev").disabled = page === 1;
  $("next").disabled = page === doc.numPages;
  textContent = await p.getTextContent();
  if (version !== renderVersion) return;
  textLayer.replaceChildren();
  for (const item of textContent.items) {
    if (!item.str) continue;
    const tx = pdfjs.Util.transform(viewport.transform, item.transform),
      angle = Math.atan2(tx[1], tx[0]),
      height = Math.hypot(tx[2], tx[3]);
    const span = document.createElement("span");
    span.textContent = item.str;
    span.style.left = tx[4] + "px";
    span.style.top = tx[5] - height + "px";
    span.style.fontSize = height + "px";
    span.style.transform = `rotate(${angle}rad)`;
    textLayer.append(span);
    const width = span.getBoundingClientRect().width;
    if (width)
      span.style.transform = `rotate(${angle}rad) scaleX(${(item.width * scale) / width})`;
  }
  draw();
}
function add(item) {
  items.push({ id: crypto.randomUUID(), page, ...item });
  dirty = true;
  selected = items.at(-1).id;
  if (["signature", "text"].includes(item.kind)) setTool("select");
  draw();
  if (['signature','text'].includes(item.kind)) {document.activeElement?.blur();overlay.tabIndex=0;overlay.focus({preventScroll:true});}
  if (item.kind === "signature") status("Signature posée : glissez-la ou utilisez les flèches. Maj + flèches : déplacement rapide. Tirez un coin pour changer sa taille.");
}
function draw() {
  overlay.replaceChildren();
  for (const it of items.filter((i) => i.page === page)) {
    const el = document.createElement("div");
    el.className = "item" + (selected === it.id ? " selected" : "");
    el.dataset.id = it.id;
    el.dataset.kind = it.kind;
    el.style.left = it.x * scale + "px";
    el.style.top = it.y * scale + "px";
    el.style.width = it.w * scale + "px";
    el.style.height = it.h * scale + "px";
    if (it.kind === "signature") {
      const img = document.createElement("img");
      img.src = it.data;
      el.append(img);
    } else if (it.kind === "highlight") {
      el.style.background = it.color;
      el.style.opacity = ".36";
      el.style.mixBlendMode = "multiply";
    } else {
      el.textContent = it.text;
      el.style.fontSize = it.size * scale + "px";
    }
    el.onpointerdown = (e) => {
      if(e.button !== 0 || e.target.closest('.resize-handle')) return;
      if (tool === "pan" || tool === "highlight" || tool === "area") return;
      setTool("select");
      e.preventDefault();
      e.stopPropagation();
      selected = it.id; overlay.tabIndex=0; overlay.focus({preventScroll:true});
      const x = e.clientX,
        y = e.clientY,
        ox = it.x,
        oy = it.y;
      el.setPointerCapture(e.pointerId);
      el.classList.add("selected");
      el.onpointermove = (m) => {
        it.x = Math.max(
          0,
          Math.min(viewport.width / scale - it.w, ox + (m.clientX - x) / scale),
        );
        it.y = Math.max(
          0,
          Math.min(
            viewport.height / scale - it.h,
            oy + (m.clientY - y) / scale,
          ),
        );
        el.style.left = it.x * scale + "px";
        el.style.top = it.y * scale + "px";
        dirty = true;
      };
      el.onpointerup = () => {
        el.onpointermove = null;
        draw();
      };
      el.onpointercancel = () => { el.onpointermove = null; draw(); };
    };
    el.oncontextmenu = e => {
      e.preventDefault(); e.stopPropagation(); selected = it.id; setTool('select'); draw();
      const menu = $('itemMenu'); menu.hidden = false;
      menu.style.left = Math.min(e.clientX, window.innerWidth - 285) + 'px';
      menu.style.top = Math.min(e.clientY, window.innerHeight - 145) + 'px';
    };
    if(selected === it.id && ['signature','highlight'].includes(it.kind)) {
      for(const corner of ['nw','ne','sw','se']) {
        const handle = document.createElement('button'); handle.className = 'resize-handle '+corner; handle.title='Tirer pour redimensionner'; handle.setAttribute('aria-label','Redimensionner '+corner);
        handle.onpointerdown = e => {
          if(e.button !== 0)return; e.preventDefault(); e.stopPropagation(); setTool('select');
          const startX=e.clientX,startY=e.clientY,original={x:it.x,y:it.y,w:it.w,h:it.h};
          handle.setPointerCapture(e.pointerId);
          handle.onpointermove = m => {
            const dx=(m.clientX-startX)/scale,dy=(m.clientY-startY)/scale;
            let w=Math.max(20,original.w+(corner.includes('e')?dx:-dx)),h=Math.max(12,original.h+(corner.includes('s')?dy:-dy));
            if(it.kind==='signature') {const factor=Math.abs(dx/original.w)>=Math.abs(dy/original.h)?w/original.w:h/original.h; w=original.w*factor; h=original.h*factor;}
            const anchorX=corner.includes('w')?original.x+original.w:original.x,anchorY=corner.includes('n')?original.y+original.h:original.y;
            const maxW=corner.includes('w')?anchorX:viewport.width/scale-anchorX,maxH=corner.includes('n')?anchorY:viewport.height/scale-anchorY;
            const fit=Math.min(1,maxW/w,maxH/h); w*=fit;h*=fit;
            it.w=w;it.h=h;it.x=corner.includes('w')?anchorX-w:anchorX;it.y=corner.includes('n')?anchorY-h:anchorY;
            el.style.left=it.x*scale+'px';el.style.top=it.y*scale+'px';el.style.width=w*scale+'px';el.style.height=h*scale+'px';dirty=true;
          };
          handle.onpointerup=handle.onpointercancel=()=>{handle.onpointermove=null;draw();};
        };
        el.append(handle);
      }
    }
    overlay.append(el);
  }
  for (const result of searchResults.filter((r) => r.page === page)) {
    for (const box of result.boxes) {
      const el = document.createElement("div");
      el.className = "searchhit";
      el.style.cssText = `left:${box.x * scale}px;top:${box.y * scale}px;width:${box.w * scale}px;height:${box.h * scale}px;`;
      overlay.append(el);
    }
  }
}
overlay.onpointerdown = guard(async (e) => {
  if (!doc || e.target !== overlay) return;
  const r = overlay.getBoundingClientRect(),
    x = (e.clientX - r.left) / scale,
    y = (e.clientY - r.top) / scale;
  if (tool === "select") {
    selected = null;
    draw();
    return;
  }
  if (tool === "area") {
    const start = { x, y };
    const preview = document.createElement("div");
    preview.className = "area-preview";
    overlay.append(preview);
    overlay.setPointerCapture(e.pointerId);
    overlay.onpointermove = (m) => {
      const px = (m.clientX - r.left) / scale,
        py = (m.clientY - r.top) / scale;
      preview.style.cssText = `left:${Math.min(x, px) * scale}px;top:${Math.min(y, py) * scale}px;width:${Math.abs(px - x) * scale}px;height:${Math.abs(py - y) * scale}px;`;
    };
    overlay.onpointerup = (m) => {
      overlay.onpointermove = null;
      overlay.onpointerup = null;
      const ex = Math.max(
          0,
          Math.min(viewport.width / scale, (m.clientX - r.left) / scale),
        ),
        ey = Math.max(
          0,
          Math.min(viewport.height / scale, (m.clientY - r.top) / scale),
        );
      preview.remove();
      if (Math.abs(ex - start.x) > 2 && Math.abs(ey - start.y) > 2)
        add({
          kind: "highlight",
          x: Math.min(x, ex),
          y: Math.min(y, ey),
          w: Math.abs(ex - x),
          h: Math.abs(ey - y),
          color: $("color").value,
        });
    };
    return;
  }
  if (tool === "signature") {
    if (!signature) return;
    const img = new Image();
    img.src = signature;
    await img.decode();
    const w = Number($("sigwidth").value);
    add({
      kind: "signature",
      x,
      y,
      w,
      h: (w * img.height) / img.width,
      data: signature,
    });
  } else {
    const text =
      tool === "date"
        ? new Date().toLocaleDateString("fr-FR")
        : tool === "check"
          ? "X"
          : $("text").value;
    if (!text.trim()) return;
    const size = Math.max(8, Math.min(72, Number($("font").value) || 14));
    const c = document.createElement("canvas").getContext("2d");
    c.font = `${size}px Arial`;
    add({
      kind: "text",
      x,
      y,
      w: Math.max(...text.split("\n").map((t) => c.measureText(t).width)),
      h: size * text.split("\n").length * 1.2,
      size,
      text,
    });
  }
});
textLayer.onpointerup = () => {
  if (tool !== "highlight") return;
  const selection = window.getSelection();
  if (!selection.rangeCount || selection.isCollapsed) return;
  const range = selection.getRangeAt(0);
  if (!textLayer.contains(range.commonAncestorContainer)) return;
  const base = textLayer.getBoundingClientRect();
  for (const rect of range.getClientRects()) {
    if (rect.width < 1 || rect.height < 1) continue;
    add({
      kind: "highlight",
      x: (rect.left - base.left) / scale,
      y: (rect.top - base.top) / scale,
      w: rect.width / scale,
      h: rect.height / scale,
      color: $("color").value,
    });
  }
  selection.removeAllRanges();
  status("Texte surligné.");
};
$("prev").onclick = guard(async () => {
  if (page > 1) {
    page--;
    await render();
  }
});
$("next").onclick = guard(async () => {
  if (doc && page < doc.numPages) {
    page++;
    await render();
  }
});
$("plus").onclick = guard(async () => {
  scale = Math.min(2.5, scale + 0.25);
  await render();
});
$("minus").onclick = guard(async () => {
  scale = Math.max(0.5, scale - 0.25);
  await render();
});
$("remove").onclick = () => {
  if (selected) {
    items = items.filter((i) => i.id !== selected);
    selected = null;
    dirty = true;
    draw();
    status("Élément supprimé.");
  }
};
$("undo").onclick = () => {
  if (items.length) {
    items.pop();
    dirty = true;
    draw();
  }
};
async function search() {
  if (!doc) return;
  const q = $("query").value.trim().toLocaleLowerCase("fr");
  searchResults = [];
  searchIndex = -1;
  if (!q) {
    $("results").textContent = "";
    draw();
    return;
  }
  status("Recherche dans le document…");
  for (let n = 1; n <= doc.numPages; n++) {
    const p = await doc.getPage(n),
      v = p.getViewport({ scale: 1 }),
      content = await p.getTextContent();
    let joined = "",
      runs = [];
    for (const it of content.items) {
      const start = joined.length;
      joined += it.str + " ";
      runs.push({ it, start, end: joined.length - 1 });
    }
    let pos = 0;
    const lower = joined.toLocaleLowerCase("fr");
    while ((pos = lower.indexOf(q, pos)) !== -1) {
      const boxes = runs
        .filter((r) => r.end > pos && r.start < pos + q.length)
        .map(({ it }) => {
          const t = pdfjs.Util.transform(v.transform, it.transform),
            h = Math.hypot(t[2], t[3]);
          return { x: t[4], y: t[5] - h, w: it.width, h };
        });
      searchResults.push({ page: n, boxes });
      pos += q.length;
    }
  }
  if (searchResults.length) {
    searchIndex = 0;
    await goResult(0);
  } else {
    $("results").textContent = "Aucun résultat";
    draw();
    status(
      "Aucun résultat. Un document scanné nécessite une reconnaissance de texte (OCR).",
    );
  }
}
async function goResult(delta) {
  if (!searchResults.length) return;
  searchIndex =
    (searchIndex + delta + searchResults.length) % searchResults.length;
  page = searchResults[searchIndex].page;
  await render();
  $("results").textContent = `${searchIndex + 1} / ${searchResults.length}`;
  const b = searchResults[searchIndex].boxes[0];
  if (b) $("scroll").scrollTop = Math.max(0, b.y * scale - 120);
  status("Résultat repéré en orange sur la page.");
}
$("search").onclick = guard(search);
$("query").onkeydown = (e) => {
  if (e.key === "Enter") guard(search)();
};
$("searchprev").onclick = guard(() => goResult(-1));
$("searchnext").onclick = guard(() => goResult(1));
async function buildPdf() {
  if (!source) return;
  status("Préparation de votre copie…");
  const output = await PDFLib.PDFDocument.load(source),
    font = await output.embedFont(PDFLib.StandardFonts.Helvetica);
  for (const it of items) {
    const p = output.getPage(it.page - 1);
    const vp = (await doc.getPage(it.page)).getViewport({ scale: 1 });
    const point = (x, y) => vp.convertToPdfPoint(x, y);
    const a = point(it.x, it.y + it.h),
      b = point(it.x + it.w, it.y + it.h);
    const rotation = PDFLib.degrees(p.getRotation().angle);
    if (it.kind === "signature") {
      const img = await output.embedPng(it.data);
      p.drawImage(img, {
        x: a[0],
        y: a[1],
        width: it.w,
        height: it.h,
        rotate: rotation,
      });
    } else if (it.kind === "highlight") {
      const h = it.color.replace("#", "");
      p.drawRectangle({
        x: a[0],
        y: a[1],
        width: it.w,
        height: it.h,
        rotate: rotation,
        color: PDFLib.rgb(
          parseInt(h.slice(0, 2), 16) / 255,
          parseInt(h.slice(2, 4), 16) / 255,
          parseInt(h.slice(4, 6), 16) / 255,
        ),
        opacity: 0.35,
        blendMode: PDFLib.BlendMode.Multiply,
      });
    } else {
      const t = point(it.x, it.y + it.size * 0.85);
      try {
        p.drawText(it.text, {
          x: t[0],
          y: t[1],
          size: it.size,
          font,
          rotate: rotation,
          lineHeight: it.size * 1.2,
          color: PDFLib.rgb(0.08, 0.14, 0.2),
        });
      } catch {
        throw Error(
          "Un caractère du texte n’est pas pris en charge. Utilisez les caractères latins usuels.",
        );
      }
    }
  }
  return output;
}
$("save").onclick = guard(async () => {
  if(!source)return;
  const output=await buildPdf();
  const ok = await window.desktop.save({
    name: name.replace(/\.pdf$/i, "") + " - modifie.pdf",
    bytes: await output.save(),
  });
  if (ok) {
    dirty = false;
    status("Copie enregistrée avec succès.");
  } else status("Enregistrement annulé.");
});
const pad = $("signpad"),
  ctx = pad.getContext("2d");
let drawing = false,
  hasInk = false;
ctx.lineWidth = 3;
ctx.lineCap = "round";
ctx.lineJoin = "round";
ctx.strokeStyle = "#17283c";
pad.onpointerdown = (e) => {
  drawing = true;
  hasInk = true;
  pad.setPointerCapture(e.pointerId);
  const r = pad.getBoundingClientRect();
  ctx.beginPath();
  ctx.moveTo(
    ((e.clientX - r.left) * pad.width) / r.width,
    ((e.clientY - r.top) * pad.height) / r.height,
  );
};
pad.onpointermove = (e) => {
  if (!drawing) return;
  const r = pad.getBoundingClientRect();
  ctx.lineTo(
    ((e.clientX - r.left) * pad.width) / r.width,
    ((e.clientY - r.top) * pad.height) / r.height,
  );
  ctx.stroke();
};
pad.onpointerup = pad.onpointercancel = () => (drawing = false);
$("configure").onclick = () => $("signatureDialog").showModal();
$("cancel").onclick = () => $("signatureDialog").close();
$("clear").onclick = () => {
  ctx.clearRect(0, 0, pad.width, pad.height);
  hasInk = false;
};
$("import").onchange = guard(async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 10000000)
    throw Error("Choisissez une image de moins de 10 Mo.");
  const url = URL.createObjectURL(file),
    img = new Image();
  img.src = url;
  await img.decode();
  ctx.clearRect(0, 0, pad.width, pad.height);
  const s = Math.min(pad.width / img.width, pad.height / img.height);
  ctx.drawImage(
    img,
    (pad.width - img.width * s) / 2,
    (pad.height - img.height * s) / 2,
    img.width * s,
    img.height * s,
  );
  URL.revokeObjectURL(url);
  const pixels = ctx.getImageData(0, 0, pad.width, pad.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const brightness = Math.min(
      pixels.data[i],
      pixels.data[i + 1],
      pixels.data[i + 2],
    );
    if (brightness > 220) pixels.data[i + 3] = 0;
  }
  ctx.putImageData(pixels, 0, 0);
  hasInk = true;
});
function preview() {
  if (signature) {
    $("sigpreview").src = signature;
    $("sigpreview").hidden = false;
  } else $("sigpreview").hidden = true;
}
$("confirm").onclick = guard(async () => {
  if (!hasInk) {
    status("Dessinez ou importez votre signature avant de valider.");
    return;
  }
  const data = ctx.getImageData(0, 0, pad.width, pad.height).data;
  let l = pad.width,
    t = pad.height,
    r = 0,
    b = 0,
    count = 0;
  for (let y = 0; y < pad.height; y++)
    for (let x = 0; x < pad.width; x++) {
      if (data[(y * pad.width + x) * 4 + 3] > 30) {
        l = Math.min(l, x);
        r = Math.max(r, x);
        t = Math.min(t, y);
        b = Math.max(b, y);
        count++;
      }
    }
  if (count < 50 || r - l < 15 || b - t < 5) {
    status("La signature est trop petite ou vide. Recommencez.");
    return;
  }
  const crop = document.createElement("canvas");
  crop.width = r - l + 9;
  crop.height = b - t + 9;
  crop
    .getContext("2d")
    .drawImage(pad, l, t, r - l + 1, b - t + 1, 4, 4, r - l + 1, b - t + 1);
  const next = crop.toDataURL("image/png");
  await window.desktop.saveSignature(next);
  signature = next;
  preview();
  $("signatureDialog").close();
  setTool("signature");
  status("Signature enregistrée. Cliquez dans le PDF pour la poser.");
});
$("forget").onclick = guard(async () => {
  if (confirm("Effacer la signature enregistrée de cet ordinateur ?")) {
    await window.desktop.saveSignature(null);
    signature = null;
    preview();
    status("Signature enregistrée effacée.");
  }
});
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
document.addEventListener("keydown", (e) => {
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='p'){e.preventDefault();if(doc&&!$('signatureDialog').open)$('print').click();}
  const editing = e.target.closest('input,textarea,select,[contenteditable="true"]');
  if(!editing&&!document.querySelector('dialog[open]')&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&selected){const item=items.find(i=>i.id===selected&&i.page===page);if(item&&arrowMove(item,e.key,e.shiftKey,viewport.width/scale,viewport.height/scale)){e.preventDefault();dirty=true;draw();status('Élément déplacé. Flèches : réglage fin · Maj + flèches : déplacement rapide.');return;}}
  if(e.key==='Escape') { $('itemMenu').hidden=true; setTool('select'); }
  if(e.key==='Delete' && !editing && !$('signatureDialog').open && selected) {e.preventDefault(); $('remove').click();}
  if (e.ctrlKey && e.key === "f") {
    e.preventDefault();
    $("query").focus();
  }
  if (e.ctrlKey && e.key === "s") {
    e.preventDefault();
    $("save").click();
  }
  if (e.ctrlKey && e.key === "o") {
    e.preventDefault();
    $("open").click();
  }
});
$('menuDelete').onclick=()=>{$('itemMenu').hidden=true;$('remove').click();};
$('menuResize').onclick=()=>{$('itemMenu').hidden=true;setTool('select');draw();status('Tirez une poignée bleue située dans un coin de votre signature.');};
$('menuDuplicate').onclick=()=>{const item=items.find(i=>i.id===selected);$('itemMenu').hidden=true;if(item){const copy={...item,x:item.x+15,y:item.y+15};delete copy.id;add(copy);}};
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#itemMenu'))$('itemMenu').hidden=true;});
$('sigwidth').oninput=()=>{const item=items.find(i=>i.id===selected&&i.kind==='signature');if(item){const ratio=item.h/item.w;item.w=Number($('sigwidth').value);item.h=item.w*ratio;dirty=true;draw();}};
pad.addEventListener('pointerdown',()=>{$('padHint').hidden=true;});
$('import').addEventListener('change',()=>{$('padHint').hidden=true;});
$('clear').addEventListener('click',()=>{$('padHint').hidden=false;});
const scroll = $("scroll");
scroll.addEventListener(
  "pointerdown",
  (e) => {
    if (tool !== "pan") return;
    e.preventDefault();
    const x = e.clientX,
      y = e.clientY,
      l = scroll.scrollLeft,
      t = scroll.scrollTop;
    scroll.setPointerCapture(e.pointerId);
    scroll.onpointermove = (m) => {
      scroll.scrollLeft = l - (m.clientX - x);
      scroll.scrollTop = t - (m.clientY - y);
    };
    scroll.onpointerup = () => {
      scroll.onpointermove = null;
    };
  },
  true,
);
window.desktop.onPdfRequested(
  guard(async () => {
    const f = await window.desktop.pending();
    if (f) await open(f);
  }),
);
guard(async () => {
  signature = await window.desktop.loadSignature();
  preview();
  const f = await window.desktop.pending();
  if (f) await open(f);
  if (!signature) $("signatureDialog").showModal();
  else if (!f && localStorage.getItem("skipwelcome") !== "yes")
    status("Votre signature est prête. Importez un PDF pour commencer.");
  if (signature && localStorage.getItem("skipwelcome") === "yes") {
    welcome.classList.add("quick");
  }
})();

initPrint({pdfjs,getDocument:()=>doc,getPage:()=>page,buildPdf,status,guard});
const updateButton=$('updates');
let updateInfo;
async function refreshUpdateInfo(){updateInfo=await window.desktop.updateInfo();$('versionInfo').textContent='Version installée : '+updateInfo.version;$('folderInfo').textContent=updateInfo.folder||'Aucun dossier sélectionné.';}
$('updateSource').value=localStorage.getItem('updateSource')||'github';$('autoUpdate').checked=localStorage.getItem('autoUpdate')==='yes';
function refreshUpdateSource(){const folder=$('updateSource').value==='folder';$('updateFolder').hidden=!folder;$('folderInfo').hidden=!folder;$('updateInstall').disabled=true;localStorage.setItem('updateSource',$('updateSource').value);}
refreshUpdateSource();$('updateSource').onchange=refreshUpdateSource;$('autoUpdate').onchange=()=>localStorage.setItem('autoUpdate',$('autoUpdate').checked?'yes':'no');
updateButton.onclick=guard(async()=>{await refreshUpdateInfo();$('updateDialog').showModal();await checkUpdates();});$('updateClose').onclick=()=>$('updateDialog').close();
$('updateFolder').onclick=guard(async()=>{const folder=await window.desktop.chooseUpdateFolder();if(folder){$('folderInfo').textContent=folder;$('updateInstall').disabled=true;}});
async function checkUpdates(automatic=false){$('updateCheck').disabled=true;$('updateInstall').disabled=true;$('updateStatus').textContent='Recherche en cours…';try{const result=await window.desktop.checkUpdate($('updateSource').value);$('updateStatus').textContent=result.available?'Version '+result.version+' disponible'+(result.size?' ('+Math.round(result.size/1048576)+' Mio)':'')+'.':result.version===result.current?'Vous utilisez la dernière version disponible.':'Aucune version plus récente trouvée.';$('updateInstall').disabled=!result.available;if(automatic&&result.available&&!$('signatureDialog').open){await refreshUpdateInfo();$('updateDialog').showModal();}}catch(e){$('updateStatus').textContent=e.message;}finally{$('updateCheck').disabled=false;}}
$('updateCheck').onclick=()=>checkUpdates();window.desktop.onUpdateProgress(message=>$('updateStatus').textContent=message);
$('updateInstall').onclick=async()=>{if(dirty&&!confirm('Des modifications ne sont pas enregistrées. Fermer pour installer la mise à jour sans les enregistrer ?'))return;const wasDirty=dirty;$('updateInstall').disabled=true;$('updateClose').disabled=true;$('updateCheck').disabled=true;try{dirty=false;await window.desktop.installUpdate();$('updateStatus').textContent='Installation automatique en cours. CremaPDF va se fermer puis redémarrer.';}catch(e){dirty=wasDirty;$('updateStatus').textContent=e.message;$('updateInstall').disabled=false;}finally{$('updateClose').disabled=false;$('updateCheck').disabled=false;}};
if($('autoUpdate').checked)checkUpdates(true);
