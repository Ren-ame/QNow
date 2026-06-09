import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  {
    // v0 생성 코드베이스 baseline — 의도적 패턴과 충돌하는 규칙은 off,
    // 권고성 규칙은 warn으로 낮춰 lint 통과시키되 정보는 노출
    rules: {
      "@typescript-eslint/no-explicit-any": "off",       // API 데이터 매핑에 의도적 any 다수
      "@typescript-eslint/no-namespace": "off",          // Kakao SDK 앰비언트 타이핑에 필요
      "@next/next/no-img-element": "off",                // images.unoptimized로 <img> 의도적 사용
      "@typescript-eslint/no-unused-vars": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/static-components": "warn",
    },
  },
]

export default eslintConfig
