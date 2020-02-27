import { Session } from "./ingame/session";
import { Entity } from "./data/entity";
import { Hero } from "./data/hero";
import { DmgType } from "./data/enums";

interface Delegate {
    (...args: any[]): any;
}

export interface ITurnHandler {
    onTurnBegin(session: Session): void;
    onTurnEnd(session: Session): void;    
}

export interface IUpgradeHandler {
    onUpgrade(entity: Hero): void;
}

export interface IShopHandler {
    onBuyCard(entity: Entity): void;
    onSellCard(entity: Entity): void;
}

export interface IHandHandler {
    onAddToHand(entity: Entity): void;
    onLeaveFromHand(entity: Entity): void;
}

export interface IFieldHandler {
    onSpawn(sender: Entity, by: Entity): void;
    onMoved(sender: Entity, by: Entity): void;
    onDestroy(sender: Entity, by: Entity): void;
}

export interface IDamageHandler {
    onAttack(sender: Entity, other: Entity, dmg: number, type: DmgType): void;
    onDamaged(sender: Entity, other: Entity, dmg: number, type: DmgType): void;
    onGuard(sender: Entity, other: Entity, dmg: number, type: DmgType): void;
    onKilled(sender: Entity, other: Entity, dmg: number, type: DmgType): void;
    onDead(sender: Entity, other: Entity, dmg: number, type: DmgType): void;
}

export class EventHandler<T> {
    private handlers: T[] = [];
    private once: T[] = [];
    private toRemove: T[] = [];

    public On(handler: T) {
        this.handlers.push(handler);
    }
    
    public Off(handler: T) {
        this.toRemove.push(handler);
    }
    
    public Once(handler: T) {
        this.once.push(handler);
    }

    private Remove(val: T, from: T[]) {
        const idx = from.indexOf(val);
        if (idx < 0) {
            return;
        }
        from.splice(idx, 1);
    }

    private Clear(arr: T[]) {
        arr.splice(0, arr.length);
    }

    public CleanUp() {
        const rm = [...this.toRemove];
        this.Clear(this.toRemove);
        rm.forEach(handler => {
            this.Remove(handler, this.handlers);
            this.Remove(handler, this.once);
        });
    }

    public Process(cb: (handler: T) => void) : T[] {
        const ret = [...this.handlers, ...this.once];
        this.toRemove.push(...this.once);
        this.Clear(this.once);
        ret.forEach(handler => cb(handler));
        return ret;
    }
}

// export class EventHandler<T = Delegate> {
//     private events: { [key: string]: T } = {};

//     public AddEvent(key: string, ev: T) {
//         if (this.events[key]) console.error('[EventHandler] Already have a event with same key!', key);
//         this.events[key] = ev;
//     }

//     public RemoveEvent(key: string) : T {
//         const event = this.events[key];
//         if (null == event) {
//             console.error("[EventHandler] Can't find event with key!", key);
//             return null;
//         }
//         this.events[key] = null;
//         delete this.events[key];
//         return event;
//     }

//     public Once(key: string, ev: T) {
//         const cb = (...args) => {
//             (<Delegate><unknown>ev)(...args);
//             this.RemoveEvent(key);
//         };
//         this.AddEvent(key, <T><unknown>cb);
//     }

//     public Invoke(...args: any[]) {
//         Object.values(this.events).forEach((ev: T) => (<Delegate><unknown>ev)(...args))
//     }
// }