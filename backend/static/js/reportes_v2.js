let tecnicoSeleccionadoId = null;
let trabajosExpandidosV2 = new Set();
let dataActualReportesV2 = { trabajos: [], actividades: [] };
let timerBusquedaFiltrosV2 = null;
let fechaDesdeCargadaReportesV2 = "";
let fechaHastaCargadaReportesV2 = "";
document.addEventListener("DOMContentLoaded", async () => {
  inicializarFechasHoy();
  registrarEventosReportesV2();
  await cargarHoyEnReportesV2();
});

function obtenerFechaHoyLocal() {
  const ahora = new Date();
  const offset = ahora.getTimezoneOffset();
  const local = new Date(ahora.getTime() - offset * 60000);
  return local.toISOString().split("T")[0];
}

function inicializarFechasHoy() {
  const hoy = new Date();
  const input = document.getElementById("rangoFechas");
  if (!input) return;

  flatpickr(input, {
    mode: "range",
    dateFormat: "Y-m-d",
    defaultDate: [hoy, hoy],
    allowInput: true,
    locale: {
      firstDayOfWeek: 1,
    },
    onClose: function (selectedDates, dateStr, instance) {
      if (!selectedDates || selectedDates.length === 0) return;

      if (selectedDates.length === 1) {
        const unica = flatpickr.formatDate(selectedDates[0], "Y-m-d");
        instance.setDate([unica, unica], false);
      }

      const filtros = obtenerFiltrosReportesV2();

      if (!filtros.fechaDesde || !filtros.fechaHasta) return;

      const mismaFecha =
        filtros.fechaDesde === fechaDesdeCargadaReportesV2 &&
        filtros.fechaHasta === fechaHastaCargadaReportesV2;

      if (mismaFecha) return;

      buscarRangoReportesV2();
    },
  });
}

function registrarEventosReportesV2() {
  const btnBuscar = document.getElementById("btnBuscar");
  const btnBuscarTrabajo = document.getElementById("btnBuscarTrabajo");
  const btnLimpiarTrabajo = document.getElementById("btnLimpiarTrabajo");
  const btnLimpiarFiltros = document.getElementById("btnLimpiarFiltros");
  const filtroOrigen = document.getElementById("filtroOrigen");
  const filtroResponsable = document.getElementById("filtroResponsable");

  if (btnBuscar) {
    btnBuscar.addEventListener("click", async () => {
      const filtros = obtenerFiltrosReportesV2();

      if (!filtros.fechaDesde || !filtros.fechaHasta) return;

      await buscarRangoReportesV2(); // solo aquí se permite backend
    });
  }

  if (btnBuscarTrabajo) {
    btnBuscarTrabajo.addEventListener("click", buscarTrabajoPorIdV2);
  }

  if (btnLimpiarTrabajo) {
    btnLimpiarTrabajo.addEventListener("click", limpiarBusquedaTrabajoV2);
  }

  if (btnLimpiarFiltros) {
    btnLimpiarFiltros.addEventListener("click", async () => {
      tecnicoSeleccionadoId = null;
      limpiarBusquedaTrabajoV2();

      const hoy = new Date();
      const hoyStr = flatpickr.formatDate(hoy, "Y-m-d");

      const rangoInput = document.getElementById("rangoFechas");
      if (rangoInput && rangoInput._flatpickr) {
        rangoInput._flatpickr.setDate([hoyStr, hoyStr], true);
      } else if (rangoInput) {
        rangoInput.value = hoyStr;
      }

      const origen = document.getElementById("filtroOrigen");
      const responsable = document.getElementById("filtroResponsable");

      if (origen) origen.value = "";
      if (responsable) responsable.value = "";

      await buscarRangoReportesV2();
    });
  }

  if (filtroOrigen) {
    filtroOrigen.addEventListener("change", aplicarFiltrosLocalesReportesV2);
  }

  if (filtroResponsable) {
    filtroResponsable.addEventListener("input", () => {
      if (timerBusquedaFiltrosV2) {
        clearTimeout(timerBusquedaFiltrosV2);
      }

      timerBusquedaFiltrosV2 = setTimeout(() => {
        aplicarFiltrosLocalesReportesV2();
      }, 300);
    });
  }
}

async function cargarHoyEnReportesV2() {
  const hoy = obtenerFechaHoyLocal();

  mostrarEstadoReportesV2("Cargando datos de hoy...");

  const dataFresh = await consultarDiaFirestoreReportesV2(hoy);

  dataActualReportesV2 = dataFresh;
  fechaDesdeCargadaReportesV2 = hoy;
  fechaHastaCargadaReportesV2 = hoy;
  renderizarVistaReportesV2({
    fechaDesde: hoy,
    fechaHasta: hoy,
    origen: "",
    responsable: "",
  });
}

async function consultarDiaFirestoreReportesV2(fechaLocal) {
  try {
    const resp = await fetch(
      `/api/reportes_v2?desde=${encodeURIComponent(fechaLocal)}&hasta=${encodeURIComponent(fechaLocal)}`,
      { cache: "no-store" },
    );

    const data = await resp.json();

    if (!resp.ok || !data?.ok) {
      throw new Error(data?.error || "No se pudo consultar reportes");
    }

    return normalizarRespuestaReportesV2(data);
  } catch (error) {
    console.error("Error consultando reportes_v2:", error);
    return {
      trabajos: [],
      actividades: [],
    };
  }
}

function normalizarRespuestaReportesV2(data) {
  return {
    trabajos: Array.isArray(data?.trabajos) ? data.trabajos : [],
    actividades: Array.isArray(data?.actividades) ? data.actividades : [],
  };
}

function obtenerFiltrosReportesV2() {
  const input = document.getElementById("rangoFechas");
  const valor = (input?.value || "").trim();
  const fechas = valor.match(/\d{4}-\d{2}-\d{2}/g) || [];

  let fechaDesde = "";
  let fechaHasta = "";

  if (fechas.length >= 2) {
    fechaDesde = fechas[0];
    fechaHasta = fechas[fechas.length - 1];
  } else if (fechas.length === 1) {
    fechaDesde = fechas[0];
    fechaHasta = fechas[0];
  }

  return {
    fechaDesde,
    fechaHasta,
    origen: (document.getElementById("filtroOrigen")?.value || "").trim(),
    responsable: (document.getElementById("filtroResponsable")?.value || "")
      .trim()
      .toLowerCase(),
  };
}

async function buscarRangoReportesV2() {
  const filtros = obtenerFiltrosReportesV2();

  if (!filtros.fechaDesde || !filtros.fechaHasta) {
    return;
  }

  tecnicoSeleccionadoId = null;
  limpiarBusquedaTrabajoV2();
  mostrarEstadoReportesV2("Buscando datos...");

  try {
    const resp = await fetch(
      `/api/reportes_v2?desde=${encodeURIComponent(filtros.fechaDesde)}&hasta=${encodeURIComponent(filtros.fechaHasta)}`,
      { cache: "no-store" },
    );

    const data = await resp.json();

    if (!resp.ok || !data?.ok) {
      throw new Error(data?.error || "No se pudo consultar el rango");
    }

    dataActualReportesV2 = normalizarRespuestaReportesV2(data);
    fechaDesdeCargadaReportesV2 = filtros.fechaDesde;
    fechaHastaCargadaReportesV2 = filtros.fechaHasta;
    renderizarVistaReportesV2(filtros);
  } catch (error) {
    console.error("Error buscando rango reportes_v2:", error);
    mostrarEstadoReportesV2("No se pudo consultar el rango.");
  }
}

function filtrarDatosReportesV2(data, filtros) {
  let trabajos = Array.isArray(data?.trabajos) ? [...data.trabajos] : [];
  let actividades = Array.isArray(data?.actividades)
    ? [...data.actividades]
    : [];

  if (filtros.origen) {
    trabajos = trabajos.filter(
      (t) => String(t?.origen || "").toLowerCase() === filtros.origen,
    );
  }

  if (filtros.responsable) {
    trabajos = trabajos.filter((t) => {
      const responsable = String(
        t?.responsable_nombre ||
          t?.vendedor_nombre ||
          t?.solicitante_nombre ||
          "",
      ).toLowerCase();

      return responsable.includes(filtros.responsable);
    });
  }

  const idsTrabajo = new Set(
    trabajos.map((t) => Number(t?.id)).filter((id) => Number.isFinite(id)),
  );

  actividades = actividades.filter((a) =>
    idsTrabajo.has(Number(a?.trabajo_id)),
  );

  return {
    trabajos,
    actividades,
  };
}

function renderizarVistaReportesV2(filtros) {
  const dataFiltrada = filtrarDatosReportesV2(dataActualReportesV2, filtros);

  renderizarResumenGeneralV2(dataFiltrada);
  renderizarTarjetasTecnicosV2(dataFiltrada);
  renderizarTrabajosV2(dataFiltrada);
  limpiarEstadoReportesV2();
}

function aplicarFiltrosLocalesReportesV2() {
  if (!dataActualReportesV2) return;

  const filtros = obtenerFiltrosReportesV2();
  renderizarVistaReportesV2(filtros);
}

function renderizarResumenGeneralV2(data) {
  const contenedor = document.getElementById("resumenGeneral");
  if (!contenedor) return;

  const trabajos = Array.isArray(data?.trabajos) ? data.trabajos : [];
  const actividades = Array.isArray(data?.actividades) ? data.actividades : [];

  const tecnicosUnicos = new Set();

  actividades.forEach((act) => {
    const participantes = Array.isArray(act?.participantes)
      ? act.participantes
      : [];

    participantes.forEach((p) => {
      const tecnicoId = Number(p?.tecnico_id || 0);
      if (tecnicoId > 0) tecnicosUnicos.add(tecnicoId);
    });
  });

  contenedor.innerHTML = `
    <div class="resumen-item">Trabajos: ${trabajos.length}</div>
    <div class="resumen-item">Actividades: ${actividades.length}</div>
    <div class="resumen-item">Técnicos: ${tecnicosUnicos.size}</div>
  `;

  const contenedorKPIs = document.getElementById("dashboardKPIs");
  if (!contenedorKPIs) return;

  // tiempo total del día
  let tiempoTotalDia = 0;

  // por técnico
  const tiempoPorTecnico = new Map();
  const actividadesPorTecnico = new Map();

  // por trabajo
  const tiempoPorTrabajo = new Map();

  actividades.forEach((act) => {
    const trabajoId = Number(act?.trabajo_id || 0);

    const participantes = Array.isArray(act?.participantes)
      ? act.participantes
      : [];

    const tecnicosContadosEnActividad = new Set();

    participantes.forEach((p) => {
      const acumulado = Number(p?.tiempo_real_seg || 0);
      const inicioActual = p?.inicio_actual_at;
      const estado = String(p?.estado || "").toLowerCase();

      let total = acumulado;

      if (p?.activo !== false && estado === "activo" && inicioActual) {
        const inicio = new Date(inicioActual);
        if (!isNaN(inicio.getTime())) {
          const ahora = new Date();
          const extra = Math.max(0, Math.floor((ahora - inicio) / 1000));
          total += extra;
        }
      }

      // total del día
      tiempoTotalDia += total;

      // por técnico
      const tecnicoId = Number(p?.tecnico_id || 0);
      const tecnicoNombre = p?.tecnico_nombre || "Técnico";

      if (!tiempoPorTecnico.has(tecnicoId)) {
        tiempoPorTecnico.set(tecnicoId, {
          nombre: tecnicoNombre,
          tiempo: 0,
        });
      }

      tiempoPorTecnico.get(tecnicoId).tiempo += total;

      // actividades por técnico (sin duplicar dentro de la misma actividad)
      if (tecnicoId > 0 && !tecnicosContadosEnActividad.has(tecnicoId)) {
        tecnicosContadosEnActividad.add(tecnicoId);

        if (!actividadesPorTecnico.has(tecnicoId)) {
          actividadesPorTecnico.set(tecnicoId, {
            nombre: tecnicoNombre,
            actividades: 0,
          });
        }

        actividadesPorTecnico.get(tecnicoId).actividades += 1;
      }

      // por trabajo
      if (!tiempoPorTrabajo.has(trabajoId)) {
        tiempoPorTrabajo.set(trabajoId, 0);
      }

      tiempoPorTrabajo.set(trabajoId, tiempoPorTrabajo.get(trabajoId) + total);
    });
  });

  // promedio por trabajo
  const totalTrabajos = Array.isArray(data?.trabajos)
    ? data.trabajos.length
    : 0;
  const promedioTrabajo =
    totalTrabajos > 0 ? Math.floor(tiempoTotalDia / totalTrabajos) : 0;

  // técnico top por tiempo
  let tecnicoTopTiempo = null;

  for (const [, val] of tiempoPorTecnico) {
    if (!tecnicoTopTiempo || val.tiempo > tecnicoTopTiempo.tiempo) {
      tecnicoTopTiempo = val;
    }
  }

  // técnico top por actividades
  let tecnicoTopActividades = null;

  for (const [, val] of actividadesPorTecnico) {
    if (
      !tecnicoTopActividades ||
      val.actividades > tecnicoTopActividades.actividades
    ) {
      tecnicoTopActividades = val;
    }
  }

  // trabajo más largo
  let trabajoTopId = null;
  let trabajoTopTiempo = 0;

  for (const [id, tiempo] of tiempoPorTrabajo) {
    if (tiempo > trabajoTopTiempo) {
      trabajoTopTiempo = tiempo;
      trabajoTopId = id;
    }
  }

  // render
  contenedorKPIs.innerHTML = `
  <div class="dashboard-kpis-v2">
    <div class="kpi-card-v2 tiempo-dia">
      <div class="kpi-label-v2">Tiempo del día</div>
      <div class="kpi-value-v2">${formatearDuracionV2(tiempoTotalDia)}</div>
    </div>

    <div class="kpi-card-v2 promedio">
      <div class="kpi-label-v2">Promedio por trabajo</div>
      <div class="kpi-value-v2">${formatearDuracionV2(promedioTrabajo)}</div>
    </div>

    <div class="kpi-card-v2 actividades-top">
      <div class="kpi-label-v2">Más actividades</div>
      <div class="kpi-value-v2">
        ${
          tecnicoTopActividades
            ? `${escapeHtmlV2(tecnicoTopActividades.nombre)} (${tecnicoTopActividades.actividades})`
            : "—"
        }
      </div>
    </div>

    <div class="kpi-card-v2 tiempo-top">
      <div class="kpi-label-v2">Más tiempo</div>
      <div class="kpi-value-v2">
        ${
          tecnicoTopTiempo
            ? `${escapeHtmlV2(tecnicoTopTiempo.nombre)} (${formatearDuracionV2(tecnicoTopTiempo.tiempo)})`
            : "—"
        }
      </div>
    </div>

    <div class="kpi-card-v2 trabajo-top">
      <div class="kpi-label-v2">Trabajo más largo</div>
      <div class="kpi-value-v2">
        #${trabajoTopId || "—"} (${formatearDuracionV2(trabajoTopTiempo)})
      </div>
    </div>
  </div>
`;
}

function construirResumenTecnicosV2(data) {
  const actividades = Array.isArray(data?.actividades) ? data.actividades : [];
  const mapa = new Map();

  function calcularTiempoParticipanteSeg(participante) {
    const acumulado = Number(participante?.tiempo_real_seg || 0);
    const inicioActual = participante?.inicio_actual_at;
    const estado = String(participante?.estado || "").toLowerCase();

    if (participante?.activo !== false && estado === "activo" && inicioActual) {
      const inicio = new Date(inicioActual);
      if (!isNaN(inicio.getTime())) {
        const ahora = new Date();
        const extra = Math.max(0, Math.floor((ahora - inicio) / 1000));
        return acumulado + extra;
      }
    }

    return acumulado;
  }

  actividades.forEach((act) => {
    const participantes = Array.isArray(act?.participantes)
      ? act.participantes
      : [];

    participantes.forEach((p) => {
      const tecnicoId = Number(p?.tecnico_id || 0);
      if (tecnicoId <= 0) return;

      const actual = mapa.get(tecnicoId) || {
        tecnico_id: tecnicoId,
        tecnico_nombre: p?.tecnico_nombre || "Técnico",
        actividades_ids: new Set(),
        tiempo_total_seg: 0,
      };

      actual.tecnico_nombre = p?.tecnico_nombre || actual.tecnico_nombre;
      if (act?.id) actual.actividades_ids.add(String(act.id));
      actual.tiempo_total_seg += calcularTiempoParticipanteSeg(p);

      mapa.set(tecnicoId, actual);
    });
  });

  return [...mapa.values()]
    .map((item) => ({
      tecnico_id: item.tecnico_id,
      tecnico_nombre: item.tecnico_nombre,
      actividades_count: item.actividades_ids.size,
      tiempo_total_seg: item.tiempo_total_seg,
    }))
    .sort((a, b) => {
      if (b.actividades_count !== a.actividades_count) {
        return b.actividades_count - a.actividades_count;
      }
      return b.tiempo_total_seg - a.tiempo_total_seg;
    });
}

function renderizarTarjetasTecnicosV2(data) {
  const contenedor = document.getElementById("tarjetasTecnicos");
  if (!contenedor) return;

  const resumen = construirResumenTecnicosV2(data);

  if (resumen.length === 0) {
    contenedor.innerHTML = `<div>No hay técnicos para mostrar.</div>`;
    return;
  }

  contenedor.innerHTML = resumen
    .map((item) => {
      const activo = Number(tecnicoSeleccionadoId) === Number(item.tecnico_id);

      return `
        <div
          class="tarjeta-tecnico ${activo ? "activa" : ""}"
          onclick="seleccionarTecnicoV2(${item.tecnico_id})"
        >
          <div><strong>${escapeHtmlV2(item.tecnico_nombre)}</strong></div>
          <div>Actividades: ${item.actividades_count}</div>
          <div>Tiempo: ${formatearDuracionV2(item.tiempo_total_seg)}</div>
        </div>
      `;
    })
    .join("");
}

function renderizarTrabajosV2(data) {
  const contenedor = document.getElementById("listaTrabajosV2");
  if (!contenedor) return;

  let trabajos = Array.isArray(data?.trabajos) ? [...data.trabajos] : [];
  const actividades = Array.isArray(data?.actividades) ? data.actividades : [];

  if (tecnicoSeleccionadoId) {
    const trabajosConTecnico = new Set();

    actividades.forEach((act) => {
      const participantes = Array.isArray(act?.participantes)
        ? act.participantes
        : [];

      const tieneTecnico = participantes.some(
        (p) => Number(p?.tecnico_id) === Number(tecnicoSeleccionadoId),
      );

      if (tieneTecnico) {
        const trabajoId = Number(act?.trabajo_id || 0);
        if (trabajoId > 0) {
          trabajosConTecnico.add(trabajoId);
        }
      }
    });

    trabajos = trabajos.filter((t) => trabajosConTecnico.has(Number(t?.id)));
  }

  if (trabajos.length === 0) {
    contenedor.innerHTML = `<div>No hay trabajos para mostrar.</div>`;
    return;
  }

  const actividadesPorTrabajo = new Map();

  actividades.forEach((act) => {
    const trabajoId = Number(act?.trabajo_id || 0);
    if (!trabajoId) return;

    if (!actividadesPorTrabajo.has(trabajoId)) {
      actividadesPorTrabajo.set(trabajoId, []);
    }

    actividadesPorTrabajo.get(trabajoId).push(act);
  });

  const ordenEstado = {
    en_proceso: 1,
    pendiente: 2,
    pausado: 3,
    finalizado: 4,
  };

  trabajos.sort((a, b) => {
    const estadoA = String(a?.estado || "").toLowerCase();
    const estadoB = String(b?.estado || "").toLowerCase();

    const ordenA = ordenEstado[estadoA] || 99;
    const ordenB = ordenEstado[estadoB] || 99;

    if (ordenA !== ordenB) return ordenA - ordenB;

    const fechaA = new Date(a?.created_at || 0).getTime();
    const fechaB = new Date(b?.created_at || 0).getTime();

    return fechaB - fechaA;
  });

  const grupos = {
    en_proceso: [],
    pendiente: [],
    pausado: [],
    finalizado: [],
    otros: [],
  };

  trabajos.forEach((trabajo) => {
    const estado = String(trabajo?.estado || "").toLowerCase();

    if (grupos[estado]) {
      grupos[estado].push(trabajo);
    } else {
      grupos.otros.push(trabajo);
    }
  });

  function tituloGrupoEstadoV2(estado, cantidad) {
    if (estado === "en_proceso") return `En proceso (${cantidad})`;
    if (estado === "pendiente") return `Pendientes (${cantidad})`;
    if (estado === "pausado") return `Pausados (${cantidad})`;
    if (estado === "finalizado") return `Finalizados (${cantidad})`;
    return `Otros (${cantidad})`;
  }

  function htmlTrabajoV2(trabajo) {
    const trabajoId = Number(trabajo?.id || 0);
    const expandido = trabajosExpandidosV2.has(trabajoId);
    const acts = actividadesPorTrabajo.get(trabajoId) || [];

    let tiempoTotalTrabajo = 0;

    acts.forEach((act) => {
      const participantes = Array.isArray(act?.participantes)
        ? act.participantes
        : [];

      participantes.forEach((p) => {
        const acumulado = Number(p?.tiempo_real_seg || 0);
        const inicioActual = p?.inicio_actual_at;
        const estado = String(p?.estado || "").toLowerCase();

        let total = acumulado;

        if (p?.activo !== false && estado === "activo" && inicioActual) {
          const inicio = new Date(inicioActual);
          if (!isNaN(inicio.getTime())) {
            const ahora = new Date();
            const extra = Math.max(0, Math.floor((ahora - inicio) / 1000));
            total += extra;
          }
        }

        tiempoTotalTrabajo += total;
      });
    });

    const responsable = String(
      trabajo?.responsable_nombre ||
        trabajo?.vendedor_nombre ||
        trabajo?.solicitante_nombre ||
        "Sin responsable",
    );

    const participantesUnicos = new Set();

    acts.forEach((act) => {
      const participantes = Array.isArray(act?.participantes)
        ? act.participantes
        : [];

      participantes.forEach((p) => {
        const tecnicoId = Number(p?.tecnico_id || 0);
        if (tecnicoId > 0) participantesUnicos.add(tecnicoId);
      });
    });

    const actividadesHtml =
      acts.length === 0
        ? `<div style="color:#667085;">Sin actividades.</div>`
        : `<div class="actividades-lista-v2">
            ${acts
              .sort((a, b) => Number(a?.orden || 0) - Number(b?.orden || 0))
              .map((act) => {
                const participantes = Array.isArray(act?.participantes)
                  ? act.participantes
                  : [];

                const nombresTecnicos = [
                  ...new Set(
                    participantes
                      .map((p) => String(p?.tecnico_nombre || "").trim())
                      .filter(Boolean),
                  ),
                ];

                let tiempoTotalActividad = 0;

                participantes.forEach((p) => {
                  const acumulado = Number(p?.tiempo_real_seg || 0);
                  const inicioActual = p?.inicio_actual_at;
                  const estado = String(p?.estado || "").toLowerCase();

                  let total = acumulado;

                  if (
                    p?.activo !== false &&
                    estado === "activo" &&
                    inicioActual
                  ) {
                    const inicio = new Date(inicioActual);
                    if (!isNaN(inicio.getTime())) {
                      const ahora = new Date();
                      const extra = Math.max(
                        0,
                        Math.floor((ahora - inicio) / 1000),
                      );
                      total += extra;
                    }
                  }

                  tiempoTotalActividad += total;
                });

                const claseEstadoAct =
                  obtenerClaseEstadoV2(act?.estado) || "estado-otros";

                return `
                  <div class="actividad-item-v2 ${claseEstadoAct}">
                    <div class="actividad-header-v2">
                      <div><strong>${escapeHtmlV2(act?.descripcion || "Actividad")}</strong></div>
                      <div class="actividad-tiempo-v2">
                        ${formatearDuracionV2(tiempoTotalActividad)}
                      </div>
                    </div>

                    <div class="actividad-meta-v2">
                      ${escapeHtmlV2(formatearEstadoV2(act?.estado || "—"))}
                    </div>

                    <div class="actividad-personal-v2">
                      ${nombresTecnicos.length > 0 ? escapeHtmlV2(nombresTecnicos.join(", ")) : "Sin técnicos"}
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>`;

    const claseEstadoTrabajo =
      obtenerClaseEstadoV2(trabajo?.estado) || "estado-otros";

    return `
      <div
        class="bloque trabajo-card-v2 ${claseEstadoTrabajo}"
        onclick="toggleTrabajoV2(${trabajoId})"
      >
        <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div>
            <div>
              <strong>Trabajo #${trabajoId}</strong>
              <span style="margin-left:8px; font-size:12px; color:#667085;">
                ${expandido ? "▲ Ocultar detalle" : "▼ Ver detalle"}
              </span>
            </div>
            <div style="margin-top:4px;">${escapeHtmlV2(trabajo?.descripcion || "Sin descripción")}</div>
          </div>

          <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
            <span class="estado-chip ${obtenerClaseEstadoV2(trabajo?.estado)}">
              ${escapeHtmlV2(formatearEstadoV2(trabajo?.estado || "—"))}
            </span>

            <div style="font-size:16px; font-weight:700; color:#0f172a;">
              ${formatearDuracionV2(tiempoTotalTrabajo)}
            </div>

            <div style="font-size:12px; color:#94a3b8;">
              ${escapeHtmlV2(trabajo?.fecha_local || "—")}
            </div>
          </div>
        </div>

        <div style="margin-top:8px; font-size:14px; color:#475467;">
          Responsable: <strong>${escapeHtmlV2(responsable)}</strong>
        </div>

        <div style="margin-top:4px; font-size:14px; color:#475467;">
          Actividades: <strong>${acts.length}</strong> · Técnicos: <strong>${participantesUnicos.size}</strong>
        </div>

        ${
          expandido
            ? `
        <div style="margin-top:10px;">
          ${actividadesHtml}
        </div>
        `
            : ""
        }
      </div>
    `;
  }

  const ordenGrupos = [
    "en_proceso",
    "pendiente",
    "pausado",
    "finalizado",
    "otros",
  ];

  contenedor.innerHTML = ordenGrupos
    .filter((estado) => grupos[estado].length > 0)
    .map((estado) => {
      const claseGrupoEstado =
        estado === "otros" ? "estado-otros" : `estado-${estado}`;

      return `
        <div class="grupo-estado-v2 ${claseGrupoEstado}">
          <div class="grupo-titulo-v2">
            ${tituloGrupoEstadoV2(estado, grupos[estado].length)}
          </div>
          ${grupos[estado].map((trabajo) => htmlTrabajoV2(trabajo)).join("")}
        </div>
      `;
    })
    .join("");
}

function seleccionarTecnicoV2(tecnicoId) {
  limpiarBusquedaTrabajoV2();

  tecnicoSeleccionadoId =
    Number(tecnicoSeleccionadoId) === Number(tecnicoId)
      ? null
      : Number(tecnicoId);

  renderizarVistaReportesV2(obtenerFiltrosReportesV2());
}

function toggleTrabajoV2(trabajoId) {
  const id = Number(trabajoId);

  if (trabajosExpandidosV2.has(id)) {
    trabajosExpandidosV2.delete(id);
  } else {
    trabajosExpandidosV2.add(id);
  }

  renderizarVistaReportesV2(obtenerFiltrosReportesV2());
}

function buscarTrabajoPorIdV2() {
  const input = document.getElementById("buscarTrabajoId");
  const contenedor = document.getElementById("resultadoTrabajo");
  if (!input || !contenedor) return;

  const trabajoId = Number((input.value || "").trim());

  if (!trabajoId) {
    alert("Debes escribir un ID de trabajo válido.");
    return;
  }

  tecnicoSeleccionadoId = null;
  contenedor.innerHTML = `<div style="color:#667085;">Buscando trabajo...</div>`;

  const trabajos = Array.isArray(dataActualReportesV2?.trabajos)
    ? dataActualReportesV2.trabajos
    : [];

  const actividades = Array.isArray(dataActualReportesV2?.actividades)
    ? dataActualReportesV2.actividades
    : [];

  const trabajo = trabajos.find((t) => Number(t?.id) === Number(trabajoId));

  if (!trabajo) {
    contenedor.innerHTML = `
      <div style="color:#667085;">
        No se encontró el trabajo en la data cargada actualmente.
      </div>
    `;
    return;
  }

  const actividadesTrabajo = actividades.filter(
    (a) => Number(a?.trabajo_id) === Number(trabajoId),
  );

  contenedor.innerHTML = `
    <div id="resultadoTrabajoCardV2" class="resultado-destacado-v2" style="margin-top:12px;">
      ${htmlTrabajoBuscadoV2(trabajo, actividadesTrabajo)}
    </div>
  `;

  setTimeout(() => {
    const target = document.getElementById("resultadoTrabajoCardV2");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, 100);
}

function limpiarBusquedaTrabajoV2() {
  const input = document.getElementById("buscarTrabajoId");
  const contenedor = document.getElementById("resultadoTrabajo");

  if (input) input.value = "";
  if (contenedor) contenedor.innerHTML = "";
}

function htmlTrabajoBuscadoV2(trabajo, actividades) {
  const trabajoId = Number(trabajo?.id || 0);
  const responsable = String(
    trabajo?.responsable_nombre ||
      trabajo?.vendedor_nombre ||
      trabajo?.solicitante_nombre ||
      "Sin responsable",
  );

  let tiempoTotalTrabajo = 0;
  const participantesUnicos = new Set();

  const acts = Array.isArray(actividades) ? [...actividades] : [];

  acts.forEach((act) => {
    const participantes = Array.isArray(act?.participantes)
      ? act.participantes
      : [];

    participantes.forEach((p) => {
      const tecnicoId = Number(p?.tecnico_id || 0);
      if (tecnicoId > 0) participantesUnicos.add(tecnicoId);

      const acumulado = Number(p?.tiempo_real_seg || 0);
      const inicioActual = p?.inicio_actual_at;
      const estado = String(p?.estado || "").toLowerCase();

      let total = acumulado;

      if (p?.activo !== false && estado === "activo" && inicioActual) {
        const inicio = new Date(inicioActual);
        if (!isNaN(inicio.getTime())) {
          const ahora = new Date();
          const extra = Math.max(0, Math.floor((ahora - inicio) / 1000));
          total += extra;
        }
      }

      tiempoTotalTrabajo += total;
    });
  });

  const actividadesHtml =
    acts.length === 0
      ? `<div style="color:#667085;">Sin actividades.</div>`
      : `<div class="actividades-lista-v2">
          ${acts
            .sort((a, b) => Number(a?.orden || 0) - Number(b?.orden || 0))
            .map((act) => {
              const participantes = Array.isArray(act?.participantes)
                ? act.participantes
                : [];

              const nombresTecnicos = [
                ...new Set(
                  participantes
                    .map((p) => String(p?.tecnico_nombre || "").trim())
                    .filter(Boolean),
                ),
              ];

              let tiempoTotalActividad = 0;

              participantes.forEach((p) => {
                const acumulado = Number(p?.tiempo_real_seg || 0);
                const inicioActual = p?.inicio_actual_at;
                const estado = String(p?.estado || "").toLowerCase();

                let total = acumulado;

                if (
                  p?.activo !== false &&
                  estado === "activo" &&
                  inicioActual
                ) {
                  const inicio = new Date(inicioActual);
                  if (!isNaN(inicio.getTime())) {
                    const ahora = new Date();
                    const extra = Math.max(
                      0,
                      Math.floor((ahora - inicio) / 1000),
                    );
                    total += extra;
                  }
                }

                tiempoTotalActividad += total;
              });

              const claseEstadoAct =
                obtenerClaseEstadoV2(act?.estado) || "estado-otros";

              return `
                <div class="actividad-item-v2 ${claseEstadoAct}">
                  <div class="actividad-header-v2">
                    <div><strong>${escapeHtmlV2(act?.descripcion || "Actividad")}</strong></div>
                    <div class="actividad-tiempo-v2">
                      ${formatearDuracionV2(tiempoTotalActividad)}
                    </div>
                  </div>

                  <div class="actividad-meta-v2">
                    ${escapeHtmlV2(formatearEstadoV2(act?.estado || "—"))}
                  </div>

                  <div class="actividad-personal-v2">
                    ${nombresTecnicos.length > 0 ? escapeHtmlV2(nombresTecnicos.join(", ")) : "Sin técnicos"}
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>`;

  const claseEstadoTrabajo =
    obtenerClaseEstadoV2(trabajo?.estado) || "estado-otros";

  return `
    <div class="grupo-estado-v2" style="margin-bottom:0;">
      <div class="grupo-titulo-v2">
        Resultado de búsqueda
      </div>

      <div class="bloque trabajo-card-v2 ${claseEstadoTrabajo}">
        <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div>
            <div><strong>Trabajo #${trabajoId}</strong></div>
            <div style="margin-top:4px;">${escapeHtmlV2(trabajo?.descripcion || "Sin descripción")}</div>
          </div>

          <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
            <span class="estado-chip ${obtenerClaseEstadoV2(trabajo?.estado)}">
              ${escapeHtmlV2(formatearEstadoV2(trabajo?.estado || "—"))}
            </span>

            <div style="font-size:16px; font-weight:700; color:#0f172a;">
              ${formatearDuracionV2(tiempoTotalTrabajo)}
            </div>

            <div style="font-size:12px; color:#94a3b8;">
              ${escapeHtmlV2(trabajo?.fecha_local || "—")}
            </div>
          </div>
        </div>

        <div style="margin-top:8px; font-size:14px; color:#475467;">
          Responsable: <strong>${escapeHtmlV2(responsable)}</strong>
        </div>

        <div style="margin-top:4px; font-size:14px; color:#475467;">
          Actividades: <strong>${acts.length}</strong> · Técnicos: <strong>${participantesUnicos.size}</strong>
        </div>

        <div style="margin-top:10px;">
          ${actividadesHtml}
        </div>
      </div>
    </div>
  `;
}

function mostrarEstadoReportesV2(texto) {
  const dashboard = document.getElementById("dashboardKPIs");
  const resumen = document.getElementById("resumenGeneral");
  const tarjetas = document.getElementById("tarjetasTecnicos");
  const trabajos = document.getElementById("listaTrabajosV2");

  if (dashboard) dashboard.innerHTML = "";
  if (resumen) resumen.innerHTML = `<div>${texto}</div>`;
  if (tarjetas) tarjetas.innerHTML = "";
  if (trabajos) trabajos.innerHTML = "";
}

function limpiarEstadoReportesV2() {}

function escapeHtmlV2(texto) {
  const div = document.createElement("div");
  div.textContent = texto == null ? "" : String(texto);
  return div.innerHTML;
}

function formatearDuracionV2(segundos) {
  const total = Math.max(0, Number(segundos || 0));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);

  if (horas > 0) {
    return minutos > 0 ? `${horas}h ${minutos} min` : `${horas}h`;
  }

  return `${minutos} min`;
}
function formatearEstadoV2(estado) {
  const valor = String(estado || "").toLowerCase();

  if (valor === "en_proceso") return "En proceso";
  if (valor === "pendiente") return "Pendiente";
  if (valor === "pausado") return "Pausado";
  if (valor === "finalizado") return "Finalizado";

  return estado || "—";
}
function obtenerClaseEstadoV2(estado) {
  const valor = String(estado || "").toLowerCase();

  if (valor === "en_proceso") return "estado-en_proceso";
  if (valor === "pendiente") return "estado-pendiente";
  if (valor === "pausado") return "estado-pausado";
  if (valor === "finalizado") return "estado-finalizado";

  return "";
}
