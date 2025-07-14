/* eslint-disable no-console */
(async () => {
  const inputEl = document.getElementById("input");
  const btn = document.getElementById("cerca");
  const loading = document.getElementById("carregant");
  const outDiv = document.getElementById("resultats");
  const copyAllBtn = document.getElementById("copiarTots");

  function showToast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.style.display = "block";
    requestAnimationFrame(() => {
      t.style.opacity = "1";
    });
    setTimeout(() => {
      t.style.opacity = "0";
      setTimeout(() => {
        t.style.display = "none";
      }, 300);
    }, 1000);
  }

  // ────────────────────────────────────────
  // Utilitats
  const normalize = (str) =>
    (str || "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  // Sinònims manuals (provenen del bloc JSON editable)
  let customAliases = {};
  try {
    customAliases = JSON.parse(
      document.getElementById("dicctionaryData").textContent
    );
  } catch (e) {
    console.warn("Alias JSON malformat");
  }

  // ────────────────────────────────────────
  // Carregar JSON (substitueix l'antic XML)
  loading.style.display = "block";
  let books; // matriu de llibres
  try {
    const res = await fetch("bec.json");
    books = await res.json();
  } catch (e) {
    loading.textContent = "No s’ha pogut carregar l’arxiu JSON";
    throw e;
  }

  // Indexar
  const index = {}; // { bookKey: { capNum: [versObjects] } }
  const aliasMap = {}; // variant normalitzada => bookKey

  books.forEach((book) => {
    const canon = (book.name || "").trim();
    if (!canon) return;
    const bookKey = normalize(canon);
    index[bookKey] = {};
    aliasMap[bookKey] = bookKey;

    // Capítols
    (book.chapters || []).forEach((chap) => {
      const capNum = parseInt(chap.chapterNo, 10);
      if (!index[bookKey][capNum]) index[bookKey][capNum] = [];
      index[bookKey][capNum].push(...(chap.verses || []));
    });

    // Aliases automàtics 1a/2a/3a (ex. "1a Corintis")
    const m = canon.match(/^([1-3])a?\s+(.+)$/i);
    if (m) {
      const num = m[1];
      const rest = normalize(m[2]);
      [
        `${num} ${rest}`,
        `${num}${rest}`,
        `${["primer", "segon", "tercer"][num - 1]} ${rest}`,
      ].forEach((a) => (aliasMap[normalize(a)] = bookKey));
      if (!aliasMap[rest]) aliasMap[rest] = bookKey;
    }
  });

  // Aliases definits per l’usuari
  Object.entries(customAliases).forEach(([k, v]) => {
    aliasMap[normalize(k)] = normalize(v);
  });

  loading.style.display = "none";

  // ────────────────────────────────────────
  // Cerca
  btn.addEventListener("click", process);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) process();
  });

  function process() {
    outDiv.innerHTML = "";
    copyAllBtn.style.display = "none";
    const raw = inputEl.value.trim();
    if (!raw) return;

    // 1️⃣ Separem per línies, netejant bullets i puntuació final
    const lines = raw
      .split(/\n+/)
      .map((l) =>
        l
          .replace(/^\s*[-•*] ?/, "") // guió o bullet
          .replace(/[.,;·]+$/, "") // puntuació final
          .trim()
      )
      .filter(Boolean);

    // 2️⃣ A cada línia, separem per ", " (coma + espais)
    const refs = [];
    lines.forEach((line) => {
      line.split(/,\s+/).forEach((r) => {
        const t = r.trim();
        if (t) refs.push(t);
      });
    });

    const errors = [];

    refs.forEach((ref) => {
      const m = ref.match(
        /^(.+?)\s+(\d+):(\d+(?:[-–]\d+)?(?:,\d+(?:[-–]\d+)?)*)$/
      );
      if (!m) {
        errors.push(`Format invàlid: ${ref}`);
        return;
      }
      let [, bookRaw, capStr, versSpec] = m;
      const bookKey = aliasMap[normalize(bookRaw)];
      if (!bookKey) {
        errors.push(`Llibre no trobat: ${bookRaw}`);
        return;
      }
      const cap = parseInt(capStr, 10);
      const capData = index[bookKey][cap];
      if (!capData) {
        errors.push(`Capítol no trobat: ${bookRaw} ${cap}`);
        return;
      }

      // Expandeix versSpec (ex. 3-5,7)
      const targets = [];
      versSpec.split(",").forEach((chunk) => {
        if (/[-–]/.test(chunk)) {
          const [s, e] = chunk.split(/[-–]/).map((v) => parseInt(v, 10));
          for (let v = s; v <= e; v++) targets.push(v);
        } else {
          targets.push(parseInt(chunk, 10));
        }
      });

      // Selecciona versos
      const verses = capData.filter((v) => targets.includes(parseInt(v.verseNo, 10)));
      if (!verses.length) {
        errors.push(`Versos no trobats: ${ref}`);
        return;
      }

      // Bloc / renderització
      const bloc = document.createElement("div");
      bloc.className = "bloc";
      const tit = document.createElement("div");
      tit.className = "titol";
      const reference = `${bookRaw.toUpperCase()} ${cap}:${versSpec}`;
      tit.textContent = reference;
      bloc.appendChild(tit);
      const text = verses
        .map((v) => (v.text || "").trim())
        .join(" ");
      const txtDiv = document.createElement("div");
      txtDiv.className = "verset";
      txtDiv.textContent = text;
      txtDiv.dataset.clip = `${reference}\n${text}`;
      bloc.appendChild(txtDiv);
      const copyBtn = document.createElement("button");
      copyBtn.textContent = "Copiar";
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(txtDiv.dataset.clip);
        showToast("Copiat");
      });
      bloc.appendChild(copyBtn);
      outDiv.appendChild(bloc);
    });

    // Errors
    errors.forEach((er) => {
      const d = document.createElement("div");
      d.className = "error";
      d.textContent = er;
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
})();
