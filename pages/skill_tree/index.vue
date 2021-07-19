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

// A single node in the skill tree
function SkillTreeNode(name, value, children, credential, posArgs) {
  // Node data
  this.name = name
  this.value = value
  this.children = children
  this.credential = credential
  // ↓ Positioning fields ↓
  this.depth = 'depth' in posArgs ? posArgs.depth : 0
  // this.childCount = function() {
  //   return this.children.length
  // }
  this.width = 'width' in posArgs ? posArgs.width : 0
  this.height = 'height' in posArgs ? posArgs.height : 0
  this.x = 'x' in posArgs ? posArgs.xpos : 0
  this.y = 'y' in posArgs ? posArgs.ypos : 0
  // Preliminary horizontal coordinate of the node.
  // Set when positioning the root, after moving its children.
  this.prelim = 'prelim' in posArgs ? posArgs.prelim : null
  // How much entire subtree should be moved horizontally.
  this.mod = 'mod' in posArgs ? posArgs.mod : null
  // Used to calculate positions of siblings in O(1), togehter with `change`
  this.shift = 'shift' in posArgs ? posArgs.shift : null
  // Used to calculate positions of siblings in O(1) togehter with `shift`
  this.change = 'change' in posArgs ? posArgs.change : null
  // Reference to node in right contour
  this.rightThread = 'rightThread' in posArgs ? posArgs.rightThread : null
  // Reference to node in left contour
  this.leftThread = 'leftThread' in posArgs ? posArgs.leftThread : null
  // Lowest node in this subtree that can be seen from the left
  this.extremeLeftNode = 'extremeLeft' in posArgs ? posArgs.extremeLeft : null
  // Lowest node in this subtree that can be seen from the right
  this.extremeRightNode =
    'extremeRight' in posArgs ? posArgs.extremeRight : null
  // Sum of mods along left contour. Needed in relative positioning.
  this.modSumExtremeLeft =
    'modSumExtremeLeft' in posArgs ? posArgs.modSumExtremeLeft : null
  // Sum of mods along right contour. Needed in relative positioning.
  this.modSumExtremeRight =
    'modSumExtremeRight' in posArgs ? posArgs.modSumExtremeRight : null
}

function childCount(tree) {
  return tree.children ? tree.children.length : 0
}

// A singly linked list of left siblings and their lowest vertical coordinates.
function Contour(lowY, index, next) {
  this.lowY = lowY
  this.index = index
  this.next = next
}

function updateContour(minY, childIndex, contour) {
  while (contour && minY >= contour.lowY) {
    contour = contour.next
  }
  return new Contour(minY, childIndex, contour)
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
      //
      const tree = new Map()
      const rootKey = this.normalizeTag('main categories')
      const root = new SkillTreeNode(rootKey, 0, [], null, {})
      tree.set(rootKey, root)
      const skillTree = {}
      for (const credential of this.credentials) {
        // if (credential.stage === 5) {
        const achievement = credential.achievement
        for (const tag of achievement.tag) {
          const normalizedTag = this.normalizeTag(tag)
          const lowerTag = this.lowerTag(tag)
          const catAndSubCat = this.skillMapping[lowerTag]
          if (catAndSubCat) {
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
            let categoryNode = tree.get(category)
            if (categoryNode) {
              const categoryNode = tree.get(category)
              categoryNode.value += 1
            } else {
              categoryNode = new SkillTreeNode(category, 0, [], null, {})
              tree.set(category, categoryNode)
              root.children.push(categoryNode)
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
            let subcategoryNode = tree.get(subCategory)
            if (subcategoryNode) {
              subcategoryNode.value += 1
            } else {
              subcategoryNode = new SkillTreeNode(subCategory, 0, [], null, {})
              tree.set(subCategory, subcategoryNode)
              categoryNode.children.push(subcategoryNode)
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
            let skillNode = tree.get(skill)
            if (skillNode) {
              skillNode.value += 1
            } else {
              skillNode = new SkillTreeNode(skill, 0, [], null, {})
              tree.set(skill, skillNode)
              subcategoryNode.children.push(skillNode)
            }
            let credentialNode = tree.get(credential.id)
            if (credentialNode) {
              credentialNode.value += 1
            } else {
              credentialNode = new SkillTreeNode(
                credential.achievement.name,
                0,
                null,
                credential,
                {}
              )
            }
            tree.set(credential.id, credentialNode)
            skillNode.children.push(credentialNode)
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
      console.log(tree)
      return tree
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
    this.drawSkillTree(this.skillTree.get(this.normalizeTag('main categories')))
  },
  methods: {
    // Calculates the positions of the nodes based on a modification to the
    // Reingold--Tilford algorithm, and adds them to each node.
    //
    // See https://doi.org/10.1002/spe.2213
    calculateNodePositions(tree) {
      console.log('Starting first walk…')
      this.firstWalk(tree)
      console.log('Starting second walk…')
      this.secondWalk(tree)
    },
    firstWalk(tree) {
      if (!tree.children) {
        this.setExtremes(tree)
      } else {
        this.firstWalk(tree.children[0])
        let contour = new Contour(
          this.bottom(tree.children[0].extremeLeftNode),
          0,
          null
        )
        for (let childIndex = 1; childIndex < childCount(tree); childIndex++) {
          this.firstWalk(tree.children[childIndex])
          const minY = this.bottom(tree.children[childIndex].extremeRightNode)
          this.separate(tree, childIndex, contour)
          contour = updateContour(minY, childIndex, contour)
        }
        this.positionRoot(tree)
        this.setExtremes(tree)
      }
    },
    // Sets the extreme nodes of the current subtree
    setExtremes(tree) {
      if (!tree.children) {
        tree.extremeLeftNode = tree
        tree.extremeRightNode = tree
        tree.modSumExtremeLeft = 0
        tree.modSumExtremeRight = 0
      } else {
        tree.extremeLeftNode = tree.children[0].extremeLeftNode
        tree.modSumExtremeLeft = tree.children[0].modSumExtremeLeft
        tree.extremeRight = tree.children[childCount(tree) - 1].extremeRightNode
        tree.modSumExtremeRight =
          tree.children[childCount(tree) - 1].modSumExtremeRight
      }
    },
    separate(tree, childIndex, contour) {
      let rightContourNode = tree.children[childIndex - 1]
      let rightContourNodeModSum = rightContourNode.mod
      let leftContourNode = tree.children[childIndex]
      let iter = 0
      const maxiter = 20
      let leftContourNodeModSum = rightContourNode.mod
      while (rightContourNode && leftContourNode) {
        console.log('Right countour node:')
        console.log(rightContourNode)
        console.log('Left countour node:')
        console.log(leftContourNode)
        console.log('Contour:')
        console.log(contour)
        if (this.bottom(rightContourNode) > contour.lowY) {
          contour = contour.next
        }
        const moveDistance =
          rightContourNodeModSum +
          rightContourNode.prelim +
          rightContourNode.width -
          leftContourNodeModSum -
          leftContourNode.prelim
        if (moveDistance > 0) {
          leftContourNodeModSum += moveDistance
          this.moveSubtree(tree, childIndex, contour.index, moveDistance)
        }
        const rightContourBottom = this.bottom(rightContourNode)
        const leftContourBottom = this.bottom(leftContourNode)
        if (rightContourBottom < leftContourBottom) {
          rightContourNode = this.nextRightContour(rightContourNode)
          if (rightContourNode) {
            rightContourNodeModSum += rightContourNode.mod
          }
        }
        if (rightContourBottom >= leftContourBottom) {
          leftContourNode = this.nextLeftContour(rightContourNode)
          if (leftContourNode) {
            leftContourNodeModSum += leftContourNode.mod
          }
        }
        if (++iter > maxiter) {
          throw new Error('Infinite loop during separation?')
        }
      }
      if (!rightContourNode && leftContourNode) {
        this.setLeftThread(
          tree,
          childIndex,
          leftContourNode,
          leftContourNodeModSum
        )
      } else if (rightContourNode && !leftContourNode) {
        this.setRightThread(
          tree,
          childIndex,
          rightContourNode,
          rightContourNodeModSum
        )
      } else {
        throw new Error('Left contour not taller than right nor vic versa?')
      }
    },
    bottom(treeNode) {
      return treeNode.y + treeNode.height
    },
    moveSubtree(tree, childIndex, contourIndex, moveDistance) {
      tree.children[childIndex].mod += moveDistance
      tree.children[childIndex].modSumExtremeLeft += moveDistance
      tree.children[childIndex].modSumExtremeRight += moveDistance
    },
    distributeExtra(tree, childIndex, siblingIndex, moveDistance) {
      if (siblingIndex !== childIndex) {
        const intermediates = childIndex - siblingIndex
        tree.children[siblingIndex + 1].shift += moveDistance / intermediates
        tree.children[childIndex].shift -= moveDistance / intermediates
        tree.children[childIndex].change -=
          moveDistance - moveDistance / intermediates
      }
    },
    nextLeftContour(treeNode) {
      return treeNode.children ? treeNode.children[0] : treeNode.leftThread
    },
    nextRightContour(treeNode) {
      return treeNode.children
        ? treeNode.children[childCount(treeNode) - 1]
        : treeNode.rightThread
    },
    setLeftThread(tree, childIndex, leftContourNode, leftContourNodeModSum) {
      const firstChild = tree.children[0]
      const li = firstChild.extremeLeftNode
      li.leftThread = leftContourNode
      const diff =
        leftContourNodeModSum -
        leftContourNode.mod -
        firstChild.modSumExtremeLeft
      li.mod += diff
      li.prelim -= diff
      firstChild.extremeLeftNode = tree.children[childIndex].extremeLeftNode
      firstChild.modSumExtremeLeft = tree.children[childIndex].modSumExtremeLeft
    },
    setRightThread(tree, childIndex, rightContourNode, rightContourNodeModSum) {
      const ithChild = tree.children[childIndex]
      const ri = ithChild.extremeRightNode
      ri.leftThread = rightContourNode
      const diff =
        rightContourNodeModSum -
        rightContourNode.mod -
        ithChild.extremeRightModSum
      ri.mod += diff
      ri.prelim -= diff
      ithChild.extremeLeftNode = tree.children[childIndex].extremeLeftNode
      ithChild.modSumExtremeLeft = tree.children[childIndex].modSumExtremeLeft
    },
    positionRoot(tree) {
      const firstChild = tree.children[0]
      const lastChild = tree.children[childCount(tree) - 1]
      tree.prelim =
        (firstChild.prelim +
          firstChild.mod +
          lastChild.mod +
          lastChild.prelim +
          lastChild.width) /
          2 -
        tree.width / 2
    },
    secondWalk(tree, modsum) {
      modsum += tree.mod
      tree.x = tree.prelim + modsum
      this.addChildSpacing(tree)
      for (const child of tree.children) {
        this.secondWalk(child, modsum)
      }
    },
    addChildSpacing(tree) {
      let d = 0
      let modsumdelta = 0
      for (const child of tree.children) {
        d += child.shift
        modsumdelta += d + child.change
        child.mod += modsumdelta
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
