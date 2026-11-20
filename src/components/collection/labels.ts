import type { CardCondition } from '@/domain/collection'
import { COLLECTION_LANGUAGES } from '@/services/collection'

/** Libellés français des états (les valeurs stockées restent celles des marchés européens). */
export const CONDITION_LABELS: Record<CardCondition, string> = {
  Mint: 'Mint (parfait)',
  'Near Mint': 'Near Mint (quasi neuf)',
  Excellent: 'Excellent (très bon)',
  Good: 'Good (bon)',
  'Light Played': 'Light Played (légèrement joué)',
  Played: 'Played (joué)',
  Poor: 'Poor (abîmé)',
}

export function languageLabel(code: string): string {
  return COLLECTION_LANGUAGES.find((language) => language.code === code)?.label ?? code
}

export function locationLabel(location: string): string {
  return location === '' ? 'Sans emplacement' : location
}

export function setLabel(prefix: string): string {
  return prefix === '' ? 'Sans code' : prefix
}
