// 15개 도착 직군 + 규칙 기반 점수 (AI 추천의 검산용이자, AI가 안 될 때의 대체)
import raw from '../data/jobs15.json';
import { BASE_NODES, nodeMap, optionOf } from './graph';
import type { ForkNode, Profile, Step } from './types';

export const TAG_LABEL: Record<string, string> = {
  major_stem: '📐 이공계 전공', major_deep: '📚 전공 심화', major_double: '📚 복수전공', major_switch: '📚 전과',
  math: '🧮 수학·통계 기초', algo: '⌨️ 코딩테스트', cpp: '💠 C/C++',
  project: '🛠 프로젝트 결과물', award: '🏆 공모전·해커톤', startup: '🚀 창업 경험',
  ml: '🧠 머신러닝·딥러닝', cv: '👁 컴퓨터비전', backend: '🖥 서버·API 개발', cloud: '☁️ 클라우드', data_pipeline: '🔧 데이터 파이프라인',
  robotics: '🦾 로봇·ROS', autonomous: '🚗 자율주행', embedded: '🔌 임베디드', plc: '🏗 PLC·제어', cad: '⚙️ 기구설계·CAD', sim: '🪞 시뮬레이션·디지털트윈',
  research: '🔬 연구 경험', paper: '📄 논문', master: '🎓 석사', phd: '🎓 박사',
  intern: '💼 인턴·현장 경험', global: '✈️ 해외 경험',
  cert_jungcheo: '🎫 정보처리기사', cert_sqld: '🎫 SQLD', cert_adsp: '🎫 ADsP', cert_bigdata: '🎫 빅데이터분석기사', cert_eng: '🎫 기사(전기·전자·기계)', cert_security: '🎫 정보보안기사',
  toeic: '🌐 공인어학', ncs_gsat: '📝 NCS·인적성', civil_prep: '📝 공무원 시험', license: '🔧 기능 자격증',
};
export const ALLOWED_TAGS = Object.keys(TAG_LABEL);

export interface Req { label: string; any: string[]; kind: '전형' | '가점' | '요구' | '우대'; src?: string }
export interface Posting { company_type?: string; url?: string; date?: string; requirements?: string; preferred?: string; process?: string }
export interface Job { id: string; group: string; emoji: string; name: string; reqs: Req[]; postings: Posting[] }

export const JOBS: Job[] = (raw as unknown as { jobs: Job[] }).jobs;
export const JOB_BY_ID = Object.fromEntries(JOBS.map((j) => [j.id, j]));
export const hasPostings = (j: Job) => j.postings.length > 0;

const WEIGHT: Record<Req['kind'], number> = { 요구: 3, 전형: 3, 가점: 2, 우대: 1 };

export function tagsOf(steps: Step[], custom: ForkNode[], profile: Profile | null) {
  const m = nodeMap(custom);
  const t = new Set<string>();
  for (const s of steps) for (const g of optionOf(m, s)?.gives ?? []) t.add(g);
  if (profile && (profile.field === '공학' || profile.field === '자연')) t.add('major_stem');
  return t;
}

export interface JobFit { job: Job; score: number; met: Req[]; miss: Req[] }
export function fit(tags: Set<string>): JobFit[] {
  return JOBS.map((job) => {
    const met = job.reqs.filter((r) => r.any.some((a) => tags.has(a)));
    const miss = job.reqs.filter((r) => !met.includes(r));
    const total = job.reqs.reduce((a, r) => a + WEIGHT[r.kind], 0);
    const got = met.reduce((a, r) => a + WEIGHT[r.kind], 0);
    return { job, score: Math.round((got / total) * 100), met, miss };
  }).sort((a, b) => b.score - a.score);
}

/** 이 요구조건을 채울 수 있는 기본 분기점 (AI 모드에선 없을 수 있음) */
export function whereToGet(req: Req) {
  for (const n of BASE_NODES) for (const o of n.options) if (o.gives?.some((g) => req.any.includes(g))) return { node: n, option: o };
  return null;
}
