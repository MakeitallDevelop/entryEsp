function Module() {
  this.sp = null;
  this.sensorTypes = {
    ALIVE: 0,
    DIGITAL: 1,
    ANALOG: 2,
    PWM: 3,
    SERVO: 4,
    TONE: 5,
    PULSEIN: 6,
    ULTRASONIC: 7,
    TIMER: 8,
    READ_BLUETOOTH: 9,
    WRITE_BLUETOOTH: 10,
    LCD: 11,
    LCDCLEAR: 12,
    RGBLED: 13,
    DCMOTOR: 14,
    OLED: 15,
    PIR: 16,
    LCDINIT: 17,
    DHTHUMI: 18,
    DHTTEMP: 19,
    NEOPIXELINIT: 20,
    NEOPIXELBRIGHT: 21,
    NEOPIXEL: 22,
    NEOPIXELALL: 23,
    NEOPIXELCLEAR: 24,
    MP3INIT: 30,
    MP3PLAY1: 31,
    MP3PLAY2: 32,
    MP3VOL: 33,
    OLEDTEXT: 34,
    TOUCH: 35,
    GYRO_X: 36,
    GYRO_Y: 37,
    GYRO_Z: 38,
  };

  this.actionTypes = {
    GET: 1,
    SET: 2,
    MODUEL: 3,
    RESET: 4,
  };

  this.sensorValueSize = {
    FLOAT: 2,
    SHORT: 3,
    STRING: 4,
  };

  this.digitalPortTimeList = [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ];

  this.sensorData = {
    ULTRASONIC: {
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
      7: 0,
      8: 0,
      9: 0,
      10: 0,
      11: 0,
      12: 0,
      13: 0,
    },
    DHTTEMP: 0,
    DHTHUMI: 0,
    TOUCH: 0,
    DIGITAL: {
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
      7: 0,
      8: 0,
      9: 0,
      10: 0,
      11: 0,
      12: 0,
      13: 0,
    },
    ANALOG: {
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
      7: 0,
      8: 0,
      9: 0,
      10: 0,
      11: 0,
      12: 0,
      13: 0,
      14: 0,
      15: 0,
      16: 0,
      17: 0,
      18: 0,
      19: 0,
      20: 0,
      21: 0,
      22: 0,
      23: 0,
      24: 0,
      25: 0,
      26: 0,
      27: 0,
      28: 0,
      29: 0,
      30: 0,
      31: 0,
      31: 0,
      32: 0,
      33: 0,
      34: 0,
      35: 0,
      36: 0,
      37: 0,
      38: 0,
      39: 0,
    },
    PULSEIN: {},
    TIMER: 0,
    GYRO_X: 0,
    GYRO_Y: 0,
    GYRO_Z: 0,
  };

  this.defaultOutput = {};

  this.recentCheckData = {};

  this.sendBuffers = [];

  this.lastTime = 0;
  this.lastSendTime = 0;
  this.isDraing = false;
}

let sensorIdx = 0;

Module.prototype.init = function (handler, config) {};

Module.prototype.setSerialPort = function (sp) {
  const self = this;
  this.sp = sp;
  // sp.set({ dtr: false, rts: true });
  // sp.set({ dtr: false, rts: false });
};
Module.prototype.requestInitialData = function (sp) {
  // jikko 그대로 했을 때
  // 이 함수 때문에 펌웨어 무한업로드 문제 발생
  this.sp = sp;
  sp.set({ dtr: false, rts: true });
  sp.set({ dtr: false, rts: false });

  return true;
};

Module.prototype.checkInitialData = function (data, config) {
  return true;
  // 이후에 체크 로직 개선되면 처리
  // var datas = this.getDataByBuffer(data);
  // var isValidData = datas.some(function (data) {
  //     return (data.length > 4 && data[0] === 255 && data[1] === 85);
  // });
  // return isValidData;
};

Module.prototype.afterConnect = function (that, cb) {
  that.connected = true;
  if (cb) {
    cb("connected");
  }
};

Module.prototype.validateLocalData = function (data) {
  return true;
};

Module.prototype.requestRemoteData = function (handler) {
  const self = this;
  if (!self.sensorData) {
    return;
  }
  Object.keys(this.sensorData).forEach((key) => {
    if (self.sensorData[key] != undefined) {
      handler.write(key, self.sensorData[key]);
    }
  });
};

Module.prototype.handleRemoteData = function (handler) {
  const self = this;
  const getDatas = handler.read("GET");
  const setDatas = handler.read("SET") || this.defaultOutput;
  const time = handler.read("TIME");
  let buffer = new Buffer([]);
  if (getDatas) {
    const keys = Object.keys(getDatas);
    keys.forEach((key) => {
      let isSend = false;
      const dataObj = getDatas[key];
      if (
        typeof dataObj.port === "string" ||
        typeof dataObj.port === "number"
      ) {
        const time = self.digitalPortTimeList[dataObj.port];
        if (dataObj.time > time) {
          isSend = true;
          self.digitalPortTimeList[dataObj.port] = dataObj.time;
        }
      } else if (Array.isArray(dataObj.port)) {
        isSend = dataObj.port.every((port) => {
          const time = self.digitalPortTimeList[port];
          return dataObj.time > time;
        });

        if (isSend) {
          dataObj.port.forEach((port) => {
            self.digitalPortTimeList[port] = dataObj.time;
          });
        }
      }

      if (isSend) {
        if (!self.isRecentData(dataObj.port, key, dataObj.data)) {
          self.recentCheckData[dataObj.port] = {
            type: key,
            data: dataObj.data,
          };
          buffer = Buffer.concat([
            buffer,
            self.makeSensorReadBuffer(key, dataObj.port, dataObj.data),
          ]);
        }
      }
    });
  }

  if (setDatas) {
    const setKeys = Object.keys(setDatas);
    setKeys.forEach((port) => {
      const data = setDatas[port];
      if (data) {
        if (self.digitalPortTimeList[port] < data.time) {
          self.digitalPortTimeList[port] = data.time;

          if (!self.isRecentData(port, data.type, data.data)) {
            self.recentCheckData[port] = {
              type: data.type,
              data: data.data,
            };
            buffer = Buffer.concat([
              buffer,
              self.makeOutputBuffer(data.type, port, data.data),
            ]);
          }
        }
      }
    });
  }
  if (buffer.length) {
    this.sendBuffers.push(buffer);
  }
};

Module.prototype.isRecentData = function (port, type, data) {
  var that = this;
  var isRecent = false;

  if (type == this.sensorTypes.ULTRASONIC) {
    var portString = port.toString();
    var isGarbageClear = false;
    Object.keys(this.recentCheckData).forEach(function (key) {
      var recent = that.recentCheckData[key];
      if (key === portString) {
      }
      if (key !== portString && recent.type == that.sensorTypes.ULTRASONIC) {
        delete that.recentCheckData[key];
        isGarbageClear = true;
      }
    });

    if (
      (port in this.recentCheckData && isGarbageClear) ||
      !(port in this.recentCheckData)
    ) {
      isRecent = false;
    } else {
      isRecent = true;
    }
  } else if (port in this.recentCheckData && type != this.sensorTypes.TONE) {
    if (
      this.recentCheckData[port].type === type &&
      this.recentCheckData[port].data === data
    ) {
      isRecent = true;
    }
  }

  return isRecent;
};

Module.prototype.requestLocalData = function () {
  const self = this;

  if (!this.isDraing && this.sendBuffers.length > 0) {
    this.isDraing = true;
    this.sp.write(this.sendBuffers.shift(), () => {
      if (self.sp) {
        self.sp.drain(() => {
          self.isDraing = false;
        });
      }
    });
  }

  return null;
};

/*
ff 55 idx size data a
*/
Module.prototype.handleLocalData = function (data) {
  const self = this;
  const datas = this.getDataByBuffer(data);

  datas.forEach((data) => {
    if (data.length <= 4 || data[0] !== 255 || data[1] !== 85) {
      return;
    }

    const readData = data.subarray(2, data.length);
    let value;
    switch (readData[0]) {
      case self.sensorValueSize.FLOAT: {
        value = new Buffer(readData.subarray(1, 5)).readFloatLE();
        value = Math.round(value * 100) / 100;
        break;
      }
      case self.sensorValueSize.SHORT: {
        value = new Buffer(readData.subarray(1, 3)).readInt16LE();
        break;
      }
      case self.sensorValueSize.STRING: {
        value = new Buffer(readData[1] + 3);
        value = readData.slice(2, readData[1] + 3);
        // value = value.toString('ascii', 0, value.length);
        value = value.toString();
        break;
      }
      default: {
        value = 0;
        break;
      }
    }

    const type = readData[readData.length - 1];
    const port = readData[readData.length - 2];

    switch (type) {
      case self.sensorTypes.ANALOG: {
        self.sensorData.ANALOG[port] = value;
        break;
      }
      case self.sensorTypes.TOUCH: {
        self.sensorData.TOUCH = value;
        // console.log('touch value:');
        // console.log(value);
        break;
      }
      case self.sensorTypes.DHTTEMP: {
        self.sensorData.DHTTEMP = value;
        break;
      }
      case self.sensorTypes.DHTHUMI: {
        self.sensorData.DHTHUMI = value;
        break;
      }
      case self.sensorTypes.ULTRASONIC: {
        self.sensorData.ULTRASONIC[port] = value;
        // console.log(value);
        // console.log(self.sensorData.ULTRASONIC[port]);
      }
      case self.sensorTypes.GYRO_X: {
        self.sensorData.GYRO_X = value;
        console.log("Gyro X");
        console.log(value);
        break;
      }
      case self.sensorTypes.GYRO_Y: {
        self.sensorData.GYRO_Y = value;
        console.log("Gyro Y");
        console.log(value);
        break;
      }
      case self.sensorTypes.GYRO_Z: {
        self.sensorData.GYRO_Z = value;
        console.log("Gyro Z");
        console.log(value);
        break;
      }
      /*
    case self.sensorTypes.DIGITAL: {
      self.sensorData.DIGITAL[port] = value;
      break;
    }
    case self.sensorTypes.ANALOG: {
      self.sensorData.ANALOG[port] = value;
      break;
    }
    case self.sensorTypes.PULSEIN: {
      self.sensorData.PULSEIN[port] = value;
      break;
    }

 
    case self.sensorTypes.TIMER: {
      self.sensorData.TIMER = value;
      break;
    }
    */
      default: {
        break;
      }
    }
  });
};

/*
ff 55 len idx action device port  slot  data a
0  1  2   3   4      5      6     7     8
*/

Module.prototype.makeSensorReadBuffer = function (device, port, data) {
  let buffer;
  const dummy = new Buffer([10]);
  if (device == this.sensorTypes.DIGITAL) {
    //data 2: pull up, 0: normal
    if (!data) {
      buffer = new Buffer([
        255,
        85,
        6,
        sensorIdx,
        this.actionTypes.GET,
        device,
        port,
        0,
        10,
      ]);
    } else {
      //pullup인 경우
      buffer = new Buffer([
        255,
        85,
        6,
        sensorIdx,
        this.actionTypes.GET,
        device,
        port,
        data,
        10,
      ]);
    }
    //console.log(buffer);
  } else if (device == this.sensorTypes.TOUCH) {
    buffer = new Buffer([
      255,
      85,
      5,
      sensorIdx,
      this.actionTypes.GET,
      device,
      port,
      10,
    ]);
  } else if (device == this.sensorTypes.ULTRASONIC) {
    buffer = new Buffer([
      255,
      85,
      6,
      sensorIdx,
      this.actionTypes.GET,
      device,
      port[0],
      port[1],
      10,
    ]);
  } else if (device == this.sensorTypes.DHTTEMP) {
    buffer = new Buffer([
      255,
      85,
      5,
      sensorIdx,
      this.actionTypes.GET,
      device,
      port,
      10,
    ]);
  } else if (device == this.sensorTypes.DHTHUMI) {
    buffer = new Buffer([
      255,
      85,
      5,
      sensorIdx,
      this.actionTypes.GET,
      device,
      port,
      10,
    ]);
  } else if (device == this.sensorTypes.ANALOG) {
    buffer = new Buffer([
      255,
      85,
      5,
      sensorIdx,
      this.actionTypes.GET,
      device,
      port,
      10,
    ]);
  } else if (device == this.sensorTypes.GYRO_X) {
    buffer = new Buffer([
      255,
      85,
      5,
      sensorIdx,
      this.actionTypes.GET,
      device,
      port,
      10,
    ]);
    console.log(buffer);
  } else if (device == this.sensorTypes.GYRO_Y) {
    buffer = new Buffer([
      255,
      85,
      5,
      sensorIdx,
      this.actionTypes.GET,
      device,
      port,
      10,
    ]);
  } else if (device == this.sensorTypes.GYRO_Z) {
    buffer = new Buffer([
      255,
      85,
      5,
      sensorIdx,
      this.actionTypes.GET,
      device,
      port,
      10,
    ]);
  } else if (!data) {
    buffer = new Buffer([
      255,
      85,
      5,
      sensorIdx,
      this.actionTypes.GET,
      device,
      port,
      10,
    ]);
  } else {
    value = new Buffer(2);
    value.writeInt16LE(data);
    buffer = new Buffer([
      255,
      85,
      7,
      sensorIdx,
      this.actionTypes.GET,
      device,
      port,
      10,
    ]);
    buffer = Buffer.concat([buffer, value, dummy]);
  }
  sensorIdx++;
  if (sensorIdx > 254) {
    sensorIdx = 0;
  }

  return buffer;
};

//0xff 0x55 0x6 0x0 0x1 0xa 0x9 0x0 0x0 0xa
Module.prototype.makeOutputBuffer = function (device, port, data) {
  let buffer;
  const value = new Buffer(2);
  const dummy = new Buffer([10]);
  switch (device) {
    case this.sensorTypes.SERVO: {
      value.writeInt16LE(data);
      buffer = new Buffer([
        255,
        85,
        6,
        sensorIdx,
        this.actionTypes.SET,
        device,
        port,
      ]);
      buffer = Buffer.concat([buffer, value, dummy]);
      break;
    }
    case this.sensorTypes.DIGITAL: {
      value.writeInt16LE(data);
      buffer = new Buffer([
        255,
        85,
        6,
        sensorIdx,
        this.actionTypes.SET,
        device,
        port,
      ]);
      buffer = Buffer.concat([buffer, value, dummy]);
      break;
    }

    /*
case this.sensorTypes.PWM: {
  value.writeInt16LE(data);
  buffer = new Buffer([
    255,
    85,
    6,
    sensorIdx,
    this.actionTypes.SET,
    device,
    port,
  ]);
  buffer = Buffer.concat([buffer, value, dummy]);
  break;
}
case this.sensorTypes.RESET_: {
  buffer = new Buffer([
    255,
    85,
    4,
    sensorIdx,
    this.actionTypes.SET,
    device,
    port,
  ]);
  buffer = Buffer.concat([buffer, dummy]);
  break;
}
case this.sensorTypes.TONE: {
  const time = new Buffer(2);
  if ($.isPlainObject(data)) {
    value.writeInt16LE(data.value);
    time.writeInt16LE(data.duration);
  } else {
    value.writeInt16LE(0);
    time.writeInt16LE(0);
  }
  buffer = new Buffer([
    255,
    85,
    8,
    sensorIdx,
    this.actionTypes.SET,
    device,
    port,
  ]);
  buffer = Buffer.concat([buffer, value, time, dummy]);
  break;
}
case this.sensorTypes.DCMOTOR: {
  const directionPort = new Buffer(2);
  const speedPort = new Buffer(2);
  const directionValue = new Buffer(2);
  const speedValue = new Buffer(2);
  if ($.isPlainObject(data)) {
    directionPort.writeInt16LE(data.port0);
    speedPort.writeInt16LE(data.port1);
    directionValue.writeInt16LE(data.value0);
    speedValue.writeInt16LE(data.value1);
  } else {
    directionPort.writeInt16LE(0);
    speedPort.writeInt16LE(0);
    directionValue.writeInt16LE(0);
    speedValue.writeInt16LE(0);
  }
  buffer = new Buffer([
    255,
    85,
    12,
    sensorIdx,
    this.actionTypes.SET,
    device,
    port,
  ]);
  buffer = Buffer.concat([
    buffer,
    directionPort,
    speedPort,
    directionValue,
    speedValue,
    dummy,
  ]);
  break;
}
*/
    case this.sensorTypes.NEOPIXELINIT: {
      console.log("NEOPIXELINIT");
      value.writeInt16LE(data);
      buffer = new Buffer([
        255,
        85,
        6,
        sensorIdx,
        this.actionTypes.SET,
        device,
        port,
      ]);
      buffer = Buffer.concat([buffer, value, dummy]);
      break;
    }
    case this.sensorTypes.NEOPIXELBRIGHT: {
      value.writeInt16LE(data);
      buffer = new Buffer([
        255,
        85,
        6,
        sensorIdx,
        this.actionTypes.SET,
        device,
        port,
      ]);
      buffer = Buffer.concat([buffer, value, dummy]);
      break;
    }
    case this.sensorTypes.NEOPIXEL: {
      const num = new Buffer(2);
      const r = new Buffer(2);
      const g = new Buffer(2);
      const b = new Buffer(2);
      if ($.isPlainObject(data)) {
        num.writeInt16LE(data.num);
        r.writeInt16LE(data.r);
        g.writeInt16LE(data.g);
        b.writeInt16LE(data.b);
      } else {
        num.writeInt16LE(0);
        r.writeInt16LE(0);
        g.writeInt16LE(0);
        b.writeInt16LE(0);
      }
      buffer = new Buffer([
        255,
        85,
        12,
        sensorIdx,
        this.actionTypes.SET,
        device,
        port,
      ]);
      buffer = Buffer.concat([buffer, num, r, g, b, dummy]);
      break;
    }
    case this.sensorTypes.NEOPIXELALL: {
      const r = new Buffer(2);
      const g = new Buffer(2);
      const b = new Buffer(2);
      if ($.isPlainObject(data)) {
        r.writeInt16LE(data.r);
        g.writeInt16LE(data.g);
        b.writeInt16LE(data.b);
      } else {
        r.writeInt16LE(0);
        g.writeInt16LE(0);
        b.writeInt16LE(0);
      }
      buffer = new Buffer([
        255,
        85,
        10,
        sensorIdx,
        this.actionTypes.SET,
        device,
        port,
      ]);
      buffer = Buffer.concat([buffer, r, g, b, dummy]);
      break;
    }
    case this.sensorTypes.NEOPIXELCLEAR: {
      buffer = new Buffer([
        255,
        85,
        4,
        sensorIdx,
        this.actionTypes.SET,
        device,
        port,
      ]);
      buffer = Buffer.concat([buffer, dummy]);
      break;
    }
    case this.sensorTypes.LCDINIT: {
      var list = new Buffer(2);
      var line = new Buffer(2);
      var col = new Buffer(2);
      if ($.isPlainObject(data)) {
        list.writeInt16LE(data.list);
        line.writeInt16LE(data.line);
        col.writeInt16LE(data.col);
      }
      buffer = new Buffer([
        255,
        85,
        10,
        sensorIdx,
        this.actionTypes.MODUEL,
        device,
        port,
      ]);
      buffer = Buffer.concat([buffer, list, col, line, dummy]);

      break;
    }
    case this.sensorTypes.LCDCLEAR: {
      buffer = new Buffer([
        255,
        85,
        4,
        sensorIdx,
        this.actionTypes.MODUEL,
        device,
        port,
      ]);
      buffer = Buffer.concat([buffer, dummy]);
      break;
    }
    case this.sensorTypes.LCD: {
      var text;
      var line = new Buffer(2);
      var col = new Buffer(2);
      var textLen = 0;
      var textLenBuf = Buffer(2);

      if ($.isPlainObject(data)) {
        textLen = ("" + data.text).length;
        // console.log(textLen);
        text = Buffer.from("" + data.text, "ascii");
        line.writeInt16LE(data.line);
        textLenBuf.writeInt16LE(textLen);
        col.writeInt16LE(data.column);
      } else {
        textLen = 0;
        text = Buffer.from("", "ascii");
        line.writeInt16LE(0);
        textLenBuf.writeInt16LE(textLen);
        col.writeInt16LE(0);
      }

      buffer = new Buffer([
        255,
        85,
        4 + 6 + textLen,
        sensorIdx,
        this.actionTypes.MODUEL,
        device,
        port,
      ]);

      buffer = Buffer.concat([buffer, line, col, textLenBuf, text, dummy]);
      break;
    }
    case this.sensorTypes.OLEDTEXT: {
      if ($.isPlainObject(data)) var oled_cmd = data.cmd;
      else oled_cmd = 1;
      var cmd = new Buffer(2);

      if (oled_cmd == 0) {
        //print
        var text;
        var line = new Buffer(2);
        var col = new Buffer(2);
        var textLen = 0;
        var textLenBuf = Buffer(2);

        if ($.isPlainObject(data)) {
          textLen = ("" + data.text).length;
          // console.log(textLen);
          text = Buffer.from("" + data.text, "ascii");
          line.writeInt16LE(data.line);
          textLenBuf.writeInt16LE(textLen);
          col.writeInt16LE(data.column);
          cmd.writeInt16LE(data.cmd);
        } else {
          textLen = 0;
          text = Buffer.from("", "ascii");
          line.writeInt16LE(0);
          textLenBuf.writeInt16LE(textLen);
          col.writeInt16LE(0);
          cmd.writeInt16LE(1);
        }

        buffer = new Buffer([
          255,
          85,
          4 + 8 + textLen,
          sensorIdx,
          this.actionTypes.MODUEL,
          device,
          port,
        ]);

        buffer = Buffer.concat([
          buffer,
          cmd,
          line,
          col,
          textLenBuf,
          text,
          dummy,
        ]);
        //   console.log(buffer);
      } else if (oled_cmd == 1) {
        //clear
        cmd.writeInt16LE(1);

        buffer = new Buffer([
          255,
          85,
          6,
          sensorIdx,
          this.actionTypes.MODUEL,
          device,
          port,
        ]);
        buffer = Buffer.concat([buffer, cmd, dummy]);
      } else if (oled_cmd == 2) {
        //size & color
        var size = new Buffer(2);
        var color = new Buffer(2);

        if ($.isPlainObject(data)) {
          size.writeInt16LE(data.size);
          color.writeInt16LE(data.color);
          cmd.writeInt16LE(data.cmd);
        } else {
          size.writeInt16LE(0);
          color.writeInt16LE(0);
          cmd.writeInt16LE(1);
        }

        buffer = new Buffer([
          255,
          85,
          10,
          sensorIdx,
          this.actionTypes.MODUEL,
          device,
          port,
        ]);
        buffer = Buffer.concat([buffer, cmd, size, color, dummy]);
      } else if (oled_cmd == 3) {
        cmd.writeInt16LE(3);

        buffer = new Buffer([
          255,
          85,
          6,
          sensorIdx,
          this.actionTypes.MODUEL,
          device,
          port,
        ]);
        buffer = Buffer.concat([buffer, cmd, dummy]);
      }
      break;
    }

    case this.sensorTypes.MP3INIT: {
      const tx = new Buffer(2);
      const rx = new Buffer(2);

      if ($.isPlainObject(data)) {
        tx.writeInt16LE(data.tx);
        rx.writeInt16LE(data.rx);
      } else {
        tx.writeInt16LE(0);
        rx.writeInt16LE(0);
      }

      buffer = new Buffer([
        255,
        85,
        8,
        sensorIdx,
        this.actionTypes.SET,
        device,
        port,
      ]);

      buffer = Buffer.concat([buffer, tx, rx, dummy]);
      break;
    }
    case this.sensorTypes.MP3PLAY1: {
      const tx = new Buffer(2);
      const num = new Buffer(2);

      if ($.isPlainObject(data)) {
        tx.writeInt16LE(data.tx);
        num.writeInt16LE(data.num);
      } else {
        tx.writeInt16LE(0);
        num.writeInt16LE(0);
      }

      buffer = new Buffer([
        255,
        85,
        8,
        sensorIdx,
        this.actionTypes.SET,
        device,
        port,
      ]);

      buffer = Buffer.concat([buffer, tx, num, dummy]);
      break;
    }
    case this.sensorTypes.MP3PLAY2: {
      const tx = new Buffer(2);
      const num = new Buffer(2);
      const time_value = new Buffer(2);

      if ($.isPlainObject(data)) {
        tx.writeInt16LE(data.tx);
        num.writeInt16LE(data.num);
        time_value.writeInt16LE(data.time_value);
      } else {
        tx.writeInt16LE(0);
        num.writeInt16LE(0);
        time_value.writeInt16LE(0);
      }

      buffer = new Buffer([
        255,
        85,
        10,
        sensorIdx,
        this.actionTypes.SET,
        device,
        port,
      ]);

      buffer = Buffer.concat([buffer, tx, num, time_value, dummy]);
      break;
    }
    case this.sensorTypes.MP3VOL: {
      const tx = new Buffer(2);
      const vol = new Buffer(2);

      if ($.isPlainObject(data)) {
        tx.writeInt16LE(data.tx);
        vol.writeInt16LE(data.vol);
      } else {
        tx.writeInt16LE(0);
        vol.writeInt16LE(0);
      }

      buffer = new Buffer([
        255,
        85,
        8,
        sensorIdx,
        this.actionTypes.SET,
        device,
        port,
      ]);

      buffer = Buffer.concat([buffer, tx, vol, dummy]);
      break;
    }
  }

  return buffer;
};

Module.prototype.getDataByBuffer = function (buffer) {
  const datas = [];
  let lastIndex = 0;
  buffer.forEach((value, idx) => {
    if (value == 13 && buffer[idx + 1] == 10) {
      datas.push(buffer.subarray(lastIndex, idx));
      lastIndex = idx + 2;
    }
  });

  return datas;
};

Module.prototype.disconnect = function (connect) {
  const self = this;
  connect.close();
  if (self.sp) {
    delete self.sp;
  }
};

Module.prototype.reset = function () {
  this.lastTime = 0;
  this.lastSendTime = 0;

  this.sensorData.PULSEIN = {};
};

Module.prototype.lostController = function () {};

module.exports = new Module();
