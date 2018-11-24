//QUASAR.JS
//In coordination with the CreativeCodingLab and the Astrophysics department at UCSC
//Jasmine Otto, David Abramov, Joe Burchett (Astrophysics), Angus Forbes


/*
questions for Joe
	What do the galaxy colors mean? (red vs blue)
	What are the units of rvir?
	What is significant about observing near-redshift galaxies?
	Could you imagine expanding the redshift range of galaxies that are included in this visualization?
	How could this tool be generalized for other cosmological datasets (far redshift? CGM?)
	What is it about dark matter that this can help us understand?
	If you could pick one or two more features to be added in the next two-three weeks, what would they be?
		- EW vs Galaxy Dist
		- Galaxy histogram?
	Would being able to query the data (ex: galaxies by stellar mass) be useful, or is this easy enough to accomplish using other databases?
*/
var z_d = loadLookUp()

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
var optionFile = 'options.txt';

// mutable params
var galaxyFile, skewerFile;
var galaxyRvirScalar = 0.5;
var galaxyRedHSL = "hsl(0, 90%, 50%)";
var galaxyBlueHSL = "hsl(200, 70%, 50%)";
var skewerAbsorptionMinHSL = "hsl(100, 90%, 50%)";
var skewerAbsorptionMaxHSL = "hsl(280, 90%, 60%)";
var showLabels = true;
var cameraFocalPoint;

// immutable params
var boxRadius = 30;
var skewerLinearFiltering = false;

// internal mutables - pass as arguments, avoid direct use.
var filterDistantGalaxies = false;
var distanceFromSkewer = 1.5; // Determines a distance for toggling on and off galaxies near Skewers

var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();

//initializes the selected galaxies/skewers
var pointOverIdx = -1;
var prevPointOverIdx = -1;
var cylOverIdx = -1;

//sets the size of the space on the right side of the screen
let columnWidth = self.innerWidth/3;
let graphHeight = 200;

//sets the x-range domain of graphs
let depthDomain = [.017, .029]; 


//graph initialization
let n_skewers = 10; //sets the number of graphs available
var prevCylOverIdx = []; //keeps track of skewers that are selected
for(i=0;i<n_skewers;i++){ //initializes selected skewer idx
	prevCylOverIdx.push(-1);
}
let graphs = createGraph(n_skewers);

//initializes skewer neighbor box sizes
var boxHeight = 'dist';
var boxWidth = 2;
var halfWidth = boxWidth;
var halfSize = 10;

//initialize selected galaxies
var currentGalaxy;
var selectedGalaxies = [];
var trigger = false; //used for storing galaxies

//initialize selected skewers
var cyl = [];
var cyl_0;

//initialize projection matrix (galaxies -> skewer distances)
var projections = [];
var quasar_galaxy_neighbors = [];
var allLoaded = false;



//used to generate redshift lookup table, now called from file in loadLookUp() function
/*
var z_r = _.range(0.01600,0.03000,0.00001)
var z_d = []
z_r.forEach(function(d){ 
	let z = {
		z: roundtofive(d),
		d: cosmcalc(d)
	}
	z_d.push(z)
})*/


let xScale = () => d3.scaleLinear().domain(depthDomain).range([0, columnWidth - 50]),
	yScale = () => d3.scaleLinear().domain([0, 2]).range([graphHeight, 0]);	




init()
animate()



function loadGalaxyData(callback) {
	//loadProjections()
	
	d3.json('data/galaxies.json').then(function(d){
		galaxies = d
		processGalaxyData(galaxies);
		//galaxies = data; // TODO: as new Map()
		callback();
	//}).then((data) => {
		
	});
}
/*
	d3.dsv(" ", galaxyFile, (d) => {
		return {
			'NSAID': d.NSAID,
			'RA': +d.RA,
			'DEC': +d.DEC,
			'redshift': +d.redshift,
			'mstars' : d.mstars,
			'sfr' : d.sfr,
			'sfr_err' : d.sfr_err,
			'rvir' : d.rvir,
			'log_sSFR': d.log_sSFR,
			'color': d.color,
			'position': sphericalToCartesian(d.RA,d.DEC,d.redshift)
		}
	}).then((data) => {
		console.log(data)
		processGalaxyData(data);
		galaxies = data; // TODO: as new Map()
		callback();
	});
}*/

//deprecated with redshift/distance lookup array

function loadProjections(){
	d3.json(projectionData).then(function(d){
		projections = d
	})
}

function loadP(idxP){
	if(idxP != -1){
		d3.json('data/projections/p' + idxP + '.json').then(function(d){
			projections[idxP] = d
			plotSkewerNeighbors()
		})
	}	
}

//loads the lookUp file containing redshift -> distance
function loadLookUp(){
	d3.json('data/projections/lookUp.json').then(function(d){
		z_d = d
	})	
}

//finds distance conversion based on redshift value in lookup array
//z: redshift
//d: distance in Mpc
function lookUp(redshift){
	let found = z_d.find(function(element){
		return element["z"] === redshift
	})
	if(found){
		return found["d"]
	}
	else{
		return cosmcalc(redshift)
	}
}

//calculates distance in Mpc from redshift
//deprecated with lookUp table
function cosmcalc(redshift){ //takes in redshift
	
	let z = redshift
	var H0=73; // hubble constant
	var WM=0.27;
	var WV=0.73;

	//initialize constants
	let verbose = 0
	let WR = 0.        // Omega(radiation)
    let WK = 0.        // Omega curvaturve = 1-Omega(total)
    let c = 299792.458 // velocity of light in km/sec
    let Tyr = 977.8    // coefficent for converting 1/H into Gyr
    let DTT = 0.5      // time from z to now in units of 1/H0
    let DTT_Gyr = 0.0  // value of DTT in Gyr
    let age = 0.5      // age of Universe in units of 1/H0
    let age_Gyr = 0.0  // value of age in Gyr
    let zage = 0.1     // age of Universe at redshift z in units of 1/H0
    let zage_Gyr = 0.0 // value of zage in Gyr
    let DCMR = 0.0     // comoving radial distance in units of c/H0
    let DCMR_Mpc = 0.0 
    let DCMR_Gyr = 0.0
    let DA = 0.0       // angular size distance
    let DA_Mpc = 0.0
    let DA_Gyr = 0.0
    let kpc_DA = 0.0
    let DL = 0.0       // luminosity distance
    let DL_Mpc = 0.0
    let DL_Gyr = 0.0   // DL in units of billions of light years
    let V_Gpc = 0.0
    let a = 1.0        // 1/(1+z), the scale factor of the Universe
	let az = 0.5       // 1/(1+z(object))
	
	let h = H0/100.
    WR = 4.165E-5/(h*h)   // includes 3 massless neutrino species, T0 = 2.72528
    WK = 1-WM-WR-WV
    az = 1.0/(1.0+1.0*z)
    age = 0.
    n=1000         // number of points in integrals
    for (i=0; i<n; i++){
      a = az*(i+0.5)/n
      let adot = Math.sqrt(WK+(WM/a)+(WR/(a*a))+(WV*a*a))
	  age = age + 1./adot
	}
    zage = az*age/n
    zage_Gyr = (Tyr/H0)*zage
    DTT = 0.0
	DCMR = 0.0
	
	// do integral over a=1/(1+z) from az to 1 in n steps, midpoint rule
    for (i=0; i<n; i++){
      a = az+(1-az)*(i+0.5)/n
      let adot = Math.sqrt(WK+(WM/a)+(WR/(a*a))+(WV*a*a))
      DTT = DTT + 1./adot
	  DCMR = DCMR + 1./(a*adot)
	}
    DTT = (1.-az)*DTT/n
    DCMR = (1.-az)*DCMR/n
    age = DTT+zage
    age_Gyr = age*(Tyr/H0)
    DTT_Gyr = (Tyr/H0)*DTT
    DCMR_Gyr = (Tyr/H0)*DCMR
	DCMR_Mpc = (c/H0)*DCMR
	
	// tangential comoving distance

    let ratio = 1.00
    let x = Math.sqrt(Math.abs(WK))*DCMR
    if (x > 0.1){
      if (WK > 0){
		ratio =  0.5*(exp(x)-exp(-x))/x
	  } 
      else{
		ratio = sin(x)/x
	  }
	}
    else{
      y = x*x
      if (WK < 0){
		y = -y
		  ratio = 1. + y/6. + y*y/120.
	  }
	}
    DCMT = ratio*DCMR
    DA = az*DCMT
    DA_Mpc = (c/H0)*DA //plot distance in terms of this
    kpc_DA = DA_Mpc/206.264806
    DA_Gyr = (Tyr/H0)*DA
    DL = DA/(az*az)
    DL_Mpc = (c/H0)*DL
    DL_Gyr = (Tyr/H0)*DL

  	// comoving volume computation

    ratio = 1.00
    x = Math.sqrt(Math.abs(WK))*DCMR
    if (x > 0.1){
		if (WK > 0){
			ratio = (0.125*(exp(2.*x)-exp(-2.*x))-x/2.)/(x*x*x/3.)
		}  
		else{
			ratio = (x/2. - sin(2.*x)/4.)/(x*x*x/3.)
		}
	}      
    else{
		let y = x*x
			if (WK < 0){
				y = -y
				ratio = 1. + y/5. + (2./105.)*y*y
			}
	}
    VCM = ratio*DCMR*DCMR*DCMR/3.
	V_Gpc = 4.*Math.pi*((0.001*c/H0)**3)*VCM
	return(DA_Mpc)
}

//rounding function to 3 decimal places
function roundtothree(s, round = true) {
	let v = parseFloat(s)
	return round ? Math.round(1000 * v) / 1000.0 : v
}


//rounding function to 5 decimal places (used due to floating point error with javascript)
//deprecated with lookUp table
/*
function roundtofive(s, round = true) {
	let v = parseFloat(s)
	return round ? Math.round(100000 * v) / 100000.0 : v
}
*/

function loadSkewerData(callback) {

	//let f = roundtothree

	d3.dsv(' ', skewerFile, (d) => {
		return {
			'name': d.name,
			'RA': +d.RA,
			'DEC': +d.DEC
		}
	}).then( (data) => {
		data.forEach( (d) => {
			skewer.push(d.name)
			//plotSkewer immediately or else scene graph group will not be aligned with skewer
			plotSkewer(d.name,d.RA, d.DEC)
			let file = [d.name] + '.dat'
			//for full data set:
			//let file = d.name + '.dat'
			let spectra = ['HI', 'CIV']
			skewerData.set(d.name, {
				'RA': +d.RA,
				'DEC': +d.DEC,
				'startPoint': sphericalToCartesian(d.RA,d.DEC,galaxy_redshift_min).clone(),
				'endPoint': sphericalToCartesian(d.RA,d.DEC,galaxy_redshift_max).clone()
			})

			// individual reads of each element
			spectra.forEach( (el) => {
				let path = 'data/spectra_' + el + '_norm/'
				d3.dsv(' ', path + file, (d) => {
					return {
						'flux_norm': parseFloat(d.flux_norm),
						'redshift': d.redshift,
						'wavelength': d.wavelength
					}
				}).then( (data) => {
					if (data.length > 1) { // CATCH sentinel values
						skewerData.get(d.name)[el] = data // register to model
						if (el === 'HI')
							createAbsorptionDataTexture(d.name) //creates texture on skewer cylinders
					}
				})
			})
		})
		callback(); // skewerData hasn't loaded yet, only skewer index
	})
}

//computes distance between every galaxy and every skewer
let computeProjections = () => {
	skewer.forEach( (k) => {
		let u = skewerData.get(k)
		//convert degrees to radians for use in Math.trig functions
		Number.prototype.toRad = function() {
			return this * Math.PI / 180;
		 }
		let ret = galaxies.map( v => {
			//v = galaxy, u = skewer
			distance = haversine(u.DEC,v.DEC,u.RA,v.RA,v.redshift)
			//return [v.NSAID,k,distance]
			return [distance]
		})
		projections.push(ret)
	})
}

//used to calculate angular distance from projection computation
function haversine(dec1, dec2, ra1, ra2, redshift){
	let z = lookUp(redshift) //converts redshift to meaningful distance in Mpc
	let lat1 = dec1.toRad()
	let lat2 = dec2.toRad()
	let dLat = (dec2-dec1).toRad()
	let dLon = (ra2-ra1).toRad()
	let a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2) * Math.sin(dLon/2)
	let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
	let distance = c * z
	return roundtothree(distance)
}

//able to export an array to .json file for faster retrieval
function exportData(name, text) {
	const a = document.createElement('a');
	const type = name.split(".").pop();
	a.href = URL.createObjectURL( new Blob([text], { type:`text/${type === "txt" ? "plain" : type}` }) );
	a.download = name;
	a.click();
}

function getQuasarGalaxyNeighbors(){
	let i = prevCylOverIdx;
	let n = graphs.length;
	for(w=0;w<n;w++){
		if(i[w] != -1){
			let k = skewer[i[w]], //v = skewerData.get(k),
				p = projections[i[w]]; // load cache of this skewer
			quasar_galaxy_neighbors[w] = []
			quasar_galaxy_neighbors[w].push(skewerData.get(k))
			if(p){
				for (let j = 0; j < galaxies.length; ++j) {						
					let dist = p[j] // .distanceTo(galaxies[j].position)
					let u = galaxies[j];
					if (dist < distanceFromSkewer) { // filter, then map
						quasar_galaxy_neighbors[w].push(u)
					}
				}
			}
		}
	}
}

// EVENT HANDLERS
function onKeyDown(event) {

	var keyChar = String.fromCharCode(event.keyCode);
	
	//export an array to json file
	if( keyChar == 'D') {
		//exportData('galaxies.json',JSON.stringify(galaxies))
		getQuasarGalaxyNeighbors()
		exportData('quasar_galaxy_neighbors.json',JSON.stringify(quasar_galaxy_neighbors))
	}
	
	
	//store selected galaxy on bottom panel
	//does not allow duplicate galaxies
	if ( keyChar == 'G') {
		if(!selectedGalaxies.includes(currentGalaxy[1])){
			d3.select('#bottom-panel').selectAll('#imageSaveInstructions').remove()
			selectedGalaxies.push(currentGalaxy[1])
			trigger = true;
			plotGalaxyImage(currentGalaxy[1],trigger)
			trigger = false;
		}	
	}

	//toggles galaxies near skewers
	//same functionality as double clicking on slider circle
	else if ( keyChar == 'N') {
		loadAllP(toggleGalaxiesNearSkewers); // skewers, distanceFromSkewer
	}
	
	//toggle skewer visibility in 3D view
	else if ( keyChar  == 'S') {
		cylinderGroup.visible = !cylinderGroup.visible;
		cylinderBackGroup.visible = !cylinderBackGroup.visible;
	}

	//toggle text visibility in 3D view
	else if ( keyChar  == 'T') {
		textGroup.visible = !textGroup.visible;
	}	

	//on numerical key press, stores selected skewer to that graph
	else if ( keyChar == '1') {
		if(prevCylOverIdx[1] == -1){
			prevCylOverIdx[1] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[1] = -1
		}
		plotSkewerSpectra();
	}
	else if ( keyChar == '2') {
		if(prevCylOverIdx[2] == -1){
			prevCylOverIdx[2] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[2] = -1
		}
		plotSkewerSpectra();
	}
	else if ( keyChar == '3') {
		if(prevCylOverIdx[3] == -1){
			prevCylOverIdx[3] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[3] = -1
		}
		plotSkewerSpectra();	}
	else if ( keyChar == '4') {
		if(prevCylOverIdx[4] == -1){
			prevCylOverIdx[4] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[4] = -1
		}
		plotSkewerSpectra();	
	}		
	else if ( keyChar == '5') {
		if(prevCylOverIdx[5] == -1){
			prevCylOverIdx[5] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[5] = -1
		}
		plotSkewerSpectra();	
	}
	else if ( keyChar == '6') {
		if(prevCylOverIdx[6] == -1){
			prevCylOverIdx[6] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[6] = -1
		}
		plotSkewerSpectra();	
	}
	else if ( keyChar == '7') {
		if(prevCylOverIdx[7] == -1){
			prevCylOverIdx[7] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[7] = -1
		}
		plotSkewerSpectra();	
	}
	else if ( keyChar == '8') {
		if(prevCylOverIdx[8] == -1){
			prevCylOverIdx[8] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[8] = -1
		}
		plotSkewerSpectra();	
	}
	else if ( keyChar == '9') {
		if(prevCylOverIdx[9] == -1){
			prevCylOverIdx[9] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[9] = -1
		}
		plotSkewerSpectra();	
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
	
	//updates color of selected skewer neighbor (galaxy) to red when hovered over
	d3.selectAll('.mark')
		.on('mouseover', (j) => {
			d3.selectAll('.g'+pointOverIdx)
				.style('fill','red')
		})

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
	for(i=0;i<prevCylOverIdx.length;i++){
		if(cyl[i]){
			cyl[i] = cylinderGroup.children[prevCylOverIdx[i]]
			cyl[i].geometry.attributes.isSelected.set(Array(192).fill(1.0)) // OR, swap out material?
			cyl[i].geometry.attributes.isSelected.needsUpdate = true;
		}
	}
	cyl_0 = cylinderGroup.children[cylOverIdx]
	cyl_0.geometry.attributes.isSelected.set(Array(192).fill(1.0)) // OR, swap out material?
	cyl_0.geometry.attributes.isSelected.needsUpdate = true;
	
}
function unselectSkewer() {
	for(i=0;i<prevCylOverIdx.length;i++){
		if (cyl[i]) {
			cyl[i].geometry.attributes.isSelected.set(Array(192).fill(0.0))
			cyl[i].geometry.attributes.isSelected.needsUpdate = true;
		}
	}
	if(cyl_0){
		cyl_0.geometry.attributes.isSelected.set(Array(192).fill(0.0)) // OR, swap out material?
		cyl_0.geometry.attributes.isSelected.needsUpdate = true;
	}
}

function onMouseMove( event ) {
	if (!controls.enabled) return // disabled orbit also disables entity select

	// calculate mouse position in normalized device coordinates
	// (-1 to +1) for both components

	mouse.x = ( event.clientX / (window.innerWidth - columnWidth) ) * 2 - 1;
	mouse.y = - ( event.clientY / (window.innerHeight - 200) ) * 2 + 1;

	raycaster.setFromCamera( mouse, camera );

	// calculate objects intersecting the picking ray
	var intersects = raycaster.intersectObjects( scene.children );
	pointOverIdx = -1;

	for ( var i = 0; i < intersects.length; i++ ) {
		var p = intersects[ i ];

		// greedy fuzzy select?
		// adjust this when changing scale of the galaxies
		//if (p.object.type == "Points" && p.distanceToRay < 0.00009) {
		if (p.object.type == "Points" && p.distanceToRay < 0.4) {
			pointOverIdx = p.index;
			break;
		}
	}

	if (pointOverIdx >= 0 && pointOverIdx != prevPointOverIdx) {
		// mouse is over new point; show galaxy details
		selectPoint();
		plotSkewerSpectra();
		plotGalaxyImage(pointOverIdx); // fire once for each new hover
	}
	if (pointOverIdx < 0 && prevPointOverIdx >= 0) {
		// mouse isn't over a point anymore
		unselectPoint();
	}

	//intersect with skewers
	intersects = raycaster.intersectObjects( cylinderGroup.children );
	//checks to see if there is a skewer selected, which updates the first graph
	if (cylOverIdx != -1){
		prevCylOverIdx[0]=cylOverIdx
		plotSkewerSpectra()
	}
	cylOverIdx = -1;
	
	for ( var i = 0; i < intersects.length; i++ ) {
		var p = intersects[ i ];
		if ( cylinderGroup.visible == true && p.object.type == "Mesh") {
			cylOverIdx = cylinderGroup.children.indexOf(p.object) // recompute index to recover model object
		}
	}

	if (cylOverIdx > -1 && !prevCylOverIdx.includes(cylOverIdx)) {
		unselectSkewer()
		selectSkewer()
		plotSkewerSpectra();
	}
}

//initializes the graphs
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
			.attr('class','graph-background')
			.attr('x', 0).attr('y', 0)
			.attr('width', graphWidth).attr('height', graphHeight)
		if(i>0){	
			ret.append('text')
				.attr('class','graphNumber')
				.attr('x',-15).attr('y',0)
				.text(i)
			ret.append('text')
				.attr('class','skewerSaveInstructions')
				.attr('x',columnWidth/4).attr('y',100)
				.text('Press ' + (i) + ' to save selected skewer')
		}
		graphs[i] = ret;

	}
	createBrush()
	createSlider()
	return graphs
}


function plotSkewerSpectra() {
	i = prevCylOverIdx;
	
	let n = graphs.length;
	for(w=0;w<n;w++){
		if(!projections[i[w]]){
			loadP(i[w])
		}
		let graph = graphs[w];
		let k = skewer[i[w]],
			spectra = d3.entries(skewerData.get(k));
		let x = xScale(), y = yScale();

		if(i[w] == -1){
			graph.selectAll("graph" + w + "_border").remove()
			d3.select('#details').select('#graph' + w).selectAll('g').selectAll('.yaxis').remove();
			d3.select('#details').select('#graph' + w).selectAll('.xaxis').remove();
			d3.select('#details').select('#graph' + w).selectAll('.title').remove();
			d3.select('#details').select('#graph' + w).selectAll('#border').remove();
			graph.selectAll('.penHI').remove()
			graph.selectAll('.penCIV').remove()
			graph.selectAll('.mark').remove()
			graph.selectAll('.graphNumber').remove()
			graph.selectAll('.skewerSaveInstructions').remove()
			if(w>0){
				graph.append('text')
				.attr('class','graphNumber')
				.attr('x',-15).attr('y',0)
				.text(w)
			graph.append('text')
				.attr('class','skewerSaveInstructions')
				.attr('x',columnWidth/4).attr('y',100)
				.text('Press ' + (w) + ' to save selected skewer')
			}
			
		}
		if(i[w] != -1){
			if (pointOverIdx != -1) {
				let j = pointOverIdx,
					u = galaxies[j]
				}
				graph.selectAll("graph" + w + "_border").remove()
				d3.select('#details').select('#graph' + w).selectAll('g').selectAll('.yaxis').remove();
				d3.select('#details').select('#graph' + w).selectAll('.xaxis').remove();
				d3.select('#details').select('#graph' + w).selectAll('.title').remove();
				d3.select('#details').select('#graph' + w).selectAll('#border').remove();

				graph.selectAll('.graphNumber').remove()
				graph.selectAll('.skewerSaveInstructions').remove()
				graph.selectAll('.penHI').remove()
				graph.selectAll('.penCIV').remove()
				graph.selectAll('.skewerSaveInstructions').remove()

				

				let pen = d3.line()
					.x((d) => x(d.redshift))
					.y((d) => y(d.flux_norm))
					//.curve(d3.curveCardinal);
				spectra.forEach((u) => {
					graph.selectAll('.pen' + u.key).remove()
					graph.selectAll('#border').remove()
					graph.append('path')
						.attr('class', 'pen' + u.key)
						.datum(u.value)
						.attr('d', pen )
						//.attr('stroke', u.key == 'HI' ? '#f4eaff' : '#ffd6ce' )
						//.attr('stroke', u.key == 'HI' ? '#9aeab9' : '#9aeab9' )
						.attr('fill', 'none')
					graph.append('rect')
						.attr("id","border")
						.attr("transform","translate(-40,-20)")
						.attr("width",columnWidth+20)
						.attr("height",graphHeight)
						//.attr("style","stroke: #5b5b5b;stroke-width: 50; fill: none;")
					if(w>0){
						graph.append('text')
						.attr('class','graphNumber')
						.attr('x',-15).attr('y',0)
						.text(w)
					}
					let k = spectra.length - 4
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
							d3.select('#details').select('#graph' + w).selectAll('g').selectAll('.yaxis').remove();
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
	
	d3.select('#box-height').on('change', function(a){
		boxHeight = d3.select(this).property('value');
	})
	d3.select('#box-width').on('change', function(a){
		boxWidth = d3.select(this).property('value');
	})
	for(w=0;w<n;w++){
		let graph = graphs[w];
		if(i[w] != -1){
			let k = skewer[i[w]], //v = skewerData.get(k),
				 p = projections[i[w]]; // load cache of this skewer
			//quasar_galaxy_neighbors[w] = []
			//quasar_galaxy_neighbors[w].push(skewerData.get(k))
			graph.selectAll('.mark').remove()
			
			if(p){
				for (let j = 0; j < galaxies.length; ++j) {
				//let dist = p[j][2] // .distanceTo(galaxies[j].position)
				
				let dist = p[j] // .distanceTo(galaxies[j].position)
				let u = galaxies[j];
				// TODO: clean up this list by storing values in an array. Such as A[0] = 'dist' ...
				
				//if (dist < distanceFromSkewer / boxRadius && u.redshift < depthDomain[1] && u.redshift > depthDomain[0]) { // filter, then map
				if (dist < distanceFromSkewer) { // filter, then map
					let distAlong = u.redshift
					//quasar_galaxy_neighbors[w].push(galaxies[j])
					if(boxWidth == 'dist'){
						halfWidth = 10/(dist)
					}
					else if(boxWidth == 'rvir'){
						halfWidth = 10*u.rvir
					}
					else if(boxWidth == 'sfr'){
						halfWidth = 10*u.sfr
					}
					else if(boxWidth == 'mstars'){
						halfWidth = 2*u.mstars
					}
					else if(boxWidth == 'onePx'){
						halfWidth = 1
					}
					if(boxHeight == 'dist'){
						halfSize = 10/(dist)
					}
					else if(boxHeight == 'rvir'){
						halfSize = 10*u.rvir
					}
					else if(boxHeight == 'sfr'){
						halfSize = 10*u.sfr
					}
					else if(boxHeight == 'mstars'){
						halfSize = 2*u.mstars
					}
					
					//let halfWidth = u.rvir*2
					//let halfWidth = 10/(u.mstars)

					// if (pointOverIdx == j) // boxOfPoints and galaxies not aligned?

					graph.append('rect')
						.attr('class', 'mark g'+j)
						.attr('x', xScale()(distAlong) - (halfWidth/2))
						.attr('y', graphHeight/2 - halfSize)
						// yScale(u.absorptionData.HI.fluxNorm[i_]) - 5
						.attr('width', halfWidth)
						.attr('height', 2*halfSize)
						//.attr('fill', '#ffff00')
						//.attr('opacity', 1 / (30*dist + 1))
						//.attr('opacity', 1)
						.datum(j)
						.style('fill', (j) => {
							if(currentGalaxy[1] && currentGalaxy[1] == (j)){
								return('#ffaaaa')
							}
							if(selectedGalaxies.includes(j)){
								return('#aaaaff')
							}
						})
						/*.on('mouseover', (j) => {
							pointOverIdx = j
							selectPoint()
							plotSkewerSpectra()
							plotGalaxyImage()
						})*/
						.on('mouseover', (j) => {
							
							pointOverIdx = j //;
							selectPoint()
							//plotSkewerSpectra()
							plotGalaxyImage(pointOverIdx)
							plotSkewerSpectra() //make separate to update just neighbors
						})
						.on('mouseout', (j) =>{
							prevPointOverIdx = j
							unselectPoint()
						})

						
					}
				}
			}
		}
	}
}

function plotGalaxyImage(idx){

	var g = galaxies[idx]
	currentGalaxy = [g,idx];
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

	if(!trigger){
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
			//.attr('src', 'data/galaxyImages_partial/' + g.NSAID + '.jpg')
			.attr('src', 'data/galaxyImages/' + g.NSAID + '.jpg')
			.attr('width', '200px')
	}
	else{
		var txt = d3.select('#selectedGalaxies').append('div')
			.attr('id','galaxyDesc' + g.NSAID)
			.attr('class','galaxyQueue galaxyQueue-Desc')
		var svg = d3.select('#selectedGalaxies').append('div')
			.attr('id','galaxyImage' + g.NSAID)
			.attr('class','galaxyQueue')
		svg.append('img')
			.attr('src', 'data/galaxyImages/' + g.NSAID + '.jpg')
			.attr('height', '200px')
		txt.selectAll('p')
			.data(lines)
			.enter()
			.append('p')
			.style('width','150px')
			.text(d => d)
		$( "div#selectedGalaxies" ).scrollLeft( 0 );
		
	}
	d3.selectAll('.galaxyQueue')
		.on('mouseover', (p) => {
			pointOverIdx = p
			selectPoint()
			d3.selectAll('.g'+idx)
				.style('fill','red')
			var cs = boxOfPoints.geometry.attributes.isSelected.array;
				for (var p = 0; p < cs.length; p++) {
					cs[p] = 0.0;
				}
			cs[idx] = 1.0;
			prevPointOverIdx = idx;
			boxOfPoints.geometry.attributes.isSelected.needsUpdate = true;
		})
}

function createSlider(init = distanceFromSkewer) {
	let width = columnWidth - columnWidth/4,
		pad = 20
	d3.select('#details').selectAll('#neighbor-slider').remove();
	let svg = d3.select('#details').append('div').attr('id','neighbor-slider').append('svg')
	svg.attr('width', width + 80).attr('height', 30)

	svg.append('rect').attr('class', 'slider-track')
		.attr('x', pad).attr('y', 12.5)
		.attr('width', width - 2*pad).attr('height', 5)
		.style('fill', 'gray')

	let scale = d3.scaleLinear()
		.range([pad, width - pad])
		.domain([0.0, 10.0])
		.clamp(true);

	svg.append('text').attr('id', 'slider-value')
		.attr('x', width).attr('y', 17.5)
		.text(init + " Mpc")
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
				.text(roundtothree(value)+ " Mpc")

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
			loadAllP(toggleGalaxiesNearSkewers)
			svg.select('.slider-handle')
				.style('fill', () => filterDistantGalaxies ? 'black' : 'white')
		})
}

function createBrush() {
	// https://github.com/CreativeCodingLab/DynamicInfluenceNetworks/blob/master/src/js/focusSlider.js
	d3.select('#details').selectAll('#depth-brush').remove();
	let svg = d3.select('#details').append('div').attr('id','depth-brush').append('svg')

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
		var h = 60;

		var aspect = w / h;
		var vw = columnWidth;
		var vh = vw / aspect;

		width = vw;
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
	}
}


function processOptions(callback) {
	let parse = {
		'skewerData': (v) => {skewerFile = v},
		'galaxyData': (v) => {galaxyFile = v},
		'projectionData': (v) => {projectionData = v},
		'lookUpTable': (v) => {lookUpTable = v},
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

			//console.log(key, value)
			if (key in parse) parse[key](value)
		}
		callback();
	})
}

function sphericalToCartesian(RA,DEC,redshift) {
	//takes in phi (RA) and theta (DEC) in degrees
	var theta = RA * (Math.PI/180)
	var phi = DEC * (Math.PI/180)
	let r = lookUp(parseFloat(redshift))
	var sph_pos = new THREE.Spherical(r,phi,theta)
		//Spherical( radius : Float, phi POLAR : Float, theta EQUATOR : Float )
		//PHI AND THETA ARE SWAPPED (physics vs math notation)
	var x = sph_pos.radius*Math.cos(sph_pos.phi)*Math.sin(sph_pos.theta)
	var y = sph_pos.radius*Math.cos(sph_pos.phi)*Math.cos(sph_pos.theta)
	var z = sph_pos.radius*Math.sin(sph_pos.phi)
	var cartesian_position = new THREE.Vector3(x,y,z)
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

		var vertex = new THREE.Vector3(data[i].position.x,data[i].position.y,data[i].position.z)//.clone()
		//var vertex = data[i].position.clone()
		vertex.toArray( positions, i * 3 );

		colors[i] = u.color == "red" ? 0 :
					  u.color == "blue" ? 1 : 2
		// wasn't equality test b/c carriage returns vary (but d3 normalizes?)

		sizes[i] = u.rvir;
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
	for (let j = 0; j < galaxies.length; ++j) {		
		boxOfPoints.geometry.attributes.isVisible.array[ j ] = 0.0;				
		let dist = projections[j]
		if (dist < distanceFromSkewer) { // filter, then map
			boxOfPoints.geometry.attributes.isVisible.array[ j ] = 1.0;
		}
		boxOfPoints.geometry.attributes.isVisible.needsUpdate = true;
	}
}



	/*for (var g = 0; g < galaxies.length; g++)
		boxOfPoints.geometry.attributes.isVisible.array[ g ] = 0.0;

	for (var s = 0; s < skewer.length; s++) {
		let mask = projections[s]
					.map(v => v//v[2] // .distanceTo(galaxies[i].position)
									<= distanceFromSkewer ? 1 : 0);
									//<= distanceFromSkewer / boxRadius ? 1 : 0);
					// TODO: refactor
		for (var g = 0; g < galaxies.length; g++)
			if (mask[g])
				boxOfPoints.geometry.attributes.isVisible.array[ g ] = 1.0;
		boxOfPoints.geometry.attributes.isVisible.needsUpdate = true;
	}*/

function unfilterGalaxiesNearSkewers() {
	for (var g = 0; g < galaxies.length; g++)
		boxOfPoints.geometry.attributes.isVisible.array[ g ] = 1.0;
	boxOfPoints.geometry.attributes.isVisible.needsUpdate = true;
}

function loadAllP(callback){
	if(!allLoaded){
		allLoaded = true;
		for(n=0;n<skewer.length;n++){
			loadP(n)
		}
	}
	allLoaded = true;
	callback();
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
			textSize: 1,
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

function init() {
	renderer = new THREE.WebGLRenderer();
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth - columnWidth, window.innerHeight - 200 );


	camera = new THREE.PerspectiveCamera(
		50 /* fov */, (2*window.innerWidth/3) / (window.innerHeight - 200) /* aspect */,
		0.01 /* near */, 10000 /* far */ );
	controls = new THREE.OrbitControls( camera, renderer.domElement );
	camera.maxDistance = Infinity;

	scene = new THREE.Scene();

	cylinderGroup = new THREE.Group();
	cylinderBackGroup = new THREE.Group();
	textGroup = new THREE.Group();
	scene.add( cylinderGroup );
	scene.add( cylinderBackGroup );
	scene.add( textGroup );
	processOptions(() => {
		// need parameters to load first
			loadGalaxyData( () =>
				//loadSkewerData( computeProjections )); // need skewer and galaxy data before taking projections
				loadSkewerData()); // need skewer and galaxy data before taking projections
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
	canvas.height = window.innerHeight - 200;
	renderer.setSize( (window.innerWidth - columnWidth), window.innerHeight - 200 );
	camera.aspect = (window.innerWidth - columnWidth) / (window.innerHeight - 200);
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