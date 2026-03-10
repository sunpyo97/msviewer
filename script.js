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

// 만약 세션이 없다면 (alert 후 redirect 중), 하위 스크립트 실행을 방지하여 에러 페이지가 남는 것을 막음.
if (currentJudge) {
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

    // UI 초기화 함수 (데이터 형식 유연성 확보)
    function initUI() {
        if (!currentJudge) return;

        // 성함 정보 즉시 표시
        const userNameElement = document.querySelector('.user-name');
        if (userNameElement) {
            userNameElement.innerText = `심사위원: ${currentJudge.name}`;
        }

        // 카테고리 구성 (데이터 로드 완료 여부 체크)
        if (window.currentData && window.currentData.videos && window.currentData.videos.length > 0) {
            const mainSelect = document.getElementById('mainCategorySelect');

            // allowedMainCategories가 객체로 올 경우 대비하여 배열로 변환
            let allowed = currentJudge.allowedMainCategories || Object.keys(JUDGING_SCHEMA);
            if (allowed && !Array.isArray(allowed)) {
                allowed = Object.values(allowed);
            }

            mainSelect.innerHTML = '';
            let hasValidCategory = false;

            allowed.forEach(key => {
                if (JUDGING_SCHEMA[key]) {
                    const opt = document.createElement('option');
                    opt.value = key;
                    opt.innerText = JUDGING_SCHEMA[key].name;
                    mainSelect.appendChild(opt);
                    hasValidCategory = true;
                }
            });

            if (hasValidCategory) {
                updateSubOptions(mainSelect.value);
            } else {
                mainSelect.innerHTML = '<option>할당된 부문이 유효하지 않습니다.</option>';
            }
        } else {
            // 데이터 로딩 중 표시
            const mainSelect = document.getElementById('mainCategorySelect');
            if (mainSelect) {
                mainSelect.innerHTML = '<option>데이터 로딩 중...</option>';
            }
        }
    }

    // 레이아웃 토글 로직
    function initLayoutSettings() {
        console.log("Initializing Layout Settings...");
        const toggleWideBtn = document.getElementById('toggleWideView');
        const toggleAspectBtn = document.getElementById('toggleAspectRatio');
        const mainContent = document.querySelector('.main-content');
        const playerWrapper = document.querySelector('.player-wrapper');

        if (!toggleWideBtn || !mainContent || !playerWrapper) return;

        // 저장된 설정 로드 (기본값을 true/doc으로 설정하여 변화를 즉시 느끼게 함)
        if (localStorage.getItem('LAYOUT_INIT') !== 'done') {
            localStorage.setItem('WIDE_VIEW', 'true');
            localStorage.setItem('ASPECT_MODE', 'doc');
            localStorage.setItem('LAYOUT_INIT', 'done');
        }

        const isWide = localStorage.getItem('WIDE_VIEW') === 'true';
        const aspectMode = localStorage.getItem('ASPECT_MODE') || 'doc';

        if (isWide) {
            mainContent.classList.add('wide-view');
            toggleWideBtn.classList.add('active');
        }

        applyAspect(aspectMode);

        toggleWideBtn.addEventListener('click', () => {
            console.log("Wide View Toggled");
            const newState = mainContent.classList.toggle('wide-view');
            toggleWideBtn.classList.toggle('active');
            localStorage.setItem('WIDE_VIEW', newState);
        });

        toggleAspectBtn.addEventListener('click', () => {
            let nextMode = '16-9';
            if (playerWrapper.classList.contains('aspect-doc')) {
                nextMode = 'auto';
            } else if (!playerWrapper.classList.contains('aspect-doc') && !playerWrapper.classList.contains('aspect-auto')) {
                nextMode = 'doc';
            }

            applyAspect(nextMode);
            localStorage.setItem('ASPECT_MODE', nextMode);
        });

        function applyAspect(mode) {
            playerWrapper.classList.remove('aspect-doc', 'aspect-auto');
            toggleAspectBtn.classList.remove('active');

            if (mode === 'doc') {
                playerWrapper.classList.add('aspect-doc');
                toggleAspectBtn.classList.add('active');
            } else if (mode === 'auto') {
                playerWrapper.classList.add('aspect-auto');
                toggleAspectBtn.classList.add('active');
            }
        }
    }

    // 영상 목록 필터링 및 업데이트 함수
    function updateVideoList(mainCat, subCat) {
        const videoData = window.currentData?.videos || [];

        const videoSelect = document.getElementById('videoSelect');
        videoSelect.innerHTML = '';

        const filteredVideos = videoData.filter(v => {
            const cats = v.categories || [{ main: v.mainCat, sub: v.subCat }];
            return cats.some(c =>
                c.main === mainCat && (subCat === 'default' || c.sub === subCat || !c.sub)
            );
        });

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
            loadVideo(videoSelect.value);
        } else {
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

    // 영상 로드 함수
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

        let catChanged = false;

        // Find if the currently selected category is valid for this video
        let activeMainCat = mainSelect.value;
        let activeSubCat = subSelect.value;

        // Default to the first category if the video has multiple categories
        const videoCats = video.categories || [{ main: video.mainCat, sub: video.subCat }];
        const validMatch = videoCats.find(c => c.main === activeMainCat && (c.sub === activeSubCat || activeSubCat === 'default' || !c.sub));

        if (!validMatch && videoCats.length > 0) {
            const firstCat = videoCats[0];
            mainSelect.value = firstCat.main;
            subSelect.innerHTML = '';
            if (JUDGING_SCHEMA[firstCat.main]?.sub) {
                Object.entries(JUDGING_SCHEMA[firstCat.main].sub).forEach(([key, data]) => {
                    const option = document.createElement('option');
                    option.value = key; option.innerText = data.name;
                    subSelect.appendChild(option);
                });
            }
            subSelect.value = firstCat.sub || 'default';
            catChanged = true;
        }

        if (catChanged) renderFields(mainSelect.value, subSelect.value);

        titleEl.innerText = displayTitle;
        infoEl.innerText = displayInfo;

        const playlistContainer = document.getElementById('playlistTabs');
        const subPlaylistContainer = document.getElementById('subPlaylistTabs');
        if (playlistContainer) playlistContainer.innerHTML = '';
        if (subPlaylistContainer) {
            subPlaylistContainer.innerHTML = '';
            subPlaylistContainer.style.display = 'none';
        }

        const iframeTag = document.getElementById('documentViewer');

        const playSource = async (driveId, isLocalObj = false, type = 'video') => {

            if (videoTag.src.startsWith('blob:') && videoTag.src !== isLocalObj) {
                URL.revokeObjectURL(videoTag.src);
            }

            videoTag.style.display = 'none';
            videoTag.pause();
            iframeTag.style.display = 'none';
            iframeTag.src = '';
            placeholder.style.display = 'none';
            console.log(`[PlaySource] ID: ${driveId}, MetaType: ${type}`);

            const playerControls = document.querySelector('.player-controls');
            if (playerControls) playerControls.style.display = 'none';

            if (driveId) {
                let cleanId = driveId;
                // 더 강력한 정규표현식: /d/, /folders/, id= 패턴 모두 대응
                const match = driveId.match(/[-\w]{25,}/);
                if (match) cleanId = match[0];

                if (type === 'folder') {
                    // 폴더는 preview가 아니라 embeddedfolderview를 사용해야 격자 형태로 내용이 보입니다.
                    iframeTag.src = `https://drive.google.com/embeddedfolderview?id=${cleanId}#grid`;
                } else {
                    // 이미지, PPT, 문서 등 모든 파일은 /preview 형식을 사용합니다.
                    iframeTag.src = `https://drive.google.com/file/d/${cleanId}/preview`;
                }
                iframeTag.style.cssText = 'display: block !important; position: absolute; top:0; left:0; width: 100%; height: 100%; border: none; z-index: 9999;';
            } else if (isLocalObj) {
                if (type === 'doc' || type === 'image') {
                    iframeTag.src = isLocalObj;
                    iframeTag.style.cssText = 'display: block !important; position: absolute; top:0; left:0; width: 100%; height: 100%; border: none; z-index: 9999;';
                } else {
                    if (playerControls) playerControls.style.display = 'flex';
                    videoTag.src = isLocalObj;
                    videoTag.load();
                    videoTag.style.cssText = 'display: block !important; width: 100%; height: 100%; object-fit: contain;';
                    iframeTag.style.zIndex = '0';
                }
            }
        };

        const isDocType = video.mainType === 'doc';

        // 새로운 트리 구조(seriesData) 우대, 없으면 기존 driveIds 사용
        const seriesItems = video.seriesData || (video.driveIds || []).map((id, idx) => ({
            id: id,
            name: `시리즈 ${idx + 1}`,
            folderName: '',
            type: isDocType ? 'doc' : 'video'
        }));

        if (seriesItems.length > 0 && playlistContainer) {
            // 탭이 1개이고 다른 부가 문서(신청서 등)가 있는 경우에도 탭을 보여줌
            const showForceTab = seriesItems.length === 1 && (video.appFormDriveId || video.appFormHasFile || video.addDescDriveId || video.addDescHasFile);

            if (seriesItems.length >= 10 || showForceTab) {
                // UI를 드롭다운(select)으로 변경
                const selectEl = document.createElement('select');
                selectEl.className = 'series-select';
                selectEl.style.cssText = 'padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: white; font-weight: 600; font-size: 0.9rem; min-width: 200px; max-width: 100%; word-break: break-all;';

                seriesItems.forEach((item, idx) => {
                    const option = document.createElement('option');
                    option.value = idx;

                    // 폴더명이 있으면 [폴더명] 파일명, 없으면 파일명
                    const label = item.folderName ? `📁 [${item.folderName}] ${item.name}` : (item.name || `작품 ${idx + 1}`);
                    option.innerText = label;
                    selectEl.appendChild(option);
                });

                selectEl.addEventListener('change', (e) => {
                    const selectedIdx = e.target.value;
                    const item = seriesItems[selectedIdx];

                    // 하위 탭 처리
                    if (subPlaylistContainer) {
                        subPlaylistContainer.innerHTML = '';
                        if (item.type === 'folder' && item.children && item.children.length > 0) {
                            subPlaylistContainer.style.display = 'flex';

                            if (item.children.length >= 10) {
                                // 자식이 많을 경우 드롭다운(select)으로 렌더링
                                const subSelectEl = document.createElement('select');
                                subSelectEl.className = 'series-select sub-select';
                                subSelectEl.style.cssText = 'padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-color); background: #f8fafc; font-size: 0.85rem; max-width: 100%; word-break: break-all; margin-top: 5px;';

                                item.children.forEach((child, cIdx) => {
                                    const option = document.createElement('option');
                                    option.value = cIdx;
                                    option.innerText = child.name;
                                    subSelectEl.appendChild(option);
                                });

                                subSelectEl.addEventListener('change', (e) => {
                                    const cIdx = e.target.value;
                                    const child = item.children[cIdx];
                                    playSource(child.id, null, child.type);
                                });

                                subPlaylistContainer.appendChild(subSelectEl);
                            } else {
                                // 자식이 10개 미만일 경우 그냥 버튼으로 렌더링
                                item.children.forEach((child, cIdx) => {
                                    const subBtn = document.createElement('button');
                                    subBtn.className = `series-btn sub-tab ${cIdx === 0 ? 'active' : ''}`;
                                    subBtn.style.fontSize = '0.75rem';
                                    subBtn.style.padding = '3px 8px';
                                    subBtn.innerText = child.name;
                                    subBtn.onclick = () => {
                                        subPlaylistContainer.querySelectorAll('.sub-tab').forEach(sb => sb.classList.remove('active'));
                                        subBtn.classList.add('active');
                                        playSource(child.id, null, child.type);
                                    };
                                    subPlaylistContainer.appendChild(subBtn);
                                });
                            }

                            // 첫 번째 자식 즉시 재생
                            playSource(item.children[0].id, null, item.children[0].type);
                        } else {
                            subPlaylistContainer.style.display = 'none';
                            playSource(item.id, null, item.type);
                        }
                    } else {
                        playSource(item.id, null, item.type);
                    }
                });

                playlistContainer.appendChild(selectEl);
            } else if (seriesItems.length > 1) {
                // 10개 미만일 경우 원래대로 버튼 형태 렌더링
                seriesItems.forEach((item, idx) => {
                    const btn = document.createElement('button');
                    btn.className = `series-btn ${idx === 0 ? 'active' : ''}`;

                    // 폴더명이 있으면 [폴더명] 파일명, 없으면 파일명
                    const label = item.folderName ? `📁 ${item.folderName}` : (item.name || `시리즈 ${idx + 1}`);
                    btn.innerText = label;
                    btn.title = item.name; // 전체 이름은 툴팁으로

                    btn.onclick = () => {
                        document.querySelectorAll('.series-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');

                        // 하위 탭 처리
                        if (subPlaylistContainer) {
                            subPlaylistContainer.innerHTML = '';
                            if (item.type === 'folder' && item.children && item.children.length > 0) {
                                subPlaylistContainer.style.display = 'flex';

                                if (item.children.length >= 10) {
                                    const subSelectEl = document.createElement('select');
                                    subSelectEl.className = 'series-select sub-select';
                                    subSelectEl.style.cssText = 'padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-color); background: #f8fafc; font-size: 0.85rem; max-width: 100%; word-break: break-all; margin-top: 5px;';

                                    item.children.forEach((child, cIdx) => {
                                        const option = document.createElement('option');
                                        option.value = cIdx;
                                        option.innerText = child.name;
                                        subSelectEl.appendChild(option);
                                    });

                                    subSelectEl.addEventListener('change', (e) => {
                                        const cIdx = e.target.value;
                                        const child = item.children[cIdx];
                                        playSource(child.id, null, child.type);
                                    });

                                    subPlaylistContainer.appendChild(subSelectEl);
                                } else {
                                    item.children.forEach((child, cIdx) => {
                                        const subBtn = document.createElement('button');
                                        subBtn.className = `series-btn sub-tab ${cIdx === 0 ? 'active' : ''}`;
                                        subBtn.style.fontSize = '0.75rem';
                                        subBtn.style.padding = '3px 8px';
                                        subBtn.innerText = child.name;
                                        subBtn.onclick = () => {
                                            subPlaylistContainer.querySelectorAll('.sub-tab').forEach(sb => sb.classList.remove('active'));
                                            subBtn.classList.add('active');
                                            playSource(child.id, null, child.type);
                                        };
                                        subPlaylistContainer.appendChild(subBtn);
                                    });
                                }
                                // 첫 번째 자식 즉시 재생
                                playSource(item.children[0].id, null, item.children[0].type);
                            } else {
                                subPlaylistContainer.style.display = 'none';
                                playSource(item.id, null, item.type);
                            }
                        } else {
                            playSource(item.id, null, item.type);
                        }
                    };
                    playlistContainer.appendChild(btn);
                });
            }

            // 첫 번째 아이템 즉시 재생 (초기 로드 시 하위 탭 대응)
            const first = seriesItems[0];
            if (first.type === 'folder' && first.children && first.children.length > 0) {
                // select 이벤트 강제 발생 방식 대신 하위 로직 직접 호출
                if (subPlaylistContainer) {
                    subPlaylistContainer.innerHTML = '';
                    subPlaylistContainer.style.display = 'flex';

                    if (first.children.length >= 10) {
                        const subSelectEl = document.createElement('select');
                        subSelectEl.className = 'series-select sub-select';
                        subSelectEl.style.cssText = 'padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-color); background: #f8fafc; font-size: 0.85rem; max-width: 100%; word-break: break-all; margin-top: 5px;';

                        first.children.forEach((child, cIdx) => {
                            const option = document.createElement('option');
                            option.value = cIdx;
                            option.innerText = child.name;
                            subSelectEl.appendChild(option);
                        });

                        subSelectEl.addEventListener('change', (e) => {
                            const cIdx = e.target.value;
                            const child = first.children[cIdx];
                            playSource(child.id, null, child.type);
                        });

                        subPlaylistContainer.appendChild(subSelectEl);
                    } else {
                        first.children.forEach((child, cIdx) => {
                            const subBtn = document.createElement('button');
                            subBtn.className = `series-btn sub-tab ${cIdx === 0 ? 'active' : ''}`;
                            subBtn.style.fontSize = '0.75rem';
                            subBtn.style.padding = '3px 8px';
                            subBtn.innerText = child.name;
                            subBtn.onclick = () => {
                                subPlaylistContainer.querySelectorAll('.sub-tab').forEach(sb => sb.classList.remove('active'));
                                subBtn.classList.add('active');
                                playSource(child.id, null, child.type);
                            };
                            subPlaylistContainer.appendChild(subBtn);
                        });
                    }
                    playSource(first.children[0].id, null, first.children[0].type);
                }
            } else {
                playSource(first.id, null, first.type);
            }
        } else if (video.driveId) {
            // 완전 구형 단건 데이터 호환성
            if (playlistContainer && (video.appFormDriveId || video.appFormHasFile || video.addDescDriveId || video.addDescHasFile)) {
                // 이 부분은 레거시이므로 가볍게 유지하거나, 필요시 select로 구색을 맞출 수 있음
                // 여기서는 기존 btnMain 유지
                const btnMain = document.createElement('button');
                btnMain.className = 'series-btn active';
                btnMain.innerText = isDocType ? '📄 메인 문서' : '🎬 메인 작품';
                btnMain.onclick = () => {
                    document.querySelectorAll('.series-btn').forEach(b => b.classList.remove('active'));
                    btnMain.classList.add('active');
                    playSource(video.driveId, false, isDocType);
                };
                playlistContainer.appendChild(btnMain);
            }
            playSource(video.driveId, false, isDocType);
        }
        else if (video.hasFile) {
            try {
                const fileData = await getVideoFile(video.id);
                if (fileData) {
                    const files = Array.isArray(fileData) ? fileData : [fileData];

                    if (files.length >= 10 && playlistContainer) {
                        const selectEl = document.createElement('select');
                        selectEl.className = 'series-select';
                        selectEl.style.cssText = 'padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: white; font-weight: 600; font-size: 0.9rem;';

                        files.forEach((file, idx) => {
                            const option = document.createElement('option');
                            option.value = idx;
                            option.innerText = `작품 ${idx + 1}`;
                            selectEl.appendChild(option);
                        });

                        selectEl.addEventListener('change', (e) => {
                            const idx = e.target.value;
                            playSource(null, URL.createObjectURL(files[idx]), video.mainType === 'doc');
                        });

                        playlistContainer.appendChild(selectEl);
                    } else if (files.length > 1 && playlistContainer) {
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
                    } else if (playlistContainer && (video.appFormDriveId || video.appFormHasFile || video.addDescDriveId || video.addDescHasFile)) {
                        const btnMain = document.createElement('button');
                        btnMain.className = 'series-btn active';
                        btnMain.innerText = video.mainType === 'doc' ? '📄 메인 문서' : '🎬 메인 작품';
                        btnMain.onclick = () => {
                            document.querySelectorAll('.series-btn').forEach(b => b.classList.remove('active'));
                            btnMain.classList.add('active');
                            playSource(null, URL.createObjectURL(files[0]), video.mainType === 'doc');
                        };
                        playlistContainer.appendChild(btnMain);
                    }
                    playSource(null, URL.createObjectURL(files[0]), video.mainType === 'doc');
                }
            } catch (err) {
                console.error('Video load error:', err);
                videoTag.style.display = 'none';
                placeholder.style.display = 'flex';
            }
        }

        if (playlistContainer) {
            if (video.appFormDriveId || video.appFormHasFile) {
                const btnApp = document.createElement('button');
                btnApp.className = 'series-btn';
                btnApp.innerText = `📄 신청서`;
                btnApp.style.marginLeft = '10px'; btnApp.style.borderColor = '#10b981';
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
        document.getElementById('judgeComment').value = '';
    }

    // 배점 필드 동적 생성 함수
    function renderFields(mainCat, subCat) {
        const container = document.getElementById('judgingFields');
        container.innerHTML = '';

        const config = JUDGING_SCHEMA[mainCat]?.sub[subCat] || { weights: {} };
        const weights = config.weights;

        const fieldMap = {
            strategic: "전략성", technical: "기술성", artistic: "예술성/심미성",
            delivery: "메시지 전달력", performance: "성과/대중성"
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
                    val = maxScore; e.target.value = maxScore;
                }
                if (val < 0) { val = 0; e.target.value = 0; }
                calculateTotal();
            });
        });
        calculateTotal();
    }

    // 합계 계산
    function calculateTotal() {
        let total = 0;
        document.querySelectorAll('.score-input').forEach(input => {
            total += parseInt(input.value) || 0;
        });
        document.getElementById('totalValue').innerText = total;
    }

    // 워터마크 생성
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
            item.style.left = Math.random() * 90 + '%';
            item.style.top = Math.random() * 95 + '%';
            item.style.color = 'rgba(255, 255, 255, 0.9)';
            item.style.fontSize = '12px'; item.style.fontWeight = 'bold';
            item.style.pointerEvents = 'none'; item.style.whiteSpace = 'nowrap';
            item.style.transform = `rotate(-25deg)`;
            container.appendChild(item);
        }
        setInterval(animateWatermarks, 2000);
    }

    function animateWatermarks() {
        const items = document.querySelectorAll('.watermark-item');
        items.forEach(item => {
            const moveX = (Math.random() - 0.5) * 40;
            const moveY = (Math.random() - 0.5) * 40;
            const currentLeft = parseFloat(item.style.left);
            const currentTop = parseFloat(item.style.top);
            item.style.left = (currentLeft + moveX / 10) + '%';
            item.style.top = (currentTop + moveY / 10) + '%';
        });
    }

    // 플레이어 제어
    const videoTag = document.getElementById('mainVideo');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const videoTime = document.getElementById('videoTime');
    const progressBar = document.querySelector('.progress');

    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', () => {
            if (videoTag.paused) { videoTag.play(); playPauseBtn.innerText = 'PAUSE'; }
            else { videoTag.pause(); playPauseBtn.innerText = 'PLAY'; }
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

    // 초기화 및 리스너 등록
    initUI();

    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('JUDGE_SESSION');
            window.location.href = 'login.html';
        });
    }

    setTimeout(createWatermark, 500);
    initLayoutSettings(); // 여기서 한 번만 호출

    document.getElementById('videoSelect').addEventListener('change', (e) => loadVideo(e.target.value));
    document.getElementById('mainCategorySelect').addEventListener('change', (e) => updateSubOptions(e.target.value));
    document.getElementById('subCategorySelect').addEventListener('change', (e) => {
        const mainCat = document.getElementById('mainCategorySelect').value;
        const subCat = e.target.value;
        renderFields(mainCat, subCat);
        updateVideoList(mainCat, subCat);
    });

    const onDataLoaded = () => {
        console.log("Firebase Data Loaded. Initializing UI Components...");
        initUI();
        const mainCat = document.getElementById('mainCategorySelect').value;
        const subCat = document.getElementById('subCategorySelect').value;
        if (mainCat && subCat) {
            renderFields(mainCat, subCat);
            updateVideoList(mainCat, subCat);
        }
    };

    window.addEventListener('judgeDataLoaded', onDataLoaded);
    if (window.currentData && window.currentData.videos && window.currentData.videos.length > 0) {
        onDataLoaded();
    }

    const submitBtn = document.querySelector('.btn.primary');
    if (submitBtn) {
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
                judgeId: currentJudge.id, judgeName: currentJudge.name,
                videoId: video.id, videoTitle: video.title,
                mainCat: document.getElementById('mainCategorySelect').value,
                subCat: document.getElementById('subCategorySelect').value,
                scores: scores, comment: document.getElementById('judgeComment').value,
                total: document.getElementById('totalValue').innerText,
                timestamp: new Date().toISOString()
            };

            if (!window.currentData.results) window.currentData.results = [];

            // Check for existing score by the same judge for the same video and same category
            const existingIndex = window.currentData.results.findIndex(r =>
                r.judgeId === currentJudge.id &&
                r.videoId === video.id &&
                r.mainCat === result.mainCat &&
                r.subCat === result.subCat
            );
            if (existingIndex !== -1) {
                // Update existing record
                window.currentData.results[existingIndex] = result;
            } else {
                // Add new record
                window.currentData.results.push(result);
            }

            window.firebaseSet(window.firebaseRef(window.firebaseDB, 'adminData/results'), window.currentData.results)
                .then(() => { alert('심사 결과가 성공적으로 등록/수정되었습니다. 수고하셨습니다.'); })
                .catch((error) => {
                    console.error('제출 저장 실패:', error);
                    alert('점수 저장에 실패했습니다. 관리자에게 문의하세요.');
                });
        });
    }

    // === 내 심사 결과 모달 로직 ===
    const myScoresBtn = document.getElementById('myScoresBtn');
    const myScoresModal = document.getElementById('myScoresModal');
    const closeMyScoresBtn = document.getElementById('closeMyScoresBtn');
    const exportMyScoresBtn = document.getElementById('exportMyScoresBtn');

    if (myScoresBtn && myScoresModal) {
        myScoresBtn.addEventListener('click', () => {
            renderMyScores();
            myScoresModal.style.display = 'flex';
        });

        closeMyScoresBtn.addEventListener('click', () => {
            myScoresModal.style.display = 'none';
        });

        // 외부 클리 시 닫기
        window.addEventListener('click', (e) => {
            if (e.target === myScoresModal) {
                myScoresModal.style.display = 'none';
            }
        });

        function renderMyScores() {
            const tbody = document.getElementById('myScoresBody');
            if (!tbody) return;
            tbody.innerHTML = '';

            const results = (window.currentData.results || []).filter(r => r.judgeId === currentJudge.id);

            if (results.length === 0) {
                tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px;">제출한 심사 결과가 없습니다.</td></tr>`;
                return;
            }

            // 최신순 정렬
            results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            results.forEach((res) => {
                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer';
                tr.addEventListener('mouseenter', () => tr.style.background = '#f1f5f9');
                tr.addEventListener('mouseleave', () => tr.style.background = 'transparent');

                tr.addEventListener('click', () => {
                    const mainSelect = document.getElementById('mainCategorySelect');
                    const subSelect = document.getElementById('subCategorySelect');
                    const videoSelect = document.getElementById('videoSelect');

                    if (mainSelect && subSelect && videoSelect) {
                        // 해당 비디오의 카테고리 정보 찾기
                        const video = window.currentData.videos.find(v => v.id === res.videoId);
                        if (video) {
                            // 현재 심사했던 카테고리(res.mainCat, res.subCat)로 먼저 전환
                            mainSelect.value = res.mainCat;

                            // 소분류 옵션 업데이트 (updateSubOptions은 내부적으로 updateVideoList를 호출함)
                            // 하지만 우리는 동기적으로 값을 다 설정해야 하므로 직접 호출 순서를 제어

                            // 1. 대분류에 따른 소분류 목록 갱신
                            subSelect.innerHTML = '';
                            if (JUDGING_SCHEMA[res.mainCat]?.sub) {
                                Object.entries(JUDGING_SCHEMA[res.mainCat].sub).forEach(([key, data]) => {
                                    const option = document.createElement('option');
                                    option.value = key; option.innerText = data.name;
                                    subSelect.appendChild(option);
                                });
                            }
                            subSelect.value = res.subCat || 'default';

                            // 2. 해당 부문의 배점 필드 및 영상 목록 갱신
                            renderFields(res.mainCat, subSelect.value);
                            updateVideoList(res.mainCat, subSelect.value);

                            // 3. 영상 선택 dropdown에서 해당 영상 선택
                            const targetIndex = window.currentData.videos.findIndex(v => v.id === res.videoId);
                            if (targetIndex !== -1) {
                                videoSelect.value = targetIndex;
                                loadVideo(targetIndex); // 즉시 로드
                            }

                            myScoresModal.style.display = 'none';
                        }
                    }
                });

                const dateStr = new Date(res.timestamp).toLocaleString('ko-KR', {
                    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                });

                const mainCatName = JUDGING_SCHEMA[res.mainCat]?.name || res.mainCat;
                const subCatName = JUDGING_SCHEMA[res.mainCat]?.sub[res.subCat]?.name || res.subCat;
                const scores = res.scores || {};

                tr.innerHTML = `
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${dateStr}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size:0.75rem;">${res.videoId}<br><span style="color:#64748b;">${mainCatName} > ${subCatName}</span></td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight:600; color:var(--primary-color);">${res.videoTitle}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${scores.strategic || 0}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${scores.technical || 0}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${scores.artistic || 0}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${scores.delivery || 0}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${scores.performance || 0}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight:bold; color:var(--primary-color);">${res.total || 0}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        exportMyScoresBtn.addEventListener('click', () => {
            const results = (window.currentData.results || []).filter(r => r.judgeId === currentJudge.id);
            if (results.length === 0) {
                alert('다운로드할 데이터가 없습니다.');
                return;
            }

            let csvContent = "\uFEFF"; // 한글 깨짐 방지 BOM
            csvContent += "심사 일시,출품번호,대분류,소분류,작품명,전략성,기술성,예술성/심미성,메시지 전달력,성과대중성,총점,심사평\n";

            results.forEach(res => {
                const dateStr = new Date(res.timestamp).toLocaleString('ko-KR');
                const mainCatName = JUDGING_SCHEMA[res.mainCat]?.name || res.mainCat;
                const subCatName = JUDGING_SCHEMA[res.mainCat]?.sub[res.subCat]?.name || res.subCat;
                const scores = res.scores || {};

                // CSV 포맷 안전 처리 (따옴표 및 쉼표 치환)
                const safeTitle = `"${(res.videoTitle || '').replace(/"/g, '""')}"`;
                const safeComment = `"${(res.comment || '').replace(/"/g, '""')}"`;

                const row = [
                    `"${dateStr}"`,
                    res.videoId,
                    mainCatName,
                    subCatName,
                    safeTitle,
                    scores.strategic || 0,
                    scores.technical || 0,
                    scores.artistic || 0,
                    scores.delivery || 0,
                    scores.performance || 0,
                    res.total || 0,
                    safeComment
                ].join(',');

                csvContent += row + "\n";
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            const dateStr = new Date().toLocaleDateString('ko-KR').replace(/\. /g, '').replace('.', '');
            link.setAttribute("download", `내_심사결과_${currentJudge.name}_${dateStr}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }
}

// === 보안 강화 로직 ===
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        securityAction("보안 정책상 복사가 금지되어 있습니다.");
    }
});

window.addEventListener('keydown', (e) => {
    const isCapture = e.key === 'PrintScreen' || e.keyCode === 44 ||
        ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'S' || e.key === 's'));

    if (isCapture) {
        document.body.classList.add('secure-blur');
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
}, true);

window.addEventListener('keyup', (e) => {
    if (e.key === 'PrintScreen' || e.keyCode === 44) {
        document.body.classList.add('secure-blur');
        securityAction("캡처 시도 감지: 즉각 폐쇄 조치.");
    }
}, true);

function securityAction(msg) {
    document.body.classList.add('secure-blur');
    const videoTag = document.getElementById('mainVideo');
    if (videoTag) videoTag.pause();
    setTimeout(() => {
        blackoutScreen();
        showSecurityAlert(msg);
    }, 0);
}

window.addEventListener('blur', () => {
    if (document.activeElement && document.activeElement.id === 'documentViewer') return;
    document.body.classList.add('secure-blur');
    const videoTag = document.getElementById('mainVideo');
    if (videoTag) videoTag.pause();
});

window.addEventListener('focus', () => {
    document.body.classList.remove('secure-blur');
});

document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        document.body.classList.add('secure-blur');
        const videoTag = document.getElementById('mainVideo');
        if (videoTag) videoTag.pause();
    } else {
        document.body.classList.remove('secure-blur');
    }
});

function showSecurityAlert(msg) {
    const toast = document.createElement('div');
    toast.className = 'security-toast';
    toast.style.background = '#000';
    toast.style.border = '2px solid #ff3b3b';
    toast.innerHTML = `<span style="color:#ff3b3b; font-weight:800;">[SECURITY ALERT]</span><br>${msg}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function blackoutScreen() {
    if (document.querySelector('.security-blocker')) return;
    const blocker = document.createElement('div');
    blocker.className = 'security-blocker';
    blocker.style.zIndex = '100000';
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
}

console.log("KODAF 2026 High-Security Engine Initialized.");
