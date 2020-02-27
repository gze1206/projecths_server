import { Entity } from "../entity";
import { IDamageHandler, IFieldHandler } from "../../eventHandler";
import { CardAction } from "./cardAction";
import { ExtendedSocket } from "../../customSocket";
import { Card } from "../card";
import { DataManager } from "../dataManager";

// 5티어 : 영웅 : 공허군주
// 종족 : 악마 | 3/9 -> 6/18
// 도발, 죽음의 메아리 : 도발 능력이 있는 1/3->2/6 악마를 셋 소환합니다.

export class Voidlord extends CardAction implements IDamageHandler, IFieldHandler {
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
        if (sender.ID !== this.Entity.ID) return;
        const eff = JSON.parse(this.Entity.MakeCard().effect);
        if (eff == null) return;
        const summonID = eff.SUMMON;
        if (summonID == null) return;

        const card = this.GetCardByID(summonID);
        if (card == null) return;

        const cli = this.Entity.Socket;
        const myField = this.Session.Field(cli);
        const myIDX = myField.Entities.findIndex(e => e.ID === this.Entity.ID);
        if (myIDX < 0) return;

        this.Summon(cli, card, myIDX);
        this.Summon(cli, card, myIDX);
        this.Summon(cli, card, myIDX);
    }

    public Summon(cli: ExtendedSocket, card: Card, pos: number) {
        const myField = this.Session.Field(cli);
        const entity = new Entity(card);
        if (entity == null) return;

        entity.Socket = cli;
        DataManager.UseCardAction(this.Session, entity);
        myField.Insert(pos, entity, this.Entity);
    }

}