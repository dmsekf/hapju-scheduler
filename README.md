# 합주 스케줄러

엑셀 명단(곡 · 세션 · 이름)과 멤버 불가능 시간을 맞춰 **합주 가능한 곡과 시간**을 찾습니다.

배포는 **Netlify**를 씁니다. Google Apps Script는 쓰지 않습니다.

## 로컬에서 열어 보기

- 멤버: `index.html` 또는 `열기.bat`
- 관리자: `admin.html` 또는 `열기-관리자.bat` (비밀번호 `1234`)

파일을 그냥 열면 이 기기에만 저장됩니다. 밴드 전체가 같은 데이터를 쓰려면 Netlify에 올려야 합니다.

## Netlify 배포

폴더만 드래그해서 올리면 **저장 서버가 빠질 수 있습니다.** Git으로 연결하는 쪽을 권장합니다.

1. [GitHub](https://github.com)에 `hapju-scheduler` 폴더를 새 저장소로 올립니다.
2. [Netlify](https://app.netlify.com)에 로그인한 뒤 **Add new site → Import an existing project**.
3. 방금 만든 GitHub 저장소를 고릅니다.
4. 설정은 그대로 두고 Deploy 합니다. (`netlify.toml`이 함수를 연결합니다.)
5. 나온 주소가 앱 주소입니다.
   - 멤버: `https://사이트이름.netlify.app`
   - 관리자: `https://사이트이름.netlify.app/admin`

처음에는 명단이 비어 있습니다. 관리자로 들어가 엑셀(곡명 / 세션 / 이름)을 올린 뒤 멤버에게 주소를 공유하면 됩니다.

관리자 비밀번호 기본값은 `1234`입니다. `js/config.js`의 `adminPin`을 바꾼 뒤 다시 배포하세요.
