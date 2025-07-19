(async () => {
    const versionSelect = document.getElementById('versionSelect');
    const loading = document.getElementById('carregant');
  
    // ✅ Ordre fix i manual segons com l'especifiquem aquí
    const xmlFiles = [
      'CatalanBECBible.xml',
      'SpanishLBLABible.xml',
      'GreekTHGNTBible.xml'
    ];
  
    const versionList = [];
  
    loading.style.display = 'block';
  
    for (const file of xmlFiles) {
      try {
        const res = await fetch(`./data/${file}`);
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, 'text/xml');
        const bibleTag = doc.querySelector('bible');
  
        const name =
          bibleTag?.getAttribute('translation')?.trim() ||
          bibleTag?.getAttribute('language')?.trim() ||
          file;
  
        versionList.push({ name, file });
      } catch (err) {
        console.error(`Error carregant ${file}:`, err);
      }
    }
  
    // 📝 Omplir el selector en el mateix ordre
    versionList.forEach(({ name, file }) => {
      const opt = document.createElement('option');
      opt.value = file;
      opt.textContent = name;
      versionSelect.appendChild(opt);
    });
  
    // ✅ Versió per defecte: la primera de xmlFiles
    const saved = localStorage.getItem('selectedBible');
    const validSaved = versionList.find(v => v.file === saved);
    const defaultFile = versionList[0]?.file;
  
    versionSelect.value = validSaved ? saved : defaultFile;
    if (!validSaved && defaultFile) {
      localStorage.setItem('selectedBible', defaultFile);
    }
  
    // 👉 Ruta seleccionada accessible globalment
    window.selectedBiblePath = `./data/${versionSelect.value}`;
  
    // 🔄 Quan l'usuari canviï la versió
    versionSelect.addEventListener('change', () => {
      const selected = versionSelect.value;
      localStorage.setItem('selectedBible', selected);
      window.selectedBiblePath = `./data/${selected}`;
      location.reload(); // 🌀 Recarrega per aplicar canvi
    });
  
    loading.style.display = 'none';
  })();
  