// 物品系统
class Item {
    constructor(type, x, y, data = {}) {
        this.type = type; // 'food' | 'weapon'
        this.x = x;
        this.y = y;
        this.data = data;
        this.collected = false;
    }
}

class ItemManager {
    constructor() {
        this.items = [];
        this.traps = [];  // 陷阱列表
    }
    
    // 生成所有物品
    generate(grid) {
        this.items = [];
        this.traps = [];
        
        // 生成食物
        for (let i = 0; i < CONFIG.FOOD_COUNT; i++) {
            const pos = grid.getRandomEmptyCell();
            if (pos) {
                this.items.push(new Item('food', pos.x, pos.y, {
                    heal: CONFIG.FOOD_HEAL,
                    name: '食物',
                }));
            }
        }
        
        // 生成武器
        for (let i = 0; i < CONFIG.WEAPON_COUNT; i++) {
            const pos = grid.getRandomEmptyCell();
            if (pos) {
                const weaponType = CONFIG.WEAPONS[Math.floor(Math.random() * CONFIG.WEAPONS.length)];
                this.items.push(new Item('weapon', pos.x, pos.y, {
                    ...weaponType,
                }));
            }
        }
        
        // 生成防具
        for (let i = 0; i < CONFIG.ARMOR_COUNT; i++) {
            const pos = grid.getRandomEmptyCell();
            if (pos) {
                const armorType = CONFIG.ARMORS[Math.floor(Math.random() * CONFIG.ARMORS.length)];
                this.items.push(new Item('armor', pos.x, pos.y, {
                    ...armorType,
                }));
            }
        }
        
        // 生成鞋子
        for (let i = 0; i < CONFIG.BOOT_COUNT; i++) {
            const pos = grid.getRandomEmptyCell();
            if (pos) {
                const bootType = CONFIG.BOOTS[Math.floor(Math.random() * CONFIG.BOOTS.length)];
                this.items.push(new Item('boots', pos.x, pos.y, {
                    ...bootType,
                }));
            }
        }
        
        // 生成伤害陷阱
        for (let i = 0; i < CONFIG.TRAP_COUNT; i++) {
            const pos = grid.getRandomEmptyCell();
            if (pos) {
                this.traps.push({
                    x: pos.x,
                    y: pos.y,
                    type: 'damage',       // 伤害型
                    triggered: false,
                    damage: CONFIG.TRAP_DAMAGE,
                });
            }
        }
        
        // 生成减速陷阱
        for (let i = 0; i < CONFIG.SLOW_TRAP_COUNT; i++) {
            const pos = grid.getRandomEmptyCell();
            if (pos) {
                this.traps.push({
                    x: pos.x,
                    y: pos.y,
                    type: 'slow',         // 减速型
                    triggered: false,
                    slowTurns: CONFIG.SLOW_TRAP_TURNS,
                });
            }
        }
    }
    
    // 获取指定位置的陷阱
    getTrapAt(x, y) {
        return this.traps.find(t => !t.triggered && t.x === x && t.y === y);
    }
    
    // 检查并触发陷阱（一次性）
    checkTraps(entity) {
        const trap = this.getTrapAt(entity.x, entity.y);
        if (trap) {
            trap.triggered = true;  // 一次性，触发后消失
            return trap;
        }
        return null;
    }
    
    // 获取指定位置的物品
    getItemAt(x, y) {
        return this.items.find(item => !item.collected && item.x === x && item.y === y);
    }
    
    // 移除物品
    removeItem(item) {
        item.collected = true;
    }
    
    // 获取存活物品列表
    getActiveItems() {
        return this.items.filter(item => !item.collected);
    }
    
    // 补充物品（定期调用保持游戏活力）
    respawn(grid, entities) {
        const activeFoods = this.items.filter(i => !i.collected && i.type === 'food').length;
        const activeWeapons = this.items.filter(i => !i.collected && i.type === 'weapon').length;
        
        // 食物少于3个时补充
        if (activeFoods < 3) {
            for (let i = 0; i < 5; i++) {
                const pos = grid.getRandomEmptyCell(entities);
                if (pos) {
                    this.items.push(new Item('food', pos.x, pos.y, {
                        heal: CONFIG.FOOD_HEAL,
                        name: '食物',
                    }));
                }
            }
        }
        
        // 武器少于2个时补充
        if (activeWeapons < 2) {
            for (let i = 0; i < 3; i++) {
                const pos = grid.getRandomEmptyCell(entities);
                if (pos) {
                    const weaponType = CONFIG.WEAPONS[Math.floor(Math.random() * CONFIG.WEAPONS.length)];
                    this.items.push(new Item('weapon', pos.x, pos.y, {
                        ...weaponType,
                    }));
                }
            }
        }
    }
}