import os
import firebase_admin
from firebase_admin import credentials, firestore

if not firebase_admin._apps:
    if os.path.exists("firebase-key.json"):
        cred = credentials.Certificate("firebase-key.json")
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app()

db = firestore.client()

usuarios = [
     {
        "id": 1,
        "usuario": "mario",
        "clave": "1234",
        "nombre": "Mario",
        "es_admin": True,
        "puede_gestionar": True,
        "activo": True,
    },
     {
        "id": 2,
        "usuario": "camila",
        "clave": "1234",
        "nombre": "Camila",
        "es_admin": False,
        "puede_gestionar": True,
        "activo": True,
    },
    {
        "id": 3,
        "usuario": "vanesa",
        "clave": "1234",
        "nombre": "Vanesa",
        "es_admin": False,
        "puede_gestionar": True,
        "activo": True,
    },
    {
        "id": 4,
        "usuario": "darling",
        "clave": "1234",
        "nombre": "Darling",
        "es_admin": False,
        "puede_gestionar": False,
        "activo": True,
    },
    {
        "id": 5,
        "usuario": "yesica",
        "clave": "1234",
        "nombre": "Yesica",
        "es_admin": False,
        "puede_gestionar": True,
        "activo": True,
    },
    {
        "id": 6,
        "usuario": "carlos",
        "clave": "1234",
        "nombre": "Carlos",
                "es_admin": False,
        "puede_gestionar": False,
        "activo": True,
    },
        {
        "id":7,
        "usuario": "genesis",
        "clave": "1234",
        "nombre": "Genesis",
        "es_admin": False,
        "puede_gestionar": True,
        "activo": True,
    }
]

for u in usuarios:
    db.collection("usuarios").document(str(u["id"])).set(u)
    print(f'Usuario creado: {u["nombre"]}')

print("Todos los usuarios fueron creados correctamente.")