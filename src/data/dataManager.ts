import { Card } from "./card";
import { HeroPower } from "./heroPower";
import { CompareType } from "./enums";
import { HP_Yogg } from "./HeroPowers/yoggsaron";
import { Session } from "../ingame/session";
import { Entity } from "./entity";
import { SoulJuggler } from "./CardActions/soulJuggler";
import { CaveHydra } from "./CardActions/caveHydra";
import { Voidlord } from "./CardActions/voidlord";
import { CloningDevice } from "./CardActions/cloningDevice";

class _DataManager {
    public MakePower(card: Card) : HeroPower {
        if (!CompareType(card.type, 'ABILITY')) return;
        
        switch (card.id) {
            case 4: return new HP_Yogg(card);
            default: return new HeroPower(card);
        }
    }

    public UseCardAction(session: Session, entity: Entity) {
        switch (entity.CardID) {
            case 7: case 8: return new SoulJuggler(session, entity);
            case 9: case 10: return new CaveHydra(session, entity);
            case 11: case 12: return new Voidlord(session, entity);
            case 13: case 14: return new CloningDevice(session, entity);
            default: return;
        }
    }
}

export const DataManager = new _DataManager();