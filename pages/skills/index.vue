<template>
  <div class="stage">
    <div class="icon--title mb-2">
      <img src="~/assets/icons/bootstrap-puzzle-big.svg" alt="Skills image" />
      <h1>Skills</h1>
    </div>
    <div class="subtitle">
      A summary page of your earned skills and achievements.
    </div>
    <v-chart v-if="credentialsExist" class="summary-chart" :option="option" />
    <div v-else class="hol-up-box">
      No credentials to display yet. Hol' up…
    </div>
  </div>
</template>

<script>
import * as echarts from 'echarts/core'
import { LegendComponent } from 'echarts/components'
import { PieChart } from 'echarts/charts'
import { SVGRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'

echarts.use([LegendComponent, PieChart, SVGRenderer])

export default {
  components: {
    VChart
  },
  computed: {
    credentials() {
      return this.$store.state.credentials.credentials
    },
    /* Filters data for drawing the summary graph */
    tagData() {
      const tagData = {}
      for (const credential of this.credentials) {
        if (credential.stage === 5) {
          const achievement = credential.achievement
          for (const tag of achievement.tag) {
            /* Not supported by older browsers, but who cares */
            const normalizedTag = tag
              .normalize()
              .trim()
              .toUpperCase()
            if (tag in tagData) {
              tagData[normalizedTag].value += 1
            } else {
              tagData[normalizedTag] = { value: 1, name: normalizedTag }
            }
          }
        }
      }
      return Object.values(tagData)
    },
    credentialsExist() {
      return this.credentials.length > 0
    },
    // Generates the data used in drawing the summary figure
    option() {
      return {
        series: [
          {
            name: "A nightingale's rose",
            type: 'pie',
            radius: [50, 250],
            center: ['50%', '50%'],
            roseType: 'area',
            itemStyle: {
              borderRadius: 8
            },
            data: [...this.tagData]
          }
        ]
      }
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
  min-height: 550px;
  width: 100%;
}

.hol-up-box {
  align-items: center;
  font-size: 20px;
  height: 200px;
  text-align: center;
  width: 100%;
}
</style>
