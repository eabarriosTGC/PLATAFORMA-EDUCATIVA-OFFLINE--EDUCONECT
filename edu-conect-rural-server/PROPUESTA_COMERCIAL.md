# 📋 Propuesta Comercial — EduConect Rural
## Plataforma educativa offline para zonas rurales
### Presentado a: [Nombre de la Alcaldía / Secretaría de Educación]

---

## 1. Resumen Ejecutivo

EduConect Rural es una plataforma educativa **100% offline** diseñada para escuelas rurales sin acceso a internet. Corre en una Raspberry Pi (costo único de ~$115 USD) y no necesita planes de datos, suscripciones ni conexión externa.

**¿Qué incluye?**
- 📖 Wikipedia offline completa (español)
- 📚 Biblioteca digital con +100 libros PDF
- 🎮 21 módulos interactivos gamificados (Matemáticas, Lenguaje, Ciencias, Wayuu)
- 📝 Diccionario offline con 21,000+ entradas + sinónimos + wayuunaiki
- 📊 Dashboard docente para seguimiento de progreso
- 🎥 Reproducción de videos educativos offline
- 🌐 Red WiFi local (hasta 30 estudiantes simultáneos)

---

## 2. El Problema

| Problema | Impacto |
|---|---|
| 68% de escuelas rurales en La Guajira NO tienen internet | Estudiantes sin acceso a contenido digital |
| Los planes de datos cuestan $50-100K COP/mes/escuela | Presupuesto insuficiente para todo el año |
| Las tablets con datos se dañan, pierden señal | Solución insostenible |
| El contenido digital no está en wayuunaiki | Pérdida de identidad cultural |

---

## 3. La Solución

```
┌─────────────────────────────────────────────────────┐
│                   EduConect Rural                    │
│                                                      │
│  ┌─────────────┐     ┌──────────────────────────┐   │
│  │ Raspberry Pi │────>│    Red WiFi LOCAL        │   │
│  │  (Servidor)  │     │  (sin internet externo)  │   │
│  └─────────────┘     └──────────┬───────────────┘   │
│                                 │                    │
│          ┌──────────────────────┼──────┐             │
│          │          ┌───────────┼──────┼──────┐      │
│       ┌──┴──┐   ┌──┴──┐   ┌───┴──┐ ┌─┴──┐ ┌─┴──┐   │
│       │Wiki │   │ Dic │   │Módul.│ │Vid.│ │Bib.│   │
│       └─────┘   └─────┘   └──────┘ └────┘ └────┘   │
└─────────────────────────────────────────────────────┘
```

Una sola Raspberry Pi (del tamaño de una tarjeta de crédito) conectada a la electricidad crea una red WiFi local. Cualquier dispositivo (celular, tablet, computador) se conecta a esa red y accede a toda la plataforma. **Sin internet, sin datos, sin límites.**

---

## 4. Modelos de Contratación

### 🏆 Paquete Recomendado — "Escuela Digital Rural"

| Componente | Descripción |
|---|---|
| Hardware | Raspberry Pi 5 (4GB) + case + fuente + MicroSD 64GB |
| Software | EduConect Rural preinstalado y configurado |
| Contenido inicial | Wikipedia + Wikilibros + Vikidia + 21 módulos + diccionario |
| Biblioteca | 100+ libros PDF curados + contenido wayuu |
| Hotspot WiFi | Red local para 30 estudiantes simultáneos |
| Portal cautivo | Al conectarse, abre automáticamente la plataforma |
| Capacitación | Taller presencial de 4 horas para docentes |
| Soporte | Remoto (WhatsApp/Telegram) + 1 visita/semestre |
| Actualizaciones | Contenido nuevo cada 6 meses vía MicroSD |

**💰 Precio por escuela/año: $1,200,000 COP** (~$300 USD)
*Incluye: hardware + instalación + contenido + capacitación + soporte*

### Opción 2: Solo SaaS (escuelas con internet)

| Plan | Precio/mes | Usuarios |
|---|---|---|
| Básico | $100,000 COP | 1 escuela, 50 estudiantes |
| Premium | $250,000 COP | 1 escuela, ilimitado |
| Municipio | $2,000,000 COP | Hasta 20 escuelas |

### Opción 3: Hardware + Licencia perpetua

| Componente | Precio único |
|---|---|
| Kit Raspberry Pi 5 preconfigurado | $450,000 COP |
| Licencia de software (perpetua) | $300,000 COP |
| Capacitación docente (4h) | $200,000 COP |
| **Total** | **$950,000 COP** (una sola vez) |

---

## 5. Comparativa de Costos vs Alternativas

| Solución | Costo anual/escuela | Dependencia técnica | Offline real | Contenido local |
|---|---|---|---|---|
| **EduConect Rural** 🏆 | **$1,200,000 COP** | 🔋 Electricidad | ✅ 100% | ✅ Wayuu + Colombia |
| Tabletas con plan de datos | $8,400,000 COP | 📡 4G/5G | ❌ No | ❌ Genérico |
| Internet satelital + plataforma | $24,000,000 COP | 🛰️ Cielo despejado | ❌ No | ❌ Genérico |
| Salas de cómputo tradicionales | $15,000,000 COP | ⚡ Internet + electricidad | ❌ No | ❌ Genérico |
| Kolibri (auto-gestionado) | $500,000 COP (solo HW) | 👨‍💻 Técnico especializado | ✅ 100% | ❌ No wayuu |

**Ahorro vs tablets con datos: 86%**
**Ahorro vs internet satelital: 95%**

---

## 6. Beneficios Medibles

| Indicador | Sin plataforma | Con EduConect |
|---|---|---|
| Estudiantes con acceso a contenido digital | 0% | 100% |
| Horas de consulta semanal por estudiante | 0h | 4-6h |
| Docentes usando herramientas digitales | 5% | 85% |
| Contenido en wayuunaiki disponible | ❌ No | ✅ Sí |
| Costo operativo mensual | $200-800K (datos) | $0 |

---

## 7. Casos de Uso

### 📖 Escuela Rural sin internet (el caso típico)
La profesora María en una ranchería wayuu de Uribia conecta su Raspberry Pi a un panel solar. 30 estudiantes se conectan con sus celulares a la red WiFi "EduConect Rural". Pueden consultar Wikipedia, hacer los módulos interactivos de matemáticas, buscar palabras en el diccionario wayuunaiki-español, y leer libros de la biblioteca digital. **Sin internet, sin datos, sin límites.**

### 🏫 Municipio con sedes educativas dispersas
La Secretaría de Educación contrata el paquete municipal. 20 escuelas reciben cada una su Raspberry Pi preconfigurada. Cada 6 meses, un técnico visitante lleva una MicroSD con contenido actualizado. **Inversión total: $24M COP/año para 20 escuelas.** Ahorro del 90% vs cualquier alternativa.

---

## 8. Soporte Técnico

| Canal | Tiempo de respuesta | Incluido en |
|---|---|---|
| WhatsApp / Telegram | < 2 horas | Plan Premium y Municipio |
| Llamada telefónica | < 24 horas | Plan Premium y Municipio |
| Visita técnica presencial | < 5 días hábiles | Plan Municipio |
| Actualización de contenido | Cada 6 meses | Todos los planes |

---

## 9. Próximos Pasos

```
1. Reunión de presentación técnica (1 hora)
2. Prueba piloto: 2 escuelas por 1 mes (sin costo)
3. Evaluación de resultados con indicadores
4. Firma de contrato por vigencia fiscal
5. Instalación en todas las sedes educativas
6. Capacitación docente (presencial)
7. Seguimiento trimestral y renovación
```

---

## 10. Contacto

**EduConect Rural — La Guajira, Colombia**
🌐 https://educonect.co
📧 contacto@educonect.co
📱 +57 [tu número]

---

*Este documento es una propuesta comercial. Los precios están en pesos colombianos (COP) e incluyen IVA. Válido hasta diciembre 2026.*
