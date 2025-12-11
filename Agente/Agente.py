import ollama 
from Buscar_papers import buscar_papers, formato_resultados, mostrar_resultados, resumen_paper
from Generar_Citas import generar_cita_apa, generar_bibliografia_apa, mostrar_cita_paper
from Lector_PDF import leer_pdf, mostrar_info, crear_analisis

instrucciones = """
Eres una asistente experto en investigación académica y científica.

Tus funciones principales:
1. Ayudar a buscar y analizar literatura científica.
2. Generar citas bibliográficas en formato APA e IEEE.
3. Resumir papers y artículos académicos.
4. Ayudar a estructurar proyectos de investigación.
5. Explicar conceptos científicos de forma clara.

Formato de citas:
* APA: Apellido, A.A (Año). Título del artículo. Revista, volumen(número), páginas. https://doi.org/xxx
* IEEE: [#] A. A. Apellido, "Título del artículo", Revista, Vol. X, No. Y, pp. ZZ–ZZ, Mes Año.

Sé preciso, académico y siempre proporciona fuentes cuando sea posible.
"""

historial = []
ultimo_resultado = None
pdf_actual = None


# ----------------------------------------------------------
# CHAT DEL AGENTE (ahora con soporte para contexto_extra)
# ----------------------------------------------------------
def chat(mensaje_user, contexto_extra=None):
    mensajes = [{
        'role': 'system',
        'content': instrucciones
    }]

    mensajes.extend(historial)

    if contexto_extra:
        mensajes.append({
            'role': 'user',
            'content': f"Contexto adicional para la respuesta:\n{contexto_extra}"
        })

    mensajes.append({
        'role': 'user',
        'content': mensaje_user
    })

    try:
        respuesta = ollama.chat(
            model='gemma3:1b',
            messages=mensajes,
            stream=False
        )
        texto_respuesta = respuesta['message']['content']

        historial.append({'role': 'user', 'content': mensaje_user})
        historial.append({'role': 'assistant', 'content': texto_respuesta})

        # limitar historial para evitar saturación
        if len(historial) > 20:
            historial.pop(0)
            historial.pop(0)

        return texto_respuesta
    except Exception as e:
        return f"Error: {e}"


# ==========================================================
# BUCLE PRINCIPAL INTERACTIVO
# ==========================================================
while True:
    mensaje = input(" Tu: ").strip()

    if not mensaje:
        continue

    # salir
    if mensaje.lower() == 'salir':
        print("\n Adiós")
        break

    # reiniciar
    if mensaje.lower() == 'limpiar':
        historial.clear()
        ultimo_resultado = None
        pdf_actual = None
        print("\n Conversación reiniciada")
        continue

    # ------------------------------------------------------
    # CARGAR PDF
    # ------------------------------------------------------
    if mensaje.lower().startswith('pdf:'):
        ruta = mensaje[4:].strip().replace('"', '').replace("'", "")
        info = leer_pdf(ruta)

        if info['exito']:
            pdf_actual = info
            mostrar_info(info)

            prompt_analisis = crear_analisis(info)
            respuesta = chat("Analiza este paper en detalle.", contexto_extra=prompt_analisis)
            print(f"\nAnálisis del agente:\n{respuesta}\n")
        else:
            print("Error al procesar el PDF.")
        continue

    # ------------------------------------------------------
    # PREGUNTAR SOBRE PDF
    # ------------------------------------------------------
    if mensaje.lower().startswith('preguntar pdf'):
        if not pdf_actual:
            print("No hay PDF cargado.")
            continue

        pregunta = mensaje.replace('preguntar pdf', '').strip()
        contexto = f"Contenido del PDF:\n{pdf_actual['texto'][:4000]}"

        respuesta = chat(pregunta, contexto_extra=contexto)
        print("\nRespuesta basada en el PDF:\n", respuesta, "\n")
        continue

    # ------------------------------------------------------
    # BÚSQUEDA DE PAPERS
    # ------------------------------------------------------
    if mensaje.lower().startswith('buscar'):
        termino = mensaje[7:].strip()

        if not termino:
            print("Debes especificar qué buscar. Ejemplo: buscar IA")
            continue

        resultados = buscar_papers(termino, max_resultados=5)

        if resultados:
            ultimo_resultado = resultados
            mostrar_resultados(resultados)

            resumen = resumen_paper(resultados)
            pregunta = f"Analiza los resultados encontrados para '{termino}'."

            respuesta = chat(pregunta, contexto_extra=resumen)
            print("\nAnálisis del agente:\n", respuesta)
            print("-" * 60)
        else:
            print("No se encontró información sobre ese término.")
        continue

    # ------------------------------------------------------
    # CITAR APA
    # ------------------------------------------------------
    if mensaje.lower().startswith('citar apa:'):
        if not ultimo_resultado:
            print("Primero debes buscar papers.")
            continue

        try:
            numero = int(mensaje[10:].strip())
            if 1 <= numero <= len(ultimo_resultado):
                paper = ultimo_resultado[numero - 1]
                print(mostrar_cita_paper(paper, numero, formato='apa'))
            else:
                print("Número de resultado inválido.")
        except ValueError:
            print("Error al procesar la cita.")
        continue

    # ------------------------------------------------------
    # BIBLIOGRAFÍA APA
    # ------------------------------------------------------
    if mensaje.lower() == 'bibliografia apa':
        if not ultimo_resultado:
            print("Primero debes buscar papers.")
            continue

        bibliografia = generar_bibliografia_apa(ultimo_resultado)
        print(f"\n{bibliografia}\n")
        continue

    # ------------------------------------------------------
    # PREGUNTAS SIMPLES AL AGENTE
    # ------------------------------------------------------
    respuesta = chat(mensaje)
    print("\n Agent:\n", respuesta, "\n")
    print("-" * 60)
