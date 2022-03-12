// self
var _img, _lock = false, _date = new Date(), _show = false, _str = "", _model = _weights = _label = null; 
const _time = _date.getTime();
delete _date;
function _imageDataVRevert(sourceData, newData) {
    for (var i = 0, h = sourceData.height; i < h; i++) {
      for (var j = 0, w = sourceData.width; j < w; j++) {
        newData.data[i * w * 4 + j * 4 + 0] =
          sourceData.data[(h - i) * w * 4 + j * 4 + 0];
        newData.data[i * w * 4 + j * 4 + 1] =
          sourceData.data[(h - i) * w * 4 + j * 4 + 1];
        newData.data[i * w * 4 + j * 4 + 2] =
          sourceData.data[(h - i) * w * 4 + j * 4 + 2];
        newData.data[i * w * 4 + j * 4 + 3] =
          sourceData.data[(h - i) * w * 4 + j * 4 + 3];
      }
    }
}

function _imageDataHRevert(sourceData, newData) {
    for (var i = 0, h = sourceData.height; i < h; i++) {
      for (j = 0, w = sourceData.width; j < w; j++) {
        newData.data[i * w * 4 + j * 4 + 0] =
          sourceData.data[i * w * 4 + (w - j) * 4 + 0];
        newData.data[i * w * 4 + j * 4 + 1] =
          sourceData.data[i * w * 4 + (w - j) * 4 + 1];
        newData.data[i * w * 4 + j * 4 + 2] =
          sourceData.data[i * w * 4 + (w - j) * 4 + 2];
        newData.data[i * w * 4 + j * 4 + 3] =
          sourceData.data[i * w * 4 + (w - j) * 4 + 3];
      }
    }
}

function _imageDataFromMat(mat) {
    // convert the mat type to cv.CV_8U
    const img = new cv.Mat();
    const depth = mat.type() % 8
    const scale =
      depth <= cv.CV_8S ? 1.0 : depth <= cv.CV_32S ? 1.0 / 256.0 : 255.0
    const shift = depth === cv.CV_8S || depth === cv.CV_16S ? 128.0 : 0.0
    mat.convertTo(img, cv.CV_8U, scale, shift)
  
    // convert the img type to cv.CV_8UC4
    switch (img.type()) {
      case cv.CV_8UC1:
        cv.cvtColor(img, img, cv.COLOR_GRAY2RGBA)
        break
      case cv.CV_8UC3:
        cv.cvtColor(img, img, cv.COLOR_RGB2RGBA)
        break
      case cv.CV_8UC4:
        break
      default:
        throw new Error(
          'Bad number of channels (Source image must have 1, 3 or 4 channels)'
        )
    }
    const clampedArray = new ImageData(
      new Uint8ClampedArray(img.data),
      img.cols,
      img.rows
    )
    img.delete()
    return clampedArray;
}

function _waitForOpencv(callbackFn, waitTimeMs = 30000, stepTimeMs = 100) {
    if (cv.Mat && _img) callbackFn(true)
    let timeSpentMs = 0
    const interval = setInterval(() => {
      const limitReached = timeSpentMs > waitTimeMs
      if (cv.Mat || limitReached) {
        clearInterval(interval)
        return callbackFn(!limitReached)
      } else {
        timeSpentMs += stepTimeMs
      }
    }, stepTimeMs);
}
 
const _flush = () => {
  if (_str.length > 0) {
    self.postMessage({type:"log",data:_str});
    _str = "";
  }
}

self.importScripts('./libs/opencv/opencv.min.js');

// API
const loop_ms = (() => {
    let ms = 50;
    return value => {
        if (value > 0) {
            ms = value;
            return;
        };
        if (value == "get") {
            return ms;
        }
        throw "loop_ms: parameter must be a number greater than 0";
    };
})();
const print = msg => _str += msg;
const get_img = () => {
    self.postMessage({type:"get"})
    return _img;
};
get_img();
const img2Mat = img => {
    if (!(img instanceof ImageData)) throw "img2Mat: parameter must be a ImageData";
    let newData = new ImageData(
        new Uint8ClampedArray(img.data),
        img.width,
        img.height
    )
    _imageDataVRevert(img, newData);
    return cv.matFromImageData(newData);
}
const img_show = img => {
    if (!(img instanceof cv.Mat)) throw "img_show: parameter must be a cv.Mat";
    if (_show) self.postMessage({type:"img",data:_imageDataFromMat(img)})
};
const control = (l_pwm, r_pwm, servo_pwm = 0) => {
    if (!(l_pwm >= -500 && l_pwm <= 500 && r_pwm >= -500 && r_pwm <= 500 && servo_pwm >= -500 && servo_pwm <= 500))
        throw "control: parameters must be between -500 and 500";
    self.postMessage({type:"control",data:[l_pwm, r_pwm, servo_pwm]});
}
const pid_show = (data, target = 0) => {
    if (typeof data !== "number" || typeof target !== "number")
        throw "pid_show: parameters must be a Number";
    let date = new Date();
    self.postMessage({type:"pid",data:[date.getTime()-_time,data],target:target});
}
const get_label = () => {
    if (_label instanceof Array) return _label;
    return [];
}
const get_model = () => {
    if ((_model instanceof File)&&(_weights instanceof File)) return [_model,_weights];
    return []
}
// listener
self.addEventListener('message', _msg => {
    _msg = _msg.data;
    switch (_msg.type) {
        case 'code': 
            if (_lock) return;
            _lock = true;
            _waitForOpencv(function (success) {
                if (success)
                    try { 
                        eval(_msg.data + "setup();_flush();setInterval(()=>loop()||_flush(),loop_ms('get'))");
                    } catch (e) {
                        self.postMessage({type:"error",data:e});
                        _lock = false;
                    }
                else 
                    throw "OpenCV not loaded";
            })
            break;
        case 'img':
            _img = _msg.data;
            break;
        case 'show':
            _show = _msg.data;
            break;
        case 'model':
            _model = _msg.data;
            break;
        case 'weights':
            _weights = _msg.data;
            break;
        case 'label':
            _label = _msg.data;
            break;
        default: break;
    }
}, false);