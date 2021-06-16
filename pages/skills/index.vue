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
    <div v-else>
      No credentials to display…
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
  async asyncData({ app, params }) {
    try {
      const credentials = await app.$axios
        .get('/profile/credentials')
        .then((result) => result.data.data)
      const skillMapping = await app.$axios
        .get(
          'https://gitlab.com/' +
            'api/v4/projects/27130233/jobs/artifacts/main/raw/the_mapping.json',
          {
            params: { job: 'make_json_mapping' },
            headers: {
              /*  Request access without authorization, as none is needed. */
              Authorization: ''
            }
          }
        )
        .then((result) => result.data)
      return { credentials, skillMapping }
    } catch (err) {
      return { asyncDataError: err }
    }
  },
  computed: {
    /* Filters data for drawing the summary graph */
    tagData() {
      const tagData = {}
      const categories = {}
      for (const credential of this.credentials) {
        // if (credential.stage === 5) {
        const achievement = credential.achievement
        for (const tag of achievement.tag) {
          /* Not supported by older browsers, but who cares */
          const normalizedTag = this.normalizeTag(tag)
          const catAndSubCat = this.skillMapping[normalizedTag]
          if (catAndSubCat !== undefined) {
            const category = catAndSubCat.category
            const subCategory = catAndSubCat['sub-category']
            /* Check for existence of category */
            if (category in categories) {
              categories[category].value += 1
            } else {
              categories[category] = {
                value: 1,
                name: category,
                subCategories: {}
              }
            }
            /* Then check for subcategory in category */
            if (subCategory in categories[category].subCategories) {
              categories[category].subCategories[subCategory].value += 1
            } else {
              categories[category].subCategories[subCategory] = {
                value: 1,
                name: subCategory
              }
            }
          } else {
            continue
          }
          if (normalizedTag in tagData) {
            tagData[normalizedTag].value += 1
          } else {
            tagData[normalizedTag] = { value: 1, name: normalizedTag }
          }
        }
        // }
      }
      console.log(categories)
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
            label: {
              fontSize: 18
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
  },
  methods: {
    normalizeTag(tag) {
      const whitespaceNormalized = tag
        .trim()
        .split(/\s+/)
        .join(' ')
      const capitalized =
        whitespaceNormalized.charAt(0).toUpperCase() +
        whitespaceNormalized.slice(1).toLowerCase()
      return capitalized
    }
  }
}
</script>

<style>
.summary-chart {
  min-height: 550px;
  width: 100%;
}
</style>
