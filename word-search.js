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
        const capNum = cap.getElementsByTagName('num_capitulo')[0]?.textContent.trim();
        Array.from(cap.getElementsByTagName('versiculo')).forEach(v => {
          const num  = v.getElementsByTagName('num_versiculo')[0]?.textContent.trim();
          const text = v.getElementsByTagName('texto_versiculo')[0]?.textContent.trim();
          if (capNum && num && text) {
            verses.push({ book: title, cap: capNum, num, text });
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

    matches.forEach(m => {
      const bloc = document.createElement('div');
      bloc.className = 'bloc';
      const tit = document.createElement('div');
      tit.className = 'titol';
      tit.textContent = `${m.book.toUpperCase()} ${m.cap}:${m.num}`;
      bloc.appendChild(tit);
      bloc.appendChild(document.createTextNode(m.text));
      outDiv.appendChild(bloc);
    });
  }
})();
