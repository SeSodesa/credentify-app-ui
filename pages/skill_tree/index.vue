<template>
  <div class="stage">
    <div v-if="!credential">
      <div class="icon--title mb-2">
        <img src="~/assets/icons/tree_icon.svg" width="45" alt="Skills image" />
        <h1>Skill Tree</h1>
      </div>
      <div class="subtitle">
        A summary page of your earned skills and achievements.
      </div>
    </div>
    <div v-else-if="credential">
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
    <div v-if="credentials && !credential">
      Awaiting construction…
      <div id="tree-view-container">
        <svg id="tree-view" xmlns="http://www.w3.org/2000/svg"></svg>
      </div>
    </div>
    <div v-else-if="credentials && credential">
      Credentials found but no single credential to display…
    </div>
    <single-credential-view v-else-if="credential" :credential="credential" />
    <div v-else>
      No credentials downloaded…
    </div>
  </div>
</template>

<script>
import SingleCredentialView from '~/components/SingleCredentialView'

// A singly linked list of left siblings and their lowest vertical coordinates.
function NodesWithRightPair(lowY, index, next) {
  this.lowY = lowY
  this.index = index
  this.next = next
}

function updateNodesWithRightPair(minY, childIndex, contour) {
  while (contour !== null && minY >= contour.lowY) {
    contour = contour.next
  }
  return new NodesWithRightPair(minY, childIndex, contour)
}

export default {
  components: {
    SingleCredentialView
  },
  async asyncData({ app, params }) {
    try {
      const credentials = await app.$axios
        .get(
          'https://gitlab.com/' +
            'api/v4/projects/27853615/jobs/artifacts/master/raw/test_data_as.json',
          {
            params: { job: 'test_data_to_json' },
            headers: {
              /*  Request access without authorization, as none is needed. */
              Authorization: ''
            }
          }
        )
        .then((result) => result.data)
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
      svgNameSpace: 'http://www.w3.org/2000/svg',
      categoryLevels: Object.freeze({
        1: {
          name: 'Main categories',
          color: '#5470c6'
        },
        2: {
          name: 'Subcategories',
          color: '#91cc75'
        },
        3: {
          name: 'Skills',
          color: '#fac858'
        },
        4: {
          name: 'Credentials',
          color: '#ee6666'
        },
        5: {
          name: 'Specific credential',
          color: '#73c0de'
        }
      }),
      credentialData: null
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
    /* Filters data for drawing the summary graph */
    skillTree() {
      const skillTree = {}
      for (const credential of this.credentials) {
        // if (credential.stage === 5) {
        const achievement = credential.achievement
        for (const tag of achievement.tag) {
          const normalizedTag = this.normalizeTag(tag)
          const lowerTag = this.lowerTag(tag)
          const catAndSubCat = this.skillMapping[lowerTag]
          if (catAndSubCat !== undefined) {
            const category = this.normalizeTag(catAndSubCat.category)
            const subCategory = this.normalizeTag(catAndSubCat['sub-category'])
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
            const observedSubCategory =
              skillTree[category].children[subCategory]
            if (skill in observedSubCategory.children) {
              observedSubCategory.children[skill].value += 1
            } else {
              observedSubCategory.children[skill] = {
                value: 1,
                name: skill,
                children: {}
              }
            }
            /* Check for existence of credential in the skill */
            const observedSkill =
              skillTree[category].children[subCategory].children[skill]
            if (credential[credential.id] in observedSkill.children) {
              observedSkill.children[credential.id].value += 1
            } else {
              observedSkill.children[credential.id] = {
                value: 1,
                name: credential.achievement.name,
                credential
                // url: `skills/${this.toValidURL(category)}/${this.toValidURL(
                //   subCategory
                // )}/${this.toValidURL(credential.achievement.name)}`
              }
            }
          } else {
            //
          }
        }
        // }
      }
      return skillTree
    },
    credentialsExist() {
      return this.credentials.length > 0
    }
  },
  created() {
    this.$store.commit('nav/setTitle', 'Skill Tree')
    this.$store.commit('nav/setBackUrl', '')
  },
  mounted() {
    this.drawSkillTree(this.skillTree)
  },
  methods: {
    // Calculates the positions of the nodes based on a modification to the
    // Reingold--Tilford algorithm, and adds them to each node.
    //
    // See https://doi.org/10.1002/spe.2213
    calculateNodePositions(skillTree) {
      this.firstWalk(skillTree)
      this.secondWalk(skillTree)
    },
    firstWalk(skillTree) {
      if (!skillTree.children) {
        this.setExtremes(skillTree)
        return true
      } else {
        this.firstWalk(skillTree.children[0])
        let contour = new NodesWithRightPair()
        for (
          let ind = 0;
          ind < Object.values(skillTree.children).length;
          ind++
        ) {
          this.firstWalk(skillTree.children[ind])
          const minY = skillTree.vertPos + skillTree.height
          this.separate(skillTree, ind, contour)
          contour = updateNodesWithRightPair(minY, ind, contour)
        }
      }
    },
    contour(skillTree, child, contour) {},
    secondWalk(skillTree) {},
    // Sets the extreme nodes of the current subtree
    setExtremes(skillTree) {
      if (!skillTree.children) {
        skillTree.extremeLeft = skillTree
        skillTree.extremeRight = skillTree
      } else {
        skillTree.extremeLeft = skillTree.children[0].extremeLeft
        skillTree.modifierSumLeft = skillTree.children[0].modifierSumLeft
        const childCount = Object.values(skillTree.children).length
        skillTree.extremeRight = skillTree.children[childCount - 1].extremeRight
        skillTree.modifierSumRight = skillTree.children[0].modifierSumRight
      }
    },
    drawNodes(skillTree) {
      const treeView = document.getElementById('tree-view')
      const myCircle = document.createElementNS(this.svgNameSpace, 'circle')
      myCircle.setAttributeNS(null, 'id', 'mycircle')
      myCircle.setAttributeNS(null, 'cx', 100)
      myCircle.setAttributeNS(null, 'cy', 100)
      myCircle.setAttributeNS(null, 'r', 50)
      myCircle.setAttributeNS(null, 'fill', 'white')
      myCircle.setAttributeNS(null, 'stroke', 'black')
      treeView.appendChild(myCircle)
    },
    drawSkillTree(skillTree) {
      this.calculateNodePositions(skillTree)
      this.drawNodes(skillTree)
      // To create a circle. For rectangle use "rectangle"
    },
    lowerTag(tag) {
      const whitespaceNormalized = tag
        .trim()
        .split(/\s+/)
        .join(' ')
      const lower = whitespaceNormalized.toLowerCase()
      return lower
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

#tree-view-container {
  min-height: 600px;
  overflow: scroll;
  width: 100%;
}
</style>
