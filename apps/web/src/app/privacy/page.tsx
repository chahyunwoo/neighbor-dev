import type { Metadata } from 'next'
import { COMPANY, pageMetadata } from '@/shared/lib'
import styles from '@/shared/ui/styles/form-page.module.css'
import { Nav } from '@/widgets/nav'
import { PageShell } from '@/widgets/page-shell'

export const metadata: Metadata = pageMetadata({
  title: '개인정보처리방침',
  description: '이웃집개발자가 수집하는 개인정보의 항목, 목적, 보유 기간과 처리 위탁을 안내합니다.',
  path: '/privacy',
})

const SECTIONS: readonly (readonly [string, readonly string[]])[] = [
  [
    '1. 수집 항목과 목적',
    [
      '프로젝트 문의: 이름(또는 회사명), 이메일, 문의 내용 — 문의 확인과 회신에 사용합니다.',
      '프로젝트 사전 진단: 입력하신 요구사항 텍스트 — 진단 결과 생성에만 사용합니다. 진단에는 개인정보를 입력하지 마세요.',
      '방문 통계나 광고를 위한 쿠키·분석 도구는 사용하지 않습니다.',
    ],
  ],
  [
    '2. 보유 기간',
    [
      '문의 내용은 서버에 저장하지 않고 이메일로 전달되며, 문의 처리가 끝난 뒤 1년간 보관하고 삭제합니다.',
      '문의가 계약으로 이어지면 관련 법령이 정한 기간 동안 보관합니다.',
      '사전 진단 입력은 저장하지 않으며, 결과는 방문자의 화면에만 표시됩니다.',
    ],
  ],
  [
    '3. 처리 위탁과 국외 이전',
    [
      'Google LLC(미국) — 문의 메일 수신·보관(Google Workspace). 이전 항목: 이름, 이메일, 문의 내용. 문의 접수 시 네트워크로 전송됩니다.',
      'Anthropic PBC(미국) — 사전 진단 결과 생성. 이전 항목: 입력한 요구사항 텍스트. 진단 요청 시 네트워크로 전송되며, 보관은 위탁사의 정책을 따릅니다.',
    ],
  ],
  [
    '4. 정보주체의 권리',
    [
      `개인정보의 열람, 정정, 삭제, 처리 정지를 요청하실 수 있습니다. ${COMPANY.email} 로 연락해 주세요.`,
    ],
  ],
  ['5. 개인정보 보호책임자', [`${COMPANY.name} 대표 ${COMPANY.owner} · ${COMPANY.email}`]],
  ['6. 시행일', ['이 방침은 2026년 9월 30일부터 적용합니다.']],
]

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <PageShell
        crumb="개인정보처리방침"
        title="개인정보처리방침"
        lede="이웃집개발자는 문의와 사전 진단에 필요한 최소한의 정보만 받습니다."
      >
        <div className={styles.wrap}>
          {SECTIONS.map(([title, lines]) => (
            <section key={title} className={styles.policy}>
              <h2 className={styles.policyTitle}>{title}</h2>
              <ul className={styles.policyList}>
                {lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </PageShell>
    </>
  )
}
