// #region For DB (use int for enum)
export const CardType: string[] = ['MINION', 'HERO', 'ABILITY'];
export const CardRank: string[] = ['COMMON', 'RARE', 'HEROIC', 'LEGENDARY'];
export const CardRace: string[] = ['NONE', 'MURLOC', 'DEMON', 'MECH', 'ELEMENTAL', 'BEAST', 'DRAGON', 'ALL'];

function getIDX(arr: string[], val: string|number) : number {
    if (typeof val === 'number') return val;
    return arr.indexOf(val);
}

function compare(arr: string[], left: string|number, right: string|number) {
    const idx1 = getIDX(arr, left);
    const idx2 = getIDX(arr, right);
    return idx1 === idx2;
}

export function CompareType(left: string|number, right: string|number) {
    return compare(CardType, left, right);
}
export function CompareRank(left: string|number, right: string|number) {
    return compare(CardRank, left, right);
}
export function CompareRace(left: string|number, right: string|number) {
    return compare(CardRace, left, right);
}
// #endregion

export enum STAT_MOD_ID {
    SHOP_FREEZE,
    HERO_POWER,

    CUSTOM
}

export enum Tag {
    FROZEN,
    TAUNT,
    POISONOUS,
    WINDFURY,
    DIVINESHIELD
}

export enum DmgType {
    NORMAL,
    COUNTER,
    EFFECT,
}