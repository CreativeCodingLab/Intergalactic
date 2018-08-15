
var sceneReady = false;

var renderer, scene, camera, controls;
var gui, guiParams;

var boxOfPoints;
var cylinderGroup, textGroup;
var galaxies = [];
var skewers = [];
// var allAbsorptionRates = []; // should be kept in same sorted order as skewers array.
							 // aka allAbsorptionRates[i] should belong to cylinderGroup.children[i] and skewers[i]

var dg,isOverControls; // used to test whether the mouse is over the dat.gui. If so the camera shouldn't move

var tex1 = new THREE.TextureLoader().load( "blur.png" );
var loader = new THREE.FileLoader();


//defaults - values can be changed here, or loaded in from options.txt
var optionFile = 'options.txt';
var galaxyFile = 'data/galaxyDataFile'; //hardcode here if not indicated in options.txt
var skewerFile = 'data/qsoInSdssSlice_partial_cartesian_norm.dat'; //hardcode here if not indicated in options.txt
var skewerList = 'skewerDataFiles.txt'; //hardcode here if not indicated in options.txt
var galaxyRvirScalar = 500.0;
var skewerWidth = 0.06;
var galaxyRedHSL = "hsl(0, 90%, 50%)";
var galaxyBlueHSL = "hsl(200, 70%, 50%)";
var skewerAbsorptionMinHSL = "hsl(100, 90%, 50%)";
var skewerAbsorptionMaxHSL = "hsl(280, 90%, 60%)";
var showLabels = true;
var cameraFocalPoint = new THREE.Vector3(0,0,0);
var boxRadius = 30;
var skewerLinearFiltering = false;

var distanceFromSkewer = 0.5; // Determines a distance for toggling on and off galaxies near Skewers

var currentFile = optionFile;

var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();

var pointOverIdx = -1;
var prevPointOverIdx = -1;
var cylOverIdx = -1;
var prevCylOverIdx = -1;

//cylinderGroup.visible = false;

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
	    var testSkewers = [];
	    //testSkewers.push(skewers[0]);
	    //testSkewers.push(skewers[1]);
	    toggleGalaxiesNearSkewers(skewers, distanceFromSkewer);
    }
};



function onMouseMove( event ) {

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
		var cs = boxOfPoints.geometry.attributes.isSelected.array;
		
		for (var p = 0; p < cs.length; p++) {
			cs[p] = 0.0;
		}
	
		cs[pointOverIdx] = 1.0;	
		prevPointOverIdx = pointOverIdx;
		boxOfPoints.geometry.attributes.isSelected.needsUpdate = true;

		// console.log(cylinderGroup);
		// console.log(galaxies[pointOverIdx]);
		
	} 
	if (pointOverIdx < 0 && prevPointOverIdx >= 0) {
		// mouse isn't over a point anymore
		var cs = boxOfPoints.geometry.attributes.isSelected.array;
		
		for (var p = 0; p < cs.length; p++) {
			cs[p] = 0.0;
		}

		prevPointOverIdx = -1;
		boxOfPoints.geometry.attributes.isSelected.needsUpdate = true;
	}
	

	//intersect with skewers - not doing anything with this yet...
	intersects = raycaster.intersectObjects( cylinderGroup.children );
	prevCylOverIdx = cylOverIdx
	cylOverIdx = -1;

	for ( var i = 0; i < intersects.length; i++ ) {
		var p = intersects[ i ];

		if ( cylinderGroup.visible == true && p.object.type == "Mesh") {
			cylOverIdx = cylinderGroup.children.indexOf(p.object) // recompute index to recover model object
			console.log('skewers['+cylOverIdx+']', p);

			// cylOverLoc = p.point; // EXPECT offset by radius from actual position along skewer.
			break;
		}
	}

	if (cylOverIdx > -1 && cylOverIdx != prevCylOverIdx) {
		console.log(skewers[cylOverIdx])

		// show skewer details
		let d = skewers[cylOverIdx] // allAbsorptionRates[cylOverIdx]

		let x = d3.scaleLinear().domain([.5, .9]).range([0, graphWidth]),
			y = d3.scaleLinear().domain([0, 2]).range([graphHeight, 0])
			// TODO: attach dat.gui

		let pen = d3.line().x((d) => x(d.distScaled)).y((d) => y(d.fluxNorm))
		// let graph = d3.select('#graph').select('g')

		// fresh axes
		graph.select('.xaxis')
			.call(d3.axisBottom(x))
			.selectAll('text')
				.attr('stroke', 'none')
				.attr('fill', 'white')
		graph.select('.yaxis')
			.call(d3.axisLeft(y))
			.selectAll('text')
				.attr('stroke', 'none')
				.attr('fill', 'white')

		graph.select('.title')
			.text(d.name)

		// manually refresh plot
		// console.log(data))

		graph.select('.pen').remove()
		graph.append('path')
			.attr('class', 'pen')
			.attr('d', pen(d.absorptionData)) // single 'datum'
			.attr('stroke', 'white')
			.attr('fill', 'none')
	}
}

function initGraph() {
	let graph = d3.select('#graph')
					.attr("width", graphWidth + 50)
					.attr("height", graphHeight + 50)
					.append('g')
						.attr("transform", "translate(25, 25)")

	graph.append('g').attr('class', 'xaxis')
		.attr('transform', 'translate(0,'+graphHeight+')')
		.attr('stroke', 'white')
	graph.append('g').attr('class', 'yaxis')
		.attr('stroke', 'white')
	
	graph.append('text').attr('class', 'title')
		.attr('transform', 'translate('+graphWidth/2+', 0)')
		.attr('text-anchor', 'middle')
		.attr('fill', 'white')

	return graph
}

let graphWidth = window.innerWidth - 50, graphHeight = 200 // FIXME: ew, globals
let graph = initGraph()


init();
animate();





function processOptions(data) {
	var rows = data.split("\n"); 
	for ( var i = 0; i < rows.length - 1; i ++ ) {
		// includes blank rows.

		var cells = rows[i].split("=");
		var key = cells[0];
		var value = cells[1];
		//console.log("" + cells[0] + " = " + cells[1]);
		
		let parse = {
			'skewerData': (v) => {skewerFile = v},
			'skewerDataFiles': (v) => {skewerList = v},
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
				cameraFocalPoint = new THREE.Vector3(parseFloat(vals[0]), parseFloat(vals[1]), parseFloat(vals[2]));
				console.log("cameraFocalPoint = " + cameraFocalPoint);
				console.log(cameraFocalPoint);
				controls.target = cameraFocalPoint;
				controls.update();
				},
			}

		// console.log(parse, key, value)
		if (key in parse) parse[key](value)
	}
}


function createAbsorptionDataTexture(absorptionData) {
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
}

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

function processGalaxyData(data) {

	console.log("data length = " + data.length);

	var rows = data.split("\n"); 

	console.log("splitLines length = " + rows.length);

	//initialize point attributes

	var amount = rows.length - 1;
	//

	var positions = new Float32Array( amount * 3 );
	var selects = new Float32Array( amount * 1 );
	var colors = new Float32Array( amount * 1 );
	var visibles = new Float32Array( amount * 1 );
	var sizes = new Float32Array( amount );

	var vertex = new THREE.Vector3();
	var color = new THREE.Color( 0xffffff );

	var idx = 0;
	//AGF
	//for ( var i = 1; i < 200; i++, idx++ ) {
	for ( var i = 1; i < rows.length - 1; i ++, idx++ ) {

		selects[ idx ] = 0.0;
		visibles[ idx ] = 1.0;

		var cells = rows[i].split(" ");

		var useX = parseFloat(cells[0]);
		var useY = parseFloat(cells[1]);
		var useZ = parseFloat(cells[2]);

		//console.log(useX + "/" + useY + "/" + useZ);
		vertex.x = useX * boxRadius;
		vertex.y = useY * boxRadius;
		vertex.z = useZ * boxRadius;
		vertex.toArray( positions, idx * 3 );
		

		var galaxyColor = cells[6];
		if (galaxyColor.includes("red")) { // watch out for carriage returns - chrome on windows specific?
			colors[ idx ] = 0;

		} else if (galaxyColor.includes("blue")) {
			colors[ idx ] = 1;
			
		} else {
			colors[ idx ] = 2;
		}
		// if (i == 1) console.log(cells)

		var galaxyRvir = parseFloat(cells[3]);
		// console.log("galaxyRvir = " + galaxyRvir);
		sizes[ idx ] = galaxyRvir; // * galaxyRvirScalar; moved this to the uniforms in the shaderMaterial, multiplication now happens in the vertex shader


		galaxies.push(new Galaxy(new THREE.Vector3(vertex.x, vertex.y, vertex.z), galaxyRvir, galaxyColor));
			// FIXME: data file is missing IDs aligned with galaxyImages_partial.
	}
	// console.log(colors);

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
		//Label  (x,y) = (-0.166381,0.062923) as ‘Coma cluster’ //z position??

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
	
		scene.add(textGroup);
	}
}


function toggleGalaxiesNearSkewers(skewers, maxDistance) { 

	//turn off all stars, then go through the selected skewers and turn on ones that < maxDistance from it 

	for (var g = 0; g < galaxies.length; g++) {
		var galaxy = galaxies[g];
		boxOfPoints.geometry.attributes.isVisible.array[ g ] = 0.0;
	}


	for (var s = 0; s < skewers.length; s++) {
		toggleGalaxiesNearSkewer(skewers[s], maxDistance);

	}

}

function toggleGalaxiesNearSkewer(skewer, maxDistance) { 

	var skewerLine = new THREE.Line3(skewer.startPoint, skewer.endPoint);
	
	for (var g = 0; g < galaxies.length; g++) {
		var galaxy = galaxies[g];

		var closestPt = new THREE.Vector3();
		skewerLine.closestPointToPoint ( galaxy.position, true, closestPt);

		var dist = closestPt.distanceTo(galaxy.position);
		//console.log("galaxy " + galaxy.position + " is " + dist + " from skewerRay ");
		//console.log(closestPt );
		//console.log(galaxy.position);
		//console.log(skewerLine);

		if (dist < maxDistance) {
			boxOfPoints.geometry.attributes.isVisible.array[ g ] = 1.0;
		} 
	
		boxOfPoints.geometry.attributes.isVisible.needsUpdate = true;
	}
}



function plotSkewer(name, startPoint, endPoint, absorptionData){
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

	var cyl2 = new THREE.Mesh(cylGeom, cylMaterialBack);
	cyl2.position.copy(startPoint);
	cyl2.lookAt(endPoint);

	cylinderGroup.add(cyl);
	// console.log(cyl);	

	scene.add( cyl2 ); // DO NOT add to cylinderGroup - won't be aligned with skewers data.
}

function createSkewer(name, startPoint, endPoint, absorptionData) {

	skewers.push( new Skewer(name, startPoint, endPoint, absorptionData) ); // register to model
	console.log(name, absorptionData[0])

	plotSkewer(...arguments)
	
	if (showLabels) {
		//Label  (x,y) = (-0.166381,0.062923) as ‘Coma cluster’ //z position??

		let sprite = new THREE.TextSprite({
			textSize: 0.25,
			redrawInterval: 250,
			texture: {
				text: name,
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
		sprite.position.setX(startPoint.x).setY(startPoint.y).setZ(startPoint.z);
		textGroup.add(sprite);
	}

}

function onLoadSkewer(filename, factory) {
	return (data) => {
		// console.log(" skewerFileName = " + skewerFileName);
		var nameVals = filename.split("__"); 

		var name = nameVals[0];
		name = name.split("/")[2];
		var start = nameVals[1].split("_");
		var end = nameVals[2].split("_");

		var sX = parseFloat(start[0]) * boxRadius;
		var sY = parseFloat(start[1]) * boxRadius;
		var sZ = parseFloat(start[2]) * boxRadius;

		var eX = parseFloat(end[0]) * boxRadius;
		var eY = parseFloat(end[1]) * boxRadius;
		var eZ = parseFloat(end[2].split(".dat")[0]) * boxRadius;

		//console.log("start = " + sX + "/" + sY + "/" + sZ);
		//console.log("end = " + eX + "/" + eY + "/" + eZ);

		var rows = data.split("\n"); 
		var absorptionRates = [];
		for ( var i = 1; i < rows.length - 1; i ++ ) {

			var cells = rows[i].split(" "); // FIXME: brittle
			var ret = {'distScaled': parseFloat(cells[3]),
					   'fluxNorm': parseFloat(cells[5]),}
			absorptionRates.push( ret );
		}

		// allAbsorptionRates.push(absorptionRates); //Saves the absorption rates for each skewer
		//console.log("ars length = " + absorptionRates.length);
		//console.log(absorptionRates);

		factory(name, new THREE.Vector3(sX,sY,sZ), new THREE.Vector3(eX,eY,eZ), absorptionRates);
	}
}

function loadData() {
	//console.log("currentFile = [" + currentFile + "]");

	loader.load(
		currentFile,

		function ( data ) {
			if (currentFile == optionFile) {
				console.log("option data = \n" + data);
				processOptions(data);
				currentFile = galaxyFile;
				loadData();
				
			} else if (currentFile == galaxyFile) {
							
				//console.log("galaxy data = \n" + data);
				processGalaxyData(data);
				currentFile = skewerList;
				loadData();
					

			} else if (currentFile == skewerList) {
				//console.log("skewer file = \n" + data);
				var rows = data.split("\n"); 

				for ( var i = 1; i < rows.length - 1; i ++ ) {
					// load skewer data
					loader.load(
						rows[i],
						onLoadSkewer(rows[i], createSkewer),

						// console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
						function ( xhr ) {},
						function ( err ) { console.error( 'An error happened' ); }
					);
				}
				
				scene.add( cylinderGroup );
				console.log(cylinderGroup);

				if(sceneReady != true){				
					sceneReady = true;
					displayGui(); /*displays gui once the scene is ready, 
								this is here so that the data is read in before the gui is made*/
				}
			}
		},

		// console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
		function ( xhr ) {},
		function ( err ) { console.error( 'An error happened' ); }
	);
}

function recreate_Skewers(){
	scene.remove(cylinderGroup); // taking out all the skewers

	cylinderGroup = null;
	cylinderGroup = new THREE.Group(); // resetting cylinderGroup so that it is empty

	loader.load(
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
	);
}

function init() {

	renderer = new THREE.WebGLRenderer();
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );

	camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 10000 );
	camera.position.z = 50;
	controls = new THREE.OrbitControls( camera );
	
	scene = new THREE.Scene();

	cylinderGroup = new THREE.Group();
	textGroup = new THREE.Group();

	loadData();
	//displayGui(); This was moved inside of loadData()
	//              For some reason skewerWidth goes back to 0.06
	//              when not inside of loadData()


	var container = document.getElementById( 'container' );
	container.appendChild( renderer.domElement );

	window.addEventListener( 'resize', onWindowResize, false );
	window.addEventListener( 'mousemove', onMouseMove, false );
	document.addEventListener("keydown", onKeyDown, false);
	

}

//Creates a gui using the dat.gui library
function displayGui(){
	gui = new dat.GUI( {width: 350} );

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
	var galaxyRvirSc = galaxyFolder.add(guiParams, "galRvirScal", 0, 1000).name("Rvir Scalar");
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
			toggleGalaxiesNearSkewers(skewers, distanceFromSkewer);
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
			toggleGalaxiesNearSkewers(skewers, distanceFromSkewer);
		}
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
	dg = document.getElementsByClassName('dg')[0];
	isOverControls = false;
	dg.onmouseover = function(){
		isOverControls = true;
		controls.enabled = false;
		controls.update();
	}
	dg.onmouseout = function(){
		isOverControls = false;
		controls.enabled = true;
		controls.update();
	}
}



function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	requestAnimationFrame( animate );

	render();

}

function render() {

	var time = Date.now() * 0.0005;

	if (!sceneReady) { return; }


	//console.log(cylinderGroup);



	//var geometry = boxOfPoints.geometry;
	//var attributes = geometry.attributes;

	//for twinkling effect
	
	//for ( var i = 0; i < attributes.size.array.length; i++ ) {
		//attributes.size.array[ i ] = 14 + 13 * Math.sin( 0.1 * i + time );
	//}
	//attributes.size.needsUpdate = true;

	renderer.render( scene, camera );

}



