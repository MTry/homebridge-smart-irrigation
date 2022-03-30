/* eslint no-undef: "error" */
/* eslint-env node */

function minTommss (minutes) {
  const sign = minutes < 0 ? '-' : ''
  const min = Math.floor(Math.abs(minutes))
  const sec = Math.floor((Math.abs(minutes) * 60) % 60)
  return sign + (min < 10 ? '0' : '') + min + ':' + (sec < 10 ? '0' : '') + sec
}

function forecastMail (forecast, Weekday) {
  let fMail = '----------------------------------------------------------\n'
  for (let dd = 0; dd <= 7; dd++) {
    fMail = fMail + forecast[dd].summary + ' on ' + Weekday[forecast[dd].sunrise.getDay()] + ' with ' + forecast[dd].clouds + '% clouds' + '\n'
    fMail = fMail + 'Sunrise: ' + forecast[dd].sunrise.toLocaleString() + '  |  RH: ' + forecast[dd].humidity + '%\n'
    fMail = fMail + '[Min | Max] Temp: ' + forecast[dd].min + '°C | ' + forecast[dd].max + '°C' + '\n'
    fMail = fMail + 'Pressure: ' + forecast[dd].pressure + ' hPa | Wind: ' + forecast[dd].speed + ' m/s' + '\n'
    fMail = fMail + 'Precipitation: ' + forecast[dd].rain + ' mm | ETo: ' + forecast[dd].ETO.toFixed(2) + ' mm' + '\n'
    fMail = fMail + '----------------------------------------------------------\n'
  }
  return fMail
}

function forecastPush (forecast, Weekday) {
  let fPush = '----------------------------------------------------------\n'
  fPush = fPush + Weekday[forecast[0].sunrise.getDay()] + ': ' + forecast[0].summary + ' with ' + forecast[0].clouds + '% clouds' + '\n'
  fPush = fPush + 'Sunrise: ' + forecast[0].sunrise.toLocaleString() + '  |  RH: ' + forecast[0].humidity + '%\n'
  fPush = fPush + '[Min | Max] Temp: ' + forecast[0].min + '°C | ' + forecast[0].max + '°C' + '\n'
  fPush = fPush + 'Pressure: ' + forecast[0].pressure + ' hPa | Wind: ' + forecast[0].speed + ' m/s' + '\n'
  fPush = fPush + 'Precipitation: ' + forecast[0].rain + ' mm | ETo: ' + forecast[0].ETO.toFixed(2) + ' mm' + '\n'
  fPush = fPush + '----------------------------------------------------------\n'
  return fPush
}

export { minTommss, forecastMail, forecastPush }
