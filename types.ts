type EquipmentDef = {
    name: string;
    description: string;
    /** e.g. can you use 1kg and 2kg plate to have 3kg */
    isCombinable: boolean
    pieces: EquipmentPiece[]
}

type EquipmentPiece = {
    resistanceType: 'weight' | 'other'
    resistance: number
    quantity: number
}

type ExerciseDef = {
    name: string
    description: string
    quantifiers: 'reps' | 'time'
    quantifiersRange: QuantifierRange
    resistance?: EquipmentPiece
    shouldCombineResistance: boolean
    tag?: Tag[]
    progressions: ExerciseProgression[]
}

type QuantifierRange = QuantifierRangeMinMax | QuantifierRangeSets

type QuantifierRangeMinMax = {
    min: number
    max: number
}
type QuantifierRangeSets = number[]

type ExerciseProgression = LinearProgression | HeavyLightProgression

type LinearProgression = {
    type: 'linear'
    volumeSets: VolumeSet[]
}

type HeavyLightProgression = {
    type: 'heavyLight'
    volumeSets: [VolumeSet, VolumeSet][]
}

type ExerciseQuantifier = {
    /** time = seconds, reps self-explanatory */
    type: 'reps' | 'time'
    value: number
}

type VolumeSet = {
    sets: number
    quantifierValue: number
    resistanceValue: number
}

type Tag = {
    name: string
    category: TagCategory
}

/**
 * Presets: Purpose (warmup/cooldown/main
 */
type TagCategory = {
    name: string
    tags: Tag[]
}
