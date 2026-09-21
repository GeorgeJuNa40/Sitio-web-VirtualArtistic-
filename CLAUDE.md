# VirtualArtistic — guía para trabajar en este repo

## Regla de lenguaje (aplica a TODO el sitio, ES e inglés)

**Escribe siempre en lenguaje común, claro y fácil de entender para cualquier
persona.** El cliente objetivo no es técnico: no debe encontrarse con tecnicismos
ni jerga de marketing.

- **Traduce cualquier tecnicismo a palabras simples**, aun cuando el prompt o la
  instrucción venga con términos técnicos. Ejemplos: en vez de "LCP / 60 FPS /
  commit / arquitectura de la información" → "abre rápido / funciona sin trabas /
  desde el primer día". En vez de "intención editorial" → "una razón clara
  detrás".
- Voz de marca: **sofisticada y silenciosa**. Lujo y arte, nunca venta agresiva.
  El visual puede ser llamativo; el texto siempre susurra.
- Nada de lenguaje altisonante ni vulgar — solo español (o inglés) natural y
  entendible.
- El inglés no se traduce literal del español: debe sonar nativo y mantener el
  mismo registro tranquilo.

### Palabras prohibidas (ES e inglés)
Nunca usar: "24/7", "máquinas de ventas", "vanguardia", "gratis", "diagnóstico
gratuito", "revolucionario", "increíble", "cutting-edge", "game-changing",
"world-class", "free consultation". Un solo cliché rompe el registro.

## Contenido y copy
- Todo el texto vive en `src/i18n/es.json` y `src/i18n/en.json` (fuente única de
  verdad). No escribir copy directo en el HTML: se edita el diccionario y se
  regenera con `npm run gen`.
- Rutas reales: `/` (es) y `/en/` (en). Ver `README.md` para la arquitectura.

## Zona protegida (no modificar sin permiso explícito)
`public/seq/`, `src/hero/ScrollSequence.js`, `src/hero/PointerControls.js`,
`public/logo.png`, `public/favicon.svg`.

## Diseño
- Fondo blanco `#fdfdfd` idéntico al de los frames. El oro `--gold #b8860b` es
  para texto (AA sobre blanco); el ámbar `--amber #e0a52a` solo para acentos
  decorativos (no texto pequeño).
- Un solo `requestAnimationFrame` compartido para todo (Lenis, secuencia, cursor,
  marquesina). No crear loops paralelos.
