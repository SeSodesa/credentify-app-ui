<template>
  <div class="stage">
    <div v-if="credentials && !credential">
      <div class="icon--title mb-2">
        <img src="~/assets/icons/tree_icon.svg" width="45" alt="Skills image" />
        <h1>Skill Tree</h1>
      </div>
      <div class="subtitle">
        A summary page of your earned skills and achievements.
      </div>
    </div>
    <div v-else-if="credentials && credential">
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
      <div id="tree-view-container">
        <!-- This will be populated later -->
        <svg id="tree-view" :xmlns="svgNameSpace"></svg>
      </div>
    </div>
    <single-credential-view
      v-else-if="credentials && credential"
      :credential="credential"
    />
    <div v-else>
      No credentials to display…
    </div>
  </div>
</template>

<script>
import SingleCredentialView from '~/components/SingleCredentialView'

/**
 * Uses canvas.measureText to compute and return the width of the given text of given font in pixels.
 *
 * @param {String} text The text to be rendered.
 * @param {String} font The css font descriptor that text is to be rendered with (e.g. "bold 14px verdana").
 *
 * @see https://stackoverflow.com/questions/118241/calculate-text-width-with-javascript/21015393#21015393
 */
function getTextWidth(text, font) {
  // re-use canvas object for better performance
  const canvas =
    getTextWidth.canvas ||
    (getTextWidth.canvas = document.createElement('canvas'))
  const context = canvas.getContext('2d')
  context.font = font
  const metrics = context.measureText(text)
  return metrics.width
}

function nodeDimensions(text, font, fontsize) {
  const MIN_NODE_WIDTH = 100
  const MAX_NODE_WIDTH = 300
  const tw = Math.ceil(getTextWidth(text, font))
  if (!tw) {
    throw new Error(`Text width calculation for text "${text}" failed…`)
  }
  let nw = 0
  if (MIN_NODE_WIDTH <= tw && tw <= MAX_NODE_WIDTH) {
    nw = tw
  } else if (MIN_NODE_WIDTH > tw) {
    nw = MIN_NODE_WIDTH
  } else if (tw > MAX_NODE_WIDTH) {
    nw = MAX_NODE_WIDTH
  } else {
    throw new Error(`Could not set width for node ${text} with font ${font}…`)
  }
  const tr = Math.floor(tw / nw) + 1
  const nh = tr * fontsize
  return { width: nw, height: nh }
}

// A single node in the skill tree
function SkillTreeNode(name, value, children, credential, posArgs) {
  // Node data
  this.name = name
  this.value = value
  this.children = children
  this.credential = credential
  // ↓ Positioning fields ↓
  this.width = 'width' in posArgs ? posArgs.width : 0
  this.height = 'height' in posArgs ? posArgs.height : 0
  this.x = 'x' in posArgs ? posArgs.x : 0
  this.y = 'y' in posArgs ? posArgs.y : 0
  // Preliminary horizontal coordinate of the node.
  // Set when positioning the root, after moving its children.
  this.prelim = 'prelim' in posArgs ? posArgs.prelim : 0
  // How much entire subtree should be moved horizontally.
  this.mod = 'mod' in posArgs ? posArgs.mod : 0
  // Used to calculate positions of siblings in O(1), together with `change`
  this.shift = 'shift' in posArgs ? posArgs.shift : 0
  // Used to calculate positions of siblings in O(1) together with `shift`
  this.change = 'change' in posArgs ? posArgs.change : 0
  // Reference to the extreme right node of the left siblings of current root.
  // Only set for leaf nodes and updated if left subtree is taller than current.
  this.rightThread = 'rightThread' in posArgs ? posArgs.rightThread : null
  // Reference to the extreme left node of the current root from left siblings.
  // Only set for leaf nodes and updated if current subtree is taller than left.
  this.leftThread = 'leftThread' in posArgs ? posArgs.leftThread : null
  // Lowest node in this subtree that can be seen from the left.
  // Used to keep left thread up to date.
  this.extremeLeftDescendant =
    'extremeLeft' in posArgs ? posArgs.extremeLeft : null
  // Lowest node in this subtree that can be seen from the right
  // Used to keep right thread up to date.
  this.extremeRightDescendant =
    'extremeRight' in posArgs ? posArgs.extremeRight : null
  // Sum of mods along left contour. Needed in relative positioning.
  this.modSumLeftContour =
    'modSumLeftContour' in posArgs ? posArgs.modSumLeftContour : null
  // Sum of mods along right contour. Needed in relative positioning.
  this.modSumRightContour =
    'modSumRightContour' in posArgs ? posArgs.modSumRightContour : null
}

function childCount(tree) {
  return tree.children ? tree.children.length : 0
}

/**
 * "… during the moving of the children, we maintain a linked list of the siblings
 * that currently have a node in the right contour. Each node in this linked list
 * is a pair of the index of the corresponding sibling and its lowest vertical bottom
 * coordinate. This list is always sorted in descending order of the siblings indices."
 *
 * -- Ploeg 2014
 **/
function ListOfLeftSiblingsWithDescendantInRightContour(lowY, index, next) {
  this.lowY = lowY
  this.siblingIndex = index
  this.next = next
}

/**
 * To update the list, we then remove elements at the head of the list that have a higher
 * lowest vertical coordinate than the new pair. This removes siblings from the list that
 * had nodes in the right contour, but these nodes are now occluded by the current subtree.
 * Afterwards, we prepend the new pair to the list. In this way, the list always corresponds
 * to the siblings that currently have a node in the right contour.
 *
 * -- Ploeg 2014
 **/
function updateListOfLeftSiblingsWithDescendantInRightContour(
  minY,
  childIndex,
  siblingIndexList
) {
  while (siblingIndexList && minY >= siblingIndexList.lowY) {
    siblingIndexList = siblingIndexList.next
  }
  return new ListOfLeftSiblingsWithDescendantInRightContour(
    minY,
    childIndex,
    siblingIndexList
  )
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
      categoryLevels(level) {
        if (level === 1) {
          return {
            name: 'Main categories',
            color: '#5470c6'
          }
        } else if (level === 2) {
          return {
            name: 'Subcategories',
            color: '#91cc75'
          }
        } else if (level === 3) {
          return {
            name: 'Skills',
            color: '#fac858'
          }
        } else if (level === 4) {
          return {
            name: 'Credentials',
            color: '#ee6666'
          }
        } else if (level === 5) {
          return {
            name: 'Specific credential',
            color: '#73c0de'
          }
        } else {
          return null
        }
      },
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
      const tree = new Map()
      const nodeFont = 'bold 14px fira sans'
      const nodeFontSize = 40
      const rootKey = this.normalizeTag('main categories')
      const nd = nodeDimensions(rootKey, nodeFont, nodeFontSize)
      const root = new SkillTreeNode(rootKey, 0, [], null, {
        width: nd.width,
        height: nd.height,
        y: 0
      })
      tree.set(rootKey, root)
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
            let categoryNode = tree.get(category)
            if (categoryNode) {
              const categoryNode = tree.get(category)
              categoryNode.value += 1
            } else {
              const nd = nodeDimensions(category, nodeFont, nodeFontSize)
              categoryNode = new SkillTreeNode(category, 0, [], null, {
                width: nd.width,
                height: nd.height,
                y: this.bottom(root)
              })
              tree.set(category, categoryNode)
              root.children.push(categoryNode)
            }
            /* Then check for subcategory in category */
            let subcategoryNode = tree.get(subCategory)
            if (subcategoryNode) {
              subcategoryNode.value += 1
            } else {
              const nd = nodeDimensions(subCategory, nodeFont, nodeFontSize)
              subcategoryNode = new SkillTreeNode(subCategory, 0, [], null, {
                width: nd.width,
                height: nd.height,
                y: this.bottom(categoryNode)
              })
              tree.set(subCategory, subcategoryNode)
              categoryNode.children.push(subcategoryNode)
            }
            /* Finally, attach skill information and credential to subcategories */
            const skill = normalizedTag
            let skillNode = tree.get(skill)
            if (skillNode) {
              skillNode.value += 1
            } else {
              const nd = nodeDimensions(subCategory, nodeFont, nodeFontSize)
              skillNode = new SkillTreeNode(skill, 0, [], null, {
                width: nd.width,
                height: nd.height,
                y: this.bottom(subcategoryNode)
              })
              tree.set(skill, skillNode)
              subcategoryNode.children.push(skillNode)
            }
            let credentialNode = tree.get(credential.id)
            if (credentialNode) {
              credentialNode.value += 1
            } else {
              const nd = nodeDimensions(
                credential.achievement.name,
                nodeFont,
                nodeFontSize
              )
              credentialNode = new SkillTreeNode(
                credential.achievement.name,
                0,
                null,
                credential,
                {
                  width: nd.width,
                  height: nd.height,
                  y: this.bottom(skillNode)
                }
              )
            }
            tree.set(credential.id + credentialNode.value, credentialNode)
            skillNode.children.push(credentialNode)
            /* Check for existence of credential in the skill */
          } else {
            //
          }
        }
        // }
      }
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
    const root = this.skillTree.get(this.normalizeTag('main categories'))
    this.drawSkillTree(root)
  },
  methods: {
    // Calculates the positions of the nodes based on a modification to the
    // Reingold--Tilford algorithm, and adds them to each node.
    //
    // See https://doi.org/10.1002/spe.2213
    setLayout(tree) {
      this.firstWalk(tree)
      this.secondWalk(tree, 0)
    },
    firstWalk(tree) {
      if (!tree.children) {
        this.setExtremes(tree)
      } else {
        this.firstWalk(tree.children[0])
        let siblingIndexList = updateListOfLeftSiblingsWithDescendantInRightContour(
          this.bottom(tree.children[0].extremeLeftDescendant),
          0,
          null
        )
        for (let childIndex = 1; childIndex < childCount(tree); childIndex++) {
          this.firstWalk(tree.children[childIndex])
          // Left siblings less tall than this will be obscured from the right
          // by the current subtree
          const minYRight = this.bottom(
            tree.children[childIndex].extremeRightDescendant
          )
          this.separate(tree, childIndex, siblingIndexList)
          // Update left siblings not obsucred by current node when looking from the right
          siblingIndexList = updateListOfLeftSiblingsWithDescendantInRightContour(
            minYRight,
            childIndex,
            siblingIndexList
          )
        }
        this.positionRoot(tree)
        this.setExtremes(tree)
      }
    },
    setExtremes(tree) {
      if (!tree.children) {
        tree.extremeLeftDescendant = tree
        tree.extremeRightDescendant = tree
        tree.modSumLeftContour = 0
        tree.modSumRightContour = 0
      } else {
        tree.extremeLeftDescendant = tree.children[0].extremeLeftDescendant
        tree.modSumLeftContour = tree.children[0].modSumLeftContour
        tree.extremeRightDescendant =
          tree.children[childCount(tree) - 1].extremeRightDescendant
        tree.modSumRightContour =
          tree.children[childCount(tree) - 1].modSumRightContour
      }
    },
    // Separates right contour of left siblings from the left contour of the
    // current subtree, thus separating the subtrees
    separate(tree, childIndex, siblingIndexList) {
      let leftSiblingRightContourNode = tree.children[childIndex - 1]
      let rightContourModSum = leftSiblingRightContourNode.mod
      let currentSubtreeLeftContourNode = tree.children[childIndex]
      let leftContourModSum = currentSubtreeLeftContourNode.mod
      let iter = 0
      const maxiter = 20
      // Go down contours until either end is reached
      while (leftSiblingRightContourNode && currentSubtreeLeftContourNode) {
        if (this.bottom(leftSiblingRightContourNode) > siblingIndexList.lowY) {
          siblingIndexList = siblingIndexList.next
        }
        const moveDistance =
          rightContourModSum +
          leftSiblingRightContourNode.prelim +
          leftSiblingRightContourNode.width -
          leftContourModSum -
          currentSubtreeLeftContourNode.prelim
        if (moveDistance > 0) {
          leftContourModSum += moveDistance
          // TODO: Prevent sibling index list from becoming null before contour
          // pair is mutually null
          this.moveSubtree(
            tree,
            childIndex,
            siblingIndexList.siblingIndex,
            moveDistance
          )
        }
        const rightContourBottom = this.bottom(leftSiblingRightContourNode)
        const leftContourBottom = this.bottom(currentSubtreeLeftContourNode)
        if (rightContourBottom <= leftContourBottom) {
          leftSiblingRightContourNode = this.nextRightContour(
            leftSiblingRightContourNode
          )
          if (leftSiblingRightContourNode) {
            rightContourModSum += leftSiblingRightContourNode.mod
          }
        }
        if (rightContourBottom >= leftContourBottom) {
          currentSubtreeLeftContourNode = this.nextLeftContour(
            currentSubtreeLeftContourNode
          )
          if (currentSubtreeLeftContourNode) {
            leftContourModSum += currentSubtreeLeftContourNode.mod
          }
        }
        if (++iter > maxiter) {
          throw new Error('Infinite loop during separation?')
        }
      }
      // Merge contours after moving of current subtree:
      if (!leftSiblingRightContourNode && currentSubtreeLeftContourNode) {
        // Current subtree taller than left siblings
        // ⇒ make left thread point to the current left contour node
        this.setLeftThread(
          tree,
          childIndex,
          currentSubtreeLeftContourNode,
          leftContourModSum
        )
      } else if (
        leftSiblingRightContourNode &&
        !currentSubtreeLeftContourNode
      ) {
        // Left siblings taller than current subtree
        // ⇒ make right thread point to the current right contour node
        this.setRightThread(
          tree,
          childIndex,
          leftSiblingRightContourNode,
          rightContourModSum
        )
      } else {
        // Current subtree equally tall as left sibling
        // ⇒ do not merge contours as left sibling is hidden form the right by current subtree
      }
    },
    bottom(tree) {
      return tree.y + tree.height
    },
    moveSubtree(tree, childIndex, siblingIndex, moveDistance) {
      tree.children[childIndex].mod += moveDistance
      if (!tree.children[childIndex].mod) {
        throw new Error(`${tree.name}.mod unset in moveSubtree…`)
      }
      tree.children[childIndex].modSumLeftContour += moveDistance
      tree.children[childIndex].modSumRightContour += moveDistance
      this.distributeExtra(tree, childIndex, siblingIndex, moveDistance)
    },
    // Distributes the available horizontal space between two given children
    // evenly
    distributeExtra(tree, childIndex, siblingIndex, moveDistance) {
      if (siblingIndex !== childIndex) {
        const intermediates = childIndex - siblingIndex
        if (intermediates === 0) {
          throw new Error(
            'Division by 0 when distributing horizontal space among children of ' +
              tree.name
          )
        }
        tree.children[siblingIndex + 1].shift += moveDistance / intermediates
        tree.children[childIndex].shift -= moveDistance / intermediates
        tree.children[childIndex].change -=
          moveDistance - moveDistance / intermediates
      }
    },
    nextLeftContour(tree) {
      if (tree.children) {
        return tree.children[0]
      } else {
        return tree.leftThread
      }
    },
    nextRightContour(tree) {
      if (tree.children) {
        return tree.children[childCount(tree) - 1]
      } else {
        return tree.rightThread
      }
    },
    setLeftThread(tree, childIndex, leftContourNode, leftContourModSum) {
      const firstChild = tree.children[0]
      const li = firstChild.extremeLeftDescendant
      li.leftThread = leftContourNode
      const diff =
        leftContourModSum - leftContourNode.mod - firstChild.modSumLeftContour
      li.mod += diff
      li.prelim -= diff
      firstChild.extremeLeftDescendant =
        tree.children[childIndex].extremeLeftDescendant
      firstChild.modSumLeftContour = tree.children[childIndex].modSumLeftContour
    },
    setRightThread(tree, childIndex, rightContourNode, rightContourModSum) {
      const ithChild = tree.children[childIndex]
      const ri = ithChild.extremeRightDescendant
      ri.rightThread = rightContourNode
      const diff =
        rightContourModSum - rightContourNode.mod - ithChild.modSumRightContour
      ri.mod += diff
      ri.prelim -= diff
      ithChild.extremeRightDescendant =
        tree.children[childIndex - 1].extremeRightDescendant
      ithChild.modSumRightContour =
        tree.children[childIndex - 1].modSumRightContour
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
    // Sets the x-coordonates of each node based on the information
    // gathered and set during firstWalk
    secondWalk(tree, modsum) {
      modsum += tree.mod
      tree.x = tree.prelim + modsum
      this.addChildSpacing(tree)
      for (let i = 0; i < childCount(tree); i++) {
        const child = tree.children[i]
        this.secondWalk(child, modsum)
      }
    },
    addChildSpacing(tree) {
      let d = 0
      let modsumdelta = 0
      for (let i = 0; i < childCount(tree); i++) {
        const child = tree.children[i]
        d += child.shift
        modsumdelta += d + child.change
        child.mod += modsumdelta
      }
    },
    drawNodes(tree, level) {
      const treeView = document.getElementById('tree-view')
      const mynode = document.createElementNS(this.svgNameSpace, 'rect')
      mynode.setAttributeNS(null, 'x', tree.x + 'px')
      mynode.setAttributeNS(null, 'y', tree.y + 'px')
      mynode.setAttributeNS(null, 'width', tree.width + 'px')
      mynode.setAttributeNS(null, 'height', tree.height + 'px')
      mynode.setAttributeNS(null, 'rx', 10)
      mynode.setAttributeNS(null, 'ry', 10)
      mynode.setAttributeNS(null, 'fill', this.categoryLevels(level).color)
      mynode.setAttributeNS(null, 'stroke', 'black')
      if (tree.credential) {
        mynode.setAttributeNS(null, 'class', 'pointable')
        mynode.credential = tree.credential
        mynode.addEventListener('click', this.focusOnCredential)
      }
      treeView.appendChild(mynode)
      for (let i = 0; i < childCount(tree); i++) {
        this.drawNodes(tree.children[i], level + 1)
      }
    },
    drawSkillTree(root) {
      this.setLayout(root)
      this.drawNodes(root, 1)
      // Resize svg to fit contents
      const svg = document.getElementById('tree-view')
      const bbox = svg.getBBox()
      svg.setAttribute('width', bbox.x + bbox.width + bbox.x)
      svg.setAttribute('height', bbox.y + bbox.height + bbox.y)
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
    },
    focusOnCredential(node) {
      if (node.currentTarget.credential) {
        this.credentialData = node.currentTarget.credential
      }
    },
    backUp(node) {
      // TODO: do sppmething to prevent an error in SingleCredentialView,
      // when credential goes missing
      this.credential = {}
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

div#tree-view-container {
  min-height: 400px;
  overflow: scroll;
}

svg#tree-view {
  min-height: 300px;
  min-width: 1000px;
}
</style>
