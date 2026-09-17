# 선행 특허 "원문 보기" 링크가 KIPRIS 직접 딥링크가 아니라 구글 검색으로 대체됨

**Symptom**: 분석 결과 화면의 선행 특허 카드에서 "KIPRIS 원문 보기"를 눌러도 KIPRIS의
해당 출원/공개 건 페이지로 바로 가지 않고, `공개번호 KIPRIS`로 구글 검색한 결과 페이지로
이동한다.

**Observed evidence**: `lib/kipris/client.ts`의 `sourceUrlFor()`가
`https://www.google.com/search?q=<번호> KIPRIS` 형태의 URL을 반환한다. KIPRIS Plus
API(`getWordSearch`, `getBibliographyDetailInfoSearch`)의 실제 응답(2026-09-17,
KIPRIS_SERVICE_KEY로 직접 호출해 확인)에는 사람이 볼 수 있는 공개 웹페이지 링크 필드가
없었고, `bigDrawing`/`drawing` 필드는 도면 이미지 파일 링크일 뿐 원문 페이지가 아니다.
공개 검색 사이트(kipris.or.kr)의 번호 기반 딥링크 URL 패턴은 WebFetch로는 확인할 수
없었다(자바스크립트 기반 검색 UI로 보임).

**Suspected cause**: KIPRIS Plus Open API 통합설명서(PDF, plus.kipris.or.kr에서
로그인 후 열람)에 공개 웹뷰어 URL 패턴이 별도로 문서화되어 있을 가능성이 높지만,
이번 세션에서는 그 문서에 접근하지 못했다.

**What was tried**: 구글 검색으로 우회해 "원문을 확인할 수 있는 경로가 있다"는 spec의
수용 기준 8번은 만족시켰다. 항상 도달 가능하고 실패하지 않는다는 장점은 있지만, KIPRIS가
아닌 검색 엔진을 거치므로 한 번의 클릭으로 정확한 페이지에 도달한다는 보장은 없다.

**Proposed next step**: KIPRIS Plus API 통합설명서(https://plus.kipris.or.kr 로그인 후
다운로드) 또는 고객센터(02-6915-1553)를 통해 출원번호/공개번호 기반 공개 뷰어 URL
패턴을 확인한 뒤, `lib/kipris/client.ts`의 `sourceUrlFor()`를 그 패턴으로 교체한다.
