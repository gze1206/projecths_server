import { HeroPower } from "../heroPower";
import { STAT_MOD_ID } from "../enums";
import { STAT_MOD_METHOD } from "../entity";

export class HP_Yogg extends HeroPower {
    
    public Do() {
        const session = this.Socket.session;
        const shop = session.Shop(this.Socket);
        if (shop.Entities.length === 0) return;
        const rand = shop.BuyAt(Math.floor(Math.random() * shop.Entities.length));
        rand.AddMod({
            ID: STAT_MOD_ID.HERO_POWER,
            By: session.Hero(this.Socket).CardName,
            Method: STAT_MOD_METHOD.ADD,
            Stackable: true,
            Stat: {
                Attack: 1,
                HP: 1
            }
        });
        session.AddToHand(this.Socket, rand);
        super.Do();
    }
}