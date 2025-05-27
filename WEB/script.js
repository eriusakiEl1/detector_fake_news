async function analizarNoticia(url) {
  const resultadoDiv = document.getElementById("result");
  const loadingGif = document.getElementById("loadingGif");

  try {
    // Mostrar GIF y ocultar resultado mientras carga
    loadingGif.style.display = "block";
    resultadoDiv.style.display = "none";

    const response = await fetch(`http://127.0.0.1:8000/analizar?url=${encodeURIComponent(url)}`);
    const data = await response.json();
    console.log("Respuesta de API:", data);

    // Ocultar GIF y mostrar resultado
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
    
    // Cargar estadísticas y gráficas después del análisis
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
    const res = await fetch(`http://127.0.0.1:8000/stats/fake_vs_real_por_fuente?_=${Date.now()}`); // evitar caché
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

    if (data.mensaje) {
      console.warn(data.mensaje);
      return;
    }

    const fechas = [...new Set(data.map(d => d.fecha))].sort();

    const fakeCounts = fechas.map(fecha => {
      const obj = data.find(d => d.fecha === fecha && d.resultado === 'fake');
      return obj ? obj.cantidad : 0;
    });
    const realCounts = fechas.map(fecha => {
      const obj = data.find(d => d.fecha === fecha && d.resultado === 'real');
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
            precision: 0
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

document.getElementById("newsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = document.getElementById("urlInput").value.trim();
  if (url) await analizarNoticia(url);
});

window.addEventListener("load", () => {
  cargarEstadisticas();
  cargarGraficaFakeReal();
  cargarGraficaNoticiasPorFuente();
  cargarGraficaTendenciaDiaria();
});
