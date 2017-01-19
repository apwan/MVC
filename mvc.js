/*
 * List class for boundary node
 */
function List(data){
  var data = data || [];
  if(data.length == 0){
    this.head = null;
    return;
  }
  this.head = {data:data[0], pre:null, next:null};

  var tmp = this.head;
  for(var i=1;i<data.length;++i){
    tmp.next = {data:data[i], pre:tmp, next:null};
    tmp = tmp.next;
  }
  // if circular
  //tmp.next = this.head;
  //this.head.pre = tmp;
}
List.prototype.isEmpty = function(){
  return this.head == null;
}
function insertAfter(data, oldNode){
  oldNode.next.pre = {data:_.clone(data), pre:oldNode, next:oldNode.next};
  oldNode.next = oldNode.next.pre;
}

List.prototype.traverse = function(func){
  var cur = this.head;
  while(cur != null){
    func(cur.data);
    cur = cur.next;
  }
}
List.prototype.map = function(func){
  var ret = [];
  this.traverse(function(data){
    ret.push(func(data));
  });
  return ret;
}
function removeNode(node){
  if(node.next != null){
    node.next.pre = node.pre;
  }
  if(node.pre != null){
    node.pre.next = node.next;
  }
  if(node.list != null){
    // is head
    var newHead = node.next || node.pre;
    if(newHead != null){
      node.list.head = newHead;
      newHead.list = node.list;
    }else{
      node.list.head = null;
    }
    node.list = null;
  }
}
/*
 * boundary sampling
 */
function HierarchyBoundary(pos, boundary){

  var maxLevel = Math.floor(Math.log2(boundary.length)); // >=3
  var level = 3;
  var step = 1 << (maxLevel - 2);
  var indices = [];
  var bpsize = boundary.length;
  for(var i=0;i<bpsize; i += step){
    indices.push({index: i});
  }
  // criteria params
  var e_dis = bpsize/16;
  var e_ang = .75;

  indices.push({index: 0});


  // hierarchy boundary
  var hb = new List(indices);
  var cur = hb.head;
  //console.log('hierarchical boundary for ', pos);

  while(cur.next != null){
    var p1 = boundary[cur.data.index];
    if(cur.data.dis == null){
      cur.data.dis = absdis(p1, pos);
    }
    var nextData = cur.next.data;
    var p2 = boundary[nextData.index];
    step = nextData.index - cur.data.index;//
    //console.log('check', cur.data.index, step);
    if(step <= 1){
      var c = cosdis({x:p1.x-pos.x, y:p1.y-pos.y}, {x:p2.x-pos.x, y:p2.y-pos.y});
      var t = cur.data.t2 = Math.sqrt((1-c)/(1+c));
      if(t!=t){
        console.warn('t1', cur, c);
      }
      cur = cur.next;
      cur.data.t1 = t;
      continue;
    }
    var level = maxLevel + 1 - Math.floor(Math.log2(step));

    if(cur.data.dis > e_dis * Math.pow(.4, level)){

      var c = cosdis({x:p1.x-pos.x, y:p1.y-pos.y}, {x:p2.x-pos.x, y:p2.y-pos.y});
      if(Math.acos(c)< e_ang * Math.pow(.8, level)){
        var t = cur.data.t2 = Math.sqrt((1-c)/(1+c));// for MVC calculation
        if(t!=t){
          console.warn('t2', cur)
        }
        cur = cur.next;
        cur.data.t1 = t;
        continue;
      }
    }


    // need finer sampling
    step = 1<<(maxLevel - level); // increase level
    insertAfter({index:cur.data.index+step}, cur);
  }
  cur.data.t2 = hb.head.data.t2;
  cur.data.dis = hb.head.data.dis;


  return hb;

}


/*
 * Triangulation
 */


function Vec2d(x, y){
  this.x = x || 0;
  this.y = y || 0;
}
Vec2d.prototype.plus = function(vec, a){
  var a = a || 1;
  this.x += vec.x * a;
  this.y += vec.y * a;
}
Vec2d.prototype.pos = function(){
  return {
    x: this.x,
    y: this.y
  }
}
Vec2d.prototype.norm = function(){
  return Math.sqrt(this.x*this.x + this.y*this.y);
}




/*
 * Mean-value coordinate
 */

function barycentric(nodes, weights){
  var ret = new Vec2d();
  weights.forEach(function(e,i){
    ret.plus(nodes[i], e)
  });
  return ret.pos();
}
function barycentricSparse(nodes, weights){
  var ret = new Vec2d();
  for(var i in weights){
    var e = weights[i];
    if(e > 0){
      ret.plus(nodes[i], e);
    }
  }
  return ret.pos();
}

function powdiv(x, maxlevel){
  var ret = 0;
  while( x & 0x1 == 0 && ret < maxlevel){
    x >> 1;
    ret++;
  }
  return ret;
}

function Vec(){

}
Vec.diff = function(a, b, l){
  var len = l || Math.min(a.length, b.length);
  var ret = new Array(len);
  for(var i=0;i<len;++i){
    ret[i] = a[i] - b[i];
  }
  return ret;
}
Vec.mul = function(a, c, l){
  var len = l || a.length;
  var ret = new Array(len);
  for(var i=0;i<len;++i){
    ret[i] = a[i] * c;
  }
  return ret;
}

function drawTriangulation(ctx, points, edges, options){
  console.log('drawing', options);
  var pos = options.pos || {x:0, y:0};
  var pre_pColor = ctx.strokeStyle;
  var pre_pWidth = ctx.lineWidth;
  ctx.strokeStyle = options.pColor || 'yellow';
  ctx.lineWidth = options.pWidth || 0.2;
  ctx.beginPath();
  function convert(id){
    var p = points[id];
    return {x:p[0] + pos.x, y:p[1] + pos.y};

  }

  edges.forEach(function(e){
    var p0 = convert(e[0]);
    if(Number.isInteger(e[1])){
      var p1 = convert(e[1]);
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
    }else{
      // stars case
      //console.log('stars');
      e[1].forEach(function(id){
        var p1 = convert(id);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
      });

    }
    //console.log('draw edge', p);

  });
  ctx.stroke();
  ctx.closePath();
  ctx.strokeStyle = pre_pColor;// recover
  ctx.lineWidth = pre_pWidth;
}
// convert to {points, edges}
function boundaryPolygon(boundary){

  var points = boundary.map(function(p){
    return [p.x, p.y];
  });
  var edges = new Array(points.length);
  for(var i=1;i<points.length;++i){
    edges[i-1] = [i-1, i];
  }
  edges[points.length-1] = [points.length-1, 0];
  return {points:points, edges:edges};
}


function adaptiveMesh(boundary, criteria){
  var data = boundaryPolygon(boundary);
  var criteria = criteria || .125;
  var res = cdt2d(data.points, data.edges, {criteria: criteria, size_criteria:100});
  //console.log(res.edges);
  // draw
  var edges = res.stars.map(function(e,i){
    return [i, e];
  });
  return {points:data.points, edges:edges.concat(data.edges)};

}


function getMVC(pre0, pre1, pos, pos0){

  return 0;
}

// TODO: get MVC for interPoints by sampling boundary
function mvCoordinates(vecs, boundary, hash, convert_back){
  // offset adjust
  console.log('gen MVC, interPoints len', vecs.Y.length, boundary);
  function convert(pos){
    return hash({x:pos.x-1, y:pos.y-1});
  }
  //
  var errCount = 0;
  return vecs.Y.map(function(id){
    var pos0 = convert_back(id);

    var hb = HierarchyBoundary(pos0, boundary);
    // check
    var cur = hb.head;



    // return
    var ret = [];
    var s = 0;
    cur = hb.head;
    while(cur.next != null){
      cur = cur.next;
      var c = (cur.data.t1 + cur.data.t2)/cur.data.dis;
      if(c!=c){
        if(cur.data.t1 != cur.data.t1){}
          //console.warn(cur);

      }
      ret.push([convert(boundary[cur.data.index]), c]);
      //console.log(c);
      s+=c;

    }

    if(s == 0){
      errCount++;
      return [];
    }else{
      return ret.map(function(c){// normalize
        return [c[0], c[1]/s];
      });
    }
  });
  console.log('err count', errCount);
}