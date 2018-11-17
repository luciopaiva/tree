
import * as Utils from "./utils.js";
import Vector from "./vector.js";
import Tree from "./tree.js";

const SCALING_FACTOR = 0.3;
const TRUNK_BASE_WIDTH = 90;
const BORDER_SIZE_FACTOR = 0.08;

class App {

    constructor () {
        this.nodesElem = document.getElementById("nodes");

        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d");
        document.body.appendChild(this.canvas);

        this.isRunning = true;

        window.addEventListener("keypress", this.keypress.bind(this));
        window.addEventListener("resize", this.resize.bind(this));
        this.resize();

        this.strokeColor = Utils.readCssVar("stroke-color");
        this.leafColors = Utils.loadCssColorPalette("leaf-color");
        this.woodColors = Utils.loadCssColorPalette("wood-color");

        this.tree = new Tree();
        this.aux = new Vector();

        this.updateFn = this.update.bind(this);
        this.update(performance.now());

        setInterval(this.reportMetrics.bind(this), 100);
    }

    reportMetrics() {
        this.nodesElem.innerText = this.tree.trunk.segments.length.toString();
    }

    keypress(event) {
        switch (event.key) {
            case " ": this.isRunning = !this.isRunning; break;
        }
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.hw = this.width / 2;
        this.hh = this.height / 2;
        this.scaleX = Math.min(this.width, this.height) * SCALING_FACTOR;
        this.scaleY = Math.min(this.width, this.height) * SCALING_FACTOR * 2;
        this.canvas.setAttribute("width", this.width);
        this.canvas.setAttribute("height", this.height);
        this.ctx.lineJoin = "round";
        this.ctx.lineCap = "round";
    }

    modelToView(v, result) {
        result.x = this.hw + v.x * this.scaleX;          // x ranges from -1 (left) to +1 (right side of the tree)
        result.y = this.hh - (v.y - 0.5) * this.scaleY;  // heights of tree points range from 0 to 1
    }

    updateModel() {
        this.tree.update();
    }

    drawGround() {
        this.ctx.strokeStyle = this.strokeColor;
        this.ctx.lineWidth = TRUNK_BASE_WIDTH * BORDER_SIZE_FACTOR;

        this.ctx.beginPath();

        const aux = this.aux;
        aux.y = 0;
        aux.x = -1;
        this.modelToView(aux, aux);
        this.ctx.moveTo(aux.x, aux.y);
        aux.y = 0;
        aux.x = 1;
        this.modelToView(aux, aux);
        this.ctx.lineTo(aux.x, aux.y);

        this.ctx.stroke();
        // erase everything below ground level
        this.ctx.clearRect(0, aux.y, this.width, this.height - aux.y);
    }

    drawAttractionPoints() {
        const aux = this.aux;
        this.ctx.fillStyle = "white";
        for (const point of this.tree.attractionPoints) {
            this.modelToView(point, aux);
            this.ctx.fillRect(aux.x - 1, aux.y - 1, 3, 3);
        }
    }

    doDrawTrunk(baseWidth, fixedWidth) {
        const aux = this.aux;
        this.modelToView(this.tree.trunk.segments[0].pos, aux);
        this.ctx.beginPath();
        this.ctx.moveTo(aux.x, aux.y);
        for (let i = 1; i < this.tree.trunk.segments.length; i++) {
            const point = this.tree.trunk.segments[i].pos;
            this.modelToView(point, aux);
            this.ctx.lineWidth = baseWidth * this.tree.trunk.segments[i].width + fixedWidth;
            this.ctx.lineTo(aux.x, aux.y);

            this.ctx.stroke();
            this.ctx.beginPath();
            this.ctx.moveTo(aux.x, aux.y);
        }
        this.ctx.stroke();
    }

    drawTrunk() {
        this.ctx.strokeStyle = this.strokeColor;
        this.doDrawTrunk(TRUNK_BASE_WIDTH, TRUNK_BASE_WIDTH * BORDER_SIZE_FACTOR);
        this.ctx.strokeStyle = this.woodColors[0];
        this.doDrawTrunk(TRUNK_BASE_WIDTH * (1 - BORDER_SIZE_FACTOR), 0);
    }

    update() {
        if (this.isRunning) {
            this.updateModel();

            this.ctx.clearRect(0, 0, this.width, this.height);

            this.drawAttractionPoints();
            this.drawTrunk();
            this.drawGround();
        }

        requestAnimationFrame(this.updateFn);
    }
}

new App();
