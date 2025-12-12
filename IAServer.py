from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import ollama
import fitz  # PyMuPDF
from Buscar_papers import buscar_papers, resumen_paper
from Generar_Citas import generar_cita_apa
from Lector_PDF import crear_analisis

app = FastAPI()

# Permitir que tu frontend (React) se conecte al server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

historial = []
ultimo_resultado = []
pdf_actual = None

instrucciones = """
Eres un asistente experto en investigación académica y científica.
Puedes: buscar papers, analizarlos, resumir PDFs, generar citas APA,
y explicar conceptos académicos de forma clara.
"""


# -----------------------------------------------------
#  CHAT NORMAL
# -----------------------------------------------------
@app.post("/chat")
def chat_endpoint(mensaje: str = Form(...)):
    mensajes = [{"role": "system", "content": instrucciones}]
    mensajes.extend(historial)
    mensajes.append({"role": "user", "content": mensaje})

    try:
        respuesta = ollama.chat(
            model="gemma3:1b",
            messages=mensajes,
            stream=False
        )

        texto = respuesta["message"]["content"]

        # guardar historial
        historial.append({"role": "user", "content": mensaje})
        historial.append({"role": "assistant", "content": texto})

        # limitar historial
        if len(historial) > 20:
            historial.pop(0)
            historial.pop(0)

        return {"respuesta": texto}

    except Exception as e:
        return {"respuesta": f"Error en el agente: {e}"}



# -----------------------------------------------------
#  SUBIR Y ANALIZAR PDF
# -----------------------------------------------------
@app.post("/subir_pdf")
async def subir_pdf(file: UploadFile = File(...)):
    global pdf_actual

    try:
        contenido = await file.read()
        doc = fitz.open(stream=contenido, filetype="pdf")

        texto = ""
        for pagina in doc:
            texto += pagina.get_text()

        pdf_actual = {
            "texto": texto,
            "paginas": len(doc),
            "metadata": doc.metadata,
        }

        doc.close()

        prompt = crear_analisis(pdf_actual)

        analisis = ollama.chat(
            model="gemma3:1b",
            messages=[
                {"role": "system", "content": instrucciones},
                {"role": "user", "content": "Analiza este PDF."},
                {"role": "user", "content": prompt},
            ],
        )

        respuesta = analisis["message"]["content"]
        return {"respuesta": respuesta}

    except Exception as e:
        return {"respuesta": f"Error al procesar PDF: {e}"}



# -----------------------------------------------------
#  BUSCAR PAPERS
# -----------------------------------------------------
@app.post("/buscar")
def buscar_endpoint(consulta: str = Form(...)):
    global ultimo_resultado

    resultados = buscar_papers(consulta)

    if not resultados:
        return {"respuesta": "No se encontraron papers."}

    ultimo_resultado = resultados

    resumen = resumen_paper(resultados)

    analisis = ollama.chat(
        model="gemma3:1b",
        messages=[
            {"role": "system", "content": instrucciones},
            {"role": "user", "content": f"Analiza estos papers:\n{resumen}"}
        ]
    )

    return {"respuesta": analisis["message"]["content"]}



# -----------------------------------------------------
#  CITAR PAPER (APA)
# -----------------------------------------------------
@app.post("/citar")
def citar_endpoint(numero: int = Form(...)):
    global ultimo_resultado

    if not ultimo_resultado:
        return {"respuesta": "Primero debes buscar papers."}

    if numero < 1 or numero > len(ultimo_resultado):
        return {"respuesta": "Número inválido."}

    cita = generar_cita_apa(ultimo_resultado[numero - 1])
    return {"respuesta": cita}



# -----------------------------------------------------
# SERVIDOR
# -----------------------------------------------------
if __name__ == "__main__":
    uvicorn.run("IAServer:app", host="0.0.0.0", port=8000, reload=True)




# ----------------------------------------------------
#IMPORTANTE COMANDO PARA CORRER EL AGENTE: 
# uvicorn IAServer:app --reload --host 0.0.0.0 --port 8000
#--------------------------------------------------------------------- 