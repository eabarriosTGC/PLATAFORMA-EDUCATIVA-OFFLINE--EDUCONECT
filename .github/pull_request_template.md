## Qué hace este PR

<!-- Una frase. Si no cabe en una frase, probablemente son dos PR. -->

## Issue

<!-- Closes #N  |  Unidad: F-01 / E-01 / D-04b / H3 / … -->

## Tipo de cambio

- [ ] Contrato (propone una forma; no implementa)
- [ ] Implementación de producto
- [ ] Infraestructura (migraciones, arranque, despliegue)
- [ ] Seguridad
- [ ] Documentación o evidencia

## Criterios de aceptación cumplidos

<!-- Copiar los criterios del issue y decir cuáles se cumplen. Si alguno no se cumple, decirlo. -->

| Criterio | Cómo se comprobó | Estado |
|---|---|---|
|  |  |  |

## Control negativo

<!-- OBLIGATORIO. Qué mutación hace fallar la prueba. Una prueba que no puede fallar no prueba nada. -->

-

## Qué NO se probó, y por qué

<!-- Sin esta sección, el PR no está completo. «No lo medí» es una respuesta válida; «debería funcionar» no. -->

-

## Superficies

- [ ] ¿Toca `src/models.rs` o alguna migración? → **requiere revisión de los tres (S3)**
- [ ] ¿Toca superficies reservadas de Codex (`static/sw.js`, `tests/e2e/pwa-*`, `scripts/auditar-catalogo.py`)? → **no mergear sin que Codex lo sepa**
- [ ] ¿Toca `Dockerfile`, `docker-compose*.yml`, `tests/fixtures/`, `.github/workflows/ci.yml`?
- [ ] ¿Introduce una tabla nueva? → **no antes de G0 + G1**

## Contratos

- [ ] No cambia ningún contrato
- [ ] Cambia un contrato → enlace al issue `tipo/contrato` aprobado:

## Verificación ejecutada

```
<!-- comandos y resultado -->
```

## Licencia

- [ ] Este PR **no** integra contribución de un tercero
- [ ] Este PR integra contribución de un tercero → **no mergear hasta que J1/J3 estén resueltos**

## Riesgo

<!-- Según la lista de alto riesgo: datos irrecuperables, seguridad, contratos que otros consumen,
     concurrencia, entrega/entorno, ausencia de prueba que detecte la regresión. -->

**Riesgo:** <!-- item N (motivo) | ninguno -->
