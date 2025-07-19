/* eslint-disable no-console */
(async () => {
  // ────────────────────────────
  // Elements UI
  const modeSel    = document.getElementById('searchMode');
  const refCont    = document.getElementById('refContainer');
  const wordCont   = document.getElementById('wordContainer');
  const helpRefs   = document.getElementById('helpRefs');
  const helpWords  = document.getElementById('helpWords');
  const wordInput  = document.getElementById('paraulaInput');
  const exactChk   = document.getElementById('exactCheck');
  const btnWords   = document.getElementById('cercaParaula');
  const btnRefs    = document.getElementById('cerca');
  const clearBtn   = document.getElementById('netejar');
  const loading    = document.getElementById('carregant');
  const outDiv     = document.getElementById('resultats');
  const copyAllBtn = document.getElementById('copiarTots');

  // ────────────────────────────
  // Toast helper
  function showToast (msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.style.display = 'block';
    requestAnimationFrame(() => { t.style.opacity = '1'; });
    setTimeout(() => {
      t.style.opacity = '0';
      setTimeout(() => { t.style.display = 'none'; }, 300);
    }, 1000);
  }

  // ────────────────────────────
  // Mostrar/ocultar blocs segons el mode
  function updateUI () {
    const wordsMode = modeSel.value === 'words';

    refCont .style.display = wordsMode ? 'none'  : 'block';
    wordCont.style.display = wordsMode ? 'block' : 'none';

    helpRefs  && (helpRefs .style.display = wordsMode ? 'none'  : 'block');
    helpWords && (helpWords.style.display = wordsMode ? 'block' : 'none');

    btnRefs  && (btnRefs .style.display = wordsMode ? 'none'        : 'inline-block');
    btnWords && (btnWords.style.display = wordsMode ? 'inline-block': 'none');
  }
  modeSel.addEventListener('change', updateUI);
  updateUI();

  // ────────────────────────────
  // Utils
  const normalize = str => (str || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // ────────────────────────────
  // Carregar XML
  loading.style.display = 'block';
  const verses = [];

  try {
    const fallbackNames = JSON.parse(
      document.getElementById('bookNames').textContent
    );

    const xmlText = await (await fetch('./data/CatalanBECBible.xml')).text();
    const xml     = new DOMParser().parseFromString(xmlText, 'text/xml');

    let bookCounter = 0;
    xml.querySelectorAll('book').forEach(bookEl => {
      let bookName =
        bookEl.getAttribute('name')     ||
        bookEl.getAttribute('title')    ||
        bookEl.getAttribute('fullname') ||
        bookEl.getAttribute('id')       ||
        bookEl.getAttribute('code');

      if (!bookName) {
        bookName = fallbackNames[bookCounter] || `Llibre ${bookCounter + 1}`;
      }
      bookCounter++;

      bookEl.querySelectorAll('chapter').forEach(cEl => {
        const capNum = +cEl.getAttribute('number');
        cEl.querySelectorAll('verse').forEach(vEl => {
          const vNum = +vEl.getAttribute('number');
          const txt  = vEl.textContent.trim();
          verses.push({ book: bookName, cap: capNum, start: vNum, end: vNum, text: txt });
        });
      });
    });

  } catch (err) {
    loading.textContent = 'No s\'ha pogut carregar l\'arxiu XML';
    throw err;
  }
  loading.style.display = 'none';

  // ────────────────────────────
  // Esdeveniments
  btnWords.addEventListener('click', searchWords);
  wordInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) searchWords();
  });

  clearBtn.addEventListener('click', () => {
    // ➜ Línia arreglada (no es pot assignar amb ?.)
    const refInput = document.getElementById('input');
    if (refInput) refInput.value = '';

    wordInput.value = '';
    exactChk.checked = false;
    outDiv.innerHTML = '';
    copyAllBtn.style.display = 'none';
    wordInput.focus();
  });

  // ────────────────────────────
  // Cerca de paraules
  function searchWords () {
    outDiv.innerHTML = '';
    copyAllBtn.style.display = 'none';

    const raw = wordInput.value.trim();
    if (!raw) return;

    const terms = raw.split(/\s+/).map(normalize).filter(Boolean);

    const hits = verses.filter(v => {
      const txtNorm = normalize(v.text);
      return terms.some(t =>
        exactChk.checked ? txtNorm.split(' ').includes(t) : txtNorm.includes(t)
      );
    });

    if (!hits.length) {
      const d = document.createElement('div');
      d.className = 'error';
      d.textContent = 'No s\'han trobat versets';
      outDiv.appendChild(d);
      return;
    }

    // Agrupar consecutius
    const groups = [];
    let cur = null;
    hits.forEach(v => {
      if (
        cur && cur.book === v.book && cur.cap === v.cap &&
        v.start <= cur.end + 1
      ) {
        cur.end = v.end;
        cur.texts.push(v.text);
      } else {
        if (cur) groups.push(cur);
        cur = { book: v.book, cap: v.cap, start: v.start, end: v.end, texts: [v.text] };
      }
    });
    if (cur) groups.push(cur);

    // Mostrar resultats
    groups.forEach(g => {
      const bloc = document.createElement('div');
      bloc.className = 'bloc';

      const ref = `${g.book.toUpperCase()} ${g.cap}:${g.start === g.end ? g.start : `${g.start}-${g.end}`}`;
      const tit = Object.assign(document.createElement('div'), { className: 'titol', textContent: ref });
      bloc.appendChild(tit);

      const txt = g.texts.join(' ');
      const txtDiv = Object.assign(document.createElement('div'), { className:'verset', textContent: txt });
      txtDiv.dataset.clip = `${ref}\n${txt}`;
      bloc.appendChild(txtDiv);

      const cBtn = document.createElement('button');
      cBtn.textContent = 'Copiar';
      cBtn.onclick = () => {
        navigator.clipboard.writeText(txtDiv.dataset.clip);
        showToast('Copiat');
      };
      bloc.appendChild(cBtn);

      outDiv.appendChild(bloc);
    });

    // Botó “Copiar tots”
    const vs = outDiv.getElementsByClassName('verset');
    if (vs.length) {
      copyAllBtn.style.display = '';
      copyAllBtn.onclick = () => {
        const all = Array.from(vs).map(v => v.dataset.clip).join('\n\n');
        navigator.clipboard.writeText(all);
        showToast('Copiat tot');
      };
    }
  }
})();
