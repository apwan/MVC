/*
 * Npm Lib binary-search-bound
 */

var bsearch = (function(){
  function compileSearch(funcName, predicate, reversed, extraArgs, earlyOut) {
    var code = [
      "function ", funcName, "(a,l,h,", extraArgs.join(","),  "){",
      earlyOut ? "" : "var i=", (reversed ? "l-1" : "h+1"),
      ";while(l<=h){\
      var m=(l+h)>>>1,x=a[m]"]
    if(earlyOut) {
      if(predicate.indexOf("c") < 0) {
        code.push(";if(x===y){return m}else if(x<=y){")
      } else {
        code.push(";var p=c(x,y);if(p===0){return m}else if(p<=0){")
      }
    } else {
      code.push(";if(", predicate, "){i=m;")
    }
    if(reversed) {
      code.push("l=m+1}else{h=m-1}")
    } else {
      code.push("h=m-1}else{l=m+1}")
    }
    code.push("}")
    if(earlyOut) {
      code.push("return -1};")
    } else {
      code.push("return i};")
    }
    return code.join("")
  }

  function compileBoundsSearch(predicate, reversed, suffix, earlyOut) {
    var result = new Function([
      compileSearch("A", "x" + predicate + "y", reversed, ["y"], earlyOut),
      compileSearch("P", "c(x,y)" + predicate + "0", reversed, ["y", "c"], earlyOut),
      "function dispatchBsearch", suffix, "(a,y,c,l,h){\
if(typeof(c)==='function'){\
return P(a,(l===void 0)?0:l|0,(h===void 0)?a.length-1:h|0,y,c)\
}else{\
return A(a,(c===void 0)?0:c|0,(l===void 0)?a.length-1:l|0,y)\
}}\
return dispatchBsearch", suffix].join(""))
    return result()
  }

  return {
    ge: compileBoundsSearch(">=", false, "GE"),
    gt: compileBoundsSearch(">", false, "GT"),
    lt: compileBoundsSearch("<", true, "LT"),
    le: compileBoundsSearch("<=", true, "LE"),
    eq: compileBoundsSearch("-", true, "EQ", true)
  }

})();


/*
 * Npm Lib cdt2d
 */

var createTriangulation = (function(){


  function Triangulation(stars, edges) {
    this.stars = stars
    this.edges = edges
  }

  var proto = Triangulation.prototype

  function removePair(list, j, k) {
    for(var i=1, n=list.length; i<n; i+=2) {
      if(list[i-1] === j && list[i] === k) {
        list[i-1] = list[n-2]
        list[i] = list[n-1]
        list.length = n - 2
        return
      }
    }
  }


  proto.isConstraint = (function() {
    var e = [0,0]
    function compareLex(a, b) {
      return a[0] - b[0] || a[1] - b[1]
    }

    return function(i, j) {
      e[0] = Math.min(i,j)
      e[1] = Math.max(i,j)
      return bsearch.eq(this.edges, e, compareLex) >= 0
    }
  })()

  proto.removeTriangle = function(i, j, k) {
    var stars = this.stars
    removePair(stars[i], j, k)
    removePair(stars[j], k, i)
    removePair(stars[k], i, j)
  }

  proto.addTriangle = function(i, j, k) {
    var stars = this.stars;
    stars[i].push(j, k)
    stars[j].push(k, i)
    stars[k].push(i, j)
  }


// the starting point in the half edge toward j in stars[i], ReadOnly
  proto.opposite = function(j, i) {
    var list = this.stars[i]
    for(var k=1, n=list.length; k<n; k+=2) {
      if(list[k] === j) {
        return list[k-1]
      }
    }
    return -1
  }

  proto.flip = function(i, j) {
    var a = this.opposite(i, j)
    var b = this.opposite(j, i)
    this.removeTriangle(i, j, a)
    this.removeTriangle(j, i, b)
    this.addTriangle(i, b, a)
    this.addTriangle(j, a, b)
  }

// directed/half edges, ReadOnly
  proto.edges = function() {
    var stars = this.stars
    var result = []
    stars.forEach(function(list){
      for(var j=0, m=list.length; j<m; j+=2) {
        result.push([list[j], list[j+1]])
      }
    });
    return result
  }
// triangles, ReadOnly
  proto.cells = function() {
    var stars = this.stars
    var result = []
    stars.forEach(function(list, i){
      for(var j=0, m=list.length; j<m; j+=2) {
        var s = list[j]
        var t = list[j+1]
        if(i < s && i < t){
          result.push([i, s, t])
        }
      }

    });
    return result
  }

  function createTriangulation(numVerts, edges) {
    var stars = new Array(numVerts)
    for(var i=0; i<numVerts; ++i) {
      stars[i] = []
    }
    return new Triangulation(stars, edges)
  }
  return createTriangulation;
})();



var monotone = (function(){
  function orient(a, b, c){
    //clockwise > 0
    return (b[0]-c[0])*(a[1]-c[1]) - (b[1]-c[1])*(a[0]-c[0]);
  }

  var EVENT_POINT = 0
  var EVENT_END   = 1
  var EVENT_START = 2

//A partial convex hull fragment, made of two unimonotone polygons
  function PartialHull(a, b, idx, lowerIds, upperIds) {
    this.a = a
    this.b = b
    this.idx = idx
    this.lowerIds = lowerIds
    this.upperIds = upperIds
  }

//An event in the sweep line procedure
// a, b:  points
// type: EVENT_POINT, EVENT_END, EVENT_START
// idx: edge index
  function Event(a, b, type, idx) {
    this.a    = a
    this.b    = b
    this.type = type
    this.idx  = idx
  }

//This is used to compare events for the sweep line procedure
// Points are:
//  1. sorted lexicographically
//  2. sorted by type  (point < end < start)
//  3. segments sorted by winding order
//  4. sorted by index
  function compareEvent(a, b) {
    var d =
      (a.a[0] - b.a[0]) ||
      (a.a[1] - b.a[1]) ||
      (a.type - b.type)
    if(d) { return d }
    // handle equal case, a.a == b.a
    if(a.type !== EVENT_POINT) {
      d = orient(a.a, a.b, b.b) // <0: CCW
      if(d) { return d }
    }
    return a.idx - b.idx
  }

  function testPoint(hull, p) {
    return orient(hull.a, hull.b, p)
  }

  function addPoint(cells, hulls, points, p, idx) {
    var lo = bsearch.lt(hulls, p, testPoint)
    var hi = bsearch.gt(hulls, p, testPoint)
    for(var i=lo; i<hi; ++i) {
      var hull = hulls[i]

      //Insert p into lower hull
      var lowerIds = hull.lowerIds
      var m = lowerIds.length
      while(m > 1 && orient(
        points[lowerIds[m-2]],
        points[lowerIds[m-1]],
        p) > 0) {
        cells.push(
          [lowerIds[m-1],
            lowerIds[m-2],
            idx])
        m -= 1
      }
      lowerIds.length = m
      lowerIds.push(idx)

      //Insert p into upper hull
      var upperIds = hull.upperIds
      var m = upperIds.length
      while(m > 1 && orient(
        points[upperIds[m-2]],
        points[upperIds[m-1]],
        p) < 0) {
        cells.push(
          [upperIds[m-2],
            upperIds[m-1],
            idx])
        m -= 1
      }
      upperIds.length = m
      upperIds.push(idx)
    }
  }

  function findSplit(hull, edge) {
    var d
    if(hull.a[0] < edge.a[0]) {
      d = orient(hull.a, hull.b, edge.a)
    } else {
      d = orient(edge.b, edge.a, hull.a)
    }
    if(d) { return d }
    if(edge.b[0] < hull.b[0]) {
      d = orient(hull.a, hull.b, edge.b)
    } else {
      d = orient(edge.b, edge.a, hull.b)
    }
    return d || hull.idx - edge.idx
  }

  function splitHulls(hulls, points, event) {
    var splitIdx = bsearch.le(hulls, event, findSplit)
    var hull = hulls[splitIdx]
    var upperIds = hull.upperIds
    var x = upperIds[upperIds.length-1]
    hull.upperIds = [x]

    // insert after
    hulls.splice(splitIdx+1, 0,
      new PartialHull(event.a, event.b, event.idx, [x], upperIds))
  }


  function mergeHulls(hulls, points, event) {
    //Swap pointers for merge search
    var tmp = event.a
    event.a = event.b
    event.b = tmp
    var mergeIdx = bsearch.eq(hulls, event, findSplit)
    var upper = hulls[mergeIdx]
    var lower = hulls[mergeIdx-1]
    lower.upperIds = upper.upperIds
    hulls.splice(mergeIdx, 1)
  }


  var monotone = function(points, edges){

    var numPoints = points.length;
    var numEdges = edges.length;

    //Create point events
    var events = points.map(function(e,i){
      return new Event(
        e,
        null,
        EVENT_POINT,
        i);
    });


    //Create edge events
    edges.forEach(function(e, i){
      var a = points[e[0]]
      var b = points[e[1]]
      if(a[0] < b[0]) {
        events.push(
          new Event(a, b, EVENT_START, i),
          new Event(b, a, EVENT_END, i))
      } else if(a[0] > b[0]) {
        events.push(
          new Event(b, a, EVENT_START, i),
          new Event(a, b, EVENT_END, i))
      }
      //? a[0] == b[0]
    });

    //Sort events
    events.sort(compareEvent)

    //Initialize hull
    var minX = events[0].a[0] - (1 + Math.abs(events[0].a[0])) * Math.pow(2, -52)
    var hull = [ new PartialHull([minX, 1], [minX, 0], -1, [], [], [], []) ]

    //Process events in order
    var cells = []
    for(var i=0, numEvents=events.length; i<numEvents; ++i) {
      var event = events[i]
      var type = event.type
      if(type === EVENT_POINT) {
        addPoint(cells, hull, points, event.a, event.idx)
      } else if(type === EVENT_START) {
        splitHulls(hull, points, event)
      } else {
        mergeHulls(hull, points, event)
      }
    }

    //Return triangulation
    return cells
  };


  return monotone;
})();

var delaunayRefine = (function(){
  function det2(p1, p2){
    return p1.x*p2.y - p1.y*p2.x;
  }
  function abdis(p1, p2){
    var dx = p1[0] - p2[0], dy = p1[1] - p2[1];
    return Math.sqrt(dx*dx + dy*dy);

  }
  function dotp(p1, p2, l){
    var ret = 0;
    for(var i=0;i<l;++i){
      ret += p1[i]*p2[i];
    }
    return ret;
  }
  function min_index(arr){
    var i_min = 0;
    var min = arr[0];
    for(var i=1;i<arr.length;++i){
      if(min>arr[i]){
        min = arr[i];
        i_min = i;
      }
    }
    return i_min;
  }
// >0 : inside circle
  function inCircle(p1, p2, p3, p4){
    var pts = [p1, p2, p3].map(function(p){
      var ret = {x:p[0]-p4[0], y:p[1]-p4[1]};
      ret.r2 = ret.x*ret.x + ret.y*ret.y;
      return ret;
    });
    return pts[0].r2 * det2(pts[1], pts[2]) +
      pts[1].r2 * det2(pts[2], pts[0]) +
      pts[2].r2 * det2(pts[0], pts[1]);

  }
  function smallestCos(p0, p1, p2, info){
    var el = [0,0,0];
    el[0] = abdis(p1, p2);
    el[1] = abdis(p2, p0);
    el[2] = abdis(p0, p1);
    var i_min = min_index(el);
    var a=el[i_min], b = el[(i_min+1)%3], c = el[(i_min+2)%3];

    if(info != null){
      info['i_min'] = i_min;
      info['i_max'] = b<c? (i_min+2)%3 : (i_min+1)%3;
      info['el'] = el;
      info['el_sum'] = el[0] + el[1] + el[2];
    }
    if(a<1e-10){
      return 1;

    }else{
      return (b*b+c*c-a*a)/(2*b*c);

    }


  }

// a,b  points index of the edge
  function testFlip(points, triangulation, stack, a, b, x) {
    var y = triangulation.opposite(a, b)

    //Test boundary edge
    if(y < 0) {
      return
    }

    //Swap edge if order flipped
    if(b < a) {
      var tmp = a
      a = b
      b = tmp
      tmp = x
      x = y
      y = tmp
    }

    //Test if edge is constrained
    if(triangulation.isConstraint(a, b)) {
      return
    }

    //Test if edge is delaunay
    if(inCircle(points[a], points[b], points[x], points[y]) < 0) {
      stack.push(a, b)
    }
  }

//Assume edges are sorted lexicographically
  function delaunayRefine(depth, points, triangulation, options) {
    options = options || {};
    var criteria = options.criteria || .125;
    criteria = Math.sqrt(1-criteria);
    var Nmax = options.size_criteria || points.length;
    var stack = []

    var stars = triangulation.stars
    stars.forEach(function(star, a){
      for(var j=1; j<star.length; j+=2) {
        var b = star[j]

        //If order is not consistent, then skip edge
        if(b < a) {
          continue
        }

        //Check if edge is constrained
        if(triangulation.isConstraint(a, b)) {
          continue
        }

        //Find opposite edge
        var x = star[j-1], y = -1
        for(var k=1; k<star.length; k+=2) {
          if(star[k-1] === b) {
            y = star[k];
            break
          }
        }

        //If this is a boundary edge, don't flip it
        if(y < 0) {
          continue
        }

        //If edge is in circle, flip it
        if(inCircle(points[a], points[b], points[x], points[y]) < 0) {
          stack.push(a, b)
        }
      }
    });
    function runStack(){
      while(stack.length > 0) {
        var b = stack.pop()
        var a = stack.pop()

        //Find opposite pairs
        var x = -1, y = -1
        var star = stars[a]
        for(var i=1; i<star.length; i+=2) {
          var s = star[i-1]
          var t = star[i]
          if(s === b) {
            y = t
          } else if(t === b) {
            x = s
          }
        }

        //If x/y are both valid then skip edge
        if(x < 0 || y < 0) {
          continue
        }

        //If edge is now delaunay, then don't flip it
        if(inCircle(points[a], points[b], points[x], points[y]) >= 0) {
          continue
        }

        //Flip the edge
        triangulation.flip(a, b)

        //Test flipping neighboring edges
        testFlip(points, triangulation, stack, x, a, y)
        testFlip(points, triangulation, stack, a, y, x)
        testFlip(points, triangulation, stack, y, b, x)
        testFlip(points, triangulation, stack, b, x, y)
      }

    }

    function badShape(cell, cri){
      var pts = cell.map(function(id){
        return points[id];
      });
      //console.log('badShape', pts, cell);
      var info = {};
      var tmp = smallestCos(pts[0], pts[1], pts[2], info);
      if(tmp > cri){
        if(tmp >= 1-1e-8){

          var a = cell[info.i_max], b = cell[(info.i_max+1)%3], c = cell[(info.i_max+2)%3];
          var ops = triangulation.opposite(c, b);
          if(ops == a){
            console.log('reversed!');
            ops = triangulation.opposite(b, c);
          }


          triangulation.removeTriangle(a, b, c);
          if(ops < 0){
            console.log('fall on boundary');
            return false;
          }
          triangulation.removeTriangle(c, b, ops);
          triangulation.addTriangle(a, b, ops);
          triangulation.addTriangle(a, ops,c);

          testFlip(points, triangulation, stack, ops, c, a);
          testFlip(points, triangulation, stack, b, ops, a);
          //console.log('colinear!', stack.length);
          return false;
        }
        var new_point =  [0,1].map(function(i){
          var pp = pts.map(function(e){
            return e[i];
          });
          return Math.round(
            dotp(info.el, pp, 3)/(info.el_sum*1.5) +dotp([1,1,1], pp, 3)/9
          );
        });
        //console.log('bad triangle', new_point, tmp);
        return new_point;
      }else{
        return false;
      }
    }
    function checkCriteria(cell){
      var tmp = badShape(cell, criteria);
      if(!tmp){// good
        return true;
      }else{
        triangulation.removeTriangle(cell[0], cell[1], cell[2]);
        console.log('add points');
        points.push(tmp);
        triangulation.stars.push([]);
        tmp = points.length - 1;
        triangulation.addTriangle(cell[0], cell[1], tmp);
        triangulation.addTriangle(cell[1], cell[2], tmp);
        triangulation.addTriangle(cell[2], cell[0], tmp);

        testFlip(points, triangulation, stack, cell[0], cell[1], tmp);
        testFlip(points, triangulation, stack, cell[1], cell[2], tmp);
        testFlip(points, triangulation, stack, cell[2], cell[0], tmp);

        return false;


      }

    }
    runStack();
    // check once
    //var cells = triangulation.cells();

    function pickCell(){
      var p0 = Math.floor(Math.random()*(points.length - 1));
      var star = triangulation.stars[p0];

      var p1 = Math.floor(Math.random() * star.length/2);
      var pt1 = star[p1*2], pt2 = star[p1*2+1];
      return [p0, pt1, pt2];

    }

    function optPick(N){
      var cells = triangulation.cells();
      function compareCri(a, b){
        return (b[1] - a[1]) || (b[2]-a[2]) || (a[0] - b[0]);
      }
      var scores = cells.map(function(cell, i){
        var pts = cell.map(function(id){
          return points[id];
        });
        var amin = smallestCos(pts[0], pts[1], pts[2]);
        var lmax = Math.max(abdis(pts[0], pts[1]), abdis(pts[1], pts[2]), abdis(pts[2], pts[0]));
        return [i, amin, lmax];
      });


      var tot = 0;
      scores.forEach(function(e){
        tot += e[1];
      });
      tot /= scores.length;

      scores.sort(compareCri);

      var bench = [criteria, 1, N];
      var bench_i = bsearch.lt(scores, bench, compareCri);
      console.log('bench', bench_i, scores.length);

      var len = Math.min(N, cells.length);
      var npt = 0;
      for(var i=0;i<len;++i){
        if(!checkCriteria(cells[scores[i][0]])){
          npt++;
        }
      }
      //if(tot != tot){
        //console.warn('invalid', scores);
      //}

      return {amin:tot, npt:npt, slen:stack.length/2};

    }


    //console.log('overall report', optPick(5));
    //checkCriteria(pickCell());
    //runStack();
    //console.log('overall report', optPick(40));
    //runStack();
    if(depth>0){
      console.log('depth reduced, points len ', points.length);
      delaunayRefine(depth-1, points, triangulation, options)
    }


  }

  return function(points, triangulation, options){
    return delaunayRefine(0, points, triangulation, options);
  }

})();

var classifyFaces = (function(){

  function FaceIndex(cells, neighbor, constraint, flags, active, next, boundary) {
    this.cells       = cells
    this.neighbor    = neighbor
    this.flags       = flags
    this.constraint  = constraint
    this.active      = active
    this.next        = next
    this.boundary    = boundary
  }

  var proto = FaceIndex.prototype

  function compareCell(a, b) {
    return a[0] - b[0] ||
      a[1] - b[1] ||
      a[2] - b[2]
  }

  proto.locate = (function() {
    var key = [0,0,0]
    return function(a, b, c) {
      var x = a, y = b, z = c
      if(b < c) {
        if(b < a) {
          x = b
          y = c
          z = a
        }
      } else if(c < a) {
        x = c
        y = a
        z = b
      }
      if(x < 0) {
        return -1
      }
      key[0] = x
      key[1] = y
      key[2] = z
      return bsearch.eq(this.cells, key, compareCell)
    }
  })();

  function indexCells(triangulation, infinity) {
    //First get cells and canonicalize
    var cells = triangulation.cells()
    var nc = cells.length
    for(var i=0; i<nc; ++i) {
      var c = cells[i]
      var x = c[0], y = c[1], z = c[2]
      if(y < z) {
        if(y < x) {
          c[0] = y
          c[1] = z
          c[2] = x
        }
      } else if(z < x) {
        c[0] = z
        c[1] = x
        c[2] = y
      }
    }
    cells.sort(compareCell)

    //Initialize flag array
    var flags = new Array(nc)
    for(var i=0; i<flags.length; ++i) {
      flags[i] = 0
    }

    //Build neighbor index, initialize queues
    var active = []
    var next   = []
    var neighbor = new Array(3*nc)
    var constraint = new Array(3*nc)
    var boundary = null
    if(infinity) {
      boundary = []
    }
    var index = new FaceIndex(
      cells,
      neighbor,
      constraint,
      flags,
      active,
      next,
      boundary);
    for(var i=0; i<nc; ++i) {
      var c = cells[i]
      for(var j=0; j<3; ++j) {
        var x = c[j], y = c[(j+1)%3]
        var a = neighbor[3*i+j] = index.locate(y, x, triangulation.opposite(y, x))
        var b = constraint[3*i+j] = triangulation.isConstraint(x, y)
        if(a < 0) {
          if(b) {
            next.push(i)
          } else {
            active.push(i)
            flags[i] = 1
          }
          if(infinity) {
            boundary.push([y, x, -1])
          }
        }
      }
    }
    return index
  }

  function filterCells(cells, flags, target) {
    var ptr = 0
    for(var i=0; i<cells.length; ++i) {
      if(flags[i] === target) {
        cells[ptr++] = cells[i]
      }
    }
    cells.length = ptr
    return cells
  }

  function classifyFaces(triangulation, target, infinity) {
    var index = indexCells(triangulation, infinity)

    if(target === 0) {
      if(infinity) {
        return index.cells.concat(index.boundary)
      } else {
        return index.cells
      }
    }

    var side = 1
    var active = index.active
    var next = index.next
    var flags = index.flags
    var cells = index.cells
    var constraint = index.constraint
    var neighbor = index.neighbor

    while(active.length > 0 || next.length > 0) {
      while(active.length > 0) {
        var t = active.pop()
        if(flags[t] === -side) {
          continue
        }
        flags[t] = side
        var c = cells[t]
        for(var j=0; j<3; ++j) {
          var f = neighbor[3*t+j]
          if(f >= 0 && flags[f] === 0) {
            if(constraint[3*t+j]) {
              next.push(f)
            } else {
              active.push(f)
              flags[f] = side
            }
          }
        }
      }

      //Swap arrays and loop
      var tmp = next;
      next = active
      active = tmp
      next.length = 0
      side = -side
    }

    var result = filterCells(cells, flags, target);
    if(infinity) {
      return result.concat(index.boundary)
    }
    return result
  }

  return classifyFaces;

})();

var cdt2d = (function(){
  function canonicalizeEdge(e) {
    return [Math.min(e[0], e[1]), Math.max(e[0], e[1])]
  }

  function compareEdge(a, b) {
    return a[0]-b[0] || a[1]-b[1]
  }

  function canonicalizeEdges(edges) {
    // copy and sort
    return edges.map(canonicalizeEdge).sort(compareEdge)
  }
  function cdt2d(points, edges, options) {
    var monotoneTriangulate = monotone;
    var makeIndex = createTriangulation;
    var delaunayFlip = delaunayRefine;
    var filterTriangulation = classifyFaces;

    if(!Array.isArray(edges)) {// omit edges
      options = edges || {}
      edges = []
    } else {
      options = options || {}
      edges = edges || []
    }



    //Handle trivial case
    if(points.length === 0) {
      return []
    }

    //Construct initial triangulation
    var cells = monotoneTriangulate(points, edges);
    console.log('monotone', cells);

    //If delaunay refinement needed, then improve quality by edge flipping
    var triangulation = makeIndex(points.length, canonicalizeEdges(edges))
    for(var i=0; i<cells.length; ++i) {
      var f = cells[i]
      triangulation.addTriangle(f[0], f[1], f[2])
    }
    console.log('index', triangulation);
    //Run edge flipping
    delaunayFlip(points, triangulation, options);

    console.log('delaunay');


    // check size criteria, add points and refine again

    //Filter exterior points, return type is
    var ret = filterTriangulation(triangulation, -1);
    console.log('cdt2d', ret);
    return triangulation;

  }

  return cdt2d;

})();
