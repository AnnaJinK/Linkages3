/*
 * This file contains all the UI state transitions and behaviors. Unfortunately,
 * since state transitions are inherently circular, this file cannot easily be
 * broken up into separate files because the CommonJS require system has zero
 * tolerance for circular references. To solve this, we'd need to add our own
 * require or registrar system on top of CommonJS. I'll tackle that when this
 * file reaches 1000 lines or so.
 */
'use strict';

var Linkage = require('../Linkage');
var LinkageRenderer = require('../graphics/LinkageRenderer');
var LinkageOptObj = require('../optimize/LinkageOptObj');
var KEYS = require('./KEYS');

var mixinPointValidation = require('./mixinPointValidation');
var optimizeStep = require('../optimize/optimizeStep');

var MAX_TRACE_POINTS = 100;

type Point = {x: number; y: number};
type StateSpec = {
  p0id?: string;
  p1id?: string;
  pointA?: Point;
  pointB?: Point;
};

type MouseInfo = {
  mousePoint: Point;
  p0id?: string;
  p1id?: string;
};

var PREVIEW_OPTIONS = {
  lineColor: 'pink',
  pointColor: 'red',
  drawPoints: true,
};

var TRACE_OPTIONS = {
  lineColor: 'pink',
  pointColor: 'red',
  drawPoints: false,
};

var OPTIMIZE_PATH_OPTIONS = {
  lineColor: 'hotPink',
  pointColor: 'magenta',
  drawPoints: false,
};

class BaseState {
  static getInitialUnpausedState(linkage: Linkage) {
    return new UnpausedState(linkage);
  }

  static getInitialPausedState(linkage: Linkage) {
    return new State0(linkage);
  }

  linkage: Linkage;
  p0id: ?string;
  p1id: ?string;
  pointA: ?Point;
  pointB: ?Point;

  constructor(linkage: Linkage, spec?: ?StateSpec) {
    //console.log(this.constructor);
    this.linkage = linkage;

    if (spec) {
      this.p0id = spec.p0id;
      this.p1id = spec.p1id;
      this.pointA = spec.pointA;
      this.pointB = spec.pointB;
    }
  }

  draw(renderer: LinkageRenderer, mouseInfo: MouseInfo): void {
    renderer.drawLinkage({
      positions: this.linkage.positions,
      points: this.linkage.spec.points,
    });
  }

  // Basic handlers
  onMouseDrag(mousePoint: Point): ?BaseState {}
  onMouseDown(): ?BaseState {}
  onMouseUp(mousePoint: Point): ?BaseState {}
  onKeyPress(key: number): ?BaseState {}
  onKeyDown(key: number): ?BaseState {}
  onKeyUp(key: number): ?BaseState {}

  // UI element-specific hanlders (convenience)
  onAnyPointUp(p0id: string): ?BaseState {}
  onCanvasDown(pointA: Point): ?BaseState {}
  onCanvasUp(pointA: Point): ?BaseState {}
  onGroundDown(p0id: string): ?BaseState {}
  onPointDown(p0id: string): ?BaseState {}
  onRotaryDown(p0id: string): ?BaseState {}
  onSegmentDown(p0id: string, p1id: string): ?BaseState {}
  onSegmentUp(p0id: string, p1id: string): ?BaseState {}
}

class UnpausedState extends BaseState {  // initial unpaused
  draw(renderer: LinkageRenderer, mouseInfo: MouseInfo): void {
    this.linkage.tryRotatingLinkageInput();
    super.draw(renderer, mouseInfo);
  }

  onKeyUp(key: number): ?BaseState {
    switch (key) {
      case KEYS.SPACE:
        return new State0(this.linkage);
      default:
        return this;
    }
  }

  onKeyPress(key: number): ?BaseState {
    switch (key) {
      case KEYS.S:
      case KEYS.s:
        this.linkage.scaleSpeed(.9);
        return this;
      case KEYS.W:
      case KEYS.w:
        this.linkage.scaleSpeed(1.1);
        return this;
      case KEYS.T:
      case KEYS.t:
        this.linkage.reverseRotary();
        return this;
      default:
        return this;
    }
  }
}

class State10 extends UnpausedState { // rotary selected moving
  draw(renderer: LinkageRenderer, mouseInfo: MouseInfo): void {
    super.draw(renderer, mouseInfo);

    var p1id = this.linkage.spec.rotaries[this.p0id];
    var p2id = this.linkage.spec.extenders[p1id].ref;
    renderer.drawLines(
      [
        this.linkage.getPoint(p1id),
        this.linkage.getPoint(this.p0id),
        this.linkage.getPoint(p2id),
      ],
      PREVIEW_OPTIONS
    );
  }

  onKeyPress(key: number): ?BaseState {
    switch (key) {
      case KEYS.S:
      case KEYS.s:
        this.linkage.changeSpeed(-1, this.p0id);
        return this;
      case KEYS.W:
      case KEYS.w:
        this.linkage.changeSpeed(1, this.p0id);
        return this;
      case KEYS.T:
      case KEYS.t:
        this.linkage.reverseRotary(this.p0id);
        return this;
      default:
        return this;
    }
  }
}

class State12 extends UnpausedState { // trace point
  tracePoints: Array<Point>;

  constructor(linkage: Linkage, spec: StateSpec) {
    super(linkage, spec);
    this.tracePoints = [];
  }

  draw(renderer: LinkageRenderer, mouseInfo: MouseInfo): void {
    super.draw(renderer, mouseInfo);

    // record the current position
    var curPoint = this.linkage.positions[this.p0id];
    this.tracePoints.push({
      x: curPoint.x,
      y: curPoint.y,
    });
    if (this.tracePoints.length > MAX_TRACE_POINTS) {
      this.tracePoints.shift();
    }

    renderer.drawLines(this.tracePoints, TRACE_OPTIONS);
    renderer.drawPoint(curPoint, PREVIEW_OPTIONS);
  }
}

class PausedState extends BaseState {
  draw(renderer: LinkageRenderer, mouseInfo: MouseInfo): void {
    var {p0id, p1id} = mouseInfo;
    super.draw(renderer, mouseInfo);

    if (p0id && p1id) {
      renderer.drawLines(
        [
          this.linkage.positions[p0id],
          this.linkage.positions[p1id],
        ],
        PREVIEW_OPTIONS
      );
    } else if (p0id) {
      renderer.drawPoint(this.linkage.positions[p0id], PREVIEW_OPTIONS);
    }
  }

  onKeyUp(key: number): ?BaseState {
    switch (key) {
      case KEYS.SPACE:
        return new UnpausedState(this.linkage);
      case KEYS.ESC:
        return new State0(this.linkage);
      default:
        return this;
    }
  }
}

class State0 extends PausedState { // initial paused
  onGroundDown(p0id: string): ?BaseState {
    return new State3(this.linkage, {p0id});
  }

  onRotaryDown(p0id: string): ?BaseState {
    return new State7(this.linkage, {p0id});
  }

  onPointDown(p0id: string): ?BaseState {
    return new State14(this.linkage, {p0id});
  }

  onSegmentDown(p0id: string, p1id: string): ?BaseState {
    return new State9(this.linkage, {p0id, p1id});
  }

  onCanvasDown(pointA: Point): ?BaseState {
    return new State1(this.linkage, {pointA});
  }

  onKeyDown(key: number): ?BaseState {
    switch (key) {
      case KEYS.R:
      case KEYS.r:
        return new State11(this.linkage);
      default:
        return this;
    }
  }
}

class OptimizeState extends PausedState {
  __drawnPoints: Array<Point>;
  __pointPath: Array<Point>;

  onKeyUp(key: number): ?BaseState {
    switch (key) {
      case KEYS.SPACE:
        return new State12(this.linkage, {p0id: this.p0id});
      default:
        return super.onKeyUp(key);
    }
  }

  draw(renderer: LinkageRenderer, mouseInfo: MouseInfo): void {
    super.draw(renderer, mouseInfo);
    renderer.drawLines(this.__drawnPoints, OPTIMIZE_PATH_OPTIONS);
    renderer.drawLines(this.__pointPath, TRACE_OPTIONS);
  }
}

class State15 extends OptimizeState { // draw optimize path
  constructor(linkage: Linkage, spec: StateSpec) {
    super(linkage, spec);
    this.__drawnPoints = [];
    this.__pointPath = this.linkage.getPath(this.p0id);
  }

  onMouseDrag(mousePoint: Point): ?BaseState {
    this.__drawnPoints.push(mousePoint);
    return this;
  }

  onMouseUp(mousePoint: Point): ?BaseState {
    return new State16(this.linkage, {p0id: this.p0id}, this.__drawnPoints);
  }

  draw(renderer: LinkageRenderer, mouseInfo: MouseInfo): void {
    var {mousePoint} = mouseInfo;
    super.draw(renderer, mouseInfo);

    renderer.drawPoint(this.linkage.getPoint(this.p0id), PREVIEW_OPTIONS);
    renderer.drawPoint(mousePoint, OPTIMIZE_PATH_OPTIONS);
  }
}

class State16 extends OptimizeState { // actually optimize
  _stopOptimizing: boolean;

  constructor(linkage: Linkage, spec: StateSpec, drawnPoints: Array<Point>) {
    super(linkage, spec);
    this.__pointPath = this.linkage.getPath(this.p0id);
    this.__drawnPoints = drawnPoints;
    this._stopOptimizing = false;
    this._startOptimization();
  }

  onKeyUp(key: number): ?BaseState {
    this._stopOptimizing = true;
    return super.onKeyUp(key);
  }

  _startOptimization() {
    var optObj = new LinkageOptObj({
      path: this.__drawnPoints,
      linkageSpec: this.linkage.spec,
      id: this.p0id,
    });

    var pauseTime = 0;

    var iterate = function () {
      if (!this._stopOptimizing) {
        setTimeout(iterate, pauseTime);
        optObj = optimizeStep(optObj);
        this.linkage = optObj.linkage;
        this.__pointPath = this.linkage.getPath(this.p0id);
      }
    };

    iterate = iterate.bind(this);

    setTimeout(iterate, pauseTime);
  }

  draw(renderer: LinkageRenderer, mouseInfo: MouseInfo): void {
    super.draw(renderer, mouseInfo);

    renderer.drawPoint(this.linkage.getPoint(this.p0id), PREVIEW_OPTIONS);
  }
}

class State14 extends PausedState { // point down
  dragged: ?boolean;

  onMouseUp(mousePoint: Point): ?BaseState {
    return this.dragged ?
      new State0(this.linkage) :
      new State4(this.linkage, {p0id: this.p0id});
  }

  onMouseDrag(mousePoint: Point): ?BaseState {
    this.dragged = true;
    this.linkage.moveNotGroundPoint(mousePoint, this.p0id);
    return this;
  }

  draw(renderer: LinkageRenderer, mouseInfo: MouseInfo): void {
    super.draw(renderer, mouseInfo);
    renderer.drawPoint(this.linkage.getPoint(this.p0id), PREVIEW_OPTIONS);
  }
}

class State11 extends PausedState { // adding rotary
  onKeyUp(key: number): ?BaseState {
    switch (key) {
      case KEYS.R:
      case KEYS.r:
        return new State0(this.linkage);
      default:
        return super.onKeyUp(key);
    }
  }

  onMouseUp(mousePoint: Point): ?BaseState {
    this.linkage.addRotaryInput(mousePoint);
    this.linkage.calculatePositions();
    return new State0(this.linkage);
  }

  draw(renderer: LinkageRenderer, mouseInfo: MouseInfo): void {
    var {mousePoint} = mouseInfo;
    super.draw(renderer, mouseInfo);

    renderer.drawLines(
      [
        {x: mousePoint.x + 3, y: mousePoint.y + 4},
        mousePoint,
        {x: mousePoint.x + 1, y: mousePoint.y},
      ],
      PREVIEW_OPTIONS
    );
  }
}

class State1 extends PausedState { // canvas1
  constructor(linkage: Linkage, spec: StateSpec) {
    super(linkage, spec);

    mixinPointValidation(
      [this.pointA],
      ['onCanvasUp', 'onAnyPointUp'],
      this
    );
  }

  onCanvasUp(pointB: Point): ?BaseState {
    return new State2(this.linkage, {pointA: this.pointA, pointB});
  }

  onAnyPointUp(p0id: string): ?BaseState {
    return new State13(this.linkage, {pointA: this.pointA, p0id});
  }

  draw(renderer: LinkageRenderer, mouseInfo: MouseInfo): void {
    var {mousePoint} = mouseInfo;
    super.draw(renderer, mouseInfo);
    renderer.drawLines([this.pointA, mousePoint], PREVIEW_OPTIONS);
  }
}

class State13 extends PausedState { // canvas then point
  constructor(linkage: Linkage, spec: StateSpec) {
    super(linkage, spec);

    mixinPointValidation(
      [this.pointA, this.linkage.getPoint(this.p0id)],
      ['onCanvasUp'],
      this
    );
  }

  onCanvasUp(pointB: Point): ?BaseState {
    this.linkage.addGroundSegment(this.pointA, pointB, this.p0id);
    this.linkage.calculatePositions();
    return new State0(this.linkage);
  }

  draw(renderer: LinkageRenderer, mouseInfo: MouseInfo): void {
    var {mousePoint} = mouseInfo;
    super.draw(renderer, mouseInfo);
    renderer.drawLines(
      [
        this.pointA,
        mousePoint,
        this.linkage.getPoint(this.p0id),
      ],
      PREVIEW_OPTIONS
    );
  }
}

class State2 extends PausedState { // canvas1 + canvas2
  constructor(linkage: Linkage, spec: StateSpec) {
    super(linkage, spec);

    mixinPointValidation(
      [this.pointB],
      ['onAnyPointUp'],
      this
    );
  }

  onAnyPointUp(p0id: string): ?BaseState {
    this.linkage.addGroundSegment(this.pointA, this.pointB, p0id);
    this.linkage.calculatePositions();
    return new State0(this.linkage);
  }

  draw(renderer: LinkageRenderer, mouseInfo: MouseInfo): void {
    var {mousePoint} = mouseInfo;
    super.draw(renderer, mouseInfo);
    renderer.drawLines([this.pointA, this.pointB], PREVIEW_OPTIONS);
    renderer.drawLines([this.pointB, mousePoint], PREVIEW_OPTIONS);
  }
}

class State3 extends PausedState { // ground down
  dragged: ?boolean;

  onMouseUp(mousePoint: Point): ?BaseState {
    return this.dragged ?
      new State0(this.linkage) :
      new State4(this.linkage, {p0id: this.p0id});
  }

  onMouseDrag(mousePoint: Point): ?BaseState {
    this.dragged = true;
    this.linkage.tryMovingGroundPoints([{point: mousePoint, id:this.p0id}]);
    return this;
  }

  draw(renderer: LinkageRenderer, mouseInfo: MouseInfo): void {
    super.draw(renderer, mouseInfo);
    renderer.drawPoint(this.linkage.getPoint(this.p0id), PREVIEW_OPTIONS);
  }
}

class State4 extends PausedState { // point1
  constructor(linkage: Linkage, spec: StateSpec) {
    super(linkage, spec);

    mixinPointValidation(
      [this.linkage.getPoint(this.p0id)],
      ['onAnyPointUp', 'onCanvasUp'],
      this
    );
  }

  onAnyPointUp(p1id: string): ?BaseState {
    return new State5(this.linkage, {p0id: this.p0id, p1id})
  }

  onCanvasUp(pointA: Point): ?BaseState {
    return new State6(this.linkage, {p0id: this.p0id, pointA})
  }

  onKeyUp(key: number): ?BaseState {
    switch (key) {
      case KEYS.D:
      case KEYS.d:
        if (this.linkage.tryRemovingPoint(this.p0id)) {
          return new State0(this.linkage);
        } else {
          return this;
        }
      case KEYS.o:
      case KEYS.O:
        if (this.linkage.getPath(this.p0id)) {
          return new State15(this.linkage, {p0id: this.p0id});
        } else {
          return this;
        }
      case KEYS.SPACE:
        return new State12(this.linkage, {p0id: this.p0id});
      default:
        return super.onKeyUp(key);
    }
  }

  draw(renderer: LinkageRenderer, mouseInfo: MouseInfo): void {
    var {mousePoint} = mouseInfo;
    super.draw(renderer, mouseInfo);
    renderer.drawLines(
      [
        this.linkage.getPoint(this.p0id),
        mousePoint,
      ],
      PREVIEW_OPTIONS
    );
  }
}

class State5 extends PausedState { // point2
  constructor(linkage: Linkage, spec: StateSpec) {
    super(linkage, spec);

    mixinPointValidation(
      [this.linkage.getPoint(this.p0id), this.linkage.getPoint(this.p1id)],
      ['onCanvasUp'],
      this
    );
  }

  onCanvasUp(pointA: Point): ?BaseState {
    this.linkage.addTriangle(this.p0id, this.p1id, pointA);
    this.linkage.calculatePositions();
    return new State0(this.linkage);
  }

  draw(renderer: LinkageRenderer, mouseInfo: MouseInfo): void {
    var {mousePoint} = mouseInfo;
    super.draw(renderer, mouseInfo);
    renderer.drawLines(
      [
        this.linkage.getPoint(this.p0id),
        mousePoint,
        this.linkage.getPoint(this.p1id),
      ],
      PREVIEW_OPTIONS
    );
  }
}

class State6 extends PausedState { // point1 + canvas1
  constructor(linkage: Linkage, spec: StateSpec) {
    super(linkage, spec);

    mixinPointValidation(
      [this.pointA, this.linkage.getPoint(this.p0id)],
      ['onCanvasUp', 'onAnyPointUp'],
      this
    );
  }

  onCanvasUp(pointB: Point): ?BaseState {
    this.linkage.addGroundSegment(pointB, this.pointA, this.p0id);
    this.linkage.calculatePositions();
    return new State0(this.linkage);
  }

  onAnyPointUp(p1id: string): ?BaseState {
    this.linkage.addTriangle(this.p0id, p1id, this.pointA);
    this.linkage.calculatePositions();
    return new State0(this.linkage);
  }

  draw(renderer: LinkageRenderer, mouseInfo: MouseInfo): void {
    var {mousePoint} = mouseInfo;
    super.draw(renderer, mouseInfo);
    renderer.drawLines(
      [
        this.linkage.getPoint(this.p0id),
        this.pointA,
        mousePoint,
      ],
      PREVIEW_OPTIONS
    );
  }
}

class State7 extends PausedState { // rotary down
  dragged: ?boolean;

  onMouseUp(mousePoint: Point): ?BaseState {
    return this.dragged ?
      new State0(this.linkage) :
      new State8(this.linkage, {p0id: this.p0id});
  }

  onMouseDrag(mousePoint: Point): ?BaseState {
    this.dragged = true;

    var {rotaries, extenders, groundPoints} = this.linkage.spec;

    var {x: prevX, y: prevY} = groundPoints[this.p0id];
    var refID = extenders[rotaries[this.p0id]].ref;
    var refCurPoint = groundPoints[refID];
    var refNextPoint = {
      x: refCurPoint.x + mousePoint.x - prevX,
      y: refCurPoint.y + mousePoint.y - prevY,
    };

    this.linkage.tryMovingGroundPoints([
      {point: mousePoint, id: this.p0id},
      {point: refNextPoint, id: refID},
    ]);

    return this;
  }

  draw(renderer: LinkageRenderer, mouseInfo: MouseInfo): void {
    super.draw(renderer, mouseInfo);
    var p1id = this.linkage.spec.rotaries[this.p0id];
    var p2id = this.linkage.spec.extenders[p1id].ref;
    renderer.drawLines(
      [
        this.linkage.getPoint(p1id),
        this.linkage.getPoint(this.p0id),
        this.linkage.getPoint(p2id),
      ],
      PREVIEW_OPTIONS
    );
  }
}

class State8 extends State0 { // rotary selected
  onKeyUp(key: number): ?BaseState {
    switch (key) {
      case KEYS.SPACE:
        return new State10(this.linkage, {p0id: this.p0id});
      case KEYS.d:
      case KEYS.D:
        if (this.linkage.tryRemovingPoint(this.p0id)) {
          return new State0(this.linkage);
        } else {
          return this;
        }
      default:
        return super.onKeyUp(key);
    }
  }

  draw(renderer: LinkageRenderer, mouseInfo: MouseInfo): void {
    super.draw(renderer, mouseInfo);
    var p1id = this.linkage.spec.rotaries[this.p0id];
    var p2id = this.linkage.spec.extenders[p1id].ref;
    renderer.drawLines(
      [
        this.linkage.getPoint(p1id),
        this.linkage.getPoint(this.p0id),
        this.linkage.getPoint(p2id),
      ],
      PREVIEW_OPTIONS
    );
  }
}

class State9 extends PausedState { // segment selected
  constructor(linkage: Linkage, spec: StateSpec) {
    super(linkage, spec);

    mixinPointValidation(
      [this.linkage.getPoint(this.p0id), this.linkage.getPoint(this.p1id)],
      ['onCanvasUp'],
      this
    );
  }

  onCanvasUp(pointA: Point): ?BaseState {
    this.linkage.addTriangle(this.p0id, this.p1id, pointA);
    this.linkage.calculatePositions();
    return new State0(this.linkage);
  }

  onKeyPress(key: number): ?BaseState {
    switch (key) {
      case KEYS.S:
      case KEYS.s:
        this.linkage.tryChangingBarLength(-1, this.p0id, this.p1id);
        return this;
      case KEYS.W:
      case KEYS.w:
        this.linkage.tryChangingBarLength(1, this.p0id, this.p1id);
        return this;
      default:
        return super.onKeyPress(key);
    }
  }

  draw(renderer: LinkageRenderer, mouseInfo: MouseInfo): void {
    var {mousePoint} = mouseInfo;
    super.draw(renderer, mouseInfo);
    renderer.drawLines(
      [
        mousePoint,
        this.linkage.getPoint(this.p0id),
        this.linkage.getPoint(this.p1id),
        mousePoint,
      ],
      PREVIEW_OPTIONS
    );
  }
}

module.exports = BaseState;
