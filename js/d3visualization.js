// This creates the d3 charts for the right menu screen
function createD3Menu(){
	// Define Margin
	var margin = {left: 40, right: 10, top: 50, bottom: 50 };
	var width =  (document.getElementById("D3menu").offsetWidth) - margin.left - margin.right;
	var height = (document.getElementById("D3menu").offsetHeight) - margin.top - margin.bottom;

	// Define SVG
	var svg = d3.select("#D3menu")
				.append("svg")
				.attr("width", width + margin.left + margin.right)
				.attr("height", height + margin.top + margin.bottom);
	var svgGroup = svg.append("g") // this defines a group within the svg
					.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

	// Create scales
	// These have temporary ranges and should be adjusted dynamically later based on data
	var xSkewerScale = d3.scaleLinear().range([0,width]);
	var ySkewerScale = d3.scaleLinear().range([height/2, 0]);

	// Define the x axis for the Skewer Line Chart
	var xAxisSkewer = d3.axisBottom()
						.scale(xSkewerScale);

	// Define the y axis for the Skewer Line Chart
	var yAxisSkewer = d3.axisLeft()
						.scale(ySkewerScale);


	// will produce a line value needed in path TEMP
	var line = d3.line()
				//.curve(d3.curveBasis) // makes the curve smooth instead of jagged
				.x(function(d){ return xSkewerScale(d.dist_frac); })
				.y(function(d){ return ySkewerScale(d.flux_norm); });

	// Here we will try to read in a skewer text file-------------------------------------------
	
	//create a space seperated parser
	var ssv = d3.dsvFormat(" ");

	// var output = ssv.parse("first last\nabe lincoln"); console.log(output[0]);

	var file = "data/spectra_HI_partial_norm/2MASS-J13250381+2717189__-0.134_0.031_0.511__-0.22_0.052_0.841.dat";
	function row(d){ // row conversion function used below
		return{
			x: +d.x,
			y: +d.y,
			z: +d.z,
			dist_scaled: +d.dist_scaled,
			dist_frac: +d.dist_frac,
			flux_norm: +d.flux_norm
		};
	}
	d3.request(file)
		.mimeType("text/plain")
		.response(function(xhr){ return ssv.parse(xhr.responseText, row) })
		.get(function(data){
			console.log("This is the retrieved data:");
			console.log(data);
			
			// Define scale domains based on the data
			xSkewerScale.domain([
							d3.min(data, function(d){ return d.dist_frac}),
							d3.max(data, function(d){ return d.dist_frac})
						]);
			ySkewerScale.domain([
							d3.min(data, function(d){ return d.flux_norm}),
							d3.max(data, function(d){ return d.flux_norm})
						]);

			// Create the x axis and y axis
			svgGroup.append("g")
					.attr("class", "xAxis")
					.attr("transform", "translate(0," + (height/2) + ")")
					.call(xAxisSkewer)
					.append("text")
					.attr("text-anchor", "middle")
					.attr("y",0)
					.attr("x", width/2)
					.attr("dx", "0em")
					.attr("dy", "2.5em")
					.attr("fill", "#000")
					.attr("font-size", "13px")
					.text("Dist_Frac");
			svgGroup.append("g")
					.attr("class", "yAxis")
					.call(yAxisSkewer)
					.append("text")
					.attr("transform", "rotate(-90)")
					.attr("text-anchor", "middle")
					.attr("y", 0 - (margin.left / 1.5))
					.attr("x", 0 - (height/4))
					.attr("fill", "#000")
					.attr("font-size", "13px")
					.text("Flux_Norm");


			// Define the Line Chart
			// This Line Chart Doesn't take into consideration the size of each segment on the skewer
			// It simply takes in the rows of data provided in the data skewer data file 
			// and plots every time there is a different flux_norm value
			svgGroup.append("path")
					.datum(data)
					.attr("class", "line")
					.attr("d", line)
					.style("stroke", function(d){ return "blue"; })
					.attr("fill", "none");
		});






}