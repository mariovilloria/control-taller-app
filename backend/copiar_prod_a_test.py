import os
import firebase_admin
from firebase_admin import credentials, firestore

FIREBASE_PROJECTS = {
    "test": {
        "credential_path": "backend/firebase-key-test.json",
    },
    "prod": {
        "credential_path": "backend/firebase-key.json",
    },
}

COLECCIONES_A_COPIAR = [
    "usuarios",
    "vendedores",
    "tecnicos",
    "trabajos",
    "config",
]


def crear_cliente_admin(nombre_app: str, credential_path: str):
    if nombre_app in firebase_admin._apps:
        return firestore.client(firebase_admin.get_app(nombre_app))

    if not os.path.exists(credential_path):
        raise FileNotFoundError(
            f"No se encontró el archivo de credenciales: {credential_path}"
        )

    cred = credentials.Certificate(credential_path)
    app = firebase_admin.initialize_app(cred, name=nombre_app)
    return firestore.client(app)


def limpiar_coleccion(destino_db, nombre_coleccion: str):
    docs = list(destino_db.collection(nombre_coleccion).stream())
    if not docs:
        return

    batch = destino_db.batch()
    contador = 0

    for doc in docs:
        batch.delete(doc.reference)
        contador += 1

        if contador == 400:
            batch.commit()
            batch = destino_db.batch()
            contador = 0

    if contador > 0:
        batch.commit()


def copiar_coleccion(origen_db, destino_db, nombre_coleccion: str):
    docs = list(origen_db.collection(nombre_coleccion).stream())

    if not docs:
        return 0

    batch = destino_db.batch()
    contador = 0
    total = 0

    for doc in docs:
        data = doc.to_dict() or {}
        ref_destino = destino_db.collection(nombre_coleccion).document(doc.id)
        batch.set(ref_destino, data)
        contador += 1
        total += 1

        if contador == 400:
            batch.commit()
            batch = destino_db.batch()
            contador = 0

    if contador > 0:
        batch.commit()

    return total


def main():
    prod_db = crear_cliente_admin(
        "app_prod_copia",
        FIREBASE_PROJECTS["prod"]["credential_path"],
    )
    test_db = crear_cliente_admin(
        "app_test_copia",
        FIREBASE_PROJECTS["test"]["credential_path"],
    )

    for coleccion in COLECCIONES_A_COPIAR:
        limpiar_coleccion(test_db, coleccion)
        total = copiar_coleccion(prod_db, test_db, coleccion)
        print(f"{coleccion}: {total} documentos copiados")


if __name__ == "__main__":
    main()
