<template>
  <div class="relative h-full min-h-screen">
    <TheNavBar />
    <div class="pt-10 px-10 flex justify-center align-middle">
      <p class="text-4xl pt-3 px-1 mt-1 text-black underline">GEM</p>
      <img :width="50" :height="50" src="./assets/logo.png" />
      <p class="text-4xl pt-3 px-2 mt-1 text-black underline">FARM</p>
    </div>
    <div class="italic mt-5 text-center">by Gemworks</div>

    <div class="p-10">
      <router-view />
    </div>

    <div class="pt-10"></div>
  </div>
</template>

<script>
import TheNavBar from '@/components/TheNavBar';
export default {
  components: { TheNavBar },
};
</script>

<style>
* {
  font-family: 'Press Start 2P', monospace;
}
input[type='radio']:checked + span {
  @apply text-black;
}
</style>
