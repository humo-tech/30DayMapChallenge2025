<script setup lang="ts">
const route = useRoute()
console.log(route.path)
const { data: page } = await useAsyncData(route.path, () => {
  return queryCollection("content").order("id", "ASC").all()
});
console.log(page)

//useSeoMeta({
//  title: home.value?.title,
//  description: home.value?.description
//})
</script>

<template>
  <main>
    <h1>30DayMapChallenge 2025</h1>
    <ul v-if="page" class="list">
      <template v-for="article in page" :key="article.path">
        <NuxtLink :to="article.path" class="list_item">
            <li>
              <p>{{ article.title }}</p>
              <p>{{ article.description }}</p>
            </li>
        </NuxtLink>
      </template>
    </ul>
  </main>
</template>

<style scoped>
* {
  font-family: sans-serif;
}
h1 {
  padding: 20px;
  margin: 0; 
  font-family: sans-serif;
  font-size: 32px;
  background-color: rgba(0, 0, 90, 0.5);
  color: #ffffff;
}
main {
  width: 100vw;
  height: 100vh;
  background: linear-gradient(to bottom right, #606a72ff, #342f2fff, #262a2cff);
}
.list {
  list-style: none;
  padding: 0;
  display: flex;
  gap: 20px;
  flex-wrap: wrap; 
  justify-content: center;
} 
.list_item {
  margin-bottom: 10px;
  display: block;
  width: 300px;
  height: 100px;
  border-radius: 10px;
  border: 1px solid #333333;
  background: linear-gradient(to bottom right, #000000, #1d133b);
  text-align: center;
  padding: 20px;
  text-decoration: none;
  color: #ffffff;
} 
.list_item:hover {
  background: linear-gradient(to bottom right, #1d133b, #000000);
  box-shadow: 0 0 5px #ffffff;
  transition: all 0.3s ease;
  transform: translateY(-5px);
} 
</style>