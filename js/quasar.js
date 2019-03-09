//QUASAR.JS

var z_d = loadLookUp()
loadCloseImpactLookUp()
var EW_coord = []; //redshift + flux
var EW_all = []
var z_left,z_right,z_abs, EW_selected, E_pressed;
var ferr = [];
var reds = [];
var waves = [];
var fluxes = [];
var EW_stat = 0;
var spec_wav = [];
var spec_flux = [];
var quasar_galaxy_EW_neighbors = []
var neighbors = []
var v = []

// instantiate once
var renderer, scene, camera, controls;
var gui, guiParams;

const target = new THREE.Vector2();

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
var galaxyRvirScalar = 1;
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
var col_m = new THREE.Vector2();

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
let n_skewers = 19; //sets the number of graphs available
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
var filterbyIP = false;



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

function updateDepthDomain(min, max){
	if(min != undefined){
		depthDomain[0] = min
	}
	if(max != undefined){
		depthDomain[1] = max
	}
	xScale = () => d3.scaleLinear().domain(depthDomain).range([0, columnWidth - 50])
}

function loadGalaxyData(callback) {
	//loadProjections()
	
	d3.json('data/galaxies_bigger.json').then(function(d){
		galaxies = d
		processGalaxyData(galaxies);
		//galaxies = data; // TODO: as new Map()
		callback();
	//}).then((data) => {
	});
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
	});*/
}


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

function loadCloseImpactLookUp(){
	d3.dsv(' ', 'data/galaxyCloseImpactLookup.dat').then(function(d){
		impactParameters = d
	})
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

function roundtofive(s, round = true) {
	let v = parseFloat(s)
	return round ? Math.round(100000 * v) / 100000.0 : v
}

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
				let path = 'data/spectra_' + el + '_norm_bigger/'
				d3.dsv(' ', path + file, (d) => {
					//console.log(d.sig_norm)
					return {
						'sig_norm': parseFloat(d.sig_norm),
						'flux_norm': parseFloat(d.flux_norm),
						'redshift': parseFloat(d.redshift),
						'wavelength': parseFloat(d.wavelength)
					}
				}).then( (data) => {
					if (data.length > 1) { // CATCH sentinel values
						skewerData.get(d.name)[el] = data // register to model
						skewer_redshift_min = skewerData.get(d.name)[el][0].redshift
						if (skewer_redshift_min < depthDomain[0] && skewer_redshift_min != undefined){
							updateDepthDomain(skewer_redshift_min, undefined)
							createBrush()
							createSlider()
						}
						skewer_redshift_max = skewerData.get(d.name)[el][skewerData.get(d.name)[el].length - 1].redshift
						if (skewer_redshift_max > depthDomain[1] && skewer_redshift_max != undefined){
							updateDepthDomain(undefined,skewer_redshift_max)
							createBrush()
							createSlider()
						}
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
	//https://www.movable-type.co.uk/scripts/latlong.html
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

//these functions are for getting values needed to plot EW


//### Transform wavelength into velocity space centered on some line
function veltrans(redshift,waves,line){
	let c = 299792.458
	let transline = []
    //if (line.isInteger() || isinstance(line,float)){

	let z_1 = math.add(redshift,1)
	let z_1l = math.multiply(z_1,line)
	let w_z_1l = math.subtract(waves,z_1l)
	let c_w = math.multiply(c,w_z_1l)
	let c_w_l = math.divide(c_w,line)

	if (!line.length){
		transline = math.divide(c_w_l,z_1)
		//transline =c*(waves-(1+redshift)*line)/line/(1+redshift)
		//console.log(transline)
	}
    else{
		for(ll=0;ll<line.length;ll++){
			transline.push(c*(waves[ll]-(1+redshift[ll])*ll)/ll/(1+redshift[ll]))
		}
	}
	//console.log(transline)
	return transline 
}

function EW_ACD_array(wave,flux,ferr,zabs,vellim=[-50,50],cont="None",restlam=1215.67,fosc=0.4164){

	/*			
    '''
    Returns arrays of equivalent width and apparent column density per pixel as
    well as their associated uncertainties due to continuum placement and flux errors.

    Parameters
    ----------
    wave: 1D float array
    flux: 1D float array
    ferr: 1D float array
        Error in flux
    zabs: float
        Redshift of the the absorption system
    vellim: 2-element list
        Lower and upper bounds over which to compute arrays
    cont: 1D float array, optional
        Continuum fitted to data
    restlam: float, optional
        Rest-frame wavelength of transition to measure
    fosc: float, optional
    	Oscillator strength of transition


    Returns
    -------
    EWpix: 1D float array
        Equivalent width in each pixel
    sigEWf: 1D float array
        EW uncertainty in each pixel due to flux errors
    Npix: 1D float array
        Apparent column density * dv (N) in each pixel
    sigNf: 1D float array
        Uncertainty in N due to flux errors
	'''
	*/

    //### Set atomic data and constants
    let c = 299792.458
    
    //### If not continuum provided, assume spectrum is normalized
    if(cont == "None"){
		cont = []
		for(i=0;i<wave.length;i++){
			cont.push(1)
		}
	}
	//console.log("cont: " + cont)
    //### Transform to velocity space
	let vel=veltrans(zabs,wave,restlam)
	//console.log('vel: ' + vel)
	let velidx = [];
	
	v[0] = wave[0] 
	v[1] = wave[wave.length-1]
	vellim = veltrans(zabs,v,restlam)
	//console.log(v)
	//console.log(vellim)
	for(i=0;i<vel.length;i++){
		if(vel[i]>=vellim[0] && vel[i]<=vellim[1]){
			velidx.push(i)
		}
	}
	
	//console.log("velidx: " + velidx)
	//let velup = vel[velidx[velidx.length - 1]]
	let velup = vel[velidx[1]]
	//console.log("velup: " +  velup)
	//let veldown = vel[velidx[0]]
	let veldown = vel[velidx[0]]
	//console.log("veldown: " +  veldown)
	let dv = Math.abs(velup-veldown)
	//console.log("dv: " + dv)

    //### Identify pixels where flux level is below noise level & replace w/noise
    let effflux = flux
	
	for(i=0;i<flux.length;i++){
		if(flux[i] < ferr[i]){
			belowerr = i
			i = flux.length
		}
		else{
			belowerr = -1
		}
	}
	
	//console.log("belowerr: " + belowerr)
	effflux[belowerr] = ferr[belowerr]
	//console.log(effflux[belowerr])

	//### Calculate EW and errors due to flux and continuum placement
	let EWpix = [];
	let sigEWf = [];
	let tauv = [];
	let tauverr_f = [];
/*
	console.log('LOOK HERE')
	console.log('dv :' + dv)
	console.log('velidx: ' + velidx)
	console.log('effflux: ' + effflux)
	console.log('cont: ' + cont)
	console.log('restlam: ' + restlam)
	console.log('c: ' + c)
	*/
	for(i=0;i<velidx.length;i++){
		let l = dv*(1-effflux[velidx[i]]/cont[velidx[i]])*restlam/c
		let m = dv / cont[velidx[i]] * ferr[velidx[i]] * restlam/c
		let n = math.log(cont[velidx[i]]/(effflux[velidx[i]]))
		let o = ferr[velidx[i]]/effflux[velidx[i]]
		EWpix.push(l)
		sigEWf.push(m)
		tauv.push(n)
		tauverr_f.push(o)
	}
	/*
	console.log(EWpix)
	console.log("EWpix: " +  EWpix)
	console.log("sigEWf: " +  sigEWf)
	console.log("tauv: " + tauv)
	console.log("tauverr_f" + tauverr_f)
	*/

    //### Calculate optical depth and uncertainty due to flux and continuum
	
	let Npix=math.multiply(1/(2.654e-15)/restlam/fosc*dv,tauv)
	//console.log("Npix: " + Npix)
    let sigNf = math.multiply(1./2.654e-15/restlam/fosc*dv,tauverr_f)
	//console.log("sigNf:" + sigNf)
	return [EWpix,sigEWf,Npix,sigNf]
}


function EW_ACD(wave,flux,ferr,zabs,vellim=[-50,50],cont="None",restlam=1215.67,fosc=0.4164){
    /*
    Calculates the equivalent width, apparent column density, and their
    associated errors a la Sembach & Savage 1992.
	If no continuum provided, assume spectrum is normalized*/
	
	if(cont == "None"){
		cont = []
		for(i=0;i<wave.length;i++){
			cont.push(1)
		}
	}

	//console.log(EW_ACD_array(wave,flux,ferr,zabs,vellim,cont,restlam,fosc))
	let EWarray = EW_ACD_array(wave,flux,ferr,zabs,vellim,cont,restlam,fosc)
	let EWpix = EWarray[0],
	sigEWf = EWarray[1],
	Npix = EWarray[2],
	sigNf = EWarray[3]
	/*
	console.log("EWpix: " + EWpix)
	console.log("sigEWf: " + sigEWf)
	console.log("Npix: " + Npix)
	console.log("sigNf: " + sigNf)
	*/
    // Totals and errors from each contribution
	let EW = math.sum(EWpix)
	//console.log(EW)
	//console.log("EW: " + EW)
    let N = math.sum(Npix)
	//console.log("N: " + N)

	let k = 0
	for(i=0;i<sigEWf.length;i++){
		k+=math.pow(sigEWf[i],2)
	}
	// Sum flux error contributions in quadrature
    let sigEWf_tot = math.sqrt(k)
	//console.log("sigEWf_tot: " + sigEWf_tot)
	k = 0
	for(i=0;i<sigNf.length;i++){
		k+=math.pow(sigNf[i],2)
	}
	let sigNf_tot = math.sqrt(k)
	//console.log("sigNf_tot: " + sigNf_tot)
	return [EW,sigEWf_tot,N,sigNf_tot]
}

function pressLeft(){
	z_left = EW_coord[0]
	//console.log("z_left: " + z_left)
	d3.select('body').select('#EW-plot').select('#EWplot').select('.EW-status').remove()
	d3.select('body').select('#EW-plot').select('#EWplot').append('text').attr('class','EW-status').text('left boundary ✓, press "E"')
}

function pressRight(){
	z_right = EW_coord[0]
	//console.log("z_right: " + z_right)
	d3.select('body').select('#EW-plot').select('#EWplot').select('.EW-status').remove()
	d3.select('body').select('#EW-plot').select('#EWplot').append('text').attr('class','EW-status').text('right boundary ✓, press "E"')
}

function selectZ(){
	z_abs = EW_coord[0]
	//console.log("z_abs: " + z_abs)
	d3.select('body').select('#EW-plot').select('#EWplot').select('.EW-status').remove()
	d3.select('body').select('#EW-plot').select('#EWplot').append('text').attr('class','EW-status').text('center point selected')
	getSkewerSpectra();
	d3.select('body').select('#EW-plot').select('#EWplot').select('.EW-status').remove()
	//d3.select('body').select('#EW-plot').select('#EWplot').append('text').attr('class','EW-status').text('Press "E" to start')	
}

function getSkewerSpectra(){
	let k = EW_selected[1]
	waves = [];
	fluxes = [];
	//console.log[k]
	for(i =0;i<k.length;i++){
		//if(k[i].key == "HI" || k[i].key == "CIV"){
		if(k[i].key == "HI"){
			let k_spec = k[i].value
			//console.log(k_spec)
			for(j=0;j<k_spec.length;j++){
				reds[j] = k_spec[j].redshift
			}
			var leftIdx = reds.indexOf(z_left)
			var rightIdx = reds.indexOf(z_right)
			//some spectra do not have the exact redshift value it is looking for
			//below it searches for the closest value in the vector
			if(rightIdx == -1){
				goal = z_right
				var closestR = reds.reduce(function(prev, curr) {
					return (Math.abs(curr - goal) < Math.abs(prev - goal) ? curr : prev);
				});
				rightIdx = reds.indexOf(closestR);
			}
			if(leftIdx == -1){
				goal = z_left
				var closestL = reds.reduce(function(prev, curr) {
					return (Math.abs(curr - goal) < Math.abs(prev - goal) ? curr : prev);
				});
				leftIdx = reds.indexOf(closestL);
			}
			//console.log(leftIdx,rightIdx)
			//below it is storing just the selected spectra wavelength and flux
			for(w=leftIdx;w<rightIdx;w++){
				waves.push(k_spec[w].wavelength)
				fluxes.push(k_spec[w].flux_norm)
				ferr.push(k_spec[w].sig_norm)
			}
			//console.log(reds, waves, fluxes, ferr)
		}
	}
	
	let EW_out = EW_ACD(waves,fluxes,ferr,z_abs,vellim=[-50,50],cont="None",restlam=1215.67,fosc=0.4164)
	//console.log(EW_out) // EW_out = [EW,sigEWf_tot,N,sigNf_tot]
	EW_all.push([EW_selected[0],EW_out[0],reds[leftIdx],reds[rightIdx],EW_out[1]])
	EW_plot();
}
function EW_plot_init(){
	d3.select('#bottom-panel').selectAll('#EW-plot').select('#EWplot').remove()
	let ret = d3.select('#bottom-panel').selectAll('#EW-plot').append('svg')
		.attr('id','EWplot')
		.attr("width", 208)
		.attr("height", 200)
		//.attr("transform", "translate(" + (window.innerWidth-columnWidth - 210) + ",0)")
		.style('fill', '#1d1d1d')
	ret.append('rect')
			.attr('x',0)
			.attr('y',0)
			.attr('width', 208)
			.attr('height', 200)
			.attr('fill', '#1d1d1d')
	if(EW_stat == 0){
		d3.select('body').select('#EW-plot').select('#EWplot').select('.EW-status').remove()
		d3.select('body').select('#EW-plot').select('#EWplot').append('text').attr('class','EW-status').text('Press "E" to start')
	}		
		
	EW_plot()
	/*d3.select('#bottom-panel').selectAll('#EW-plot').append('p')
		.attr('id','EWplotInstructions')
		.text('Equivalent Width Plot Instructions: <br/> Within the skewer panel... <br/> 1. Press "E" and select left boundary <br/> 2. Press "E" and select right boundary <br/>3. Press "E" and select center reference point')*/
}
function EW_plot(){
	neighbors = []
	for(i=0;i<EW_all.length;i++){
		let fnew = filterNeighborsEW(EW_all[i][1],EW_all[i][2],EW_all[i][3],EW_all[i][0],EW_all[i][4])
		//for(j=0; j< fnew.length; j++){
		if(fnew){
			neighbors.push(fnew)
		}
		 //in: zmin zmax skewername out: skewername nsaid impactparam
		//}
	}
	d3.select("body").select('#bottom-panel').select('#EW-plot').select('#EWplot').selectAll('g').remove()
	//var svg = d3.select("body").select('#bottom-panel').select('#EW-plot').select('#EWplot')
	var xScale = d3.scaleLinear()
		.domain([0,distanceFromSkewer])
		.range([0,150])
	var yScale = d3.scaleLinear()
		.domain([1.2,0])
		.range([0,130])
	var svg = d3.select("body").select('#bottom-panel').select('#EW-plot').select('#EWplot').append('svg')
		.append("g")
		.attr('transform','translate(45,180)')
	var tooltip = d3.select("body").append("div")
		.attr("class", "tooltip")
		.style("opacity", 0);
	var xAxis = d3.axisBottom()
		.scale(xScale)
		.ticks(6)
	// Y-axis
	var yAxis = d3.axisLeft()
		.scale(yScale)
		.ticks(5)
	svg.append("g")
		.attr("class","xAxis")
		.attr("transform","translate(0,-20)")
		.call(xAxis);
	svg.append("text")
		.text("Impact Parameter (Mpc)")
		.style("fill","white")
		.attr("font-size","11px")
		.attr("transform","translate(8,12)")
	svg.append("g")
		.attr("class","yAxis")
		.call(yAxis)
		.attr('transform','translate(0,-150)')
	svg.append("text")
		.text("Equivalent Width (Å)")
		.attr('transform','rotate(-90)')
		.attr("y", -30)
		.attr("x", 35)
		.style("fill", "white")
		.attr("font-size","11px")
	
	//add error line
	svg.append("g").selectAll("line")
		.data(neighbors).enter()
		.append("line")
		.attr("class", "error-line")
		.attr("x1", function(d) {
			return xScale(d.ip);
		})
		.attr("y1", function(d) {
			if(d.ew < 3*d.sigEWf){
				let ew = 3*d.sigEWf
				return yScale(ew-0.1)-150;
			}
			else{
				return yScale(d.ew + d.sigEWf)-150;
			}
		})
		.attr("x2", function(d) {
			return xScale(d.ip);
		})
		.attr("y2", function(d) {
			if(d.ew < 3* d.sigEWf){
				let ew = 3*d.sigEWf
				//return yScale(d.ew - ew)-170;
				return yScale(ew)-150;
			}
			else{
				return yScale(d.ew - d.sigEWf)-150;
			}
		})
		.attr('stroke',function(d){
			if (d.color == 'blue') {
				return ('#00aeff')	// blue
			} else {
				return('#ff0000')	// red
			}
			//return d.color
		})

		// Add Error Top Cap
	svg.append("g").selectAll("line")
		.data(neighbors).enter()
		.append("line")
		.attr("class", "error-cap")
		.attr("x1", function(d) {
			if(d.ew < 3*d.sigEWf){
			}
			else{
				return xScale(d.ip) - 4;
			}
		})
		.attr("y1", function(d) {
			if(d.ew < 3*d.sigEWf){
			}
			else{
				return yScale(d.ew + d.sigEWf)-150;
			}
		})
		.attr("x2", function(d) {
			if(d.ew < 3*d.sigEWf){
			}
			else{
				return xScale(d.ip) + 4;
			}
		})
		.attr("y2", function(d) {
			if(d.ew < 3* d.sigEWf){
				//let ew = 3*d.sigEWf
				//yScale(ew + d.sigEWf)-170;
			}
			else{
				return yScale(d.ew + d.sigEWf)-150;
			}
		})
		.attr('stroke',function(d){
			if (d.color == 'blue') {
				return ('#00aeff')	// blue
			} else {
				return('#ff0000')	// red
			}
		})
		
		// Add Error Bottom Cap
	svg.append("g").selectAll("line")
		.data(neighbors).enter()
		.append("line")
		.attr("class", "error-cap")
		.attr("x1", function(d) {
			return xScale(d.ip) - 4;
		})
		.attr("y1", function(d) {
			if(d.ew < 3* d.sigEWf){
				let ew = 3*d.sigEWf
				return yScale(ew - 0.1)-154;
			}
			else{
				return yScale(d.ew - d.sigEWf)-150;
			}
		})
		.attr("x2", function(d) {
			if(d.ew < 3* d.sigEWf){
				return xScale(d.ip);
			}
			else{
				return xScale(d.ip) + 4;
			}
		})
		.attr("y2", function(d) {
			if(d.ew < 3* d.sigEWf){
				let ew = 3*d.sigEWf
				return yScale(ew - 0.1)-150;
			}
			else{
				return yScale(d.ew - d.sigEWf)-150;
			}
		})
		.attr('stroke',function(d){
			if (d.color == 'blue') {
				return ('#00aeff')	// blue
			} else {
				return('#ff0000')	// red
			}
		})
			//console.log(neighbors)
			// setup x 
	
	svg.append("g").selectAll("line")
		.data(neighbors).enter()
		.append("line")
		.attr("class", "error-cap")
		.attr("x1", function(d) {
			if(d.ew < 3* d.sigEWf){
				return xScale(d.ip);
			}
		})
		.attr("y1", function(d) {
			if(d.ew < 3* d.sigEWf){
				let ew = 3*d.sigEWf
				return yScale(ew - 0.1)-150;
			}
		})
		.attr("x2", function(d) {
			if(d.ew < 3* d.sigEWf){
				return xScale(d.ip) + 4;
			}
		})
		.attr("y2", function(d) {
			if(d.ew < 3* d.sigEWf){
				let ew = 3*d.sigEWf
				return yScale(ew - 0.1)-154;
			}
		})
		.attr('stroke',function(d){
			if (d.color == 'blue') {
				return ('#00aeff')	// blue
			} else {
				return('#ff0000')	// red
			}
		})
	
	svg.selectAll(".dot")
        .data(neighbors)
		.enter().append("circle")
		.attr("class", "dot")
        .attr("r", 2)
        .attr("cx", function(d) {
            return xScale(d.ip);
		})
        .attr("cy", function(d) {
			if(d.ew < 3* d.sigEWf){
				return yScale(3*d.sigEWf)-150;
			}
            else return yScale(d.ew)-150;
		})
		.attr('fill',function(d){
			if (d.color == 'blue') {
				return ('#00aeff')	// blue
			} else {
				return('#ff0000')	// red
			}
		})
		.on("mouseover", function(d) {
			tooltip.transition()
				 .duration(200)
				 .style("opacity", 0.75);
			tooltip.html("QSO: " + d.skewer + "<br/> NSAID: " + d.NSAID + "<br/> IP: " + d.ip + " Mpc <br/> EW: " + roundtofive(d.ew) + " Å <br/> zmin: " + d.zmin + "<br/> zmax: " + d.zmax + "<br/> zabs: " + d.zabs + "<br/> velmin: " + d.velmin + " km/s <br/> velmax: " + d.velmax + "km/s")
				 .style("left", (d3.event.pageX - 25) + "px")
				 .style("top", (d3.event.pageY - 170) + "px")
			var g = galaxies[d.gidx]
			currentGalaxy = [g,d.gidx];
			plotGalaxyImage(d.gidx)
			plotSkewerNeighbors();
		})
		.on("mouseout", function(d) {
			tooltip.transition()
				 .duration(200)
				 .style("opacity", 0);
		});
}

function filterNeighborsEW(EW,z_min,z_max,skewerName,err){
	let mn = z_min
	let mx = z_max
	let i = skewer.indexOf(skewerName)
	/*console.log('z_min:' + mn)
	console.log('z_max:' + mx)
	console.log('skewer: ' + i)*/
	quasar_galaxy_EW_neighbors = []
	if(i != -1){
		let k = skewer[i], //v = skewerData.get(k),
			p = projections[i]; // load cache of this skewer
		if(p){
			for (let j = 0; j < galaxies.length; ++j) {						
				let dist = p[j] // .distanceTo(galaxies[j].position)
				let u = galaxies[j];
				if (dist < distanceFromSkewer && mn<u.redshift && mx>u.redshift) { // filter, then map
					var qgew = {
						'skewer': skewerName,
						'NSAID': u.NSAID,
						'zmin': z_min,
						'zmax': z_max,
						'ip': +dist[0],
						'ew': EW,
						'zabs': z_abs,
						'velmin': v[0],
						'velmax': v[1],
						'gidx': j,
						'color': u.color,
						'sigEWf':err
					}
					if(!quasar_galaxy_EW_neighbors.includes(qgew)){
						quasar_galaxy_EW_neighbors.push(qgew)
					}
				}
			}
		}
	}
	//console.log(qgew)
	let x;
	
	x = quasar_galaxy_EW_neighbors.sort(function(a, b){
		return a.ip-b.ip
	})
	//console.log(x[0])
	return x[0];
}

function mapKeyPressToActualCharacter(isShiftKey, characterCode) {
    if (typeof isShiftKey != "boolean" || typeof characterCode != "number") {
        return false;
    }

    if (isShiftKey) {
        return characterMapShift[characterCode];
    } else {
        return characterMap[characterCode];
    }
}


// EVENT HANDLERS
function onKeyDown(event) {
	
	var keyChar = String.fromCharCode(event.keyCode);
	var shiftKeyPressed = KeyboardEvent.shiftKey
	//export an array to json file
	if( keyChar == 'D') {
		//projections.empty
		//computeProjections()
		//for(i = 0, len = skewer.length; i < len; i++){
		//	exportData('p' + i + '.json',JSON.stringify(projections[i]))
		//}
		//exportData('galaxies_bigger.json',JSON.stringify(galaxies))
		/*getQuasarGalaxyNeighbors()
		exportData('quasar_galaxy_neighbors.json',JSON.stringify(quasar_galaxy_neighbors))*/
	}

	if( keyChar == 'E'){
		E_pressed = true;
		if(EW_stat == 0){
			d3.select('body').select('#EW-plot').select('#EWplot').select('.EW-status').remove()
			d3.select('body').select('#EW-plot').select('#EWplot').append('text').attr('class','EW-status').text('select left boundary')
		}
		if(EW_stat == 1){
			d3.select('body').select('#EW-plot').select('#EWplot').select('.EW-status').remove()
			d3.select('body').select('#EW-plot').select('#EWplot').append('text').attr('class','EW-status').text('select right boundary')
		}
		if(EW_stat == 2){
			d3.select('body').select('#EW-plot').select('#EWplot').select('.EW-status').remove()
			d3.select('body').select('#EW-plot').select('#EWplot').append('text').attr('class','EW-status').text('select center point')
		}
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

	else if ( keyChar  == 'Z') {
		zoomToGalaxy()	
	}	

	//on numerical key press, stores selected skewer to that graph
	
	if ( keyChar == '1' && !event.shiftKey) {
	
		if(prevCylOverIdx[1] == -1){
			prevCylOverIdx[1] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[1] = -1
			unselectSkewer();
		}
		plotSkewerSpectra();
	}
	else if ( keyChar == '2' && !event.shiftKey ) {
		if(prevCylOverIdx[2] == -1){
			prevCylOverIdx[2] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[2] = -1
			unselectSkewer();
		}
		plotSkewerSpectra();
	}
	else if ( keyChar == '3' && !event.shiftKey ) {
		if(prevCylOverIdx[3] == -1){
			prevCylOverIdx[3] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[3] = -1
			unselectSkewer();
		}
		plotSkewerSpectra();	}
	else if ( keyChar == '4' && !event.shiftKey ) {
		if(prevCylOverIdx[4] == -1){
			prevCylOverIdx[4] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[4] = -1
			unselectSkewer();
		}
		plotSkewerSpectra();	
	}		
	else if ( keyChar == '5' && !event.shiftKey ) {
		if(prevCylOverIdx[5] == -1){
			prevCylOverIdx[5] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[5] = -1
			unselectSkewer();
		}
		plotSkewerSpectra();	
	}
	else if ( keyChar == '6' && !event.shiftKey ) {
		if(prevCylOverIdx[6] == -1){
			prevCylOverIdx[6] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[6] = -1
			unselectSkewer();
		}
		plotSkewerSpectra();	
	}
	else if ( keyChar == '7' && !event.shiftKey ) {
		if(prevCylOverIdx[7] == -1){
			prevCylOverIdx[7] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[7] = -1
			unselectSkewer();
		}
		plotSkewerSpectra();	
	}
	else if ( keyChar == '8' && !event.shiftKey ) {
		if(prevCylOverIdx[8] == -1){
			prevCylOverIdx[8] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[8] = -1
			unselectSkewer();
		}
		plotSkewerSpectra();	
	}
	else if ( keyChar == '9' && !event.shiftKey ) {
		if(prevCylOverIdx[9] == -1){
			prevCylOverIdx[9] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[9] = -1
			unselectSkewer();
		}
		plotSkewerSpectra();	
	}
	else if ( keyChar == '1' && event.shiftKey  ) {

		if(prevCylOverIdx[10] == -1){
			prevCylOverIdx[10] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[10] = -1
			unselectSkewer();
		}
		plotSkewerSpectra();
	}
	else if ( keyChar == '2' && event.shiftKey   ) {
		if(prevCylOverIdx[11] == -1){
			prevCylOverIdx[11] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[11] = -1
			unselectSkewer();
		}
		plotSkewerSpectra();
	}
	else if ( keyChar == '3' && event.shiftKey   ) {
		if(prevCylOverIdx[12] == -1){
			prevCylOverIdx[12] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[12] = -1
			unselectSkewer();
		}
		plotSkewerSpectra();
	}
	else if ( keyChar == '4'  && event.shiftKey  ) {
		if(prevCylOverIdx[13] == -1){
			prevCylOverIdx[13] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[13] = -1
			unselectSkewer();
		}
		plotSkewerSpectra();	
	}		
	else if ( keyChar == '5' && event.shiftKey   ) {
		if(prevCylOverIdx[14] == -1){
			prevCylOverIdx[14] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[14] = -1
			unselectSkewer();
		}
		plotSkewerSpectra();	
	}
	else if ( keyChar == '6' && event.shiftKey   ) {
		if(prevCylOverIdx[15] == -1){
			prevCylOverIdx[15] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[15] = -1
			unselectSkewer();
		}
		plotSkewerSpectra();	
	}
	else if ( keyChar == '7' && event.shiftKey   ) {
		if(prevCylOverIdx[16] == -1){
			prevCylOverIdx[16] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[16] = -1
			unselectSkewer();
		}
		plotSkewerSpectra();	
	}
	else if ( keyChar == '8' && event.shiftKey   ) {
		if(prevCylOverIdx[17] == -1){
			prevCylOverIdx[17] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[17] = -1
			unselectSkewer();
		}
		plotSkewerSpectra();	
	}
	else if ( keyChar == '9' && event.shiftKey   ) {
		if(prevCylOverIdx[18] == -1){
			prevCylOverIdx[18] = prevCylOverIdx[0];
		}
		else{
			prevCylOverIdx[18] = -1
			unselectSkewer();
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

	plotGalaxyImage(pointOverIdx)
	
	//updates color of selected skewer neighbor (galaxy) to red when hovered over
	/*
	d3.selectAll('.mark')
		.on('mouseover', (j) => {
			d3.selectAll('.g'+pointOverIdx)
				.style('fill','red')
		})
*/
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
	if(cylOverIdx != -1){
		cyl_0 = cylinderGroup.children[cylOverIdx]
		cyl_0.geometry.attributes.isSelected.set(Array(192).fill(1.0)) // OR, swap out material?
		cyl_0.geometry.attributes.isSelected.needsUpdate = true;
	}
	else if(prevCylOverIdx[0] != -1){
		cyl_0 = cylinderGroup.children[prevCylOverIdx[0]]
		cyl_0.geometry.attributes.isSelected.set(Array(192).fill(1.0)) // OR, swap out material?
		cyl_0.geometry.attributes.isSelected.needsUpdate = true;
	}
	for(i=1;i<prevCylOverIdx.length;i++){
		if(prevCylOverIdx[i] != -1){
			cyl[i] = cylinderGroup.children[prevCylOverIdx[i]]
			cyl[i].geometry.attributes.isSelected.set(Array(192).fill(1.0)) // OR, swap out material?
			cyl[i].geometry.attributes.isSelected.needsUpdate = true;
		}
		
	}
}
function unselectSkewer() {
	for(i=1;i<prevCylOverIdx.length;i++){
		if (cyl[i] && prevCylOverIdx[i] == -1) {
			cyl[i].geometry.attributes.isSelected.set(Array(192).fill(0.0))
			cyl[i].geometry.attributes.isSelected.needsUpdate = true;
		}
	}
	if(cyl_0){
		cyl_0.geometry.attributes.isSelected.set(Array(192).fill(0.0)) // OR, swap out material?
		cyl_0.geometry.attributes.isSelected.needsUpdate = true;
	}
	if(cylOverIdx != -1){
		cyl_0 = cylinderGroup.children[cylOverIdx]
		cyl_0.geometry.attributes.isSelected.set(Array(192).fill(1.0)) // OR, swap out material?
		cyl_0.geometry.attributes.isSelected.needsUpdate = true;
	}
}

function onMouseMove( event ) {
	//if (!controls.enabled) return // disabled orbit also disables entity select
	//console.log(event.target)
	let x = event.clientX
	let y = event.clientY
	//console.log(x,y)
	//col_m.x = ( x / (window.innerWidth) ) * 2 - 1;
	//col_m.y = - ( y / (window.innerHeight) ) * 2 + 1;
	// calculate mouse position in normalized device coordinates
	// (-1 to +1) for both components

	mouse.x = ( x / (window.innerWidth - columnWidth) ) * 2 - 1;
	mouse.y = - ( y / (window.innerHeight - 200) ) * 2 + 1;
	//console.log(col_m)

	raycaster.setFromCamera( mouse, camera );


	if(mouse.y>-1 && mouse.x<1){
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
			let skewIdx = i[w]
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
					graph.selectAll('.pen' + u.key + 'invis').remove()
					graph.selectAll('#border').remove()
					if(u.key == "HI" || u.key == "CIV"){
						var path = graph.append('path')
							.attr('class', 'pen' + u.key)
							.datum(u.value)
							.attr('d', pen )
							.attr('fill', 'none')
						var path = graph.append('path')
							.attr('class', 'pen' + u.key + 'invis')
							.datum(u.value)
							.attr('d', pen )
							.attr('fill', 'none')
							.on('click', function() {
								var x0 = x.invert(d3.mouse(this)[0]),
								y0 = y.invert(d3.mouse(this)[1])
								EW_coord = [roundtofive(x0),roundtofive(y0)] //[redshift, flux_norm]
								//i = d3.bisect(data, x0, 1),
								//d0 = path[i - 1],
								//d1 = path[i]
								//console.log(x0,y0,i,d0,d1)
								
								//d = x0 - d0.date > d1.date - x0 ? d1 : d0;
								if(E_pressed && u.key == "HI"){
									EW_selected = [skewer[skewIdx],spectra]
									//console.log(EW_selected)
									//console.log(x0,y0)
									//console.log(EW_stat)
									if(EW_stat == 0){ //means E has not been pressed yet
										pressLeft();
										EW_stat = 1;
										E_pressed = false;
									}
									else if(EW_stat == 1){ //means E has been pressed once (left edge selected)
										pressRight();
										EW_stat = 2;
										E_pressed = false;
									}
									else if(EW_stat == 2){ //means E has been pressed twice (right edge selected)
										EW_stat = 0;
										E_pressed = false;
										selectZ();
									}
								}
								
							})
					}
					graph.append('rect')
						.attr("id","border")
						.attr("transform","translate(-40,-20)")
						.attr("width",columnWidth+20)
						.attr("height",graphHeight+50)
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
							graph.selectAll('.penHI').attr("transform","translate(0," + graphHeight/8 + ")")
							graph.selectAll('.penHIinvis').attr("transform","translate(0," + graphHeight/8 + ")")
							graph.selectAll('.penCIV').attr("transform","translate(0," + (-1)*graphHeight/3 + ")")
							graph.selectAll('.penCIVinvis').attr("transform","translate(0," + (-1)*graphHeight/3 + ")")
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
	unselectSkewer()
	selectSkewer()
	plotSkewerNeighbors();
}
function plotSkewerNeighbors() {
	let i = prevCylOverIdx;
	let n = graphs.length;
	
	d3.select('#box-height').on('change', function(a){
		boxHeight = d3.select(this).property('value');
		plotSkewerNeighbors()
	})
	d3.select('#box-width').on('change', function(a){
		boxWidth = d3.select(this).property('value');
		plotSkewerNeighbors()
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
						halfWidth = 2
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
						.attr('opacity', .85)
						.datum(j)
						.style('fill', (j) => {
							if(currentGalaxy[1] && currentGalaxy[1] == (j)){
								return('#00ff00')	//  green
							}
							if(selectedGalaxies.includes(j)){
								if (galaxies[j].color == 'blue') {
									return ('#00aeff')	// blue
								} else {
									return('#ff0000')	// red
								}
							}
						})
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
	let j = idx
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
			.attr('src', 'data/galaxyImages/' + g.NSAID + '.jpg')
			//.attr('src', 'data/galaxyImages/' + g.NSAID + '.jpg')
			.attr('width', '160px')
			.on('mouseover', (j) => {			
				pointOverIdx = idx //;
				selectPoint()
				plotSkewerNeighbors()
			})
			.on('mouseout', (j) =>{
				prevPointOverIdx = idx
				unselectPoint()
			})
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
			.attr('height', '160px')
			.attr('padding', '10px')
			.on('mouseover', (j) => {
				pointOverIdx = j //;
				selectPoint()
				
			})
			.on('mouseout', (j) =>{
				prevPointOverIdx = j
				unselectPoint()
			})
			/*.on('click', (j) =>{
				//want to move camera to position of galaxy
				camera.position = galaxies[pointOverIdx].position
				camera.Translate(0, 0, -r);
				camera.needsUpdate = true
			})*/
		txt.selectAll('p')
			.data(lines)
			.enter()
			.append('p')
			.style('width','150px')
			.text(d => d)
		svg.selectAll('img')
			.on('mouseover', (j) => {
				pointOverIdx = idx //;
				let m = galaxies[idx]
				currentGalaxy = [m,idx];
				plotSkewerNeighbors()
				selectPoint()
			})
			.on('mouseout', (j) =>{
				prevPointOverIdx = idx
				unselectPoint()
			})
		//$( "div#selectedGalaxies" ).scrollLeft( 0 );
		$( "div#selectedGalaxies" ).animate({scrollLeft:  '0' }, 400);
	}
	/*d3.selectAll('.galaxyQueue')
		.on('mouseover', (p) => {
			pointOverIdx = idx
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
		})*/
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
			EW_plot();
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
			.call(d3.axisBottom(x).ticks(6))

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
			
			updateDepthDomain(ret[0],ret[1])

			if (prevCylOverIdx[0] !== -1 && prevCylOverIdx[0] !== -1) {
				plotSkewerSpectra()
				plotSkewerNeighbors()
			}

			filterBrushedGalaxies()

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
			//controls.noZoom = true;
			controls.enableZoom = false;
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

function zoomToGalaxy(){
	pos = currentGalaxy[0]
	poss = sphericalToCartesian(pos.RA,pos.DEC,pos.redshift*0.9)
	camera.position.set(poss.x,poss.y,poss.z)
	camera.lookAt(pos.position.x,pos.position.y,pos.position.z)
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
			//color:     { value: new THREE.Color( 0xffffff ) },
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

function filterBrushedGalaxies() {
	if (filterbyIP == true){
		for (let j = 0; j < impactParameters.length; ++j) {				
			let dist = impactParameters[j].smallestImpact/1000
			if (dist < distanceFromSkewer && galaxies[j].redshift > depthDomain[0] && galaxies[j].redshift < depthDomain[1]) { // filter, then map
				boxOfPoints.geometry.attributes.isVisible.array[ j ] = 1.0;
			}
			else{
				boxOfPoints.geometry.attributes.isVisible.array[ j ] = 0.0;	
			}
			boxOfPoints.geometry.attributes.isVisible.needsUpdate = true;
		}
	}
	
	else{
		for (i = 0; i < galaxies.length; i ++) {
			if ( galaxies[i].redshift >  depthDomain[0] && galaxies[i].redshift < depthDomain[1]) {
				boxOfPoints.geometry.attributes.isVisible.array[ i ] = 1.0;
			}
			else {
				boxOfPoints.geometry.attributes.isVisible.array[ i ] = 0.0;
			}
			boxOfPoints.geometry.attributes.isVisible.needsUpdate = true;
		}
	}
	
}

function filterGalaxiesNearSkewers() {
	//turn off all stars, then go through the selected skewers and turn on ones that < maxDistance from it
	filterbyIP = true
	for (let j = 0, len = impactParameters.length; j < len; ++j) {		
					
		let dist = impactParameters[j].smallestImpact/1000
		if (dist < distanceFromSkewer && galaxies[j].redshift > depthDomain[0] && galaxies[j].redshift < depthDomain[1]) { // filter, then map
			boxOfPoints.geometry.attributes.isVisible.array[ j ] = 1.0;
		}
		else{
			boxOfPoints.geometry.attributes.isVisible.array[ j ] = 0.0;	
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
	filterbyIP = false
	for (var g = 0, len = galaxies.length; g < len; g++)
		boxOfPoints.geometry.attributes.isVisible.array[ g ] = 1.0;
	boxOfPoints.geometry.attributes.isVisible.needsUpdate = true;
}

function loadAllP(callback){
	if(!allLoaded){
		allLoaded = true;
		for(n=0, len = skewer.length;n<len;n++){
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
	if (galaxy_redshift_min < depthDomain[0]){
		depthDomain[0] = galaxy_redshift_min
	}
	galaxy_redshift_max = galaxies.reduce((max, p) => p.redshift > max ? p.redshift : max, galaxies[0].redshift)
	if (galaxy_redshift_max > depthDomain[1]){
		depthDomain[1] = galaxy_redshift_max
	}
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
			textSize: 0.5,
			redrawInterval: 250,
			texture: {
				text: name,
				fontFamily: 'Karla, Avenir, monospace, Arial, Helvetica, sans-serif',
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
	renderer.antialias = true;
	//renderer.logarithmicDepthBuffer = true
	//renderer.setClearColor (0x333333, 0.1);
	camera = new THREE.PerspectiveCamera(
		54 /* fov */, (window.innerWidth - columnWidth) / (window.innerHeight - 200) /* aspect */,
		0.01 /* near */, 10000 /* far */ );
	controls = new THREE.OrbitControls( camera, renderer.domElement );
	controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
	//controls.autoRotate = false;
	controls.maxAzimuthAngle = Infinity;
	controls.maxPolarAngle = Infinity;
	controls.dampingFactor = 0.4;
	
	camera.maxDistance = Infinity;

	scene = new THREE.Scene();
	//scene.fog = new THREE.FogExp2( 0xcccccc, 0.02 );
	scene.background = new THREE.Color( 0x050505 );

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
	createBrush()
	createSlider()
	//depthDomain = [galaxies.red, .029]; 

	window.addEventListener( 'resize', onWindowResize, false );
	document.addEventListener( 'mousemove', onMouseMove, false );
	window.addEventListener( 'wheel', onMouseWheel, false );
	document.addEventListener( 'keydown', onKeyDown, false );
	var container = document.getElementById( 'container' );
	container.appendChild( renderer.domElement );
	EW_plot_init()
}


function onMouseWheel(event){
	let x = event.clientX
	let y = event.clientY
	
	mouse.x = ( x / (window.innerWidth - columnWidth) ) * 2 - 1;
	mouse.y = - ( y / (window.innerHeight - 200) ) * 2 + 1;
	if(mouse.y>-1 && mouse.x < 1){
		var factor = 4;
		//var mX = (event.clientX / jQuery(container).width()) * 2 - 1;
		//var mY = -(event.clientY / jQuery(container).height()) * 2 + 1;

		//var vector = new THREE.Vector3(mX, mY, 0.1);
		var vector = new THREE.Vector3(mouse.x, mouse.y, 1);
		vector.unproject(camera);
		vector.sub(camera.position);
		if (event.deltaY < 0) {
			camera.position.addVectors(camera.position, vector.setLength(factor));
			controls.target.addVectors(controls.target, vector.setLength(factor));
		} else {
			camera.position.subVectors(camera.position, vector.setLength(factor));
			controls.target.subVectors(controls.target, vector.setLength(factor));
		}
	}

		//camera.position.z += event.deltaY * 0.1;
	//camera.lookAt(mouse.x,mouse.y,camera.position.z)
}

//Creates a gui using the dat.gui library
function displayGui(){
	gui = new dat.GUI( {width: (columnWidth/2)} );
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
		//skewerWidth: skewerWidth,
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
	//var skewerWidthChange = skewerFolder.add(guiParams, "skewerWidth", 0.0, 0.5).step(0.01).name("Width");
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
		for(var i = 0, len = cylinderGroup.children.length; i< len; i++){
			createAbsorptionDataTexture(skewer[i]);
		}
	});

	/*skewerWidthChange.onChange(function(value){
		skewerWidth = value;
	});*/

	skewerMaxAbs.onChange(function(value){
		skewerAbsorptionMaxHSL = "rgb("+Math.round(value[0])+", "+Math.round(value[1])+", "+Math.round(value[2])+")";
		//console.log(skewerAbsorptionMaxHSL);
		for(var i = 0, len = cylinderGroup.children.length; i< len; i++){
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
	EW_plot_init()
	EW_plot()


}

function animate() {
	target.x = ( 1 - mouse.x ) * 0.002;
	target.y = ( 1 - mouse.y ) * 0.002;
	
	camera.rotation.x += 0.05 * ( target.y - camera.rotation.x );
	camera.rotation.y += 0.05 * ( target.x - camera.rotation.y );
	requestAnimationFrame( animate );
	controls.update();
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

			//var ar = absorptionData[i];
			var lerpVal;

			//colorVal.setHSL(minHSL.h, minHSL.s, 0.2);

			
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
