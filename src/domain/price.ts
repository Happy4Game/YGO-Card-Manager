/**
 * Un relevé de prix d'une carte, enregistré localement à une date donnée.
 * Source : `card_prices` de l'API YGOPRODeck (https://ygoprodeck.com/api-guide/).
 * `cardmarket` est le prix le plus bas toutes impressions confondues (« the lowest price found
 * across multiple versions of that card »), en euros.
 */
export interface PricePoint {
  id?: number
  cardId: number
  /** Jour du relevé, format AAAA-MM-JJ (un seul relevé par carte et par jour). */
  date: string
  /** Prix Cardmarket en euros, `null` si l'API n'en donne pas. */
  cardmarket: number | null
}

/** Prix tels que renvoyés par l'API (chaînes de caractères converties en nombres). */
export interface CardPrices {
  cardId: number
  cardmarket: number | null
}
