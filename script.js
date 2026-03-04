// 보안 설정 및 데이터 로드 영역
const SECURE_STORAGE_KEY = 'secure_judge_data';

// 보안 및 세션 체크
function checkSession() {
    const session = sessionStorage.getItem('JUDGE_SESSION');
    if (!session) {
        alert('심사위원 인증이 필요합니다.');
        window.location.href = 'login.html';
        return null;
    }
    return JSON.parse(session);
}

const currentJudge = checkSession();

let currentData = { judges: [], videos: [], results: [] };

function getStoredData() {
    try {
        const dbRef = window.firebaseRef(window.firebaseDB);
        const adminDataRef = window.firebaseChild(dbRef, 'adminData');

        window.firebaseOnValue(adminDataRef, (snapshot) => {
            if (snapshot.exists()) {
                currentData = snapshot.val();
            } else {
                console.warn("Firebase에 데이터가 없습니다. 관리자 페이지에서 먼저 초기화하세요.");
            }

            if (!currentData.judges) currentData.judges = [];
            if (!currentData.videos) currentData.videos = [];
            if (!currentData.results) currentData.results = [];

            window.currentData = currentData;
            window.dispatchEvent(new Event('judgeDataLoaded'));
        });
    } catch (e) {
        console.error("Firebase 로딩 에러:", e);
    }
}

// 초기화 즉시 실행
getStoredData();
window.currentData = currentData;

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

// UI 초기화
function initUI() {
    if (!currentJudge) return; // 세션 없으면 실행 안함

    document.querySelector('.user-name').innerText = `심사위원: ${currentJudge.name}`;

    // 대분류 선택기 구성
    const mainSelect = document.getElementById('mainCategorySelect');
    // 세션 정보에서 허용된 카테고리 가져오기 (login-script.js에서 연동됨)
    const allowed = currentJudge.allowedMainCategories || Object.keys(JUDGING_SCHEMA);

    mainSelect.innerHTML = '';
    allowed.forEach(key => {
        if (JUDGING_SCHEMA[key]) {
            const opt = document.createElement('option');
            opt.value = key;
            opt.innerText = JUDGING_SCHEMA[key].name;
            mainSelect.appendChild(opt);
        }
    });

    if (allowed && allowed.length > 0) {
        updateSubOptions(allowed[0]);
    } else {
        document.getElementById('mainCategorySelect').innerHTML = '<option>할당된 부문 없음</option>';
        document.getElementById('subCategorySelect').innerHTML = '<option>-</option>';
    }
}

// 영상 목록 필터링 및 업데이트 함수
function updateVideoList(mainCat, subCat) {
    // 실시간 Firebase 연동 상태이므로 전송받은 최신 상태 유지
    const videoData = window.currentData?.videos || [];

    const videoSelect = document.getElementById('videoSelect');
    videoSelect.innerHTML = '';

    // 필터링 조건 (소분류가 없는 경우나 default 처리 포함)
    const filteredVideos = videoData.filter(v =>
        v.mainCat === mainCat &&
        (subCat === 'default' || v.subCat === subCat || !v.subCat)
    );

    filteredVideos.forEach(v => {
        const option = document.createElement('option');
        const originalIndex = videoData.indexOf(v);
        option.value = originalIndex;
        option.innerText = `${v.id} - ${v.title}`;
        videoSelect.appendChild(option);
    });

    const videoTag = document.getElementById('mainVideo');
    const placeholder = document.getElementById('videoPlaceholder');
    const controls = document.querySelector('.player-controls');

    if (filteredVideos.length > 0) {
        if (controls) controls.style.display = 'flex';
        // 목록이 갱신된 후 첫 번째 영상 자동 로드
        loadVideo(videoSelect.value);
    } else {
        // 영상 없음 처리
        if (videoTag) {
            videoTag.style.display = 'none';
            videoTag.src = '';
        }
        if (placeholder) {
            placeholder.style.display = 'flex';
            const msg = placeholder.querySelector('p');
            if (msg) msg.innerText = "해당 부문에 등록된 영상이 없습니다.";
        }
        if (controls) controls.style.display = 'none';
        document.getElementById('currentVideoTitle').innerText = "등록된 영상 없음";
        document.getElementById('currentVideoInfo').innerText = "-";
    }
}

// 소분류 옵션 업데이트 함수
function updateSubOptions(mainCatKey) {
    const subSelect = document.getElementById('subCategorySelect');
    subSelect.innerHTML = '';

    if (JUDGING_SCHEMA[mainCatKey] && JUDGING_SCHEMA[mainCatKey].sub) {
        Object.entries(JUDGING_SCHEMA[mainCatKey].sub).forEach(([key, data]) => {
            const option = document.createElement('option');
            option.value = key;
            option.innerText = data.name;
            subSelect.appendChild(option);
        });
    }
    const subCat = subSelect.value;
    renderFields(mainCatKey, subCat);
    updateVideoList(mainCatKey, subCat);
}

// 영상 로드 함수 (IndexedDB 연동 비동기화)
async function loadVideo(index) {
    const video = currentData.videos[index];
    if (!video) return;

    const videoTag = document.getElementById('mainVideo');
    const placeholder = document.getElementById('videoPlaceholder');
    const titleEl = document.getElementById('currentVideoTitle');
    const infoEl = document.getElementById('currentVideoInfo');
    const mainSelect = document.getElementById('mainCategorySelect');
    const subSelect = document.getElementById('subCategorySelect');

    const displayTitle = `심사 대상 - "${video.title}"`;
    const displayInfo = `출품번호: ${video.id} | 출품사: ${video.company}`;

    // 1. 영상 분류 강제 세팅 (무한 루프 방지를 위해 값이 다를 때만 UI 수동 동기화)
    let catChanged = false;
    if (video.mainCat && mainSelect.value !== video.mainCat) {
        mainSelect.value = video.mainCat;
        subSelect.innerHTML = '';
        if (JUDGING_SCHEMA[video.mainCat]?.sub) {
            Object.entries(JUDGING_SCHEMA[video.mainCat].sub).forEach(([key, data]) => {
                const option = document.createElement('option');
                option.value = key; option.innerText = data.name;
                subSelect.appendChild(option);
            });
        }
        catChanged = true;
    }
    if (video.subCat && subSelect.value !== video.subCat) {
        subSelect.value = video.subCat;
        catChanged = true;
    }
    if (catChanged) renderFields(mainSelect.value, subSelect.value);

    // 타이틀 고정
    titleEl.innerText = displayTitle;
    infoEl.innerText = displayInfo;

    // 2. 영상 소스 처리 (IndexedDB 또는 Google Drive)
    const playlistContainer = document.getElementById('playlistTabs');
    if (playlistContainer) playlistContainer.innerHTML = ''; // 탭 초기화

    // 문서 렌더링 (iframe)
    const iframeTag = document.getElementById('documentViewer');

    // 재생 및 문서 렌더링 헬퍼 함수
    const playSource = async (driveId, isLocalObj = false, isDoc = false) => {
        console.log(`[Viewer Debug] playSource called with id: ${driveId}, isDoc: ${isDoc}, isLocal: ${!!isLocalObj}`);

        if (videoTag.src.startsWith('blob:') && videoTag.src !== isLocalObj) {
            URL.revokeObjectURL(videoTag.src); // 메모리 해제 제한적 실행
        }

        // 초기화
        videoTag.style.display = 'none';
        videoTag.pause();
        iframeTag.style.display = 'none';
        iframeTag.src = '';
        placeholder.style.display = 'none';

        const playerControls = document.querySelector('.player-controls');
        if (playerControls) playerControls.style.display = 'none';

        if (driveId) {
            // ID가 전체 URL일 경우를 대비한 안전 방어막
            let cleanId = driveId;
            const match = driveId.match(/\/d\/([a-zA-Z0-9_-]+)/) || driveId.match(/id=([a-zA-Z0-9_-]+)/);
            if (match) cleanId = match[1];

            // 구글 드라이브 링크는 영상이든 문서든 무조건 iframe 뷰어로 처리 (호환성 보장)
            iframeTag.src = `https://drive.google.com/file/d/${cleanId}/preview`;
            iframeTag.style.cssText = 'display: block !important; position: absolute; top:0; left:0; width: 100%; height: 100%; border: none; z-index: 9999;';
        } else if (isLocalObj) {
            if (isDoc) {
                // 로컬 문서 렌더링 (iframe)
                iframeTag.src = isLocalObj;
                iframeTag.style.cssText = 'display: block !important; position: absolute; top:0; left:0; width: 100%; height: 100%; border: none; z-index: 9999;';
            } else {
                // 로컬 비디오 렌더링 (video)
                if (playerControls) playerControls.style.display = 'flex';
                videoTag.src = isLocalObj;
                videoTag.load();
                videoTag.style.cssText = 'display: block !important; width: 100%; height: 100%; object-fit: contain;';
                iframeTag.style.zIndex = '0';
            }
        }
    };

    // 최우선 처리: 다중 구글 드라이브 ID (시리즈)
    const isDocType = video.mainType === 'doc';
    if (video.driveIds && video.driveIds.length > 0) {
        if (video.driveIds.length > 1 && playlistContainer) {
            // 다중 탭 렌더링
            video.driveIds.forEach((id, idx) => {
                const btn = document.createElement('button');
                btn.className = `series-btn ${idx === 0 ? 'active' : ''}`;
                btn.innerText = `시리즈 ${idx + 1}`;
                btn.onclick = () => {
                    // 활성 상태 변경
                    document.querySelectorAll('.series-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    // 영상/문서 전환
                    playSource(id, false, isDocType);
                };
                playlistContainer.appendChild(btn);
            });
        }
        playSource(video.driveIds[0], false, isDocType);

    } else if (video.driveId) {
        // 기존 하위 호환 단일 드라이브 ID
        playSource(video.driveId, false, isDocType);

    } else if (video.hasFile) {
        // 로컬 DB 비디오 다중 지원 병합
        try {
            const fileData = await getVideoFile(video.id);
            if (fileData) {
                const files = Array.isArray(fileData) ? fileData : [fileData];

                if (files.length > 1 && playlistContainer) {
                    files.forEach((file, idx) => {
                        const btn = document.createElement('button');
                        btn.className = `series-btn ${idx === 0 ? 'active' : ''}`;
                        btn.innerText = `시리즈 ${idx + 1}`;
                        btn.onclick = () => {
                            document.querySelectorAll('.series-btn').forEach(b => b.classList.remove('active'));
                            btn.classList.add('active');
                            playSource(null, URL.createObjectURL(file), video.mainType === 'doc');
                        };
                        playlistContainer.appendChild(btn);
                    });
                }
                playSource(null, URL.createObjectURL(files[0]), video.mainType === 'doc');
            } else {
                throw new Error("File not found in DB");
            }
        } catch (err) {
            console.error('Video load error:', err);
            videoTag.style.display = 'none';
            placeholder.style.display = 'flex';
            const errorMsg = placeholder.querySelector('p');
            if (errorMsg) {
                errorMsg.innerHTML = `영상을 불러올 수 없습니다.<br><small style="font-size: 0.8rem; opacity: 0.7;">관리자 페이지에서 영상을 다시 등록해주세요.</small>`;
            }
        }
    } else {
        videoTag.style.display = 'none';
        placeholder.style.display = 'flex';
    }

    // 문서 탭(신청서, 추가설명서) 동적 렌더링 병합
    if (playlistContainer) {
        // [2] 신청서
        if (video.appFormDriveId || video.appFormHasFile) {
            const btnApp = document.createElement('button');
            btnApp.className = 'series-btn';
            btnApp.innerText = `📄 신청서`;
            btnApp.style.marginLeft = '10px';
            btnApp.style.borderColor = '#10b981';
            btnApp.onclick = async () => {
                document.querySelectorAll('.series-btn').forEach(b => b.classList.remove('active'));
                btnApp.classList.add('active');
                if (video.appFormDriveId) {
                    playSource(video.appFormDriveId, false, true);
                } else {
                    const fileObj = await getVideoFile(video.id + '_appForm');
                    if (fileObj) playSource(null, URL.createObjectURL(fileObj), true);
                }
            };
            playlistContainer.appendChild(btnApp);
        }

        // [3] 추가설명서
        if (video.addDescDriveId || video.addDescHasFile) {
            const btnDesc = document.createElement('button');
            btnDesc.className = 'series-btn';
            btnDesc.innerText = `📄 추가설명서`;
            btnDesc.style.borderColor = '#8b5cf6';
            btnDesc.onclick = async () => {
                document.querySelectorAll('.series-btn').forEach(b => b.classList.remove('active'));
                btnDesc.classList.add('active');
                if (video.addDescDriveId) {
                    playSource(video.addDescDriveId, false, true);
                } else {
                    const fileObj = await getVideoFile(video.id + '_addDesc');
                    if (fileObj) playSource(null, URL.createObjectURL(fileObj), true);
                }
            };
            playlistContainer.appendChild(btnDesc);
        }
    }

    // 심사평 초기화
    document.getElementById('judgeComment').value = '';
}

// 배점 필드 동적 생성 함수
function renderFields(mainCat, subCat) {
    const container = document.getElementById('judgingFields');
    container.innerHTML = '';

    const config = JUDGING_SCHEMA[mainCat]?.sub[subCat] || { weights: {} };
    const weights = config.weights;

    const fieldMap = {
        strategic: "전략성",
        technical: "기술성",
        artistic: "예술성/심미성",
        delivery: "메시지 전달력",
        performance: "성과/대중성"
    };

    Object.entries(weights).forEach(([key, maxScore]) => {
        if (maxScore === 0) return;

        const field = document.createElement('div');
        field.className = 'scoring-field';
        field.style.marginBottom = "15px";
        field.innerHTML = `
            <div class="field-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <span class="field-title" style="font-size: 0.9rem; color: var(--text-secondary);">${fieldMap[key]} <small>(최대 ${maxScore}점)</small></span>
                <input type="number" class="score-input" id="score_${key}" min="0" max="${maxScore}" value="0" 
                    style="width: 70px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); color: #fff; padding: 5px; border-radius: 4px; text-align: center; font-weight: bold;">
            </div>
        `;
        container.appendChild(field);

        const input = field.querySelector('input');
        input.addEventListener('input', (e) => {
            let val = parseInt(e.target.value) || 0;
            if (val > maxScore) {
                alert(`${fieldMap[key]}의 최대 배점은 ${maxScore}점입니다.`);
                val = maxScore;
                e.target.value = maxScore;
            }
            if (val < 0) {
                val = 0;
                e.target.value = 0;
            }
            calculateTotal();
        });
    });
    calculateTotal();
}

// 합계 계산 함수
function calculateTotal() {
    let total = 0;
    document.querySelectorAll('.score-input').forEach(input => {
        total += parseInt(input.value) || 0;
    });
    document.getElementById('totalValue').innerText = total;
}

// 워터마크 생성 (성함 버전)
function createWatermark() {
    if (!currentJudge) return;
    const container = document.getElementById('watermark');
    if (!container) return;
    container.innerHTML = '';

    // 화면 크기에 맞춰 넉넉하게 생성
    for (let i = 0; i < 30; i++) {
        const item = document.createElement('div');
        item.className = 'watermark-item';
        item.innerText = `${currentJudge.name} | ${currentJudge.id} | ${new Date().toLocaleDateString()}`;
        item.style.position = 'absolute';
        item.style.left = Math.random() * 90 + '%';
        item.style.top = Math.random() * 95 + '%';
        item.style.opacity = '0.08';
        item.style.color = 'rgba(255, 255, 255, 0.5)';
        item.style.fontSize = '12px';
        item.style.fontWeight = 'bold';
        item.style.pointerEvents = 'none';
        item.style.whiteSpace = 'nowrap';
        item.style.transform = `rotate(-25deg)`;
        container.appendChild(item);
    }
}

// === 플레이어 제어 ===
const videoTag = document.getElementById('mainVideo');
const playPauseBtn = document.getElementById('playPauseBtn');
const videoTime = document.getElementById('videoTime');
const progressBar = document.querySelector('.progress');

if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
        if (videoTag.paused) {
            videoTag.play();
            playPauseBtn.innerText = 'PAUSE';
        } else {
            videoTag.pause();
            playPauseBtn.innerText = 'PLAY';
        }
    });
}

if (videoTag) {
    videoTag.addEventListener('timeupdate', () => {
        const curr = videoTag.currentTime;
        const dur = videoTag.duration || 0;
        const progress = (curr / dur) * 100;
        if (progressBar) progressBar.style.width = `${progress}%`;
        if (videoTime) videoTime.innerText = `${formatTime(curr)} / ${formatTime(dur)}`;
    });
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// 최종 제출 연동
window.addEventListener('judgeDataLoaded', () => {
    // 초기화 실행
    if (currentJudge) {
        initUI();
        document.getElementById('videoSelect').addEventListener('change', (e) => loadVideo(e.target.value));
        document.getElementById('mainCategorySelect').addEventListener('change', (e) => updateSubOptions(e.target.value));
        document.getElementById('subCategorySelect').addEventListener('change', (e) => {
            const mainCat = document.getElementById('mainCategorySelect').value;
            const subCat = e.target.value;
            renderFields(mainCat, subCat);
            updateVideoList(mainCat, subCat);
        });

        setTimeout(createWatermark, 500); // 폰트 로딩 대기 후 생성
    }

    const submitBtn = document.querySelector('.btn.primary');
    if (submitBtn) {
        // 기존 리스너 중복 방지 (안전 장치)
        const newSubmitBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);

        newSubmitBtn.addEventListener('click', () => {
            const currentVideoIndex = document.getElementById('videoSelect').value;
            const video = window.currentData.videos[currentVideoIndex];
            if (!video) return;

            const scores = {};
            let missingScore = false;
            document.querySelectorAll('.score-input').forEach(input => {
                const key = input.id.replace('score_', '');
                const val = parseInt(input.value) || 0;
                scores[key] = val;
                if (val <= 0) missingScore = true;
            });

            if (missingScore) {
                alert('모든 심사 항목에 점수를 작성해 주세요. 0점인 항목이 있으면 제출할 수 없습니다.');
                return;
            }

            const result = {
                judgeId: currentJudge.id,
                judgeName: currentJudge.name,
                videoId: video.id,
                videoTitle: video.title,
                mainCat: document.getElementById('mainCategorySelect').value,
                subCat: document.getElementById('subCategorySelect').value,
                scores: scores,
                comment: document.getElementById('judgeComment').value,
                total: document.getElementById('totalValue').innerText,
                timestamp: new Date().toISOString()
            };

            // 바로 Firebase에 밀어넣기
            if (!window.currentData.results) window.currentData.results = [];
            window.currentData.results.push(result);
            window.firebaseSet(window.firebaseRef(window.firebaseDB, 'adminData/results'), window.currentData.results)
                .then(() => {
                    alert('최종 제출되었습니다. 수고하셨습니다.');
                })
                .catch((error) => {
                    console.error('제출 저장 실패:', error);
                    alert('점수 저장에 실패했습니다. 관리자에게 문의하세요.');
                });
        });
    }
});


// 로그아웃 기능 (가장 상단 우선 처리)
const logoutBtn = document.querySelector('.logout-btn');
if (logoutBtn) {
    // 기존 이벤트 클리어 후 재등록
    const newLogoutBtn = logoutBtn.cloneNode(true);
    logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
    newLogoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('JUDGE_SESSION');
        window.location.href = 'login.html';
    });
}

// === 보안 강화 로직 (캡처 및 녹화 방지) ===
// 1. 우클릭 및 기본 복사 금지
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        securityAction("보안 정책상 복사가 금지되어 있습니다.");
    }
});

// 2. 캡처 시도 및 주요 단축키 감지 (Win+Shift+S, PrintScreen, Ctrl+P 등)
// Capture 페이즈에서 가장 먼저 이벤트를 낚아챔 (렌더링 지연 최소화)
window.addEventListener('keydown', (e) => {
    const isCapture = e.key === 'PrintScreen' || e.keyCode === 44 ||
        ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'S' || e.key === 's'));

    if (isCapture) {
        document.body.classList.add('secure-blur'); // 0순위 물리적 차단 (DOM 최우선 반영)
        securityAction("캡처 도구 사용이 감지되어 즉각 차단되었습니다.");
        e.preventDefault();
        return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        document.body.classList.add('secure-blur');
        securityAction("문서 인쇄가 제한됩니다.");
        e.preventDefault();
        return;
    }

    if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'i' || e.key === 'I'))) {
        document.body.classList.add('secure-blur');
        securityAction("개발자 도구 사용은 보안 위반 사항입니다.");
        e.preventDefault();
        return;
    }
}, true); // 캡처 페이즈 강제 활성화

window.addEventListener('keyup', (e) => {
    if (e.key === 'PrintScreen' || e.keyCode === 44) {
        document.body.classList.add('secure-blur');
        securityAction("캡처 시도 감지: 즉각 폐쇄 조치.");
    }
}, true);

// 워터마크 이동 스케줄러 (강력한 추적성)
function animateWatermarks() {
    const items = document.querySelectorAll('.watermark-item');
    items.forEach(item => {
        // 랜덤하게 조금씩 위치 이동
        const moveX = (Math.random() - 0.5) * 40;
        const moveY = (Math.random() - 0.5) * 40;
        const currentLeft = parseFloat(item.style.left);
        const currentTop = parseFloat(item.style.top);

        item.style.left = (currentLeft + moveX / 10) + '%';
        item.style.top = (currentTop + moveY / 10) + '%';
    });
}

// 워터마크 생성 로직 업데이트 (애니메이션 클래스 추가)
function createWatermark() {
    if (!currentJudge) return;
    const container = document.getElementById('watermark');
    if (!container) return;
    container.innerHTML = '';

    for (let i = 0; i < 30; i++) {
        const item = document.createElement('div');
        item.className = 'watermark-item dynamic-float';
        item.innerText = `${currentJudge.name} | ${currentJudge.id} | ${new Date().toLocaleDateString()}`;
        item.style.position = 'absolute';
        const startLeft = Math.random() * 90;
        const startTop = Math.random() * 95;
        item.style.left = startLeft + '%';
        item.style.top = startTop + '%';
        item.style.opacity = ''; // CSS 애니메이션에서 조절
        item.style.color = 'rgba(255, 255, 255, 0.9)'; // 검은 영상 대응을 위한 밝은 텍스트
        item.style.fontSize = '12px';
        item.style.fontWeight = 'bold';
        item.style.pointerEvents = 'none';
        item.style.whiteSpace = 'nowrap';
        item.style.transform = `rotate(-25deg)`;
        container.appendChild(item);
    }

    // 위치 미세 이동 시작
    setInterval(animateWatermarks, 2000);
}

function securityAction(msg) {
    // 1. 영상 정지 및 차단 클래스 즉시 동기화 (찰나의 유출 차단)
    document.body.classList.add('secure-blur');
    if (videoTag) videoTag.pause();

    // 2. DOM 렌더링에 시간 먹는 작업들을 이벤트 루프 뒤로 미룸
    setTimeout(() => {
        blackoutScreen();
        showSecurityAlert(msg);
        try { copyToClipboard("KODAF SECURITY PROTOCOLS ACTIVE: UNAUTHORIZED ACTION DETECTED"); } catch (e) { }
    }, 0);
}

// 3. 화면 포커스 이탈 시 화이트아웃 및 영상 정지 (녹화 도구 활성화 방지)
window.addEventListener('blur', () => {
    // 구글 드라이브 뷰어(Iframe) 내부 클릭 시 blur 이벤트 발생 방어
    if (document.activeElement && document.activeElement.id === 'documentViewer') {
        return;
    }
    document.body.classList.add('secure-blur');
    if (videoTag) videoTag.pause();
});
window.addEventListener('focus', () => {
    document.body.classList.remove('secure-blur');
});

// 브라우저 탭 전환 등 화면 숨김 상태 감지 추가 (보안 강화)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        document.body.classList.add('secure-blur');
        if (videoTag) videoTag.pause();
    } else {
        document.body.classList.remove('secure-blur');
    }
});

function showSecurityAlert(msg) {
    const toast = document.createElement('div');
    toast.className = 'security-toast';
    toast.style.background = '#000'; // 더 위협적인 블랙 경고창
    toast.style.border = '2px solid #ff3b3b';
    toast.innerHTML = `<span style="color:#ff3b3b; font-weight:800;">[SECURITY ALERT]</span><br>${msg}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function blackoutScreen() {
    // 중복 생성 방지
    if (document.querySelector('.security-blocker')) return;

    const blocker = document.createElement('div');
    blocker.className = 'security-blocker';
    blocker.style.zIndex = '100000'; // 최상단 노출
    blocker.style.position = 'fixed';
    blocker.style.top = '0'; blocker.style.left = '0';
    blocker.style.width = '100vw'; blocker.style.height = '100vh';
    blocker.innerHTML = `
        <div style="font-size: 5rem; margin-bottom: 2rem;">✋</div>
        <h2 style="color:white; font-size: 2.5rem; margin-bottom: 1rem;">보안 규정 위반 감지</h2>
        <p style="color:#ff3b3b; font-size: 1.2rem; font-weight: 700;">비인가 동작(캡처/복사 등)이 감지되어 시스템이 강력 차단되었습니다.</p>
        <p style="color:#666; margin-top: 2rem;">심사 세션을 다시 시작하려면 아래 버튼을 클릭하세요.</p>
        <button onclick="location.reload()" style="margin-top: 30px; padding: 15px 40px; font-size: 1.1rem; font-weight: bold; background: #ff3b3b; color: white; border: none; border-radius: 8px; cursor: pointer; transition: 0.3s;">시스템 재시작</button>
    `;
    document.body.appendChild(blocker);
    // 시간 경과 후 자동 해제(setTimeout)를 삭제하여 영구 차단
}

function copyToClipboard(text) {
    const temp = document.createElement('textarea');
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    document.body.removeChild(temp);
}

console.log("KODAF 2026 High-Security Engine Initialized.");
