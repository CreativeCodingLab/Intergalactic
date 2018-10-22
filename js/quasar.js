//QUASAR.JS
//In coordination with the CreativeCodingLab and the Astrophysics department at UCSC
//Jasmine Otto, David Abramov, Joe Burchett (Astrophysics), Angus Forbes

// instantiate once
var renderer, scene, camera, controls;
var gui, guiParams;

var boxOfPoints; // parallel to 'galaxies'
var cylinderGroup, // parallel to 'skewer'
	cylinderBackGroup,
	textGroup;

// load once from files
var galaxies = [];
var skewer = [];
var skewerData = new Map();

var tex1 = new THREE.TextureLoader().load( "blur.png" );
// var loader = new THREE.FileLoader();

var optionFile = 'options.txt';

// mutable params
var galaxyFile, skewerFile;
var galaxyRvirScalar = 0.5;

// var skewerWidth = 0.06;

var galaxyRedHSL = "hsl(0, 90%, 50%)";
var galaxyBlueHSL = "hsl(200, 70%, 50%)";
var skewerAbsorptionMinHSL = "hsl(100, 90%, 50%)";
var skewerAbsorptionMaxHSL = "hsl(280, 90%, 60%)";
var showLabels = true;
var cameraFocalPoint;
// = new THREE.Vector3(0,0,0);

// immutable params
var boxRadius = 30;
var skewerLinearFiltering = false;

// internal mutables - pass as arguments, avoid direct use.
var filterDistantGalaxies = false;
var distanceFromSkewer = 0.05;
	// Determines a distance for toggling on and off galaxies near Skewers

var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();

var pointOverIdx = -1;
var prevPointOverIdx = -1;
var cylOverIdx = -1;
var prevCylOverIdx = [-1,-1];

//sets the size of the space on the right side of the screen
let columnWidth = self.innerWidth/3;
let graphHeight = 200;
let depthDomain = [.018, .028];

//graph initialization
let n_skewers = 2;
let graphs = createGraph(n_skewers);

let xScale = () => d3.scaleLinear().domain(depthDomain).range([0, columnWidth - 50]),
	yScale = () => d3.scaleLinear().domain([0, 2]).range([graphHeight, 0]);

init();
animate();

// TODO: attach dat.gui to scales?
// FIXME: load from files specified in

function loadGalaxyData(callback) {
	d3.dsv(" ", galaxyFile, (d) => {
		return {
			'NSAID': d.NSAID,
			'RA': d.RA,
			'DEC': d.DEC,
			'redshift': d.redshift,
			'mstars' : d.mstars,
			'sfr' : d.sfr,
			'sfr_err' : d.sfr_err,
			'rvir' : d.rvir,
			'log_sSFR': d.log_sSFR,
			'color': d.color,
			'position': sphericalToCartesian(d.RA,d.DEC,d.redshift)
			//'img_position': new THREE.Vector3(parseFloat(d.x), parseFloat(d.y), parseFloat(d.z)),
		}
	}).then((data) => {
		processGalaxyData(data);
		galaxies = data; // TODO: as new Map()
		callback();
	});
}

function roundtothree(s, round = true) {
	// FIXME: must agree with rounding to 3 digits during file generation
	// return +parseFloat(s).toFixed(3)
	let v = parseFloat(s)
	return round ? Math.round(1000 * v) / 1000.0 : v
}

function loadSkewerData(callback) {

	let f = roundtothree

	d3.dsv(' ', skewerFile, (d) => {
		return { // name x1 y1 z1 x2 y2 z2
			'name': d.name,
			'start': new THREE.Vector3(f(d.x1), f(d.y1), f(d.z1)),
			'end': new THREE.Vector3(f(d.x2), f(d.y2), f(d.z2)),
			'RA': +d.RA,
			'DEC': +d.DEC
		}
	}).then( (data) => {
		data.forEach( (d) => {
			skewer.push(d.name)
			//plotSkewer immediately or else scene graph group will not be aligned with skewer
			//plotSkewer(d.name, d.start.clone().multiplyScalar(boxRadius),
								//d.end.clone().multiplyScalar(boxRadius))
			plotSkewer(d.name,d.RA, d.DEC)
			let file = [d.name] + '.dat'
			//for full data set:
			//let file = d.name + '.dat'
			let spectra = ['HI', 'CIV']
			skewerData.set(d.name, {
				'start': d.start,
				'end': d.end,
				'RA': +d.RA,
				'DEC': +d.DEC,
				'startPoint': sphericalToCartesian(d.RA,d.DEC,galaxy_redshift_min).clone(),
				'endPoint': sphericalToCartesian(d.RA,d.DEC,galaxy_redshift_max).clone()
			})

			// individual reads of each element
			spectra.forEach( (el) => {
				let path = 'data/spectra_' + el + '_partial_norm/'
				//for full data set:
				//let path = 'data/spectra_' + el + '_norm/'
				d3.dsv(' ', path + file, (dee) => {
					// x y z dist_scaled dist_frac flux_norm
					return {
						// VERIFY x,y,z recoverable from start_point, dist_scaled
						//'dist_scaled': parseFloat(dee.dist_scaled),
						'dist_scaled': +spectraScale(dee.dist_scaled), //delete when redshift values is added to spectra
						'flux_norm': parseFloat(dee.flux_norm),
					}
				}).then( (data) => {
					if (data.length > 1) { // CATCH sentinel values

						skewerData.get(d.name)[el] = data // register to model
						if (el === 'HI')
							createAbsorptionDataTexture(d.name)
					}
				})
			})
		})
		callback(); // skewerData hasn't loaded yet, only skewer index
	})
}

let computeProjections = () => {
	// console.log('loaded so far:', skewerData.length, galaxies.length)
	// TODO: progress bar for large datasets

	skewer.forEach( (k) => {
		let u = skewerData.get(k)
		var galaxy_redshift_min = galaxies.reduce((min, p) => p.redshift < min ? p.redshift : min, galaxies[0].redshift)
		var galaxy_redshift_max = galaxies.reduce((max, p) => p.redshift > max ? p.redshift : max, galaxies[0].redshift)

		var startPoint = sphericalToCartesian(u.RA,u.DEC,galaxy_redshift_min).clone()
		//console.log(startPoint)
		var endPoint = sphericalToCartesian(u.RA,u.DEC,galaxy_redshift_max).clone()

		let skewerLine = new THREE.Line3(startPoint, endPoint);

		let ret = galaxies.map( v => {
			let p = skewerLine.closestPointToPoint(v.position, true) // clamped to line segment
			return [p, v.position.distanceTo(p)] // < 6*boxRadius ? p : null
		}) // maintain array alignment (w/o wasting memory?)

		// console.log(u, k, ret.map(u => u[1])) // a few skewers are far from everything
		projections.push(ret)
	})
}
let projections = []

//DELETE THIS FUNCTION ONCE SPECTRAL DATA HAS REDSHIFT
function spectraScale(data){
	let u = data;
	var oldmin = 0.5;
	var oldmax = 0.9;
	var newmin = 0.018;
	var newmax = 0.028;
	var	scaled = (((newmax-newmin)*(u-oldmin))/(oldmax-oldmin))+newmin;
	return scaled
}


// EVENT HANDLERS
function onKeyDown(event) {

    var keyChar = String.fromCharCode(event.keyCode);

    if ( keyChar  == 'S') {
		cylinderGroup.visible = !cylinderGroup.visible;
		cylinderBackGroup.visible = !cylinderBackGroup.visible;

    } else if ( keyChar  == 'T') {
	    textGroup.visible = !textGroup.visible;

	} /* else if ( keyChar  == 'G') {
	    for (var g = 0; g < galaxies.length; g++) {
		var galaxy = galaxies[g];
		galaxy.isVisible = true;
		boxOfPoints.geometry.attributes.isVisible.array[g] = 1.0;
		boxOfPoints.geometry.attributes.isVisible.needsUpdate = true;
		}
    }*/ else if ( keyChar == 'N') {
	    toggleGalaxiesNearSkewers(); // skewers, distanceFromSkewer
    }
};

function selectPoint() {
	var cs = boxOfPoints.geometry.attributes.isSelected.array;
	for (var p = 0; p < cs.length; p++) {
		cs[p] = 0.0;
	}
	cs[pointOverIdx] = 1.0;
	prevPointOverIdx = pointOverIdx;
	boxOfPoints.geometry.attributes.isSelected.needsUpdate = true;
}
function unselectPoint() {
	var cs = boxOfPoints.geometry.attributes.isSelected.array;
		for (var p = 0; p < cs.length; p++) {
			cs[p] = 0.0;
		}
		prevPointOverIdx = -1;
		boxOfPoints.geometry.attributes.isSelected.needsUpdate = true;
}

// WIP - pass bool attribute to fragment shader of each cylinder?
function selectSkewer() {
	let cyl = cylinderGroup.children[prevCylOverIdx[0]]
	cyl.geometry.attributes.isSelected.set(Array(192).fill(1.0)) // OR, swap out material?
	cyl.geometry.attributes.isSelected.needsUpdate = true;
}
function unselectSkewer() {
	let cyl = cylinderGroup.children[prevCylOverIdx[0]]
	if (cyl) {
		cyl.geometry.attributes.isSelected.set(Array(192).fill(0.0))
		cyl.geometry.attributes.isSelected.needsUpdate = true;
	}
}

function onMouseMove( event ) {
	if (!controls.enabled) return // disabled orbit also disables entity select

	// calculate mouse position in normalized device coordinates
	// (-1 to +1) for both components

	mouse.x = ( event.clientX / (window.innerWidth - columnWidth) ) * 2 - 1;
	mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

	raycaster.setFromCamera( mouse, camera );

	// calculate objects intersecting the picking ray
	var intersects = raycaster.intersectObjects( scene.children );
	pointOverIdx = -1;

	for ( var i = 0; i < intersects.length; i++ ) {
		var p = intersects[ i ];

		// greedy fuzzy select?
		if (p.object.type == "Points" && p.distanceToRay < 0.00009) {
			pointOverIdx = p.index;
			break;
		}
	}

	if (pointOverIdx >= 0 && pointOverIdx != prevPointOverIdx) {
		// mouse is over new point; show galaxy details
		selectPoint();

		plotSkewerSpectra(); // FIXME: only really redrawing x-axis
		plotGalaxyImage(); // fire once for each new hover
	}
	if (pointOverIdx < 0 && prevPointOverIdx >= 0) {
		// mouse isn't over a point anymore
		unselectPoint();
	}

	//intersect with skewers
	intersects = raycaster.intersectObjects( cylinderGroup.children );
	//checks to see if the skewer you are over is already contained within prevCylOverIdx, as to prevent graphs flipping
	let n = n_skewers;
	if (cylOverIdx != -1){
		let i0 = prevCylOverIdx[0];
		for(i=0;i<n-1;i++){
			if(prevCylOverIdx[i] != cylOverIdx){
				if(cylOverIdx != prevCylOverIdx[i+1]){
					prevCylOverIdx[i] = cylOverIdx
					if(prevCylOverIdx[i+1] == -1 || i0 != prevCylOverIdx[i]){
						prevCylOverIdx[i+1] = i0
					}
				}
			}
		}
	}
	if (cylOverIdx != -1){
		let i0 = prevCylOverIdx[0];
		if(prevCylOverIdx[0] != cylOverIdx){
			if(cylOverIdx != prevCylOverIdx[1]){
				prevCylOverIdx[0] = cylOverIdx
				if(prevCylOverIdx[1] == -1 || i0 != prevCylOverIdx[1]){
					prevCylOverIdx[1] = i0
				}
			}
		}
	}
	cylOverIdx = -1;

	for ( var i = 0; i < intersects.length; i++ ) {
		var p = intersects[ i ];

		if ( cylinderGroup.visible == true && p.object.type == "Mesh") {
			cylOverIdx = cylinderGroup.children.indexOf(p.object) // recompute index to recover model object
			//console.log('skewers['+cylOverIdx+']', p);

			// cylOverLoc = p.point; // EXPECT offset by radius from actual position along skewer.
	//		break;
		}
	}

	if (cylOverIdx > -1 && cylOverIdx != prevCylOverIdx[0] || cylOverIdx != prevCylOverIdx[1]) {
		unselectSkewer()
		selectSkewer()

		plotSkewerSpectra();
	}
}

function createGraph(n_skewers) {
	let graphWidth = columnWidth - 50
	let n = n_skewers;
	var graphs = [];
	for(i=0;i<n;i++){
		let ret = d3.select('#details').select('#graphs').append('div').attr('id','graph' + i).append('svg')
						.attr("width", graphWidth + 50)
						.attr("height", graphHeight + 50)
						.append('g')
							.attr("transform", "translate(25, 25)")
		ret.append('rect')
			.attr('class','graph')
			.attr('x', 0).attr('y', 0)
			.attr('width', graphWidth).attr('height', graphHeight)
			.attr('fill', 'black')
			.attr('opacity', .5)
		graphs[i] = ret;

	}
	createBrush()
	createSlider()
	return graphs
}

function plotSkewerSpectra() {
	i = prevCylOverIdx;

	// sticky selection
	let n = graphs.length;
	//graphs.forEach((d) => {
	for(w=0;w<n;w++){
		let graph = graphs[w];

		let k = skewer[i[w]],
			spectra = d3.entries(skewerData.get(k));
		let x = xScale(), y = yScale();

		if(i[w] != -1){
			if (pointOverIdx != -1) {
				let j = pointOverIdx,
					u = galaxies[j]
				}
				graph.selectAll("graph" + w+ "_border").remove()
				d3.select('#details').select('#graph' + w).selectAll('g').selectAll('.yaxis').remove();
				d3.select('#details').select('#graph' + w).selectAll('.xaxis').remove();
				d3.select('#details').select('#graph' + w).selectAll('.title').remove();
				d3.select('#details').select('#graph' + w).selectAll('#border').remove();
				graph.selectAll('.penHI').remove()
				graph.selectAll('.penCIV').remove()

				let pen = d3.line()
					.x((d) => x(d.dist_scaled))
					.y((d) => y(d.flux_norm))
					.curve(d3.curveCardinal);
				spectra.forEach((u) => {
					graph.selectAll('.pen' + u.key).remove()
					graph.selectAll('#border').remove()
					graph.append('path')
						.attr('class', 'pen' + u.key)
						.datum(u.value)
						.attr('d', pen )
						.attr('stroke', u.key == 'HI' ? '#f4eaff' : '#ffd6ce' )
						.attr('fill', 'none')
					graph.append('rect')
							.attr("id","border")
							.attr("transform","translate(-40,-20)")
							.attr("x","15")
							.attr("y","10")
							.attr("width",columnWidth)
							.attr("height",graphHeight+25)
							.attr("style","stroke: black;stroke-width: 50; fill: none;")
					let k = spectra.length - 6
						if(k==1 && (u.key == 'HI' || u.key == 'CIV')){
							graph.append('g').attr('class', 'yaxis')
								.attr('stroke', 'white')
								//.call(d3.axisLeft(y))
								.append('text')
								.attr("transform", "translate(-10," + graphHeight/2 + ") rotate(-90)")
			      		.style("text-anchor", "middle")
								.text(u.key);
						}
						else if(k==2){
							graph.selectAll('.penHI').attr("transform","translate(0," + graphHeight/4 + ")")
							graph.selectAll('.penCIV').attr("transform","translate(0," + (-1)*graphHeight/4 + ")")
								graph.append('g').attr('class', 'yaxis')
									.attr('stroke', 'white')
									.append('text')
									.attr("transform", "translate(-10," + 3*graphHeight/4 + ") rotate(-90)")
				      		.style("text-anchor", "middle")
									.text('HI');
								graph.append('g').attr('class', 'yaxis')
									.attr('stroke', 'white')
									.append('text')
									.attr("transform", "translate(-10," + graphHeight/4 + ") rotate(-90)")
				      		.style("text-anchor", "middle")
									.text('CIV');
							}
						d3.selectAll('text')
							.attr('stroke', 'none')
							.attr('fill', 'white');
					})
			}
			graph.append('g').attr('class', 'xaxis')
				.attr('transform', 'translate(0,'+graphHeight+')')
				.attr('stroke', 'white')
				.call(d3.axisBottom(x).ticks(6)) // relX
				.selectAll('text')
					.attr('stroke', 'none')
					.attr('fill', 'white');

			graph.append('text').attr('class','title')
				.attr('transform', 'translate('+(columnWidth-50)/2+', -7)')
				.attr('text-anchor', 'middle')
				.attr('fill', 'white')
				.text(k);
	}
	plotSkewerNeighbors();
}
function plotSkewerNeighbors() {
	let i = prevCylOverIdx;
	let n = graphs.length;
	for(w=0;w<n;w++){
		let graph = graphs[w];
		if(i[w] != -1){
			let k = skewer[i[w]], v = skewerData.get(k),
			 	p = projections[i[w]]; // load cache of this skewer
			graph.selectAll('.mark').remove()

			if(p){
				for (let j = 0; j < galaxies.length; ++j) {
				let dist = p[j][1] // .distanceTo(galaxies[j].position)
				let u = galaxies[j];
				if (dist < distanceFromSkewer / boxRadius && u.redshift < depthDomain[1] && u.redshift > depthDomain[0]) { // filter, then map

					//let distAlong = .018 + p[j][0].distanceTo(v.startPoint)
					let distAlong = u.redshift
					//console.log(u.rvir, dist)
					let halfSize = 1/(100*dist)
					let halfWidth = u.rvir*2
					//let halfWidth = 10/(u.mstars)

					// if (pointOverIdx == j) // boxOfPoints and galaxies not aligned?

					graph.append('rect') // .attr('id', 'g'+j)
						.attr('class', 'mark')
						.attr('x', xScale()(distAlong))
						.attr('y', graphHeight/2 - halfSize)
						// yScale(u.absorptionData.HI.fluxNorm[i_]) - 5
						.attr('width', halfWidth)
						.attr('height', 2*halfSize)
						.attr('fill', '#fa8072')
						//.attr('opacity', 1 / (30*dist + 1))
						.attr('opacity', 0.75)
						.datum(j)
						/*.on('mouseover', (j) => {
							pointOverIdx = j
							selectPoint()
							plotSkewerSpectra()
							plotGalaxyImage()
						})*/
						.on('click', (j) => {
							pointOverIdx = j //;
							if (event.type == "click"){
								console.log(galaxies[j].NSAID+", " + k + ", " + p[j][1])
							}
							selectPoint()
							plotSkewerSpectra()
							plotGalaxyImage()
						})
						
					}
				}
			}
		}
	}
}
function plotGalaxyImage(){

	var g = galaxies[pointOverIdx]
	//g.NSAID

	let f = roundtothree


	let lines = [
		'NSAID: ' + g.NSAID,
		'DEC = ' + g.DEC,
		'RA = ' + g.RA,
		'mstars = ' + g.mstars,
		'sfr = ' + g.sfr,
		'sfr_err = ' + g.sfr_err,
		'redshift: ' + g.redshift,
		'rvir: ' + g.rvir,
		'log_sSFR: ' + g.log_sSFR]

	//TO DO: float over to bottom right
	//TO DO: update image for new galaxy

	var txt = d3.select('#galaxyDesc')

	var svg = d3.select('#galaxyImage')

	txt.select('div').remove()
	svg.select('div').remove()

	var galaxyDesc = txt.append('div')
	galaxyDesc.selectAll('p')
		.data(lines)
		.enter()
			.append('p')
			.text(d => d)

	var galaxyImage = svg.append('div')
	galaxyImage.append('img')
		.attr('src', 'data/galaxyImages_partial/' + g.NSAID + '.jpg')
		.attr('width', window.innerWidth/6)
	//	.attr('height', 200)

}

function createSlider(init = distanceFromSkewer) {
	let width = columnWidth - columnWidth/4, // FIXME: from columnWidth
		pad = 20
	d3.select('#details').selectAll('#neighbor-slider').remove();
	let svg = d3.select('#details').append('div').attr('id','neighbor-slider').append('svg')
	svg.attr('width', width + 80).attr('height', 30)

	svg.append('rect').attr('class', 'slider-track')
		.attr('x', pad).attr('y', 12.5)
		.attr('width', width - 2*pad).attr('height', 5)
		.style('fill', 'gray')
		/* .on('click', () => {
			apply(d3.event.x) // WIP - needs context of the slider handle.
		}) */

	let scale = d3.scaleLinear()
		.range([pad, width - pad])
		.domain([0.0, 0.2])
		.clamp(true);

	svg.append('text').attr('id', 'slider-value')
		.attr('x', width).attr('y', 17.5)
		.text(init)
		.style('fill', 'white')

	let drag = d3.drag()
		.on('drag', function() {
			if (d3.event.dx === 0) { return; }
			let x = d3.event.x;
			x = x < pad ? pad : x > width-pad ? width-pad : x

			d3.select(this)
				.attr('cx', x);
			let value = scale.copy().invert(x);
			svg.select('#slider-value')
				.text(roundtothree(value))

			distanceFromSkewer = value
			if (filterDistantGalaxies) {
				filterGalaxiesNearSkewers()
			}
			plotSkewerNeighbors();
		})

	svg.append('g') // d3.event wants to be relative to a group
		.append('circle').attr('class', 'slider-handle')
		.attr('cx', scale(init))
		.attr('cy', 15).attr('r', 10)
		.style('fill', 'white')
			// TODO: filterDistantGalaxies doesn't load from options in time
			// TODO: do filter galaxies on load if option is on
		.style('stroke', 'gray')
		.style('stroke-width', 2.5)
		.call(drag)
		.on('dblclick', () => {
			toggleGalaxiesNearSkewers()
			svg.select('.slider-handle')
				.style('fill', () => filterDistantGalaxies ? 'black' : 'white')
		})
}

function createBrush() {
	// https://github.com/CreativeCodingLab/DynamicInfluenceNetworks/blob/master/src/js/focusSlider.js
	d3.select('#details').selectAll('#depth-brush').remove();
	let svg = d3.select('#details').append('div').attr('id','depth-brush').append('svg')
	//let svg = d3.select('#depth-brush')

	let margin = {top: 5, left: 20, bottom: 20, right: 20};
	let axis = svg.append('g');

	let brush = svg.append("g")
		.attr("class", "brush");

	let width = 0, height = 0
	let x = d3.scaleLinear()
	.domain(depthDomain)
	.range([margin.left, width - 1]);

	resize();
	drawBrush();

	function resize() {
		var w = columnWidth - margin.right;
		//var w = 400 - margin.right;
		var h = 60;

		var aspect = w / h;
		//var vw = 280;
		var vw = columnWidth;
		var vh = vw / aspect;

		width = vw;
		//width = window.innerWidth/6;
		height = vh - margin.bottom;

		svg
			//.style("font-size", "2px")
			.attr('width', w).attr('height', h)
			.attr("viewBox", "0 0 " + vw + " " + vh)
			//.attr("text", "white")

		x.range([margin.left, width - margin.right]);

		axis.attr('transform', 'translate(0,' + height + ')')
			.call(d3.axisBottom(x).ticks(4))

	}

	function drawBrush() {
		if (!x) { return; }
		let brusher = d3.brushX()
			.extent([[margin.left, 0], [width - margin.right, height]])
			.on("brush end", brushed);

		brush.call(brusher)
			.call(brusher.move, x.range());
	}

	function brushed() {
		var s = d3.event.selection || x.range();
		ret = s.map(x.invert, x);
		if (ret[0] !== ret[1]) {
			depthDomain[0] = ret[0]
			depthDomain[1] = ret[1]

			if (prevCylOverIdx[0] !== -1 && prevCylOverIdx[0] !== -1) {
				plotSkewerSpectra()
				plotSkewerNeighbors()
			}
		}
		// domain[0] = Math.round(domain[0]);
		// domain[1] = Math.round(domain[1]);
	}
}


function processOptions(callback) {
	let parse = {
		'skewerData': (v) => {skewerFile = v},
		'galaxyData': (v) => {galaxyFile = v},
		'galaxyRvirScalar': (v) => {galaxyRvirScalar = parseFloat(v)},
		'galaxyRedHSL': (v) => {galaxyRedHSL = v},
		'galaxyBlueHSL': (v) => {galaxyBlueHSL = v},
		'skewerWidth': (v) => {skewerWidth = parseFloat(v)},
		'skewerAbsorptionMinHSL': (v) => {skewerAbsorptionMinHSL = v},
		'skewerAbsorptionMaxHSL': (v) => {skewerAbsorptionMaxHSL = v},
		'skewerLinearFiltering': (v) => {skewerLinearFiltering = (v == 'true')},
		//'showLabels': (v) => {showLabels = (v == 'true')},
		'boxRadius': (v) => {boxRadius = v},
		'cameraFocalPoint': (v) => {
			var vals = v.split(",");
			cameraFocalPoint = new THREE.Vector3(
				parseFloat(vals[0]), parseFloat(vals[1]), parseFloat(vals[2]));

			controls.target = cameraFocalPoint;
			controls.update();
			},
		'cameraPositionX': (v) => {camera.position.x = v},
		'cameraPositionY': (v) => {camera.position.y = v},
		'cameraPositionZ': (v) => {camera.position.z = v}
	}

	d3.text('options.txt').then( (data) => {
		let rows = data.split("\n");
		for ( var i = 0; i < rows.length; i ++ ) {
			// careful: includes blank rows.

			var cells = rows[i].split("=");
			var key = cells[0];
			var value = cells[1];

			console.log(key, value)
			if (key in parse) parse[key](value)
		}
		callback();
	})
}

function sphericalToCartesian(RA,DEC,redshift) {
	//takes in phi (RA) and theta (DEC) in degrees
	var theta = RA * (Math.PI/180)
	var phi = DEC * (Math.PI/180)
	var r = redshift

	var sph_pos = new THREE.Spherical(r,phi,theta)
		//Spherical( radius : Float, phi POLAR : Float, theta EQUATOR : Float )
		//PHI AND THETA ARE SWAPPED (physics vs math notation)
	var x = sph_pos.radius*Math.cos(sph_pos.phi)*Math.sin(sph_pos.theta)
	var y = sph_pos.radius*Math.cos(sph_pos.phi)*Math.cos(sph_pos.theta)
	var z = sph_pos.radius*Math.sin(sph_pos.phi)

	var cartesian_position = new THREE.Vector3(x,y,z)
	//console.log(sph_pos)

	return cartesian_position;
}

function processGalaxyData(data) {
	var n = data.length;

	var positions = new Float32Array( n * 3 );
	var selects = new Float32Array( n * 1 );
	var colors = new Float32Array( n * 1 );
	var visibles = new Float32Array( n * 1 );
	var sizes = new Float32Array( n );

	// var color = new THREE.Color( 0xffffff );

	for ( var i = 0; i < n; ++i ) {
		selects[ i ] = 0.0;
		visibles[ i ] = 1.0;

		let u = data[i];
		var id = u.NSAID;

		var vertex = data[i].position.clone()
		//console.log(sphericalToCartesian(u.RA,u.DEC,u.redshift))
		//var vertex = u.position.clone();

		//vertex.multiplyScalar(boxRadius)
		vertex.toArray( positions, i * 3 );

		colors[i] = u.color == "red" ? 0 :
					  u.color == "blue" ? 1 : 2
		// wasn't equality test b/c carriage returns vary (but d3 normalizes?)

		// if (i == 1) console.log(cells)

		var galaxyRvir = u.rvir;
		sizes[i] = galaxyRvir; // * galaxyRvirScalar;
		// moved this to the uniforms in the shaderMaterial,
		// multiplication now happens in the vertex shader

		// let g = new Galaxy(id,
		// new THREE.Vector3(vertex.x, vertex.y, vertex.z), galaxyColor);
		// galaxies.push(g);
	}
	// console.log(colors);
	// console.log(sizes);
	var geometry = new THREE.BufferGeometry();
	geometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
	geometry.addAttribute( 'customColor', new THREE.BufferAttribute( colors, 1 ) );
	geometry.addAttribute( 'isSelected', new THREE.BufferAttribute( selects, 1 ) );
	geometry.addAttribute( 'isVisible', new THREE.BufferAttribute( visibles, 1 ) );

	geometry.addAttribute( 'size', new THREE.BufferAttribute( sizes, 1 ) );

	var material = new THREE.ShaderMaterial( {

		uniforms: {
			amplitude: { value: 1.0 },
			color:     { value: new THREE.Color( 0xffffff ) },
			redColor:  { value: new THREE.Color(galaxyRedHSL) },
			blueColor: { value: new THREE.Color(galaxyBlueHSL) },
			texture:   { value: tex1 },
			galaxyRvirScalar: {value: galaxyRvirScalar}, // multiplication with galaxy Rvir now happens in the vertex shader
		},
		vertexShader:   document.getElementById( 'vertexshader' ).textContent,
		fragmentShader: document.getElementById( 'fragmentshader' ).textContent,

		blending:       THREE.AdditiveBlending,
		depthTest:      false,
		transparent:    true,

	});

	boxOfPoints = new THREE.Points( geometry, material );
	scene.add( boxOfPoints );
/* //This needs to be updated for new coordinate system
	if (showLabels) {
		//Label  (x,y,z) = (-0.166381, 0.062923, ?) as ‘Coma cluster’

		let sprite = new THREE.TextSprite({
			textSize: 0.7,
			redrawInterval: 250,
			texture: {
				text: 'Coma cluster',
				fontFamily: 'Avenir, monospace, Arial, Helvetica, sans-serif',
				textAlign: 'left',
			},
			material: {
				//color: 0xffbbff,
				color: 0xffffff,
				fog: true,
				transparent: true,
				opacity: 0.9,
			},
		});
		sprite.position.setX(-0.166381 * boxRadius).setY(0.062923 * boxRadius).setZ(30);
		textGroup.add(sprite);
	}
	*/
}

function filterGalaxiesNearSkewers() {
	//turn off all stars, then go through the selected skewers and turn on ones that < maxDistance from it

	for (var g = 0; g < galaxies.length; g++)
		boxOfPoints.geometry.attributes.isVisible.array[ g ] = 0.0;

	for (var s = 0; s < skewer.length; s++) {
		let mask = projections[s]
					.map(v => v[1] // .distanceTo(galaxies[i].position)
									<= distanceFromSkewer / boxRadius ? 1 : 0);
					// TODO: refactor
		for (var g = 0; g < galaxies.length; g++)
			if (mask[g])
				boxOfPoints.geometry.attributes.isVisible.array[ g ] = 1.0;
		boxOfPoints.geometry.attributes.isVisible.needsUpdate = true;
	}

}
function unfilterGalaxiesNearSkewers() {
	for (var g = 0; g < galaxies.length; g++)
		boxOfPoints.geometry.attributes.isVisible.array[ g ] = 1.0;
	boxOfPoints.geometry.attributes.isVisible.needsUpdate = true;
}
function toggleGalaxiesNearSkewers() {
	filterDistantGalaxies = !filterDistantGalaxies
	if (filterDistantGalaxies)
		filterGalaxiesNearSkewers()
	else
		unfilterGalaxiesNearSkewers()
}


//function plotSkewer(name, startPoint, endPoint){
function plotSkewer(name, RA, DEC){
	// was 'recreate_SkewerIndividual'

	//Whenever this function is called it resets the position of skewers based on the original skewerDataFiles.txt
	//So if their positions is ever moved, it will be placed back during the call to reload_Skewers()
	// This means that in the future if you ever move the skewers from their original position then you will
	// need to figure out thow to call reload_Skewers without using the skewerDataFiles.txt
	//****Also**** In this call skewers[] is not changed, and text group is not changed

	var cylMat = new THREE.ShaderMaterial( {

		uniforms: {
			amplitude: { value: 1.0 },
			color:     { value: new THREE.Color( 0xffffff ) },
			texture:   { value: null } //texture gets set below
		},
		vertexShader:   document.getElementById( 'cyl_vertexshader' ).textContent,
		fragmentShader: document.getElementById( 'cyl_fragmentshader' ).textContent,
		// cyl_fragmentshader samples a texture

		//blending:       THREE.AdditiveBlending,
		depthTest:      true,
		transparent:    false,
		side:		THREE.FrontSide
	});

	galaxy_redshift_min = galaxies.reduce((min, p) => p.redshift < min ? p.redshift : min, galaxies[0].redshift)
	galaxy_redshift_max = galaxies.reduce((max, p) => p.redshift > max ? p.redshift : max, galaxies[0].redshift)

	var startPoint = sphericalToCartesian(RA,DEC,galaxy_redshift_min).clone()
	var endPoint = sphericalToCartesian(RA,DEC,galaxy_redshift_max).clone()

	//var cylLength = new THREE.Vector3().subVectors(endPoint, startPoint).length();
	var cylLength = startPoint.distanceTo( endPoint );


//	r_min = galaxies.reduce((min, p) => p.position.z < min ? p.position.z : min, galaxies[0].position.z)
//	r_max = galaxies.reduce((max, p) => p.position.z > max ? p.position.z : max, galaxies[0].position.z)

//	var cylLength = -Math.abs(Math.abs(r_max) - Math.abs(r_min))*40;
	//console.log(startPoint)
	var cylGeom = new THREE.CylinderBufferGeometry(skewerWidth, skewerWidth, cylLength, 32, 1, true);
	cylGeom.translate(0, cylLength / 2, 0);
	cylGeom.rotateX(Math.PI / 2);

	//cylMaterialFront.uniforms.texture.value = createAbsorptionDataTexture(name);
		//**this may reset the color textures(Delete After Testing)
	cylGeom.addAttribute( 'isSelected', new THREE.BufferAttribute( new Float32Array(32*6).fill(0.0), 1 ) )
	var cyl = new THREE.Mesh(cylGeom, cylMat);

	//cyl.position.copy(position);
	cyl.position.copy(startPoint);
	cyl.lookAt(endPoint);

	cyl.userData.name = name;

	var cyl2 = new THREE.Mesh(cylGeom, cylMat);

	//cyl2.position.copy(position);
	cyl2.position.copy(startPoint);
	cyl2.lookAt(endPoint);

	cylinderGroup.add(cyl);
	cylinderBackGroup.add( cyl2 ); // do not also add to cylinderGroup - won't be aligned with skewers data.
	// console.log(cyl, cyl2);


	if (showLabels) {
		//Label  (x,y) = (-0.166381,0.062923) as ‘Coma cluster’ //z position??

		// TODO: fix level of detail, which is overagressive
		let sprite = new THREE.TextSprite({
			textSize: 0.000125,
			redrawInterval: 250,
			texture: {
				text: name,
				fontFamily: 'Avenir, monospace, Arial, Helvetica, sans-serif',
				textAlign: 'left',
			},
			material: {
				color: 0xffffff,
				fog: false,
				transparent: true,
				opacity: 0.9,
			},
		});
		sprite.position.setX(startPoint.x).setY(startPoint.y).setZ(startPoint.z);
		textGroup.add(sprite);
	}

}

/*
function recreate_Skewers(){
	scene.remove(cylinderGroup); // taking out all the skewers

	// cylinderGroup.forEach(u => u.dispose()); // FIXME: memory leak
	cylinderGroup = null;
	cylinderGroup = new THREE.Group(); // resetting cylinderGroup so that it is empty

	skewerData.forEach( (d) => {
		plotSkewer(d.name, d.start.clone().multiplyScalar(boxRadius),
							d.end.clone().multiplyScalar(boxRadius))
	})
	scene.add( cylinderGroup );
}
*/

function init() {

	renderer = new THREE.WebGLRenderer();
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth - columnWidth, window.innerHeight );

	camera = new THREE.PerspectiveCamera(
		28 /* fov */, (2*window.innerWidth/3) / window.innerHeight /* aspect */,
		0.001 /* near */, 1 /* far */ );
	controls = new THREE.OrbitControls( camera );
	camera.maxDistance = Infinity;

	scene = new THREE.Scene();

	cylinderGroup = new THREE.Group();
	cylinderBackGroup = new THREE.Group();
	textGroup = new THREE.Group();
	scene.add( cylinderGroup );
	scene.add( cylinderBackGroup );
	scene.add( textGroup );

	processOptions(() => { // need parameters to load first
		loadGalaxyData( () =>
			loadSkewerData( computeProjections )); // need skewer and galaxy data before taking projections
		displayGui();
	});

	var container = document.getElementById( 'container' );
	container.appendChild( renderer.domElement );

	window.addEventListener( 'resize', onWindowResize, false );
	window.addEventListener( 'mousemove', onMouseMove, false );
	document.addEventListener("keydown", onKeyDown, false);
}

//Creates a gui using the dat.gui library
function displayGui(){
	gui = new dat.GUI( {width: 350} );
	gui.domElement.id = 'dat-gui';

	//Get the color from the global variables
	//I make use of the fact that THREE.Color can switch between rgb and hsl
	var galRed = new THREE.Color(galaxyRedHSL);
	var galBlue = new THREE.Color(galaxyBlueHSL);
	var skewMinHSL = new THREE.Color(skewerAbsorptionMinHSL);
	var skewMaxHSL = new THREE.Color(skewerAbsorptionMaxHSL);

	//Define gui Parameters
	guiParams = {
		galNearSkewer: false,
		galDist2Skewer: distanceFromSkewer,
		galRvirScal: galaxyRvirScalar,
		galRedHSL: [galRed.r * 255, galRed.g * 255, galRed.b * 255],
		galBlueHSL: [galBlue.r * 255, galBlue.g * 255, galBlue.b * 255],
		skewerWidth: skewerWidth,
		skewerAbsorMinHSL: [skewMinHSL.r * 255, skewMinHSL.g * 255, skewMinHSL.b * 255],
		skewerAbsorMaxHSL: [skewMaxHSL.r * 255, skewMaxHSL.g * 255, skewMaxHSL.b * 255],

		skewersVisible: function(){
			cylinderGroup.visible = !cylinderGroup.visible;
			cylinderBackGroup.visible = !cylinderBackGroup.visible;
		},
		textVisible: function(){textGroup.visible = !textGroup.visible;},
	}

	//Galaxies Options-----
	var galaxyFolder = gui.addFolder('Galaxies');
	// var galNearSkew =      galaxyFolder.add(guiParams, "galNearSkewer").name("Galaxies Close to Skewers");
	// var galRangeNearSkew = galaxyFolder.add(guiParams, "galDist2Skewer", 0.01, 6).name("Range From Skewer");
	var galaxyRvirSc = galaxyFolder.add(guiParams, "galRvirScal", galaxyRvirScalar/2, galaxyRvirScalar*10).name("Rvir Scalar");
	var galaxyRed  = galaxyFolder.addColor(guiParams, "galRedHSL").name("Red Value");
	var galaxyBlue = galaxyFolder.addColor(guiParams, "galBlueHSL").name("Blue Value");

	//Skewers Options-----
	var skewerFolder = gui.addFolder("Skewers");
	var skewerVis = skewerFolder.add(guiParams, "skewersVisible").name("Toggle Skewer Visibility");
	var textVis =   skewerFolder.add(guiParams, "textVisible").name("Toggle Text Visibility");
	var skewerWidthChange = skewerFolder.add(guiParams, "skewerWidth", 0.0, 0.5).step(0.01).name("Width");
	var skewerMinAbs = skewerFolder.addColor(guiParams, "skewerAbsorMinHSL").name("Minimum Absorption");
	var skewerMaxAbs = skewerFolder.addColor(guiParams, "skewerAbsorMaxHSL").name("Maximum Absorption");

	galaxyRvirSc.onChange(function(value){
		//console.log(value);
		boxOfPoints.material.uniforms.galaxyRvirScalar.value = value;
	});

	galaxyRed.onChange(function(value){
		boxOfPoints.material.uniforms.redColor.value = new THREE.Color(value[0]/255, value[1]/255, value[2]/255);
	});

	galaxyBlue.onChange(function(value){
		boxOfPoints.material.uniforms.blueColor.value = new THREE.Color(value[0]/255, value[1]/255, value[2]/255);
	});

	/*
	skewerWidthChange.onFinishChange(function(value){
		//console.log(cylinderGroup);
		//console.log("skewerWidthChange");
		skewerWidth = value;
		recreate_Skewers();

	});
	*/
	skewerMinAbs.onChange(function(value){
		//console.log(value);
		skewerAbsorptionMinHSL = "rgb("+Math.round(value[0])+" ,"+Math.round(value[1])+" ,"+Math.round(value[2])+")";
		for(var i = 0; i< cylinderGroup.children.length; i++){
			createAbsorptionDataTexture(skewer[i]);
		}
	});

	skewerMaxAbs.onChange(function(value){
		skewerAbsorptionMaxHSL = "rgb("+Math.round(value[0])+", "+Math.round(value[1])+", "+Math.round(value[2])+")";
		//console.log(skewerAbsorptionMaxHSL);
		for(var i = 0; i< cylinderGroup.children.length; i++){
			createAbsorptionDataTexture(skewer[i]);
		}
	});

	galaxyFolder.open();
	skewerFolder.open();
	gui.close();

	// dg will be used to test whether the mouse is on the dat.gui menu
	// If it is then you need to stop the orbitControls. If it's not then the camera movement should be enabled
	let orbitOff = () => {controls.enabled = false; controls.update()},
		orbitOn = () => {controls.enabled = true; controls.update()};

	['dat-gui', 'details', /*'graph'*/].forEach( (id) => {
		let dg = document.getElementById(id)
		dg.onmouseover = orbitOff
		dg.onmouseout = orbitOn
	})

	let close = document.getElementsByClassName('close-button');
	document.getElementById('dat-gui').prepend(close[0]); // node vacates previous position
}


function onWindowResize() {

	columnWidth = window.innerWidth/3;
	var canvas = document.getElementsByTagName('canvas')[0]
	canvas.width = window.innerWidth - columnWidth
	//canvas.height = window.innerHeight
	renderer.setSize( (window.innerWidth - columnWidth), window.innerHeight );
	camera.aspect = (window.innerWidth - columnWidth) / window.innerHeight;
	camera.updateProjectionMatrix();


	let n = graphs.length;
	for(w=0;w<n;w++){
		//let graph = graphs[w];
		d3.select('#details').selectAll('#graph' + w).remove();
	}
	d3.select("#depth-brush").empty();
	graphs = createGraph(n_skewers);
	plotSkewerSpectra(xScale, yScale);
	plotSkewerSpectra();


}

function animate() {
	requestAnimationFrame( animate );

	renderer.render( scene, camera );
}

/* function render() {
	// if (!sceneReady) { return; }

	//console.log(cylinderGroup);

	//var geometry = boxOfPoints.geometry;
	//var attributes = geometry.attributes;

	//for twinkling effect

	// var time = Date.now() * 0.0005;
	//for ( var i = 0; i < attributes.size.array.length; i++ ) {
		//attributes.size.array[ i ] = 14 + 13 * Math.sin( 0.1 * i + time );
	//}
	//attributes.size.needsUpdate = true;

	renderer.render( scene, camera );
} */

function createAbsorptionDataTexture(name) {
	// create a buffer with color data
	let v = skewerData.get(name),
		c = cylinderGroup.children[skewer.indexOf(name)];
		// FIXME: unnecessary O(n) per skewer, once

	/* if (!v || !v.HI) {
		var defaultMat = new THREE.ShaderMaterial( {

			uniforms: {
				amplitude: { value: 1.0 },
				color:     { value: new THREE.Color( 0xffffff ) },
			},
			vertexShader:   document.getElementById( 'cyl_vertexshader' ).textContent,
			fragmentShader: document.getElementById( 'cyl_fragmentshader2' ).textContent,
			// FALLBACK - no data

			//blending:       THREE.AdditiveBlending,
			depthTest:      true,
			transparent:    false,
			side:		THREE.FrontSide

		});
		// var data = new Uint8Array([255, 255, 255, 255]);

		c.material = defaultMat // VERIFY
	} */
	if (v && v.HI) {
		let absorptionData = skewerData.get(name).HI.map(u => u.flux_norm)
		var resY = absorptionData.length - 1;
		var data = new Uint8Array(4 * resY);

		var colorMin = new THREE.Color(skewerAbsorptionMinHSL);
		var colorMax = new THREE.Color(skewerAbsorptionMaxHSL);

		var minHSL = colorMin.getHSL();
		var maxHSL = colorMax.getHSL();

		var colorVal = new THREE.Color(0.0, 0.0, 0.0);

		for (var i = 0; i < resY; i++) {
			//console.log()
			var ar = absorptionData[i] - 1;
			//var lerpVal = (ar + 1.0) * 0.5; //scale from -1->+1 to 0->1

			var lerpVal;
			if (ar < 0.0) {
				lerpVal = (ar * -1.0);
				colorVal.setHSL(minHSL.h, minHSL.s, lerpVal + 0.2); //   = colorMin.clone().lerp(black, lerpVal);
			} else {
				colorVal.setHSL(maxHSL.h, maxHSL.s, lerpVal + 0.2);
			}
			//console.log("ar = " + ar + ", lerpVal = " + lerpVal);

			var stride = i * 4;

			data[stride] = parseInt(colorVal.r * 255);
			data[stride + 1] = parseInt(colorVal.g * 255);
			data[stride + 2] = parseInt(colorVal.b * 255);
			data[stride + 3] = 255;
		}

		var texture;
		//DataTexture( data, width, height, format, type, mapping, wrapS, wrapT, magFilter, minFilter, anisotropy )
		if (skewerLinearFiltering) {
			texture = new THREE.DataTexture(data, 1, resY,
				THREE.RGBAFormat, THREE.UnsignedByteType, THREE.UVMapping, THREE.ClampToEdgeWrapping,
				THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.LinearFilter);
		} else {
			texture = new THREE.DataTexture(data, 1, resY, THREE.RGBAFormat);
		}
		texture.needsUpdate = true;
		c.material.uniforms.texture.value = texture
	}
}
