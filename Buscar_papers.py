from scholarly import scholarly
import time

def buscar_papers(consulta, max_resultados=5):
    """
    Busca papers académicos en Google Scholar.
    Args:
        consulta (str): Término de búsqueda (ej: "machine learning")
        max_resultados (int): Número máximo de resultados
    Returns:
        list: Lista de diccionarios con información de los papers
    """
    print("\n  Buscando papers académicos…")
    print("  Puede tardar un momento…")

    resultados = []
    try:
        busqueda = scholarly.search_pubs(consulta)
        for _ in range(max_resultados):
            try:
                paper = next(busqueda)
                info_paper = {
                    'titulo': paper.get('bib', {}).get('title', 'Sin título'),
                    'autores': paper.get('bib', {}).get('author', 'Sin autor'),
                    'año': paper.get('bib', {}).get('pub_year', 'Sin año'),
                    'revista': paper.get('bib', {}).get('venue', 'Sin revista'),
                    'resumen': paper.get('bib', {}).get('abstract', 'Sin resumen'),
                    'citacion': paper.get('bib', {}).get('citations', 0),
                    'url': paper.get('pub_url', paper.get('eprint_url', 'Sin URL')),
                }
                resultados.append(info_paper)
                time.sleep(1)

            except StopIteration:
                print(f"\n  Solo se encontraron {len(resultados)} resultados.")
                break
            except Exception as e:
                print(f"Error interno: {e}")
                continue

        print("\n  Búsqueda completada.")
        return resultados
    
    except Exception as e:
        print(f"Error en la búsqueda: {e}")
        return []


def formato_resultados(paper, numero):
    """
    Devuelve un texto formateado para mostrar un paper bonito.
    """
    autores = ", ".join(paper['autores']) if isinstance(paper['autores'], list) else paper['autores']

    resumen = paper['resumen']
    if len(resumen) > 300:
        resumen = resumen[:300] + "..."

    texto = f"""
------------------------------------------------------------
PAPER #{numero}
------------------------------------------------------------
Título: {paper['titulo']}
Autores: {autores}
Año: {paper['año']}
Revista: {paper['revista']}
Citas: {paper['citacion']}
------------------------------------------------------------
Resumen:
{resumen}
------------------------------------------------------------
URL: {paper['url']}
"""
    return texto


def mostrar_resultados(resultados):
    """
    Muestra todos los resultados en pantalla.
    """
    if not resultados:
        print("No hay resultados para mostrar.")
        return

    print("\n RESULTADOS ENCONTRADOS:")
    for i, paper in enumerate(resultados, 1):
        print(formato_resultados(paper, i))


def resumen_paper(resultados):
    """
    Crea un resumen corto para enviarlo al agente.
    Devuelve un texto educativo técnico + preguntas sugeridas.
    """
    if not resultados:
        return "No se encontraron papers."

    resumen_texto = f"Se encontraron {len(resultados)} papers académicos.\n\n"

    for i, paper in enumerate(resultados, 1):
        autores = ", ".join(paper['autores']) if isinstance(paper['autores'], list) else paper['autores']

        resumen_texto += f"""
--- Paper {i} ---
Título: {paper['titulo']}
Autores: {autores}
Año: {paper['año']}
Revista: {paper['revista']}
Citas: {paper['citacion']}
Resumen corto: {paper['resumen'][:200]}...
URL: {paper['url']}
"""

    # 👇 Añadimos aquí lo que tú querías: preguntas técnicas sugeridas
    resumen_texto += """

Preguntas sugeridas (educativas y técnicas):
- ¿Quieres que te explique estos conceptos en lenguaje simple?
- ¿Deseas saber cómo aplicar estos papers en un proyecto técnico real?

"""

    return resumen_texto
