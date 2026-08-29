export interface CharacterSectionField {
  label: string;
  value: string;
}

export interface CharacterSection {
  title: string;
  fields: CharacterSectionField[];
}

export interface CharacterCard {
  id: string;
  bookId: string;
  categoryId: string;
  archiveNo: string;       // 档案编号：如 749-SURVIVOR-NO.001
  stampText: string;       // 印章徽章：如 地质世家第三代 · 绝密建档
  name: string;            // 姓名：如 杨涛
  subtitle: string;        // 括号副标：如 (28岁 · 湖南籍 · 闷葫芦)
  identityBadge: string;   // 右侧身份标签：如 原省水文大坝助理工程师
  sections: CharacterSection[]; // 三大核心板块 (家族渊源/专业绝活/生活习性等)
  tags: string[];          // 生活习性与行事风格特征胶囊：如 ['从不抽烟', '偶尔喝两口烈酒', '冷峻干练', '极度护短较真']
  habitsText?: string;     // 习惯与习性
  physicalTraits?: string; // 生理标志 / 内在风骨
  tokenBelongings: string; // 随身信物：如 爷爷的《1982年秦南水文手记》...
  quoteText: string;       // 底部经典名言金句
  quoteSource?: string;    // 金句注脚：如 末日生存人物图鉴卡 · 编号 001 · 杨涛个人档案
  updatedAt?: string;
}

export interface CharacterCategory {
  id: string;
  bookId: string;
  name: string;
  orderIndex: number;
}

export interface CharacterRelation {
  id: string;
  fromCharacterId: string;
  toCharacterId: string;
  relationText: string; // 如：过命兄弟、命定搭档、杀父仇敌、师徒
  relationType?: 'friendly' | 'hostile' | 'neutral' | 'family';
}

export interface CharacterCanvasNode {
  characterId: string;
  x: number;
  y: number;
}

export interface CharacterLogicMapData {
  bookId: string;
  nodes: CharacterCanvasNode[];
  relations: CharacterRelation[];
}
