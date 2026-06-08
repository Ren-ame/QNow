-- 2026-06-08: 사용자 신규 장소 등록 테이블
-- 카카오 API 미등록 장소(팝업스토어, 임시매장 등) 직접 등록 지원

CREATE TABLE IF NOT EXISTS custom_places (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT '기타',
  address     TEXT,
  lat         FLOAT8      NOT NULL,
  lng         FLOAT8      NOT NULL,
  description TEXT,
  is_active   BOOLEAN     DEFAULT TRUE NOT NULL
);

-- 위치 기반 쿼리 인덱스
CREATE INDEX IF NOT EXISTS custom_places_location_idx
  ON custom_places (lat, lng)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS custom_places_user_idx
  ON custom_places (user_id);

-- RLS 활성화
ALTER TABLE custom_places ENABLE ROW LEVEL SECURITY;

-- 누구나 활성 장소 조회 가능
CREATE POLICY "custom_places_select"
  ON custom_places FOR SELECT
  USING (is_active = TRUE);

-- 로그인 유저만 등록 가능
CREATE POLICY "custom_places_insert"
  ON custom_places FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 본인 등록 장소만 수정/삭제 가능
CREATE POLICY "custom_places_update"
  ON custom_places FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "custom_places_delete"
  ON custom_places FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
