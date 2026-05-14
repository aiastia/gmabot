// 角色实体系统

// AI 状态枚举
const AI_STATE = {
    WANDER: 'WANDER',       // 游荡
    SEEK_ITEM: 'SEEK_ITEM', // 拾取物品
    HUNT: 'HUNT',           // 追杀敌人
    FLEE: 'FLEE',           // 逃跑
    ATTACK: 'ATTACK',       // 攻击
};

class Entity {
    constructor(id, profile, personality) {
        this.id = id;
        this.name = profile.name;
        this.color = profile.color;
        this.personality = personality;
        
        // 位置
        this.x = 0;
        this.y = 0;
        
        // 属性
        this.hp = CONFIG.INITIAL_HP;
        this.maxHp = CONFIG.INITIAL_HP;
        this.baseAttack = CONFIG.BASE_ATTACK;
        this.weapon = null;       // 当前武器 {name, power, color}
        this.armor = null;        // 当前防具 {name, defense, color}
        this.boots = null;        // 当前鞋子 {name, speed, dodge, color}
        this.hunger = 80;         // 饱食度 (0-100)
        
        // 状态
        this.alive = true;
        this.state = AI_STATE.WANDER;
        this.targetEntity = null; // 追杀/逃跑目标
        this.targetItem = null;   // 拾取目标
        this.kills = 0;
        this.lastAction = '';     // 上回合行为描述
        
        // 状态效果
        this.slowed = 0;        // 减速剩余回合
        
        // 动画
        this.animOffset = { x: 0, y: 0 };
        this.damageFlash = 0;
        this.healFlash = 0;
    }
    
    // 获取总攻击力
    getAttackPower() {
        let power = this.baseAttack;
        if (this.weapon) {
            power += this.weapon.power;
        }
        // 饥饿时攻击力降低
        if (this.hunger <= 0) {
            power = Math.floor(power * 0.6);
        }
        return power;
    }
    
    // 获取防御力
    getDefense() {
        return this.armor ? this.armor.defense : 0;
    }
    
    // 获取闪避率
    getDodgeChance() {
        return this.boots ? this.boots.dodge : 0;
    }
    
    // 获取速度（额外移动步数）
    getSpeed() {
        return this.boots ? this.boots.speed : 0;
    }
    
    // 获取战斗力评分（AI决策用）
    getCombatScore() {
        let score = this.hp + this.getAttackPower() * 2;
        score += this.getDefense() * 2;
        score += this.getDodgeChance() * 50;
        return score;
    }
    
    // 受到伤害（考虑防御和闪避）
    takeDamage(amount) {
        // 闪避判定
        if (Math.random() < this.getDodgeChance()) {
            this.damageFlash = 4;
            return { dodged: true, actualDamage: 0 };
        }
        
        // 防御减伤
        const defense = this.getDefense();
        const reducedDamage = Math.max(1, amount - defense);
        this.hp -= reducedDamage;
        this.damageFlash = 8;
        if (this.hp <= 0) {
            this.hp = 0;
            this.alive = false;
        }
        return { dodged: false, actualDamage: reducedDamage };
    }
    
    // 治疗
    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
        this.healFlash = 8;
    }
    
    // 装备武器
    equipWeapon(weapon) {
        if (!this.weapon || weapon.power > this.weapon.power) {
            this.weapon = { ...weapon };
            return true;
        }
        return false;
    }
    
    // 装备防具
    equipArmor(armor) {
        if (!this.armor || armor.defense > this.armor.defense) {
            this.armor = { ...armor };
            return true;
        }
        return false;
    }
    
    // 装备鞋子
    equipBoots(boots) {
        if (!this.boots || (boots.dodge + boots.speed) > (this.boots.dodge + this.boots.speed)) {
            this.boots = { ...boots };
            return true;
        }
        return false;
    }
    
    // 掠夺被击杀敌人的装备
    lootFrom(victim) {
        const lootMsg = [];
        if (victim.weapon && (!this.weapon || victim.weapon.power > this.weapon.power)) {
            this.weapon = { ...victim.weapon };
            lootMsg.push(`⚔️${victim.weapon.name}`);
        }
        if (victim.armor && (!this.armor || victim.armor.defense > this.armor.defense)) {
            this.armor = { ...victim.armor };
            lootMsg.push(`🛡️${victim.armor.name}`);
        }
        if (victim.boots && (!this.boots || (victim.boots.dodge + victim.boots.speed) > (this.boots.dodge + this.boots.speed))) {
            this.boots = { ...victim.boots };
            lootMsg.push(`👢${victim.boots.name}`);
        }
        return lootMsg;
    }
    
    // 是否处于减速状态
    isSlowed() {
        return this.slowed > 0;
    }
    
    // 每回合更新
    tick() {
        if (!this.alive) return;
        
        // 减速回合递减
        if (this.slowed > 0) this.slowed--;
        
        // 饱食度消耗
        this.hunger -= CONFIG.HUNGER_RATE;
        if (this.hunger <= 0) {
            this.hunger = 0;
            this.takeDamage(CONFIG.STARVATION_DAMAGE);
            if (this.alive) {
                this.lastAction = '饥饿中，受到伤害';
            }
        }
        
        // 更新动画
        if (this.damageFlash > 0) this.damageFlash--;
        if (this.healFlash > 0) this.healFlash--;
    }
    
    // 获取视野内的实体
    getVisibleEntities(entities) {
        return entities.filter(e => 
            e.alive && 
            e.id !== this.id && 
            Grid.distance(this.x, this.y, e.x, e.y) <= CONFIG.VISION_RANGE
        );
    }
    
    // 获取视野内的物品
    getVisibleItems(itemManager) {
        return itemManager.getActiveItems().filter(item =>
            Grid.distance(this.x, this.y, item.x, item.y) <= CONFIG.VISION_RANGE
        );
    }
    
    // 重置（新游戏）
    reset(x, y) {
        this.x = x;
        this.y = y;
        this.hp = this.maxHp;
        this.weapon = null;
        this.armor = null;
        this.boots = null;
        this.hunger = 80;
        this.alive = true;
        this.state = AI_STATE.WANDER;
        this.targetEntity = null;
        this.targetItem = null;
        this.kills = 0;
        this.lastAction = '';
        this.damageFlash = 0;
        this.healFlash = 0;
    }
}