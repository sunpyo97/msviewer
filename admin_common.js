const SECURE_STORAGE_KEY = 'secure_judge_data';

// 배점표 스키마는 judging-schema.js에서 로드 (window.JUDGING_SCHEMA)
const JUDGING_SCHEMA = window.JUDGING_SCHEMA;

// 데이터 마이그레이션 및 로드
// 관리자 페이지 보안 체크
(function () {
    const isLoginPage = window.location.pathname.includes('admin_login.html');
    if (!isLoginPage) {
        const auth = sessionStorage.getItem('kodaf_admin_auth');
        if (auth !== 'true') {
            localStorage.setItem('admin_redirect_url', window.location.href);
            window.location.href = 'admin_login.html';
            return;
        }
    }
})();

let currentAdminData = { judges: [], videos: [], results: [] };

// Firebase에서 데이터 실시간 동기화
function getAdminData() {
    try {
        const dbRef = window.firebaseRef(window.firebaseDB);
        const adminDataRef = window.firebaseChild(dbRef, 'adminData');

        window.firebaseOnValue(adminDataRef, (snapshot) => {
            if (snapshot.exists()) {
                currentAdminData = snapshot.val();
                
                // [Migration & Normalization]
                // If results is an array in Firebase, migrate it to object structure
                if (currentAdminData.results && Array.isArray(currentAdminData.results)) {
                    console.log("KODAF Admin: Migrating legacy array results to object structure...");
                    const legacyResults = currentAdminData.results;
                    const migratedObj = {};
                    legacyResults.forEach(res => {
                        const id = `${res.judgeId}_${res.videoId}_${res.mainCat}_${res.subCat}`.replace(/[^a-zA-Z0-9_]/g, '_');
                        migratedObj[id] = res;
                    });
                    // Update Firebase to object structure
                    window.firebaseSet(window.firebaseRef(window.firebaseDB, 'adminData/results'), migratedObj);
                    // Keep as array locally for immediate use
                    currentAdminData.results = legacyResults;
                } else if (currentAdminData.results) {
                    // Convert object from Firebase to array for local dashboard compatibility
                    currentAdminData.results = Object.values(currentAdminData.results);
                }
            } else {
                // 기본 초기 데이터 쓰기
                currentAdminData = {
                    judges: [
                        { id: "judge_01", name: "김광고", password: "password123", allowedMainCategories: ["integrated_marketing", "marketing_campaign", "performance", "digital_creative", "ai_creative"] }
                    ],
                    videos: [],
                    results: {} // New structure starts as object
                };
                saveAdminData();
            }

            // 배열 누락 방지 (results는 로컬에서는 항상 배열로 유지)
            if (!currentAdminData.judges) currentAdminData.judges = [];
            if (!currentAdminData.videos) currentAdminData.videos = [];
            if (!currentAdminData.results) currentAdminData.results = [];

            window.currentAdminData = currentAdminData;

            // 데이터 로드/변경 시 화면 갱신 이벤트 트리거
            window.dispatchEvent(new Event('adminDataLoaded'));
        });

    } catch (error) {
        console.error("Firebase 실시간 연결 에러:", error);
    }
}

// 초기화 (Firebase 로딩 완료 대기)
function initFirebaseSync() {
    if (!window.firebaseRef || !window.firebaseDB) {
        console.warn("KODAF Admin: Firebase not ready. Retrying in 500ms...");
        setTimeout(initFirebaseSync, 500);
        return;
    }
    getAdminData();
}

initFirebaseSync();

window.currentAdminData = currentAdminData;

function saveAdminData() {
    console.log("KODAF Admin: Saving to Firebase...", currentAdminData);
    
    // results가 로컬에서는 배열이므로, Firebase 저장 전에 객체로 변환 (동시성 방지를 위해 서버는 객체 구조 유지)
    const resultsObj = {};
    if (Array.isArray(currentAdminData.results)) {
        currentAdminData.results.forEach(res => {
            const id = `${res.judgeId}_${res.videoId}_${res.mainCat}_${res.subCat}`.replace(/[^a-zA-Z0-9_]/g, '_');
            resultsObj[id] = res;
        });
    }

    const dataToSave = {
        ...currentAdminData,
        results: resultsObj
    };

    window.firebaseSet(window.firebaseRef(window.firebaseDB, 'adminData'), dataToSave)
        .then(() => {
            console.log("KODAF Admin: Firebase Sync Success!");
            // 로컬 스토리지에 백업 (브라우저 종료 대비)
            localStorage.setItem(SECURE_STORAGE_KEY, JSON.stringify(dataToSave));
        })
        .catch(err => {
            console.error("KODAF Admin: Firebase Sync Failed!", err);
            alert("서버 저장에 실패했습니다. (인터넷 연결 또는 권한 확인 필)");
        });
}
window.saveAdminData = saveAdminData;

// 사이드바 네비게이션 생성
function initAdminSidebar() {
    const sidebar = document.createElement('div');
    sidebar.className = 'admin-sidebar';

    // 현재 페이지 파일명 확인
    const currentPage = window.location.pathname.split('/').pop() || 'admin_accounts.html';

    const menuItems = [
        { name: '계정 관리', icon: '👤', url: 'admin_accounts.html' },
        { name: '영상 등록/목록', icon: '🎬', url: 'admin_videos.html' },
        { name: '결과 대시보드', icon: '📊', url: 'admin_results.html' },
        { name: '심사화면 가기', icon: '🖥️', url: 'judging.html' },
        { name: '홈으로', icon: '🏠', url: 'index.html' }
    ];

    let menuHtml = `
        <div style="padding: 2rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: center; align-items: center;">
            <img src="logo.png" alt="KODAF" style="height: 65px; max-width: 100%; object-fit: contain;">
        </div>
        <nav class="sidebar-nav" style="padding-top: 1rem;">`;
    menuItems.forEach(item => {
        const isActive = currentPage === item.url ? 'active' : '';
        menuHtml += `<a href="${item.url}" class="nav-item ${isActive}"><span>${item.icon}</span> ${item.name}</a>`;
    });
    menuHtml += `</nav>`;

    sidebar.innerHTML = menuHtml;
    document.body.prepend(sidebar);
}

// 소분류 옵션 동적 생성 함수
function updateSubOptions(mainCatKey, selectElementId) {
    const subSelect = document.getElementById(selectElementId);
    if (!subSelect) return;
    subSelect.innerHTML = '';

    if (JUDGING_SCHEMA[mainCatKey] && JUDGING_SCHEMA[mainCatKey].sub) {
        Object.entries(JUDGING_SCHEMA[mainCatKey].sub).forEach(([key, data]) => {
            const option = document.createElement('option');
            option.value = key;
            option.innerText = data.name;
            subSelect.appendChild(option);
        });
    }
}

window.initAdminSidebar = initAdminSidebar;
window.updateSubOptions = updateSubOptions;
