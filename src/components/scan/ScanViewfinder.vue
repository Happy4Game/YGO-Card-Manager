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

/**
 * Viseur : la vidéo de la caméra plein cadre, un cadre au format carte et les zones lues
 * (code d'impression, nom) mises en évidence. Le parent récupère des images via `capture()`.
 */
const props = defineProps<{
  stream: MediaStream | undefined
  /** « success » déclenche l'animation de lecture réussie. */
  mode: 'idle' | 'scanning' | 'success' | 'paused'
  /** Nombre de lectures identiques en cours (0, 1, 2…) : la zone du code s'illumine. */
  streak: number
}>()

const container = useTemplateRef<HTMLDivElement>('container')
const video = useTemplateRef<HTMLVideoElement>('video')
const size = ref({ width: 0, height: 0 })

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

const frame = computed(() => cardFrameInBox(size.value.width, size.value.height))
const px = (rect: Rect) => ({
  left: `${rect.x}px`,
  top: `${rect.y}px`,
  width: `${rect.width}px`,
  height: `${rect.height}px`,
})
const frameStyle = computed(() => px(frame.value))
const codeStyle = computed(() =>
  px({
    x: CARD_ZONES.code.x * frame.value.width,
    y: CARD_ZONES.code.y * frame.value.height,
    width: CARD_ZONES.code.width * frame.value.width,
    height: CARD_ZONES.code.height * frame.value.height,
  }),
)
const nameStyle = computed(() =>
  px({
    x: CARD_ZONES.name.x * frame.value.width,
    y: CARD_ZONES.name.y * frame.value.height,
    width: CARD_ZONES.name.width * frame.value.width,
    height: CARD_ZONES.name.height * frame.value.height,
  }),
)

/** Image préparée pour l'OCR de la zone demandée, ou undefined si la vidéo n'est pas prête. */
function capture(zone: CardZone, options?: CaptureOptions): HTMLCanvasElement | undefined {
  const element = video.value
  if (!element || element.readyState < 2 || element.videoWidth === 0) return undefined
  const media = { width: element.videoWidth, height: element.videoHeight }
  const rect = containerRectToMedia(zoneInFrame(frame.value, CARD_ZONES[zone]), size.value, media)
  return captureZone(element, media, rect, options)
}

defineExpose({ capture })
</script>

<template>
  <div ref="container" class="viewfinder" :data-mode="mode">
    <!-- playsinline : indispensable sur iPhone, sinon la vidéo s'ouvre en plein écran.
         muted : autorise la lecture automatique. Doc : https://webkit.org/blog/6784/new-video-policies-for-ios/ -->
    <video ref="video" class="video" playsinline muted autoplay aria-hidden="true"></video>
    <div class="frame" :style="frameStyle" aria-hidden="true">
      <span class="corner tl"></span>
      <span class="corner tr"></span>
      <span class="corner bl"></span>
      <span class="corner br"></span>
      <span class="zone zone-name" :style="nameStyle"></span>
      <span class="zone zone-code" :class="{ warm: streak > 0 }" :style="codeStyle">
        <span class="zone-label">code</span>
      </span>
      <span v-if="mode === 'scanning'" class="sweep"></span>
    </div>
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
  /* Assombrit tout ce qui est hors du cadre (ombre géante coupée par overflow: hidden). */
  box-shadow: 0 0 0 100vmax rgb(3 6 12 / 0.55);
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

.zone {
  position: absolute;
  border-radius: var(--radius-sm);
  border: 2px dashed rgb(255 255 255 / 0.55);
}
.zone-code {
  border-style: solid;
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 12%, transparent);
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast);
}
.zone-code.warm {
  background: color-mix(in srgb, var(--color-accent) 32%, transparent);
}
.zone-label {
  position: absolute;
  right: 0;
  bottom: calc(100% + 2px);
  padding: 0 var(--space-1);
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: #111;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* Ligne de balayage : indique que la lecture est en cours. */
.sweep {
  position: absolute;
  left: 4%;
  right: 4%;
  height: 2px;
  top: 0;
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
