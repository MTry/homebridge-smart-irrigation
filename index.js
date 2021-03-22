var Service, Characteristic
const packageJson = require('./package.json')
const schedule = require('node-schedule')
const request = require('request')

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
  this.zones = config.zones
  this.zoned = config.zones.length || 4
  this.latitude = config.latitude
  this.longitude = config.longitude
  this.altitude = config.altitude || 1
  this.keyAPI = config.keyAPI
  this.verbosed = config.verbosed
  this.masterDisable = config.masterDisable
  this.sunriseOffset = config.sunriseOffset || 0
  this.lowThreshold = config.lowThreshold
  this.highThreshold = config.highThreshold
  this.cycles = config.cycles || 2
  this.JanRad = config.JanRad
  this.FebRad = config.FebRad
  this.MarRad = config.MarRad
  this.AprRad = config.AprRad
  this.MayRad = config.MayRad
  this.JunRad = config.JunRad
  this.JulRad = config.JulRad
  this.AugRad = config.AugRad
  this.SepRad = config.SepRad
  this.OctRad = config.OctRad
  this.NovRad = config.NovRad
  this.DecRad = config.DecRad
  this.valveAccessory = []
  this.zoneDuration = []
  this.manufacturer = config.manufacturer || packageJson.author.name
  this.serial = config.serial || this.latitude
  this.model = config.model || packageJson.name
  this.firmware = config.firmware || packageJson.version
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

  _calculateSchedule: function (callback) {
    var url = 'https://api.openweathermap.org/data/2.5/onecall?lat=' + this.latitude + '&lon=' + this.longitude + '&exclude=current,hourly&units=metric&appid=' + this.keyAPI
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

        var SolarRad = [this.JanRad,this.FebRad,this.MarRad,this.AprRad,this.MayRad,this.JunRad,this.JulRad,this.AugRad,this.SepRad,this.OctRad,this.NovRad,this.DecRad]
        var Weekday = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
        var Months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
        
        var forecast = [{},{},{},{},{},{},{},{}]
        for (var pop = 0; pop <= 7; pop++){
          forecast[pop].summary = json.daily[pop].weather[0].description,
          forecast[pop].sunrise = new Date(json.daily[pop].sunrise * 1000),
          forecast[pop].min = json.daily[pop].temp.min,
          forecast[pop].max = json.daily[pop].temp.max,
          forecast[pop].humidity = json.daily[pop].humidity,
          forecast[pop].pressure = json.daily[pop].pressure,
          forecast[pop].speed = json.daily[pop].wind_speed,
          forecast[pop].rain = ('rain' in json.daily[pop]) ? json.daily[pop].rain : 0,
          forecast[pop].clouds = json.daily[pop].clouds,
          forecast[pop].ETO = 0
        }
        
        var EToDay = forecast[0]
        var alt = this.altitude
        var lat = this.latitude
        
        function CalcETO(EToDay){
        var T_mean = (EToDay.max + EToDay.min) / 2
        var R_s = SolarRad[EToDay.sunrise.getMonth()] * 3.6
        var U_2 = EToDay.speed * .748
        var Slope_svpc = 4098 * (.6108 * Math.exp((17.27 * T_mean) / (T_mean + 237.3))) / Math.pow((T_mean +237.3),2)
        var P_a = EToDay.pressure / 10
        var Ps_c = P_a * .000665
        var DT = Slope_svpc / (Slope_svpc + (Ps_c * (1 + (.34 * U_2))))
        var PT = Ps_c / (Slope_svpc + (Ps_c * (1 + (.34 * U_2))))
        var TT = U_2 * (900 / (T_mean + 273))
        var eTmax = .6108 * Math.exp(17.27 * EToDay.max / (EToDay.max +237.3))
        var eTmin = .6108 * Math.exp(17.27 * EToDay.min / (EToDay.min +237.3))
        var e_s = (eTmax + eTmin) / 2
        var e_a = EToDay.humidity * e_s / 100
        var now = new Date(EToDay.sunrise.getTime())
        var start = new Date(now.getFullYear(), 0, 0)
        var diff = (now - start) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000)
        var DoY = Math.floor(diff / (1000 * 60 * 60 * 24))
        var D_r = 1 + .033 * Math.cos(2 * Math.PI * DoY / 365)
        var S_d = .409 * Math.sin((2 * Math.PI * DoY / 365) - 1.39)
        var L_rad = lat * Math.PI / 180
        var Sunset_ha = Math.acos(-(Math.tan(S_d) * Math.tan(L_rad)))
        var Ra = (1440 / Math.PI) * .082 * D_r * ((Sunset_ha * Math.sin(L_rad) * Math.sin(S_d)) + (Math.cos(L_rad) * Math.cos(S_d) * Math.sin(Sunset_ha)))
        var Rso = Ra * (.75 + (2 * alt / 100000))
        var Rns = R_s * (1-.23)
        var Rnl = 4.903 * Math.pow(10,-9) * (Math.pow((273.16 + EToDay.max),4) + Math.pow((273.16 + EToDay.min),4)) / 2
        Rnl = Rnl * (.34 - (.14 * Math.sqrt(e_a)))
        Rnl = Rnl * ((1.35 * R_s / Rso) - .35)
        var R_n = Rns - Rnl
        var R_ng = .408 * R_n
        var ET_rad = DT * R_ng
        var ET_wind = PT * TT * (e_s - e_a)
        var ET_o = ET_rad + ET_wind
        return ET_o
        }

        for (var dd = 0; dd <= 7; dd++) {
          forecast[dd].ETO = CalcETO(forecast[dd])
          this.log('-----------------------------------------------------')
          this.log('%s on %s %s with %s% clouds & %s% RH', forecast[dd].summary, Weekday[forecast[dd].sunrise.getDay()], forecast[dd].sunrise.toLocaleDateString(), forecast[dd].clouds, forecast[dd].humidity)
          this.log('ETo:%smm|Rain:%smm|Min:%s°C|Max:%s°C|Wind:%sm/s', forecast[dd].ETO.toFixed(2), forecast[dd].rain, forecast[dd].min, forecast[dd].max, forecast[dd].speed)
         }

         var WaterNeeded = 0
         var wateringTime = new Array(this.zoned).fill(0)
         var Today_ZonesDuration = new Array(this.zoned).fill(0)
         var zoneTimes = [Today_ZonesDuration,Today_ZonesDuration]

         for (zDay = 0; zDay <= 1; zDay++){
          for (Z_index =0; Z_index <= this.zoned-1; Z_index++) {
            if (this.zones[Z_index].enabled && this.zones[Z_index].wateringWeekdays.includes(Weekday[forecast[zDay].sunrise.getDay()]) && this.zones[Z_index].wateringMonths.includes(Months[forecast[zDay].sunrise.getMonth()]))
            { if (!this.zones[Z_index].adaptive) 
              {
                zoneTimes[zDay][Z_index] = this.zones[Z_index].defDuration
              }
              else 
              {
                for (var N_days = 1; N_days <= 7; N_days++ ) {
                  var temp = Weekday[forecast[N_days+zDay].sunrise.getDay()]
                  if (this.zones[Z_index].wateringWeekdays.includes(temp)) break
                 }
                 var ETo_tillNext = 0
                 var Rain_tillNext = 0
                 for (var E_days = 0; E_days <= N_days-1; E_days++) 
                 {
                   ETo_tillNext = ETo_tillNext + forecast[E_days+zDay].ETO
                   Rain_tillNext = Rain_tillNext + forecast[E_days+zDay].rain
                 }
                 if (this.zones[Z_index].rainFactoring)
                 {
                   WaterNeeded = ETo_tillNext - Rain_tillNext
                   if (WaterNeeded < 0) {WaterNeeded = 0}
                   if (this.zones[Z_index].rainThreshold < forecast[zDay].rain) {WaterNeeded = 0}
                 } else {WaterNeeded = ETo_tillNext}
                 WaterNeeded = (WaterNeeded * this.zones[Z_index].cropCoef * this.zones[Z_index].plantDensity * this.zones[Z_index].expFactor * this.zones[Z_index].dripArea * this.zones[Z_index].tweakFactor) / this.zones[Z_index].efficiency
                 zoneTimes[zDay][Z_index] = WaterNeeded * 60 / (this.zones[Z_index].dripLPH * this.zones[Z_index].dripNos)
                 if (this.zones[Z_index].maxDuration <= zoneTimes[zDay][Z_index])
                 {zoneTimes[zDay][Z_index] = this.zones[Z_index].maxDuration}
              }
            } 
            else 
            {
              zoneTimes[zDay][Z_index] = 0
            }
          }
          wateringTime[zDay] = zoneTimes[zDay].reduce((a, b) => a + b, 0)
          if (this.verbosed) {
          this.log('------------------------------------------------')
          this.log('Day %s Zone times: %s', zDay, zoneTimes[zDay])
          this.log('------------------------------------------------')
          this.log('Day %s Total time: %s', zDay, wateringTime[zDay])
          this.log('------------------------------------------------')
          }
        }

        zDay = 0
        var earliestToday = new Date(forecast[0].sunrise.getTime() - (wateringTime[zDay] + this.sunriseOffset) * 60000)
        if (earliestToday.getTime() > Date.now()) {
          zDay = 0
        } else {
          zDay = 1
        }

        if (!this.masterDisable && this.highThreshold < forecast[zDay].max && this.lowThreshold < forecast[zDay].min) 
        {
          for (var zone = 1; zone <= this.zoned; zone++) {
          this.zoneDuration[zone] = zoneTimes[zDay][zone-1] / this.cycles
          }
          
          var startTime = new Date(forecast[zDay].sunrise.getTime() - (wateringTime[zDay] + this.sunriseOffset) * 60000)
          var finishTime = new Date(startTime.getTime() + wateringTime[zDay] * 60000)
          this.log('------------------------------------------------')
          this.log('Watering starts: %s', Weekday[startTime.getDay()], startTime.toLocaleString())
          this.log('Watering finishes: %s', Weekday[finishTime.getDay()], finishTime.toLocaleString())
          this.log('Total watering time: %s minutes', minTommss(wateringTime[zDay]))
          this.log('------------------------------------------------')

          for (zone = 1; zone <= this.zoned; zone++) {
            if (this.zoneDuration[zone] != 0){
              this.log('%s | %s minutes | %sx %s minute cycles', this.zones[zone-1].zoneName, minTommss(this.zoneDuration[zone] * this.cycles), this.cycles, minTommss(this.zoneDuration[zone]))
            } else {
              this.log('%s | %s minutes | X--> NO WATERING <--X', this.zones[zone-1].zoneName, minTommss(this.zoneDuration[zone] * this.cycles))  
            }
          }

          schedule.scheduleJob(startTime, function () {
            this.log('Starting water cycle 1/%s', this.cycles)
            this._wateringCycle(1, 1)
          }.bind(this))
          this.service.getCharacteristic(Characteristic.ProgramMode).updateValue(1)
        } else {
          this.log('------------------------------------------------')
          this.log('No schedule set, recalculation: %s', forecast[zDay].sunrise.toLocaleString())
          this.service.getCharacteristic(Characteristic.ProgramMode).updateValue(0)
          schedule.scheduleJob(forecast[zDay].sunrise, function () {
            this._calculateSchedule(function () {})
          }.bind(this))
        }
        this.log('------------------------------------------------')
        callback()
      }
    }.bind(this))
  },

  _wateringCycle: function (zone, cycle) {
    if (this.zoneDuration[zone] != 0) {this.valveAccessory[zone].setCharacteristic(Characteristic.Active, 1)}
    setTimeout(() => {
      if (this.zoneDuration[zone] != 0) {this.valveAccessory[zone].setCharacteristic(Characteristic.Active, 0)}
      var nextZone = zone + 1
      if (nextZone <= this.zoned) {
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
        this.log('%s | Set state to %s', this.zones[zone-1].zoneName, value)
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
    for (var zone = 1; zone <= this.zoned; zone++) {
      var accessory = new Service.Valve(this.zones[zone-1].zoneName, zone)
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
    this.log('Initialized %s zones', this.zoned)

    if (!this.masterDisable) {
      this._calculateSchedule(function () {})
    }
    
    return services
  }

}
