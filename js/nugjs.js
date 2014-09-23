
window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       || 
          window.webkitRequestAnimationFrame || 
          window.mozRequestAnimationFrame    || 
          window.oRequestAnimationFrame      || 
          window.msRequestAnimationFrame     || 
          function(/* function */ callback, /* DOMElement */ element){
            window.setTimeout(callback, 1000 / FPS);
          };
})();

function Universe(div, name) {
    this.TIME_MULTIPLIER = 10000;
    this.clock = new THREE.Clock();
    this.G_FORCE = 6.674E-11;
    this.draw_trajectories = false;
    this.container = div;
    this.name = name;
    this.planets = [];
    this.view = [];
    this.view.mouse = [];

}

Universe.prototype.init = function() {
    // set the scene size
    var WIDTH = 720,
        HEIGHT = 405;

    // set some camera attributes
    var VIEW_ANGLE = 45,
        ASPECT = WIDTH / HEIGHT,
        NEAR = 0.1,
        FAR = 10000;

    // get the DOM element to attach to
    // - assume we've got jQuery to hand
    var $container = $('#universe');

    // create a WebGL renderer, camera
    // and a scene
    var renderer = new THREE.WebGLRenderer();
    this.view.scene = new THREE.Scene();
    this.view.renderer = renderer;

    this.view.camera = new THREE.PerspectiveCamera(VIEW_ANGLE, ASPECT, NEAR, FAR);
    // the camera starts at 0,0,0 so pull it back
    this.view.camera.position.z = 5000;

    // start the renderer
    renderer.setSize(WIDTH, HEIGHT);

    // attach the render-supplied DOM element
    $container.append(renderer.domElement);

    // and the camera
    this.view.scene.add(this.view.camera);

    // create a point light
    var pointLight = new THREE.PointLight( 0xFFFFFF );

    // set its position
    pointLight.position.x = 0;
    pointLight.position.y = 0;
    pointLight.position.z = 10000;
    this.view.scene.add(pointLight);

    // Draw axis
    //this.draw_axis();

    // draw!
    this.update();
}

Universe.prototype.draw_axis = function() {
    var geometry = new THREE.Geometry();
    var line = new THREE.Line(geometry, new THREE.LineBasicMaterial(
        { color: 0xffffff, opacity: 0.5}));
    geometry.vertices.push(new THREE.Vector3(-400, 0, 0));
    geometry.vertices.push(new THREE.Vector3(400, 0, 0));
    this.view.scene.add(line);
    geometry = new THREE.Geometry()
    line = new THREE.Line(geometry, new THREE.LineBasicMaterial(
        { color: 0xffffff, opacity: 0.5}));
    geometry.vertices.push(new THREE.Vector3(0, 400, 0));
    geometry.vertices.push(new THREE.Vector3(0, -400, 0));
    this.view.scene.add(line);
}

/*
 * x, y increment.
 */
Universe.prototype.move_camera = function(x, y) {
    this.view.camera.position.x += x;
    this.view.camera.position.y += y;
}

Universe.prototype.add_planet = function(mass, name, x, y, vx, vy) {
    name = typeof name !== 'undefined' ? name : 'planet' + (this.planets.length+1);
    vx = typeof vx !== 'undefined' ? vx : 0;
    vy = typeof vy !== 'undefined' ? vy : 0;
    var planet = new Planet(this, name, mass, x, y, vx, vy);
    this.planets.push(planet);
    this.view.scene.add(planet.mesh);
}

Universe.prototype.del_planet = function(planet) {
    remove_from_array(this.planets, planet);
    this.view.scene.remove(planet.trajectory);
    this.view.scene.remove(planet.mesh);
}

// animation loop
Universe.prototype.update = function() {
    // Time step
    var t = this.clock.getDelta() * this.TIME_MULTIPLIER;

    this.check_user_interactions();
  
    var planets_to_remove=[];    // Since we shouldn't remove a planet inside the loop...
    for (var i = 0; i < this.planets.length; i++) {
        this.planets[i].force = new THREE.Vector3(0,0,0);
        for (var j = 0; j < this.planets.length; j++) {
            if (this.planets[i] != this.planets[j]) {
                var distance = calculate_magnitude(calculate_vector(this.planets[i].mesh.position, this.planets[j].mesh.position));
                if (distance > this.planets[i].mesh.geometry.parameters.radius + this.planets[j].mesh.geometry.parameters.radius) {
                    var force_var = this.get_g_force(this.planets[j], this.planets[i]);
                    this.planets[i].force.x += force_var.x;
                    this.planets[i].force.y += force_var.y;
                    this.planets[i].force.z += force_var.z;
                } else {
                    planets_to_remove.push(this.merge(this.planets[i], this.planets[j]));
                }
            }
            this.move(t, this.planets[i]);
        }
    }
    for (var i = 0; i< planets_to_remove.length; i++) {
        this.del_planet(planets_to_remove[i]);
    }

    // draw
    this.view.renderer.render(this.view.scene, this.view.camera);

    // set up the next call (the bind method gets rid of the 'this' pointer missplacements)
    requestAnimationFrame(this.update.bind(this));
}

Universe.prototype.check_user_interactions = function() {
    if (this.hud_callback !== undefined) {
        this.hud_callback(this.planets.length);
    }
}

/*
 * Moves the planet2 towards planet1.
 */
Universe.prototype.move = function(t, planet2) {
    // Force applied on planet2 due to planet1

    var last_acceleration = new THREE.Vector3(planet2.acceleration.x,
                                              planet2.acceleration.y,
                                              planet2.acceleration.z);
    var pos = new THREE.Vector3(planet2.mesh.position.x,
                                planet2.mesh.position.y,
                                planet2.mesh.position.z);
    pos.x += planet2.velocity.x * t + (0.5 * last_acceleration.x * Math.pow(t, 2));
    pos.y += planet2.velocity.y * t + (0.5 * last_acceleration.y * Math.pow(t, 2));
    pos.z += planet2.velocity.z * t + (0.5 * last_acceleration.z * Math.pow(t, 2));
    var last_pos = new THREE.Vector3(planet2.getPos().x,
                                        planet2.getPos().y,
                                        planet2.getPos().z);
    planet2.setPos(pos);
    planet2.acceleration.x = planet2.force.x / planet2.mass;
    planet2.acceleration.y = planet2.force.y / planet2.mass;
    planet2.acceleration.z = planet2.force.z / planet2.mass;
    var avg_acceleration = new THREE.Vector3((last_acceleration.x + planet2.acceleration.x) / 2,
                                             (last_acceleration.y + planet2.acceleration.y) / 2,
                                             (last_acceleration.z + planet2.acceleration.z) / 2);
    planet2.velocity.x += avg_acceleration.x * t;
    planet2.velocity.y += avg_acceleration.y * t;
    planet2.velocity.z += avg_acceleration.z * t;

    // draw trajectory
    if (this.draw_trajectories) {
        planet2.addTrajectoryPoint(planet2.getPos());
    }
}

Universe.prototype.merge = function(planet1, planet2) {
    var new_planet;
    var old_planet;
    if (planet1.mass >= planet2.mass) {
        new_planet = planet1;
        old_planet = planet2;
    } else {
        new_planet = planet2;
        old_planet = planet1;
    }

    new_planet.mass += old_planet.mass;
    old_planet.mass = 0;

    return old_planet;
}

Universe.prototype.get_g_force = function(planet1, planet2) {
    // Move planet
    var v12 = calculate_vector(planet1.getPos(), planet2.getPos());
    var distance = calculate_magnitude(v12);
    var magf12 = -this.G_FORCE * (planet1.mass * planet2.mass) / Math.pow(distance,2);
    var dirf12 = unit_vector(v12);
    return new THREE.Vector3(magf12 * dirf12.x,
                             magf12 * dirf12.y,
                             magf12 * dirf12.z);
}

/*
 * Calculates the vector between points p1 and p2.
 * e.g. p1 = {'x': 1, 'y': 2}
 */
function calculate_vector(p1, p2) {
    return new THREE.Vector3(p2.x - p1.x,
                             p2.y - p1.y,
                             p2.z - p1.z);
}

function unit_vector(v) {
    var magnitude = calculate_magnitude(v);
    return new THREE.Vector3(v.x / magnitude,
                             v.y / magnitude,
                             v.z / magnitude);
}

function calculate_magnitude(v) {
    return Math.pow(Math.pow(v.x, 2) + Math.pow(v.y, 2) + Math.pow(v.z, 2), 1/2)
}

function substract_vectors(v1, v2) {
    return new THREE.Vector3(v2.x - v1.x, v2.y - v1.y, v2.z - v1.z);
}

function Planet(universe, name, mass, x, y, vx, vy) {
    this.universe = universe;
    this.name = name;
    this.velocity = new THREE.Vector3(vx,vy,0);
    this.acceleration = new THREE.Vector3(0,0,0);
    this.mass = mass;
    var pos = new THREE.Vector3(x, y, 0);
    var material = new THREE.MeshLambertMaterial({color: this.calculate_colour(mass)});
    var radius = this.calculate_radius(mass);
    var planet = new THREE.Mesh(
       new THREE.SphereGeometry(radius, 16, 16), material);
    planet.position.x = pos.x;
    planet.position.y = pos.y;
    planet.position.z = pos.z;
    this.mesh = planet;
}

Planet.prototype.calculate_colour = function(mass) {
    var colours = [0xffffff, 0x3de62e, 0xd9e62e, 0xe6a32e, 0xe67c2e, 0xe62e2e];

    if (mass < 10001) {
        return colours[0];
    } else if (mass < 100001) {
        return colours[1];
    } else if (mass < 1000001) {
        return colours[2];
    } else if (mass < 10000001) {
        return colours[3];
    } else if (mass < 100000001) {
        return colours[4];
    } else {
        return colours[5];
    }
}

Planet.prototype.addTrajectoryPoint = function(point) {
    if (typeof this.trajectory == 'undefined') {
        var geometry = new THREE.Geometry();
        geometry.dynamic = true;
        var line = new THREE.Line(geometry, new THREE.LineBasicMaterial( { color: 0x00ff00, opacity: 0.5 } ) );
        this.trajectory = line;
        this.universe.view.scene.add(this.trajectory);
    }
    this.trajectory.geometry.vertices.push(point);
}

Planet.prototype.getPos = function() {
    return new THREE.Vector3(this.mesh.position.x,
                             this.mesh.position.y,
                             this.mesh.position.z);
}

Planet.prototype.setPos = function(pos) {  
    this.mesh.position.x = pos.x;
    this.mesh.position.y = pos.y;
    this.mesh.position.z = pos.z;
}   

/**
  * Get radius from sphere volume assuming the density of Iron.
  */
Planet.prototype.calculate_radius = function(mass) {
    var DENSITY = 7874;
    //return Math.pow((3 * mass) / (4 * Math.PI * DENSITY), 1/3);
    return 2*Math.log(mass);
}

function getXY(camera, cX, cY) {
    var projector = new THREE.Projector();
    var planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    var mv = new THREE.Vector3(cX * 2 - 1,
        -cY * 2 + 1,
        0.5 );
    var raycaster = projector.pickingRay(mv, camera);
    var pos = raycaster.ray.intersectPlane(planeZ);

    return pos;
}

function remove_from_array(arr, item) {
    for(var i = arr.length; i--;) {
      if(arr[i] === item) {
          arr.splice(i, 1);
      }
    }
}

/*********************************************************************/
/**************************** CONTROLS *******************************/
/*********************************************************************/
Universe.prototype.mouse_down = function(x, y) {
    this.view.mouse.down_position = getXY(this.view.camera, x, y);
}

Universe.prototype.mouse_move = function(x, y) {
    var universe_pos = getXY(this.view.camera, x, y);
    // Add planet
    if (this.view.mouse.down_position !== undefined) {
        if (this.view.initial_velocity !== undefined) {
            this.view.scene.remove(this.view.initial_velocity);
        }
        this.view.mouse.position = universe_pos;
        var geometry = new THREE.Geometry();
        this.view.initial_velocity = new THREE.Line(geometry, new THREE.LineBasicMaterial(
                                                        { color: 0xffffff, opacity: 0.5}));
        this.view.initial_velocity.geometry.vertices.push(this.view.mouse.down_position);
        this.view.initial_velocity.geometry.vertices.push(this.view.mouse.position);
        this.view.scene.add(this.view.initial_velocity);
    }

    // HUD update
}

Universe.prototype.mouse_up = function(mass, x, y) {
    if (this.view.mouse.down_position !== undefined) {
        var new_pos = getXY(this.view.camera, x, y);
        var v = new THREE.Vector3((new_pos.x - this.view.mouse.down_position.x) * 0.00001,
                                  (new_pos.y - this.view.mouse.down_position.y) * 0.00001, 0);
        this.add_planet(mass, undefined, this.view.mouse.down_position.x, this.view.mouse.down_position.y, v.x, v.y);
        // Release
        this.view.mouse.down_position = undefined;
        if (this.view.initial_velocity !== undefined) {
            this.view.scene.remove(this.view.initial_velocity);
        }
    }
}

Universe.prototype.mouse_wheel = function(updown) {
    this.view.camera.position.z += updown * 10;
}

Universe.prototype.registerHudInfo = function(f) {
    this.hud_callback = f;
}
