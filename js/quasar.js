
var sceneReady = false;

var renderer, scene, camera, controls;
var gui, guiParams;

var boxOfPoints;
var cylinderGroup, textGroup;

var galaxies = [];
var skewer = [];
var skewerData = new Map();

// var allAbsorptionRates = []; // should be kept in same sorted order as skewers array.
							 // aka allAbsorptionRates[i] should belong to cylinderGroup.children[i] and skewers[i]

var tex1 = new THREE.TextureLoader().load( "blur.png" );
var loader = new THREE.FileLoader();

//defaults - values can be changed here, or loaded in from options.txt
var optionFile = 'options.txt';
// var currentFile = optionFile;

var galaxyFile, skewerFile;
var galaxyRvirScalar = 0.5;
// var skewerWidth = 0.06;
var galaxyRedHSL = "hsl(0, 90%, 50%)";
var galaxyBlueHSL = "hsl(200, 70%, 50%)";
// var skewerAbsorptionMinHSL = "hsl(100, 90%, 50%)";
// var skewerAbsorptionMaxHSL = "hsl(280, 90%, 60%)";
var showLabels = true;
var cameraFocalPoint = new THREE.Vector3(0,0,0);

var boxRadius = 30;
var skewerLinearFiltering = false;

var distanceFromSkewer = 6.0;
	// Determines a distance for toggling on and off galaxies near Skewers

var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();

var pointOverIdx = -1;
var prevPointOverIdx = -1;
var cylOverIdx = -1;
var prevCylOverIdx = -1;


let graphWidth = window.innerWidth/2 - 50, graphHeight = 200; // FIXME: ew, globals
let graph = initGraph();

let xScale = d3.scaleLinear().domain([.5, .9]).range([0, graphWidth]),
	yScale = d3.scaleLinear().domain([0, 2]).range([graphHeight, 0]);

// TODO: attach dat.gui to scales?
// FIXME: load from files specified in

function loadGalaxyData(callback) {
	d3.dsv(" ", galaxyFile, (d) => {
		return {
			'NSAID': d.NSAID,
			'position': new THREE.Vector3(parseFloat(d.x), parseFloat(d.y), parseFloat(d.z)),
			'rvir': d.rvir,
			'redshift': d.redshift,
			'log_sSFR': d.log_sSFR,
			'color': d.color
		}
	}).then((data) => {
		processGalaxyData(data);
		galaxies = data; // TODO: as new Map()

		callback();
	});
}

function roundtothree(s, round = true) {
	// FIXME: must agree with rounding to 3 digits during file generation
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
		}
	}).then( (data) => {
		data.forEach( (d) => {
			skewer.push(d.name)
			let file = [d.name, '', d.start.x, d.start.y, d.start.z,
								'', d.end.x, d.end.y, d.end.z].join('_') + '.dat'
			let spectra = ['HI', 'CIV']
			skewerData.set(d.name, {
				'start': d.start,
				'end': d.end
			})
			plotSkewer(d.name, d.start.clone().multiplyScalar(boxRadius),
								d.end.clone().multiplyScalar(boxRadius))

			// individual reads of each element
			spectra.forEach( (el) => {
				let path = 'data/spectra_' + el + '_partial_norm/'

				d3.dsv(' ', path + file, (dee) => {
					// x y z dist_scaled dist_frac flux_norm
					return {
						// VERIFY x,y,z recoverable from start_point, dist_scaled
						'dist_scaled': parseFloat(dee.dist_scaled),
						'flux_norm': parseFloat(dee.flux_norm),
					}
				}).then( (data) => {
					if (data.length > 1) { // CATCH sentinel values
						skewerData.get(d.name)[el] = data // register to model
					}
				})
			})
		})
		console.log(cylinderGroup.children)
		console.log(skewerData)

		callback();
	})
}

let computeProjections = () => {
	// console.log('loaded so far:', skewerData.length, galaxies.length)
	// TODO: progress bar for large datasets

	skewer.forEach( (k) => {
		let u = skewerData.get(k)
		let skewerLine = new THREE.Line3(u.start, u.end);

		let ret = galaxies.map( v => {
			let p = skewerLine.closestPointToPoint(v.position, true) // clamped to line segment
			return [p, v.position.distanceTo(p)] // < 6*boxRadius ? p : null
		}) // maintain array alignment (w/o wasting memory?)

		// console.log(u, k, ret.map(u => u[1])) // a few skewers are far from everything
		projections.push(ret)
	})
}
let projections = []


// EVENT HANDLERS
function onKeyDown(event) {

    var keyChar = String.fromCharCode(event.keyCode);

    if ( keyChar  == 'S') {
	    cylinderGroup.visible = !cylinderGroup.visible;

    } else if ( keyChar  == 'T') {
	    textGroup.visible = !textGroup.visible;

    } else if ( keyChar  == 'G') {
	    for (var g = 0; g < galaxies.length; g++) {
		var galaxy = galaxies[g];
		galaxy.isVisible = true;
		boxOfPoints.geometry.attributes.isVisible.array[g] = 1.0;
		boxOfPoints.geometry.attributes.isVisible.needsUpdate = true;
	    }

    } else if ( keyChar == 'N') {
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

function onMouseMove( event ) {
	if (!controls.enabled) return // disabled orbit also disables entity select

	// calculate mouse position in normalized device coordinates
	// (-1 to +1) for both components

	mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

	raycaster.setFromCamera( mouse, camera );
	
	// calculate objects intersecting the picking ray	
	var intersects = raycaster.intersectObjects( scene.children );
	pointOverIdx = -1;

	for ( var i = 0; i < intersects.length; i++ ) {
		var p = intersects[ i ];

		// greedy fuzzy select?
		if (p.object.type == "Points" && p.distanceToRay < 0.2) {
			pointOverIdx = p.index;
			break;
		}
	}

	if (pointOverIdx >= 0 && pointOverIdx != prevPointOverIdx) {
		// mouse is over new point; show galaxy details
		selectPoint();
		plotGalaxyImage(); // fire once for each new hover
	}
	if (pointOverIdx < 0 && prevPointOverIdx >= 0) {
		// mouse isn't over a point anymore
		unselectPoint();		
	}

	//intersect with skewers
	intersects = raycaster.intersectObjects( cylinderGroup.children );
	if (cylOverIdx != -1) prevCylOverIdx = cylOverIdx
	cylOverIdx = -1;

	for ( var i = 0; i < intersects.length; i++ ) {
		var p = intersects[ i ];

		if ( cylinderGroup.visible == true && p.object.type == "Mesh") {
			cylOverIdx = cylinderGroup.children.indexOf(p.object) // recompute index to recover model object
			//console.log('skewers['+cylOverIdx+']', p);

			// cylOverLoc = p.point; // EXPECT offset by radius from actual position along skewer.
			break;
		}
	}

	if (cylOverIdx > -1 && cylOverIdx != prevCylOverIdx) {
		plotSkewerSpectra(xScale, yScale);
		plotSkewerNeighbors();
	}
}

function plotSkewerSpectra(x,y) {
	let k = skewer[cylOverIdx],
		spectra = d3.entries(skewerData.get(k));
	// let spectra = d3.entries(u.absorptionData);

	let pen = d3.line()
				.x((d) => x(d.dist_scaled)) // NOT camelcase
				.y((d) => y(d.flux_norm));
	// let graph = d3.select('#graph').select('g')

	// fresh axes rendering x(), y()
	graph.select('.xaxis')
		.call(d3.axisBottom(x))
		.selectAll('text')
			.attr('stroke', 'none')
			.attr('fill', 'white');
	graph.select('.yaxis')
		.call(d3.axisLeft(y))
		.selectAll('text')
			.attr('stroke', 'none')
			.attr('fill', 'white');

	graph.select('.title')
		.text(k);

	// update plot with all absorption data for this skewer

	graph.selectAll('.pen').remove()
	spectra.forEach((u) => {
		graph.append('path')
			.attr('class', 'pen')
			.datum(u.value)
			.attr('d', pen )
			.attr('stroke', u.key == 'HI' ? 'white' : 'gray' )
			.attr('fill', 'none');
	})
		// ({value: v}) => pen(v)
		// ({key: k}) => k == 'HI' ? 'white' : k == 'CIV' ? 'blue' : 'red'
}

function plotGalaxyImage(){

	var g = galaxies[pointOverIdx]
	//g.NSAID

	let f = roundtothree
	x = f(g.position.x,true)
	y = f(g.position.y,true)
	z = f(g.position.z,true)

	var NSAID = 'NSAID: ' + g.NSAID;
	var pos = 'position: x = ' + x + ', y = ' + y + ', z = ' + z;
	var rs = 'redshift: ' + g.redshift;
	var lssfr = 'log_sSFR:' + g.log_sSFR;

	//TO DO: float over to bottom right
	//TO DO: update image for new galaxy
	
	var svg = d3.select('#galaxyImage')
	
	svg.select('div').remove()
	var galaxyImage = svg.append('div')
	galaxyImage.append('img')
		.attr('src', 'data/galaxyImages_partial/'+g.NSAID+'_'+x+'_'+y+'_'+z+'.jpg')
		.attr('width', 200)
		.attr('height', 200)
	galaxyImage.append("text")
		.text(function (d) { return NSAID; })
	galaxyImage.append("text")
		.text(function (d) { return '\n' + pos + '\n'; });
	galaxyImage.append("text")
		.text(function (d) { return rs + '\n'; });
	galaxyImage.append("text")
		.text(function (d) { return lssfr + '\n'; });
	//galaxyImage.append('rect')
	//	.attr("width", 200)
	//	.attr("height", 200);
	
}

function plotSkewerNeighbors() {
	// let u = skewers[cylOverIdx];
	let i = prevCylOverIdx;
	if (i == -1) return;

	let k = skewer[i], v = skewerData.get(k),
		p = projections[i]; // load cache of this skewer

	graph.selectAll('.mark').remove()
	for (let j = 0; j < galaxies.length; ++j) {
		let dist = p[j][1] // .distanceTo(galaxies[j].position)
		// console.log(dist)

		if (dist < distanceFromSkewer / boxRadius) { // filter, then map
			let u = galaxies[j];
			let distAlong = .5 + p[j][0].distanceTo(v.start)
			// console.log(dist, distAlong)

			let halfSize = 20*u.rvir

			// if (pointOverIdx == j) // boxOfPoints and galaxies not aligned?

			graph.append('rect')
				.attr('class', 'mark')
				.attr('x', xScale(distAlong)) // FIXME: I don't believe these...
				.attr('y', graphHeight/2 - halfSize)
				// yScale(u.absorptionData.HI.fluxNorm[i_]) - 5
				.attr('width', 1)
				.attr('height', 2*halfSize)
				.attr('fill', pointOverIdx == j ? 'red' : 'lightblue')
				.attr('opacity', 1 / (30*dist + 1))

				.datum(j)
				.on('mouseover', (j) => {
					pointOverIdx = j //; console.log(galaxies[j])
					selectPoint()
					plotGalaxyImage()
				}) // VERIFY
		}
	}
}

function initGraph() {
	let graph = d3.select('#graph')
					.attr("width", graphWidth + 50)
					.attr("height", graphHeight + 50)
					.append('g')
						.attr("transform", "translate(25, 25)")

	graph.append('rect')
		.attr('x', 0).attr('y', 0)
		.attr('width', graphWidth).attr('height', graphHeight)
		.attr('fill', 'black')	
		.attr('opacity', .5)

	graph.append('g').attr('class', 'xaxis')
		.attr('transform', 'translate(0,'+graphHeight+')')
		.attr('stroke', 'white')
	graph.append('g').attr('class', 'yaxis')
		.attr('stroke', 'white')

	graph.append('text').attr('class', 'title')
		.attr('transform', 'translate('+graphWidth/2+', 0)')
		.attr('text-anchor', 'middle')
		.attr('fill', 'white')

	// let trace = graph.selectAll('.pen')
		 			 // .data(data) // FIXME
	return graph // [graph, trace]
}

init();
animate();


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
		'showLabels': (v) => {showLabels = (v == 'true')},
		'boxRadius': (v) => {boxRadius = v},
		'cameraFocalPoint': (v) => {
			var vals = v.split(",");
			cameraFocalPoint = new THREE.Vector3(
				parseFloat(vals[0]), parseFloat(vals[1]), parseFloat(vals[2]));

			controls.target = cameraFocalPoint;
			controls.update();
			},
		'cameraPositionZ': (v) => {
			camera.position.z = v
		}
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

		

		var vertex = u.position.clone()
		vertex.multiplyScalar(boxRadius)
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
}


function toggleGalaxiesNearSkewers() { 
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



function plotSkewer(name, startPoint, endPoint){
	// was 'recreate_SkewerIndividual'

	//Whenever this function is called it resets the position of skewers based on the original skewerDataFiles.txt
	//So if their positions is ever moved, it will be placed back during the call to reload_Skewers()
	// This means that in the future if you ever move the skewers from their original position then you will
	// need to figure out thow to call reload_Skewers without using the skewerDataFiles.txt
	//****Also**** In this call skewers[] is not changed, and text group is not changed

	var cylMaterialFront = new THREE.ShaderMaterial( {

		uniforms: {
			amplitude: { value: 1.0 },
			color:     { value: new THREE.Color( 0xffffff ) },
			texture:   { value: null } //texture gets set below
		},
		vertexShader:   document.getElementById( 'cyl_vertexshader' ).textContent,
		fragmentShader: document.getElementById( 'cyl_fragmentshader2' ).textContent,
		// cyl_fragmentshader samples a texture

		//blending:       THREE.AdditiveBlending,
		depthTest:      true,
		transparent:    false,
		side:		THREE.FrontSide
	});

	var cylMaterialBack = new THREE.ShaderMaterial( {

		uniforms: {
			amplitude: { value: 1.0 },
			color:     { value: new THREE.Color( 0xffffff ) },
		},
		vertexShader:   document.getElementById( 'cyl_vertexshader' ).textContent,
		fragmentShader: document.getElementById( 'cyl_fragmentshader2' ).textContent,

		//blending:       THREE.AdditiveBlending,
		depthTest:      true,
		transparent:    false,
		side:		THREE.BackSide

	});

	var cylLength = new THREE.Vector3().subVectors(endPoint, startPoint).length();
	var cylGeom = new THREE.CylinderBufferGeometry(skewerWidth, skewerWidth, cylLength, 32, 1, true);
	cylGeom.translate(0, cylLength / 2, 0);
	cylGeom.rotateX(Math.PI / 2);

	// cylMaterialFront.uniforms.texture.value = createAbsorptionDataTexture(absorptionData);
		//**this may reset the color textures(Delete After Testing)
	var cyl = new THREE.Mesh(cylGeom, cylMaterialFront);

	cyl.position.copy(startPoint);
	cyl.lookAt(endPoint);

	cyl.userData.name = name;

	var cyl2 = new THREE.Mesh(cylGeom, cylMaterialBack);
	cyl2.position.copy(startPoint);
	cyl2.lookAt(endPoint);

	cylinderGroup.add(cyl);
	scene.add( cyl2 ); // DO NOT add to cylinderGroup - won't be aligned with skewers data.

	// console.log(cyl, cyl2);	

	if (showLabels) {
		//Label  (x,y) = (-0.166381,0.062923) as ‘Coma cluster’ //z position??

		// TODO: fix level of detail, which is overagressive
		let sprite = new THREE.TextSprite({
			textSize: 0.25,
			redrawInterval: 250,
			texture: {
				text: name,
				fontFamily: 'Avenir, monospace, Arial, Helvetica, sans-serif',
				textAlign: 'left',
			},
			material: {
				color: 0xffffff,
				fog: true,
				transparent: true,
				opacity: 0.9,
			},
		});
		sprite.position.setX(startPoint.x).setY(startPoint.y).setZ(startPoint.z);
		textGroup.add(sprite);
	}
}

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

	/* loader.load(
		skewerList,

		function(data){
			var rows = data.split("\n");
			for(var i = 1; i < rows.length - 1; i++){
				loader.load(
					rows[i],
					onLoadSkewer(rows[i], plotSkewer),

					// console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
					function ( xhr ) {},
					function ( err ) { console.error( 'An error happened' ); }
				)
			}

			scene.add( cylinderGroup );
		},
		function( xhr ){},
		function( err ){ console.error( 'An error happened');}
	); */
}

function init() {

	renderer = new THREE.WebGLRenderer();
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );

	camera = new THREE.PerspectiveCamera(
		20 /* fov */, window.innerWidth / window.innerHeight /* aspect */,
		1 /* near */, 10000 /* far */ );
	controls = new THREE.OrbitControls( camera );

	scene = new THREE.Scene();

	cylinderGroup = new THREE.Group();
	textGroup = new THREE.Group();
	scene.add( cylinderGroup );
	scene.add( textGroup );

	processOptions(() => { // need parameters to load first
		loadSkewerData( () =>
			loadGalaxyData( computeProjections )
		); // need skewer and galaxy data before taking projections

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
		skewerWid: skewerWidth,
		skewerAbsorMinHSL: [skewMinHSL.r * 255, skewMinHSL.g * 255, skewMinHSL.b * 255],
		skewerAbsorMaxHSL: [skewMaxHSL.r * 255, skewMaxHSL.g * 255, skewMaxHSL.b * 255],
		skewersVisible: function(){cylinderGroup.visible = !cylinderGroup.visible;},
		textVisible: function(){textGroup.visible = !textGroup.visible;},
	}

	//Galaxies Options-----
	var galaxyFolder = gui.addFolder('Galaxies');
	var galNearSkew =      galaxyFolder.add(guiParams, "galNearSkewer").name("Galaxies Close to Skewers");
	var galRangeNearSkew = galaxyFolder.add(guiParams, "galDist2Skewer", 0.01, 6).name("Range From Skewer");
	var galaxyRvirSc = galaxyFolder.add(guiParams, "galRvirScal", 0, 1).name("Rvir Scalar");
	var galaxyRed  = galaxyFolder.addColor(guiParams, "galRedHSL").name("Red Value");
	var galaxyBlue = galaxyFolder.addColor(guiParams, "galBlueHSL").name("Blue Value");

	//Skewers Options-----
	var skewerFolder = gui.addFolder("Skewers");
	var skewerVis = skewerFolder.add(guiParams, "skewersVisible").name("Toggle Skewer Visibility");
	var textVis =   skewerFolder.add(guiParams, "textVisible").name("Toggle Text Visibility");
	var skewerWidthChange = skewerFolder.add(guiParams, "skewerWid", 0.0, 0.5).step(0.01).name("Width");
	var skewerMinAbs = skewerFolder.addColor(guiParams, "skewerAbsorMinHSL").name("Minimum Absorption");
	var skewerMaxAbs = skewerFolder.addColor(guiParams, "skewerAbsorMaxHSL").name("Maximum Absorption");


	//Functions to update the galaxy parameters in the scene------
	galNearSkew.onChange(function(value){
		if(value){
			toggleGalaxiesNearSkewers();
		}else{
			for (var g = 0; g < galaxies.length; g++) {
				var galaxy = galaxies[g];
				galaxy.isVisible = true;
				boxOfPoints.geometry.attributes.isVisible.array[g] = 1.0;
				boxOfPoints.geometry.attributes.isVisible.needsUpdate = true;
	    	}
		}
	});

	galRangeNearSkew.onChange(function(value){
		distanceFromSkewer = value;
		if(guiParams.galNearSkewer){
			toggleGalaxiesNearSkewers();
		}
		plotSkewerNeighbors(); // not until performance improves! (TODO: caching)
	});

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


	//Functions to update skewer parameters in the scene-------

	/*THE FUNCTIONS FOR THESE TWO OPTIONS HAS BEEN MOVED INTO THE OPTIONS
	skewerVis.onChange(function(value){
		cylinderGroup.visible = !cylinderGroup.visible;
	});

	textVis.onChange(function(value){
		console.log(textGroup.visible);
		textGroup.visible = !textGroup.visible;
	});*/

	skewerWidthChange.onFinishChange(function(value){
		//console.log(cylinderGroup);
		//console.log("skewerWidthChange");
		skewerWidth = value;
		recreate_Skewers();

	});

	/* skewerMinAbs.onChange(function(value){
		//console.log(value);
		skewerAbsorptionMinHSL = "rgb("+Math.round(value[0])+" ,"+Math.round(value[1])+" ,"+Math.round(value[2])+")";
		for(var i = 0; i< cylinderGroup.children.length; i++){
			cylinderGroup.children[i].material.uniforms.texture.value = createAbsorptionDataTexture(allAbsorptionRates[i]);
		}
	});

	skewerMaxAbs.onChange(function(value){
		skewerAbsorptionMaxHSL = "rgb("+Math.round(value[0])+", "+Math.round(value[1])+", "+Math.round(value[2])+")";
		//console.log(skewerAbsorptionMaxHSL);
		for(var i = 0; i< cylinderGroup.children.length; i++){
			cylinderGroup.children[i].material.uniforms.texture.value = createAbsorptionDataTexture(allAbsorptionRates[i]);
		}
	}); */



	galaxyFolder.open();
	skewerFolder.open();
	gui.close();

	// dg will be used to test whether the mouse is on the dat.gui menu
	// If it is then you need to stop the orbitControls. If it's not then the camera movement should be enabled
	let orbitOff = () => {controls.enabled = false; controls.update()},
		orbitOn = () => {controls.enabled = true; controls.update()};

	['dat-gui', 'graph'].forEach( (id) => {
		let dg = document.getElementById(id)
		dg.onmouseover = orbitOff
		dg.onmouseout = orbitOn
	})

	let close = document.getElementsByClassName('close-button');
	document.getElementById('dat-gui').prepend(close[0]); // node vacates previous position
}



function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

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


/*
function createDataTexture() {

	// create a buffer with color data

	var resX = 1;
	var resY = parseInt(Math.random() * 15 + 1);

	var size = resX * resY;
	var data = new Uint8Array( 4 * size );


	for ( var i = 0; i < size; i++ ) {

		var stride = i * 4;

		data[ stride ] = parseInt( Math.random() * 255 );
		data[ stride + 1 ] = parseInt( Math.random() * 255 );
		data[ stride + 2 ] = parseInt( Math.random() * 255 );
		data[ stride + 3 ] = 255;
	}


	// used the buffer to create a DataTexture

	//console.log(data);

	var texture;
	if (skewerLinearFiltering) {
		//DataTexture( data, width, height, format, type, mapping, wrapS, wrapT, magFilter, minFilter, anisotropy )
		texture = new THREE.DataTexture( data, resX, resY, THREE.RGBAFormat, THREE.UnsignedByteType, THREE.UVMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.LinearFilter );

	} else {

		texture = new THREE.DataTexture( data, resX, resY, THREE.RGBAFormat ); 
	}


	texture.needsUpdate = true; // just a weird thing that Three.js wants you to do after you set the data for the texture

	return texture;
}
*/

/* function createAbsorptionDataTexture(absorptionData) {
	// create a buffer with color data

	var resY = absorptionData.length - 1;
	var data = new Uint8Array( 4 * resY );

	var colorMin = new THREE.Color(skewerAbsorptionMinHSL);
	var colorMax = new THREE.Color(skewerAbsorptionMaxHSL);

	var minHSL = colorMin.getHSL();
	var maxHSL = colorMax.getHSL();

	var colorVal = new THREE.Color(0.0,0.0,0.0);

	for ( var i = 0; i < resY; i++ ) {

		var ar = absorptionData[i];
		//var lerpVal = (ar + 1.0) * 0.5; //scale from -1->+1 to 0->1

		var lerpVal;
		if (ar < 0.0) {
			lerpVal = (ar * -1.0);
			colorVal.setHSL(minHSL.h, minHSL.s, lerpVal+0.2); //   = colorMin.clone().lerp(black, lerpVal);
		} else {
			colorVal.setHSL(maxHSL.h, maxHSL.s, lerpVal+0.2 );
		}
		//console.log("ar = " + ar + ", lerpVal = " + lerpVal);

		var stride = i * 4;

		data[ stride ] = parseInt(colorVal.r * 255);
		data[ stride + 1 ] = parseInt(colorVal.g * 255);
		data[ stride + 2 ] = parseInt(colorVal.b * 255);
		data[ stride + 3 ] = 255;
	}

	var texture;
	if (skewerLinearFiltering) {
		//DataTexture( data, width, height, format, type, mapping, wrapS, wrapT, magFilter, minFilter, anisotropy )
		texture = new THREE.DataTexture( data, 1, resY,
				THREE.RGBAFormat, THREE.UnsignedByteType, THREE.UVMapping, THREE.ClampToEdgeWrapping,
				THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.LinearFilter );
	} else {

		texture = new THREE.DataTexture( data, 1, resY, THREE.RGBAFormat );
	}
	texture.needsUpdate = true; // just a weird thing that Three.js wants you to do after you set the data for the texture

	return texture;
} */