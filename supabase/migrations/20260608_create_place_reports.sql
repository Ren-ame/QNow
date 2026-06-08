-- 2026-06-08: 장소 신고 테이블
-- 커스텀 등록 장소에 대한 신고 접수 및 어드민 검토용

CREATE TABLE IF NOT EXISTS place_reports (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  place_id    TEXT        NOT NULL,
  place_name  TEXT        NOT NULL,
  reason      TEXT        NOT NULL,
  detail      TEXT,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  status      TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS place_reports_place_idx ON place_reports (place_id);
CREATE INDEX IF NOT EXISTS place_reports_status_idx ON place_reports (status);

ALTER TABLE place_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "place_reports_insert"
  ON place_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "place_reports_select_own"
  ON place_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
