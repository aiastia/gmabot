// 游戏主入口和主循环

class Game {
    constructor() {
        // 游戏系统
        this.grid = new Grid();
        this.itemManager = new ItemManager();
        this.aiController = new AIController();
        this.combatSystem = new CombatSystem();
        this.renderer = new Renderer('gameCanvas');
        
        // 实体列表
        this.entities = [];
        
        // 游戏状态
        this.turn = 0;
        this.gameOver = false;
        this.winner = null;
        this.paused = false;
        this.speedIndex = CONFIG.DEFAULT_SPEED_INDEX;
        
        // 定时器
        this.tickTimer = null;
        
        // 初始化
        this._initEntities();
        this._setupControls();
        this._startGame();
    }
    
    // 初始化实体
    _initEntities() {
        this.entities = [];
        for (let i = 0; i < CONFIG.AI_COUNT; i++) {
            const profile = CONFIG.AI_PROFILES[i];
            const personality = CONFIG.PERSONALITIES[Math.floor(Math.random() * CONFIG.PERSONALITIES.length)];
            const entity = new Entity(i, profile, personality);
            this.entities.push(entity);
        }
    }
    
    // 开始游戏
    _startGame() {
        this.turn = 0;
        this.gameOver = false;
        this.winner = null;
        this.combatSystem.logs = [];
        this.combatSystem.floatingTexts = [];
        
        // 生成地图
        this.grid.generate();
        
        // 放置实体
        for (const entity of this.entities) {
            const pos = this.grid.getRandomEmptyCell(this.entities);
            if (pos) {
                entity.reset(pos.x, pos.y);
            }
        }
        
        // 生成物品
        this.itemManager.generate(this.grid);
        
        // 开始初始日志
        this.combatSystem.logs.push({
            turn: 0,
            text: '🎮 新游戏开始！8 位战士进入战场',
            color: '#FFD700',
            important: true,
        });
        
        // 启动游戏循环
        this._startTick();
        
        // 启动渲染循环
        this._renderLoop();
    }
    
    // 启动回合定时器
    _startTick() {
        if (this.tickTimer) clearInterval(this.tickTimer);
        this.tickTimer = setInterval(() => {
            if (!this.paused && !this.gameOver) {
                this._gameTick();
            }
        }, CONFIG.TICK_SPEEDS[this.speedIndex]);
    }
    
    // 游戏回合
    _gameTick() {
        this.turn++;
        
        // 1. AI 决策
        const actions = this.aiController.makeDecisions(
            this.entities, this.grid, this.itemManager
        );
        
        // 2. 执行行动
        const result = this.combatSystem.resolveActions(
            actions, this.grid, this.itemManager
        );
        
        // 2.5 移动后碰撞分离
        this.combatSystem._separateEntities(this.entities);
        
        // 3. 实体回合更新（饥饿等）
        for (const entity of this.entities) {
            entity.tick();
        }
        
        // 4. 更新死亡标记
        this.grid.updateDeadZones();
        
        // 5. 更新浮动文字
        this.combatSystem.updateFloatingTexts();
        
        // 6. 定期补充物品
        if (this.turn % 10 === 0) {
            this.itemManager.respawn(this.grid, this.entities);
        }
        
        // 7. 检查胜负
        this._checkWinCondition();
    }
    
    // 检查胜利条件
    _checkWinCondition() {
        const alive = this.entities.filter(e => e.alive);
        
        if (alive.length <= 1) {
            this.gameOver = true;
            this.winner = alive.length === 1 ? alive[0] : null;
            
            if (this.winner) {
                this.combatSystem.logs.unshift({
                    turn: this.turn,
                    text: `🏆 ${this.winner.name} 赢得了胜利！`,
                    color: this.winner.color,
                    important: true,
                });
            } else {
                this.combatSystem.logs.unshift({
                    turn: this.turn,
                    text: '💀 所有战士同归于尽！',
                    color: '#FF4444',
                    important: true,
                });
            }
        }
    }
    
    // 渲染循环（独立于游戏回合，保持流畅）
    _renderLoop() {
        const gameState = this._getGameState();
        this.renderer.render(gameState);
        requestAnimationFrame(() => this._renderLoop());
    }
    
    // 获取游戏状态（传给渲染器）
    _getGameState() {
        return {
            grid: this.grid,
            itemManager: this.itemManager,
            entities: this.entities,
            combatSystem: this.combatSystem,
            turn: this.turn,
            gameOver: this.gameOver,
            winner: this.winner,
            paused: this.paused,
            speedIndex: this.speedIndex,
        };
    }
    
    // 设置控制
    _setupControls() {
        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    this.paused = !this.paused;
                    break;
                case 'r':
                case 'R':
                    this._startGame();
                    break;
                case '1':
                    this.speedIndex = 0;
                    this._startTick();
                    break;
                case '2':
                    this.speedIndex = 1;
                    this._startTick();
                    break;
                case '3':
                    this.speedIndex = 2;
                    this._startTick();
                    break;
                case '4':
                    this.speedIndex = 3;
                    this._startTick();
                    break;
                case '5':
                    this.speedIndex = 4;
                    this._startTick();
                    break;
            }
        });
    }
}

// 页面加载后启动游戏
window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
});