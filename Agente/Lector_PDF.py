import fitz  # PyMuPDF

def leer_pdf(ruta):
    """
    Lee un archivo PDF y devuelve su texto, paginación y metadatos.
    
    Args:
        ruta (str): Ruta al archivo PDF.
    
    Returns:
        dict: Información del PDF.
    """
    try:
        doc = fitz.open(ruta)
        texto = ""

        for pagina in doc:
            texto += pagina.get_text()

        return {
            "exito": True,
            "ruta": ruta,
            "paginas": len(doc),
            "texto": texto,
            "metadata": doc.metadata
        }

    except Exception as e:
        return {
            "exito": False,
            "error": str(e)
        }


def mostrar_info(info):
    """
    Muestra en pantalla la información del PDF cargado.
    """
    print("\n=== PDF CARGADO ===")
    print(f"Ruta: {info['ruta']}")
    print(f"Paginas: {info['paginas']}")
    print("Metadatos:")

    for k, v in info['metadata'].items():
        print(f"  {k}: {v}")

    print("====================\n")


def crear_analisis(info):
    """
    Construye un prompt para análisis automático del PDF.
    Limita el texto a 4000 caracteres para evitar sobrecarga.
    """
    texto_limitado = info['texto'][:4000]

    prompt = f"""
El siguiente texto proviene de un artículo académico en PDF.

METADATOS:
{info['metadata']}

CONTENIDO (primeras 4000 letras):
{texto_limitado}
    """

    return prompt
