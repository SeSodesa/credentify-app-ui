<template>
  <div class="stage">
    <div v-if="currentCategoryLevel < maxCategoryLevel">
      <div class="icon--title mb-2">
        <img src="~/assets/icons/bootstrap-puzzle-big.svg" alt="Skills image" />
        <h1>Skills</h1>
      </div>
      <div class="subtitle">
        A summary page of your earned skills and achievements. Click on a petal
        to view information related to the skill category.
      </div>
    </div>
    <div v-else-if="currentCategoryLevel === maxCategoryLevel">
      <div class="icon--title">
        <img src="~/assets/icons/credentials-big.svg" alt="Credential logo" />
        <h1>Credential details</h1>
      </div>
      <button class="pointable back-from-details" @click="backUp">
        ↑ Back up
      </button>
    </div>
    <div v-else>
      <h1>Oops. Something went wrong…</h1>
    </div>
    <v-chart
      v-if="credentialsExist && currentCategoryLevel < maxCategoryLevel"
      :ref="'category-chart'"
      class="category-chart"
      :option="currentChartOption"
      @click="chartClickAction"
    />
    <single-credential-view
      v-else-if="credentialsExist && currentCategoryLevel === maxCategoryLevel"
      :credential="credential"
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
import SingleCredentialView from '~/components/SingleCredentialView'

echarts.use([TitleComponent, PieChart, SVGRenderer])

export default {
  components: {
    VChart,
    SingleCredentialView
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
      backUrl: '/skills',
      categoryLevels: Object.freeze({
        1: {
          name: 'Main categories',
          color: '#0C6291'
        },
        2: {
          name: 'Subcategories',
          color: '#4C9F70'
        },
        3: {
          name: 'Skills',
          color: '#9A348E'
        },
        4: {
          name: 'Credentials',
          color: '#C69DD2'
        },
        5: {
          name: 'Specific credential'
        }
      }),
      credentialData: {},
      categoryLevelTitles: {
        mainCategory: {
          text: 'Main categories',
          subtext: '',
          triggerEvent: false
        },
        subCategory(breadcrumb) {
          return {
            text: breadcrumb.join(' → '),
            subtext: '↑ Back up',
            subtextStyle: {
              fontSize: 14
            },
            triggerEvent: true
          }
        }
      },
      commonSeriesSettings: {
        id: 'Skill tree visualization',
        type: 'pie',
        radius: [50, 250],
        center: ['50%', '50%'],
        roseType: 'area',
        itemStyle: {
          borderRadius: 8
        },
        label: {
          fontSize: 20,
          formatter(petal) {
            if ('credential' in petal.data) {
              const achievement = petal.data.credential.achievement
              return (
                achievement.name +
                '\n' +
                'ECTS: ' +
                achievement.ectsCreditPoints
              )
            } else {
              return petal.name + '\n' + 'Instances: ' + petal.value
            }
          },
          position: 'outer',
          alignTo: 'edge',
          edgeDistance: 0,
          distanceToLabelLine: 10
        }
      },
      breadcrumb: [],
      optionStackData: []
    }
  },
  computed: {
    credential: {
      get() {
        return this.credentialData
      },
      set(newValue) {
        this.credentialData = newValue
      }
    },
    optionStack() {
      return this.optionStackData
    },
    currentCategoryLevel() {
      return this.optionStackData.length
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
    maxCategoryLevel() {
      return Object.keys(this.categoryLevels).length
    },
    // Generates the data used in drawing the summary figure
    mainChartOption() {
      return {
        title: this.categoryLevelTitles.mainCategory,
        series: [
          {
            name: 'Main categories',
            ...this.commonSeriesSettings,
            data: Object.values(this.skillTree)
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
    this.breadcrumb.push('Main categories')
  },
  methods: {
    backUp() {
      this.breadcrumb.pop()
      this.optionStack.pop()
      this.credential = {}
    },
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
            color: this.categoryLevels[this.currentCategoryLevel + 1].color,
            name: label,
            ...this.commonSeriesSettings,
            data: data !== null ? Object.values(data) : {}
          }
        ]
      }
      this.optionStack.push(newOption)
    },
    chartClickAction(chartComponent) {
      const componentData = chartComponent.data
      if (chartComponent.componentType === 'title') {
        this.backUp()
      } else if (chartComponent.componentType === 'series') {
        if (this.currentCategoryLevel < this.maxCategoryLevel - 1) {
          this.breadcrumb.push(componentData.name)
          this.pushChartOption(
            this.categoryLevels[this.currentCategoryLevel + 1].name,
            componentData.children
          )
        } else if (this.currentCategoryLevel === this.maxCategoryLevel - 1) {
          this.breadcrumb.push(componentData.name)
          this.pushChartOption(componentData.name, null)
          this.credential = componentData.credential
        } else {
          return false
        }
      } else {
        return false
      }
      return true
    },
    // Generates a gradient of colors from a given darkest base color (0xRGB)
    // and a number of color tints above it
    colorTints(darkestColor, nOfTints) {
      // Which idiot included conflicting linters.
      // "Unicorn numbers" my ass…
      const colorMax = parseInt('0xff', 16)
      const darkestAsInt = parseInt(darkestColor, 16)
      if (darkestAsInt > colorMax || darkestAsInt < 0x00) {
        return null
      }
      const darkestRed = darkestAsInt >> 16
      const darkestGreen = (darkestAsInt << 16) >> 24
      const darkestBlue = (darkestAsInt << 24) >> 24
      const darkestMax = Math.max(darkestRed, darkestGreen, darkestBlue)
      const colorDiff = colorMax - darkestMax
      const colorStep = (1 / nOfTints) * colorDiff
      const tints = [darkestColor]
      for (let ii = 0; ii < nOfTints; ii++) {
        const nextRed = Math.floor(darkestRed + ii * colorStep)
        const nextGreen = Math.floor(darkestGreen + ii * colorStep)
        const nextBlue = Math.floor(darkestBlue + ii * colorStep)
        const nextHex =
          '0x' + String((nextRed << 16) + (nextGreen << 8) + nextBlue)
        tints.push(nextHex)
      }
      return tints
    }
  }
}
</script>

<style>
.category-chart {
  min-height: 600px;
  width: 100%;
}

.back-from-details {
  font-size: 16px;
}

.pointable:hover {
  cursor: pointer;
}
</style>
