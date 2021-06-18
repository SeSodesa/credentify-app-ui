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
      v-if="
        credentialsExist && currentCategoryLevel === categoryLevels.category
      "
      :ref="'category-chart'"
      class="category-chart"
      :option="categoryOption"
      @click="categoryChartClickAction"
    />
    <v-chart
      v-else-if="
        credentialsExist && currentCategoryLevel === categoryLevels.subCategory
      "
      :ref="'subcategory-chart'"
      class="category-chart"
      :option="currentSubcategoryOption"
      @click="subCategoryChartClickAction"
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
        category: 'category',
        subCategory: 'sub-category'
      }),
      categoryLevel: '',
      subcategoryOption: {}
    }
  },
  computed: {
    currentCategoryLevel: {
      get() {
        if (this.categoryLevel !== '') {
          return this.categoryLevel
        } else {
          return this.categoryLevels.category
        }
      },
      set(newValue) {
        if (
          newValue === this.categoryLevels.category ||
          newValue === this.categoryLevels.subCategory
        ) {
          this.categoryLevel = newValue
        }
      }
    },
    tagData() {
      const tagData = {}
      for (const credential of this.credentials) {
        // if (credential.stage === 5) {
        const achievement = credential.achievement
        for (const tag of achievement.tag) {
          const normalizedTag = this.normalizeTag(tag)
          if (normalizedTag in tagData) {
            tagData[normalizedTag].value += 1
          } else {
            tagData[normalizedTag] = { value: 1, name: normalizedTag }
          }
        }
        // }
      }
      return Object.values(tagData)
    },
    /* Filters data for drawing the summary graph */
    skillCategories() {
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
                )}`
              }
            }
          }
        }
        // }
      }
      console.log(categories)
      return Object.values(categories)
    },
    credentialsExist() {
      return this.credentials.length > 0
    },
    // Generates the data used in drawing the summary figure
    categoryOption() {
      return {
        title: {
          top: 'top',
          text: 'Categories'
        },
        series: [
          {
            name: 'Main categories',
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
            },
            data: [...this.skillCategories]
          }
        ]
      }
    },
    currentSubcategoryOption: {
      get() {
        return this.subcategoryOption
      },
      set(newValue) {
        this.subcategoryOption = newValue
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
    },
    toValidURL(category) {
      const lower = category.trim().toLowerCase()
      return lower.split(/\s+/).join('_')
    },
    followCategoryLink(event) {
      window.location.href = event.data.url
    },
    switchCategoryLevel() {
      if (this.currentCategoryLevel === this.categoryLevels.category) {
        this.currentCategoryLevel = this.categoryLevels.subCategory
        return true
      } else if (
        this.currentCategoryLevel === this.categoryLevels.subCategory
      ) {
        this.currentCategoryLevel = this.categoryLevels.category
        return true
      } else {
        return false
      }
    },
    categoryChartClickAction(chartComponent) {
      if (chartComponent.componentType === 'title') {
        console.log('Clicked on title…')
      } else if (chartComponent.componentType === 'series') {
        this.toSubCategory(chartComponent)
      } else {
        console.log('Unknown component type…')
      }
    },
    subCategoryChartClickAction(chartComponent) {
      if (chartComponent.componentType === 'title') {
        console.log('Clicked on title…')
      } else if (chartComponent.componentType === 'series') {
        console.log(
          'Clicked on series with name "' + chartComponent.data.name + '"…'
        )
      } else {
        console.log('Unknown component type…')
      }
    },
    toSubCategory(series) {
      console.log(series)
      const subCategories = Object.values(series.data.subCategories)
      console.log(subCategories)
      this.currentSubcategoryOption = {
        title: {
          text: 'Sub-categories',
          subtext: '↑ Back up',
          triggerEvent: true
        },
        series: [
          {
            name: 'Subcategories',
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
            data: [...subCategories]
          }
        ]
      }
      this.switchCategoryLevel()
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
