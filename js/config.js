// 游戏配置常量
const CONFIG = {
    // 地图
    GRID_COLS: 40,
    GRID_ROWS: 30,
    CELL_SIZE: 20,
    
    // 墙壁
    WALL_DENSITY: 0.12,
    
    // 物品
    FOOD_COUNT: 15,
    WEAPON_COUNT: 8,
    TRAP_COUNT: 6,
    TRAP_DAMAGE: 15,
    SLOW_TRAP_COUNT: 6,
    SLOW_TRAP_TURNS: 3,    // 减速持续回合数
    
    // 角色
    AI_COUNT: 8,
    INITIAL_HP: 100,
    BASE_ATTACK: 10,
    VISION_RANGE: 12,
    ATTACK_RANGE: 2,      // 攻击范围（曼哈顿距离）
    HUNGER_RATE: 1,        // 每回合饱食度消耗
    STARVATION_DAMAGE: 3,  // 饥饿伤害
    
    // 武器类型
    WEAPONS: [
        { name: '木棍', power: 5, color: '#8B4513', symbol: '🏏' },
        { name: '铁剑', power: 12, color: '#C0C0C0', symbol: '⚔️' },
        { name: '神剑', power: 25, color: '#FFD700', symbol: '🗡️' },
    ],
    
    // 防具类型
    ARMORS: [
        { name: '布甲', defense: 3, color: '#8B7355', symbol: '🛡️' },
        { name: '铁甲', defense: 8, color: '#778899', symbol: '🛡️' },
        { name: '金甲', defense: 15, color: '#DAA520', symbol: '🛡️' },
    ],
    
    // 鞋子类型
    BOOTS: [
        { name: '草鞋', speed: 1, dodge: 0.05, color: '#9ACD32', symbol: '👟' },
        { name: '皮靴', speed: 1, dodge: 0.12, color: '#CD853F', symbol: '👢' },
        { name: '风靴', speed: 2, dodge: 0.20, color: '#00CED1', symbol: '👟' },
    ],
    
    // 物品生成数量
    ARMOR_COUNT: 6,
    BOOT_COUNT: 5,
    
    // 食物
    FOOD_HEAL: 25,
    
    // AI 性格
    PERSONALITIES: [
        { name: '勇猛', aggressionWeight: 0.7, fleeThreshold: 0.2 },
        { name: '谨慎', aggressionWeight: 0.3, fleeThreshold: 0.5 },
        { name: '平衡', aggressionWeight: 0.5, fleeThreshold: 0.35 },
        { name: '贪婪', aggressionWeight: 0.4, fleeThreshold: 0.3, greedWeight: 0.8 },
    ],
    
    // 角色名字和颜色
    AI_PROFILES: [
        { name: '赤狼', color: '#FF4444' },
        { name: '蓝鹰', color: '#4488FF' },
        { name: '绿蟒', color: '#44BB44' },
        { name: '紫蝎', color: '#AA44FF' },
        { name: '金虎', color: '#FFAA00' },
        { name: '青蛇', color: '#00BBBB' },
        { name: '橙狮', color: '#FF8800' },
        { name: '粉狐', color: '#FF66AA' },
    ],
    
    // 压注系统
    BETTING_TIME: 30,       // 压注倒计时（秒）
    
    // 游戏速度（毫秒/回合）
    TICK_SPEEDS: [500, 300, 150, 80, 40],
    DEFAULT_SPEED_INDEX: 1,
    
    // 颜色
    COLORS: {
        BG: '#1a1a2e',
        GRID_LINE: '#16213e',
        WALL: '#0f3460',
        WALL_TOP: '#1a4a7a',
        FLOOR: '#1a1a2e',
        FOOD: '#e94560',
        FOOD_GLOW: 'rgba(233, 69, 96, 0.3)',
        HP_BAR_BG: '#333',
        HP_BAR: '#44ff44',
        HP_BAR_LOW: '#ff4444',
        TEXT: '#e0e0e0',
        TEXT_DIM: '#888',
        PANEL_BG: '#0a0a1a',
        LOG_BG: '#111122',
    },
};