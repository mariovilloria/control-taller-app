// ===== Helpers HTML =====

function escapeHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto == null ? "" : String(texto);
  return div.innerHTML;
}

function nombreResponsable(trabajo) {
  if (!trabajo) return "Sin responsable";

  return (
    trabajo.responsable_nombre ||
    trabajo.vendedor_nombre ||
    trabajo.solicitante_nombre ||
    "Sin responsable"
  );
}

function textoBusquedaFinalizado(trabajo) {
  if (!trabajo) return "";

  const estadoVisual =
    typeof estadoVisualTrabajo === "function"
      ? estadoVisualTrabajo(trabajo)
      : trabajo.estado || "";

  const fechaRef = fechaReferenciaTrabajo(trabajo, estadoVisual);
  const fecha = formatearFechaCorta(fechaRef);

  return [
    trabajo.id || "",
    trabajo.descripcion || "",
    nombreResponsable(trabajo),
    estadoVisual || "",
    fecha,
    trabajo.created_at || "",
    trabajo.finalizado_at || "",
  ]
    .join(" ")
    .toLowerCase();
}

// ===== Fechas =====

function formatearFechaCorta(fechaIso) {
  if (!fechaIso) return "—";
  const fecha = new Date(fechaIso);
  if (isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function almuerzoEsDeHoy(tecnico) {
  if (!tecnico?.almuerzo_registrado || !tecnico?.almuerzo_fecha) return false;

  const fechaAlmuerzo = new Date(tecnico.almuerzo_fecha);
  const hoy = new Date();

  if (isNaN(fechaAlmuerzo.getTime())) return false;

  return (
    fechaAlmuerzo.getFullYear() === hoy.getFullYear() &&
    fechaAlmuerzo.getMonth() === hoy.getMonth() &&
    fechaAlmuerzo.getDate() === hoy.getDate()
  );
}

function fechaReferenciaTrabajo(trabajo, estadoVisual = null) {
  const estado = estadoVisual || trabajo?.estado || "pendiente";

  if (estado === "finalizado") {
    return (
      trabajo.finalizado_at || trabajo.updated_at || trabajo.created_at || null
    );
  }

  if (estado === "en_proceso") {
    return (
      trabajo.inicio_proceso_at ||
      trabajo.updated_at ||
      trabajo.created_at ||
      null
    );
  }

  if (estado === "pausado") {
    return (
      trabajo.espera_desde || trabajo.updated_at || trabajo.created_at || null
    );
  }

  return trabajo.created_at || trabajo.updated_at || null;
}

function etiquetaFechaTrabajo(trabajo, estadoVisual = null) {
  const estado = estadoVisual || trabajo?.estado || "pendiente";

  if (estado === "finalizado") return "Finalizado";
  if (estado === "en_proceso") return "En proceso";
  if (estado === "pausado") return "Pausado";
  return "Creado";
}

function normalizarFechaTrabajoFinalizado(trabajo) {
  if (!trabajo) return null;

  return (
    trabajo.finalizado_at || trabajo.updated_at || trabajo.created_at || null
  );
}

function trabajoFinalizadoVisibleSegunCierre(trabajo) {
  if (!trabajo) return false;
  if (!cierreDiaActivoDesde) return true;
  if (mostrarFinalizadosDelCierre) return true;

  const fechaTrabajo = normalizarFechaTrabajoFinalizado(trabajo);
  if (!fechaTrabajo) return true;

  return fechaTrabajo >= cierreDiaActivoDesde;
}

function filtrarFinalizadosPorCierre(trabajosFinalizados) {
  const lista = Array.isArray(trabajosFinalizados) ? trabajosFinalizados : [];
  return lista.filter(trabajoFinalizadoVisibleSegunCierre);
}

function trabajoArrastradoDesdeAntesDelCierre(trabajo, estadoVisual = null) {
  if (!cierreDiaActivoDesde) return false;

  const estado = estadoVisual || trabajo?.estado || "pendiente";
  if (estado === "finalizado") return false;

  const fechaTrabajo = trabajo?.created_at || null;
  if (!fechaTrabajo) return false;

  return fechaTrabajo < cierreDiaActivoDesde;
}

// ===== Tiempo =====

function formatearDuracion(segundos) {
  const total = Math.max(0, Number(segundos || 0));

  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);

  if (horas > 0) {
    return minutos > 0 ? `${horas}h ${minutos} min` : `${horas}h`;
  }

  return `${minutos} min`;
}

function formatearHoraCorta(fechaIso) {
  if (!fechaIso) return "—";

  const fecha = new Date(fechaIso);
  if (isNaN(fecha.getTime())) return "—";

  try {
    return fecha.toLocaleTimeString("es-EC", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatearTiempoRestante(segundos) {
  const abs = Math.abs(Math.floor(segundos));
  const horas = Math.floor(abs / 3600);
  const minutos = Math.floor((abs % 3600) / 60);
  const seg = abs % 60;

  if (horas > 0) return `${horas}h ${minutos}m`;
  if (minutos > 0) return `${minutos}m ${seg}s`;
  return `${seg}s`;
}

function segundosTecnicoActivo(tecnico) {
  if (!tecnico) return 0;

  const estado = String(
    tecnico.estado_en_trabajo || tecnico.estado || "",
  ).toLowerCase();

  const inicioActual =
    tecnico.inicio_actual_at ||
    tecnico.asignado_at ||
    tecnico.inicio_at ||
    null;

  let acumulado = Number(
    tecnico.tiempo_real_seg ??
      tecnico.tiempo_acumulado_seg ??
      tecnico.total_trabajado_seg ??
      0,
  );

  if (!Number.isFinite(acumulado) || acumulado < 0) {
    acumulado = 0;
  }

  const sigueActivo =
    tecnico.activo !== false &&
    (estado === "activo" || estado === "trabajando");

  if (sigueActivo && inicioActual) {
    const inicio = new Date(inicioActual);
    const ahora = new Date();

    if (
      !isNaN(inicio.getTime()) &&
      !isNaN(ahora.getTime()) &&
      ahora >= inicio
    ) {
      acumulado += Math.floor((ahora - inicio) / 1000);
    }
  }

  return Math.max(0, acumulado);
}

function obtenerTiempoGuardadoTecnico(tecnicoData) {
  if (!tecnicoData) return 0;

  const valor = Number(
    tecnicoData.tiempo_real_seg ??
      tecnicoData.tiempo_acumulado_seg ??
      tecnicoData.total_trabajado_seg ??
      0,
  );

  return Number.isFinite(valor) && valor >= 0 ? valor : 0;
}

function cerrarTiempoTecnicoEnTrabajo(
  tecnicoTrabajo,
  estadoSalida = "pausado",
) {
  if (!tecnicoTrabajo) return null;

  const copia = { ...tecnicoTrabajo };
  const ahoraIso = new Date().toISOString();
  const acumulado = segundosTecnicoActivo(copia);

  copia.tiempo_real_seg = Math.max(0, acumulado);
  copia.tiempo_acumulado_seg = Math.max(0, acumulado);

  copia.estado = estadoSalida || "pausado";
  copia.estado_en_trabajo = estadoSalida || "pausado";
  copia.activo = false;

  copia.inicio_actual_at = null;
  copia.asignado_at = null;

  copia.pausa_actual_at = null;
  copia.pausado_at = null;
  copia.finalizado_at = null;
  copia.liberado_at = null;

  if (estadoSalida === "finalizado") {
    copia.finalizado_at = ahoraIso;
  } else if (estadoSalida === "pausado") {
    copia.pausa_actual_at = ahoraIso;
    copia.pausado_at = ahoraIso;
  } else {
    copia.liberado_at = ahoraIso;
  }

  return copia;
}

function minutosPendiente(fechaBase) {
  if (!fechaBase) return "";

  const base = new Date(fechaBase);
  const ahora = new Date();

  if (isNaN(base.getTime()) || isNaN(ahora.getTime())) return "";

  const diffMin = Math.floor((ahora - base) / 60000);
  if (diffMin < 0) return "0 min";

  const horas = Math.floor(diffMin / 60);
  const minutos = diffMin % 60;

  if (horas > 0) {
    return minutos > 0 ? `${horas}h ${minutos} min` : `${horas}h`;
  }

  return `${minutos} min`;
}

function segundosHistorialTrabajo(historial, tecnicoActivo) {
  let total = obtenerTiempoGuardadoTecnico(historial);

  if (tecnicoActivo) {
    const tiempoGuardadoActivo = obtenerTiempoGuardadoTecnico(tecnicoActivo);
    const tiempoActivoActual = segundosTecnicoActivo(tecnicoActivo);

    total = Math.max(total, tiempoGuardadoActivo);

    const estado = String(
      tecnicoActivo.estado_en_trabajo || tecnicoActivo.estado || "",
    ).toLowerCase();

    if (
      tecnicoActivo.activo !== false &&
      (estado === "activo" || estado === "trabajando")
    ) {
      total = Math.max(total, tiempoActivoActual);
    }
  }

  return Math.max(0, total);
}

function obtenerCargaActualTecnico(tecnicoId) {
  const trabajos = Array.isArray(ultimoResumen?.trabajos)
    ? ultimoResumen.trabajos
    : [];

  const hoy = new Date();
  const inicioHoy = new Date(
    hoy.getFullYear(),
    hoy.getMonth(),
    hoy.getDate(),
    0,
    0,
    0,
    0,
  );
  const finHoy = new Date(
    hoy.getFullYear(),
    hoy.getMonth(),
    hoy.getDate(),
    23,
    59,
    59,
    999,
  );

  function parseFechaSeguraLocal(fechaIso) {
    if (!fechaIso) return null;
    const fecha = new Date(fechaIso);
    return isNaN(fecha.getTime()) ? null : fecha;
  }

  function cruzaHoy(inicioIso, finIso) {
    const inicio = parseFechaSeguraLocal(inicioIso);
    const fin = parseFechaSeguraLocal(finIso);

    if (!inicio && !fin) return false;

    let inicioReal = inicio || fin;
    let finReal = fin || inicio;

    if (!inicioReal || !finReal) return false;

    if (finReal < inicioReal) {
      const temp = inicioReal;
      inicioReal = finReal;
      finReal = temp;
    }

    if (finReal < inicioHoy) return false;
    if (inicioReal > finHoy) return false;

    return true;
  }

  let actividadesActivas = 0;
  let actividadesCerradasHoy = 0;
  let tiempoActivoSeg = 0;
  let tiempoHoySeg = 0;

  trabajos.forEach((trabajo) => {
    const actividades = Array.isArray(trabajo?.actividades)
      ? trabajo.actividades
      : [];

    actividades.forEach((actividad) => {
      const participantes = Array.isArray(actividad?.participantes)
        ? actividad.participantes
        : [];

      const participante = participantes.find(
        (p) => Number(p?.tecnico_id) === Number(tecnicoId),
      );

      if (!participante) return;

      const estado = String(participante?.estado || "").toLowerCase();
      const sigueActivo = participante?.activo !== false && estado === "activo";

      const inicioParticipacion =
        participante?.asignado_at ||
        participante?.inicio_actual_at ||
        actividad?.primer_inicio_at ||
        actividad?.created_at ||
        trabajo?.created_at ||
        null;

      const finParticipacion = sigueActivo
        ? new Date().toISOString()
        : participante?.finalizado_at ||
          participante?.pausa_actual_at ||
          actividad?.finalizado_at ||
          actividad?.ultima_pausa_at ||
          actividad?.ultima_actividad_at ||
          inicioParticipacion;

      if (!cruzaHoy(inicioParticipacion, finParticipacion)) return;

      const tiempoParticipante = segundosTecnicoActivo(participante);
      tiempoHoySeg += tiempoParticipante;

      if (sigueActivo) {
        actividadesActivas += 1;
        tiempoActivoSeg += tiempoParticipante;
      } else {
        actividadesCerradasHoy += 1;
      }
    });
  });

  return {
    actividadesActivas,
    actividadesTerminadasHoy: actividadesCerradasHoy,
    actividadesHoy: actividadesActivas + actividadesCerradasHoy,
    tiempoActivoSeg,
    tiempoHoySeg,
  };
}

function htmlCargaTecnico(tecnico) {
  if (!tecnico?.id) return "";

  const carga = obtenerCargaActualTecnico(tecnico.id);

  if (!carga.actividadesHoy && !carga.tiempoHoySeg) {
    return `
      <div style="
        margin-top: 6px;
        font-size: 12px;
        color: #4b5563;
        line-height: 1.25;
      ">
        <span style="font-weight: 600;">📊 Sin carga hoy</span>
      </div>
    `;
  }

  return `
    <div style="
      margin-top: 6px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      line-height: 1.25;
    ">
      <div style="
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      ">
        <span style="font-weight: 700; color: #1f2937;">
          📊 Hoy: ${carga.actividadesHoy}
        </span>
        <span style="font-weight: 700; color: #1f2937;">
          ⏱ ${formatearDuracion(carga.tiempoHoySeg)}
        </span>
      </div>

      <div style="
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        color: #374151;
      ">
        <span><strong>Activas:</strong> ${carga.actividadesActivas}</span>
        <span><strong>Terminadas:</strong> ${carga.actividadesTerminadasHoy}</span>
      </div>
    </div>
  `;
}

function numeroActividadesHoyTecnico(tecnicoId) {
  if (!tecnicoId || typeof obtenerCargaActualTecnico !== "function") return 0;

  const carga = obtenerCargaActualTecnico(tecnicoId) || {};
  return Number(carga.actividadesHoy || 0);
}

let holdTecnicoEventualTimer = null;
function iniciarHoldTecnicoEventual(tecnicoId, activoActual) {
  cancelarHoldTecnicoEventual();

  holdTecnicoEventualTimer = setTimeout(() => {
    abrirModalConfirmacion({
      titulo: activoActual
        ? "Deshabilitar técnico eventual"
        : "Habilitar técnico eventual",
      texto: activoActual
        ? "Este técnico eventual dejará de estar disponible."
        : "Este técnico eventual volverá a estar disponible.",
      boton: activoActual ? "Deshabilitar" : "Habilitar",
      claseBoton: activoActual ? "btn-danger" : "btn-success",
      onConfirm: async () => {
        await toggleActivoTecnicoEventual(tecnicoId, !activoActual);
      },
    });
  }, 700);
}

function cancelarHoldTecnicoEventual() {
  if (holdTecnicoEventualTimer) {
    clearTimeout(holdTecnicoEventualTimer);
    holdTecnicoEventualTimer = null;
  }
}

async function toggleActivoTecnicoEventual(tecnicoId, nuevoActivo) {
  try {
    const tecnicoRef = window.db.collection("tecnicos").doc(String(tecnicoId));
    const doc = await tecnicoRef.get();

    if (!doc.exists) return;

    const tecnico = doc.data();

    // 🚨 SI ESTÁ TRABAJANDO NO PERMITIR DESHABILITAR
    if (!nuevoActivo && tecnico.trabajo_id) {
      abrirModalConfirmacion({
        titulo: "Técnico en trabajo",
        texto:
          "Este técnico está asignado a un trabajo. Debes liberarlo antes de deshabilitarlo.",
        boton: "Entendido",
        claseBoton: "btn-secundario",
        onConfirm: () => {},
      });
      return;
    }

    await tecnicoRef.update({ activo: nuevoActivo });
  } catch (error) {
    console.error("Error actualizando técnico eventual:", error);
    alert("No se pudo actualizar el técnico eventual.");
  }
}
async function habilitarTecnicoDesdeAcciones(tecnicoId) {
  if (!validarBatuta()) return;

  const clave = `habilitar-tecnico-${tecnicoId}`;
  if (!iniciarAccion(clave)) return;

  try {
    const tecnicoRef = window.db.collection("tecnicos").doc(String(tecnicoId));
    const tecnicoSnap = await tecnicoRef.get();

    if (!tecnicoSnap.exists) {
      alert("Técnico no encontrado.");
      return;
    }

    await tecnicoRef.update({
      activo: true,
    });

    cerrarModalAccionesTecnico();
  } catch (error) {
    console.error("Error habilitando técnico:", error);
    alert("No se pudo habilitar el técnico.");
  } finally {
    finalizarAccion(clave);
  }
}

async function deshabilitarTecnicoDesdeAcciones(tecnicoId) {
  if (!validarBatuta()) return;

  const clave = `deshabilitar-tecnico-${tecnicoId}`;
  if (!iniciarAccion(clave)) return;

  try {
    const tecnicoRef = window.db.collection("tecnicos").doc(String(tecnicoId));

    await tecnicoRef.update({
      activo: false,
      trabajo_id: null,
      estado: "libre",
    });

    cerrarModalAccionesTecnico();
  } catch (error) {
    console.error("Error deshabilitando técnico:", error);
    alert("No se pudo deshabilitar el técnico.");
  } finally {
    finalizarAccion(clave);
  }
}
function formatearEstado(estado) {
  if (!estado) return "";

  return estado.replaceAll("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
}
function abrirModalLogout(e) {
  e.preventDefault();
  document.getElementById("modalLogout").classList.remove("hidden");
}

function cancelarLogout() {
  document.getElementById("modalLogout").classList.add("hidden");
}

function ejecutarLogout() {
  cerrarMenu();
  window.location.href = "/logout";
}

function actualizarMenuSegunEstado() {
  const formRecuperar = document.getElementById("formRecuperarBatuta");
  const formTransferir = document.getElementById("formTransferirBatuta");
  const formSoltar = document.getElementById("formSoltarBatuta");
  const btnCierreDia = document.getElementById("btnCierreDia");

  const menuReportes = document.getElementById("menuReportes");
  const menuUsuarios = document.getElementById("menuUsuarios");
  const menuTecnicos = document.getElementById("menuTecnicos");
  const menuVendedores = document.getElementById("menuVendedores");

  const seccionSupervision = document.getElementById("menuSeccionSupervision");
  const seccionGestion = document.getElementById("menuSeccionGestion");
  const seccionSistema = document.getElementById("menuSeccionSistema");
  const seccionCuenta = document.getElementById("menuSeccionCuenta");

  const nivelUsuarioTexto = document.getElementById("nivelUsuarioTexto");
  const cardCrearTrabajo = document.getElementById("cardCrearTrabajo");

  const puedeCrearTrabajosBase =
    usuarioActualCache?.puede_crear_trabajos === true;

  PUEDE_GESTIONAR_UI = ES_ADMIN || TIENE_BATUTA;
  PUEDE_CREAR_TRABAJOS = ES_ADMIN || TIENE_BATUTA || puedeCrearTrabajosBase;

  if (formRecuperar) {
    formRecuperar.style.display = ES_ADMIN ? "block" : "none";
  }

  if (formTransferir) {
    formTransferir.style.display = ES_ADMIN || TIENE_BATUTA ? "flex" : "none";
  }

  if (formSoltar) {
    formSoltar.style.display = TIENE_BATUTA && !ES_ADMIN ? "block" : "none";
  }

  if (btnCierreDia) {
    btnCierreDia.style.display = ES_ADMIN || TIENE_BATUTA ? "block" : "none";
  }

  if (menuReportes) {
    menuReportes.style.display = ES_ADMIN ? "block" : "none";
  }

  if (menuUsuarios) {
    menuUsuarios.style.display = ES_ADMIN ? "block" : "none";
  }

  if (menuTecnicos) {
    menuTecnicos.style.display = ES_ADMIN ? "block" : "none";
  }

  if (menuVendedores) {
    menuVendedores.style.display = ES_ADMIN ? "block" : "none";
  }

  const visibilidad = [
    { el: seccionSupervision, visible: ES_ADMIN || TIENE_BATUTA },
    { el: seccionGestion, visible: ES_ADMIN },
    { el: seccionSistema, visible: ES_ADMIN || TIENE_BATUTA },
    { el: seccionCuenta, visible: true },
  ];

  visibilidad.forEach(({ el, visible }) => {
    if (!el) return;
    el.classList.toggle("oculta", !visible);
    el.classList.remove("primera-visible");
  });

  const primeraVisible = visibilidad.find((v) => v.el && v.visible);
  if (primeraVisible?.el) {
    primeraVisible.el.classList.add("primera-visible");
  }

  if (nivelUsuarioTexto) {
    nivelUsuarioTexto.textContent = ES_ADMIN
      ? "Administrador"
      : TIENE_BATUTA
        ? "Gestión activa"
        : puedeCrearTrabajosBase
          ? "Creación de trabajos"
          : "Consulta";
  }

  if (cardCrearTrabajo) {
    cardCrearTrabajo.style.display = PUEDE_CREAR_TRABAJOS ? "block" : "none";
  }
}
document.addEventListener("click", function (e) {
  const menu = document.querySelector(".panel-menu");

  if (!menu) return;

  const clicDentro = menu.contains(e.target);

  if (!clicDentro) {
    menu.removeAttribute("open");
  }
});

function cerrarMenu() {
  const menu = document.querySelector(".panel-menu");
  if (menu) {
    menu.removeAttribute("open");
  }
}
