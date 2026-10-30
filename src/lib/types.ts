export interface Stat { text: string; src: string }
export interface Option {
  id: string;
  label: string;
  stat?: Stat;
  gains: string[];
  costs: string[];
  next: string[];
  /** 이 선택으로 얻는 스펙 태그 (도착지 계산용) */
  gives?: string[];
}
export interface ForkNode {
  id: string;
  stage: 'S1' | 'S2' | 'S3';
  short: string;
  emoji: string;
  question: string;
  stats: Stat[];
  options: Option[];
  /** 사용자가 추가하고 AI(또는 예시 규칙)가 만든 갈림길 */
  custom?: { by: 'ai' | 'mock'; returnTo: string; parent: string; kind?: 'main' | 'user' };
  /** AI가 붙인 한 줄 맥락 */
  context?: string;
}
export interface Source { name: string; by: string; refs: string[] }
export interface Dataset {
  meta: { title: string; built: string; rule: string; stages: Record<string, string> };
  sources: Record<string, Source>;
  start: string;
  nodes: ForkNode[];
  outcomeLabels: Record<string, string>;
  startByGrade: Record<string, string>;
}

export type Field = '공학' | '자연' | '인문' | '사회' | '예체능' | '의약' | '교육';
export type Grade = 'low' | '3' | '4' | 'grad';
export interface Profile { name: string; field: Field; grade: Grade; interests: string[] }

/** 경로의 한 걸음: 질문(nodeId)에서 고른 답(optionId). 마지막 걸음은 아직 답이 없을 수 있다 */
export interface Step { nodeId: string; optionId?: string }
export interface Route { id: string; color: string; steps: Step[]; ended: boolean }
