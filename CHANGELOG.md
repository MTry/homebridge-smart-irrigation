# Change Log
All meaningful changes will be logged here.

## **1.3.2 [13-04-2021]**

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