import CardPool from "./cardpool";
import { Entity, STAT_MOD_METHOD } from "../data/entity";
import { Tag, STAT_MOD_ID } from "../data/enums";
import { Session } from "./session";
import { ExtendedSocket } from "../customSocket";


export default class Shop {
    private session: Session;
    private cli: ExtendedSocket;
    private pool: CardPool;
    private level: number;
    private entities: Entity[] = [];
    private showAmounts: number[] = [];

    constructor(session: Session, cli: ExtendedSocket, cardPool: CardPool, amounts: number[]) {
        this.session = session;
        this.cli = cli;
        this.pool = cardPool;
        this.showAmounts = amounts;
    }

    public set Level(level: number) {
        this.level = level;
    }

    public get Amount() : number {
        const level = this.level;
        const arr = this.showAmounts;
        if (level < 1 || arr.length <= level) return -1;

        return arr[level];
    }

    public ToggleFreeze() {
        const id = STAT_MOD_ID.SHOP_FREEZE;
        const frozen = Tag.FROZEN;
        const mod = {
            By: 'Shop',
            ID: id,
            Method: STAT_MOD_METHOD.ADD,
            Stackable: false,
            Stat: {
                Tags: [Tag[frozen]]
            }
        };

        this.entities.forEach(entity => {
            if (entity.HasTag(frozen)) {
                entity.RemoveMod(id);
            } else {
                entity.AddMod(mod);
            }
        });
    }

    public BuyAt(idx: number) : Entity {
        if (this.entities.length <= idx) return null;
        const entity = this.entities.splice(idx, 1)[0];
        if (entity) {
            entity.Socket = this.cli;
            this.session.shopEvent.Process(h => h.onBuyCard(entity));
        }
        return entity;
    }

    public Sell(entity: Entity) {
        if (entity == null) return;
        this.session.shopEvent.Process(h => h.onSellCard(entity));
        this.pool.Push(entity);
    }

    public get Entities() : Entity[] {
        return this.entities;
    }

    public Open() {
        // 기존 상점은 닫고
        this.Close();
        this.Refill();
    }

    public Refresh() {
        // 리롤은 빙결 영향을 안 받을 줄은...
        this.entities.forEach(entity => this.pool.Push(entity));
        this.entities = [];
        this.Refill();
    }

    private Refill() {
        // 수량 채우기
        const amount = this.Amount;
        while (amount > this.entities.length) {
            const entity = this.pool.PopRandom(card => card.tier <= this.level);
            if (entity == null) {
                break;
            }
            this.entities.push(entity);
        }

        this.entities.forEach(entity => {
            console.log(entity.CardID, '-', entity.ID);
        });
    }

    public Close() {
        // 상점 비우기
        const old: Entity[] = [...this.entities];
        this.entities = [];
        old.forEach(entity => {
            // 빙결 상태면 그대로 유지
            if (entity.HasTag(Tag.FROZEN)) {
                this.entities.push(entity);
                return;
            }
            // 빙결 상태가 아니면 다시 풀에 넣음
            this.pool.Push(entity);
        });
    }
}