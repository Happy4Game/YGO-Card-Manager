import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CameraError,
  cameraErrorKind,
  cameraErrorMessage,
  nextCameraId,
  startCamera,
  supportsTorch,
} from '../camera'

const domError = (name: string) => new DOMException('erreur', name)

describe('cameraErrorKind / cameraErrorMessage', () => {
  it('reconnaît les erreurs standard de getUserMedia', () => {
    expect(cameraErrorKind(domError('NotAllowedError'))).toBe('denied')
    expect(cameraErrorKind(domError('NotFoundError'))).toBe('not-found')
    expect(cameraErrorKind(domError('OverconstrainedError'))).toBe('not-found')
    expect(cameraErrorKind(domError('NotReadableError'))).toBe('busy')
    expect(cameraErrorKind(new CameraError('insecure'))).toBe('insecure')
    expect(cameraErrorKind('bizarre')).toBe('unknown')
  })

  it('donne un message en français pour chaque cas', () => {
    expect(cameraErrorMessage('denied')).toMatch(/refusé/)
    expect(cameraErrorMessage('insecure')).toMatch(/https/)
    expect(cameraErrorMessage('not-found')).toMatch(/Aucune caméra/)
  })
})

describe('nextCameraId', () => {
  it('passe à la caméra suivante, en boucle', () => {
    const cameras = [{ deviceId: 'a' }, { deviceId: 'b' }]
    expect(nextCameraId(cameras, 'a')).toBe('b')
    expect(nextCameraId(cameras, 'b')).toBe('a')
    expect(nextCameraId(cameras, undefined)).toBe('a')
    expect(nextCameraId([{ deviceId: 'a' }], 'a')).toBeUndefined()
  })
})

/** Piste vidéo factice (pas de caméra dans jsdom). */
function fakeTrack(capabilities: MediaTrackCapabilities | undefined) {
  return {
    stop: vi.fn(),
    getSettings: () => ({ deviceId: 'cam-1' }),
    getCapabilities: capabilities ? () => capabilities : undefined,
  }
}

describe('startCamera', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('demande la caméra arrière en haute définition et détecte la lampe', async () => {
    const track = fakeTrack({ torch: true })
    const getUserMedia = vi.fn(() =>
      Promise.resolve({ getVideoTracks: () => [track], getTracks: () => [track] }),
    )
    vi.stubGlobal('isSecureContext', true)
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })

    const session = await startCamera()
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        facingMode: { ideal: 'environment' },
      },
    })
    expect(session.torchSupported).toBe(true)
    expect(session.deviceId).toBe('cam-1')
  })

  it('refuse hors contexte sécurisé (http://)', async () => {
    vi.stubGlobal('isSecureContext', false)
    await expect(startCamera()).rejects.toMatchObject({ kind: 'insecure' })
  })

  it('sans getUserMedia : navigateur non compatible', async () => {
    vi.stubGlobal('isSecureContext', true)
    vi.stubGlobal('navigator', {})
    await expect(startCamera()).rejects.toMatchObject({ kind: 'unsupported' })
  })
})

describe('supportsTorch', () => {
  it('est faux sans getCapabilities ou sans lampe', () => {
    const noCapabilities = fakeTrack(undefined)
    const noTorch = fakeTrack({})
    expect(supportsTorch(noCapabilities)).toBe(false)
    expect(supportsTorch(noTorch)).toBe(false)
    expect(supportsTorch(fakeTrack({ torch: true }))).toBe(true)
  })
})
