

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const history = [];
const forward_history = [];
let historyIndex = 0;
function recordStep(obj) {
  history.push(obj)
}

var isNumber = function isNumber(value) 
{
   return typeof value === 'number' && isFinite(value);
}


let avlTree;
let d3tree;
let D3_TREE_ROOT;
let line;
let svg;
let AVL_TREE_ROOT;

function init() {
  let margin = { top: 40, right: 120, bottom: 20, left: 120 },
    width = 960 - margin.right - margin.left,
    height = 500 - margin.top - margin.bottom;

  let i = 0;

  d3tree = d3.layout.tree().size([height, width]);

  line = d3.svg.line()
    .x(function (d) {
      return d.x;
    })
    .y(function (d) {
      return d.y;
    });

  svg = d3.select("#svg-container").append("svg")
    .attr("width", width + margin.right + margin.left)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


  //always create well balanced tree at init
  for (let index = 0; index < 5; index++) {
    let value = index;
    AVL_TREE_ROOT = avlInsert(AVL_TREE_ROOT, value);
  }

  D3_TREE_ROOT = convertToD3Node(AVL_TREE_ROOT);
  renderTree(0)
}


function renderTree(transition, forceRedraw) {
  try {
    if (forceRedraw) {
      svg.selectAll('.node').remove();
      svg.selectAll(".link").remove();
    }
  } catch (e) {

  }

  let nodes = d3tree.nodes(D3_TREE_ROOT).reverse();
  let links = d3tree.links(nodes);

  nodes.forEach(function (d) { d.y = d.depth * 100; });

  let node = svg.selectAll("g.node")
    .data(nodes, function (d, i) {
      // console.log(d, i)
      return d.value
    });


  node.exit().remove();

  let nodeEnter = node.enter().append("g")
    .attr("class", "node")


  nodeEnter.append("circle")
    // .transition()
    // .duration(transition)
    .attr("r", 10)
    .attr("value", d => d.value)
    .style("fill", function (d) {
      let color;

      if (d._found_highlight || d._new_add_highlight) {
        color = "red"
      } else if (d._search_highlight) {
        color = "#95f04f"
      } else {
        color = "white"
      }
      // console.log(d, color)
      return color;
    });

  nodeEnter.append("text")
    .attr("y", function (d) {
      return d.children || d._children ? -18 : 18;
    })
    .attr("dy", ".35em")
    .attr("text-anchor", "middle")
    .text(function (d) { return d.value; })
    .style("fill-opacity", 1);


  node
    .transition()
    .duration(transition)
    .attr("transform", function (d) {
      return "translate(" + d.x + "," + d.y + ")";
    });


  let link = svg.selectAll("path.link")
    .data(links, function (d) { return d.target.value; });

  link.exit().remove();

  link.enter()
    .insert("path", "g")
    .attr("class", "link")


  link
    // .transition()
    // .duration(transition)
    .attr("d", function (d) {
      return line([d.source, d.target]);
    });
}

function highlightCodePanel(panelSelector, lineNumArr){
  $(panelSelector).find(".line-code").removeClass("code-highlight")

  if(isNumber(lineNumArr)){
    lineNumArr = [lineNumArr];
  }

  lineNumArr.forEach(ii => {
    $($(panelSelector).find(".line-code")[ii]).addClass("code-highlight")
  })
}

async function do_rotation_animation(node){
     if(node._rotation_happen){
      await sleep(1000 * getSpeed());
      D3_TREE_ROOT = convertToD3Node(AVL_TREE_ROOT);
      renderTree(3000)
      await sleep(3000);
      delete node._rotation_happen
    }
}

async function avlInsert_animation(node, value) {
    highlightCodePanel("#insert-panel", [0])

    if (node == null) {
        console.log("insert ",  value)
        return new Node(value)
    }

    const tempNode = binary_search(AVL_TREE_ROOT, node.value)
    tempNode._search_highlight = true;
    D3_TREE_ROOT = convertToD3Node(AVL_TREE_ROOT);
    renderTree(0, true)
    await sleep(1000 * getSpeed());

    if (value < node.value) {
        console.log( value, " < ", node.value ," go left")
        node.left = await avlInsert_animation(node.left, value);
    } else if (value > node.value) {
        console.log( value, " > ", node.value ," go right")
        node.right = await avlInsert_animation(node.right, value);
    } else {
        console.log("duplicate value. do nothing", )
        return node;
    }

    await do_rotation_animation(node)

    node.height = 1 + Math.max(height(node.left), height(node.right));

    let balance = getBalance(node);

    console.log("check ", node.value, " balance")

    if (balance > 1 && value < node.left.value) {
      node = rightRotate(node);
      node._rotation_happen = true;
      console.log("case 1")
      highlightCodePanel("#insert-panel", [2])
    } else if (balance < -1 && value > node.right.value) { 
      node = leftRotate(node);
      node._rotation_happen = true;
      console.log("case 2")
      highlightCodePanel("#insert-panel", [3])
    } else if (balance > 1 && value > node.left.value) { 
      node.left = leftRotate(node.left);
      node = rightRotate(node);
      node._rotation_happen = true;
      console.log("case 3")
      highlightCodePanel("#insert-panel", [4])
      

    } else if (balance < -1 && value < node.right.value) {   
      node.right = rightRotate(node.right);
      node = leftRotate(node);
      node._rotation_happen = true;
      console.log("case 4")
      highlightCodePanel("#insert-panel", [5])
    }

    return node;
}



async function do_insert_with_animation(value){
    // await doSearchAnimation(value)
    const searchNode = binary_search(AVL_TREE_ROOT, value)
    if (!searchNode) {
      if(isAvlTree()){

        $("#search-panel").hide()
        $("#insert-panel").show()
        $("#remove-panel").hide()

        AVL_TREE_ROOT = await avlInsert_animation(AVL_TREE_ROOT, value);

        await do_rotation_animation(AVL_TREE_ROOT)
        highlightCodePanel("#insert-panel", [6])


        D3_TREE_ROOT = convertToD3Node(AVL_TREE_ROOT);
        renderTree(0, true)
        await sleep(1000 * getSpeed());
      } else {
          AVL_TREE_ROOT = normalInsert(AVL_TREE_ROOT, value);
          D3_TREE_ROOT = convertToD3Node(AVL_TREE_ROOT);
          const tempNode = binary_search(AVL_TREE_ROOT, value)
          tempNode._new_add_highlight = true;
          D3_TREE_ROOT = convertToD3Node(AVL_TREE_ROOT);
          renderTree(2000 * getSpeed())
      }

      // recordStep({
      //   type: "insert",
      //   value
      // })
    } else {
      alert("already exist in tree")
    }
}


// --------------------------
$("#insert_button").on("click", async (e) => {
  const value = parseFloat($("#insert_input").val());

  cleanHighlight(AVL_TREE_ROOT)
  renderTree(0, true)

  // $("#insert_input").val("")

  if (!isNaN(value)) {
    do_insert_with_animation(value)
  }
})


async function binary_search_with_animation(node, value) {
    if (!node) {
        return;
    }

    const tempNode = binary_search(AVL_TREE_ROOT, node.value)
    tempNode._search_highlight = true;

    D3_TREE_ROOT = convertToD3Node(AVL_TREE_ROOT);
    renderTree(0, true)
    await sleep(1000 * getSpeed());

    if(node.value === value){
      return node;
    }else if (node.value < value) {
        return await binary_search_with_animation(node.right, value)
    } else  {
        return await binary_search_with_animation(node.left, value)
    }
}

async function doSearchAnimation(value) {
  cleanHighlight(AVL_TREE_ROOT)
  renderTree(0, true)

  $("#search-panel").show()
  $("#insert-panel").hide()
  $("#remove-panel").hide()

  await binary_search_with_animation(AVL_TREE_ROOT, value)
}


$("#search_button").on("click", async e => {
  const value = parseFloat($("#search_input").val());

  if (!isNaN(value)) {
    await doSearchAnimation(value)
  }
})


async function avl_deleteNode_animation(node, value) {
    if (node == null) {
        return node;
    }

    const tempNode = binary_search(AVL_TREE_ROOT, node.value)
    tempNode._search_highlight = true;
    D3_TREE_ROOT = convertToD3Node(AVL_TREE_ROOT);
    renderTree(0, true)
    await sleep(1000 * getSpeed());

    if (value < node.value) {
        node.left = await avl_deleteNode_animation(node.left, value);
    } else if (value > node.value) {
        node.right = await avl_deleteNode_animation(node.right, value);
    } else {
        if ((node.left == null) || (node.right == null)) {
            let temp = null;
            if (temp == node.left){
                temp = node.right;
            } else {
                temp = node.left;
            }

            // No child case
            if (temp == null) {
                temp = node;
                node = null;
            } else {
                node = temp; 
            }
        } else {
            let temp = minValueNode(node.right);
            node.value = temp.value;
            node.right = await avl_deleteNode_animation(node.right, temp.value);
        }
    }

    if (node == null) {
        return node;
    }

    await do_rotation_animation(node)

    node.height = Math.max(height(node.left), height(node.right)) + 1;

    let balance = getBalance(node);

    if (balance > 1 && value < node.left.value) {
        node = rightRotate(node);
        node._rotation_happen = true;
        console.log("case 1")
    } else if (balance < -1 && value > node.right.value) { // Right Right Case
        node = leftRotate(node);
        node._rotation_happen = true;
        console.log("case 2")
    } else if (balance > 1 && value > node.left.value) {  // Left Right Case
        node.left = leftRotate(node.left);
        node = rightRotate(node);
         node._rotation_happen = true;
        console.log("case 3")
    } else if (balance < -1 && value < node.right.value) {   // Right Left Case
        node.right = rightRotate(node.right);
        node = leftRotate(node);
        node._rotation_happen = true;
        console.log("case 4")
    }

    return node;
}



$("#remove_button").on("click", async (e) => {
  const value = parseFloat($("#remove_input").val());

  cleanHighlight(AVL_TREE_ROOT)
  renderTree(0, true)

  $("#search-panel").hide()
  $("#insert-panel").hide()
  $("#remove-panel").show()

  if (!isNaN(value)) {
    const searchNode = binary_search(AVL_TREE_ROOT, value)
    if (!searchNode) {
      alert("not in tree")
    } else {

      if(isAvlTree()){
        AVL_TREE_ROOT = await avl_deleteNode_animation(AVL_TREE_ROOT, value);
        await do_rotation_animation(AVL_TREE_ROOT)
      }else {
        AVL_TREE_ROOT = normal_deleteNode(AVL_TREE_ROOT, value);
        
      }

      D3_TREE_ROOT = convertToD3Node(AVL_TREE_ROOT);
      renderTree(3000 * getSpeed())
      // recordStep({
      //   type: "remove",
      //   value
      // })
    }
  }
})




function getSpeed() {
  // ratio: 0 -> 1 - > 2 
  // the middle be 1
  let ratio = parseFloat($("#animation-speed-input").val()) / 10;

  return ratio;
}

function isAvlTree(){
  // https://stackoverflow.com/questions/9561625/checking-value-of-radio-button-group-via-javascript
  return $('input[name=tree-type]:checked').val() === "avl-tree";
}


init();

