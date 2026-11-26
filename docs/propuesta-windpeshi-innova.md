# Propuesta Técnica — EDUConect Windpeshi

**Adaptación de la plataforma educativa offline-first EDUConect a la iniciativa «Formando en la Diversidad – Windpeshi INNOVA»**

| Campo | Valor |
|---|---|
| Documento | Propuesta técnica y de alcance |
| Versión | 0.2 — incorpora reparto por desarrollador, contratos de integración y plan de sprints |
| Fecha | Noviembre de 2026 |
| Base de evidencia | Auditoría read-only del repositorio, rama `fix/portable-runtime-baseline`, commit `a27adec` (`docs/diagnostico-2026-11-25.md`) |
| Documento de referencia | «Formando en la Diversidad – Windpeshi INNOVA. Anexos técnicos» (Plan de trabajo, roles, matriz de entregables, matriz de riesgo, inventario de aportes) |
| Documento asociado | `docs/contratos-integracion.md` — contratos de identidad, datos, API y frontera de Firebase, de obligada lectura antes de implementar sincronización |
| Seguimiento de ejecución | `odd/tasks/fase0-estabilizacion.md` |
| Naturaleza | Borrador técnico. No constituye oferta, ni concepto jurídico, ni compromiso contractual |

---

## 1. Resumen ejecutivo

La iniciativa Windpeshi INNOVA exige 27 productos agrupados en 8 componentes. EDUConect, en su estado actual verificado, cubre funcionalmente una parte acotada de ese universo: un aula offline operativa, un panel administrativo, un motor de evaluaciones y una base documental bilingüe de consulta. No cubre el canal de WhatsApp, el asistente de información oficial, el registro de inquietudes comunitarias, la sincronización entre nodos ni el dashboard territorial.

Esta propuesta no plantea construir una plataforma nueva. Plantea tres operaciones secuenciales:

1. **Estabilizar** lo que existe, porque hoy no arranca en una instalación limpia fuera de Docker y sus 13 módulos 3D no son alcanzables en el hardware objetivo.
2. **Ampliar** EDUConect con las capacidades que Windpeshi exige y que hoy no existen.
3. **Declarar explícitamente lo que no se construye**, para que el alcance contractual no prometa productos que dependen de equipos pedagógicos o institucionales y no de desarrollo de software.

El resultado es un activo digital reutilizable para Ecopetrol, con un núcleo demostrable en fase 1 y una ruta de ampliación verificable.

### 1.1. Advertencia de alcance

De los 27 entregables del documento de referencia: **4 tienen base sólida en el software actual, 10 son adaptables con trabajo sustancial, 3 son de desarrollo nuevo y 10 no son productos de software** (son entregables pedagógicos, institucionales o de gobierno del proyecto). Cualquier propuesta que se presente como «27 productos con un equipo de tres personas de desarrollo» no es defendible en mesa técnica.

La sección 6 detalla esta clasificación entregable por entregable.

---

## 2. Punto de partida verificado

Todo lo afirmado en esta sección proviene de lectura de código y estructura del repositorio. Lo que no pudo verificarse se marca como tal y no debe tratarse como hecho.

### 2.1. Inventario de capacidades existentes

| Capacidad | Estado | Evidencia |
|---|---|---|
| Servidor HTTP en Rust (Axum) | Operativo en Docker | `edu-conect-rural-server/src/main.rs` |
| Base de datos SQLite con WAL | Operativo | `src/db.rs`; `migrations/` |
| Autenticación con JWT | Implementada | `src/auth.rs` |
| Control de tasa de peticiones | Implementado | `src/rate_limit.rs` |
| Catálogo de 61 módulos educativos | Presente en disco | 56 directorios con `index.html` + 5 simulaciones PhET |
| 13 módulos 3D con three.js r128 local | Código correcto, sin CDN, geometría procedural | `modulos/comun/three.min.js`; `modulos/cie-40*/app.js` |
| Motor de evaluaciones con puntuación | Implementado | `src/quiz.rs`; `migrations/005_quizzes.sql` |
| Seguimiento de progreso | Implementado | tabla `progreso` |
| Panel administrativo y de docentes | Implementado | tablas `admin_usuarios`; rutas `/admin`, `/api/profesor` |
| Biblioteca documental con servido por rangos | Implementado | `/biblioteca/{*path}`, `src/main.rs:573-663` |
| Búsqueda de texto completo (FTS) | Implementada | `/api/buscar`; `seeds/005_biblioteca_fts.sql` |
| Diccionario español–wayuunaiki | Tabla y datos base presentes | `seeds/006_diccionarios.sql` |
| Lector ZIM (contenido offline tipo Wikipedia) | Implementado, dependencia nativa | `src/zim_proxy.rs` |
| Síntesis de voz (TTS) | Implementada, con defecto de configuración | `/api/tts`, `src/main.rs:870` |
| Dashboard web | Export estático de Next.js | `edu-conect-rural-dashboard/next.config.mjs` |
| Investigación curricular y etnoeducativa propia | Documentada | `investigacion_etnoeducacion_wayuu.md`, `investigacion_curriculo_guajira.md` |
| Documentación técnica | Existente, requiere actualización | `README.md` (27 KB), `DEPLOY.md`, `reporte-integracion-local.md` |

### 2.2. Capacidades inexistentes

Verificado por búsqueda en `edu-conect-rural-server/src`: **no existe ninguna referencia a WhatsApp, Twilio, chatbot, LLM u OpenAI**. Tampoco existen tablas de preguntas frecuentes, inquietudes comunitarias, territorialidad ni auditoría de accesos.

Concretamente, no existe:

- Integración con WhatsApp ni pasarela de mensajería.
- Asistente conversacional de información oficial.
- Banco de preguntas frecuentes gobernado.
- Registro y seguimiento de inquietudes comunitarias.
- Sincronización entre nodos offline y un sistema central.
- Analítica territorial (solo existe analítica educativa de progreso y evaluaciones).
- Gestión de comunicados oficiales y su flujo de aprobación.
- Auditoría de accesos, retención y anonimización de datos personales.
- Certificación formal del aprendizaje (existe puntuación, no certificado).

### 2.3. Bloqueantes de despliegue (P0)

Estos defectos no son funcionalidades faltantes: son condiciones para que la solución exista en el territorio. Fueron identificados en la auditoría de noviembre de 2026 por lectura de código y deben confirmarse en runtime.

| # | Defecto | Evidencia | Consecuencia |
|---|---|---|---|
| 1 | El servidor termina con pánico al iniciar en instalación limpia: `JWT_SECRET` es obligatorio y `install.sh` no lo provisiona | `src/config.rs:20-27`; `install.sh:189-196` | Ningún nodo arranca tras una instalación nueva |
| 2 | `ADMIN_INITIAL_PASSWORD` vacío provoca error de apertura de base de datos | `src/db.rs:243-258`; `docker-compose.yml`; `.github/workflows/ci.yml:60-66` | El contenedor nunca alcanza estado saludable en volumen nuevo |
| 3 | `/modulos/*` responde 404 fuera de Docker: el servidor resuelve la ruta relativa al directorio de trabajo y el árbol vive en otro directorio | `src/main.rs:410`; `install.sh` no copia `modulos/` | Los 61 módulos educativos, incluidos los 13 en 3D, son inalcanzables en la Pi |
| 4 | `/static/*` responde 404 en la Pi | `src/main.rs:421`; `install.sh:191` | Interfaz sin hojas de estilo ni scripts |
| 5 | El layout de `install.sh` no coincide con la unidad de systemd | `install.sh:261-262` frente a `deploy/educonect.service:6,9` | Instalación inconsistente |
| 6 | La ruta `/api/cursos/{id}/archivo` no existe en el router | `static/js/curso-viewer.js:205,214,350` | Visor de PDF en blanco |
| 7 | 16 tarjetas de curso apuntan a slugs inexistentes | `seeds/002_modulos.sql:7-14,26-32,44` | Catálogo con enlaces muertos |

**Conclusión operativa:** cualquier demostración ante Ecopetrol debe ejecutarse sobre el hardware objetivo y no solo en Docker. Resolver los siete puntos anteriores es requisito previo a presentar «Aula Virtual en funcionamiento» como resultado alcanzado.

### 2.4. Objetivo de despliegue: una familia heterogénea, no un dispositivo

El hardware objetivo no es único. Se consideran tres entornos, en orden de probabilidad declarado por el equipo:

| Entorno | Sistema | Vía de instalación | Implicación |
|---|---|---|---|
| PC de escritorio o portátil | Linux | `install.sh` + systemd | Es el único entorno para el que hoy existe instalador |
| **PC de colegio o de docente** | **Windows (presumible)** | Paquete portable + lanzador | **No existe hoy: sin systemd, sin `install.sh`, sin hotspot** |
| Raspberry Pi | Linux ARM | Imagen preparada | Requiere resolver `libzim` en compilación cruzada |

Consecuencias que afectan el diseño y no solo el empaquetado:

1. **La raíz de aplicación no puede derivarse del directorio de trabajo.** En un acceso directo de Windows o en una unidad de systemd, el CWD difiere del directorio del ejecutable. Es la causa del 404 de `modulos/` y `static/`, y en Windows se agrava. La raíz debe derivarse de la ubicación del ejecutable, con anulación por variable de entorno.
2. **Las dependencias nativas son un problema por plataforma.** `libzim` se enlaza en compilación; `espeak-ng`, `ffmpeg` y `yt-dlp` se invocan como procesos externos. En Windows no están presentes por defecto. Debe declararse qué se degrada: biblioteca ZIM, síntesis de voz y conversión de video.
3. **La unidad systemd deja de ser la única fuente de verdad del arranque.** Se requiere un lanzador por plataforma y una definición única de la raíz.
4. **El hotspot de `install.sh` no aplica en un colegio**, donde ya existe red. El modo de acceso (solo local, red del colegio, hotspot propio) debe declararse por entorno.
5. **Firewall del sistema operativo.** En Windows las conexiones entrantes al puerto 8080 se bloquean por defecto: es un paso de instalación documentado, no un supuesto.

Un PC de colegio sin Internet es, en la práctica, el escenario más favorable para una plataforma offline-first. También es el escenario donde hoy no hay nada construido.

### 2.5. Deuda técnica relevante para el proyecto

| Tema | Estado | Implicación para Windpeshi |
|---|---|---|
| Compresión HTTP | No habilitada | `three.min.js` (589 KB) viaja sin comprimir por Wi-Fi comunitario |
| Dependencia nativa `libzim` | Requerida en compilación y ejecución | El cross-compile estático a `aarch64-musl` no es viable tal como está escrito |
| `next/font/google` | Se resuelve en tiempo de compilación | La compilación del frontend falla sin internet |
| Pruebas de integración | Montan su propio router, no el real | Ninguna ruta HTTP está cubierta por pruebas |
| CI | Ejecuta solo `--test integration_test` | Los pruebas unitarias quedan fuera de la integración continua |
| `modulos/` | Solo existe dentro de la imagen Docker | Agregar un módulo en la Pi exige reconstruir la imagen |

---

## 3. Principio rector

> **No se construye una plataforma nueva. Se estabiliza, se amplía y se declara el alcance.**

Tres consecuencias directas:

1. Toda funcionalidad nueva debe estar trazada a un entregable numerado del documento de referencia (P1–P27). No se agrega tecnología sin producto asociado.
2. Lo que hoy no funciona se reconoce como deuda, no se presenta como capacidad. El repositorio documenta un panel de administración y estadísticas educativas; ello no demuestra la existencia del dashboard territorial que Windpeshi solicita.
3. La distinción entre plataforma educativa y sistema de información territorial se explicita desde el diseño. Son dos productos con dos ciclos de vida y dos regímenes de datos.

---

## 4. Arquitectura propuesta

### 4.1. Modelo de dos entornos

```
┌──────────────────────────────────────────────────────────────────┐
│  ENTORNO COMUNITARIO — funciona sin Internet                      │
│                                                                   │
│  Usuarios: autoridades · comunidad adulta · estudiantes ·         │
│            docentes · facilitadores                               │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Nodo EDUConect Windpeshi  (Rust/Axum + SQLite)             │  │
│  │                                                              │  │
│  │  Aula offline          Contenido bilingüe      Aprendizaje   │  │
│  │  cursos, módulos 3D    español / wayuunaiki    evaluación    │  │
│  │  audio, video, PDF     validado culturalmente  progreso      │  │
│  │                                                              │  │
│  │  Escucha comunitaria (registro local, cola de salida)       │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Acceso por Wi-Fi local o red mesh del punto de servicio          │
└──────────────────────────────────────────────────────────────────┘
                             │
                             │  Sincronización por lotes
                             │  (cuando exista conectividad;
                             │   unidireccional en contenido,
                             │   bidireccional en inquietudes)
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  SERVICIOS CENTRALES — requiere Internet                          │
│                                                                   │
│  WhatsApp            Dashboard              Referencia            │
│  consultas y          indicadores            usuarios,           │
│  respuestas          territoriales           permisos,           │
│  oficiales                                   auditoría           │
│                                                                   │
│  Contenido oficial   Laboratorio de IA       Operación           │
│  publicación y       reglas, límites,        monitoreo y         │
│  flujo de aprobación evaluaciones            respaldo            │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2. Decisiones arquitectónicas

**D1 — El nodo offline es autónomo, no dependiente.** El aula, la evaluación y el registro de inquietudes funcionan íntegramente sin conectividad. La sincronización es una mejora, nunca una condición de operación.

**D2 — WhatsApp es complementario, no sustituto.** Sin conectividad, WhatsApp no funciona. El documento de referencia establece en R3 que los contenidos deben ser accesibles «incluso en condiciones de conectividad limitada», pero un canal de mensajería no puede garantizar ese resultado. El objetivo 1 se cumple con la conjunción aula offline + canal WhatsApp, y ninguna de las dos por separado.

**D3 — Tecnología base: la ya existente.** Rust/Axum + SQLite en el nodo, export estático en el frontend, WhatsApp Business API para el canal. La reescritura no está justificada: el núcleo educativo funciona y sus módulos 3D sin CDN son el activo más difícil de replicar del repositorio.

**D4 — Sincronización con reglas explícitas antes de implementarla.** Sin reglas no se escribe código de sincronización. El diseño mínimo exige:

- Identificador estable generado en el nodo para cada registro (no autoincremental), para evitar duplicados por reenvío.
- Registro de origen y de sello temporal de dispositivo, distinto del sello temporal del servidor central.
- Contenido en dirección central → nodo con versión y hash; el nodo no edita contenido oficial.
- Inquietudes en dirección nodo → central, con reintento idempotente y confirmación por lote.
- Registro de conflictos para inspección humana, sin resolución automática silenciosa.

**D5 — Separación estricta de dos regímenes de datos.** Los datos educativos (progreso, evaluaciones) y los datos personales de interacción (teléfono de WhatsApp, inquietudes, ubicación comunitaria) no comparten ciclo de vida, no comparten base ni acceso. Esta separación se define en el diseño, no se resuelve con permisos a posteriori.

**D6 — El asistente responde solo desde conocimiento aprobado.** El asistente de información oficial no genera información nueva sobre Windpeshi. Responde exclusivamente a partir de un banco de preguntas frecuentes validado y versionado, y ante ausencia de respuesta declara el límite y redirige a los canales oficiales. Esto da cumplimiento a R5 (desinformación) y a R16 (expectativas no resolubles) simultáneamente.

### 4.3. Flujo de actualización de contenido oficial

```
Econova valida  →  publicación versionada en central  →  distribución
    (P20)              (con hash por paquete)             a nodos
                                                              │
                                                              ▼
                                          nodo detecta nueva versión,
                                          descarga si hay conexión,
                                          aplica y registra la versión
```

Un nodo siempre es capaz de declarar qué versión de contenido está sirviendo. Sin esa trazabilidad, no es posible defender la integridad de la información entregada a las comunidades.

---

## 5. Roles del equipo de desarrollo

El documento de referencia asigna la ejecución integral a la Universidad de La Guajira, con componentes pedagógico, tecnológico y presencial. El componente tecnológico es responsabilidad de este equipo.

| Desarrollador | Foco | Responsabilidad |
|---|---|---|
| **1 — Firebase e integración central** | Capa de servicios centrales y sincronización | Configurar la capa central acordada; diseñar y demostrar sincronización idempotente; documentar arquitectura central, esquema y reglas de seguridad |
| **2 — Profesor–alumno** | Flujo educativo completo | Identidad y roles docentes/estudiantes, cursos, inscripciones, actividades, evaluaciones, progreso y reportes |
| **3 — Backend, estabilización e integración** | Fase 0, API, modelo de datos, seguridad, registro de inquietudes y coordinación | Bloqueantes de instalación; modelo de datos e identidad; contratos de integración; registro local de inquietudes y cola de salida; endpoints territoriales; coordinación de las integraciones |

**Regla de dependencia.** El Desarrollador 1 y el Desarrollador 2 no implementan colecciones centrales, identidad de estudiantes ni sincronización hasta que el Desarrollador 3 entregue los contratos de `docs/contratos-integracion.md` acordados. Es la aplicación directa del principio de no construir tres partes aisladas para unirlas después.

**Supuesto explícito:** este equipo de tres personas construye y opera el software. No diseña el currículo ni ejecuta el trabajo presencial. El equipo pedagógico de la Universidad produce rutas, módulos y materiales; este equipo los integra, los hace bilingües en la plataforma y los pone disponibles offline.

Si esa separación no se mantiene, el alcance de software debe reducirse en consecuencia.

---

## 6. Correspondencia con los 27 entregables

Clasificación por naturaleza del trabajo:

- **R — Reutiliza:** existe y funciona; requiere configuración o corrección menor. *(Ningún entregable alcanza hoy esta categoría: toda capacidad existente necesita trabajo adicional para el contexto Windpeshi.)*
- **A — Adapta:** existe la base; requiere trabajo de ampliación sustancial.
- **N — Nuevo:** no existe; requiere desarrollo desde cero.
- **S — No es software:** entregable pedagógico, institucional o de gobierno del proyecto.

| # | Entregable | Clase | Estado actual frente a Windpeshi |
|---|---|---|---|
| P1 | Dirección del proyecto | S | PM y cronograma; proceso |
| P2 | Comité de seguimiento | S | Informes; proceso |
| P3 | Canal oficial de WhatsApp | N | Inexistente. Requiere número, proveedor, alta, verificación |
| P4 | Banco de preguntas frecuentes | N | Inexistente. Requiere modelo, flujo de aprobación y carga |
| P5 | Aula Virtual y Chatbot | A | Aula existe y funciona offline; chatbot inexistente |
| P6 | Plataforma administrativa | A | Base administrativa existe; faltan gestión territorial, permisos y auditoría |
| P7 | Dashboard de indicadores | A | Datos educativos existen; analítica territorial inexistente |
| P8 | Arquitectura y documentación | A | Documentación base existe; requiere actualización al estado final |
| P9 | Ruta para autoridades y líderes | A | Módulos y motor existen; diseño curricular es del equipo pedagógico |
| P10 | Ruta para comunidades adultas | A | Ídem |
| P11 | Ruta para estudiantes | A | Ídem; los 61 módulos y 13 laboratorios 3D son la base natural |
| P12 | Ruta para docentes | A | Ídem; panel de docentes ya existe |
| P13 | Contenidos bilingües | A | Diccionario existe; contenidos bilingües no. Requiere validación cultural |
| P14 | Evaluaciones y certificación | A | Evaluación y puntuación existen; certificación formal no |
| P15 | Socialización del programa | S | Jornadas presenciales |
| P16 | Formación de facilitadores | S | Proceso |
| P17 | Círculos de reflexión | S | Proceso |
| P18 | Formación a docentes | S | Proceso |
| P19 | Actividades con estudiantes | S | Proceso |
| P20 | Validación de contenidos institucionales | S | Flujo institucional de Econova |
| P21 | Actualización de novedades | N | Requiere gestión de comunicados y aprobación |
| P22 | Articulación con VTT | S | Mesas de trabajo |
| P23 | Evaluación ex ante y ex post | A | Inexistentes línea base e instrumentos; requiere diseño metodológico |
| P24 | Análisis de uso e interacción | A | Progreso existe; reportes de participación e inquietudes no |
| P25 | Transferencia de capacidades | A | Proceso, apoyado en documentación y capacitación |
| P26 | Propiedad y escalabilidad | A | Código y arquitectura existen; entrega y cesión son decisión jurídica |
| P27 | Aprobación de entregables | S | Actas y procedimiento institucional |

**Totales sobre 27 entregables:** 14 adaptables —de los cuales 4 tienen base sólida (P5, P6, P8, P14) y 10 exigen ampliación sustancial (P7, P9, P10, P11, P12, P13, P23, P24, P25, P26)—, 3 de desarrollo nuevo (P3, P4, P21) y 10 no-software (P1, P2, P15, P16, P17, P18, P19, P20, P22, P27).

**Advertencia sobre las cifras poblacionales.** El documento de referencia menciona 1.112 adultos, 346 estudiantes y 14 comunidades. Esas cifras deben orientar la planificación, pero no deben confundirse con personas formadas ni con mejoras demostradas de aprendizaje. El indicador de «estudiantes impactados» (P19) exige definición operativa antes de reportarse.

---

## 7. Alcance por fases

### Fase 0 — Estabilización (requisito de entrada)

Sin esta fase no hay demostración defendible ni operación en territorio.

- Servir `modulos/`, `static/` y el frontend de forma independiente del directorio de trabajo, derivando la raíz de la ubicación del ejecutable.
- Alinear `install.sh` con la unidad de systemd y con una definición única de la raíz de aplicación.
- **Definir el paquete portable para Windows y su lanzador**, con la matriz de funciones que se degradan en esa plataforma.
- Provisionar `JWT_SECRET` con permisos restringidos y rotación documentada.
- Provisionar `ADMIN_INITIAL_PASSWORD` con cambio forzado en primer acceso.
- Implementar o corregir la ruta de descarga de archivos de curso.
- Re-sembrar el catálogo con los identificadores reales.
- Habilitar compresión HTTP.
- Confirmar en el hardware objetivo que los 13 módulos 3D cargan.

**Criterio de salida:** instalación limpia en al menos dos entornos de la familia objetivo (Linux y Windows); aula, catálogo de módulos, laboratorios 3D, evaluaciones y panel administrativo operativos sin Internet.

### Fase 1 — Núcleo Windpeshi

- Canal oficial de WhatsApp con menú de consulta sobre banco de preguntas frecuentes validado (P3, P4, parte de P5).
- Asistente acotado a conocimiento aprobado, con declaración explícita de límites y redirección a canales oficiales (P5, R5, R16).
- Registro de inquietudes comunitarias en el nodo, con cola de salida idempotente (objetivo 5).
- Dashboard mínimo: participación, avance formativo, consultas frecuentes e inquietudes por comunidad (P7, P24).
- Gestión de contenido oficial con versión, hash y flujo de aprobación (P20 técnico, P21).
- Rutas formativas por público montadas sobre los módulos existentes (P9–P12, integración).
- Evaluación inicial y final con reporte por participante (P14).

**Criterio de salida:** un nodo en territorio registra inquietudes sin conexión, las sincroniza al recuperar conectividad, y el dashboard central las muestra sin duplicados, con trazabilidad de versión de contenido.

### Fase 2 — Consolidación

- Sincronización multi-nodo con resolución de conflictos supervisada.
- Certificación formal y reconocimiento (P14 completo).
- Analítica avanzada e informes exportables (P7, P24 completos).
- Línea base, instrumentos y evaluación de impacto (P23).
- Endurecimiento de seguridad: auditoría de accesos, retención, anonimización.
- Transferencia formal, documentación final y plan de sostenibilidad (P25, P26, P8).
- Evaluación de escalabilidad a otros territorios.

### Fuera de alcance de esta propuesta

- Diseño curricular, producción pedagógica y validación cultural (equipo pedagógico de la Universidad).
- Ejecución de jornadas, círculos de reflexión y formación presencial (componente presencial).
- Definición de la titularidad jurídica y régimen de propiedad intelectual (decisión institucional y jurídica).
- Atención de PQR y solicitudes individuales: el asistente redirige, no resuelve (R16).
- Operación del canal WhatsApp como canal de servicio al cliente.

---

## 8. Riesgos técnicos y mitigación

Se conservan los códigos de la matriz de riesgo del documento de referencia y se agregan los riesgos propios del software.

| # | Riesgo | Nivel | Mitigación propuesta | Verificación |
|---|---|---|---|---|
| R2 | Baja adopción de la herramienta digital | Alto | Interfaz para adultos y autoridades, no solo estudiantes; contenidos audiovisuales; capacitación de usuarios clave; componente presencial obligatorio | Tasa de uso por comunidad y por perfil, no solo registros |
| R3 | Limitaciones de conectividad | Alto | Nodo offline autónomo; contenido liviano; compresión HTTP; prioridad a audio descargable | Prueba en terreno sin conectividad |
| R5 | Desinformación sobre Windpeshi | Alto | Asistente restringido a banco aprobado y versionado; sin generación libre; actualización con trazabilidad de versión | Prueba adversarial de respuestas fuera de alcance |
| R8 | Retrasos en el desarrollo tecnológico | Medio | Fase 0 cerrada antes de iniciar fase 1; hitos con criterio de salida verificable | Revisión mensual contra criterios de salida |
| R9 | Dependencia del proveedor tecnológico | Alto | Repositorio, arquitectura y manuales desde el inicio; transferencia progresiva, no al final | Compilación reproducible por personal de Ecopetrol |
| R10 | Pérdida o uso inadecuado de información de usuarios | Alto | Separación de regímenes de datos (D5); control de acceso; respaldo; anonimización en analítica | Revisión de accesos y prueba de restauración |
| R15 | La solución no escala a otros territorios | Medio | Arquitectura parametrizable por territorio; contenido versionado separable del código | Segundo nodo desplegado sin cambios de código |
| R16 | Expectativas de atención no resolubles | Alto | Alcance del asistente declarado al usuario desde el primer mensaje; redirección a canales oficiales | Guion de respuesta ante solicitud individual |
| R17 | Baja sostenibilidad tras el proyecto | Alto | Plan de operación y mantenimiento con alcance, niveles de servicio y responsable de pago definidos antes de la entrega | Documento aprobado y financiado, no declaración de intención |
| **T1** | **Despliegue no reproducible fuera de Docker** | **Alto** | Fase 0; rutas independientes del directorio de trabajo; instalación verificada en hardware objetivo | Instalación limpia exitosa en al menos dos plataformas (Linux y Windows), registrada |
| **T2** | **Sincronización con duplicados o pérdida de registros** | **Alto** | Reglas D4 definidas antes de implementar; identificadores estables; confirmación por lote; bitácora de conflictos | Prueba con dos nodos, desconexión y reconexión |
| **T3** | **Compilación del frontend dependiente de Internet** | **Medio** | Sustituir la carga de fuentes en tiempo de compilación por recursos locales | Compilación exitosa sin red |
| **T4** | **Dependencia nativa `libzim` y compilación cruzada** | **Medio** | Compilación dinámica verificada o retiro de la dependencia si no se usa en producción | Artefacto desplegable en arquitectura objetivo |
| **T5** | **Ausencia de pruebas sobre rutas reales** | **Alto** | Pruebas contra el router de producción; integración continua con todos los objetivos de prueba; humo por módulo 3D | Fallo intencional detectado por la suite |
| **T6** | **Propiedad intelectual no resuelta** | **Alto** | Inventario de activos preexistentes y licencia escrita antes del primer commit de ampliación | Documento firmado previo al inicio de fase 1 |

---

## 9. Requisitos no funcionales y cumplimiento de los vacíos señalados en revisión

El anexo de revisión de la Coordinación de PI y Transferencia identifica 16 vacíos. Los que tienen consecuencia técnica directa se abordan así:

### 9.1. Protección de datos (comentario 8)

- **Separación de regímenes:** datos educativos y datos de interacción comunitaria en almacenes distintos, con finalidades declaradas por separado.
- **Minimización:** el canal de WhatsApp no solicita identificación nominativa para consultas informativas; el número se conserva solo si el usuario requiere seguimiento de su inquietud.
- **Retención definida:** plazo por tipo de dato, con eliminación programada y verificable, no manual.
- **Anonimización en analítica:** el dashboard trabaja sobre agregados; los identificadores directos no son visibles para el equipo de análisis.
- **Roles y accesos:** administrador, gestor territorial y analista con permisos distintos y registro de auditoría por acceso.
- **Incidentes:** procedimiento de notificación con responsable y plazo definidos.
- **Encargados y proveedores:** el proveedor de WhatsApp y el proveedor de infraestructura quedan identificados como encargados con obligaciones documentadas.

Previo a la puesta en operación del canal de WhatsApp se requiere validación jurídica del instrumento de tratamiento de datos.

### 9.2. Uso de IA y asistente conversacional (comentario 9)

- **Tecnología:** asistente restringido a recuperación sobre el banco de preguntas frecuentes aprobado. No se emplea generación libre de información sobre el proyecto Windpeshi.
- **Fuentes:** únicamente contenido validado y versionado por Econova. Cada respuesta declara la versión del contenido en que se basa.
- **Control de respuestas:** ante ausencia de coincidencia, el asistente declara no disponer de información oficial y redirige a los canales definidos. No improvisa.
- **Datos enviados a proveedores:** se documenta qué texto se transmite a servicios externos y qué se conserva localmente. Ningún dato personal identificable se envía a un proveedor de modelos sin base jurídica explícita.
- **Registros:** bitácora de consultas, respuestas entregadas y versiones de contenido, con retención acorde a la política definida.
- **Actualización de contenidos:** flujo con aprobación, versión y publicación registrada (sección 4.3).
- **Límites de alcance:** declarados al usuario desde el primer contacto (R16).

### 9.3. Validación cultural y lingüística (comentario 10)

- **Responsables:** intérpretes y validadores culturales definidos por el equipo pedagógico; este equipo no los designa.
- **Aprobación:** ningún contenido bilingüe se publica sin registro de aprobación del validador.
- **Reconocimiento y costos:** fuera del alcance de software; deben quedar en el instrumento contractual.
- **Autorizaciones de materiales comunitarios:** se requiere consentimiento documentado para material, audio o imagen de origen comunitario. La plataforma conservará el registro de autorización asociado al recurso.

### 9.4. Propiedad intelectual y activos (comentarios 1, 2, 4, 5)

El punto de partida no es neutro: **EDUConect es software preexistente**. La entrega de código fuente no constituye por sí sola una cesión. Se propone:

**A — Inventario de activos preexistentes** (a presentar antes del inicio de la fase 1):

| Activo preexistente | Naturaleza |
|---|---|
| Servidor Rust/Axum (auth, base de datos, evaluaciones, búsqueda, ZIM, TTS) | Software de la Universidad |
| 61 módulos educativos y 13 laboratorios 3D | Contenido y código de la Universidad |
| Diccionario español–wayuunaiki y datos base | Base de datos de la Universidad |
| Investigación curricular y etnoeducativa documentada | Conocimiento de la Universidad |
| Dashboard Next.js | Software de la Universidad |

**B — Resultados nuevos de la iniciativa:** canal WhatsApp, banco de preguntas frecuentes, asistente, registro de inquietudes, sincronización, dashboard territorial, contenidos específicos de Windpeshi.

**C — Matriz de contribuciones de terceros:** autores de contenido, desarrolladores, docentes, estudiantes, contratistas, traductores y validadores, con verificación de contratos y autorizaciones.

**D — Licencia de uso:** se propone licencia de uso institucional para Ecopetrol sobre los resultados nuevos, con derecho de modificación y despliegue, y licencia limitada sobre los activos preexistentes necesarios para operar, sin transferencia de titularidad salvo acuerdo expreso.

Esta propuesta técnica no define el régimen jurídico. Lo delimita técnicamente para que la decisión jurídica sea informada.

### 9.5. Mantenimiento y sostenibilidad (comentarios 7 y 15; riesgo R17)

El documento de referencia establece soporte durante la ejecución y dos años posteriores. Para que esa obligación sea ejecutable debe definir:

- Fecha de inicio y de finalización del período de soporte.
- Alcance: corrección de defectos, actualización de contenido, actualización de seguridad, cambios evolutivos. Son categorías distintas con costos distintos.
- Niveles de servicio: tiempo de respuesta y de restauración por severidad.
- Infraestructura: quién aloja los servicios centrales, quién paga mensajería, almacenamiento y licencias.
- Costos recurrentes identificados: WhatsApp Business API, alojamiento central, respaldo, dominio y certificados.
- Responsable de pago por concepto.
- Plan de salida: qué ocurre con los datos, cómo se exportan y en qué plazo ante terminación anticipada.

Sin esta definición, R17 no se mitiga: se posterga.

---

## 10. Indicadores y evaluación

Los indicadores deben distinguir tres cosas que el documento de referencia mantiene juntas: **registrados**, **formados** y **con aprendizaje demostrado**.

| Dimensión | Indicador propuesto | Fuente | Verificación |
|---|---|---|---|
| Cobertura | Comunidades con nodo activo | Registro de nodos | Conteo de nodos operando en las últimas 4 semanas |
| Participación | Personas con al menos una actividad completada | Base de progreso | Distinto del total de registrados |
| Aprendizaje | Diferencia entre evaluación inicial y final | Motor de evaluaciones | Diferencia por participante, no promedio agregado |
| Acceso sin conexión | Porcentaje de actividad registrada en modo offline | Bitácora del nodo | Requiere instrumentación en fase 1 |
| Escucha | Inquietudes registradas y cerradas con respuesta | Módulo de inquietudes | Con tiempo medio de respuesta |
| Pertinencia | Contenidos aprobados por validador cultural | Registro de aprobación | 100 % de contenidos publicados con aprobación |
| Información oficial | Consultas respondidas desde banco aprobado | Bitácora del asistente | Porcentaje de respuestas con fuente versionada |
| Sostenibilidad | Actualizaciones aplicadas sin intervención del proveedor | Bitácora de nodos | Prueba realizada por personal de Ecopetrol |

La línea base (P23) debe levantarse **antes** de la primera intervención. Si se levanta después, no es línea base: es un registro de actividad.

---

## 11. Cronograma propuesto

Supuesto: arranque en el primer trimestre de 2027, con la continuidad operativa proyectada por el riesgo R17 hasta diciembre de 2027. Las duraciones son estimaciones sujetas a la firma del convenio y a la disponibilidad del equipo pedagógico.

| Fase | Duración estimada | Dependencia crítica |
|---|---|---|
| Fase 0 — Estabilización | 4 a 6 semanas | Acceso al hardware objetivo y al entorno de despliegue |
| Fase 1 — Núcleo Windpeshi | 4 a 5 meses | Banco de preguntas frecuentes validado por Econova; validación jurídica de datos y WhatsApp |
| Fase 2 — Consolidación | 4 a 5 meses | Línea base levantada; definición de niveles de servicio y modelo de sostenibilidad |

**Condición de secuencia:** la fase 1 no inicia sin banco de preguntas frecuentes aprobado y sin validación jurídica de protección de datos y de la integración con WhatsApp. Construir el canal antes de tener el conocimiento gobernado produce exactamente el riesgo R5.

---

## 12. Supuestos y decisiones pendientes

### Supuestos

1. La Universidad dispone del componente pedagógico para producir rutas, contenidos y materiales; este equipo los integra.
2. Econova provee y opera el número oficial de WhatsApp y asume el costo del proveedor de mensajería.
3. Existe hardware de al menos dos entornos de la familia objetivo (Linux y Windows) disponible para la fase 0 y para la operación en territorio.
4. La conectividad en territorio es intermitente, no nula: la sincronización por lotes es viable.
5. El equipo de desarrollo es de tres personas con dedicación definida en el instrumento contractual.

### Decisiones pendientes (no las resuelve este documento)

| # | Decisión | A cargo de |
|---|---|---|
| 1 | Régimen de propiedad intelectual y licencia de activos preexistentes | Jurídica y coordinación de PI y Transferencia |
| 2 | Validador jurídico del tratamiento de datos personales | Jurídica |
| 3 | Proveedor de WhatsApp y modelo de costos | Econova |
| 4 | Alcance exacto del período de mantenimiento y responsable de pago | Econova y Universidad |
| 5 | Designación de intérpretes y validadores culturales | Equipo pedagógico |
| 6 | Definición operativa del indicador de «estudiantes impactados» | Coordinación del proyecto |
| 7 | Confirmación de los siete bloqueantes de despliegue en runtime sobre hardware objetivo | Equipo de desarrollo |

---

## 13. Cierre

La propuesta se sostiene en tres afirmaciones verificables:

1. **Existe una base real que justifica la adaptación y no la reconstrucción.** Sesenta y un módulos educativos, trece laboratorios 3D sin dependencia de CDN, motor de evaluación, panel administrativo, diccionario bilingüe e investigación curricular propia. Es un punto de partida, no una promesa.
2. **Existe una brecha declarada.** El canal de WhatsApp, el asistente, el registro de inquietudes, la sincronización y la analítica territorial no existen y se construirán. Presentarlos como existentes es el camino más corto a perder credibilidad en la mesa técnica.
3. **Existen dos riesgos que deben resolverse antes de presentar resultados: el despliegue no reproducible y la propiedad intelectual no resuelta.** El primero es técnico y tiene plan. El segundo es jurídico y tiene dueño.

---

## Anexo A — Registro de evidencias

Toda afirmación de estado en este documento proviene de las siguientes fuentes del repositorio:

- `docs/diagnostico-2026-11-25.md` — auditoría read-only, cuatro sectores, hallazgos citados por `ruta:línea`.
- `edu-conect-rural-server/src/` — `main.rs`, `config.rs`, `db.rs`, `auth.rs`, `quiz.rs`, `rate_limit.rs`, `zim_proxy.rs`.
- `edu-conect-rural-server/migrations/` y `seeds/`.
- `edu-conect-rural-dashboard/` — export estático de Next.js.
- `install.sh`, `deploy/educonect.service`, `Dockerfile`, `docker-compose.yml`, `.github/workflows/ci.yml`.
- `README.md`, `DEPLOY.md`, `reporte-integracion-local.md`, `CONTRIBUTING.md`.
- `investigacion_etnoeducacion_wayuu.md`, `investigacion_curriculo_guajira.md`, `investigacion_proyectos_offline.md`, `investigacion_tendencias_edtech.md`.

**Verificaciones no realizadas:** los hallazgos de despliegue provienen de lectura de código y no de ejecución. La carga de contexto WebGL en el hardware objetivo, el comportamiento del instalador en la Raspberry Pi y el estado de la integración continua no fueron comprobados en runtime. Deben confirmarse en la fase 0 y sus resultados incorporarse a este documento.

La memoria persistente del proyecto no estaba operativa durante la elaboración de esta versión; el estado técnico vive en el repositorio, no en memoria.
