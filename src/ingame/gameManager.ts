import { ITurnHandler, IFieldHandler, IHandHandler, IShopHandler, IDamageHandler } from "../eventHandler";
import { Session } from "./session";
import { ExtendedSocket } from "../customSocket";
import { Entity } from "../data/entity";
import { DataManager } from "../data/dataManager";
import { CompareType } from "../data/enums";
import { Hero } from "../data/hero";

export class GameManager implements ITurnHandler, IFieldHandler, IHandHandler, IShopHandler, IDamageHandler {
    private isFirstTurn: boolean = true;

    public onTurnBegin(session: Session) : void {
        session.damageEvent.CleanUp();
        session.fieldEvent.CleanUp();
        session.handEvent.CleanUp();
        session.shopEvent.CleanUp();
        session.turnEvent.CleanUp();
        session.upgradeEvent.CleanUp();

        session.Members.forEach(cli => {
            const hero = session.Hero(cli);
            const power = hero.Power;
            power?.Init();

            if (this.isFirstTurn) {
                hero.RecalcStat();
                return;
            }

            hero.DecreaseUpgradeCost(1);
            if (hero.MaxGold < hero.GoldLimit) {
                hero.AddMaxGold(1);
            }
            hero.RefillGold();

            session.Field(cli).Entities.forEach(e => e.Recover());
        });

        if (this.isFirstTurn) {
            this.isFirstTurn = false;
        }
    }

    public onTurnEnd(session: Session) : void {
        session.Members.forEach(cli => {
            const grave = session.Grave(cli);
            grave.splice(0, grave.length);
        });
    }

    public onSpawn(sender: Entity, by: Entity) : void {
        this.CheckGoldCard(sender.Socket);
    }

    public onMoved() {}
    public onDestroy() {}
    public onSellCard() {}
    public onAttack() {}
    public onGuard() {}
    public onDamaged() {}
    public onKilled() {}

    public onDead(sender: Entity) {
        if (!CompareType(sender.Type, 'HERO')) return;
        const cli = sender.Socket;
        const session = cli.session;
        session?.Hero(cli)?.SetAlive(false);
    }

    public onBuyCard(entity: Entity) : void {
        DataManager.UseCardAction(entity.Socket.session, entity);
        this.CheckGoldCard(entity.Socket);
    }

    public onAddToHand(entity: Entity) : void {
        this.CheckGoldCard(entity.Socket);
    }

    public onLeaveFromHand(entity: Entity) : void {
        if (false === entity.IsGenerated && entity.IsGold) {
            const cli = entity.Socket;
            const session = cli.session;

            const nextTier: number = Math.min(session.Hero(cli).UpgradeLevel + 1, 6);
            const cards = session.GetCards(c => false == c.is_gold && c.tier === nextTier);
            if (cards.length === 0) return;

            const random = cards[Math.floor(Math.random() * cards.length)];
            const bonus: Entity = new Entity(random);
            bonus.Socket = cli;
            bonus.IsGenerated = true;
            DataManager.UseCardAction(session, bonus);
            // console.log('B', bonus.CardName, bonus.Socket?.id);
            session.AddToHand(cli, bonus);
            return;
        }
    }

    private CheckGoldCard(cli: ExtendedSocket) {
        const session = cli.session;
        // 전투 중에는 황금카드가 만들어지지 않음
        if (!session.IsShopPhase) return;

        const fields = session.Field(cli);
        const hands = session.Hand(cli);

        const groups = [...fields.Entities, ...hands.Entities]
            .reduce((total, cur) => {
                if (cur.IsGold) return total;
                if (total[cur.CardID] == null) {
                    total[cur.CardID] = [cur];
                    return total;
                }
                total[cur.CardID].push(cur);
                return total;
            }, {});
        const entitiesArr: Entity[][] = Object.keys(groups)
            .filter(id => groups[id].length >= 3)
            .map(id => groups[id].splice(0, 3));
        // console.log(entitiesArr);
        
        for (let i = 0, max = entitiesArr.length; i < max; i++) {
            const entities = entitiesArr[i];
            const cardName = entities[0].CardName;

            const goldCard = new Entity(session.GetGoldCardByName(cardName));
            
            entities.forEach(entity => {
                // Remove entities from Field and Hand
                if (fields.Contains(entity)) fields.Remove(entity, null);
                else if (hands.Contains(entity)) hands.Remove(entity);
                else throw `[CHECK GOLD CARD] Can't found card from fields and hands! ${entity} ${fields.Entities} ${hands.Entities}`;

                // Merge to gold card
                goldCard.Merge(entity);
            });

            session.Room.emit('made', {
                name: cli.username
            });

            goldCard.Socket = cli;
            DataManager.UseCardAction(session, goldCard);
            session.AddToHand(cli, goldCard);
        }
    }
}