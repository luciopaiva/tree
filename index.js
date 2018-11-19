
import * as Utils from "./utils.js";
import Vector from "./vector.js";
import Tree from "./tree.js";

const SCALING_FACTOR = 0.8;  // percentage of screen height
const BORDER_SIZE = 2;
const WIREFRAME_MODE = false;

class App {

    constructor () {
        this.branchesElem = document.getElementById("branches");
        this.segmentsElem = document.getElementById("segments");
        this.attractorsElem = document.getElementById("attractors");

        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d");
        document.body.appendChild(this.canvas);

        this.isRunning = true;
        this.isDebugging = true;
        this.wireframeMode = WIREFRAME_MODE;

        this.strokeColor = Utils.readCssVar("stroke-color");
        this.leafColors = Utils.loadCssColorPalette("leaf-color");
        this.woodColors = Utils.loadCssColorPalette("wood-color");

        this.tree = new Tree();
        this.aux = new Vector();

        window.addEventListener("keypress", this.keypress.bind(this));
        window.addEventListener("resize", this.resize.bind(this));
        this.resize();

        this.updateFn = this.update.bind(this);
        this.update(performance.now());

        setInterval(this.reportMetrics.bind(this), 100);
    }

    reportMetrics() {
        const branches = this.tree.branches;
        this.branchesElem.innerText = branches.length.toString();
        this.segmentsElem.innerText = branches.reduce((sum, branch) => sum + branch.segments.length, 0).toString();
        this.attractorsElem.innerText = this.tree.attractionPoints.length.toString();
    }

    keypress(event) {
        switch (event.key) {
            case " ": this.isRunning = !this.isRunning; break;
            case "n": this.update(performance.now(), true); break;
            case "d": this.isDebugging = !this.isDebugging; break;
            case "g": this.growTreeAtOnce(); break;
            case "w": this.wireframeMode = !this.wireframeMode; break;
        }
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.hw = this.width / 2;
        this.hh = this.height / 2;
        this.treeHalfHeight = this.tree.height / 2;
        const treeDimension = Math.max(this.tree.height, this.tree.width / 2);
        this.scaleY = Math.min(this.width, this.height) * SCALING_FACTOR / treeDimension;
        this.scaleX = this.scaleY / 2;
        this.canvas.setAttribute("width", this.width);
        this.canvas.setAttribute("height", this.height);
        if (!this.wireframeMode) {
            this.ctx.lineJoin = "round";
            this.ctx.lineCap = "round";
        }
    }

    modelToView(v, result) {
        result.x = this.hw + v.x * this.scaleX;          // x ranges from -1 (left) to +1 (right side of the tree)
        result.y = this.hh - (v.y - this.treeHalfHeight) * this.scaleY   // heights of tree points range from 0 to tree.height
    }

    growTreeAtOnce() {
        while (!this.tree.fullyGrown) {
            this.tree.update();
        }
    }

    updateModel() {
        this.tree.update();
    }

    drawGround() {
        this.ctx.strokeStyle = this.strokeColor;
        this.ctx.lineWidth = BORDER_SIZE;

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
        this.ctx.fillStyle = "red";
        for (const point of this.tree.attractionPoints) {
            this.modelToView(point.pos, aux);
            this.ctx.fillRect(aux.x - 1, aux.y - 1, 3, 3);
        }

        this.ctx.strokeStyle = "blue";
        this.ctx.lineWidth = 1;
        for (const branch of this.tree.branches) {
            const segments = branch.segments;
            for (const segment of segments) {
                for (const point of segment.attractionPoints) {
                    this.ctx.beginPath();
                    this.modelToView(point.pos, aux);
                    this.ctx.moveTo(aux.x, aux.y);
                    this.modelToView(segment.pos, aux);
                    this.ctx.lineTo(aux.x, aux.y);
                    this.ctx.stroke();
                }
            }
        }
    }

    doDrawBranches(fixedWidthToAdd) {
        for (const branch of this.tree.branches) {
            const segments = branch.segments;
            const aux = this.aux;
            this.modelToView(segments[0].pos, aux);
            this.ctx.beginPath();
            this.ctx.moveTo(aux.x, aux.y);
            for (let i = 1; i < segments.length; i++) {
                const point = segments[i].pos;
                this.modelToView(point, aux);
                this.ctx.lineWidth = this.wireframeMode ? 1 : this.scaleX * segments[i].width + fixedWidthToAdd;
                this.ctx.lineTo(aux.x, aux.y);

                this.ctx.stroke();
                this.ctx.beginPath();
                this.ctx.moveTo(aux.x, aux.y);
            }
            this.ctx.stroke();
        }
    }

    drawBranches() {
        if (!this.wireframeMode) {
            this.ctx.strokeStyle = this.strokeColor;
            this.doDrawBranches(BORDER_SIZE);
        }
        this.ctx.strokeStyle = this.woodColors[0];
        this.doDrawBranches(0);
    }

    update(now, force = false) {
        if (this.isRunning || force) {
            this.updateModel();

            this.ctx.clearRect(0, 0, this.width, this.height);

            this.drawBranches();
            if (this.isDebugging) {
                this.drawAttractionPoints();
            }
            this.drawGround();
        }

        if (!force) {
            requestAnimationFrame(this.updateFn);
        }
    }
}

new App();
