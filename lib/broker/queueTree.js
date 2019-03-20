function queueTree () {
  let _tree = {
    clients     : [],
    queue       : [],
    currentItem : null,
    subTrees    : {}
  };

  return {
    has : function has () {

    }
  }
}

module.exports = queueTree;


/*
  LISTEN -> CLIENT_1; CLIENT_N
               |         |
               |       NODE_1
        -----------
        |          |
      NODE_1     NODE_2

  CONSUMER -> CLIENT_1#NODE_1;  CLIENT_1#NODE_2; CLIENT_N#NODE_1
*/
