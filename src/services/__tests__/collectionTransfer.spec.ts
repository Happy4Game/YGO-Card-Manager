import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { AppDatabase } from '@/db/database'
import { addEntry, type NewCollectionEntry } from '../collection'
import {
  downloadFile,
  escapeCsvField,
  exportFilename,
  exportToCsv,
  exportToJson,
  importFromJson,
  parseImport,
  type CollectionExport,
} from '../collectionTransfer'

// Données 100 % fictives (règle légale du projet).
function entry(overrides: Partial<NewCollectionEntry> = {}): Required<NewCollectionEntry> {
  return {
    cardId: 11111111,
    setCode: 'TST-FR001',
    rarity: 'Common',
    language: 'fr',
    condition: 'Near Mint',
    quantity: 1,
    location: 'Classeur A',
    note: '',
    addedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function exportFile(entries: unknown[], extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    app: 'card-manager',
    version: 1,
    exportedAt: '2026-02-01T00:00:00.000Z',
    entries,
    ...extra,
  })
}

describe('services/collectionTransfer', () => {
  const db = new AppDatabase('test-collection-transfer')

  afterEach(async () => {
    await db.delete()
    await db.open()
  })

  afterAll(async () => {
    await db.delete()
  })

  describe('export JSON', () => {
    it('produit le format versionné, sans les ids auto-incrémentés', async () => {
      await addEntry(db, entry({ quantity: 2 }))
      await addEntry(db, entry({ cardId: 22222222 }))
      const json = await exportToJson(db, new Date('2026-03-04T05:06:07.000Z'))
      const data: unknown = JSON.parse(json)

      expect(data).toEqual({
        app: 'card-manager',
        version: 1,
        exportedAt: '2026-03-04T05:06:07.000Z',
        entries: [entry({ quantity: 2 }), entry({ cardId: 22222222 })],
      } satisfies CollectionExport)
      expect(json).not.toContain('"id"')
    })

    it('peut être réimporté tel quel (aller-retour)', async () => {
      await addEntry(db, entry({ note: 'Avec "guillemets", virgules\net saut de ligne' }))
      const json = await exportToJson(db)
      const parsed = parseImport(json)
      expect(parsed).toEqual({ ok: true, entries: [entry({ note: expect.any(String) })] })
    })
  })

  describe('export CSV', () => {
    it('échappe virgules, guillemets et sauts de ligne (RFC 4180)', () => {
      expect(escapeCsvField('simple')).toBe('simple')
      expect(escapeCsvField('a,b')).toBe('"a,b"')
      expect(escapeCsvField('dit "bonjour"')).toBe('"dit ""bonjour"""')
      expect(escapeCsvField('ligne 1\nligne 2')).toBe('"ligne 1\nligne 2"')
      expect(escapeCsvField('retour\r')).toBe('"retour\r"')
      expect(escapeCsvField(42)).toBe('42')
    })

    it('écrit un en-tête puis une ligne par entrée, en CRLF', async () => {
      await db.cards.add({
        id: 11111111,
        name: 'Golem, le "Fictif"',
        type: 'Normal Monster',
        frameType: 'normal',
        desc: 'Texte de test.',
        race: 'Rock',
        sets: [],
        setKeys: [],
      })
      await addEntry(db, entry({ location: 'Boîte, étagère', note: 'a\nb' }))
      await addEntry(db, entry({ cardId: 22222222, note: '=1+1' }))

      const lines = (await exportToCsv(db)).split('\r\n')
      expect(lines[0]).toBe(
        'cardId,cardName,setCode,rarity,language,condition,quantity,location,note,addedAt',
      )
      expect(lines[1]).toBe(
        '11111111,"Golem, le ""Fictif""",TST-FR001,Common,fr,Near Mint,1,"Boîte, étagère","a\nb",2026-01-01T00:00:00.000Z',
      )
      // Carte inconnue : nom de repli ; formule neutralisée contre l'injection CSV.
      expect(lines[2]).toBe(
        "22222222,Carte #22222222,TST-FR001,Common,fr,Near Mint,1,Classeur A,'=1+1,2026-01-01T00:00:00.000Z",
      )
      expect(lines[3]).toBe('')
    })
  })

  describe('validation à l’import', () => {
    it('refuse un JSON mal formé', () => {
      expect(parseImport('{pas du json')).toEqual({
        ok: false,
        errors: ["Le fichier n'est pas un JSON valide."],
      })
    })

    it('refuse un fichier d’une autre application', () => {
      expect(parseImport(JSON.stringify({ app: 'autre', version: 1, entries: [] }))).toMatchObject({
        ok: false,
        errors: [expect.stringContaining("n'est pas un export")],
      })
      expect(parseImport('[]')).toMatchObject({ ok: false })
    })

    it('refuse une version inconnue', () => {
      expect(parseImport(exportFile([], { version: 2 }))).toEqual({
        ok: false,
        errors: ['Version de fichier non prise en charge : 2.'],
      })
    })

    it('refuse un champ entries qui n’est pas une liste', () => {
      expect(parseImport(exportFile([], { entries: {} }))).toMatchObject({ ok: false })
    })

    it('indique chaque ligne et chaque champ invalide', () => {
      const result = parseImport(
        exportFile([
          entry(),
          { ...entry(), quantity: 0, condition: 'Neuve' },
          'texte',
          { ...entry(), cardId: '123', language: 'FR', addedAt: 'hier', note: 5 },
        ]),
      )
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors).toEqual([
        'Ligne 2 : champ « quantity » invalide (entier supérieur ou égal à 1 attendu).',
        expect.stringMatching(/^Ligne 2 : champ « condition » invalide/),
        "Ligne 3 : l'entrée doit être un objet.",
        'Ligne 4 : champ « cardId » invalide (entier positif attendu).',
        expect.stringMatching(/^Ligne 4 : champ « language »/),
        expect.stringMatching(/^Ligne 4 : champ « addedAt »/),
        expect.stringMatching(/^Ligne 4 : champ « note »/),
      ])
    })

    it('résume les erreurs au-delà de 20', () => {
      const result = parseImport(exportFile(Array.from({ length: 25 }, () => 'x')))
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors).toHaveLength(21)
      expect(result.errors[20]).toBe('… et 5 autre(s) erreur(s).')
    })

    it('ignore les champs inconnus et l’id éventuel', () => {
      const result = parseImport(exportFile([{ ...entry(), id: 99, pirate: true }]))
      expect(result).toEqual({ ok: true, entries: [entry()] })
    })

    it('n’écrit rien en base si le fichier est invalide', async () => {
      await addEntry(db, entry())
      const result = await importFromJson(db, exportFile([entry(), { bad: true }]), 'replace')
      expect(result.ok).toBe(false)
      expect(await db.collection.count()).toBe(1)
    })
  })

  describe('modes d’import', () => {
    const file = exportFile([
      entry({ quantity: 2 }),
      entry({ cardId: 22222222, location: 'Boîte' }),
    ])

    it('merge : fusionne avec la collection existante', async () => {
      await addEntry(db, entry({ quantity: 1 }))
      await addEntry(db, entry({ cardId: 33333333 }))

      expect(await importFromJson(db, file, 'merge')).toEqual({ ok: true, count: 2, mode: 'merge' })
      const rows = await db.collection.orderBy('id').toArray()
      expect(rows.map((row) => [row.cardId, row.quantity])).toEqual([
        [11111111, 3],
        [33333333, 1],
        [22222222, 1],
      ])
    })

    it('replace : remplace toute la collection', async () => {
      await addEntry(db, entry({ quantity: 5 }))
      await addEntry(db, entry({ cardId: 33333333 }))

      expect(await importFromJson(db, file, 'replace')).toEqual({
        ok: true,
        count: 2,
        mode: 'replace',
      })
      const rows = await db.collection.orderBy('id').toArray()
      expect(rows.map((row) => [row.cardId, row.quantity])).toEqual([
        [11111111, 2],
        [22222222, 1],
      ])
    })
  })

  describe('téléchargement', () => {
    it('crée un lien de téléchargement puis libère l’URL', () => {
      vi.useFakeTimers()
      // jsdom n'implémente pas createObjectURL : on le simule, puis on restaure à la fin.
      const { createObjectURL, revokeObjectURL } = URL
      const create = vi.fn(() => 'blob:fictif')
      const revoke = vi.fn()
      URL.createObjectURL = create
      URL.revokeObjectURL = revoke
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

      downloadFile('collection.json', '{}', 'application/json')

      expect(create).toHaveBeenCalledWith(expect.any(Blob))
      expect(click).toHaveBeenCalledOnce()
      // `contexts` contient le `this` de chaque appel : ici, le lien créé.
      const link = click.mock.contexts[0]
      expect(link).toBeInstanceOf(HTMLAnchorElement)
      expect(link).toHaveProperty('download', 'collection.json')
      expect(document.querySelector('a[download]')).toBeNull()
      expect(revoke).not.toHaveBeenCalled()
      vi.runAllTimers()
      expect(revoke).toHaveBeenCalledWith('blob:fictif')

      click.mockRestore()
      URL.createObjectURL = createObjectURL
      URL.revokeObjectURL = revokeObjectURL
      vi.useRealTimers()
    })

    it('génère un nom de fichier daté', () => {
      expect(exportFilename('csv', new Date('2026-11-20T10:00:00.000Z'))).toBe(
        'collection-2026-11-20.csv',
      )
    })
  })
})
