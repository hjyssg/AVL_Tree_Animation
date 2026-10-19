d3被用于tree的渲染

动画实现三种方法

* d3的transition。但不能显示tree一步一步的变化
* 用settimeout去展示每一步变化。但是callback hell
* 改进settimeout，用async await。写出优美的代码

我们有一份数据结构的avl tree node
但是d3不接受这种数据结构。所以要转换成d3能看懂的数据结构。



https://visualgo.net/en/bst

d3.js is used for tree rendering


// note:
// svg is difficult to change dynamically
// so we use d3.js 
// but d3 is also really difficult. ****


// note:
// https://wiki.jikexueyuan.com/project/d3wiki/enterexit.html