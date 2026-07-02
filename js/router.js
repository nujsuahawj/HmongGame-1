async function navigateTo(pageName) {
    const app = document.getElementById('app');

    // ล้าง Animation ของ Battle ก่อนเปลี่ยนหน้า
    if (window.App && window.App.cleanup) window.App.cleanup();

    try {
        const response = await fetch(`pages/${pageName}.html`);
        const html = await response.text();
        app.innerHTML = html;

        // เรียกสคริปต์เมื่อโหลดหน้าเสร็จ
        if (pageName === 'lobby') window.App.initLobby();
        if (pageName === 'profile') window.App.initProfile();
        if (pageName === 'shop') window.App.initShop();
        if (pageName === 'battle') window.App.initBattle();

    } catch (err) {
        console.error("Error loading page:", err);
    }
}

// หน้าแรกที่จะแสดงเมื่อโหลดเว็บ
window.onload = () => { navigateTo('login'); };