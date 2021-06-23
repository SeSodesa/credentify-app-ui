<template>
  <div class="stage">
    <div class="icon--title mb-2">
      <img src="~/assets/icons/bootstrap-puzzle-big.svg" alt="Skills image" />
      <h1>Skills</h1>
    </div>
    <div class="subtitle">
      A summary page of your earned skills and achievements. Click on a petal to
      view information related to the skill category.
    </div>
    <v-chart
      v-if="credentialsExist"
      :ref="'category-chart'"
      class="category-chart"
      :option="currentChartOption"
      @click="chartClickAction"
    />
    <div v-else>
      No credentials to display…
    </div>
  </div>
</template>

<script>
import * as echarts from 'echarts/core'
import { TitleComponent } from 'echarts/components'
import { PieChart } from 'echarts/charts'
import { SVGRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'

echarts.use([TitleComponent, PieChart, SVGRenderer])

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
  data() {
    return {
      categoryLevels: Object.freeze({
        1: {
          name: 'Main categories'
        },
        2: {
          name: 'Subcategories'
        },
        3: {
          name: 'Skills'
        },
        4: {
          name: 'Credentials'
        }
      }),
      categoryLevel: 1,
      chartOption: {},
      categoryLevelTitles: {
        mainCategory: {
          text: 'Main categories',
          subtext: '',
          triggerEvent: false
        },
        subCategory(breadcrumb) {
          return {
            text: '→ ' + breadcrumb.join(' → '),
            subtext: '↑ Back up',
            subtextStyle: {
              fontSize: 14
            },
            triggerEvent: true
          }
        }
      },
      commonSeriesSettings: {
        type: 'pie',
        radius: [50, 250],
        center: ['50%', '50%'],
        roseType: 'area',
        itemStyle: {
          borderRadius: 8
        },
        label: {
          fontSize: 18,
          formatter: '{b}: {c}'
        }
      },
      breadcrumb: [],
      optionStackData: []
    }
  },
  computed: {
    optionStack: {
      get() {
        return this.optionStackData
      },
      set(newValue) {
        this.optionStackData = newValue
      }
    },
    currentCategoryLevel: {
      get() {
        return this.optionStackData.length
      }
    },
    /* Filters data for drawing the summary graph */
    skillTree() {
      const skillTree = {}
      for (const credential of this.credentials) {
        // if (credential.stage === 5) {
        const achievement = credential.achievement
        for (const tag of achievement.tag) {
          const normalizedTag = this.normalizeTag(tag)
          const catAndSubCat = this.skillMapping[normalizedTag]
          if (catAndSubCat !== undefined) {
            const category = catAndSubCat.category
            const subCategory = catAndSubCat['sub-category']
            /* Check for existence of category */
            if (category in skillTree) {
              skillTree[category].value += 1
            } else {
              skillTree[category] = {
                value: 1,
                name: category,
                url: `/skills/${this.toValidURL(category)}`,
                children: {}
              }
            }
            /* Then check for subcategory in category */
            if (subCategory in skillTree[category].children) {
              skillTree[category].children[subCategory].value += 1
            } else {
              skillTree[category].children[subCategory] = {
                value: 1,
                name: subCategory,
                url: `skills/${this.toValidURL(category)}/${this.toValidURL(
                  subCategory
                )}`,
                children: {}
              }
            }
            /* Finally, attach skill information and credential to subcategories */
            const skill = normalizedTag
            if (skill in skillTree[category].children[subCategory].children) {
              skillTree[category].children[subCategory].children[
                skill
              ].value += 1
            } else {
              skillTree[category].children[subCategory].children[skill] = {
                value: 1,
                name: skill,
                children: {}
              }
            }
            /* Check for existence of credential in the skill */
            if (
              credential[credential.id] in
              skillTree[category].children[subCategory].children[skill].children
            ) {
              skillTree[category].children[subCategory].children[
                skill
              ].children[credential.id].value += 1
            } else {
              skillTree[category].children[subCategory].children[
                skill
              ].children[credential.id] = {
                value: 1,
                name: credential.achievement.name,
                credential,
                url: `skills/${this.toValidURL(category)}/${this.toValidURL(
                  subCategory
                )}/${this.toValidURL(credential.achievement.name)}`
              }
            }
          }
        }
        // }
      }
      return skillTree
    },
    credentialsExist() {
      return this.credentials.length > 0
    },
    // Generates the data used in drawing the summary figure
    mainChartOption() {
      return {
        title: this.categoryLevelTitles.mainCategory,
        series: [
          {
            id: 'Skill tree',
            name: 'Main categories',
            ...this.commonSeriesSettings,
            data: [...Object.values(this.skillTree)]
          }
        ]
      }
    },
    currentChartOption() {
      return this.optionStack[this.optionStack.length - 1]
    }
  },
  created() {
    this.$store.commit('nav/setTitle', 'Skills')
    this.$store.commit('nav/setBackUrl', '')
  },
  mounted() {
    // this.chartOption = this.mainChartOption
    this.optionStack.push(this.mainChartOption)
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
    },
    toValidURL(category) {
      const lower = category.trim().toLowerCase()
      return lower.split(/\s+/).join('_')
    },
    followCategoryLink(event) {
      window.location.href = event.data.url
    },
    pushChartOption(label, data) {
      const newOption = {
        title: this.categoryLevelTitles.subCategory(this.breadcrumb),
        series: [
          {
            name: label,
            ...this.commonSeriesSettings,
            data: [...Object.values(data)]
          }
        ]
      }
      this.optionStack.push(newOption)
    },
    chartClickAction(chartComponent) {
      const componentData = chartComponent.data
      if (chartComponent.componentType === 'title') {
        if (this.currentCategoryLevel > 1) {
          // Remove category key from breadcrumb
          this.breadcrumb.pop()
          this.optionStack.pop()
        }
      } else if (chartComponent.componentType === 'series') {
        if (
          this.currentCategoryLevel < Object.keys(this.categoryLevels).length
        ) {
          this.breadcrumb.push(componentData.name)
          const optionData = componentData.children
          this.pushChartOption(
            this.categoryLevels[this.currentCategoryLevel + 1].name,
            optionData
          )
        } else {
          return false
        }
      } else {
        return false
      }
      return true
    }
  }
}
</script>

<style>
.category-chart {
  min-height: 600px;
  width: 100%;
}
</style>
