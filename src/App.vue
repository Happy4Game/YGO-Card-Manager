<script setup lang="ts">
import { reactive, ref } from 'vue'
import { YGOProDeckDTO } from './dto/ygoProDeckDTO'
import { Card } from './model/Card/card'
import type { CardSearchParameters } from './model/Card/cardSearchParameter'
import { CardType } from './model/Card/cardType'
import { CardRace } from './model/Card/cardRace'
import { CardMonster } from './model/Card/cardMonster'
import type { CardSpell } from './model/Card/cardSpell'
import type { CardPendulum } from './model/Card/cardPendulum'
import type { CardAchetype } from './model/Card/cardArchetype'
import type { CardLink } from './model/Card/cardLink'

const cardsInfo =
  ref<Array<Card | CardMonster | CardLink | CardAchetype | CardPendulum | CardSpell>>()
const cardSearchParameter = reactive<CardSearchParameters>({ language: 'en' })

const querySelectorAll = <T extends Element>(query: string): NodeListOf<T> => {
  return document.querySelectorAll(query)
}
const promiseStatus = ref<string>()
const promiseError = ref<string>()
</script>

<template>
  <header></header>

  <main>
    <div>
      Language
      <input
        type="radio"
        name="lang"
        id="fr"
        v-on:input="() => (cardSearchParameter.language = 'fr')"
      /><label for="fr">Français</label>
      <input
        type="radio"
        name="lang"
        id="en"
        checked="true"
        v-on:input="() => (cardSearchParameter.language = 'en')"
      /><label for="en">Anglais</label>
    </div>

    <p>Chercher par nom</p>
    <input type="text" v-model="cardSearchParameter.fname" />

    <h2>Type</h2>
    <div class="wrapper">
      <div class="" v-for="(item, index) in Object.values(CardType).sort()" :key="index">
        <input
          type="radio"
          name="type"
          :id="item"
          v-on:change="
            (event: any) => {
              if (event.target.checked == false) {
                delete cardSearchParameter.type
              } else {
                cardSearchParameter.type = item
              }
            }
          "
        />
        <label :for="item">{{ item }}</label>
      </div>
      <button
        v-on:click="
          () => {
            for (const value of querySelectorAll<HTMLInputElement>(`input[name='type']`)) {
              value.checked = false
            }
            delete cardSearchParameter.type
          }
        "
      >
        ❌Clear Type
      </button>
    </div>

    <h2>Race</h2>
    <div class="wrapper">
      <div class="" v-for="(item, index) in Object.values(CardRace).sort()" :key="index">
        <input
          type="radio"
          name="race"
          :id="item"
          v-on:change="
            (event: any) => {
              if (event.target.checked == false) {
                delete cardSearchParameter.race
              } else {
                cardSearchParameter.race = item
              }
            }
          "
        />
        <label :for="item">{{ item }}</label>
      </div>
      <button
        v-on:click="
          () => {
            for (const value of querySelectorAll<HTMLInputElement>(`input[name='race']`)) {
              value.checked = false
            }
            delete cardSearchParameter.race
          }
        "
      >
        ❌Clear Race
      </button>
    </div>

    <button
      v-on:click="
        () => {
          promiseStatus = 'pending'
          cardsInfo?.splice(0)
          YGOProDeckDTO.prototype
            .list(cardSearchParameter)
            .then((result) => {
              cardsInfo = result
              promiseStatus = 'fullfield'
            })
            .catch((err) => {
              promiseStatus = 'error'
              promiseError = err
            })
        }
      "
    >
      Chercher
    </button>
    <p v-if="promiseStatus === 'pending'">Request pending</p>
    <p v-else-if="promiseStatus === 'error' && cardsInfo?.length === 0">No result found</p>
    <table v-else>
      <thead>
        <tr>
          <th>Name</th>
          <th>Level</th>
          <th>Type</th>
          <th>Price Cardmarket</th>
          <th>Quantity</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(item, index) in cardsInfo" :key="index">
          <td>
            <a :href="item.ygoprodeck_url" target="_blank">{{ item.name }}</a>
          </td>
          <td>
            <template v-if="item instanceof CardMonster">
              {{ item.level !== 0 ? item.level : '' }}
            </template>
          </td>
          <td>
            <template v-if="item instanceof CardMonster">
              {{ item.type }}
            </template>
          </td>
          <td>{{ item.card_prices.cardmarket_price }}€</td>
          <td>0</td>
          <td><button>Ajouter</button></td>
        </tr>
      </tbody>
    </table>
  </main>
</template>

<style scoped>
.wrapper {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
}
table {
  padding: 0;
  margin: 0;
  width: 100%;
  text-align: center;
  border: solid 1px black;
}
</style>
