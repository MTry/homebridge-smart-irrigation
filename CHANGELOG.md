# Change Log
All meaningful changes will be logged here.

## **1.7.2 [14-07-2022] - dependency fix**

### *Fixed:*
- Bumps got from 11.8.3 to 11.8.5.

## **1.7.1 [10-05-2022] - Bug fix**

### *Fixed:*
- Storage cache location - should now work on all platforms - including docker!

- Fixed subdirectory name so existing platforms not affected by this will keep the persisting control settings from earlier.

## **1.7.0 [10-05-2022] - Big fix**

### *Fixed:*
- Storage cache location - should now work on all platforms - including docker!

### *PLEASE NOTE:*
- The location update on cache directory may impact the state of controls as saved earlier - please set again on your home app once.

## **1.6.0 [30-03-2022] - module update**

### *Changes:*
- module updates/bug fixes (thanks @angyalz)

## **1.5.5 [30-03-2022] - security updates**

### *Changes:*
- Upgrade dependencies versions

## **1.5.4 [29-08-2021] - security updates**

### *Changes:*
- Upgrade dependencies versions

## **1.5.3 [21-07-2021] - nodemailer update**

### *Changes:*
- Upgrade nodemailer from 6.6.1 to 6.6.2

## **1.5.2 [14-06-2021] - Bug fix**

### *Fixed:*
- Security update

## **1.5.1 [20-04-2021] - Bug fix**

### *Fixed:*
- Declaration scope leading to plugin crash

## **1.5.0 [19-04-2021]**

### *Added:*
- Ability to specify receiving devices with Pushcut

## **1.4.1 [19-04-2021]**

### *Added:*
- Code of Conduct, Contribution & Security Policy
- Discord & Reddit link to Readme

### *Changes:*
- Code optimisation
- Some refactoring for code clarity

## **1.4.0 [16-04-2021] - Pushcut is here!!**

### *Added:*
- Pushcut notifications - on Weather Check, Watering Start & Watering End
- Pushcut notifications control `switch`

### *Fixed:*
- Spelling errors in logs
### *Changes:*
- `lowThreshold` default [5°C] and range [0-20 °C]
- `highThreshold` default [10°C] and range [5-30 °C]
- Corresponding Readme & Changelog updates

## **1.3.5 [15-04-2021]**

### *Fixed:*
- Typos in logs/notifications

## **1.3.4 [15-04-2021]**

### *Added:*
- Reason information in logs and push/email when no scheduling set [#2](https://github.com/MTry/homebridge-smart-irrigation/issues/2)

## **1.3.3 [13-04-2021]**

### *Added:*
- Added `.gitignore` & `CHANGELOG.md`

### *Fixed:*
- Pruned OWM `API` call for faster response with only the relevant data
### *Changes:*
- Adopted `standard` coding style
- modularize `ETo` calculation section
- modularize format section - this will evolve over time
- updated dependencies version to most recent

## **1.3.1 [11-04-2021] - Water Level Patch**

### *Fixed:*
- If schedule is set the Water Level displays `100%` else `0%`
### *Changes:*
- General cleanup

## **1.3.0 [10-04-2021] - Water Level Characteristic**

### *Added:*
- `WaterLevel` Characteristic to the primary service that shows the `%` of watering cycle remaining
- Configuration alerts in case of abnormal settings made directly in `config.json`
### *Fixed:*

- Semver alignment

## **1.2.11 [09-04-2021] - Home App Controls**

### *Added:*
- Option to expose system controls to Homekit
    - `Master` Enable/Disable irrigation
    - `Recheck` Enable/Disable reassessment
    - `Email Notify` Enable/Disable email notifications
    - `Push Notify` Enable/Disable push notifications

## **1.1.11 [05-04-2021] - Push Notifications**

### *Added:*
Add [Pushover](https://pushover.net/) credentials to receive push notifications on you devices
 - Starting of water cycle
 - Conclusion of water cycle
 - Schedule details
 - Reassessed schedule details
 - Today's forecasted weather along with the calculated <b>ET<sub>o</sub></b>

## **1.0.11 [02-04-2021] - Default & Remaining Duration Update**

### *Added:*
- The `Set Duration` of the service is set at the total watering duration on every calculation
- The individual zones `Set Duration` at the corresponding zone's ***single-cycle time***
- `Remaining Duration` of the service counts down to `0` through the runtime
- Active zone displays the `Remaining Duration` of that cycle

## **1.0.10 [31-03-2021] - Migration to `got`**

### *Fixed:*
- Better error handling & reporting
### *Changes:*
- Migration from `request` to `got` - no more deprecated dependency package warnings!

## **1.0.9 [30-03-2021]**

### *Fixed:*
- Graceful handling in case of OWM API erros  - doesn't crash HB anymore
- Graceful handling in case of email configuration errors

## **1.0.8 [30-03-2021]**

### *Added:*
 - Readme & logo updates

## **1.0.7 [28-03-2021]**

### *Changes:*
 - node base version requirement update >=10

## **1.0.6 [28-03-2021]**

### *Fixed:*
 - purge orphaned schedules before reassessment
 - add separator line before reassessment time display
 - remove console message indicating sent mail


## **1.0.5 [27-03-2021] - Stable Release**
