// web worker
var worker, worker_ready = false;
const log = document.querySelector('.bottom');

function print(str) {
    log.innerText += str + '\n';
}

const message_process = msg => {
    msg = msg.data;
    switch (msg.type) {
        case 'error': 
            print('[RUNTIME ERROR]' + msg.data);
            car_body.velocity.set(0, 0, 0);
            drive(0, 0, 0);
            break;
        case 'get':
            worker_ready = true;
            break;
        case 'log':
            print(msg.data);
            break;
        case 'control':
            drive(...msg.data);
            break;
        case 'img':
            if (fpv_canvas.hidden) {
                fpv_ctx.putImageData(msg.data, 0, 0);
            }
            break;
        case 'pid':
            option.series[0].data = msg.data;
            option.series[0].markLine.label.formatter = msg.target.toString();
            option.series[0].markLine.data[0].yAxis = msg.target;
            pidChart.setOption(option);
            break;
        default: break;
    }
}

const worker_creater = () => {
    if(typeof(Worker) !== "undefined") {
        worker = new Worker('./js/worker.js');
        worker.onmessage = message_process;
        worker.onerror = e => {
            print(['[SYSTEM ERROR] Line ', e.lineno, ' in ', e.filename, ': ', e.message].join(''));
            worker.terminate();
            worker = undefined;
        };
    } else {
        alert("您的浏览器不支持Web Worker,请更换浏览器!");
    }
}

// ace
const editorDom = document.getElementById('editor');
document.getElementById('b1').addEventListener('click', () => {
    if (!worker) worker_creater();
    if (fpv_canvas.hidden) fpv_canvas.click();
    worker.postMessage({type:'code',data:editorDom.innerText});
    chart_reset();
});
document.getElementById('b2').addEventListener('click', () => {
    worker?.terminate();
    worker = undefined;
    car_body.velocity.set(0, 0, 0);
    drive(0, 0, 0);
});
ace.require("ace/ext/language_tools");  
ace.require("ace/edit_session").EditSession.prototype.$useWorker = false;
var editor = ace.edit(editorDom);
editor.setOptions({
    enableLiveAutocompletion: true
});
editor.setTheme("ace/theme/tomorrow_night_blue");
editor.getSession().setMode("ace/mode/javascript");
editor.setFontSize(16);
editor.onFocus = () => document.onkeydown = document.onkeyup = null;
// echarts
const chartDom = document.getElementById('echarts');
const pidChart = echarts.init(chartDom, 'dark');
const option = {
    title: {
        top: '5%',
        left: 'center',
        text: 'PID示波器',
        textStyle: {
            color: '#00f',
            fontWeight: 'normal',
            fontSize: 14
        }
    },
    backgroundColor: '',
    xAxis: {
        axisLine:{
            lineStyle: {
                color: '#00f',
            }
        },
        axisLabel: {
            textStyle: {
                color: '#00f'
            }
        },
        splitLine: {
            show: false
        },
        type: 'value'
    },
    yAxis: {
        axisLine:{
            lineStyle: {
                color: '#00f'
            }
        },
        axisLabel: {
            textStyle: {
                color: '#00f'
            }
        },
        splitLine: {
            show: false
        },
        type: 'value'
    },
    series: [
        {
            markLine: {
                show: false,
                lineStyle: {
                    color: '#f00'
                },
                data: [{
                    yAxis: 0
                }],
                label: {
                    formatter: '0'
                },
            },
            data: [[0,0]],
            lineStyle: {
                color: '#0f0'
            },
            type: 'line',
            smooth: true
        }
    ]
};
const chart_reset = () => {
    option.series[0].data = [[0,0]];
    option.series[0].markLine.label.formatter = '0';
    option.series[0].markLine.data[0].yAxis = 0;
    pidChart.setOption(option, true);
}
option && pidChart.setOption(option);
// stat
const simulator = document.querySelector('.left');
const fpv_canvas = document.getElementById('fpv');
const fpv_img = document.getElementById('fpv_img');
const fpv_ctx = fpv_img.getContext('2d');
fpv_canvas.onclick = () => {
    worker?.postMessage({type:'show',data:true});
    fpv_canvas.hidden = true;
    fpv_img.hidden = false;
}
fpv_img.onclick = () => {
    worker?.postMessage({type:'show',data:false});
    fpv_canvas.hidden = false;
    fpv_img.hidden = true;
}
fpv_canvas.updatePosition = () => fpv_canvas.style.left = fpv_img.style.left = simulator.offsetWidth - fpv_canvas.width - 10;
fpv_canvas.updatePosition();
const stats = new Stats();
simulator.append(stats.dom);
// three
const scene = new THREE.Scene();
scene.background = new THREE.Color( 0xaaccff );
const renderer = new THREE.WebGLRenderer({ antialias: true });
const fpv_renderer = new THREE.WebGLRenderer({ antialias: true, canvas: fpv_canvas });
renderer.setPixelRatio(simulator.devicePixelRatio);
fpv_renderer.setPixelRatio(simulator.devicePixelRatio);
renderer.shadowMap.enabled = true;
fpv_renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
fpv_renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize( simulator.offsetWidth, simulator.offsetHeight );
fpv_renderer.setSize( fpv_canvas.width, fpv_canvas.height );
simulator.appendChild( renderer.domElement );
const group = new THREE.Group();

const camera = new THREE.PerspectiveCamera( 75, simulator.offsetWidth / simulator.offsetHeight, 1, 1000 );
camera.position.set(100, 100, 100);
camera.lookAt(0, 0, 0);

const controls = new THREE.OrbitControls( camera, renderer.domElement );
controls.maxPolarAngle = 0.9 * Math.PI / 2;
controls.minDistance = 10;

const transformControl = new THREE.TransformControls( camera,renderer.domElement );
transformControl.showX = transformControl.showY = transformControl.showZ = false;
scene.add( transformControl );
transformControl.addEventListener( 'dragging-changed', function ( event ) {
    controls.enabled = ! event.value; 
    transformControl.showX = transformControl.showY = transformControl.showZ = event.value;
    if (transformControl.object.position.y < 2) {
        transformControl.object.position.y = 2;
    }
});

const loader = new THREE.TextureLoader();
var material = new THREE.MeshPhongMaterial({map: loader.load('./res/map.png')});
var geometry = new THREE.BoxGeometry( 500, 500, 1 );
const ground = new THREE.Mesh( geometry, material );
ground.receiveShadow = true;
scene.add( ground );

const light = {
    ambient: {
        color: 0x404040,
        intensity: 1
    },
    point: {
        obj: [],
        position: [50, 50, 50],
        add: creater,
        remove: () => {
            scene.remove(light.point.obj.pop());
            pointlight = light.point.obj[light.point.obj.length-1];
            transformControl.attach(pointlight);
            if (light.point.obj.length == 1) remove.disable();
        },
        size: 1,
        color: 0xffffff,
        intensity: 2,
        distance: 500,
        decay: 2
    }
}

const ambientlight = new THREE.AmbientLight( light.ambient.color, light.ambient.intensity );
scene.add( ambientlight );

var pointlight, remove;
function creater() {
    pointlight = new THREE.PointLight( light.point.color, light.point.intensity, light.point.distance, light.point.decay );
    material = new THREE.MeshBasicMaterial({color: light.point.color});
    geometry = new THREE.SphereGeometry( light.point.size );
    pointlight.add( new THREE.Mesh( geometry, material ) );
    pointlight.position.set(...light.point.position);
    pointlight.position.x += light.point.obj.length * 10;
    pointlight.castShadow = true;
    light.point.obj.push(pointlight);
    scene.add( pointlight );
    transformControl.attach( pointlight );
    remove?.enable();
};
creater();

const car_size = {
    length: 30,
    width: 18,
    mass: 1,
    pole_height: 20,
    fpv_degree: Math.PI * 1.7,
    wheel_size: {
        radius: 3,
        width: 2.9,
        mass: .1,
    }
}

material = new THREE.MeshLambertMaterial({color: 0x28323c});
geometry = new THREE.BoxGeometry( car_size.length, car_size.width, 1);
const car = new THREE.Mesh( geometry, material );
car.castShadow = true;
group.add( car );

material = new THREE.MeshLambertMaterial({color: 0x000000});
geometry = new THREE.CylinderGeometry( 0.5, 0.5, car_size.pole_height, 32 );
const pole = new THREE.Mesh( geometry, material );
pole.rotation.x = -Math.PI / 2.0;
pole.position.set(0, 0, car_size.pole_height / 2);
pole.castShadow = true;
group.add( pole );

material = new THREE.MeshLambertMaterial({color: 0x0000ff});
geometry = new THREE.CylinderGeometry( 1.5, 1, 2.6, 32 );
const fpv_camera = new THREE.Mesh( geometry, material );
fpv_camera.position.set(1, 0, car_size.pole_height);
fpv_camera.rotation.x = -Math.PI / 2.0;
fpv_camera.rotation.z = car_size.fpv_degree;
fpv_camera.castShadow = true;
group.add( fpv_camera );

const fpv = new THREE.PerspectiveCamera( 75, 4 / 3, 1, 1000 );
fpv.up.set(0, 0, 1);
fpv.position.set(1 + 1.3 * Math.sin(2 * Math.PI - car_size.fpv_degree), 0, car_size.pole_height - 1.3 * Math.cos(2 * Math.PI - car_size.fpv_degree));
fpv.lookAt(1 + car_size.pole_height * Math.tan(2 * Math.PI - car_size.fpv_degree), 0, 0);
fpv.up.set(0,1,0);
group.add(fpv);

const fpv_helper = new THREE.CameraHelper( fpv );
const xyz = new THREE.AxesHelper( 1 );
xyz.visible = false;
xyz.position.set(car_size.length, 0, 0);
group.add( xyz );

scene.add( group );
// cannon
const world = new CANNON.World();
world.gravity.set(0, -9.8, 0);
world.broadphase = new CANNON.SAPBroadphase(world);
world.solver.iterations = 10;
world.defaultContactMaterial.friction = 0;

const groundMaterial = new CANNON.Material("groundMaterial");
const wheelMaterial = new CANNON.Material("wheelMaterial");
const wheelGroundContactMaterial = new CANNON.ContactMaterial(wheelMaterial, groundMaterial,{
    friction: 0.3,
    restitution: 0,
    contactEquationStiffness: 1000
});
world.addContactMaterial(wheelGroundContactMaterial);

var shape = new CANNON.Box(new CANNON.Vec3(250, 250, 0.5));
const ground_body = new CANNON.Body({
    mass: 0,
    material: groundMaterial
});
ground_body.addShape(shape);
ground_body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
world.add(ground_body);	

shape =  new CANNON.Box(new CANNON.Vec3(car_size.length / 2, car_size.width / 2, 0.5));
const car_body = new CANNON.Body({
    mass: car_size.mass,
});
car_body.addShape(shape);
car_body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
car_body.position.set(0, 5, 0);
world.add(car_body);	

const vehicle = new CANNON.RaycastVehicle({
    chassisBody: car_body
});		

const wheel_params = {
    radius: car_size.wheel_size.radius,
    directionLocal: new CANNON.Vec3(0, 0, -1),
    suspensionStiffness: 30,
    suspensionRestLength: 0.3,
    frictionSlip: 35,
    dampingRelaxation: 2.3,
    dampingCompression: 4.4,
    maxSuspensionForce: 100000,
    rollInfluence: 0.01,
    axleLocal: new CANNON.Vec3(0, 1, 0),
    chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
    maxSuspensionTravel: 0.3,
    customSlidingRotationalSpeed: -30,
    useCustomSlidingRotationalSpeed: true,
    maxSteerVal: 1,
    maxForce: 12
};
var offset_x = car_size.length / 2 - wheel_params.radius - 1, offset_y = (car_size.width - car_size.wheel_size.width) / 2 + .1;
wheel_params.chassisConnectionPointLocal.set(offset_x, offset_y, 0);
vehicle.addWheel(wheel_params);
wheel_params.chassisConnectionPointLocal.set(offset_x, -offset_y, 0);
vehicle.addWheel(wheel_params);
wheel_params.chassisConnectionPointLocal.set(-offset_x,offset_y, 0);
vehicle.addWheel(wheel_params);
wheel_params.chassisConnectionPointLocal.set(-offset_x, -offset_y, 0);
vehicle.addWheel(wheel_params);
vehicle.addToWorld(world);

const wheels_bodies = [], wheels = [];
for (let wheel of vehicle.wheelInfos) {
    shape = new CANNON.Cylinder(wheel.radius, wheel.radius, car_size.wheel_size.width, 32);
    let wheel_body = new CANNON.Body({
        mass: 0.1,
        material: wheelMaterial
    });
    wheel_body.addShape(shape);
    wheels_bodies.push(wheel_body);
    material = new THREE.MeshLambertMaterial({color: 0xff0000});
    geometry = new THREE.CylinderGeometry(wheel.radius, wheel.radius, car_size.wheel_size.width, 32);
    let _wheel = new THREE.Mesh( geometry, material );
    _wheel.castShadow = true;
    scene.add(_wheel);
    wheels.push(_wheel);
}
simulator.onclick = () => {
    editor.blur();
    document.onkeydown = handler;
    document.onkeyup = handler;
};
simulator.onclick();

function drive(l_pwm, r_pwm, servo_pwm) {
    vehicle.setBrake(0, 0);
    vehicle.setBrake(0, 1);
    vehicle.setBrake(0, 2);
    vehicle.setBrake(0, 3);
    vehicle.applyEngineForce(-wheel_params.maxForce * l_pwm / 500, 2);
    vehicle.applyEngineForce(-wheel_params.maxForce * r_pwm / 500, 3);
    vehicle.setSteeringValue(-wheel_params.maxSteerVal * servo_pwm / 500, 0);
    vehicle.setSteeringValue(-wheel_params.maxSteerVal * servo_pwm / 500, 1);
}

function handler(event){

    var up = (event.type =='keyup');

    if (!up && event.type !== 'keydown'){
        return;
    }
    vehicle.setBrake(0, 0);
    vehicle.setBrake(0, 1);
    vehicle.setBrake(0, 2);
    vehicle.setBrake(0, 3);

    switch(event.keyCode){

    case 87://forward
    vehicle.applyEngineForce(up ? 0 : -wheel_params.maxForce, 2);
    vehicle.applyEngineForce(up ? 0 : -wheel_params.maxForce, 3);
    break;

    case 83: //backward
    
    vehicle.applyEngineForce(up ? 0 : wheel_params.maxForce, 2);
    vehicle.applyEngineForce(up ? 0: wheel_params.maxForce, 3);
    break;

    case 68: //right
    vehicle.setSteeringValue(up ? 0 : -wheel_params.maxSteerVal, 0);
    vehicle.setSteeringValue(up ? 0 : -wheel_params.maxSteerVal, 1);
    break;

    case 65: //left
    vehicle.setSteeringValue(up ? 0 : wheel_params.maxSteerVal, 0);
    vehicle.setSteeringValue(up ? 0 : wheel_params.maxSteerVal, 1);
    break;


    
    }


    
}

world.addEventListener('postStep', function(){
    for (let i=0; i<vehicle.wheelInfos.length; i++) {
        vehicle.updateWheelTransform(i);
        let t = vehicle.wheelInfos[i].worldTransform;
        wheels_bodies[i].position.copy(t.position);
        wheels_bodies[i].quaternion.copy(t.quaternion);
        wheels[i].position.copy(t.position);
        wheels[i].quaternion.copy(t.quaternion);
    }
});

const car_reset = () => {
    car_body.position.set(control.car_position.position[0] , 5, control.car_position.position[2]);
    car_body.quaternion.set(...control.car_position.quaternion);
    car_body.velocity.set(0, 0, 0);
    car_body.angularVelocity.set(0, 0, 0);
}

function updatePhysics() {
    world.step(1/60);
    ground.position.copy(ground_body.position);
    ground.quaternion.copy(ground_body.quaternion);
    if (group.position.y < -10 || group.rotation.x > 1.5) 
        car_reset();
    group.position.copy(car_body.position);
    group.quaternion.copy(car_body.quaternion);
}

function sendMat() {
    if (worker_ready) {
        let gl = fpv_canvas.getContext('webgl');
        let pixels = new Uint8Array(fpv_canvas.width*fpv_canvas.height*4);
        gl.readPixels(0, 0, fpv_canvas.width, fpv_canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let imgData = new ImageData(new Uint8ClampedArray(pixels),fpv_canvas.width,fpv_canvas.height);
        worker?.postMessage({type:"img",data:imgData});
        worker_ready = false;
    }
}
// lil-gui
const gui = new lil.GUI();
const control = {
    bg_color: scene.background.getHex(),
    car_position: {
        position: [car_body.position.x, car_body.position.y, car_body.position.z],
        quaternion: [car_body.quaternion.x, car_body.quaternion.y, car_body.quaternion.z, car_body.quaternion.w]
    },
    car_begin: function() {
        alert('请使用键盘控制车辆移动到初始位置, 完成后点击鼠标右键保存');
        document.oncontextmenu = function(e) {
            control.car_position.position = [car_body.position.x, car_body.position.y, car_body.position.z];
            control.car_position.quaternion = [car_body.quaternion.x, car_body.quaternion.y, car_body.quaternion.z, car_body.quaternion.w];
            document.oncontextmenu = null;
            alert('保存成功');
        }
    },
    get_path: () => {
        let fileDom = document.getElementById('file');
        let files = fileDom.files;
        fileDom.outerHTML = fileDom.outerHTML;
        if (files.length == 0) return;
        if (files[0].type.split('/')[0] != "image") {
            print("[ERROR] 图片类型错误\n");
            return;
        };
        let reader = new FileReader();
        reader.onload = () => loader.load(reader.result, texture => {
            let size = prompt("请输入地图尺寸:长x宽(单位:cm)", "500x500");
            if (size == null) return;
            if (size.split('x').length != 2 || !parseInt(size.split('x')[0]) || !parseInt(size.split('x')[1])) {
                print("[ERROR] 地图尺寸错误\n");
                return;
            };
            ground.material.map = texture;
            ground.scale.set(parseInt(size.split('x')[1]) / 500, parseInt(size.split('x')[0]) / 500, 1);
            ground_body.shapes[0] = new CANNON.Box(new CANNON.Vec3(parseInt(size.split('x')[1]) / 2, parseInt(size.split('x')[0]) / 2, 0.5));
        }, undefined, err => print("[ERROR] 图片加载失败\n"));
        reader.readAsDataURL(files[0]);
    },
    loader: () => document.getElementById('file').click(),
    fpv_resolution: '320x240',
    fpv_resolution_data: [320, 240],
    fpv_height: car_size.pole_height,
    fpv_helper: false,
    fpv_degree: (2 * Math.PI - car_size.fpv_degree) / Math.PI * 180,
    fpv_fov: 75,
    fullscreen: function() {
        if (document.fullscreenElement) {
            fullscreen.name('全屏模式');
            document.exitFullscreen();
        } else {
            fullscreen.name('退出全屏');
            document.documentElement.requestFullscreen();
        }
    },
    chart: () => (chartDom.hidden = !chartDom.hidden) ? chart.name('打开示波器') : chart.name('关闭示波器'),
    open: false,
    editor: () => {
        if (!(control.open = !control.open)) {
            code.name("打开编辑器");
            simulator.style.width = window.innerWidth;
        } else {
            code.name("关闭编辑器");
            simulator.style.width = .7 * window.innerWidth;
        }
    },
    stop_flag: false,
    stop: () => (control.stop_flag = !control.stop_flag) ? stop.name('继续') : stop.name('暂停'),
    reset: () => car_reset() || chart_reset() || drive(0, 0, 0),
    view: () => window.open("https://gitee.com/guidons/simulator")
}
const car_settings = gui.addFolder('车辆参数').close();
car_settings.add(control, 'car_begin').name('设置初始位置');
car_settings.add(car_size, 'mass', 0, 5).name('质量(kg)').step(.1).onChange( value => car_body.mass = value );
car_settings.add(wheel_params, 'maxForce', 0, 20).step(.1).name('电机最大功率');
car_settings.add(wheel_params, 'maxSteerVal', 0, 1.5).step(.1).name('舵机最大转角');
car_settings.add(wheel_params, 'frictionSlip', 0, 50).step(1).name('摩擦系数').onChange( value => {
    for (let wheel of vehicle.wheelInfos) wheel.frictionSlip = value;
});
car_settings.add(wheel_params, 'rollInfluence', 0, 5).step(.01).name('转向惯性').onChange( value => {
    for (let wheel of vehicle.wheelInfos) wheel.rollInfluence = value;
});

const scene_settings = gui.addFolder('场景控制').close();
const ambientlight_settings = scene_settings.addFolder('环境光参数').close();
ambientlight_settings.addColor(light.ambient, 'color').name('颜色').onChange( value => ambientlight.color.setHex(value) );
ambientlight_settings.add(light.ambient, 'intensity', 0, 5).name('强度').step(.1).onChange( value => ambientlight.intensity = value );

const pointlight_settings = scene_settings.addFolder('点光源参数').close();
pointlight_settings.add(light.point, 'add').name('添加点光源');
remove = pointlight_settings.add(light.point, "remove").name("删除点光源").disable();
pointlight_settings.addColor(light.point, 'color').name('颜色').onChange( value => {
    pointlight.color.setHex(value);
    pointlight.children[0].material.color.setHex(value);
});
pointlight_settings.add(light.point, 'intensity', 0, 20).name('强度').step(.1).onChange( value => pointlight.intensity = value );
pointlight_settings.add(light.point, 'distance', 0, 1000).name('光线距离').step(10).onChange( value => pointlight.distance = value );
pointlight_settings.add(light.point, 'decay', 0, 20).name('衰退量').step(.1).onChange( value => pointlight.decay = value );

scene_settings.addColor(control, 'bg_color').name('背景颜色').onChange( value => scene.background.setHex(value) );
scene_settings.add(control, 'loader').name('导入地图');

const fpv_setting = gui.addFolder('相机参数').close();
fpv_setting.add(control, 'fpv_helper').name('辅助对象').onChange( value => value ? scene.add(fpv_helper) : scene.remove(fpv_helper) );
fpv_setting.add(control, 'fpv_height', 5, 50).name('高度(cm)').step(1).onChange( value => {
    pole.scale.y = value / pole.geometry.parameters.height;
    pole.position.set(0, 0, value / 2);
    fpv_camera.position.set(1, 0, value);
    fpv.position.z = value - 1.3 * Math.cos(control.fpv_degree * Math.PI / 180)
});
fpv_setting.add(control, 'fpv_degree', 1, 89).name('角度(°)').step(1).onChange( value => {
    fpv_camera.rotation.z = 2 * Math.PI - value * Math.PI / 180;
    fpv.position.set(1 + 1.3 * Math.sin(value * Math.PI / 180), 0, control.fpv_height - 1.3 * Math.cos(value * Math.PI / 180));
    xyz.position.set(1 + control.fpv_height * Math.tan(value * Math.PI / 180), 0, 0);
    fpv.lookAt(xyz.getWorldPosition());
});
fpv_setting.add(control, 'fpv_fov', 20, 150).name('垂直视野角度(°)').step(1).onChange( value => {
    fpv.fov = value;
    fpv.updateProjectionMatrix();
});
fpv_setting.add(control, 'fpv_resolution', ['480x360', '320x240', '160x120']).name("分辨率").onFinishChange(value => {
    control.fpv_resolution_data = [parseInt(value.split('x')[0]), parseInt(value.split('x')[1])];
    fpv_canvas.width = control.fpv_resolution_data[0];
    fpv_canvas.height = control.fpv_resolution_data[1];
    fpv_renderer.setSize( fpv_canvas.width, fpv_canvas.height );
    fpv_img.width = fpv_canvas.width;
    fpv_img.height = fpv_canvas.height;
    fpv_canvas.updatePosition();
});

const dom_setting = gui.addFolder('界面控制').close();
const chart = dom_setting.add(control, 'chart');
const code = dom_setting.add(control, 'editor');
const fullscreen = dom_setting.add(control, 'fullscreen');
const stop = gui.add(control, 'stop');
gui.add(control, 'reset').name('重置');
gui.add(control, 'view').name("项目源码");
chart.name('关闭示波器');
code.name('关闭编辑器');
fullscreen.name('全屏模式');
stop.name('暂停');
gui.domElement.style = "position: relative; bottom: 100%; margin-left: auto; right: 0px; top: auto";
simulator.appendChild(gui.domElement);
gui.close();
// resize-event
function onLeftResize() {
    camera.aspect = simulator.offsetWidth / simulator.offsetHeight;
    camera.updateProjectionMatrix();
    fpv_renderer.setSize( fpv_canvas.width, fpv_canvas.height );
    fpv.updateProjectionMatrix();
    renderer.setSize( simulator.offsetWidth, simulator.offsetHeight );
    pidChart.resize({
        width: simulator.offsetWidth * .3,
        height: simulator.offsetWidth * .24,
    });
    fpv_canvas.updatePosition();
}
function onRightResize() {
    editor.resize();
}
// main-loop
const last = new Uint16Array(4);
(function animate () {
    requestAnimationFrame( animate );
    if (!control.stop_flag) updatePhysics();
    controls.update();
    //renderer.setViewport(0, 0, simulator.offsetWidth, simulator.offsetHeight);
    renderer.render( scene, camera );
    fpv_renderer.render( scene, fpv );
    sendMat();
    // renderer.setScissorTest( true );
    // renderer.setScissor(simulator.offsetWidth-control.fpv_resolution_data[0]-10, 10, 
    //     control.fpv_resolution_data[0], control.fpv_resolution_data[1]);
    // renderer.setViewport(simulator.offsetWidth-control.fpv_resolution_data[0]-10, 10, 
    //     control.fpv_resolution_data[0], control.fpv_resolution_data[1]);
    // renderer.render( scene, fpv );
    // renderer.setScissorTest( false );
    stats.update();
    if (simulator.offsetWidth != last[0] || simulator.offsetHeight != last[1]) onLeftResize();
    if (editorDom.offsetWidth != last[2] || editorDom.offsetHeight != last[3]) onRightResize();
    last[0] = simulator.offsetWidth;
    last[1] = simulator.offsetHeight;
    last[2] = editorDom.offsetWidth;
    last[3] = editorDom.offsetHeight;
})();