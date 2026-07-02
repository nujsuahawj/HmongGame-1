window.App = {
    battleLoopId: null,

    cleanup() {
        if (this.battleLoopId) {
            cancelAnimationFrame(this.battleLoopId);
            this.battleLoopId = null;
        }
    },

    initLobby() {
        const char = GameState.getCurrentChar();
        const data = GameState.getData();

        document.getElementById('lobbyStage').innerText = `ด่าน: ${char.stage} / 10`;
        document.getElementById('lobbyName').innerText = char.name;
        document.getElementById('lobbyGold').innerText = `🟡 ${char.gold.toLocaleString()}`;
        document.getElementById('lobbyHero').innerText = char.icon;

        const grid = document.getElementById('charGrid');
        grid.innerHTML = '';
        for (let i = 1; i <= 9; i++) {
            const heroData = data.characters.find(c => c.id === i);
            const div = document.createElement('div');
            div.className = `char-slot ${data.selectedCharId === i ? 'active' : ''}`;

            if (heroData) {
                div.innerText = heroData.icon;
                div.onclick = () => {
                    GameState.selectChar(heroData.id);
                    navigateTo('lobby'); // รีเฟรชข้อมูลหน้า Lobby
                };
            }
            grid.appendChild(div);
        }
    },

    initProfile() {
        // อัปเดตข้อมูลจาก GameState (ถ้าต้องการ)
    },

    initShop() {
        window.switchTab = function (tabId) {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            event.target.classList.add('active');
        };
    },

    initCustomize() {
        window.currentSelectedItem = document.querySelector('.item-slot.equipped');

        window.selectItem = function (element, name, desc) {
            document.querySelectorAll('.item-slot').forEach(el => el.classList.remove('selected'));
            element.classList.add('selected');
            window.currentSelectedItem = element;
            document.getElementById('preview-name').innerText = name;
            document.getElementById('preview-desc').innerText = desc;
            let btn = document.getElementById('btn-equip');
            btn.innerText = element.classList.contains('equipped') ? "ถอดออก" : "สวมใส่";
            btn.className = element.classList.contains('equipped') ? "btn-equip active" : "btn-equip";
        };

        window.toggleEquip = function () {
            if (!window.currentSelectedItem) return;
            let btn = document.getElementById('btn-equip');
            if (window.currentSelectedItem.classList.contains('equipped')) {
                window.currentSelectedItem.classList.remove('equipped');
                btn.innerText = "สวมใส่";
                btn.classList.remove('active');
            } else {
                window.currentSelectedItem.classList.add('equipped');
                btn.innerText = "ถอดออก";
                btn.classList.add('active');
            }
        };
    },

    initBattle() {
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
        window.addEventListener('resize', resize); resize();

        let player = { x: window.innerWidth / 2, y: window.innerHeight / 2, radius: 25, speed: 5, actionType: 'idle', actionTimer: 0, angle: 0 };
        let projectiles = [];
        let playerHp = 100;
        let moveVec = { x: 0, y: 0 };

        window.showResult = function (result) {
            document.getElementById('gameResultOverlay').style.display = 'flex';
            if (result === 'win') {
                document.getElementById('victoryScreen').style.display = 'block';
            } else {
                document.getElementById('defeatScreen').style.display = 'block';
            }
        };

        const jZone = document.getElementById('joystickZone');
        const jKnob = document.getElementById('joystickKnob');
        let jCenter = { x: 0, y: 0 };
        let isDragging = false;
        let lastTapTime = 0;

        function updateJCenter() { const rect = jZone.getBoundingClientRect(); jCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; }
        setTimeout(updateJCenter, 100);

        function handleJoystick(e) {
            if (!isDragging) return;
            let cX = e.touches ? e.touches[0].clientX : e.clientX;
            let cY = e.touches ? e.touches[0].clientY : e.clientY;
            let dx = cX - jCenter.x; let dy = cY - jCenter.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 50) { dx = (dx / dist) * 50; dy = (dy / dist) * 50; }
            jKnob.style.transform = `translate(${dx}px, ${dy}px)`;
            moveVec.x = dx / 50; moveVec.y = dy / 50;
            if (dist > 5) { player.angle = Math.atan2(dy, dx); }
        }

        function checkDoubleTap() {
            let currentTime = new Date().getTime();
            let tapLength = currentTime - lastTapTime;
            if (tapLength < 300 && tapLength > 0) { window.triggerRoll(); }
            lastTapTime = currentTime;
        }

        jZone.addEventListener('touchstart', (e) => { isDragging = true; updateJCenter(); checkDoubleTap(); handleJoystick(e); }, { passive: false });
        window.addEventListener('touchmove', handleJoystick, { passive: false });
        window.addEventListener('touchend', () => { isDragging = false; moveVec = { x: 0, y: 0 }; jKnob.style.transform = `translate(0px, 0px)`; });

        window.toggleMenu = function () { const m = document.getElementById('subMenu'); m.style.display = (m.style.display === 'flex') ? 'none' : 'flex'; };
        window.triggerSteelPunch = function () { player.actionType = 'steel-punch'; player.actionTimer = 20; };
        window.triggerAction = function (type) { player.actionType = type; player.actionTimer = 15; };

        window.triggerMagic = function () {
            let dirX = Math.cos(player.angle); let dirY = Math.sin(player.angle);
            projectiles.push({ x: player.x, y: player.y, dx: dirX * 10, dy: dirY * 10, type: 'magic', life: 60 });
        };

        window.triggerBuffalo = function () {
            let dirX = Math.cos(player.angle); let dirY = Math.sin(player.angle);
            projectiles.push({ x: player.x, y: player.y, dx: dirX * 6, dy: dirY * 6, type: 'buffalo', life: 100 });
            window.toggleMenu();
        };

        window.triggerRoll = function () {
            player.actionType = 'roll'; player.actionTimer = 20;
            player.x += Math.cos(player.angle) * 100;
            player.y += Math.sin(player.angle) * 100;
        };

        window.triggerHeal = function () { playerHp = 100; document.getElementById('hpFill').style.width = '100%'; window.toggleMenu(); };

        function update() {
            let nextX = player.x + (moveVec.x * player.speed);
            let nextY = player.y + (moveVec.y * player.speed);
            player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, nextX));
            player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, nextY));

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#39ff14';
            ctx.beginPath(); ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2); ctx.fill();

            if (player.actionTimer > 0) {
                player.actionTimer--;
                ctx.strokeStyle = 'white'; ctx.lineWidth = 5;
                ctx.strokeRect(player.x - 40, player.y - 40, 80, 80);
            }

            for (let i = projectiles.length - 1; i >= 0; i--) {
                let p = projectiles[i];
                p.x += p.dx; p.y += p.dy; p.life--;
                ctx.fillStyle = (p.type === 'buffalo') ? 'gold' : 'cyan';
                ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, Math.PI * 2); ctx.fill();
                if (p.life <= 0 || p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) projectiles.splice(i, 1);
            }

            document.getElementById('posDisplay').innerText = `X: ${Math.round(player.x)} | Y: ${Math.round(player.y)}`;
            if (playerHp <= 0) { window.showResult('lose'); return; }

            window.App.battleLoopId = requestAnimationFrame(update);
        }
        update();
    }
};