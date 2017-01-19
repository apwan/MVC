var mvc = {src:{}, tgt:{}};

function resizeCvs(cvs, w, h){
  ['fg', 'bg', 'aid'].forEach(function(tag){
    cvs[tag].width = w;
    cvs[tag].height = h;
  });
}
function loadBgImg(cvs, url){
  var img = new Image();
  img.src = url;
  img.onload = function(){
    resizeCvs(cvs, img.width, img.height);
    cvs.bg.getContext('2d').drawImage(img, 0,0);
  }
}

function init(mvc_demo){
  mvc.src['el'] = document.getElementById('mvc_src');
  mvc.tgt['el'] = document.getElementById('mvc_tgt');
  ['fg', 'bg', 'aid'].forEach(function(tag){
    mvc.src[tag] = mvc.src.el.getElementsByClassName('cvs_'+tag)[0];
    mvc.tgt[tag] = mvc.tgt.el.getElementsByClassName('cvs_'+tag)[0];
  });
  mvc.src.ctx = mvc.src.fg.getContext('2d');
  mvc.tgt.ctx = mvc.tgt.fg.getContext('2d');

  loadBgImg(mvc.src, 'source.jpg');
  loadBgImg(mvc.tgt, 'target.jpg');
}



// outer:0, boudary:>=2, inner:1
function findMask(boundary, boxP1, boxP2){
  var ret = [];
  var width = boxP2.x - boxP1.x + 1;
  var height = boxP2.y - boxP1.y + 1;
  for(var i=0;i<height+2;i++){
    ret.push(Array(width+2).fill(1));
  }

  boundary.forEach(function(e,i){
    ret[e.y-boxP1.y+1][e.x-boxP1.x+1] = 2;
  });


  // blood fill from bounding box
  var frontier = [];
  function spread(i,j){
    if(ret[i][j] == 1){
      ret[i][j] = 0;

      frontier.push([i,j]);
    }
  }
  for(var i=1;i<=width;++i){
    ret[0][i] = ret[height+1][i] = 0;
    spread(1, i);
    spread(height, i);
  }
  for(var i=1;i<=height;++i){
    ret[i][0] = ret[i][width+1] = 0;
    spread(i, 1);
    spread(i, width);
  }
  while(frontier.length > 0){
    var pix = frontier.shift();
    neighbor4.forEach(function(p){
      spread(pix[0]+p[0], pix[1]+p[1]);
    });
  }

  // remove spurious edge, order boundary
  var reducedBoundary = [];
  boundary.forEach(function(e){
    var x = e.x-boxP1.x+1;
    var y = e.y-boxP1.y+1;
    var s = [0,0,0];
    neighbor4.forEach(function(p){
      var val = ret[y+p[1]][x+p[0]];
      s[val] += 1;
    });
    if(s[0] >= 2){
      if(s[1]>0){
        reducedBoundary.push({x:x,y:y});
      }else{
        ret[y][x] = 0;
      }
    }else if(s[0] > 0){
      reducedBoundary.push({x:x,y:y});
    }else{
      neighbor4p.forEach(function(p){
        var val = ret[y+p[1]][x+p[0]];
        s[val] += 1;
      });
      if(s[0]>1){
        reducedBoundary.push({x:x,y:y});
      }else{
        ret[y][x] = 1;

      }
    }

  });
  for(var i=1;i<reducedBoundary.length;++i){
    var p1 = reducedBoundary[i-1], p2 = reducedBoundary[i];
    var dx = p2.x - p1.x, dy = p2.y - p1.y;

    var s = [0,0,0,0,0];
    neighbor8.forEach(function(p){
      var val = ret[p1.y+p[1]][p1.x+p[0]];
      s[val] += 1;

    });
    //console.log(dx, dy, ret[p1.y+dx][p1.x-dy]);

  }

  return {mask:ret, boundary:reducedBoundary};

}


/*
 UI Design
 */

function draggor(){
  // mask: 2D array (height+2)x(width+2), 1~width/1~height is valid
  var mask; // make copy
  var enabled = false;
  var pressed = false;
  var hitPos = {};
  var q = {};
  var lastPos = {};
  var width;
  var height;
  // mask center
  var c = {};
  // global center
  var g = {};
  // transform matrix
  var mat = [];// identity

  function hit(x, y){
    var r = {x: x - g.x + c.x, y: y - g.y + c.y};
    // transform

    if(r.x<0 || r.x>=width || r.y<0 || r.y>=height){
      return false;
    }else if(mask[r.y+1][r.x+1]>0){
      console.log('hit');
      return r;
    }else{
      return false;
    }
  }
  function pressing(e){
    if(pressed){
      return false;
    }else if(enabled){
      // decide if within mask area
      q = hit(e.offsetX, e.offsetY);
      if(q == false){
        q = {};
        return false;
      }else{
        hitPos = {x: e.offsetX, y: e.offsetY};
        lastPos = {x: e.offsetX, y: e.offsetY};
        pressed = true;
        return true;
      }
      return true;
    }else{
      return false;
    }
  }
  function moving(e){
    if(!pressed){
      return false;
    }
    var dx = e.offsetX - lastPos.x;
    var dy = e.offsetY - lastPos.y;
    if(dx == 0 && dy == 0){
      return false; // no change
    }else{
      lastPos.x = e.offsetX;
      lastPos.y = e.offsetY;
      g.x = lastPos.x - q.x + c.x;
      g.y = lastPos.y - q.y + c.y;
      return {
        x: lastPos.x - q.x,
        y: lastPos.y - q.y
      }
    }
  }
  function updateMask(_mask, parentPos){
    if(typeof _mask != 'undefined'){
      mask = _mask.map(function(e){return e.slice();});
      enabled = true;
      width = mask[0].length - 2;
      height = mask.length - 2;
      // mask center
      c = {x: (width>>1),y: (height>>1)};
      // global center
      g = {x: parentPos.x + c.x, y: parentPos.y + c.y};
      //console.log('mask updated');
    }else{
      mask = null;
      enabled = false;
      width = null;
      height = null;
      c = {};
      g = {};
    }
  }

  function release(e){
    if(!pressed){
      return false;
    }
    pressed = false;
    hitPos = {};
    lastPos = {};
    q = {};

  }

  return {
    pressing: pressing,
    release: release,
    moving: moving,
    updateMask: updateMask
  }

}



function selector(){
  var pressed = false;
  var boundary = [];
  var boxP1 = {};
  var boxP2 = {};
  var lastPos = {};

  function updateBoundary(x,y){
    var dx = x - lastPos.x;
    var dy = y - lastPos.y;
    if(dx == 0 && dy == 0){
      return;
    }

    // connect
    if(dx*dx > 1 && dy*dy<=dx*dx){
      var step = dx>0? 1: -1;
      var r = dy/dx;

      for(var j=1;j<dx/step;++j){
        boundary.push({x:lastPos.x+step*j, y:lastPos.y+Math.floor(step*j*r)});
      }
    }else if(dy*dy > 1 && dy*dy>=dx*dx){
      var step = dy>0? 1: -1;
      var r = dx/dy;
      for(var j=1;j<dy/step;++j){
        boundary.push({x:lastPos.x+Math.floor(step*j*r), y:lastPos.y+step*j});
      }
    }
    lastPos = {x:x, y:y};
    boundary.push(lastPos);

    // update bounding box
    if(x < boxP1.x){
      boxP1.x = x;
    }else if(x > boxP2.x){
      boxP2.x = x;
    }
    if(y < boxP1.y){
      boxP1.y = y;
    }else if(y > boxP2.y){
      boxP2.y = y;
    }

  }

  function pressing(e){
    if(pressed){
      return false;
    }
    boundary = [];
    lastPos = {x:e.offsetX, y:e.offsetY};
    boundary.push(lastPos);
    boxP1 = {x:e.offsetX, y:e.offsetY};
    boxP2 = {x:e.offsetX, y:e.offsetY};
    pressed = true;
    return true;
  }

  function release(e){
    if(!pressed){
      return false;
    }
    updateBoundary(boundary[0].x, boundary[0].y);
    pressed = false;

    return {
      boundary: boundary,
      boxP1: boxP1,
      boxP2: boxP2
    }

  }
  return {
    pressing: pressing,
    pressed: function(){return pressed},
    release: release,
    updateBoundary: updateBoundary
  }
}


// handle mouse event
function registerEvents(src,tgt){
  function register(el, evts){
    for(var type in evts){
      el.addEventListener(type, evts[type]);
    }
  }


  var sel = selector();
  var drag = draggor();
  var fg_img, bg_img;// the two image parts we concerned
  var img = null; // apply poisson on fg_img;
  var cloner;
  var pre_pos = null;

  var ctx = mvc.src.ctx;
  ctx.strokeStyle = 'red';


  // target image mouse control
  register(mvc.tgt.aid,{
    'mousedown': function(e){
      if(drag.pressing(e)){
        // make changes
      }
    },
    'mousemove': function(e){
      var pos = drag.moving(e);
      if(pos == false){
        // no changes
      }else{
        if(img == null){
          return;
        }
        mvc.tgt.ctx.clearRect(0, 0, mvc.tgt.fg.width, mvc.tgt.fg.height);
        // get new background and pass back difference on the boundary
        bg_img = mvc.tgt.bg.getContext('2d').getImageData(pos.x, pos.y, img.width, img.height);
        img = ctx.createImageData(bg_img.width, bg_img.height)
        img = cloner.paintTgt(img, bg_img);
        mvc.tgt.ctx.putImageData(img, pos.x, pos.y);

      }
    },
    'mouseup': function(e){
      drag.release(e);

    },
    'mouseout': function(e){
      drag.release(e);
    }
  });

  // source image mouse control
  register(mvc.src.aid, {
    'mousedown': function(e){
      if(sel.pressing(e)){
        ctx.beginPath();
        ctx.moveTo(e.offsetX, e.offsetY);
        ctx.clearRect(0,0, mvc.src.fg.width, mvc.src.fg.height);
      }

    },
    'mousemove': function(e){
      if(sel.pressed()){
        sel.updateBoundary(e.offsetX, e.offsetY);

        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.stroke();

      }
    },
    'mouseup': release,
    'mouseout': release,
    'dblclick': function(e){
      //console.log(e.offsetX, e.offsetY);
      ctx.clearRect(0, 0, mvc.src.fg.width, mvc.src.fg.height);
    }
  });


  // at source image
  function release(e){
    var res = sel.release(e);
    if(res == false){
      return;
    }
    ctx.lineTo(res.boundary[0].x, res.boundary[0].y);
    ctx.stroke();
    ctx.closePath();

    var width = res.boxP2.x - res.boxP1.x + 1;
    var height = res.boxP2.y - res.boxP1.y + 1;
    var data = findMask(res.boundary, res.boxP1, res.boxP2);
    drag.updateMask(data.mask, res.boxP1);// for mouse drag hit
    fg_img = mvc.src.bg.getContext('2d').getImageData(res.boxP1.x, res.boxP1.y, width, height);
    cloner = new ImageCloner(data.mask, data.boundary, fg_img);


    // triangulation



    // painting source image
    var meshImg = mvc.src.ctx.createImageData(width+1, height+1);
    var src_paint = cloner.paintSrc(meshImg);
    mvc.src.ctx.clearRect(res.boxP1.x-1,res.boxP1.y-1, width+2,height+2);
    mvc.src.ctx.putImageData(src_paint.img, res.boxP1.x, res.boxP1.y);
    // post paint
    src_paint.post_paint(ctx, res.boxP1);






    // painting target image

    bg_img = mvc.tgt.bg.getContext('2d').getImageData(res.boxP1.x, res.boxP1.y, width, height);
    img = mvc.tgt.ctx.createImageData(width+1, height+1)
    img = cloner.paintTgt(img, bg_img);
    mvc.tgt.ctx.clearRect(0,0, mvc.tgt.fg.width, mvc.tgt.fg.height);
    mvc.tgt.ctx.putImageData(img, res.boxP1.x, res.boxP1.y);

  }
  // select
  document.getElementById('mode').addEventListener('change', function(e){
    selectedMode = Number.parseInt(e.target.selectedIndex);
    //mvc.tgt.ctx.clearRect(0, 0, mvc.tgt.fg.width, mvc.tgt.fg.height);
    // get new background and pass back difference on the boundary
    //bg_img = mvc.tgt.bg.getContext('2d').getImageData(pos.x, pos.y, img.width, img.height);
    //img = ctx.createImageData(bg_img.width, bg_img.height)
    //img = cloner.paintTgt(img, bg_img);
    //mvc.tgt.ctx.putImageData(img, pos.x, pos.y);
  });

}


