console.log("KODAF script.js: Script evaluation start.");
// 보안 설정 및 데이터 로드 영역
const SECURE_STORAGE_KEY = 'secure_judge_data';

// ===== 다이얼로그 보안 예외 처리 =====
// alert/confirm/prompt 호출 시 보안 화면이 뜨지 않도록 플래그 관리
window._isDialogOpen = false;
(function () {
    const _origAlert = window.alert.bind(window);
    const _origConfirm = window.confirm.bind(window);
    const _origPrompt = window.prompt.bind(window);
    window.alert = function (msg) {
        window._isDialogOpen = true;
        try { return _origAlert(msg); } finally {
            // 브라우저 blur 이벤트가 비동기로 올 수 있으므로 약간 지연 후 해제
            setTimeout(() => { window._isDialogOpen = false; }, 100);
        }
    };
    window.confirm = function (msg) {
        window._isDialogOpen = true;
        try { return _origConfirm(msg); } finally {
            setTimeout(() => { window._isDialogOpen = false; }, 100);
        }
    };
    window.prompt = function (msg, def) {
        window._isDialogOpen = true;
        try { return _origPrompt(msg, def); } finally {
            setTimeout(() => { window._isDialogOpen = false; }, 100);
        }
    };
})();
// ===== 다이얼로그 보안 예외 처리 끝 =====

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
console.log("KODAF script.js: Session check result:", currentJudge);

// 만약 세션이 없다면 (alert 후 redirect 중), 하위 스크립트 실행을 방지하여 에러 페이지가 남는 것을 막음.
if (currentJudge) {
    console.log("KODAF script.js: Starting main logic for judge:", currentJudge.name);

    // 심사위원 이름 즉시 렌더링 (Firebase 로딩 대기 상관 없이)
    const userNameElement = document.querySelector('.user-name');
    if (userNameElement) {
        userNameElement.innerText = `심사위원: ${currentJudge.name}`;
    }

    let currentData = { judges: [], videos: [], results: [] };
    
    // ===== 메모리 관리를 위한 Blob URL 추적 및 해제 로직 =====
    window.activeBlobUrls = new Set();
    function safeCreateObjectURL(file) {
        if (!file) return null;
        const url = URL.createObjectURL(file);
        window.activeBlobUrls.add(url);
        console.log(`[Memory] Blob URL Created: ${url}. Total active: ${window.activeBlobUrls.size}`);
        return url;
    }

    function revokeAllBlobUrls(exceptionUrl = null) {
        // 1. 현재 열려 있는 모든 팝업창에서 사용 중인 Blob URL 수집 (보호 대상)
        const protectedUrls = new Set();
        if (window.openedPopups) {
            window.openedPopups.forEach(item => {
                if (item.win && !item.win.closed && item.blobUrl) {
                    protectedUrls.add(item.blobUrl);
                }
            });
        }

        // 2. 예외 URL(현재 메인 뷰어에서 로드된 것 등) 추가
        if (exceptionUrl) protectedUrls.add(exceptionUrl);

        // 3. 보호되지 않은 URL만 해제
        window.activeBlobUrls.forEach(url => {
            if (!protectedUrls.has(url)) {
                URL.revokeObjectURL(url);
                window.activeBlobUrls.delete(url);
                console.log(`[Memory] Blob URL Revoked: ${url}`);
            } else {
                console.log(`[Memory] Blob URL Protected (In use by popup or active): ${url}`);
            }
        });
    }
    // 페이지 종료 시 모든 Blob 해제
    window.addEventListener('beforeunload', () => revokeAllBlobUrls());
    // ===== 메모리 관리 로직 끝 =====

    function getStoredData() {
        console.log("KODAF Judge: Initializing Firebase Data Listener...");
        try {
            // Firebase가 로드될 때까지 약간 대기 (모듈 로딩 순서 대응)
            if (!window.firebaseRef || !window.firebaseDB) {
                console.warn("KODAF Judge: Firebase not ready. Retrying in 500ms...");
                setTimeout(getStoredData, 500);
                return;
            }

            const dbRef = window.firebaseRef(window.firebaseDB);
            const adminDataRef = window.firebaseChild(dbRef, 'adminData');

            // 트래픽 최적화: onValue(실시간) 대신 get(1회성) 사용
            window.firebaseGet(adminDataRef).then((snapshot) => {
                console.log("KODAF Judge: Firebase Initial Data Received. exists:", snapshot.exists());
                if (snapshot.exists()) {
                    currentData = snapshot.val();
                    
                    // Normalize results: convert object to array if needed
                    if (currentData.results && !Array.isArray(currentData.results)) {
                        currentData.results = Object.values(currentData.results);
                    }
                    
                    console.log("KODAF Judge: Data loaded successfully.", currentData);
                } else {
                    console.warn("KODAF Judge: No data found at adminData node!");
                }

                if (!currentData.judges) currentData.judges = [];
                if (!currentData.videos) currentData.videos = [];
                if (!currentData.results) currentData.results = [];

                window.currentData = currentData;
                window.dispatchEvent(new Event('judgeDataLoaded'));
            }).catch(e => {
                console.error("데이터 초기 로딩 실패:", e);
                alert("서버 데이터를 가져오지 못했습니다. 새로고침해 주세요.");
            });
        } catch (e) {
            console.error("Firebase 로딩 에러:", e);
        }
    }

    // 팝업 창 추적을 위한 전역 변수
    window.openedPopups = [];
    window.isPopupFocused = false;
    let openedPopups = window.openedPopups;
    let isPopupFocused = window.isPopupFocused;

    window.addEventListener('message', (e) => {
        if (e.data === 'trusted-popup-focus') {
            window.isPopupFocused = true;
            document.body.classList.remove('secure-blur');
        } else if (e.data === 'trusted-popup-blur') {
            window.isPopupFocused = false;
            // 지연 후에 실제로 어떤 창도 포커스가 없다면 차단
            setTimeout(() => {
                if (!document.hasFocus() && !isPopupFocused) {
                    document.body.classList.add('secure-blur');
                }
            }, 300);
        }
    });

    function popoutDocument(url, isLocal = false) {
        const width = 1100;
        const height = 900;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        // 구글 링크를 직접 여는 대신 보안 뷰어 페이지를 경유
        const secureViewerUrl = `secure-viewer.html?id=${encodeURIComponent(url)}&local=${isLocal}&user=${encodeURIComponent(currentJudge.name)}`;

        const popup = window.open(secureViewerUrl, '_blank', `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes`);

        if (popup) {
            const popupEntry = { win: popup, blobUrl: isLocal ? url : null };
            openedPopups.push(popupEntry);
            // 팝업이 닫힐 때 배열에서 제거
            const timer = setInterval(() => {
                if (popup.closed) {
                    clearInterval(timer);
                    const index = window.openedPopups.indexOf(popupEntry);
                    if (index > -1) window.openedPopups.splice(index, 1);
                }
            }, 1000);
        }
        return popup;
    }

    // 초기화 즉시 실행
    // getStoredData() call removed from here to prevent race condition
    window.currentData = currentData;

    // 배점표 스키마는 judging-schema.js에서 로드 (window.JUDGING_SCHEMA)
    const JUDGING_SCHEMA = window.JUDGING_SCHEMA;

    // UI 초기화 함수 (데이터 형식 유연성 확보)
    function initUI() {
        if (!currentJudge) return;

        // 카테고리 구성 (데이터 로드 완료 여부 체크)
        if (window.currentData) {
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
            // 다른 비디오 로드 시 이전 Blob 메모리 정리 (단, 현재 로컬 객체가 사용 중이면 제외)
            if (videoTag.src.startsWith('blob:') && videoTag.src !== isLocalObj) {
                // URL.revokeObjectURL(videoTag.src); // revokeAllBlobUrls에서 일괄 처리
            }
            if (!isLocalObj) {
                // 로컬 파일이 아닌 드라이브 등을 볼 때, 기존 로컬 파일 Blob들은 모두 정리
                revokeAllBlobUrls();
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
                } else if (type === 'ppt') {
                    // PPT/PPTX: Microsoft Office Online Viewer 사용 (폰트 렌더링 우수, 내장 동영상 지원)
                    const fileUrl = `https://drive.google.com/uc?export=download&id=${cleanId}`;
                    iframeTag.src = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
                } else {
                    // 이미지, PDF, 문서 등 모든 파일은 /preview 형식을 사용합니다.
                    iframeTag.src = `https://drive.google.com/file/d/${cleanId}/preview`;
                }
                iframeTag.onload = () => {
                    console.log("KODAF Security: Iframe loaded, refreshing watermark.");
                    createWatermark();
                };
                // 워터마크(9998)보다 아래에 위치하도록 z-index 조정 (9999 -> 10)
                iframeTag.style.cssText = 'display: block !important; position: absolute; top:0; left:0; width: 100%; height: 100%; border: none; z-index: 10;';
            } else if (isLocalObj) {
                if (type === 'doc' || type === 'image') {
                    iframeTag.src = isLocalObj;
                    iframeTag.onload = () => createWatermark();
                    // 워터마크(9998)보다 아래에 위치하도록 z-index 조정 (9999 -> 10)
                    iframeTag.style.cssText = 'display: block !important; position: absolute; top:0; left:0; width: 100%; height: 100%; border: none; z-index: 10;';
                } else {
                    if (playerControls) playerControls.style.display = 'flex';
                    videoTag.src = isLocalObj;
                    videoTag.onloadeddata = () => createWatermark();
                    videoTag.load();
                    videoTag.style.cssText = 'display: block !important; width: 100%; height: 100%; object-fit: contain;';
                    iframeTag.style.zIndex = '0';
                }
            }
            // 콘텐츠 로드 시작 시점에 한 번 더 생성 (지연 로딩 대비)
            setTimeout(createWatermark, 100);
            setTimeout(createWatermark, 1000);
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
        else {
            playSource(video.id, null, isDocType);
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

    // 워터마크 생성 (Object Pooling 적용: DOM 파괴 방지)
    function createWatermark() {
        console.log("KODAF Security: Updating Watermarks (Pooling)...");
        const container = document.getElementById('watermark');
        if (!container) return;

        // DOM 순서 보장
        const parent = container.parentElement;
        if (parent && parent.lastElementChild !== container) {
            parent.appendChild(container);
        }

        const judgeName = (currentJudge && currentJudge.name) ? currentJudge.name : '심사위원';
        const dateStr = new Date().toLocaleDateString();
        const watermarkText = `${judgeName} | 보안 심사 | ${dateStr}`;

        // 기존 엘리먼트들 가져오기
        let items = container.querySelectorAll('.watermark-item');
        const count = 10;

        const cols = 4;
        const rows = 3;
        const cellWidth = 100 / cols;
        const cellHeight = 100 / rows;

        let positions = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                positions.push({ r, c });
            }
        }
        positions.sort(() => Math.random() - 0.5);

        for (let i = 0; i < count; i++) {
            let item = items[i];
            
            // 엘리먼트가 없으면 생성 (최초 1회만)
            if (!item) {
                item = document.createElement('div');
                item.className = 'watermark-item dynamic-float';
                item.style.position = 'absolute';
                item.style.color = 'rgba(255, 255, 255, 1)';
                item.style.fontSize = '18px';
                item.style.fontWeight = '700';
                item.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.9)';
                item.style.pointerEvents = 'none';
                item.style.whiteSpace = 'nowrap';
                item.style.transform = `rotate(-25deg)`;
                item.style.zIndex = '9999';
                container.appendChild(item);
            }

            // 내용 및 위치만 업데이트
            item.innerText = watermarkText;
            const pos = positions[i];
            const baseLeft = pos.c * cellWidth;
            const baseTop = pos.r * cellHeight;
            const jitterX = Math.random() * (cellWidth * 0.5);
            const jitterY = Math.random() * (cellHeight * 0.5);

            item.style.left = (baseLeft + jitterX) + '%';
            item.style.top = (baseTop + jitterY) + '%';
        }

        // 혹시 10개보다 많으면 제거 (유지보수용 안전장치)
        if (items.length > count) {
            for (let i = count; i < items.length; i++) {
                container.removeChild(items[i]);
            }
        }
    }

    if (window.watermarkInterval) clearInterval(window.watermarkInterval);
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
// initUI 호출 제거 (타이밍 이슈 해결)
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
    createWatermark(); // 데이터 로드 후 워터마크 생성
    const mainCat = document.getElementById('mainCategorySelect').value;
    const subCat = document.getElementById('subCategorySelect').value;
    if (mainCat && subCat) {
        renderFields(mainCat, subCat);
        updateVideoList(mainCat, subCat);
    }
};

window.addEventListener('judgeDataLoaded', onDataLoaded);

// 만약 이미 데이터가 window에 존재한다면(이례적인 케이스) 즉시 실행
if (window.currentData && window.currentData.videos && window.currentData.videos.length > 0) {
    console.log("KODAF Judge: Data already present, triggering UI init.");
    onDataLoaded();
} else {
    console.log("KODAF Judge: Waiting for judgeDataLoaded event...");
}

const submitBtn = document.querySelector('.action-buttons .btn.primary');
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
            total: parseInt(document.getElementById('totalValue').innerText) || 0,
            timestamp: new Date().toISOString()
        };

        // Use a unique key for each result to prevent race conditions (Judge ID + Video ID + Category)
        const resultPathId = `${result.judgeId}_${result.videoId}_${result.mainCat}_${result.subCat}`.replace(/[^a-zA-Z0-9_]/g, '_');
        window.firebaseSet(window.firebaseRef(window.firebaseDB, `adminData/results/${resultPathId}`), result)
            .then(() => { 
                const existingIdx = window.currentData.results.findIndex(
                    r => r.judgeId === result.judgeId && r.videoId === result.videoId && r.mainCat === result.mainCat && r.subCat === result.subCat
                );
                if (existingIdx !== -1) {
                    window.currentData.results[existingIdx] = result;
                } else {
                    window.currentData.results.push(result);
                }
                alert('심사 결과가 저장되었습니다.');
                goToNextUnscored();
            })
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
        try {
            renderMyScores();
            myScoresModal.style.display = 'flex';
        } catch (error) {
            console.error('내 심사 결과 렌더링 중 오류:', error);
            alert('결과를 불러오는 중 오류가 발생했습니다: ' + error.message);
        }
    });

    closeMyScoresBtn.addEventListener('click', () => {
        myScoresModal.style.display = 'none';
    });

    // 외부 클릭 시 닫기
    window.addEventListener('click', (e) => {
        if (e.target === myScoresModal) {
            myScoresModal.style.display = 'none';
        }
    });

    function renderMyScores() {
        const tbody = document.getElementById('myScoresBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!window.currentData) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px;">서버에서 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.</td></tr>`;
            return;
        }

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
            const subCatName = JUDGING_SCHEMA[res.mainCat]?.sub?.[res.subCat]?.name || res.subCat;
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
        const csvUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", csvUrl);
        const dateStr = new Date().toLocaleDateString('ko-KR').replace(/\. /g, '').replace('.', '');
        link.setAttribute("download", `내_심사결과_${currentJudge.name}_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(csvUrl);
    });
} // <--- End of if (myScoresBtn && myScoresModal)

const refreshDataBtn = document.getElementById('refreshDataBtn');
if (refreshDataBtn) {
    refreshDataBtn.addEventListener('click', () => {
        getStoredData();
        alert('데이터를 최신 상태로 갱신했습니다.');
    });
}

// === 다음 미채점 작품 이동 로직 ===

function isVideoScored(videoId, mainCat, subCat) {
    return (window.currentData.results || []).some(
        r => r.judgeId === currentJudge.id && r.videoId === videoId && r.mainCat === mainCat && r.subCat === subCat
    );
}

function getVideoIndicesForSubCat(mainCat, subCat) {
    const videos = window.currentData?.videos || [];
    return videos.reduce((acc, v, idx) => {
        const cats = v.categories || [{ main: v.mainCat, sub: v.subCat }];
        if (cats.some(c => c.main === mainCat && (subCat === 'default' || c.sub === subCat || !c.sub))) {
            acc.push(idx);
        }
        return acc;
    }, []);
}

function findNextUnscoredVideo(mainCat, subCat, startAfterIdx) {
    const startIdx = (startAfterIdx === undefined || startAfterIdx === null) ? -1 : startAfterIdx;
    const indices = getVideoIndicesForSubCat(mainCat, subCat);
    const videos = window.currentData?.videos || [];
    // 현재 작품 이후부터 탐색
    for (const idx of indices) {
        if (idx > startIdx && !isVideoScored(videos[idx]?.id, mainCat, subCat)) {
            return idx;
        }
    }
    // 없으면 처음부터 탐색 (wrap-around)
    for (const idx of indices) {
        if (!isVideoScored(videos[idx]?.id, mainCat, subCat)) {
            return idx;
        }
    }
    return null; // 소부문 전체 완료
}

function resetScoreInputs() {
    document.querySelectorAll('.score-input').forEach(input => { input.value = 0; });
    const totalEl = document.getElementById('totalValue');
    if (totalEl) totalEl.innerText = '0';
}

function goToNextUnscored() {
    const mainCat = document.getElementById('mainCategorySelect').value;
    const subCat = document.getElementById('subCategorySelect').value;
    const currentVideoIndex = parseInt(document.getElementById('videoSelect').value) || 0;

    const nextIdx = findNextUnscoredVideo(mainCat, subCat, currentVideoIndex);
    if (nextIdx !== null) {
        resetScoreInputs();
        document.getElementById('videoSelect').value = nextIdx;
        loadVideo(nextIdx);
    } else {
        showSubCatCompleteModal(mainCat, subCat);
    }
}

function showSubCatCompleteModal(mainCat, subCat) {
    const modal = document.getElementById('subCatCompleteModal');
    if (!modal) return;

    const schema = window.JUDGING_SCHEMA;
    const mainCatName = schema[mainCat]?.name || mainCat;
    const subCatName = schema[mainCat]?.sub?.[subCat]?.name || subCat;

    document.getElementById('subCatCompleteTitle').innerText = `✅ ${mainCatName} > ${subCatName} 심사 완료!`;

    const nextList = document.getElementById('subCatNextList');
    nextList.innerHTML = '';

    let allowed = currentJudge.allowedMainCategories || Object.keys(schema);
    if (allowed && !Array.isArray(allowed)) allowed = Object.values(allowed);

    let foundNext = false;

    // 현재 대분류의 나머지 소분류 먼저 확인
    const currentMainSubs = schema[mainCat]?.sub || {};
    const currentMainSubKeys = Object.keys(currentMainSubs);
    const currentSubIdx = currentMainSubKeys.indexOf(subCat);
    for (let i = currentSubIdx + 1; i < currentMainSubKeys.length; i++) {
        const nextSubKey = currentMainSubKeys[i];
        if (findNextUnscoredVideo(mainCat, nextSubKey) !== null) {
            const label = `${mainCatName} > ${currentMainSubs[nextSubKey].name}`;
            nextList.appendChild(createNextNavBtn(label, mainCat, nextSubKey));
            foundNext = true;
        }
    }

    // 이후 다른 허용된 대분류 확인 (첫 번째 미채점 소분류만 노출)
    for (const mainKey of allowed) {
        if (mainKey === mainCat || !schema[mainKey]) continue;
        const subs = schema[mainKey].sub || {};
        for (const subKey of Object.keys(subs)) {
            if (findNextUnscoredVideo(mainKey, subKey) !== null) {
                const label = `${schema[mainKey].name} > ${subs[subKey].name}`;
                nextList.appendChild(createNextNavBtn(label, mainKey, subKey));
                foundNext = true;
                break; // 대분류당 첫 미채점 소분류만 표시
            }
        }
    }

    if (!foundNext) {
        nextList.innerHTML = '<p style="color: #059669; font-weight: 700; text-align: center; font-size: 1.05rem; padding: 12px 0;">🎉 배정된 모든 부문의 심사가 완료되었습니다!</p>';
    }

    modal.style.display = 'flex';
}

function createNextNavBtn(label, mainCat, subCat) {
    const btn = document.createElement('button');
    btn.style.cssText = 'display: block; width: 100%; margin-bottom: 8px; padding: 12px 16px; font-size: 0.9rem; font-weight: 700; text-align: left; background: #0f172a; color: white; border: none; border-radius: 8px; cursor: pointer;';
    btn.innerText = `→ ${label}`;
    btn.onmouseover = () => { btn.style.background = '#1e3a5f'; };
    btn.onmouseout = () => { btn.style.background = '#0f172a'; };
    btn.onclick = () => {
        document.getElementById('subCatCompleteModal').style.display = 'none';
        navigateToSubCat(mainCat, subCat);
    };
    return btn;
}

function navigateToSubCat(mainCat, subCat) {
    const schema = window.JUDGING_SCHEMA;
    const mainSelect = document.getElementById('mainCategorySelect');
    const subSelect = document.getElementById('subCategorySelect');

    mainSelect.value = mainCat;
    subSelect.innerHTML = '';
    if (schema[mainCat]?.sub) {
        Object.entries(schema[mainCat].sub).forEach(([key, data]) => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.innerText = data.name;
            subSelect.appendChild(opt);
        });
    }
    subSelect.value = subCat;
    renderFields(mainCat, subCat);
    updateVideoList(mainCat, subCat);

    // updateVideoList가 첫 작품을 로드하지만, 첫 미채점 작품으로 override
    setTimeout(() => {
        const nextIdx = findNextUnscoredVideo(mainCat, subCat, -1);
        if (nextIdx !== null) {
            resetScoreInputs();
            document.getElementById('videoSelect').value = nextIdx;
            loadVideo(nextIdx);
        }
    }, 150);
}

const nextUnscoredBtn = document.getElementById('nextUnscoredBtn');
if (nextUnscoredBtn) {
    nextUnscoredBtn.addEventListener('click', goToNextUnscored);
}

const subCatCompleteCloseBtn = document.getElementById('subCatCompleteCloseBtn');
if (subCatCompleteCloseBtn) {
    subCatCompleteCloseBtn.addEventListener('click', () => {
        document.getElementById('subCatCompleteModal').style.display = 'none';
    });
}

// === 다음 미채점 작품 이동 로직 끝 ===

// === 보안 강화 로직 (Pre-emptive Blackout) ===
document.addEventListener('DOMContentLoaded', () => {
    const blackout = document.getElementById('blackout-overlay');
    let isCaptureLocked = false;
    
    const applyBlackout = (reason = '(포커스 이탈 및 화면 캡처 시도 감지)') => {
        if (!blackout) return;
        const reasonEl = blackout.querySelector('.reason-text');
        if (reasonEl) reasonEl.innerText = reason;
        
        blackout.classList.add('active');
        const video = document.getElementById('mainVideo');
        if (video) video.pause(); 
    };
    
    const removeBlackout = () => {
        if (isCaptureLocked) return;
        if (blackout) blackout.classList.remove('active');
    };
    
    const resumeBtn = document.getElementById('resume-btn');
    if (resumeBtn) {
        resumeBtn.addEventListener('click', () => {
            isCaptureLocked = false;
            removeBlackout();
            window.focus();
        });
    }

    document.addEventListener('keydown', (e) => {
        // 단일 Meta 키 차단 제거 (과잉 방어 방지)
        if (e.key === 'PrintScreen' || e.keyCode === 44) { 
            isCaptureLocked = true; 
            applyBlackout('(화면 캡처 시도 감지)'); 
        }
        
        const isF12 = e.key === 'F12';
        const isDevTools = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key.toLowerCase() === 'i' || e.key.toLowerCase() === 'c');
        const isPrint = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p';
        const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's';
        const isMacCapture = e.metaKey && e.shiftKey && (e.key === '4' || e.key === '3' || e.key.toLowerCase() === 's' || e.key.toLowerCase() === 'r');
        const isWinCapture = (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's';
        
        if (isF12 || isDevTools || isPrint || isSave || isMacCapture || isWinCapture) {
            e.preventDefault(); 
            isCaptureLocked = true; 
            applyBlackout(isF12 || isDevTools ? '(개발자 도구 접근 차단)' : '(화면 캡처/저장 시도 감지)'); 
            try { navigator.clipboard.writeText('보안 위반: 클립보드 오염 처리됨'); } catch(err) {}
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
            e.preventDefault();
            isCaptureLocked = true;
            applyBlackout('(복사 시도 차단)');
            try { navigator.clipboard.writeText('보안 위반: 복사 차단'); } catch(err) {}
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'PrintScreen' || e.key === 'Meta' || e.keyCode === 44) { 
            isCaptureLocked = true; 
            applyBlackout('(화면 캡처 시도 감지)'); 
            try { navigator.clipboard.writeText('보안 위반: 클립보드 오염 처리됨'); } catch(err) {}
        }
    });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) { 
            isCaptureLocked = true; 
            applyBlackout('(화면 숨김/전환 감지)'); 
        } else { 
            removeBlackout(); 
        }
    });

    window.addEventListener('blur', () => { 
        // 다이얼로그(alert/confirm 등) 예외 처리
        if (window._isDialogOpen) return;
        
        // 클릭된 요소가 문서 뷰어(iframe)인 경우 예외 처리
        if (document.activeElement && document.activeElement.id === 'documentViewer') return;
        
        // 팝업창(secure-viewer) 포커스 예외 처리
        const _openedPopups = window.openedPopups || [];
        const _isPopupFocused = window.isPopupFocused || false;
        if (_isPopupFocused) return;
        
        const isFocusOnPopupByDoc = _openedPopups.some(p => {
            try { return p.win && !p.win.closed && p.win.document.hasFocus(); } catch (e) { return false; }
        });
        if (isFocusOnPopupByDoc) return;

        isCaptureLocked = true; 
        applyBlackout('(포커스 이탈 감지)'); 
    });

    window.addEventListener('focus', () => {
        window.isPopupFocused = false;
        removeBlackout();
    });

    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('dragstart', e => e.preventDefault());
    
    // 마우스 이탈 선제 차단 (예외 처리 포함)
    document.addEventListener('mouseleave', () => {
        if (window._isDialogOpen) return;
        const _openedPopups = window.openedPopups || [];
        if (_openedPopups.some(p => p.win && !p.win.closed)) return;
        
        // mouseleave 시 즉시 블랙아웃 걸지 않고 화면만 가림. 클릭 방어 (복귀 버튼 없이)
        if (blackout && !isCaptureLocked) {
           blackout.classList.add('active');
        }
    });
    
    document.addEventListener('mouseenter', () => {
        if (!isCaptureLocked) {
            removeBlackout();
        }
    });

    // [성능 최적화] 리사이즈 디바운싱: 창 크기 조절 시 자원 소모 최소화
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            createWatermark();
        }, 200);
    });
});

console.log("KODAF 2026 High-Security Engine (Pre-emptive) Initialized.");

// Kick off data loading last to avoid race conditions
getStoredData();
