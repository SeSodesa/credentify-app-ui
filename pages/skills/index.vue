<template>
  <div class="stage">
    <div class="icon--title mb-2">
      <img src="~/assets/icons/bootstrap-puzzle-big.svg" alt="Skills image" />
      <h1>Skills</h1>
    </div>
    <div class="subtitle">
      A summary page of your earned skills and achievements.
    </div>
    <v-chart class="summary-chart" :option="option" />
  </div>
</template>

<script>
export default {
  data() {
    return {
      achievements: []
    }
  },
  created() {
    this.$store.commit('nav/setTitle', 'Skills')
    this.$store.commit('nav/setBackUrl', '')
  }
}
</script>

<style>
.summary-chart {
  height: 100%;
  width: 100%;
}
</style>
