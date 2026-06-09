-- 2026-06-09: 대기정보 포인트 적립을 원자적으로 처리하는 RPC
-- 기존: 라우트에서 조회 후 insert (check-then-act) → 동시 요청 시 중복 적립 race
-- 변경: 유저 단위 advisory lock으로 직렬화하여 중복(같은 장소 24h)·일일 상한을 원자적 판정
-- 포인트가 현금성(상품 교환)으로 전환되므로 무결성 보장 필요

CREATE OR REPLACE FUNCTION award_wait_time_point(
  p_user_id    UUID,
  p_place_id   TEXT,
  p_place_name TEXT,
  p_daily_limit INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
-- SECURITY INVOKER: service_role(서버)로만 호출하고 service_role은 이미 풀 액세스라
-- DEFINER 권한 상승이 불필요 → DEFINER hardening 표면을 원천 제거
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_already_count INTEGER;
  v_daily_count   INTEGER;
BEGIN
  -- 같은 유저의 동시 적립 요청을 트랜잭션 단위로 직렬화
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- 최근 24시간 적립 내역 기준 중복(같은 장소)·일일 횟수 판정
  SELECT
    count(*) FILTER (WHERE reference_id = p_place_id),
    count(*)
  INTO v_already_count, v_daily_count
  FROM point_transactions
  WHERE user_id = p_user_id
    AND type = 'earn'
    AND created_at >= now() - interval '24 hours';

  IF v_already_count > 0 OR v_daily_count >= p_daily_limit THEN
    RETURN FALSE;
  END IF;

  INSERT INTO point_transactions (user_id, type, amount, description, reference_id)
  VALUES (
    p_user_id,
    'earn',
    10,
    '대기 정보 등록 - ' || coalesce(p_place_name, p_place_id),
    p_place_id
  );

  RETURN TRUE;
END;
$$;

-- 서버(service_role)만 호출 가능 — 일반 유저가 RPC 직접 호출로 자가 지급하는 것 차단
REVOKE ALL ON FUNCTION award_wait_time_point(UUID, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION award_wait_time_point(UUID, TEXT, TEXT, INTEGER) TO service_role;
