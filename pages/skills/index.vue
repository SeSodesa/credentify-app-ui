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
  async asyncData({ app, params }) {
    try {
      const credentials = await app.$axios
        .get('/profile/credentials')
        .then((result) => result.data.data)
      return { credentials }
    } catch (err) {
      return { asyncDataError: err }
    }
  },
  computed: {
    /* Filters data for drawing the summary graph */
    tagData() {
      const tagData = {}
      for (const credential of this.credentials) {
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
      const dataArray = []
      for (const item of Object.values(tagData)) {
        dataArray.push(item)
      }
      return dataArray
    },
    // Generates the data used in drawing the summary figure
    option() {
      return {
        // legend: {
        //   top: 'bottom'
        // },
        // toolbox: {
        //   show: false,
        //   feature: {
        //     mark: { show: true },
        //     dataView: { show: true, readOnly: false },
        //     restore: { show: true },
        //     saveAsImage: { show: true }
        //   }
        // },
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
            data: [...this.tagData] // [
            //   { value: 40, name: 'petal 1' },
            //   { value: 38, name: 'petal 2' },
            //   { value: 32, name: 'petal 3' },
            //   { value: 30, name: 'petal 4' },
            //   { value: 28, name: 'petal 5' },
            //   { value: 26, name: 'petal 6' },
            //   { value: 22, name: 'petal 7' },
            //   { value: 18, name: 'petal 8' }
            // ]
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
</style>
