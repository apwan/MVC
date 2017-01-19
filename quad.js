
var neighbor4 = [[0,1], [1,0], [0,-1], [-1,0]];
var neighbor4p = [[1,1], [1,-1], [-1,-1], [-1,1]];
var neighbor8 = [[0,1], [1,1], [1,0], [1,-1],
                 [0,-1], [-1,-1], [-1,0], [-1,1]];

// pos = [x,y], rgba float 0~1
function drawPixel(img, pos, rgb, a){
	if(pos.x<0 || pos.x>=img.width || pos.y<0 || pos.y>=img.height){
		return; // invalid pos
	}
	var ref = 4*(pos.y*img.width+pos.x);
	for(var i=0;i<3;++i){
		// clamped array will handle the cases tmp<0 and tmp>255
		img.data[ref+i] = Math.floor(rgb[i]*256);;
	}
	if(typeof a != 'undefined'){
		img.data[ref+3] = Math.floor(a*256);
	}
}



function drawRect(img, pos1, pos2, rgb, a){
	// TODO: check
	var ref1 = 4*(pos1.y*img.width+pos1.x);
	var ref2 = 4*(pos2.y*img.width+pos2.x);
	var step = img.width * 4;
	var a = a || 1;
	for(var ref=ref1;ref<ref2;ref+=step){
		for(var xref = (pos2.x-pos1.x)*4;xref>= 0;xref-=4){
			for(var i=0;i<3;++i){
				// clamped array will handle the cases tmp<0 and tmp>255
				img.data[ref+xref+i] = Math.floor(rgb[i]*256);
			}
			img.data[ref+xref+3] = Math.floor(a*256);

		}
	}
}
function setRGB(img, pos, rgb, a){
	var ref = 4 * (img.width * pos.y + pos.x);
	img.data[ref] = rgb[0];
	img.data[ref+1] = rgb[1];
	img.data[ref+2] = rgb[2];
	var a = a || 1;
	img.data[ref+3] = Math.floor(a * 256);
}
function getRGB(img, pos){
	var ref = 4 * (img.width * pos.y + pos.x);
	return [
		img.data[ref],
		img.data[ref+1],
		img.data[ref+2]
	];
}
function diffImg(img1, img2){
	var ret = {
		width: Math.min(img1.width, img2.width),
		height: Math.min(img1.height, img2.height),
		data: []
	};
	for(var y=0;y<height;++y){
		for(var x=0;x<width;++x){
			var rgb1 = getRGB(img1, {x:x, y:y});
			var rbg2 = getRGB(img2, {x:x, y:y});
			ret.data.push(
					rgb1[0]-rgb2[0],
					rgb1[1]-rgb2[1],
					rgb1[2]-rgb2[2]
			);
		}
	}
	return ret;
}

// algebraic utils
// calculate mean value coordinates

function absdis(p1, p2){
	var dx = p1.x - p2.x;
	var dy = p1.y - p2.y;
	return Math.sqrt(dx*dx + dy*dy);
}
function  cosdis(p1, p2){
	if((p1.x==0 && p1.y==0)||(p2.x==0 && p2.y==0)){
		return 0;
	}
	return (p1.x*p2.x+p1.y*p2.y)/Math.sqrt(p1.x*p1.x+p1.y*p1.y)/Math.sqrt(p2.x*p2.x+p2.y*p2.y);
}
function det(p1, p2){
	return p1.x * p2.y - p1.y * p2.x;
}
function area(pts){
	if(pts.length<3) return 0;

	var ret = 0;
	for(var i=1; i<pts.length; ++i){
		ret += det(pts[i-1], pts[i]);
	}
	ret += det(pts[pts.length - 1], pts[0]);
	return ret/2;
}


function normalize(arr){
	var s = 0;
	arr.forEach(function(e){s += e;});
	return arr.map(function(e){
		return e/s;
	});
}

function powdiv(x, maxlevel){
	var ret = 0;
	while( x & 0x1 == 0 && ret < maxlevel){
		x >> 1;
		ret++;
	}
	return ret;
}

function rnd_vec(N){
	return new Array(N).fill(null).map(function(){
		return Math.random();
	});
}


// vector algebra
function l2norm(arr){
	var s = 0;
	arr.forEach(function(e){s += e*e;});
	return arr;

}
function dotprod(a, b){
	var len = Math.min(a.length, b.length);
	var s = 0;
	for(var i=0;i<len;++i){
		s += a[i]*b[i];
	}
}

function linadd(x, v, a){
	var a = a || 1;
	return v.map(function(e, i){return x[i] + a * e;});
}

function rt_reduce(arr, cb){
	var ret = arr[0];
	for(var i=1;i<arr.length;++i){
		ret = cb(ret, arr[i]);
	}

}

// double linear interpolation
function dlint(pos0, pos, step, stepY){
	var stepY = stepY || step;
	var ret = [];
	var dx = pos.x - pos0.x, dy = pos.y - pos0.y;
	if(dx == 0 || dx == step){
		if(dy == 0 || dy == stepY){
			ret.push([pos, 1]);
		}else{
			ret.push([{x:pos.x, y:pos0.y}, 1 - dy/stepY]);
			ret.push([{x:pos.x, y:pos0.y+stepY}, dy/stepY]);
		}
	}else{
		if(dy == 0 || dy == stepY){
			ret.push([{x:pos0.x, y:pos.y}, 1 - dx/step]);
			ret.push([{x:pos0.x + step, y:pos.y}, dx/step]);
		}else{
			dy /= stepY; dx /= step;
			ret.push([pos0, (1 - dy) * (1 - dx)]);
			ret.push([{x:pos0.x, y:pos0.y+stepY}, dy * (1-dx)]);
			ret.push([{x:pos0.x+step, y:pos0.y+stepY}, dy * dx]);
			ret.push([{x:pos0.x+step, y:pos0.y}, (1 - dy) * dx]);
		}
	}
	return ret;
}

function tanhalf(p, p1, p2){
	var c = cosdis({x:p1.x-p.x, y:p1.y-p.y}, {x:p2.x-p.x, y:p2.y-p.y});
	return Math.sqrt((1-c	)/(1+c));
}
function polarCoordinates(x, y){
	// change to polar
	var r = Math.sqrt(x*x + y*y);
	var th = 0;
	if(r > 1e-10){
		if(Math.sign(x) == 0){
			th = y > 0? Math.PI/2: -Math.PI/2;
		}else{
			th = Math.atan(y/x);
			if(x<0){
				th += Math.PI;
			}
		}
	}else{
		r = 0;
	}
	return {
		r: r,
		th: th
	}

}
function rectCoordinates(r, th){
	return {
		x: r * Math.cos(th),
		y: r * Math.sin(th)
	}
}


/*
 * Quadradtree
 */



var NodeType = {
	point: 0,
	leaf: 1,
	empty: 2, // outer leaf, in fact
	mixed: 3, // 
	inner: 4
}

function QTreeNode(pos, type){
	//this.level = level | 1;
	this.type = type || NodeType.leaf;
	this.children = Array(4).fill(null); // 0:++, 1:+-, 2:--, 3:-+
	this.pos = pos; // key
}
QTreeNode.prototype.childAt = function(pos){
	if(pos.x >= this.pos.x){
		if(pos.y >= this.pos.y){
			return this.children[0];
		}else{
			return this.children[1];
		}
	}else{
		if(pos.y < this.pos.y){
			return this.children[2];
		}else{
			return this.children[3];
		}
	}
}

QTreeNode.prototype.traverse = function(func){
	if(this.type == NodeType.leaf){
		func(this.children);
	}else if(this.type == NodeType.mixed){
		this.children.forEach(function(e){
			if(e!=null){
				func(e);
			}
		});
	}else if(this.type == NodeType.empty){
		console.warn('wrong traverse', this);
	}else if(this.type == NodeType.inner){
		for(var i=0;i<4;++i){
			if(this.children[i] != null){
				this.children[i].traverse(func);
			}
		}
	}
}

QTreeNode.prototype.search = function(pos){
	if(pos.x<0 || pos.y<0 || pos.x >= this.pos.x*2 || pos.y >= this.pos.y*2){
		return null;
	}
	if(this.type == NodeType.inner){
		var child = this.childAt(pos);
		if(child == null){
			return null;
		}else{
			return child.search(pos);
		}
	}else if(this.type == NodeType.mixed){
		var child = this.childAt(pos);

		if(child == null){
			return null;
		}else{
			if(child.x != pos.x || child.y != pos.y){
				console.warn('rong search', this);
			}
			return [[child, 1]];
		}
	}else if(this.type == NodeType.empty){
		console.warn('search wrong!', this);
		return null;
	}else{
		// leaf
		if(this.type != NodeType.leaf){
			console.log('wrong search!');
		}
		// TODO: handdle T points
		var step = this.children[0].y - this.children[2].y;
		// should be children[2]
		return dlint(this.children[2], pos, step);
	}
}

QTreeNode.prototype.mosaic = function(img){
	this.traverse(function(arr){
		if(Array.isArray(arr)){
			var s = arr[0].x-arr[2].x;
			if(s<4) {
				drawPixel(img, {
					x: Math.floor((arr[2].x + arr[0].x) / 2),
					y: Math.floor((arr[0].y + arr[2].y) / 2)
				}, [.1, .3, .3], 1);
			}else{
				var rgb = rnd_vec(3);
				drawRect(img, arr[2], arr[0], linadd([.1,0,.1], rgb, .2 * Math.log2(s)), .8);
			}

		}else{
			var rgb = [.1,.2,.1];
			drawPixel(img, arr, rgb, .9);
		}

	});
}

// building Quadtree bottom-up
function QTree(mask){
	//console.log('mask', mask);
	var height = mask.length - 2, width = mask[0].length - 2;
	var maxLevel = Math.ceil(Math.log2(Math.max(height, width)));
	var len = 1 << (maxLevel - 1);
	var pre = new Array(len);
	var mixedCount = 0;
	for(var y=0;y<len;++y){
		pre[y] = new Array(len);
		for(var x=0;x<len;++x){
			var s = [0,0,0,0];//counts
			var ele;
			var elepos = {x:2*x+1, y:2*y+1};
			var cv = [0,0,0,0];
			[[1,1],[1,0],[0,0],[0,1]].forEach(function(p, i){
				var pos = {x:2*x+p[0], y:2*y+p[1]};
				if(pos.y >= height  || pos.x >= width){
					s[0]++; // outter
				}else{
					var val = mask[pos.y+1][pos.x+1];
					s[val]++;
					cv[i] = val;
				}
			});

			if(s[0] == 4){
				// empty, will not store at the next level
				ele = new QTreeNode(elepos, NodeType.empty);
			}else{
				if(s[1] < 4){// mixed
					ele = new QTreeNode(elepos, NodeType.mixed);
					mixedCount++;

					ele.children = [
						cv[0]>0? {x:2*x+1, y:2*y+1}: null,
						cv[1]>0? {x:2*x+1, y:2*y}: null,
						cv[2]>0? {x:2*x, y:2*y}: null,
						cv[3]>0? {x:2*x, y:2*y+1}: null
					];
				}else if(s[1]==4){//otherwise leaf, directly merge
					ele = new QTreeNode(elepos, NodeType.leaf);
					ele.children = [
						{x:2*(x+1), y:2*(y+1)},
						{x:2*(x+1), y:2*y},
						{x:2*x, y:2*y},
						{x:2*x, y:2*(y+1)}
					];
				}
			}
			pre[y][x] = ele;
		}
	}
	// bottom-up
	while((len>>=1)>1){
		var step = (1<<maxLevel)/len/2;// step in pre
		//console.log('step', step);
		var next = new Array(len);
		for(var y=0;y<len;++y){
			next[y] = new Array(len).fill(null);
			for(var x=0;x<len;++x){
				var s = [0,0,0];//counts
				var ele = next[y][x] = new QTreeNode({x:step*(2*x+1), y:step*(2*y+1)});

				[[1,1],[1,0],[0,0],[0,1]].forEach(function(p, i){
					var pos = {x:2*x+p[0], y:2*y+p[1]};
					var child = pre[pos.y][pos.x];
					switch(child.type){
						case NodeType.leaf:
							s[1]++;
							ele.children[i] = child;
							break;
						case NodeType.empty:
							s[0]++; // no need to store
							ele.children[i] = null;
							break;
						default: // mixed or inner
							s[2]++;
							ele.children[i] = child;
					}
				});
				if(s[0] == 4){
					ele.type = NodeType.empty;
					ele.children = null;
				}else if(s[1] < 4){
					ele.type = NodeType.inner;
				}else{
					// check whether to merge leaves
					var merge = true;
					var L_neighbor = [[0,-1],[1,-1],[2,0],[2,1],[1,2],[0,2],[-1,1],[-1,0]];
					for(var i=0;i<8;++i){
						var p = L_neighbor[i];
						var pp = {x:2*x+p[0], y:2*y+p[1]};
						if(pp.x>=0 && pp.y>=0 && pp.x<2*len && pp.y<2*len){
							var type = pre[pp.y][pp.x].type;
							if(type != NodeType.leaf){// not leaf 1 or empty 2
								//console.log('not merge', type, pp);
								merge = false;
								break;
							}
						}
					}
					if(merge){
						ele.children = [[1,1],[1,0],[0,0],[0,1]].map(function(p, i){
							return {x:step*2*(x+p[0]), y:step*2*(y+p[1])};
						});
						ele.type = NodeType.leaf;
					}else{
						ele.type = NodeType.inner;
					}
				}
			}

		}

		pre = next;
	}
	// root, now pre is 2x2
	var root = new QTreeNode({x:1<<(maxLevel-1), y:1<<(maxLevel-1)}, NodeType.inner);
	root.children[0] = pre[1][1];
	root.children[1] = pre[0][1];
	root.children[2] = pre[0][0];
	root.children[3] = pre[1][0];
	root.children.forEach(function(e,i,arr){
		if(e.type == NodeType.empty){
			arr[i] = null;
		}
	});

	return root;
}



// ==========

/*
 * maps from dense vector to sparse representation
 */
function DoubleMap(N){
	this.forward = new Array(N);// dense dim
	for(var i=0;i<N;i++){
		this.forward[i] = [];
	}
	this.reverse = {};// sparse dim
}
DoubleMap.prototype.add = function(i,j,v){
	if(this.reverse[j]==null){
		this.reverse[j] = [];
	}
	this.forward[i].push([j,v]);
	this.reverse[j].push([i,v]);
}

// multiply dense vector
DoubleMap.prototype.mul = function(p){

	var ret = {};
	for (var i in this.reverse){
		var s = 0;
		this.reverse[i].forEach(function(e){
			s += p[e[0]] * e[1];
		});
		ret[i] = s;
	}
	return ret; // or  Object.values(ret);

};
// multiply sparse vector, equivalent to interpolate
DoubleMap.prototype.rmul = function(r, tid){
	var len = this.forward.length;
	var ret = Array(len);
	for (var i=0;i<len;++i){
		var s = 0;
		this.forward[i].forEach(function(e){
			s += r[e[0]] * e[1];
		});
		ret[i] = s;
	};
	if(tid == null){
		return ret;
	}else{
		return tid.map(function(id){
			var val = ret[id];
			if(val != null){
				return val;
			}else{
				return 0;
			}
		});
	}
};

//return sparse matrix
DoubleMap.prototype.back = function(rev, sid, tid, dense){
	var ret = {}, tmp=[];
	// rev is array of [key, value]
  for(var i=0;i<sid.length;i++){
		var id = sid[i];
		var m = _.object(rev[id]);
		ret[id] = this.rmul(m, tid);
		tmp.push(ret[id]);
	}
	if(dense==true){
		return tmp;
	}else{
		return ret;
	}
}


// only for testing
function testReverse(rev, mask, tree){
	var flag = true;
	var errCount = 0;
	var width = mask[0].length - 2;
	var height = mask.length - 2;
	function convert_back(id){
		 return {x:id % width, y:Math.floor(id/width)};
	}
	var emptyCount = 0;
	var interCount = 0;
	var interVec = [];
	var check = rev.map(function(val, id){
		var p = convert_back(id);
		var ret = tree.search(p);
		if(ret == null){
			emptyCount++;
			if(val.length != 0){
				console.log('wrong', val);
			}
		}else{
			if(ret.length == 1){
				interCount++;
				interVec.push(p);
			}
			var s = {x:0, y:0, i:0};
			ret.forEach(function(e){
				s.x += e[0].x * e[1];
				s.y += e[0].y * e[1];
				s.i += e[1];
			});
			if(Math.sign(s.x-p.x) | Math.sign(s.y-p.y) | (s.i - 1)){
				console.warn('err', p, s, ret);
			}

		}
		return [p, ret];
	});
	console.log(emptyCount, interCount);


	function checkEmpty(id){
		var p = convert_back(id);
		if(p.y>=height) return true;
		if(mask[p.y+1][p.x+1] == 0){
			return true;
		}else{
			console.log('left', p.x, p.y, mask[p.y+1][p.x+1]);
			//console.log('left', p, tree.search(p));
			return false;
		}
	}
	for(var id in rev){
		var ws = rev[id];


		if(ws.length == 0){
			if(!checkEmpty(id)) {
				flag = false;
				errCount++;
			}
		}else if(ws.length > 4){
			console.warn('exceed', convert_back(id), ws);
		}else{
			var s = {x:0,y:0, i:0};
			ws.forEach(function(w){
				var p = convert_back(w[0]);
				s.x += p.x * w[1];
				s.y += p.y * w[1];
				s.i += w[1];
				if(w[1]<0 || w[1]>1) console.warn('invalid', w[1]);
			});
			var p = convert_back(id);
			if(Math.sign(s.x - p.x) != 0 || Math.sign(s.y - p.y) != 0 || Math.sign(s.i - 1) != 0){
				flag = false;
				errCount++;
				console.log(s, p, ws);
			}

		}

	}
	console.warn('errCount', errCount);
	return flag;
}
// construct quadratree to achieve sparseness

function reduceMap(mask){
	var tree = QTree(mask);
	var mm = [[],[],[]];
	var height = mask.length - 2, width = mask[0].length - 2;
	for(var j=1;j<=height;j++){
		for(var i=1;i<=width;i++){
			var val = mask[j][i];
			if(val>2 || val<0){
				console.warn('wrong mask', val, i, j);
			}
			mm[val].push(width*(j-1)+(i-1));
		}
	}
	console.log('outter vec', mm[0].length);
	console.log('boundary', mm[2].length);
	var inner_count = 0, bcount = 0;
	var dmap = new DoubleMap(height*width);
	function convert(pos){
		return pos.y * width + pos.x;
	}
	var bound = {};

	tree.traverse(function(arr){
		if(Array.isArray(arr)){
			var step = arr[0].x - arr[2].x;
			var a = convert(arr[2]), b = convert(arr[1]);
			var d = convert(arr[0]), c = convert(arr[3]);
			var i_vec = [d, b, a, c];
			if(step == 1){
				// mixed type
				console.log('step 1, mixed');
				arr.forEach(function(p, i){
					var val = mask[p.y+1][p.x+1];
					if (val >= 2){
						bound[i_vec[i]] = 1;
						dmap.add(i_vec[i], i_vec[i], 1);
						bcount++;
					}else	if(val>0){
						dmap.add(i_vec[i], i_vec[i], 1);
						inner_count++;
					}
				});
				return;
			}

			inner_count += step*step;

			// step >= 2, must be leaf
			var index = a;
			if(mask[arr[2].y+1][arr[2].x+1] != 1){
				console.warn('err leaf', arr[2], step);
			}
			dmap.add(index, index, 1);
			for(var j=1;j<step;j++){
				var rj=j/step;
				dmap.add(index+j, a, 1-rj);
				dmap.add(index+j, b, rj);
			}
			for(var i=1;i<step;i++){
				index += width;
				var ri = i/step;
				dmap.add(index, a, 1-ri);
				dmap.add(index, c, ri);

				for(var j=1;j<step;j++){
					var rj = j/step;
					dmap.add(index+j, a, (1-ri)*(1-rj));
					dmap.add(index+j, b, (1-ri)*rj);
					dmap.add(index+j, c, ri*(1-rj));
					dmap.add(index+j, d, ri*rj);
				}

			}

		}else{
			var val = mask[arr.y+1][arr.x+1];
			if(val > 0){
				var index = convert(arr);
				dmap.add(index, index, 1);
				if(dmap.forward[index].length>1){
					console.warn('duplicate', arr, dmap.forward[index]);
				}
				inner_count++;
				if (val >= 2){
					bound[index] = 1;
					bcount++;
				}
			}

		}
	});





	return {dmap:dmap, tree:tree, bmap:bound, hash:convert};
}

function vecType(mask, rev){
	var width = mask[0].length - 2, height = mask.length - 2;
	var ret = {};
	var b_len = 0, X_len = 0, Y_len = 0;
	function convert(x,y){
		return x + y * width;
	}
	for(var y=0;y<height;y++){
		for(var x=0;x<width;x++){
			var val = mask[y+1][x+1];
			if(val > 0){
				var id = convert(x, y);
				if(val >= 2){
					ret[id] = 2;
					b_len++;
				}else{
					//check whether it is interpolation point
					ret[id] = 0;
					X_len++;
					if(rev[id] != null){
						ret[id] = 1;
						Y_len++;
					}
				}
			}
		}
	}
	console.log('vec len: ', b_len, X_len, Y_len);
	return ret;
}
function getTypeVec(vmap){
	var bvec = [], Xvec = [], Yvec = [];
	var i=0, vecId = {};
	for(var id in vmap){
		vecId[id] = i++;
		switch(vmap[id]){
			case 2:
				bvec.push(id);
				break;
			case 1:
				Yvec.push(id);
			// no break!
			case 0:
				Xvec.push(id);
				break;
			default:
				console.warn('wrong', vmap);
		}
	}
	console.log('summary:', bvec.length, Xvec.length, Yvec.length, i);
	return {b:bvec, X:Xvec, Y:Yvec, vid:vecId};
}



function Laplacian(mask, dmap){
	this.height = mask.length - 2;
	this.width = mask[0].length - 2;
	this.mask = mask;
	this.vmap = vecType(mask, dmap.reverse);
	this.dmap = dmap;
}

Laplacian.prototype.convert = function(x, y){
	if(x<0 || y<0) {
		console.warn('negative coordinates');
		return null;
	}
	return y * this.width + x;
}
Laplacian.prototype.convert_back = function(i){
	return {x: i%this.width, y: Math.floor(i/this.width)};
}

function visitNeighbor4(pos0, func, _this){
	neighbor4.map(function(p, i){
		var pos = {x:pos0.x+p[0], y:pos0.y+p[1]};
		if(_this != null){
			return func.call(_this, pos);
		}else{
			return func(pos);
		}


	});
}

Laplacian.prototype.mul = function(sid, sval, tid){
	// by spreading from source
	var tmp = {};
	for(var i=0;i<tid.length;++i){
		var id = sid[i], val = sval[i];
		var pos0 = this.convert_back(id);
		if(tmp[id]==null){
			tmp[id] = 0;
		}
		tmp[id] -= 4*val; //
		visitNeighbor4(pos0, function(pos){
			var new_id = this.convert(pos);
			if(new_id != null && this.vmap[new_id] != null){
				if(tmp[new_id]==null){
					tmp[new_id] = 0;
				}
				tmp[new_id] += val; //
			}
		}, this)
	}
	return tid.map(function(id){
		if(tmp[id]!=null){
			return tmp[id];
		}else{
			return 0;
		}
	});
}

Laplacian.prototype.reverse = function(tid, tval, sid){
	var tmp = {};
	for(var i=0;i<tid.length;++i){
		var id = sid[i], val = tval[i];
		var pos0 = this.convert_back(id);
		// tval not change, sval reversed
		visitNeighbor4(pos0, function(pos){
			var new_id = this.convert(pos);
			if(new_id != null && this.vmap[new_id] != null){
				if(tmp[new_id]==null){
					tmp[new_id] = 0;
				}
				tmp[new_id] -= val; //
			}
		}, this)
	}
	return sid.map(function(id,i){
		if(tmp[id]!=null){
			return tmp[id];
		}else{
			return 0;
		}
	});
}

Laplacian.prototype.rmul = function(sid, svals, tid) {
	// sparse version
	var tmp = {};
	for (var i = svals.length - 1; i >= 0; i--) {
		var ss = svals[i];
		var id = ss[0], sval = ss[1];
		var pos0 = this.convert_back(id);
		if (tmp[id] == null) {
			tmp[id] = 0;
		}
		tmp[id] -= 4 * sval;//
		visitNeighbor4(pos, function (pos) {
			var new_id = this.convert(pos);
			if (new_id != null && this.vmap[new_id] != null) {
				if (tmp[new_id] == null) {
					tmp[new_id] = 0;
				}
				tmp[new_id] += sval;//
			}
		}, this);
	}

	if (tid == null) {
		// return zip vector
		var ret = [];
		for (var id in tmp) {
			var val = tmp[id];
			if (val != 0) {
				ret.push([id, val]);
			}
		}
		return ret;
	}else if(Array.isArray(tid)){
		// filtering
		var ret = [];
		tid.forEach(function (id) {
			var val = tmp[id];
			if (val != null && val != 0) {
				ret.push([id, val])
			}
		});
		return ret;
	}else{
		// multi filtering
		return Object.keys(tid).map(function(fid){
			var ret = [];
			tid[fid].forEach(function (id) {
				var val = tmp[id];
				if (val != null && val != 0) {
					ret.push([id, val])
				}
			});
			return ret;
		});
	}
};


/*
 * Conjugate GD
 */

function run_CGD(mask, dmap, bvals_array){
	// TODO: optimize by saving intermediate result
	var lapl = new Laplacian(mask, dmap.reverse);
	var vecs = getTypeVec(lapl.vmap);
	var params = bvals_array.map(function(bvals){
		return getGDParams(lapl, dmap, vecs, bvals);
	});

	y0 = Array(vecs.Y.length).fill(0);
	var res = params.map(function(p, i){
		return bvals_array[i].concat(conjGD(p.A, p.b, y0, 1e-4, 100));
	});

	return res;


}

function getGDParams(lapl, dmap, vecs, bvals){
	// bvals is the id:val map of boundary
	var bval = vecs.b.map(function(id){
		var val = bvals[id];
		if(val==null){
			console.warn('miss boundary value');
			val = 0;
		}
		return val;
	});
	// S_xb * b
	var b1 = dmap.rmul(bvals,vecs.X);
	// D_xx * S_xb *b
	var b2 = lapl.rmul(vecs.X,b1,vecs.X);
	// D^T_xx * b
	var b3 = lapl.reverse(vecs.b, bval, vecs.X);
  // b2 - b3
	var b4 = Vec.diff(b2, b3);

	// S^T_yx * b4
	var m = _.object(vecs.b, b4);
	var b5 = dmap.rmul(m,vecs.Y);

	// var b5;

	// D_xx * S_xy
	var S = lapl.rmul(dmap.reverse);
	var S2 = dmap.back(S,vecs.Y,vecs.Y,true);


	return {A:S2, b:b5};

	//

}


function conjGD(A, b, x0, ep, Nmax){
	var x = x0, r = b;
	var rho =l2norm(r);
	var thres = ep * Math.sqrt(rho);
	var p = 0, rho_pre = rho;

	for(var k=0;k<Nmax;++k){
		console.log('CD', k, rho);
		p = p*rho/rho_pre + r;
		var w = A.map(function(e){
			return dotprod(e,p);
		});

		var alpha = rho/dotprod(p, w);
		linadd(x, p, alpha);
		linadd(r, w, -alpha);
		rho_pre = rho;
		rho = l2norm(r);
		if(Math.sqrt(rho)<thres){
			break;
		}

	}
	return x;

}

