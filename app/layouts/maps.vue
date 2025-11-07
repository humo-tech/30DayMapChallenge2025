<script setup>
const route = useRoute()
const data = await queryCollection('content').path(route.path).first()
</script>

<template>
  <header>
    <div>
      <h1>{{ data.title }}</h1>
      <h2>{{ data.description }}</h2>
    </div>
  </header>
  <main>
    <slot />
  </main>
</template>

<style scoped>
header {
    position: absolute;
    top: 0;
    left: 0;
    color: white;
    width: 100%;
    text-align: center;
    background-color: rgba(0, 0, 90, 0.5);
    z-index: 10;
}
h1 {
    margin: 10px 20px 0 20px;
    font-family: sans-serif;
    font-size: 24px;
}
h2 {
    margin: 0 20px 10px 20px;
    font-family: sans-serif;
    font-weight: normal;
    font-size: 18px;
}
</style>