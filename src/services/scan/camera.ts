/**
 * Accès à la caméra arrière du téléphone.
 * Doc MDN : https://developer.mozilla.org/fr/docs/Web/API/MediaDevices/getUserMedia
 *
 * Les images restent dans le navigateur : rien n'est envoyé sur Internet.
 */

// La lampe (torch) vient de la spécification « MediaStream Image Capture », pas encore décrite
// par les types DOM de TypeScript pour les capacités et les contraintes : on les complète.
// Spécification : https://w3c.github.io/mediacapture-image/#torch
declare global {
  interface MediaTrackCapabilities {
    torch?: boolean
  }
  interface MediaTrackConstraintSet {
    torch?: ConstrainBoolean
  }
}

export interface CameraSession {
  stream: MediaStream
  track: MediaStreamTrack
  /** La lampe (flash continu) est-elle pilotable ? (Chrome Android surtout.) */
  torchSupported: boolean
  deviceId: string | undefined
}

/** La caméra n'est disponible que sur HTTPS (ou localhost) et dans un navigateur récent. */
export function cameraAvailability(): 'ok' | 'insecure' | 'unsupported' {
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'insecure'
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return 'unsupported'
  }
  return 'ok'
}

export async function startCamera(deviceId?: string): Promise<CameraSession> {
  const availability = cameraAvailability()
  if (availability !== 'ok') throw new CameraError(availability)

  // Contraintes « ideal » : le navigateur fait au mieux sans échouer si c'est impossible.
  // Doc MDN : https://developer.mozilla.org/fr/docs/Web/API/MediaTrackConstraints
  const video: MediaTrackConstraints = {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }),
  }
  const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false })
  const [track] = stream.getVideoTracks()
  if (!track) {
    stopStream(stream)
    throw new CameraError('not-found')
  }
  return {
    stream,
    track,
    torchSupported: supportsTorch(track),
    deviceId: track.getSettings().deviceId,
  }
}

export function supportsTorch(track: { getCapabilities?: () => MediaTrackCapabilities }): boolean {
  // getCapabilities n'existe pas partout (anciens Firefox) : on vérifie avant d'appeler.
  if (typeof track.getCapabilities !== 'function') return false
  return track.getCapabilities().torch === true
}

/** Allume ou éteint la lampe. Doc : https://w3c.github.io/mediacapture-image/#torch */
export async function setTorch(track: MediaStreamTrack, on: boolean): Promise<void> {
  await track.applyConstraints({ advanced: [{ torch: on }] })
}

/** Caméras disponibles (les noms ne sont connus qu'après l'autorisation). */
export async function listCameras(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter((device) => device.kind === 'videoinput')
}

/** Coupe la caméra (le voyant s'éteint). À faire dès qu'on quitte la page ou l'onglet. */
export function stopStream(stream: MediaStream | undefined): void {
  stream?.getTracks().forEach((track) => track.stop())
}

/** Caméra suivante dans la liste (bouton « changer de caméra »). */
export function nextCameraId(
  cameras: readonly Pick<MediaDeviceInfo, 'deviceId'>[],
  currentId: string | undefined,
): string | undefined {
  if (cameras.length < 2) return undefined
  const index = cameras.findIndex((camera) => camera.deviceId === currentId)
  return cameras[(index + 1) % cameras.length]?.deviceId
}

export type CameraErrorKind =
  | 'denied'
  | 'not-found'
  | 'busy'
  | 'insecure'
  | 'unsupported'
  | 'unknown'

export class CameraError extends Error {
  constructor(readonly kind: CameraErrorKind) {
    super(cameraErrorMessage(kind))
    this.name = 'CameraError'
  }
}

/** Type d'erreur à partir de l'exception levée par getUserMedia (noms normalisés par le W3C). */
export function cameraErrorKind(error: unknown): CameraErrorKind {
  if (error instanceof CameraError) return error.kind
  const name = error instanceof Error || error instanceof DOMException ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'denied'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'not-found'
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'busy'
    default:
      return 'unknown'
  }
}

export function cameraErrorMessage(kind: CameraErrorKind): string {
  switch (kind) {
    case 'denied':
      return "L'accès à la caméra a été refusé. Autorise-le dans les réglages du navigateur (icône à gauche de l'adresse), ou importe une photo."
    case 'not-found':
      return 'Aucune caméra détectée sur cet appareil. Tu peux importer une photo de la carte.'
    case 'busy':
      return 'La caméra est déjà utilisée par une autre application. Ferme-la puis réessaie.'
    case 'insecure':
      return 'La caméra nécessite une connexion sécurisée (adresse en https://). Tu peux importer une photo.'
    case 'unsupported':
      return "Ce navigateur ne permet pas d'utiliser la caméra. Tu peux importer une photo."
    case 'unknown':
      return 'Impossible de démarrer la caméra. Réessaie, ou importe une photo.'
  }
}
