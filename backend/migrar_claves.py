from firebase_admin import credentials, firestore, initialize_app
from werkzeug.security import generate_password_hash

# 🔹 Ajusta esto según tu archivo de credenciales
cred = credentials.Certificate("firebase-key-test.json")
initialize_app(cred)

db = firestore.client()

usuarios_ref = db.collection("usuarios")
docs = usuarios_ref.stream()

total = 0
actualizados = 0

for doc in docs:
    data = doc.to_dict() or {}
    clave_actual = data.get("clave")

    if not clave_actual:
        continue

    # 🔴 Si ya parece hash, lo saltamos
    if str(clave_actual).startswith("pbkdf2:"):
        continue

    nueva_clave = generate_password_hash(clave_actual)

    doc.reference.update({"clave": nueva_clave})

    actualizados += 1
    print(f"✔ Usuario {data.get('usuario')} actualizado")

    total += 1

print("\n--- RESULTADO ---")
print(f"Procesados: {total}")
print(f"Actualizados: {actualizados}")
