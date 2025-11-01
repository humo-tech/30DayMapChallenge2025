<script setup>
const route = useRoute()
const { data } = await useAsyncData(() => queryCollection('content').path(route.path).first())
useSeoMeta({
  title: data.value?.title,
  description: data.value?.description
})
</script>

<template>
  <ContentRenderer v-if="data" :value="data" />
  <div v-else>Page not found</div>
</template>