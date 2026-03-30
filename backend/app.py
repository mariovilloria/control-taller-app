from flask import Flask, request, jsonify, render_template, redirect, url_for, session
from datetime import datetime, timedelta
import os
import firebase_admin
from firebase_admin import credentials, firestore

APP_ENV = os.environ.get("APP_ENV", "test").strip().lower()

FIREBASE_PROJECTS = {
    "test": {
        "credential_path": "firebase-key-test.json",
        "web_config": {
            "apiKey": "AIzaSyAyMuYDurJS7wTRi4jXrXOeH4G3-PGfj10",
            "authDomain": "control-taller-test.firebaseapp.com",
            "projectId": "control-taller-test",
            "storageBucket": "control-taller-test.firebasestorage.app",
            "messagingSenderId": "809588778547",
            "appId": "1:809588778547:web:41765b3a65a599226d6546",
        },
    },
    "prod": {
        "credential_path": "firebase-key.json",
        "web_config": {
            "apiKey": "AIzaSyA28Yl41a2-Tz0LSLVVmcoyfP_5hlTWAfs",
            "authDomain": "control-taller-83ca4.firebaseapp.com",
            "databaseURL": "https://control-taller-83ca4-default-rtdb.firebaseio.com",
            "projectId": "control-taller-83ca4",
            "storageBucket": "control-taller-83ca4.firebasestorage.app",
            "messagingSenderId": "719470492457",
            "appId": "1:719470492457:web:5fb9c6d2b9bf7b5a5c1538",
        },
    },
}

if APP_ENV not in FIREBASE_PROJECTS:
    raise ValueError(f"APP_ENV no válido: {APP_ENV}")

firebase_settings = FIREBASE_PROJECTS[APP_ENV]
credential_path = firebase_settings["credential_path"]

if not firebase_admin._apps:
    if not os.path.exists(credential_path):
        raise FileNotFoundError(
            f"No se encontró el archivo de credenciales: {credential_path}"
        )

    cred = credentials.Certificate(credential_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()
app = Flask(__name__)
app.secret_key = "control_taller_clave_inicial_2026"


# =========================
# Helpers
# =========================
def ahora_iso():
    return datetime.now().isoformat()


def diff_segundos(desde_iso, hasta_iso=None):
    if not desde_iso:
        return 0
    try:
        inicio = datetime.fromisoformat(desde_iso)
        fin = datetime.fromisoformat(hasta_iso) if hasta_iso else datetime.now()
        return max(0, int((fin - inicio).total_seconds()))
    except Exception:
        return 0


def limpiar_contexto_tecnico(tecnico):
    tecnico["almuerzo_desde"] = None
    tecnico["almuerzo_hasta"] = None
    tecnico["interno_descripcion"] = None
    tecnico["interno_solicitante"] = None


usuarios = [
    {
        "id": 1,
        "usuario": "mario",
        "clave": "1234",
        "nombre": "Mario",
        "es_admin": True,
        "puede_gestionar": True,
    },
    {
        "id": 2,
        "usuario": "camila",
        "clave": "1234",
        "nombre": "Camila",
        "es_admin": False,
        "puede_gestionar": False,
    },
    {
        "id": 3,
        "usuario": "genesis",
        "clave": "1234",
        "nombre": "Génesis",
        "es_admin": False,
        "puede_gestionar": False,
    },
    {
        "id": 4,
        "usuario": "vanesa",
        "clave": "1234",
        "nombre": "Vanesa",
        "es_admin": False,
        "puede_gestionar": False,
    },
    {
        "id": 5,
        "usuario": "yesica",
        "clave": "1234",
        "nombre": "Yesica",
        "es_admin": False,
        "puede_gestionar": False,
    },
    {
        "id": 6,
        "usuario": "darling",
        "clave": "1234",
        "nombre": "Darling",
        "es_admin": False,
        "puede_gestionar": False,
    },
]


def obtener_batuta_usuario_id():
    doc = db.collection("config").document("batuta").get()
    if not doc.exists:
        return None

    data = doc.to_dict() or {}
    return data.get("usuario_id")


def guardar_batuta_usuario_id(usuario_id):
    db.collection("config").document("batuta").set({"usuario_id": usuario_id})


def usuario_tiene_batuta():
    usuario_id = session.get("usuario_id")
    batuta_usuario_id = obtener_batuta_usuario_id()
    return usuario_id is not None and batuta_usuario_id == usuario_id


@app.route("/")
def home():
    return redirect(url_for("login"))


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        return render_template("login.html")

    usuario_ingresado = (request.form.get("usuario") or "").strip()
    clave_ingresada = (request.form.get("clave") or "").strip()

    usuario_encontrado = None

    docs = (
        db.collection("usuarios")
        .where("usuario", "==", usuario_ingresado)
        .where("clave", "==", clave_ingresada)
        .where("activo", "==", True)
        .stream()
    )

    for doc in docs:
        usuario_encontrado = doc.to_dict()
        break

    if not usuario_encontrado:
        return render_template("login.html", error="Usuario o clave incorrectos")

    session["usuario_id"] = usuario_encontrado["id"]
    session["usuario_nombre"] = usuario_encontrado["nombre"]
    session["es_admin"] = usuario_encontrado["es_admin"]
    session["puede_gestionar"] = usuario_encontrado["puede_gestionar"]

    return redirect(url_for("panel"))


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/batuta/estado")
def estado_batuta():
    return jsonify({"batuta_usuario_id": obtener_batuta_usuario_id()})


@app.route("/batuta/tomar", methods=["POST"])
def tomar_batuta():
    usuario_id = session.get("usuario_id")

    if not usuario_id:
        return redirect(url_for("login"))

    es_admin = session.get("es_admin", False)

    batuta_actual = obtener_batuta_usuario_id()

    # ADMIN puede tomar siempre
    if es_admin:
        guardar_batuta_usuario_id(usuario_id)
        return redirect(url_for("panel"))

    # Usuario normal solo si está libre
    if batuta_actual is None:
        guardar_batuta_usuario_id(usuario_id)
        return redirect(url_for("panel"))

    return redirect(url_for("panel"))


@app.route("/batuta/soltar", methods=["POST"])
def soltar_batuta():
    if not session.get("usuario_id"):
        return redirect(url_for("login"))

    usuario_id = session.get("usuario_id")
    es_admin = session.get("es_admin", False)

    # Si no tiene la batuta, no hace nada
    if not usuario_tiene_batuta():
        return redirect(url_for("panel"))

    # 🔥 Buscar al admin (dueño)
    docs = (
        db.collection("usuarios")
        .where("es_admin", "==", True)
        .where("activo", "==", True)
        .stream()
    )

    admin_id = None
    for doc in docs:
        data = doc.to_dict()
        admin_id = data.get("id")
        break

    # 🔥 Si encuentra admin, vuelve a él
    if admin_id:
        guardar_batuta_usuario_id(admin_id)

    return redirect(url_for("panel"))


@app.route("/batuta/transferir", methods=["POST"])
def transferir_batuta():
    if not session.get("usuario_id"):
        return redirect(url_for("login"))

    usuario_actual = session.get("usuario_id")
    es_admin = session.get("es_admin", False)

    nuevo_usuario_id = int(request.form.get("usuario_id"))

    batuta_actual = obtener_batuta_usuario_id()

    # Solo el admin o quien tiene la batuta puede transferir
    if not es_admin and batuta_actual != usuario_actual:
        return redirect(url_for("panel"))

    # Buscar el usuario destino en Firestore
    docs = (
        db.collection("usuarios")
        .where("id", "==", nuevo_usuario_id)
        .where("activo", "==", True)
        .stream()
    )

    usuario_destino = None
    for doc in docs:
        usuario_destino = doc.to_dict()
        break

    if not usuario_destino:
        return redirect(url_for("panel"))

    # Validar que pueda gestionar
    if not usuario_destino.get("puede_gestionar", False):
        return redirect(url_for("panel"))

    # Transferir batuta
    guardar_batuta_usuario_id(nuevo_usuario_id)

    return redirect(url_for("panel"))


@app.route("/panel")
def panel():
    if not session.get("usuario_id"):
        return redirect(url_for("login"))

    usuario_id = session.get("usuario_id")
    batuta_usuario_id = obtener_batuta_usuario_id()

    # traer usuarios desde Firestore
    docs = db.collection("usuarios").where("activo", "==", True).stream()

    usuarios = []
    for doc in docs:
        usuarios.append(doc.to_dict())

    batuta_nombre = None

    if batuta_usuario_id:
        docs = db.collection("usuarios").where("id", "==", batuta_usuario_id).stream()

        for doc in docs:
            data = doc.to_dict()
            batuta_nombre = data.get("nombre")
            break

    import subprocess

    def obtener_version():
        try:
            return (
                subprocess.check_output(["git", "rev-parse", "--short", "HEAD"])
                .decode("utf-8")
                .strip()
            )
        except:
            return "unknown"

    return render_template(
        "index.html",
        usuario_nombre=session.get("usuario_nombre"),
        es_admin=session.get("es_admin"),
        puede_gestionar=session.get("puede_gestionar"),
        usuario_id=usuario_id,
        tiene_batuta=(batuta_usuario_id == usuario_id) or session.get("es_admin"),
        batuta_usuario_id=batuta_usuario_id,
        batuta_nombre=batuta_nombre,
        usuarios=usuarios,
        firebase_config=firebase_settings["web_config"],
        app_env=APP_ENV,
        version_app=obtener_version(),
    )


@app.route("/trabajos/<int:trabajo_id>/editar", methods=["POST"])
def editar_trabajo(trabajo_id):
    data = request.json or {}
    nueva_descripcion = (data.get("descripcion") or "").strip()
    nuevo_origen = (data.get("origen") or "").strip().lower()
    nuevo_vendedor_id = data.get("vendedor_id")
    nuevo_solicitante = (data.get("solicitante_nombre") or "").strip()

    if not nueva_descripcion:
        return jsonify({"error": "La descripción es obligatoria"}), 400
    if nuevo_origen not in ["vendedor", "interno"]:
        return jsonify({"error": "Debes indicar un origen válido"}), 400

    trabajo_ref = db.collection("trabajos").document(str(trabajo_id))
    trabajo_doc = trabajo_ref.get()

    if not trabajo_doc.exists:
        return jsonify({"error": "Trabajo no encontrado"}), 404

    update_data = {"descripcion": nueva_descripcion, "origen": nuevo_origen}

    if nuevo_origen == "vendedor":
        if nuevo_vendedor_id is None:
            return jsonify({"error": "Debes seleccionar un vendedor"}), 400

        vendedor_doc = (
            db.collection("vendedores").document(str(nuevo_vendedor_id)).get()
        )
        if not vendedor_doc.exists:
            return jsonify({"error": "Vendedor no encontrado"}), 404

        vendedor = vendedor_doc.to_dict()

        update_data.update(
            {
                "vendedor_id": vendedor.get("id"),
                "vendedor_nombre": vendedor.get("nombre"),
                "solicitante_nombre": None,
                "responsable_nombre": vendedor.get("nombre"),
            }
        )

    if nuevo_origen == "interno":
        if not nuevo_solicitante:
            return (
                jsonify({"error": "Debes escribir quién solicita el trabajo interno"}),
                400,
            )

        update_data.update(
            {
                "vendedor_id": None,
                "vendedor_nombre": None,
                "solicitante_nombre": nuevo_solicitante,
                "responsable_nombre": nuevo_solicitante,
            }
        )

    trabajo_ref.update(update_data)

    trabajo_actualizado = trabajo_ref.get().to_dict()

    return jsonify(
        {
            "mensaje": "Trabajo actualizado correctamente",
            "trabajo": trabajo_actualizado,
        }
    )


import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=5000)
