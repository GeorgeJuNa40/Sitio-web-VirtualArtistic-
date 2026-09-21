# VirtualArtistic — Hero

Sección Hero de **VirtualArtistic**, boutique de ingeniería digital.

Concepto: **animación del logo controlada por el scroll** ("scroll-scrubbing" tipo
Apple) sobre un fondo **blanco premium**. Al hacer scroll, el logo se arma → se
arremolina → estalla → se rearma. En móvil llena toda la pantalla (full-bleed).
Sitio **bilingüe** con rutas reales (`/` español, `/en/` inglés).

## Stack

- **Vanilla JS (ES6+) + Vite** — sin frameworks de UI.
- **GSAP** — timeline de entrada del texto y easing maestro (`power3.out`).
- **Lenis** — smooth scroll.
- Sin dependencias 3D: el hero es una **secuencia de imágenes** en un canvas 2D.

## Cómo correrlo

```bash
npm install
npm run dev      # desarrollo (http://localhost:5173 → /  y  /en/)
npm run build    # producción → /dist (genera / y /en/)
npm run preview  # sirve el build
npm run gen      # regenera index.html + en/index.html desde los diccionarios
```

## Bilingüe — rutas reales, no un toggle de JS

Un switch de JavaScript que solo cambia texto no se indexa. Para que un cliente
en inglés encuentre el sitio, hay **dos rutas HTML reales**:

- `/` → español (idioma por defecto)
- `/en/` → inglés

**Fuente única de verdad.** Los textos viven en `src/i18n/es.json` y
`src/i18n/en.json`. `scripts/build-i18n-html.mjs` toma esos diccionarios + la CSS
crítica compartida (`src/templates/critical.css`) y **genera** `index.html` y
`en/index.html`. Nunca se duplica HTML a mano; cambiar una frase es editar el
diccionario. Un plugin de Vite (ver `vite.config.js`) regenera al iniciar/compilar
y recarga en dev cuando cambian plantilla o diccionarios.

- `<html lang="es|en">` correcto por ruta.
- `hreflang` cruzado (`es`, `en`, `x-default`) + `canonical` + Open Graph por ruta
  (inyectados post-bundle para que Vite no intente resolver las URLs de directorio).
- Selector `ES · EN` (texto, nunca banderas) como enlaces reales `<a href>`.
- Detección del idioma del navegador con **aviso discreto, nunca redirección
  forzada**; la elección se guarda en `localStorage` y se conserva la posición de
  scroll al cambiar de idioma.

> Antes de publicar, define el dominio en `SITE_URL` (arriba de
> `scripts/build-i18n-html.mjs`) para que `canonical`/`hreflang`/OG sean absolutos.

## Efectos del hero

1. **Entrada del texto por máscara + línea** — cada línea del H1 sube desde un
   contenedor `overflow:hidden`, con desenfoque que se resuelve; escalonado 0.16s.
2. **Cursor personalizado** (`src/core/Cursor.js`) — punto de tinta + anillo con
   inercia; sobre elementos interactivos el anillo crece y se vuelve dorado. Solo
   desktop; desactivado en táctil y `prefers-reduced-motion`.
3. **Marquesina ligada al scroll** (`src/core/Marquee.js`) — franja monoespaciada
   que aparece en la salida del hero; su velocidad y dirección responden a la
   velocidad del scroll. Solo `translate3d`.
4. **Transición de salida encadenada** — el texto se despeja en el primer ~30% y la
   marquesina entra justo después (`src/core/Scroll.js`).
5. **Atmósfera de superficie** — grano SVG estático (opacidad ~0.03) + viñeta CSS,
   por debajo del texto, sin `pointer-events`.

Un **solo `requestAnimationFrame`** (en `src/main.js`) mueve Lenis, la secuencia,
el cursor y la marquesina. No hay loops paralelos.

## Estructura

```
index.html · en/index.html      · GENERADOS desde los diccionarios (entradas Vite)
scripts/build-i18n-html.mjs      · generador es/en (fuente única de verdad)
src/
  i18n/{es,en}.json              · textos por idioma
  templates/critical.css         · CSS crítico compartido (inline en ambas rutas)
  main.js                        · orquestador + rAF único (scroll+dibujo+cursor+marquee)
  hero/
    ScrollSequence.js            · precarga y dibuja los fotogramas según el scroll
    PointerControls.js           · cursor (lerp) · giroscopio · drift autónomo
  core/
    Scroll.js                    · smooth scroll (Lenis) + fade del texto + velocidad
    Cursor.js                    · cursor personalizado (canvas 2D)
    Marquee.js                   · marquesina ligada al scroll
    Preloader.js                 · intro: logo que se revela + conteo 0→100
  styles/main.css                · estilos no críticos (preloader, estados)
public/seq/f_000..f_099.webp     · fotogramas de la animación del logo
public/logo.png · public/favicon.svg
```

## Rendimiento

- LCP < 2.5s (el `<h1>` pinta en el primer frame; medido ~0.4–0.6s en local).
- CLS = 0; solo se animan `transform`/`opacity`; DPR capado a 2.
- 60 FPS en reposo con el cursor activo; el único costo por frame durante el scrub
  es el dibujo de la secuencia (código aprobado, acelerado por GPU en hardware real).
- Los assets (fotogramas, fuentes) se comparten entre ambas rutas — la ruta en
  inglés no duplica nada.

## Accesibilidad

- `prefers-reduced-motion`: sin scrub (frame estático), sin cursor, sin marquesina,
  sin grano; el contenido queda plenamente legible.
- Contraste AA (incluido el dorado sobre blanco), foco visible en CTAs y selector,
  `<h1>` semántico, canvas `aria-hidden`.
