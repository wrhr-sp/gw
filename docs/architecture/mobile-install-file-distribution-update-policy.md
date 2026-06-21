# 모바일 설치파일 배포 및 강제 업데이트 정책 참고안

## 한 줄 요약

그룹웨어 모바일 앱을 스토어 중심이 아니라 사이트 내 설치파일/설치 안내 방식으로 배포할 경우, 업데이트 정책은 **Android/iOS 대상과 무관하게 선택 업데이트 없이 무조건 강제 업데이트**로 둔다.

이 문서는 아직 구현 범위가 아니라, 향후 모바일 설치파일 배포 Phase에서 참고할 정책 메모다.

## 현재 결정 상태

- 아직 설치파일 배포 단계는 아니다.
- 현재 그룹웨어의 1차 모바일 기준은 웹/PWA와 반응형 UI다.
- 향후 설치파일 배포를 진행할 경우 Android/iOS 모두 앱 래퍼를 고려한다.
- 추천 래퍼 후보는 Capacitor 기반 웹뷰 앱이다.
- Android는 APK 직접 다운로드 배포를 고려할 수 있다.
- iOS는 Android처럼 `.ipa`를 단순 다운로드 설치하는 방식이 일반 운영에 적합하지 않으므로 TestFlight, Apple Business/MDM, Ad Hoc, Enterprise 중 별도 선택이 필요하다.
- 앱 업데이트 정책은 선택/권장 업데이트 없이 **최신 버전이 아니면 사용 불가**로 둔다.

## 강제 업데이트 원칙

앱 실행 시 현재 앱 버전과 서버의 최신 버전을 비교한다.

- 현재 앱 버전이 최신 버전보다 낮으면 업무 화면 진입을 차단한다.
- `나중에`, `닫기`, `건너뛰기` 버튼은 제공하지 않는다.
- 업데이트 전에는 로그인, 메뉴, 결재, 근태, 휴가, 게시판, 관리자 화면 등 모든 업무 기능에 접근할 수 없어야 한다.
- 사용자는 `업데이트하기` 버튼만 눌러 OS별 업데이트 경로로 이동한다.

사용자 문구 기준:

```text
업데이트가 필요합니다

현재 버전은 더 이상 사용할 수 없습니다.
업데이트 후 이용해주세요.

[업데이트하기]
```

## OS별 업데이트 경로

### Android

Android는 사이트 내 설치 페이지나 최신 APK 링크로 보낸다.

예시:

- `/install/android`
- `/downloads/groupware-android-{version}.apk`

운영 조건:

- 기존 앱 위에 업데이트하려면 앱 ID가 동일해야 한다.
- 기존 앱 위에 업데이트하려면 동일한 Android 서명키로 빌드해야 한다.
- 새 APK의 `versionCode`는 반드시 이전보다 커야 한다.
- 사용자는 단말에서 알 수 없는 앱 설치 허용이 필요할 수 있다.
- 설치 페이지에는 최신 버전, 변경사항, 파일 크기, 체크섬을 표시한다.

### iOS

iOS는 배포 채널별 설치/업데이트 안내 URL로 보낸다.

가능 후보:

- TestFlight
- Apple Business Manager + MDM
- Ad Hoc
- Enterprise 배포

운영 조건:

- 단순 `.ipa` 다운로드 방식은 Android APK처럼 쉽게 운영할 수 없다.
- Apple Developer 계정, 인증서, provisioning profile, 기기 등록 또는 MDM 정책이 필요할 수 있다.
- 인증서와 provisioning profile 만료 시 재설치/갱신 이슈가 생길 수 있다.
- iOS 업데이트 버튼은 실제 파일 직접 다운로드보다 `/install/ios` 안내 페이지 또는 TestFlight/MDM 링크로 연결하는 편이 안전하다.

## 버전 정책 파일 예시

향후 구현 시 앱은 서버의 버전 정책을 확인한다.

예시 경로:

- `/app-version.json`

예시 내용:

```json
{
  "android": {
    "latest": "1.0.3",
    "forceUpdate": true,
    "updateUrl": "/install/android",
    "downloadUrl": "/downloads/groupware-android-1.0.3.apk",
    "sha256": "<checksum>",
    "releaseNotes": [
      "보안 업데이트",
      "업무 화면 안정성 개선"
    ]
  },
  "ios": {
    "latest": "1.0.3",
    "forceUpdate": true,
    "updateUrl": "/install/ios",
    "releaseNotes": [
      "보안 업데이트",
      "업무 화면 안정성 개선"
    ]
  }
}
```

판정 기준:

```text
현재 앱 버전 < latest
→ 강제 업데이트 화면 표시

현재 앱 버전 = latest
→ 정상 진입
```

## 앱 전역 가드 기준

향후 구현 시 앱 시작 시점에 전역 업데이트 가드를 둔다.

1. 앱 래퍼에서 현재 앱 버전을 읽는다.
2. `/app-version.json` 또는 같은 역할의 API를 호출한다.
3. OS에 맞는 최신 버전 정보를 선택한다.
4. 현재 버전이 최신 버전보다 낮으면 강제 업데이트 화면만 렌더링한다.
5. 최신 버전이면 기존 로그인/세션/권한 흐름으로 진입한다.

네트워크 오류 기준:

- 버전 확인 실패 시에는 보수적으로 업무 화면을 열지 않는다.
- 안내 문구는 “업데이트 확인 중 문제가 발생했습니다. 네트워크 확인 후 다시 시도해주세요.”로 둔다.
- 재시도 버튼은 허용하되, 업무 화면 우회 버튼은 제공하지 않는다.

## 웹 배포와 설치파일 업데이트의 역할 분리

Capacitor 같은 웹뷰 래퍼를 쓰면 대부분의 업무 화면은 웹 배포로 갱신할 수 있다.

웹 배포만으로 반영 가능한 영역:

- 화면 문구
- 메뉴와 정보구조
- 결재/근태/휴가/게시판 등 업무 화면
- 권한 UI
- 하단탭/사이드바 등 일반 UI

설치파일 업데이트가 필요한 영역:

- 앱 아이콘/앱 이름
- 앱 ID/package/bundle 설정
- Android/iOS 권한
- WebView 설정
- 푸시, 생체인증, 파일 처리, 카메라, NFC 등 네이티브 기능
- 딥링크/앱링크
- 서명/인증서 관련 변경

따라서 운영 전략은 다음과 같다.

- 일반 업무 개선은 웹 배포로 빠르게 반영한다.
- 앱 래퍼 또는 네이티브 설정이 바뀔 때만 새 설치파일을 배포한다.
- 새 설치파일이 배포되면 기존 앱은 무조건 강제 업데이트한다.

## 설치 페이지 기준

향후 `/install` 또는 `/download` 페이지를 만들 때 포함할 항목:

- Android 설치 버튼
- iOS 설치/업데이트 안내 버튼
- 최신 버전
- 배포일
- 변경사항
- 파일 크기
- Android APK 체크섬
- 설치 전 주의사항
- 업데이트가 안 될 때 조치 방법

## 승인 게이트

아래 항목은 별도 승인 없이 진행하지 않는다.

- Android 서명키 생성/교체/보관 방식 확정
- iOS 인증서, provisioning profile, Apple Developer/Business/Enterprise/MDM 설정
- 유료 Apple/MDM 리소스 사용
- 앱 파일 외부 공개 범위 확대
- production DB 실데이터/migration/seed
- secret 입력/교체
- DNS/custom domain
- destructive/force 작업

## 후속 Phase 후보

설치파일 배포를 실제로 시작할 때는 별도 Phase로 분리한다.

1. Android/iOS 내부 배포 정책 확정
2. Capacitor 앱 래퍼 구조 설계
3. Android APK 빌드/서명/다운로드 경로 구성
4. iOS 배포 채널 선택 및 설치 안내 설계
5. `/install` 페이지 구현
6. `/app-version.json` 또는 버전 API 구현
7. 강제 업데이트 전역 가드 구현
8. 설치/업데이트 문서화
9. PR/CI/배포/live smoke 검증
