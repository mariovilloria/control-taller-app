import firebase_admin
from firebase_admin import credentials, firestore

# 🔴 CONFIGURA ESTO
cred_prod = credentials.Certificate("backend/firebase-key.json")
cred_test = credentials.Certificate("backend/firebase-key-test.json")

app_prod = firebase_admin.initialize_app(cred_prod, name="prod")
app_test = firebase_admin.initialize_app(cred_test, name="test")

db_prod = firestore.client(app_prod)
db_test = firestore.client(app_test)

COLECCION = "trabajos"


def borrar_coleccion_test():
    print("🧹 Borrando colección en TEST...")

    docs = db_test.collection(COLECCION).stream()
    batch = db_test.batch()
    count = 0

    for doc in docs:
        batch.delete(doc.reference)
        count += 1

        if count % 400 == 0:
            batch.commit()
            batch = db_test.batch()

    batch.commit()
    print("✅ Colección TEST borrada")


def copiar_coleccion():
    print("📥 Copiando datos de PROD → TEST...")

    docs = db_prod.collection(COLECCION).stream()
    batch = db_test.batch()
    count = 0

    for doc in docs:
        data = doc.to_dict()
        ref = db_test.collection(COLECCION).document(doc.id)

        batch.set(ref, data)
        count += 1

        if count % 400 == 0:
            batch.commit()
            batch = db_test.batch()
            print(f"➡️ Copiados {count} documentos...")

    batch.commit()
    print(f"✅ Copia completa: {count} documentos")


if __name__ == "__main__":
    borrar_coleccion_test()
    copiar_coleccion()
