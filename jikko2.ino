#include "Servo_ESP32.h"
#include "Wire.h"
#include "LiquidCrystal_I2C.h"
#include "Adafruit_NeoPixel.h"
#include "dht.h"

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128 // OLED display width, in pixels
#define SCREEN_HEIGHT 64 // OLED display height, in pixels

// 핀 설정
#define ALIVE 0
#define DIGITAL 1
#define ANALOG 2
#define PWM 3
#define SERVO 4
#define TONE 5
#define PULSEIN 6
#define ULTRASONIC 7
#define TIMER 8
#define LCD 11
#define LCDCLEAR 12
#define DCMOTOR 14
#define PIR 16
#define LCDINIT 17
#define DHTHUMI 18
#define DHTTEMP 19
#define NEOPIXELINIT 20
#define NEOPIXELBRIGHT 21
#define NEOPIXEL 22
#define NEOPIXELALL 23
#define NEOPIXELCLEAR 24
#define DOTMATRIXINIT 25
#define DOTMATRIXBRIGHT 26
#define DOTMATRIX 27
#define DOTMATRIXEMOJI 28
#define DOTMATRIXCLEAR 29
#define MP3INIT 30
#define MP3PLAY1 31
#define MP3VOL 33
#define OLEDTEXT 34
#define TOUCH 35
#define GYRO_X 36
#define GYRO_Y 37
#define GYRO_Z 38

// State Constant
#define GET 1
#define SET 2
#define MODULE 3
#define RESET 4

// val Union
union
{
  byte byteVal[4];
  float floatVal;
  long longVal;
} val;

// valShort Union
union
{
  byte byteVal[2];
  short shortVal;
} valShort;

int analogs[40] = {
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
};

const int ledChannel_A = 0;
int freq = 5000;
int resolution = 8;

const int servoPin = 23; // 서보모터 핀
const int Channel = 13;  // 채널만 설정, 주파수와 해상도는 라이브러리안에 이미 설정이 되어 있습니다.

int pos = 0;   // 서보모터 0~180 각도안에서만 조작된다.
Servo myservo; // 서보모터 객체 생성
LiquidCrystal_I2C lcd(0x27, 16, 2);
Adafruit_NeoPixel strip = Adafruit_NeoPixel(4, 33, NEO_GRB + NEO_KHZ800);
Adafruit_SSD1306 display_oled(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

int oled_text_size = 1;
int oled_text_color = 0;

int touchPin = 0;
int trigPin = 13;
int echoPin = 12;
int lastUltrasonic = 0;

// 포트
int dhtPin = 0;
//dht
dht myDHT11;

int analogPin = 0;

// 자이로센서
long gyroX, gyroY, gyroZ;
float rotX, rotY, rotZ;

// Buffer
char buffer[52];
unsigned char prevc = 0;
byte idx = 0;
byte dataLen;

boolean isStart = false;
boolean isDHThumi = false;
boolean isDHTtemp = false;
boolean isTouch = false;
boolean isUltrasonic = false;
boolean isGyro_x = false;
boolean isGyro_y = false;
boolean isGyro_z = false;
boolean isStartOled = false;
uint8_t command_index = 0;

void setup()
{
  // myservo에 GPIO핀을 할당하는 함수
  Serial.begin(115200);
  Wire.begin();
  initLCD();
  initNeo();
  setupMPU();
}

void setupMPU()
{
  Wire.beginTransmission(0b1101000); //This is the I2C address of the MPU (b1101000/b1101001 for AC0 low/high datasheet sec. 9.2)
  Wire.write(0x6B);                  //Accessing the register 6B - Power Management (Sec. 4.28)
  Wire.write(0b00000000);            //Setting SLEEP register to 0. (Required; see Note on p. 9)
  Wire.endTransmission();
  Wire.beginTransmission(0b1101000); //I2C address of the MPU
  Wire.write(0x1B);                  //Accessing the register 1B - Gyroscope Configuration (Sec. 4.4)
  Wire.write(0x00000000);            //Setting the gyro to full scale +/- 250deg./s
  Wire.endTransmission();
  Wire.beginTransmission(0b1101000); //I2C address of the MPU
  Wire.write(0x1C);                  //Accessing the register 1C - Acccelerometer Configuration (Sec. 4.5)
  Wire.write(0b00000000);            //Setting the accel to +/- 2g
  Wire.endTransmission();
}

void initLCD()
{ //lcd 초기화
  lcd.init();
  lcd.backlight();
  lcd.clear();
}

void initNeo()
{
  strip.begin();
  strip.show();
}

void loop()
{
  while (Serial.available())
  {
    if (Serial.available() > 0)
    {
      char serialRead = Serial.read();
      setPinValue(serialRead & 0xff);
    }
  }
  delay(15);
  sendPinvalues();
  delay(10);
}

// 시리얼에서 읽어온 값을 버퍼에 읽어오고 파싱
void setPinValue(unsigned char c)
{
  // lcd.setCursor(0, 0);
  // lcd.print("setPinvalue");

  if (c == 0x55 && isStart == false)
  {
    if (prevc == 0xff)
    {
      idx = 1;
      isStart = true;
    }
  }
  else
  {
    prevc = c;
    if (isStart)
    {
      if (idx == 2)
      {
        dataLen = c;
      }
      else if (idx > 2)
      {
        dataLen--;
      }
      writeBuffer(idx, c); //버퍼에 읽어옴
    }
  }

  idx++;

  if (idx > 51)
  {
    idx = 0;
    isStart = false;
  }

  if (isStart && dataLen == 0 && idx > 3)
  {
    isStart = false;
    parseData(); //센서 케이스 별로 데이터 파싱
    idx = 0;
  }
}

/**
 * 버퍼의 index에 위치한 값 반환
 * @param int idx: 읽을 버퍼 인덱스
**/
unsigned char readBuffer(int idx)
{
  return buffer[idx];
}

/**
 * GET/SET/MODULE/RESET 분류
 * GET인 경우 해당 포트 셋팅
 * SET/MODULE인 경우 runSet/runMoudle 호출
 * 
 * [ Buffer ]
 * 0xff 0x55 bufLen sensorIdx actionType device port  data   data  ....
 *  0    1     2        3          4       5      6    7      9
 * sensorIdx: 센서 인덱스 => 사용안함.
 * actionType: get/set/moudule/reset
 * device: 센서 종류
 * port: 포트 번호
 * **/
void parseData()
{
  isStart = false;
  int idx = readBuffer(3);
  command_index = (uint8_t)idx;
  int action = readBuffer(4);
  int device = readBuffer(5);
  int port = readBuffer(6);

  switch (action) //actionType
  {
  case GET:
  { /*
    데이터를 받아와 값을 전송해야함 
    => 해당 함수에선 플래그 설정 및 setup()과 같이 핀모드 설정만 하고
    센서 작동 및 시리얼 전송은 sendPinValues()에서 실행
    */
    if (device == ULTRASONIC)
    {
      if (!isUltrasonic)
      {
        isUltrasonic = true;
        trigPin = readBuffer(6);
        echoPin = readBuffer(7);
        pinMode(trigPin, OUTPUT);
        pinMode(echoPin, INPUT);
        delay(50);
      }
      else
      {
        int trig = readBuffer(6);
        int echo = readBuffer(7);
        if (trig != trigPin || echo != echoPin)
        {
          trigPin = trig;
          echoPin = echo;
          pinMode(trigPin, OUTPUT);
          pinMode(echoPin, INPUT);
          delay(50);
        }
        }
        }
        else if(device == ANALOG)
        {
            analogPin = readBuffer(6);
            analogs[analogPin] = 1;
        }
    else if (device == DHTHUMI)
    {
      isDHThumi = true;
      dhtPin = readBuffer(6);
    }
    else if (device == DHTTEMP)
    {
      isDHTtemp = true;
      dhtPin = readBuffer(6);
    }
    else if (device == TOUCH)
    {
      isTouch = true;
      touchPin = readBuffer(6);
    }
    else if (device == GYRO_X)
    {
      isGyro_x = true;
    }
    else if (device == GYRO_Y)
    {
      isGyro_y = true;
    }
    else if (device == GYRO_Z)
    {
      isGyro_z = true;
    }
  }
  break;
  case SET: //센서에 출력해야하는 경우
  {
    runSet(device);
    callOK();
  }
  break;
  case MODULE: //LCD 작동
  {
    runModule(device);
    callOK();
  }
  break;
  case RESET:
  {
    callOK();
  }
  break;
  }
}

void runSet(int device)
{
  //0xff 0x55 0x6 0x0 0x1 0xa 0x9 0x0 0x0 0xa

  int port = readBuffer(6);
  unsigned char pin = port;

  // lcd.setCursor(0, 0);
  // lcd.print("runSet");

  switch (device)
  {

  case DIGITAL: //센서 셋팅
  {
    //setPortWritable(pin);
    int v = readBuffer(7);
    pinMode(port, OUTPUT);
    digitalWrite(port, v);
  }
  break;
  case SERVO:
  {
    int num = readBuffer(7);
    myservo.attach(pin);
    myservo.write(num);
    /*
        for(pos = 0; pos <= num; pos += 1){
            myservo.write(pos);
            delay(15);
        }
        */
    // setPortWritable(pin);
    // int v = readBuffer(7);
    // if (v >= 0 && v <= 180)
    // {
    //     sv = servos[searchServoPin(pin)];
    //     sv.attach(pin);
    //     sv.write(v);
  }
  break;
  case NEOPIXELINIT:
  {
    /*
    객체 재선언시 작동 안됨 -> ESP32에서만
    */
    // strip = Adafruit_NeoPixel(readBuffer(7), readBuffer(6), NEO_GRB + NEO_KHZ800);
    strip.setPin(readBuffer(6));
    strip.begin();
    strip.clear();
    strip.show();
  }
  break;
  case NEOPIXELBRIGHT:
  {
    int bright = readBuffer(7);
    //밝기 설정
    strip.setBrightness(bright);
  }
  break;
  case NEOPIXEL:
  {
    int num = readBuffer(7);
    int r = readBuffer(9);
    int g = readBuffer(11);
    int b = readBuffer(13);

    //data=0인 경우 초기화
    if (num == 0 && r == 0 && g == 0 && b == 0)
    {
      strip.setPixelColor(0, 0, 0, 0);
      strip.setPixelColor(1, 0, 0, 0);
      strip.setPixelColor(2, 0, 0, 0);
      strip.setPixelColor(3, 0, 0, 0);
      strip.show();
      strip.show();
      delay(50);
      break;
    }

    strip.setPixelColor(num, r, g, b);
    strip.show();
    strip.show();
  }
  break;
  case NEOPIXELALL:
  {
    int r = readBuffer(7);
    int g = readBuffer(9);
    int b = readBuffer(11);

    strip.setPixelColor(0, r, g, b);
    strip.setPixelColor(1, r, g, b);
    strip.setPixelColor(2, r, g, b);
    strip.setPixelColor(3, r, g, b);

    strip.show();
    strip.show();
  }
  break;
  case NEOPIXELCLEAR:
  {
    strip.clear();
    strip.show();
  }
  break;
  default:
    break;
  }
}

void runModule(int device)
{
  //0xff 0x55 0x6 0x0 0x1 0xa 0x9 0x0 0x0 0xa
  //head head                        pinNUM
  //                                      A/D

  int port = readBuffer(6);
  unsigned char pin = port;

  // lcd.setCursor(0, 0);
  // lcd.print("runModule");
  switch (device)
  {

  case LCDINIT:
  {                         //주소, column, line 순서
    if (readBuffer(7) == 0) //주소: 0x27
    {
      lcd = LiquidCrystal_I2C(0x27, readBuffer(9), readBuffer(11));
    }
    else //주소: 0x3f
    {
      lcd = LiquidCrystal_I2C(0x3f, readBuffer(9), readBuffer(11));
    }
    initLCD();
  }
  break;

  case LCDCLEAR:
  {
    lcd.clear();
  }
  break;

  case LCD:
  {
    int row = readBuffer(7);
    int column = readBuffer(9);
    int len = readBuffer(11);
    String txt = readString(len, 13);
    // lcd.setCursor(0, 1);
    // lcd.print(row);
    // lcd.setCursor(3, 1);
    // lcd.print(column);
    // lcd.setCursor(6, 1);
    // lcd.print(txt);
    // delay(100);
    // lcd.clear();
    if (len == 0) //data=0인 경우
    {
      lcd.init();
      lcd.clear();
      break;
    }

    lcd.setCursor(column, row);
    lcd.print(txt);
  }
  break;
  case OLEDTEXT:
  {
      if (!isStartOled)
    {
      display_oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);
      display_oled.clearDisplay();
      isStartOled = true;
    }

    int cmd = readBuffer(7);

    if (cmd == 2)
    { //text Size 읽어오기
      oled_text_size = readBuffer(9);
      oled_text_color = readBuffer(11);
    }

    if (cmd == 0) //print
    {

      int row = readBuffer(9);
      int column = readBuffer(11);
      int len = readBuffer(13);
      String txt = readString(len, 15);

      display_oled.setTextSize(oled_text_size);
      if (oled_text_color == 0)
        display_oled.setTextColor(WHITE);
      else if (oled_text_color == 1)
        display_oled.setTextColor(BLACK, WHITE);
      display_oled.setCursor(column, row);
      display_oled.println(txt);
    }
    else if (cmd == 3) //display
    {
      display_oled.display();
    }
    else if (cmd == 1) //clear
    {
      display_oled.clearDisplay();
      display_oled.display();
    }
  }
  break;
  }
}

void sendPinvalues()
{
  callOK();

    int pinNumber = 0;
    for (pinNumber = 2; pinNumber < 40; pinNumber++){
        if(analogs[pinNumber] == 1){
            sendAnalogValue(pinNumber);
            callOK();
        }
    }
    if (isUltrasonic)
  {
    sendUltrasonic();
    callOK();
  }
  if (isDHThumi)
  {
    sendDHT();
    callOK();
  }
  if (isDHTtemp)
  {
    sendDHT();
    callOK();
  }
  if (isTouch)
  {
    sendTouch();
    callOK();
  }
  if (isGyro_x || isGyro_y || isGyro_z)
  {
    sendGyro();
    callOK();
  }
}

void sendAnalogValue(int pinNumber){
    float val = analogRead(pinNumber);

    writeHead();
    sendFloat((int)val);
    writeSerial(pinNumber);
    writeSerial(ANALOG);
    writeEnd();
}

void sendUltrasonic()
{
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  float value = pulseIn(echoPin, HIGH, 30000) / 29.0 / 2.0;

  if (value == 0)
  {
    value = lastUltrasonic;
  }
  else
  {
    lastUltrasonic = value;
  }
  writeHead();
  sendFloat(value);
  writeSerial(trigPin);
  writeSerial(echoPin);
  writeSerial(ULTRASONIC);
  writeEnd();
}

void sendTouch()
{
  float tp = 0;
  switch (touchPin)
  {
  case 2:
    tp = touchRead(T2);
    break;
  case 13:
    tp = touchRead(T4);
    break;
  case 14:
    tp = touchRead(T6);
    break;
  case 15:
    tp = touchRead(T3);
    break;
  case 32:
    tp = touchRead(T9);
    break;
  case 33:
    tp = touchRead(T8);
    break;
  }
  delay(50);

  writeHead();
  sendFloat(tp);
  writeSerial(TOUCH);
  writeEnd();
}

void sendDHT()
{

  myDHT11.read11(dhtPin);
  float fTempC = myDHT11.temperature;
  float fHumid = myDHT11.humidity;

  delay(50);
  if (isDHTtemp)
  {
    writeHead();       //읽어온 값 시리얼 전송 시작
    sendFloat(fTempC); //float 시리얼 전송
    writeSerial(DHTTEMP);
    writeEnd(); //줄바꿈
  }

  if (isDHThumi)

  {
    writeHead();
    sendFloat(fHumid);
    writeSerial(DHTHUMI);
    writeEnd();
  }
}

void sendAnalog()
{
    float val = analogRead(analogPin);

    writeHead();
    sendFloat((int)val);
    writeSerial(analogPin);
    writeSerial(ANALOG);
    writeEnd();
}

void sendGyro()
{
    Wire.beginTransmission(0b1101000); //I2C address of the MPU
    Wire.write(0x43); //Starting register for Gyro Readings
    Wire.endTransmission();
    Wire.requestFrom(0b1101000,6); //Request Gyro Registers (43 - 48)
    while(Wire.available() < 6);
    gyroX = Wire.read()<<8|Wire.read(); //Store first two bytes into accelX
    gyroY = Wire.read()<<8|Wire.read(); //Store middle two bytes into accelY
    gyroZ = Wire.read()<<8|Wire.read(); //Store last two bytes into accelZ
    rotX = gyroX / 131.0;
    rotY = gyroY / 131.0; 
    rotZ = gyroZ / 131.0;    

    if (isGyro_x){
        writeHead();
        sendFloat(rotX);
        writeSerial(GYRO_X);
        writeEnd();
    }
    if (isGyro_y){
        writeHead();
        sendFloat(rotY);
        writeSerial(GYRO_Y);
        writeEnd();
    }
    if (isGyro_z){
        writeHead();
        sendFloat(rotZ);
        writeSerial(GYRO_Z);
        writeEnd();
    }
}
void writeBuffer(int index, unsigned char c)
{
  buffer[index] = c;
}

void writeHead()
{
  writeSerial(0xff);
  writeSerial(0x55);
}

void writeEnd()
{
  Serial.println();
}

void writeSerial(unsigned char c)
{
  Serial.write(c);
}

void sendString(String s)
{
  int l = s.length();
  writeSerial(4);
  writeSerial(l);
  for (int i = 0; i < l; i++)
  {
    writeSerial(s.charAt(i));
  }
}

void sendFloat(float value)
{
  writeSerial(2);
  val.floatVal = value;
  writeSerial(val.byteVal[0]);
  writeSerial(val.byteVal[1]);
  writeSerial(val.byteVal[2]);
  writeSerial(val.byteVal[3]);
}

void sendShort(double value)
{
  writeSerial(3);
  valShort.shortVal = value;
  writeSerial(valShort.byteVal[0]);
  writeSerial(valShort.byteVal[1]);
}

short readShort(int idx)
{
  valShort.byteVal[0] = readBuffer(idx);
  valShort.byteVal[1] = readBuffer(idx + 1);
  return valShort.shortVal;
}

float readFloat(int idx)
{
  val.byteVal[0] = readBuffer(idx);
  val.byteVal[1] = readBuffer(idx + 1);
  val.byteVal[2] = readBuffer(idx + 2);
  val.byteVal[3] = readBuffer(idx + 3);
  return val.floatVal;
}

long readLong(int idx)
{
  val.byteVal[0] = readBuffer(idx);
  val.byteVal[1] = readBuffer(idx + 1);
  val.byteVal[2] = readBuffer(idx + 2);
  val.byteVal[3] = readBuffer(idx + 3);
  return val.longVal;
}

void callOK()
{                    //상태 확인용
  writeSerial(0xff); //테일
  writeSerial(0x55); //테일2
  writeEnd();        //다음줄로 넘기기
}

//LCD String을 버퍼에 읽어들임
String readString(int len, int startIdx)
{
  String str = "";

  for (int i = startIdx; i < (startIdx + len); i++)
  {
    str += (char)readBuffer(i);
  }

  return str;
}