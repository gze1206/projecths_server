import { Card } from "../data/card";
import { Entity } from "../data/entity";

interface Predicate {
    (card: Card): boolean;
}

export default class CardPool {
    private cards: { [id: number] : Card } = {};
    private cardIDs: number[] = [];

    constructor(allCards: Card[]) {
        allCards.forEach(
            card => this.cards[card.id] = card
        );
    }

    public Push(target: Card|Entity) {
        if (target instanceof Entity) {
            // 아무튼 생성된 카드는 카드풀에 들어가지 않음 (황금 카드 제외)
            if (target.IsGenerated) return;
        }
        const id =
            target instanceof Entity
            ? target.CardID
            : target.id;
        this.cardIDs.push(id);

        const isGold = target instanceof Entity ? target.IsGold : target.is_gold;
        if (isGold) {
            // 황카 팔면 풀에 3장 들어감
            this.cardIDs.push(id);
            this.cardIDs.push(id);
        }
    }

    private GetRandomIDX(arr: any[]) : number {
        return Math.floor(Math.random() * arr.length);
    }

    public PopRandom(filter: Predicate = null) : Entity {
        const arr = (filter == null) ? this.cardIDs
            : this.cardIDs.map(id => this.cards[id]).filter(card => card && filter(card)).map(card => card.id);

        const idx = this.GetRandomIDX(arr);
        const id = arr[idx];
        this.cardIDs.splice(this.cardIDs.indexOf(id), 1);

        const card = this.cards[id];
        if (card) {
            const entity = new Entity(card);
            return entity;
        }
        return null;
    }
}