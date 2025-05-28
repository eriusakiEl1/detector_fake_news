document.addEventListener("DOMContentLoaded", () => {
  const validationType = document.getElementById("validationType");
  const urlInput = document.getElementById("urlInput");
  const rssFileInput = document.getElementById("rssFileInput");
  const xmlUrlInput = document.getElementById("xmlUrlInput");
  const xmlUrlContainer = document.getElementById("xmlUrlContainer");
  const validationForm = document.getElementById("validationForm");
  const resultadoDiv = document.getElementById("result");
  const loadingGif = document.getElementById("loadingGif");
  const noticiasListContainer = document.getElementById("noticiasListContainer");
  const submitButton = validationForm.querySelector('button[type="submit"]');

  function updateInputs() {
    const type = validationType.value;

    if (type === "xml") {
      urlInput.style.display = "none";
      urlInput.required = false;

      rssFileInput.style.display = "block";
      rssFileInput.required = false;

      xmlUrlContainer.style.display = "block";
      xmlUrlInput.required = false;

      noticiasListContainer.style.display = "none";
    } else {
      urlInput.style.display = "block";
      urlInput.required = true;

      rssFileInput.style.display = "none";
      rssFileInput.required = false;

      xmlUrlContainer.style.display = "none";
      xmlUrlInput.required = false;

      noticiasListContainer.style.display = "none";

      urlInput.placeholder = type === "news"
        ? "https://ejemplo.com/noticia"
        : "https://ejemplo.com/portal";
    }

    if (submitButton) {
      if (type === "site") {
        submitButton.textContent = "Buscar";
      } else if (type === "xml") {
        submitButton.textContent = "Comprobar";
      } else {
        submitButton.textContent = "Validar";
      }
    }
  }

  validationType.addEventListener("change", updateInputs);
  updateInputs(); // Inicializa al cargar

  validationForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (validationType.value === "xml") {
      const file = rssFileInput.files[0];
      const xmlUrl = xmlUrlInput.value.trim();

      if (!file && xmlUrl === "") {
        alert("Por favor, selecciona un archivo XML o ingresa una URL para validar.");
        return;
      }
      if (file) {
        validarXML(file);
      } else if (xmlUrl) {
        await validarXMLUrl(xmlUrl);
      }
    } else {
      const url = urlInput.value.trim();
      if (!url) {
        alert("Por favor, ingresa una URL válida.");
        return;
      }
      if (validationType.value === "news") {
        await analizarNoticia(url);
      } else if (validationType.value === "site") {
        await validarPortal(url);
      }
    }
  });

  async function analizarNoticia(url) {
    try {
      loadingGif.style.display = "block";
      resultadoDiv.style.display = "none";
      noticiasListContainer.style.display = "none";

      const response = await fetch(`http://127.0.0.1:8000/analizar?url=${encodeURIComponent(url)}`);
      const data = await response.json();

      loadingGif.style.display = "none";
      resultadoDiv.style.display = "block";
      resultadoDiv.className = "result";

      if (data.error) {
        resultadoDiv.textContent = `Error: ${data.error}`;
        resultadoDiv.classList.add("error");
        limpiarNoticiasRelacionadas();
        limpiarEstadisticas();
        limpiarInformacionUtil();
        return;
      }

      const resultado = Array.isArray(data.resultado) ? data.resultado[0] : data.resultado;
      const resumen = Array.isArray(data.resumen) ? data.resumen[0] : data.resumen;

      if (typeof resultado === "string") {
        resultadoDiv.innerHTML = `
          <strong>Resultado:</strong> ${resultado}<br>
          <strong>Resumen:</strong> ${resumen}
        `;
        resultadoDiv.classList.add(resultado.toLowerCase() === "fake" ? "fake" : "real");
      } else {
        resultadoDiv.textContent = "⚠️ Resultado inválido o ausente en la respuesta.";
        resultadoDiv.classList.add("error");
      }

      mostrarNoticiasRelacionadas(data.relacionadas || []);
      mostrarInformacionUtil(data.definiciones || []);

      await cargarEstadisticas();
      await cargarGraficaFakeReal();
      await cargarGraficaNoticiasPorFuente();
      await cargarGraficaTendenciaDiaria();

    } catch (error) {
      console.error("Error al analizar la noticia:", error);
      loadingGif.style.display = "none";
      resultadoDiv.style.display = "block";
      resultadoDiv.textContent = "Error al analizar la noticia. Revisa la consola.";
      resultadoDiv.className = "result error";
      limpiarNoticiasRelacionadas();
      limpiarEstadisticas();
      limpiarInformacionUtil();
    }
  }

  async function validarPortal(url) {
    try {
      loadingGif.style.display = "block";
      resultadoDiv.style.display = "none";
      noticiasListContainer.style.display = "none";

      const response = await fetch(`http://127.0.0.1:8000/validar_portal?url=${encodeURIComponent(url)}`);
      const data = await response.json();

      loadingGif.style.display = "none";

      if (data.error) {
        alert("Error al obtener noticias del portal: " + data.error);
        return;
      }

      if (!Array.isArray(data) || data.length === 0) {
        alert("No se encontraron noticias en el portal.");
        return;
      }

      noticiasListContainer.style.display = "block";
      noticiasListContainer.innerHTML = "<h3>Seleccione una noticia para validar:</h3>";
      const ul = document.createElement("ul");
      ul.style.listStyle = "none";
      ul.style.padding = 0;

      data.forEach((noticia, idx) => {
        const li = document.createElement("li");
        li.style.marginBottom = "10px";

        const btn = document.createElement("button");
        btn.textContent = noticia.titulo || `Noticia ${idx + 1}`;
        btn.style.cursor = "pointer";
        btn.style.padding = "6px 12px";
        btn.style.borderRadius = "4px";
        btn.style.border = "1px solid #2a9d8f";
        btn.style.background = "#e0f0f5";
        btn.style.color = "#2a9d8f";
        btn.style.fontWeight = "600";
        btn.onclick = () => {
          analizarNoticia(noticia.url);
          noticiasListContainer.style.display = "none";
        };

        li.appendChild(btn);
        ul.appendChild(li);
      });

      noticiasListContainer.appendChild(ul);

    } catch (error) {
      loadingGif.style.display = "none";
      alert("Error al obtener noticias del portal. Revisa la consola.");
      console.error(error);
    }
  }

  async function validarXML(file) {
    try {
      loadingGif.style.display = "block";
      resultadoDiv.style.display = "none";
      noticiasListContainer.style.display = "none";

      const text = await file.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "application/xml");

      // Igual lógica para detectar RSS o Atom
      let noticias = [];

      let items = xmlDoc.getElementsByTagName("item");
      if (items.length === 0) {
        const atomNS = "http://www.w3.org/2005/Atom";
        items = xmlDoc.getElementsByTagNameNS(atomNS, "entry");
      }

      if (items.length === 0) {
        alert("No se encontraron noticias en el XML (ni RSS ni Atom).");
        loadingGif.style.display = "none";
        return;
      }

      for (let i = 0; i < Math.min(items.length, 5); i++) {
        const item = items[i];
        let titulo = "";
        let link = "";

        if (item.getElementsByTagName("title").length > 0) {
          titulo = item.getElementsByTagName("title")[0].textContent.trim();
        }

        if (item.getElementsByTagName("link").length > 0) {
          const linkElems = item.getElementsByTagName("link");

          if (linkElems[0].textContent.trim() !== "") {
            link = linkElems[0].textContent.trim();
          } else if (linkElems[0].getAttribute("href")) {
            link = linkElems[0].getAttribute("href").trim();
          } else {
            for (let j = 0; j < linkElems.length; j++) {
              if (linkElems[j].getAttribute("href")) {
                link = linkElems[j].getAttribute("href").trim();
                break;
              }
            }
          }
        }

        if (titulo && link) {
          noticias.push({ titulo, url: link });
        }
      }

      loadingGif.style.display = "none";

      if (noticias.length === 0) {
        alert("No se encontraron noticias válidas en el XML.");
        return;
      }

      noticiasListContainer.style.display = "block";
      noticiasListContainer.innerHTML = "<h3>Seleccione una noticia para validar:</h3>";
      const ul = document.createElement("ul");
      ul.style.listStyle = "none";
      ul.style.padding = 0;

      noticias.forEach((noticia, idx) => {
        const li = document.createElement("li");
        li.style.marginBottom = "10px";

        const btn = document.createElement("button");
        btn.textContent = noticia.titulo;
        btn.style.cursor = "pointer";
        btn.style.padding = "6px 12px";
        btn.style.borderRadius = "4px";
        btn.style.border = "1px solid #2a9d8f";
        btn.style.background = "#e0f0f5";
        btn.style.color = "#2a9d8f";
        btn.style.fontWeight = "600";

        btn.onclick = () => {
          analizarNoticia(noticia.url);
          noticiasListContainer.style.display = "none";
        };

        li.appendChild(btn);
        ul.appendChild(li);
      });

      noticiasListContainer.appendChild(ul);

    } catch (error) {
      loadingGif.style.display = "none";
      alert("Error al procesar el archivo XML. Revisa la consola.");
      console.error(error);
    }
  }

  async function validarXMLUrl(xmlUrl) {
    try {
      loadingGif.style.display = "block";
      resultadoDiv.style.display = "none";
      noticiasListContainer.style.display = "none";

      const response = await fetch(xmlUrl);
      if (!response.ok) throw new Error(`Error al obtener XML: ${response.statusText}`);

      const text = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "application/xml");

      let noticias = [];

      let items = xmlDoc.getElementsByTagName("item");
      if (items.length === 0) {
        const atomNS = "http://www.w3.org/2005/Atom";
        items = xmlDoc.getElementsByTagNameNS(atomNS, "entry");
      }

      if (items.length === 0) {
        alert("No se encontraron noticias en el XML (ni RSS ni Atom).");
        loadingGif.style.display = "none";
        return;
      }

      for (let i = 0; i < Math.min(items.length, 5); i++) {
        const item = items[i];
        let titulo = "";
        let link = "";

        if (item.getElementsByTagName("title").length > 0) {
          titulo = item.getElementsByTagName("title")[0].textContent.trim();
        }

        if (item.getElementsByTagName("link").length > 0) {
          const linkElems = item.getElementsByTagName("link");

          if (linkElems[0].textContent.trim() !== "") {
            link = linkElems[0].textContent.trim();
          } else if (linkElems[0].getAttribute("href")) {
            link = linkElems[0].getAttribute("href").trim();
          } else {
            for (let j = 0; j < linkElems.length; j++) {
              if (linkElems[j].getAttribute("href")) {
                link = linkElems[j].getAttribute("href").trim();
                break;
              }
            }
          }
        }

        if (titulo && link) {
          noticias.push({ titulo, url: link });
        }
      }

      loadingGif.style.display = "none";

      if (noticias.length === 0) {
        alert("No se encontraron noticias válidas en el XML.");
        return;
      }

      noticiasListContainer.style.display = "block";
      noticiasListContainer.innerHTML = "<h3>Seleccione una noticia para validar:</h3>";
      const ul = document.createElement("ul");
      ul.style.listStyle = "none";
      ul.style.padding = 0;

      noticias.forEach((noticia, idx) => {
        const li = document.createElement("li");
        li.style.marginBottom = "10px";

        const btn = document.createElement("button");
        btn.textContent = noticia.titulo;
        btn.style.cursor = "pointer";
        btn.style.padding = "6px 12px";
        btn.style.borderRadius = "4px";
        btn.style.border = "1px solid #2a9d8f";
        btn.style.background = "#e0f0f5";
        btn.style.color = "#2a9d8f";
        btn.style.fontWeight = "600";

        btn.onclick = () => {
          analizarNoticia(noticia.url);
          noticiasListContainer.style.display = "none";
        };

        li.appendChild(btn);
        ul.appendChild(li);
      });

      noticiasListContainer.appendChild(ul);

    } catch (error) {
      loadingGif.style.display = "none";
      alert("Error al procesar el XML. Revisa la consola.");
      console.error(error);
    }
  }

  function mostrarNoticiasRelacionadas(noticias) {
    const lista = document.getElementById("relatedList");
    lista.innerHTML = "";
    if (!noticias.length) {
      lista.innerHTML = "<li>No se encontraron noticias relacionadas.</li>";
      return;
    }
    noticias.forEach(noticia => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = noticia.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = noticia.titulo;
      li.appendChild(a);
      lista.appendChild(li);
    });
  }

  function mostrarInformacionUtil(definiciones) {
    const infoList = document.getElementById("infoList");
    infoList.innerHTML = "";

    if (!definiciones.length) {
      infoList.innerHTML = "<li>No disponible aún.</li>";
      return;
    }

    definiciones.forEach(obj => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${obj.entidad}:</strong> ${obj.definicion}`;
      infoList.appendChild(li);
    });
  }

  async function cargarEstadisticas() {
    try {
      const res = await fetch(`http://127.0.0.1:8000/stats/fake_vs_real_por_fuente?_=${Date.now()}`);
      const data = await res.json();
      const tbody = document.querySelector("#statsTable tbody");
      tbody.innerHTML = "";

      if (!Array.isArray(data) || !data.length) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 5;
        td.textContent = "No hay estadísticas disponibles.";
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }

      data.forEach(site => {
        const total = (site.fake || 0) + (site.real || 0);
        const veracidad = total > 0 ? ((site.real || 0) / total) * 100 : 0;

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${site.source || "Desconocida"}</td>
          <td>${total}</td>
          <td>${site.fake || 0}</td>
          <td>${site.real || 0}</td>
          <td>${veracidad.toFixed(2)}%</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (error) {
      console.error("Error cargando estadísticas", error);
      limpiarEstadisticas();
    }
  }

  async function cargarGraficaFakeReal() {
    try {
      const res = await fetch(`http://127.0.0.1:8000/stats/fake_vs_real_por_fuente?_=${Date.now()}`);
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        console.warn("No hay datos para la gráfica fake vs real.");
        return;
      }

      const etiquetas = data.map(d => d.source);
      const fakeCounts = data.map(d => d.fake);
      const realCounts = data.map(d => d.real);

      const ctx = document.getElementById('fakeRealChart').getContext('2d');

      if(window.fakeRealChartInstance) {
        window.fakeRealChartInstance.destroy();
      }

      window.fakeRealChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: etiquetas,
          datasets: [
            {
              label: 'Fake',
              data: fakeCounts,
              backgroundColor: 'rgba(217, 83, 79, 0.7)'
            },
            {
              label: 'Real',
              data: realCounts,
              backgroundColor: 'rgba(92, 184, 92, 0.7)'
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              precision: 0
            }
          }
        }
      });

    } catch (error) {
      console.error("Error cargando gráfica fake vs real:", error);
    }
  }

  async function cargarGraficaNoticiasPorFuente() {
    try {
      const res = await fetch(`http://127.0.0.1:8000/stats/noticias_por_fuente?_=${Date.now()}`);
      const data = await res.json();

      if (data.mensaje) {
        console.warn(data.mensaje);
        return;
      }

      const etiquetas = data.map(d => d.source);
      const cantidades = data.map(d => d.total);

      const ctx = document.getElementById('noticiasPorFuenteChart').getContext('2d');

      if(window.noticiasPorFuenteChartInstance) {
        window.noticiasPorFuenteChartInstance.destroy();
      }

      window.noticiasPorFuenteChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: etiquetas,
          datasets: [{
            data: cantidades,
            backgroundColor: [
              '#FF6384',
              '#36A2EB',
              '#FFCE56',
              '#4BC0C0',
              '#9966FF',
              '#FF9F40',
              '#66FF66',
              '#FF6666'
            ]
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'right',
            },
            title: {
              display: true,
              text: 'Noticias por fuente (total)'
            }
          }
        }
      });

    } catch (error) {
      console.error("Error cargando gráfica noticias por fuente:", error);
    }
  }

  async function cargarGraficaTendenciaDiaria() {
    try {
      const res = await fetch(`http://127.0.0.1:8000/stats/tendencia_diaria?_=${Date.now()}`);
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        console.warn("No hay datos para la gráfica de tendencia diaria.");
        return;
      }

      // Extraer fechas únicas ordenadas
      const fechasSet = new Set();
      data.forEach(d => fechasSet.add(d.fecha));
      const fechas = [...fechasSet].sort();

      const fakeCounts = fechas.map(fecha => {
        const obj = data.find(d => d.fecha === fecha && d.resultado.toLowerCase() === 'fake');
        return obj ? obj.cantidad : 0;
      });

      const realCounts = fechas.map(fecha => {
        const obj = data.find(d => d.fecha === fecha && d.resultado.toLowerCase() === 'real');
        return obj ? obj.cantidad : 0;
      });

      const ctx = document.getElementById('tendenciaDiariaChart').getContext('2d');

      if(window.tendenciaDiariaChartInstance) {
        window.tendenciaDiariaChartInstance.destroy();
      }

      window.tendenciaDiariaChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: fechas,
          datasets: [
            {
              label: 'Fake',
              data: fakeCounts,
              borderColor: 'rgba(217, 83, 79, 1)',
              backgroundColor: 'rgba(217, 83, 79, 0.3)',
              fill: true,
              tension: 0.1,
            },
            {
              label: 'Real',
              data: realCounts,
              borderColor: 'rgba(92, 184, 92, 1)',
              backgroundColor: 'rgba(92, 184, 92, 0.3)',
              fill: true,
              tension: 0.1,
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
            },
            x: {
              type: 'time',
              time: {
                unit: 'day',
                tooltipFormat: 'yyyy-MM-dd'
              },
              title: {
                display: true,
                text: 'Fecha'
              }
            }
          },
          plugins: {
            title: {
              display: true,
              text: 'Tendencia diaria de Fake vs Real'
            }
          }
        }
      });

    } catch (error) {
      console.error("Error cargando gráfica de tendencia diaria:", error);
    }
  }

  function limpiarNoticiasRelacionadas() {
    document.getElementById("relatedList").innerHTML = "";
  }

  function limpiarEstadisticas() {
    document.querySelector("#statsTable tbody").innerHTML = "";
  }

  function limpiarInformacionUtil() {
    document.getElementById("infoList").innerHTML = "";
  }

  // Inicializar gráficos y tabla al cargar la página
  cargarEstadisticas();
  cargarGraficaFakeReal();
  cargarGraficaNoticiasPorFuente();
  cargarGraficaTendenciaDiaria();
});
