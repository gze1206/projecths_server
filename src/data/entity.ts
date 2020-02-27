import { Card } from "./card";
import { Tag, DmgType } from "./enums";
import { ExtendedSocket } from "../customSocket";
import { EventHandler } from "../eventHandler";

export class Status {
    public MaxHP: number;
    public HP: number;
    public Attack: number;
    public Tags: string[];
}

export enum STAT_MOD_METHOD {
    'SET', 'ADD'
}

export class StatModify {
    public ID: number;
    public By: string;
    public Method: STAT_MOD_METHOD;
    public Stackable: boolean;
    public Stat: any|Status;
}

export class Entity {
    private static NEXT_ID: number = 0;
    private id: number;
    protected card: Card;
    protected stat: Status;
    protected calcStat: Status;
    protected statMods: StatModify[] = [];
    public Socket: ExtendedSocket;
    public IsGenerated: boolean = false;
    public ExtraFields: any = {};
    
    constructor(from: Card) {
        // console.log('json : ', JSON.stringify(from));
        this.id = Entity.NEXT_ID++;
        this.card = from;

        const eff = JSON.parse(from.effect);
        if (eff.STAT) {
            this.stat = this.copyStat({}, eff.STAT);
            if (this.stat.Tags == null) {
                this.stat.Tags = [];
            }
            this.stat.MaxHP = this.stat.HP;

            this.RecalcStat();
        }
    }

    public Recover() {
        // console.log(`RECOVER ${this.stat.HP} -> ${this.stat.MaxHP}`);
        this.stat.HP = this.stat.MaxHP;
        this.ExtraFields = {};
        this.RecalcStat();
    }

    public DamageTo(to: Entity, dmg: number, type: DmgType = DmgType.NORMAL) {
        const session = this.Socket.session;
        to.RecalcStat();
        const old = to.CalcStat.HP;
        if (to.HasTag(Tag.DIVINESHIELD)) {
            const broken = to.ExtraFields.BROKEN_SHIELD;
            if (broken == null || broken == false) {
                console.log('shield break');
                to.ExtraFields.BROKEN_SHIELD = true;
                console.log(`ATK: ${this.Socket.username}'s ${this.CardName}(${this.ID}) -> ${to.Socket.username}'s ${to.CardName}(${to.ID})\n${old} - ${dmg} = ${to.CalcStat.HP} (천보, ${DmgType[type]})`);
                session.damageEvent.Process(h => {
                    h.onGuard(to, this, dmg, type);
                    h.onAttack(this, to, dmg, type);
                });
                return;
            }
            console.log('shield broken');
        }
        to.Stat.HP -= dmg;
        to.RecalcStat();
        console.log(`ATK: ${this.Socket.username}'s ${this.CardName}(${this.ID}) -> ${to.Socket.username}'s ${to.CardName}(${to.ID})\n${old} - ${dmg} = ${to.CalcStat.HP} (${DmgType[type]})`);
        session.damageEvent.Process(h => {
            h.onAttack(this, to, dmg, type);
            h.onDamaged(to, this, dmg, type);
        });


        if (to.CalcStat.HP <= 0 || this.HasTag(Tag.POISONOUS)) {
            session.damageEvent.Process(h => {
                h.onKilled(this, to, dmg, type);
                h.onDead(to, this, dmg, type);
            });
        }
    }

    public AddMod(mod: StatModify) {
        if (false === mod.Stackable) {
            const idx = this.statMods.findIndex(iter => iter.ID === mod.ID);
            if (idx >= 0) {
                this.statMods.splice(idx, 1);
            }
        }
        this.statMods.push(mod);
        this.ApplyMod(mod);        
    }

    public RemoveMod(id: number) {
        this.statMods = this.statMods.filter(mod => id != mod.ID);
        this.RecalcStat();
    }

    protected ApplyMod(mod: StatModify) {
        switch (mod.Method) {
            case STAT_MOD_METHOD.SET:
                this.calcStat = this.copyStat(this.calcStat, mod.Stat);
                break;
            case STAT_MOD_METHOD.ADD:
                this.calcStat = this.mergeStat(this.calcStat, mod.Stat);
                break;
        }
    }

    protected copyStat(from: any, stat: any) : Status {
        const ret: any = Object.assign({}, from);
        Object.keys(stat).forEach(key => {
            const val = stat[key];
            if (Array.isArray(val)) {
                ret[key] = [...val];
                return;
            }
            ret[key] = val;
        });
        return ret;
    }

    protected mergeStat(stat: any, other: any) : Status {
        Object.keys(other).forEach(key => {
            let myVal = stat[key];
            let val = other[key];
            // console.log(key, myVal, val);

            if (Array.isArray(myVal)) myVal = [...myVal];
            if (Array.isArray(val)) val = [...val];

            if (myVal != null && val == null) return;
            if (val != null && myVal == null) {
                stat[key] = val;
            }

            if (Array.isArray(myVal)) {
                stat[key] = [...myVal, ...val];
                return;
            }
            stat[key] = myVal + val;
        });
        return stat;
    }

    public RecalcStat() {
        this.calcStat = this.copyStat({}, this.stat);

        this.statMods.forEach(mod => {
            this.ApplyMod(mod);
        });
    }

    public HasTag(tag: string|Tag) : boolean {
        let str: string;
        if (typeof tag === 'string') {
            str = tag;
        }
        else {
            str = Tag[tag];
        }

        return this.calcStat.Tags.includes(str);
    }

    public MakeCard() : Card {
        const ret = new Card();
        Object.keys(this.card).forEach(key => {
            ret[key] = this.card[key];
        });

        const eff = JSON.parse(this.card.effect);
        eff.STAT = this.calcStat;
        if (eff.STAT && eff.STAT.Tags == null) {
            eff.STAT.Tags = [];
        }
        ret.effect = JSON.stringify(eff);

        if (eff.STAT?.RACE) {
            ret.race = eff.STAT.RACE;
        }
        
        return ret;
    }

    public Clone() : Entity {
        return Object.assign({}, this);
    }

    public Merge(other: Entity) : Entity {
        other.statMods.forEach(mod => this.AddMod(mod));
        this.RecalcStat();
        return this;
    }

    public get ID() : number {
        return this.id;
    }
    
    public get CardID() : number {
        return this.card.id;
    }

    public get CardName() : string {
        return this.card.name;
    }

    public get IsGold() : boolean {
        return this.card.is_gold;
    }

    public get Tier() : number {
        return this.card.tier;
    }

    public get Type() : number { 
        return this.card.type;
    }
    
    public get Stat() : Status {
        return this.stat;
    }

    public get CalcStat() : Status {
        return this.calcStat;
    }
    
}