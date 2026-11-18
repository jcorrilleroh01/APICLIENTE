import pandas as pd
import numpy as np
def _descartar_columnas_no_utilizables(df):
  columnas_descarte = ['id_cliente', 'salario_mensual_aprox', 'comentarios_cliente', 'motivo_cancelacion']
  df = df.drop(columns=columnas_descarte, errors='ignore')
  return df

def _sanitizar_centinelas_numericos(df):
  if 'edad' in df.columns:
    df.loc[(df['edad'] <= 0) | (df['edad'] > 120), 'edad'] = np.nan
  if 'ingresos_anuales' in df.columns:
    df.loc[df['ingresos_anuales'] <= 0, 'ingresos_anuales'] = np.nan
  if 'saldo_cuenta' in df.columns:
   df['saldo_cuenta'] = df['saldo_cuenta'].replace(-999, np.nan)
   return df

def _sanitizar_categoricos(df):
  if 'tipo_cuenta' in df.columns:
    df['tipo_cuenta'] = df['tipo_cuenta'].astype(str).str.strip().str.capitalize()
    df['tipo_cuenta'] = df['tipo_cuenta'].replace({'Desconocido': np.nan, '?': np.nan, 'Nan': np.nan})

  if 'canal_preferido' in df.columns:
    df['canal_preferido'] = df['canal_preferido'].astype(str).str.strip()
    df['canal_preferido'] = df['canal_preferido'].replace({'???': np.nan, 'Nan': np.nan})

  if 'nivel_estudios' in df.columns:
    df['nivel_estudios'] = df['nivel_estudios'].astype(str).str.strip().replace({'Nan': np.nan, 'nan': np.nan})
  return df

def _feature_engineering(df):
   if 'saldo_cuenta' in df.columns and 'ingresos_anuales' in df.columns:
    df['ratio_saldo_ingresos'] = df['saldo_cuenta'] / (df['ingresos_anuales'] + 1)

   if 'saldo_cuenta' in df.columns and 'num_productos' in df.columns:
    df['saldo_por_producto'] = df['saldo_cuenta'] / df['num_productos']

   if 'edad' in df.columns:
    limites_edad = [0, 30, 55, 120]
    etiquetas_edad = ['Joven', 'Adulto', 'Senior']
    df['grupo_edad'] = pd.cut(df['edad'], bins=limites_edad, labels=etiquetas_edad).astype(str)

   if 'antiguedad_meses' in df.columns:
    df['antiguedad_anios'] = df['antiguedad_meses'] / 12.0
    df = df.drop(columns=['antiguedad_meses'])
    return df



def preparar_datos_crudos(df_entrada: pd.DataFrame) -> pd.DataFrame:
  """
  Aplica reglas de negocio deterministas sobre datos crudos:
  - Descarta columnas de identificador o data leakage.
  - Convierte valores centinelas en np.nan.
  - Limpia tipografía y espacios.
  - Genera las características de negocio (Feature Engineering).
  """
  df = df_entrada.copy()

  # A. Descarte de columnas no utilizables en inferencia (si existen en el DataFrame)
  df = _descartar_columnas_no_utilizables(df)

  # B. Sanitización de centinelas numéricos a NaN
  df = _sanitizar_centinelas_numericos(df)

  # C. Limpieza tipográfica y centinelas categóricos a NaN
  df = _sanitizar_categoricos(df)
  # D. Feature Engineering (Variables de negocio)
  df = _feature_engineering(df)
  return df