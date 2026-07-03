const GameState = {
    init() {
        // [สำคัญ] ลบข้อมูลเก่าทิ้ง เพื่อบังคับให้ระบบสร้างข้อมูลใหม่ที่มีรูปภาพครบถ้วน (แก้ปัญหา undefined)
        localStorage.removeItem('mockGameData');

        if (!localStorage.getItem('mockGameData')) {
            const data = {
                characters: [
                    {
                        id: 1,
                        name: "นักรบไซเบอร์ V.1",
                        stage: 1,
                        gold: 8500,
                        // อัปเดตพาธใหม่ให้ชี้ไปที่โฟลเดอร์ assets
                        staticImg: "assets/characters/ntxoovyias/ntxoovyias.png",
                        gifImg: "assets/characters/ntxoovyias/animate.gif"
                    },
                    {
                        id: 2,
                        name: "นักรบไซเบอร์ V.2",
                        stage: 4,
                        gold: 1200,
                        // อัปเดตพาธใหม่ให้ชี้ไปที่โฟลเดอร์ assets
                        staticImg: "assets/characters/tswya/tswya.png",
                        gifImg: "assets/characters/tswya/animate.gif"
                    }
                ],
                selectedCharId: 1
            };
            localStorage.setItem('mockGameData', JSON.stringify(data));
        }
    },
    getData() { return JSON.parse(localStorage.getItem('mockGameData')); },
    saveData(data) { localStorage.setItem('mockGameData', JSON.stringify(data)); },
    getCurrentChar() {
        const data = this.getData();
        return data.characters.find(c => c.id === data.selectedCharId);
    },
    selectChar(id) {
        const data = this.getData();
        data.selectedCharId = id;
        this.saveData(data);
    }
};
// เรียกใช้งานทันที
GameState.init();