export class CardPrice {
  cardmarket_price: number
  coolstuffinc_price: number
  tcgplayer_price: string
  ebay_price: string
  amazon_price: number

  constructor(
    cardmarket_price: number,
    coolstuffinc_price: number,
    tcgplayer_price: string,
    ebay_price: string,
    amazon_price: number,
  ) {
    this.cardmarket_price = cardmarket_price
    this.coolstuffinc_price = coolstuffinc_price
    this.tcgplayer_price = tcgplayer_price
    this.ebay_price = ebay_price
    this.amazon_price = amazon_price
  }
}
