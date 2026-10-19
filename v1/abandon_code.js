$("#back-button").on("click", e => {
  const obj = history.pop();

  if (obj) {
    forward_history.push(obj)

    const { type, value } = obj;
    if (type === "insert") {
      AVL_TREE_ROOT = avl_deleteNode(AVL_TREE_ROOT, value);
      D3_TREE_ROOT = convertToD3Node(AVL_TREE_ROOT);
    } else if (type === "remove") {
      AVL_TREE_ROOT = avlInsert(AVL_TREE_ROOT, value);
      D3_TREE_ROOT = convertToD3Node(AVL_TREE_ROOT);
    } else {
      debugger
    }
  }
  renderTree(2000 * getSpeed())
})


$("#forward-button").on("click", e => {
  const obj = forward_history.shift();

  if (obj) {

    const { type, value } = obj;
    history.push(obj)

    if (type === "insert") {
      AVL_TREE_ROOT = avlInsert(AVL_TREE_ROOT, value);
      D3_TREE_ROOT = convertToD3Node(AVL_TREE_ROOT);
    } else if (type === "remove") {
      AVL_TREE_ROOT = avl_deleteNode(AVL_TREE_ROOT, value);
      D3_TREE_ROOT = convertToD3Node(AVL_TREE_ROOT);
    } else {
      debugger
    }
  }

  renderTree(2000 * getSpeed())
})

// return new root
function avl_deleteNode(root, value, rotationObj) {
    // STEP 1: PERFORM STANDARD BST DELETE
    if (root == null) {
        return root;
    }

    if (value < root.value) {
        root.left = avl_deleteNode(root.left, value);
    }
    else if (value > root.value) {
        root.right = avl_deleteNode(root.right, value);
    } else {
        // node with only one child or no child
        if ((root.left == null) || (root.right == null)) {
            let temp = null;
            if (temp == root.left)
                temp = root.right;
            else
                temp = root.left;

            // No child case
            if (temp == null) {
                temp = root;
                root = null;
            }
            else // One child case
                root = temp; // Copy the contents of
            // the non-empty child
        } else {

            // node with two children: Get the inorder
            // successor (smallest in the right subtree)
            let temp = minValueNode(root.right);

            // Copy the inorder successor's data to this node
            root.value = temp.value;

            // Delete the inorder successor
            root.right = avl_deleteNode(root.right, temp.value);
        }
    }

    // If the tree had only one node then return
    if (root == null) {
        return root;
    }

    // STEP 2: UPDATE HEIGHT OF THE CURRENT NODE
    root.height = Math.max(height(root.left), height(root.right)) + 1;

       /* 3. Get the balance factor of this ancestor
        root to check whether this root became
        unbalanced */
    let balance = getBalance(root);

    // If this root becomes unbalanced
    if (balance > 1 && value < root.left.value) {
        // console.log("rotation", root.value)
        if (rotationObj) {
            rotationObj.func = () => {
                return rightRotate(root);
            }
        } else {
            return rightRotate(root);
        }

    } else if (balance < -1 && value > root.right.value) { // Right Right Case
        // console.log("rotation", root.value)
        if (rotationObj) {
            rotationObj.func = () => {
                return leftRotate(root);
            }
        } else {
            return leftRotate(root);
        }

    } else if (balance > 1 && value > root.left.value) {  // Left Right Case
        // console.log("rotation", root.value)
        if (rotationObj) {
            rotationObj.func = () => {
                root.left = leftRotate(root.left);
                return rightRotate(root);
            }
        } else {
            root.left = leftRotate(root.left);
            return rightRotate(root);
        }

    } else if (balance < -1 && value < root.right.value) {   // Right Left Case
        // console.log("rotation", root.value)
        if (rotationObj) {
            rotationObj.func = () => {
                root.right = rightRotate(root.right);
                return leftRotate(root);
            }
        } else {
            root.right = rightRotate(root.right);
            return leftRotate(root);
        }
    }

    return root;
}



//return new root
// rotationObj is used to store/delay rotation and
function avlInsert(root, value, rotationObj) {
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


    /* 2. Update height of this ancestor root */
    root.height = 1 + Math.max(height(root.left), height(root.right));

    /* 3. Get the balance factor of this ancestor
        root to check whether this root became
        unbalanced */
    let balance = getBalance(root);

    // If this root becomes unbalanced
    if (balance > 1 && value < root.left.value) {
        // console.log("rotation", root.value)

        if (rotationObj) {
            rotationObj.func = () => {
                return rightRotate(root);
            }
        } else {
            return rightRotate(root);
        }

    } else if (balance < -1 && value > root.right.value) { // Right Right Case
        // console.log("rotation", root.value)
        if (rotationObj) {
            rotationObj.func = () => {
                return leftRotate(root);
            }
        } else {
            return leftRotate(root);
        }

    } else if (balance > 1 && value > root.left.value) {  // Left Right Case
        // console.log("rotation", root.value)
        if (rotationObj) {
            rotationObj.func = () => {
                root.left = leftRotate(root.left);
                return rightRotate(root);
            }
        } else {
            root.left = leftRotate(root.left);
            return rightRotate(root);
        }

    } else if (balance < -1 && value < root.right.value) {   // Right Left Case
        // console.log("rotation", root.value)
        if (rotationObj) {
            rotationObj.func = () => {
                root.right = rightRotate(root.right);
                return leftRotate(root);
            }
        } else {
            root.right = rightRotate(root.right);
            return leftRotate(root);
        }
    }
    return root;
}