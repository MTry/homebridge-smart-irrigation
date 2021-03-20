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
  this.disableScheduling = config.disableScheduling || false
  this.disableAdaptiveWatering = config.disableAdaptiveWatering || false
  this.latitude = config.latitude
  this.longitude = config.longitude
  this.altitude = config.altitude || 1
  this.key = config.key
  this.verbosed = config.verbosed
  this.restrictedDays = config.restrictedDays || []
  this.restrictedMonths = config.restrictedMonths || []
  this.sunriseOffset = config.sunriseOffset || 0
  this.lowThreshold = config.lowThreshold || 10
  this.highThreshold = config.highThreshold || 20
  this.rainThreshold = config.rainThreshold || 2.3
  this.defaultDuration = config.defaultDuration || 20
  this.maxDuration = config.maxDuration || 30
  this.cycles = config.cycles || 2
  this.zonePercentages = config.zonePercentages || new Array(this.zoned).fill(100)
  this.Sunday = config.Sunday || new Array(this.zoned).fill(100)
  this.Monday = config.Monday || new Array(this.zoned).fill(100)
  this.Tuesday = config.Tuesday || new Array(this.zoned).fill(100)
  this.Wednesday = config.Wednesday || new Array(this.zoned).fill(100)
  this.Thursday = config.Thursday || new Array(this.zoned).fill(100)
  this.Friday = config.Friday || new Array(this.zoned).fill(100)
  this.Saturday = config.Saturday || new Array(this.zoned).fill(100)
  this.SolarRad = config.SolarRad || new Array(12).fill(5.8)
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

        var SolarRad = [this.JanRad,this.FebRad,this.MarRad,this.AprRad,this.MayRad,this.JunRad,this.JulRad,this.AugRad,this.SepRad,this.OctRad,this.NovRad,this.DecRad]
        
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

        var forecast = [
          {
          summary: json.daily[0].weather[0].description,
          sunrise: new Date(json.daily[0].sunrise * 1000),
          min: json.daily[0].temp.min,
          max: json.daily[0].temp.max,
          humidity: json.daily[0].humidity,
          pressure: json.daily[0].pressure,
          speed: json.daily[0].wind_speed,
          rain: ('rain' in json.daily[0]) ? json.daily[0].rain : 0,
          clouds: json.daily[0].clouds,
          ETO: 0
          },
          {
          summary: json.daily[1].weather[0].description,
          sunrise: new Date(json.daily[1].sunrise * 1000),
          min: json.daily[1].temp.min,
          max: json.daily[1].temp.max,
          humidity: json.daily[1].humidity,
          pressure: json.daily[1].pressure,
          speed: json.daily[1].wind_speed,
          rain: ('rain' in json.daily[1]) ? json.daily[1].rain : 0,
          clouds: json.daily[1].clouds,
          ETO: 0
          },
          {
          summary: json.daily[2].weather[0].description,
          sunrise: new Date(json.daily[2].sunrise * 1000),
          min: json.daily[2].temp.min,
          max: json.daily[2].temp.max,
          humidity: json.daily[2].humidity,
          pressure: json.daily[2].pressure,
          speed: json.daily[2].wind_speed,
          rain: ('rain' in json.daily[2]) ? json.daily[2].rain : 0,
          clouds: json.daily[2].clouds,
          ETO: 0
          },
          {
          summary: json.daily[3].weather[0].description,
          sunrise: new Date(json.daily[3].sunrise * 1000),
          min: json.daily[3].temp.min,
          max: json.daily[3].temp.max,
          humidity: json.daily[3].humidity,
          pressure: json.daily[3].pressure,
          speed: json.daily[3].wind_speed,
          rain: ('rain' in json.daily[3]) ? json.daily[3].rain : 0,
          clouds: json.daily[3].clouds,
          ETO: 0
          },
          {
          summary: json.daily[4].weather[0].description,
          sunrise: new Date(json.daily[4].sunrise * 1000),
          min: json.daily[4].temp.min,
          max: json.daily[4].temp.max,
          humidity: json.daily[4].humidity,
          pressure: json.daily[4].pressure,
          speed: json.daily[4].wind_speed,
          rain: ('rain' in json.daily[4]) ? json.daily[4].rain : 0,
          clouds: json.daily[4].clouds,
          ETO: 0
          },
          {
          summary: json.daily[5].weather[0].description,
          sunrise: new Date(json.daily[5].sunrise * 1000),
          min: json.daily[5].temp.min,
          max: json.daily[5].temp.max,
          humidity: json.daily[5].humidity,
          pressure: json.daily[5].pressure,
          speed: json.daily[5].wind_speed,
          rain: ('rain' in json.daily[5]) ? json.daily[5].rain : 0,
          clouds: json.daily[5].clouds,
          ETO: 0
          },
          {
          summary: json.daily[6].weather[0].description,
          sunrise: new Date(json.daily[6].sunrise * 1000),
          min: json.daily[6].temp.min,
          max: json.daily[6].temp.max,
          humidity: json.daily[6].humidity,
          pressure: json.daily[6].pressure,
          speed: json.daily[6].wind_speed,
          rain: ('rain' in json.daily[6]) ? json.daily[6].rain : 0,
          clouds: json.daily[6].clouds,
          ETO: 0
          },
          {
          summary: json.daily[7].weather[0].description,
          sunrise: new Date(json.daily[7].sunrise * 1000),
          min: json.daily[7].temp.min,
          max: json.daily[7].temp.max,
          humidity: json.daily[7].humidity,
          pressure: json.daily[7].pressure,
          speed: json.daily[7].wind_speed,
          rain: ('rain' in json.daily[7]) ? json.daily[7].rain : 0,
          clouds: json.daily[7].clouds,
          ETO: 0
          }
        ] 

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
       
        var EToDay =forecast[0]
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

        var T_mean = (EToDay.max + EToDay.min) / 2
        var R_s = this.SolarRad[EToDay.sunrise.getMonth()] * 3.6
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
        var L_rad = this.latitude * Math.PI / 180
        var Sunset_ha = Math.acos(-(Math.tan(S_d) * Math.tan(L_rad)))
        var Ra = (1440 / Math.PI) * .082 * D_r * ((Sunset_ha * Math.sin(L_rad) * Math.sin(S_d)) + (Math.cos(L_rad) * Math.cos(S_d) * Math.sin(Sunset_ha)))
        var Rso = Ra * (.75 + (2 * this.altitude / 100000))
        var Rns = R_s * (1-.23)
        var Rnl = 4.903 * Math.pow(10,-9) * (Math.pow((273.16 + EToDay.max),4) + Math.pow((273.16 + EToDay.min),4)) / 2
        Rnl = Rnl * (.34 - (.14 * Math.sqrt(e_a)))
        Rnl = Rnl * ((1.35 * R_s / Rso) - .35)
        var R_n = Rns - Rnl
        var R_ng = .408 * R_n
        var ET_rad = DT * R_ng
        var ET_wind = PT * TT * (e_s - e_a)
        var ET_o = ET_rad + ET_wind  

        if (this.verbosed) {
          this.log('Sunrise date: %s', EToDay.sunrise.toLocaleString())
          this.log('Mean daily temperature: %s °C', T_mean.toFixed(4))
          this.log('Solar Rad from config: %s', this.SolarRad[EToDay.sunrise.getMonth()])
          this.log('Mean daily solar radiation (R_s): %s MJ m-2 day-1', R_s)
          this.log('Wind speed (u2): %s m/s', U_2.toFixed(4))
          this.log('Slope of saturation vapor pressure curve (Slope_svpc): %s', Slope_svpc.toFixed(4))
          this.log('Atmospheric Pressure (P)): %s kPa', P_a)
          this.log('Psychrometric constant (Ps_c): %s kPa/°C', Ps_c.toFixed(4))
          this.log('Delta Term (DT): %s', DT.toFixed(4))
          this.log('Psi Term (PT): %s', PT.toFixed(4))
          this.log('Temperature Term (TT): %s', TT.toFixed(4))
          this.log('eTmax: %s kPa', eTmax.toFixed(4))
          this.log('eTmin: %s kPa', eTmin.toFixed(4))
          this.log('Mean saturation vapor pressure: %s kPa', e_s.toFixed(4))
          this.log('Actual vapor pressure (e_a): %s kPa', e_a.toFixed(4))
          this.log('Day of Year: %s', DoY)
          this.log('Inverse relative distance Earth-Sun (dr): %s', D_r.toFixed(4))
          this.log('Solar declination: %s', S_d.toFixed(4))
          this.log('Latitude in radians: %s', L_rad.toFixed(4))
          this.log('Sunset hour angle in radians: %s', Sunset_ha.toFixed(4))
          this.log('Extraterrestrial radiation (Ra): %s MJ m-2 day-1', Ra.toFixed(4))
          this.log('Clear sky solar radiation (Rso): %s MJ m-2 day-1', Rso.toFixed(4))
          this.log('Net shortwave radiation (Rns): %s MJ m-2 day-1', Rns.toFixed(4))
          this.log('Net outgoing long wave solar radiation (Rnl): %s MJ m-2 day-1', Rnl.toFixed(4))
          this.log('Net radiation (Rn): %s MJ m-2 day-1', R_n.toFixed(4))
          this.log('Net radiation (Rng): %s mm', R_ng.toFixed(4))
          this.log('Radiation term (ET_rad): %s mm/day', ET_rad.toFixed(2))
          this.log('Wind term (ET_wind): %s mm/day', ET_wind.toFixed(2))
          this.log('Reference Evapotranspiration Value (ET_o): %s mm/day', ET_o.toFixed(2))
          this.log('------------------------------------------------')
        }     

        for (var dd = 0; dd <= 7; dd++) {
          forecast[dd].ETO = CalcETO(forecast[dd])
          this.log('----------------------%s--------------------------',dd)
          this.log('Variable Check: %s', forecast[dd])
          this.log('Variable Check: %s', forecast[dd].ETO)
         }

         var WaterNeeded = 0
         var wateringTime = new Array(this.zoned).fill(0)
         var Today_ZonesDuration = new Array(this.zoned).fill(0)
         var zoneTimes = [Today_ZonesDuration,Today_ZonesDuration]

         for (zDay = 0; zDay <= 1; zDay++){
          for (Z_index =0; Z_index <= this.zoned-1; Z_index++) {
            if (this.zones[Z_index].enabled && this.zones[Z_index].wateringDays.includes(forecast[zDay].sunrise.getDay()) && this.zones[Z_index].wateringMonths.includes(forecast[zDay].sunrise.getMonth()))
            { if (!this.zones[Z_index].adaptive) 
              {
                zoneTimes[zDay][Z_index] = this.zones[Z_index].defDuration
              }
              else 
              {
                for (var N_days = 1; N_days <= 7; N_days++ ) {
                  var temp = forecast[N_days+zDay].sunrise.getDay()
                  if (this.zones[Z_index].wateringDays.includes(temp)) break
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
                   this.log('------------------------------------------------')
                   this.log('Day %s Water : %s zone %s', zDay,WaterNeeded,Z_index)
                   this.log('------------------------------------------------')
                 } else {WaterNeeded = ETo_tillNext}
                 WaterNeeded = (WaterNeeded * this.zones[Z_index].cropCoef * this.zones[Z_index].plantDensity * this.zones[Z_index].expFactor * this.zones[Z_index].dripArea * this.zones[Z_index].tweakFactor) / this.zones[Z_index].efficiency
                 zoneTimes[zDay][Z_index] = WaterNeeded * 60 / (this.zones[Z_index].dripLPH * this.zones[Z_index].dripNos)
                 if (this.zones[Z_index].maxDuration <= zoneTimes[zDay][Z_index])
                 {zoneTimes[zDay][Z_index] = this.zones[Z_index].maxDuration}
                 this.log('------------------------------------------------')
                 this.log('Day %s Water : %s zone %s', zDay,WaterNeeded,Z_index)
                 this.log('------------------------------------------------')
              }
            } 
            else 
            {
              zoneTimes[zDay][Z_index] = 0
            }
          }
          wateringTime[zDay] = zoneTimes[zDay].reduce((a, b) => a + b, 0)
          this.log('------------------------------------------------')
          this.log('Day %s Check times: %s', zDay, zoneTimes[zDay])
          this.log('------------------------------------------------')
          this.log('Day %s Check total time: %s', zDay, wateringTime[zDay])
        }

        var maximumTotal
        if (this.disableAdaptiveWatering) {
          maximumTotal = this.zoned * this.defaultDuration
        } else {
          maximumTotal = this.zoned * this.maxDuration
        }

        var earliestToday = new Date(forecast[0].sunrise.getTime() - (maximumTotal + this.sunriseOffset) * 60000)
        var waterDay
        if (earliestToday.getTime() > Date.now()) {
          waterDay = today
        } else {
          waterDay = tomorrow
        }

    if (!this.restrictedDays.includes(waterDay.sunrise.getDay()) && !this.restrictedMonths.includes(waterDay.sunrise.getMonth()) && today.rain < this.rainThreshold && tomorrow.rain < this.rainThreshold && waterDay.min > this.lowThreshold && waterDay.max > this.highThreshold) 
    {
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

    for (var zone = 1; zone <= this.zoned; zone++) {
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

          for (zone = 1; zone <= this.zoned; zone++) {
            this.log('%s | %s minutes | %sx %s minute cycles', this.zones[zone-1].zoneName, minTommss(this.zoneDuration[zone] * this.cycles), this.cycles, minTommss(this.zoneDuration[zone]))
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
    this.log('Initialized %s zoned', this.zoned)

    if (!this.disableScheduling) {
      this._calculateSchedule(function () {})
    }
    
    return services
  }

}
