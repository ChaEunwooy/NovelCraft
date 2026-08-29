import type { CharacterCard, CharacterCategory, CharacterLogicMapData } from '../types/character';

export const DEFAULT_CATEGORIES: CharacterCategory[] = [
  { id: 'cat_protagonists', bookId: 'fq_book_7674950021661330457', name: '主角核心团', orderIndex: 1 },
  { id: 'cat_survivors', bookId: 'fq_book_7674950021661330457', name: '外围老城避难所', orderIndex: 2 },
  { id: 'cat_blackmarket', bookId: 'fq_book_7674950021661330457', name: '黑市军火势力', orderIndex: 3 },
  { id: 'cat_inner_city', bookId: 'fq_book_7674950021661330457', name: '内城防灾署调查组', orderIndex: 4 }
];

export const DEFAULT_CHARACTERS: CharacterCard[] = [
  {
    id: 'char_yang_tao',
    bookId: 'fq_book_7674950021661330457',
    categoryId: 'cat_protagonists',
    archiveNo: '749-SURVIVOR-NO.001',
    stampText: '地质世家第三代 · 绝密建档',
    name: '杨涛',
    subtitle: '(28岁 · 湖南籍 · 闷葫芦)',
    identityBadge: '原省水文大坝助理工程师',
    sections: [
      {
        title: '家族渊源与至亲档案',
        fields: [
          { label: '籍贯地域', value: '湖南（生于湘江三流水文工程基地，自幼在水库大院与钻机轰鸣中长大）。' },
          { label: '祖父 (已故)', value: '杨万山（原国营749地质勘探队第一代钻探高工，三十年前参与秦南大断裂带测绘，灾变前夕留下一本贴满黄胶带的手记神秘失踪）。' },
          { label: '父亲 (已故)', value: '杨建国（三线机械厂八级机修钳工，技术大拿，杨涛的一身精密盲修机械手艺全由父亲言传身教敲打出来）。' },
          { label: '母亲 (失联)', value: '周秀芬（县棉纺织厂女工，灾变当天留守平原老宅沉入白雾死区，生死未卜——杨涛拼死下坑的终极执念）。' },
          { label: '命定搭档', value: '邓杰（胖子）（两家祖辈有过命交情，灾变当天邓杰开重卡救出杨涛，如今两人搭伙共守七盘岭）。' }
        ]
      },
      {
        title: '教育背景与职业技术',
        fields: [
          { label: '毕业院校', value: '中南大学 地球科学与空间勘测学院（统招工科一本）' },
          { label: '专业方向', value: '地下空间工程与地质测绘专业（辅修精密机械设计及自动化）' },
          { label: '实操能力', value: '精通地质断层等高线推演，闭眼盲拆单缸柴油机、发电机组；耐受白雾毒气时间远超常人。' }
        ]
      },
      {
        title: '生活习性与行事风格',
        fields: [
          { label: '习惯与习性', value: '坚决不抽烟（嫌烟味在雾里暴露位置且影响嗅觉），寒夜排险时偶尔小抿两口自酿烈酒暖身；遇事沉着话极少。' },
          { label: '生理标志', value: '左手食指缺半截指甲（修水泵咬伤的工伤）；思考棘手难题时习惯两根手指下意识捻泥土闻质地。' }
        ]
      }
    ],
    tags: ['从不抽烟', '偶尔喝两口烈酒', '冷峻干练', '极度护短较真'],
    habitsText: '坚决不抽烟（嫌烟味在雾里暴露位置且影响嗅觉），寒夜排险时偶尔小抿两口自酿烈酒暖身；遇事沉着话极少。',
    physicalTraits: '左手食指缺半截指甲（修水泵咬伤的工伤）；思考棘手难题时习惯两根手指下意识捻泥土闻质地。',
    tokenBelongings: '爷爷的《1982年秦南水文手记》、父亲遗留淬火红铜錾刀、改装双罐活性炭防毒面具。',
    quoteText: '我家三代人在地下钻孔打洞。天漏了算什么，地下无论多深，老子也能把路凿出来。',
    quoteSource: '末日生存人物图鉴卡 · 编号 001 · 杨涛个人档案（双击编辑）'
  },
  {
    id: 'char_deng_jie',
    bookId: 'fq_book_7674950021661330457',
    categoryId: 'cat_protagonists',
    archiveNo: '749-SURVIVOR-NO.002',
    stampText: '重工爆破前锋 · 铁血老兵',
    name: '邓杰',
    subtitle: '(33岁 · 外号胖子 · 年长杨涛5岁)',
    identityBadge: '原路桥隧道重型爆破工程队工长',
    sections: [
      {
        title: '家族渊源与人生履历',
        fields: [
          { label: '年龄与辈分', value: '33岁左右，比杨涛年长5岁。早早便辍学进入社会摸爬滚打，是泥水重工里滚出来的实战老手。' },
          { label: '学历履历', value: '学历未知（无正规大学文凭，自幼在筑路工棚与爆破库房吃百家饭长大，自学掌握所有炸药配比与机械驾驶）。' },
          { label: '父亲 (因公牺牲)', value: '邓大发（原铁道兵排险连连长，三十年前在749大断裂带瓦斯险情中舍命背炸药救出杨万山，结下两家生死盟）。' },
          { label: '过命兄弟', value: '杨涛（相识多年，视杨涛为唯一的亲弟弟；大灾变当天开着老解放重卡冲进白雾将杨涛从死人堆里硬拽上车）。' }
        ]
      },
      {
        title: '重工战力与专业绝活',
        fields: [
          { label: '实操绝活', value: '精通土法黑火药提纯、定向爆破、老式雷管压接；精通重型柴油重卡、悬崖卷扬机索道操纵。' },
          { label: '体魄身板', value: '体格宽大雄壮如一堵厚铁墙（不是虚胖，是常年开山扛重铁的熊体格），近身格斗力大无穷。' },
          { label: '末日职务', value: '三号断轨黑市哨站重型绞盘掌舵把手，兼任下坑突击与后方火力压制。' }
        ]
      },
      {
        title: '生活习性与行事风格',
        fields: [
          { label: '习惯与习性', value: '坚决不抽烟（长年玩炸药必须杜绝明火火星），极能吃肉，偶尔和杨涛就着咸菜喝二两老白干，讲究重工安全规矩。' },
          { label: '内在风骨', value: '看着粗枝大叶，实则战术嗅觉极敏锐；下坑遇险时必定是最后一个人堵在风道口断后掩护。' }
        ]
      }
    ],
    tags: ['从不抽烟', '偶尔喝二两老酒', '骨子极硬', '大智若愚', '舍命断后'],
    habitsText: '坚决不抽烟（长年玩炸药必须杜绝明火火星），极能吃肉，偶尔和杨涛就着咸菜喝二两老白干，讲究重工安全规矩。',
    physicalTraits: '看着粗枝大叶，实则战术嗅觉极敏锐；下坑遇险时必定是最后一个人堵在风道口断后掩护。',
    tokenBelongings: '改线膛重型撅把子土铳、淬火撬道钉加重钢钎、老式雷管压接钳、纯铝火药壶。',
    quoteText: '老邓我没读过几天圣贤书，但懂规矩。只要这双手还在闸把上，阎王爷也甭想把杨老弟拉下去。',
    quoteSource: '末日生存人物图鉴卡 · 编号 002 · 邓杰个人档案（双击编辑）'
  },
  {
    id: 'char_lu_ren',
    bookId: 'fq_book_7674950021661330457',
    categoryId: 'cat_survivors',
    archiveNo: '749-SURVIVOR-NO.003',
    stampText: '老城区废墟向导 · 避险达人',
    name: '路仁',
    subtitle: '(24岁 · 长湘本地幸存者 · 大圆近视镜)',
    identityBadge: '商场负三层防空洞据点向导',
    sections: [
      {
        title: '身世与避险经历',
        fields: [
          { label: '身世背景', value: '在长湘老城区废墟中摸爬滚打长大的平民幸存者，父母在几十年前逃难时双亡。' },
          { label: '避险专长', value: '随身携带长辈拿命总结的避险笔记本，熟悉外围三大特级死区的各种规则禁忌。' },
          { label: '与主角羁绊', value: '在废弃站台被杨涛借眼镜死循环反杀回头鬼救下，惊为内城贵公子，主动担任向导。' }
        ]
      }
    ],
    tags: ['近视600度', '生存笔记', '忠厚可靠', '胆小但讲义气'],
    tokenBelongings: '泛黄手绘城区避险笔记、厚底大圆黑框近视镜、商场防空洞防爆门备用钥匙。',
    quoteText: '杨哥，外头别的地方早让阴霾吞光了，咱们这帮苦命人抱团，才能多活一口气。',
    quoteSource: '末日生存人物图鉴卡 · 编号 003 · 路仁个人档案'
  }
];

export const DEFAULT_LOGIC_MAP: CharacterLogicMapData = {
  bookId: 'fq_book_7674950021661330457',
  nodes: [
    { characterId: 'char_yang_tao', x: 80, y: 120 },
    { characterId: 'char_deng_jie', x: 480, y: 120 },
    { characterId: 'char_lu_ren', x: 280, y: 380 }
  ],
  relations: [
    {
      id: 'rel_1',
      fromCharacterId: 'char_yang_tao',
      toCharacterId: 'char_deng_jie',
      relationText: '过命兄弟 / 祖辈生死盟',
      relationType: 'friendly'
    },
    {
      id: 'rel_2',
      fromCharacterId: 'char_yang_tao',
      toCharacterId: 'char_lu_ren',
      relationText: '救命之恩 / 废墟向导',
      relationType: 'friendly'
    },
    {
      id: 'rel_3',
      fromCharacterId: 'char_deng_jie',
      toCharacterId: 'char_lu_ren',
      relationText: '据点哨位庇护',
      relationType: 'neutral'
    }
  ]
};
