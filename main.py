import os
from contextlib import asynccontextmanager
import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Importamos la función determinista y los esquemas Pydantic desde nuestros módulos locales
from preprocesamiento import preparar_datos_crudos
from schemas import ClienteInput, PrediccionOutput

# Variables globales para almacenar los artefactos en memoria RAM
artefactos = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gestiona el ciclo de vida de la aplicación:
    Carga el preprocesador y el modelo una sola vez al arrancar el servidor desde 'artifacts/'.
    """
    ruta_prep = os.path.join("artifacts", "preprocesador_banca.joblib")
    ruta_modelo = os.path.join("artifacts", "modelo_knn.joblib")

    if not os.path.exists(ruta_prep) or not os.path.exists(ruta_modelo):
        raise RuntimeError("❌ Error crítico: No se encuentran los archivos .joblib en 'artifacts/'.")

    print("--> Cargando artefactos en memoria RAM...")
    artefactos['preprocesador'] = joblib.load(ruta_prep)
    artefactos['modelo'] = joblib.load(ruta_modelo)
    print("✅ Artefactos listos para servir inferencias.")

    yield
    # Limpieza al apagar el servidor
    artefactos.clear()


# Inicializamos la aplicación FastAPI con el gestor de ciclo de vida
app = FastAPI(
    title="API de Predicción de Abandono de Clientes",
    description="Microservicio para evaluar el riesgo de fuga de clientes integrando ColumnTransformer y KNeighborsClassifier.",
    version="1.0.0",
    lifespan=lifespan
)

# Configuración de CORS para admitir peticiones desde cualquier origen
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montaje de la carpeta de recursos estáticos (CSS, JS)
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")


# Endpoint para servir la interfaz web del gestor bancario
@app.get("/", tags=["Frontend"])
def servir_frontend():
    """
    Sirve el formulario web interactivo desde la carpeta templates/.
    """
    ruta_html = os.path.join("templates", "index.html")
    if os.path.exists(ruta_html):
        return FileResponse(ruta_html)
    return {"mensaje": "API de Banca activa. Visita /docs para la documentación interactiva de Swagger."}


# ============================================================================
# Endpoint de inferencia: El corazón del despliegue
# ============================================================================

@app.post("/predict", response_model=PrediccionOutput, tags=["Inferencia"])
def predecir_abandono(cliente: ClienteInput):
    """
    Recibe los datos crudos de un cliente y ejecuta el pipeline completo de predicción:
    1. Conversión de JSON Pydantic a DataFrame de Pandas (1 fila).
    2. Limpieza previa determinista (preparar_datos_crudos).
    3. Preprocesamiento automatizado con ColumnTransformer (.transform).
    4. Inferencia con el modelo (.predict y .predict_proba).
    """
    try:
        # Paso 1: Convertimos la entrada a un diccionario y luego a DataFrame de 1 fila
        datos_dict = cliente.model_dump()
        df_crudo = pd.DataFrame([datos_dict])

        # Paso 2: Ejecutamos la función de limpieza previa y Feature Engineering
        df_saneado = preparar_datos_crudos(df_crudo)

        # Paso 3: Aplicamos el pipeline cargado (imputación + escalados + OHE)
        preprocesador = artefactos['preprocesador']
        X_inferencia = preprocesador.transform(df_saneado)

        # Paso 4: Predecimos con el clasificador
        modelo = artefactos['modelo']
        prediccion_clase = int(modelo.predict(X_inferencia)[0])
        probabilidades = modelo.predict_proba(X_inferencia)[0]
        prob_abandono = float(probabilidades[1])  # Probabilidad de clase 1 (abandono)

        # Paso 5: Regla de negocio para determinar el nivel de riesgo y la acción
        # Esto nos lo tendrían que decir desde el departamento de negocio
        if prob_abandono >= 0.70:
            riesgo = "Alto"
            accion = "Contacto telefónico prioritario por el gestor de cuentas y oferta de fidelización."
        elif prob_abandono >= 0.40:
            riesgo = "Medio"
            accion = "Envío de encuesta de satisfacción y campaña informativa sobre ventajas en comisiones."
        else:
            riesgo = "Bajo"
            accion = "Sin acción requerida. Cliente fidelizado."

        # Retornamos la respuesta según el esquema Pydantic PrediccionOutput
        return PrediccionOutput(
            id_cliente=cliente.id_cliente,
            abandono=prediccion_clase,
            probabilidad_abandono=round(prob_abandono, 4),
            nivel_riesgo=riesgo,
            accion_recomendada=accion
        )

    except Exception as e:
        # Captura cualquier fallo inesperado y devuelve un código HTTP 500 explicativo
        raise HTTPException(
            status_code=500,
            detail=f"Error durante el procesamiento de la inferencia: {str(e)}"
        )