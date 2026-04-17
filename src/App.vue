<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { YGOProDeckDTO } from './dto/ygoProDeckDTO'
import { Card } from './model/Card/card'

const cardsInfo = ref<Card[]>()

onMounted(() => {
  YGOProDeckDTO.prototype
    .list({ fname: 'Magicien', scale: 1 })
    .then((result) => (cardsInfo.value = result))
})
</script>

<template>
  <header></header>

  <main>
    {{ cardsInfo }}
  </main>
</template>

<style scoped></style>
