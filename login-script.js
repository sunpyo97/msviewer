document.getElementById('loginBtn').addEventListener('click', async () => {
    const id = document.getElementById('judgeId').value;
    const pw = document.getElementById('judgePw').value;
    const errorMsg = document.getElementById('errorMsg');
    const btn = document.getElementById('loginBtn');

    if (!id || !pw) {
        errorMsg.innerText = '아이디와 비밀번호를 모두 입력해주세요.';
        errorMsg.style.display = 'block';
        return;
    }

    btn.innerText = '인증 중...';
    btn.disabled = true;

    try {
        const dbRef = window.firebaseRef(window.firebaseDB);
        const judgesRef = window.firebaseChild(dbRef, 'adminData/judges');
        const snapshot = await window.firebaseGet(judgesRef);

        const normalizedId = id.trim();

        if (snapshot.exists()) {
            const judgesData = snapshot.val();
            const judgesList = Array.isArray(judgesData) ? judgesData : Object.values(judgesData);

            // ID와 PW 모두 일치하는 심사위원 검색
            const judge = judgesList.find(j =>
                j && (j.id === normalizedId || j.ID === normalizedId) && j.password === pw
            );

            if (judge) {
                proceedLogin(judge);
                return;
            }
        }

        // 단일 계정 백업 체크 (adminData 최상위에 있을 경우)
        const rootSnapshot = await window.firebaseGet(window.firebaseChild(dbRef, 'adminData'));
        if (rootSnapshot.exists()) {
            const adminData = rootSnapshot.val();
            if ((adminData.judgeId === normalizedId || adminData.judgeID === normalizedId) && adminData.password === pw) {
                proceedLogin({
                    id: adminData.judgeId || adminData.judgeID,
                    name: adminData.judgeName || "심사위원",
                    allowedMainCategories: adminData.allowedMainCategories || []
                });
                return;
            }
        }

        errorMsg.innerText = 'ID 또는 패스워드가 올바르지 않습니다.';
        errorMsg.style.display = 'block';

    } catch (e) {
        console.error("로그인 연동 실패", e);
        errorMsg.innerText = '서버 통신에 실패했습니다.';
        errorMsg.style.display = 'block';
    } finally {
        btn.innerText = '로그인';
        btn.disabled = false;
    }
});

function proceedLogin(judge) {
    sessionStorage.setItem('JUDGE_SESSION', JSON.stringify({
        id: judge.id || judge.ID,
        name: judge.name || judge.Name || "심사위원",
        allowedMainCategories: judge.allowedMainCategories || []
    }));
    window.location.href = 'judging.html';
}

// Enter 키 로그인 지원
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('loginBtn').click();
    }
});
