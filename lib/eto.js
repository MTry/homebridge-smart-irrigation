/* eslint no-undef: "error" */
/* eslint-env node */

function calculate (climate, solarRad, alt, lat) {
  const tMean = (climate.max + climate.min) / 2
  const rS = solarRad * 3.6
  const U_2 = climate.speed * 0.748
  const slopeSvpc = 4098 * (0.6108 * Math.exp((17.27 * tMean) / (tMean + 237.3))) / Math.pow((tMean + 237.3), 2)
  const pA = climate.pressure / 10
  const pSc = pA * 0.000665
  const DT = slopeSvpc / (slopeSvpc + (pSc * (1 + (0.34 * U_2))))
  const PT = pSc / (slopeSvpc + (pSc * (1 + (0.34 * U_2))))
  const TT = U_2 * (900 / (tMean + 273))
  const eTmax = 0.6108 * Math.exp(17.27 * climate.max / (climate.max + 237.3))
  const eTmin = 0.6108 * Math.exp(17.27 * climate.min / (climate.min + 237.3))
  const eS = (eTmax + eTmin) / 2
  const eA = climate.humidity * eS / 100
  const now = new Date(climate.sunrise.getTime())
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = (now - start) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000)
  const DoY = Math.floor(diff / (1000 * 60 * 60 * 24))
  const dR = 1 + 0.033 * Math.cos(2 * Math.PI * DoY / 365)
  const sD = 0.409 * Math.sin((2 * Math.PI * DoY / 365) - 1.39)
  const lRad = lat * Math.PI / 180
  const sunsetHA = Math.acos(-(Math.tan(sD) * Math.tan(lRad)))
  const Ra = (1440 / Math.PI) * 0.082 * dR * ((sunsetHA * Math.sin(lRad) * Math.sin(sD)) + (Math.cos(lRad) * Math.cos(sD) * Math.sin(sunsetHA)))
  const Rso = Ra * (0.75 + (2 * alt / 100000))
  const Rns = rS * (1 - 0.23)
  let Rnl = 4.903 * Math.pow(10, -9) * (Math.pow((273.16 + climate.max), 4) + Math.pow((273.16 + climate.min), 4)) / 2
  Rnl = Rnl * (0.34 - (0.14 * Math.sqrt(eA)))
  Rnl = Rnl * ((1.35 * rS / Rso) - 0.35)
  const rN = Rns - Rnl
  const rNg = 0.408 * rN
  const etRad = DT * rNg
  const etWind = PT * TT * (eS - eA)
  const eTo = etRad + etWind
  return eTo
}

module.exports = { calculate }
