class Node {
    constructor(d) {
        this.value = d;
        this.height = 1;
        this.left = null;
        this.right = null;
    }
}

function height(N) {
    return N == null ? 0 : N.height;
}

// A utility function to right
// rotate subtree rooted with y
// See the diagram given above.
function rightRotate(y) {
    let x = y.left;
    let T2 = x.right;

    // Perform rotation
    x.right = y;
    y.left = T2;

    // Update heights
    y.height = Math.max(height(y.left), height(y.right)) + 1;
    x.height = Math.max(height(x.left), height(x.right)) + 1;

    // Return new root
    return x;
}

// A utility function to left
// rotate subtree rooted with x
// See the diagram given above.
function leftRotate(x) {
    let y = x.right;
    let T2 = y.left;

    // Perform rotation
    y.left = x;
    x.right = T2;

    // Update heights
    x.height = Math.max(height(x.left), height(x.right)) + 1;
    y.height = Math.max(height(y.left), height(y.right)) + 1;

    // Return new root
    return y;
}

// Get Balance factor of node N
function getBalance(N) {
    if (N == null) return 0;
    return height(N.left) - height(N.right);
}

function normalInsert(root, value){
    if (root == null) {
        return new Node(value)

    }

    if (value < root.value) {
        root.left = normalInsert(root.left, value);
    } else if (value > root.value) {
        root.right = normalInsert(root.right, value);
    } else {
        console.log("duplicate value. do nothing", )
        return root;
    }

    return root;
}

function avlInsert(root, value) {
    if (root == null) {
        return new Node(value)
    }

    if (value < root.value) {
        root.left = avlInsert(root.left, value);
    } else if (value > root.value) {
        root.right = avlInsert(root.right, value);
    } else {
        console.log("duplicate value. do nothing", )
        return root;
    }

    root.height = 1 + Math.max(height(root.left), height(root.right));

    let balance = getBalance(root);

    if (balance > 1 && value < root.left.value) {
        return rightRotate(root);
    } else if (balance < -1 && value > root.right.value) { 
        return leftRotate(root);
    } else if (balance > 1 && value > root.left.value) {  
        root.left = leftRotate(root.left);
        return rightRotate(root);
    } else if (balance < -1 && value < root.right.value) {   
        root.right = rightRotate(root.right);
        return leftRotate(root);
    }
    return root;
}

function minValueNode(node) {
    let current = node;
    while (current.left != null) {
        current = current.left;
    }
    return current;
}

function normal_deleteNode(root, value){
    if (root == null) {
        return root;
    }

    if (value < root.value) {
        root.left = normal_deleteNode(root.left, value);
    }
    else if (value > root.value) {
        root.right = normal_deleteNode(root.right, value);
    } else {
        if ((root.left == null) || (root.right == null)) {
            let temp = null;
            if (temp == root.left)
                temp = root.right;
            else
                temp = root.left;

            if (temp == null) {
                temp = root;
                root = null;
            }
            else{
                root = temp; 
            }
        } else {
            let temp = minValueNode(root.right);
            root.value = temp.value;
            root.right = normal_deleteNode(root.right, temp.value);
        }
    }

    if (root == null) {
        return root;
    }
    return root;
}



function convertToD3Node(root, parentRoot) {
    if (!root) {
        return null;
    }

    const left = convertToD3Node(root.left, root)
    const right = convertToD3Node(root.right, root)

    const {
        _search_highlight,
        _found_highlight,
        _new_add_highlight,
    } = root;

    const newRoot = {
        value: root.value,
        children: [left, right].filter(e => !!e),   //d3 do allow null child
        parent: (parentRoot && parentRoot.value ) || "null",

        _search_highlight,
        _found_highlight,
        _new_add_highlight,
    }

    return newRoot
}

function cleanHighlight(node) {
    $("#search_message").text("")

    if (node) {
        node._search_highlight = false;
        node._found_highlight = false;
        node._new_add_highlight = false;

        cleanHighlight(node.left)
        cleanHighlight(node.right)
    }
}


function binary_search(node, value) {
    if (!node) {
        return
    }

    if (node.value < value) {
        return binary_search(node.right, value)
    } else if (node.value > value) {
        return binary_search(node.left, value)
    } else {
        return node;
    }
}

function binary_search_with_path(node, value, path) {
    if (!node) {
        return;
    }

    path.push(node.value)
    if (node.value === value) {
    } else if (node.value < value && node.children && node.children[1]) {
        binary_search_with_path(node.children[1], value, path)
    } else if (node.value > value && node.children && node.children[0]) {
        binary_search_with_path(node.children[0], value, path)
    }
}