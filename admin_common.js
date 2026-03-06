const SECURE_STORAGE_KEY = 'secure_judge_data';

// 이미지 기반 상세 배점표 데이터 (공통 공유)
const JUDGING_SCHEMA = {
    "integrated_marketing": {
        name: "통합마케팅",
        sub: {
            "default": { name: "-", weights: { strategic: 20, technical: 20, artistic: 20, delivery: 20, performance: 20 } }
        }
    },
    "marketing_campaign": {
        name: "마케팅/캠페인",
        sub: {
            "data_marketing": { name: "데이터활용마케팅", weights: { strategic: 30, technical: 25, artistic: 5, delivery: 5, performance: 35 } },
            "sns_marketing": { name: "SNS마케팅", weights: { strategic: 30, technical: 5, artistic: 15, delivery: 25, performance: 25 } },
            "ecommerce_ad": { name: "이커머스 광고", weights: { strategic: 30, technical: 5, artistic: 5, delivery: 10, performance: 50 } },
            "promotion": { name: "프로모션", weights: { strategic: 30, technical: 20, artistic: 10, delivery: 10, performance: 30 } },
            "techtainment": { name: "테크테인먼트", weights: { strategic: 30, technical: 30, artistic: 20, delivery: 10, performance: 10 } }
        }
    },
    "performance": {
        name: "퍼포먼스",
        sub: {
            "integrated_perf": { name: "통합 퍼포먼스", weights: { strategic: 30, technical: 10, artistic: 10, delivery: 20, performance: 30 } },
            "app_perf": { name: "앱 퍼포먼스", weights: { strategic: 30, technical: 10, artistic: 10, delivery: 20, performance: 30 } },
            "search_perf_large": { name: "검색 퍼포먼스(대형)", weights: { strategic: 30, technical: 0, artistic: 0, delivery: 20, performance: 50 } },
            "search_perf_mid": { name: "검색 퍼포먼스(중형)", weights: { strategic: 30, technical: 0, artistic: 0, delivery: 20, performance: 50 } },
            "search_perf_small": { name: "검색 퍼포먼스(소형)", weights: { strategic: 30, technical: 0, artistic: 0, delivery: 20, performance: 50 } },
            "perf_creative": { name: "퍼포먼스크리에이티브", weights: { strategic: 20, technical: 15, artistic: 20, delivery: 15, performance: 30 } }
        }
    },
    "digital_creative": {
        name: "디지털 크리에이티브",
        sub: {
            "visual_creative": { name: "비주얼크리에이티브", weights: { strategic: 20, technical: 10, artistic: 30, delivery: 30, performance: 10 } },
            "short_form": { name: "디지털영상(숏폼)", weights: { strategic: 10, technical: 10, artistic: 50, delivery: 25, performance: 5 } },
            "short_film": { name: "디지털영상(단편)", weights: { strategic: 10, technical: 10, artistic: 50, delivery: 25, performance: 5 } },
            "series": { name: "디지털영상(시리즈)", weights: { strategic: 10, technical: 10, artistic: 50, delivery: 25, performance: 5 } }
        }
    },
    "ai_creative": {
        name: "AI크리에이티브",
        sub: {
            "ai_story": { name: "AI스토리", weights: { strategic: 15, technical: 25, artistic: 25, delivery: 25, performance: 10 } },
            "ai_visual": { name: "AI비주얼", weights: { strategic: 15, technical: 25, artistic: 25, delivery: 25, performance: 10 } },
            "ai_campaign": { name: "AI캠페인", weights: { strategic: 20, technical: 20, artistic: 20, delivery: 20, performance: 20 } }
        }
    },
    "tech_solution": {
        name: "테크/솔루션",
        sub: {
            "marketing_tech": { name: "마케팅테크", weights: { strategic: 40, technical: 40, artistic: 0, delivery: 0, performance: 20 } },
            "ad_tech": { name: "애드테크", weights: { strategic: 40, technical: 40, artistic: 0, delivery: 0, performance: 20 } },
            "ai_tech_innovation": { name: "AI기술혁신", weights: { strategic: 40, technical: 40, artistic: 0, delivery: 0, performance: 20 } }
        }
    },
    "digital_pr": {
        name: "디지털PR",
        sub: {
            "public_pr": { name: "공공PR", weights: { strategic: 20, technical: 10, artistic: 20, delivery: 30, performance: 20 } },
            "csr": { name: "CSR(기업의 사회적 책임)", weights: { strategic: 20, technical: 20, artistic: 20, delivery: 20, performance: 20 } },
            "crisis": { name: "위기·평판관리PR", weights: { strategic: 20, technical: 20, artistic: 20, delivery: 20, performance: 20 } },
            "marketing_pr": { name: "마케팅PR", weights: { strategic: 20, technical: 20, artistic: 20, delivery: 20, performance: 20 } }
        }
    },
    "special_category": {
        name: "특별부문",
        sub: {
            "global_campaign": { name: "글로벌 캠페인", weights: { strategic: 20, technical: 20, artistic: 20, delivery: 20, performance: 20 } },
            "public_sector": { name: "공공분야", weights: { strategic: 20, technical: 10, artistic: 20, delivery: 40, performance: 10 } },
            "digital_signage": { name: "디지털 사이지니", weights: { strategic: 20, technical: 20, artistic: 20, delivery: 20, performance: 20 } }
        }
    }
};

window.JUDGING_SCHEMA = JUDGING_SCHEMA;

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
            } else {
                // 기본 초기 데이터 쓰기
                currentAdminData = {
                    judges: [
                        { id: "judge_01", name: "김광고", password: "password123", allowedMainCategories: ["integrated_marketing", "marketing_campaign", "performance", "digital_creative", "ai_creative"] }
                    ],
                    videos: [],
                    results: []
                };
                saveAdminData();
            }

            // 배열 누락 방지
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

// 초기화 즉시 실행
getAdminData();

window.currentAdminData = currentAdminData;

function saveAdminData() {
    window.currentAdminData = currentAdminData;
    window.firebaseSet(window.firebaseRef(window.firebaseDB, 'adminData'), currentAdminData)
        .then(() => console.log("Firebase 저장 완료"))
        .catch(err => console.error("Firebase 저장 실패:", err));
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
