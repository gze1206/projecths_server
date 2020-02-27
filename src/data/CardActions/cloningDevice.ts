import { Entity, STAT_MOD_METHOD } from "../entity";
import { IFieldHandler, IShopHandler, ITurnHandler } from "../../eventHandler";
import { CardAction } from "./cardAction";
import { STAT_MOD_ID } from "../enums";

// 3티어 : 희귀 : 복제장치
// 종족 : 없음 | 1/1 -> 2/2
// 이 하수인은 항상 내 전장에 마지막으로 소환된 하수인과 같은 종족이 됩니다.

export class CloningDevice extends CardAction implements IShopHandler, IFieldHandler {

    public Init() {
        this.Session.shopEvent.On(this);
        this.Session.fieldEvent.On(this);
    }

    public onMoved() {}
    public onDestroy() {}
    public onBuyCard() {}

    public onSellCard(sender: Entity) {
        if (sender.ID !== this.Entity.ID) return;
        this.Session.fieldEvent.Off(this);
        this.Session.shopEvent.Off(this);
    }

    public onSpawn(sender: Entity) {
        if (!this.Session.IsShopPhase || !this.IsMine(sender)) return;
        if (sender.CardName === this.Entity.CardName) return;
        this.Entity.AddMod({
            ID: STAT_MOD_ID.CUSTOM + this.Entity.ID,
            By: this.Entity.CardName,
            Method: STAT_MOD_METHOD.SET,
            Stackable: false,
            Stat: {
                RACE: sender.MakeCard().race,
            }
        });
        this.Entity.RecalcStat();
        this.Session.NotifyCards(this.Entity.Socket);
    }

}