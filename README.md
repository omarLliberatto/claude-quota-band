# quota-band

Mod de Claude Code que dibuja una banda encima del prompt con lo que importa de la sesión: carpeta, modelo y effort, contexto usado (con aviso `wrapup?` / `WRAPUP` desde 200K y 400K tokens), minutos de caché que quedan (TTL de 1 h) y las cuotas de 5 horas y de 7 días, todo en verde, amarillo y rojo.

Formato: `carpeta | Modelo effort | ctx 22% 215K/1000K | caché 48m | 5h 40% | 7d 12%`

Las cuotas solo aparecen en cuentas que las informan (suscripción). No gasta tokens: se alimenta de los datos que el motor ya mide.

## Instalación

En una sesión de terminal:

```
/plugin install quota-band --marketplace omarLliberatto/claude-quota-band
```

Desde un shell:

```
claude plugin install quota-band --marketplace omarLliberatto/claude-quota-band
```

En la app de escritorio, donde `/plugin` no corre: clic en + junto al prompt, Plugins, Add marketplace con `omarLliberatto/claude-quota-band`, y luego Add plugin.
