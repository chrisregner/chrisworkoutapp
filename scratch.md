Non progression based tracking (e.g. pull up bar hold/jump rope time increasing over time)
Disallow/handle on UI/logic when selecting a progression grid more than twice (once for heavy, once for light)

--- PIVOT (Goal 2 program def) ---
- Materialized microcycle model, NOT swap-derived. Program → Microcycle[] → Day[] → Activity[] (nested G3).
- Microcycle = periodization term replacing "week" (calendar-banned). Kept "Program"/"Day".
- Rest between exercises = positional RestPeriod; HL variance via concrete authored days.
- Rest between sets = VolumeSet.restBetweenSets; HL heavy/light symmetric-or-neither.
- invertDay/invertMicrocycle pure domain helpers (UI seeds, then editable).
- Rotation cursor (RotationPosition {microcycleId,dayId}, ID-based) + logging = Goal 3, separate services.
- Full spec: specs/program-definition.md

---

- equipment definition
  - name (e.g. kettlebell)
  - isCombinable = false (e.g. can you use 1kg and 2kg plate to have 3kg)
  - pieces
    - weight (e.g. 12kg, 16kg)
    - quantity

- excercise definition
    - name (e.g. Turkish Get Up)
    - amount
      - type reps/seconds/minutes
      - presets (number[], e.g. sets can only be 1, 3, 6, 10 for reverse pyramid clean, or just 1-24 for other exercises)
    - resistance
      - types
        - either equipment definition, or number[], e.g. you only have 12kg and 16kg kettlebell
    - type: warmup, cooldown, main
    - increments
      - Basic [resistance, amount][]
      - Heavy Light Cycle - requires amount and weight
        - sets of weights
        - sets of reps
        - lists of heavy light pair [(resistance, amount), (resistance, amount)][]
          - volume = weight * reps
          - light volume > heavy volume
          - heavy weight > light weight

- program definition
  - day
    - activities (list)
      - rest period
      - excercises
        - exercise definitinon
        - high or low if applicable
        - rest between sets
        - sets count
    - somehow we need to be able to create programs that alternate heavy light non-swapped and swapped days
      - RESOLVED: materialize, don't derive. Program → Microcycle[] → Day[] → Activity[].
        Light counterpart = concrete authored microcycle/day seeded by invertDay/invertMicrocycle,
        then freely editable. No `swap` flag. Rest variance dissolves (just author the number).
        See specs/program-definition.md "The pivot".

- log (not sure how to structure)
    - date
    - time start and time end for whole workout
    - time start and end for each exercise
    - weight/amount if defined in workout definition, so we can track progression per exercise

- features
  - sample types of exercises supported
    - exercises that has reps/sets/weight like kettlebell exerises
    - time based stretch cooldowns
    - repetition based calisthenic warmup exercises
  - workout - has to be seamless
    - tap todays workout
      - start
      - per exercise
        - shows what exercise
        - tap start
        - tap end, 
          - feedback - if defined decrease increment
          - free form notes optional
      - per rest
        - tap start/end
        - optional: +5/+10/+30/+60 and minus equivalents to tweak rest
      - tracked: date/time of workout session and each segment
  - adding exercise definition
    - defining increments (basic or heavy/light)
  - data
    - ai prompt creator to create json import code
    - json import for
      - exercise definitions
      - programs definitions
      - log data
    - json export for log data
  - later
    - chart per exercise definition of volume
    - free form categorized tags
      - category: equipment, tag: kettlebell, category: per-side, tag: per-side (no tag means unilateral)
- technical
  - docker
  - frontend only for now
  - react
  - mantine ui
  - mobile first design
  - pglite

"Continue rolling rotation" logic. When you tap "today's workout," it should serve up next day in rotation, not today's calendar day. This is the key UX decision for a rolling program — get it right and the app is invisible; get it wrong and you fight it constantly.

The rolling rotation is the whole UX. Don't accidentally build a calendar-based app. The home screen should be: "Next workout: Day 4. Tap to start." Not a weekly grid. Get this wrong and the app becomes a chore.
