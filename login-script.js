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
        const snapshot = await window.firebaseGet(window.firebaseChild(dbRef, 'adminData'));

        if (snapshot.exists()) {
            const adminData = snapshot.val();

            // 1. 단일 계정 (하위 호환)
            if (adminData.judgeId === id && adminData.password === pw) {
                proceedLogin({
                    id: adminData.judgeId,
                    name: adminData.judgeName || "심사위원",
                    allowedMainCategories: adminData.allowedMainCategories || []
                });
                return;
            }

            // 2. 다중 계정 목록 확인
            if (adminData.judges && Array.isArray(adminData.judges)) {
                const judge = adminData.judges.find(j => j.id === id && j.password === pw);
                if (judge) {
                    proceedLogin(judge);
                    return;
                }
            }
        }

        // 3. Fallback (초기 테스트용 데모 계정)
        if (id === 'judge_01' && pw === 'password123') {
            proceedLogin({
                id: "judge_01",
                name: "김광고",
                allowedMainCategories: ["integrated_marketing", "marketing_campaign", "performance", "digital_creative", "ai_creative"]
            });
            return;
        }

        // 권한 없음
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
        id: judge.id,
        name: judge.name,
        allowedMainCategories: judge.allowedMainCategories
    }));
    window.location.href = 'judging.html';
}

// Enter 키 로그인 지원
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('loginBtn').click();
    }
});
