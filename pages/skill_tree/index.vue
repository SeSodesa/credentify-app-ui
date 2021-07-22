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
        <svg
          id="tree-view"
          xmlns="http://www.w3.org/2000/svg"
          width="5000px"
          height="5000px"
        ></svg>
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

<script lang="ts">
import SingleCredentialView from '~/components/SingleCredentialView'

const svgNameSpace = 'http://www.w3.org/2000/svg'

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
  const MIN_NODE_WIDTH = 80
  const MAX_NODE_WIDTH = 150
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

// A class that stores the fields needed in positioning tree nodes as instructed
// by Ploeg 2014. See https://doi.org/10.1002/spe.2213.
class PositionableTreeNode {
  children: Array<PositionableTreeNode> | null = null
  x: number = 0
  y: number
  height: number = 0
  width: number = 0
  // Preliminary horizontal coordinate of the node.
  // Set when positioning the root, after moving its children.
  prelim: number = 0
  // How much entire subtree should be moved horizontally.
  mod: number = 0
  // Used to calculate positions of siblings in O(1), together with `change`
  shift: number = 0
  // Used to calculate positions of siblings in O(1) together with `shift`
  change: number = 0
  // Reference to the extreme right node of the left siblings of current root.
  // Only set for leaf nodes and updated if left subtree is taller than current.
  rightThread: PositionableTreeNode = null
  // Reference to the extreme left node of the current root from left siblings.
  // Only set for leaf nodes and updated if current subtree is taller than left.
  leftThread: PositionableTreeNode = null
  // Lowest node in this subtree that can be seen from the left.
  // Used to keep left thread up to date.
  extremeLeftDescendant: PositionableTreeNode = null
  // Lowest node in this subtree that can be seen from the right
  // Used to keep right thread up to date.
  extremeRightDescendant: PositionableTreeNode = null
  // Sum of mods along left contour. Needed in relative positioning.
  modSumLeftContour: number = null
  // Sum of mods along right contour. Needed in relative positioning.
  modSumRightContour: number = null
  constructor(
    width: number,
    height: number,
    y: number,
    children: Array<PositionableTreeNode>
  ) {
    this.width = width
    this.height = height
    this.y = y
    this.children = children
  }
}

// A single node in the skill tree
class SkillTreeNode extends PositionableTreeNode {
  name: string
  value: number = 0
  credential: Object | null = null
  constructor(
    name: string,
    value: number,
    children: Array<PositionableTreeNode>,
    credential: any,
    width: number,
    height: number,
    y: number
  ) {
    super(width, height, y, children)
    this.name = name
    this.value = value
    this.credential = credential
  }
}

function childCount(tree: SkillTreeNode) {
  return tree.children ? tree.children.length : 0
}

function nextLeftContour(tree: SkillTreeNode) {
  if (tree.children) {
    return tree.children[0]
  } else {
    return tree.leftThread
  }
}

function nextRightContour(tree: SkillTreeNode): SkillTreeNode | null {
  if (tree.children) {
    return tree.children[childCount(tree) - 1]
  } else {
    return tree.rightThread
  }
}

// Calculates the positions of the nodes based on a modification to the
// Reingold--Tilford algorithm, and adds them to each node.
//
// See https://doi.org/10.1002/spe.2213
function setLayout(tree: SkillTreeNode) {
  firstWalk(tree)
  secondWalk(tree, 0)
}

function firstWalk(tree: SkillTreeNode) {
  console.log(`↓ ${tree.name}…`)
  if (!tree.children) {
    setExtremes(tree)
  } else {
    firstWalk(tree.children[0])
    let leftSiblingIndexList = updateListOfSiblingsWithDescendantInRightContour(
      bottom(tree.children[0].extremeLeftDescendant),
      0,
      null
    )
    console.log('←←←←←←←←←←← LEFT SIBLING INDEX LIST ←←←←←←←←←←←')
    console.log(leftSiblingIndexList)
    for (
      let currentIndex = 1;
      currentIndex < childCount(tree);
      currentIndex++
    ) {
      firstWalk(tree.children[currentIndex])
      console.log(`→ ${tree.name}`)
      // Store lowest descendant coordinate while extreme nodes are still
      // in current subtree
      const minYRight: number = bottom(
        tree.children[currentIndex].extremeRightDescendant
      )
      separate(tree, currentIndex, leftSiblingIndexList)
      // Remove indices of left siblings not visible directly from the right
      leftSiblingIndexList = updateListOfSiblingsWithDescendantInRightContour(
        minYRight,
        currentIndex,
        leftSiblingIndexList
      )
      console.log(leftSiblingIndexList)
    }
    positionRoot(tree)
    setExtremes(tree)
  }
  console.log(`↑ ${tree.name}…`)
}

function setExtremes(tree: SkillTreeNode) {
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
}

// Separates right contour of left siblings from the left contour of the
// current subtree, thus separating the subtrees
function separate(
  tree: SkillTreeNode,
  currentIndex: number,
  leftSiblingIndexList: ListOfSiblingsWithDescendantInRightContour
) {
  let leftSiblingRightContourNode = tree.children[currentIndex - 1]
  let rightContourModSum: number = leftSiblingRightContourNode.mod
  let currentSubtreeLeftContourNode = tree.children[currentIndex]
  let leftContourModSum: number = currentSubtreeLeftContourNode.mod
  // Go down contours until either of the nodes in observed contour pair is
  // null
  while (leftSiblingRightContourNode && currentSubtreeLeftContourNode) {
    if (bottom(leftSiblingRightContourNode) > leftSiblingIndexList.lowY) {
      leftSiblingIndexList = leftSiblingIndexList.next
    }
    const moveDistance: number =
      rightContourModSum +
      leftSiblingRightContourNode.prelim +
      leftSiblingRightContourNode.width -
      leftContourModSum -
      currentSubtreeLeftContourNode.prelim
    if (moveDistance > 0) {
      leftContourModSum += moveDistance
      // TODO: Prevent sibling index list from becoming null before contour
      // pair is mutually null
      moveSubtree(
        tree,
        currentIndex,
        leftSiblingIndexList.siblingIndex,
        moveDistance
      )
    }
    const rightContourBottom = bottom(leftSiblingRightContourNode)
    const leftContourBottom = bottom(currentSubtreeLeftContourNode)
    if (rightContourBottom <= leftContourBottom) {
      leftSiblingRightContourNode = nextRightContour(
        leftSiblingRightContourNode
      )
      if (leftSiblingRightContourNode) {
        rightContourModSum += leftSiblingRightContourNode.mod
      }
    }
    if (rightContourBottom >= leftContourBottom) {
      currentSubtreeLeftContourNode = nextLeftContour(
        currentSubtreeLeftContourNode
      )
      if (currentSubtreeLeftContourNode) {
        leftContourModSum += currentSubtreeLeftContourNode.mod
      }
    }
  }
  // Merge contours by connecting right thread of current subtree to
  // the right extreme node of the left sibling or vice versa
  if (!leftSiblingRightContourNode && currentSubtreeLeftContourNode) {
    // Current subtree taller than left siblings
    // ⇒ make left thread point to the current left contour node
    setLeftThread(
      tree,
      currentIndex,
      currentSubtreeLeftContourNode,
      leftContourModSum
    )
  } else if (leftSiblingRightContourNode && !currentSubtreeLeftContourNode) {
    // Left siblings taller than current subtree
    // ⇒ make right thread point to the current right contour node
    setRightThread(
      tree,
      currentIndex,
      leftSiblingRightContourNode,
      rightContourModSum
    )
  } else {
    // Height of trees the same ⇒ no need to merge contours
  }
}

function bottom(tree: SkillTreeNode) {
  return tree.y + tree.height
}

function moveSubtree(
  tree: SkillTreeNode,
  currentIndex: number,
  siblingIndex: number,
  moveDistance: number
) {
  tree.children[currentIndex].mod += moveDistance
  tree.children[currentIndex].modSumLeftContour += moveDistance
  tree.children[currentIndex].modSumRightContour += moveDistance
  distributeExtra(tree, currentIndex, siblingIndex, moveDistance)
}

// Distributes the available horizontal space between two given children
// evenly
function distributeExtra(
  tree: SkillTreeNode,
  currentIndex: number,
  siblingIndex: number,
  moveDistance: number
) {
  if (siblingIndex !== currentIndex) {
    const intermediates = currentIndex - siblingIndex
    if (!intermediates) {
      throw new Error(
        'Division by 0 when distributing horizontal space among children of ' +
          tree.name
      )
    }
    tree.children[siblingIndex + 1].shift += moveDistance / intermediates
    tree.children[currentIndex].shift -= moveDistance / intermediates
    tree.children[currentIndex].change -=
      moveDistance - moveDistance / intermediates
  }
}

function setLeftThread(
  tree: SkillTreeNode,
  currentIndex: number,
  leftContourNode: SkillTreeNode,
  leftContourModSum: number
) {
  const firstChild = tree.children[0]
  const li = firstChild.extremeLeftDescendant
  li.leftThread = leftContourNode
  const diff =
    leftContourModSum - leftContourNode.mod - firstChild.modSumLeftContour
  li.mod += diff
  li.prelim -= diff
  firstChild.extremeLeftDescendant =
    tree.children[currentIndex].extremeLeftDescendant
  firstChild.modSumLeftContour = tree.children[currentIndex].modSumLeftContour
}

function setRightThread(
  tree: SkillTreeNode,
  currentIndex: number,
  rightContourNode: SkillTreeNode,
  rightContourModSum: number
) {
  const ithChild = tree.children[currentIndex]
  const ri = ithChild.extremeRightDescendant
  ri.rightThread = rightContourNode
  const diff =
    rightContourModSum - rightContourNode.mod - ithChild.modSumRightContour
  ri.mod += diff
  ri.prelim -= diff
  ithChild.extremeRightDescendant =
    tree.children[currentIndex - 1].extremeRightDescendant
  ithChild.modSumRightContour =
    tree.children[currentIndex - 1].modSumRightContour
}

function positionRoot(tree: SkillTreeNode) {
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
}
// Sets the x-coordonates of each node based on the information
// gathered and set during firstWalk
function secondWalk(tree: SkillTreeNode, modsum: number) {
  modsum += tree.mod
  tree.x = tree.prelim + modsum
  addChildSpacing(tree)
  for (let i = 0; i < childCount(tree); i++) {
    const child = tree.children[i]
    secondWalk(child, modsum)
  }
}

function addChildSpacing(tree: SkillTreeNode) {
  let d = 0
  let modsumdelta = 0
  for (let i = 0; i < childCount(tree); i++) {
    const child = tree.children[i]
    d += child.shift
    modsumdelta += d + child.change
    child.mod += modsumdelta
  }
}

function drawNodes(tree: SkillTreeNode, level: number) {
  const treeView = document.getElementById('tree-view')
  const mynode = document.createElementNS(svgNameSpace, 'rect')
  mynode.setAttributeNS(null, 'id', tree.name)
  mynode.setAttributeNS(null, 'x', tree.x + 'px')
  mynode.setAttributeNS(null, 'y', tree.y + 'px')
  mynode.setAttributeNS(null, 'width', tree.width + 'px')
  mynode.setAttributeNS(null, 'height', tree.height + 'px')
  mynode.setAttributeNS(null, 'rx', '10')
  mynode.setAttributeNS(null, 'ry', '10')
  mynode.setAttributeNS(null, 'fill', categoryLevels(level).color)
  mynode.setAttributeNS(null, 'stroke', 'black')
  if (treeView !== null) {
    treeView.appendChild(mynode)
  } else {
    throw new TypeError(`Could not add ${tree.name} to tree view…`)
  }
  for (let i = 0; i < childCount(tree); i++) {
    drawNodes(tree.children[i], level + 1)
  }
}

function drawSkillTree(root: SkillTreeNode) {
  setLayout(root)
  drawNodes(root, 1)
}

/**
 * "… during the moving of the children, we maintain a linked list of the siblings
 * that currently have a node in the right contour. Each node in this linked list
 * is a pair of the index of the corresponding sibling and its lowest vertical bottom
 * coordinate. This list is always sorted in descending order of the siblings indices."
 *
 * -- Ploeg 2014
 **/
class ListOfSiblingsWithDescendantInRightContour {
  lowY: number
  index: number
  next: ListOfSiblingsWithDescendantInRightContour
  constructor(lowY, index, next) {
    this.lowY = lowY
    this.siblingIndex = index
    this.next = next
  }
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
function updateListOfSiblingsWithDescendantInRightContour(
  minY: number,
  currentIndex: number,
  leftSiblingIndexList: ListOfSiblingsWithDescendantInRightContour | null
) {
  // Remove siblings that are obscured by current node looking from the right
  while (leftSiblingIndexList && minY >= leftSiblingIndexList.lowY) {
    leftSiblingIndexList = leftSiblingIndexList.next
  }
  // Add current node to the head of the list
  return new ListOfSiblingsWithDescendantInRightContour(
    minY,
    currentIndex,
    leftSiblingIndexList
  )
}

function categoryLevels(level: number) {
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
    throw new Error(`${level} is not a known category level…`)
  }
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
    // Assembles the skill tree based on the skill mapping on GitLab
    skillTree() {
      const tree = new Map()
      const nodeFont = 'bold 14px fira sans'
      const nodeFontSize = 14
      const rootKey = this.normalizeTag('main categories')
      const nd = nodeDimensions(rootKey, nodeFont, nodeFontSize)
      const root = new SkillTreeNode(
        rootKey,
        0,
        [],
        null,
        nd.width,
        nd.height,
        0
      )
      tree.set(rootKey, root)
      for (const credential of this.credentials) {
        // if (credential.stage === 5) {
        const achievement = credential.achievement
        for (const tag of achievement.tag) {
          const normalizedTag = this.normalizeTag(tag)
          const lowerTag = this.lowerTag(tag)
          const catAndSubCat = this.skillMapping[lowerTag]
          if (catAndSubCat) {
            // Normalize level names
            const category = this.normalizeTag(catAndSubCat.category)
            const subCategory = this.normalizeTag(catAndSubCat['sub-category'])
            // Start building this tree branch
            let categoryNode = tree.get(category)
            if (categoryNode) {
              categoryNode.value += 1
            } else {
              const nd = nodeDimensions(category, nodeFont, nodeFontSize)
              categoryNode = new SkillTreeNode(
                category,
                0,
                [],
                null,
                nd.width,
                nd.height,
                bottom(root)
              )
              tree.set(category, categoryNode)
              root.children.push(categoryNode)
            }
            /* Then check for subcategory in category */
            let subcategoryNode = tree.get(subCategory)
            if (subcategoryNode) {
              subcategoryNode.value += 1
            } else {
              const nd = nodeDimensions(subCategory, nodeFont, nodeFontSize)
              subcategoryNode = new SkillTreeNode(
                subCategory,
                0,
                [],
                null,
                nd.width,
                nd.height,
                bottom(categoryNode)
              )
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
              skillNode = new SkillTreeNode(
                skill,
                0,
                [],
                null,
                nd.width,
                nd.height,
                bottom(subcategoryNode)
              )
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
                nd.width,
                nd.height,
                bottom(skillNode)
              )
              tree.set(credential.id, credentialNode)
            }
            skillNode.children.push(credentialNode)
            /* Check for existence of credential in the skill */
          } else {
            throw new Error(
              'Categories not found from skill mapping when constructing skill tree…'
            )
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
    drawSkillTree(root)
  },
  methods: {
    lowerTag(tag: string) {
      const whitespaceNormalized = tag
        .trim()
        .split(/\s+/)
        .join(' ')
      const lower = whitespaceNormalized.toLowerCase()
      return lower
    },
    normalizeTag(tag: string) {
      const whitespaceNormalized = tag
        .trim()
        .split(/\s+/)
        .join(' ')
      const capitalized =
        whitespaceNormalized.charAt(0).toUpperCase() +
        whitespaceNormalized.slice(1).toLowerCase()
      return capitalized
    },
    toValidURL(category: string) {
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

div#tree-view-container {
  min-height: 400px;
  overflow: scroll;
}

svg#tree-view {
  min-height: 500px;
  min-width: 1000px;
}
</style>
