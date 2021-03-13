var Service, Characteristic
const packageJson = require('./package.json')
const schedule = require('node-schedule')
const request = require('request')
//const ip = require('ip')
//const http = require('http')

function minTommss(minutes){
 var sign = minutes < 0 ? "-" : "";
 var min = Math.floor(Math.abs(minutes))
 var sec = Math.floor((Math.abs(minutes) * 60) % 60);
 return sign + (min < 10 ? "0" : "") + min + ":" + (sec < 10 ? "0" : "") + sec;
}

module.exports = function (homebridge) {
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  homebridge.registerAccessory('homebridge-smart-irrigation', 'SmartSprinklers', SmartSprinklers)
}

function SmartSprinklers (log, config) {
  this.log = log

  this.name = config.name
//  this.apiroute = config.apiroute
  this.zones = config.zones || 6
//  this.pollInterval = config.pollInterval || 300

//  this.listener = config.listener || false
//  this.port = config.port || 2000
//  this.requestArray = ['state']

  this.disableScheduling = config.disableScheduling || false
  this.disableAdaptiveWatering = config.disableAdaptiveWatering || false

  this.latitude = config.latitude
  this.longitude = config.longitude
  this.altitude = config.altitude || 1
  this.key = config.key
  this.verbosed = config.verbosed || true

  this.restrictedDays = config.restrictedDays || []
  this.restrictedMonths = config.restrictedMonths || []
  this.sunriseOffset = config.sunriseOffset || 0

  this.lowThreshold = config.lowThreshold || 10
  this.highThreshold = config.highThreshold || 20
  this.rainThreshold = config.rainThreshold || 2.3

  this.defaultDuration = config.defaultDuration || 20
  this.maxDuration = config.maxDuration || 30

  this.cycles = config.cycles || 2

  this.zonePercentages = config.zonePercentages || new Array(this.zones).fill(100)
  this.Sunday = config.Sunday || new Array(this.zones).fill(100)
  this.Monday = config.Monday || new Array(this.zones).fill(100)
  this.Tuesday = config.Tuesday || new Array(this.zones).fill(100)
  this.Wednesday = config.Wednesday || new Array(this.zones).fill(100)
  this.Thursday = config.Thursday || new Array(this.zones).fill(100)
  this.Friday = config.Friday || new Array(this.zones).fill(100)
  this.Saturday = config.Saturday || new Array(this.zones).fill(100)
  this.SolarRad = config.SolarRad || new Array(12).fill(5.8)

  this.valveAccessory = []
  this.zoneDuration = []

  this.manufacturer = config.manufacturer || packageJson.author.name
  this.serial = config.serial || this.latitude
  this.model = config.model || packageJson.name
  this.firmware = config.firmware || packageJson.version

//  this.username = config.username || null
//  this.password = config.password || null
//  this.timeout = config.timeout || 3000
//  this.http_method = config.http_method || 'GET'

//  if (this.username != null && this.password != null) {
//    this.auth = {
//      user: this.username,
//      pass: this.password
//    }
//  }

//  if (this.listener) {
//    this.server = http.createServer(function (request, response) {
//      var baseURL = 'http://' + request.headers.host + '/'
//      var url = new URL(request.url, baseURL)
//      if (this.requestArray.includes(url.pathname.substr(1))) {
//        this.log.debug('Handling request')
//        response.end('Handling request')
//        this._httpHandler(url.searchParams.get('zone'), url.pathname.substr(1), url.searchParams.get('value'))
//      } else {
//        this.log.warn('Invalid request: %s', request.url)
//        response.end('Invalid request')
//      }
//    }.bind(this))

//    this.server.listen(this.port, function () {
//      this.log('Listen server: http://%s:%s', ip.address(), this.port)
//    }.bind(this))
//  }

  this.service = new Service.IrrigationSystem(this.name)
}

SmartSprinklers.prototype = {

  identify: function (callback) {
    this.log('Identify requested!')
    callback()
  },

  _httpRequest: function (url, body, method, callback) {
    request({
      url: url,
      body: body,
      method: this.http_method,
      timeout: this.timeout,
      rejectUnauthorized: false,
      auth: this.auth
    },
    function (error, response, body) {
      callback(error, response, body)
    })
  },

//  _getStatus: function (callback) {
//    var url = this.apiroute + '/status'
//    this.log.debug('Getting status: %s', url)

//    this._httpRequest(url, '', 'GET', function (error, response, responseBody) {
//      if (error) {
//        this.log.warn('Error getting status: %s', error.message)
//        this.service.getCharacteristic(Characteristic.Active).updateValue(new Error('Polling failed'))
//        callback(error)
//      } else {
//        this.service.getCharacteristic(Characteristic.Active).updateValue(1)
//        this.log.debug('Device response: %s', responseBody)
//        var json = JSON.parse(responseBody)

//        for (var zone = 1; zone <= this.zones; zone++) {
//          var value = json[zone - 1].state
//          this.log.debug('Zone %s | Updated state to: %s', zone, value)
//          this.valveAccessory[zone].getCharacteristic(Characteristic.Active).updateValue(value)
//          this.valveAccessory[zone].getCharacteristic(Characteristic.InUse).updateValue(value)
//        }
//        callback()
//      }
//    }.bind(this))
//  },

//  _httpHandler: function (zone, characteristic, value) {
//    switch (characteristic) {
//      case 'state':
//        this.valveAccessory[zone].getCharacteristic(Characteristic.Active).updateValue(value)
//        this.valveAccessory[zone].getCharacteristic(Characteristic.InUse).updateValue(value)
//        this.log('Zone %s | Updated %s to: %s', zone, characteristic, value)
//        break
//      default:
//        this.log.warn('Zone %s | Unknown characteristic "%s" with value "%s"', zone, characteristic, value)
//    }
//  },

  _calculateSchedule: function (callback) {
    var url = 'https://api.openweathermap.org/data/2.5/onecall?lat=' + this.latitude + '&lon=' + this.longitude + '&exclude=current,hourly&units=metric&appid=' + this.key
    this.log.debug('Retrieving weather data: %s', url)
    this._httpRequest(url, '', this.http_method, function (error, response, responseBody) {
      if (error) {
        this.log.warn('Error getting weather data: %s', error)
        setTimeout(() => {
          this._calculateSchedule(function () {})
        }, 60000)
        callback(error)
      } else {
        this.log.debug('Weather data: %s', responseBody)
        try {
          var json = JSON.parse(responseBody)
        } catch (error) {
          setTimeout(() => {
            this._calculateSchedule(function () {})
          }, 60000)
          return this.log.error('Error parsing weather data: %s', error)
        }

        var today = {}
        today.summary = json.daily[0].weather[0].description
        today.sunrise = new Date(json.daily[0].sunrise * 1000)
        today.min = json.daily[0].temp.min
        today.max = json.daily[0].temp.max
	today.humidity = json.daily[0].humidity
  today.pressure = json.daily[0].pressure
  today.speed = json.daily[0].wind_speed
        today.rain = ('rain' in json.daily[0]) ? json.daily[0].rain : 0
        today.clouds = json.daily[0].clouds

        var tomorrow = {}
        tomorrow.summary = json.daily[1].weather[0].description
        tomorrow.sunrise = new Date(json.daily[1].sunrise * 1000)
        tomorrow.min = json.daily[1].temp.min
        tomorrow.max = json.daily[1].temp.max
	tomorrow.humidity = json.daily[1].humidity
  tomorrow.pressure = json.daily[1].pressure
  tomorrow.speed = json.daily[1].wind_speed
        tomorrow.rain = ('rain' in json.daily[1]) ? json.daily[1].rain : 0
        tomorrow.clouds = json.daily[1].clouds

        this.log('------------------------------------------------')
        this.log('Today summary: %s', today.summary)
        this.log('Today sunrise: %s', today.sunrise.toLocaleString())
        this.log('Today temp: Min %s°C | Max %s°C', today.min, today.max)
        this.log('Today pressure: %s hPa', today.pressure)
        this.log('Today wind speed: %s m/s', today.speed)        
        this.log('Today humidity: %s %', today.humidity)
        this.log('Today rain: %s mm', today.rain)
        this.log('Today cloud cover: %s %', today.clouds)
        this.log('------------------------------------------------')
        this.log('Tomorrow summary: %s', tomorrow.summary)
        this.log('Tomorrow sunrise: %s', tomorrow.sunrise.toLocaleString())
        this.log('Tomorrow temp: Min %s°C | Max %s°C', tomorrow.min, tomorrow.max)
        this.log('Tomorrow pressure: %s hPa', tomorrow.pressure)
        this.log('Tomorrow wind speed: %s m/s', tomorrow.speed)   
        this.log('Tomorrow humidity: %s %', tomorrow.humidity)
        this.log('Tomorrow rain: %s mm', tomorrow.rain)
        this.log('Tomorrow cloud cover: %s %', tomorrow.clouds)
        this.log('------------------------------------------------')


        var maximumTotal
        if (this.disableAdaptiveWatering) {
          maximumTotal = this.zones * this.defaultDuration
        } else {
          maximumTotal = this.zones * this.maxDuration
        }

        var earliestToday = new Date(today.sunrise.getTime() - (maximumTotal + this.sunriseOffset) * 60000)
        var waterDay
        if (earliestToday.getTime() > Date.now()) {
          waterDay = today
        } else {
          waterDay = tomorrow
        }

var T_mean = (waterDay.max + waterDay.min) / 2
if (verbosed) {this.log('Mean daily temperature: %s °C', T_mean)}
this.log('SolarRad: %s', this.SolarRad[waterDay.sunrise.getMonth()])
var R_s = this.SolarRad[waterDay.sunrise.getMonth()] * 3.6
this.log('Mean daily solar radiation (R_s): %s MJ m-2 day-1', R_s)
var U_2 = waterDay.speed * .748
this.log('Wind speed (u2): %s m/s', U_2)
var Slope_svpc = 4098 * (.6108 * Math.exp((17.27 * T_mean) / (T_mean + 237.3))) / Math.pow((T_mean +237.3),2)
this.log('Slope of saturation vapor pressure curve (Slope_svpc): %s', Slope_svpc)
var P_a = waterDay.pressure / 10
this.log('Atmospheric Pressure (P)): %s kPa', P_a)
var Ps_c = P_a * .000665
this.log('Psychrometric constant (Ps_c): %s kPa/°C', Ps_c)
var DT = Slope_svpc / (Slope_svpc + (Ps_c * (1 + (.34 * U_2))))
this.log('Delta Term (DT): %s', DT)
var PT = Ps_c / (Slope_svpc + (Ps_c * (1 + (.34 * U_2))))
this.log('Psi Term (PT): %s', PT)
var TT = U_2 * (900 / (T_mean + 273))
this.log('Temperature Term (TT): %s', TT)
var eTmax = .6108 * Math.exp(17.27 * waterDay.max / (waterDay.max +237.3))
this.log('eTmax: %s kPa', eTmax)
var eTmin = .6108 * Math.exp(17.27 * waterDay.min / (waterDay.min +237.3))
this.log('eTmin: %s kPa', eTmin)
var e_s = (eTmax + eTmin) / 2
this.log('Mean saturation vapor pressure: %s kPa', e_s)
var e_a = waterDay.humidity * e_s / 100
this.log('Actual vapor pressure (e_a): %s kPa', e_a)

var now = new Date(waterDay.sunrise.getTime())
var start = new Date(now.getFullYear(), 0, 0)
var diff = (now - start) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000)
var DoY = Math.floor(diff / (1000 * 60 * 60 * 24))
this.log('Day of Year: %s', DoY)
var D_r = 1 + .033 * Math.cos(2 * Math.PI * DoY / 365)
this.log('Inverse relative distance Earth-Sun (dr): %s', D_r)
var S_d = .409 * Math.sin((2 * Math.PI * DoY / 365) - 1.39)
this.log('Solar declination: %s', S_d)

var L_rad = this.latitude * Math.PI / 180
this.log('Latitude in radians: %s', L_rad)
var Sunset_ha = Math.acos(-(Math.tan(S_d) * Math.tan(L_rad)))
this.log('Sunset hour angle in radians: %s', Sunset_ha)
var Ra = (1440 / Math.PI) * .082 * D_r * ((Sunset_ha * Math.sin(L_rad) * Math.sin(S_d)) + (Math.cos(L_rad) * Math.cos(S_d) * Math.sin(Sunset_ha)))
this.log('Extraterrestrial radiation (Ra): %s MJ m-2 day-1', Ra)
var Rso = Ra * (.75 + (2 * this.altitude / 100000))
this.log('Clear sky solar radiation (Rso): %s MJ m-2 day-1', Rso)
var Rns = R_s * (1-.23)
this.log('Net shortwave radiation (Rns): %s MJ m-2 day-1', Rns)

var Rnl = 4.903 * Math.pow(10,-9) * (Math.pow((273.16 + waterDay.max),4) + Math.pow((273.16 + waterDay.min),4)) / 2
Rnl = Rnl * (.34 - (.14 * Math.sqrt(e_a)))
Rnl = Rnl * ((1.35 * R_s / Rso) - .35)
this.log('Net outgoing long wave solar radiation (Rnl): %s MJ m-2 day-1', Rnl)

var R_n = Rns - Rnl
this.log('Net radiation (Rn): %s MJ m-2 day-1', R_n)

var R_ng = .408 * R_n
this.log('Net radiation (Rng): %s mm', R_ng)

var ET_rad = DT * R_ng
this.log('Radiation term (ET_rad): %s mm/day', ET_rad)
var ET_wind = PT * TT * (e_s - e_a)
this.log('Wind term (ET_wind): %s mm/day', ET_wind)
var ET_o = ET_rad + ET_wind
this.log('Reference Evapotranspiration Value (ET_o): %s mm/day', ET_o.toFixed(2))
this.log('---------------------It Worked---------------------------')

        if (!this.restrictedDays.includes(waterDay.sunrise.getDay()) && !this.restrictedMonths.includes(waterDay.sunrise.getMonth()) && today.rain < this.rainThreshold && tomorrow.rain < this.rainThreshold && waterDay.min > this.lowThreshold && waterDay.max > this.highThreshold) {
          var zoneMaxDuration = this.defaultDuration
          if (!this.disableAdaptiveWatering) {
            var highDiff = waterDay.max - this.highThreshold
            var lowDiff = this.highThreshold - waterDay.min
            var cloudPercentage = 100 - (waterDay.clouds / 3)
	    var humidityFactor = 100 - ((today.humidity + tomorrow.humidity) / 2) / 2
            zoneMaxDuration = (((this.defaultDuration + (highDiff - lowDiff)) / 100) * cloudPercentage * (humidityFactor / 100)) - waterDay.rain
          }

var Weekday = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
  
switch (waterDay.sunrise.getDay()) {
  case 0:
 this.zonePercentages = this.Sunday
    break
  case 1:
 this.zonePercentages = this.Monday
    break
  case 2:
 this.zonePercentages = this.Tuesday
    break
  case 3:
 this.zonePercentages = this.Wednesday
    break
  case 4:
 this.zonePercentages = this.Thursday
    break
  case 5:
 this.zonePercentages = this.Friday
    break
  case 6:
 this.zonePercentages = this.Saturday
}

          for (var zone = 1; zone <= this.zones; zone++) {
            this.zoneDuration[zone] = ((zoneMaxDuration / this.cycles) / 100) * this.zonePercentages[zone - 1]
	    if (this.zoneDuration[zone] > (this.maxDuration / this.cycles)) {
	    this.zoneDuration[zone] = this.maxDuration / this.cycles
		}
          }

          var totalTime = this.zoneDuration.reduce((a, b) => a + b, 0) * this.cycles

          var startTime = new Date(waterDay.sunrise.getTime() - (totalTime + this.sunriseOffset) * 60000)
          var finishTime = new Date(startTime.getTime() + totalTime * 60000)

          this.log('Watering starts: %s', Weekday[waterDay.sunrise.getDay()], startTime.toLocaleString())
          this.log('Watering finishes: %s', finishTime.toLocaleString())
          this.log('Total watering time: %s minutes', minTommss(totalTime))
	  this.log('Calculated Zone duration: %s minutes', minTommss(zoneMaxDuration))
          this.log('Zone max duration limit: %s minutes', minTommss(this.maxDuration))
          this.log('------------------------------------------------')
          this.log(Weekday[waterDay.sunrise.getDay()], 'zone percentages:', this.zonePercentages)

          for (zone = 1; zone <= this.zones; zone++) {
            this.log('Zone %s | %s minutes | %sx %s minute cycles', zone, minTommss(this.zoneDuration[zone] * this.cycles), this.cycles, minTommss(this.zoneDuration[zone]))
          }

          schedule.scheduleJob(startTime, function () {
            this.log('Starting water cycle 1/%s', this.cycles)
            this._wateringCycle(1, 1)
          }.bind(this))
          this.service.getCharacteristic(Characteristic.ProgramMode).updateValue(1)
        } else {
          this.log('No schedule set, recalculation: %s', waterDay.sunrise.toLocaleString())
          this.service.getCharacteristic(Characteristic.ProgramMode).updateValue(0)
          schedule.scheduleJob(waterDay.sunrise, function () {
            this._calculateSchedule(function () {})
          }.bind(this))
        }
        this.log('------------------------------------------------')
        callback()
      }
    }.bind(this))
  },

  _wateringCycle: function (zone, cycle) {
    this.valveAccessory[zone].setCharacteristic(Characteristic.Active, 1)
    setTimeout(() => {
      this.valveAccessory[zone].setCharacteristic(Characteristic.Active, 0)
      var nextZone = zone + 1
      if (nextZone <= this.zones) {
        this._wateringCycle(nextZone, cycle)
      } else {
        var nextCycle = cycle + 1
        if (nextCycle <= this.cycles) {
          this._wateringCycle(1, nextCycle)
          this.log('Starting watering cycle %s/%s', nextCycle, this.cycles)
        } else {
          this.log('Watering finished')
          this._calculateSchedule(function () {})
        }
      }
    }, this.zoneDuration[zone] * 60000)
  },

  setActive: function (zone, value, callback) {
        this.log('Zone %s | Set state to %s', zone, value)
        this.valveAccessory[zone].getCharacteristic(Characteristic.InUse).updateValue(value)
        callback()
  },

  getServices: function () {
    this.service.getCharacteristic(Characteristic.ProgramMode).updateValue(0)
    this.service.getCharacteristic(Characteristic.Active).updateValue(1)
    this.service.getCharacteristic(Characteristic.InUse).updateValue(0)

    this.informationService = new Service.AccessoryInformation()
    this.informationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.SerialNumber, this.serial)
      .setCharacteristic(Characteristic.FirmwareRevision, this.firmware)

    var services = [this.informationService, this.service]
    for (var zone = 1; zone <= this.zones; zone++) {
      var accessory = new Service.Valve('Zone', zone)
      accessory
        .setCharacteristic(Characteristic.ServiceLabelIndex, zone)
        .setCharacteristic(Characteristic.ValveType, 1)

      accessory
        .getCharacteristic(Characteristic.Active)
        .on('set', this.setActive.bind(this, zone))

      this.valveAccessory[zone] = accessory
      this.service.addLinkedService(accessory)
      services.push(accessory)
    }
    this.log('Initialized %s zones', this.zones)

    if (!this.disableScheduling) {
      this._calculateSchedule(function () {})
    }



    return services
  }

}
