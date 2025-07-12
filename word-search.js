(async () => {
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
  clearBtn.addEventListener('click', () => {
    document.getElementById('input').value = '';
    wordInput.value = '';
    exactChk.checked = false;
    outDiv.innerHTML = '';
    copyAllBtn.style.display = 'none';
  });

  function search() {
    outDiv.innerHTML = '';
    copyAllBtn.style.display = 'none';
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
