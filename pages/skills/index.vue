<template>
  <div class="stage">
    <div class="icon--title mb-2">
      <img src="~/assets/icons/bootstrap-puzzle-big.svg" alt="Skills image" />
      <h1>Skills</h1>
    </div>
    <div class="subtitle">
      A summary page of your earned skills and achievements.
    </div>
    <v-chart :option="option" />
  </div>
</template>

<script>
import * as echarts from 'echarts/core'
import { ToolboxComponent, LegendComponent } from 'echarts/components'
import { PieChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'

echarts.use([ToolboxComponent, LegendComponent, PieChart, CanvasRenderer])

export default {
  components: {
    VChart
  },
  data() {
    return {
      async achievements() {
        try {
          const achievements = await this.$axios
            .get('/achievements')
            .then((result) => result.data.data)
          return achievements
        } catch (e) {
          this.handleErrors(e)
        }
      }
    }
  },
  computed: {
    // Generates the data used in drawing the summary figure
    option() {
      return {
        legend: {
          top: 'bottom'
        },
        toolbox: {
          show: false,
          feature: {
            mark: { show: true },
            dataView: { show: true, readOnly: false },
            restore: { show: true },
            saveAsImage: { show: true }
          }
        },
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
            data: [
              { value: 40, name: 'petal 1' },
              { value: 38, name: 'petal 2' },
              { value: 32, name: 'petal 3' },
              { value: 30, name: 'petal 4' },
              { value: 28, name: 'petal 5' },
              { value: 26, name: 'petal 6' },
              { value: 22, name: 'petal 7' },
              { value: 18, name: 'petal 8' }
            ]
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
  height: 100%;
  width: 100%;
}
</style>
