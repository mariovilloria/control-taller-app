from flask import Flask, request, jsonify, render_template, redirect, url_for, session
from datetime import datetime, timedelta
import os
import firebase_admin
from firebase_admin import credentials, firestore
from werkzeug.security import generate_password_hash, check_password_hash

APP_ENV = os.environ.get("APP_ENV", "test").strip().lower()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

FIREBASE_PROJECTS = {
    "test": {
        "credential_path": os.path.join(BASE_DIR, "firebase-key-test.json"),
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
        "credential_path": os.path.join(BASE_DIR, "firebase-key.json"),
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


def obtener_batuta_usuario_id():
    doc = db.collection("config").document("batuta").get()
    if not doc.exists:
        return None

    data = doc.to_dict() or {}
    return data.get("usuario_id")


def guardar_batuta_usuario_id(usuario_id):
    db.collection("config").document("batuta").set({"usuario_id": usuario_id})


def obtener_usuario_por_id(usuario_id):
    if not usuario_id:
        return None

    docs = db.collection("usuarios").where("id", "==", usuario_id).limit(1).stream()

    for doc in docs:
        return doc.to_dict() or {}

    return None


def obtener_usuario_actual_db():
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return None

    return obtener_usuario_por_id(usuario_id)


def usuario_activo():
    usuario = obtener_usuario_actual_db()
    return bool(usuario and usuario.get("activo", False))


def es_super_admin():
    usuario = obtener_usuario_actual_db()
    return bool(
        usuario and usuario.get("activo", False) and usuario.get("super_admin", False)
    )


def usuario_objetivo_es_super_admin(usuario_id):
    usuario = obtener_usuario_por_id(usuario_id)
    return bool(
        usuario and usuario.get("activo", False) and usuario.get("super_admin", False)
    )


def usuario_tiene_batuta():
    usuario_id = session.get("usuario_id")
    batuta_usuario_id = obtener_batuta_usuario_id()
    return usuario_id is not None and batuta_usuario_id == usuario_id


def es_admin():
    usuario = obtener_usuario_actual_db()
    return bool(
        usuario and usuario.get("activo", False) and usuario.get("es_admin", False)
    )


def tiene_batuta():
    return es_admin() or usuario_tiene_batuta()


def usuario_puede_gestionar():
    return es_admin() or usuario_tiene_batuta()


def usuario_puede_crear_trabajos():
    usuario = obtener_usuario_actual_db()
    return bool(
        usuario
        and usuario.get("activo", False)
        and (
            usuario.get("es_admin", False)
            or usuario_tiene_batuta()
            or usuario.get("puede_crear_trabajos", False)
        )
    )


def usuario_es_elegible_para_batuta():
    usuario = obtener_usuario_actual_db()
    return bool(
        usuario
        and usuario.get("activo", False)
        and (usuario.get("es_admin", False) or usuario.get("puede_gestionar", False))
    )


@app.before_request
def validar_sesion_activa():
    rutas_publicas = {"login", "logout", "static"}

    if request.endpoint in rutas_publicas:
        return None

    if not session.get("usuario_id"):
        return None

    if not usuario_activo():
        session.clear()
        return redirect(url_for("login"))

    return None


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
        .where("activo", "==", True)
        .limit(1)
        .stream()
    )

    for doc in docs:
        usuario_encontrado = doc.to_dict()
        break

    if not usuario_encontrado:
        return render_template("login.html", error="Usuario o clave incorrectos")

    clave_guardada = usuario_encontrado.get("clave", "")

    if not check_password_hash(clave_guardada, clave_ingresada):
        return render_template("login.html", error="Usuario o clave incorrectos")

    session["usuario_id"] = usuario_encontrado["id"]
    session["usuario_nombre"] = usuario_encontrado["nombre"]
    session["es_admin"] = usuario_encontrado.get("es_admin", False)
    session["super_admin"] = usuario_encontrado.get("super_admin", False)
    session["puede_gestionar"] = usuario_encontrado.get("puede_gestionar", False)
    session["puede_crear_trabajos"] = usuario_encontrado.get(
        "puede_crear_trabajos", False
    )

    return redirect(url_for("panel"))


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/batuta/estado")
def estado_batuta():
    if not session.get("usuario_id"):
        return jsonify({"error": "No autenticado"}), 401

    return jsonify({"batuta_usuario_id": obtener_batuta_usuario_id()})


@app.route("/batuta/tomar", methods=["POST"])
def tomar_batuta():
    usuario_id = session.get("usuario_id")

    if not usuario_id:
        return redirect(url_for("login"))

    batuta_actual = obtener_batuta_usuario_id()

    # 🔥 El super admin puede recuperarla siempre, sin importar quién la tenga
    if es_super_admin():
        guardar_batuta_usuario_id(usuario_id)
        return redirect(url_for("panel"))

    # Admin normal puede tomarla solo si no la tiene el super admin
    if es_admin():
        if batuta_actual and usuario_objetivo_es_super_admin(batuta_actual):
            return redirect(url_for("panel"))

        guardar_batuta_usuario_id(usuario_id)
        return redirect(url_for("panel"))

    # Usuario elegible normal: solo si está libre
    if batuta_actual is None and usuario_es_elegible_para_batuta():
        guardar_batuta_usuario_id(usuario_id)
        return redirect(url_for("panel"))

    return redirect(url_for("panel"))


@app.route("/batuta/soltar", methods=["POST"])
def soltar_batuta():
    if not session.get("usuario_id"):
        return redirect(url_for("login"))

    usuario_id = session.get("usuario_id")

    if not tiene_batuta():
        return redirect(url_for("panel"))

    # 🔥 Si quien tiene la batuta es super admin, no se le fuerza a nadie más
    if usuario_objetivo_es_super_admin(usuario_id):
        guardar_batuta_usuario_id(usuario_id)
        return redirect(url_for("panel"))

    # Si no es super admin, buscar primero un super admin activo
    docs_super = (
        db.collection("usuarios")
        .where("super_admin", "==", True)
        .where("activo", "==", True)
        .limit(1)
        .stream()
    )

    super_admin_id = None
    for doc in docs_super:
        data = doc.to_dict() or {}
        super_admin_id = data.get("id")
        break

    if super_admin_id is not None:
        guardar_batuta_usuario_id(super_admin_id)
        return redirect(url_for("panel"))

    # Si no hay super admin, vuelve a cualquier admin activo
    docs_admin = (
        db.collection("usuarios")
        .where("es_admin", "==", True)
        .where("activo", "==", True)
        .limit(1)
        .stream()
    )

    admin_id = None
    for doc in docs_admin:
        data = doc.to_dict() or {}
        admin_id = data.get("id")
        break

    if admin_id is not None:
        guardar_batuta_usuario_id(admin_id)

    return redirect(url_for("panel"))


@app.route("/batuta/transferir", methods=["POST"])
def transferir_batuta():
    if not session.get("usuario_id"):
        return redirect(url_for("login"))

    usuario_actual = session.get("usuario_id")
    admin_actual = es_admin()
    super_admin_actual = es_super_admin()

    usuario_id_str = request.form.get("usuario_id")

    if not usuario_id_str or not usuario_id_str.isdigit():
        return redirect(url_for("panel"))

    nuevo_usuario_id = int(usuario_id_str)
    batuta_actual = obtener_batuta_usuario_id()

    # Solo admin o quien tiene la batuta puede transferir
    if not admin_actual and batuta_actual != usuario_actual:
        return redirect(url_for("panel"))

    # Buscar usuario destino
    usuario_destino = obtener_usuario_por_id(nuevo_usuario_id)
    if not usuario_destino:
        return redirect(url_for("panel"))

    if not usuario_destino.get("activo", False):
        return redirect(url_for("panel"))

    # Solo elegibles (admin o puede_gestionar)
    if not (
        usuario_destino.get("es_admin", False)
        or usuario_destino.get("puede_gestionar", False)
    ):
        return redirect(url_for("panel"))

    if usuario_destino.get("id") != nuevo_usuario_id:
        return redirect(url_for("panel"))

    # 🔥 Si la batuta la tiene el super admin, nadie salvo el mismo super admin puede moverla
    if batuta_actual and usuario_objetivo_es_super_admin(batuta_actual):
        if not super_admin_actual:
            return redirect(url_for("panel"))

    # 🔥 Nadie puede quitarle la batuta al super admin, salvo él mismo
    if usuario_objetivo_es_super_admin(batuta_actual) and not super_admin_actual:
        return redirect(url_for("panel"))

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

    return render_template(
        "index.html",
        usuario_nombre=session.get("usuario_nombre"),
        es_admin=es_admin(),
        puede_gestionar=usuario_puede_gestionar(),
        puede_crear_trabajos=usuario_puede_crear_trabajos(),
        usuario_id=usuario_id,
        tiene_batuta=tiene_batuta(),
        batuta_usuario_id=batuta_usuario_id,
        batuta_nombre=batuta_nombre,
        usuarios=usuarios,
        firebase_config=firebase_settings["web_config"],
        app_env=APP_ENV,
        version_app=os.environ.get("APP_VERSION", "unknown"),
    )


@app.route("/reportes")
def reportes():
    if not session.get("usuario_id"):
        return redirect(url_for("login"))

    if not es_admin():
        return redirect(url_for("panel"))

    return render_template("reportes.html")


@app.route("/usuarios")
def usuarios_page():
    if not session.get("usuario_id"):
        return redirect(url_for("login"))

    if not es_admin():
        return redirect(url_for("panel"))

    docs = db.collection("usuarios").order_by("id").stream()

    usuarios = []
    for doc in docs:
        data = doc.to_dict() or {}
        usuarios.append(data)

    return render_template(
        "usuarios.html",
        usuarios=usuarios,
        ok=(request.args.get("ok") or "").strip(),
    )


@app.route("/mi-perfil")
def mi_perfil():
    if not session.get("usuario_id"):
        return redirect(url_for("login"))

    usuario_id = session.get("usuario_id")

    docs = db.collection("usuarios").where("id", "==", usuario_id).limit(1).stream()

    usuario = None
    for doc in docs:
        usuario = doc.to_dict() or {}
        break

    if not usuario:
        return redirect(url_for("panel"))

    return render_template("mi_perfil.html", usuario=usuario)


@app.route("/mi-perfil/actualizar", methods=["POST"])
def actualizar_mi_perfil():
    if not session.get("usuario_id"):
        return redirect(url_for("login"))

    usuario_id = session.get("usuario_id")
    nombre = (request.form.get("nombre") or "").strip()
    clave_actual = (request.form.get("clave_actual") or "").strip()
    clave_nueva = (request.form.get("clave_nueva") or "").strip()
    clave_confirmacion = (request.form.get("clave_confirmacion") or "").strip()

    if not nombre:
        return redirect(url_for("mi_perfil", error="El nombre es obligatorio"))

    docs = db.collection("usuarios").where("id", "==", usuario_id).limit(1).stream()

    usuario_doc = None
    usuario_data = None

    for doc in docs:
        usuario_doc = doc
        usuario_data = doc.to_dict() or {}
        break

    if not usuario_doc:
        return redirect(url_for("panel"))

    update_data = {
        "nombre": nombre,
    }

    quiere_cambiar_clave = clave_actual or clave_nueva or clave_confirmacion

    if quiere_cambiar_clave:
        if not clave_actual or not clave_nueva or not clave_confirmacion:
            return redirect(
                url_for(
                    "mi_perfil",
                    error="Debes completar clave actual, nueva clave y confirmación",
                )
            )

        clave_guardada = usuario_data.get("clave", "")

        if not check_password_hash(clave_guardada, clave_actual):
            return redirect(url_for("mi_perfil", error="La clave actual es incorrecta"))

        if clave_nueva != clave_confirmacion:
            return redirect(
                url_for(
                    "mi_perfil", error="La nueva clave y su confirmación no coinciden"
                )
            )

        update_data["clave"] = generate_password_hash(clave_nueva)

    usuario_doc.reference.update(update_data)

    session["usuario_nombre"] = nombre

    return redirect(url_for("mi_perfil", ok=1))


@app.route("/usuarios/<int:usuario_id>/editar")
def editar_usuario(usuario_id):
    if not session.get("usuario_id"):
        return redirect(url_for("login"))

    if not es_admin():
        return redirect(url_for("panel"))

    docs = db.collection("usuarios").where("id", "==", usuario_id).limit(1).stream()

    usuario = None
    for doc in docs:
        usuario = doc.to_dict() or {}
        break

    if not usuario:
        return redirect(url_for("usuarios_page"))

    return render_template("editar_usuario.html", usuario=usuario)


@app.route("/usuarios/<int:usuario_id>/actualizar", methods=["POST"])
def actualizar_usuario_admin(usuario_id):
    if not session.get("usuario_id"):
        return redirect(url_for("login"))

    if not es_admin():
        return redirect(url_for("panel"))

    nombre = (request.form.get("nombre") or "").strip()
    clave = (request.form.get("clave") or "").strip()

    if not nombre:
        return redirect(url_for("editar_usuario", usuario_id=usuario_id))

    docs = db.collection("usuarios").where("id", "==", usuario_id).limit(1).stream()

    usuario_doc = None
    usuario_data = None

    for doc in docs:
        usuario_doc = doc
        usuario_data = doc.to_dict() or {}
        break

    if not usuario_doc:
        return redirect(url_for("usuarios_page", ok="actualizado"))

    # 🔥 Nadie puede modificar al super admin, salvo el mismo super admin
    if usuario_data.get("super_admin", False) and not es_super_admin():
        return redirect(url_for("usuarios_page"))

    nuevo_es_admin = "es_admin" in request.form
    nuevo_puede_gestionar = "puede_gestionar" in request.form
    nuevo_puede_crear_trabajos = "puede_crear_trabajos" in request.form
    nuevo_activo = "activo" in request.form

    if nuevo_es_admin:
        nuevo_puede_gestionar = True
        nuevo_puede_crear_trabajos = True

    # 🔥 Si el usuario objetivo es super admin, queda blindado
    if usuario_data.get("super_admin", False):
        nuevo_es_admin = True
        nuevo_puede_gestionar = True
        nuevo_puede_crear_trabajos = True
        nuevo_activo = True

    # 🔐 Evitar que cualquier usuario se quite permisos a sí mismo
    if usuario_id == session.get("usuario_id"):
        nuevo_es_admin = True if es_admin() else nuevo_es_admin
        nuevo_puede_gestionar = True if es_admin() else nuevo_puede_gestionar
        nuevo_puede_crear_trabajos = True if es_admin() else nuevo_puede_crear_trabajos
        nuevo_activo = True

    update_data = {
        "nombre": nombre,
        "es_admin": nuevo_es_admin,
        "puede_gestionar": nuevo_puede_gestionar,
        "puede_crear_trabajos": nuevo_puede_crear_trabajos,
        "activo": nuevo_activo,
    }

    if clave:
        # 🔥 Solo el propio super admin puede cambiar su clave desde aquí
        if usuario_data.get("super_admin", False) and not es_super_admin():
            return redirect(url_for("usuarios_page"))
        update_data["clave"] = generate_password_hash(clave)

    usuario_doc.reference.update(update_data)
    batuta_actual = obtener_batuta_usuario_id()

    # Si el usuario editado tenía la batuta y deja de ser elegible, devolverla
    if batuta_actual == usuario_id and (
        not update_data["activo"]
        or (not update_data["es_admin"] and not update_data["puede_gestionar"])
    ):
        docs_super = (
            db.collection("usuarios")
            .where("super_admin", "==", True)
            .where("activo", "==", True)
            .limit(1)
            .stream()
        )

        super_admin_id = None
        for doc_super in docs_super:
            data_super = doc_super.to_dict() or {}
            super_admin_id = data_super.get("id")
            break

        if super_admin_id is not None:
            guardar_batuta_usuario_id(super_admin_id)
        else:
            docs_admin = (
                db.collection("usuarios")
                .where("es_admin", "==", True)
                .where("activo", "==", True)
                .limit(1)
                .stream()
            )

            admin_id = None
            for doc_admin in docs_admin:
                admin_data = doc_admin.to_dict() or {}
                admin_id = admin_data.get("id")
                break

            if admin_id is not None:
                guardar_batuta_usuario_id(admin_id)

    if usuario_id == session.get("usuario_id"):
        session["usuario_nombre"] = update_data["nombre"]
        session["es_admin"] = update_data["es_admin"]
        session["puede_gestionar"] = update_data["puede_gestionar"]
        session["puede_crear_trabajos"] = update_data["puede_crear_trabajos"]

    return redirect(url_for("usuarios_page", ok="actualizado"))


@app.route("/usuarios/nuevo", methods=["GET", "POST"])
def crear_usuario():
    if not session.get("usuario_id"):
        return redirect(url_for("login"))

    if not es_admin():
        return redirect(url_for("panel"))

    if request.method == "GET":
        return render_template("nuevo_usuario.html")

    usuario = (request.form.get("usuario") or "").strip().lower()
    nombre = (request.form.get("nombre") or "").strip()
    clave = (request.form.get("clave") or "").strip()

    if not usuario or not nombre or not clave:
        return render_template(
            "nuevo_usuario.html",
            error="Debes completar usuario, nombre y clave",
        )

    docs = db.collection("usuarios").where("usuario", "==", usuario).limit(1).stream()

    usuario_existente = None
    for doc in docs:
        usuario_existente = doc
        break

    if usuario_existente:
        return render_template(
            "nuevo_usuario.html",
            error="Ese usuario ya existe",
        )

    docs_ids = (
        db.collection("usuarios")
        .order_by("id", direction=firestore.Query.DESCENDING)
        .limit(1)
        .stream()
    )

    ultimo_id = 0
    for doc in docs_ids:
        data = doc.to_dict() or {}
        ultimo_id = data.get("id", 0)
        break

    nuevo_id = ultimo_id + 1
    nuevo_es_admin = "es_admin" in request.form
    nuevo_puede_gestionar = "puede_gestionar" in request.form
    nuevo_puede_crear_trabajos = "puede_crear_trabajos" in request.form
    nuevo_activo = "activo" in request.form

    if nuevo_es_admin:
        nuevo_puede_gestionar = True
        nuevo_puede_crear_trabajos = True

    nuevo_usuario = {
        "id": nuevo_id,
        "usuario": usuario,
        "nombre": nombre,
        "clave": generate_password_hash(clave),
        "es_admin": nuevo_es_admin,
        "super_admin": False,
        "puede_gestionar": nuevo_puede_gestionar,
        "puede_crear_trabajos": nuevo_puede_crear_trabajos,
        "activo": nuevo_activo,
    }

    db.collection("usuarios").document(str(nuevo_id)).set(nuevo_usuario)

    return redirect(url_for("usuarios_page"))


@app.route("/usuarios/<int:usuario_id>/resetear-clave", methods=["POST"])
def resetear_clave_usuario(usuario_id):
    if not session.get("usuario_id"):
        return redirect(url_for("login"))

    if not es_admin():
        return redirect(url_for("panel"))

    # 🔐 Evitar que un admin se resetee su propia clave desde aquí
    if usuario_id == session.get("usuario_id"):
        return redirect(url_for("usuarios_page"))

    docs = db.collection("usuarios").where("id", "==", usuario_id).limit(1).stream()

    usuario_doc = None
    usuario_data = None

    for doc in docs:
        usuario_doc = doc
        usuario_data = doc.to_dict() or {}
        break

    if not usuario_doc:
        return redirect(url_for("usuarios_page"))

    # 🔥 Nadie puede resetear la clave del super admin, salvo él mismo desde su perfil
    if usuario_data.get("super_admin", False):
        return redirect(url_for("usuarios_page"))

    nueva_clave = generate_password_hash("1234")
    usuario_doc.reference.update({"clave": nueva_clave})

    return redirect(url_for("usuarios_page", ok="clave_reseteada"))


@app.route("/tecnicos")
def tecnicos_page():
    if not session.get("usuario_id"):
        return redirect(url_for("login"))

    docs = db.collection("tecnicos").order_by("id").stream()
    tecnicos = []

    for doc in docs:
        data = doc.to_dict() or {}
        tecnicos.append(data)

    return render_template(
        "tecnicos.html", tecnicos=tecnicos, ok=request.args.get("ok")
    )


@app.route("/tecnicos/nuevo", methods=["GET", "POST"])
def nuevo_tecnico():
    if not session.get("usuario_id"):
        return redirect(url_for("login"))

    if not es_admin():
        return redirect(url_for("panel"))

    if request.method == "POST":
        nombre = (request.form.get("nombre") or "").strip()
        tipo = (request.form.get("tipo") or "").strip().lower()

        if not nombre:
            return render_template(
                "nuevo_tecnico.html",
                error="Debes ingresar el nombre.",
            )

        if tipo not in ["normal", "eventual"]:
            return render_template(
                "nuevo_tecnico.html",
                error="Debes seleccionar un tipo válido.",
            )

        docs = (
            db.collection("tecnicos")
            .order_by("id", direction=firestore.Query.DESCENDING)
            .limit(1)
            .stream()
        )

        ultimo_id = 0
        for doc in docs:
            data = doc.to_dict() or {}
            ultimo_id = data.get("id", 0)
            break

        nuevo_id = ultimo_id + 1

        nuevo_tecnico_data = {
            "id": nuevo_id,
            "nombre": nombre,
            "tipo": tipo,
            "habilitado": True,
            "activo": True,
            "estado": "libre",
            "trabajo_id": None,
            "almuerzo_desde": None,
            "almuerzo_hasta": None,
            "almuerzo_fecha": None,
            "almuerzo_registrado": False,
            "dia_libre": False,
        }

        db.collection("tecnicos").document(str(nuevo_id)).set(nuevo_tecnico_data)

        return redirect(url_for("tecnicos_page", ok="creado"))

    return render_template("nuevo_tecnico.html")


@app.route("/tecnicos/<int:tecnico_id>/editar")
def editar_tecnico(tecnico_id):
    if not session.get("usuario_id"):
        return redirect(url_for("login"))

    docs = db.collection("tecnicos").where("id", "==", tecnico_id).limit(1).stream()

    tecnico = None
    for doc in docs:
        tecnico = doc.to_dict()
        break

    if not tecnico:
        return redirect(url_for("tecnicos_page"))

    return render_template("editar_tecnico.html", tecnico=tecnico)


@app.route("/tecnicos/<int:tecnico_id>/actualizar", methods=["POST"])
def actualizar_tecnico(tecnico_id):
    if not session.get("usuario_id"):
        return redirect(url_for("login"))

    if not es_admin():
        return redirect(url_for("panel"))

    nombre = (request.form.get("nombre") or "").strip()
    tipo = (request.form.get("tipo") or "").strip().lower()

    if not nombre:
        return redirect(url_for("editar_tecnico", tecnico_id=tecnico_id))

    if tipo not in ["normal", "eventual"]:
        return redirect(url_for("editar_tecnico", tecnico_id=tecnico_id))

    docs = db.collection("tecnicos").where("id", "==", tecnico_id).limit(1).stream()

    tecnico_doc = None
    tecnico_data = None

    for doc in docs:
        tecnico_doc = doc
        tecnico_data = doc.to_dict() or {}
        break

    if not tecnico_doc:
        return redirect(url_for("tecnicos_page"))

    estado_actual = (tecnico_data.get("estado") or "").strip().lower()
    trabajo_id_actual = tecnico_data.get("trabajo_id")
    habilitado_actual = tecnico_data.get("habilitado", True)

    tecnico_en_operacion = (
        estado_actual in ["trabajando", "almuerzo"] or trabajo_id_actual is not None
    )

    if tecnico_en_operacion:
        habilitado = habilitado_actual
    else:
        habilitado = "habilitado" in request.form

    update_data = {
        "nombre": nombre,
        "tipo": tipo,
        "habilitado": habilitado,
    }

    tecnico_doc.reference.update(update_data)

    return redirect(url_for("tecnicos_page", ok="actualizado"))


@app.route("/vendedores")
def vendedores_page():
    if not session.get("usuario_id"):
        return redirect(url_for("login"))

    docs = db.collection("vendedores").order_by("id").stream()
    vendedores = []

    for doc in docs:
        data = doc.to_dict() or {}
        vendedores.append(data)

    return render_template(
        "vendedores.html", vendedores=vendedores, ok=request.args.get("ok")
    )


@app.route("/vendedores/nuevo", methods=["GET", "POST"])
def nuevo_vendedor():
    if not session.get("usuario_id"):
        return redirect(url_for("login"))

    if not es_admin():
        return redirect(url_for("panel"))

    if request.method == "POST":
        nombre = (request.form.get("nombre") or "").strip()

        if not nombre:
            return render_template(
                "nuevo_vendedor.html",
                error="Debes ingresar el nombre.",
            )

        docs = (
            db.collection("vendedores")
            .order_by("id", direction=firestore.Query.DESCENDING)
            .limit(1)
            .stream()
        )

        ultimo_id = 0
        for doc in docs:
            data = doc.to_dict() or {}
            ultimo_id = data.get("id", 0)
            break

        nuevo_id = ultimo_id + 1

        db.collection("vendedores").add(
            {"id": nuevo_id, "nombre": nombre, "activo": True}
        )

        return redirect(url_for("vendedores_page", ok="creado"))

    return render_template("nuevo_vendedor.html")


@app.route("/vendedores/<int:vendedor_id>/editar")
def editar_vendedor(vendedor_id):
    if not session.get("usuario_id"):
        return redirect(url_for("login"))

    docs = db.collection("vendedores").where("id", "==", vendedor_id).limit(1).stream()

    vendedor = None
    for doc in docs:
        vendedor = doc.to_dict()
        break

    if not vendedor:
        return redirect(url_for("vendedores_page"))

    return render_template("editar_vendedor.html", vendedor=vendedor)


@app.route("/vendedores/<int:vendedor_id>/actualizar", methods=["POST"])
def actualizar_vendedor(vendedor_id):
    if not session.get("usuario_id"):
        return redirect(url_for("login"))

    if not es_admin():
        return redirect(url_for("panel"))

    nombre = (request.form.get("nombre") or "").strip()
    activo = "activo" in request.form

    if not nombre:
        return redirect(url_for("editar_vendedor", vendedor_id=vendedor_id))

    docs = db.collection("vendedores").where("id", "==", vendedor_id).limit(1).stream()

    vendedor_doc = None

    for doc in docs:
        vendedor_doc = doc
        break

    if not vendedor_doc:
        return redirect(url_for("vendedores_page"))

    vendedor_doc.reference.update({"nombre": nombre, "activo": activo})

    return redirect(url_for("vendedores_page", ok="actualizado"))


@app.route("/api/resumen")
def api_resumen():
    if not session.get("usuario_id"):
        return jsonify({"error": "No autenticado"}), 401

    fecha = (request.args.get("fecha") or "").strip()

    if fecha:
        inicio_dia = datetime.strptime(fecha, "%Y-%m-%d")
    else:
        inicio_dia = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    fin_dia = inicio_dia + timedelta(days=1)

    def estado_visual_trabajo_backend(trabajo):
        actividades = trabajo.get("actividades") or []

        if not actividades:
            return (trabajo.get("estado") or "pendiente").strip().lower()

        estados = [(a.get("estado") or "").strip().lower() for a in actividades]

        if any(e == "en_proceso" for e in estados):
            return "en_proceso"

        if any(e == "pendiente" for e in estados):
            return "pendiente"

        if any(e == "pausado" for e in estados):
            return "pausado"

        if estados and all(e in ["finalizado", "no_realizada"] for e in estados):
            return "finalizado"

        return (trabajo.get("estado") or "pendiente").strip().lower()

    def fecha_finalizacion_trabajo(trabajo):
        candidatos = []

        if trabajo.get("finalizado_at"):
            candidatos.append(trabajo.get("finalizado_at"))

        for act in trabajo.get("actividades") or []:
            if act.get("finalizado_at"):
                candidatos.append(act.get("finalizado_at"))

        fechas_validas = []
        for valor in candidatos:
            try:
                fecha_parseada = datetime.fromisoformat(valor.replace("Z", "+00:00"))
                if fecha_parseada.tzinfo is not None:
                    fecha_parseada = fecha_parseada.replace(tzinfo=None)
                fechas_validas.append(fecha_parseada)
            except Exception:
                pass

        if not fechas_validas:
            return None

        return max(fechas_validas)

    campos_trabajo = [
        "id",
        "origen",
        "responsable_nombre",
        "vendedor_nombre",
        "solicitante_nombre",
        "descripcion",
        "estado",
        "actividades",
        "created_at",
        "updated_at",
        "inicio_proceso_at",
        "espera_desde",
        "finalizado_at",
    ]

    trabajos_docs = db.collection("trabajos").select(campos_trabajo).stream()
    trabajos_filtrados = []

    for doc in trabajos_docs:
        trabajo = doc.to_dict() or {}
        estado_visual = estado_visual_trabajo_backend(trabajo)

        if estado_visual in ["pendiente", "en_proceso", "pausado"]:
            trabajos_filtrados.append(trabajo)
            continue

        if estado_visual == "finalizado":
            fecha_fin = fecha_finalizacion_trabajo(trabajo)
            if fecha_fin and inicio_dia <= fecha_fin < fin_dia:
                trabajos_filtrados.append(trabajo)

    trabajos = sorted(
        trabajos_filtrados,
        key=lambda t: int(t.get("id") or 0),
    )

    tecnicos_docs = db.collection("tecnicos").select(["id", "nombre"]).stream()
    tecnicos = sorted(
        [doc.to_dict() for doc in tecnicos_docs],
        key=lambda t: int(t.get("id") or 0),
    )

    return jsonify(
        {
            "trabajos": trabajos,
            "tecnicos": tecnicos,
            "fecha": inicio_dia.strftime("%Y-%m-%d"),
        }
    )


@app.route("/api/trabajo/<int:trabajo_id>")
def api_trabajo_por_id(trabajo_id):
    if not session.get("usuario_id"):
        return jsonify({"error": "No autenticado"}), 401

    trabajo_ref = db.collection("trabajos").document(str(trabajo_id))
    trabajo_doc = trabajo_ref.get()

    if not trabajo_doc.exists:
        return jsonify({"error": "Trabajo no encontrado"}), 404

    trabajo = trabajo_doc.to_dict() or {}

    return jsonify({"trabajo": trabajo})


@app.route("/trabajos/<int:trabajo_id>/editar", methods=["POST"])
def editar_trabajo(trabajo_id):
    if not session.get("usuario_id"):
        return jsonify({"error": "No autenticado"}), 401

    if not usuario_puede_gestionar():
        return jsonify({"error": "No tienes permisos para gestionar trabajos"}), 403
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
    app.run(host="0.0.0.0", port=5000, debug=True)
