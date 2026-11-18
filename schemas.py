from pydantic import BaseModel, Field
from typing import Literal
from typing import Literal
from pydantic import BaseModel, Field


class ClienteInput(BaseModel):
    id_cliente: str = Field(..., pattern=r"^CLI-\d{4}$")
    edad: int = Field( ge=18, le=120, description="Edad del cliente en años")
    ingresos_anuales: float = Field( gt=0, description="Ingresos anuales en euros")
    antiguedad_meses: int = Field( ge=0, description="Meses como cliente")
    saldo_cuenta: float = Field( ge=0, description="Saldo actual en euros")
    nivel_estudios: Literal["Primaria", "Secundaria", "Grado", "Master", "Doctorado"]
    tipo_cuenta: Literal["Corriente", "Ahorro", "Nomina", "Inversion"]
    nivel_satisfaccion: Literal["Muy Bajo", "Bajo", "Medio", "Alto", "Muy Alto"]
    num_productos: int = Field( ge=1, le=4)
    tiene_tarjeta: Literal[0, 1]
    canal_preferido: Literal["App Movil", "Web", "Oficina", "Telefono", "Cajero Antiguo"]

class PrediccionOutput(BaseModel):
    id_cliente:str
    abandono:int
    probabilidad_abandono:float
    nivel_riesgo:str
    accion_recomendada:str
