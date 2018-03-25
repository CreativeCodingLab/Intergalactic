
var sceneReady = false;

var renderer, scene, camera, controls;

var boxOfPoints;
var cylinderGroup, textGroup;



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


var currentFile = optionFile;

var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();

var pointOverIdx = -1;
var prevPointOverIdx = -1;


//cylinderGroup.visible = false;

function onKeyDown(event) {

    var keyChar = String.fromCharCode(event.keyCode);

    if ( keyChar  == 'S') {
	    cylinderGroup.visible = !cylinderGroup.visible;
    } else if ( keyChar  == 'T') {
	    textGroup.visible = !textGroup.visible;
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
		
		if (p.object.type == "Points" && p.distanceToRay < 0.2) {
			//console.log(p);
			pointOverIdx = p.index;
			break;
		}
	}

	
	if (pointOverIdx >= 0 && pointOverIdx != prevPointOverIdx) {

		var cs = boxOfPoints.geometry.attributes.isSelected.array;
		
		for (var p = 0; p < cs.length; p++) {
			cs[p] = 0.0;
		}
	
		cs[pointOverIdx] = 1.0;	

		prevPointOverIdx = pointOverIdx;
		
		boxOfPoints.geometry.attributes.isSelected.needsUpdate = true;

		console.log(cylinderGroup);
	
	} 
	
	if (pointOverIdx < 0 && prevPointOverIdx >= 0) {

		var cs = boxOfPoints.geometry.attributes.isSelected.array;
		
		for (var p = 0; p < cs.length; p++) {
			cs[p] = 0.0;
		}

		prevPointOverIdx = -1;
		boxOfPoints.geometry.attributes.isSelected.needsUpdate = true;


	}
	






}


init();
animate();





function processOptions(data) {

	var rows = data.split("\n"); 
	for ( var i = 0; i < rows.length - 1; i ++ ) {

		var cells = rows[i].split("=");
		var key = cells[0];
		var value = cells[1];
		
		//console.log("" + cells[0] + " = " + cells[1]);
		
		
		if (key == "skewerData") {
			skewerFile = value;

		} else if (key == "skewerDataFiles") {
			skewerList = value;

		} else if (key == "galaxyData") {
			galaxyFile = value;

		} else if (key == "galaxyRvirScalar") {
			galaxyRvirScalar = parseFloat(value);
			
		} else if (key == "galaxyRedHSL") {
			galaxyRedHSL = value;

		} else if (key == "galaxyBlueHSL") {
			galaxyBlueHSL = value;

		} else if (key == "skewerWidth") {
			skewerWidth = parseFloat(value);

		} else if (key == "skewerAbsorptionMinHSL") {
			skewerAbsorptionMinHSL = value;

		} else if (key == "skewerAbsorptionMaxHSL") {
			skewerAbsorptionMaxHSL = value;

		} else if (key == "skewerLinearFiltering") {
			skewerLinearFiltering = (value == 'true');

		} else if (key == "showLabels") {
			showLabels = (value == 'true');

		} else if (key == "boxRadius") {
			boxRadius = value;

		} else if (key == "cameraFocalPoint") {
			var vals = value.split(",");
			cameraFocalPoint = new THREE.Vector3(parseFloat(vals[0]), parseFloat(vals[1]), parseFloat(vals[2]));
			console.log("cameraFocalPoint = " + cameraFocalPoint);
			console.log(cameraFocalPoint);
			controls.target = cameraFocalPoint;
			controls.update();

		}
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
		texture = new THREE.DataTexture( data, 1, resY, THREE.RGBAFormat, THREE.UnsignedByteType, THREE.UVMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.LinearFilter );

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
	var sizes = new Float32Array( amount );

	var vertex = new THREE.Vector3();
	var color = new THREE.Color( 0xffffff );

	var idx = 0;
	//for ( var i = 1; i < 50; i++, idx++ ) {
	for ( var i = 1; i < rows.length - 1; i ++, idx++ ) {

		var cells = rows[i].split(" ");

		var useX = parseFloat(cells[0]);
		var useY = parseFloat(cells[1]);
		var useZ = parseFloat(cells[2]);

		//console.log(useX + "/" + useY + "/" + useZ);
		vertex.x = useX * boxRadius;
		vertex.y = useY * boxRadius;
		vertex.z = useZ * boxRadius;
		vertex.toArray( positions, idx * 3 );
		
		/*
		var galaxyColor = cells[6];
		//console.log("galaxyColor = " + galaxyColor);
		if (galaxyColor == "red") {
			color = new THREE.Color(galaxyRedHSL); //"hsl(0, 90%, 50%)");
			//color = new THREE.Color("hsl(0, 90%, 50%)");

		} else if (galaxyColor == "blue") {
			color = new THREE.Color(galaxyBlueHSL); //"hsl(200, 70%, 50%)");
			//color.setRGB(0.0,1.0,0.0);
		} else {
			color.setRGB(0.0,1.0,0.0);
		}
		color.toArray( colors, idx * 3 );
		*/
		
		var galaxyColor = cells[6];
		if (galaxyColor == "red") {
			colors[ idx ] = 0;

		} else if (galaxyColor == "blue") {
			colors[ idx ] = 1;
		} else {
			colors[ idx ] = 2;
		}


		var galaxyRvir = parseFloat(cells[3]);
		//console.log("galaxyRvir = " + galaxyRvir);

		//console.log("galaxyRvirScalar = " + galaxyRvirScalar);

		sizes[ idx ] = galaxyRvir * galaxyRvirScalar;

		selects[ idx ] = 0.0;
	}



	var geometry = new THREE.BufferGeometry();
	geometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
	geometry.addAttribute( 'customColor', new THREE.BufferAttribute( colors, 1 ) );
	geometry.addAttribute( 'isSelected', new THREE.BufferAttribute( selects, 1 ) );
	geometry.addAttribute( 'size', new THREE.BufferAttribute( sizes, 1 ) );

	

	var material = new THREE.ShaderMaterial( {

		uniforms: {
			amplitude: { value: 1.0 },
			color:     { value: new THREE.Color( 0xffffff ) },
			redColor:  { value: new THREE.Color(galaxyRedHSL) }, 
			blueColor: { value: new THREE.Color(galaxyBlueHSL) }, 
			texture:   { value: tex1 },
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
			textSize: 1.2,
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


function createSkewer(startPoint, endPoint, absorptionData) {

	var cylMaterialFront = new THREE.ShaderMaterial( {

		uniforms: {
			amplitude: { value: 1.0 },
			color:     { value: new THREE.Color( 0xffffff ) },
			texture:   { value: null } //texture gets set below
		},
		vertexShader:   document.getElementById( 'cyl_vertexshader' ).textContent,
		fragmentShader: document.getElementById( 'cyl_fragmentshader' ).textContent,

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

	cylMaterialFront.uniforms.texture.value = createAbsorptionDataTexture(absorptionData);
	var cyl = new THREE.Mesh(cylGeom, cylMaterialFront);

	cyl.position.copy(startPoint);
	cyl.lookAt(endPoint);

	var cyl2 = new THREE.Mesh(cylGeom, cylMaterialBack);
	cyl2.position.copy(startPoint);
	cyl2.lookAt(endPoint);

	cylinderGroup.add(cyl);

	//scene.add( cyl2 );

	//console.log(cyl);
}

function loadSkewerData(skewerFileName) {

	
	loader.load(
		skewerFileName,

		function ( data ) {

			//console.log(" skewerFileName = " + skewerFileName);
			var nameVals = skewerFileName.split("__"); 

			var name = nameVals[0];
			var start = nameVals[1].split("_");
			var end = nameVals[2].split("_");;

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

				var cells = rows[i].split(" ");
				absorptionRates.push( parseFloat(cells[5]) );
			}

			//console.log("ars length = " + absorptionRates.length);
			//console.log(absorptionRates);


			createSkewer(new THREE.Vector3(sX,sY,sZ), new THREE.Vector3(eX,eY,eZ), absorptionRates);

		},

		function ( xhr ) {
			//console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
		},

		function ( err ) {
			console.error( 'An error happened' );
		}
	);

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

					loadSkewerData(rows[i]);
				}		
				
				scene.add( cylinderGroup );
				console.log(cylinderGroup);

								
				sceneReady = true;
			}
		},

		function ( xhr ) {
			//console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
		},

		function ( err ) {
			console.error( 'An error happened' );
		}
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


	var container = document.getElementById( 'container' );
	container.appendChild( renderer.domElement );

	window.addEventListener( 'resize', onWindowResize, false );
	window.addEventListener( 'mousemove', onMouseMove, false );
	document.addEventListener("keydown", onKeyDown, false);
	

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



