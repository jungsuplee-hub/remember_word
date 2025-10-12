(function () {
  const GUIDE_CONTENT = {
    manage: {
      title: '단어 관리 빠른 시작',
      description:
        '폴더와 그룹을 만들어 단어를 정리하고 별점으로 학습 진도를 관리할 수 있는 기본 화면입니다.',
      sections: [
        {
          heading: '폴더 · 그룹 둘러보기',
          description:
            '왼쪽 패널에서 폴더를 선택하면 해당 폴더의 그룹이 가운데 영역에 표시됩니다.',
          items: [
            '새 폴더 만들기를 눌러 과목이나 언어별로 폴더를 추가하세요.',
            '폴더를 고르면 그룹 패널이 활성화되고, 그룹을 선택해야 단어 목록이 열립니다.',
            '그룹 만들기를 이용해 날짜 · 단원 등 학습 단위를 구분해보세요.'
          ],
          note: '폴더는 큰 범주, 그룹은 학습 세트라고 생각하면 한눈에 정리가 됩니다.'
        },
        {
          heading: '단어 추가와 편집',
          description:
            '오른쪽 패널에서 현재 선택한 그룹에 속한 단어를 관리할 수 있습니다.',
          items: [
            '단어 추가 폼에서 단어, 뜻, 별점을 입력하고 필요하다면 메모를 남깁니다.',
            '단어 행의 \"편집\" 버튼으로 내용을 수정하고, \"삭제\"로 불필요한 항목을 정리하세요.',
            '별점은 암기 난이도나 우선순위를 표시하는 용도로 활용하면 좋습니다.'
          ]
        },
        {
          heading: '필터와 정렬 활용',
          items: [
            '최소 별점 필터를 이용해 복습이 필요한 단어만 추려볼 수 있습니다.',
            '단어 목록 상단의 새로고침 버튼으로 서버의 최신 상태를 다시 받아올 수 있습니다.',
            '단어를 많이 추가했다면 브라우저 검색(Ctrl+F)으로 빠르게 찾을 수도 있습니다.'
          ],
          note: '엑셀 업로드, 단어 암기, 시험 보기 등 다른 화면은 상단 메뉴에서 바로 이동할 수 있습니다.'
        }
      ]
    },
    memorize: {
      title: '단어 암기 화면 가이드',
      description:
        '선택한 폴더와 그룹의 단어를 카드 형태로 보면서 단어와 뜻을 번갈아 가리거나 확인할 수 있습니다.',
      sections: [
        {
          heading: '폴더와 그룹 선택',
          items: [
            '상단 드롭다운에서 폴더를 고르면 연결된 그룹 목록이 자동으로 채워집니다.',
            '암기할 그룹을 선택하면 아래 표에 단어가 순서대로 나타납니다.',
            '여러 그룹을 차례로 복습하고 싶다면 선택을 바꿔가며 새로고침하세요.'
          ],
          note: '폴더나 그룹을 바꾸면 번호 범위와 토글 상태가 초기화됩니다.'
        },
        {
          heading: '보기 옵션 조절',
          items: [
            '단어 가리기 · 뜻 가리기 버튼으로 원하는 면만 숨겼다가 확인할 수 있습니다.',
            '번호 범위 입력 후 \"설정\"을 누르면 해당 구간의 단어만 보여집니다.',
            '발음 언어를 선택하면 TTS 버튼을 눌렀을 때 지정한 언어로 읽어줍니다.'
          ]
        },
        {
          heading: '학습 팁',
          items: [
            '별점이 낮은 단어부터 집중해서 보고 싶다면 관리 화면에서 별점을 조정해두세요.',
            '표 상단의 순서를 유지하면서 스크롤하면 자연스럽게 전체 단어를 복습할 수 있습니다.',
            '암기 중 모르는 단어는 별점이나 메모를 수정해 시험 준비에 반영하세요.'
          ]
        }
      ]
    },
    exam: {
      title: '시험 설정 도우미',
      description:
        '단어 암기 상태를 점검할 맞춤 시험을 만들고 최근 결과를 확인하는 화면입니다.',
      sections: [
        {
          heading: '시험 구성하기',
          items: [
            '폴더와 출제 수, 문제 방향(단어→뜻 / 뜻→단어)을 지정해 시험 형태를 결정합니다.',
            '최소 별점을 설정하면 복습이 필요한 단어만 출제할 수 있습니다.',
            '순서 섞기 옵션을 통해 매번 다른 순서로 문제를 받아보세요.'
          ],
          note: '출제 수를 비워두면 선택한 그룹의 단어가 모두 시험에 포함됩니다.'
        },
        {
          heading: '그룹 선택과 번호 범위',
          items: [
            '같은 폴더 안에서 여러 그룹을 동시에 선택할 수 있습니다.',
            '그룹 선택 후 번호 범위를 지정하면 특정 구간만 출제할 수 있습니다.',
            '선택 전체 · 해제 버튼으로 빠르게 조합을 바꿀 수 있습니다.'
          ]
        },
        {
          heading: '시험 이력 확인',
          items: [
            '오른쪽 패널에서 최근 시험 결과와 점수를 한눈에 확인합니다.',
            '각 기록을 눌러 세부 정보를 확인하거나 다시 시험을 시작할 수 있습니다.',
            '새로고침 버튼으로 최신 데이터를 불러옵니다.'
          ]
        }
      ]
    },
    'exam-session': {
      title: '시험 진행 화면 안내',
      description:
        '시험을 시작하면 문제 풀이 진행 상황과 결과 요약을 이 화면에서 확인합니다.',
      sections: [
        {
          heading: '문제 풀이하기',
          items: [
            '상단 진행률을 참고해 현재 문제 수를 확인하세요.',
            '\"정답 미리보기\"로 즉시 답을 확인하거나, 다 풀고 요약에서 다시 볼 수 있습니다.',
            '암기 완료를 누르면 정답으로 처리되고, 다시암기는 오답으로 기록됩니다.'
          ]
        },
        {
          heading: '시험 제어 버튼',
          items: [
            '\"시험 그만보기\" 버튼으로 언제든 시험을 종료하고 설정 화면으로 돌아갈 수 있습니다.',
            '모든 문제를 풀면 결과 요약이 열리고, 틀린 문제만 다시 풀 수 있는 버튼이 제공됩니다.',
            '오른쪽 상단 메뉴에서 다른 화면으로 이동할 수 있지만 진행 중 시험은 초기화됩니다.'
          ]
        }
      ],
      footer: '시험이 끝난 뒤에는 시험 설정 화면의 이력 패널에서 상세 결과를 다시 확인할 수 있습니다.'
    },
    import: {
      title: '엑셀 업로드 안내',
      description:
        '준비한 스프레드시트 파일을 업로드해 폴더, 그룹, 단어를 한 번에 등록할 수 있습니다.',
      sections: [
        {
          heading: '파일 준비하기',
          items: [
            '필수 열은 폴더, 그룹, 단어, 뜻 네 가지입니다.',
            '선택 열(언어, 별점, 메모 등)이 있으면 자동으로 함께 저장됩니다.',
            '샘플 이미지를 눌러 확대해 열 이름과 데이터를 확인하세요.'
          ]
        },
        {
          heading: '업로드 절차',
          items: [
            '파일 선택 버튼으로 .xlsx, .xls, .csv 파일을 불러옵니다.',
            '기본 언어를 입력하면 새로 생성되는 폴더의 언어 정보로 저장됩니다.',
            '업로드를 누르면 누락된 데이터는 건너뛰고, 중복 단어는 최신 정보로 갱신됩니다.'
          ],
          note: '업로드가 끝나면 단어 관리 화면으로 이동해 추가된 내용이 맞는지 확인하세요.'
        }
      ]
    },
    market: {
      title: '단어 마켓 사용법',
      description:
        '관리자가 공유한 단어장을 골라 내 계정으로 복사해오는 화면입니다.',
      sections: [
        {
          heading: '언어 선택',
          items: [
            '먼저 기본 언어를 선택하면 해당 언어의 공유 폴더가 표시됩니다.',
            '언어를 바꾸면 폴더와 그룹 목록이 새로 고쳐집니다.',
            '새로고침 버튼으로 최신 공유 목록을 다시 불러올 수 있습니다.'
          ]
        },
        {
          heading: '폴더 · 그룹 고르기',
          items: [
            '공유 폴더를 클릭하면 안의 그룹이 오른쪽에 펼쳐집니다.',
            '가져오고 싶은 그룹을 여러 개 선택해도 한 번에 추가할 수 있습니다.',
            '모두 선택 · 모두 해제 버튼으로 빠르게 선택 상태를 바꿔보세요.'
          ]
        },
        {
          heading: '가져오기 실행',
          items: [
            '선택한 그룹 가져오기 버튼을 누르면 내 계정에 동일한 폴더/그룹과 단어가 생성됩니다.',
            '가져온 단어는 단어 관리 화면에서 즉시 확인하고 편집할 수 있습니다.'
          ]
        }
      ]
    },
    register: {
      title: '회원가입 도움말',
      description:
        'Remember Word 계정을 만들고 간편 가입 옵션을 활용하는 방법을 안내해드려요.',
      sections: [
        {
          heading: '기본 정보 입력',
          items: [
            '아이디, 이름, 비밀번호는 필수 입력 항목입니다. 빠짐없이 작성해주세요.',
            '비밀번호는 6자 이상이어야 하며, 아래 확인 입력란과 동일해야 제출됩니다.',
            '선택 입력인 이메일을 등록하면 비밀번호 찾기 안내를 받을 수 있습니다.'
          ],
          note: '입력한 내용은 서버로 전송되기 전까지 브라우저에만 저장됩니다.'
        },
        {
          heading: '간편 가입 버튼 활용',
          items: [
            '하단의 Google · Kakao · Naver 버튼을 누르면 해당 서비스 로그인 화면으로 이동합니다.',
            '이미 같은 이메일로 계정을 사용 중이라면 자동으로 연결되어 중복 가입을 막아줍니다.',
            '소셜 로그인 진행 중 다른 창이 열리면 브라우저 팝업 차단 설정을 확인해주세요.'
          ]
        },
        {
          heading: '가입 완료 후 다음 단계',
          items: [
            '회원가입이 성공하면 안내 메시지와 함께 자동으로 다음 화면으로 이동합니다.',
            '바로 단어 관리 화면이 열리므로 폴더를 만들고 단어를 추가해보세요.',
            '상단 메뉴에서 오늘의 학습, 암기, 시험 등 다른 학습 도구로 이동할 수 있습니다.'
          ],
          note: '가입 직후 자동 이동이 되지 않으면 잠시 후 직접 단어 관리 메뉴로 이동해주세요.'
        }
      ]
    },
    account: {
      title: '계정 관리 가이드',
      description: '현재 로그인한 계정 정보를 확인하고 비밀번호를 변경할 수 있는 화면입니다.',
      sections: [
        {
          heading: '계정 정보 확인',
          items: [
            '상단 패널에서 이름, 아이디, 이메일, 로그인 기록을 확인합니다.',
            '데이터가 보이지 않으면 새로고침 후 다시 접속하거나 관리자에게 문의하세요.'
          ]
        },
        {
          heading: '비밀번호 변경',
          items: [
            '현재 비밀번호를 확인한 뒤 새 비밀번호와 확인 입력란을 채웁니다.',
            '6자 이상으로 안전한 비밀번호를 설정하고, 자주 쓰는 비밀번호는 피하세요.',
            '변경 후에는 다시 로그인 화면으로 이동하지 않아도 즉시 반영됩니다.'
          ],
          note: '사회적 계정(Google, Kakao 등)으로 로그인했다면 해당 서비스에서 비밀번호를 관리합니다.'
        }
      ]
    },
    admin: {
      title: '관리자 대시보드 안내',
      description: '서비스 전체 이용 현황을 살펴보고 계정과 활동 데이터를 점검하는 화면입니다.',
      sections: [
        {
          heading: '데이터 새로고침',
          items: [
            '상단 새로고침 버튼을 눌러 최신 통계를 불러옵니다.',
            '표는 사용자별로 폴더, 그룹, 단어 수와 시험 이력, 로그인 정보를 보여줍니다.'
          ]
        },
        {
          heading: '모니터링 포인트',
          items: [
            '로그인 횟수와 마지막 로그인 시간을 확인해 비정상적인 사용 패턴을 찾을 수 있습니다.',
            '시험 이력 수를 통해 학습 활동이 활발한 사용자를 파악하세요.',
            '필요하다면 개별 계정을 선택해 상세 정보를 추적하고 지원합니다.'
          ],
          note: '관리자 기능은 중요한 데이터에 접근하므로 사용 후에는 반드시 로그아웃하세요.'
        }
      ]
    }
  };

  const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input[type="text"]:not([disabled])',
    'input[type="radio"]:not([disabled])',
    'input[type="checkbox"]:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  const createParagraph = (text, className) => {
    const p = document.createElement('p');
    p.textContent = text;
    if (className) {
      p.className = className;
    }
    return p;
  };

  document.addEventListener('DOMContentLoaded', () => {
    const pageKey = document.body?.dataset?.guidePage;
    const modal = document.getElementById('guide-modal');
    const openButton = document.querySelector('[data-guide-trigger]');

    if (!pageKey || !modal || !openButton) {
      return;
    }

    const guideData = GUIDE_CONTENT[pageKey];
    if (!guideData) {
      openButton.remove();
      return;
    }

    const titleEl = modal.querySelector('#guide-modal-title');
    const bodyEl = modal.querySelector('#guide-modal-body');
    const dialogEl = modal.querySelector('[data-guide-dialog]');
    const closeButtons = modal.querySelectorAll('[data-guide-close]');
    const footerButton = modal.querySelector('[data-guide-footer-close]');
    let previousFocus = null;

    const renderContent = (data) => {
      titleEl.textContent = data.title || '초보자 사용가이드';
      bodyEl.innerHTML = '';

      if (data.description) {
        bodyEl.appendChild(createParagraph(data.description, 'guide-description'));
      }

      if (Array.isArray(data.sections)) {
        data.sections.forEach((section) => {
          const sectionEl = document.createElement('section');
          sectionEl.className = 'guide-section';

          if (section.heading) {
            const headingEl = document.createElement('h3');
            headingEl.textContent = section.heading;
            sectionEl.appendChild(headingEl);
          }

          if (section.description) {
            sectionEl.appendChild(createParagraph(section.description));
          }

          if (Array.isArray(section.items) && section.items.length > 0) {
            const listEl = document.createElement('ul');
            section.items.forEach((item) => {
              const li = document.createElement('li');
              li.textContent = item;
              listEl.appendChild(li);
            });
            sectionEl.appendChild(listEl);
          }

          if (section.note) {
            sectionEl.appendChild(createParagraph(section.note, 'guide-note'));
          }

          bodyEl.appendChild(sectionEl);
        });
      }

      if (data.footer) {
        bodyEl.appendChild(createParagraph(data.footer, 'guide-note'));
      }
    };

    const trapFocus = (event) => {
      if (event.key !== 'Tab') {
        return;
      }
      const focusable = Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (element) => element.offsetParent !== null
      );
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const closeModal = () => {
      if (modal.hasAttribute('hidden')) {
        return;
      }
      modal.setAttribute('hidden', '');
      document.body.classList.remove('guide-modal-open');
      modal.removeEventListener('keydown', trapFocus);
      if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus();
      }
    };

    const openModal = () => {
      renderContent(guideData);
      previousFocus = document.activeElement;
      modal.removeAttribute('hidden');
      document.body.classList.add('guide-modal-open');
      modal.addEventListener('keydown', trapFocus);
      const focusTarget = dialogEl || modal;
      window.requestAnimationFrame(() => {
        focusTarget.focus();
      });
    };

    openButton.addEventListener('click', openModal);
    closeButtons.forEach((button) => {
      button.addEventListener('click', closeModal);
    });
    if (footerButton) {
      footerButton.addEventListener('click', closeModal);
    }

    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });

    modal.querySelector('.guide-modal-backdrop')?.addEventListener('click', closeModal);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    });
  });
})();
