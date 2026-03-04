const SECURE_STORAGE_KEY = 'secure_judge_data';

// 이미지 기반 상세 배점표 데이터
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
    }
};

// 데이터 로드
function getStoredData() {
    const defaultData = {
        judgeName: "김광고",
        judgeId: "judge_01",
        password: "password123",
        allowedMainCategories: ["integrated_marketing", "marketing_campaign", "performance", "digital_creative", "ai_creative"],
        videos: [
            { id: "AD-2026-0042", title: "The Future of AI", company: "(주)혁신광고", mainCat: "ai_creative", subCat: "ai_campaign" }
        ],
        results: []
    };
    const stored = localStorage.getItem(SECURE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : defaultData;
}

const currentData = getStoredData();

// 소분류 옵션 업데이트 함수
window.updateSubCategoryOptions = function (mainCatKey, subSelectId) {
    const subSelect = document.getElementById(subSelectId);
    subSelect.innerHTML = '';

    if (JUDGING_SCHEMA[mainCatKey] && JUDGING_SCHEMA[mainCatKey].sub) {
        Object.entries(JUDGING_SCHEMA[mainCatKey].sub).forEach(([key, data]) => {
            const option = document.createElement('option');
            option.value = key;
            option.innerText = data.name;
            subSelect.appendChild(option);
        });
    }
};

// UI 업데이트
function updateAdminUI() {
    document.getElementById('adminJudgeName').value = currentData.judgeName;
    document.getElementById('adminJudgeId').value = currentData.judgeId;
    document.getElementById('adminPassword').value = currentData.password || "";

    // 카테고리 체크박스 상태 업데이트
    const allowed = currentData.allowedMainCategories || ["integrated_marketing", "marketing_campaign", "performance", "digital_creative", "ai_creative"];
    document.querySelectorAll('#categoryCheckboxes input').forEach(cb => {
        cb.checked = allowed.includes(cb.value);
    });

    // 영상 등록 소분류 초기화
    updateSubCategoryOptions(document.getElementById('vMainCategory').value, 'vSubCategory');

    // 영상 목록 렌더링
    const videoListBody = document.getElementById('videoListBody');
    videoListBody.innerHTML = '';
    currentData.videos.forEach((v, index) => {
        const row = document.createElement('tr');
        const mainCatName = JUDGING_SCHEMA[v.mainCat]?.name || v.mainCat;
        const subCatName = JUDGING_SCHEMA[v.mainCat]?.sub[v.subCat]?.name || v.subCat;

        row.innerHTML = `
            <td>${v.id}</td>
            <td>${v.title}</td>
            <td>${mainCatName} > ${subCatName}</td>
            <td><button class="btn secondary" style="padding: 5px 10px; font-size: 0.7rem;" onclick="deleteVideo(${index})">삭제</button></td>
        `;
        videoListBody.appendChild(row);
    });

    // 심사 결과 렌더링
    const resultsBody = document.getElementById('resultsBody');
    resultsBody.innerHTML = '';

    currentData.results.forEach(res => {
        const row = document.createElement('tr');
        const mainCatName = JUDGING_SCHEMA[res.mainCat]?.name || res.mainCat;
        const subCatName = JUDGING_SCHEMA[res.mainCat]?.sub[res.subCat]?.name || res.subCat;

        // 세부 점수 매핑 (국문 키 반영)
        const s = res.scores || {};

        row.innerHTML = `
            <td>${new Date(res.timestamp).toLocaleString()}</td>
            <td>${res.judgeName || res.judgeId}</td>
            <td style="font-size: 0.8rem;">[${mainCatName}>${subCatName}] ${res.videoTitle || res.videoId}</td>
            <td>${s.strategic || 0}</td>
            <td>${s.technical || 0}</td>
            <td>${s.artistic || 0}</td>
            <td>${s.delivery || 0}</td>
            <td>${s.performance || 0}</td>
            <td style="font-size: 0.8rem; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${res.comment || '-'}</td>
            <td style="color: var(--primary-color); font-weight: bold;">${res.total}</td>
        `;
        resultsBody.appendChild(row);
    });
}

// 심사위원 정보 및 카테고리 저장
document.getElementById('saveSessionBtn').addEventListener('click', () => {
    currentData.judgeName = document.getElementById('adminJudgeName').value;
    currentData.judgeId = document.getElementById('adminJudgeId').value;
    currentData.password = document.getElementById('adminPassword').value;

    const selectedCats = [];
    document.querySelectorAll('#categoryCheckboxes input:checked').forEach(cb => {
        selectedCats.push(cb.value);
    });
    currentData.allowedMainCategories = selectedCats;

    localStorage.setItem(SECURE_STORAGE_KEY, JSON.stringify(currentData));
    alert('시스템 구성 및 심사위원 정보가 저장되었습니다.');
    updateAdminUI();
});

// 엑셀(CSV) 내보내기
document.getElementById('exportExcelBtn').addEventListener('click', () => {
    if (currentData.results.length === 0) {
        alert('내보낼 심사 결과가 없습니다.');
        return;
    }

    let csvContent = "\uFEFF"; // UTF-8 BOM for Excel
    csvContent += "일시,심사위원ID,심사위원성함,대분류,소분류,영상번호,영상제목,전략성,기술성,예술성,메시지전달력,성과대중성,심사평,총합\n";

    currentData.results.forEach(res => {
        const s = res.scores || {};
        const mainCatName = JUDGING_SCHEMA[res.mainCat]?.name || res.mainCat;
        const subCatName = JUDGING_SCHEMA[res.mainCat]?.sub[res.subCat]?.name || res.subCat;

        const row = [
            `"${new Date(res.timestamp).toLocaleString()}"`,
            `"${res.judgeId}"`,
            `"${res.judgeName || ''}"`,
            `"${mainCatName}"`,
            `"${subCatName}"`,
            `"${res.videoId}"`,
            `"${res.videoTitle || ''}"`,
            `"${s.strategic || 0}"`,
            `"${s.technical || 0}"`,
            `"${s.artistic || 0}"`,
            `"${s.delivery || 0}"`,
            `"${s.performance || 0}"`,
            `"${(res.comment || '').replace(/"/g, '""')}"`,
            `"${res.total}"`
        ].join(",");
        csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `심사결과_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// 영상 추가 (IndexedDB 연동으로 지속성 유지)
document.getElementById('addVideoBtn').addEventListener('click', async () => {
    const vId = document.getElementById('vId').value;
    const vTitle = document.getElementById('vTitle').value;
    const vCompany = document.getElementById('vCompany').value;
    const vMainCat = document.getElementById('vMainCategory').value;
    const vSubCat = document.getElementById('vSubCategory').value;
    const vFile = document.getElementById('vFile').files[0];

    let mainType = 'video';
    const mainTypeEl = document.querySelector('input[name="mainType"]:checked');
    if (mainTypeEl) {
        mainType = mainTypeEl.value;
    }

    if (!vId || !vTitle || !vCompany) {
        alert('필수 정보를 입력해주세요.');
        return;
    }

    const newVideo = {
        id: vId,
        title: vTitle,
        company: vCompany,
        mainCat: vMainCat,
        subCat: vSubCat,
        mainType: mainType,
        hasFile: !!vFile
    };

    if (vFile) {
        try {
            await saveVideoFile(vId, vFile);
            newVideo.fileName = vFile.name;
        } catch (err) {
            console.error('Video save error:', err);
            alert('영상 저장 중 오류가 발생했습니다.');
            return;
        }
    }

    currentData.videos.push(newVideo);
    localStorage.setItem(SECURE_STORAGE_KEY, JSON.stringify(currentData));
    updateAdminUI();
    alert('새 영상이 등록되었습니다.');
});

// 영상 삭제
window.deleteVideo = async function (index) {
    if (confirm('이 영상을 목록에서 삭제하시겠습니까? 데이터베이스의 원본 영상도 삭제됩니다.')) {
        const v = currentData.videos[index];
        if (v && v.hasFile) {
            await deleteVideoFile(v.id);
        }
        currentData.videos.splice(index, 1);
        localStorage.setItem(SECURE_STORAGE_KEY, JSON.stringify(currentData));
        updateAdminUI();
    }
};

// 결과 초기화
document.getElementById('clearResultsBtn').addEventListener('click', () => {
    if (confirm('모든 심사 결과를 삭제하시겠습니까?')) {
        currentData.results = [];
        localStorage.setItem(SECURE_STORAGE_KEY, JSON.stringify(currentData));
        updateAdminUI();
    }
});

// 초기화
updateAdminUI();
