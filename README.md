# VirtualArtistic — Hero

Sección Hero de **VirtualArtistic**, boutique de ingeniería digital y arquitectura web.
Un núcleo de inteligencia abstracto —renderizado como pieza de arte por raymarching—
que reacciona al cursor con inercia y se desintegra al hacer scroll.

Registro silencioso, nunca estridente. Autoridad por sobriedad.

## Stack

- **Vanilla JS (ES6+) + Vite** — sin frameworks de UI, sin librerías de componentes.
- **Three.js** — renderer y post-procesado.
- **GLSL custom** — vertex + fragment shaders (raymarching, ruido Simplex 3D, iridiscencia Fresnel).
- **GSAP** — timelines del preloader y del fade escalonado.
- **Lenis** — smooth scroll.

## Requisitos

```bash
npm install
npm run dev      # desarrollo
npm run build    # build de producción → dist/
npm run preview  # sirve el build (usar HTTPS/host real para probar giroscopio en móvil)
```

> El giroscopio (móvil) requiere **HTTPS** y, en iOS, permiso explícito activado por
> gesto del usuario. `npm run preview -- --host` sirve en la red local para probar en
> dispositivo real; para el permiso de iOS se necesita un contexto seguro (HTTPS).

## Estructura

```
index.html                     # HTML semántico + CSS crítico inline (el <h1> pinta primero)
public/favicon.svg
src/
  main.js                      # orquestador + único rAF loop (scroll + render comparten budget)
  styles/main.css              # CSS no crítico (preloader, estados de fade)
  utils/QualityManager.js      # detección de capacidad → tier full | mid | low
  core/
    Preloader.js               # contador numérico, salida con fade lento (GSAP)
    Scroll.js                  # Lenis + uScrollProgress + fade escalonado
  hero/
    HeroScene.js               # renderer, quad fullscreen, post-procesado, ciclo de vida
    PointerControls.js         # cursor (lerp 0.08) · giroscopio · drift autónomo
    glsl/
      core.vert.glsl           # pass-through fullscreen
      core.frag.glsl           # raymarching del núcleo (SDF + FBM + Fresnel + desintegración)
      low.frag.glsl            # fallback: gradiente iridiscente sobrio, sin raymarch
      composite.frag.glsl      # aberración cromática + film grain + vignette (1 pase)
      simplexNoise.glsl        # ruido Simplex 3D (Ashima / Gustavson, MIT)
```

## Decisiones de rendimiento (frame budget 16.6 ms)

- **DPR capado a 2×** y escalado adicional por tier (`renderScale`).
- **Tres niveles de calidad** detectados al iniciar:
  - `full` — raymarching (4 octavas, 64 pasos) + bloom + pase compuesto.
  - `mid` — 3 octavas, 40 pasos, solo bloom.
  - `low` — gradiente animado ligero, sin post (móvil de gama baja / sin WebGL2 / GPU débil).
- **Early-out por esfera de contorno**: los rayos que no cruzan el núcleo salen antes de marchar.
- **Defines de calidad compilados** (`OCTAVES`, `MAX_STEPS`) en lugar de branching en runtime.
- **WebGL2 por defecto, fallback a WebGL1** (los shaders evitan builtins de ES 3.0).
- **Un solo rAF** comparte presupuesto entre Lenis y el renderer.
- **Pausa del render** en `visibilitychange`; manejo de **pérdida de contexto**; `dispose()`
  de geometría, materiales y render targets al desmontar.

### Nota sobre la desintegración

La consigna original —"desintegrarse en partículas"— tomada literalmente exigiría extraer
una nube de puntos de una superficie *implícita* (no hay geometría) en cada frame, algo
inviable a 60 FPS. La alternativa optimizada implementada es una **disolución dentro del
shader**: al subir `uScrollProgress`, una máscara de erosión 3D fragmenta la SDF y los
supervivientes se dispersan hacia afuera. Se lee como dispersión de partículas, sin coste
extra y como una sola coreografía junto al fade escalonado del texto.

## Criterios de validación cubiertos

- El `<h1>` pinta en el primer frame (CSS crítico inline); el canvas hace fade-in después.
- Prueba de desnudez: sin canvas, en blanco y negro, el copy se sostiene por su paralelismo.
- Contraste protegido en todo estado por scrim/vignette (CSS) + vignette (shader).
- Sin saltos de layout (CLS = 0); el texto se lee con JavaScript bloqueado.
- Las dos líneas del `<h1>` comparten tamaño y peso; el salto de línea es de markup.
```
