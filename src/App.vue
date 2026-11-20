<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <a class="skip-link" href="#main">Aller au contenu</a>
  <header>
    <nav aria-label="Navigation principale">
      <RouterLink to="/">Recherche</RouterLink>
      <RouterLink to="/collection">Ma collection</RouterLink>
      <RouterLink to="/about">À propos</RouterLink>
    </nav>
  </header>

  <main id="main" tabindex="-1">
    <RouterView />
  </main>

  <footer>
    <small>Projet non officiel, non affilié à Konami. Données : YGOPRODeck.</small>
  </footer>
</template>

<style scoped>
.skip-link {
  position: absolute;
  left: -9999px;
}
.skip-link:focus {
  left: 1rem;
  top: 1rem;
}
nav {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}
nav a.router-link-exact-active {
  font-weight: bold;
  text-decoration: underline;
}
</style>
