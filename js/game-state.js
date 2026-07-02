const GameState = {
    init() {
        if (!localStorage.getItem('mockGameData')) {
            const data = {
                characters: [
                    { id: 1, name: "นักรบไซเบอร์ V.1", stage: 1, gold: 8500, icon: "🧑‍🎤" },
                    { id: 2, name: "นักรบไซเบอร์ V.2", stage: 4, gold: 1200, icon: "🥷" }
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
GameState.init();