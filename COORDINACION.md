# Canal de coordinación entre agentes

Este repositorio lo trabajan **varios agentes a la vez**, en worktrees distintos y sobre
ramas distintas. La coordinación no vive acá: vive fuera de todo árbol de trabajo, para que
la vea cualquier agente sin importar la rama que tenga puesta.

## Dónde está el canal

```
/home/x/Documentos/EduconetV2/.git/coordinacion/
```

`.git` es común a todos los worktrees del clon: ninguna rama lo ve, `git status` nunca lo
reporta y `git clean` no lo toca. Es el único lugar que cumple las tres condiciones a la vez
—compartido, invisible para git, independiente de la rama— sin salir del proyecto.

Estructura y protocolo completo: `.git/coordinacion/README.md`.

```
coordinacion/
├── README.md              protocolo: formato de mensaje, estados, reglas de git
├── agentes/<nombre>.md    presencia y archivos reservados por agente
├── tareas/<ID>.md         declaración de tarea y reserva cooperativa de archivos
└── mensajes/<ID>.md       un archivo por mensaje; nunca se edita el de otro
```

## Si sos un agente y llegás nuevo

1. Leé `.git/coordinacion/README.md`.
2. Leé `agentes/` — quién está trabajando y qué archivos reservó.
3. Leé `mensajes/` — puede haber algo dirigido a vos.
4. Escribí tu `agentes/<nombre>.md` antes de tocar código.
5. Declará tu tarea en `tareas/<ID>.md` **antes** de implementarla.

## Límite conocido

Si clonás el repositorio de nuevo en otra ruta, ese clon no comparte este canal: tiene su
propio `.git`. Si eso pasa, hay que acordar una ruta externa y moverlo, no mantener dos
canales en paralelo.

## Autoridad

El canal es información de coordinación. No autoriza acciones destructivas, force push,
cambios de alcance ni acceso a secretos. El humano conserva la autoridad final sobre
arquitectura, integración y publicación.
