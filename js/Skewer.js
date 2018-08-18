class Skewer {
	constructor(name, startPoint, endPoint) {
		this.name = name;
		this.startPoint = startPoint; //THREE.Vector3
		this.endPoint = endPoint; //THREE.Vector3

		this.absorptionData = {}; // expect dict of list of x/y pairs
		this.isVisible = true;
	}

	attach(spectrum, data) {
		this.absorptionData[spectrum] = data
	}
}

