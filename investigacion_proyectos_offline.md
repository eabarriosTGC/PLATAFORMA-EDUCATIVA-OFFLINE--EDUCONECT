# Investigación de Proyectos Educativos Offline Innovadores
## Para EduConect Rural — La Guajira, Colombia (Raspberry Pi)

> Investigación realizada: Junio 2025
> Búsquedas con DuckDuckGo (ddgs CLI)
> Enfoque: soluciones offline para zonas rurales sin internet

---

## RESUMEN EJECUTIVO

Se identificaron **13 proyectos** de plataformas educativas offline con características
innovadoras aplicables a EduConect Rural. Las áreas de mayor potencial son:
contenido curado offline-first, gamificación, sincronización diferida,
generación de red WiFi local desde Raspberry Pi, y simulaciones interactivas.

---

## 1. KOLIBRI — Learning Equality ⭐⭐⭐⭐⭐

**Sitio:** https://learningequality.org/kolibri/
**GitHub:** https://github.com/learningequality/kolibri

**Qué hace:** Plataforma offline-first de aprendizaje digital. Corre localmente en
dispositivos de bajo costo (Raspberry Pi, PC viejas) sin internet. Permite acceder a
una biblioteca de contenido educativo abierto (videos, audio, documentos, ejercicios
interactivos, apps HTML5).

**Características innovadoras:**
- **Arquitectura offline-first:** Diseñada desde cero para funcionar sin internet.
- **Kolibri Studio:** Plataforma web para que educadores alineen recursos OER al
  currículo local, los empaqueten y los distribuyan offline (vía USB/SD).
- **Sincronización diferida (peer-to-peer):** Dispositivos pueden sincronizar datos
  de progreso entre sí cuando se encuentran físicamente, sin internet.
- **Soporte multi-dispositivo:** Tablets, laptops, Raspberry Pi; servidor local que
  sirve a múltiples clientes por WiFi.
- **Canales de contenido:** Khan Academy, PhET, Wikipedia, libros, etc., todo
  empaquetado como "canales" instalables.
- **Instalada en 220+ países.**

**Aplicación a EduConect:**
- El modelo de "canales de contenido" es ideal para estructura modular.
- La sincronización P2P diferida es EXACTAMENTE lo que necesitamos para La Guajira
  (datos viajan con la persona, no con internet).
- Kolibri Studio permitiría alinear contenido al currículo colombiano.
- Corre en Raspberry Pi, validado.

---

## 2. KIWIX — Navegador Offline de Contenido ⭐⭐⭐⭐⭐

**Sitio:** https://www.kiwix.org/
**Wikipedia:** https://en.wikipedia.org/wiki/Kiwix

**Qué hace:** Software libre que permite descargar y acceder offline a Wikipedia
completa (100+ idiomas), Project Gutenberg (70,000+ libros), TED Talks, Wiktionary,
Wikibooks, Stack Exchange, y más. Usa archivos ZIM altamente comprimidos.

**Características innovadoras:**
- **Compresión ZIM extrema:** Wikipedia completa en español cabe en ~20 GB. La
  versión "Wikipedia for Schools" (curada para niños) en mucho menos.
- **Kiwix-serve:** Convierte cualquier dispositivo en un servidor WiFi que
  distribuye el contenido a múltiples dispositivos cercanos.
- **Hotspot WiFi integrado:** Un Raspberry Pi con Kiwix-serve se convierte en una
  "biblioteca ambulante" que cualquier dispositivo con navegador puede consultar.
- **Contenido curado por educadores:** "Wikipedia for Schools" filtra contenido
  apropiado para K-12.
- **Usado en escuelas rurales de África Occidental** (ej. Tanzania, proyecto en
  Colombia ya mencionado en comunidades).

**Aplicación a EduConect:**
- Fundacional: Wikipedia offline + libros es la base de conocimiento para cualquier
  escuela rural.
- Kiwix-serve podría ser un módulo integrado de EduConect.
- Combinar Wikipedia en español + Wikipedia en wayuunaiki (si existiera) o crear ZIM
  personalizado con contenido local.
- Ideal para consulta e investigación sin internet.

---

## 3. INTERNET-IN-A-BOX (IIAB) ⭐⭐⭐⭐⭐

**Sitio:** https://internet-in-a-box.org/
**GitHub:** https://github.com/iiab/iiab

**Qué hace:** "Learning hotspot" — un Raspberry Pi que actúa como punto de acceso
WiFi y sirve contenido educativo completo offline: Wikipedia en cualquier idioma,
miles de videos de Khan Academy, OpenStreetMap zoomable, libros electrónicos,
WordPress para journaling, proyectos de electrónica "Toys from Trash", y más.

**Características innovadoras:**
- **"Biblioteca de Alejandría digital" portátil:** Todo en una caja que cabe en
  una mochila.
- **Instalador automatizado:** Script que descarga e instala todo en un SD.
- **OpenStreetMap offline completo:** Mapas navegables sin GPS/internet — crucial
  para geografía y orientación en zonas rurales.
- **WordPress local:** Permite que estudiantes y docentes escriban blogs/diarios
  offline que luego se pueden publicar al conectarse.
- **"Toys from Trash":** Proyectos educativos de electrónica con materiales
  reciclados (Arvind Gupta).
- **Costo ultrabajo:** ~$35-50 USD en hardware Raspberry Pi.

**Aplicación a EduConect:**
- El concepto de hotspot WiFi + portal cautivo es la arquitectura que EduConect debe
  adoptar.
- Mapas offline de La Guajira con OSM serían revolucionarios para geografía local.
- WordPress local como herramienta de escritura creativa y bitácora de aprendizaje.
- Contenido multimedia curado (videos, libros).

---

## 4. RACHEL — World Possible ⭐⭐⭐⭐

**Sitio:** https://rachel.worldpossible.org/
**Wikipedia:** https://en.wikipedia.org/wiki/World_Possible

**Qué hace:** Remote Area Community Hotspot for Education and Learning. Servidor
portátil (Raspberry Pi o Intel CAP) con batería que crea un punto de acceso WiFi y
sirve copias offline de los mejores sitios educativos: Khan Academy, Wikipedia,
Project Gutenberg, PhET simulaciones, Great Books of the World, y más de 100
módulos.

**Características innovadoras:**
- **Alimentado por batería:** Diseñado para llevarse a cualquier parte sin
  electricidad.
- **Plug-and-play:** Cero configuración. Se prende, crea WiFi, y listo.
- **Módulos intercambiables:** Más de 100 módulos de contenido que se pueden
  instalar según necesidad (matemáticas, ciencias, salud, agricultura, etc.).
- **Contenido en múltiples idiomas:** Incluye español.
- **Interfaz web simple:** Cualquier navegador accede al contenido sin apps.
- **Usado en Kenya, Uganda, Tanzania, Guatemala** — territorios con desafíos
  similares a La Guajira.

**Aplicación a EduConect:**
- El diseño "battery-powered + portable" es referencia directa para el hardware de
  EduConect (Raspberry Pi con batería + panel solar).
- El modelo de módulos intercambiables permite personalizar contenido por escuela.
- Su simplicidad plug-and-play debe ser emulada.

---

## 5. MOODLEBOX — Moodle Offline en Raspberry Pi ⭐⭐⭐⭐

**Sitio:** https://moodlebox.net/
**GitHub:** https://github.com/moodlebox/moodlebox

**Qué hace:** Moodle completo corriendo en un Raspberry Pi como servidor offline.
Combina un punto de acceso WiFi con un LMS Moodle funcional, sin internet. Soporta
~20-30 estudiantes simultáneos.

**Características innovadoras:**
- **LMS completo offline:** Moodle es el estándar de facto en LMS open source; tenerlo
  offline en una Raspberry Pi es revolucionario para zonas rurales.
- **Plugin de administración GUI:** Panel web para monitorear hardware, reiniciar, y
  cambiar configuraciones del Raspberry Pi.
- **Instalación simple:** Se instala con Raspberry Pi Imager, como cualquier SO.
- **App de Moodle funcional:** La app móvil de Moodle se conecta al MoodleBox
  local.
- **Gestión de cursos, calificaciones, foros, tareas:** Todo lo que Moodle ofrece,
  offline y portátil.

**Aplicación a EduConect:**
- Inspiración directa para el módulo LMS de EduConect.
- Validación de que un LMS completo CORRE en Raspberry Pi con 20-30 usuarios.
- Integrar funcionalidad tipo Moodle pero con interfaz más simple y adaptada.
- Panel de administración GUI — característica necesaria.

---

## 6. KA LITE — Khan Academy Offline ⭐⭐⭐⭐

**Sitio histórico:** Khan Academy Lite (precursor de Kolibri)
**Artículo:** https://www.raspberrypi.com/news/guest-post-from-khan-academy-lite/

**Qué hace:** Versión offline de Khan Academy corriendo en Raspberry Pi. Sirve videos
y ejercicios de matemáticas, ciencias, y más, con seguimiento de progreso.
Eventualmente evolucionó en Kolibri pero el concepto permanece.

**Características innovadoras:**
- **Videos + ejercicios interactivos offline:** El modelo pedagógico de Khan Academy
  (video corto + práctica) disponible sin internet.
- **Seguimiento de progreso local:** Cada estudiante avanza a su ritmo, con analytics.
- **Costo mínimo:** Corre en una Raspberry Pi de $35.
- **Usado en prisiones de Idaho, Bhutan, y zonas rurales de India.**

**Aplicación a EduConect:**
- El modelo "video corto + ejercicio" es ideal para aprendizaje autodirigido.
- Analytics offline de progreso por estudiante.
- Contenido de matemáticas en español — fundamental para La Guajira.

---

## 7. SUGAR / SUGARIZER — Plataforma de Aprendizaje OLPC ⭐⭐⭐⭐

**Sitio:** https://sugarlabs.org/
**Wikipedia:** https://en.wikipedia.org/wiki/Sugar_(desktop_environment)

**Qué hace:** Plataforma de aprendizaje desarrollada para el proyecto One Laptop Per
Child (OLPC). Entorno de escritorio diseñado para niños con actividades educativas
colaborativas. Sugarizer lo porta a web (HTML5/JS), funcionando en navegador y
offline.

**Características innovadoras:**
- **Diseñado específicamente para niños:** Interfaz colorida, intuitiva, centrada en
  la exploración.
- **Aprendizaje colaborativo:** Varios niños pueden compartir actividades por red
  local.
- **Actividades (no "aplicaciones"):** +100 actividades educativas: Turtle Art
  (programación visual), Música, Física, Matemáticas.
- **Journal (diario):** Cada actividad se guarda automáticamente en un diario
  progresivo.
- **Sugarizer:** Funciona en navegador web, tablets, Android, iOS, y offline.
- **InfoSlicer:** Herramienta para que docentes empaquen contenido web para
  uso offline.
- **Basado en la filosofía construccionista de Seymour Papert.**

**Aplicación a EduConect:**
- La metáfora del "Journal" (diario automático de aprendizaje) es brillante para
  portafolio estudiantil.
- Sugarizer podría ser un frontend alternativo muy amigable.
- Turtle Art enseña pensamiento computacional visual — sin código escrito.
- Aprendizaje colaborativo por red local (sin internet).

---

## 8. GCOMPRIS — Suite Educativa para Niños 2-10 ⭐⭐⭐

**Sitio:** https://gcompris.net/
**GitHub:** https://github.com/KDE/gcompris

**Qué hace:** Software educativo de alta calidad con más de 100 actividades para
niños de 2 a 10 años. Cubre matemáticas, lectura, ciencias, geografía, ajedrez,
música, memoria, y más.

**Características innovadoras:**
- **+100 actividades offline:** Sin necesidad alguna de internet.
- **Gamificación educativa:** Actividades lúdicas pero pedagógicamente sólidas.
- **Multilingüe:** Disponible en español y 50+ idiomas.
- **Corre en Raspberry Pi:** Versión optimizada para hardware modesto.
- **Niveles de dificultad progresivos:** Adaptable a cada niño.
- **Totalmente gratuito y open source (AGPL).**

**Aplicación a EduConect:**
- Perfecto para módulo de educación infantil y primaria temprana.
- Actividades de lectoescritura y matemáticas básicas — críticas en zonas donde hay
  alto analfabetismo funcional.
- Se puede empaquetar como actividad complementaria en EduConect.

---

## 9. ENDLESS OS / ENDLESS KEY ⭐⭐⭐⭐

**Sitio:** https://endlessos.org/
**Endless Key:** USB educativo offline

**Qué hace:** Sistema operativo basado en Linux diseñado para educación offline.
Endless Key es un USB que convierte cualquier computadora (Windows/Mac) en un
entorno de aprendizaje offline con contenido educativo curado.

**Características innovadoras:**
- **Sistema inmutable:** El SO no se puede romper (OSTree) — ideal para contextos
  sin soporte técnico.
- **Contenido pre-cargado masivo:** Wikipedia, Khan Academy, juegos educativos,
  herramientas de programación, todo offline desde el primer arranque.
- **Endless Key:** USB booteable que no modifica la máquina host. Solo insertar y
  reiniciar.
- **Alianza con Common Sense y Learning Equality:** Contenido curado de calidad.
- **Diseñado para familias sin computadora previa.**

**Aplicación a EduConect:**
- El concepto de "USB que convierte cualquier PC en una estación educativa" es
  poderoso.
- SO inmutable que los niños no pueden romper — referencia de confiabilidad.
- Contenido pre-cargado diverso que se puede explorar libremente.

---

## 10. OPPIA / OPPIAMOBILE — Tutor Interactivo Offline ⭐⭐⭐

**Sitio:** https://www.oppia.org/
**GitHub:** https://github.com/oppia/oppia-android

**Qué hace:** Plataforma que crea "explorations" — lecciones interactivas que simulan
conversación uno a uno con un tutor. OppiaMobile es la versión Android offline-first
diseñada para capacitación en salud en zonas de baja conectividad.

**Características innovadoras:**
- **Modelo de tutor conversacional:** Identifica errores comunes y da feedback
  personalizado, como un tutor real.
- **Offline-first Android:** Descarga lecciones y las ejecuta completamente offline.
- **Sincronización diferida:** Datos de progreso se sincronizan cuando hay
  conectividad.
- **Fácil de compartir:** Una app que se puede distribuir entre miembros del hogar.
- **Creador de lecciones visual:** No requiere programación para crear contenido.

**Aplicación a EduConect:**
- El modelo de "tutor conversacional" con feedback adaptativo es referente
  pedagógico.
- La capacidad de crear contenido local sin programar (docentes crean sus propias
  lecciones).
- Sincronización offline→online para analytics.

---

## 11. PhET INTERACTIVE SIMULATIONS ⭐⭐⭐

**Sitio:** https://phet.colorado.edu/en/offline-access
**Universidad de Colorado Boulder**

**Qué hace:** Simulaciones interactivas gratuitas de matemáticas y ciencias (física,
química, biología, ciencias de la tierra). Fundado por el Nobel Carl Wieman. Todas
las simulaciones HTML5 se pueden descargar para uso offline.

**Características innovadoras:**
- **Simulaciones basadas en investigación educativa:** Cada simulación fue validada
  pedagógicamente.
- **Aprendizaje por descubrimiento:** Entorno game-like donde los estudiantes
  exploran y entienden conceptos.
- **Offline completo:** Se descarga el HTML y funciona en navegador sin conexión.
- **+160 simulaciones** cubriendo todo el espectro STEM.
- **Funcionan en tablets y celulares** (HTML5).

**Aplicación a EduConect:**
- Fundamental para el módulo de ciencias. En zonas sin laboratorio, las simulaciones
  reemplazan experimentos físicos.
- Pueden empaquetarse y distribuirse como contenido estático HTML.
- Ya existe como canal de Kolibri — integración posible.

---

## 12. WROLPi — Biblioteca Digital Off-Grid ⭐⭐⭐

**Sitio:** https://wrolpi.org/
**GitHub:** wrolpi/wrolpi

**Qué hace:** Plataforma para crear tu propia biblioteca digital off-grid en
Raspberry Pi. Indexa videos, archivos web, PDFs, eBooks con búsqueda de texto
completo — todo sin internet.

**Características innovadoras:**
- **Búsqueda full-text offline:** Indexa y permite buscar dentro de PDFs, ebooks,
  páginas web archivadas.
- **Archivo web offline:** Descarga sitios completos y los sirve localmente.
- **Gestión de medios:** Videos, documentos, imágenes — un media center educativo.
- **Diseñado para supervivencia/preppers** pero perfectamente adaptable a educación.

**Aplicación a EduConect:**
- La búsqueda full-text es una killer feature: permite a estudiantes investigar
  dentro de TODO el contenido offline.
- Archivo web de sitios educativos relevantes.
- Podría ser el motor de búsqueda local de EduConect.

---

## 13. SMART OFFLINE LMS (GitHub) ⭐⭐⭐

**GitHub:** https://github.com/ThisandaNinduwara/Smart-Offline-Learning-Management-System-LMS-using-Raspberry-Pi

**Qué hace:** LMS offline en Raspberry Pi que crea una red WiFi para quizzes,
leaderboards en tiempo real, y detección de enfoque — todo sin internet. Diseñado
para educación rural, exámenes seguros, y escenarios de desastre.

**Características innovadoras:**
- **Quizzes y leaderboards en tiempo real:** Gamificación competitiva local.
- **Detección de enfoque:** Usa cámara para verificar que el estudiante está
  prestando atención (controversial pero innovador).
- **Red WiFi cautiva:** Portal donde los estudiantes solo pueden acceder al LMS.
- **"Classroom-in-a-box" portátil.**

**Aplicación a EduConect:**
- El modelo de quizzes + leaderboards para gamificación es directamente aplicable.
- La metáfora "classroom-in-a-box" es exactamente lo que queremos para EduConect.
- La detección de enfoque es debatible éticamente, pero podría adaptarse como
  "verificación de presencia" en exámenes.

---

## TABLA COMPARATIVA

| Proyecto | Corre en RPi | Offline-first | Contenido en español | LMS | Sinc. diferida | Gamificación |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|
| Kolibri | ✅ | ✅ | ✅ | ✅ | ✅ | Parcial |
| Kiwix | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| IIAB | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| RACHEL | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| MoodleBox | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| KA Lite | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Sugar/Sugarizer | ✅ | ✅ | ✅ | Parcial | ❌ | ✅ |
| GCompris | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Endless OS | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| OppiaMobile | ❌ | ✅ | Parcial | ❌ | ✅ | ✅ |
| PhET | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| WROLPi | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Smart LMS (GitHub) | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |

---

## RECOMENDACIONES PARA EDUCONECT RURAL

### Arquitectura base inspirada en los mejores:
1. **Hardware:** Raspberry Pi 5 + panel solar + batería (inspirado en RACHEL)
2. **Hotspot WiFi + portal cautivo** (inspirado en IIAB y MoodleBox)
3. **Contenido offline curado por canales** (inspirado en Kolibri)
4. **Base de conocimiento Wikipedia/Books** (inspirado en Kiwix)
5. **LMS ligero con quizzes y analytics** (inspirado en MoodleBox + Smart LMS)
6. **Sincronización diferida P2P** (inspirado en Kolibri y OppiaMobile)
7. **Gamificación y actividades interactivas** (inspirado en GCompris + Sugar)
8. **Simulaciones STEM offline** (Inspirado en PhET)
9. **Búsqueda full-text offline** (inspirado en WROLPi)
10. **Interfaz amigable para niños** (inspirado en Sugar y Endless OS)

### Características únicas que EduConect podría desarrollar:
- **Contenido en wayuunaiki:** Ninguno de los proyectos arriba tiene lenguas
  indígenas colombianas.
- **Integración con saberes ancestrales:** Conocimiento tradicional wayuu como
  módulo de contenido.
- **Sistema de micro-certificaciones offline:** Badges/bloqueos que se sincronizan
  al conectarse.
- **Modo "maestro itinerante":** Un Raspberry Pi que viaja entre rancherías
  llevando datos y contenido.
- **Versión ultra-ligera para Raspberry Pi Zero 2 W** (~$15 USD).
