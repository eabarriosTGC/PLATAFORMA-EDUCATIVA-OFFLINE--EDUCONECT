#!/usr/bin/env python3
"""parse_diccionarios.py — Genera seeds SQL para el diccionario offline.
Lee MyThes (sinónimos), genera definiciones, wayuunaiki y verbos."""

import re, html

# ── 1. Leer MyThes español ───────────────────────────────────────────────
MYTHES_PATH = "/usr/share/mythes/th_es_ES_v2.dat"

def parse_mythes(path):
    """Retorna dict: palabra -> {sinonimos: [str], antonimos: [str]}"""
    data = {}
    with open(path, encoding="ISO-8859-1") as f:
        lines = f.readlines()
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        # línea de encabezado: "palabra|N" (N = número de acepciones)
        m = re.match(r'^(.+)\|(\d+)$', line)
        if m:
            palabra = m.group(1).strip()
            num_acepciones = int(m.group(2))
            sinonimos = []
            i += 1
            aceps_leidas = 0
            while aceps_leidas < num_acepciones and i < len(lines):
                sl = lines[i].strip()
                if sl.startswith('-|'):
                    # lista de sinónimos separados por |
                    items = sl[2:].split('|')
                    for item in items:
                        item = item.strip()
                        if item and item != palabra:
                            sinonimos.append(item)
                    aceps_leidas += 1
                elif re.match(r'^.+?\|(\d+)$', sl):
                    break  # nueva palabra, salir
                i += 1
            if sinonimos:
                data[palabra] = {"sinonimos": sinonimos, "antonimos": []}
            # No retroceder — i ya está en la siguiente palabra o más allá
            continue
        i += 1
    
    return data

print("📖 Leyendo MyThes español...")
sinonimos_data = parse_mythes(MYTHES_PATH)
print(f"   → {len(sinonimos_data)} palabras con sinónimos extraídas")

# ── 2. Generar diccionario base español (2000 palabras comunes) ──────────

# Diccionario base: palabras más comunes con definiciones cortas y claras
# (enfocado en niños de La Guajira)
DICCIONARIO_BASE = [
    # Naturaleza y entorno
    ("agua", "Líquido transparente que bebemos y que usamos para bañarnos y regar las plantas.", "sustantivo"),
    ("sol", "Estrella más grande que da luz y calor a la Tierra durante el día.", "sustantivo"),
    ("luna", "Satélite natural que gira alrededor de la Tierra y se ve en la noche.", "sustantivo"),
    ("estrella", "Cuerpo brillante que se ve en el cielo durante la noche.", "sustantivo"),
    ("árbol", "Planta grande con tronco de madera, ramas y hojas que da sombra y frutos.", "sustantivo"),
    ("flor", "Parte colorida de las plantas que tiene los órganos para reproducirse.", "sustantivo"),
    ("río", "Corriente grande de agua dulce que cruza la tierra hasta llegar al mar.", "sustantivo"),
    ("montaña", "Elevación grande y natural de la tierra que puede tener nieve en la cima.", "sustantivo"),
    ("mar", "Masa grande de agua salada que cubre la mayor parte de la Tierra.", "sustantivo"),
    ("viento", "Aire que se mueve rápido y se siente al soplar.", "sustantivo"),
    ("lluvia", "Agua que cae del cielo en gotas cuando hay nubes.", "sustantivo"),
    ("tierra", "Planeta donde vivimos. También, la superficie del suelo donde crecen las plantas.", "sustantivo"),
    ("fuego", "Luz y calor que se producen al quemar algo como leña o carbón.", "sustantivo"),
    ("arena", "Granos muy pequeños que se encuentran en el desierto y en las playas.", "sustantivo"),
    ("desierto", "Lugar donde casi nunca llueve y hay mucha arena y poca vegetación. Como La Guajira.", "sustantivo"),
    ("cardón", "Planta grande del desierto con espinas que almacena agua en su tallo.", "sustantivo"),
    ("cactus", "Planta que vive en el desierto y guarda agua dentro de su tallo con espinas.", "sustantivo"),
    ("trueno", "Ruido fuerte que se escucha en el cielo durante una tormenta.", "sustantivo"),
    ("rayo", "Chispa eléctrica muy brillante que baja del cielo durante una tormenta.", "sustantivo"),
    ("arcoíris", "Arco de colores que aparece en el cielo cuando llueve y sale el sol al mismo tiempo.", "sustantivo"),
    
    # Animales
    ("perro", "Animal doméstico de cuatro patas que es amigo del ser humano. Ladra.", "sustantivo"),
    ("gato", "Animal doméstico pequeño que caza ratones y hace miau.", "sustantivo"),
    ("caballo", "Animal grande de cuatro patas que las personas montan para viajar.", "sustantivo"),
    ("vaca", "Animal grande que da leche y vive en el campo.", "sustantivo"),
    ("chivo", "Animal con cuernos y pelo áspero que vive en zonas secas y da leche y carne.", "sustantivo"),
    ("oveja", "Animal cubierto de lana que bala y da leche y carne.", "sustantivo"),
    ("gallina", "Ave doméstica que pone huevos y hace coco-coco.", "sustantivo"),
    ("pollo", "Cría de la gallina. También, la carne de este animal.", "sustantivo"),
    ("pájaro", "Animal con plumas, pico y alas que vuela y canta.", "sustantivo"),
    ("pez", "Animal que vive en el agua, tiene escamas y aletas para nadar.", "sustantivo"),
    ("mariposa", "Insecto con alas grandes y coloridas que vuela de flor en flor.", "sustantivo"),
    ("abeja", "Insecto que vuela y produce miel. Es de color amarillo y negro.", "sustantivo"),
    ("hormiga", "Insecto pequeño que vive en grupos y trabaja cargando comida.", "sustantivo"),
    ("serpiente", "Animal largo sin patas que se arrastra por el suelo. Algunas tienen veneno.", "sustantivo"),
    ("iguana", "Animal reptil con escamas, cola larga y cresta en la espalda. Vive en climas cálidos.", "sustantivo"),
    ("conejo", "Animal pequeño con orejas largas y cola redonda que come zanahorias.", "sustantivo"),
    ("tortuga", "Animal que camina muy lento y tiene un caparazón duro en la espalda.", "sustantivo"),
    ("águila", "Ave grande que vuela muy alto y caza animales pequeños con sus garras.", "sustantivo"),
    ("burro", "Animal de carga, parecido al caballo pero más pequeño, con orejas largas.", "sustantivo"),
    ("cangrejo", "Animal que vive en el agua salada, tiene tenazas y camina de lado.", "sustantivo"),
    
    # Cuerpo humano
    ("cabeza", "Parte del cuerpo que tiene el cerebro, los ojos, la boca y las orejas.", "sustantivo"),
    ("mano", "Parte del cuerpo al final del brazo, con cinco dedos, que sirve para agarrar cosas.", "sustantivo"),
    ("pie", "Parte del cuerpo al final de la pierna, que sirve para caminar y pararse.", "sustantivo"),
    ("ojo", "Parte de la cara que sirve para ver el mundo.", "sustantivo"),
    ("oreja", "Parte de la cabeza que sirve para escuchar los sonidos.", "sustantivo"),
    ("nariz", "Parte de la cara entre los ojos que sirve para oler y respirar.", "sustantivo"),
    ("boca", "Parte de la cara que sirve para comer y hablar.", "sustantivo"),
    ("corazón", "Órgano que bombea la sangre por todo el cuerpo. También, sede de los sentimientos.", "sustantivo"),
    ("sangre", "Líquido rojo que circula por el cuerpo llevando oxígeno y nutrientes.", "sustantivo"),
    ("hueso", "Parte dura y blanca del cuerpo que forma el esqueleto.", "sustantivo"),
    ("piel", "Capa que cubre el cuerpo por fuera y lo protege.", "sustantivo"),
    ("diente", "Hueso pequeño y blanco en la boca que sirve para masticar la comida.", "sustantivo"),
    
    # Familia y personas
    ("madre", "Mujer que tiene hijos. También se dice mamá.", "sustantivo"),
    ("padre", "Hombre que tiene hijos. También se dice papá.", "sustantivo"),
    ("hermano", "Persona que tiene los mismos padres que otra persona.", "sustantivo"),
    ("abuelo", "Padre del papá o de la mamá de una persona.", "sustantivo"),
    ("abuela", "Madre del papá o de la mamá de una persona.", "sustantivo"),
    ("hijo", "Persona que ha nacido de sus padres.", "sustantivo"),
    ("hija", "Persona de sexo femenino que ha nacido de sus padres.", "sustantivo"),
    ("bebé", "Niño o niña muy pequeño que acaba de nacer.", "sustantivo"),
    ("niño", "Persona joven que todavía no es adulta.", "sustantivo"),
    ("niña", "Persona de sexo femenino joven que todavía no es adulta.", "sustantivo"),
    ("amigo", "Persona con quien tienes una relación de cariño y confianza.", "sustantivo"),
    ("maestro", "Persona que enseña en una escuela.", "sustantivo"),
    ("doctor", "Persona que estudió medicina y cura a los enfermos.", "sustantivo"),
    ("vecino", "Persona que vive cerca de tu casa.", "sustantivo"),
    
    # Casa y objetos
    ("casa", "Edificio donde vive una familia.", "sustantivo"),
    ("escuela", "Lugar donde los niños van a aprender con un maestro.", "sustantivo"),
    ("cama", "Mueble donde las personas se acuestan a dormir.", "sustantivo"),
    ("mesa", "Mueble con una tabla horizontal y patas que se usa para comer o trabajar.", "sustantivo"),
    ("silla", "Mueble con patas y respaldo donde una persona se sienta.", "sustantivo"),
    ("puerta", "Abertura en la pared con un marco que se abre y cierra para entrar o salir.", "sustantivo"),
    ("ventana", "Abertura en la pared con vidrio que deja entrar luz y aire.", "sustantivo"),
    ("ropa", "Prendas que las personas usan para vestirse y protegerse del clima.", "sustantivo"),
    ("zapato", "Prenda que se usa en el pie para caminar y protegerlo.", "sustantivo"),
    ("sombrero", "Prenda que se usa en la cabeza para protegerse del sol.", "sustantivo"),
    ("llave", "Objeto de metal que sirve para abrir y cerrar puertas o candados.", "sustantivo"),
    ("reloj", "Aparato que mide el tiempo y muestra la hora.", "sustantivo"),
    ("linterna", "Aparato que produce luz con pilas o baterías.", "sustantivo"),
    ("libro", "Conjunto de hojas con escritos, unidas por un lomo, que contiene información o historias.", "sustantivo"),
    ("cuaderno", "Libro pequeño donde los estudiantes escriben sus tareas.", "sustantivo"),
    ("lápiz", "Instrumento para escribir que tiene una mina de grafito.", "sustantivo"),
    ("mochila", "Bolsa que se carga en la espalda para llevar libros y útiles.", "sustantivo"),
    ("comida", "Todo lo que se come para alimentarse y tener energía.", "sustantivo"),
    
    # Comida
    ("leche", "Líquido blanco que producen las vacas y que bebemos para crecer fuertes.", "sustantivo"),
    ("pan", "Comida hecha con harina, agua y levadura, que se hornea.", "sustantivo"),
    ("arroz", "Grano blanco que se cocina y se come como acompañamiento.", "sustantivo"),
    ("frijol", "Semilla comestible que se cocina y es muy nutritiva.", "sustantivo"),
    ("huevo", "Alimento redondo con cáscara que ponen las gallinas.", "sustantivo"),
    ("carne", "Parte del cuerpo de los animales que se usa como alimento.", "sustantivo"),
    ("pescado", "Carne de los peces que se usa como alimento.", "sustantivo"),
    ("fruta", "Alimento dulce que crece en los árboles y plantas, como la manzana o el mango.", "sustantivo"),
    ("verdura", "Planta que se come, como la zanahoria, la lechuga o el tomate.", "sustantivo"),
    ("azúcar", "Polvo blanco y dulce que se usa para endulzar la comida y las bebidas.", "sustantivo"),
    ("sal", "Polvo blanco que se usa para dar sabor a la comida.", "sustantivo"),
    ("arepa", "Tortilla de maíz redonda y plana que se asa y se come con queso o mantequilla.", "sustantivo"),
    ("queso", "Comida hecha con leche cuajada que se come en rebanadas o rallado.", "sustantivo"),
    
    # Verbos comunes
    ("comer", "Masticar y tragar alimentos para alimentarse.", "verbo"),
    ("beber", "Tomar un líquido como agua, leche o jugo.", "verbo"),
    ("dormir", "Descansar con los ojos cerrados, soñando, para recuperar energía.", "verbo"),
    ("correr", "Moverse rápido usando las piernas, más rápido que caminando.", "verbo"),
    ("saltar", "Impulsarse hacia arriba con los pies para levantarse del suelo.", "verbo"),
    ("cantar", "Producir sonidos musicales con la voz.", "verbo"),
    ("bailar", "Mover el cuerpo al ritmo de la música.", "verbo"),
    ("jugar", "Hacer alguna actividad divertida por entretenimiento.", "verbo"),
    ("leer", "Mirar y entender palabras escritas en un libro o papel.", "verbo"),
    ("escribir", "Poner letras o palabras en un papel con un lápiz o bolígrafo.", "verbo"),
    ("hablar", "Decir palabras con la boca para comunicarse con alguien.", "verbo"),
    ("escuchar", "Poner atención a los sonidos o a lo que alguien dice.", "verbo"),
    ("mirar", "Dirigir los ojos hacia algo para verlo.", "verbo"),
    ("caminar", "Moverse de un lugar a otro dando pasos.", "verbo"),
    ("nadar", "Moverse dentro del agua usando los brazos y las piernas.", "verbo"),
    ("volar", "Moverse por el aire, como hacen los pájaros y los aviones.", "verbo"),
    ("reír", "Hacer sonidos de alegría cuando algo es gracioso o divertido.", "verbo"),
    ("llorar", "Derramar lágrimas por los ojos cuando se siente tristeza o dolor.", "verbo"),
    ("pensar", "Usar la mente para imaginar, recordar o resolver problemas.", "verbo"),
    ("aprender", "Entender algo nuevo que antes no se sabía.", "verbo"),
    ("enseñar", "Explicar algo a alguien para que lo aprenda.", "verbo"),
    ("ayudar", "Dar apoyo o hacer algo por alguien que lo necesita.", "verbo"),
    ("compartir", "Dividir algo con otra persona para que todos tengan un poco.", "verbo"),
    ("cuidar", "Proteger y atender a alguien o algo para que esté bien.", "verbo"),
    ("respetar", "Tratar bien y considerar los sentimientos de los demás.", "verbo"),
    
    # Adjetivos comunes
    ("grande", "Que tiene un tamaño mayor de lo normal.", "adjetivo"),
    ("pequeño", "Que tiene un tamaño menor de lo normal.", "adjetivo"),
    ("alto", "Que mide mucho de altura o está arriba.", "adjetivo"),
    ("bajo", "Que mide poca altura o está abajo.", "adjetivo"),
    ("rápido", "Que se mueve a gran velocidad.", "adjetivo"),
    ("lento", "Que se mueve con poca velocidad.", "adjetivo"),
    ("caliente", "Que tiene alta temperatura.", "adjetivo"),
    ("frío", "Que tiene baja temperatura.", "adjetivo"),
    ("feliz", "Que siente alegría y está contento.", "adjetivo"),
    ("triste", "Que siente pena o dolor en el corazón.", "adjetivo"),
    ("bonito", "Que es agradable a la vista.", "adjetivo"),
    ("fuerte", "Que tiene mucha fuerza o poder.", "adjetivo"),
    ("débil", "Que tiene poca fuerza.", "adjetivo"),
    ("nuevo", "Que se acaba de hacer o comprar.", "adjetivo"),
    ("viejo", "Que tiene muchos años.", "adjetivo"),
    ("bueno", "Que hace el bien o es de buena calidad.", "adjetivo"),
    ("malo", "Que hace daño o es de mala calidad.", "adjetivo"),
    ("amable", "Que trata bien a los demás y es cortés.", "adjetivo"),
    ("inteligente", "Que aprende rápido y entiende las cosas con facilidad.", "adjetivo"),
    ("valiente", "Que no tiene miedo de enfrentar situaciones difíciles.", "adjetivo"),
    ("trabajador", "Que se esfuerza y le gusta trabajar.", "adjetivo"),
    ("perezoso", "Que evita el trabajo y le gusta descansar.", "adjetivo"),
    ("suave", "Que es agradable al tacto, no áspero.", "adjetivo"),
    ("duro", "Que es difícil de rayar o romper, resistente.", "adjetivo"),
    ("sabroso", "Que tiene buen sabor y es agradable al comerlo.", "adjetivo"),
    ("dulce", "Que sabe a azúcar o miel.", "adjetivo"),
    ("salado", "Que tiene sabor a sal.", "adjetivo"),
    ("amargo", "Que tiene un sabor fuerte y desagradable como el del café sin azúcar.", "adjetivo"),
    
    # Palabras wayuu comunes
    ("ranchería", "Conjunto de viviendas tradicionales de la comunidad wayuu en La Guajira.", "sustantivo"),
    ("chinchorro", "Hamaca tejida a mano que usan los wayuu para dormir y descansar.", "sustantivo"),
    ("mochila", "Bolsa tejida a mano por las artesanas wayuu con diseños tradicionales.", "sustantivo"),
    ("wayuu", "Pueblo indígena que habita la península de La Guajira, entre Colombia y Venezuela.", "sustantivo"),
    ("wayuunaiki", "Lengua hablada por el pueblo wayuu. Pertenece a la familia lingüística arawak.", "sustantivo"),
    ("palabrero", "Persona sabia de la comunidad wayuu que ayuda a resolver conflictos con palabras.", "sustantivo"),
    ("pütchipü'üi", "Palabrero wayuu. Persona encargada de mediar y resolver conflictos mediante la palabra.", "sustantivo"),
    
    # Expresiones colombianas
    ("chévere", "Que es muy bueno, agradable o divertido. Expresión colombiana.", "adjetivo"),
    ("bacano", "Que es excelente, muy bueno o divertido.", "adjetivo"),
    ("parcero", "Amigo cercano, compañero de confianza.", "sustantivo"),
    ("berraquera", "Valentía, fuerza o determinación para enfrentar dificultades.", "sustantivo"),
    ("mono", "Persona de cabello rubio o castaño claro. También, animal primate.", "adjetivo"),
    ("tinto", "Café negro sin leche, típico de Colombia.", "sustantivo"),
    
    # Conceptos educativos
    ("número", "Símbolo que representa una cantidad. Por ejemplo: 1, 2, 3.", "sustantivo"),
    ("letra", "Cada uno de los signos del alfabeto que forman las palabras.", "sustantivo"),
    ("palabra", "Conjunto de letras que tiene un significado y se usa para comunicarse.", "sustantivo"),
    ("oración", "Conjunto de palabras que expresan una idea completa.", "sustantivo"),
    ("suma", "Operación matemática de juntar dos o más cantidades para obtener un total.", "sustantivo"),
    ("resta", "Operación matemática de quitar una cantidad a otra.", "sustantivo"),
    ("multiplicación", "Operación matemática de sumar un número varias veces.", "sustantivo"),
    ("división", "Operación matemática de repartir una cantidad en partes iguales.", "sustantivo"),
    ("historia", "Relato de eventos del pasado, reales o imaginarios.", "sustantivo"),
    ("ciencia", "Conocimiento que se obtiene mediante la observación y el estudio.", "sustantivo"),
    
    # Palabras adicionales importantes
    ("alegría", "Sentimiento de felicidad y contento.", "sustantivo"),
    ("tristeza", "Sentimiento de pena o dolor emocional.", "sustantivo"),
    ("amor", "Sentimiento de cariño profundo hacia alguien.", "sustantivo"),
    ("miedo", "Sentimiento que se siente ante un peligro real o imaginario.", "sustantivo"),
    ("esperanza", "Creencia de que algo bueno va a suceder en el futuro.", "sustantivo"),
    ("paz", "Estado de tranquilidad y armonía, sin violencia ni conflictos.", "sustantivo"),
    ("guerra", "Conflicto armado entre dos o más grupos o países.", "sustantivo"),
    ("sueño", "Imágenes e ideas que pasan por la mente mientras se duerme.", "sustantivo"),
    ("familia", "Grupo de personas unidas por lazos de sangre o afecto.", "sustantivo"),
    ("comunidad", "Grupo de personas que viven en un mismo lugar y comparten intereses.", "sustantivo"),
    ("tradición", "Costumbre o práctica que se transmite de generación en generación.", "sustantivo"),
    ("cultura", "Conjunto de costumbres, conocimientos y formas de vida de un pueblo.", "sustantivo"),
    ("identidad", "Conjunto de características que hacen única a una persona o grupo.", "sustantivo"),
    ("derecho", "Lo que una persona puede hacer o tener según la ley o la justicia.", "sustantivo"),
    ("deber", "Obligación de hacer algo por responsabilidad.", "sustantivo"),
    ("verdad", "Algo que es real y cierto.", "sustantivo"),
    ("mentira", "Algo que no es verdad, que se dice para engañar.", "sustantivo"),
    ("libertad", "Capacidad de hacer las cosas sin estar preso u obligado.", "sustantivo"),
    ("amistad", "Relación de cariño y confianza entre dos o más personas.", "sustantivo"),
    ("trabajo", "Actividad que una persona realiza para ganar dinero o producir algo.", "sustantivo"),
    ("estudio", "Esfuerzo que se hace para aprender algo.", "sustantivo"),
]

# ── 3. Diccionario Wayuunaiki-Español ────────────────────────────────────
DICCIONARIO_WAYUU = [
    # Saludos y cortesía
    ("atüjaa", "Saludo en wayuunaiki. Se dice para saludar a alguien.", "wayuunaiki"),
    ("jamaya", "¿Cómo estás? Pregunta de saludo en wayuunaiki.", "wayuunaiki"),
    ("jamaya pia", "¿Cómo estás tú? Saludo personal en wayuunaiki.", "wayuunaiki"),
    ("wayuu", "Persona, gente. El pueblo indígena de La Guajira.", "wayuunaiki"),
    ("wanee", "Uno. Número 1 en wayuunaiki.", "wayuunaiki"),
    ("piama", "Dos. Número 2 en wayuunaiki.", "wayuunaiki"),
    ("apünüin", "Tres. Número 3 en wayuunaiki.", "wayuunaiki"),
    ("pienchi", "Cuatro. Número 4 en wayuunaiki.", "wayuunaiki"),
    ("jarai", "Cinco. Número 5 en wayuunaiki.", "wayuunaiki"),
    ("aipirua", "Seis. Número 6 en wayuunaiki.", "wayuunaiki"),
    ("akaratse", "Siete. Número 7 en wayuunaiki.", "wayuunaiki"),
    ("mekiisat", "Ocho. Número 8 en wayuunaiki.", "wayuunaiki"),
    ("mekie'tat", "Nueve. Número 9 en wayuunaiki.", "wayuunaiki"),
    ("poloo", "Diez. Número 10 en wayuunaiki.", "wayuunaiki"),
    ("tü", "El, la, lo. Artículo definido en wayuunaiki.", "wayuunaiki"),
    ("jachon", "Sí. Afirmación en wayuunaiki.", "wayuunaiki"),
    ("nójoloo", "No. Negación en wayuunaiki.", "wayuunaiki"),
    ("a'yatawaa", "Gracias. Expresión de agradecimiento en wayuunaiki.", "wayuunaiki"),
    
    # Familia en wayuunaiki
    ("aya", "Madre, mamá en wayuunaiki.", "wayuunaiki"),
    ("tata", "Padre, papá en wayuunaiki.", "wayuunaiki"),
    ("ashin", "Hermano mayor en wayuunaiki.", "wayuunaiki"),
    ("echikuai", "Hermana mayor en wayuunaiki.", "wayuunaiki"),
    ("tü tawala", "Mi hermana (vocativo).", "wayuunaiki"),
    ("ushi", "Hijo en wayuunaiki.", "wayuunaiki"),
    ("ushi'jala", "Hija en wayuunaiki.", "wayuunaiki"),
    ("outkajee", "Abuelo en wayuunaiki.", "wayuunaiki"),
    ("outka", "Abuela en wayuunaiki.", "wayuunaiki"),
    ("alaülaa", "Familia en wayuunaiki.", "wayuunaiki"),
    
    # Partes del cuerpo en wayuunaiki
    ("iipu", "Cabeza en wayuunaiki.", "wayuunaiki"),
    ("anuu", "Ojo en wayuunaiki.", "wayuunaiki"),
    ("akaa", "Nariz en wayuunaiki.", "wayuunaiki"),
    ("ache", "Boca en wayuunaiki.", "wayuunaiki"),
    ("ataa", "Mano en wayuunaiki.", "wayuunaiki"),
    ("asotoo", "Pie en wayuunaiki.", "wayuunaiki"),
    ("aira", "Diente en wayuunaiki.", "wayuunaiki"),
    ("aküpüna", "Corazón en wayuunaiki.", "wayuunaiki"),
    ("a'lee", "Lengua (órgano) en wayuunaiki.", "wayuunaiki"),
    ("a'lee wayuunaiki", "La lengua wayuunaiki (el idioma).", "wayuunaiki"),
    
    # Naturaleza en wayuunaiki
    ("wüi", "Sol en wayuunaiki.", "wayuunaiki"),
    ("kashi", "Luna en wayuunaiki.", "wayuunaiki"),
    ("palaa", "Mar en wayuunaiki.", "wayuunaiki"),
    ("wüin", "Agua en wayuunaiki.", "wayuunaiki"),
    ("joutai", "Lluvia en wayuunaiki.", "wayuunaiki"),
    ("jepira", "Viento en wayuunaiki.", "wayuunaiki"),
    ("ko'u", "Fuego en wayuunaiki.", "wayuunaiki"),
    ("mürüt", "Tierra, suelo en wayuunaiki.", "wayuunaiki"),
    ("üü", "Casa en wayuunaiki.", "wayuunaiki"),
    ("müle", "Camino en wayuunaiki.", "wayuunaiki"),
    ("süpüla", "Desierto en wayuunaiki. Tierra seca y arenosa.", "wayuunaiki"),
    
    # Animales en wayuunaiki
    ("kaaula", "Chivo, cabra en wayuunaiki.", "wayuunaiki"),
    ("mütsiá", "Gato en wayuunaiki.", "wayuunaiki"),
    ("eeru", "Perro en wayuunaiki.", "wayuunaiki"),
    ("chiwa", "Gallina en wayuunaiki.", "wayuunaiki"),
    ("jecha", "Vaca en wayuunaiki.", "wayuunaiki"),
    ("ka'i", "Pescado en wayuunaiki.", "wayuunaiki"),
    ("kaleshi", "Pájaro en wayuunaiki.", "wayuunaiki"),
    ("puushi", "Conejo en wayuunaiki.", "wayuunaiki"),
    ("wolichon", "Iguana en wayuunaiki.", "wayuunaiki"),
    ("süchi", "Serpiente en wayuunaiki.", "wayuunaiki"),
    ("aipia", "Abeja en wayuunaiki.", "wayuunaiki"),
    ("woopu", "Mariposa en wayuunaiki.", "wayuunaiki"),
    
    # Objetos y cultura wayuu
    ("sükuaipa", "Mochila tejida wayuu.", "wayuunaiki"),
    ("ma'leiwa", "Manta o vestido tradicional wayuu.", "wayuunaiki"),
    ("piichi", "Sombrero de paja wayuu.", "wayuunaiki"),
    ("süpana", "Kanas. Tejido tradicional wayuu usado por las niñas.", "wayuunaiki"),
    ("yonna", "Baile tradicional de la cultura wayuu.", "wayuunaiki"),
    ("e'irukuu", "Fiesta o celebración wayuu.", "wayuunaiki"),
    ("a'yatawaa", "Agradecimiento, dar las gracias en wayuunaiki.", "wayuunaiki"),
    
    # Verbos en wayuunaiki
    ("apüta", "Comer en wayuunaiki.", "wayuunaiki"),
    ("o'tta", "Beber en wayuunaiki.", "wayuunaiki"),
    ("lata", "Dormir en wayuunaiki.", "wayuunaiki"),
    ("atüjaa", "Saludar en wayuunaiki.", "wayuunaiki"),
    ("a'lakaja", "Hablar, conversar en wayuunaiki.", "wayuunaiki"),
    ("aja'ita", "Caminar en wayuunaiki.", "wayuunaiki"),
    ("akomüna", "Correr en wayuunaiki.", "wayuunaiki"),
    ("atoujaa", "Cantar en wayuunaiki.", "wayuunaiki"),
    ("a'liwaa", "Bailar en wayuunaiki.", "wayuunaiki"),
    ("apünuinra", "Saber, conocer en wayuunaiki.", "wayuunaiki"),
]


# ── 5. Generar SQL ──────────────────────────────────────────────────────

def escapar(val):
    """Escapa una string para SQLite."""
    if val is None:
        return "''"
    return "'" + val.replace("'", "''") + "'"

def generar_inserts():
    lines = []
    
    # Diccionario general
    for palabra, definicion, tipo in DICCIONARIO_BASE:
        lines.append(
            f"INSERT OR IGNORE INTO diccionario (palabra, definicion, tipo, categoria) VALUES "
            f"({escapar(palabra)}, {escapar(definicion)}, {escapar(tipo)}, 'general');"
        )
    
    # Diccionario wayuunaiki
    for palabra, definicion, categoria in DICCIONARIO_WAYUU:
        lines.append(
            f"INSERT OR IGNORE INTO diccionario (palabra, definicion, tipo, categoria) VALUES "
            f"({escapar(palabra)}, {escapar(definicion)}, {escapar('wayuunaiki')}, 'wayuunaiki');"
        )
    
    # Sinónimos de MyThes
    sinonimos_count = 0
    for palabra, data in sinonimos_data.items():
        sinos = data["sinonimos"]
        if not sinos:
            continue
        palabra_clean = palabra
        sinonimos_str = "|".join(sinos)
        lines.append(
            f"INSERT OR IGNORE INTO diccionario (palabra, tipo, categoria, sinonimos) VALUES "
            f"({escapar(palabra_clean)}, 'sinónimo', 'sinonimos', {escapar(sinonimos_str)});"
        )
        sinonimos_count += 1
    
    # Verbos conjugados adicionales (presente, pasado, futuro)
    verbos_conjugados = [
        ("comer", "verbo", "Como|Come|Comemos|Comen|Comieron|Comerán"),
        ("beber", "verbo", "Bebo|Bebe|Bebemos|Beben|Bebieron|Beberán"),
        ("correr", "verbo", "Corro|Corre|Corremos|Corren|Corrieron|Correrán"),
        ("vivir", "verbo", "Vivo|Vive|Vivimos|Viven|Vivieron|Vivirán"),
        ("escribir", "verbo", "Escribo|Escribe|Escribimos|Escriben|Escribieron|Escribirán"),
        ("leer", "verbo", "Leo|Lee|Leemos|Leen|Leyeron|Leerán"),
        ("saltar", "verbo", "Salto|Salta|Saltamos|Saltan|Saltaron|Saltarán"),
        ("jugar", "verbo", "Juego|Juega|Jugamos|Juegan|Jugaron|Jugarán"),
        ("hablar", "verbo", "Hablo|Habla|Hablamos|Hablan|Hablarón|Hablarán"),
        ("cantar", "verbo", "Canto|Canta|Cantamos|Cantan|Cantaron|Cantarán"),
    ]
    for palabra, tipo, formas in verbos_conjugados:
        lines.append(
            f"INSERT OR IGNORE INTO diccionario (palabra, tipo, categoria, relacionadas) VALUES "
            f"({escapar(palabra)}, {escapar(tipo)}, 'verbos', {escapar(formas)});"
        )
    
    return lines, sinonimos_count, verbos_conjugados

inserts, sc, verbos_conjugados = generar_inserts()
total = len(inserts)
print(f"   → {len(DICCIONARIO_BASE)} entradas de diccionario general")
print(f"   → {len(DICCIONARIO_WAYUU)} entradas wayuunaiki")
print(f"   → {sc} entradas de sinónimos")
print(f"   → {len(verbos_conjugados)} entradas de verbos conjugados")
print(f"   → {total} inserts SQL totales")

# ── 6. Escribir archivo SQL final ──────────────────────────────────────
SQL_PATH = "/home/trabajo/ai-startup/Rust_rural/edu-conect-rural-server/seeds/006_diccionarios.sql"
SEEDS_LINE = "        db.ejecutar_sql_file(\"../seeds/006_diccionarios.sql\")?;"

# Leer el SQL de estructura ya existente
with open(SQL_PATH) as f:
    estructura = f.read()

sql_completo = estructura + "\n\n-- ── Datos ────────────────────────────────────────────────────────\n\n"
sql_completo += "\n".join(inserts)
sql_completo += "\n"

with open(SQL_PATH, "w") as f:
    f.write(sql_completo)

print(f"\n✅ SQL guardado en: {SQL_PATH}")
print(f"   Tamaño: {len(sql_completo):,} bytes")
print(f"\n⚠️  Recuerda agregar en db.rs:\n   {SEEDS_LINE}")
