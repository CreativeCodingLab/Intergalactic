class Skewer {
	constructor(name, startPoint, endPoint, data) {
		this.name = name;
		this.startPoint = startPoint; //THREE.Vector3
		this.endPoint = endPoint; //THREE.Vector3
		this.absorptionData = data; // expect list of ~529 tuples
		this.isVisible = true;
	}
}

