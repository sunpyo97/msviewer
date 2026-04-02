// KODAF 2026 - 심사 배점 스키마 (공유 모듈)
// 이 파일을 수정하면 모든 페이지(심사/관리자)에 동시 반영됩니다.
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
