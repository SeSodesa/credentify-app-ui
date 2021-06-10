<template>
  <div class="stage">
    <div class="icon--title mb-2">
      <img src="~/assets/icons/credentials-big.svg" alt="Skills image" />
      <h1>Skills</h1>
    </div>
    <div class="subtitle">
      A summary page of your earned skills and achievements.
    </div>
  </div>
</template>

<script>
export default {
  created() {
    this.$store.commit('nav/setTitle', 'Skills')
    this.$store.commit('nav/setBackUrl', '')
  }
}
</script>

<style></style>
