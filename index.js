var traj = require('voxel-trajectory');
var tic = require('tic')();

module.exports = function(game, opts) {
  return new Sky(game, opts);
};

function Sky(game, opts) {
  this.game   = game;
  this.time   = opts.time  || 1600;
  this.size   = opts.size  || this.game.worldWidth() * 3;
  this._color = opts.color || new this.game.THREE.Color(0, 0, 0);
  this._speed = opts.speed || 0.1;
  this.dayLength = opts.dayLength || 2400;
  this.day    = opts.day   || 0;
  this.moonCycle = opts.moonCycle || 29.5305882;
  this.enable();
}

Sky.prototype.enable = function() {
  this.createBox();
  this.createLights();
  //this.scheduleTime();

  this.game.on('tick', this.onTick = this.tick.bind(this));
};

Sky.prototype.disable = function() {
  this.game.removeListener('tick', this.onTick);
  this.destroyLights();
  this.destroyBox();
};

Sky.prototype.scheduleTime = function() {
  for (var i = 0; i <= this.dayLength; i += this._speed) this.tick.call(this);
};

Sky.prototype.tick = function(dt) {
  tic.tick(dt);
  this.fn.call(this, this.time);
  var pos = this.game.cameraPosition();
  var vec = new this.game.THREE.Vector3(pos[0], pos[1], pos[2]);
  this.outer.position.copy(vec);
  this.inner.position.copy(vec);
  this.ambient.position.copy(vec);
  this.time += this._speed;
  if (this.time > this.dayLength) this.time = 0;
  return this;
};

Sky.prototype.createBox = function() {
  var game = this.game;
  var size = this.size;

  var mat = new game.THREE.MeshBasicMaterial({
    side: game.THREE.BackSide,
    fog: false,
  });
  this.outer = new game.THREE.Mesh(
    new game.THREE.CubeGeometry(size, size, size),
    new game.THREE.MeshFaceMaterial([
      mat, mat, mat, mat, mat, mat
    ])
  );
  game.scene.add(this.outer);

  var materials = [];
  for (var i = 0; i < 6; i++) {
    materials.push(this.createCanvas());
  }
  this.inner = new game.THREE.Mesh(
    new game.THREE.CubeGeometry(size-10, size-10, size-10),
    new game.THREE.MeshFaceMaterial(materials)
  );
  game.scene.add(this.inner);
};

Sky.prototype.destroyBox = function() {
  this.game.scene.remove(this.outer);
  this.game.scene.remove(this.inner);
};

Sky.prototype.createLights = function() {
  var game = this.game;
  this.ambient = new game.THREE.HemisphereLight(0x408CFF, 0xFFC880, 0.6);
  game.scene.add(this.ambient);
  this.sunlight = new game.THREE.DirectionalLight(0xffffff, 0.5);
  game.scene.add(this.sunlight);
};

Sky.prototype.destroyLights = function() {
  this.game.scene.remove(this.ambient);
  this.game.scene.remove(this.sunlight);
};

Sky.prototype.color = function(end, time) {
  var self = this;
  if (self._colorInterval) self._colorInterval();
  var i = 0;
  var start = self._color.clone().getHSL();
  var color = self._color.clone().getHSL();
  self._colorInterval = tic.interval(function() {
    var dt = i / time;
    for (var p in color) color[p] = start[p] + (end[p] - start[p]) * dt;
    self._color.setHSL(color.h, color.s, color.l);
    self.outer.material.materials.forEach(function(mat) {
      mat.color.setHSL(color.h, color.s, color.l);
    });
    self.ambient.color.setHSL(color.h, color.s, color.l);
    if (self.game.scene.fog) self.game.scene.fog.color.setHSL(color.h, color.s, color.l);
    if (dt === 1) self._colorInterval();
    i += self._speed;
  }, self._speed);
};

Sky.prototype.speed = function(speed) {
  if (speed != null) this._speed = speed;
  return this._speed;
};

Sky.prototype.paint = function(faces, fn) {
  var self = this;
  var args = Array.prototype.slice.call(arguments, 2);
  var index = ['back', 'front', 'top', 'bottom', 'left', 'right'];
  if (faces === 'all') faces = index;
  if (faces === 'sides') faces = ['back', 'front', 'left', 'right'];
  if (!isArray(faces)) faces = [faces];
  faces.forEach(function(face) {
    if (typeof face === 'string') {
      face = index.indexOf(String(face).toLowerCase());
      if (face === -1) return;
    }
    self.material = self.inner.material.materials[face];
    self.canvas = self.material.map.image;
    self.context = self.canvas.getContext('2d');
    fn.apply(self, args);
    self.inner.material.materials[face].map.needsUpdate = true;
  });
  self.material = self.canvas = self.context = false;
};

Sky.prototype.sun   = require('./lib/sun.js');
Sky.prototype.moon  = require('./lib/moon.js');
Sky.prototype.stars = require('./lib/stars.js');

Sky.prototype.createCanvas = function() {
  var game = this.game;

  var canvas = document.createElement('canvas');
  canvas.height = canvas.width = 512;
  var context = canvas.getContext('2d');

  var material = new game.THREE.MeshBasicMaterial({
    side: game.THREE.BackSide,
    map: new game.THREE.Texture(canvas),
    transparent: true,
    fog: false,
  });
  material.magFilter = game.THREE.NearestFilter;
  material.minFilter = game.THREE.LinearMipMapLinearFilter;
  material.wrapS = material.wrapT = game.THREE.RepeatWrapping;
  material.map.needsUpdate = true;

  return material;
};

Sky.prototype.spin = function(r) {
  this.inner.rotation.x = this.outer.rotation.x = r;
  this.ambient.rotation.x = r + Math.PI;
  var t = traj(this.size/2, this.ambient.rotation);
  this.sunlight.position.set(t[0], t[1], t[2]);
  this.sunlight.lookAt(0, 0, 0);
};

Sky.prototype.clear = function() {
  if (!this.canvas) return false;
  this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
};

// default sky
Sky.prototype._default = {
  hours: {
       1600: {color: {h: 230/360, s: 0.3, l: 0}},
     1300: {color: {h: 26/360, s: 0.3, l: 0.5}},
     1100: {color: {h: 230/360, s: 0.3, l: 0.7}},
    200: {color: {h: 26/360, s: 0.3, l: 0.5}},
    0: {color: {h: 230/360, s: 0.3, l: 0}}
  },
  init: function() {
    // add a sun on the top
    this.paint('top', this.sun);
    // add some stars
    this.paint(['top', 'left', 'right', 'front', 'back'], this.stars, 500);
    this.material.transparent = true;
    this.material.opacity = 1.0;
    // add full moon to the bottom
    this.paint('bottom', this.moon, 0);
    // full sunlight at startup
    this.sunlight.intensity = 1;

    //this.applyEffectsWithinInterval(0, this.time);
  },
  until: false,
  last: 0
};

// default sky fn
Sky.prototype.fn = function(time) {
  var my = this._default;
  var hour = Math.round(time / 100) * 100;
  var speed = Math.abs(my.last - time);
  my.last = time;

  // run initialization once
  if (my.init) { my.init.call(this); delete my.init; }

  // switch color based on time of day
  // maybe make this next part into a helper function
  if (my.hours[hour]) {
    if (!my.until) {
      this.color(my.hours[hour].color, speed > 9 ? 100 : 1000);
      my.until = hour + 100;
    }
  }
  if (my.until === hour) my.until = false;

  this.applyEffectsWithinInterval(time, time);

  // spin the sky 1 revolution per day
  this.spin(Math.PI * 2 * (time / this.dayLength));

  // keep track of days
  if (time === this.dayLength) this.day++;
};

Sky.prototype.timeEffects = [
  // turn on sunlight
  {at:400, name:'sunlightOn', run:function() {
    (function(sunlight) {
      //var i = tic.interval(function() {
        sunlight.intensity += 0.1;
      //  if (sunlight.intensity <= 1) i();
      //}, 100);
    }(this.sunlight));
  }},

  // fade stars in
  {at:500, name:'starsIn', run:function() {
    this.paint(['top', 'left', 'right', 'front', 'back'], function() {
      this.material.transparent = true;
      //var i = tic.interval(function(mat) {
        this.material.opacity -= 0.1;
      //  if (mat.opacity <= 0) i();
      //}, 100, this.material);
    });
  }},


  // change moon phase
  {at:1200, name:'moonPhase', run:function() {
    this.paint('top', this.clear);
    this.paint('top', this.moon, Math.floor(this.day % this.moonCycle) / this.moonCycle);
    this.paint('top', this.stars, 500);
  }},

  // fade stars out
  {at:1800, name:'starsOut', run:function() {
    this.paint(['top', 'left', 'right', 'front', 'back'], function() {
      this.material.transparent = true;
      var i = tic.interval(function(mat) {
        mat.opacity += 0.1;
        if (mat.opacity >= 1) i();
      }, 100, this.material);
    });
  }},

  // turn off sunlight
  {at:1800, name:'sunlightOff', run:function() {
    (function(sunlight) {
      //var i = tic.interval(function() {
        sunlight.intensity -= 0.1;
      //  if (sunlight.intensity <= 0) i();
      //}, 100);
    }(this.sunlight));
  }}
];

Sky.prototype.applyEffectsWithinInterval = function(start, end) {
  for (var i = 0; i < this.timeEffects.length; ++i) {
    var effect = this.timeEffects[i];

    if (effect.at >= start && effect.at <= end)
      console.log('within ',effect.at,' applying ',effect.name);
      effect.run.call(this);
  }
};


Sky.prototype.rgba = function(c, o) {
  if (arguments.length === 4) {
    c = {r: arguments[0], g: arguments[1], b: arguments[2]};
    o = arguments[3];
  }
  return 'rgba(' + (c.r*255) + ', ' + (c.g*255) + ', ' + (c.b*255) + ', ' + o + ')';
};

function isArray(ar) {
  return Array.isArray(ar)
    || (typeof ar === 'object' && Object.prototype.toString.call(ar) === '[object Array]');
}
