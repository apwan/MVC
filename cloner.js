/*
 * image processing
 */

function ImageCloner(mask, boundary, fg_img){
  this.mask = mask;
  this.boundary = boundary;
  this.fg_img = fg_img;
  this.rMaps = reduceMap(mask);
  var rev = this.rev = this.rMaps.dmap.reverse;
  var tree = this.tree = this.rMaps.tree;

  // check bounary
  var bm = this.rMaps.bmap;
  var convert = this.rMaps.hash;
  var errCount = 0;
  boundary.forEach(function(p, i){
    var newp = {x:p.x-1, y:p.y-1};
    var id = convert(newp);
    if(bm[id]==null || rev[id]==null){
      errCount++;
      console.warn('error', newp, tree.search(newp), mask[p.y][p.x]);
    }
  })
  console.log('err count: ', errCount);

  // pass interPoints to construct mvc coordinates
  var vmap = this.vmap = vecType(mask, this.rev);
  var vecs = this.vecs = getTypeVec(vmap);

  var width = mask[0].length - 2;
  function convert_back(id){
    return {x:id%width + 1, y:Math.floor(id/width) + 1}

  }


  console.time('syb');
  this.Syb = mvCoordinates(this.vecs, this.boundary, this.rMaps.hash, convert_back);
  console.log('Syb', this.Syb);
  console.timeEnd('syb');


}



// triangulatioin based on quadratree
ImageCloner.prototype.quadMesh = function(){
  var blen = this.boundary.length - 1; // dim, b
  console.log('boundary len', blen);
  var vmap = vecType(this.mask, this.rMaps.dmap.reverse);
  var vid = getTypeVec(vmap);


  var width = this.mask[0].length - 2;

  var convert = this.rMaps.hash;
  var tree = this.rMaps.tree;
  function convert_back(id){
    return {x:id%width, y:Math.floor(id/width)};
  }


  // indexed in inner points

  var interId = {};
  var mask = this.mask;
  var interPoints = Object.keys(this.rMaps.dmap.reverse);
  var interlen = interPoints.length;
  var points = new Array(interlen).fill(null);


  interPoints = interPoints.map(function(id,i){
    interId[id] = i;
    id = Number(id);
    var p = convert_back(id);
    points[i] = [p.x, p.y];
    return id;
  });


  var bdId = {};

  var boundaryPoints = new Array(blen);

  for(var i=0;i<blen;++i) {
    var p = this.boundary[i];
    var newp = {x: p.x - 1, y: p.y - 1};
    var id = convert(newp);

    if (interId[id] == null) {
      console.warn('boundary not exist', p, tree.search(newp));
    } else {
      bdId[id] = interId[id];
    }
    boundaryPoints[i] = bdId[id];
  };
  var edges = [];

  for(var i=2;i<blen;i+=2){
    edges.push([boundaryPoints[i-2], boundaryPoints[i]]);
    //edges.push([i-1, i]);
  }
  edges.push([boundaryPoints[(blen-1)^0x1], boundaryPoints[0]]);
  //edges.push([blen-1, 0]);
  edges.sort(function(a, b){
    return a[0] - b[0] || a[1] - b[1];
  });

  //console.log('cdt2d', points, edges);

  var mesh = cdt2d(points, edges, {criteria: .125, size_criteria:10});
  console.log('quaMesh', mesh);

  var ret_edges = [];

  mesh.stars.forEach(function(star, i){
    for(var j=0;j<star.length;j+=2){
      if(i<star[j] && star[j]<star[j+1]){
        ret_edges.push([star[j], star[j+1]]);
      }
    }
  });
  return {points:points, edges:ret_edges.concat(edges)};

  return mesh;

}


ImageCloner.prototype.paintSrc = function(img){
  // on source img: mesh or mozaic

  this.boundary.forEach(function(pos){
    var rgb = [.1, .1, .1];
    drawPixel(img, {x:pos.x-1, y:pos.y-1}, rgb, 1);
  });

  // draw mosaic
  this.rMaps.tree.mosaic(img);

  // hierarchy boundary
  var hb = HierarchyBoundary({x:(img.width)>>1, y:(img.height/2)>>1}, this.boundary);
  var boundary = this.boundary;
  hb.traverse(function(data){
    var pos = boundary[data.index];
    drawPixel(img, {x:pos.x - 1, y:pos.y - 1}, [1, 0, 0], 1);
    neighbor8.forEach(function(e){
      drawPixel(img, {x:pos.x - 1 + e[0], y:pos.y - 1 + e[1]}, [.9, .1, .1], 1);
    });
  });


  var tri;
  try{
    tri = this.quadMesh();
    console.log('quadMesh');
  }catch(e){
    console.warn(e);
    var simpBoundary = hb.map(function(data){
      return boundary[data.index];
    });
    tri = adaptiveMesh(simpBoundary)

  }


  var paint = function(ctx, refpos){
    //console.log('paint mesh', tri);
    drawTriangulation(ctx, tri.points, tri.edges, {pos:refpos, pColor:'white', pWidth:.4});
  }

  //console.log('hierarchy boundary: ', hbsize, hb);


  var width = this.mask[0].length - 2;
  // draw interpolation points
  for(var node in this.rMaps.dmap.reverse){
    var py = Math.floor(node/width);
    var px = node % width;
    drawPixel(img, {x:px, y:py}, [0,0,.9],1);
  }
  return {img:img, post_paint:paint};
}

ImageCloner.prototype.interpolate = function(bval){
  // y = Syb * b
  // if mvc
  var errCount = 0;
  var tot =0;

  var yval = this.Syb.map(function(yy){
    var ret = 0;
    yy.forEach(function(ele){
      tot++;
      var bid = ele[0];
      var b = bval[bid];
      //if(b == null || b!=b || ele[1] != ele[1]){
        //console.warn('miss boundary', ele);
        //errCount++;
        //return;
      //}
      ret += b * ele[1];

    });
    return ret;
  });

  //console.log('inter err', errCount, tot, yval.length);


  // x = S * [b, y]
  bval = this.vecs.b.map(function(id){
    return bval[id] || 0;
  });
  var b_y = _.object(this.vecs.Y.concat(this.vecs.b), yval.concat(bval));


  var b_x = this.rMaps.dmap.rmul(b_y, this.vecs.b.concat(this.vecs.X));

  return b_x;

}


var Mode = {
  composite: 0,
  mvc: 3,
  cgd: 4,
  avg: 2,
  membrane: 1
}
var selectedMode = Mode.mvc;


function floatToRGB(rgb){
  return [
    Math.floor(rgb[0]*256),
    Math.floor(rgb[1]*256),
    Math.floor(rgb[2]*256)
  ]
}

ImageCloner.prototype.paintTgt = function(img, bg_img){

  //var img = new ImageData(this.fg_img);

  // local refs
  var mask = this.mask;
  var fg_img = this.fg_img;
  var rmap = this.rMaps;
  var height = this.mask.length - 2, width = this.mask[0].length-2;
  var vecs = this.vecs;
  function convert_back(id){
    return {x:id%width, y:Math.floor(id/width)};
  }

  //console.log('bvals', bvals_arr);// len 3
  var b_x = vecs.b.concat(vecs.X);

  if(selectedMode == Mode.composite){
    b_x.forEach(function(id){
      var pos = convert_back(id);
      //var rgb = floatToRGB(rgbval[i]);
      var rgb = getRGB(fg_img, pos);
      setRGB(img, pos, rgb, 1);
    });
    return img;
  }
  if(selectedMode == Mode.avg){

    b_x.forEach(function(id){
      var pos = convert_back(id);
      var rgb0 = getRGB(bg_img, pos);
      var rgb = getRGB(fg_img, pos).map(function(e,i){
        return Math.floor((e+rgb0[i])/2);
      });
      setRGB(img, pos, rgb, 1);
    });
    return img;


  }
  // bg_img used to calculate the difference

  var diffs = vecs.b.map(function(id){
    var pos = convert_back(id);
    return Vec.diff(getRGB(bg_img, pos), getRGB(fg_img, pos),3);

  });

  var bvals_arr = _.unzip(diffs).map(function(b){
    return _.object(vecs.b, b);
  });

  var rgb_arr = Array(3);
  if(selectedMode == Mode.cgd){
    try{
      rgb_arr = run_CGD(mask, this.rMaps.dmap, bvals_arr);

    }catch(e){
      console.warn(e);
      rgb_arr = Array(3)
    }

  }else{
    console.time('interpolate')
    for(var i=0;i<3;++i){
      rgb_arr[i] = this.interpolate(bvals_arr[i]);
    }
    var rgbval = _.unzip(rgb_arr);
    console.timeEnd('interpolate')

  }


  if(selectedMode == Mode.membrane){

    for(var i=b_x.length-1;i>=0;i--){
      var pos = convert_back(b_x[i]);
      //var rgb = floatToRGB(rgbval[i]);
      var rgb = rgbval[i].map(function(e,j){
        return Math.round(e);
      });
      setRGB(img, pos, rgb, 1);

    }
    return img;

  }

  // else MVC

  for(var i=b_x.length-1;i>=0;i--){
    var pos = convert_back(b_x[i]);
    //var rgb = floatToRGB(rgbval[i]);
    var rgb0 = getRGB(fg_img, pos);
    var rgb = rgbval[i].map(function(e,j){
      return Math.round(rgb0[j]+e);
    });
    setRGB(img, pos, rgb, 1);
  }



  return img;
}

// video  cloning
