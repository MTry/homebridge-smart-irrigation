<p align="center">
  <a href="https://github.com/homebridge/homebridge"><img src="https://raw.githubusercontent.com/homebridge/branding/master/logos/homebridge-color-round-stylized.png" height="140"></a>
</p>

<span align="center">

# Homebridge Smart Irrigation
</span>

## Description

This [homebridge](https://github.com/nfarina/homebridge) plugin exposes a multi-zone irrigation sprinkler <b>dummy control system</b> to Apple's [HomeKit](http://www.apple.com/ios/home/).

Although a <i>dummy</i>, it brings smarts of a climate/plant adaptive irrigation controller with the use of [OpenWeatherMap API](https://openweathermap.org/api). All parameters can be configured from the configuration UI. 

The plugin can optionally email you with the watering schedule it has calculated, or when a watering run is completed, along with the next 7-day weather forecast.

## Why?
Searching for an irrigation or sprinkler control plugin never showed any suitable option for my needs. The one that came closest and is the <b><u>inspiration and basis</b></u> for this plugin is [Tom Rodrigues's](https://github.com/Tommrodrigues) [homebridge-web-sprinklers](https://github.com/Tommrodrigues/homebridge-web-sprinklers). But like many others, I didn't have the http hardware for it to control! So I stripped the code to just expose the dummy accessories, reworked the irrigation logic - and then one thing led to another.. in my quest to achieve a more granular control and incorporate more irrigation science to create a climate adaptive irrigation controller.

## Basic use case..
1. Configure the plugin with your parameters to expose the required number sprinkler accessories(zones)
2. Use Eve or other Homekit controller to configure <b><u>ANY</b></u> other smart plug or outlet or valve to follow the state of the above exposed sprinklers
3. The smartplug/outlet/valve in their simplest configuration could be just driving the power of any solenoid valve that controls watering to a zone!

## Installation

1. Install [homebridge](https://github.com/nfarina/homebridge#installation-details)
2. Install this plugin: `npm install -g git+https://github.com/MTry/homebridge-smart-irrigation.git`
3. Sign up at the [OpenWeatherMap API](https://openweathermap.org/api) and retrieve your API key (if you want scheduling). The free tier allows you 1000 API calls a day and this plugin will make only a couple!
4. Configure the settings

## Operating Principle

One of the primary factors affecting the water demand of plants is <b>evapotranspiration</b>, also denoted as <b>ET<sub>o</sub></b> and expressed in <i>mm</i>. While the subject of irrigation is one of extensive global research and there is no end to the extent of complication one can end up with, this plugin chooses to focus on three - <b>ET<sub>o</sub></b>, <b>local rain</b> and the <b>crop characteristics</b> of each of the zones configured. 

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
1. Crop coefficients [0.1 - 0.9] based on the type of plants [Read here!](https://ucanr.edu/sites/UrbanHort/Water_Use_of_Turfgrass_and_Landscape_Plant_Materials/Plant_Factor_or_Crop_Coefficient__What’s_the_difference/)
2. Planting Density [0.5 - 1.3]
3. Exposure Factor [0.5 - 1.4] based on the zone's microclimate

Additionally, information about the number of drip emitters, their discharge rate, area irrigated and efficiency is considered with the above factors.

## Operating Logic

1. Gather weather forecast for the next 7-day period
2. Using the above and Solar Radiation data, calculate projected <b>ET<sub>o</sub></b> for the next 7 days
3. If the zone is `enabled` & `adaptive`, calculate the total <b>ET<sub>o</sub></b> until the next watering day
4. If `rainFactoring` is enabled, calculate the total projected rainfall till the zone's next watering day
5. Calculate the net irrigation requirement based on total <b>ET<sub>o</sub></b> and total rain till the zone's next watering
6. Calculate zone specific time required basd on that zone's irrigation infrastructure and crop profile
7. Schedule the watering run and send notification email if `emailEnable`
8. Reassess `recheckTime` minutes before the scheduled run

## Primary Settings

| Key | Description | Default |
| --- | --- | --- |
| `name` | Name to appear in the Home app | N/A |
| `verbosed` | Verbose Calculations and Extended Climate data | true |
| `masterDisable` | Disable scheduling all irrigation | false |
| `recheckTime` | Reassess - minutes before runtime | 0 |
| `cycles` | Number of cycles per watering run | 2 |
| `sunriseOffset` | Minutes before the sunrise watering should get over by | 0 |
| `lowThreshold` | Skip scheduling when forecasted minimum temperature falls below this | 10 |
| `highThreshold` | Skip scheduling when forecasted maximum temperature stays below this | 20 |
| `keyAPI` | Your OpenWeatherMap API Key | N/A |
| `latitude` | Enter the latitude in decimals including '-' if in the southern hemisphere | N/A |
| `longitude` | Your decimal longitude | N/A |
| `altitude` | Enter the altitude in meters | 0 |

## Email Notification Settings

| Key | Description | Default |
| --- | --- | --- |
| `emailEnable` | Enable Notifications | false |
| `senderName` | Sender Name | N/A |
| `senderEmail` | Sender Email ID | N/A |
| `sendTo` | Receiver Email ID | N/A |
| `smtpHost` | SMTP Host | N/A |
| `smtpPort` | SMTP Port | N/A |
| `portSecure` | Secure Port | false |
| `userID` | SMTP Username | N/A |
| `userPwd` | SMTP Password | N/A |

## Monthly Mean Daily Solar Radiation Data [kWh/day]

This requires some explanation. 
