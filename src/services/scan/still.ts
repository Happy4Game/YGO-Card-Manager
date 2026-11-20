/**
 * Bouton « photo » : fige l'image et la prend dans la meilleure qualité possible.
 *
 * Quand le navigateur le permet (Chrome Android), `ImageCapture.takePhoto()` déclenche une
 * vraie photo à la pleine résolution du capteur (souvent 12 Mpx, contre 2 Mpx pour la
 * vidéo) : les petits codes d'impression deviennent bien plus lisibles. Sinon, on fige
 * l'image courante de la vidéo.
 * Spécification W3C : https://w3c.github.io/mediacapture-image/#dom-imagecapture-takephoto
 * Doc MDN : https://developer.mozilla.org/fr/docs/Web/API/ImageCapture/takePhoto
 */

// ImageCapture n'est pas (encore) décrit par les types DOM de TypeScript.
interface ImageCaptureLike {
  takePhoto(): Promise<Blob>
}
type ImageCaptureConstructor = new (track: MediaStreamTrack) => ImageCaptureLike

export async function takeStill(
  track: MediaStreamTrack | undefined,
  video: HTMLVideoElement,
): Promise<ImageBitmap> {
  const ImageCaptureClass = (globalThis as { ImageCapture?: ImageCaptureConstructor }).ImageCapture
  if (track && ImageCaptureClass) {
    try {
      const blob = await new ImageCaptureClass(track).takePhoto()
      return await createImageBitmap(blob)
    } catch {
      // Appareil qui refuse la photo (ou flux de test) : on fige la vidéo.
    }
  }
  return createImageBitmap(video)
}
