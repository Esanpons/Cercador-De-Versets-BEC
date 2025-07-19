(async () => {
  // ───────────── Elements del DOM ─────────────
  const inputEl    = document.getElementById("input");
  const btnSearch  = document.getElementById("cerca");
  const btnClear   = document.getElementById("netejar");
  const loading    = document.getElementById("carregant");
  const outDiv     = document.getElementById("resultats");
  const copyAllBtn = document.getElementById("copiarTots");

  function showToast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.style.display = "block";
    requestAnimationFrame(() => (t.style.opacity = "1"));
    setTimeout(() => {
      t.style.opacity = "0";
      setTimeout(() => (t.style.display = "none"), 300);
    }, 1000);
  }

  const normalize = (str) =>
    (str || "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  // ───────────── Alias i llista de llibres ─────────────
  let customAliases = {};
  try {
    customAliases = JSON.parse(
      document.getElementById("dicctionaryData").textContent
    );
  } catch {}

  const fallbackNames = JSON.parse(
    document.getElementById("bookNames").textContent
  );

  // ───────────── Carrega i indexa l'XML ─────────────
  loading.style.display = "block";

  const index    = {};
  const aliasMap = {};

  try {
    // 👇  Ruta actualitzada
    const xmlText = await (await fetch("./data/CatalanBECBible.xml")).text();
    const xml     = new DOMParser().parseFromString(xmlText, "text/xml");

    let bookCounter = 0;
    xml.querySelectorAll("book").forEach((bookEl) => {
      let bookName =
        bookEl.getAttribute("name")     ||
        bookEl.getAttribute("title")    ||
        bookEl.getAttribute("fullname") ||
        bookEl.getAttribute("id")       ||
        bookEl.getAttribute("code");

      if (!bookName) {
        bookName = fallbackNames[bookCounter] || `Llibre ${bookCounter + 1}`;
      }
      bookCounter++;

      const bookKey = normalize(bookName);
      index[bookKey]   = {};
      aliasMap[bookKey] = bookKey;

      ["code", "id"].forEach((att) => {
        const v = bookEl.getAttribute(att);
        if (v) aliasMap[normalize(v)] = bookKey;
      });

      const m = bookName.match(/^([1-3])\s+(.+)/);
      if (m) {
        const num = m[1];
        const rest = normalize(m[2]);
        [
          `${num}${rest}`,
          `${num} ${rest}`,
          `${["primer","segon","tercer"][num-1]} ${rest}`,
          rest
        ].forEach((a) => (aliasMap[normalize(a)] = bookKey));
      }

      bookEl.querySelectorAll("chapter").forEach((ch) => {
        const capNum = +ch.getAttribute("number");
        index[bookKey][capNum] = Array.from(ch.querySelectorAll("verse")).map(
          (v) => ({
            verseNo: +v.getAttribute("number"),
            text: v.textContent.trim(),
          })
        );
      });
    });

    Object.entries(customAliases).forEach(([k, v]) => {
      aliasMap[normalize(k)] = normalize(v);
    });

  } finally {
    loading.style.display = "none";
  }

  // ───────────── Funcions d'UI ─────────────
  function clearAll() {
    inputEl.value = "";
    outDiv.innerHTML = "";
    copyAllBtn.style.display = "none";
    inputEl.focus();
  }

  function process() {
    outDiv.innerHTML = "";
    copyAllBtn.style.display = "none";

    const raw = inputEl.value.trim();
    if (!raw) return;

    const refs = raw
      .split(/\n+/)
      .flatMap((line) =>
        line
          .replace(/^\s*[-•*]\s*/, "")
          .replace(/[.,;·]+$/, "")
          .split(/,\s+/)
          .map((r) => r.trim())
          .filter(Boolean)
      );

    const errors = [];

    refs.forEach((ref) => {
      const m = ref.match(
        /^(.+?)\s+(\d+):(\d+(?:[-–]\d+)?(?:,\d+(?:[-–]\d+)?)*)$/
      );
      if (!m) { errors.push(`Format invàlid: ${ref}`); return; }

      const [, bookRaw, capStr, versSpec] = m;
      const bookKey = aliasMap[normalize(bookRaw)];
      if (!bookKey) { errors.push(`Llibre no trobat: ${bookRaw}`); return; }

      const capNum = +capStr;
      const capData = index[bookKey][capNum];
      if (!capData) { errors.push(`Capítol no trobat: ${bookRaw} ${capNum}`); return; }

      const targets = [];
      versSpec.split(",").forEach((c) => {
        if (/[-–]/.test(c)) {
          const [s, e] = c.split(/[-–]/).map(Number);
          for (let v = s; v <= e; v++) targets.push(v);
        } else targets.push(+c);
      });

      const verses = capData.filter((v) => targets.includes(v.verseNo));
      if (!verses.length) { errors.push(`Versos no trobats: ${ref}`); return; }

      const bloc = document.createElement("div");
      bloc.className = "bloc";

      const tit = document.createElement("div");
      tit.className = "titol";
      tit.textContent = `${bookRaw.toUpperCase()} ${capNum}:${versSpec}`;
      bloc.appendChild(tit);

      const txt = verses.map((v) => v.text).join(" ");
      const txtDiv = document.createElement("div");
      txtDiv.className = "verset";
      txtDiv.textContent = txt;
      txtDiv.dataset.clip = `${tit.textContent}\n${txt}`;
      bloc.appendChild(txtDiv);

      const copyBtn = document.createElement("button");
      copyBtn.textContent = "Copiar";
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(txtDiv.dataset.clip);
        showToast("Copiat");
      };
      bloc.appendChild(copyBtn);

      outDiv.appendChild(bloc);
    });

    errors.forEach((e) => {
      const d = document.createElement("div");
      d.className = "error";
      d.textContent = e;
      outDiv.appendChild(d);
    });

    const versets = outDiv.getElementsByClassName("verset");
    if (versets.length) {
      copyAllBtn.style.display = "";
      copyAllBtn.onclick = () => {
        const all = Array.from(versets)
          .map((v) => v.dataset.clip)
          .join("\n\n");
        navigator.clipboard.writeText(all);
        showToast("Copiat tot");
      };
    }
  }

  // ───────────── Esdeveniments ─────────────
  btnSearch.addEventListener("click", process);
  btnClear .addEventListener("click", clearAll);
  inputEl   .addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) process();
  });
})();
