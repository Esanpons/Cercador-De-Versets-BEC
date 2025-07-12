(async () => {
  const wordInput = document.getElementById('paraulaInput');
  const btn = document.getElementById('cercaParaula');
  const loading = document.getElementById('carregant');
  const outDiv = document.getElementById('resultats');

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
      const title = lib.getElementsByTagName('titulo')[0].textContent.trim();
      Array.from(lib.getElementsByTagName('capitulo')).forEach(cap => {
        const capNum = cap.getElementsByTagName('num_capitulo')[0].textContent.trim();
        const vers = cap.getElementsByTagName('versiculo')[0];
        if (!vers) return;
        const num = vers.getElementsByTagName('num_versiculo')[0].textContent.trim();
        const text = vers.getElementsByTagName('texto_versiculo')[0].textContent.trim();
        verses.push({book: title, cap: capNum, num, text});
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

    const words = raw.split(/\s+/).filter(Boolean);

    words.forEach(word => {
      const norm = normalize(word);
      const matches = verses.filter(v => normalize(v.text).includes(norm));

      if (matches.length) {
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
      } else {
        const d = document.createElement('div');
        d.className = 'error';
        d.textContent = `No s'han trobat versets per a '${word}'`;
        outDiv.appendChild(d);
      }
    });
  }
})();
