<p align="center">
  <a href="https://github.com/MTry/homebridge-smart-irrigation"><img src="https://github.com/MTry/homebridge-smart-irrigation/blob/master/branding/logo.png" height="150"></a>
</p>

<span align="center">

# Homebridge Smart Irrigation
[![npm](https://img.shields.io/npm/dt/homebridge-smart-irrigation?style=plastic)](https://www.npmjs.com/package/homebridge-smart-irrigation) [![npm](https://img.shields.io/npm/v/homebridge-smart-irrigation?style=plastic)](https://www.npmjs.com/package/homebridge-smart-irrigation) [![NPM](https://img.shields.io/npm/l/homebridge-smart-irrigation?style=plastic)](https://github.com/MTry/homebridge-smart-irrigation)

</span>

## Description

Turn any electrical irrigation valve into a smart-valve!

This [Homebridge](https://github.com/nfarina/homebridge) plugin exposes a multi-zone irrigation sprinkler <b>dummy control system</b> to Apple's [HomeKit](http://www.apple.com/ios/home/).

Although a <i>dummy</i>, it brings smarts of an <b>evapotranspiration</b>[<b>ET<sub>o</sub></b>] based climate/plant adaptive irrigation controller with the use of [OpenWeatherMap API](https://openweathermap.org/api). All parameters can be configured from the Homebridge UI and the plugin offers granular control specific to every zone's individual requirerments.

The plugin can optionally email you with the watering schedule it has calculated, or when a watering run is completed, along with the next 7-day weather forecast.

## Why?
Searching for an irrigation or sprinkler control plugin never showed any suitable option for my needs. The one that came closest, and is the ***inspiration and basis*** for this plugin is [Tom Rodrigues's](https://github.com/Tommrodrigues) [homebridge-web-sprinklers](https://github.com/Tommrodrigues/homebridge-web-sprinklers). But like many others, I didn't have the http hardware for it to control, or the inclination to rig it! What I did have access to, were some solenoid valves which I could power from a smart socket that was exposed to Homekit. So I stripped the code to just expose the dummy sprinkler accessories, reworked the irrigation logic - and then, one thing led to another.. in my quest to achieve a more granular control and incorporate more irrigation science to create a climate adaptive irrigation controller.

## Basic use case..
1. Configure the plugin with your parameters to expose the required number sprinkler accessories(zones)
2. Use the Eve app or another Homekit controller app to configure ***ANY*** other smart plug or outlet in your Homekit ecosystem to follow the state of the above exposed sprinklers
3. The smartplug/outlet/valve in their simplest configuration could be just driving the power of any solenoid valve that controls watering to a zone!

## Installation

1. Install [Homebridge](https://github.com/nfarina/homebridge#installation-details)
2. Install this plugin: `npm install -g homebridge-smart-irrigation`
3. Sign up at the [OpenWeatherMap website](https://openweathermap.org/api) and retrieve your API key (if you want adaptive control). The free tier allows 1000 API calls a day and this plugin will make no more than a couple on any day!
4. Gather the mean daily Solar Radiation figures for your location in kWh/day. Please read the settings section for more details
5. Configure the settings
6. Use the Eve app or any other Homekit controller app to setup automations for your smartplug or outlet to follow the state of the zones exposed by the plugin

## Operating Principle

One of the primary factors affecting the water demand of plants is <b>evapotranspiration</b>, also denoted as <b>ET<sub>o</sub></b> and expressed in <i>mm</i>. While the subject of irrigation is one of extensive global research and there is no end to the extent of complication one can end up with, this plugin chooses to focus on three - <b>ET<sub>o</sub></b>, <b>local rain</b> and the <b>crop characteristics</b> of each of the zones configured. 

<b>ET<sub>o</sub></b> is calculated using the [<i>Penman-Monteith Evapotranspiration (FAO-56) Method</i>](https://edis.ifas.ufl.edu/pdffiles/ae/ae45900.pdf). Those interested in a deeper understanding of the principles may head to this excellent resource of [FAO](http://www.fao.org/3/X0490E/x0490e00.htm#Contents). The factors used include the following <b><i>(daily)</i></b>:
1. Min/Max Temperatures
2. Mean RH
3. Wind speed
4. Shortwave Solar Radiation <i>[more on this later..]</i>
5. Atmospheric Pressure (barometric)
6. Latitude
7. Elevation
8. Julian day

<b>Rain</b> is derived from [OpenWeatherMap API](https://openweathermap.org/api) along with some of the factors above using the `latitude` and `longitude` configured.

<b>Crop characteristics</b> use some of the understanding gained from the website of [University of California, Division of Agriculture and Natural Resources](https://ucanr.edu/sites/UrbanHort/Water_Use_of_Turfgrass_and_Landscape_Plant_Materials/) and particularly from this document for [calculating drip irrigation schedules](https://ucanr.edu/sites/scmg/files/30917.pdf). Specifically, it utilises the following based on the conditions of the particular zone being irrigated:
1. Crop coefficients [0.1 - 0.9] based on the type of plants [Read here!](https://ucanr.edu/sites/UrbanHort/Water_Use_of_Turfgrass_and_Landscape_Plant_Materials/Plant_Factor_or_Crop_Coefficient__What’s_the_difference/)
2. Planting Density [0.5 - 1.3]
3. Exposure Factor [0.5 - 1.4] based on the zone's microclimate

Additionally, information about the number of drip emitters, their discharge rate, area irrigated and efficiency is considered with the above factors.

## Operating Logic & Scheduling

If `masterDisable` is not checked, the plugin will calculate the total watering durartion and check if watering can be completed today before sunrise or by the time as specified in `sunriseOffset`. If not, it will schedule the irrigation for the next day. Regardless of `masterDisable` it will gather the weather information and also send a notification email if `emailEnable` is set.

Forecasted low and high temperature higher than their respective thresholds must be met for the day being scheduled.

If `adaptive` watering is disabled for a zone, but scheduling remains `enabled`, the zone will be watered for the number of minutes specified by `defDuration` and not factor any other calculations.

The plugin schedules asynchronous zone watering - cycling sequentially through all the scheduled zones needing water one at a time and repeats the process the number of times specified by `cycles`.

Start times will vary daily as a result of changing sunrise times as well as the calculated watering time based on the weather factors.
> `recheckTime` instructs the plugin to reassess the watering times based on the most current forecast available `15`, `30` or `60` minutes prior to the scheduled run - if this is of no use to you set it to `0`. But for many living in tropical regions where climate modeling is far too complex to give accurate forecasting, this can be helpful as the forecasts change frequently or significantly.

1. Gather weather forecast for the next 7-day period
2. Using the above and Solar Radiation data, calculate projected <b>ET<sub>o</sub></b> for the next 7 days
3. If the zone is `enabled` & `adaptive`, calculate the total <b>ET<sub>o</sub></b> until the next watering day
4. If `rainFactoring` is enabled, calculate the total projected rainfall till the zone's next watering day
5. Calculate the net irrigation requirement based on total <b>ET<sub>o</sub></b> and total rain till the zone's next watering
6. Calculate zone specific time required based on that zone's irrigation infrastructure and crop profile
7. Schedule the watering run and send notification email if `emailEnable`
8. Reassess `recheckTime` minutes before the scheduled run

## Primary Settings

| Key | Description | Default |
| --- | --- | --- |
| `name` | Name that appears in the Home app | N/A |
| `verbosed` | Verbose Calculations and Extended Climate data | `true` |
| `masterDisable` | Disable scheduling all irrigation | `false` |
| `recheckTime` | Reassess - minutes before runtime | `0` |
| `cycles` | Number of cycles per watering run | `2` |
| `sunriseOffset` | Minutes before sunrise that watering should get over by | `0` |
| `lowThreshold` | Skip scheduling when forecasted minimum temperature falls below this | `10` |
| `highThreshold` | Skip scheduling when forecasted maximum temperature stays below this | `20` |
| `keyAPI` | Your OpenWeatherMap API Key | N/A |
| `latitude` | Enter the latitude in decimals including '-' if in the southern hemisphere | N/A |
| `longitude` | Your decimal longitude | N/A |
| `altitude` | Enter the altitude in meters | `0` |

## Email Notification Settings
Currently this supports basic authentication. If using Gmail, you will need to go to the security settings of your account to enable less secure app access. *It might be best to create a specific ID for this purpose to avoid security risks to your main account!*

| Key | Description | Default |
| --- | --- | --- |
| `emailEnable` | Enable Notifications | `false` |
| `senderName` | Sender Name | N/A |
| `senderEmail` | Sender Email ID | N/A |
| `sendTo` | Receiver Email ID | N/A |
| `smtpHost` | SMTP Host | N/A |
| `smtpPort` | SMTP Port | N/A |
| `portSecure` | Secure Port | `false` |
| `userID` | SMTP Username | N/A |
| `userPwd` | SMTP Password | N/A |

## Monthly data of Mean Daily Solar Radiation [kWh/day]

There are several sources but the one that I used is [Weatherspark](https://weatherspark.com). Search for your location. Scroll to the bottom of the page to the Solar Energy section and note the figures for each month(the months are clickable!) in kWh/day which is the daily mean figure for the month. Feel free to use an alternate source that you trust but keep in mind the unit of measurment - **kWh/day**!

Going forward, it will be great to extract live daily shortwave radiation data/forecast through an API instead of relying on historical averages.. hopefully will get there soon!

| Key | Description | Default |
| --- | --- | --- |
| `xxxRad` | Mean Daily Solar Radiation [kWh/day] for the month `xxx`| `6` |

## Zones setup
This is where multiple zones can be configured - with a limit of `8 zones` at the moment. <i>There is no reason why more than 8 zones will not work so if this becomes a constraint, let me know and I will bump up this limit!</i><br>
> **Crop Coefficient** - [Read here for reference!](https://ucanr.edu/sites/UrbanHort/Water_Use_of_Turfgrass_and_Landscape_Plant_Materials/Plant_Factor_or_Crop_Coefficient__What’s_the_difference/)<br>
This is based on the crop type or species and their water needs. [`0.1 - 0.9`]

> **Planting Density**<br>
> Low—sparse: `0.5 - 0.9`<br>
> Average—moderate coverage: `1`<br>
> High--complete coverage: `1.1 - 1.3`<br>

> **Exposure Factor**<br>
> The microclimate or exposure factor [`0.5 - 1.4`]<br>
Average--open field: `1.0`<br>
Low--moderate wind, part sun: `0.5 - 0.9`<br>
High--stronger winds and greater exposure: `1.1 - 1.4`<br>
*A protected, shady location would use a lower factor.*

| Key | Description | Default |
| --- | --- | --- |
| `zoneName` | Friendly zone name | N/A |
| `enabled` | Zone Enabled | `true` |
| `adaptive` | Climate Adaptive Zone | `true` |
| `rainFactoring` | Factor rain amount in watering & respect the set threshold to skip irrigation for this zone| `true` |
| `defDuration` | Default zone duration in minutes when not adaptive [max `120`] | `20` |
| `maxDuration` | Maximum duration settable in minutes [max `120`]| `30` |
| `rainThreshold` | Rain Threshold[`mm`] above which watering skipped for this zone | `2.5` |
| `tweakFactor` | The *human* factor to *tweak* proposed watering in `%` [`max:200`] | `100` |
| `dripLPH` | Drip emitter discharge rate in LPH (of a single emitter)| `2` |
| `dripNos` | Number of drip emitters used in this zone | `1` |
| `dripArea` | Irrigation area in `m`<sup>`2`</sup>| `1` |
| `efficiency` | Irrigation system efficiency  - usually `90%` for drip | `90` |
| `cropCoef` | Crop Coefficient [`0.1 - 0.9`] | `0.5` |
| `plantDensity` | Plantation Density [`0.5 - 1.3`] | `1` |
| `expFactor` | Exposure Factor [`0.5 - 1.4`] | `1` |
| `wateringWeekdays` | Weekdays to water - *at least 1!* | ALL |
| `wateringMonths` | Watering Months - *uncheck to skip watering in that month* | ALL |

## Notes & Suggestions

- For any of the smart outlets/sockets you intend to use by following the zone states for driving irrigation valves, do setup an additional automation in Homekit to switch them off after a preset time - this can be a kind of failsafe in case the plugin crashes for any reason and leaves the zone turned on indefinately.<br>

- The plugin pairs very well with multi-channel devices such as the 4CHPRO from Sonoff which has dry contacts to relay low voltage AC/DC to control solenoid valves and also has a wide operating voltage range. I use 2 of these mounted in an IP65 outdoor enclosure to run a 8-zone 12VDC configuration. The plugin used to expose the 4CHPRO is [homebridge-ewelink](https://github.com/bwp91/homebridge-ewelink) plugin from [Ben](https://github.com/sponsors/bwp91), who somehow manages to squeeze more than 24 hours in a day giving support, adding features and fixing bugs!

- Homekit allows a maximum settable `on` time of `60` minutes for a `sprinkler`. If the watering requirement for a zone is more, one can sneak around this limitation by enabling multiple cycles, each being less than `60` minutes. `defDuration` & `maxDuration` are currently limited to `120` minutes but will gladly increase this if it is limiting many users.

- If you are using a zone to water a set of pots, each with a single drip emitter, a reasonable way to configure would be to set `dripArea` as the area of a single pot and `dripNos` to `1`. The rest of the zone settings to be configured as per requriement.

- If you are using a zone to water in a protected space, consider disabling `rainFactoring` for that zone - since the plants never receive any rainfall, and the reduction in  <b>ET<sub>o</sub></b> is already factored in calculating the zone timing, you should be good to go!

- Use `tweakFactor` to modulate what the system calculates as the requirement for a zone. Do start with 100%, which means no change and then go lower or higher based on whether you feel the system is overestimating or underestimating the zone's water requirement.

## Way forward..

- [ ] Update `Remaining Duration` on the accessory/service - or an alternate way to show how much time is remaining

- [ ] The plugin uses [request](https://github.com/request/request) which is now deprecated - would like to transition to either [node-fetch](https://www.npmjs.com/package/node-fetch), [got](https://www.npmjs.com/package/got) or any other suitable one which is lightweight and easy to implement - help solicited!

- [ ] Use live daily shortwave solar radiation data/forecast through an API instead of relying on having to feed historical averages.. the only  service I am aware of which has a free option is [Solcast](https://solcast.com/solar-radiation-data/) which offers 10 API calls a day. Any suggestions if its worth doing this?

- [ ] Push messages to indicate start and completion of scheduled irrigation

- [ ] Prettier HTML email notifications!

## Support/Contribution

I dont have a great deal of programming experience so the biggest help and contribution you can make is helping with the code or "Way forward.." items!

If financial contribution is on your agenda, may I humbly redirect you to [Homebridge](https://github.com/nfarina/) which makes this community possible. Also consider supporting several fine developers who offer an incredible amount of their time and effort in supporting the community and creating extraordinary plugins.