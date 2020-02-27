import { Server, Namespace } from "socket.io";
import { Card } from "../data/card";
import Axios from "axios";
import { ExtendedSocket } from "../customSocket";
import * as Events from "../events";
import * as Config from "../../config.js";
import CardPool from "./cardpool";
import Shop from "./shop";
import { Entity } from "../data/entity";
import { STAT_MOD_ID } from "../data/enums";
import { Hero } from "../data/hero";
import { EventHandler, ITurnHandler, IUpgradeHandler, IShopHandler, IHandHandler, IFieldHandler, IDamageHandler } from "../eventHandler";
import { DataManager } from "../data/dataManager";
import { BattleManager } from "./battleManager";
import { GameManager } from "./gameManager";
import { SessionManager } from "./sessionManager";

interface SessionConf {
    MAX_MEMBERS_CNT: number;
    POOLCNT_BY_TIER: number[];
    SHOW_AMOUNT_BY_LV: number[];
    UPGRADE_COST_BY_LV: number[];
    FIELD_LIMIT: number;
    HAND_LIMIT: number;
}

class Field {
    private session: Session;
    private entities: Entity[];
    private limit: number;

    constructor(cli: ExtendedSocket, limit: number) {
        this.session = cli.session;
        this.entities = [];
        this.limit = limit;
    }

    public get length() : number {
        return this.entities.length;
    }

    public get Entities() : Entity[] {
        return this.entities;
    }
    
    public get HasSpace() : boolean {
        return this.length < this.limit
    }

    public Contains(entity: Entity) {
        return this.entities.includes(entity);
    }

    public Add(entity: Entity, by: Entity) {
        if (!this.HasSpace) return;
        this.entities.push(entity);
        this.session.fieldEvent.Process(h => h.onSpawn(entity, by));
    }

    public Insert(at: number, entity: Entity, by: Entity) {
        if (!this.HasSpace) return;
        this.entities.splice(at, 0, entity);
        this.session.fieldEvent.Process(h => h.onSpawn(entity, by));
    }

    public Move(from: number, to: number) {
        const entity = this.entities.splice(from, 1)[0];
        this.entities.splice(to, 0, entity);
    }

    public Remove(entity: Entity, by: Entity) : Entity {
        return this.RemoveAt(this.entities.findIndex(e => entity.ID === e.ID), by);
    }

    public RemoveAt(idx: number, by: Entity) : Entity {
        if (idx < 0 || idx >= this.entities.length) {
            console.error(`WRONG IDX idx : ${idx} len : ${this.entities.length}`);
            return;
        }
        const removed = this.entities.splice(idx, 1)[0];
        this.session.fieldEvent.Process(h => h.onDestroy(removed, by));
        return removed;
    }
}

class Hand {
    private session: Session;
    private entities: Entity[];
    private limit: number;

    constructor(cli: ExtendedSocket, limit: number) {
        this.session = cli.session;
        this.entities = [];
        this.limit = limit;
    }

    public get length() : number {
        return this.entities.length;
    }

    public get Entities() : Entity[] {
        return this.entities;
    }

    public get HasSpace() : boolean {
        return this.length < this.limit
    }
    
    public Contains(entity: Entity) {
        return this.entities.includes(entity);
    }

    public Add(entity: Entity) {
        if (!this.HasSpace) return;
        this.entities.push(entity);
        this.session.handEvent.Process(h => h.onAddToHand(entity));
    }

    public Remove(entity: Entity) : Entity {
        return this.RemoveAt(this.entities.findIndex(e => entity.ID === e.ID));
    }

    public RemoveAt(idx: number) : Entity {
        if (idx < 0 || idx >= this.entities.length) {
            console.error(`WRONG IDX idx : ${idx} len : ${this.entities.length}`);
            return;
        }
        const removed = this.entities.splice(idx, 1)[0];
        this.session.handEvent.Process(h => h.onLeaveFromHand(removed));
        return removed;
    }
}

interface UserOwn {
    hero: Hero;
    shop: Shop;
    hand: Hand;
    field: Field;
    grave: Entity[];
}

export class Session {
    private id: string;
    private conf: SessionConf;
    private io: Server;
    private room: Namespace;
    private pool: CardPool;
    private readyCount: number = 0;
    private curTurn: 'SHOP'|'BATTLE' = 'SHOP';

    private battle: BattleManager;
    private members: ExtendedSocket[] = [];
    private cards: Card[] = [];
    private heroData: Card[] = [];
    private powerData: Card[] = [];
    private goldCards: { [name: string]: Card } = {};
    private userOwned: { [id: string]: UserOwn } = {};

    public turnEvent: EventHandler<ITurnHandler> = new EventHandler<ITurnHandler>();
    public upgradeEvent: EventHandler<IUpgradeHandler> = new EventHandler<IUpgradeHandler>();
    public shopEvent: EventHandler<IShopHandler> = new EventHandler<IShopHandler>();
    public handEvent: EventHandler<IHandHandler> = new EventHandler<IHandHandler>();
    public fieldEvent: EventHandler<IFieldHandler> = new EventHandler<IFieldHandler>();
    public damageEvent: EventHandler<IDamageHandler> = new EventHandler<IDamageHandler>();

    public get ID() : string {
        return this.id;
    }

    private getOwned(cli: ExtendedSocket) : UserOwn {
        return this.userOwned[cli.id];
    }
    public Hero(cli: ExtendedSocket) : Hero {
        return this.getOwned(cli)?.hero;
    }
    public Shop(cli: ExtendedSocket) : Shop {
        return this.getOwned(cli)?.shop;
    }
    public Hand(cli: ExtendedSocket) : Hand {
        return this.getOwned(cli)?.hand;
    }
    public Field(cli: ExtendedSocket) : Field {
        return this.getOwned(cli)?.field;
    }
    public Grave(cli: ExtendedSocket) : Entity[] {
        return this.getOwned(cli)?.grave;
    }

    public GetPowerByID(id: number) : Card {
        return this.powerData.find(card => card.id === id);
    }

    public GetGoldCardByName(name: string) : Card {
        return this.goldCards[name];
    }

    public GetCards(predicate: (card: Card) => boolean) : Card[] {
        return this.cards.filter(predicate);
    }

    public get Members() : ExtendedSocket[] {
        return this.members;
    }

    public get Room() : Namespace {
        return this.room;
    }

    public get IsShopPhase() : boolean {
        return this.curTurn === 'SHOP';
    }

    public GetOpponent(cli: ExtendedSocket) : ExtendedSocket {
        const pairs = this.battle.Pairs;
        // first에 cli가 있으면 second가 상대
        let temp = pairs.find(p => p.first.id === cli.id);
        if (temp) return temp.second;
        // second에 cli가 있으면 first가 상대
        temp = pairs.find(p => p.second.id === cli.id);
        if (temp) return temp.first;
        // cli가 있는 페어가 없으면 상대가 없는 것
        console.error(`Can't found opponent of ${cli.username}!\npairs : ${pairs.map(p => {
            return {
                first: `${p.first.username}-${p.first.id}`,
                second: `${p.second.username}-${p.second.id}`
            };
        })}`);
        return null;
    }

    constructor(id: string, members: ExtendedSocket[], io: Server) {
        this.id = id;
        this.io = io;
        this.room = io.to(id);
        this.battle = new BattleManager(this);

        Axios.get("/setting", {
                params: {
                    key: 'SESSION_CONF'
                }
            })
            .then(res => {
                this.conf = res.data;
                this.conf.MAX_MEMBERS_CNT = Math.max(this.conf.MAX_MEMBERS_CNT, Config.matching.max);
                return Axios.get("/card/all");
            })
            .then(res => {
                this.cards = res.data;
                this.InitPool();
                return Axios.get("/card/all/?type=hero");
            })
            .then(res => {
                this.heroData = res.data;
                // console.log(this.heroData);
                return Axios.get("/card/all/?type=ability");
            })
            .then(res => {
                this.powerData = res.data;
                this.InitEvents();
                return members;
            })
            .then(res => {
                res.forEach(cli => {
                    cli.session = this;

                    cli.once('ready', data => {
                        this.OnReady(cli, data);
                    });
                    cli.emit(Events.MATCHED, {});
                    cli.join(this.id, err => {
                        if (null != err) {
                            console.error(err);
                            return;
                        }
                        this.userOwned[cli.id] = {
                            hero: null,
                            shop: new Shop(this, cli, this.pool, this.conf.SHOW_AMOUNT_BY_LV),
                            hand: new Hand(cli, this.conf.HAND_LIMIT),
                            field: new Field(cli, this.conf.FIELD_LIMIT),
                            grave: [],
                        };

                        this.Join(cli);
                    })
                });
            });
    }

    private InitEvents() {
        console.log('Init Events');
        const gm = new GameManager();
        //ITurnHandler, IFieldHandler, IHandHandler, IShopHandler
        this.turnEvent.On(gm);
        this.fieldEvent.On(gm);
        this.handEvent.On(gm);
        this.shopEvent.On(gm);
        this.damageEvent.On(gm);
    }

    private OnReady(cli: ExtendedSocket, data: any) {
        const max = this.conf.MAX_MEMBERS_CNT;
        this.readyCount++;
        console.log('ready!', this.readyCount, max, data);
        
        const heroSlotIDX = data.HERO;
        const heroCard = this.heroData[heroSlotIDX];
        const hero = new Hero(heroCard);
        this.getOwned(cli).hero = hero;
        hero.Socket = cli;
        hero.UpgradeCost = this.conf.UPGRADE_COST_BY_LV[hero.UpgradeLevel];

        const ability = JSON.parse(heroCard.effect)?.ABILITY;
        if (ability) {
            const powerCard = this.GetPowerByID(ability);
            // console.log(ability, powerCard);
            const power = DataManager.MakePower(powerCard);
            hero.Power = power;
        }

        this.room.emit('readied', {
            Name: cli.username,
            Rate: `${this.readyCount} / ${max}`
        });

        if (this.readyCount == max) this.GameBegin();
    }

    private InitPool() {
        const cards = this.cards.filter(card => !card.is_gold);
        this.pool = new CardPool(cards);
        this.cards.forEach(card => {
            if (card.is_gold) {
                this.goldCards[card.name] = card;
                return;
            }
            if (card.tier >= this.conf.POOLCNT_BY_TIER.length) return;

            const cnt = this.conf.POOLCNT_BY_TIER[card.tier];
            for (let i = 0; i < cnt; i++) {
                this.pool.Push(card);
            }
        });
    }

    private Join(cli: ExtendedSocket) {
        cli.sessionID = this.id;
        this.members.push(cli);
        const cnt = this.members.length;
        const maxCnt = this.conf.MAX_MEMBERS_CNT;
        console.log(`Matched with ${cnt} peoples`);

        const shop = this.Shop(cli);

        cli.on('freeze', data => {
            const hero = this.Hero(cli);
            const cost = hero.FreezePrice;
            if (hero.Gold < cost) {
                cli.emit('freeze', {
                    success: false
                });
                return;
            }

            hero.AddGold(-cost);
            shop.ToggleFreeze();

            this.NotifyGold(cli);
            this.NotifyShop(cli, 'freeze');
        });

        cli.on('reroll', data => {
            const hero = this.Hero(cli);
            const cost = hero.RefreshPrice;
            if (hero.Gold < cost) {
                cli.emit('reroll', {
                    success: false
                });
                return;
            }

            hero.AddGold(-cost);
            shop.Refresh();

            this.NotifyGold(cli);
            this.NotifyShop(cli);
            this.NotifyHands(cli);
            this.NotifyFields(cli);
        });

        cli.on('buy', data => {
            const hero = this.Hero(cli);
            const cost = hero.BuyPrice;
            if (hero.Gold < cost) {
                cli.emit('buy', {
                    success: false
                });
                return;
            }

            if (!this.Hand(cli).HasSpace) {
                console.error('[BUY] Hand is full!');
                return;
            }

            const idx = data.idx;
            const entity = shop.BuyAt(idx);
            if (entity) {
                // 선술집에서 빙결 걸었던 거 해제
                entity.RemoveMod(STAT_MOD_ID.SHOP_FREEZE);
                hero.AddGold(-cost);
                this.AddToHand(cli, entity);
            } else {
                console.error('[BUY] Entity is null!', idx, shop.Entities);
            }
            this.NotifyGold(cli);
            this.NotifyShop(cli);
            this.NotifyHands(cli);
        });

        cli.on('summon', data => {
            const fields = this.Field(cli);
            if (!fields.HasSpace) {
                console.error('[SUMMON] Fields is full!');
                return;
            }
            const handIDX = data.handidx;
            const fieldIDX = data.fieldidx;

            const hands = this.Hand(cli);
            if (hands.length <= handIDX) {
                console.error('[SUMMON] Entity is null!', handIDX, hands);
                return;
            }
            const entity = hands.RemoveAt(handIDX);
            console.log('PLAYED', entity.CardName, entity.Socket?.id);

            if (fields.length < fieldIDX) {
                console.error('[SUMMON] Field idx is wrong!', fieldIDX, fields);
                return;
            }
            fields.Insert(fieldIDX, entity, this.Hero(cli));

            this.NotifyShop(cli);
            this.NotifyHands(cli);
            this.NotifyFields(cli);
        });

        cli.on('replace', data => {
            const from = data.from;
            const to = data.to;

            const fields = this.Field(cli);
            if (fields.length <= from || fields.length <= to) {
                console.error('[REPLACE] Field idx is wrong!', from, to, fields);
                return;
            }
            fields.Move(from, to);
            
            this.NotifyShop(cli);
            this.NotifyHands(cli);
            this.NotifyFields(cli);
        });

        cli.on('sell', data => {
            const hero = this.Hero(cli);
            const price = hero.SellPrice;

            const idx = data.idx;

            const fields = this.Field(cli);
            if (fields.length <= idx) {
                console.error('[SELL] Field idx is wrong!', idx, fields);
                return;
            }

            const entity = fields.RemoveAt(idx, hero);
            this.pool.Push(entity);
            hero.AddGold(price);
            shop.Sell(entity);
            
            this.NotifyGold(cli);
            this.NotifyShop(cli);
            this.NotifyHands(cli);
            this.NotifyFields(cli);
        });

        cli.on('upgrade', data => {
            const hero = this.Hero(cli);
            const cost = hero.UpgradeCost;
            if (cost < 0) {
                console.log("Can't upgrade more!");
                return;
            }
            if (hero.Gold < cost) {
                console.log('not enough gold');
                cli.emit('upgrade', {
                    success: false
                });
                return;
            }
            const self = this;
            this.upgradeEvent.Once({
                onUpgrade(hero) {
                    hero.AddGold(-cost);
                    hero.UpgradeCost = self.GetUpgradeCost(hero);
                    shop.Level = hero.UpgradeLevel;
    
                    hero.RecalcStat();
                    self.NotifyGold(cli);
                    self.NotifyUpgrade(cli);
                }
            });
            hero.Upgrade();
        });

        cli.on('power', data => {
            const hero = this.Hero(cli);
            const power = hero.Power;
            if (power == null || power.IsUsed) return;

            const cost = power.Cost;
            if (hero.Gold < cost) {
                console.log('not enough gold');
                cli.emit('power', {
                    success: false
                });
                return;
            }
            power.Do();
            hero.AddGold(-cost);
            this.NotifyGold(cli);
        });

        cli.on('skipbattle', data => {
            if (this.curTurn !== 'BATTLE') return;
            this.readyCount++;
        });

        cli.on('skipshop', data => {
            if (this.curTurn !== 'SHOP') return;
            this.readyCount++;
        });

        this.room.emit(Events.JOINED, {
            Name: cli.username,
            Rate: `${cnt} / ${maxCnt}`
        });
    }

    public Leave(cli: ExtendedSocket) {
        if (cli.session.ID !== this.ID) return;
        cli.leave(this.ID);

        cli.removeAllListeners('freeze');
        cli.removeAllListeners('reroll');
        cli.removeAllListeners('buy');
        cli.removeAllListeners('summon');
        cli.removeAllListeners('replace');
        cli.removeAllListeners('sell');
        cli.removeAllListeners('upgrade');
        cli.removeAllListeners('power');
        cli.removeAllListeners('skipbattle');
        cli.removeAllListeners('skipshop');

        cli.session = null;
        cli.sessionID = null;
        const idx = this.members.findIndex(m => m.id === cli.id);
        if (idx < 0) return;
        this.members.splice(idx, 1);
        delete this.userOwned[cli.id];

        if (this.members.length === 0) {
            SessionManager.Instance.CloseSession(this);
        }
    }

    private GetUpgradeCost(hero: Hero) : number {
        const level = hero.UpgradeLevel;
        const cost = this.conf.UPGRADE_COST_BY_LV[level];
        return cost;
    }

    private GameBegin() {
        this.room.emit(Events.BEGIN, {});
        // this.ShopPhase();
        this.GameTurn();
    }

    private Delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private WaitUntilAllReady(freq: number, maxWaitTime: number) {
        if (maxWaitTime <= 0 || this.readyCount === this.members.length) return true;
        // console.log(this.curTurn, this.readyCount, this.members.length);
        return this.Delay(freq).then(() => this.WaitUntilAllReady(freq, maxWaitTime-freq));
    }

    private GameTurn() {
        if (this.members.length <= 0) return;

        Promise.resolve(this.turnEvent.Process(h => h.onTurnBegin(this)))
            .then(res => this.ShopPhase())
            .then(res => this.WaitUntilAllReady(100, 60000))
            .then(res => this.turnEvent.Process(h => h.onTurnEnd(this)))
            .then(res => this.BattlePhase())
            .then(res => this.WaitUntilAllReady(100, 60000))
            .then(res => this.GameTurn());
    }

    private ShopPhase() {
        this.readyCount = 0;
        this.curTurn = 'SHOP';
        this.battle.CalcPairs(this.members);

        this.members.forEach(cli => {
            const shop = this.Shop(cli);
            shop.Level = this.Hero(cli).UpgradeLevel;
            shop.Open();

            this.NotifyGold(cli);
            this.NotifyUpgrade(cli);
            this.NotifyShop(cli);
            this.NotifyHands(cli);
            this.NotifyFields(cli);
            this.NotifyHero(cli);
        });
    }

    private BattlePhase() {
        this.curTurn = 'BATTLE';
        this.readyCount = 0;
        if (this.members.length === 0) return;
        this.room.emit('battle', {
            phase: 'begin'
        });

        const pairs = this.battle.Pairs;
        const promises = pairs.map(pair => {
            const win = this.battle.Process(pair.first, pair.second);
            
            const firstField = this.Field(pair.first);
            const secondField = this.Field(pair.second);
            const fieldCount = (firstField?.length || 0) + (secondField?.length || 0);
            const delay = fieldCount * 500;
            Promise.resolve(this.Delay(delay))
                .then(() => {
                    const data = {
                        phase: 'end',
                        id: win?.id,
                        name: win?.username,
                    };
    
                    if (pair.first.sessionID === this.ID) {
                        pair.first.emit('battle', data);
                        this.NotifyHero(pair.first);
                    }
                    if (pair.second.sessionID === this.ID) {
                        pair.second.emit('battle', data);
                        this.NotifyHero(pair.second);
                    }
                });
        });
        Promise.all(promises).then(() => {
            this.CheckDead();

            if (this.members.length === 1) {
                const winner = this.members[0];
                this.Hero(winner).SetAlive(false);
                this.CheckDead();
            }
        });
    }

    private CheckDead() {
        const m = [...this.members];
        m.forEach(cli => {
            const hero = this.Hero(cli);
            if (!hero.IsAlive) {
                console.log('GAME OVER', cli.username);
                this.NotifyHero(cli);
                cli.session.Room.emit('gameover', {
                    id: cli.id,
                    name: cli.username,
                    rank: this.members.length,
                });
                cli.session.Leave(cli);
            }
        });
    }

    public AddToHand(cli: ExtendedSocket, entity: Entity) {
        entity.Socket = cli;
        this.Hand(cli).Add(entity);

        this.NotifyCards(cli);
    }

    public NotifyCards(cli: ExtendedSocket) {
        this.NotifyShop(cli);
        this.NotifyHands(cli);
        this.NotifyFields(cli);
    }

    private NotifyShop(cli: ExtendedSocket, ev: string = 'openshop') {
        const shop = this.Shop(cli);
        const cards = shop.Entities.map(entity => entity.MakeCard());
        cli.emit(ev, {
            cards: cards,
        });
    }

    private NotifyHands(cli: ExtendedSocket) {
        const hands = this.Hand(cli).Entities.map(entity => entity.MakeCard());
        cli.emit('hands', {
            hands: hands,
        });
    }

    private NotifyFields(cli: ExtendedSocket) {
        const fields = this.Field(cli).Entities.map(entity => entity.MakeCard()); 
        cli.emit('fields', {
            fields: fields
        });
    }

    private NotifyUpgrade(cli: ExtendedSocket) {
        const hero = this.Hero(cli);
        cli.emit('upgrade', {
            level: hero.UpgradeLevel,
            cost: hero.UpgradeCost
        });
    }

    private NotifyGold(cli: ExtendedSocket) {
        const hero = this.Hero(cli);
        cli.emit('gold', {
            max: hero.MaxGold,
            cur: hero.Gold,
            prices: {
                buy: hero.BuyPrice,
                sell: hero.SellPrice,
                refresh: hero.RefreshPrice,
                freeze: hero.FreezePrice,
            },
        });
    }

    public NotifyHero(cli: ExtendedSocket) {
        const hero = this.Hero(cli);
        const power = hero.Power;
        cli.emit('hero', {
            hero: {
                name: hero.CardName,
                hp: hero.CalcStat.HP,
            },
            power: power.MakeCard(),
        });
    }
}