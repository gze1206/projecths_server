import { Entity } from "../entity";
import { IDamageHandler, IFieldHandler } from "../../eventHandler";
import { CardAction } from "./cardAction";
import { DmgType } from "../enums";

// 4티어 : 일반 : 동굴 히드라
// 종족 : 야수 | 2/4 -> 4/8
// 공격하는 대상 양옆의 하수인들에게도 피해를 줍니다.

export class CaveHydra extends CardAction implements IDamageHandler, IFieldHandler {
    public Init() {
        this.Session.fieldEvent.On(this);
    }

    public onDamaged() {}
    public onGuard() {}
    public onKilled() {}
    public onDead() {}
    public onMoved() {}

    public onSpawn(sender: Entity) {
        if (sender.ID !== this.Entity.ID) return;
        this.Session.damageEvent.On(this);
        console.log(`Add handler : ${sender.CardName}(${sender.ID})`);
    }

    public onDestroy(sender: Entity) {
        if (sender.ID !== this.Entity.ID) return;
        this.Session.damageEvent.Off(this);
        this.Session.fieldEvent.Off(this);
    }

    public onAttack(sender: Entity, target: Entity, dmg: number, type: DmgType): void {
        if (sender.ID !== this.Entity.ID || dmg <= 0 || type !== DmgType.NORMAL) return;
        const opponent = this.Session.GetOpponent(sender.Socket);
        const opFields = this.Session.Field(opponent)?.Entities;
        if (opFields == null || opFields.length == 0) return;
        const idx = opFields.findIndex(e => target.ID === e.ID);
        if (idx < 0) return;
        console.log(`RANGE ATTACK from ${idx}`);
        this.RangeAttack(opFields, idx-1, dmg);
        this.RangeAttack(opFields, idx+1, dmg);
    }

    private RangeAttack(opFields: Entity[], idx: number, dmg: number) {
        if (idx < 0 || idx >= opFields.length) return;
        const entity = opFields[idx];
        this.Entity.DamageTo(entity, dmg, DmgType.EFFECT);
        console.log(`RANGE ATK! IDX-${idx} ${this.Entity.CardName}(${this.Entity.ID}) --${dmg}--> ${entity.CardName}(${entity.ID})`);
    }

}