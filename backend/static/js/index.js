console.log("index.js cargado correctamente");

console.log("🔥 FIREBASE FUNCIONANDO");

window.addEventListener("DOMContentLoaded", () => {
  console.log("🌍 ENTORNO ACTIVO:", window.APP_ENV || "no definido");
});

let vendedorEdicionSeleccionado = null;
let origenEdicionSeleccionado = null;
let actividadEditandoTrabajoId = null;
let modoActividad = "editar"; // "editar" o "nuevo"
let actividadEditandoId = null;
let cierreDiaActivoDesde = null;
let mostrarFinalizadosDelCierre = false;
let ultimoTrabajoCreadoId = null;
let vendedorSeleccionado = null;
let origenTrabajoSeleccionado = null;
let vendedoresCache = null;
let trabajoAsignacionId = null;
let actividadAsignacionId = null;
let estadoTecnicoActualId = null;
let estadoTecnicoSeleccionado = null;
let ultimoResumen = { trabajos: [], tecnicos: [] };
let mostrarFinalizados = false;
let mostrarOtrosTecnicos = false;
let holdTecnicoTimer = null;
let holdTecnicoEjecutado = false;
const tecnicosExpandidos = new Set();
const tecnicosAsignacionExpandidos = new Set();
const trabajosColapsados = new Set();
const trabajosExpandidosFinalizados = new Set();
let unsubscribeTrabajos = null;
let unsubscribeActividades = null;
let unsubscribeTecnicos = null;
let unsubscribeVendedores = null;
let timerRefrescoMinutos = null;
let accionPendiente = null;
let accionCancelPendiente = null;
let trabajoSinTecnicosPendiente = null;
const accionesEnProceso = new Set();
let mantenerAccionesCrearTrabajoFlotantes = false;
let PUEDE_GESTIONAR_UI = false;
let usuarioActualCache = null;
let nombreBatutaCache = {};

let TIENE_BATUTA =
  document.getElementById("config")?.dataset.tieneBatuta === "true";
let PUEDE_CREAR_TRABAJOS =
  document.getElementById("config")?.dataset.puedeCrearTrabajos === "true";
let ES_ADMIN = window.ES_ADMIN;
const USUARIO_ID_ACTUAL = Number(window.USUARIO_ID_ACTUAL);
function puedeGestionar() {
  return TIENE_BATUTA || ES_ADMIN;
}

function validarBatuta() {
  if (puedeGestionar()) return true;
  alert("Solo quien tiene la batuta puede gestionar técnicos y trabajos.");
  return false;
}

function enfocarSiguienteCampoCreacion(origen) {
  setTimeout(() => {
    if (origen === "interno") {
      const inputSolicitante = document.getElementById("solicitanteInterno");
      if (inputSolicitante) {
        inputSolicitante.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        inputSolicitante.focus();
        inputSolicitante.select();
      }
      return;
    }

    const textareaDescripcion = document.getElementById("descripcion");
    if (textareaDescripcion) {
      textareaDescripcion.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      textareaDescripcion.focus();
      textareaDescripcion.setSelectionRange(
        textareaDescripcion.value.length,
        textareaDescripcion.value.length,
      );
    }
  }, 80);
}

function obtenerInsetTecladoVisual() {
  if (!window.visualViewport) return 0;

  const viewport = window.visualViewport;
  const inset = window.innerHeight - (viewport.height + viewport.offsetTop);

  return Math.max(0, Math.round(inset));
}

function actualizarBotonesCrearTrabajoMovil() {
  const acciones = document.querySelector(".acciones-crear-trabajo");
  if (!acciones) return;

  const esMovil = window.innerWidth <= 640;
  const activo = document.activeElement;

  const campoAbierto =
    activo &&
    (activo.id === "descripcion" || activo.id === "solicitanteInterno");

  if (!esMovil) {
    acciones.classList.remove("flotante-movil");
    acciones.style.bottom = "";
    return;
  }

  if (!campoAbierto && !mantenerAccionesCrearTrabajoFlotantes) {
    acciones.classList.remove("flotante-movil");
    acciones.style.bottom = "";
    return;
  }

  acciones.classList.add("flotante-movil");

  const inset = obtenerInsetTecladoVisual();
  acciones.style.bottom = `${Math.max(10, inset + 10)}px`;
}

function obtenerFechaLocalISO() {
  const now = new Date();

  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);

  return local.toISOString().split("T")[0]; // YYYY-MM-DD
}

function registrarComportamientoBotonesCrearTrabajoMovil() {
  const descripcion = document.getElementById("descripcion");
  const solicitante = document.getElementById("solicitanteInterno");
  const acciones = document.querySelector(".acciones-crear-trabajo");

  if (descripcion) {
    descripcion.addEventListener("focus", actualizarBotonesCrearTrabajoMovil);
    descripcion.addEventListener("blur", () => {
      setTimeout(() => {
        if (!mantenerAccionesCrearTrabajoFlotantes) {
          actualizarBotonesCrearTrabajoMovil();
        }
      }, 120);
    });
    descripcion.addEventListener("input", actualizarBotonesCrearTrabajoMovil);
  }

  if (solicitante) {
    solicitante.addEventListener("focus", actualizarBotonesCrearTrabajoMovil);
    solicitante.addEventListener("blur", () => {
      setTimeout(() => {
        if (!mantenerAccionesCrearTrabajoFlotantes) {
          actualizarBotonesCrearTrabajoMovil();
        }
      }, 120);
    });
    solicitante.addEventListener("input", actualizarBotonesCrearTrabajoMovil);
  }

  if (acciones) {
    acciones.addEventListener("pointerdown", () => {
      mantenerAccionesCrearTrabajoFlotantes = true;
      actualizarBotonesCrearTrabajoMovil();
    });

    acciones.addEventListener("pointerup", () => {
      setTimeout(() => {
        mantenerAccionesCrearTrabajoFlotantes = false;
        actualizarBotonesCrearTrabajoMovil();
      }, 220);
    });

    acciones.addEventListener("click", () => {
      setTimeout(() => {
        mantenerAccionesCrearTrabajoFlotantes = false;
        actualizarBotonesCrearTrabajoMovil();
      }, 220);
    });
  }

  window.addEventListener("resize", actualizarBotonesCrearTrabajoMovil);

  if (window.visualViewport) {
    window.visualViewport.addEventListener(
      "resize",
      actualizarBotonesCrearTrabajoMovil,
    );
    window.visualViewport.addEventListener(
      "scroll",
      actualizarBotonesCrearTrabajoMovil,
    );
  }

  document.addEventListener("focusin", actualizarBotonesCrearTrabajoMovil);
  document.addEventListener("focusout", () => {
    setTimeout(() => {
      if (!mantenerAccionesCrearTrabajoFlotantes) {
        actualizarBotonesCrearTrabajoMovil();
      }
    }, 120);
  });
}

async function cargarVendedores() {
  const contenedor = document.getElementById("vendedores");
  contenedor.innerHTML = "";

  const btnInterno = document.createElement("button");
  btnInterno.className = "btn-vendedor";
  btnInterno.textContent = "Interno";

  btnInterno.onclick = () => {
    origenTrabajoSeleccionado = "interno";
    vendedorSeleccionado = null;

    document
      .querySelectorAll("#vendedores .btn-vendedor")
      .forEach((b) => b.classList.remove("activo"));
    btnInterno.classList.add("activo");

    document.getElementById("vendedorSeleccionadoTexto").textContent =
      "Origen seleccionado: Interno";
    document.getElementById("bloqueSolicitanteInterno").style.display = "block";

    enfocarSiguienteCampoCreacion("interno");
  };

  contenedor.appendChild(btnInterno);

  try {
    if (!Array.isArray(vendedoresCache)) {
      return;
    }

    vendedoresCache.forEach((v) => {
      if (v.activo === false) return;

      const btn = document.createElement("button");
      btn.className = "btn-vendedor";
      btn.textContent = v.nombre;

      btn.onclick = () => {
        origenTrabajoSeleccionado = "vendedor";
        vendedorSeleccionado = v;

        document
          .querySelectorAll("#vendedores .btn-vendedor")
          .forEach((b) => b.classList.remove("activo"));
        btn.classList.add("activo");

        document.getElementById("vendedorSeleccionadoTexto").textContent =
          "Vendedor seleccionado: " + v.nombre;
        document.getElementById("bloqueSolicitanteInterno").style.display =
          "none";
        document.getElementById("solicitanteInterno").value = "";

        enfocarSiguienteCampoCreacion("vendedor");
      };

      contenedor.appendChild(btn);
    });
  } catch (error) {
    console.error("ERROR FIRESTORE VENDEDORES:", error);
    alert("Firestore: " + (error.message || JSON.stringify(error)));
  }
}

async function crearTrabajo() {
  if (!PUEDE_CREAR_TRABAJOS) {
    alert("No tienes permisos para crear trabajos.");
    return;
  }

  const clave = "crear-trabajo";
  if (!iniciarAccion(clave)) return;

  const btnCrear = document.getElementById("btnCrearTrabajo");
  const textoOriginalBtn = btnCrear ? btnCrear.textContent : "";

  try {
    if (btnCrear) {
      btnCrear.disabled = true;
      btnCrear.textContent = "Guardando...";
    }

    const descripcion = document.getElementById("descripcion").value.trim();
    const solicitanteInterno =
      document.getElementById("solicitanteInterno")?.value.trim() || "";

    if (!descripcion) {
      alert("Debes escribir la descripción del trabajo.");
      return;
    }

    if (!origenTrabajoSeleccionado) {
      alert("Debes seleccionar un origen del trabajo.");
      return;
    }

    const trabajosRef = window.db.collection("trabajos");
    const contadorRef = window.db.collection("config").doc("contadores");

    const nuevoId = await window.db.runTransaction(async (transaction) => {
      const contadorSnap = await transaction.get(contadorRef);

      let ultimoId = 0;

      if (contadorSnap.exists) {
        ultimoId = Number(contadorSnap.data().ultimo_trabajo_id || 0);
      }

      const siguienteId = ultimoId + 1;

      transaction.set(
        contadorRef,
        { ultimo_trabajo_id: siguienteId },
        { merge: true },
      );

      return siguienteId;
    });

    let vendedorId = null;
    let vendedorNombre = null;
    let solicitanteNombre = null;
    let responsableNombre = null;

    if (origenTrabajoSeleccionado === "vendedor") {
      if (!vendedorSeleccionado) {
        alert("Debes seleccionar un vendedor.");
        return;
      }

      vendedorId = vendedorSeleccionado.id ?? null;
      vendedorNombre = vendedorSeleccionado.nombre ?? null;
      responsableNombre = vendedorSeleccionado.nombre ?? "";
    }

    if (origenTrabajoSeleccionado === "interno") {
      if (!solicitanteInterno) {
        alert("Debes escribir quién solicita el trabajo interno.");
        return;
      }

      solicitanteNombre = solicitanteInterno;
      responsableNombre = solicitanteInterno;
    }

    const ahora = new Date().toISOString();

    const trabajo = {
      id: nuevoId,
      descripcion: descripcion,
      origen: origenTrabajoSeleccionado,
      vendedor_id: vendedorId,
      vendedor_nombre: vendedorNombre,
      solicitante_nombre: solicitanteNombre,
      responsable_nombre: responsableNombre,
      creado_por_usuario_id: String(window.USUARIO_ID_ACTUAL || ""),
      creado_por_nombre: String(window.USUARIO_NOMBRE_ACTUAL || ""),
      estado: "pendiente",
      created_at: ahora,
      fecha_local: obtenerFechaLocalISO(), // 👈 NUEVO
      primer_inicio_at: null,
      finalizado_at: null,
      ultima_actividad_at: null,
      total_actividades: 1,
      actividades_pendientes: 1,
      actividades_en_proceso: 0,
      actividades_pausadas: 0,
      actividades_finalizadas: 0,
      tecnicos_activos_count: 0,
      tecnicos_participantes_count: 0,
      tiempo_espera_seg: 0,
      tiempo_real_seg: 0,
      tiempo_hombre_seg: 0,
      tiempo_pausa_seg: 0,
      activo: true,
    };

    ultimoTrabajoCreadoId = nuevoId;
    trabajosColapsados.delete(nuevoId);

    const actividadId = `act_${String(nuevoId).padStart(6, "0")}_01`;
    const actividadesRef = window.db.collection("actividades");
    const actividadInicial = {
      id: actividadId,
      trabajo_id: nuevoId,
      orden: 1,
      descripcion: descripcion,
      estado: "pendiente",
      origen: origenTrabajoSeleccionado,
      responsable_nombre: responsableNombre,
      created_at: ahora,
      fecha_local: obtenerFechaLocalISO(), // 👈 NUEVO
      primer_inicio_at: null,
      ultima_reanudacion_at: null,
      ultima_pausa_at: null,
      finalizado_at: null,
      ultima_actividad_at: null,
      tecnicos_activos_ids: [],
      tecnicos_activos_nombres: [],
      tecnicos_activos_count: 0,
      tecnicos_participantes_ids: [],
      tecnicos_participantes_count: 0,
      ultimo_tecnicos_ids: [],
      ultimo_tecnicos_nombres: [],
      tiempo_espera_seg: 0,
      tiempo_real_seg: 0,
      tiempo_hombre_seg: 0,
      tiempo_pausa_seg: 0,
      inicio_tramo_activo_at: null,
      inicio_tramo_pausa_at: null,
      creado_por_usuario_id: String(window.USUARIO_ID_ACTUAL || ""),
      creado_por_nombre: String(window.USUARIO_NOMBRE_ACTUAL || ""),
      participantes: [],
      activo: true,
    };

    const batch = window.db.batch();
    batch.set(trabajosRef.doc(String(nuevoId)), trabajo);
    batch.set(actividadesRef.doc(actividadId), actividadInicial);
    await batch.commit();

    limpiarFormulario();
  } catch (error) {
    console.error("Error guardando trabajo en Firestore:", error);
    alert("No se pudo guardar el trabajo en Firestore.");
  } finally {
    if (btnCrear) {
      btnCrear.disabled = false;
      btnCrear.textContent = textoOriginalBtn || "Crear trabajo";
    }
    finalizarAccion(clave);
  }
}

function limpiarFormulario() {
  vendedorSeleccionado = null;
  origenTrabajoSeleccionado = null;

  document.getElementById("descripcion").value = "";
  document.getElementById("solicitanteInterno").value = "";
  document.getElementById("bloqueSolicitanteInterno").style.display = "none";
  document.getElementById("vendedorSeleccionadoTexto").textContent =
    "Ningún origen seleccionado";

  document
    .querySelectorAll("#vendedores .btn-vendedor")
    .forEach((b) => b.classList.remove("activo"));
}

function accionOcupada(clave) {
  return accionesEnProceso.has(clave);
}

function iniciarAccion(clave) {
  if (accionesEnProceso.has(clave)) return false;
  accionesEnProceso.add(clave);
  return true;
}

function finalizarAccion(clave) {
  accionesEnProceso.delete(clave);
}

function inyectarEstilosTrabajosMixtos() {
  if (document.getElementById("estilos-trabajos-mixtos")) return;

  const style = document.createElement("style");
  style.id = "estilos-trabajos-mixtos";
  style.textContent = `
    .trabajo-card.trabajo-en-proceso-mixto {
      border: 2px solid #f59e0b !important;
      box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.12);
    }

    .trabajo-card.trabajo-en-proceso-mixto .trabajo-top-linea {
      background: rgba(245, 158, 11, 0.08);
      border-radius: 10px;
      padding: 6px 8px;
    }

    .trabajo-card.trabajo-en-proceso-mixto .trabajo-titulo {
      color: #b45309;
    }
  `;

  document.head.appendChild(style);
}

function estadoVisualTrabajo(trabajo) {
  const actividades = Array.isArray(trabajo?.actividades)
    ? trabajo.actividades
    : [];

  if (actividades.length === 0) {
    return trabajo?.estado || "pendiente";
  }

  const tieneEnProceso = actividades.some(
    (a) => (a.estado || "").toLowerCase() === "en_proceso",
  );
  const tienePendientes = actividades.some(
    (a) => (a.estado || "").toLowerCase() === "pendiente",
  );
  const tienePausadas = actividades.some(
    (a) => (a.estado || "").toLowerCase() === "pausado",
  );

  const todasFinalizadas = actividades.every(
    (a) => String(a?.estado || "").toLowerCase() === "finalizado",
  );

  if (tieneEnProceso) return "en_proceso";
  if (tienePausadas) return "pausado";
  if (tienePendientes) return "pendiente";
  if (todasFinalizadas) return "finalizado";

  return trabajo?.estado || "pendiente";
}

function htmlTiempoPendiente(trabajo) {
  if (!trabajo) return "";

  const inicio = trabajo.created_at;
  const fin = trabajo.finalizado_at || new Date().toISOString();

  if (!inicio) return "";

  const fechaInicio = new Date(inicio);
  const fechaFin = new Date(fin);

  if (isNaN(fechaInicio.getTime()) || isNaN(fechaFin.getTime())) return "";

  const diffMin = Math.floor((fechaFin - fechaInicio) / 60000);
  const minutos = diffMin < 0 ? 0 : diffMin;

  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;

  let texto = "";
  if (horas > 0) {
    texto = mins > 0 ? `${horas}h ${mins} min` : `${horas}h`;
  } else {
    texto = `${mins} min`;
  }

  return `<div class="tiempo-pendiente">${texto}</div>`;
}

function toggleTrabajoCard(trabajoId) {
  const trabajo = (ultimoResumen.trabajos || []).find(
    (t) => t.id === trabajoId,
  );
  if (!trabajo) return;

  const expandido = trabajoExpandidoVisual(trabajo);

  const estadoVisual = estadoVisualTrabajo(trabajo);

  if (estadoVisual === "finalizado") {
    if (expandido) {
      trabajosExpandidosFinalizados.delete(trabajo.id);
    } else {
      trabajosExpandidosFinalizados.add(trabajo.id);
    }
  } else {
    if (expandido) {
      trabajosColapsados.add(trabajo.id);
    } else {
      trabajosColapsados.delete(trabajo.id);
    }
  }

  renderizarPanelPrincipal(ultimoResumen);
}

function seleccionarOrigenEdicion(tipo) {
  origenEdicionSeleccionado = tipo;

  const btnV = document.getElementById("btnEditarOrigenVendedor");
  const btnI = document.getElementById("btnEditarOrigenInterno");

  const bloqueV = document.getElementById("bloqueEditarVendedor");
  const bloqueI = document.getElementById("bloqueEditarSolicitante");

  if (tipo === "vendedor") {
    btnV.classList.add("activo");
    btnI.classList.remove("activo");

    bloqueV.style.display = "block";
    bloqueI.style.display = "none";
  } else {
    btnI.classList.add("activo");
    btnV.classList.remove("activo");

    bloqueV.style.display = "none";
    bloqueI.style.display = "block";
  }
}

function cambiarColapsoPorEstado(estado, expandir) {
  const lista = (ultimoResumen.trabajos || []).filter(
    (t) => estadoVisualTrabajo(t) === estado,
  );

  lista.forEach((tr) => {
    if (estado === "finalizado") {
      if (expandir) trabajosExpandidosFinalizados.add(tr.id);
      else trabajosExpandidosFinalizados.delete(tr.id);
    } else {
      if (expandir) trabajosColapsados.delete(tr.id);
      else trabajosColapsados.add(tr.id);
    }
  });

  renderizarPanelPrincipal(ultimoResumen);
}

function trabajoExpandidoVisual(trabajo) {
  const estadoVisual = estadoVisualTrabajo(trabajo);

  if (estadoVisual === "finalizado") {
    return trabajosExpandidosFinalizados.has(trabajo.id);
  }
  return !trabajosColapsados.has(trabajo.id);
}

function resumenTrabajoColapsado(trabajo) {
  const estadoVisual = estadoVisualTrabajo(trabajo);
  const descripcion = trabajo.descripcion || "Sin descripción";
  const descripcionCorta =
    descripcion.length > 80
      ? descripcion.substring(0, 80) + "..."
      : descripcion;

  const responsable = nombreResponsable(trabajo);

  const actividades = Array.isArray(trabajo?.actividades)
    ? trabajo.actividades
    : [];

  let activos = 0;
  const participantesUnicos = new Set();

  actividades.forEach((act) => {
    const tecnicosActivos = Array.isArray(act?.tecnicos_activos_ids)
      ? act.tecnicos_activos_ids
      : [];

    const participantes = Array.isArray(act?.participantes)
      ? act.participantes
      : [];

    activos += tecnicosActivos.length;

    participantes.forEach((p) => {
      const tecnicoId = Number(p?.tecnico_id || 0);
      if (tecnicoId > 0) {
        participantesUnicos.add(tecnicoId);
      }
    });
  });

  const historicos = participantesUnicos.size;

  let estadoTexto = "";
  let resumenEquipo = "";

  switch (estadoVisual) {
    case "finalizado":
      estadoTexto = "Finalizado";
      resumenEquipo =
        historicos > 0
          ? `${historicos} técnico${historicos === 1 ? "" : "s"} participaron`
          : "Sin técnicos registrados";
      break;

    case "en_proceso":
      estadoTexto = "En proceso";
      resumenEquipo = `${activos} activo${activos === 1 ? "" : "s"} ahora`;
      if (historicos > activos) {
        resumenEquipo += ` · ${historicos} en total`;
      }
      break;

    case "pausado":
      estadoTexto = "Pausado";
      resumenEquipo =
        activos > 0
          ? `${activos} activo${activos === 1 ? "" : "s"}`
          : historicos > 0
            ? `${historicos} que han pasado`
            : "Sin técnicos activos";
      break;

    default:
      estadoTexto = "Pendiente";
      resumenEquipo =
        activos > 0
          ? `${activos} activo${activos === 1 ? "" : "s"}`
          : historicos > 0
            ? `${historicos} registrado${historicos === 1 ? "" : "s"}`
            : "Sin asignar";
      break;
  }

  return `
    <div class="trabajo-resumen-colapsado">
      <div class="trabajo-resumen-colapsado-top">
        <div class="trabajo-resumen-colapsado-titulo">${escapeHtml(descripcionCorta)}</div>
        <span class="badge-estado-mini ${escapeHtml((estadoVisual || "pendiente").toLowerCase())}">
          ${escapeHtml(estadoTexto)}
        </span>
      </div>
      <div class="trabajo-resumen-meta-colapsado">
        <span class="trabajo-resumen-responsable">${escapeHtml(responsable)}</span>
        <span class="trabajo-resumen-separador">•</span>
        <span class="trabajo-resumen-equipo">${escapeHtml(resumenEquipo)}</span>
      </div>
    </div>
  `;
}

function participanteEstaEnAlmuerzo(participante) {
  const tecnicoId = Number(participante?.tecnico_id || 0);
  if (!tecnicoId) return false;

  const tecnicoReal = Array.isArray(ultimoResumen?.tecnicos)
    ? ultimoResumen.tecnicos.find((t) => Number(t?.id) === tecnicoId)
    : null;

  if (!tecnicoReal) return false;

  return String(tecnicoReal?.estado || "").toLowerCase() === "almuerzo";
}

function htmlTecnicosActividad(trabajo, act) {
  const participantes = Array.isArray(act?.participantes)
    ? act.participantes.filter((p) => p?.visible_en_tarjeta !== false)
    : [];

  const participantesActivos = participantes.filter(
    (p) => String(p?.estado || "").toLowerCase() === "activo",
  );

  const participantesAlmuerzo = participantes.filter((p) => {
    const estado = String(p?.estado || "").toLowerCase();
    return estado === "pausado" && participanteEstaEnAlmuerzo(p);
  });

  const participantesPausados = participantes.filter((p) => {
    const estado = String(p?.estado || "").toLowerCase();
    return estado === "pausado" && !participanteEstaEnAlmuerzo(p);
  });

  const participantesFinalizados = participantes.filter(
    (p) => String(p?.estado || "").toLowerCase() === "finalizado",
  );

  const participantesOtros = participantes.filter((p) => {
    const estado = String(p?.estado || "").toLowerCase();

    if (estado === "activo") return false;
    if (estado === "finalizado") return false;
    if (estado === "pausado") return false;

    return true;
  });

  const calcularTiempoParticipanteSeg = (participante) => {
    const acumulado = Number(participante?.tiempo_real_seg || 0);
    const inicioActual = participante?.inicio_actual_at;

    if (
      participante?.activo !== false &&
      String(participante?.estado || "").toLowerCase() === "activo" &&
      inicioActual
    ) {
      const inicio = new Date(inicioActual);
      if (!isNaN(inicio.getTime())) {
        const ahora = new Date();
        const extra = Math.max(0, Math.floor((ahora - inicio) / 1000));
        return acumulado + extra;
      }
    }

    return acumulado;
  };

  const obtenerInfoAlmuerzoParticipante = (participante) => {
    const tecnicoId = Number(participante?.tecnico_id || 0);
    if (!tecnicoId) return "";

    const tecnicoReal = Array.isArray(ultimoResumen?.tecnicos)
      ? ultimoResumen.tecnicos.find((t) => Number(t?.id) === tecnicoId)
      : null;

    if (!tecnicoReal) return "";

    const almuerzoHasta = tecnicoReal?.almuerzo_hasta;
    if (!almuerzoHasta) return "En almuerzo";

    const regreso = new Date(almuerzoHasta);
    if (isNaN(regreso.getTime())) return "En almuerzo";

    const ahora = new Date();
    const faltanSeg = Math.floor((regreso - ahora) / 1000);

    if (faltanSeg >= 0) {
      return `Regresa en ${formatearTiempoRestante(faltanSeg)}`;
    }

    return `Atrasado ${formatearTiempoRestante(faltanSeg)}`;
  };

  const textoEstadoParticipante = (participante) => {
    const estado = String(participante?.estado || "").toLowerCase();

    if (estado === "activo") return "Trabajando";
    if (estado === "pausado" && participanteEstaEnAlmuerzo(participante)) {
      return "Almorzando";
    }
    if (estado === "pausado") return "Pausado";
    if (estado === "finalizado") return "Finalizado";
    if (estado === "liberado") return "Liberado";

    return estado ? formatearEstado(estado) : "Sin estado";
  };

  const claseEstadoParticipante = (participante) => {
    const estado = String(participante?.estado || "").toLowerCase();

    if (estado === "activo") return "trabajando";
    if (estado === "pausado" && participanteEstaEnAlmuerzo(participante)) {
      return "almuerzo";
    }
    if (estado === "pausado") return "pausado";
    if (estado === "finalizado") return "finalizado";
    if (estado === "liberado") return "liberado";

    return "sin-estado";
  };

  const htmlParticipante = (p, esActivo = false) => {
    const tiempoTrabajo = formatearDuracion(calcularTiempoParticipanteSeg(p));
    const infoAlmuerzo = participanteEstaEnAlmuerzo(p)
      ? obtenerInfoAlmuerzoParticipante(p)
      : "";
    const estadoActividad = String(act?.estado || "").toLowerCase();
    const estadoParticipante = String(p?.estado || "").toLowerCase();

    const puedePausarParticipacion =
      estadoActividad !== "finalizado" && estadoParticipante === "activo";

    const puedeReanudar =
      estadoActividad !== "finalizado" && estadoParticipante === "pausado";

    const puedeFinalizarParticipacion =
      estadoActividad !== "finalizado" && estadoParticipante !== "finalizado";

    return `
<div class="tecnico-trabajo-item" style="margin-top:8px;">
  <div class="tecnico-trabajo-top">
    <div class="tecnico-trabajo-nombre">${escapeHtml(p.tecnico_nombre || "Técnico")}</div>
    <div class="tecnico-trabajo-meta">
      ${
        String(act.estado || "").toLowerCase() === "finalizado"
          ? ""
          : `<span class="tecnico-trabajo-estado estado-${escapeHtml(claseEstadoParticipante(p))}">
         ${escapeHtml(textoEstadoParticipante(p))}
       </span>`
      }
      <span class="tecnico-trabajo-tiempo">${escapeHtml(tiempoTrabajo)}</span>
    </div>
  </div>

  ${
    infoAlmuerzo
      ? `<div style="margin-top:4px; font-size:12px; color:#b45309; font-weight:600;">
${escapeHtml(infoAlmuerzo)}
</div>`
      : ""
  }

${
  puedeGestionar() &&
  (puedePausarParticipacion || puedeReanudar || puedeFinalizarParticipacion)
    ? `
<div class="tecnico-trabajo-acciones" onclick="event.stopPropagation()">
  ${
    puedePausarParticipacion
      ? `
  <button
    type="button"
    class="btn-icono-trabajo pausar"
    title="Pausar participación"
    onclick='event.stopPropagation(); pedirPausarParticipacion(${trabajo.id}, ${JSON.stringify(act.id || "")}, ${Number(p.tecnico_id)})'
  >⏸</button>
  `
      : ""
  }

  ${
    puedeReanudar
      ? `
  <button
    type="button"
    class="btn-icono-trabajo reanudar"
    title="Reanudar participación"
    onclick='event.stopPropagation(); reanudarParticipacionEnActividad(${trabajo.id}, ${JSON.stringify(act.id || "")}, ${Number(p.tecnico_id)})'
  >▶</button>
  `
      : ""
  }

  ${
    puedeFinalizarParticipacion
      ? `
  <button
    type="button"
    class="btn-icono-trabajo finalizar"
    title="Finalizar participación"
    onclick='event.stopPropagation(); pedirLiberarTecnico(${trabajo.id}, ${JSON.stringify(act.id || "")}, ${Number(p.tecnico_id)})'
  >✓</button>
  `
      : ""
  }
</div>
`
    : ""
}

  ${
    p.asignado_por_nombre
      ? `<div style="margin-top:4px; font-size:12px; color:#667085;">
Asignado por: ${escapeHtml(p.asignado_por_nombre)}
</div>`
      : ""
  }
</div>
`;
  };

  const bloques = [];

  if (participantesActivos.length > 0) {
    bloques.push(
      participantesActivos.map((p) => htmlParticipante(p, true)).join(""),
    );
  }

  if (participantesAlmuerzo.length > 0) {
    bloques.push(
      participantesAlmuerzo.map((p) => htmlParticipante(p, false)).join(""),
    );
  }

  if (participantesPausados.length > 0) {
    bloques.push(
      participantesPausados.map((p) => htmlParticipante(p, false)).join(""),
    );
  }

  if (participantesFinalizados.length > 0) {
    bloques.push(
      participantesFinalizados.map((p) => htmlParticipante(p, false)).join(""),
    );
  }

  if (bloques.length > 0) {
    return bloques.join("");
  }

  const contenidoOtros = participantesOtros
    .map((p) => htmlParticipante(p, false))
    .join("");

  if (contenidoOtros) {
    return contenidoOtros;
  }

  return `<div style="margin-top:6px; font-size:13px; color:#667085;">Sin técnicos asignados</div>`;
}

function htmlAccionesActividad(trabajo, act) {
  if (!puedeGestionar()) return "";

  const estado = String(act?.estado || "pendiente").toLowerCase();

  const participantes = Array.isArray(act?.participantes)
    ? act.participantes
    : [];

  const tieneActivos = Array.isArray(act?.tecnicos_activos_ids)
    ? act.tecnicos_activos_ids.length > 0
    : false;

  const tieneParticipantesPrevios = participantes.some(
    (p) => Number(p?.tecnico_id) > 0,
  );

  const puedeEditar = estado !== "finalizado";

  const puedeAsignar =
    estado === "pendiente" || estado === "en_proceso" || estado === "pausado";

  const puedePausar = estado === "en_proceso" && tieneActivos;

  const puedeReanudar = estado === "pausado" && tieneParticipantesPrevios;

  const puedeCerrar =
    estado !== "finalizado" &&
    estado !== "pendiente" &&
    (tieneActivos || tieneParticipantesPrevios);
  const puedeEliminarPendiente =
    estado === "pendiente" && !tieneParticipantesPrevios;

  return `
<div class="actividad-acciones">
${
  puedeEditar
    ? `
<button
class="btn-actividad editar"
title="Editar actividad"
onclick='event.stopPropagation(); abrirModalEditarActividad(${trabajo.id}, ${JSON.stringify(act.id || "")})'
>✎</button>
`
    : ""
}

${
  puedeAsignar
    ? `
<button
class="btn-actividad asignar"
title="Asignar técnico"
onclick='event.stopPropagation(); mostrarAsignacion(${trabajo.id}, ${JSON.stringify(act.id || "")})'
>👷</button>
`
    : ""
}

${
  puedePausar
    ? `
<button
class="btn-actividad pausar"
title="Pausar actividad"
onclick='event.stopPropagation(); confirmarPausarActividad(${trabajo.id}, ${JSON.stringify(act.id || "")})'
>⏸</button>
`
    : ""
}

${
  puedeReanudar
    ? `
<button
class="btn-actividad reanudar"
title="Reanudar actividad"
onclick='event.stopPropagation(); reanudarActividad(${trabajo.id}, ${JSON.stringify(act.id || "")})'
>▶</button>
`
    : ""
}

${
  puedeCerrar
    ? `
<button
class="btn-actividad finalizar"
title="Cerrar actividad"
onclick='event.stopPropagation(); confirmarCerrarActividad(${trabajo.id}, ${JSON.stringify(act.id || "")})'
>✓</button>
`
    : ""
}

${
  puedeEliminarPendiente
    ? `
<button
class="btn-actividad eliminar"
title="Eliminar actividad pendiente"
onclick='event.stopPropagation(); pedirEliminarActividadPendiente(${trabajo.id}, ${JSON.stringify(act.id || "")})'
>🗑</button>
`
    : ""
}
</div>
`;
}

function confirmarPausarActividad(trabajoId, actividadId) {
  if (!validarBatuta()) return;

  const trabajo = (ultimoResumen.trabajos || []).find(
    (t) => Number(t.id) === Number(trabajoId),
  );

  if (!trabajo) {
    alert("No se encontró el trabajo.");
    return;
  }

  const actividades = Array.isArray(trabajo.actividades)
    ? trabajo.actividades
    : [];

  const actividad = actividades.find(
    (a) => String(a?.id || "").trim() === String(actividadId || "").trim(),
  );

  if (!actividad) {
    alert("No se encontró la actividad.");
    return;
  }

  const participantes = Array.isArray(actividad.participantes)
    ? actividad.participantes
    : [];

  const participantesActivos = participantes.filter(
    (p) =>
      p?.activo !== false && String(p?.estado || "").toLowerCase() === "activo",
  );

  const nombresTecnicos = participantesActivos.length
    ? participantesActivos
        .map((p) => escapeHtml(p.tecnico_nombre || "Técnico"))
        .join(", ")
    : "Sin técnicos activos";

  abrirModalConfirmacion({
    titulo: "Pausar actividad",
    texto:
      "La actividad quedará pausada y los técnicos activos quedarán libres.",
    destacado: `
<strong>Actividad:</strong> ${escapeHtml(actividad.descripcion || "Actividad")}<br>
<strong>Técnico(s):</strong> ${nombresTecnicos}
`,
    boton: "Pausar actividad",
    claseBoton: "btn-secundario",
    onConfirm: async () => {
      await pausarActividad(trabajoId, actividadId);
    },
  });
}

function htmlActividadCard(trabajo, act, index) {
  const estado = String(act?.estado || "pendiente").toLowerCase();
  const estadoTexto = estado.replaceAll("_", " ");

  const htmlTecnicos = htmlTecnicosActividad(trabajo, act);

  return `
<div class="actividad-card">
<div class="actividad-header">
<div class="actividad-descripcion">
${index + 1}. ${escapeHtml(act?.descripcion || "Sin descripción")}
</div>

<div class="actividad-lado-derecho">
<span class="actividad-estado estado-${estado}">
${escapeHtml(estadoTexto)}
</span>

${htmlAccionesActividad(trabajo, act)}
</div>
</div>

<div class="actividad-body">
${htmlTecnicos}
</div>
</div>
`;
}

function htmlActividadesTrabajo(trabajo) {
  const actividades = Array.isArray(trabajo.actividades)
    ? trabajo.actividades
    : [];

  if (actividades.length === 0) {
    return `
<div class="trabajo-tecnicos-vacio">
Sin actividades registradas
</div>
`;
  }

  const items = actividades
    .map((act, index) => {
      return htmlActividadCard(trabajo, act, index);
    })
    .join("");

  return `<div class="trabajo-tecnicos-lista">${items}</div>`;
}

function obtenerTecnicosActivosDesdeActividades(trabajo) {
  const actividades = Array.isArray(trabajo?.actividades)
    ? trabajo.actividades
    : [];

  const mapa = new Map();

  actividades.forEach((act) => {
    const participantes = Array.isArray(act?.participantes)
      ? act.participantes
      : [];

    participantes.forEach((p) => {
      const tecnicoId = Number(p?.tecnico_id || 0);
      const estado = String(p?.estado || "").toLowerCase();

      if (tecnicoId <= 0) return;
      if (p?.activo === false) return;
      if (estado !== "activo") return;

      if (!mapa.has(tecnicoId)) {
        mapa.set(tecnicoId, {
          id: tecnicoId,
          nombre: p?.tecnico_nombre || "Técnico",
          estado_en_trabajo: estado,
          asignado_at: p?.asignado_at || null,
          inicio_actual_at: p?.inicio_actual_at || null,
          tiempo_real_seg: Number(p?.tiempo_real_seg || 0),
          tiempo_pausa_seg: Number(p?.tiempo_pausa_seg || 0),
          actividad_descripcion: act?.descripcion || "Actividad",
          actividad_id: act?.id || null,
        });
      }
    });
  });

  return Array.from(mapa.values());
}

function contarActividadesSinTecnico(trabajo) {
  const actividades = Array.isArray(trabajo?.actividades)
    ? trabajo.actividades
    : [];

  return actividades.filter((a) => {
    const estado = String(a?.estado || "").toLowerCase();

    const tieneActivos = Array.isArray(a?.tecnicos_activos_ids)
      ? a.tecnicos_activos_ids.length > 0
      : false;

    return !tieneActivos && (estado === "pendiente" || estado === "en_proceso");
  }).length;
}

function tienePendientesInternasEnProceso(trabajo) {
  if (estadoVisualTrabajo(trabajo) !== "en_proceso") {
    return false;
  }

  const actividades = Array.isArray(trabajo?.actividades)
    ? trabajo.actividades
    : [];

  const tieneActividadPausada = actividades.some(
    (a) => String(a?.estado || "").toLowerCase() === "pausado",
  );

  const tieneActividadSinTecnico = contarActividadesSinTecnico(trabajo) > 0;

  const tieneParticipacionPausadaEnActividadEnProceso = actividades.some(
    (a) => {
      const estadoActividad = String(a?.estado || "").toLowerCase();
      if (estadoActividad !== "en_proceso") return false;

      const participantes = Array.isArray(a?.participantes)
        ? a.participantes
        : [];

      return participantes.some(
        (p) => String(p?.estado || "").toLowerCase() === "pausado",
      );
    },
  );

  return (
    tieneActividadPausada ||
    tieneActividadSinTecnico ||
    tieneParticipacionPausadaEnActividadEnProceso
  );
}

function tecnicoDisponibleParaReanudarParticipacion(tecnicoId) {
  const tecnico = Array.isArray(ultimoResumen?.tecnicos)
    ? ultimoResumen.tecnicos.find((t) => Number(t?.id) === Number(tecnicoId))
    : null;

  if (!tecnico) return false;

  return (
    tecnico.activo !== false &&
    String(tecnico.estado || "").toLowerCase() === "libre"
  );
}

function resumirEstadosTrabajoDesdeActividades(actividades) {
  const lista = Array.isArray(actividades) ? actividades : [];

  const actividadesPendientes = lista.filter(
    (a) => String(a?.estado || "").toLowerCase() === "pendiente",
  ).length;

  const actividadesEnProceso = lista.filter(
    (a) => String(a?.estado || "").toLowerCase() === "en_proceso",
  ).length;

  const actividadesPausadas = lista.filter(
    (a) => String(a?.estado || "").toLowerCase() === "pausado",
  ).length;

  const actividadesFinalizadas = lista.filter(
    (a) => String(a?.estado || "").toLowerCase() === "finalizado",
  ).length;

  let nuevoEstadoTrabajo = "pendiente";
  if (actividadesEnProceso > 0) nuevoEstadoTrabajo = "en_proceso";
  else if (actividadesPausadas > 0) nuevoEstadoTrabajo = "pausado";
  else if (actividadesPendientes > 0) nuevoEstadoTrabajo = "pendiente";
  else if (lista.length > 0) nuevoEstadoTrabajo = "finalizado";

  const tecnicosActivosTotal = lista.reduce(
    (acc, a) => acc + Number(a?.tecnicos_activos_count || 0),
    0,
  );

  const tecnicosParticipantesSet = new Set();
  lista.forEach((a) => {
    const ids = Array.isArray(a?.tecnicos_participantes_ids)
      ? a.tecnicos_participantes_ids
      : [];
    ids.forEach((id) => {
      const n = Number(id);
      if (n > 0) tecnicosParticipantesSet.add(n);
    });
  });

  return {
    nuevoEstadoTrabajo,
    actividadesPendientes,
    actividadesEnProceso,
    actividadesPausadas,
    actividadesFinalizadas,
    tecnicosActivosTotal,
    tecnicosParticipantesCount: tecnicosParticipantesSet.size,
  };
}

function trabajoPendienteSePuedeEliminar(trabajo) {
  const actividades = Array.isArray(trabajo?.actividades)
    ? trabajo.actividades
    : [];

  if (actividades.length === 0) return true;

  return actividades.every((act) => {
    const estado = String(act?.estado || "").toLowerCase();

    const participantes = Array.isArray(act?.participantes)
      ? act.participantes
      : [];

    const tecnicosParticipantesIds = Array.isArray(
      act?.tecnicos_participantes_ids,
    )
      ? act.tecnicos_participantes_ids
      : [];

    const tuvoParticipacion =
      participantes.some((p) => Number(p?.tecnico_id || 0) > 0) ||
      tecnicosParticipantesIds.some((id) => Number(id || 0) > 0);

    if (tuvoParticipacion) return false;

    if (
      estado === "finalizado" ||
      estado === "pausado" ||
      estado === "en_proceso"
    ) {
      return false;
    }

    return true;
  });
}

function htmlHeaderTrabajo(
  tr,
  estadoVisual,
  expandido,
  arrastrado,
  fechaLabel,
  fechaTexto,
  sinTecnico,
) {
  const puedeEliminarPendiente =
    estadoVisual === "pendiente" &&
    puedeGestionar() &&
    trabajoPendienteSePuedeEliminar(tr);

  return `
<div class="trabajo-top-linea">
  <div class="trabajo-top-fila trabajo-top-fila-1">
    <div class="trabajo-top-minutos">
      ${htmlTiempoPendiente(tr)}
    </div>

    <div class="trabajo-top-alerta">
      ${
        sinTecnico > 0
          ? `
      <div class="badge-alerta">
        ⚠ ${sinTecnico} sin técnico
      </div>
      `
          : `<div class="trabajo-top-alerta-vacio"></div>`
      }
    </div>

    <div class="trabajo-top-orden">
      <div class="fecha-chip">#${tr.id}</div>
    </div>
  </div>

  <div class="trabajo-top-fila trabajo-top-fila-2">
    <div class="trabajo-acciones-icono" onclick="event.stopPropagation()">
      <button class="btn-icono-trabajo resumen" title="Ver resumen" onclick="abrirResumenTrabajo(${tr.id})">📋</button>
      ${estadoVisual !== "finalizado" && puedeGestionar() ? `<button class="btn-icono-trabajo editar" title="Editar trabajo" onclick='editar(${tr.id}, ${JSON.stringify(tr.descripcion || "")})'>✎</button>` : ""}
      ${(estadoVisual === "pendiente" || estadoVisual === "en_proceso") && puedeGestionar() ? `<button class="btn-icono-trabajo asignar" title="Agregar actividad" onclick="agregarActividadATrabajo(${tr.id})">＋</button>` : ""}
      ${(estadoVisual === "en_proceso" || estadoVisual === "pausado" || estadoVisual === "pendiente") && puedeGestionar() ? `<button class="btn-icono-trabajo finalizar" title="Finalizar trabajo completo" onclick="pedirFinalizarTrabajo(${tr.id})">✓</button>` : ""}
      ${puedeEliminarPendiente ? `<button class="btn-icono-trabajo finalizar" title="Eliminar trabajo" onclick="pedirEliminarTrabajoPendiente(${tr.id})">🗑️</button>` : ""}
      <button class="btn-icono-trabajo colapsar" title="${expandido ? "Colapsar" : "Expandir"}" onclick="toggleTrabajoCard(${tr.id})">${expandido ? "▲" : "▼"}</button>
    </div>
  </div>

  <div class="trabajo-top-fila trabajo-top-fila-3">
    <div class="trabajo-top-estado-fecha">
      ${arrastrado ? `<div class="fecha-chip chip-arrastrado">↪ Arrastrado</div>` : ""}
      <div class="fecha-chip">📅 ${escapeHtml(fechaLabel)}: ${escapeHtml(fechaTexto)}</div>
    </div>
  </div>
</div>
`;
}

function htmlContenidoExpandidoTrabajo(tr) {
  return `
<div class="trabajo-encabezado">
<div class="trabajo-titulo-wrap">
<div class="trabajo-titulo-linea">
<div class="trabajo-titulo">${escapeHtml(tr.descripcion || "")}</div>
</div>
<div class="trabajo-vendedor-chip ${tr.origen === "interno" ? "interno" : "vendedor"}">
${tr.origen === "interno" ? "Interno" : "Vendedor"}: ${escapeHtml(nombreResponsable(tr))}
</div>
${
  tr.creado_por_nombre
    ? `<div class="nota-ayuda" style="margin-top:6px;">
         Creado por: ${escapeHtml(tr.creado_por_nombre)}
       </div>`
    : ""
}
<div class="trabajo-fechas">
${tr.finalizado_at ? `<div class="fecha-chip">✅ Finalizado: ${escapeHtml(formatearFechaCorta(tr.finalizado_at))}</div>` : ""}
</div>
</div>
</div>
<div class="trabajo-tecnicos">
<strong>Actividades del trabajo:</strong>
${htmlActividadesTrabajo(tr)}
</div>
`;
}

function crearCardTrabajo(tr) {
  const estadoVisual = estadoVisualTrabajo(tr);
  const div = document.createElement("div");
  const expandido = trabajoExpandidoVisual(tr);
  const fechaRef = fechaReferenciaTrabajo(tr, estadoVisual);
  const fechaTexto = formatearFechaCorta(fechaRef);
  const fechaLabel = etiquetaFechaTrabajo(tr, estadoVisual);
  const arrastrado = trabajoArrastradoDesdeAntesDelCierre(tr, estadoVisual);
  const sinTecnico = contarActividadesSinTecnico(tr);
  const tienePendientesInternas = tienePendientesInternasEnProceso(tr);

  div.className = `trabajo-card estado-${estadoVisual} ${expandido ? "expandido" : "colapsado"} ${arrastrado ? "trabajo-arrastrado" : ""} ${tr.origen === "interno" ? "trabajo-interno" : "trabajo-vendedor"} ${tienePendientesInternas ? "trabajo-en-proceso-mixto" : ""}`;
  div.dataset.estado = estadoVisual;
  div.id = `trabajo-card-${tr.id}`;
  div.onclick = () => toggleTrabajoCard(tr.id);

  div.innerHTML = `
${htmlHeaderTrabajo(tr, estadoVisual, expandido, arrastrado, fechaLabel, fechaTexto, sinTecnico)}

${expandido ? htmlContenidoExpandidoTrabajo(tr) : resumenTrabajoColapsado(tr)}
`;

  return div;
}

function ponerVacio(contenedor, mensaje) {
  contenedor.innerHTML = `<div class="vacio">${mensaje}</div>`;
}

function htmlInfoAlmuerzoTecnico(tecnico) {
  if (tecnico.estado !== "almuerzo") return "";

  const salida = tecnico.almuerzo_desde;
  const regreso = tecnico.almuerzo_hasta;

  if (!salida && !regreso) {
    return `
<div class="tecnico-almuerzo-box">
<div class="tecnico-linea-info">
<span class="tecnico-etiqueta">Almuerzo</span>
<span class="tecnico-valor">En almuerzo</span>
</div>
</div>
`;
  }

  const ahora = new Date();
  const regresoFecha = regreso ? new Date(regreso) : null;
  const faltanSeg = regresoFecha
    ? Math.floor((regresoFecha - ahora) / 1000)
    : null;
  const estaAtrasado = faltanSeg !== null ? faltanSeg < 0 : false;

  let textoCuenta = "Sin hora estimada";
  if (faltanSeg !== null) {
    textoCuenta = estaAtrasado
      ? `Atrasado ${formatearTiempoRestante(faltanSeg)}`
      : `Faltan ${formatearTiempoRestante(faltanSeg)}`;
  }

  return `
<div class="tecnico-almuerzo-box">
<div class="tecnico-linea-info">
<span class="tecnico-etiqueta">Salida almuerzo</span>
<span class="tecnico-valor">${escapeHtml(formatearHoraCorta(salida))}</span>
</div>
<div class="tecnico-linea-info">
<span class="tecnico-etiqueta">Regreso estimado</span>
<span class="tecnico-valor">${escapeHtml(formatearHoraCorta(regreso))}</span>
</div>
<div class="tecnico-almuerzo-tiempo ${estaAtrasado ? "atrasado" : "ok"}">
${escapeHtml(textoCuenta)}
</div>
</div>
`;
}
function resumenRapidoTrabajo(trabajoActual) {
  if (!trabajoActual) return "Sin trabajo asignado";

  const detalle = trabajoActual.descripcion
    ? String(trabajoActual.descripcion)
    : "Sin detalle";

  const detalleCorto =
    detalle.length > 55 ? detalle.substring(0, 55) + "..." : detalle;

  return `${detalleCorto} · ${nombreResponsable(trabajoActual)}`;
}
function htmlResumenColapsadoTecnico(tecnico, trabajoActual) {
  if (tecnico.estado !== "almuerzo") {
    return `<div class="tecnico-resumen-colapsado">${escapeHtml(resumenRapidoTrabajo(trabajoActual))}</div>`;
  }

  const salida = tecnico.almuerzo_desde;
  const regreso = tecnico.almuerzo_hasta;
  const ahora = new Date();
  const regresoFecha = regreso ? new Date(regreso) : null;
  const faltanSeg = regresoFecha
    ? Math.floor((regresoFecha - ahora) / 1000)
    : null;
  const estaAtrasado = faltanSeg !== null ? faltanSeg < 0 : false;

  let textoTiempo = "Sin hora estimada";
  if (faltanSeg !== null) {
    textoTiempo = estaAtrasado
      ? `Atrasado ${formatearTiempoRestante(faltanSeg)}`
      : `Faltan ${formatearTiempoRestante(faltanSeg)}`;
  }

  return `
<div class="tecnico-resumen-colapsado tecnico-resumen-almuerzo">
<div><strong>Salida:</strong> ${escapeHtml(formatearHoraCorta(salida))}</div>
<div><strong>Regreso:</strong> ${escapeHtml(formatearHoraCorta(regreso))}</div>
<div class="tecnico-almuerzo-tiempo ${estaAtrasado ? "atrasado" : "ok"}">
${escapeHtml(textoTiempo)}
</div>
</div>
`;
}

function iniciarHoldTecnico(tecnicoId) {
  if (!puedeGestionar()) return;
  cancelarHoldTecnico();
  holdTecnicoEjecutado = false;

  holdTecnicoTimer = setTimeout(() => {
    holdTecnicoEjecutado = true;
    mostrarAccionesTecnico(tecnicoId);
  }, 600);
}
function mostrarAccionesTecnico(tecnicoId) {
  const tecnico = (ultimoResumen.tecnicos || []).find(
    (t) => t.id === tecnicoId,
  );

  if (!tecnico) {
    alert("No se encontró el técnico.");
    return;
  }

  const esEventual = (tecnico.tipo || "fijo") === "eventual";
  const tieneDiaLibre = tecnico.dia_libre === true;

  const resumen = document.getElementById("accionesTecnicoResumen");
  const opciones = document.getElementById("accionesTecnicoOpciones");

  if (resumen) {
    resumen.innerHTML = `
<strong>${tecnico.nombre}</strong><br>
Tipo: ${tecnico.tipo || "fijo"}<br>
Estado: ${tecnico.estado}<br>
Activo: ${tecnico.activo ? "Sí" : "No"}
`;
  }

  let htmlOpciones = "";

  if (esEventual) {
    if (tecnico.activo) {
      htmlOpciones = `
<button class="estado-opcion" onclick="deshabilitarTecnicoDesdeAcciones(${tecnico.id})">
Deshabilitar
</button>
`;
    } else {
      htmlOpciones = `
<button class="estado-opcion" onclick="habilitarTecnicoDesdeAcciones(${tecnico.id})">
Habilitar
</button>
`;
    }
  } else {
    if (tecnico.activo) {
      const yaAlmorzoHoy = almuerzoEsDeHoy(tecnico);

      htmlOpciones = `
${
  tecnico.estado === "almuerzo"
    ? `
<button
class="estado-opcion"
onclick="cerrarModalAccionesTecnico(); abrirModalConfirmacion({
titulo: 'Confirmar regreso de almuerzo',
texto: '¿Confirmas que este técnico regresó del almuerzo?',
destacado: '<strong>Técnico:</strong> ${escapeHtml(tecnico.nombre || "Técnico")}',
boton: 'Confirmar regreso',
claseBoton: 'btn-principal',
onConfirm: async () => {
await cambiarEstadoTecnico(${tecnico.id}, { estado: 'libre' });
}
})"
>
Regreso de almuerzo
</button>
`
    : !yaAlmorzoHoy
      ? `
<button
class="estado-opcion"
onclick="cerrarModalAccionesTecnico(); abrirModalEstadoTecnico(${tecnico.id}, 'almuerzo')"
>
Enviar a almuerzo
</button>
`
      : ""
}
<button
class="estado-opcion"
onclick="cerrarModalAccionesTecnico(); toggleDiaLibreTecnico(${tecnico.id}, ${tieneDiaLibre ? "false" : "true"})"
>
${tieneDiaLibre ? "Quitar día libre" : "Marcar día libre"}
</button>

${
  tecnico.estado === "trabajando"
    ? `
<div style="
font-size: 12px;
color: #b54708;
margin-top: 6px;
text-align: center;
font-weight: 500;
">
🔧 En trabajo activo
</div>
`
    : tecnico.estado === "almuerzo"
      ? `
<div style="
font-size: 12px;
color: #1d4ed8;
margin-top: 6px;
text-align: center;
font-weight: 500;
">
🍽️ En almuerzo
</div>
`
      : `
<button
class="estado-opcion"
onclick="deshabilitarTecnicoDesdeAcciones(${tecnico.id})"
>
Deshabilitar
</button>
`
}
  `;
    } else {
      htmlOpciones = `
  <button class="estado-opcion" onclick="habilitarTecnicoDesdeAcciones(${tecnico.id})">
  Habilitar
  </button>
  `;
    }
  }

  if (opciones) {
    opciones.innerHTML = htmlOpciones;
  }

  abrirModalAccionesTecnico();
}
function cancelarHoldTecnico() {
  if (holdTecnicoTimer) {
    clearTimeout(holdTecnicoTimer);
    holdTecnicoTimer = null;
  }
}

function holdTecnicoFueEjecutado() {
  const ejecutado = holdTecnicoEjecutado;
  holdTecnicoEjecutado = false;
  return ejecutado;
}

function toggleTecnicoPanel(tecnicoId) {
  if (tecnicosExpandidos.has(tecnicoId)) {
    tecnicosExpandidos.delete(tecnicoId);
  } else {
    tecnicosExpandidos.add(tecnicoId);
  }
  renderizarPanelPrincipal(ultimoResumen);
}
function obtenerTrabajosPorEstado(trabajos) {
  const lista = Array.isArray(trabajos) ? [...trabajos] : [];

  const obtenerFechaMs = (...fechas) => {
    for (const valor of fechas) {
      if (!valor) continue;
      const ms = new Date(valor).getTime();
      if (!Number.isNaN(ms)) return ms;
    }
    return 0;
  };

  const trabajosPendientes = lista
    .filter((t) => estadoVisualTrabajo(t) === "pendiente")
    .sort((a, b) => {
      const sinTecnicoA = contarActividadesSinTecnico(a);
      const sinTecnicoB = contarActividadesSinTecnico(b);

      if (sinTecnicoA !== sinTecnicoB) {
        return sinTecnicoB - sinTecnicoA;
      }

      const fa = obtenerFechaMs(a.espera_desde, a.created_at);
      const fb = obtenerFechaMs(b.espera_desde, b.created_at);
      return fa - fb;
    });

  const trabajosProceso = lista
    .filter((t) => estadoVisualTrabajo(t) === "en_proceso")
    .sort((a, b) => {
      const sinTecnicoA = contarActividadesSinTecnico(a);
      const sinTecnicoB = contarActividadesSinTecnico(b);

      if (sinTecnicoA !== sinTecnicoB) {
        return sinTecnicoB - sinTecnicoA;
      }

      const fa = obtenerFechaMs(
        a.inicio_proceso_at,
        a.primer_inicio_at,
        a.created_at,
      );
      const fb = obtenerFechaMs(
        b.inicio_proceso_at,
        b.primer_inicio_at,
        b.created_at,
      );
      return fb - fa;
    });

  const trabajosPausados = lista
    .filter((t) => estadoVisualTrabajo(t) === "pausado")
    .sort((a, b) => {
      const sinTecnicoA = contarActividadesSinTecnico(a);
      const sinTecnicoB = contarActividadesSinTecnico(b);

      if (sinTecnicoA !== sinTecnicoB) {
        return sinTecnicoB - sinTecnicoA;
      }

      const fa = obtenerFechaMs(a.espera_desde, a.created_at);
      const fb = obtenerFechaMs(b.espera_desde, b.created_at);
      return fb - fa;
    });

  const trabajosFinalizados = filtrarFinalizadosPorCierre(
    lista.filter((t) => estadoVisualTrabajo(t) === "finalizado"),
  );

  return {
    trabajosPendientes,
    trabajosProceso,
    trabajosPausados,
    trabajosFinalizados,
  };
}
function actualizarContadoresTrabajos({
  trabajosPendientes,
  trabajosProceso,
  trabajosPausados,
  trabajosFinalizados,
}) {
  document.getElementById("contadorPendientes").textContent =
    trabajosPendientes.length;
  document.getElementById("contadorProceso").textContent =
    trabajosProceso.length;
  document.getElementById("contadorPausados").textContent =
    trabajosPausados.length;
  document.getElementById("contadorFinalizados").textContent =
    trabajosFinalizados.length;
}

function renderizarColumnaTrabajos(contenedor, trabajos, mensajeVacio) {
  contenedor.innerHTML = "";

  if (!Array.isArray(trabajos) || trabajos.length === 0) {
    ponerVacio(contenedor, mensajeVacio);
    return;
  }

  trabajos.forEach((tr) => {
    contenedor.appendChild(crearCardTrabajo(tr));
  });
}

function renderizarSeccionFinalizados(finalizados, trabajosFinalizados) {
  finalizados.innerHTML = "";

  const filtroFinalizados = (
    document.getElementById("buscarFinalizados")?.value || ""
  )
    .trim()
    .toLowerCase();

  if (!mostrarFinalizados) {
    finalizados.innerHTML = `<div class="texto-finalizados-ocultos">Finalizados ocultos para mantener el panel operativo más limpio.</div>`;
    return;
  }

  const finalizadosFiltrados = !filtroFinalizados
    ? trabajosFinalizados
    : trabajosFinalizados.filter((tr) =>
        textoBusquedaFinalizado(tr).includes(filtroFinalizados),
      );

  renderizarColumnaTrabajos(
    finalizados,
    finalizadosFiltrados,
    filtroFinalizados
      ? "No se encontraron finalizados con ese criterio."
      : "No hay trabajos finalizados.",
  );
}

function obtenerContenedoresTrabajos() {
  return {
    pendientes: document.getElementById("pendientes"),
    proceso: document.getElementById("proceso"),
    pausados: document.getElementById("pausados"),
    finalizados: document.getElementById("finalizados"),
  };
}

function renderizarColumnasPrincipalesTrabajos(contenedores, grupos) {
  renderizarColumnaTrabajos(
    contenedores.pendientes,
    grupos.trabajosPendientes,
    "No hay trabajos pendientes.",
  );

  renderizarColumnaTrabajos(
    contenedores.proceso,
    grupos.trabajosProceso,
    "No hay trabajos en proceso.",
  );

  renderizarColumnaTrabajos(
    contenedores.pausados,
    grupos.trabajosPausados,
    "No hay trabajos pausados.",
  );
}
function obtenerResumenTrabajos(data) {
  const trabajos = Array.isArray(data?.trabajos) ? data.trabajos : [];
  return obtenerTrabajosPorEstado(trabajos);
}

function renderizarPanelTrabajos(contenedores, grupos) {
  actualizarContadoresTrabajos(grupos);

  renderizarColumnasPrincipalesTrabajos(contenedores, grupos);

  renderizarSeccionFinalizados(
    contenedores.finalizados,
    grupos.trabajosFinalizados,
  );
}

function renderizarTrabajos(data) {
  const contenedores = obtenerContenedoresTrabajos();
  const grupos = obtenerResumenTrabajos(data);

  renderizarPanelTrabajos(contenedores, grupos);
}

function crearCardTecnico(t, trabajosPorId) {
  const item = document.createElement("div");
  const trabajoActual = t.trabajo_id ? trabajosPorId[t.trabajo_id] : null;
  const expandido =
    (t.tipo || "fijo") === "eventual" && t.activo === false
      ? false
      : tecnicosExpandidos.has(t.id);
  const resumenTrabajo = trabajoActual?.descripcion || "";
  const resumenCorto =
    resumenTrabajo.length > 80
      ? resumenTrabajo.substring(0, 80) + "..."
      : resumenTrabajo;

  const htmlInfoExtra = trabajoActual
    ? `
  <div class="tecnico-info-extra">
  <div class="tecnico-linea-info">
  <span class="tecnico-etiqueta">Vehículo / trabajo</span>
  <span class="tecnico-valor">${escapeHtml(resumenCorto || "Sin detalle")}</span>
  </div>
  <div class="tecnico-linea-info">
  <span class="tecnico-etiqueta">Responsable</span>
  <span class="tecnico-valor">${escapeHtml(nombreResponsable(trabajoActual))}</span>
  </div>
  ${htmlInfoAlmuerzoTecnico(t)}
  <div class="tecnico-ayuda-click">Toca de nuevo la tarjeta para volver a colapsarla</div>
  <div class="tecnico-acciones-secundarias" onclick="event.stopPropagation()">
  <button class="btn-secundario" onclick="irATrabajo(${trabajoActual.id})">Ir al trabajo</button>
  </div>
  </div>
  `
    : `
  <div class="tecnico-info-extra">
  <div class="tecnico-info-vacio">Sin trabajo asignado en este momento</div>
  ${htmlInfoAlmuerzoTecnico(t)}
  </div>
  `;

  const esEventual = (t.tipo || "fijo") === "eventual";
  const eventualInactivo = esEventual && t.activo === false;

  const htmlAcciones = "";

  item.className = `tecnico-item estado-${t.estado} ${expandido ? "expandido" : "colapsado"} ${trabajoActual ? "clickeable" : ""} ${esEventual ? "tecnico-eventual" : ""} ${t.activo === false ? "tecnico-inactivo" : ""} ${eventualInactivo ? "tecnico-eventual-inactivo" : ""}`;

  item.onclick = () => {
    if (eventualInactivo) return;
    if (holdTecnicoFueEjecutado()) return;
    toggleTecnicoPanel(t.id);
  };

  const estadoTexto =
    t.estado === "trabajando"
      ? "🔵 Trabajando"
      : t.estado === "almuerzo"
        ? "🟡 Almuerzo"
        : "🟢 Libre";

  item.innerHTML = `
  <div class="tecnico-header">
  <div class="tecnico-nombre">
  ${escapeHtml(t.nombre)}
  ${esEventual ? `<span class="badge-eventual">Eventual</span>` : ""}
  ${almuerzoEsDeHoy(t) ? `<span class="badge-almuerzo-hecho" title="Ya almorzó hoy">🍽️</span>` : ""}
  ${!esEventual && t.dia_libre ? `<span class="badge-dia-libre">Día libre</span>` : ""}
  </div>
  <div class="tecnico-estado">${escapeHtml(estadoTexto)}</div>
  </div>

  ${
    (t.estado || "").toLowerCase() === "trabajando"
      ? `
  ${htmlResumenColapsadoTecnico(t, trabajoActual)}
  ${htmlCargaTecnico(t)}
  `
      : `
  ${htmlCargaTecnico(t)}
  ${htmlResumenColapsadoTecnico(t, trabajoActual)}
  `
  }
  <div class="tecnico-ayuda-colapsado">
  ${eventualInactivo ? "Mantén presionado para habilitar" : "Toca para ver más"}
  </div>

  ${htmlInfoExtra}
  ${htmlAcciones}
  `;

  item.addEventListener("mousedown", () => iniciarHoldTecnico(t.id));
  item.addEventListener("mouseup", cancelarHoldTecnico);
  item.addEventListener("mouseleave", cancelarHoldTecnico);

  item.addEventListener("touchstart", () => iniciarHoldTecnico(t.id), {
    passive: true,
  });
  item.addEventListener("touchmove", cancelarHoldTecnico, {
    passive: true,
  });
  item.addEventListener("touchend", cancelarHoldTecnico);
  item.addEventListener("touchcancel", cancelarHoldTecnico);

  return item;
}

function obtenerTrabajosPorId(trabajos) {
  const mapa = {};
  const lista = Array.isArray(trabajos) ? trabajos : [];

  lista.forEach((tr) => {
    if (tr && tr.id != null) {
      mapa[tr.id] = tr;
    }
  });

  return mapa;
}

function ordenarTecnicos(tecnicos) {
  const lista = Array.isArray(tecnicos) ? [...tecnicos] : [];

  const grupoTecnico = (t) => {
    const tipo = (t?.tipo || "fijo").toLowerCase();
    const activo = t?.activo !== false;

    if (activo && tipo !== "eventual") return 0;
    if (activo && tipo === "eventual") return 1;
    if (!activo && tipo !== "eventual") return 2;
    return 3;
  };

  const prioridadEstado = (t) => {
    if (t?.dia_libre === true) return 3;

    const estado = (t?.estado || "libre").toLowerCase();

    if (estado === "libre") return 0;
    if (estado === "trabajando") return 1;
    if (estado === "almuerzo") return 2;

    return 4;
  };

  const cargaTecnico = (t) => {
    if (!t?.id || typeof obtenerCargaActualTecnico !== "function") {
      return {
        actividadesHoy: 0,
        tiempoHoySeg: 0,
      };
    }

    const carga = obtenerCargaActualTecnico(t.id) || {};

    return {
      actividadesHoy: Number(carga.actividadesHoy || 0),
      tiempoHoySeg: Number(carga.tiempoHoySeg || 0),
    };
  };

  return lista.sort((a, b) => {
    const ga = grupoTecnico(a);
    const gb = grupoTecnico(b);

    if (ga !== gb) return ga - gb;

    if (ga >= 2) {
      return (a?.nombre || "").localeCompare(b?.nombre || "", "es", {
        sensitivity: "base",
      });
    }

    const pa = prioridadEstado(a);
    const pb = prioridadEstado(b);

    if (pa !== pb) return pa - pb;

    const cargaA = cargaTecnico(a);
    const cargaB = cargaTecnico(b);

    if (cargaA.actividadesHoy !== cargaB.actividadesHoy) {
      return cargaA.actividadesHoy - cargaB.actividadesHoy;
    }

    if (cargaA.tiempoHoySeg !== cargaB.tiempoHoySeg) {
      return cargaA.tiempoHoySeg - cargaB.tiempoHoySeg;
    }

    return (a?.nombre || "").localeCompare(b?.nombre || "", "es", {
      sensitivity: "base",
    });
  });
}

function obtenerContenedorTecnicos() {
  return document.getElementById("tecnicos");
}

function renderizarListaTecnicos(contenedor, tecnicos, trabajosPorId) {
  contenedor.innerHTML = "";

  const tecnicosVisibles = tecnicos.filter((t) => t.activo !== false);
  const otrosTecnicos = tecnicos.filter((t) => t.activo === false);

  tecnicosVisibles.forEach((t) => {
    contenedor.appendChild(crearCardTecnico(t, trabajosPorId));
  });

  if (otrosTecnicos.length > 0) {
    const cardOtros = document.createElement("div");
    cardOtros.className = "tecnico-item colapsado clickeable";
    cardOtros.onclick = () => toggleOtrosTecnicos();

    cardOtros.innerHTML = `
  <div class="tecnico-header">
  <div class="tecnico-nombre">Otros técnicos</div>
  <div class="tecnico-estado">${mostrarOtrosTecnicos ? "Ocultar" : "Mostrar"}</div>
  </div>
  <div class="tecnico-resumen-colapsado">
  ${otrosTecnicos.length} técnico${otrosTecnicos.length === 1 ? "" : "s"} deshabilitado${otrosTecnicos.length === 1 ? "" : "s"}
  </div>
  <div class="tecnico-ayuda-colapsado">
  ${mostrarOtrosTecnicos ? "Toca para ocultar" : "Toca para ver más"}
  </div>
  `;

    contenedor.appendChild(cardOtros);

    if (mostrarOtrosTecnicos) {
      otrosTecnicos.forEach((t) => {
        contenedor.appendChild(crearCardTecnico(t, trabajosPorId));
      });
    }
  }
}
function toggleOtrosTecnicos() {
  mostrarOtrosTecnicos = !mostrarOtrosTecnicos;
  renderizarTecnicos(ultimoResumen);
}
function obtenerResumenTecnicos(data) {
  const trabajos = Array.isArray(data?.trabajos) ? data.trabajos : [];
  const tecnicos = Array.isArray(data?.tecnicos) ? data.tecnicos : [];

  return {
    trabajosPorId: obtenerTrabajosPorId(trabajos),
    tecnicosOrdenados: ordenarTecnicos(tecnicos),
  };
}

function renderizarPanelTecnicos(contenedor, resumen) {
  renderizarListaTecnicos(
    contenedor,
    resumen.tecnicosOrdenados,
    resumen.trabajosPorId,
  );
}

function renderizarTecnicos(data) {
  const tecnicosBox = obtenerContenedorTecnicos();
  const resumen = obtenerResumenTecnicos(data);

  renderizarPanelTecnicos(tecnicosBox, resumen);
}

function renderizarPanelPrincipal(data) {
  const trabajos = Array.isArray(data?.trabajos) ? data.trabajos : [];

  const hoy = new Date();

  function esMismoDia(fechaIso) {
    if (!fechaIso) return false;
    const fecha = new Date(fechaIso);
    if (isNaN(fecha.getTime())) return false;

    return (
      fecha.getFullYear() === hoy.getFullYear() &&
      fecha.getMonth() === hoy.getMonth() &&
      fecha.getDate() === hoy.getDate()
    );
  }

  // contar trabajos del día
  const trabajosHoy = trabajos.filter(
    (t) => esMismoDia(t?.created_at) || esMismoDia(t?.updated_at),
  ).length;
  const chipTrabajosHoy = document.getElementById("chipTrabajosHoy");
  if (chipTrabajosHoy) {
    chipTrabajosHoy.textContent = `🧾 Trabajos hoy: ${trabajosHoy}`;
  }
  renderizarTrabajos(data);
  renderizarTecnicos(data);
}

function actualizarUltimoResumen(data) {
  ultimoResumen = data;
}

function enfocarUltimoTrabajoCreado() {
  if (!ultimoTrabajoCreadoId) return;

  const trabajoId = Number(ultimoTrabajoCreadoId);
  ultimoTrabajoCreadoId = null;

  setTimeout(() => {
    irATrabajo(trabajoId);
  }, 120);
}

async function cargarDatos() {
  try {
    const [trabajosSnapshot, actividadesSnapshot, tecnicosSnapshot] =
      await Promise.all([
        window.db.collection("trabajos").orderBy("id").get(),
        window.db.collection("actividades").where("activo", "==", true).get(),
        window.db.collection("tecnicos").orderBy("id").get(),
      ]);

    const trabajos = trabajosSnapshot.docs
      .map((doc) => doc.data())
      .filter((t) => t.activo !== false);
    const actividades = actividadesSnapshot.docs.map((doc) => doc.data());
    const tecnicos = tecnicosSnapshot.docs.map((doc) => doc.data());

    const actividadesPorTrabajo = new Map();

    actividades.forEach((act) => {
      const trabajoId = Number(act?.trabajo_id);
      if (!trabajoId) return;

      if (!actividadesPorTrabajo.has(trabajoId)) {
        actividadesPorTrabajo.set(trabajoId, []);
      }

      actividadesPorTrabajo.get(trabajoId).push(act);
    });

    const trabajosConActividades = trabajos.map((trabajo) => {
      const trabajoId = Number(trabajo?.id);
      const actividadesTrabajo = actividadesPorTrabajo.get(trabajoId) || [];

      actividadesTrabajo.sort(
        (a, b) => Number(a?.orden || 0) - Number(b?.orden || 0),
      );

      return {
        ...trabajo,
        actividades: actividadesTrabajo,
      };
    });

    const data = {
      trabajos: trabajosConActividades,
      tecnicos,
    };

    actualizarUltimoResumen(data);
    renderizarPanelPrincipal(data);
    enfocarUltimoTrabajoCreado();
  } catch (error) {
    console.error("Error cargando datos:", error);
    alert("No se pudieron cargar los datos.");
  }
}

function escucharDatosEnTiempoReal() {
  if (unsubscribeTrabajos) unsubscribeTrabajos();
  if (unsubscribeActividades) unsubscribeActividades();
  if (unsubscribeTecnicos) unsubscribeTecnicos();
  if (unsubscribeVendedores) unsubscribeVendedores();
  if (timerRefrescoMinutos) clearInterval(timerRefrescoMinutos);

  timerRefrescoMinutos = setInterval(() => {
    renderizarResumenDesdeMemoria();
  }, 60000);

  const hoy = obtenerFechaLocalISO();

  let trabajos = [];
  let actividades = [];
  let tecnicos = [];

  function obtenerDataPanelPrincipal() {
    const actividadesPorTrabajo = new Map();

    actividades.forEach((act) => {
      const trabajoId = Number(act?.trabajo_id);
      if (!trabajoId) return;

      if (!actividadesPorTrabajo.has(trabajoId)) {
        actividadesPorTrabajo.set(trabajoId, []);
      }

      actividadesPorTrabajo.get(trabajoId).push(act);
    });

    const trabajosConActividades = trabajos.map((trabajo) => {
      const trabajoId = Number(trabajo?.id);
      const actividadesTrabajo = actividadesPorTrabajo.get(trabajoId) || [];

      actividadesTrabajo.sort(
        (a, b) => Number(a?.orden || 0) - Number(b?.orden || 0),
      );

      return {
        ...trabajo,
        actividades: actividadesTrabajo,
      };
    });

    return { trabajos: trabajosConActividades, tecnicos };
  }

  function renderizarResumenDesdeMemoria() {
    const data = obtenerDataPanelPrincipal();
    actualizarUltimoResumen(data);

    renderizarPanelPrincipal(data);
    enfocarUltimoTrabajoCreado();
  }

  unsubscribeTrabajos = window.db
    .collection("trabajos")
    .where("activo", "==", true)
    .where("fecha_local", "==", hoy)
    .onSnapshot(
      (snapshot) => {
        trabajos = snapshot.docs.map((doc) => doc.data());
        renderizarResumenDesdeMemoria();
      },
      (error) => {
        console.error("Error escuchando trabajos:", error);
      },
    );

  unsubscribeActividades = window.db
    .collection("actividades")
    .where("activo", "==", true)
    .where("fecha_local", "==", hoy)
    .onSnapshot(
      (snapshot) => {
        actividades = snapshot.docs.map((doc) => doc.data());
        renderizarResumenDesdeMemoria();
      },
      (error) => {
        console.error("Error escuchando actividades:", error);
      },
    );

  unsubscribeTecnicos = window.db
    .collection("tecnicos")
    .orderBy("id")
    .onSnapshot(
      (snapshot) => {
        tecnicos = snapshot.docs
          .map((doc) => doc.data())
          .filter((t) => t.habilitado !== false);
        renderizarResumenDesdeMemoria();
      },
      (error) => {
        console.error("Error escuchando técnicos:", error);
      },
    );

  unsubscribeVendedores = window.db
    .collection("vendedores")
    .orderBy("id")
    .onSnapshot(
      (snapshot) => {
        vendedoresCache = snapshot.docs
          .map((doc) => doc.data())
          .filter((v) => v.activo !== false);

        const contenedorVendedores = document.getElementById("vendedores");
        if (contenedorVendedores) {
          cargarVendedores();
        }
      },
      (error) => {
        console.error("Error escuchando vendedores:", error);
      },
    );
}

function resaltarTrabajo(trabajoId) {
  document
    .querySelectorAll(".trabajo-card.resaltado")
    .forEach((el) => el.classList.remove("resaltado"));
  const card = document.getElementById(`trabajo-card-${trabajoId}`);
  if (!card) return;
  card.classList.add("resaltado");
  setTimeout(() => card.classList.remove("resaltado"), 2200);
}

function irATrabajo(trabajoId) {
  const trabajo = (ultimoResumen.trabajos || []).find(
    (t) => t.id === trabajoId,
  );
  if (trabajo) {
    const estadoVisual = estadoVisualTrabajo(trabajo);

    if (estadoVisual === "finalizado") {
      trabajosExpandidosFinalizados.add(trabajoId);
    } else {
      trabajosColapsados.delete(trabajoId);
    }
  }

  renderizarPanelPrincipal(ultimoResumen);

  setTimeout(() => {
    const card = document.getElementById(`trabajo-card-${trabajoId}`);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    resaltarTrabajo(trabajoId);
  }, 80);
}

function htmlResumenTecnicosTrabajo(trabajo) {
  const actividades = Array.isArray(trabajo?.actividades)
    ? trabajo.actividades
    : [];

  const mapa = new Map();

  const calcularTiempoParticipanteSeg = (participante) => {
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
  };

  actividades.forEach((act) => {
    const participantes = Array.isArray(act?.participantes)
      ? act.participantes
      : [];

    participantes.forEach((p) => {
      const tecnicoId = Number(p?.tecnico_id || 0);
      if (tecnicoId <= 0) return;

      const actual = mapa.get(tecnicoId) || {
        id: tecnicoId,
        nombre: p?.tecnico_nombre || "Técnico",
        totalSeg: 0,
        pausadoSeg: 0,
        estados: new Set(),
      };

      actual.nombre = p?.tecnico_nombre || actual.nombre || "Técnico";
      actual.totalSeg += calcularTiempoParticipanteSeg(p);
      actual.pausadoSeg += Number(p?.tiempo_pausa_seg || 0);

      const estado = String(p?.estado || "").toLowerCase();
      if (estado) {
        actual.estados.add(estado);
      }

      mapa.set(tecnicoId, actual);
    });
  });

  const prioridadEstado = (estado) => {
    if (estado === "activo") return 0;
    if (estado === "almuerzo") return 1;
    if (estado === "pausado") return 2;
    if (estado === "finalizado") return 3;
    if (estado === "liberado") return 4;
    return 5;
  };

  const resolverEstadoTexto = (estadosSet) => {
    const estados = Array.from(estadosSet || []);

    if (estados.length === 0) return "sin dato";

    estados.sort((a, b) => prioridadEstado(a) - prioridadEstado(b));

    const principal = estados[0];

    if (principal === "activo") return "Trabajando";
    if (principal === "almuerzo") return "Almuerzo";
    if (principal === "pausado") return "Pausado";
    if (principal === "finalizado") return "Finalizado";
    if (principal === "liberado") return "Liberado";

    return formatearEstado(principal);
  };

  const lista = [...mapa.values()].sort((a, b) => {
    return (a.nombre || "").localeCompare(b.nombre || "", "es", {
      sensitivity: "base",
    });
  });

  if (lista.length === 0) {
    return `<div class="resumen-bloque">No hay técnicos registrados en este trabajo todavía.</div>`;
  }

  const items = lista
    .map((t) => {
      const estadoTexto = resolverEstadoTexto(t.estados);

      return `
  <div class="resumen-tecnico-item">
    <div class="resumen-tecnico-head">
      <div class="resumen-tecnico-nombre">${escapeHtml(t.nombre)}</div>
      <div class="resumen-tecnico-tiempo">${formatearDuracion(t.totalSeg)}</div>
    </div>
    <div class="resumen-tecnico-meta">Estado: ${escapeHtml(estadoTexto)}</div>
  </div>
  `;
    })
    .join("");

  return `<div class="resumen-tecnicos-lista">${items}</div>`;
}

function abrirResumenTrabajo(trabajoId) {
  const trabajo = (ultimoResumen.trabajos || []).find(
    (t) => Number(t.id) === Number(trabajoId),
  );

  if (!trabajo) return;

  const estadoVisual = estadoVisualTrabajo(trabajo);
  const contenido = document.getElementById("contenidoResumenTrabajo");

  const actividades = Array.isArray(trabajo?.actividades)
    ? trabajo.actividades
    : [];

  const idsActivos = new Set();
  const idsHistoricos = new Set();

  actividades.forEach((act) => {
    const tecnicosActivosIds = Array.isArray(act?.tecnicos_activos_ids)
      ? act.tecnicos_activos_ids
      : [];

    const participantes = Array.isArray(act?.participantes)
      ? act.participantes
      : [];

    tecnicosActivosIds.forEach((id) => {
      const tecnicoId = Number(id);
      if (tecnicoId > 0) {
        idsActivos.add(tecnicoId);
      }
    });

    participantes.forEach((p) => {
      const tecnicoId = Number(p?.tecnico_id || 0);
      if (tecnicoId > 0) {
        idsHistoricos.add(tecnicoId);
      }
    });
  });

  const tecnicosActivos = idsActivos.size;
  const tecnicosHistoricos = idsHistoricos.size;

  const resumenEquipo =
    estadoVisual === "finalizado"
      ? `${tecnicosHistoricos} técnico${tecnicosHistoricos === 1 ? "" : "s"} participaron`
      : `${tecnicosActivos} activo${tecnicosActivos === 1 ? "" : "s"} · ${tecnicosHistoricos} que han pasado`;

  const htmlResumenGeneral = `
  <div class="resumen-grid">
    <div class="resumen-bloque">
      <div class="resumen-label">Trabajo</div>
      <div class="resumen-valor">#${trabajo.id}</div>
    </div>
    <div class="resumen-bloque">
      <div class="resumen-label">Estado</div>
      <div class="resumen-valor">${escapeHtml(estadoVisual || "sin dato")}</div>
    </div>
    <div class="resumen-bloque">
      <div class="resumen-label">Responsable</div>
      <div class="resumen-valor">${escapeHtml(nombreResponsable(trabajo))}</div>
    </div>
    <div class="resumen-bloque">
      <div class="resumen-label">Equipo</div>
      <div class="resumen-valor">${escapeHtml(resumenEquipo)}</div>
    </div>
  </div>
  `;

  const htmlDetalle = `
  <div class="resumen-bloque">
    <div class="resumen-label">Detalle</div>
    <div class="resumen-valor">${escapeHtml(trabajo.descripcion || "Sin descripción")}</div>
  </div>
  `;

  const htmlFechas = `
  <div class="resumen-bloque">
    <div class="resumen-label">Fechas</div>
    <div class="resumen-valor">
      Creado: ${escapeHtml(formatearFechaCorta(trabajo.created_at))}
      ${trabajo.finalizado_at ? ` · Finalizado: ${escapeHtml(formatearFechaCorta(trabajo.finalizado_at))}` : ""}
    </div>
  </div>
  `;

  const htmlTecnicos = `
  <div class="resumen-bloque">
    <div class="resumen-label">Técnicos que estuvieron en este trabajo</div>
    ${htmlResumenTecnicosTrabajo(trabajo)}
  </div>
  `;

  contenido.innerHTML = `
  ${htmlResumenGeneral}
  ${htmlDetalle}
  ${htmlFechas}
  ${htmlTecnicos}
  `;

  document.getElementById("modalResumenTrabajo").style.display = "block";
}

function cerrarResumenTrabajo() {
  document.getElementById("contenidoResumenTrabajo").innerHTML = "";
  document.getElementById("modalResumenTrabajo").style.display = "none";
}
function abrirModalEstadoTecnico(tecnicoId) {
  if (!validarBatuta()) return;

  const tecnico = (ultimoResumen.tecnicos || []).find(
    (t) => t.id === tecnicoId,
  );
  const trabajo = tecnico?.trabajo_id
    ? (ultimoResumen.trabajos || []).find((tr) => tr.id === tecnico.trabajo_id)
    : null;

  if (!tecnico) return;

  estadoTecnicoActualId = tecnicoId;
  estadoTecnicoSeleccionado = "almuerzo";

  const htmlResumen = `
  <div><strong>Técnico:</strong> ${escapeHtml(tecnico.nombre || "")}</div>
  <div><strong>Estado actual:</strong> ${escapeHtml(tecnico.estado || "sin dato")}</div>
  <div><strong>Trabajo actual:</strong> ${escapeHtml(trabajo?.descripcion || "Sin trabajo asignado")}</div>
  <div><strong>Responsable actual:</strong> ${escapeHtml(trabajo ? nombreResponsable(trabajo) : "—")}</div>
  `;

  document.getElementById("estadoTecnicoResumen").innerHTML = htmlResumen;

  const box = document.getElementById("estadoTecnicoCamposExtra");
  const ahora = new Date();
  const horaActual = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;

  box.style.display = "block";
  box.innerHTML = `
  <div class="estado-campo-bloque">
  <label class="estado-campo-label" for="almuerzoHoraSalida">Hora de salida</label>
  <input id="almuerzoHoraSalida" type="time" value="${horaActual}">
  </div>
  <div class="estado-campo-bloque">
  <label class="estado-campo-label" for="almuerzoMinutos">Minutos estimados de almuerzo</label>
  <input id="almuerzoMinutos" type="text" value="60" placeholder="Ej: 60">
  </div>
  `;

  actualizarBotonGuardarEstadoTecnico();
  document.getElementById("modalEstadoTecnico").style.display = "block";
}

function cerrarModalEstadoTecnico() {
  estadoTecnicoActualId = null;
  estadoTecnicoSeleccionado = null;
  document.getElementById("estadoTecnicoResumen").innerHTML = "";
  document.getElementById("estadoTecnicoCamposExtra").innerHTML = "";
  document.getElementById("estadoTecnicoCamposExtra").style.display = "none";
  document.getElementById("modalEstadoTecnico").style.display = "none";
  actualizarBotonGuardarEstadoTecnico();
}
function actualizarBotonGuardarEstadoTecnico() {
  const btn = document.querySelector("#modalEstadoTecnico .btn-principal");
  if (!btn) return;

  const minutos = (
    document.getElementById("almuerzoMinutos")?.value || ""
  ).trim();
  const horaSalida = (
    document.getElementById("almuerzoHoraSalida")?.value || ""
  ).trim();

  btn.disabled = !horaSalida || !minutos || isNaN(minutos);
}

function renderizarCamposEstadoTecnico() {
  const box = document.getElementById("estadoTecnicoCamposExtra");
  if (!box) return;

  const ahora = new Date();
  const horaActual = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;

  box.style.display = "block";
  box.innerHTML = `
  <div class="estado-campo-bloque">
  <label class="estado-campo-label" for="almuerzoHoraSalida">Hora de salida</label>
  <input id="almuerzoHoraSalida" type="time" value="${horaActual}" oninput="actualizarBotonGuardarEstadoTecnico()">
  </div>
  <div class="estado-campo-bloque">
  <label class="estado-campo-label" for="almuerzoMinutos">Minutos estimados de almuerzo</label>
  <input id="almuerzoMinutos" type="text" value="60" placeholder="Ej: 60" oninput="actualizarBotonGuardarEstadoTecnico()">
  </div>
  `;
}
async function confirmarCambioEstadoTecnico() {
  if (!estadoTecnicoActualId) {
    alert("No se encontró el técnico.");
    return;
  }

  const tecnico = (ultimoResumen.tecnicos || []).find(
    (t) => t.id === estadoTecnicoActualId,
  );

  const minutosInput = document.getElementById("almuerzoMinutos");
  const horaSalidaInput = document.getElementById("almuerzoHoraSalida");

  const minutos = (minutosInput?.value || "").trim();
  const horaSalida = (horaSalidaInput?.value || "").trim();

  if (!horaSalida) {
    alert("Debes ingresar la hora de salida al almuerzo.");
    return;
  }

  if (!minutos || isNaN(minutos)) {
    alert("Debes ingresar minutos válidos para el almuerzo.");
    return;
  }

  abrirModalConfirmacion({
    titulo: "Confirmar envío a almuerzo",
    texto: "¿Confirmas que este técnico saldrá a almorzar?",
    destacado: `
  <strong>Técnico:</strong> ${escapeHtml(tecnico?.nombre || "Técnico")}<br>
  <strong>Hora de salida:</strong> ${escapeHtml(horaSalida)}<br>
  <strong>Minutos estimados:</strong> ${escapeHtml(minutos)}
  `,
    boton: "Enviar a almuerzo",
    claseBoton: "btn-principal",
    onConfirm: async () => {
      await cambiarEstadoTecnico(estadoTecnicoActualId, {
        estado: "almuerzo",
        minutos: parseInt(minutos, 10),
        hora_salida: horaSalida,
      });
    },
  });
}

async function cambiarEstadoTecnico(tecnicoId, payload) {
  if (!validarBatuta()) return;

  const clave = `estado-tecnico-${tecnicoId}`;
  if (!iniciarAccion(clave)) return;

  try {
    const tecnicoRef = window.db.collection("tecnicos").doc(String(tecnicoId));
    const tecnicoSnap = await tecnicoRef.get();

    if (!tecnicoSnap.exists) {
      alert("Técnico no encontrado.");
      return;
    }

    const tecnicoActual = tecnicoSnap.data() || {};
    const nuevoEstado = String(payload?.estado || "").toLowerCase();

    if (payload?.accion_si_vacio === "__cancelar__") {
      return;
    }

    if (!["libre", "almuerzo"].includes(nuevoEstado)) {
      alert("Por ahora solo se permite cambiar a libre o almuerzo.");
      return;
    }

    let trabajoRef = null;
    let trabajoActual = null;
    let actividadRef = null;
    let actividadActual = null;

    const vieneDeTrabajoActivo = tecnicoActual?.trabajo_id != null;
    const vieneDeAlmuerzo =
      String(tecnicoActual?.estado || "").toLowerCase() === "almuerzo";

    // Caso normal: técnico está trabajando en una actividad y lo mando a almuerzo
    if (vieneDeTrabajoActivo) {
      const trabajoIdActual = Number(tecnicoActual.trabajo_id);

      trabajoRef = window.db
        .collection("trabajos")
        .doc(String(trabajoIdActual));

      const trabajoSnap = await trabajoRef.get();
      if (trabajoSnap.exists) {
        trabajoActual = trabajoSnap.data() || {};
      }

      const actividadesSnap = await window.db
        .collection("actividades")
        .where("trabajo_id", "==", trabajoIdActual)
        .where("activo", "==", true)
        .get();

      const actividadDoc = actividadesSnap.docs.find((doc) => {
        const actividad = doc.data() || {};
        const participantes = Array.isArray(actividad.participantes)
          ? actividad.participantes
          : [];

        return participantes.some(
          (p) =>
            Number(p?.tecnico_id) === Number(tecnicoId) &&
            p?.activo !== false &&
            String(p?.estado || "").toLowerCase() === "activo",
        );
      });

      if (actividadDoc) {
        actividadRef = actividadDoc.ref;
        actividadActual = actividadDoc.data() || {};
      }

      if (!actividadActual) {
        alert(
          "No se encontró la actividad activa del técnico dentro del trabajo actual.",
        );
        return;
      }

      const cantidadActivos = Array.isArray(
        actividadActual.tecnicos_activos_ids,
      )
        ? actividadActual.tecnicos_activos_ids.length
        : 0;

      if (
        cantidadActivos === 1 &&
        nuevoEstado === "almuerzo" &&
        !payload?.accion_si_vacio
      ) {
        abrirModalTrabajoSinTecnicos({
          trabajo: {
            ...(trabajoActual || {}),
            actividades: [actividadActual],
          },
          contexto:
            "Esta actividad quedará sin técnicos activos. ¿Qué deseas hacer con ella?",
          onResolver: async (accion) => {
            const nuevoPayload = { ...payload, accion_si_vacio: accion };
            await cambiarEstadoTecnico(tecnicoId, nuevoPayload);
          },
        });
        return;
      }
    }

    // Caso regreso de almuerzo: buscar actividad origen guardada en el técnico
    let actividadOrigenAlmuerzoRef = null;
    let actividadOrigenAlmuerzo = null;

    if (!vieneDeTrabajoActivo && vieneDeAlmuerzo && nuevoEstado === "libre") {
      const actividadOrigenId = String(
        tecnicoActual.actividad_origen_almuerzo_id || "",
      ).trim();

      if (actividadOrigenId) {
        actividadOrigenAlmuerzoRef = window.db
          .collection("actividades")
          .doc(actividadOrigenId);

        const actividadOrigenSnap = await actividadOrigenAlmuerzoRef.get();
        if (actividadOrigenSnap.exists) {
          actividadOrigenAlmuerzo = actividadOrigenSnap.data() || {};
        }
      }
    }

    const batch = window.db.batch();

    const updateTecnico = {
      estado: nuevoEstado,
      trabajo_id: null,
    };

    if (nuevoEstado === "almuerzo") {
      const minutos = Number(payload?.minutos || 60);
      const horaSalida = String(payload?.hora_salida || "").trim();

      if (!horaSalida) {
        alert("Debes ingresar la hora de salida al almuerzo.");
        return;
      }

      const partesHora = horaSalida.split(":").map(Number);
      if (partesHora.length !== 2 || partesHora.some((n) => Number.isNaN(n))) {
        alert("La hora de salida no es válida.");
        return;
      }

      const [hh, mm] = partesHora;
      const ahoraBase = new Date();

      const salida = new Date(
        ahoraBase.getFullYear(),
        ahoraBase.getMonth(),
        ahoraBase.getDate(),
        hh,
        mm,
        0,
        0,
      );

      if (isNaN(salida.getTime())) {
        alert("La hora de salida no es válida.");
        return;
      }

      const regreso = new Date(salida.getTime() + Math.max(0, minutos) * 60000);

      updateTecnico.almuerzo_desde = salida.toISOString();
      updateTecnico.almuerzo_hasta = regreso.toISOString();
      updateTecnico.almuerzo_registrado = true;
      updateTecnico.almuerzo_fecha = salida.toISOString();

      updateTecnico.actividad_origen_almuerzo_id = actividadActual?.id || null;
      updateTecnico.trabajo_origen_almuerzo_id = trabajoActual?.id || null;
    } else {
      updateTecnico.almuerzo_desde = null;
      updateTecnico.almuerzo_hasta = null;
      updateTecnico.actividad_origen_almuerzo_id = null;
      updateTecnico.trabajo_origen_almuerzo_id = null;
    }

    batch.update(tecnicoRef, updateTecnico);

    // Caso 1: se va a almuerzo desde una actividad activa
    if (trabajoActual && actividadActual && actividadRef) {
      const participantes = Array.isArray(actividadActual.participantes)
        ? [...actividadActual.participantes]
        : [];

      const participanteIndex = participantes.findIndex(
        (p) =>
          Number(p?.tecnico_id) === Number(tecnicoId) &&
          p?.activo !== false &&
          String(p?.estado || "").toLowerCase() === "activo",
      );

      if (participanteIndex === -1) {
        alert("No se encontró el participante activo en la actividad.");
        return;
      }

      const ahora = new Date();
      const ahoraIso = ahora.toISOString();

      const participante = { ...participantes[participanteIndex] };

      if (participante.inicio_actual_at) {
        const inicio = new Date(participante.inicio_actual_at);
        if (!isNaN(inicio.getTime())) {
          const extra = Math.max(0, Math.floor((ahora - inicio) / 1000));
          participante.tiempo_real_seg =
            Number(participante.tiempo_real_seg || 0) + extra;
        }
      }

      const accionSiVacio = String(
        payload?.accion_si_vacio || "",
      ).toLowerCase();

      if (nuevoEstado === "almuerzo") {
        participante.estado = "pausado";
        participante.visible_en_tarjeta = true;
      } else {
        participante.estado = "liberado";
        participante.visible_en_tarjeta = false;
      }

      participante.activo = false;
      participante.inicio_actual_at = null;
      participante.pausa_actual_at =
        nuevoEstado === "almuerzo" ? ahoraIso : null;
      participante.finalizado_at = null;

      participantes[participanteIndex] = participante;

      const activosIds = (
        Array.isArray(actividadActual.tecnicos_activos_ids)
          ? actividadActual.tecnicos_activos_ids
          : []
      ).filter((id) => Number(id) !== Number(tecnicoId));

      const nombreTecnico =
        participante.tecnico_nombre || tecnicoActual.nombre || "Técnico";

      const activosNombres = (
        Array.isArray(actividadActual.tecnicos_activos_nombres)
          ? actividadActual.tecnicos_activos_nombres
          : []
      ).filter((n) => n !== nombreTecnico);

      const ultimoIdsBase = Array.isArray(actividadActual.ultimo_tecnicos_ids)
        ? [...actividadActual.ultimo_tecnicos_ids]
        : [];
      const ultimoNombresBase = Array.isArray(
        actividadActual.ultimo_tecnicos_nombres,
      )
        ? [...actividadActual.ultimo_tecnicos_nombres]
        : [];

      const ultimoIds = ultimoIdsBase.filter(
        (id) => Number(id) !== Number(tecnicoId),
      );
      const ultimoNombres = ultimoNombresBase.filter(
        (n) => n !== nombreTecnico,
      );

      if (!ultimoIds.some((id) => Number(id) === Number(tecnicoId))) {
        ultimoIds.push(tecnicoId);
      }
      if (!ultimoNombres.includes(nombreTecnico)) {
        ultimoNombres.push(nombreTecnico);
      }

      let nuevoEstadoActividad = "en_proceso";

      if (activosIds.length === 0) {
        if (nuevoEstado === "almuerzo") {
          if (accionSiVacio === "finalizado") {
            nuevoEstadoActividad = "finalizado";
          } else {
            nuevoEstadoActividad = "pausado";
          }
        } else {
          if (accionSiVacio === "finalizado") {
            nuevoEstadoActividad = "finalizado";
          } else {
            nuevoEstadoActividad = "pausado";
          }
        }
      }

      const actividadUpdate = {
        participantes,
        tecnicos_activos_ids: activosIds,
        tecnicos_activos_nombres: activosNombres,
        tecnicos_activos_count: activosIds.length,
        estado: nuevoEstadoActividad,
        ultima_actividad_at: ahoraIso,
        inicio_tramo_activo_at: null,
        inicio_tramo_pausa_at:
          nuevoEstadoActividad === "pausado" ? ahoraIso : null,
        ultima_pausa_at:
          nuevoEstadoActividad === "pausado"
            ? ahoraIso
            : actividadActual.ultima_pausa_at || null,
        finalizado_at: nuevoEstadoActividad === "finalizado" ? ahoraIso : null,
        ultimo_tecnicos_ids: ultimoIds,
        ultimo_tecnicos_nombres: ultimoNombres,
      };

      batch.update(actividadRef, actividadUpdate);

      const actividadesSnap = await window.db
        .collection("actividades")
        .where("trabajo_id", "==", Number(tecnicoActual.trabajo_id))
        .where("activo", "==", true)
        .get();

      const actividadesActualizadas = actividadesSnap.docs.map((doc) => {
        const data = doc.data() || {};
        if (doc.id === actividadRef.id) {
          return {
            ...data,
            ...actividadUpdate,
          };
        }
        return data;
      });

      const {
        nuevoEstadoTrabajo,
        actividadesPendientes,
        actividadesEnProceso,
        actividadesPausadas,
        actividadesFinalizadas,
        tecnicosActivosTotal,
        tecnicosParticipantesCount,
      } = resumirEstadosTrabajoDesdeActividades(actividadesActualizadas);

      batch.update(trabajoRef, {
        estado: nuevoEstadoTrabajo,
        ultima_actividad_at: ahoraIso,
        finalizado_at: nuevoEstadoTrabajo === "finalizado" ? ahoraIso : null,
        total_actividades: actividadesActualizadas.length,
        actividades_pendientes: actividadesPendientes,
        actividades_en_proceso: actividadesEnProceso,
        actividades_pausadas: actividadesPausadas,
        actividades_finalizadas: actividadesFinalizadas,
        tecnicos_activos_count: tecnicosActivosTotal,
        tecnicos_participantes_count: tecnicosParticipantesCount,
      });
    }

    // Caso 2: regresa de almuerzo y hay que ocultarlo de la actividad anterior
    if (
      nuevoEstado === "libre" &&
      vieneDeAlmuerzo &&
      actividadOrigenAlmuerzoRef &&
      actividadOrigenAlmuerzo
    ) {
      const participantesOrigen = Array.isArray(
        actividadOrigenAlmuerzo.participantes,
      )
        ? [...actividadOrigenAlmuerzo.participantes]
        : [];

      const indexOrigen = participantesOrigen.findIndex((p) => {
        const estado = String(p?.estado || "").toLowerCase();

        return (
          Number(p?.tecnico_id) === Number(tecnicoId) &&
          ["almuerzo", "pausado"].includes(estado)
        );
      });

      if (indexOrigen !== -1) {
        const participanteOrigen = { ...participantesOrigen[indexOrigen] };

        participanteOrigen.estado = "pausado";
        participanteOrigen.activo = false;
        participanteOrigen.visible_en_tarjeta = true;
        participanteOrigen.inicio_actual_at = null;
        participanteOrigen.pausa_actual_at =
          participanteOrigen.pausa_actual_at || new Date().toISOString();
        participanteOrigen.finalizado_at = null;

        participantesOrigen[indexOrigen] = participanteOrigen;

        batch.update(actividadOrigenAlmuerzoRef, {
          participantes: participantesOrigen,
          ultima_actividad_at: new Date().toISOString(),
        });
      }
    }

    await batch.commit();

    cerrarModalEstadoTecnico();
  } catch (error) {
    console.error("Error cambiando estado en Firestore:", error);
    alert("No se pudo cambiar el estado del técnico.");
  } finally {
    finalizarAccion(clave);
  }
}
async function toggleDiaLibreTecnico(tecnicoId, diaLibre) {
  if (!validarBatuta()) return;
  const clave = `dia-libre-${tecnicoId}`;
  if (!iniciarAccion(clave)) return;

  try {
    await window.db.collection("tecnicos").doc(String(tecnicoId)).update({
      dia_libre: diaLibre,
    });
  } catch (error) {
    console.error("Error actualizando día libre en Firestore:", error);
    alert("No se pudo actualizar el día libre.");
  } finally {
    finalizarAccion(clave);
  }
}
async function editar(id, descripcion) {
  editandoTrabajoId = id;

  const trabajo = (ultimoResumen.trabajos || []).find((t) => t.id === id);
  if (!trabajo) {
    alert("No se encontró el trabajo.");
    return;
  }

  document.getElementById("descripcionActual").textContent = descripcion || "";
  document.getElementById("nuevaDescripcion").value = descripcion || "";
  document.getElementById("editarSolicitanteInterno").value = "";
  document.getElementById("editarVendedorSeleccionadoTexto").textContent =
    "Ningún vendedor seleccionado";
  vendedorEdicionSeleccionado = null;

  const contenedor = document.getElementById("editarVendedoresCards");
  contenedor.innerHTML = "";

  try {
    let vendedores = vendedoresCache;

    if (!Array.isArray(vendedores)) {
      const vendedoresSnap = await window.db
        .collection("vendedores")
        .orderBy("id")
        .get();

      vendedores = vendedoresSnap.docs.map((doc) => doc.data());
      vendedoresCache = vendedores;
    }

    vendedores.forEach((v) => {
      if (v.activo === false) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-vendedor";
      btn.textContent = v.nombre || `Vendedor ${v.id}`;

      btn.onclick = () => {
        vendedorEdicionSeleccionado = v;

        document
          .querySelectorAll("#editarVendedoresCards .btn-vendedor")
          .forEach((b) => b.classList.remove("activo"));

        btn.classList.add("activo");
        document.getElementById("editarVendedorSeleccionadoTexto").textContent =
          "Vendedor seleccionado: " + (v.nombre || `Vendedor ${v.id}`);
      };

      contenedor.appendChild(btn);

      if (
        trabajo.origen === "vendedor" &&
        trabajo.vendedor_id != null &&
        Number(trabajo.vendedor_id) === Number(v.id)
      ) {
        vendedorEdicionSeleccionado = v;
        btn.classList.add("activo");
        document.getElementById("editarVendedorSeleccionadoTexto").textContent =
          "Vendedor seleccionado: " + (v.nombre || `Vendedor ${v.id}`);
      }
    });

    if (trabajo.origen === "vendedor") {
      seleccionarOrigenEdicion("vendedor");
      document.getElementById("editarSolicitanteInterno").value = "";
    } else {
      seleccionarOrigenEdicion("interno");
      document.getElementById("editarSolicitanteInterno").value =
        trabajo.solicitante_nombre || "";
    }

    document.getElementById("modalEditar").style.display = "block";
  } catch (error) {
    console.error("Error cargando vendedores para edición:", error);
    alert("No se pudieron cargar los vendedores.");
  }
}

function cerrarModalEditar() {
  editandoTrabajoId = null;
  origenEdicionSeleccionado = null;
  vendedorEdicionSeleccionado = null;

  document.getElementById("descripcionActual").textContent = "";
  document.getElementById("nuevaDescripcion").value = "";
  document.getElementById("editarVendedoresCards").innerHTML = "";
  document.getElementById("editarVendedorSeleccionadoTexto").textContent =
    "Ningún vendedor seleccionado";
  document.getElementById("editarSolicitanteInterno").value = "";

  document.getElementById("bloqueEditarVendedor").style.display = "none";
  document.getElementById("bloqueEditarSolicitante").style.display = "none";

  document.getElementById("modalEditar").style.display = "none";
}

async function guardarEdicion() {
  if (!editandoTrabajoId) return;

  const nuevaDescripcion = document
    .getElementById("nuevaDescripcion")
    .value.trim();
  const origen = origenEdicionSeleccionado;

  if (!nuevaDescripcion) {
    alert("La descripción no puede estar vacía.");
    return;
  }

  if (!origen) {
    alert("Debes seleccionar el origen del trabajo.");
    return;
  }

  let data = {
    descripcion: nuevaDescripcion,
    origen: origen,
  };

  if (origen === "vendedor") {
    if (!vendedorEdicionSeleccionado) {
      alert("Debes seleccionar un vendedor.");
      return;
    }

    data.vendedor_id = Number(vendedorEdicionSeleccionado.id);
  }

  if (origen === "interno") {
    const solicitante = document
      .getElementById("editarSolicitanteInterno")
      .value.trim();

    if (!solicitante) {
      alert("Debes indicar quién solicita el trabajo.");
      return;
    }

    data.solicitante_nombre = solicitante;
  }

  try {
    const response = await fetch(`/trabajos/${editandoTrabajoId}/editar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Error al guardar cambios");
      return;
    }

    cerrarModalEditar();
  } catch (error) {
    console.error("Error editando trabajo:", error);
    alert("No se pudo actualizar el trabajo.");
  }
}

function abrirModalEditarActividad(trabajoId, actividadId) {
  if (!validarBatuta()) return;

  const trabajo = (ultimoResumen.trabajos || []).find(
    (t) => Number(t.id) === Number(trabajoId),
  );

  if (!trabajo) {
    alert("No se encontró el trabajo.");
    return;
  }

  const actividades = Array.isArray(trabajo.actividades)
    ? trabajo.actividades
    : [];

  const actividadIdTexto = String(actividadId || "").trim();

  const actividad = actividades.find(
    (a) => String(a?.id || "").trim() === actividadIdTexto,
  );

  if (!actividad) {
    alert("No se encontró la actividad.");
    return;
  }

  modoActividad = "editar";

  actividadEditandoTrabajoId = Number(trabajoId);
  actividadEditandoId = actividadIdTexto;

  document.getElementById("tituloModalActividad").textContent =
    "✏️ Editar actividad";

  document.getElementById("descripcionActualActividad").textContent =
    actividad.descripcion || "Sin descripción";

  document.getElementById("nuevaDescripcionActividad").value =
    actividad.descripcion || "";

  document.getElementById("modalEditarActividad").style.display = "block";

  setTimeout(() => {
    const campo = document.getElementById("nuevaDescripcionActividad");
    if (campo) {
      campo.focus();
      campo.select();
    }
  }, 50);
}
function cerrarModalEditarActividad() {
  actividadEditandoTrabajoId = null;
  actividadEditandoId = null;

  document.getElementById("descripcionActualActividad").textContent = "";
  document.getElementById("nuevaDescripcionActividad").value = "";
  document.getElementById("modalEditarActividad").style.display = "none";
}

async function guardarEdicionActividad() {
  if (!validarBatuta()) return;
  if (actividadEditandoTrabajoId == null) return;

  const nuevaDescripcion = document
    .getElementById("nuevaDescripcionActividad")
    .value.trim();

  if (!nuevaDescripcion) {
    alert("La descripción no puede estar vacía.");
    return;
  }

  try {
    const trabajoId = Number(actividadEditandoTrabajoId);

    const trabajoRef = window.db.collection("trabajos").doc(String(trabajoId));
    const trabajoSnap = await trabajoRef.get();

    if (!trabajoSnap.exists) {
      alert("Trabajo no encontrado.");
      return;
    }

    const trabajo = trabajoSnap.data() || {};
    const actividadesRef = window.db.collection("actividades");

    if (modoActividad === "editar") {
      const actividadId = String(actividadEditandoId || "").trim();
      if (!actividadId) {
        alert("Actividad no encontrada.");
        return;
      }

      const actividadRef = actividadesRef.doc(actividadId);
      const actividadSnap = await actividadRef.get();

      if (!actividadSnap.exists) {
        alert("Actividad no encontrada.");
        return;
      }

      await actividadRef.update({
        descripcion: nuevaDescripcion,
      });
    } else if (modoActividad === "nuevo") {
      const actividadesSnap = await actividadesRef
        .where("trabajo_id", "==", trabajoId)
        .where("activo", "==", true)
        .get();

      const actividadesExistentes = actividadesSnap.docs.map((doc) =>
        doc.data(),
      );

      const siguienteOrden =
        actividadesExistentes.length > 0
          ? Math.max(
              ...actividadesExistentes.map((a) => Number(a?.orden || 0)),
            ) + 1
          : 1;

      const nuevaActividadId = `act_${String(trabajoId).padStart(6, "0")}_${String(siguienteOrden).padStart(2, "0")}`;
      const ahora = new Date().toISOString();

      const nuevaActividad = {
        id: nuevaActividadId,
        trabajo_id: trabajoId,
        orden: siguienteOrden,
        descripcion: nuevaDescripcion,
        estado: "pendiente",
        origen: trabajo.origen || null,
        responsable_nombre: trabajo.responsable_nombre || null,
        created_at: ahora,
        fecha_local: obtenerFechaLocalISO(), // 👈 NUEVO
        primer_inicio_at: null,
        ultima_reanudacion_at: null,
        ultima_pausa_at: null,
        finalizado_at: null,
        ultima_actividad_at: null,
        tecnicos_activos_ids: [],
        tecnicos_activos_nombres: [],
        tecnicos_activos_count: 0,
        tecnicos_participantes_ids: [],
        tecnicos_participantes_count: 0,
        ultimo_tecnicos_ids: [],
        ultimo_tecnicos_nombres: [],
        tiempo_espera_seg: 0,
        tiempo_real_seg: 0,
        tiempo_hombre_seg: 0,
        tiempo_pausa_seg: 0,
        inicio_tramo_activo_at: null,
        inicio_tramo_pausa_at: null,
        creado_por_usuario_id: String(window.USUARIO_ID_ACTUAL || ""),
        creado_por_nombre: String(window.USUARIO_NOMBRE_ACTUAL || ""),
        participantes: [],
        activo: true,
      };

      await actividadesRef.doc(nuevaActividadId).set(nuevaActividad);

      await trabajoRef.update({
        total_actividades: siguienteOrden,
        actividades_pendientes: Number(trabajo.actividades_pendientes || 0) + 1,
        ultima_actividad_at: ahora,
      });
    }

    cerrarModalEditarActividad();
  } catch (error) {
    console.error("Error guardando actividad:", error);
    alert("No se pudo guardar la actividad.");
  }
}

function agregarActividadATrabajo(trabajoId) {
  if (!validarBatuta()) return;
  const trabajo = (ultimoResumen.trabajos || []).find(
    (t) => Number(t.id) === Number(trabajoId),
  );

  if (!trabajo) {
    alert("No se encontró el trabajo.");
    return;
  }

  const estadoVisual = estadoVisualTrabajo(trabajo);

  if (estadoVisual !== "pendiente" && estadoVisual !== "en_proceso") {
    alert(
      "Solo se pueden agregar actividades a trabajos pendientes o en proceso.",
    );
    return;
  }
  modoActividad = "nuevo";

  actividadEditandoTrabajoId = Number(trabajoId);
  actividadEditandoId = null;

  document.getElementById("tituloModalActividad").textContent =
    "➕ Nueva actividad";

  document.getElementById("descripcionActualActividad").textContent =
    "Nueva actividad";
  document.getElementById("nuevaDescripcionActividad").value = "";

  document.getElementById("modalEditarActividad").style.display = "block";

  setTimeout(() => {
    const campo = document.getElementById("nuevaDescripcionActividad");
    if (campo) {
      campo.focus();
    }
  }, 50);
}

async function eliminarTrabajoPendiente(trabajoId) {
  if (!validarBatuta()) return;

  const clave = `eliminar-trabajo-${trabajoId}`;
  if (!iniciarAccion(clave)) return;

  try {
    const trabajoRef = window.db.collection("trabajos").doc(String(trabajoId));

    const [trabajoSnap, actividadesSnap] = await Promise.all([
      trabajoRef.get(),
      window.db
        .collection("actividades")
        .where("trabajo_id", "==", Number(trabajoId))
        .where("activo", "==", true)
        .get(),
    ]);

    if (!trabajoSnap.exists) {
      alert("Trabajo no encontrado.");
      return;
    }

    const trabajo = trabajoSnap.data() || {};

    if ((trabajo.estado || "").toLowerCase() !== "pendiente") {
      alert("Solo se pueden eliminar trabajos pendientes.");
      return;
    }

    const actividades = actividadesSnap.docs.map((doc) => doc.data() || {});
    const trabajoConActividades = {
      ...trabajo,
      actividades,
    };

    if (!trabajoPendienteSePuedeEliminar(trabajoConActividades)) {
      alert(
        "Este trabajo pendiente ya tiene historial y no se puede eliminar. Debes finalizarlo, no eliminarlo.",
      );
      return;
    }

    const batch = window.db.batch();
    const ahoraIso = new Date().toISOString();

    actividadesSnap.forEach((doc) => {
      batch.update(doc.ref, {
        activo: false,
        eliminado_at: ahoraIso,
      });
    });

    batch.update(trabajoRef, {
      activo: false,
      eliminado_at: ahoraIso,
    });

    await batch.commit();
  } catch (error) {
    console.error("Error eliminando trabajo:", error);
    alert("No se pudo eliminar el trabajo.");
  } finally {
    finalizarAccion(clave);
  }
}

async function mostrarAsignacion(trabajoId, actividadId = null) {
  if (!validarBatuta()) return;

  tecnicosAsignacionExpandidos.clear();

  const trabajo = (ultimoResumen.trabajos || []).find(
    (t) => Number(t?.id) === Number(trabajoId),
  );

  if (!trabajo) {
    alert("No se encontró el trabajo.");
    return;
  }

  const actividades = Array.isArray(trabajo.actividades)
    ? trabajo.actividades
    : [];

  if (actividades.length === 0) {
    alert("Este trabajo no tiene actividades disponibles.");
    return;
  }

  let actividadSeleccionada = null;
  const actividadIdTexto =
    actividadId == null ? null : String(actividadId).trim();

  if (actividadIdTexto) {
    actividadSeleccionada =
      actividades.find(
        (a) => String(a?.id || "").trim() === actividadIdTexto,
      ) || null;
  }

  if (!actividadSeleccionada) {
    actividadSeleccionada = actividades[0];
  }

  if (!actividadSeleccionada) {
    alert("No se encontró la actividad seleccionada.");
    return;
  }

  trabajoAsignacionId = Number(trabajoId);
  actividadAsignacionId = String(actividadSeleccionada.id || "").trim();

  let sugerencia = "";

  if (
    Array.isArray(actividadSeleccionada.ultimo_tecnicos_nombres) &&
    actividadSeleccionada.ultimo_tecnicos_nombres.length > 0
  ) {
    const nombres = actividadSeleccionada.ultimo_tecnicos_nombres
      .map((nombre) => escapeHtml(nombre || "—"))
      .join(", ");

    sugerencia = `<div style="margin-top:6px; font-size:13px; color:#b45309;">
  ↪ Último técnico en esta actividad: <strong>${nombres}</strong>
  </div>`;
  }

  document.getElementById("asignacionTrabajoResumen").innerHTML = `
  <div><strong>Trabajo #${escapeHtml(trabajo.id)}</strong></div>
  <div><strong>Responsable:</strong> ${escapeHtml(nombreResponsable(trabajo))}</div>
  <div><strong>Vehículo / detalle general:</strong> ${escapeHtml(trabajo.descripcion || "Sin descripción")}</div>
  <div><strong>Actividad seleccionada:</strong> ${escapeHtml(actividadSeleccionada.descripcion || "Sin actividad")}</div>
  ${sugerencia}
  `;

  document.getElementById("buscarTecnicoAsignacion").value = "";
  renderizarTecnicosAsignacion();
  document.getElementById("modalAsignacion").style.display = "block";
}

function renderizarTecnicosAsignacion() {
  const lista = document.getElementById("listaTecnicosAsignacion");
  const buscador = document.getElementById("buscarTecnicoAsignacion");
  const filtro = (buscador?.value || "").trim().toLowerCase();
  const trabajoId = Number(trabajoAsignacionId);

  const trabajo = (ultimoResumen.trabajos || []).find(
    (t) => Number(t?.id) === Number(trabajoId),
  );

  if (!trabajo) {
    lista.innerHTML = `<div class="sin-tecnicos-asignacion">No se encontró el trabajo.</div>`;
    return;
  }

  const actividades = Array.isArray(trabajo.actividades)
    ? trabajo.actividades
    : [];

  const actividadActual = actividades.find(
    (a) =>
      String(a?.id || "").trim() === String(actividadAsignacionId || "").trim(),
  );

  const tecnicosEnActividad = new Set(
    (Array.isArray(actividadActual?.tecnicos_activos_ids)
      ? actividadActual.tecnicos_activos_ids
      : []
    ).map((id) => Number(id)),
  );

  const tecnicosOrdenados = [...(ultimoResumen.tecnicos || [])].sort((a, b) => {
    const grupoTecnico = (t) => {
      const tipo = (t.tipo || "fijo").toLowerCase();
      const activo = t.activo !== false;

      if (activo && tipo !== "eventual") return 0;
      if (activo && tipo === "eventual") return 1;
      if (!activo && tipo !== "eventual") return 2;
      return 3;
    };

    const cargaTecnico = (t) => {
      if (!t?.id || typeof obtenerCargaActualTecnico !== "function") {
        return {
          actividadesHoy: 0,
          tiempoHoySeg: 0,
        };
      }

      const carga = obtenerCargaActualTecnico(t.id) || {};

      return {
        actividadesHoy: Number(carga.actividadesHoy || 0),
        tiempoHoySeg: Number(carga.tiempoHoySeg || 0),
      };
    };

    const ga = grupoTecnico(a);
    const gb = grupoTecnico(b);

    if (ga !== gb) return ga - gb;

    if (ga >= 2) {
      return (a.nombre || "").localeCompare(b.nombre || "", "es", {
        sensitivity: "base",
      });
    }

    const prioridadEstado = { libre: 0, trabajando: 1, almuerzo: 2 };
    const pa = prioridadEstado[(a.estado || "").toLowerCase()] ?? 99;
    const pb = prioridadEstado[(b.estado || "").toLowerCase()] ?? 99;

    if (pa !== pb) return pa - pb;

    const cargaA = cargaTecnico(a);
    const cargaB = cargaTecnico(b);

    if (cargaA.actividadesHoy !== cargaB.actividadesHoy) {
      return cargaA.actividadesHoy - cargaB.actividadesHoy;
    }

    if (cargaA.tiempoHoySeg !== cargaB.tiempoHoySeg) {
      return cargaA.tiempoHoySeg - cargaB.tiempoHoySeg;
    }

    return (a.nombre || "").localeCompare(b.nombre || "", "es", {
      sensitivity: "base",
    });
  });

  const trabajosPorId = {};
  (ultimoResumen.trabajos || []).forEach((tr) => {
    trabajosPorId[tr.id] = tr;
  });

  const filtrados = tecnicosOrdenados.filter((t) => {
    if (t.habilitado === false) return false;
    if (t.activo === false) return false;

    if (!filtro) return true;

    const trabajoActual = t.trabajo_id ? trabajosPorId[t.trabajo_id] : null;

    const texto = [
      t.nombre || "",
      t.estado || "",
      trabajoActual?.descripcion || "",
      trabajoActual ? nombreResponsable(trabajoActual) || "" : "",
      t.dia_libre ? "dia libre" : "",
      (t.tipo || "fijo") === "eventual" ? "eventual" : "",
      t.activo === false ? "inactivo" : "",
    ]
      .join(" ")
      .toLowerCase();

    return texto.includes(filtro);
  });

  if (filtrados.length === 0) {
    lista.innerHTML = `<div class="sin-tecnicos-asignacion">No se encontraron técnicos con ese criterio.</div>`;
    return;
  }

  lista.innerHTML = filtrados
    .map((t) => {
      const estado = (t.estado || "").toLowerCase();
      const esEventual = (t.tipo || "fijo").toLowerCase() === "eventual";
      const eventualInactivo = esEventual && t.activo === false;
      const tecnicoInactivo = t.activo === false;
      const trabajoActual = t.trabajo_id ? trabajosPorId[t.trabajo_id] : null;

      const mismoTrabajo = Number(t.trabajo_id) === trabajoId;
      const yaEnActividad = tecnicosEnActividad.has(Number(t.id));
      const expandida = eventualInactivo
        ? false
        : tecnicosAsignacionExpandidos.has(t.id);

      let textoBoton = "Asignar a esta actividad";
      let claseBoton = `btn-principal btn-asignar-card ${(t.tipo || "fijo") !== "eventual" && t.dia_libre ? "dia-libre" : ""}`;
      let disabledAttr = "";
      let onclickBoton = `onclick="asignarTecnico(${trabajoId}, ${t.id})"`;

      if (tecnicoInactivo) {
        textoBoton = "Técnico deshabilitado";
        claseBoton = "btn-secundario btn-asignar-card";
        disabledAttr = "disabled";
        onclickBoton = "";
      } else if (yaEnActividad) {
        textoBoton = "Ya está en esta actividad";
        claseBoton = "btn-secundario btn-asignar-card";
        disabledAttr = "disabled";
        onclickBoton = "";
      } else if (mismoTrabajo) {
        textoBoton = "Mover a esta actividad";
      } else if (estado === "trabajando" && trabajoActual) {
        textoBoton = "Mover a esta actividad";
      } else if (estado === "almuerzo") {
        textoBoton = "Llamar de almuerzo y asignar";
      } else if (!["libre", "trabajando", "almuerzo"].includes(estado)) {
        textoBoton = "No disponible ahora";
        claseBoton = "btn-secundario btn-asignar-card";
        disabledAttr = "disabled";
        onclickBoton = "";
      }

      const resumenActual = trabajoActual?.descripcion || "Sin detalle";
      const resumenCorto =
        resumenActual.length > 70
          ? resumenActual.substring(0, 70) + "..."
          : resumenActual;
      const actividadesHoy = numeroActividadesHoyTecnico(t.id);

      const resumenColapsado = eventualInactivo
        ? "Técnico eventual inactivo"
        : actividadesHoy === 1
          ? "1 actividad hoy"
          : `${actividadesHoy} actividades hoy`;

      const onclickCard = tecnicoInactivo
        ? ""
        : `onclick="toggleTecnicoAsignacionExpandido(${t.id})"`;

      return `
  <div
  class="asignacion-card estado-${escapeHtml(estado)} ${expandida ? "expandida" : "colapsada"} ${tecnicoInactivo ? "asignacion-card-inactiva" : ""}"
  ${onclickCard}
  >
  <div class="asignacion-card-top">
  <div class="asignacion-nombre">
  ${escapeHtml(t.nombre || "")}
  ${(t.tipo || "fijo") === "eventual" ? `<span class="badge-eventual">Eventual</span>` : ""}
  </div>
  <div class="asignacion-badges">
  <span class="badge-estado ${escapeHtml(estado)}">${escapeHtml(estado)}</span>
  ${(t.tipo || "fijo") !== "eventual" && t.dia_libre ? `<span class="badge-dia-libre">Día libre</span>` : ""}
  </div>
  </div>

  <div class="asignacion-card-resumen">${escapeHtml(resumenColapsado)}</div>
  <div class="asignacion-ayuda-expandir">
  ${tecnicoInactivo ? "Técnico deshabilitado" : "Toca para ver más y asignar"}
  </div>

  <div class="asignacion-detalle">
  ${
    (t.tipo || "fijo") !== "eventual" && t.dia_libre
      ? `<div class="asignacion-dia-libre-alerta">
  Este técnico está marcado con día libre, pero igual puede asignarse si lo necesitas.
  </div>`
      : ""
  }

  <div class="asignacion-detalle-item">
  <span class="asignacion-detalle-label">Trabajo actual</span>
  <span class="asignacion-detalle-valor">${trabajoActual ? escapeHtml(resumenCorto) : "Sin trabajo asignado"}</span>
  </div>

  <div class="asignacion-detalle-item">
  <span class="asignacion-detalle-label">Responsable actual</span>
  <span class="asignacion-detalle-valor">${trabajoActual ? escapeHtml(nombreResponsable(trabajoActual)) : "—"}</span>
  </div>
  </div>

  <div class="asignacion-acciones" onclick="event.stopPropagation()">
  <button
  class="${claseBoton}"
  ${disabledAttr}
  ${onclickBoton}
  >
  ${textoBoton}
  </button>
  </div>
  </div>
  `;
    })
    .join("");
}

function toggleTecnicoAsignacionExpandido(tecnicoId) {
  if (tecnicosAsignacionExpandidos.has(tecnicoId)) {
    tecnicosAsignacionExpandidos.delete(tecnicoId);
  } else {
    tecnicosAsignacionExpandidos.add(tecnicoId);
  }
  renderizarTecnicosAsignacion();
}

function cerrarModalAsignacion() {
  trabajoAsignacionId = null;
  actividadAsignacionId = null;
  tecnicosAsignacionExpandidos.clear();

  document.getElementById("asignacionTrabajoResumen").innerHTML = "";
  document.getElementById("listaTecnicosAsignacion").innerHTML = "";
  document.getElementById("buscarTecnicoAsignacion").value = "";
  document.getElementById("modalAsignacion").style.display = "none";
}

function pedirDecisionParticipacionOrigenV2({
  trabajo,
  actividad,
  tecnico,
  esUltimoActivo = false,
}) {
  return new Promise((resolve) => {
    const existente = document.getElementById(
      "modalDecisionParticipacionOrigenV2",
    );
    if (existente) existente.remove();

    const nombreTecnico =
      tecnico?.tecnico_nombre || tecnico?.nombre || "Técnico";
    const nombreActividad = actividad?.descripcion || "Actividad";
    const nombreTrabajo = trabajo?.descripcion || "Sin descripción";
    const responsable = nombreResponsable(trabajo || {}) || "Sin responsable";

    const texto = esUltimoActivo
      ? "Este técnico es el último activo en su actividad actual. Debes decidir qué pasará con su participación antes de moverlo."
      : "Este técnico ya participa en otra actividad. Debes decidir qué hacer con su participación actual antes de moverlo.";

    const overlay = document.createElement("div");
    overlay.id = "modalDecisionParticipacionOrigenV2";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(15, 23, 42, 0.55)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "9999";
    overlay.style.padding = "16px";

    overlay.innerHTML = `
<div style="
  width:100%;
  max-width:620px;
  background:#ffffff;
  border-radius:16px;
  box-shadow:0 20px 50px rgba(0,0,0,0.25);
  padding:20px;
  max-height:90vh;
  overflow:auto;
">
  <div style="font-size:20px; font-weight:700; color:#0f172a; margin-bottom:10px;">
    Decidir participación origen
  </div>

  <div style="font-size:14px; color:#475569; line-height:1.5;">
    ${escapeHtml(texto)}
  </div>

  <div style="margin-top:12px; padding:12px; border:1px solid #d9dee7; border-radius:12px; background:#f8fafc;">
    <div><strong>Técnico:</strong> ${escapeHtml(nombreTecnico)}</div>
    <div style="margin-top:4px;"><strong>Actividad actual:</strong> ${escapeHtml(nombreActividad)}</div>
    <div style="margin-top:4px;"><strong>Trabajo actual:</strong> ${escapeHtml(nombreTrabajo)}</div>
    <div style="margin-top:4px;"><strong>Responsable:</strong> ${escapeHtml(responsable)}</div>
  </div>

  <div style="margin-top:10px; font-size:13px; color:#475569;">
    <strong>Pausar participación</strong>: el técnico sale temporalmente de esa actividad.<br>
    <strong>Finalizar participación</strong>: el técnico deja cerrada su participación en esa actividad.
  </div>

  <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap; margin-top:18px;">
    <button id="btnPausarParticipacionOrigenV2" type="button" style="padding:10px 14px; border:none; border-radius:10px; background:#475569; color:#fff; font-weight:600; cursor:pointer;">
      Pausar participación
    </button>
    <button id="btnFinalizarParticipacionOrigenV2" type="button" style="padding:10px 14px; border:none; border-radius:10px; background:#16a34a; color:#fff; font-weight:600; cursor:pointer;">
      Finalizar participación
    </button>
    <button id="btnCancelarParticipacionOrigenV2" type="button" style="padding:10px 14px; border:1px solid #cbd5e1; border-radius:10px; background:#fff; color:#0f172a; font-weight:600; cursor:pointer;">
      Cancelar
    </button>
  </div>
</div>
`;

    const cerrar = (accion = "__cancelar__") => {
      overlay.remove();
      resolve(accion);
    };

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) cerrar("__cancelar__");
    });

    document.body.appendChild(overlay);

    document.getElementById("btnPausarParticipacionOrigenV2").onclick = () =>
      cerrar("pausado");

    document.getElementById("btnFinalizarParticipacionOrigenV2").onclick = () =>
      cerrar("finalizado");

    document.getElementById("btnCancelarParticipacionOrigenV2").onclick = () =>
      cerrar("__cancelar__");
  });
}

async function resolverSalidaParticipacionOrigenV2({
  tecnico,
  trabajoDestino,
  actividadDestinoId,
  accionPredefinida = null,
}) {
  const tecnicoId = Number(tecnico?.id || 0);
  const trabajoActualId =
    tecnico?.trabajo_id != null ? Number(tecnico.trabajo_id) : null;

  if (!tecnicoId || trabajoActualId == null) {
    return { ok: true, actividadOrigen: null, trabajoOrigen: null };
  }

  let trabajoOrigen = null;
  let actividadOrigen = null;

  if (trabajoActualId === Number(trabajoDestino?.id)) {
    const actividadesMismoTrabajo = Array.isArray(trabajoDestino?.actividades)
      ? trabajoDestino.actividades
      : [];

    actividadOrigen =
      actividadesMismoTrabajo.find((a) => {
        const actividadId = String(a?.id || "").trim();
        const participantes = Array.isArray(a?.participantes)
          ? a.participantes
          : [];

        return (
          actividadId !== String(actividadDestinoId || "").trim() &&
          participantes.some(
            (p) =>
              Number(p?.tecnico_id) === tecnicoId &&
              p?.activo !== false &&
              String(p?.estado || "").toLowerCase() === "activo",
          )
        );
      }) || null;

    trabajoOrigen = trabajoDestino || null;
  } else {
    const trabajoOrigenRef = window.db
      .collection("trabajos")
      .doc(String(trabajoActualId));

    const trabajoOrigenSnap = await trabajoOrigenRef.get();
    if (trabajoOrigenSnap.exists) {
      trabajoOrigen = trabajoOrigenSnap.data() || null;
    }

    actividadOrigen =
      (await buscarActividadActivaDelTecnicoV2(trabajoActualId, tecnicoId)) ||
      null;
  }

  if (!actividadOrigen) {
    return { ok: true, actividadOrigen: null, trabajoOrigen };
  }

  const cantidadActivosOrigen = Array.isArray(
    actividadOrigen.tecnicos_activos_ids,
  )
    ? actividadOrigen.tecnicos_activos_ids.length
    : 0;

  let accion = accionPredefinida;

  if (!accion) {
    accion = await pedirDecisionParticipacionOrigenV2({
      trabajo: trabajoOrigen || trabajoDestino,
      actividad: actividadOrigen,
      tecnico,
      esUltimoActivo: cantidadActivosOrigen <= 1,
    });
  }

  if (!accion || accion === "__cancelar__") {
    return { ok: false, actividadOrigen, trabajoOrigen };
  }

  await liberarTecnicoDeTrabajo(
    Number(actividadOrigen.trabajo_id),
    tecnicoId,
    accion,
    actividadOrigen.id,
  );

  return { ok: true, actividadOrigen, trabajoOrigen, accion };
}

async function asignarTecnico(
  trabajoId,
  tecnicoId,
  accionOrigenSiVacio = null,
) {
  if (!validarBatuta()) return;

  const clave = `asignar-${trabajoId}-${tecnicoId}`;
  if (!iniciarAccion(clave)) return;

  try {
    const actividadId = String(actividadAsignacionId || "").trim();

    if (!actividadId) {
      alert("No se encontró la actividad seleccionada.");
      return;
    }

    const trabajoRef = window.db.collection("trabajos").doc(String(trabajoId));
    const actividadRef = window.db.collection("actividades").doc(actividadId);
    const tecnicoRef = window.db.collection("tecnicos").doc(String(tecnicoId));

    const [trabajoSnap, actividadSnap, tecnicoSnap] = await Promise.all([
      trabajoRef.get(),
      actividadRef.get(),
      tecnicoRef.get(),
    ]);

    if (!trabajoSnap.exists) {
      alert("Trabajo no encontrado.");
      return;
    }

    if (!actividadSnap.exists) {
      alert("Actividad no encontrada.");
      return;
    }

    if (!tecnicoSnap.exists) {
      alert("Técnico no encontrado.");
      return;
    }

    const trabajo = trabajoSnap.data() || {};
    const actividad = actividadSnap.data() || {};
    const tecnico = tecnicoSnap.data() || {};

    if (Number(actividad.trabajo_id) !== Number(trabajoId)) {
      alert("La actividad no pertenece al trabajo seleccionado.");
      return;
    }

    if (actividad.activo === false) {
      alert("La actividad no está activa.");
      return;
    }

    const actividadesDestinoSnap = await window.db
      .collection("actividades")
      .where("trabajo_id", "==", Number(trabajoId))
      .where("activo", "==", true)
      .get();

    let actividadesDestino = actividadesDestinoSnap.docs.map((doc) =>
      doc.id === actividadId ? { ...doc.data(), id_doc: doc.id } : doc.data(),
    );

    let actividadDestinoIndex = actividadesDestino.findIndex(
      (a) => String(a?.id || "").trim() === actividadId,
    );

    if (actividadDestinoIndex === -1) {
      alert("No se encontró la actividad seleccionada.");
      return;
    }

    let actividadDestinoActual = {
      ...actividadesDestino[actividadDestinoIndex],
    };

    let tecnicosActivosIds = Array.isArray(
      actividadDestinoActual.tecnicos_activos_ids,
    )
      ? [...actividadDestinoActual.tecnicos_activos_ids]
      : [];
    let tecnicosActivosNombres = Array.isArray(
      actividadDestinoActual.tecnicos_activos_nombres,
    )
      ? [...actividadDestinoActual.tecnicos_activos_nombres]
      : [];
    let tecnicosParticipantesIds = Array.isArray(
      actividadDestinoActual.tecnicos_participantes_ids,
    )
      ? [...actividadDestinoActual.tecnicos_participantes_ids]
      : [];
    let ultimoTecnicosIds = Array.isArray(
      actividadDestinoActual.ultimo_tecnicos_ids,
    )
      ? [...actividadDestinoActual.ultimo_tecnicos_ids]
      : [];
    let ultimoTecnicosNombres = Array.isArray(
      actividadDestinoActual.ultimo_tecnicos_nombres,
    )
      ? [...actividadDestinoActual.ultimo_tecnicos_nombres]
      : [];
    let participantesDestino = Array.isArray(
      actividadDestinoActual.participantes,
    )
      ? [...actividadDestinoActual.participantes]
      : [];

    if (tecnicosActivosIds.some((id) => Number(id) === Number(tecnicoId))) {
      alert("El técnico ya está asignado a esta actividad.");
      return;
    }

    const salidaOrigen = await resolverSalidaParticipacionOrigenV2({
      tecnico,
      trabajoDestino: {
        ...trabajo,
        actividades: actividadesDestino,
      },
      actividadDestinoId: actividadId,
      accionPredefinida: accionOrigenSiVacio,
    });

    if (!salidaOrigen.ok) {
      return;
    }

    const actividadesDestinoRecargadasSnap = await window.db
      .collection("actividades")
      .where("trabajo_id", "==", Number(trabajoId))
      .where("activo", "==", true)
      .get();

    actividadesDestino = actividadesDestinoRecargadasSnap.docs.map((doc) =>
      doc.id === actividadId ? { ...doc.data(), id_doc: doc.id } : doc.data(),
    );

    actividadDestinoIndex = actividadesDestino.findIndex(
      (a) => String(a?.id || "").trim() === actividadId,
    );

    if (actividadDestinoIndex === -1) {
      alert("No se pudo recargar la actividad destino.");
      return;
    }

    actividadDestinoActual = { ...actividadesDestino[actividadDestinoIndex] };

    tecnicosActivosIds = Array.isArray(
      actividadDestinoActual.tecnicos_activos_ids,
    )
      ? [...actividadDestinoActual.tecnicos_activos_ids]
      : [];
    tecnicosActivosNombres = Array.isArray(
      actividadDestinoActual.tecnicos_activos_nombres,
    )
      ? [...actividadDestinoActual.tecnicos_activos_nombres]
      : [];
    tecnicosParticipantesIds = Array.isArray(
      actividadDestinoActual.tecnicos_participantes_ids,
    )
      ? [...actividadDestinoActual.tecnicos_participantes_ids]
      : [];
    ultimoTecnicosIds = Array.isArray(
      actividadDestinoActual.ultimo_tecnicos_ids,
    )
      ? [...actividadDestinoActual.ultimo_tecnicos_ids]
      : [];
    ultimoTecnicosNombres = Array.isArray(
      actividadDestinoActual.ultimo_tecnicos_nombres,
    )
      ? [...actividadDestinoActual.ultimo_tecnicos_nombres]
      : [];
    participantesDestino = Array.isArray(actividadDestinoActual.participantes)
      ? [...actividadDestinoActual.participantes]
      : [];

    const ahoraIso = new Date().toISOString();

    if (!tecnicosActivosIds.some((id) => Number(id) === Number(tecnico.id))) {
      tecnicosActivosIds.push(tecnico.id);
    }

    if (!tecnicosActivosNombres.includes(tecnico.nombre || "Técnico")) {
      tecnicosActivosNombres.push(tecnico.nombre || "Técnico");
    }

    if (
      !tecnicosParticipantesIds.some((id) => Number(id) === Number(tecnico.id))
    ) {
      tecnicosParticipantesIds.push(tecnico.id);
    }

    const participanteIndexDestino = participantesDestino.findIndex(
      (p) => Number(p?.tecnico_id) === Number(tecnico.id),
    );

    const participanteDestinoActualizado = {
      tecnico_id: tecnico.id,
      tecnico_nombre: tecnico.nombre || "Técnico",
      estado: "activo",
      asignado_at:
        participantesDestino[participanteIndexDestino]?.asignado_at || ahoraIso,
      asignado_por_usuario_id: String(window.USUARIO_ID_ACTUAL || ""),
      asignado_por_nombre: String(window.USUARIO_NOMBRE_ACTUAL || ""),
      inicio_actual_at: ahoraIso,
      pausa_actual_at: null,
      finalizado_at: null,
      tiempo_real_seg: Number(
        participantesDestino[participanteIndexDestino]?.tiempo_real_seg || 0,
      ),
      tiempo_pausa_seg: Number(
        participantesDestino[participanteIndexDestino]?.tiempo_pausa_seg || 0,
      ),
      cantidad_pausas: Number(
        participantesDestino[participanteIndexDestino]?.cantidad_pausas || 0,
      ),
      activo: true,
      visible_en_tarjeta: true,
    };

    if (participanteIndexDestino === -1) {
      participantesDestino.push(participanteDestinoActualizado);
    } else {
      participantesDestino[participanteIndexDestino] = {
        ...participantesDestino[participanteIndexDestino],
        ...participanteDestinoActualizado,
      };
    }

    const actividadDestinoUpdate = {
      participantes: participantesDestino,
      estado: "en_proceso",
      primer_inicio_at: actividadDestinoActual.primer_inicio_at || ahoraIso,
      ultima_reanudacion_at: ahoraIso,
      ultima_actividad_at: ahoraIso,
      inicio_tramo_activo_at: ahoraIso,
      inicio_tramo_pausa_at: null,
      finalizado_at: null,
      tecnicos_activos_ids: tecnicosActivosIds,
      tecnicos_activos_nombres: tecnicosActivosNombres,
      tecnicos_activos_count: tecnicosActivosIds.length,
      tecnicos_participantes_ids: tecnicosParticipantesIds,
      tecnicos_participantes_count: tecnicosParticipantesIds.length,
      ultimo_tecnicos_ids: ultimoTecnicosIds.filter(
        (id) => Number(id) !== Number(tecnico.id),
      ),
      ultimo_tecnicos_nombres: ultimoTecnicosNombres.filter(
        (nombre) => nombre !== (tecnico.nombre || "Técnico"),
      ),
    };

    actividadesDestino[actividadDestinoIndex] = {
      ...actividadDestinoActual,
      ...actividadDestinoUpdate,
    };

    const {
      nuevoEstadoTrabajo,
      actividadesPendientes,
      actividadesEnProceso,
      actividadesPausadas,
      actividadesFinalizadas,
      tecnicosActivosTotal,
      tecnicosParticipantesCount,
    } = resumirEstadosTrabajoDesdeActividades(actividadesDestino);

    const batch = window.db.batch();

    batch.update(actividadRef, actividadDestinoUpdate);

    batch.update(tecnicoRef, {
      estado: "trabajando",
      trabajo_id: Number(trabajoId),
      almuerzo_desde: null,
      almuerzo_hasta: null,
      actividad_origen_almuerzo_id: null,
      trabajo_origen_almuerzo_id: null,
    });

    batch.update(trabajoRef, {
      estado: nuevoEstadoTrabajo,
      primer_inicio_at: trabajo.primer_inicio_at || ahoraIso,
      ultima_actividad_at: ahoraIso,
      finalizado_at: nuevoEstadoTrabajo === "finalizado" ? ahoraIso : null,
      total_actividades: actividadesDestino.length,
      actividades_pendientes: actividadesPendientes,
      actividades_en_proceso: actividadesEnProceso,
      actividades_pausadas: actividadesPausadas,
      actividades_finalizadas: actividadesFinalizadas,
      tecnicos_activos_count: tecnicosActivosTotal,
      tecnicos_participantes_count: tecnicosParticipantesCount,
    });

    await batch.commit();

    await crearEventoActividad({
      tipo: "tecnico_asignado",
      trabajoId,
      actividadId,
      tecnicoId: tecnico.id,
      tecnicoNombre: tecnico.nombre || "Técnico",
    });

    cerrarModalAsignacion();
  } catch (error) {
    console.error("Error asignando técnico en actividad:", error);
    alert("No se pudo asignar el técnico.");
  } finally {
    finalizarAccion(clave);
  }
}

async function crearEventoActividad({
  tipo,
  trabajoId,
  actividadId,
  tecnicoId,
  tecnicoNombre,
}) {
  try {
    const ahora = new Date();

    await window.db.collection("actividad_eventos").add({
      tipo, // "asignacion", "pausa", etc
      trabajo_id: Number(trabajoId),
      actividad_id: String(actividadId),
      tecnico_id: Number(tecnicoId),
      tecnico_nombre: tecnicoNombre || "Técnico",
      timestamp: ahora.toISOString(),
      timestamp_ms: ahora.getTime(),
      fecha_local: obtenerFechaLocalISO(), // 👈 NUEVO
    });
  } catch (error) {
    console.error("Error creando evento de actividad:", error);
  }
}

async function pedirLiberarTecnico(trabajoId, actividadId, tecnicoId) {
  if (!validarBatuta()) return;

  const trabajo = (ultimoResumen.trabajos || []).find(
    (t) => Number(t.id) === Number(trabajoId),
  );
  const tecnico = (ultimoResumen.tecnicos || []).find(
    (t) => Number(t.id) === Number(tecnicoId),
  );

  if (!trabajo) {
    alert("No se encontró el trabajo.");
    return;
  }

  const actividades = Array.isArray(trabajo.actividades)
    ? trabajo.actividades
    : [];

  const actividadActual = actividades.find(
    (a) => String(a?.id || "").trim() === String(actividadId || "").trim(),
  );

  if (!actividadActual) {
    alert("No se encontró la actividad.");
    return;
  }

  const participantes = Array.isArray(actividadActual.participantes)
    ? actividadActual.participantes
    : [];

  const participanteActual = participantes.find(
    (p) =>
      Number(p?.tecnico_id) === Number(tecnicoId) &&
      String(p?.estado || "").toLowerCase() !== "finalizado",
  );

  if (!participanteActual) {
    alert("No se encontró la participación del técnico en esta actividad.");
    return;
  }

  const cantidadActivos = Array.isArray(actividadActual.tecnicos_activos_ids)
    ? actividadActual.tecnicos_activos_ids.length
    : 0;

  const nombreTecnico = tecnico?.nombre || "Técnico";
  const nombreActividad = actividadActual.descripcion || "Actividad";
  const estadoParticipante = String(
    participanteActual.estado || "",
  ).toLowerCase();
  const esActivo =
    participanteActual?.activo !== false && estadoParticipante === "activo";

  const esUltimoActivo = esActivo && cantidadActivos <= 1;

  const ejecutarFinalizacionParticipacion = async () => {
    await liberarTecnicoDeTrabajo(
      trabajoId,
      tecnicoId,
      "finalizado",
      actividadActual.id,
    );

    await evaluarTrabajoLuegoDeAccion(trabajoId);
  };

  if (esUltimoActivo) {
    abrirModalConfirmacion({
      titulo: "Finalizar participación",
      texto:
        "Este técnico es el último activo en la actividad. Su participación se finalizará y la actividad también quedará finalizada.",
      destacado: `
<strong>Técnico:</strong> ${escapeHtml(nombreTecnico)}<br>
<strong>Actividad:</strong> ${escapeHtml(nombreActividad)}
`,
      boton: "Finalizar participación",
      claseBoton: "btn-principal",
      onConfirm: ejecutarFinalizacionParticipacion,
    });
    return;
  }

  abrirModalConfirmacion({
    titulo: "Finalizar participación",
    texto: "Este técnico dejará de participar en esta actividad.",
    destacado: `
<strong>Técnico:</strong> ${escapeHtml(nombreTecnico)}<br>
<strong>Actividad:</strong> ${escapeHtml(nombreActividad)}
`,
    boton: "Finalizar participación",
    claseBoton: "btn-principal",
    onConfirm: ejecutarFinalizacionParticipacion,
  });
}

async function evaluarTrabajoLuegoDeAccion(trabajoId) {
  try {
    const actividadesSnap = await window.db
      .collection("actividades")
      .where("trabajo_id", "==", Number(trabajoId))
      .where("activo", "==", true)
      .get();

    const actividades = actividadesSnap.docs.map((doc) => doc.data() || {});

    const hayEnProceso = actividades.some(
      (a) => String(a?.estado || "").toLowerCase() === "en_proceso",
    );

    if (hayEnProceso) return;

    const hayPausadas = actividades.some(
      (a) => String(a?.estado || "").toLowerCase() === "pausado",
    );

    const pendientesSinTecnico = actividades.filter((a) => {
      const estado = String(a?.estado || "").toLowerCase();

      const participantes = Array.isArray(a?.participantes)
        ? a.participantes
        : [];

      const tuvoParticipacion = participantes.some(
        (p) => Number(p?.tecnico_id || 0) > 0,
      );

      return estado === "pendiente" && !tuvoParticipacion;
    });

    if (hayPausadas || pendientesSinTecnico.length > 0) {
      await confirmarFinalizacionTrabajoCompletoConPendientes(trabajoId);
    }
  } catch (error) {
    console.error("Error evaluando trabajo después de acción:", error);
  }
}

async function pedirPausarParticipacion(trabajoId, actividadId, tecnicoId) {
  if (!validarBatuta()) return;

  const trabajo = (ultimoResumen.trabajos || []).find(
    (t) => Number(t.id) === Number(trabajoId),
  );
  const tecnico = (ultimoResumen.tecnicos || []).find(
    (t) => Number(t.id) === Number(tecnicoId),
  );

  if (!trabajo) {
    alert("No se encontró el trabajo.");
    return;
  }

  const actividades = Array.isArray(trabajo.actividades)
    ? trabajo.actividades
    : [];

  const actividadActual = actividades.find(
    (a) => String(a?.id || "").trim() === String(actividadId || "").trim(),
  );

  if (!actividadActual) {
    alert("No se encontró la actividad.");
    return;
  }

  const cantidadActivos = Array.isArray(actividadActual.tecnicos_activos_ids)
    ? actividadActual.tecnicos_activos_ids.length
    : 0;

  const nombreTecnico = tecnico?.nombre || "Técnico";
  const nombreActividad = actividadActual.descripcion || "Actividad";

  if (cantidadActivos <= 1) {
    abrirModalConfirmacion({
      titulo: "Pausar participación",
      texto:
        "Este técnico es el último activo en la actividad. Su participación se pausará y la actividad también quedará pausada.",
      destacado: `
<strong>Técnico:</strong> ${escapeHtml(nombreTecnico)}<br>
<strong>Actividad:</strong> ${escapeHtml(nombreActividad)}
`,
      boton: "Pausar participación",
      claseBoton: "btn-secundario",
      onConfirm: async () => {
        await liberarTecnicoDeTrabajo(
          trabajoId,
          tecnicoId,
          "pausado",
          actividadActual.id,
        );
      },
    });
    return;
  }

  abrirModalConfirmacion({
    titulo: "Pausar participación",
    texto:
      "Este técnico saldrá temporalmente de la actividad actual y podrá retomarla después.",
    destacado: `
<strong>Técnico:</strong> ${escapeHtml(nombreTecnico)}<br>
<strong>Actividad:</strong> ${escapeHtml(nombreActividad)}
`,
    boton: "Pausar participación",
    claseBoton: "btn-secundario",
    onConfirm: async () => {
      await liberarTecnicoDeTrabajo(
        trabajoId,
        tecnicoId,
        "pausado",
        actividadActual.id,
      );
    },
  });
}

async function liberarTecnicoDeTrabajo(
  trabajoId,
  tecnicoId,
  accionSiVacio = null,
  actividadIdOrigen = null,
) {
  if (!validarBatuta()) return;

  const clave = `liberar-${trabajoId}-${tecnicoId}`;
  if (!iniciarAccion(clave)) return;

  try {
    const actividadId = String(actividadIdOrigen || "").trim();

    if (!actividadId) {
      alert("No se encontró la actividad origen del técnico.");
      return;
    }

    const trabajoRef = window.db.collection("trabajos").doc(String(trabajoId));
    const actividadRef = window.db.collection("actividades").doc(actividadId);
    const tecnicoRef = window.db.collection("tecnicos").doc(String(tecnicoId));

    const [trabajoSnap, actividadSnap, tecnicoSnap] = await Promise.all([
      trabajoRef.get(),
      actividadRef.get(),
      tecnicoRef.get(),
    ]);

    if (!trabajoSnap.exists || !actividadSnap.exists || !tecnicoSnap.exists) {
      alert("Datos no encontrados.");
      return;
    }

    const trabajo = trabajoSnap.data() || {};
    const actividad = actividadSnap.data() || {};
    const tecnico = tecnicoSnap.data() || {};

    if (Number(actividad.trabajo_id) !== Number(trabajoId)) {
      alert("La actividad origen no pertenece al trabajo indicado.");
      return;
    }

    const participantes = Array.isArray(actividad.participantes)
      ? [...actividad.participantes]
      : [];

    const index = participantes.findIndex(
      (p) =>
        Number(p?.tecnico_id) === Number(tecnicoId) &&
        String(p?.estado || "").toLowerCase() !== "finalizado",
    );

    if (index === -1) {
      alert("No se encontró la participación del técnico.");
      return;
    }

    const participante = { ...participantes[index] };
    const estadoAnterior = String(participante?.estado || "").toLowerCase();
    const eraActivo =
      participante?.activo !== false && estadoAnterior === "activo";

    const ahora = new Date();
    const ahoraIso = ahora.toISOString();

    if (participante.inicio_actual_at) {
      const inicio = new Date(participante.inicio_actual_at);
      if (!isNaN(inicio.getTime())) {
        const extra = Math.max(0, Math.floor((ahora - inicio) / 1000));
        participante.tiempo_real_seg =
          Number(participante.tiempo_real_seg || 0) + extra;
      }
    }

    const accionNormalizada = String(accionSiVacio || "").toLowerCase();

    if (accionNormalizada === "pausado") {
      participante.estado = "pausado";
      participante.visible_en_tarjeta = true;
      participante.pausa_actual_at = ahoraIso;
      participante.finalizado_at = null;
    } else {
      participante.estado = "finalizado";
      participante.visible_en_tarjeta = true;
      participante.pausa_actual_at = null;
      participante.finalizado_at = ahoraIso;
    }

    participante.activo = false;
    participante.inicio_actual_at = null;

    participantes[index] = participante;

    const activosIds = (
      Array.isArray(actividad.tecnicos_activos_ids)
        ? actividad.tecnicos_activos_ids
        : []
    ).filter((id) => Number(id) !== Number(tecnicoId));

    const nombreTecnico =
      participante.tecnico_nombre || tecnico.nombre || "Técnico";

    const activosNombres = (
      Array.isArray(actividad.tecnicos_activos_nombres)
        ? actividad.tecnicos_activos_nombres
        : []
    ).filter((n) => n !== nombreTecnico);

    const ultimoIdsBase = Array.isArray(actividad.ultimo_tecnicos_ids)
      ? [...actividad.ultimo_tecnicos_ids]
      : [];
    const ultimoNombresBase = Array.isArray(actividad.ultimo_tecnicos_nombres)
      ? [...actividad.ultimo_tecnicos_nombres]
      : [];

    const ultimoIds = ultimoIdsBase.filter(
      (id) => Number(id) !== Number(tecnicoId),
    );
    const ultimoNombres = ultimoNombresBase.filter((n) => n !== nombreTecnico);

    if (!ultimoIds.some((id) => Number(id) === Number(tecnicoId))) {
      ultimoIds.push(Number(tecnicoId));
    }

    if (!ultimoNombres.includes(nombreTecnico)) {
      ultimoNombres.push(nombreTecnico);
    }

    const participantesVigentes = participantes.filter(
      (p) => String(p?.estado || "").toLowerCase() !== "finalizado",
    );

    const hayActivos = participantesVigentes.some(
      (p) =>
        p?.activo !== false &&
        String(p?.estado || "").toLowerCase() === "activo",
    );

    const hayPausados = participantesVigentes.some(
      (p) => String(p?.estado || "").toLowerCase() === "pausado",
    );

    let nuevoEstadoActividad = "pendiente";

    if (hayActivos) {
      nuevoEstadoActividad = "en_proceso";
    } else if (hayPausados) {
      nuevoEstadoActividad = "pausado";
    } else if (accionNormalizada === "finalizado") {
      nuevoEstadoActividad = "finalizado";
    } else {
      nuevoEstadoActividad = "pausado";
    }

    const actividadUpdate = {
      participantes,
      tecnicos_activos_ids: activosIds,
      tecnicos_activos_nombres: activosNombres,
      tecnicos_activos_count: activosIds.length,
      estado: nuevoEstadoActividad,
      ultima_actividad_at: ahoraIso,
      inicio_tramo_activo_at:
        activosIds.length > 0 ? actividad.inicio_tramo_activo_at || null : null,
      inicio_tramo_pausa_at:
        nuevoEstadoActividad === "pausado" ? ahoraIso : null,
      ultima_pausa_at:
        nuevoEstadoActividad === "pausado"
          ? ahoraIso
          : actividad.ultima_pausa_at || null,
      finalizado_at: nuevoEstadoActividad === "finalizado" ? ahoraIso : null,
      ultimo_tecnicos_ids: ultimoIds,
      ultimo_tecnicos_nombres: ultimoNombres,
    };

    const actividadesSnap = await window.db
      .collection("actividades")
      .where("trabajo_id", "==", Number(trabajoId))
      .where("activo", "==", true)
      .get();

    const actividadesActualizadas = actividadesSnap.docs.map((doc) => {
      const data = doc.data() || {};
      if (doc.id === actividadRef.id) {
        return {
          ...data,
          ...actividadUpdate,
        };
      }
      return data;
    });

    const {
      nuevoEstadoTrabajo,
      actividadesPendientes,
      actividadesEnProceso,
      actividadesPausadas,
      actividadesFinalizadas,
      tecnicosActivosTotal,
      tecnicosParticipantesCount,
    } = resumirEstadosTrabajoDesdeActividades(actividadesActualizadas);

    const hayEnProcesoDespues = actividadesActualizadas.some(
      (a) => String(a?.estado || "").toLowerCase() === "en_proceso",
    );

    const hayPausadasDespues = actividadesActualizadas.some(
      (a) => String(a?.estado || "").toLowerCase() === "pausado",
    );

    const pendientesSinTecnicoDespues = actividadesActualizadas.filter((a) => {
      const estado = String(a?.estado || "").toLowerCase();
      const participantesAct = Array.isArray(a?.participantes)
        ? a.participantes
        : [];
      const tuvoParticipacion = participantesAct.some(
        (p) => Number(p?.tecnico_id || 0) > 0,
      );

      return estado === "pendiente" && !tuvoParticipacion;
    });

    const requiereDecisionAntesDeGuardar =
      accionNormalizada === "finalizado" &&
      !hayEnProcesoDespues &&
      !hayPausadasDespues &&
      pendientesSinTecnicoDespues.length > 0;

    if (requiereDecisionAntesDeGuardar) {
      const existente = document.getElementById(
        "modalDecisionTrabajoConPendientesFinalizarParticipacion",
      );
      if (existente) existente.remove();

      const overlay = document.createElement("div");
      overlay.id = "modalDecisionTrabajoConPendientesFinalizarParticipacion";
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.background = "rgba(15, 23, 42, 0.55)";
      overlay.style.display = "flex";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      overlay.style.zIndex = "9999";
      overlay.style.padding = "16px";

      overlay.innerHTML = `
<div style="
  width:100%;
  max-width:620px;
  background:#ffffff;
  border-radius:16px;
  box-shadow:0 20px 50px rgba(0,0,0,0.25);
  padding:20px;
  max-height:90vh;
  overflow:auto;
">
  <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:10px;">
    <div style="font-size:20px; font-weight:700; color:#0f172a;">
      Confirmar finalización del trabajo
    </div>
    <button id="btnCerrarDecisionParticipacionPendiente" type="button" style="padding:8px 12px; border:none; border-radius:10px; background:#e5e7eb; color:#374151; font-weight:600; cursor:pointer;">
      Cerrar
    </button>
  </div>

  <div style="font-size:14px; color:#475569; line-height:1.5;">
    Este trabajo todavía tiene actividades pendientes sin técnico.
  </div>

  <div style="margin-top:12px; padding:12px; border:1px solid #d9dee7; border-radius:12px; background:#f8fafc; color:#111827; font-size:14px; line-height:1.5;">
    <div><strong>Trabajo:</strong> ${escapeHtml(trabajo?.descripcion || "Sin descripción")}</div>
    <div style="margin-top:12px; font-weight:700; margin-bottom:8px; color:#b42318;">
      Actividades pendientes sin técnico
    </div>
    ${pendientesSinTecnicoDespues
      .map(
        (a, i) => `
      <div style="margin-top:6px;">${i + 1}. ${escapeHtml(a?.descripcion || "Actividad")}</div>
    `,
      )
      .join("")}
    <div style="margin-top:14px;">
      ¿Deseas finalizar el trabajo de todas formas o mantenerlo abierto?
    </div>
  </div>

  <div style="display:flex; gap:10px; justify-content:flex-start; flex-wrap:wrap; margin-top:18px;">
    <button id="btnFinalizarTodoDesdeParticipacion" type="button" style="padding:10px 14px; border:none; border-radius:10px; background:#fbe7e7; color:#b42318; font-weight:700; cursor:pointer;">
      Finalizar de todas formas
    </button>
    <button id="btnMantenerAbiertoDesdeParticipacion" type="button" style="padding:10px 14px; border:none; border-radius:10px; background:#e5e7eb; color:#374151; font-weight:700; cursor:pointer;">
      Cancelar
    </button>
  </div>
</div>
`;

      const cerrar = () => {
        overlay.remove();
      };

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) cerrar();
      });

      document.body.appendChild(overlay);

      document.getElementById(
        "btnCerrarDecisionParticipacionPendiente",
      ).onclick = () => cerrar();

      document.getElementById("btnFinalizarTodoDesdeParticipacion").onclick =
        async () => {
          cerrar();
          await finalizarTrabajoCompleto(trabajoId);
        };

      document.getElementById("btnMantenerAbiertoDesdeParticipacion").onclick =
        async () => {
          cerrar();

          const batch = window.db.batch();

          batch.update(actividadRef, actividadUpdate);

          const updateTecnico = {};

          if (eraActivo) {
            updateTecnico.estado = "libre";
            updateTecnico.trabajo_id = null;
            updateTecnico.almuerzo_desde = null;
            updateTecnico.almuerzo_hasta = null;
            updateTecnico.actividad_origen_almuerzo_id = null;
            updateTecnico.trabajo_origen_almuerzo_id = null;
          } else if (
            String(tecnico.estado || "").toLowerCase() === "almuerzo" &&
            String(tecnico.actividad_origen_almuerzo_id || "").trim() ===
              actividadId
          ) {
            updateTecnico.actividad_origen_almuerzo_id = null;
            updateTecnico.trabajo_origen_almuerzo_id = null;
          }

          if (Object.keys(updateTecnico).length > 0) {
            batch.update(tecnicoRef, updateTecnico);
          }

          batch.update(trabajoRef, {
            estado: nuevoEstadoTrabajo,
            ultima_actividad_at: ahoraIso,
            finalizado_at:
              nuevoEstadoTrabajo === "finalizado" ? ahoraIso : null,
            total_actividades: actividadesActualizadas.length,
            actividades_pendientes: actividadesPendientes,
            actividades_en_proceso: actividadesEnProceso,
            actividades_pausadas: actividadesPausadas,
            actividades_finalizadas: actividadesFinalizadas,
            tecnicos_activos_count: tecnicosActivosTotal,
            tecnicos_participantes_count: tecnicosParticipantesCount,
          });

          await batch.commit();
        };

      return;
    }

    const batch = window.db.batch();

    batch.update(actividadRef, actividadUpdate);

    const updateTecnico = {};

    if (eraActivo) {
      updateTecnico.estado = "libre";
      updateTecnico.trabajo_id = null;
      updateTecnico.almuerzo_desde = null;
      updateTecnico.almuerzo_hasta = null;
      updateTecnico.actividad_origen_almuerzo_id = null;
      updateTecnico.trabajo_origen_almuerzo_id = null;
    } else if (
      String(tecnico.estado || "").toLowerCase() === "almuerzo" &&
      String(tecnico.actividad_origen_almuerzo_id || "").trim() === actividadId
    ) {
      updateTecnico.actividad_origen_almuerzo_id = null;
      updateTecnico.trabajo_origen_almuerzo_id = null;
    }

    if (Object.keys(updateTecnico).length > 0) {
      batch.update(tecnicoRef, updateTecnico);
    }

    batch.update(trabajoRef, {
      estado: nuevoEstadoTrabajo,
      ultima_actividad_at: ahoraIso,
      finalizado_at: nuevoEstadoTrabajo === "finalizado" ? ahoraIso : null,
      total_actividades: actividadesActualizadas.length,
      actividades_pendientes: actividadesPendientes,
      actividades_en_proceso: actividadesEnProceso,
      actividades_pausadas: actividadesPausadas,
      actividades_finalizadas: actividadesFinalizadas,
      tecnicos_activos_count: tecnicosActivosTotal,
      tecnicos_participantes_count: tecnicosParticipantesCount,
    });

    await batch.commit();
  } catch (error) {
    console.error("Error liberando técnico:", error);
    alert("No se pudo liberar al técnico de la actividad.");
  } finally {
    finalizarAccion(clave);
  }
}

async function reanudarParticipacionEnActividad(
  trabajoId,
  actividadId,
  tecnicoId,
) {
  if (!validarBatuta()) return;

  const trabajo = (ultimoResumen.trabajos || []).find(
    (t) => Number(t.id) === Number(trabajoId),
  );

  if (!trabajo) {
    alert("No se encontró el trabajo.");
    return;
  }

  const actividades = Array.isArray(trabajo.actividades)
    ? trabajo.actividades
    : [];

  const actividad = actividades.find(
    (a) => String(a?.id || "").trim() === String(actividadId || "").trim(),
  );

  if (!actividad) {
    alert("No se encontró la actividad.");
    return;
  }

  const participante = (
    Array.isArray(actividad.participantes) ? actividad.participantes : []
  ).find(
    (p) =>
      Number(p?.tecnico_id) === Number(tecnicoId) &&
      String(p?.estado || "").toLowerCase() === "pausado",
  );

  if (!participante) {
    alert("No se encontró una participación pausada para este técnico.");
    return;
  }

  const tecnicoRef = window.db.collection("tecnicos").doc(String(tecnicoId));
  const tecnicoSnap = await tecnicoRef.get();

  if (!tecnicoSnap.exists) {
    alert("No se encontró el técnico.");
    return;
  }

  const tecnico = tecnicoSnap.data() || {};

  if (tecnico.habilitado === false || tecnico.activo === false) {
    alert("Este técnico no está disponible para reanudar.");
    return;
  }

  const trabajoActualId =
    tecnico.trabajo_id != null ? Number(tecnico.trabajo_id) : null;

  const estaOcupadoEnOtraActividad =
    String(tecnico.estado || "").toLowerCase() === "trabajando" &&
    trabajoActualId != null;

  // Caso 1: está ocupado -> resolver con el modal nuevo y reanudar directo
  if (estaOcupadoEnOtraActividad) {
    const salidaOrigen = await resolverSalidaParticipacionOrigenV2({
      tecnico,
      trabajoDestino: trabajo,
      actividadDestinoId: actividadId,
    });

    if (!salidaOrigen.ok) {
      return;
    }

    const ok = await activarParticipantePausadoEnActividadV2(
      trabajoId,
      actividadId,
      tecnicoId,
    );

    if (!ok) {
      alert("No se pudo reanudar la participación.");
    }

    return;
  }

  // Caso 2: está libre -> usar el modal normal de confirmación
  abrirModalConfirmacion({
    titulo: "Reanudar participación",
    texto: "El técnico volverá a esta actividad y retomará su participación.",
    destacado: `
<strong>Técnico:</strong> ${escapeHtml(participante.tecnico_nombre || "Técnico")}<br>
<strong>Actividad:</strong> ${escapeHtml(actividad.descripcion || "Actividad")}
`,
    boton: "Reanudar participación",
    claseBoton: "btn-principal",
    onConfirm: async () => {
      const ok = await activarParticipantePausadoEnActividadV2(
        trabajoId,
        actividadId,
        tecnicoId,
      );

      if (!ok) {
        alert("No se pudo reanudar la participación.");
      }
    },
  });
}

async function cerrarActividad(trabajoId, actividadId) {
  if (!validarBatuta()) return;

  const clave = `cerrar-actividad-${trabajoId}-${actividadId}`;
  if (!iniciarAccion(clave)) return;

  try {
    const trabajoRef = window.db.collection("trabajos").doc(String(trabajoId));
    const actividadIdTexto = String(actividadId || "").trim();
    const actividadRef = window.db
      .collection("actividades")
      .doc(actividadIdTexto);

    const [trabajoSnap, actividadSnap, actividadesSnap] = await Promise.all([
      trabajoRef.get(),
      actividadRef.get(),
      window.db
        .collection("actividades")
        .where("trabajo_id", "==", Number(trabajoId))
        .where("activo", "==", true)
        .get(),
    ]);

    if (!trabajoSnap.exists) {
      alert("Trabajo no encontrado.");
      return;
    }

    if (!actividadSnap.exists) {
      alert("Actividad no encontrada.");
      return;
    }

    const trabajo = trabajoSnap.data() || {};
    const actividad = actividadSnap.data() || {};

    if (Number(actividad.trabajo_id) !== Number(trabajoId)) {
      alert("La actividad no pertenece al trabajo indicado.");
      return;
    }

    const participantes = Array.isArray(actividad.participantes)
      ? [...actividad.participantes]
      : [];

    const ahora = new Date();
    const ahoraIso = ahora.toISOString();

    const batch = window.db.batch();

    const idsUltimos = [];
    const nombresUltimos = [];
    const idsParticipantes = new Set(
      (Array.isArray(actividad.tecnicos_participantes_ids)
        ? actividad.tecnicos_participantes_ids
        : []
      ).map((id) => Number(id)),
    );

    const participantesActualizados = participantes.map((p) => {
      const actualizado = { ...p };
      const tecnicoId = Number(actualizado?.tecnico_id || 0);
      const tecnicoNombre = actualizado?.tecnico_nombre || "Técnico";
      const estadoActual = String(actualizado?.estado || "").toLowerCase();
      const estabaActivo =
        actualizado?.activo !== false && estadoActual === "activo";

      if (tecnicoId > 0) {
        idsParticipantes.add(tecnicoId);
      }

      if (!idsUltimos.includes(tecnicoId) && tecnicoId > 0) {
        idsUltimos.push(tecnicoId);
      }

      if (!nombresUltimos.includes(tecnicoNombre)) {
        nombresUltimos.push(tecnicoNombre);
      }

      if (estabaActivo && actualizado.inicio_actual_at) {
        const inicio = new Date(actualizado.inicio_actual_at);
        if (!isNaN(inicio.getTime())) {
          const extra = Math.max(0, Math.floor((ahora - inicio) / 1000));
          actualizado.tiempo_real_seg =
            Number(actualizado.tiempo_real_seg || 0) + extra;
        }
      }

      if (estadoActual !== "finalizado") {
        actualizado.estado = "finalizado";
      }

      actualizado.visible_en_tarjeta = true;
      actualizado.activo = false;
      actualizado.inicio_actual_at = null;
      actualizado.pausa_actual_at = null;
      actualizado.finalizado_at = ahoraIso;

      if (estabaActivo && tecnicoId > 0) {
        const tecnicoRef = window.db
          .collection("tecnicos")
          .doc(String(tecnicoId));

        batch.update(tecnicoRef, {
          estado: "libre",
          trabajo_id: null,
          almuerzo_desde: null,
          almuerzo_hasta: null,
        });
      }

      return actualizado;
    });

    const actividadUpdate = {
      participantes: participantesActualizados,
      estado: "finalizado",
      ultima_actividad_at: ahoraIso,
      finalizado_at: ahoraIso,
      ultima_reanudacion_at: null,
      ultima_pausa_at: null,
      inicio_tramo_activo_at: null,
      inicio_tramo_pausa_at: null,
      tecnicos_activos_ids: [],
      tecnicos_activos_nombres: [],
      tecnicos_activos_count: 0,
      tecnicos_participantes_ids: Array.from(idsParticipantes),
      tecnicos_participantes_count: idsParticipantes.size,
      ultimo_tecnicos_ids: idsUltimos.filter((id) => id > 0),
      ultimo_tecnicos_nombres: nombresUltimos,
    };

    batch.update(actividadRef, actividadUpdate);

    const actividadesActualizadas = actividadesSnap.docs.map((doc) => {
      const data = doc.data() || {};
      if (doc.id === actividadIdTexto) {
        return {
          ...data,
          ...actividadUpdate,
        };
      }
      return data;
    });

    const {
      nuevoEstadoTrabajo,
      actividadesPendientes,
      actividadesEnProceso,
      actividadesPausadas,
      actividadesFinalizadas,
      tecnicosActivosTotal,
      tecnicosParticipantesCount,
    } = resumirEstadosTrabajoDesdeActividades(actividadesActualizadas);

    batch.update(trabajoRef, {
      estado: nuevoEstadoTrabajo,
      ultima_actividad_at: ahoraIso,
      finalizado_at: nuevoEstadoTrabajo === "finalizado" ? ahoraIso : null,
      total_actividades: actividadesActualizadas.length,
      actividades_pendientes: actividadesPendientes,
      actividades_en_proceso: actividadesEnProceso,
      actividades_pausadas: actividadesPausadas,
      actividades_finalizadas: actividadesFinalizadas,
      tecnicos_activos_count: tecnicosActivosTotal,
      tecnicos_participantes_count: tecnicosParticipantesCount,
    });

    const hayEnProceso = actividadesActualizadas.some(
      (a) => String(a?.estado || "").toLowerCase() === "en_proceso",
    );

    const hayPausadas = actividadesActualizadas.some(
      (a) => String(a?.estado || "").toLowerCase() === "pausado",
    );

    const pendientesSinTecnico = actividadesActualizadas.filter((a) => {
      const estado = String(a?.estado || "").toLowerCase();
      const participantesAct = Array.isArray(a?.participantes)
        ? a.participantes
        : [];
      const tuvoParticipacion = participantesAct.some(
        (p) => Number(p?.tecnico_id || 0) > 0,
      );

      return estado === "pendiente" && !tuvoParticipacion;
    });

    if (!hayEnProceso && !hayPausadas && pendientesSinTecnico.length > 0) {
      const decision = await new Promise((resolve) => {
        const existente = document.getElementById(
          "modalDecisionTrabajoConPendientes",
        );
        if (existente) existente.remove();

        const listaHtml = pendientesSinTecnico
          .map(
            (a) =>
              `<div style="margin-top:4px;">• ${escapeHtml(a?.descripcion || "Actividad")}</div>`,
          )
          .join("");

        const overlay = document.createElement("div");
        overlay.id = "modalDecisionTrabajoConPendientes";
        overlay.style.position = "fixed";
        overlay.style.inset = "0";
        overlay.style.background = "rgba(15, 23, 42, 0.55)";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        overlay.style.zIndex = "9999";
        overlay.style.padding = "16px";

        overlay.innerHTML = `
<div style="
  width:100%;
  max-width:620px;
  background:#ffffff;
  border-radius:16px;
  box-shadow:0 20px 50px rgba(0,0,0,0.25);
  padding:20px;
  max-height:90vh;
  overflow:auto;
">
  <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:10px;">
    <div style="font-size:20px; font-weight:700; color:#0f172a;">
      Trabajo con actividades pendientes
    </div>
    <button id="btnCerrarDecisionTrabajoPendiente" type="button" style="padding:8px 12px; border:none; border-radius:10px; background:#e5e7eb; color:#374151; font-weight:600; cursor:pointer;">
      Cerrar
    </button>
  </div>

  <div style="font-size:14px; color:#475569; line-height:1.5;">
    Aún quedan actividades pendientes sin técnico en este trabajo.
  </div>

  <div style="margin-top:12px; padding:12px; border:1px solid #d9dee7; border-radius:12px; background:#f8fafc; color:#111827; font-size:14px; line-height:1.5;">
    ${listaHtml}
    <div style="margin-top:12px;">
      ¿Deseas finalizar el trabajo de todas formas o mantenerlo abierto?
    </div>
  </div>

  <div style="display:flex; gap:10px; justify-content:flex-start; flex-wrap:wrap; margin-top:18px;">
    <button id="btnFinalizarTrabajoConPendientes" type="button" style="padding:10px 14px; border:none; border-radius:10px; background:#fbe7e7; color:#b42318; font-weight:700; cursor:pointer;">
      Finalizar de todas formas
    </button>
    <button id="btnCancelarFinalizacionTrabajoConPendientes" type="button" style="padding:10px 14px; border:none; border-radius:10px; background:#e5e7eb; color:#374151; font-weight:700; cursor:pointer;">
      Cancelar
    </button>
  </div>
</div>
`;

        const cerrar = (valor = "mantener_abierto") => {
          overlay.remove();
          resolve(valor);
        };

        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) cerrar("mantener_abierto");
        });

        document.body.appendChild(overlay);

        document.getElementById("btnCerrarDecisionTrabajoPendiente").onclick =
          () => cerrar("mantener_abierto");

        document.getElementById(
          "btnCancelarFinalizacionTrabajoConPendientes",
        ).onclick = () => cerrar("mantener_abierto");

        document.getElementById("btnFinalizarTrabajoConPendientes").onclick =
          () => cerrar("finalizar");
      });

      if (decision === "finalizar") {
        finalizarAccion(clave);
        await finalizarTrabajoCompleto(trabajoId);
        return;
      }

      await batch.commit();
      return;
    }

    await batch.commit();
  } catch (error) {
    console.error("Error cerrando actividad:", error);
    alert("No se pudo cerrar la actividad.");
  } finally {
    finalizarAccion(clave);
  }
}

function pedirEliminarActividadPendiente(trabajoId, actividadId) {
  if (!validarBatuta()) return;

  const trabajo = (ultimoResumen.trabajos || []).find(
    (t) => Number(t.id) === Number(trabajoId),
  );

  if (!trabajo) {
    alert("No se encontró el trabajo.");
    return;
  }

  const actividades = Array.isArray(trabajo.actividades)
    ? trabajo.actividades
    : [];

  const actividad = actividades.find(
    (a) => String(a?.id || "").trim() === String(actividadId || "").trim(),
  );

  if (!actividad) {
    alert("No se encontró la actividad.");
    return;
  }

  abrirModalConfirmacion({
    titulo: "Eliminar actividad pendiente",
    texto:
      "Esta actividad pendiente se eliminará del trabajo sin afectar el historial de las demás.",
    destacado: `
<strong>Actividad:</strong> ${escapeHtml(actividad.descripcion || "Actividad")}
`,
    boton: "Eliminar actividad",
    claseBoton: "btn-danger",
    onConfirm: async () => {
      await eliminarActividadPendiente(trabajoId, actividadId);
    },
  });
}

async function eliminarActividadPendiente(trabajoId, actividadId) {
  if (!validarBatuta()) return;

  const clave = `eliminar-actividad-${trabajoId}-${actividadId}`;
  if (!iniciarAccion(clave)) return;

  try {
    const trabajoRef = window.db.collection("trabajos").doc(String(trabajoId));
    const actividadRef = window.db
      .collection("actividades")
      .doc(String(actividadId).trim());

    const [trabajoSnap, actividadSnap, actividadesSnap] = await Promise.all([
      trabajoRef.get(),
      actividadRef.get(),
      window.db
        .collection("actividades")
        .where("trabajo_id", "==", Number(trabajoId))
        .where("activo", "==", true)
        .get(),
    ]);

    if (!trabajoSnap.exists) {
      alert("Trabajo no encontrado.");
      return;
    }

    if (!actividadSnap.exists) {
      alert("Actividad no encontrada.");
      return;
    }

    const trabajo = trabajoSnap.data() || {};
    const actividad = actividadSnap.data() || {};
    const estadoActividad = String(actividad?.estado || "").toLowerCase();

    const participantes = Array.isArray(actividad?.participantes)
      ? actividad.participantes
      : [];

    const tuvoParticipacion = participantes.some(
      (p) => Number(p?.tecnico_id || 0) > 0,
    );

    if (estadoActividad !== "pendiente" || tuvoParticipacion) {
      alert(
        "Solo se pueden eliminar actividades pendientes que nunca tuvieron técnico.",
      );
      return;
    }

    const ahoraIso = new Date().toISOString();
    const batch = window.db.batch();

    batch.update(actividadRef, {
      activo: false,
      eliminado_at: ahoraIso,
    });

    const actividadesRestantes = actividadesSnap.docs
      .filter((doc) => doc.id !== String(actividadId).trim())
      .map((doc) => doc.data() || {});

    const {
      nuevoEstadoTrabajo,
      actividadesPendientes,
      actividadesEnProceso,
      actividadesPausadas,
      actividadesFinalizadas,
      tecnicosActivosTotal,
      tecnicosParticipantesCount,
    } = resumirEstadosTrabajoDesdeActividades(actividadesRestantes);

    batch.update(trabajoRef, {
      estado: nuevoEstadoTrabajo,
      ultima_actividad_at: ahoraIso,
      finalizado_at: nuevoEstadoTrabajo === "finalizado" ? ahoraIso : null,
      total_actividades: actividadesRestantes.length,
      actividades_pendientes: actividadesPendientes,
      actividades_en_proceso: actividadesEnProceso,
      actividades_pausadas: actividadesPausadas,
      actividades_finalizadas: actividadesFinalizadas,
      tecnicos_activos_count: tecnicosActivosTotal,
      tecnicos_participantes_count: tecnicosParticipantesCount,
    });

    await batch.commit();
  } catch (error) {
    console.error("Error eliminando actividad pendiente:", error);
    alert("No se pudo eliminar la actividad.");
  } finally {
    finalizarAccion(clave);
  }
}

function confirmarCerrarActividad(trabajoId, actividadId) {
  const trabajo = (ultimoResumen.trabajos || []).find(
    (t) => Number(t.id) === Number(trabajoId),
  );

  const actividad = (trabajo?.actividades || []).find(
    (a) => String(a?.id || "").trim() === String(actividadId || "").trim(),
  );

  if (!trabajo || !actividad) {
    alert("No se encontró la actividad.");
    return;
  }

  const participantes = Array.isArray(actividad?.participantes)
    ? actividad.participantes
    : [];

  const nombresUnicos = [
    ...new Set(
      participantes
        .map((p) => (p?.tecnico_nombre || "").trim())
        .filter((nombre) => nombre),
    ),
  ];

  const tecnicosActivos = Array.isArray(actividad?.tecnicos_activos_ids)
    ? actividad.tecnicos_activos_ids.length
    : 0;

  const tecnicoNombre =
    nombresUnicos.length > 0 ? nombresUnicos.join(", ") : "No asignado";

  abrirModalConfirmacion({
    titulo: "Cerrar actividad",
    texto: "¿Confirmas que deseas cerrar esta actividad?",
    destacado: `
  <strong>Actividad:</strong> ${escapeHtml(actividad?.descripcion || "Actividad")}<br>
  <strong>Técnico(s):</strong> ${escapeHtml(tecnicoNombre)}<br>
  <strong>Activos ahora:</strong> ${escapeHtml(String(tecnicosActivos))}
  `,
    boton: "Cerrar actividad",
    claseBoton: "btn-principal",
    onConfirm: async () => {
      await cerrarActividad(trabajoId, actividadId);
    },
  });
}

async function pausarActividad(trabajoId, actividadId) {
  if (!validarBatuta()) return;

  const clave = `pausar-actividad-${trabajoId}-${actividadId}`;
  if (!iniciarAccion(clave)) return;

  try {
    const actividadIdTexto = String(actividadId || "").trim();

    const trabajoRef = window.db.collection("trabajos").doc(String(trabajoId));
    const actividadRef = window.db
      .collection("actividades")
      .doc(actividadIdTexto);

    const [trabajoSnap, actividadSnap] = await Promise.all([
      trabajoRef.get(),
      actividadRef.get(),
    ]);

    if (!trabajoSnap.exists) {
      alert("Trabajo no encontrado.");
      return;
    }

    if (!actividadSnap.exists) {
      alert("Actividad no encontrada.");
      return;
    }

    const trabajo = trabajoSnap.data() || {};
    const actividad = actividadSnap.data() || {};
    const participantes = Array.isArray(actividad.participantes)
      ? [...actividad.participantes]
      : [];

    const participantesActivos = participantes.filter(
      (p) =>
        p?.activo !== false &&
        String(p?.estado || "").toLowerCase() === "activo",
    );

    if (participantesActivos.length === 0) {
      alert("Esta actividad no tiene técnicos activos para pausar.");
      return;
    }

    const ahoraIso = new Date().toISOString();
    const batch = window.db.batch();

    const participantesActualizados = participantes.map((p) => {
      const esActivo =
        p?.activo !== false &&
        String(p?.estado || "").toLowerCase() === "activo";

      if (!esActivo) return p;

      const actualizado = { ...p };
      actualizado.visible_en_tarjeta = true;
      if (actualizado.inicio_actual_at) {
        const inicio = new Date(actualizado.inicio_actual_at);
        if (!isNaN(inicio.getTime())) {
          const ahora = new Date();
          const extra = Math.max(0, Math.floor((ahora - inicio) / 1000));
          actualizado.tiempo_real_seg =
            Number(actualizado.tiempo_real_seg || 0) + extra;
        }
      }

      actualizado.estado = "pausado";
      actualizado.activo = false;
      actualizado.inicio_actual_at = null;
      actualizado.pausa_actual_at = ahoraIso;
      actualizado.finalizado_at = null;
      actualizado.cantidad_pausas =
        Number(actualizado.cantidad_pausas || 0) + 1;

      return actualizado;
    });

    const ultimoIds = [];
    const ultimoNombres = [];

    participantesActivos.forEach((p) => {
      if (!ultimoIds.some((id) => Number(id) === Number(p.tecnico_id))) {
        ultimoIds.push(p.tecnico_id);
      }
      if (!ultimoNombres.includes(p.tecnico_nombre || "Técnico")) {
        ultimoNombres.push(p.tecnico_nombre || "Técnico");
      }

      const tecnicoRef = window.db
        .collection("tecnicos")
        .doc(String(p.tecnico_id));

      batch.update(tecnicoRef, {
        estado: "libre",
        trabajo_id: null,
        almuerzo_desde: null,
        almuerzo_hasta: null,
      });
    });

    const actividadUpdate = {
      participantes: participantesActualizados,
      estado: "pausado",
      tecnicos_activos_ids: [],
      tecnicos_activos_nombres: [],
      tecnicos_activos_count: 0,
      ultima_actividad_at: ahoraIso,
      inicio_tramo_activo_at: null,
      inicio_tramo_pausa_at: ahoraIso,
      ultima_pausa_at: ahoraIso,
      finalizado_at: null,
      ultimo_tecnicos_ids: ultimoIds,
      ultimo_tecnicos_nombres: ultimoNombres,
    };

    batch.update(actividadRef, actividadUpdate);

    const actividadesTrabajo = Array.isArray(ultimoResumen?.trabajos)
      ? ultimoResumen.trabajos.find((t) => Number(t.id) === Number(trabajoId))
          ?.actividades || []
      : [];

    const actividadesRestantes = actividadesTrabajo.map((a) => {
      if (String(a?.id || "").trim() !== actividadIdTexto) return a;
      return {
        ...a,
        ...actividad,
        ...actividadUpdate,
      };
    });

    const {
      nuevoEstadoTrabajo,
      actividadesPendientes,
      actividadesEnProceso,
      actividadesPausadas,
      actividadesFinalizadas,
      tecnicosActivosTotal,
      tecnicosParticipantesCount,
    } = resumirEstadosTrabajoDesdeActividades(actividadesRestantes);

    batch.update(trabajoRef, {
      estado: nuevoEstadoTrabajo,
      ultima_actividad_at: ahoraIso,
      finalizado_at: nuevoEstadoTrabajo === "finalizado" ? ahoraIso : null,
      total_actividades: actividadesRestantes.length,
      actividades_pendientes: actividadesPendientes,
      actividades_en_proceso: actividadesEnProceso,
      actividades_pausadas: actividadesPausadas,
      actividades_finalizadas: actividadesFinalizadas,
      tecnicos_activos_count: tecnicosActivosTotal,
      tecnicos_participantes_count: tecnicosParticipantesCount,
    });

    await batch.commit();
  } catch (error) {
    console.error("Error pausando actividad:", error);
    alert("No se pudo pausar la actividad.");
  } finally {
    finalizarAccion(clave);
  }
}

async function pedirPausarTrabajo(trabajoId) {
  if (!validarBatuta()) return;

  const trabajo = (ultimoResumen.trabajos || []).find(
    (t) => Number(t.id) === Number(trabajoId),
  );

  if (!trabajo) {
    alert("Trabajo no encontrado.");
    return;
  }

  const actividades = Array.isArray(trabajo.actividades)
    ? trabajo.actividades
    : [];

  const actividadesEnProceso = actividades.filter((act) => {
    const estado = String(act?.estado || "").toLowerCase();

    const tecnicosActivos = Array.isArray(act?.tecnicos_activos_ids)
      ? act.tecnicos_activos_ids.length
      : 0;

    return estado === "en_proceso" && tecnicosActivos > 0;
  });

  if (actividadesEnProceso.length === 0) {
    alert("Este trabajo no tiene actividades activas para pausar.");
    return;
  }

  const listaActividades = `
  <div style="margin-top:10px;">
    <div style="font-weight:600; margin-bottom:8px;">
      Se pausarán estas actividades:
    </div>
    <div style="display:flex; flex-direction:column; gap:8px;">
      ${actividadesEnProceso
        .map((act, index) => {
          const tecnicosActivos = Array.isArray(act?.tecnicos_activos_nombres)
            ? act.tecnicos_activos_nombres.filter((n) => String(n || "").trim())
            : [];

          return `
      <div style="padding:10px 12px; border:1px solid #d9dee7; border-radius:10px; background:#f8fafc;">
        <div><strong>${index + 1}. ${escapeHtml(act?.descripcion || "Sin descripción")}</strong></div>
        <div style="margin-top:4px; color:#475569;">
          Técnicos activos: ${escapeHtml(String(tecnicosActivos.length))}
          ${tecnicosActivos.length > 0 ? ` · ${escapeHtml(tecnicosActivos.join(", "))}` : ""}
        </div>
      </div>
      `;
        })
        .join("")}
    </div>
  </div>
  `;

  abrirModalConfirmacion({
    titulo: "Pausar trabajo",
    texto:
      "Se pausarán todas las actividades activas del trabajo y los técnicos quedarán libres.",
    destacado: `
  <strong>Trabajo:</strong> ${escapeHtml(trabajo.descripcion || "Sin descripción")}
  ${listaActividades}
  `,
    boton: "Pausar trabajo",
    claseBoton: "btn-secundario",
    onConfirm: async () => {
      const clave = `pausar-${trabajoId}`;
      if (!iniciarAccion(clave)) return;

      try {
        for (const act of actividadesEnProceso) {
          await pausarActividad(trabajoId, act.id);
        }
      } catch (error) {
        console.error("Error pausando trabajo en V2:", error);
        alert("No se pudo pausar el trabajo.");
      } finally {
        finalizarAccion(clave);
      }
    },
  });
}
async function pedirFinalizarTrabajo(trabajoId) {
  if (!validarBatuta()) return;

  const trabajo = (ultimoResumen.trabajos || []).find(
    (t) => Number(t.id) === Number(trabajoId),
  );

  if (!trabajo) {
    alert("Trabajo no encontrado.");
    return;
  }

  const actividades = Array.isArray(trabajo.actividades)
    ? trabajo.actividades
    : [];

  const pendientesSinTecnico = actividades.filter((act) => {
    const estado = String(act?.estado || "pendiente").toLowerCase();

    const tecnicosActivos = Array.isArray(act?.tecnicos_activos_ids)
      ? act.tecnicos_activos_ids
      : [];

    const participantes = Array.isArray(act?.participantes)
      ? act.participantes
      : [];

    const tuvoParticipacion = participantes.some(
      (p) => Number(p?.tecnico_id || 0) > 0,
    );

    return (
      estado === "pendiente" &&
      tecnicosActivos.length === 0 &&
      !tuvoParticipacion
    );
  });

  const actividadesPorCerrar = actividades.filter((act) => {
    const estado = String(act?.estado || "pendiente").toLowerCase();

    const tecnicosActivos = Array.isArray(act?.tecnicos_activos_ids)
      ? act.tecnicos_activos_ids
      : [];

    const participantes = Array.isArray(act?.participantes)
      ? act.participantes
      : [];

    const tuvoParticipacion = participantes.some(
      (p) => Number(p?.tecnico_id || 0) > 0,
    );

    if (estado === "finalizado") {
      return false;
    }

    if (
      estado === "pendiente" &&
      tecnicosActivos.length === 0 &&
      !tuvoParticipacion
    ) {
      return false;
    }

    return true;
  });

  const listaActividades = actividadesPorCerrar.length
    ? `
  <div style="margin-top:10px;">
    <div style="font-weight:600; margin-bottom:8px;">
      Se cerrarán estas actividades:
    </div>
    <div style="display:flex; flex-direction:column; gap:8px;">
      ${actividadesPorCerrar
        .map((act, index) => {
          const estado = String(act?.estado || "pendiente").toLowerCase();

          const tecnicosActivos = Array.isArray(act?.tecnicos_activos_ids)
            ? act.tecnicos_activos_ids
            : [];

          const participantes = Array.isArray(act?.participantes)
            ? act.participantes
            : [];

          const participantesUnicos = new Set(
            participantes
              .map((p) => Number(p?.tecnico_id || 0))
              .filter((id) => id > 0),
          );

          return `
      <div style="padding:10px 12px; border:1px solid #d9dee7; border-radius:10px; background:#f8fafc;">
        <div><strong>${index + 1}. ${escapeHtml(act?.descripcion || "Sin descripción")}</strong></div>
        <div style="margin-top:4px; color:#475569;">
          Estado: ${escapeHtml(formatearEstado(estado))}
          · Técnicos activos: ${tecnicosActivos.length}
          · Participantes: ${participantesUnicos.size}
        </div>
      </div>
      `;
        })
        .join("")}
    </div>
  </div>
  `
    : "";

  const textoPendientes =
    pendientesSinTecnico.length > 0
      ? `Las ${pendientesSinTecnico.length} actividad(es) pendientes sin técnico se eliminarán automáticamente.`
      : "Las actividades restantes se cerrarán y se guardarán sus tiempos finales.";

  abrirModalConfirmacion({
    titulo: "Finalizar trabajo completo",
    texto: `${textoPendientes}${actividadesPorCerrar.length > 0 ? " También se cerrarán automáticamente las actividades abiertas." : ""}`,
    destacado: `
  <strong>Trabajo:</strong> ${escapeHtml(trabajo.descripcion || "")}
  ${listaActividades}
  `,
    boton: "Finalizar todo",
    claseBoton: "btn-success",
    onConfirm: async () => {
      await confirmarFinalizacionTrabajoCompletoConPendientes(trabajoId);
    },
  });
}

async function confirmarFinalizacionTrabajoCompletoConPendientes(trabajoId) {
  if (!validarBatuta()) return;

  try {
    const trabajoRef = window.db.collection("trabajos").doc(String(trabajoId));
    const actividadesSnap = await window.db
      .collection("actividades")
      .where("trabajo_id", "==", Number(trabajoId))
      .where("activo", "==", true)
      .get();

    if (actividadesSnap.empty) {
      await finalizarTrabajoCompleto(trabajoId);
      return;
    }

    const actividades = actividadesSnap.docs.map((doc) => ({
      idDoc: doc.id,
      ref: doc.ref,
      ...doc.data(),
    }));

    const actividadesPausadas = actividades.filter(
      (act) => String(act?.estado || "").toLowerCase() === "pausado",
    );

    const pendientesSinTecnico = actividades.filter((act) => {
      const estado = String(act?.estado || "").toLowerCase();

      const tecnicosActivos = Array.isArray(act?.tecnicos_activos_ids)
        ? act.tecnicos_activos_ids
        : [];

      const participantes = Array.isArray(act?.participantes)
        ? act.participantes
        : [];

      const tuvoParticipacion = participantes.some(
        (p) => Number(p?.tecnico_id || 0) > 0,
      );

      return (
        estado === "pendiente" &&
        tecnicosActivos.length === 0 &&
        !tuvoParticipacion
      );
    });

    if (actividadesPausadas.length === 0 && pendientesSinTecnico.length === 0) {
      await finalizarTrabajoCompleto(trabajoId);
      return;
    }

    const existente = document.getElementById(
      "modalDecisionTrabajoConPendientesFinalizarTodo",
    );
    if (existente) existente.remove();

    const trabajo = (ultimoResumen.trabajos || []).find(
      (t) => Number(t.id) === Number(trabajoId),
    );

    const bloquePausadas =
      actividadesPausadas.length > 0
        ? `
<div style="margin-top:12px;">
  <div style="font-weight:700; margin-bottom:8px; color:#b42318;">
    Actividades pausadas
  </div>
  ${actividadesPausadas
    .map(
      (a, i) => `
    <div style="margin-top:6px;">${i + 1}. ${escapeHtml(a?.descripcion || "Actividad")}</div>
  `,
    )
    .join("")}
</div>
`
        : "";

    const bloquePendientes =
      pendientesSinTecnico.length > 0
        ? `
<div style="margin-top:12px;">
  <div style="font-weight:700; margin-bottom:8px; color:#b42318;">
    Actividades pendientes sin técnico
  </div>
  ${pendientesSinTecnico
    .map(
      (a, i) => `
    <div style="margin-top:6px;">${i + 1}. ${escapeHtml(a?.descripcion || "Actividad")}</div>
  `,
    )
    .join("")}
</div>
`
        : "";

    const overlay = document.createElement("div");
    overlay.id = "modalDecisionTrabajoConPendientesFinalizarTodo";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(15, 23, 42, 0.55)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "9999";
    overlay.style.padding = "16px";

    overlay.innerHTML = `
<div style="
  width:100%;
  max-width:620px;
  background:#ffffff;
  border-radius:16px;
  box-shadow:0 20px 50px rgba(0,0,0,0.25);
  padding:20px;
  max-height:90vh;
  overflow:auto;
">
  <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:10px;">
    <div style="font-size:20px; font-weight:700; color:#0f172a;">
      Confirmar finalización del trabajo
    </div>
    <button id="btnCerrarDecisionFinalizarTodo" type="button" style="padding:8px 12px; border:none; border-radius:10px; background:#e5e7eb; color:#374151; font-weight:600; cursor:pointer;">
      Cerrar
    </button>
  </div>

  <div style="font-size:14px; color:#475569; line-height:1.5;">
    Este trabajo todavía tiene actividades con detalles pendientes.
  </div>

  <div style="margin-top:12px; padding:12px; border:1px solid #d9dee7; border-radius:12px; background:#f8fafc; color:#111827; font-size:14px; line-height:1.5;">
    <div><strong>Trabajo:</strong> ${escapeHtml(trabajo?.descripcion || "Sin descripción")}</div>
    ${bloquePausadas}
    ${bloquePendientes}
    <div style="margin-top:14px;">
      ¿Deseas finalizar el trabajo de todas formas o mantenerlo abierto?
    </div>
  </div>

  <div style="display:flex; gap:10px; justify-content:flex-start; flex-wrap:wrap; margin-top:18px;">
    <button id="btnFinalizarTodoConPendientes" type="button" style="padding:10px 14px; border:none; border-radius:10px; background:#fbe7e7; color:#b42318; font-weight:700; cursor:pointer;">
      Finalizar de todas formas
    </button>
    <button id="btnCancelarFinalizarTodoConPendientes" type="button" style="padding:10px 14px; border:none; border-radius:10px; background:#e5e7eb; color:#374151; font-weight:700; cursor:pointer;">
      Cancelar
    </button>
  </div>
</div>
`;

    const cerrar = () => {
      overlay.remove();
    };

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) cerrar();
    });

    document.body.appendChild(overlay);

    document.getElementById("btnCerrarDecisionFinalizarTodo").onclick = () =>
      cerrar();

    document.getElementById("btnFinalizarTodoConPendientes").onclick =
      async () => {
        cerrar();
        await finalizarTrabajoCompleto(trabajoId);
      };

    document.getElementById("btnCancelarFinalizarTodoConPendientes").onclick =
      async () => {
        cerrar();

        const clave = `resolver-finalizacion-parcial-${trabajoId}`;
        if (!iniciarAccion(clave)) return;

        try {
          const ahoraIso = new Date().toISOString();
          const batch = window.db.batch();

          const actividadesActualizadas = [];

          for (const act of actividades) {
            const estado = String(act?.estado || "").toLowerCase();

            const participantes = Array.isArray(act?.participantes)
              ? [...act.participantes]
              : [];

            const idsParticipantes = new Set(
              (Array.isArray(act?.tecnicos_participantes_ids)
                ? act.tecnicos_participantes_ids
                : []
              ).map((id) => Number(id)),
            );

            const idsUltimos = Array.isArray(act?.ultimo_tecnicos_ids)
              ? [...act.ultimo_tecnicos_ids]
              : [];
            const nombresUltimos = Array.isArray(act?.ultimo_tecnicos_nombres)
              ? [...act.ultimo_tecnicos_nombres]
              : [];

            if (estado === "en_proceso") {
              const participantesActualizados = participantes.map((p) => {
                const actualizado = { ...p };
                const tecnicoId = Number(actualizado?.tecnico_id || 0);
                const tecnicoNombre = actualizado?.tecnico_nombre || "Técnico";
                const estadoParticipante = String(
                  actualizado?.estado || "",
                ).toLowerCase();
                const estabaActivo =
                  actualizado?.activo !== false &&
                  estadoParticipante === "activo";

                if (tecnicoId > 0) {
                  idsParticipantes.add(tecnicoId);
                  if (!idsUltimos.includes(tecnicoId))
                    idsUltimos.push(tecnicoId);
                }

                if (tecnicoNombre && !nombresUltimos.includes(tecnicoNombre)) {
                  nombresUltimos.push(tecnicoNombre);
                }

                if (estabaActivo && actualizado.inicio_actual_at) {
                  const inicio = new Date(actualizado.inicio_actual_at);
                  if (!isNaN(inicio.getTime())) {
                    const extra = Math.max(
                      0,
                      Math.floor((new Date() - inicio) / 1000),
                    );
                    actualizado.tiempo_real_seg =
                      Number(actualizado.tiempo_real_seg || 0) + extra;
                  }
                }

                actualizado.visible_en_tarjeta = true;
                actualizado.estado = "finalizado";
                actualizado.activo = false;
                actualizado.inicio_actual_at = null;
                actualizado.pausa_actual_at = null;
                actualizado.finalizado_at = ahoraIso;

                if (estabaActivo && tecnicoId > 0) {
                  const tecnicoRef = window.db
                    .collection("tecnicos")
                    .doc(String(tecnicoId));

                  batch.update(tecnicoRef, {
                    estado: "libre",
                    trabajo_id: null,
                    almuerzo_desde: null,
                    almuerzo_hasta: null,
                    actividad_origen_almuerzo_id: null,
                    trabajo_origen_almuerzo_id: null,
                  });
                }

                return actualizado;
              });

              const actividadUpdate = {
                participantes: participantesActualizados,
                estado: "finalizado",
                ultima_actividad_at: ahoraIso,
                finalizado_at: ahoraIso,
                ultima_reanudacion_at: null,
                ultima_pausa_at: null,
                inicio_tramo_activo_at: null,
                inicio_tramo_pausa_at: null,
                tecnicos_activos_ids: [],
                tecnicos_activos_nombres: [],
                tecnicos_activos_count: 0,
                tecnicos_participantes_ids: Array.from(idsParticipantes),
                tecnicos_participantes_count: idsParticipantes.size,
                ultimo_tecnicos_ids: idsUltimos.filter((id) => Number(id) > 0),
                ultimo_tecnicos_nombres: nombresUltimos,
              };

              batch.update(act.ref, actividadUpdate);
              actividadesActualizadas.push({
                ...act,
                ...actividadUpdate,
              });
              continue;
            }

            actividadesActualizadas.push({ ...act });
          }

          const {
            nuevoEstadoTrabajo,
            actividadesPendientes,
            actividadesEnProceso,
            actividadesPausadas,
            actividadesFinalizadas,
            tecnicosActivosTotal,
            tecnicosParticipantesCount,
          } = resumirEstadosTrabajoDesdeActividades(actividadesActualizadas);

          batch.update(trabajoRef, {
            estado: nuevoEstadoTrabajo,
            ultima_actividad_at: ahoraIso,
            finalizado_at:
              nuevoEstadoTrabajo === "finalizado" ? ahoraIso : null,
            total_actividades: actividadesActualizadas.length,
            actividades_pendientes: actividadesPendientes,
            actividades_en_proceso: actividadesEnProceso,
            actividades_pausadas: actividadesPausadas,
            actividades_finalizadas: actividadesFinalizadas,
            tecnicos_activos_count: tecnicosActivosTotal,
            tecnicos_participantes_count: tecnicosParticipantesCount,
          });

          await batch.commit();
        } catch (error) {
          console.error(
            "Error resolviendo finalización parcial del trabajo:",
            error,
          );
          alert("No se pudo actualizar el trabajo.");
        } finally {
          finalizarAccion(clave);
        }
      };
  } catch (error) {
    console.error(
      "Error validando pendientes antes de finalizar trabajo completo:",
      error,
    );
    alert("No se pudo validar el estado del trabajo antes de finalizar.");
  }
}

async function finalizarTrabajoCompleto(trabajoId) {
  if (!validarBatuta()) return;

  const clave = `finalizar-trabajo-${trabajoId}`;
  if (!iniciarAccion(clave)) return;

  try {
    const trabajoRef = window.db.collection("trabajos").doc(String(trabajoId));

    const [trabajoSnap, actividadesSnap] = await Promise.all([
      trabajoRef.get(),
      window.db
        .collection("actividades")
        .where("trabajo_id", "==", Number(trabajoId))
        .where("activo", "==", true)
        .get(),
    ]);

    if (!trabajoSnap.exists) {
      alert("Trabajo no encontrado.");
      return;
    }

    if (actividadesSnap.empty) {
      alert("No se encontraron actividades para este trabajo.");
      return;
    }

    const ahora = new Date();
    const ahoraIso = ahora.toISOString();
    const batch = window.db.batch();

    const actividadesActualizadas = [];

    for (const doc of actividadesSnap.docs) {
      const actividadRef = doc.ref;
      const actividad = doc.data() || {};
      const estadoActual = String(
        actividad.estado || "pendiente",
      ).toLowerCase();

      const participantes = Array.isArray(actividad.participantes)
        ? [...actividad.participantes]
        : [];

      const idsParticipantes = new Set(
        (Array.isArray(actividad.tecnicos_participantes_ids)
          ? actividad.tecnicos_participantes_ids
          : []
        ).map((id) => Number(id)),
      );

      const idsUltimos = [];
      const nombresUltimos = [];

      const tuvoParticipacion =
        participantes.some((p) => Number(p?.tecnico_id || 0) > 0) ||
        idsParticipantes.size > 0;

      const participantesActualizados = participantes.map((p) => {
        const actualizado = { ...p };
        const tecnicoId = Number(actualizado?.tecnico_id || 0);
        const tecnicoNombre = actualizado?.tecnico_nombre || "Técnico";
        const estadoParticipante = String(
          actualizado?.estado || "",
        ).toLowerCase();
        const estabaActivo =
          actualizado?.activo !== false && estadoParticipante === "activo";

        if (tecnicoId > 0) {
          idsParticipantes.add(tecnicoId);
        }

        if (tecnicoId > 0 && !idsUltimos.includes(tecnicoId)) {
          idsUltimos.push(tecnicoId);
        }

        if (!nombresUltimos.includes(tecnicoNombre)) {
          nombresUltimos.push(tecnicoNombre);
        }

        if (estabaActivo && actualizado.inicio_actual_at) {
          const inicio = new Date(actualizado.inicio_actual_at);
          if (!isNaN(inicio.getTime())) {
            const extra = Math.max(0, Math.floor((ahora - inicio) / 1000));
            actualizado.tiempo_real_seg =
              Number(actualizado.tiempo_real_seg || 0) + extra;
          }
        }

        actualizado.visible_en_tarjeta = true;
        actualizado.estado = "finalizado";
        actualizado.activo = false;
        actualizado.inicio_actual_at = null;
        actualizado.pausa_actual_at = null;
        actualizado.finalizado_at = ahoraIso;

        if (estabaActivo && tecnicoId > 0) {
          const tecnicoRef = window.db
            .collection("tecnicos")
            .doc(String(tecnicoId));

          batch.update(tecnicoRef, {
            estado: "libre",
            trabajo_id: null,
            almuerzo_desde: null,
            almuerzo_hasta: null,
          });
        }

        return actualizado;
      });

      const esPendienteSinTecnico =
        estadoActual === "pendiente" && !tuvoParticipacion;

      if (esPendienteSinTecnico) {
        batch.update(actividadRef, {
          activo: false,
          eliminado_at: ahoraIso,
        });

        continue;
      }

      const actividadUpdate = {
        participantes: participantesActualizados,
        estado: "finalizado",
        ultima_actividad_at: ahoraIso,
        finalizado_at: ahoraIso,
        ultima_reanudacion_at: null,
        ultima_pausa_at: null,
        inicio_tramo_activo_at: null,
        inicio_tramo_pausa_at: null,
        tecnicos_activos_ids: [],
        tecnicos_activos_nombres: [],
        tecnicos_activos_count: 0,
        tecnicos_participantes_ids: Array.from(idsParticipantes),
        tecnicos_participantes_count: idsParticipantes.size,
        ultimo_tecnicos_ids: idsUltimos.filter((id) => id > 0),
        ultimo_tecnicos_nombres: nombresUltimos,
      };

      batch.update(actividadRef, actividadUpdate);

      actividadesActualizadas.push({
        ...actividad,
        ...actividadUpdate,
      });
    }

    const {
      actividadesPendientes,
      actividadesEnProceso,
      actividadesPausadas,
      actividadesFinalizadas,
      tecnicosParticipantesCount,
    } = resumirEstadosTrabajoDesdeActividades(actividadesActualizadas);

    batch.update(trabajoRef, {
      estado: "finalizado",
      finalizado_at: ahoraIso,
      ultima_actividad_at: ahoraIso,
      total_actividades: actividadesActualizadas.length,
      actividades_pendientes: actividadesPendientes,
      actividades_en_proceso: actividadesEnProceso,
      actividades_pausadas: actividadesPausadas,
      actividades_finalizadas: actividadesFinalizadas,
      tecnicos_activos_count: 0,
      tecnicos_participantes_count: tecnicosParticipantesCount,
    });

    await batch.commit();
  } catch (error) {
    console.error("Error finalizando trabajo completo:", error);
    alert("No se pudo finalizar el trabajo.");
  } finally {
    finalizarAccion(clave);
  }
}

function abrirModalConfirmacion({
  titulo,
  texto,
  destacado,
  boton,
  claseBoton,
  onConfirm,
  onCancel = null,
  botonSecundario = "Cancelar",
}) {
  accionPendiente = onConfirm;
  accionCancelPendiente = onCancel;

  document.getElementById("confirmacionTitulo").textContent =
    titulo || "Confirmar acción";
  document.getElementById("confirmacionTexto").textContent = texto || "";
  document.getElementById("confirmacionDestacado").innerHTML = destacado || "";

  const btnPrincipal = document.getElementById("confirmacionBtnPrincipal");
  btnPrincipal.textContent = boton || "Confirmar";
  btnPrincipal.className = claseBoton || "btn-danger";

  const btnCancelar = document.querySelector(
    "#modalConfirmacionAccion .btn-secundario",
  );
  if (btnCancelar) {
    btnCancelar.textContent = botonSecundario || "Cancelar";
  }

  document.getElementById("modalConfirmacionAccion").style.display = "block";
}
function toggleFinalizados() {
  mostrarFinalizados = !mostrarFinalizados;

  const btn = document.getElementById("btnToggleFinalizados");
  const wrap = document.getElementById("filtroFinalizadosWrap");

  if (btn) btn.textContent = mostrarFinalizados ? "Ocultar" : "Mostrar";
  if (wrap) wrap.classList.toggle("visible", mostrarFinalizados);

  renderizarPanelPrincipal(ultimoResumen);
}

function cerrarModalConfirmacion() {
  accionPendiente = null;
  document.getElementById("modalConfirmacionAccion").style.display = "none";
  document.getElementById("confirmacionTitulo").textContent =
    "Confirmar acción";
  document.getElementById("confirmacionTexto").textContent = "";
  document.getElementById("confirmacionDestacado").innerHTML = "";
}

async function confirmarAccionPendiente() {
  const accion = accionPendiente;
  cerrarModalConfirmacion();

  if (typeof accion === "function") {
    await accion();
  }
}

function abrirModalAviso({
  titulo,
  texto,
  destacado = "",
  boton = "Entendido",
}) {
  accionPendiente = null;

  document.getElementById("confirmacionTitulo").textContent = titulo || "Aviso";
  document.getElementById("confirmacionTexto").textContent = texto || "";
  document.getElementById("confirmacionDestacado").innerHTML = destacado || "";

  const btn = document.getElementById("confirmacionBtnPrincipal");
  btn.textContent = boton;
  btn.className = "btn-principal";

  document.getElementById("modalConfirmacionAccion").style.display = "block";
}

function pedirCerrarDia() {
  abrirModalConfirmacion({
    titulo: "Cierre de día",
    texto:
      "Se eliminarán los trabajos pendientes del día y se reiniciarán los indicadores de almuerzo.",
    destacado:
      "No se permitirá cerrar si existen trabajos en proceso o pausados.",
    boton: "Cerrar día",
    claseBoton: "btn-danger",
    onConfirm: async () => {
      await cerrarDiaEjecutar();
    },
  });
}

function abrirModalTrabajoSinTecnicos({
  trabajo,
  contexto,
  onResolver,
  tecnicosMovidos = [],
  tituloPersonalizado = "",
}) {
  trabajoSinTecnicosPendiente = onResolver;

  const titulo = document.getElementById("trabajoSinTecnicosTitulo");
  if (titulo) {
    titulo.textContent = tituloPersonalizado || "Trabajo sin técnicos activos";
  }

  document.getElementById("trabajoSinTecnicosTexto").textContent =
    contexto ||
    "Este trabajo quedará sin técnicos activos. ¿Qué deseas hacer con él?";

  const textoTecnicos =
    tecnicosMovidos.length > 0
      ? tecnicosMovidos
          .map((t) => escapeHtml(t.nombre || `Técnico ${t.id}`))
          .join(", ")
      : "No especificado";

  document.getElementById("trabajoSinTecnicosDestacado").innerHTML = `
  <strong>Trabajo #${trabajo.id}</strong><br>
  ${escapeHtml(trabajo.descripcion || "Sin descripción")}<br>
  <strong>${trabajo.origen === "interno" ? "Interno" : "Vendedor"}:</strong> ${escapeHtml(nombreResponsable(trabajo))}<br>
  <strong>Técnico(s) involucrados:</strong> ${textoTecnicos}
  `;

  document.getElementById("modalTrabajoSinTecnicos").style.display = "block";
}

function cerrarModalTrabajoSinTecnicos(resolverComoCancelar = true) {
  const resolverPendiente = trabajoSinTecnicosPendiente;

  trabajoSinTecnicosPendiente = null;
  document.getElementById("trabajoSinTecnicosTexto").textContent = "";
  document.getElementById("trabajoSinTecnicosDestacado").innerHTML = "";
  document.getElementById("modalTrabajoSinTecnicos").style.display = "none";

  if (resolverComoCancelar && typeof resolverPendiente === "function") {
    resolverPendiente("__cancelar__");
  }
}

async function resolverTrabajoSinTecnicos(accion) {
  if (!trabajoSinTecnicosPendiente) return;

  const resolver = trabajoSinTecnicosPendiente;
  cerrarModalTrabajoSinTecnicos(false);
  await resolver(accion);
}
window.onclick = function (event) {
  const modalEditar = document.getElementById("modalEditar");
  const modalEditarActividad = document.getElementById("modalEditarActividad");
  const modalAsignacion = document.getElementById("modalAsignacion");
  const modalResumenTrabajo = document.getElementById("modalResumenTrabajo");
  const modalEstadoTecnico = document.getElementById("modalEstadoTecnico");
  const modalConfirmacionAccion = document.getElementById(
    "modalConfirmacionAccion",
  );
  const modalTrabajoSinTecnicos = document.getElementById(
    "modalTrabajoSinTecnicos",
  );

  if (event.target === modalEditar) cerrarModalEditar();
  if (event.target === modalEditarActividad) cerrarModalEditarActividad();
  if (event.target === modalAsignacion) cerrarModalAsignacion();
  if (event.target === modalResumenTrabajo) cerrarResumenTrabajo();
  // modalEstadoTecnico ya no se cierra haciendo click por fuera
  if (event.target === modalConfirmacionAccion) cerrarModalConfirmacion();
  if (event.target === modalTrabajoSinTecnicos) cerrarModalTrabajoSinTecnicos();
};

async function iniciarAplicacion() {
  try {
    inyectarEstilosTrabajosMixtos();
    await cargarVendedores();
    registrarComportamientoBotonesCrearTrabajoMovil();
    const panelSnap = await window.db.collection("config").doc("panel").get();
    const panelConfig = panelSnap.exists ? panelSnap.data() : {};

    cierreDiaActivoDesde = panelConfig?.cierre_dia_at || null;
    mostrarFinalizadosDelCierre = false;

    escucharDatosEnTiempoReal();
  } catch (error) {
    console.error("Error iniciando aplicación:", error);
  }
}
async function cerrarDiaEjecutar() {
  try {
    const hoy = obtenerFechaLocalISO();

    const [trabajosSnapshot, actividadesSnapshot, tecnicosSnapshot] =
      await Promise.all([
        window.db
          .collection("trabajos")
          .where("activo", "==", true)
          .where("fecha_local", "==", hoy)
          .get(),

        window.db
          .collection("actividades")
          .where("activo", "==", true)
          .where("fecha_local", "==", hoy)
          .get(),

        window.db.collection("tecnicos").get(),
      ]);

    const trabajos = trabajosSnapshot.docs.map((doc) => ({
      idDoc: doc.id,
      ...doc.data(),
    }));

    const actividades = actividadesSnapshot.docs.map((doc) => ({
      idDoc: doc.id,
      ...doc.data(),
    }));

    const actividadesPorTrabajo = new Map();

    actividades.forEach((act) => {
      const trabajoId = Number(act?.trabajo_id);
      if (!trabajoId) return;

      if (!actividadesPorTrabajo.has(trabajoId)) {
        actividadesPorTrabajo.set(trabajoId, []);
      }

      actividadesPorTrabajo.get(trabajoId).push(act);
    });

    const trabajosConActividades = trabajos.map((trabajo) => {
      const trabajoId = Number(trabajo?.id);
      const actividadesTrabajo = actividadesPorTrabajo.get(trabajoId) || [];

      actividadesTrabajo.sort(
        (a, b) => Number(a?.orden || 0) - Number(b?.orden || 0),
      );

      return {
        ...trabajo,
        actividades: actividadesTrabajo,
      };
    });

    const enProceso = trabajosConActividades.filter(
      (t) => estadoVisualTrabajo(t) === "en_proceso",
    );

    const pausados = trabajosConActividades.filter(
      (t) => estadoVisualTrabajo(t) === "pausado",
    );

    const pendientes = trabajosConActividades.filter(
      (t) => estadoVisualTrabajo(t) === "pendiente",
    );

    if (enProceso.length > 0 || pausados.length > 0) {
      abrirModalAviso({
        titulo: "No se puede cerrar el día",
        texto:
          "Hay trabajos en proceso o pausados. Debes finalizarlos o resolverlos antes de cerrar el día.",
        boton: "Entendido",
      });
      return;
    }

    const batch = window.db.batch();
    const ahora = new Date().toISOString();

    pendientes.forEach((trabajo) => {
      const trabajoRef = window.db.collection("trabajos").doc(trabajo.idDoc);

      batch.update(trabajoRef, {
        activo: false,
        eliminado_at: ahora,
      });

      const actividadesTrabajo =
        actividadesPorTrabajo.get(Number(trabajo.id)) || [];

      actividadesTrabajo.forEach((act) => {
        const actividadRef = window.db.collection("actividades").doc(act.idDoc);

        batch.update(actividadRef, {
          activo: false,
          eliminado_at: ahora,
        });
      });
    });

    tecnicosSnapshot.docs.forEach((doc) => {
      const data = doc.data() || {};
      const esEventual = (data.tipo || "fijo").toLowerCase() === "eventual";
      const ref = window.db.collection("tecnicos").doc(doc.id);

      batch.update(ref, {
        estado: "libre",
        trabajo_id: null,
        activo: esEventual ? false : true,
        dia_libre: false,
        almuerzo_desde: null,
        almuerzo_hasta: null,
        almuerzo_registrado: false,
        almuerzo_fecha: null,
      });
    });

    const configRef = window.db.collection("config").doc("panel");

    batch.set(
      configRef,
      {
        cierre_dia_at: ahora,
      },
      { merge: true },
    );

    await batch.commit();

    cierreDiaActivoDesde = ahora;
    mostrarFinalizadosDelCierre = false;

    renderizarPanelPrincipal(ultimoResumen);

    abrirModalAviso({
      titulo: "Cierre aplicado",
      texto: "El cierre de día se aplicó correctamente.",
      boton: "Entendido",
    });
  } catch (error) {
    console.error("Error aplicando cierre de día:", error);
    abrirModalAviso({
      titulo: "Error",
      texto: "No se pudo aplicar el cierre de día.",
      boton: "Entendido",
    });
  }
}
async function reanudarActividad(trabajoId, actividadId) {
  if (!validarBatuta()) return;

  const clave = `reanudar-actividad-${trabajoId}-${actividadId}`;
  if (!iniciarAccion(clave)) return;

  try {
    const actividadIdTexto = String(actividadId || "").trim();

    const trabajoRef = window.db.collection("trabajos").doc(String(trabajoId));
    const actividadRef = window.db
      .collection("actividades")
      .doc(actividadIdTexto);

    const [trabajoSnap, actividadSnap] = await Promise.all([
      trabajoRef.get(),
      actividadRef.get(),
    ]);

    if (!trabajoSnap.exists) {
      alert("Trabajo no encontrado.");
      return;
    }

    if (!actividadSnap.exists) {
      alert("Actividad no encontrada.");
      return;
    }

    const actividad = actividadSnap.data() || {};

    if (String(actividad.estado || "").toLowerCase() !== "pausado") {
      alert("Solo se pueden reanudar actividades pausadas.");
      return;
    }

    const participantes = Array.isArray(actividad.participantes)
      ? [...actividad.participantes]
      : [];

    const participantesReanudables = participantes.filter((p) => {
      const estado = String(p?.estado || "").toLowerCase();

      if (!p?.tecnico_id) return false;
      if (estado === "finalizado") return false;

      return ["pausado", "liberado", "almuerzo"].includes(estado);
    });

    if (participantesReanudables.length === 0) {
      alert("Esta actividad no tiene técnicos disponibles para reanudar.");
      return;
    }

    const disponibles = [];
    const almuerzo = [];
    const ocupados = [];

    for (const participante of participantesReanudables) {
      const tecnicoId = Number(participante?.tecnico_id);
      if (!tecnicoId) continue;

      const tecnicoRef = window.db
        .collection("tecnicos")
        .doc(String(tecnicoId));
      const tecnicoSnap = await tecnicoRef.get();

      if (!tecnicoSnap.exists) continue;

      const tecnicoData = tecnicoSnap.data() || {};
      const estadoTecnico = String(tecnicoData.estado || "").toLowerCase();
      const trabajoActualTecnico =
        tecnicoData.trabajo_id != null ? Number(tecnicoData.trabajo_id) : null;

      // Deshabilitados/inactivos quedan fuera del flujo
      if (tecnicoData.habilitado === false || tecnicoData.activo === false) {
        continue;
      }

      if (estadoTecnico === "libre") {
        disponibles.push({
          participante,
          tecnicoData,
          motivo: "Disponible",
        });
        continue;
      }

      if (estadoTecnico === "almuerzo") {
        almuerzo.push({
          participante,
          tecnicoData,
          motivo: "Está en almuerzo",
        });
        continue;
      }

      if (estadoTecnico === "trabajando" || trabajoActualTecnico !== null) {
        ocupados.push({
          participante,
          tecnicoData,
          motivo: "Está en otra actividad",
        });
      }
    }

    if (
      disponibles.length === 0 &&
      almuerzo.length === 0 &&
      ocupados.length === 0
    ) {
      alert("No hay técnicos elegibles para reanudar esta actividad.");
      return;
    }

    abrirModalSeleccionReanudacionActividad({
      trabajoId,
      actividadId: actividadIdTexto,
      disponibles,
      almuerzo,
      ocupados,
    });
  } catch (error) {
    console.error("Error reanudando actividad:", error);
    alert("No se pudo preparar la reanudación.");
  } finally {
    finalizarAccion(clave);
  }
}

async function reanudarActividadConDisponiblesV2(
  trabajoId,
  actividadId,
  tecnicosDisponibles,
) {
  const trabajoRef = window.db.collection("trabajos").doc(String(trabajoId));
  const actividadRef = window.db
    .collection("actividades")
    .doc(String(actividadId));

  const [trabajoSnap, actividadSnap] = await Promise.all([
    trabajoRef.get(),
    actividadRef.get(),
  ]);

  if (!trabajoSnap.exists || !actividadSnap.exists) {
    alert("No se encontraron los datos para reanudar.");
    return;
  }

  const trabajo = trabajoSnap.data() || {};
  const actividad = actividadSnap.data() || {};
  const participantes = Array.isArray(actividad.participantes)
    ? [...actividad.participantes]
    : [];

  const ahoraIso = new Date().toISOString();
  const batch = window.db.batch();

  const idsReanudados = [];
  const nombresReanudados = [];

  const participantesActualizados = participantes.map((p) => {
    const coincide = tecnicosDisponibles.some(
      (item) =>
        Number(item?.participante?.tecnico_id) === Number(p?.tecnico_id),
    );

    if (!coincide) return p;

    const actualizado = { ...p };
    actualizado.estado = "activo";
    actualizado.activo = true;
    actualizado.inicio_actual_at = ahoraIso;
    actualizado.pausa_actual_at = null;
    actualizado.finalizado_at = null;

    idsReanudados.push(actualizado.tecnico_id);
    nombresReanudados.push(actualizado.tecnico_nombre || "Técnico");

    return actualizado;
  });

  tecnicosDisponibles.forEach((item) => {
    const tecnicoRef = window.db
      .collection("tecnicos")
      .doc(String(item.participante.tecnico_id));

    batch.update(tecnicoRef, {
      estado: "trabajando",
      trabajo_id: Number(trabajoId),
      almuerzo_desde: null,
      almuerzo_hasta: null,
    });
  });

  const actividadUpdate = {
    participantes: participantesActualizados,
    estado: "en_proceso",
    primer_inicio_at: actividad.primer_inicio_at || ahoraIso,
    ultima_reanudacion_at: ahoraIso,
    ultima_actividad_at: ahoraIso,
    inicio_tramo_activo_at: ahoraIso,
    inicio_tramo_pausa_at: null,
    finalizado_at: null,
    tecnicos_activos_ids: idsReanudados,
    tecnicos_activos_nombres: nombresReanudados,
    tecnicos_activos_count: idsReanudados.length,
  };

  batch.update(actividadRef, actividadUpdate);

  const actividadesTrabajo = Array.isArray(ultimoResumen?.trabajos)
    ? ultimoResumen.trabajos.find((t) => Number(t.id) === Number(trabajoId))
        ?.actividades || []
    : [];

  const actividadesRestantes = actividadesTrabajo.map((a) => {
    if (String(a?.id || "").trim() !== String(actividadId).trim()) return a;
    return {
      ...a,
      ...actividad,
      ...actividadUpdate,
    };
  });

  const {
    nuevoEstadoTrabajo,
    actividadesPendientes,
    actividadesEnProceso,
    actividadesPausadas,
    actividadesFinalizadas,
    tecnicosActivosTotal,
    tecnicosParticipantesCount,
  } = resumirEstadosTrabajoDesdeActividades(actividadesRestantes);

  batch.update(trabajoRef, {
    estado: nuevoEstadoTrabajo,
    primer_inicio_at: trabajo.primer_inicio_at || ahoraIso,
    ultima_actividad_at: ahoraIso,
    finalizado_at: nuevoEstadoTrabajo === "finalizado" ? ahoraIso : null,
    total_actividades: actividadesRestantes.length,
    actividades_pendientes: actividadesPendientes,
    actividades_en_proceso: actividadesEnProceso,
    actividades_pausadas: actividadesPausadas,
    actividades_finalizadas: actividadesFinalizadas,
    tecnicos_activos_count: tecnicosActivosTotal,
    tecnicos_participantes_count: tecnicosParticipantesCount,
  });

  await batch.commit();
}

function abrirModalDecisionReanudacionActividad({
  titulo,
  texto,
  disponibles,
  noDisponibles,
  mostrarReanudar,
  onReanudar,
  onAsignarManual,
}) {
  const existente = document.getElementById(
    "modalDecisionReanudacionActividad",
  );
  if (existente) existente.remove();

  const htmlDisponibles =
    Array.isArray(disponibles) && disponibles.length > 0
      ? `
<div style="margin-top:10px;">
  <div style="font-weight:600; margin-bottom:6px;">Pueden volver ahora:</div>
  <div style="display:flex; flex-direction:column; gap:6px;">
    ${disponibles
      .map(
        (item) => `
<div style="padding:8px 10px; border:1px solid #d9dee7; border-radius:10px; background:#f8fafc;">
  ${escapeHtml(item?.participante?.tecnico_nombre || "Técnico")}
</div>
`,
      )
      .join("")}
  </div>
</div>
`
      : "";

  const htmlNoDisponibles =
    Array.isArray(noDisponibles) && noDisponibles.length > 0
      ? `
<div style="margin-top:10px;">
  <div style="font-weight:600; margin-bottom:6px;">No disponibles ahora:</div>
  <div style="display:flex; flex-direction:column; gap:6px;">
    ${noDisponibles
      .map(
        (item) => `
<div style="padding:8px 10px; border:1px solid #d9dee7; border-radius:10px; background:#fff7ed;">
  <div><strong>${escapeHtml(item?.participante?.tecnico_nombre || "Técnico")}</strong></div>
  <div style="margin-top:4px; color:#9a3412;">${escapeHtml(item?.motivo || "No disponible")}</div>
</div>
`,
      )
      .join("")}
  </div>
</div>
`
      : "";

  const overlay = document.createElement("div");
  overlay.id = "modalDecisionReanudacionActividad";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(15, 23, 42, 0.55)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "9999";
  overlay.style.padding = "16px";

  overlay.innerHTML = `
<div style="
  width:100%;
  max-width:560px;
  background:#ffffff;
  border-radius:16px;
  box-shadow:0 20px 50px rgba(0,0,0,0.25);
  padding:20px;
  max-height:90vh;
  overflow:auto;
">
  <div style="font-size:20px; font-weight:700; color:#0f172a; margin-bottom:10px;">
    ${escapeHtml(titulo || "Reanudar actividad")}
  </div>

  <div style="font-size:14px; color:#475569; line-height:1.5;">
    ${escapeHtml(texto || "")}
  </div>

  ${htmlDisponibles}
  ${htmlNoDisponibles}

  <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap; margin-top:18px;">
    ${
      mostrarReanudar
        ? `<button id="btnReanudarDisponibles" type="button" style="padding:10px 14px; border:none; border-radius:10px; background:#2563eb; color:#fff; font-weight:600; cursor:pointer;">Reanudar con disponibles</button>`
        : ""
    }
    <button id="btnAsignarManual" type="button" style="padding:10px 14px; border:none; border-radius:10px; background:#0f766e; color:#fff; font-weight:600; cursor:pointer;">Asignar manualmente</button>
    <button id="btnCancelarDecisionReanudacion" type="button" style="padding:10px 14px; border:1px solid #cbd5e1; border-radius:10px; background:#fff; color:#0f172a; font-weight:600; cursor:pointer;">Cancelar</button>
  </div>
</div>
`;

  const cerrar = () => {
    overlay.remove();
  };

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) cerrar();
  });

  document.body.appendChild(overlay);

  const btnCancelar = document.getElementById("btnCancelarDecisionReanudacion");
  const btnAsignar = document.getElementById("btnAsignarManual");
  const btnReanudar = document.getElementById("btnReanudarDisponibles");

  if (btnCancelar) {
    btnCancelar.onclick = cerrar;
  }

  if (btnAsignar) {
    btnAsignar.onclick = () => {
      cerrar();
      if (typeof onAsignarManual === "function") {
        onAsignarManual();
      }
    };
  }

  if (btnReanudar) {
    btnReanudar.onclick = async () => {
      cerrar();
      if (typeof onReanudar === "function") {
        await onReanudar();
      }
    };
  }
}

function abrirModalSeleccionReanudacionActividad({
  trabajoId,
  actividadId,
  disponibles,
  almuerzo,
  ocupados,
}) {
  const existente = document.getElementById(
    "modalSeleccionReanudacionActividad",
  );
  if (existente) existente.remove();

  const renderGrupo = (titulo, items, colorFondo) => {
    if (!Array.isArray(items) || items.length === 0) return "";

    return `
<div style="margin-top:12px;">
  <div style="font-weight:700; margin-bottom:8px;">${escapeHtml(titulo)}</div>
  <div style="display:flex; flex-direction:column; gap:8px;">
    ${items
      .map((item) => {
        const participante = item?.participante || {};
        const tecnicoNombre = participante.tecnico_nombre || "Técnico";
        const tecnicoId = participante.tecnico_id;
        const motivo = item?.motivo
          ? `<div style="margin-top:4px; color:#475569; font-size:12px;">${escapeHtml(item.motivo)}</div>`
          : "";

        return `
<label style="
  display:flex;
  gap:10px;
  align-items:flex-start;
  padding:10px 12px;
  border:1px solid #d9dee7;
  border-radius:10px;
  background:${colorFondo};
  cursor:pointer;
">
  <input
    type="checkbox"
    class="chk-reanudar-tecnico"
    data-tecnico-id="${escapeHtml(tecnicoId)}"
    data-grupo="${escapeHtml(item.grupo || "")}"
    ${item.seleccionado ? "checked" : ""}
    style="margin-top:3px;"
  >
  <div>
    <div style="font-weight:600; color:#0f172a;">${escapeHtml(tecnicoNombre)}</div>
    ${motivo}
  </div>
</label>
`;
      })
      .join("")}
  </div>
</div>
`;
  };

  const overlay = document.createElement("div");
  overlay.id = "modalSeleccionReanudacionActividad";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(15, 23, 42, 0.55)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "9999";
  overlay.style.padding = "16px";

  overlay.innerHTML = `
<div style="
  width:100%;
  max-width:620px;
  background:#ffffff;
  border-radius:16px;
  box-shadow:0 20px 50px rgba(0,0,0,0.25);
  padding:20px;
  max-height:90vh;
  overflow:auto;
">
  <div style="font-size:20px; font-weight:700; color:#0f172a; margin-bottom:10px;">
    Reanudar actividad
  </div>

  <div style="font-size:14px; color:#475569; line-height:1.5;">
    Selecciona qué técnicos deseas reincorporar a esta actividad.
  </div>

  ${renderGrupo(
    "Disponibles",
    disponibles.map((item) => ({
      ...item,
      grupo: "disponible",
      seleccionado: true,
    })),
    "#f8fafc",
  )}

  ${renderGrupo(
    "En almuerzo",
    almuerzo.map((item) => ({
      ...item,
      grupo: "almuerzo",
      seleccionado: false,
    })),
    "#fff7ed",
  )}

  ${renderGrupo(
    "Ocupados en otra actividad",
    ocupados.map((item) => ({
      ...item,
      grupo: "ocupado",
      seleccionado: false,
    })),
    "#eff6ff",
  )}

  <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap; margin-top:18px;">
    <button id="btnConfirmarSeleccionReanudacion" type="button" style="padding:10px 14px; border:none; border-radius:10px; background:#2563eb; color:#fff; font-weight:600; cursor:pointer;">
      Reanudar con seleccionados
    </button>
    <button id="btnAsignarManualSeleccionReanudacion" type="button" style="padding:10px 14px; border:none; border-radius:10px; background:#0f766e; color:#fff; font-weight:600; cursor:pointer;">
      Asignar manualmente
    </button>
    <button id="btnCancelarSeleccionReanudacion" type="button" style="padding:10px 14px; border:1px solid #cbd5e1; border-radius:10px; background:#fff; color:#0f172a; font-weight:600; cursor:pointer;">
      Cancelar
    </button>
  </div>
</div>
`;

  const cerrar = () => {
    overlay.remove();
  };

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) cerrar();
  });

  document.body.appendChild(overlay);

  document.getElementById("btnCancelarSeleccionReanudacion").onclick = cerrar;

  document.getElementById("btnAsignarManualSeleccionReanudacion").onclick =
    () => {
      cerrar();
      mostrarAsignacion(trabajoId, actividadId);
    };

  document.getElementById("btnConfirmarSeleccionReanudacion").onclick =
    async () => {
      const checks = Array.from(
        document.querySelectorAll(
          "#modalSeleccionReanudacionActividad .chk-reanudar-tecnico:checked",
        ),
      );

      if (checks.length === 0) {
        alert("Debes seleccionar al menos un técnico para reanudar.");
        return;
      }

      const seleccionados = checks.map((chk) => ({
        tecnicoId: Number(chk.dataset.tecnicoId),
        grupo: String(chk.dataset.grupo || ""),
      }));

      cerrar();
      await procesarSeleccionReanudacionActividad(
        trabajoId,
        actividadId,
        disponibles,
        almuerzo,
        ocupados,
        seleccionados,
      );
    };
}

async function procesarSeleccionReanudacionActividad(
  trabajoId,
  actividadId,
  disponibles,
  almuerzo,
  ocupados,
  seleccionados,
) {
  const idsSeleccionados = new Set(
    (Array.isArray(seleccionados) ? seleccionados : []).map((s) =>
      Number(s.tecnicoId),
    ),
  );

  const seleccionDisponibles = (
    Array.isArray(disponibles) ? disponibles : []
  ).filter((item) =>
    idsSeleccionados.has(Number(item?.participante?.tecnico_id)),
  );

  const seleccionAlmuerzo = (Array.isArray(almuerzo) ? almuerzo : []).filter(
    (item) => idsSeleccionados.has(Number(item?.participante?.tecnico_id)),
  );

  const seleccionOcupados = (Array.isArray(ocupados) ? ocupados : []).filter(
    (item) => idsSeleccionados.has(Number(item?.participante?.tecnico_id)),
  );

  await reanudarActividadConSeleccionV2(
    trabajoId,
    actividadId,
    seleccionDisponibles,
    seleccionAlmuerzo,
    seleccionOcupados,
  );
}

async function reanudarActividadConSeleccionV2(
  trabajoId,
  actividadId,
  seleccionDisponibles,
  seleccionAlmuerzo,
  seleccionOcupados,
) {
  const disponibles = Array.isArray(seleccionDisponibles)
    ? seleccionDisponibles
    : [];
  const almuerzo = Array.isArray(seleccionAlmuerzo) ? seleccionAlmuerzo : [];
  const ocupados = Array.isArray(seleccionOcupados) ? seleccionOcupados : [];

  let reactivados = 0;

  for (const item of disponibles) {
    const tecnicoId = Number(item?.participante?.tecnico_id);
    if (!tecnicoId) continue;

    const ok = await activarParticipantePausadoEnActividadV2(
      trabajoId,
      actividadId,
      tecnicoId,
    );

    if (ok) reactivados += 1;
  }

  for (const item of almuerzo) {
    const tecnicoId = Number(item?.participante?.tecnico_id);
    if (!tecnicoId) continue;

    const ok = await activarParticipantePausadoEnActividadV2(
      trabajoId,
      actividadId,
      tecnicoId,
    );

    if (ok) reactivados += 1;
  }

  for (const item of ocupados) {
    const tecnicoId = Number(item?.participante?.tecnico_id);
    if (!tecnicoId) continue;

    const tecnicoRef = window.db.collection("tecnicos").doc(String(tecnicoId));
    const tecnicoSnap = await tecnicoRef.get();

    if (!tecnicoSnap.exists) continue;

    const tecnicoData = tecnicoSnap.data() || {};
    const trabajoOrigenId =
      tecnicoData.trabajo_id != null ? Number(tecnicoData.trabajo_id) : null;

    if (!trabajoOrigenId) {
      const ok = await activarParticipantePausadoEnActividadV2(
        trabajoId,
        actividadId,
        tecnicoId,
      );
      if (ok) reactivados += 1;
      continue;
    }

    const actividadOrigen = await buscarActividadActivaDelTecnicoV2(
      trabajoOrigenId,
      tecnicoId,
    );

    if (!actividadOrigen) {
      const ok = await activarParticipantePausadoEnActividadV2(
        trabajoId,
        actividadId,
        tecnicoId,
      );
      if (ok) reactivados += 1;
      continue;
    }

    const activosOrigen = Array.isArray(actividadOrigen.tecnicos_activos_ids)
      ? actividadOrigen.tecnicos_activos_ids.length
      : 0;

    let accionOrigen = "finalizado";

    if (activosOrigen <= 1) {
      const trabajoOrigen =
        (ultimoResumen.trabajos || []).find(
          (t) => Number(t.id) === Number(trabajoOrigenId),
        ) || null;

      accionOrigen = await obtenerAccionActividadSinTecnicosV2({
        trabajo: trabajoOrigen,
        actividad: actividadOrigen,
        tecnico: item?.participante || {},
      });

      if (!accionOrigen || accionOrigen === "__cancelar__") {
        continue;
      }
    }

    await liberarTecnicoDeTrabajo(
      trabajoOrigenId,
      tecnicoId,
      accionOrigen,
      actividadOrigen.id,
    );

    const ok = await activarParticipantePausadoEnActividadV2(
      trabajoId,
      actividadId,
      tecnicoId,
    );

    if (ok) reactivados += 1;
  }

  if (reactivados === 0) {
    alert("No se pudo reanudar la actividad con los técnicos seleccionados.");
    return;
  }
}

async function activarParticipantePausadoEnActividadV2(
  trabajoId,
  actividadId,
  tecnicoId,
) {
  const trabajoRef = window.db.collection("trabajos").doc(String(trabajoId));
  const actividadRef = window.db
    .collection("actividades")
    .doc(String(actividadId));
  const tecnicoRef = window.db.collection("tecnicos").doc(String(tecnicoId));

  const [trabajoSnap, actividadSnap, tecnicoSnap] = await Promise.all([
    trabajoRef.get(),
    actividadRef.get(),
    tecnicoRef.get(),
  ]);

  if (!trabajoSnap.exists || !actividadSnap.exists || !tecnicoSnap.exists) {
    return false;
  }

  const trabajo = trabajoSnap.data() || {};
  const actividad = actividadSnap.data() || {};
  const tecnico = tecnicoSnap.data() || {};

  const participantes = Array.isArray(actividad.participantes)
    ? [...actividad.participantes]
    : [];

  const participanteIndex = participantes.findIndex(
    (p) => Number(p?.tecnico_id) === Number(tecnicoId),
  );

  if (participanteIndex === -1) {
    return false;
  }

  const ahoraIso = new Date().toISOString();
  const participante = { ...participantes[participanteIndex] };
  if (participante.pausa_actual_at) {
    const pausaInicio = new Date(participante.pausa_actual_at);
    if (!isNaN(pausaInicio.getTime())) {
      const ahora = new Date();
      const pausaSeg = Math.max(0, Math.floor((ahora - pausaInicio) / 1000));

      participante.tiempo_pausa_seg =
        Number(participante.tiempo_pausa_seg || 0) + pausaSeg;
    }
  }
  participante.estado = "activo";
  participante.activo = true;
  participante.visible_en_tarjeta = true;
  participante.inicio_actual_at = ahoraIso;
  participante.pausa_actual_at = null;
  participante.finalizado_at = null;

  participantes[participanteIndex] = participante;

  const tecnicosActivosIds = Array.isArray(actividad.tecnicos_activos_ids)
    ? [...actividad.tecnicos_activos_ids]
    : [];
  const tecnicosActivosNombres = Array.isArray(
    actividad.tecnicos_activos_nombres,
  )
    ? [...actividad.tecnicos_activos_nombres]
    : [];

  if (!tecnicosActivosIds.some((id) => Number(id) === Number(tecnicoId))) {
    tecnicosActivosIds.push(tecnicoId);
  }

  const nombreTecnico =
    participante.tecnico_nombre || tecnico.nombre || "Técnico";
  if (!tecnicosActivosNombres.includes(nombreTecnico)) {
    tecnicosActivosNombres.push(nombreTecnico);
  }

  const actividadUpdate = {
    participantes,
    estado: "en_proceso",
    primer_inicio_at: actividad.primer_inicio_at || ahoraIso,
    ultima_reanudacion_at: ahoraIso,
    ultima_actividad_at: ahoraIso,
    inicio_tramo_activo_at: ahoraIso,
    inicio_tramo_pausa_at: null,
    finalizado_at: null,
    tecnicos_activos_ids: tecnicosActivosIds,
    tecnicos_activos_nombres: tecnicosActivosNombres,
    tecnicos_activos_count: tecnicosActivosIds.length,
  };

  const batch = window.db.batch();

  batch.update(actividadRef, actividadUpdate);

  batch.update(tecnicoRef, {
    estado: "trabajando",
    trabajo_id: Number(trabajoId),
    almuerzo_desde: null,
    almuerzo_hasta: null,
  });

  const actividadesTrabajo = Array.isArray(ultimoResumen?.trabajos)
    ? ultimoResumen.trabajos.find((t) => Number(t.id) === Number(trabajoId))
        ?.actividades || []
    : [];

  const actividadesRestantes = actividadesTrabajo.map((a) => {
    if (String(a?.id || "").trim() !== String(actividadId).trim()) return a;
    return {
      ...a,
      ...actividad,
      ...actividadUpdate,
    };
  });

  const {
    nuevoEstadoTrabajo,
    actividadesPendientes,
    actividadesEnProceso,
    actividadesPausadas,
    actividadesFinalizadas,
    tecnicosActivosTotal,
    tecnicosParticipantesCount,
  } = resumirEstadosTrabajoDesdeActividades(actividadesRestantes);

  const trabajoUpdate = {
    estado: nuevoEstadoTrabajo,
    primer_inicio_at: trabajo.primer_inicio_at || ahoraIso,
    ultima_actividad_at: ahoraIso,
    finalizado_at: nuevoEstadoTrabajo === "finalizado" ? ahoraIso : null,
    total_actividades: actividadesRestantes.length,
    actividades_pendientes: actividadesPendientes,
    actividades_en_proceso: actividadesEnProceso,
    actividades_pausadas: actividadesPausadas,
    actividades_finalizadas: actividadesFinalizadas,
    tecnicos_activos_count: tecnicosActivosTotal,
    tecnicos_participantes_count: tecnicosParticipantesCount,
  };

  batch.update(trabajoRef, trabajoUpdate);

  await batch.commit();
  return true;
}

async function buscarActividadActivaDelTecnicoV2(trabajoId, tecnicoId) {
  const snapshot = await window.db
    .collection("actividades")
    .where("trabajo_id", "==", Number(trabajoId))
    .where("activo", "==", true)
    .get();

  const actividades = snapshot.docs.map((doc) => doc.data());

  return (
    actividades.find((act) => {
      const participantes = Array.isArray(act?.participantes)
        ? act.participantes
        : [];

      return participantes.some(
        (p) =>
          Number(p?.tecnico_id) === Number(tecnicoId) &&
          p?.activo !== false &&
          String(p?.estado || "").toLowerCase() === "activo",
      );
    }) || null
  );
}

function obtenerAccionActividadSinTecnicosV2({ trabajo, actividad, tecnico }) {
  return new Promise((resolve) => {
    abrirModalTrabajoSinTecnicos({
      trabajo: {
        ...(trabajo || {}),
        id: trabajo?.id || actividad?.trabajo_id,
        descripcion:
          trabajo?.descripcion || actividad?.descripcion || "Sin descripción",
        origen: trabajo?.origen || "vendedor",
        responsable_nombre:
          trabajo?.responsable_nombre ||
          actividad?.responsable_nombre ||
          "Sin responsable",
        actividades: [actividad],
      },
      contexto:
        "Este técnico saldrá de su actividad actual y esa actividad quedará sin técnicos activos. ¿Qué deseas hacer con ella?",
      tecnicosMovidos: [
        {
          id: tecnico?.tecnico_id || tecnico?.id,
          nombre: tecnico?.tecnico_nombre || tecnico?.nombre || "Técnico",
        },
      ],
      onResolver: async (accion) => {
        resolve(accion || "__cancelar__");
      },
    });
  });
}

const firebaseConfig = window.firebaseConfig;
firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();

window.db = db;
window.auth = auth;
const APP_ENV = window.APP_ENV;
window.APP_ENV = APP_ENV;

if (typeof iniciarAplicacion === "function") {
  iniciarAplicacion();
}

const batutaRef = db.collection("config").doc("batuta");

function actualizarVisibilidadSeccionesMenu({
  mostrarSupervision,
  mostrarGestion,
  mostrarSistema,
}) {
  const seccionSupervision = document.getElementById("menuSeccionSupervision");
  const seccionGestion = document.getElementById("menuSeccionGestion");
  const seccionSistema = document.getElementById("menuSeccionSistema");
  const seccionCuenta = document.getElementById("menuSeccionCuenta");

  const secciones = [
    { el: seccionSupervision, visible: mostrarSupervision },
    { el: seccionGestion, visible: mostrarGestion },
    { el: seccionSistema, visible: mostrarSistema },
    { el: seccionCuenta, visible: true },
  ];

  secciones.forEach(({ el, visible }) => {
    if (!el) return;
    el.classList.remove("primera-visible");
    el.classList.toggle("oculta", !visible);
  });

  const primeraVisible = secciones.find(({ el, visible }) => el && visible);
  if (primeraVisible?.el) {
    primeraVisible.el.classList.add("primera-visible");
  }
}

// =============================
// LISTENER BATUTA
// =============================
batutaRef.onSnapshot(async (doc) => {
  const data = doc.data() || {};
  const batutaUsuarioId =
    data.usuario_id != null ? Number(data.usuario_id) : null;
  const miUsuarioId = Number(USUARIO_ID_ACTUAL);

  const label = document.getElementById("batutaTexto");
  if (!label) return;

  const tengoBatuta = batutaUsuarioId === miUsuarioId;

  if (!batutaUsuarioId) {
    label.textContent = "Sin asignar";
  } else {
    let nombre = "otro usuario";

    if (nombreBatutaCache[batutaUsuarioId]) {
      nombre = nombreBatutaCache[batutaUsuarioId];
    } else {
      const snap = await db
        .collection("usuarios")
        .where("id", "==", batutaUsuarioId)
        .limit(1)
        .get();

      if (!snap.empty) {
        nombre = snap.docs[0].data().nombre || nombre;
        nombreBatutaCache[batutaUsuarioId] = nombre;
      }
    }

    label.textContent = tengoBatuta ? "la tienes tú" : "la tiene " + nombre;
  }

  TIENE_BATUTA = tengoBatuta;

  actualizarMenuSegunEstado();

  if (ultimoResumen && Array.isArray(ultimoResumen.trabajos)) {
    renderizarPanelPrincipal(ultimoResumen);
  }
});

// =============================
// LISTENER USUARIO ACTUAL
// =============================
db.collection("usuarios")
  .where("id", "==", USUARIO_ID_ACTUAL)
  .limit(1)
  .onSnapshot(
    (snapshot) => {
      if (snapshot.empty) return;

      const usuarioActual = snapshot.docs[0].data() || {};
      usuarioActualCache = usuarioActual;
      ES_ADMIN = usuarioActual.es_admin === true;

      // 🔴 IMPORTANTE: usuario desactivado
      if (usuarioActual.activo === false) {
        window.location.href = "/logout";
        return;
      }

      actualizarMenuSegunEstado();

      if (ultimoResumen && Array.isArray(ultimoResumen.trabajos)) {
        renderizarPanelPrincipal(ultimoResumen);
      }
    },
    (error) => {
      console.error("Error escuchando usuario actual:", error);
    },
  );

function abrirModalAccionesTecnico() {
  const modal = document.getElementById("modalAccionesTecnico");
  if (modal) modal.style.display = "block";
}

function cerrarModalAccionesTecnico() {
  const modal = document.getElementById("modalAccionesTecnico");
  if (modal) modal.style.display = "none";
}
function pedirEliminarTrabajoPendiente(trabajoId) {
  abrirModalConfirmacion({
    titulo: "Eliminar trabajo pendiente",
    texto: "Este trabajo será eliminado y no aparecerá más en el panel.",
    destacado: "Esta acción solo afecta trabajos pendientes.",
    boton: "Eliminar",
    claseBoton: "btn-danger",
    onConfirm: async () => {
      await eliminarTrabajoPendiente(trabajoId);
    },
  });
}
