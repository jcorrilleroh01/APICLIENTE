/* =========================================================
   Ficha de evaluación de cliente
   Recoge los campos del formulario, los valida y genera
   el objeto con las columnas que espera preparar_datos_crudos().
   ========================================================= */

// Ruta del endpoint de main.py. Es relativa porque FastAPI sirve esta web y la API
// desde el mismo servidor (http://127.0.0.1:8000), así que no hace falta poner la URL completa.
const API_URL = "/predict";

const form = document.getElementById("form-cliente");
const salidaJson = document.getElementById("json-salida");
const bloqueJson = document.getElementById("bloque-json");
const estado = document.getElementById("estado");
const veredicto = document.getElementById("veredicto");
const rosa = document.getElementById("rosa");
const btnEvaluar = document.getElementById("btn-evaluar");

const TOTAL_CAMPOS = 11;
const FORMATO_ID = /^CLI-\d{4}$/; // mismo formato que el CSV: CLI-1001

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const dec = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 });

/* ---------- 1. Recogida de datos ---------- */

function leerNumero(fd, nombre, entero = false) {
  const valor = fd.get(nombre);
  if (valor === null || valor === "") return null;
  const n = Number(valor);
  if (!Number.isFinite(n)) return null;
  return entero ? Math.round(n) : n;
}

function leerTexto(fd, nombre) {
  const valor = fd.get(nombre);
  return valor === null || valor === "" ? null : String(valor);
}

/** Devuelve los datos del cliente con los nombres y tipos de las columnas del dataset. */
function recogerDatos() {
  const fd = new FormData(form);
  return {
    id_cliente: leerTexto(fd, "id_cliente")?.trim().toUpperCase() || null,
    edad: leerNumero(fd, "edad", true),
    ingresos_anuales: leerNumero(fd, "ingresos_anuales"),
    antiguedad_meses: leerNumero(fd, "antiguedad_meses", true),
    saldo_cuenta: leerNumero(fd, "saldo_cuenta"),
    nivel_estudios: leerTexto(fd, "nivel_estudios"),
    tipo_cuenta: leerTexto(fd, "tipo_cuenta"),
    nivel_satisfaccion: leerTexto(fd, "nivel_satisfaccion"),
    num_productos: leerNumero(fd, "num_productos", true),
    tiene_tarjeta: leerNumero(fd, "tiene_tarjeta", true),
    canal_preferido: leerTexto(fd, "canal_preferido"),
  };
}

/* ---------- 2. Validación ---------- */

const REGLAS = {
  id_cliente: (v) => (v === null ? "Introduce el ID del cliente." : !FORMATO_ID.test(v) ? "El ID debe tener el formato CLI-1234." : ""),
  edad: (v) => (v === null ? "Introduce la edad." : v < 18 || v > 120 ? "La edad debe estar entre 18 y 120 años." : ""),
  ingresos_anuales: (v) => (v === null ? "Introduce los ingresos anuales." : v <= 0 ? "Los ingresos deben ser mayores que 0 €." : ""),
  saldo_cuenta: (v) => (v === null ? "Introduce el saldo." : v < 0 ? "El saldo no puede ser negativo." : ""),
  antiguedad_meses: (v) => (v === null ? "Introduce la antigüedad." : v < 0 ? "La antigüedad no puede ser negativa." : ""),
  nivel_estudios: (v) => (v ? "" : "Elige el nivel de estudios."),
  tipo_cuenta: (v) => (v ? "" : "Elige el tipo de cuenta."),
  nivel_satisfaccion: (v) => (v ? "" : "Elige el nivel de satisfacción."),
  num_productos: (v) => (v ? "" : "Elige el número de productos."),
  tiene_tarjeta: (v) => (v === null ? "Indica si tiene tarjeta." : ""),
  canal_preferido: (v) => (v ? "" : "Elige el canal preferido."),
};

function mostrarError(nombre, mensaje) {
  const campo = form.querySelector(`[data-campo="${nombre}"]`);
  const error = document.getElementById(`${nombre}-error`);
  if (!campo || !error) return;
  error.textContent = mensaje;
  campo.classList.toggle("con-error", Boolean(mensaje));
  campo.querySelectorAll("input").forEach((input) => {
    if (mensaje) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  });
}

function validar(datos) {
  let primero = null;
  let fallos = 0;
  for (const [nombre, regla] of Object.entries(REGLAS)) {
    const mensaje = regla(datos[nombre]);
    mostrarError(nombre, mensaje);
    if (mensaje) {
      fallos++;
      primero ??= nombre;
    }
  }
  return { valido: fallos === 0, fallos, primero };
}

/* ---------- 3. Resumen en vivo (mismas reglas que el pipeline en Python) ---------- */

function grupoEdad(edad) {
  // Equivale a pd.cut(bins=[0, 30, 55, 120], labels=['Joven', 'Adulto', 'Senior'])
  if (edad === null || edad <= 0 || edad > 120) return null;
  if (edad <= 30) return "Joven";
  if (edad <= 55) return "Adulto";
  return "Senior";
}

function contarCompletados(datos) {
  return Object.values(datos).filter((v) => v !== null).length;
}

function actualizarResumen() {
  const d = recogerDatos();

  document.getElementById("progreso-num").textContent = contarCompletados(d);
  document.getElementById("r-grupo").textContent = grupoEdad(d.edad) ?? "—";

  document.getElementById("r-anios").textContent =
    d.antiguedad_meses !== null ? `${dec.format(d.antiguedad_meses / 12)} años` : "—";

  document.getElementById("r-ratio").textContent =
    d.saldo_cuenta !== null && d.ingresos_anuales !== null
      ? dec.format(d.saldo_cuenta / (d.ingresos_anuales + 1))
      : "—";

  document.getElementById("r-producto").textContent =
    d.saldo_cuenta !== null && d.num_productos
      ? eur.format(d.saldo_cuenta / d.num_productos)
      : "—";

  salidaJson.textContent = JSON.stringify(d, null, 2);
  dibujarRosa(rosa, semillaDe(d));
}

/* ---------- 4. Sello guilloché (cambia con los datos del cliente) ---------- */

function semillaDe(obj) {
  const texto = JSON.stringify(obj);
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
  return h;
}

function aleatorio(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function trazoAnillo({ radio, amplitud, lobulos, onda, rizo, fase, pasos = 720 }) {
  let d = "";
  for (let k = 0; k <= pasos; k++) {
    const t = (k / pasos) * Math.PI * 2;
    const r = radio + amplitud * Math.cos(lobulos * (t + fase)) + rizo * Math.sin(onda * lobulos * (t - fase));
    const x = (r * Math.cos(t)).toFixed(2);
    const y = (r * Math.sin(t)).toFixed(2);
    d += (k === 0 ? "M" : "L") + x + " " + y;
  }
  return d + "Z";
}

function dibujarRosa(svg, semilla, { animar = false, capasExt = 9, capasInt = 6 } = {}) {
  const rnd = aleatorio(semilla);
  const lobulos = 6 + Math.floor(rnd() * 9);
  const radio = 52 + rnd() * 8;
  const amplitud = 18 + rnd() * 10;
  const onda = 2 + Math.floor(rnd() * 3);
  const rizo = 2 + rnd() * 3;
  const lobulosInt = lobulos + 3 + Math.floor(rnd() * 6);

  let html = "";
  let i = 0;

  for (let c = 0; c < capasExt; c++, i++) {
    const fase = (c / capasExt) * ((Math.PI * 2) / lobulos);
    const d = trazoAnillo({ radio: radio - c * 0.9, amplitud, lobulos, onda, rizo, fase });
    html += `<path d="${d}" pathLength="1" style="--i:${i}" opacity="${(0.9 - c * 0.05).toFixed(2)}"/>`;
  }

  for (let c = 0; c < capasInt; c++, i++) {
    const fase = (c / capasInt) * ((Math.PI * 2) / lobulosInt);
    const d = trazoAnillo({ radio: radio * 0.5, amplitud: amplitud * 0.45, lobulos: lobulosInt, onda: 1, rizo: rizo * 0.5, fase });
    html += `<path d="${d}" pathLength="1" style="--i:${i}" opacity="0.55"/>`;
  }

  svg.innerHTML = html;

  if (animar) {
    svg.classList.remove("rosa--dibujando");
    void svg.getBoundingClientRect(); // reinicia la animación
    svg.classList.add("rosa--dibujando");
  } else {
    svg.classList.remove("rosa--dibujando");
  }
}

/* ---------- 5. Envío al modelo ---------- */

function mensajeError(data, codigo) {
  // FastAPI devuelve los fallos de validación (422) como una lista en "detail"
  if (Array.isArray(data?.detail)) {
    return data.detail.map((d) => `${d.loc.at(-1)}: ${d.msg}`).join(" · ");
  }
  return data?.detail || `La API ha devuelto un error (${codigo}).`;
}

async function enviarAlModelo(datos) {
  const respuesta = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  const data = await respuesta.json().catch(() => null);
  if (!respuesta.ok) throw new Error(mensajeError(data, respuesta.status));
  return data;
}

function mostrarVeredicto(resultado) {
  // Respuesta de PrediccionOutput:
  // { id_cliente, abandono, probabilidad_abandono, nivel_riesgo, accion_recomendada }
  const abandona = Number(resultado.abandono) === 1;
  const prob = Number(resultado.probabilidad_abandono);

  veredicto.hidden = false;
  veredicto.className = resultado.nivel_riesgo === "Bajo" ? "veredicto" : "veredicto veredicto--riesgo";
  veredicto.innerHTML = `
    <strong>Riesgo ${escapar(String(resultado.nivel_riesgo).toLowerCase())}</strong>
    ${abandona ? "El modelo predice que el cliente abandonará." : "El modelo predice que el cliente se quedará."}
    Probabilidad de abandono: ${dec.format(prob * 100)} %.
    <br><br>${escapar(resultado.accion_recomendada)}`;
}

function escapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

function ponerEstado(texto, esError = false) {
  estado.textContent = texto;
  estado.classList.toggle("estado--error", esError);
}

/* ---------- 6. Eventos ---------- */

form.addEventListener("input", (e) => {
  if (e.target.id === "id_cliente") e.target.value = e.target.value.toUpperCase();
  if (e.target.name) mostrarError(e.target.name, "");
  veredicto.hidden = true;
  actualizarResumen();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const datos = recogerDatos();
  const { valido, fallos, primero } = validar(datos);

  if (!valido) {
    ponerEstado(fallos === 1 ? "Falta 1 campo por completar o corregir." : `Faltan ${fallos} campos por completar o corregir.`, true);
    form.querySelector(`[name="${primero}"]`)?.focus();
    return;
  }

  salidaJson.textContent = JSON.stringify(datos, null, 2);
  bloqueJson.open = true;
  dibujarRosa(rosa, semillaDe(datos), { animar: true });
  console.log("Datos del cliente:", datos);

  btnEvaluar.disabled = true;
  ponerEstado("Enviando datos al modelo…");
  try {
    const resultado = await enviarAlModelo(datos);
    mostrarVeredicto(resultado);
    ponerEstado("Evaluación recibida.");
  } catch (err) {
    const sinConexion = err instanceof TypeError;
    ponerEstado(sinConexion ? "No se pudo conectar con la API. Comprueba que el servidor está arrancado." : err.message, true);
  } finally {
    btnEvaluar.disabled = false;
  }
});

form.addEventListener("reset", () => {
  // Espera a que el navegador vacíe los campos
  setTimeout(() => {
    Object.keys(REGLAS).forEach((n) => mostrarError(n, ""));
    veredicto.hidden = true;
    bloqueJson.open = false;
    ponerEstado("");
    actualizarResumen();
  });
});

document.getElementById("btn-copiar").addEventListener("click", async (e) => {
  const boton = e.currentTarget;
  try {
    await navigator.clipboard.writeText(salidaJson.textContent);
    boton.textContent = "JSON copiado";
  } catch {
    boton.textContent = "No se pudo copiar";
  }
  setTimeout(() => (boton.textContent = "Copiar JSON"), 2000);
});

// Cliente real del CSV (CLI-1002) para probar rápido
const EJEMPLO = {
  edad: 39,
  ingresos_anuales: 13334.98,
  antiguedad_meses: 31,
  saldo_cuenta: 4586.66,
  nivel_estudios: "Grado",
  tipo_cuenta: "Ahorro",
  nivel_satisfaccion: "Alto",
  num_productos: 2,
  tiene_tarjeta: 1,
  canal_preferido: "App Movil",
  id_cliente: "CLI-1002",
};

document.getElementById("btn-ejemplo").addEventListener("click", () => {
  for (const [nombre, valor] of Object.entries(EJEMPLO)) {
    const campos = form.elements[nombre];
    if (!campos) continue;
    if (campos instanceof RadioNodeList) campos.value = String(valor);
    else campos.value = valor;
    mostrarError(nombre, "");
  }
  veredicto.hidden = true;
  ponerEstado("");
  actualizarResumen();
});

/* ---------- Inicio ---------- */

dibujarRosa(document.getElementById("sello"), 42, { capasExt: 4, capasInt: 0 });
actualizarResumen();

// Disponible desde la consola o desde otros scripts
window.recogerDatos = recogerDatos;
