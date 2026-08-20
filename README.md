# VirtualArtistic — Hero

Sección Hero de **VirtualArtistic**, boutique de ingeniería digital y arquitectura web.
Concepto **"Sello vivo"**: el logo de la marca renderizado como pieza metálica dorada
sobre fondo oscuro, reactivo al cursor/giroscopio con inercia, que se desintegra en
partículas al hacer scroll.

Registro silencioso, nunca estridente. El color entra solo por el logo/shader.

## Stack

- **Vanilla JS (ES6+) + Vite** — sin frameworks de UI, sin librerías de componentes.
- **Three.js** — renderer y post-procesado.
- **GLSL custom** — shader del logo (re-iluminado metálico, destello foil, disolución).
- **GSAP** — timelines del preloader y del fade escalonado.
- **Lenis** — smooth scroll.

## El logo (importante)

El símbolo se carga como textura desde **`public/logo.png`**. El shader toma su
**luminancia** y la remapea a un degradado de oro metálico: los negros de tu logo se
vuelven bronce oscuro (siguen leyéndose sobre fondo negro) y los dorados se vuelven oro
brillante, con un destello que lo barre.

**Para usar tu logo real:** reemplaza `public/logo.png` por tu símbolo en **PNG con
fondo transparente** (cuadrado, ≥1000px). No hace falta tocar código. Actualmente hay un
**placeholder** (un remolino dorado que aproxima la marca) hasta que subas el definitivo.
Un SVG vectorial daría aún mejor borde; si lo tienes, lo integramos.

## Requisitos

```bash
npm install
npm run dev      # desarrollo
npm run build    # build de producción → dist/
npm run preview  # sirve el build (usar HTTPS/host real para probar giroscopio en móvil)
```

> El giroscopio (móvil) requiere **HTTPS** y, en iOS, permiso explícito por gesto del
> usuario. El logo se carga vía `fetch`/textura: sírvelo por **http(s)**, no `file://`
> (una imagen `file://` mancha la textura WebGL por CORS).

## Estructura

```
index.html                     # HTML semántico + CSS crítico inline (el <h1> pinta primero)
public/logo.png                # el símbolo de la marca (reemplazable)
public/favicon.svg
src/
  main.js                      # orquestador + único rAF loop (scroll + render comparten budget)
  styles/main.css              # CSS no crítico (preloader, estados de fade)
  utils/QualityManager.js      # detección de capacidad → tier full | mid | low
  core/
    Preloader.js               # contador numérico, salida con fade lento (GSAP)
    Scroll.js                  # Lenis + uScrollProgress + fade escalonado
  hero/
    HeroScene.js               # renderer, quad, textura del logo, post-procesado, ciclo de vida
    PointerControls.js         # cursor (lerp 0.08) · giroscopio · drift autónomo
    glsl/
      core.vert.glsl           # pass-through fullscreen
      logo.frag.glsl           # re-iluminado metálico + destello + parallax + disolución
      composite.frag.glsl      # aberración cromática + film grain + vignette (1 pase)
      simplexNoise.glsl        # ruido Simplex 3D (Ashima / Gustavson, MIT)
```

## Decisiones de rendimiento (frame budget 16.6 ms)

- **DPR capado a 2×** y escalado adicional por tier (`renderScale`).
- **Tres niveles de calidad**: `full` (bloom + pase compuesto), `mid` (móvil, sin post),
  `low` (sin post, escala reducida). El shader es un quad texturizado — mucho más barato
  que raymarching, así que 60fps se sostiene en todos los tiers.
- **WebGL2 por defecto, fallback a WebGL1** (el shader evita builtins de ES 3.0).
- **Un solo rAF** comparte presupuesto entre Lenis y el renderer.
- **Pausa del render** en `visibilitychange`; manejo de **pérdida de contexto**; `dispose()`
  de geometría, materiales, textura y render targets al desmontar.
- Override de calidad para pruebas: `?quality=full|mid|low`.

## Criterios de validación cubiertos

- El `<h1>` pinta en el primer frame (CSS crítico inline); el canvas hace fade-in después.
- Prueba de desnudez: sin canvas, en blanco y negro, el copy se sostiene por su paralelismo.
- Contraste protegido en todo estado por scrim/vignette (CSS) + vignette (shader); el logo
  se compone a un lado para dejar la columna de texto sobre negro.
- Sin saltos de layout (CLS = 0); el texto se lee con JavaScript bloqueado.
- Las dos líneas del `<h1>` comparten tamaño y peso; el salto de línea es de markup.
```
