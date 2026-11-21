<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import {
  CARD_ZONES,
  cardFrameInBox,
  containerRectToMedia,
  zoneInFrame,
  type CardZone,
  type Rect,
} from '@/services/scan/cardFrame'
import { captureZone, type CaptureOptions } from '@/services/scan/frameCapture'
import { captureWhole, type InkPolarity } from '@/services/scan/multiScan'

/**
 * Viseur : la vidéo de la caméra plein cadre, et par-dessus les codes détectés, entourés en
 * temps réel. Une image figée (bouton « photo » ou photo importée) peut remplacer la vidéo.
 * Le parent récupère des images via `captureFrame()` (image entière) ou `capture()` (zone).
 */
export interface OverlayBox {
  key: string
  /** Position en pixels de l'image affichée (vidéo ou image figée). */
  box: Rect
  label: string
  /** « confirmed » : lu plusieurs fois ou sur la photo ; « seen » : lu une fois, à confirmer. */
  state: 'seen' | 'confirmed' | 'unknown'
}

const props = defineProps<{
  stream: MediaStream | undefined
  /** « success » déclenche l'animation de lecture réussie. */
  mode: 'idle' | 'scanning' | 'success' | 'paused'
  /** Codes à entourer. */
  boxes?: OverlayBox[]
  /** Image figée affichée à la place de la vidéo (URL d'objet + taille en pixels). */
  still?: { url: string; width: number; height: number }
  /** Cadre au format carte (pour « Lire le nom », qui lit une seule carte centrée). */
  guide?: boolean
}>()

const container = useTemplateRef<HTMLDivElement>('container')
const video = useTemplateRef<HTMLVideoElement>('video')
const size = ref({ width: 0, height: 0 })
const videoSize = ref({ width: 0, height: 0 })

let observer: ResizeObserver | undefined
onMounted(() => {
  const element = container.value
  if (!element) return
  const update = () => {
    size.value = { width: element.clientWidth, height: element.clientHeight }
  }
  update()
  // Doc MDN : https://developer.mozilla.org/fr/docs/Web/API/ResizeObserver
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(update)
    observer.observe(element)
  }
})
onBeforeUnmount(() => observer?.disconnect())

watch(
  () => props.stream,
  async (stream) => {
    const element = video.value
    if (!element) return
    element.srcObject = stream ?? null
    if (stream) {
      // play() peut être interrompu si le flux change entre-temps : sans gravité.
      await element.play().catch(() => undefined)
    }
  },
  { flush: 'post' },
)

function onVideoSize() {
  const element = video.value
  if (element) videoSize.value = { width: element.videoWidth, height: element.videoHeight }
}

/**
 * Repère du calque : mêmes coordonnées que l'image affichée. Avec `object-fit: cover` côté
 * vidéo et `preserveAspectRatio="xMidYMid slice"` côté SVG, l'image et le calque sont
 * agrandis et rognés de la même façon : un rectangle en pixels d'image tombe pile dessus.
 * Doc MDN : https://developer.mozilla.org/fr/docs/Web/SVG/Attribute/preserveAspectRatio
 */
const overlaySize = computed(() => props.still ?? videoSize.value)
const viewBox = computed(
  () => `0 0 ${String(overlaySize.value.width)} ${String(overlaySize.value.height)}`,
)
/** Épaisseur des traits et taille du texte, proportionnelles à l'image (lisibles partout). */
const unit = computed(() => Math.max(overlaySize.value.width, overlaySize.value.height) / 300)

const frame = computed(() => cardFrameInBox(size.value.width, size.value.height))
const frameStyle = computed(() => ({
  left: `${String(frame.value.x)}px`,
  top: `${String(frame.value.y)}px`,
  width: `${String(frame.value.width)}px`,
  height: `${String(frame.value.height)}px`,
}))

function videoReady(): HTMLVideoElement | undefined {
  const element = video.value
  if (!element || element.readyState < 2 || element.videoWidth === 0) return undefined
  return element
}

/** Zone d'une carte cadrée au centre (lecture du nom), préparée pour l'OCR. */
function capture(zone: CardZone, options?: CaptureOptions): HTMLCanvasElement | undefined {
  const element = videoReady()
  if (!element) return undefined
  const media = { width: element.videoWidth, height: element.videoHeight }
  const rect = containerRectToMedia(zoneInFrame(frame.value, CARD_ZONES[zone]), size.value, media)
  return captureZone(element, media, rect, options)
}

/** Image entière de la vidéo, pour chercher tous les codes visibles. */
function captureFrame(options?: { maxSide?: number; maxScale?: number; polarity?: InkPolarity }) {
  const element = videoReady()
  if (!element) return undefined
  return captureWhole(element, { width: element.videoWidth, height: element.videoHeight }, options)
}

defineExpose({ capture, captureFrame, videoElement: () => videoReady() })
</script>

<template>
  <div ref="container" class="viewfinder" :data-mode="mode">
    <!-- playsinline : indispensable sur iPhone, sinon la vidéo s'ouvre en plein écran.
         muted : autorise la lecture automatique. Doc : https://webkit.org/blog/6784/new-video-policies-for-ios/ -->
    <video
      ref="video"
      class="video"
      playsinline
      muted
      autoplay
      aria-hidden="true"
      @loadedmetadata="onVideoSize"
      @resize="onVideoSize"
    ></video>
    <img v-if="still" class="still" :src="still.url" alt="" />

    <svg
      v-if="overlaySize.width > 0 && (boxes?.length ?? 0) > 0"
      class="boxes"
      :viewBox="viewBox"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g v-for="item in boxes" :key="item.key" :class="['box', `box--${item.state}`]">
        <rect
          :x="item.box.x - unit * 2"
          :y="item.box.y - unit * 2"
          :width="item.box.width + unit * 4"
          :height="item.box.height + unit * 4"
          :rx="unit * 1.5"
          :stroke-width="unit"
        />
        <text
          :x="item.box.x - unit * 2"
          :y="item.box.y - unit * 4"
          :font-size="unit * 7"
          :stroke-width="unit * 1.6"
        >
          {{ item.label }}
        </text>
      </g>
    </svg>

    <div v-if="guide" class="frame" :style="frameStyle" aria-hidden="true">
      <span class="corner tl"></span>
      <span class="corner tr"></span>
      <span class="corner bl"></span>
      <span class="corner br"></span>
    </div>
    <span v-if="mode === 'scanning'" class="sweep" aria-hidden="true"></span>
    <slot></slot>
  </div>
</template>

<style scoped>
.viewfinder {
  position: relative;
  overflow: hidden;
  width: 100%;
  aspect-ratio: 3 / 4;
  max-height: min(72vh, 46rem);
  border-radius: var(--radius-lg);
  background: #05070b;
  box-shadow: var(--shadow-md);
  isolation: isolate;
}

.video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.frame {
  position: absolute;
  border-radius: calc(var(--radius-md) * 0.8);
  outline: 1px solid rgb(255 255 255 / 0.35);
  transition:
    outline-color var(--transition-fast),
    transform 240ms ease-out;
}

.corner {
  position: absolute;
  width: 1.6rem;
  height: 1.6rem;
  border: 3px solid #fff;
  border-radius: 0.6rem;
}
.tl {
  top: -3px;
  left: -3px;
  border-right: 0;
  border-bottom: 0;
  border-bottom-left-radius: 0;
  border-top-right-radius: 0;
}
.tr {
  top: -3px;
  right: -3px;
  border-left: 0;
  border-bottom: 0;
  border-bottom-right-radius: 0;
  border-top-left-radius: 0;
}
.bl {
  bottom: -3px;
  left: -3px;
  border-right: 0;
  border-top: 0;
  border-top-left-radius: 0;
  border-bottom-right-radius: 0;
}
.br {
  bottom: -3px;
  right: -3px;
  border-left: 0;
  border-top: 0;
  border-top-right-radius: 0;
  border-bottom-left-radius: 0;
}

/* Image figée : même cadrage que la vidéo (object-fit: cover). */
.still {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Calque des codes détectés, aux mêmes coordonnées que l'image. */
.boxes {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.box rect {
  fill: color-mix(in srgb, var(--color-accent) 18%, transparent);
  stroke: var(--color-accent);
}
.box--confirmed rect {
  fill: color-mix(in srgb, var(--color-success) 22%, transparent);
  stroke: var(--color-success);
}
.box--unknown rect {
  fill: transparent;
  stroke: #fff;
  stroke-dasharray: 4 3;
}
/* Étiquette lisible sur n'importe quel fond : texte blanc cerclé de noir. */
.box text {
  fill: #fff;
  stroke: rgb(0 0 0 / 0.75);
  paint-order: stroke;
  font-family: var(--font-sans);
  font-weight: 700;
}

/* Ligne de balayage : indique que la lecture est en cours. */
.sweep {
  position: absolute;
  left: 4%;
  right: 4%;
  height: 2px;
  top: 0;
  z-index: 1;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, var(--color-primary), transparent);
  box-shadow: 0 0 12px var(--color-primary);
  animation: sweep 2.4s ease-in-out infinite alternate;
}
@keyframes sweep {
  from {
    top: 6%;
  }
  to {
    top: 92%;
  }
}

/* Lecture réussie : le cadre passe au vert et « respire » une fois. */
.viewfinder[data-mode='success'] .frame {
  outline: 3px solid var(--color-success);
  transform: scale(1.02);
}
.viewfinder[data-mode='success'] .corner {
  border-color: var(--color-success);
}
.viewfinder[data-mode='paused'] .frame {
  outline-color: rgb(255 255 255 / 0.2);
}

@media (min-width: 48rem) {
  .viewfinder {
    aspect-ratio: 4 / 3;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sweep {
    animation: none;
    top: 50%;
    opacity: 0.6;
  }
  .frame {
    transition: none;
  }
  .viewfinder[data-mode='success'] .frame {
    transform: none;
  }
}
</style>
