/* eslint-disable no-console */
(async () => {
  // ────────────────────────────────────────
  // Elements UI
  const modeSel    = document.getElementById('searchMode');
  const refCont    = document.getElementById('refContainer');
  const wordCont   = document.getElementById('wordContainer');
  const helpRefs   = document.getElementById('helpRefs');
  const helpWords  = document.getElementById('helpWords');
  const wordInput  = document.getElementById('paraulaInput');
  const exactChk   = document.getElementById('exactCheck');
  const btn        = document.getElementById('cercaParaula');
  const refBtn     = document.getElementById('cerca');
  const clearBtn   = document.getElementById('netejar');
  const loading    = document.getElementById('carregant');
  const outDiv     = document.getElementById('resultats');
  const copyAllBtn = document.getElementById('copiarTots');

  // ────────────────────────────────────────
  // Toast helper
  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.style.display = 'block';
    requestAnimationFrame(() => {
      t.style.opacity = '1';
    });
    setTimeout(() => {
      t.style.opacity = '0';
      setTimeout(() => { t.style.display = 'none'; }, 300);
    }, 1000);
  }

  // ────────────────────────────────────────
  // Mode selector (referències / paraules)
  function updateUI() {
    if (modeSel.value === 'words') {
      refCont.style.display  = 'none';
      wordCont.style.display = '';
      if (helpWords) helpWords.style.display = '';
      if (helpRefs)  helpRefs.style.display  = 'none';
      if (refBtn) refBtn.style.display = 'none';
      if (btn)    btn.style.display    = 'inline-block';
    } else {
      wordCont.style.display = 'none';
      refCont.style.display  = '';
      if (helpWords) helpWords.style.display = 'none';
      if (helpRefs)  helpRefs.style.display  = '';
      if (refBtn) refBtn.style.display = '';
      if (btn)    btn.style.display    = 'none';
    }
  }
  modeSel.addEventListener('change', updateUI);
  updateUI();

  // ────────────────────────────────────────
  // Utils
  const normalize = str => (str || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // ────────────────────────────────────────
  // Carregar JSON (substitueix l'antic XML)
  loading.style.display = 'block';
  const verses = []; // [{ book, cap, start, end, text }]
  try {
    const res  = await fetch('bec.json');
    const data = await res.json(); // array de llibres

    data.forEach(book => {
      const title = (book.name || '').trim();
      if (!title) return;

      (book.chapters || []).forEach(chap => {
        const capNum = parseInt(chap.chapterNo, 10);
        if (Number.isNaN(capNum)) return;

        (chap.verses || []).forEach(v => {
          const num = parseInt(v.verseNo, 10);
          const rawText = (v.text || '').trim();
          if (!Number.isNaN(num) && rawText) {
            // En el JSON cada vers és autònom ⇒ start === end
            verses.push({ book: title, cap: capNum, start: num, end: num, text: rawText });
          }
        });
      });
    });
  } catch (e) {
    loading.textContent = 'No s\'ha pogut carregar l\'arxiu JSON';
    throw e;
  }
  loading.style.display = 'none';

  // ────────────────────────────────────────
  // Esdeveniments UI
  btn.addEventListener('click', search);
  wordInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) search();
  });
  clearBtn.addEventListener('click', () => {
    document.getElementById('input').value = '';
    wordInput.value = '';
    exactChk.checked = false;
    outDiv.innerHTML = '';
    copyAllBtn.style.display = 'none';
  });

  // ────────────────────────────────────────
  // Cerca de paraules
  function search() {
    outDiv.innerHTML = '';
    copyAllBtn.style.display = 'none';
    const raw = wordInput.value.trim();
    if (!raw) return;

    const words = raw.split(/\s+/).map(w => normalize(w)).filter(Boolean);

    // 1️⃣ Filtra versets que contenen almenys una de les paraules
    const matches = verses.filter(v => {
      const textNorm = normalize(v.text);
      return words.some(w => {
        if (exactChk.checked) {
          const tokens = textNorm.split(' ');
          return tokens.includes(w);
        }
        return textNorm.includes(w);
      });
    });

    if (!matches.length) {
      const d = document.createElement('div');
      d.className = 'error';
      d.textContent = 'No s\'han trobat versets';
      outDiv.appendChild(d);
      return;
    }

    // 2️⃣ Agrupa versets consecutius del mateix llibre i capítol
    const groups = [];
    let cur = null;
    matches.forEach(v => {
      if (cur && cur.book === v.book && cur.cap === v.cap && v.start <= cur.end + 1) {
        cur.end = Math.max(cur.end, v.end);
        cur.texts.push(v.text);
      } else {
        if (cur) groups.push(cur);
        cur = { book: v.book, cap: v.cap, start: v.start, end: v.end, texts: [v.text] };
      }
    });
    if (cur) groups.push(cur);

    // 3️⃣ Renderitza resultats
    groups.forEach(g => {
      const bloc = document.createElement('div');
      bloc.className = 'bloc';

      const tit = document.createElement('div');
      tit.className = 'titol';
      const range = g.start === g.end ? g.start : `${g.start}-${g.end}`;
      const reference = `${g.book.toUpperCase()} ${g.cap}:${range}`;
      tit.textContent = reference;
      bloc.appendChild(tit);

      const text = g.texts.join(' ');
      const txtDiv = document.createElement('div');
      txtDiv.className = 'verset';
      txtDiv.textContent = text;
      txtDiv.dataset.clip = `${reference}\n${text}`;
      bloc.appendChild(txtDiv);

      const copyBtn = document.createElement('button');
      copyBtn.textContent = 'Copiar';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(txtDiv.dataset.clip);
        showToast('Copiat');
      });
      bloc.appendChild(copyBtn);

      outDiv.appendChild(bloc);
    });

    // 4️⃣ Botó "Copiar tot"
    const versets = outDiv.getElementsByClassName('verset');
    if (versets.length) {
      copyAllBtn.style.display = '';
      copyAllBtn.onclick = () => {
        const all = Array.from(versets)
          .map(v => v.dataset.clip)
          .join('\n\n');
        navigator.clipboard.writeText(all);
        showToast('Copiat tot');
      };
    }
  }
})();
