import { Entity } from "../entity";
import { IDamageHandler, IFieldHandler } from "../../eventHandler";
import { CompareRace, DmgType } from "../enums";
import { CardAction } from "./cardAction";
import { ExtendedSocket } from "../../customSocket";

// 3티어 : 영웅 : 영혼 곡예사
// 종족 : 없음 | 3/3
// 아군 악마가 죽은 후에, 무작위 적 하수인에게 피해를 3->6 줍니다.

export class SoulJuggler extends CardAction implements IDamageHandler, IFieldHandler {
    public Init() {
        this.Session.fieldEvent.On(this);
    }

    public onAttack() {}
    public onGuard() {}
    public onDamaged() {}
    public onKilled() {}
    public onMoved() {}

    public onSpawn(sender: Entity) {
        if (sender.ID !== this.Entity.ID) return;
        this.Session.damageEvent.On(this);
    }

    public onDestroy(sender: Entity) {
        if (sender.ID !== this.Entity.ID) return;
        this.Session.damageEvent.Off(this);
        this.Session.fieldEvent.Off(this);
    }

    public onDead(sender: Entity): void {
        if (false === this.IsMine(sender) || false === CompareRace(sender.MakeCard().race, 'DEMON')) return;
        const eff = JSON.parse(this.Entity.MakeCard().effect);
        if (eff == null) return;
        this.Shoot(sender.Socket, this.Entity, eff.DMG);
    }

    private Shoot(cli: ExtendedSocket, entity: Entity, dmg: number) {
        const opponent = this.Session.GetOpponent(cli);
        if (opponent == null) return;

        const opFields = this.Session.Field(opponent)?.Entities;
        if (opFields == null || opFields.length == 0) return;
        const rand = this.GetRandomOf(opFields);
        console.log(`FIRE! ${entity.CardName} --${dmg}--> ${rand.CardName}`);
        entity.DamageTo(rand, dmg, DmgType.EFFECT);
    }

}