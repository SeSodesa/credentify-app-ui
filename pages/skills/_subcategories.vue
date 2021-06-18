<!--
This page displays graphs related to the subcategories of the credential tags
-->
<template>
  <div class="stage">
    <div class="icon--title mb-2">
      <img src="~/assets/icons/bootstrap-puzzle-big.svg" alt="Skills image" />
      <h1>Subskills</h1>
    </div>
    <div class="subtitle">
      A summary page of your earned skills and achievements.
    </div>
  </div>
</template>
<script>
export default {
  created() {
    this.$store.commit('nav/setTitle', 'Subskills')
    this.$store.commit('nav/setBackUrl', '/skills')
  }
}
</script>
<style></style>
