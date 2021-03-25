<p align="center">
  <a href="https://github.com/homebridge/homebridge"><img src="https://raw.githubusercontent.com/homebridge/branding/master/logos/homebridge-color-round-stylized.png" height="140"></a>
</p>

<span align="center">

# Homebridge Smart Irrigation
</span>

## Description

This [homebridge](https://github.com/nfarina/homebridge) plugin exposes a multi-zone irrigation sprinkler <b>dummy control system</b> to Apple's [HomeKit](http://www.apple.com/ios/home/).

Although a <i>dummy</i>, it brings smarts of a climate/plant adaptive irrigation controller with the use of [OpenWeatherMap API](https://openweathermap.org/api). All parameters can be configured from the configuration UI.

## Operating Principle

One of the primary factors affecting the water demand of plants is <b>evapotranspiration</b>, also denoted as <b>ET<sub>o</sub></b>. While the subject of irrigation is one of extensive global research and there is no end to the extent of complication one can end up with, this plugin chooses to focus on three - <b>ET<sub>o</sub></b>, <b>local rain</b> and the <b>crop characteristics</b> of each of the zones configured. 

<b>ET<sub>o</sub></b> is calculated using the [<i>Penman-Monteith Evapotranspiration (FAO-56 Method)</i>](https://edis.ifas.ufl.edu/pdffiles/ae/ae45900.pdf). Those interested in a deeper understanding of the principles may head to this excellent resource of [FAO](http://www.fao.org/3/X0490E/x0490e00.htm#Contents). The factors used include the following <b><i>(daily)</i></b>:
1. Min/Max Temperatures
2. Mean RH
3. Wind speed
4. Solar Radiation <i>[more on this later..]</i>
5. Atmospheric Pressure (barometric)
6. Latitude
7. Elevation
8. Julian day

<b>Rain</b> is derived from [OpenWeatherMap API](https://openweathermap.org/api) along with some of the factors above using the `latitude` and `longitude` configured.

<b>Crop characteristics</b> uses some of the understanding gained from the website of [University of California, Division of Agriculture and Natural Resources](https://ucanr.edu/sites/UrbanHort/Water_Use_of_Turfgrass_and_Landscape_Plant_Materials/) and particularly from this document for [calculating drip irrigation schedules](https://ucanr.edu/sites/scmg/files/30917.pdf). Specifically, it utilises the following based on the conditions of the particular zone being irrigated:
1. Crop coefficients [0.1 - 0.9] based on the type of plant [Read here!](https://ucanr.edu/sites/UrbanHort/Water_Use_of_Turfgrass_and_Landscape_Plant_Materials/Plant_Factor_or_Crop_Coefficient__What’s_the_difference/)
2. Planting Density [0.5 - 1.3]
3. Exposure Factor [0.5 - 1.4] based on the zone's microclimate

Additionally, information about the number of drip emitters, their discharge rate, area irrigated and efficiency is considered with the above factors. 