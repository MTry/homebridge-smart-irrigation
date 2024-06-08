/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */

'use strict'
let Service, Characteristic
import { readFile } from 'fs/promises';
const packageJson = JSON.parse(
  await readFile(
    new URL('./package.json', import.meta.url)
  )
);
import schedule from 'node-schedule';
import nodemailer from 'nodemailer';
import got from 'got';
import { Pushover } from 'pushover-js';
import storage from 'node-persist';

import * as format from './lib/format.js';
import * as eto from './lib/eto.js';

let workEnabled = true
let cacheDirectory = ''
const mailTransport = {}
const mailContruct = {}
let wateringDone = false
let servicetimeEnd = 0
const zoneEnd = new Array(8).fill(0)
let recheckJob = {}
let wateringJob = {}
let recheckScheduled = false
let wateringScheduled = false
let fullTime = 0
const pcImage = 'https://raw.githubusercontent.com/MTry/homebridge-smart-irrigation/master/branding/pcimage.png'
const pcURL = 'https://api.pushcut.io/v1/notifications/'
let pushcutDevices = []

async function storeState (param, state) {
  await storage.init({ dir: cacheDirectory, forgiveParseErrors: true })
  await storage.setItem(param, state)
}

async function getState (param) {
  await storage.init({ dir: cacheDirectory, forgiveParseErrors: true })
  const ret = await storage.getItem(param)
  return ret
}

async function sendEmail (transport, matter) {
  const transporter = nodemailer.createTransport(transport)
  try { await transporter.sendMail(matter) } catch (mailError) {
    throw new TypeError('Email not sent - recheck email settings. Moving ahead...')
  }
}

export default (homebridge) => {
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  homebridge.registerAccessory('homebridge-smart-irrigation', 'SmartSprinklers', SmartSprinklers)
  cacheDirectory = homebridge.user.storagePath() + '/homebridge-smart-irrigation/storage'
}

function SmartSprinklers (log, config) {
  this.log = log
  this.name = config.name || 'Irrigation'
  this.zones = config.zones
  this.zoned = config.zones.length || 1
  if (this.zoned > 16) {
    this.log.warn('Too many zones! Disabling')
    workEnabled = false
  }
  this.latitude = config.latitude || 0
  this.longitude = config.longitude || 0
  this.altitude = config.altitude || 1
  this.keyAPI = config.keyAPI || ''
  if (this.keyAPI === '') {
    this.log.warn('OWM Key cant be blank! Disabling')
    workEnabled = false
  }
  this.verbosed = config.verbosed || true
  this.masterDisable = config.masterDisable || false
  this.exposeControls = config.exposeControls || true
  this.recheckTime = config.recheckTime || 0
  this.sunriseOffset = config.sunriseOffset || 0
  if (this.sunriseOffset < -1440 || this.sunriseOffset > 1440) {
    this.log.warn('Sunrise Offset out of bounds! Disabling')
    workEnabled = false
  }
  this.lowThreshold = config.lowThreshold || 5
  this.highThreshold = config.highThreshold || 15
  this.cycles = config.cycles || 2
  if (this.cycles < 1 || this.cycles > 5) {
    this.log.warn('Invalid number of cycles! Disabling')
    workEnabled = false
  }
  this.emailEnable = config.emailEnable || false
  this.senderName = config.senderName || ''
  this.senderEmail = config.senderEmail || ''
  this.sendTo = config.sendTo || ''
  this.smtpHost = config.smtpHost || ''
  this.smtpPort = config.smtpPort || 587
  this.portSecure = config.portSecure || false
  this.userID = config.userID || ''
  this.userPwd = config.userPwd || ''
  if (this.emailEnable === true && (this.senderName === '' || this.senderEmail === '' || this.sendTo === '' || this.smtpHost === '' || this.userID === '' || this.userPwd === '')) {
    this.log.warn('Email enabled but configuration items cant be blank! Disabling Email')
    this.emailEnable = false
  }
  this.pushEnable = config.pushEnable || false
  this.userPO = config.userPO || ''
  this.tokenPO = config.tokenPO || ''
  if (this.pushEnable === true && (this.userPO === '' || this.tokenPO === '')) {
    this.log.warn('Pushover enabled but User or Token cant be blank! Disabling Push')
    this.pushEnable = false
  }
  this.devicePO = config.devicePO || ''
  this.priorityPO = config.priorityPO || 0
  this.soundPO = config.soundPO || 'pushover'
  this.pcEnable = config.pcEnable || false
  this.pcKey = config.pcKey || ''
  this.pcDevices = config.pcDevices || ''
  this.pcWeatherChecked = config.pcWeatherChecked || ''
  this.pcWeatherCheckedSound = config.pcWeatherCheckedSound || 'system'
  this.pcWateringStart = config.pcWateringStart || ''
  this.pcWateringStartSound = config.pcWateringStartSound || 'system'
  this.pcWateringEnd = config.pcWateringEnd || ''
  this.pcWateringEndSound = config.pcWateringEndSound || 'jobDone'
  if (this.pcEnable === true && this.pcWeatherChecked === '') {
    this.log.warn('Pushcut enabled but API Key or Weather Checked notification cant be blank! Disabling Pushcut')
    this.pcEnable = false
  }
  if (this.pcWateringStart === '') {
    this.pcWateringStart = this.pcWeatherChecked
  }
  if (this.pcWateringEnd === '') {
    this.pcWateringEnd = this.pcWeatherChecked
  }
  this.JanRad = config.JanRad || 6
  this.FebRad = config.FebRad || 6
  this.MarRad = config.MarRad || 6
  this.AprRad = config.AprRad || 6
  this.MayRad = config.MayRad || 6
  this.JunRad = config.JunRad || 6
  this.JulRad = config.JulRad || 6
  this.AugRad = config.AugRad || 6
  this.SepRad = config.SepRad || 6
  this.OctRad = config.OctRad || 6
  this.NovRad = config.NovRad || 6
  this.DecRad = config.DecRad || 6
  this.valveAccessory = []
  this.zoneDuration = []
  this.manufacturer = packageJson.author.name
  this.serial = this.latitude
  this.model = packageJson.name
  this.firmware = packageJson.version
  this.service = new Service.IrrigationSystem(this.name)
  if (this.recheckTime !== 0) { this.recheckEnable = true }
}

SmartSprinklers.prototype = {
  identify: function (callback) {
    this.log('Identify requested!')
    callback()
  },

  _calculateSchedule: function (callback) {
    if (workEnabled) {
      for (const job in schedule.scheduledJobs) schedule.cancelJob(job)
      const url = 'https://api.openweathermap.org/data/3.0/onecall?lat=' + this.latitude + '&lon=' + this.longitude + '&exclude=current,minutely,hourly,alerts&units=metric&appid=' + this.keyAPI
      this.log.debug('Retrieving weather data: %s', url)
      let json = {}

      got.get(url, { responseType: 'json' })
        .then(res => {
          json = res.body
          this.log.debug('Weather data: %s', json)

          const SolarRad = [this.JanRad, this.FebRad, this.MarRad, this.AprRad, this.MayRad, this.JunRad, this.JulRad, this.AugRad, this.SepRad, this.OctRad, this.NovRad, this.DecRad]
          const Weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
          const Months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

          mailTransport.host = this.smtpHost
          mailTransport.port = this.smtpPort
          mailTransport.secure = this.portSecure
          mailTransport.auth = {
            user: this.userID,
            pass: this.userPwd
          }
          mailContruct.from = this.senderName + ' <' + this.senderEmail + '>'
          mailContruct.to = this.sendTo
          mailContruct.text = ''
          let mailSubject = ''
          let pushTitle = ''
          let pushMessage = ''
          let pushcutMessage = ''
          //          let pcDevices = []
          if (this.pcDevices !== '') {
            pushcutDevices = this.pcDevices.split(',')
          }

          const pushover = new Pushover(this.userPO, this.tokenPO)
          pushover
            .setSound(this.soundPO)
            .setPriority(this.priorityPO, 3600, 60)
            .setHtml()

          const forecast = [{}, {}, {}, {}, {}, {}, {}, {}]
          for (let pop = 0; pop <= 7; pop++) {
            forecast[pop].summary = json.daily[pop].weather[0].description
            forecast[pop].sunrise = new Date(json.daily[pop].sunrise * 1000)
            forecast[pop].min = json.daily[pop].temp.min
            forecast[pop].max = json.daily[pop].temp.max
            forecast[pop].humidity = json.daily[pop].humidity
            forecast[pop].pressure = json.daily[pop].pressure
            forecast[pop].speed = json.daily[pop].wind_speed
            forecast[pop].rain = ('rain' in json.daily[pop]) ? json.daily[pop].rain : 0
            forecast[pop].clouds = json.daily[pop].clouds
            forecast[pop].ETO = eto.calculate(forecast[pop], SolarRad[forecast[pop].sunrise.getMonth()], this.altitude, this.latitude)
            if (this.verbosed) {
              this.log('-----------------------------------------------------')
              this.log('%s on %s %s with %s% clouds & %s% RH', forecast[pop].summary, Weekday[forecast[pop].sunrise.getDay()], forecast[pop].sunrise.toLocaleDateString(), forecast[pop].clouds, forecast[pop].humidity)
              this.log('ETo:%smm|Rain:%smm|Min:%s°C|Max:%s°C|Wind:%sm/s', forecast[pop].ETO.toFixed(2), forecast[pop].rain, forecast[pop].min, forecast[pop].max, forecast[pop].speed)
            }
          }

          let WaterNeeded = 0
          const wateringTime = new Array(this.zoned).fill(0)
          const zoneTimes = [[], []]
          let nDays = 1

          for (let zDay = 0; zDay <= 1; zDay++) {
            for (let zIndex = 0; zIndex <= this.zoned - 1; zIndex++) {
              if (this.zones[zIndex].enabled && this.zones[zIndex].wateringWeekdays.includes(Weekday[forecast[zDay].sunrise.getDay()]) && this.zones[zIndex].wateringMonths.includes(Months[forecast[zDay].sunrise.getMonth()])) {
                if (!this.zones[zIndex].adaptive) {
                  zoneTimes[zDay][zIndex] = this.zones[zIndex].defDuration
                } else {
                  for (nDays = 1; nDays <= 7; nDays++) {
                    const temp = Weekday[forecast[nDays + zDay].sunrise.getDay()]
                    if (this.zones[zIndex].wateringWeekdays.includes(temp)) break
                  }
                  let etoTillnext = 0
                  let rainTillnext = 0
                  for (let eDays = 0; eDays <= nDays - 1; eDays++) {
                    etoTillnext = etoTillnext + forecast[eDays + zDay].ETO
                    rainTillnext = rainTillnext + forecast[eDays + zDay].rain
                  }
                  if (this.zones[zIndex].rainFactoring) {
                    WaterNeeded = etoTillnext - rainTillnext
                    if (WaterNeeded < 0) { WaterNeeded = 0 }
                    if (this.zones[zIndex].rainThreshold < forecast[zDay].rain) { WaterNeeded = 0 }
                  } else { WaterNeeded = etoTillnext }
                  WaterNeeded = (WaterNeeded * this.zones[zIndex].cropCoef * this.zones[zIndex].plantDensity * this.zones[zIndex].expFactor * this.zones[zIndex].dripArea * this.zones[zIndex].tweakFactor) / this.zones[zIndex].efficiency
                  zoneTimes[zDay][zIndex] = WaterNeeded * 60 / (this.zones[zIndex].dripLPH * this.zones[zIndex].dripNos)
                  if (this.zones[zIndex].maxDuration <= zoneTimes[zDay][zIndex]) { zoneTimes[zDay][zIndex] = this.zones[zIndex].maxDuration }
                }
              } else {
                zoneTimes[zDay][zIndex] = 0
              }
            }
            wateringTime[zDay] = zoneTimes[zDay].reduce((a, b) => a + b, 0)
          }

          let zDay = 0
          const earliestToday = new Date(forecast[0].sunrise.getTime() - (wateringTime[zDay] + this.sunriseOffset) * 60000)
          if (earliestToday.getTime() > Date.now()) {
            zDay = 0
          } else {
            zDay = 1
          }
          const startTime = new Date(forecast[zDay].sunrise.getTime() - (wateringTime[zDay] + this.sunriseOffset) * 60000)
          const finishTime = new Date(startTime.getTime() + wateringTime[zDay] * 60000)
          servicetimeEnd = finishTime.getTime()
          fullTime = finishTime - startTime

          if (startTime.getTime() > Date.now() && !this.masterDisable && this.highThreshold < forecast[zDay].max && this.lowThreshold < forecast[zDay].min && wateringTime[zDay] !== 0) {
            for (let zone = 1; zone <= this.zoned; zone++) {
              this.zoneDuration[zone] = zoneTimes[zDay][zone - 1] / this.cycles
            }
            this.service.getCharacteristic(Characteristic.SetDuration).updateValue(wateringTime[zDay] * 60)
            this.service.getCharacteristic(Characteristic.WaterLevel).updateValue(100)

            this.log('------------------------------------------------')
            this.log('Watering starts: %s', Weekday[startTime.getDay()].substring(0, 3), startTime.toLocaleString())
            this.log('Watering finishes: %s', Weekday[finishTime.getDay()].substring(0, 3), finishTime.toLocaleString())
            this.log('Total watering time: %s minutes', format.minTommss(wateringTime[zDay]))
            this.log('------------------------------------------------')

            let waterMail = ''
            waterMail = waterMail + 'Total watering time: ' + format.minTommss(wateringTime[zDay]) + ' minutes\n'
            waterMail = waterMail + 'Start: ' + Weekday[startTime.getDay()] + ' ' + startTime.toLocaleString() + '\n'
            waterMail = waterMail + 'Finish: ' + Weekday[finishTime.getDay()] + ' ' + finishTime.toLocaleString() + '\n'
            pushcutMessage = '------------------------------------------------\n' + waterMail + '------------------------------------------------\n'
            waterMail = '----------------------------------------------------------\n' + waterMail + '----------------------------------------------------------\n'

            for (let zone = 1; zone <= this.zoned; zone++) {
              if (this.zoneDuration[zone] !== 0) {
                this.log('%s | %s minutes | %sx %s minute cycles', this.zones[zone - 1].zoneName, format.minTommss(this.zoneDuration[zone] * this.cycles), this.cycles, format.minTommss(this.zoneDuration[zone]))
                this.valveAccessory[zone].getCharacteristic(Characteristic.SetDuration).updateValue(this.zoneDuration[zone] * 60)
                waterMail = waterMail + this.zones[zone - 1].zoneName + ': ' + format.minTommss(this.zoneDuration[zone] * this.cycles) + ' minutes  |  ' + this.cycles + ' x ' + format.minTommss(this.zoneDuration[zone]) + ' min. cycles\n'
              } else {
                this.log('%s | %s minutes |     NO WATERING', this.zones[zone - 1].zoneName, format.minTommss(this.zoneDuration[zone] * this.cycles))
                this.valveAccessory[zone].getCharacteristic(Characteristic.SetDuration).updateValue(0)
                waterMail = waterMail + this.zones[zone - 1].zoneName + ':     NO WATERING\n'
              }
            }
            waterMail = waterMail + '----------------------------------------------------------\n'

            const recheck = new Date(startTime - (this.recheckTime * 60000))
            if ((recheck > Date.now()) && ((recheck - (30 * 60000)) > Date.now()) && (this.recheckEnable)) {
              recheckJob = schedule.scheduleJob(recheck, function () {
                this._calculateSchedule(function () {})
              }.bind(this))
              recheckScheduled = true
              this.log('------------------------------------------------')
              this.log('Reassessment: %s %s', Weekday[recheck.getDay()], recheck.toLocaleString())
              waterMail = waterMail + 'Reassessment: ' + Weekday[recheck.getDay()].substring(0, 3) + ' ' + recheck.toLocaleString() + '\n'
              pushcutMessage = pushcutMessage + 'Reassessment: ' + Weekday[recheck.getDay()].substring(0, 3) + ' ' + recheck.toLocaleString() + '\n'
            } else {
              recheckScheduled = false
              this.log('------------------------------------------------')
              this.log('No further reassessment before schedule!')
              waterMail = waterMail + 'No further reassessment before schedule.\n'
              pushcutMessage = pushcutMessage + 'No further reassessment before schedule.\n'
            }

            wateringJob = schedule.scheduleJob(startTime, function () {
              this.log('Starting water cycle 1/%s', this.cycles)
              pushTitle = 'Starting Irrigation'
              pushMessage = 'Starting water cycles for: ' + format.minTommss(wateringTime[zDay]) + ' minutes'
              if (this.pushEnable) {
                pushover.send(pushTitle, pushMessage).then(msj => { this.log('Pushover notification sent') }).catch(err => { this.log.warn('Pushover Error - Recheck config: ', err.message) })
              }
              if (this.pcEnable) {
                got.post(pcURL + this.pcWateringStart, { json: { text: pushMessage, title: pushTitle, sound: this.pcWateringStartSound, input: format.minTommss(wateringTime[zDay]).toString(), devices: pushcutDevices, image: pcImage }, headers: { 'API-Key': this.pcKey }, responseType: 'json' })
                  .then(res => {
                    this.log('Pushcut notification sent')
                  })
                  .catch(err => {
                    this.log('Pushcut Error: %s | %s', err.response.statusCode, err.response.body.error)
                  })
              }
              this._wateringCycle(1, 1)
            }.bind(this))

            wateringScheduled = true
            this.service.getCharacteristic(Characteristic.ProgramMode).updateValue(1)
            if (wateringDone) { mailSubject = '✅ Watering finished | ' + '♒️ Irrigation Scheduled ⏱' } else { mailSubject = '♒️ Irrigation Scheduled ⏱' }
            mailContruct.subject = mailSubject
            mailContruct.text = waterMail + '----------------------------------------------------------\n' + '----------------------FORECAST--------------------\n' + format.forecastMail(forecast, Weekday)
            wateringDone = false
            pushMessage = waterMail + format.forecastPush(forecast, Weekday)
            pushTitle = mailSubject
            if (this.pushEnable) {
              pushover.send(pushTitle, pushMessage).then(msj => { this.log('Pushover notification sent') }).catch(err => { this.log.warn('Pushover Error - Recheck config: ', err.message) })
            }
            if (this.pcEnable) {
              got.post(pcURL + this.pcWeatherChecked, { json: { text: pushcutMessage, title: mailSubject, input: 'Scheduled', sound: this.pcWeatherCheckedSound, devices: pushcutDevices, image: pcImage }, headers: { 'API-Key': this.pcKey }, responseType: 'json' })
                .then(res => {
                  this.log('Pushcut notification sent')
                })
                .catch(err => {
                  this.log('Pushcut Error: %s | %s', err.response.statusCode, err.response.body.error)
                })
            }
            if (this.emailEnable) {
              sendEmail(mailTransport, mailContruct).then(res => { this.log('Email notification sent') }).catch(err => { this.log.warn('Error: ', err.message) })
            }
          } else {
            wateringScheduled = false
            let reasonNoschedule = ''
            this.service.getCharacteristic(Characteristic.WaterLevel).updateValue(0)
            this.service.getCharacteristic(Characteristic.ProgramMode).updateValue(0)

            this.log('------------------------------------------------')
            this.log('No schedule set:')
            if (this.masterDisable) {
              reasonNoschedule = '-Irrigation disabled \n'
              this.log('-Irrigation disabled')
            }
            if (startTime.getTime() < Date.now()) {
              reasonNoschedule = reasonNoschedule + '-Not enough time to complete before desired time \n'
              this.log('-Not enough time to complete before desired time')
            }
            if (this.highThreshold > forecast[zDay].max) {
              reasonNoschedule = reasonNoschedule + '-Forecasted MAX temp is less than highThreshold \n'
              this.log('-Forecasted MAX temp is less than high threshold')
            }
            if (this.lowThreshold > forecast[zDay].min) {
              reasonNoschedule = reasonNoschedule + '-Forecasted MIN temp is less than lowThreshold \n'
              this.log('-Forecasted MIN temp is less than low threshold')
            }
            if (wateringTime[zDay] === 0) {
              reasonNoschedule = reasonNoschedule + '-No schedule available or no watering needed \n'
              this.log('-No schedule available or no watering needed')
            }

            this.log('Recalculation set for: %s', forecast[zDay].sunrise.toLocaleString())
            reasonNoschedule = reasonNoschedule + 'Recalculation set for:\n'

            if (wateringDone) { mailSubject = '✅ Watering finished | ' + '🚫 No Irrigation Scheduled' } else { mailSubject = '🚫 No Irrigation Scheduled' }
            let waterMail = '----------------------------------------------------------\n' + 'No schedule set: \n'
            pushcutMessage = '------------------------------------------------\n' + 'No schedule set: \n'
            waterMail = waterMail + reasonNoschedule + Weekday[forecast[zDay].sunrise.getDay()] + ', ' + forecast[zDay].sunrise.toLocaleString() + '\n'
            pushcutMessage = pushcutMessage + reasonNoschedule + Weekday[forecast[zDay].sunrise.getDay()] + ', ' + forecast[zDay].sunrise.toLocaleString() + '\n'
            pushMessage = waterMail
            waterMail = waterMail + '----------------------------------------------------------\n' + '----------------------FORECAST--------------------\n'
            mailContruct.text = waterMail + format.forecastMail(forecast, Weekday)
            mailContruct.subject = mailSubject
            wateringDone = false
            pushTitle = mailSubject
            pushcutMessage = pushcutMessage + '------------------------------------------------\n'
            pushMessage = pushMessage + format.forecastPush(forecast, Weekday)
            if (this.pushEnable) {
              pushover.send(pushTitle, pushMessage).then(msj => { this.log('Pushover notification sent') }).catch(err => { this.log.warn('Pushover Error - Recheck config: ', err.message) })
            }
            if (this.pcEnable) {
              got.post(pcURL + this.pcWeatherChecked, { json: { text: pushcutMessage, title: mailSubject, input: 'Not Scheduled', sound: this.pcWeatherCheckedSound, devices: pushcutDevices, image: pcImage }, headers: { 'API-Key': this.pcKey }, responseType: 'json' })
                .then(res => {
                  this.log('Pushcut notification sent')
                })
                .catch(err => {
                  this.log('Pushcut Error: %s | %s', err.response.statusCode, err.response.body.error)
                })
            }
            if (this.emailEnable) {
              sendEmail(mailTransport, mailContruct).then(res => { this.log('Email notification sent') }).catch(err => { this.log.warn('Error: ', err.message) })
            }
            schedule.scheduleJob(forecast[zDay].sunrise, function () {
              this._calculateSchedule(function () {})
            }.bind(this))
          }
          this.log('------------------------------------------------')
          callback()
        })
        .catch(err => {
          this.log.warn('Error getting weather data or %s', err.message)
          setTimeout(() => {
            this._calculateSchedule(function () {})
          }, 60000)
          callback()
        })
    } else { this.log.warn('Check configuration errors. Currently disabled!') }
  },

  _wateringCycle: function (zone, cycle) {
    if (this.zoneDuration[zone] !== 0) {
      this.valveAccessory[zone].setCharacteristic(Characteristic.Active, 1)
      zoneEnd[zone] = Date.now() + (this.zoneDuration[zone] * 60000)
    }
    setTimeout(() => {
      if (this.zoneDuration[zone] !== 0) { this.valveAccessory[zone].setCharacteristic(Characteristic.Active, 0) }
      const nextZone = zone + 1
      if (nextZone <= this.zoned) {
        this._wateringCycle(nextZone, cycle)
      } else {
        const nextCycle = cycle + 1
        if (nextCycle <= this.cycles) {
          this._wateringCycle(1, nextCycle)
          this.log('Starting watering cycle %s/%s', nextCycle, this.cycles)
        } else {
          this.log('Watering finished')
          wateringDone = true
          if (this.pcEnable) {
            got.post(pcURL + this.pcWateringEnd, { json: { text: 'The scheduled irrigation has been completed', title: '✅ Watering Finished!', sound: this.pcWateringEndSound, devices: pushcutDevices, image: pcImage }, headers: { 'API-Key': this.pcKey }, responseType: 'json' })
              .then(res => {
                this.log('Pushcut Watering End notification sent')
              })
              .catch(err => {
                this.log('Pushcut Error: %s | %s', err.response.statusCode, err.response.body.error)
              })
          }
          this._calculateSchedule(function () {})
        }
      }
    }, this.zoneDuration[zone] * 60000)
  },

  setActive: function (zone, value, callback) {
    this.log('%s | Set state to %s', this.zones[zone - 1].zoneName, value)
    this.valveAccessory[zone].getCharacteristic(Characteristic.InUse).updateValue(value)
    this.service.getCharacteristic(Characteristic.InUse).updateValue(value)
    callback()
  },

  masterHandle: function (value, callback) {
    getState('masterState').then(ret => {
      if (ret === false && value === true) { this._calculateSchedule(function () {}) }
      if (value === true) {
        this.log('Enabling irrigation. Will also recalculate now...')
      } else {
        this.log('Disabling irrigation and cancelling next watering cycle if scheduled')
        if (wateringScheduled) { wateringJob.cancel() }
        this.service.getCharacteristic(Characteristic.ProgramMode).updateValue(0)
      }
      this.masterDisable = !value
      storeState('masterState', value)
    })
    callback()
  },

  recheckHandle: function (value, callback) {
    getState('recheckState').then(ret => {
      if (ret === false && value === true) { this._calculateSchedule(function () {}) }
      if (value === true) {
        this.log('Enabling reassesment. Will also recalculate now...')
      } else {
        this.log('Disabling reassesment and cancelling next reassessment if scheduled')
        if (recheckScheduled) { recheckJob.cancel() }
      }
      this.recheckEnable = value
      storeState('recheckState', value)
    })
    callback()
  },

  mailHandle: function (value, callback) {
    let state = ''
    if (value === true) { state = 'Enable' } else { state = 'Disable' }
    this.log('Set Email notifications to: %s', state)
    this.emailEnable = value
    storeState('mailState', value)
    callback()
  },

  pushHandle: function (value, callback) {
    let state = ''
    if (value === true) { state = 'Enable' } else { state = 'Disable' }
    this.log('Set Pushover notifications to: %s', state)
    this.pushEnable = value
    storeState('pushState', value)
    callback()
  },

  pushcutHandle: function (value, callback) {
    let state = ''
    if (value === true) { state = 'Enable' } else { state = 'Disable' }
    this.log('Set Pushcut notifications to: %s', state)
    this.pcEnable = value
    storeState('pushcutState', value)
    callback()
  },

  zoneRemainingTime: function (zone, callback) {
    if (this.valveAccessory[zone].getCharacteristic(Characteristic.InUse).value) {
      const remaining = Math.floor((zoneEnd[zone] - Date.now()) / 1000)
      if (remaining < 0) {
        callback(null, 0)
      } else {
        callback(null, remaining)
      }
    } else {
      callback(null, 0)
    }
  },

  serviceRemainingTime (callback) {
    if (this.service.getCharacteristic(Characteristic.InUse).value) {
      const remaining = Math.floor((servicetimeEnd - Date.now()) / 1000)
      if (remaining < 0) {
        callback(null, 0)
      } else {
        callback(null, remaining)
      }
    } else {
      callback(null, 0)
    }
  },

  showWaterlevel (callback) {
    if (this.service.getCharacteristic(Characteristic.ProgramMode).value) {
      const remaining = Math.floor((servicetimeEnd - Date.now()) * 100 / fullTime)
      if (remaining < 0 || remaining > 100) {
        callback(null, 100)
      } else {
        callback(null, remaining)
      }
    } else {
      callback(null, 0)
    }
  },

  getServices: function () {
    this.service.getCharacteristic(Characteristic.ProgramMode).updateValue(0)
    this.service.getCharacteristic(Characteristic.Active).updateValue(1)
    this.service.getCharacteristic(Characteristic.InUse).updateValue(0)
    this.service.getCharacteristic(Characteristic.SetDuration).updateValue(0)
    this.service.getCharacteristic(Characteristic.RemainingDuration).updateValue(0)
    this.service.getCharacteristic(Characteristic.WaterLevel)
    this.service
      .getCharacteristic(Characteristic.RemainingDuration)
      .setProps({ maxValue: 18000 })

    this.service
      .getCharacteristic(Characteristic.SetDuration)
      .setProps({ maxValue: 18000 })

    this.service
      .getCharacteristic(Characteristic.RemainingDuration)
      .on('get', this.serviceRemainingTime.bind(this))

    this.service
      .getCharacteristic(Characteristic.WaterLevel)
      .on('get', this.showWaterlevel.bind(this))

    this.informationService = new Service.AccessoryInformation()
    this.informationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.SerialNumber, this.serial)
      .setCharacteristic(Characteristic.FirmwareRevision, this.firmware)
      .setCharacteristic(Characteristic.ValveType, 0)

    const services = [this.informationService, this.service]

    for (let zone = 1; zone <= this.zoned; zone++) {
      const accessory = new Service.Valve(this.zones[zone - 1].zoneName, zone)

      accessory
        .setCharacteristic(Characteristic.ServiceLabelIndex, zone)
        .setCharacteristic(Characteristic.ValveType, 1)

      accessory
        .getCharacteristic(Characteristic.Active)
        .on('set', this.setActive.bind(this, zone))

      accessory
        .getCharacteristic(Characteristic.RemainingDuration)
        .on('get', this.zoneRemainingTime.bind(this, zone))

      this.valveAccessory[zone] = accessory

      this.valveAccessory[zone]
        .getCharacteristic(Characteristic.RemainingDuration)
        .setProps({ maxValue: 7200 })

      this.valveAccessory[zone]
        .getCharacteristic(Characteristic.SetDuration)
        .setProps({ maxValue: 7200 })

      this.service.addLinkedService(accessory)
      services.push(accessory)
    }

    if (this.exposeControls) {
      this.log('Exposing controls to Homekit...')
      const masterSwitch = new Service.Switch(this.name + ' Master', 'master')
      masterSwitch.getCharacteristic(Characteristic.On)
        .on('set', this.masterHandle.bind(this))
      getState('masterState').then(ret => {
        if ((ret === undefined) || (ret === true)) {
          masterSwitch.setCharacteristic(Characteristic.On, true)
        } else {
          masterSwitch.setCharacteristic(Characteristic.On, false)
        }
      })
      masterSwitch.setCharacteristic(Characteristic.ServiceLabelIndex, this.zoned + 1)
      this.service.addLinkedService(masterSwitch)
      services.push(masterSwitch)
      this.log('Exposed Master Control')

      if (this.recheckTime !== 0) {
        const recheckSwitch = new Service.Switch(this.name + ' Recheck', 'recheck')
        recheckSwitch.getCharacteristic(Characteristic.On)
          .on('set', this.recheckHandle.bind(this))
        getState('recheckState').then(ret => {
          if ((ret === undefined) || (ret === true)) {
            recheckSwitch.setCharacteristic(Characteristic.On, true)
          } else {
            recheckSwitch.setCharacteristic(Characteristic.On, false)
          }
        })
        recheckSwitch.setCharacteristic(Characteristic.ServiceLabelIndex, this.zoned + 2)
        this.service.addLinkedService(recheckSwitch)
        services.push(recheckSwitch)
        this.log('Exposed Recheck Control')
      }

      if (this.emailEnable) {
        const mailSwitch = new Service.Switch(this.name + ' Email Notify', 'email')
        mailSwitch.getCharacteristic(Characteristic.On)
          .on('set', this.mailHandle.bind(this))
        getState('mailState').then(ret => {
          if ((ret === undefined) || (ret === true)) {
            mailSwitch.setCharacteristic(Characteristic.On, true)
          } else {
            mailSwitch.setCharacteristic(Characteristic.On, false)
          }
        })
        mailSwitch.setCharacteristic(Characteristic.ServiceLabelIndex, this.zoned + 3)
        this.service.addLinkedService(mailSwitch)
        services.push(mailSwitch)
        this.log('Exposed Email Notification Control')
      }

      if (this.pushEnable) {
        const pushSwitch = new Service.Switch(this.name + ' Pushover Notify', 'push')
        pushSwitch.getCharacteristic(Characteristic.On)
          .on('set', this.pushHandle.bind(this))
        getState('pushState').then(ret => {
          if ((ret === undefined) || (ret === true)) {
            pushSwitch.setCharacteristic(Characteristic.On, true)
          } else {
            pushSwitch.setCharacteristic(Characteristic.On, false)
          }
        })
        pushSwitch.setCharacteristic(Characteristic.ServiceLabelIndex, this.zoned + 4)
        this.service.addLinkedService(pushSwitch)
        services.push(pushSwitch)
        this.log('Exposed Pushover Notification Control')
      }

      if (this.pcEnable) {
        const pushcutSwitch = new Service.Switch(this.name + ' Pushcut Notify', 'pushcut')
        pushcutSwitch.getCharacteristic(Characteristic.On)
          .on('set', this.pushcutHandle.bind(this))
        getState('pushcutState').then(ret => {
          if ((ret === undefined) || (ret === true)) {
            pushcutSwitch.setCharacteristic(Characteristic.On, true)
          } else {
            pushcutSwitch.setCharacteristic(Characteristic.On, false)
          }
        })
        pushcutSwitch.setCharacteristic(Characteristic.ServiceLabelIndex, this.zoned + 5)
        this.service.addLinkedService(pushcutSwitch)
        services.push(pushcutSwitch)
        this.log('Exposed Pushcut Notification Control')
      }
    }

    this.log('Initialized %s zones', this.zoned)
    this._calculateSchedule(function () {})
    return services
  }
}
