import type { CardRace } from './cardRace'
import type { CardType } from './cardType'

export type CardSearchParameters = {
  fname?: string //- A fuzzy search using a string. For example &fname=Magician to search by all cards with "Magician" in the name.
  id?: number //- The 8-digit passcode of the card. You cannot pass this alongside name. You can pass multiple comma separated IDs to this parameter.
  konami_id?: number //- The Konami ID of the card. This is not the passcode.
  type?: CardType //- The type of card you want to filter by. See below "Card Types Returned" to see all available types. You can pass multiple comma separated Types to this parameter.
  atk?: string //- Filter by atk value.
  def?: string //- Filter by def value.
  level?: number //- Filter by card level/RANK.
  race?: CardRace //- Filter by the card race which is officially called type (Spellcaster, Warrior, Insect, etc). This is also used for Spell/Trap cards (see below). You can pass multiple comma separated Races to this parameter.
  attribute?: string //- Filter by the card attribute. You can pass multiple comma separated Attributes to this parameter.
  link?: string //- Filter the cards by Link value.
  linkmarker?: Array<string> //- Filter the cards by Link Marker value (Top, Bottom, Left, Right, Bottom-Left, Bottom-Right, Top-Left, Top-Right). You can pass multiple comma separated values to this parameter (see examples below).
  scale?: number //- Filter the cards by Pendulum Scale value.
  cardset?: string //- Filter the cards by card set (Metal Raiders, Soul Fusion, etc).
  archetype?: string //- Filter the cards by archetype (Dark Magician, Prank-Kids, Blue-Eyes, etc).
  banlist?: string //- Filter the cards by banlist (TCG, OCG, Goat).
  sort?: string //- Sort the order of the cards (atk, def, name, type, level, id, new).
  format?: string //- Sort the format of the cards (tcg, goat, ocg goat, speed duel, master duel, rush duel, duel links, genesys). Note: Duel Links is not 100% accurate but is close. Using tcg results in all cards with a set TCG Release Date and excludes Speed Duel/Rush Duel cards.
  misc?: string //- Pass yes to show additional response info (details).
  staple?: boolean //- Check if card is a staple.
  has_effect?: boolean //- Check if a card actually has an effect or not by passing a boolean true/false. Examples of cards that do not have an actual effect: Black Skull Dragon, LANphorhynchus, etc etc.
  //startdate, enddate and dateregion - Filter based on cards' release date. Format dates as YYYY-mm-dd. Pass dateregion as tcg (default) or ocg.
}
