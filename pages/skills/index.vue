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
        category: 0,
        subCategory: 1,
        skill: 2,
        credential: 3
      }),
      categoryLevel: '',
      chartOption: {},
      categoryLevelTitles: {
        mainCategory: {
          text: 'Main categories',
          subtext: '',
          triggerEvent: false
        },
        subCategory(mainCategoryName) {
          return {
            text: 'Subcategories of ' + mainCategoryName,
            subtext: '↑ Back up',
            subtextStyle: {
              fontSize: 14
            },
            triggerEvent: true
          }
        },
        skill(subCategoryName) {
          return {
            text: 'Skills within ' + subCategoryName,
            subtext: '↑ Back up',
            subtextStyle: {
              fontSize: 14
            },
            triggerEvent: true
          }
        },
        credential(skillName) {
          return {
            text: 'Credentials making up ' + skillName,
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
      optionStack: []
    }
  },
  computed: {
    currentCategoryLevel: {
      get() {
        if (this.categoryLevel) {
          return this.categoryLevel
        } else {
          return this.categoryLevels.category
        }
      },
      set(newValue) {
        if (
          newValue === this.categoryLevels.category ||
          newValue === this.categoryLevels.subCategory ||
          newValue === this.categoryLevels.skill ||
          newValue === this.categoryLevels.credential
        ) {
          this.categoryLevel = newValue
        }
      }
    },
    /* Filters data for drawing the summary graph */
    skillTree() {
      console.log('Generating skill tree…')
      console.log(this.skillMapping)

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
                url: `/skills/${this.toValidURL(category)}`,
                subCategories: {}
              }
            }
            /* Then check for subcategory in category */
            if (subCategory in categories[category].subCategories) {
              categories[category].subCategories[subCategory].value += 1
            } else {
              categories[category].subCategories[subCategory] = {
                value: 1,
                name: subCategory,
                url: `skills/${this.toValidURL(category)}/${this.toValidURL(
                  subCategory
                )}`,
                skills: {}
              }
            }
            /* Finally, attach skill information and credential to subcategories */
            const skill = normalizedTag
            if (
              skill in categories[category].subCategories[subCategory].skills
            ) {
              categories[category].subCategories[subCategory].skills[
                skill
              ].value += 1
            } else {
              categories[category].subCategories[subCategory].skills[skill] = {
                value: 1,
                name: skill,
                credentials: {}
              }
            }
            /* Check for existence of credential in the skill */
            if (
              credential[credential.id] in
              categories[category].subCategories[subCategory].skills[skill]
                .credentials
            ) {
              categories[category].subCategories[subCategory].skills[
                skill
              ].credentials[credential.id].value += 1
            } else {
              categories[category].subCategories[subCategory].skills[
                skill
              ].credentials[credential.id] = {
                value: 1,
                name: credential.achievement.name,
                credential
              }
            }
          }
        }
        // }
      }
      console.log(categories)
      return categories
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
            name: 'Main categories',
            ...this.commonSeriesSettings,
            data: [...Object.values(this.skillTree)]
          }
        ]
      }
    },
    currentChartOption: {
      get() {
        return this.chartOption
      },
      set(newValue) {
        this.chartOption = newValue
      }
    }
  },
  created() {
    this.$store.commit('nav/setTitle', 'Skills')
    this.$store.commit('nav/setBackUrl', '')
  },
  mounted() {
    this.chartOption = this.mainChartOption
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
    chartClickAction(chartComponent) {
      console.log(this.skillTree)
      console.log(chartComponent)
      const componentData = chartComponent.data
      console.log('Component data:')
      console.log(componentData)
      if (chartComponent.componentType === 'title') {
        if (this.currentCategoryLevel === this.categoryLevels.category) {
          console.log('Clicked on main category title…')
        } else if (
          this.currentCategoryLevel === this.categoryLevels.subCategory
        ) {
          this.currentChartOption = this.mainChartOption
          this.currentCategoryLevel = this.categoryLevels.category
        } else if (this.currentCategoryLevel === this.categoryLevels.skill) {
          const categoryName = this.breadcrumb[0]
          const subCategories = this.skillTree[categoryName].subCategories
          this.currentChartOption = {
            title: this.categoryLevelTitles.subCategory(categoryName),
            series: [
              {
                name: 'Subcategories',
                ...this.commonSeriesSettings,
                data: [...Object.values(subCategories)]
              }
            ]
          }
          this.currentCategoryLevel = this.categoryLevels.subCategory
        } else if (
          this.currentCategoryLevel === this.categoryLevels.credential
        ) {
          const categoryName = this.breadcrumb[0]
          const subCategoryName = this.breadcrumb[1]
          const skills = this.skillTree[categoryName].subCategories[
            subCategoryName
          ].skills
          this.currentChartOption = {
            title: this.categoryLevelTitles.skill(subCategoryName),
            series: [
              {
                name: 'Subcategories',
                ...this.commonSeriesSettings,
                data: [...Object.values(skills)]
              }
            ]
          }
          this.currentCategoryLevel = this.categoryLevels.skill
        } else {
          return false
        }
        this.breadcrumb.pop()
      } else if (chartComponent.componentType === 'series') {
        if (this.currentCategoryLevel === this.categoryLevels.category) {
          const subCategories = Object.values(componentData.subCategories)
          this.currentChartOption = {
            title: this.categoryLevelTitles.subCategory(componentData.name),
            series: [
              {
                name: 'Subcategories',
                ...this.commonSeriesSettings,
                data: [...subCategories]
              }
            ]
          }
          this.currentCategoryLevel = this.categoryLevels.subCategory
        } else if (
          this.currentCategoryLevel === this.categoryLevels.subCategory
        ) {
          const skills = Object.values(componentData.skills)
          this.currentChartOption = {
            title: this.categoryLevelTitles.skill(chartComponent.name),
            series: [
              {
                name: 'Skills',
                ...this.commonSeriesSettings,
                data: [...skills]
              }
            ]
          }
          this.currentCategoryLevel = this.categoryLevels.skill
        } else if (this.currentCategoryLevel === this.categoryLevels.skill) {
          const credentials = componentData.credentials
          console.log(credentials)
          this.currentChartOption = {
            title: this.categoryLevelTitles.credential(componentData.name),
            series: [
              {
                name: 'Credentials',
                ...this.commonSeriesSettings,
                data: [...Object.values(credentials)]
              }
            ]
          }
          this.currentCategoryLevel = this.categoryLevels.credential
        } else {
          return false
        }
        this.breadcrumb.push(componentData.name)
      } else {
        console.log('Unknown component type…')
        return false
      }
      console.log('breadcrumb: ' + this.breadcrumb)
      console.log('Skill tree depth: ' + this.currentCategoryLevel)
      return true
    }
  }
}
</script>

<style>
.category-chart {
  min-height: 550px;
  width: 100%;
}
</style>
