<script setup lang="ts">
import { reactive, ref } from 'vue'
import { YGOProDeckDTO } from './dto/ygoProDeckDTO'
import { Card } from './model/Card/card'
import type { CardSearchParameters } from './model/Card/cardSearchParameter'
import { CardType } from './model/Card/cardType'

const cardsInfo = ref<Card[]>()
const cardSearchParameter = reactive<CardSearchParameters>({ language: 'en' })

const querySelectorAll: NodeList<Element> = (query: string) => {
  return document.querySelectorAll(query)
}
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
            for (const value of querySelectorAll(`input[name='type']`)) {
              value.checked = false
            }
            delete cardSearchParameter.type
          }
        "
      >
        ❌Clear Type
      </button>
    </div>

    <button
      v-on:click="
        () => {
          cardsInfo?.splice(0)
          YGOProDeckDTO.prototype.list(cardSearchParameter).then((result) => (cardsInfo = result))
        }
      "
    >
      Chercher
    </button>
    <template v-for="(item, index) in cardsInfo" :key="index">
      <div>{{ item.name }}</div>
    </template>
  </main>
</template>

<style scoped>
.wrapper {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
}
</style>
