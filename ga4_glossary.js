// GA4 用語・指標 解説辞書
// ターゲット：GA4を見られるが詳細な解釈が難しい方向け

const GA4_GLOSSARY = {
  // ===== 基本構造 =====
  'アカウント': {
    term: 'アカウント',
    aliases: ['account', 'accounts'],
    category: '基本構成',
    emoji: '🏢',
    summary: 'アナリティクスを利用するための最上位の階層',
    detail: 'Google アナリティクスにアクセスするための場所です。1つのアカウント内に複数の「プロパティ」を持つことができ、会社や組織単位で管理するのが一般的です。',
    tip: '社内の複数のサイトを管理する場合、1つのアカウントにまとめるか、事業部ごとに分けるかを検討しましょう。'
  },
  'プロパティ': {
    term: 'プロパティ',
    aliases: ['property', 'properties'],
    category: '基本構成',
    emoji: '🏠',
    summary: 'サイトやアプリのデータをグループ化したもの',
    detail: 'ウェブサイトやアプリのデータを1まとめにした単位です。レポートの表示や、データ収集の設定、他サービス（Google 広告など）との連携はこの単位で行います。',
    tip: '現在の「GA4プロパティ」は、以前の「ユニバーサル アナリティクス（UA）」とはデータの持ち方が大きく異なります。'
  },
  '測定 ID': {
    term: '測定 ID',
    aliases: ['measurement id', 'g-', '測定ID'],
    category: '基本構成',
    emoji: '🆔',
    summary: 'データを正しい場所に送るための識別子',
    detail: 'ウェブデータストリーム（計測対象のサイト）ごとに発行される一意のIDです。「G-」から始まる英数字で、サイトに設置するタグに関連付けられます。',
    tip: '「管理 > データストリーム」から確認できます。タグマネージャーでの設定時などに必要になります。'
  },

  // ===== ユーザー・アクティビティ =====
  'ユーザー': {
    term: 'ユーザー',
    aliases: ['users', 'user', 'アクティブユーザー', 'active users'],
    category: 'ユーザー',
    emoji: '👤',
    summary: 'サイトを訪れた人の数（重複なし）',
    detail: '指定した期間内にサイトやアプリを訪問したユーザーの総数です。GA4では基本的に「アクティブ ユーザー」を指し、実際に操作を行った人をカウントします。',
    tip: '「新規ユーザー」と「リピートユーザー」を分けることで、集客の質を判断できます。'
  },
  '新規ユーザー数': {
    term: '新規ユーザー数',
    aliases: ['new users', 'new user'],
    category: 'ユーザー',
    emoji: '🆕',
    summary: '初めてサイトを訪れた人の数',
    detail: '過去にサイトを訪問したことがない、初めての訪問者の数です。広告や新しいコンテンツの効果を測るのに役立ちます。',
    tip: '全ユーザー数に対して新規ユーザーの割合を確認し、新規開拓ができているかチェックしましょう。'
  },
  'コホート': {
    term: 'コホート',
    aliases: ['cohort', 'cohorts'],
    category: 'ユーザー',
    emoji: '📅',
    summary: '共通の特性を持つユーザーのグループ',
    detail: '「特定の日に初めてサイトを訪れた」「特定の週に購入した」など、特定の条件を共有するユーザーの塊です。継続率（リテンション）の分析によく使われます。',
    tip: 'コホート分析を使うと、獲得したユーザーが時間の経過とともにどれくらい離脱しているかが可視化できます。'
  },
  'ユーザー プロパティ': {
    term: 'ユーザー プロパティ',
    aliases: ['user property', 'user properties'],
    category: 'ユーザー',
    emoji: '📋',
    summary: 'ユーザー自身の特徴を説明する属性',
    detail: 'ユーザーの言語設定や地域、会員ランクなど、その人固有の属性です。これをもとにユーザーを分類（セグメント化）して分析できます。',
    tip: '「プレミアム会員」「無料会員」などの区分をこのプロパティに設定すると、ターゲット別の分析が可能になります。'
  },

  // ===== セッション・訪問 =====
  'セッション': {
    term: 'セッション',
    aliases: ['sessions', 'session'],
    category: '訪問',
    emoji: '🔄',
    summary: 'サイトへの訪問1回分のこと',
    detail: 'ユーザーがサイトに来てから去るまでの一連の行動です。デフォルトでは30分以上操作がないと終了します。',
    tip: '1人のユーザーが1日に3回訪問すれば、ユーザー数は1、セッション数は3になります。'
  },
  'エンゲージメントのあったセッション': {
    term: 'エンゲージメントのあったセッション',
    aliases: ['engaged sessions', 'engaged session'],
    category: '訪問',
    emoji: '💡',
    summary: '意味のある行動（10秒以上滞在など）があった訪問',
    detail: '10秒以上の滞在、2回以上のページ閲覧、またはキーイベント（コンバージョン）の発生のいずれかを満たしたセッションです。',
    tip: '単なる「セッション数」よりも、中身のある「エンゲージメントのあったセッション」を重視しましょう。'
  },

  // ===== イベント・行動 =====
  'イベント': {
    term: 'イベント',
    aliases: ['events', 'event'],
    category: '行動',
    emoji: '⚡',
    summary: 'ユーザーがサイト内で行った具体的なアクション',
    detail: 'クリック、スクロール、ページ表示など、GA4での計測の最小単位です。GA4ではあらゆる行動が「イベント」として記録されます。',
    tip: '「page_view」や「click」など、あらかじめ用意されているものの他に、自分でカスタムイベントを作ることもできます。'
  },
  'イベント パラメータ': {
    term: 'イベント パラメータ',
    aliases: ['event parameter', 'event parameters'],
    category: '行動',
    emoji: '📝',
    summary: 'イベントに付随する「さらに詳しい情報」',
    detail: '「クリック」というイベントに対して、「どのボタンを押したか」「どのページで押したか」といった補足情報のことです。',
    tip: 'イベントひとつひとつに詳細なコンテキスト（文脈）を持たせることで、分析が深まります。'
  },
  'キーイベント / コンバージョン': {
    term: 'キーイベント（旧：コンバージョン）',
    aliases: ['conversion', 'conversions', 'key event', 'key events'],
    category: '行動',
    emoji: '🎯',
    summary: 'ビジネスにとって特に重要なアクション',
    detail: '問い合わせ完了や購入など、サイトの目標となる特定のイベントです。以前は「コンバージョン」と呼ばれていました。',
    tip: 'どのイベントを「キーイベント」とするかは、管理画面でスイッチをONにするだけで設定できます。'
  },

  // ===== ページ・コンテンツ =====
  'ランディング ページ': {
    term: 'ランディング ページ',
    aliases: ['landing page', 'landing pages'],
    category: 'ページ',
    emoji: '🛬',
    summary: 'ユーザーが最初に目にしたページ（入り口）',
    detail: '外部サイトや広告から訪問した際に、一番最初に表示されたページです。サイトの第一印象を決める重要なページになります。',
    tip: '「ランディング ページ レポート」を確認して、どのページが入り口として優秀か（離脱が少ないか）チェックしましょう。'
  },
  'ページパス': {
    term: 'ページパス',
    aliases: ['page path', 'page_path'],
    category: 'ページ',
    emoji: '🛤️',
    summary: 'URLのドメインより後ろの部分',
    detail: '「example.com/about」であれば「/about」の部分を指します。サイト内のどの階層を見ているかを特定するのに使います。',
    tip: 'ディレクトリ（フォルダ）ごとに数値を集計することで、サイトのどのコーナーが人気か分析しやすくなります。'
  },

  // ===== 分析・集客 =====
  'アトリビューション': {
    term: 'アトリビューション',
    aliases: ['attribution', 'attributions'],
    category: '集客分析',
    emoji: '🔗',
    summary: 'コンバージョンへの貢献度を割り当てる仕組み',
    detail: 'ユーザーがコンバージョンに至るまでに接触した様々な広告やチャネル（検索、SNS、メール等）に対して、それぞれの貢献度を適切に割り振る計算方法のことです。',
    tip: 'GA4ではAIを活用した「データドリブン アトリビューション」が標準で、最も正確に広告の効果を測定できます。'
  },
  'User-ID': {
    term: 'User-ID',
    aliases: ['userid', 'user-id', 'user_id'],
    category: 'ユーザー',
    emoji: '🆔',
    summary: '個々のユーザーをデバイスを跨いで特定するためのID',
    detail: 'サイト独自の会員IDなどをGA4に送信することで、同じ人がPCで見てもスマホで見ても「同一人物」として統合して計測できるようにする機能です。',
    tip: 'これを設定すると、デバイスを跨いだ正確なユーザー行動（クロスデバイス計測）が可能になります。'
  },
  '基数': {
    term: '基数',
    aliases: ['cardinality'],
    category: 'システム',
    emoji: '🔢',
    summary: 'データの種類の多さ（バリエーション）のこと',
    detail: 'ある項目に含まれる一意の（ユニークな）値の数です。例えば「性別」は基数が低い（男・女・不明など数種類）ですが、「ページURL」は基数が高い（数万行になることも）です。',
    tip: '基数が高すぎると、レポートで「(other)」という行にまとめられてしまうことがあります。'
  },
  'データフィルタ': {
    term: 'データフィルタ',
    aliases: ['data filter', 'data filters'],
    category: 'システム',
    emoji: '🧹',
    summary: '不要なデータ（社内アクセス等）を除外する設定',
    detail: '特定のIPアドレスからのアクセスや、テスト環境のデータなどがレポートに含まれないようにするための設定です。',
    tip: '社内からのアクセスを「内部トラフィック」として除外設定しておくのが一般的です。'
  },
  'Measurement Protocol': {
    term: 'Measurement Protocol',
    aliases: ['measurement protocol'],
    category: 'システム',
    emoji: '📡',
    summary: 'サーバー等から直接データを送信する仕組み',
    detail: 'ブラウザのタグだけでなく、POSレジやサーバーなどから直接GA4にデータを送るためのプロトコル（通信規約）です。',
    tip: '実店舗の購入データや、オフラインのイベントをGA4に反映させたい時に活用します。'
  },
  'チャネル グループ': {
    term: 'チャネル グループ',
    aliases: ['channel group', 'channel groups'],
    category: '集客分析',
    emoji: '📢',
    summary: '集客経路のジャンル分け（自然検索、SNSなど）',
    detail: '流入元を「Google検索」「広告」「SNS」などの大枠で分類したものです。全体像を把握するのに便利です。',
    tip: '「Organic Search（自然検索）」や「Paid Search（Paid Search）」などの標準的な分類が自動で行われます。'
  },
  'ユーザーデータ探索': {
    term: 'ユーザーデータ探索',
    aliases: ['user exploration', 'user exploration tool'],
    category: '分析手法',
    emoji: '🔍',
    summary: '特定のユーザーの行動履歴を詳しく見るツール',
    detail: '平均値ではなく、ある特定のユーザーがどのような順番でページを見たか、個別のログ（行動履歴）を分析できる手法です。',
    tip: '特定のサイト利用パターンを深掘りしたいときに非常に強力なツールです。'
  },
  'アトリビューション モデル': {
    term: 'アトリビューション モデル',
    aliases: ['attribution model'],
    category: '集客分析',
    emoji: '⚖️',
    summary: '貢献度を判断するための「計算ルール」',
    detail: '数ある訪問経路の中で、どの接点を重視するかを決めるルールです（例：データドリブン、ラストクリックなど）。',
    tip: 'GA4ではAIが最適に判断する「データドリブン」モデルが標準として推奨されています。'
  },

  // ===== エンゲージメント指標 =====
  'エンゲージメント率': {
    term: 'エンゲージメント率',
    aliases: ['engagement rate'],
    category: 'エンゲージメント',
    emoji: '📊',
    summary: 'サイトをきちんと見てくれた訪問の割合',
    detail: '全訪問のうち、エンゲージメントのあったセッションが占める割合です。中身のない「さらっと見ただけ」を排除した指標です。',
    tip: '50%以上を目指しましょう。低い場合は、コンテンツが期待外れだった可能性があります。'
  },
  '直帰率': {
    term: '直帰率',
    aliases: ['bounce rate'],
    category: 'エンゲージメント',
    emoji: '↩️',
    summary: 'すぐに離脱してしまった訪問の割合',
    detail: 'GA4では「エンゲージメントがなかった訪問」の割合を指します。以前のGAと定義が少し変わっています。',
    tip: '直帰率が高い ＝ エンゲージメント率が低い という関係です。'
  },
  '平均エンゲージメント時間': {
    term: '平均エンゲージメント時間',
    aliases: ['average engagement time'],
    category: 'エンゲージメント',
    emoji: '⏱️',
    summary: '実際に画面を見ていた平均的な時間',
    detail: 'ユーザーがタブをアクティブにして実際に閲覧していた時間の平均です。放置していただけの時間は含まれません。',
    tip: '記事を読ませるサイトなら1分以上、情報が完結するサイトなら短くてもOKなど、目的に合わせて評価します。'
  },

  // ===== 広告・収益 =====
  'ROAS': {
    term: 'ROAS',
    aliases: ['roas', '広告費用対効果'],
    category: '収益',
    emoji: '💸',
    summary: '広告の費用対効果（110円の広告で何円売れたか）',
    detail: '広告費に対して得られた売上の割合です。例えば 1万円の広告で 5万円売れたら ROAS 500% です。',
    tip: '目標とする利益率から、最低限クリアすべきROASを算出しておきましょう。'
  },
  'LTV': {
    term: 'LTV（ライフタイム バリュー）',
    aliases: ['lifetime value', 'ltv'],
    category: '収益',
    emoji: '👑',
    summary: '1人の顧客が生涯でもたらす価値の合計',
    detail: 'あるユーザーがサイトやサービスを使い始めてから、離脱するまでにもたらす売上の総額です。',
    tip: '目先の1回きりの購入だけでなく、長く使い続けてくれる「良い客」を集められているか判断できます。'
  }
};

// 検索関数：完全一致・部分一致・エイリアス対応（候補表示対応）
function lookupGA4Term(selectedText) {
  if (!selectedText || selectedText.trim().length < 2) return null;

  const text = selectedText.trim().toLowerCase();
  const candidates = new Map(); // 重複排除のためMapを使用

  // スコアリング用ヘルパー
  const addCandidate = (item, score) => {
    if (!candidates.has(item.term) || candidates.get(item.term).score < score) {
      candidates.set(item.term, { item: item, score: score });
    }
  };

  for (const key in GA4_GLOSSARY) {
    const item = GA4_GLOSSARY[key];
    const termLower = item.term.toLowerCase();
    
    // 1. 完全一致 (Score: 100)
    if (termLower === text || key.toLowerCase() === text) {
      addCandidate(item, 100);
    }

    // 2. エイリアス完全一致 (Score: 90)
    if (item.aliases && item.aliases.some(alias => alias.toLowerCase() === text)) {
      addCandidate(item, 90);
    }

    // 3. 部分一致 / 包含関係 (Score: 40 ~ 80)
    // 選択テキストが用語を含んでいる場合 (例: "セッションの数" で "セッション" を探す)
    if (text.includes(termLower)) {
      const score = 80 * (termLower.length / text.length);
      addCandidate(item, score);
    }
    // 用語が選択テキストを含んでいる場合 (例: "セッショ" で "セッション" を探す)
    if (termLower.includes(text)) {
      const score = 70 * (text.length / termLower.length);
      addCandidate(item, score);
    }

    // 4. エイリアス部分一致 (Score: 30 ~ 60)
    if (item.aliases) {
      for (const alias of item.aliases) {
        const aliasLower = alias.toLowerCase();
        if (text.includes(aliasLower)) {
          addCandidate(item, 60 * (aliasLower.length / text.length));
        } else if (aliasLower.includes(text)) {
          addCandidate(item, 50 * (text.length / aliasLower.length));
        }
      }
    }
  }

  // スコア順にソート
  const sortedCandidates = Array.from(candidates.values())
    .sort((a, b) => b.score - a.score);

  if (sortedCandidates.length === 0) return null;

  // 1位のスコアが極めて高い（80以上）場合は、単一の結果として返す
  if (sortedCandidates[0].score >= 80) {
    return { type: 'exact', item: sortedCandidates[0].item };
  }

  // それ以外、または候補が複数ある場合は、候補リストとして返す（最大5件）
  return {
    type: 'candidates',
    items: sortedCandidates.slice(0, 5).map(c => c.item)
  };
}
