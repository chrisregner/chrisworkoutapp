type EquipmentDef = {
    name: string;
    description?: string;
    /**
     * Whether pieces can stack to form a new resistance value.
     * e.g. 1kg + 2kg plate = 3kg (true). Kettlebells (false).
     */
    isCombinable: boolean
    unit: 'kg' | 'lb'
    /** Invariant: non-empty. */
    pieces: EquipmentPiece[]
}

type EquipmentPiece = {
    /** Interpretation depends on parent `EquipmentDef.resistanceType`. */
    resistance: number
    /** Invariant: integer >= 1. How many of this piece the user owns. */
    quantity: number
}

type ExerciseDef = {
    name: string
    description?: string
    quantifierType: 'reps' | 'seconds'
    quantifierRule: QuantifierRule
    resistance?: EquipmentDef
    shouldCombineResistance?: boolean   
}

/**
 * Tied to one exercise; volume sets reference its equipment pieces.
 * Reusable across multiple programs.
 *
 * Invariant (runtime-validated, not type-enforced):
 *   Every `VolumeSet.resistanceSource[].piece` must come from
 *   `exercise.resistance.pieces`.
 *
 * Note: `VolumeSet.resistanceSource[].piece` stores piece by value.
 * Editing the underlying `EquipmentDef` later does not propagate;
 * progressions hold a structural snapshot.
 */
type ProgressionDef = {
    name: string
    exercise: ExerciseDef
    body: ProgressionBody
}

type ProgressionBody = LinearProgression | HeavyLightProgression


type QuantifierRule = QuantifierMinMax | QuantifierAllowedValues

/** Invariant: min >= 1, max >= min. */
type QuantifierMinMax = {
    kind: 'min-max'
    min: number
    max: number
}
/** Invariant: non-empty, all values >= 1, unique, sorted ascending. */
type QuantifierAllowedValues = {
    kind: 'allowed-values',
    values: number[]
}

type LinearProgression = {
    kind: 'linear'
    /**
     * Invariant: non-empty. Order matters — represents progression sequence
     * (e.g. week 1 → week 2 → ...). Intended to be monotonically increasing in
     * load (resistance and/or volume); not type-enforced.
     */
    volumeSets: VolumeSet[]
}

/**
 * Invariant:
 * heavy.resistance > light.resistance
 * light volume > heavy volume
 * (volume = sets * quantifierValue * totalResistance).
 */
type HeavyLightProgression = {
    kind: 'heavyLight'
    /**
     * Invariant: non-empty. Order matters — progression sequence across cycles.
     * Each pair: heavy.resistance > light.resistance, light volume > heavy volume.
     */
    volumeSets: { heavy: VolumeSet, light: VolumeSet }[]
}

type VolumeSet = {
    /** Invariant: integer >= 1. */
    sets: number
    /**
     * Invariant: >= 1. Must satisfy the owning exercise's `quantifierRule`
     * (within MinMax range, or member of AllowedValues).
     */
    quantifierValue: number
    /**
     * Invariants:
     *   - Empty iff owning exercise has no `resistance` (bodyweight).
     *   - Each entry's `piece` must come from `exercise.resistance.pieces`.
     *   - Each entry's `quantity` is integer >= 1 and <= `piece.quantity`
     *     (cannot use more than the user owns).
     *   - Multiple entries require `exercise.resistance.isCombinable === true`.
     */
    resistanceSource: {
        piece: EquipmentPiece,
        quantity: number
    }[]
}
