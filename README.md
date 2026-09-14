# VirtualArtistic — Hero

Sección Hero de **VirtualArtistic**, boutique de ingeniería digital y arquitectura web.

Concepto: **animación del logo controlada por el scroll** ("scroll-scrubbing" tipo Apple)
sobre un fondo **blanco premium**. Al hacer scroll, el logo se arma → se arremolina →
estalla en fragmentos → se rearma. En móvil la animación llena toda la pantalla
(full-bleed). Un **destello dorado** sigue al cursor y el texto entra con un fade sutil.

## Stack

- **Vanilla JS (ES6+) + Vite** — sin frameworks de UI.
- **GSAP** — timeline de entrada del texto y utilidades de easing.
- **Lenis** — smooth scroll.
- Sin dependencias 3D: el hero es una **secuencia de imágenes** dibujada en un canvas 2D.

## Cómo correrlo

```bash
npm install
npm run dev      # desarrollo (abre el enlace local, p. ej. http://localhost:5173)
npm run build    # producción → /dist
npm run preview  # sirve el build
```

## Cómo funciona la animación

La animación es una **secuencia de 100 fotogramas** (`public/seq/f_000.webp` … `f_099.webp`),
extraídos del video del logo. `src/hero/ScrollSequence.js` los precarga y dibuja en un
`<canvas>` el fotograma que corresponde al progreso de scroll (con suavizado para que se
sienta cinematográfico). El `<canvas>` cubre toda la pantalla (cover), por eso no se ve
ninguna "caja".

**Para cambiar la animación:** reemplaza los `.webp` de `public/seq/` por tu propia
secuencia (mismo nombre `f_000.webp`…). Puedes generarlos desde un video con ffmpeg:

```bash
ffmpeg -i tu_video.mp4 -vf "fps=10,scale=1200:-1" frame_%03d.png
# luego convierte cada PNG a WEBP y renómbralos f_000.webp, f_001.webp, ...
```

## Estructura

```
index.html                    · HTML + CSS crítico inline (tema blanco premium)
public/seq/f_000..f_099.webp  · fotogramas de la animación del logo
public/logo.png               · logo (referencia; la animación ya lo contiene)
public/favicon.svg
src/
  main.js                     · orquestador + rAF loop (scroll + dibujo)
  hero/
    ScrollSequence.js         · precarga y dibuja los fotogramas según el scroll
    PointerControls.js        · cursor (lerp) · giroscopio · drift autónomo
  core/
    Scroll.js                 · smooth scroll (Lenis) + fade del texto
    PointerFlash.js           · destello dorado que sigue al cursor (todo el sitio)
    Preloader.js              · contador de carga
  styles/main.css             · CSS no crítico (preloader, estados)
```

## Notas de diseño

- El `<h1>` pinta en el primer frame (CSS crítico inline) → LCP protegido, CLS = 0.
- El texto entra con un fade escalonado y luego se desvanece con el scroll.
- El fondo de la página usa exactamente el blanco de la animación (`#fdfdfd`) para que el
  canvas se funda con la página sin bordes visibles.
- La secuencia de imágenes evita el "jank" de hacer *seek* en un video H.264 y no depende
  del códec del navegador.
