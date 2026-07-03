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

        const lobbyHero = document.getElementById('lobbyHero');
        lobbyHero.innerHTML = `<img src="${char.gifImg}" style="width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; border-radius: 20px;">`;

        const grid = document.getElementById('charGrid');
        grid.innerHTML = '';
        for (let i = 1; i <= 9; i++) {
            const heroData = data.characters.find(c => c.id === i);
            const div = document.createElement('div');
            div.className = `char-slot ${data.selectedCharId === i ? 'active' : ''}`;

            if (heroData) {
                div.innerHTML = `<img src="${heroData.staticImg}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px; image-rendering: pixelated;">`;
                div.onclick = () => {
                    GameState.selectChar(heroData.id);
                    navigateTo('lobby');
                };
            }
            grid.appendChild(div);
        }
    },

    initProfile() { },
    initShop() {
        window.switchTab = function (tabId) {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            event.target.classList.add('active');
        };
    },
    initCustomize() { },

    initBattle() {
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
        window.addEventListener('resize', resize); resize();

        const allData = GameState.getData();
        const playerChar = GameState.getCurrentChar();
        const aiChar = allData.characters.find(c => c.id !== playerChar.id) || allData.characters[0];

        const folderPlayer = playerChar.id === 1 ? 'ntxoovyias' : 'tswya';
        const folderAI = aiChar.id === 1 ? 'ntxoovyias' : 'tswya';

        const loadImages = (folder) => {
            const actions = ['idle', 'run', 'punch', 'kick', 'sword-attack', 'roll', 'crouch', 'death'];
            const imgs = {};
            actions.forEach(act => {
                let img = new Image();
                img.src = `assets/characters/${folder}/${act}.png`;
                imgs[act] = img;
            });
            return imgs;
        };

        // 🌟 ตั้งค่าฉาก (Visual) กลับไปใช้ค่าที่คุณต้องการ
        let cameraX = 0;
        const floorTop = canvas.height * 0.55;
        // กึ่งกลางจอยสติ๊กพอดี (จอยสติ๊กสูง 120 ยกจากพื้น 30 = กึ่งกลางคือ 90px จากล่าง)
        const floorBottom = canvas.height - 90;

        class Fighter {
            constructor(x, y, folder, isAI) {
                this.x = x; this.y = y;
                this.width = 150; this.height = 150;
                this.speed = isAI ? 3 : 5;
                this.maxHp = isAI ? 500 : 100;
                this.hp = this.maxHp;
                this.action = 'idle';
                this.isAI = isAI;
                this.facing = isAI ? -1 : 1;
                this.images = loadImages(folder);
                this.frameX = 0;
                this.frameTimer = 0;
                this.actionCooldown = 0;

                this.knockdownTimer = 0;
                this.lightHitCount = 0;
                this.lightHitTimer = 0;

                this.hitCount = 0;
                this.mode = 'aggressive';
                this.modeTimer = 0;
            }

            draw() {
                let img = this.images[this.action] || this.images['idle'];
                let screenX = this.x - cameraX;

                if (img.complete && img.naturalWidth > 0) {
                    let totalFrames = Math.max(1, Math.floor(img.naturalWidth / 512));
                    let animSpeed = 12;
                    if (['punch', 'kick', 'sword-attack'].includes(this.action)) animSpeed = 22;
                    else if (this.action === 'roll') animSpeed = 16;
                    else if (this.action === 'death') animSpeed = 18;

                    this.frameTimer++;
                    if (this.frameTimer > animSpeed) {
                        if (this.action === 'death') {
                            if (this.frameX < totalFrames - 1) this.frameX++;
                        } else {
                            this.frameX = (this.frameX + 1) % totalFrames;
                            if (this.frameX === 0 && !['idle', 'run'].includes(this.action)) {
                                this.action = 'idle';
                            }
                        }
                        this.frameTimer = 0;
                    }
                    ctx.save();
                    ctx.translate(screenX, this.y);
                    ctx.scale(this.facing, 1);
                    ctx.drawImage(img, this.frameX * 512, 0, 512, 512, -this.width / 2, -this.height / 2, this.width, this.height);
                    ctx.restore();
                } else {
                    ctx.fillStyle = this.isAI ? 'red' : 'cyan';
                    ctx.beginPath(); ctx.arc(screenX, this.y, 40, 0, Math.PI * 2); ctx.fill();
                }

                ctx.fillStyle = 'red'; ctx.fillRect(screenX - 40, this.y - this.height / 2 - 20, 80, 8);
                ctx.fillStyle = '#39ff14'; ctx.fillRect(screenX - 40, this.y - this.height / 2 - 20, 80 * (Math.max(0, this.hp) / this.maxHp), 8);
            }
        }

        let p1 = new Fighter(canvas.width / 2, floorTop + 50, folderPlayer, false);
        let ai = new Fighter(canvas.width / 2 + 300, floorTop + 50, folderAI, true);
        let projectiles = [];
        let isGameOver = false;
        let battleStarted = false;

        const vsOverlay = document.createElement('div');
        vsOverlay.id = 'vsScreenOverlay';
        vsOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(10,10,20,0.95);z-index:9999;display:flex;justify-content:space-around;align-items:center;color:white;font-family:sans-serif;transition:opacity 0.5s;';
        vsOverlay.innerHTML = `
            <div style="text-align:center; transform: translateX(-50px); animation: slideInLeft 0.5s forwards;">
                <img src="${playerChar.staticImg}" style="width:120px; height:120px; object-fit:cover; border:3px solid #39ff14; border-radius:50%; box-shadow: 0 0 20px #39ff14;">
                <h2 style="color:#39ff14; margin-top:15px; text-shadow:0 0 10px #39ff14;">${playerChar.name}</h2>
            </div>
            <div style="font-size:4rem; font-weight:900; color:white; font-style:italic; text-shadow:0 0 20px rgba(255,255,255,0.8); z-index:10;">VS</div>
            <div style="text-align:center; transform: translateX(50px); animation: slideInRight 0.5s forwards;">
                <img src="${aiChar.staticImg}" style="width:120px; height:120px; object-fit:cover; border:3px solid #ff2a2a; border-radius:50%; box-shadow: 0 0 20px #ff2a2a;">
                <h2 style="color:#ff2a2a; margin-top:15px; text-shadow:0 0 10px #ff2a2a;">${aiChar.name}</h2>
            </div>
            <div style="position:absolute; bottom: 30px; font-size:1.2rem; color:yellow; animation: blink 1s infinite;">กำลังเตรียมสนามประลอง...</div>
            <style>
                @keyframes slideInLeft { to { transform: translateX(0); } }
                @keyframes slideInRight { to { transform: translateX(0); } }
                @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
            </style>
        `;
        document.body.appendChild(vsOverlay);

        setTimeout(() => {
            vsOverlay.style.opacity = '0';
            setTimeout(() => {
                vsOverlay.remove();
                battleStarted = true;
                cameraX = p1.x - (canvas.width / 2);
                update();
            }, 500);
        }, 2500);

        const applyHit = (target, type, attackerX, damage) => {
            const isHeavy = (type === 'buffalo' || type === 'steel');
            const knockDir = target.x < attackerX ? -1 : 1;

            target.hp -= damage;

            if (isHeavy) {
                target.action = 'death';
                target.frameX = 0;
                target.knockdownTimer = type === 'buffalo' ? 80 : 60;
                target.x += knockDir * 35;
                target.lightHitCount = 0;
            } else {
                target.lightHitCount++;
                target.lightHitTimer = 150;

                if (target.lightHitCount >= 3) {
                    target.action = 'death';
                    target.frameX = 0;
                    target.knockdownTimer = 50;
                    target.x += knockDir * 15;
                    target.lightHitCount = 0;
                } else {
                    target.action = 'idle';
                    target.knockdownTimer = 15;
                }
            }
        };

        const jZone = document.getElementById('joystickZone');
        const jKnob = document.getElementById('joystickKnob');
        let jCenter = { x: 0, y: 0 }; let moveVec = { x: 0, y: 0 }; let isDragging = false; let lastTapTime = 0;

        setTimeout(() => { const rect = jZone.getBoundingClientRect(); jCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; }, 100);

        function handleJoystick(e) {
            if (!battleStarted || !isDragging || p1.knockdownTimer > 0) return;
            e.preventDefault();
            let touch = Array.from(e.touches).find(t => t.target === jZone || t.target === jKnob) || e.touches[0];
            if (!touch) return;
            let dx = touch.clientX - jCenter.x; let dy = touch.clientY - jCenter.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 50) { dx = (dx / dist) * 50; dy = (dy / dist) * 50; }
            jKnob.style.transform = `translate(${dx}px, ${dy}px)`;
            moveVec.x = dx / 50; moveVec.y = dy / 50;

            if (p1.action === 'idle' || p1.action === 'run') {
                p1.action = (Math.abs(moveVec.x) > 0.1 || Math.abs(moveVec.y) > 0.1) ? 'run' : 'idle';
                if (moveVec.x > 0.1) p1.facing = 1;
                if (moveVec.x < -0.1) p1.facing = -1;
            }
        }

        jZone.addEventListener('touchstart', (e) => {
            if (!battleStarted || p1.knockdownTimer > 0) return;
            isDragging = true;
            let currentTime = Date.now();
            let tapLength = currentTime - lastTapTime;
            if (tapLength > 0 && tapLength < 300 && p1.action !== 'roll') {
                p1.action = 'roll'; p1.frameX = 0;
                p1.lightHitCount = 0;
            }
            lastTapTime = currentTime;
            handleJoystick(e);
        }, { passive: false });

        jZone.addEventListener('touchmove', handleJoystick, { passive: false });
        jZone.addEventListener('touchend', (e) => {
            if (!battleStarted) return;
            e.preventDefault(); isDragging = false; moveVec = { x: 0, y: 0 }; jKnob.style.transform = `translate(0px, 0px)`;
            if (p1.hp > 0 && p1.action === 'run') p1.action = 'idle';
        }, { passive: false });

        const bindBtn = (id, callback) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('touchstart', (e) => { e.preventDefault(); if (battleStarted) callback(); }, { passive: false });
            el.addEventListener('mousedown', (e) => { e.preventDefault(); if (battleStarted) callback(); });
        };

        bindBtn('btnMagicMenu', () => {
            const m = document.getElementById('subMenu');
            m.style.display = (m.style.display === 'flex') ? 'none' : 'flex';
        });

        bindBtn('btnBuffalo', () => {
            if (p1.hp <= 0 || p1.knockdownTimer > 0) return;
            p1.action = 'idle'; p1.frameX = 0;
            projectiles.push({ x: p1.x, y: p1.y, speed: 3.5, type: 'buffalo', life: 250, owner: 'player' });
            document.getElementById('subMenu').style.display = 'none';
        });

        bindBtn('btnHeal', () => {
            if (p1.hp <= 0 || p1.knockdownTimer > 0) return;
            p1.hp = Math.min(p1.maxHp, p1.hp + 50);
            document.getElementById('hpFill').style.width = p1.hp + '%';
            document.getElementById('subMenu').style.display = 'none';
        });

        bindBtn('btnSteelPunch', () => {
            if (p1.hp <= 0 || p1.knockdownTimer > 0) return;
            p1.action = 'idle'; p1.frameX = 0;
            projectiles.push({ x: p1.x + (p1.facing * 30), y: p1.y, dx: p1.facing * 6, dy: 0, type: 'steel', life: 100, owner: 'player' });
        });

        bindBtn('btnMagic', () => {
            if (p1.hp <= 0 || p1.knockdownTimer > 0) return;
            p1.action = 'idle'; p1.frameX = 0;
            projectiles.push({ x: p1.x + (p1.facing * 30), y: p1.y, dx: p1.facing * 5, dy: 0, type: 'magic', life: 100, owner: 'player' });
        });

        bindBtn('btnDodge', () => {
            if (p1.hp > 0 && p1.action !== 'crouch' && p1.knockdownTimer <= 0) {
                p1.action = 'crouch'; p1.frameX = 0;
                p1.lightHitCount = 0;
            }
        });

        const triggerAttack = (type) => {
            if (p1.hp <= 0 || p1.knockdownTimer > 0) return;
            p1.action = type; p1.frameX = 0;
            let distToAi = Math.hypot(p1.x - ai.x, p1.y - ai.y);

            if (distToAi < 120 && ai.knockdownTimer <= 0) {
                applyHit(ai, type, p1.x, 10);
                ai.hitCount++;
                if (ai.hitCount >= 2) { ai.mode = 'flee'; ai.modeTimer = 90; ai.hitCount = 0; }
            }
        };

        bindBtn('btnSword', () => triggerAttack('sword-attack'));
        bindBtn('btnPunch', () => triggerAttack('punch'));
        bindBtn('btnKick', () => triggerAttack('kick'));

        window.showResult = function (result) {
            document.getElementById('gameResultOverlay').style.display = 'flex';
            if (result === 'win') document.getElementById('victoryScreen').style.display = 'block';
            else document.getElementById('defeatScreen').style.display = 'block';
        };

        bindBtn('btnNextStage', () => navigateTo('battle'));
        bindBtn('btnWinHome', () => navigateTo('lobby'));
        bindBtn('btnRetry', () => navigateTo('battle'));
        bindBtn('btnLoseHome', () => navigateTo('lobby'));

        function drawBackground() {
            ctx.fillStyle = '#050510'; ctx.fillRect(0, 0, canvas.width, floorTop);

            ctx.fillStyle = '#0f172a';
            for (let i = -1; i <= Math.ceil(canvas.width / 150) + 1; i++) {
                let offset = (cameraX * 0.2) % 150; if (offset < 0) offset += 150;
                let bx = i * 150 - offset;
                ctx.fillRect(bx + 10, floorTop - 120, 40, 120);
                ctx.fillRect(bx + 60, floorTop - 80, 50, 80);
                ctx.fillRect(bx + 120, floorTop - 160, 20, 160);
            }

            // โซนพื้นดิน
            ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0, floorTop, canvas.width, floorBottom - floorTop);

            ctx.strokeStyle = 'rgba(0, 243, 255, 0.1)'; ctx.lineWidth = 2;
            for (let i = -1; i <= Math.ceil(canvas.width / 100) + 1; i++) {
                let offset = (cameraX % 100); if (offset < 0) offset += 100;
                let lineX = i * 100 - offset;
                ctx.beginPath(); ctx.moveTo(lineX, floorTop); ctx.lineTo(lineX - 80, floorBottom); ctx.stroke();
            }

            ctx.strokeStyle = '#0f3460'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, floorTop); ctx.lineTo(canvas.width, floorTop); ctx.stroke();

            ctx.fillStyle = '#0a0a14'; ctx.fillRect(0, floorBottom, canvas.width, canvas.height - floorBottom);
        }

        function update() {
            if (isGameOver || !battleStarted) return;

            // 🌟 ปรับขอบเขตการเดินของตัวละคร (Walkable Area)
            let minY = p1.height / 2; // ด้านบนสุด: ขึ้นฟ้าไปได้สุดจอ
            let maxY = floorBottom;   // ด้านล่างสุด: ตัวละครเดินลงมาได้ลึกถึงเส้นกึ่งกลางจอยสติ๊กพอดีเป๊ะ! (ไม่หักลบความสูงแล้ว)

            [p1, ai].forEach(f => {
                if (f.lightHitTimer > 0) f.lightHitTimer--;
                else f.lightHitCount = 0;

                if (f.knockdownTimer > 0 && f.hp > 0) {
                    f.knockdownTimer--;
                    if (f.knockdownTimer <= 0) f.action = 'idle';
                }
            });

            if (ai.hp <= 0 && !isGameOver) {
                isGameOver = true; ai.action = 'death'; ai.frameX = 0;
                setTimeout(() => window.showResult('win'), 1500);
            }
            if (p1.hp <= 0 && !isGameOver) {
                isGameOver = true; p1.action = 'death'; p1.frameX = 0;
                setTimeout(() => window.showResult('lose'), 1500);
            }

            // ผู้เล่นเคลื่อนที่
            if (p1.hp > 0 && p1.knockdownTimer <= 0) {
                if (p1.action === 'roll') {
                    if (moveVec.x === 0 && moveVec.y === 0) p1.x += p1.facing * (p1.speed * 1.5);
                    else { p1.x += moveVec.x * p1.speed * 1.5; p1.y += moveVec.y * p1.speed * 1.5; }
                } else if (p1.action === 'run') {
                    p1.x += moveVec.x * p1.speed;
                    p1.y += moveVec.y * p1.speed;
                }

                // จำกัดการวิ่งขึ้นลง ให้ลงได้ลึกสุดตามค่า maxY
                p1.y = Math.max(minY, Math.min(maxY, p1.y));
                document.getElementById('hpFill').style.width = p1.hp + '%';
            }

            // ระบบกล้องประคองตัวผู้เล่น
            let screenX = p1.x - cameraX;
            let leftMargin = canvas.width * 0.2;
            let rightMargin = canvas.width * 0.8;

            if (screenX > rightMargin) cameraX += (screenX - rightMargin);
            else if (screenX < leftMargin) cameraX -= (leftMargin - screenX);

            // AI Logic
            if (ai.hp > 0 && p1.hp > 0 && ai.knockdownTimer <= 0) {
                let dx = p1.x - ai.x; let dy = p1.y - ai.y;
                let dist = Math.hypot(dx, dy);

                if (ai.actionCooldown > 0) ai.actionCooldown--;

                if (ai.modeTimer > 0) ai.modeTimer--;
                else {
                    let r = Math.random();
                    if (r < 0.2) ai.mode = 'flee';
                    else if (r < 0.5) ai.mode = 'aloof';
                    else ai.mode = 'aggressive';
                    ai.modeTimer = 60 + Math.floor(Math.random() * 60);
                }

                if (ai.mode === 'flee') {
                    ai.action = 'run'; ai.facing = dx > 0 ? -1 : 1;
                    ai.x -= (dx / dist) * ai.speed; ai.y -= (dy / dist) * ai.speed;
                }
                else if (ai.mode === 'aloof') {
                    ai.facing = dx > 0 ? 1 : -1;
                    if (dist > 200 && ai.actionCooldown <= 0) {
                        ai.action = 'idle';
                        ai.frameX = 0; ai.actionCooldown = 100;
                        let aimX = dx / dist; let aimY = dy / dist;
                        projectiles.push({ x: ai.x + (ai.facing * 30), y: ai.y, dx: aimX * 5, dy: aimY * 5, type: 'magic', life: 100, owner: 'ai' });
                    } else if (ai.action !== 'magic') ai.action = 'idle';
                }
                else {
                    ai.facing = dx > 0 ? 1 : -1;
                    if (dist > 120) {
                        ai.action = 'run'; ai.x += (dx / dist) * ai.speed; ai.y += (dy / dist) * ai.speed;
                    } else {
                        if (ai.actionCooldown <= 0) {
                            const attacks = ['punch', 'kick', 'sword-attack'];
                            ai.action = attacks[Math.floor(Math.random() * attacks.length)];
                            ai.frameX = 0; ai.actionCooldown = 60;

                            if (dist < 120 && p1.action !== 'roll' && p1.action !== 'crouch' && p1.knockdownTimer <= 0) {
                                applyHit(p1, ai.action, ai.x, 8);
                            }
                        }
                    }
                }

                // จำกัด AI ไม่ให้วิ่งทะลุจอแกน Y
                ai.y = Math.max(minY, Math.min(maxY, ai.y));
            }

            for (let i = projectiles.length - 1; i >= 0; i--) {
                let p = projectiles[i];

                if (p.type === 'buffalo' && p.owner === 'player' && ai.hp > 0) {
                    let aimX = ai.x - p.x; let aimY = ai.y - p.y;
                    let aimDist = Math.hypot(aimX, aimY);
                    if (aimDist > 0) { p.x += (aimX / aimDist) * p.speed; p.y += (aimY / aimDist) * p.speed; }
                } else {
                    p.x += p.dx; p.y += p.dy || 0;
                }

                p.life--;

                if (p.owner === 'player' && Math.hypot(p.x - ai.x, p.y - ai.y) < 50 && ai.hp > 0 && ai.knockdownTimer <= 0) {
                    let dmg = p.type === 'buffalo' ? 25 : (p.type === 'steel' ? 15 : 10);
                    applyHit(ai, p.type, p.x, dmg);

                    ai.hitCount++;
                    if (ai.hitCount >= 2) { ai.mode = 'flee'; ai.modeTimer = 90; ai.hitCount = 0; }

                    projectiles.splice(i, 1);
                    continue;
                }

                if (p.owner === 'ai' && Math.hypot(p.x - p1.x, p.y - p1.y) < 50 && p1.hp > 0 && p1.knockdownTimer <= 0) {
                    if (p1.action !== 'roll' && p1.action !== 'crouch') {
                        applyHit(p1, p.type, p.x, 10);
                    }
                    projectiles.splice(i, 1);
                    continue;
                }

                if (p.life <= 0) projectiles.splice(i, 1);
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            drawBackground();

            if (p1.y < ai.y) { p1.draw(); ai.draw(); } else { ai.draw(); p1.draw(); }

            projectiles.forEach(p => {
                ctx.beginPath(); ctx.arc(p.x - cameraX, p.y, 15, 0, Math.PI * 2);
                if (p.type === 'buffalo') ctx.fillStyle = 'brown';
                else if (p.type === 'steel') ctx.fillStyle = 'silver';
                else ctx.fillStyle = 'cyan';
                ctx.fill();
            });

            document.getElementById('posDisplay').innerText = `X: ${Math.round(p1.x)} | Y: ${Math.round(p1.y)}`;
            window.App.battleLoopId = requestAnimationFrame(update);
        }
    }
};