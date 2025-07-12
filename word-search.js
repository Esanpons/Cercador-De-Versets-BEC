(async () => {
  const modeSel   = document.getElementById('searchMode');
  const refCont   = document.getElementById('refContainer');
  const wordCont  = document.getElementById('wordContainer');
  const wordInput = document.getElementById('paraulaInput');
  const exactChk  = document.getElementById('exactCheck');
  const btn       = document.getElementById('cercaParaula');
  const loading   = document.getElementById('carregant');
  const outDiv    = document.getElementById('resultats');

  function updateUI() {
    if (modeSel.value === 'words') {
      refCont.style.display  = 'none';
      wordCont.style.display = '';
    } else {
      wordCont.style.display = 'none';
      refCont.style.display  = '';
    }
  }

  modeSel.addEventListener('change', updateUI);
  updateUI();

  const normalize = str => (str || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  loading.style.display = 'block';
  let verses = [];
  try {
    const res = await fetch('ibec.xml');
    const txt = await res.text();
    const xmlDoc = new DOMParser().parseFromString(txt, 'application/xml');
    Array.from(xmlDoc.getElementsByTagName('libro')).forEach(lib => {
      const title = lib.getElementsByTagName('titulo')[0]?.textContent.trim();
      Array.from(lib.getElementsByTagName('capitulo')).forEach(cap => {
        const capNum = parseInt(
          cap.getElementsByTagName('num_capitulo')[0]?.textContent.trim(),
          10
        );
        Array.from(cap.getElementsByTagName('versiculo')).forEach(v => {
          const num = parseInt(
            v.getElementsByTagName('num_versiculo')[0]?.textContent.trim(),
            10
          );
          const rawText = v.getElementsByTagName('texto_versiculo')[0]?.textContent.trim();
          if (!Number.isNaN(capNum) && !Number.isNaN(num) && rawText) {
            const lines = rawText.split(/\r?\n/);
            let start = num;
            let end = num;
            const cleaned = lines.map(l => {
              const m = l.match(/^\s*(\d+)\s+(.*)$/);
              if (m) {
                end = parseInt(m[1], 10);
                return m[2];
              }
              return l;
            }).join(' ');
            verses.push({ book: title, cap: capNum, start, end, text: cleaned });
          }
        });
      });
    });
  } catch (e) {
    loading.textContent = 'No s\'ha pogut carregar l\'arxiu XML';
    throw e;
  }
  loading.style.display = 'none';

  btn.addEventListener('click', search);
  wordInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) search();
  });

  function search() {
    outDiv.innerHTML = '';
    const raw = wordInput.value.trim();
    if (!raw) return;

    const words = raw.split(/\s+/).map(w => normalize(w)).filter(Boolean);

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

    const groups = [];
    let cur = null;
    matches.forEach(v => {
      if (
        cur &&
        cur.book === v.book &&
        cur.cap === v.cap &&
        v.start <= cur.end + 1
      ) {
        cur.end = Math.max(cur.end, v.end);
        cur.texts.push(v.text);
      } else {
        if (cur) groups.push(cur);
        cur = { book: v.book, cap: v.cap, start: v.start, end: v.end, texts: [v.text] };
      }
    });
    if (cur) groups.push(cur);

    groups.forEach(g => {
      const bloc = document.createElement('div');
      bloc.className = 'bloc';
      const tit = document.createElement('div');
      tit.className = 'titol';
      const range = g.start === g.end ? g.start : `${g.start}-${g.end}`;
      tit.textContent = `${g.book.toUpperCase()} ${g.cap}:${range}`;
      bloc.appendChild(tit);
      bloc.appendChild(document.createTextNode(g.texts.join(' ')));
      outDiv.appendChild(bloc);
    });
  }
})();
