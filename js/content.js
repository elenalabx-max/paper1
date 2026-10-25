'use strict';
// 靜態內容：各分頁文字、表格、架構圖與決策樹資料

const TAG = {
  have: '<span class="tag t-have">已具備資料</span>',
  pend: '<span class="tag t-pend">待確認資料</span>',
  plan: '<span class="tag t-plan">規劃中方法</span>',
  none: '<span class="tag t-none">尚未取得結果</span>',
  fixed: '<span class="tag t-fixed">固定契約要求</span>'
};
const LEGEND_BAR = `<div class="legendbar">標記說明：${TAG.have}${TAG.pend}${TAG.plan}${TAG.none}${TAG.fixed}</div>`;

const PAGES = [
  ['goal', '研究目的與核心問題'],
  ['contract', '桃園115年度契約要求'],
  ['data', '既有資料與可用性'],
  ['arch', '研究整體架構'],
  ['tree', '損壞辨識決策樹'],
  ['survey', '兩階段問卷示意'],
  ['map', '互動式查報地圖'],
  ['methods', '空間方法比較'],
  ['weights', '權重與情境比較'],
  ['timeline', '修復狀態與時間軸'],
  ['renew', '年度更新候選範圍'],
  ['plan', '執行步驟與待討論事項']
];

const HTML_GOAL = `
<h2>1 研究目的與核心問題</h2>
<p class="lead">道路管理機關累積了大量查報案件，目前主要用於派工與結案。本研究探討如何把這些案件整理成可用於道路狀況判讀與年度維護規劃的空間資訊。</p>
${LEGEND_BAR}
<div class="callout info">本網頁是討論用原型，不是研究成果，也不是已驗證的道路更新決策系統。地圖上的案件是模擬資料，路網取自 OpenStreetMap 的臺北市中山區道路線段。</div>
<div class="grid2">
  <div class="card">
    <h4>研究前提</h4>
    <ul>
      <li>不預設查報熱點可以取代 PCI。</li>
      <li>不預設哪一種空間分析方法或評分公式較佳。</li>
      <li>盡量不依賴設備商提供的 PCI 調查單元，優先使用查報位置與公開道路線段。</li>
      <li>管理偏好（權重）與物理損壞程度分開處理。</li>
    </ul>
  </div>
  <div class="card">
    <h4>主要目的 ${TAG.plan}</h4>
    <p>建立以道路查報事件為基礎的多屬性空間資訊整合與視覺化方法，協助機關辨識損壞集中、反覆陳情，以及值得進一步評估年度更新的道路範圍。</p>
    <h4 style="margin-top:10px">次要目的 ${TAG.plan}</h4>
    <ul>
      <li>簡易損壞辨識決策樹及程度判斷方式</li>
      <li>以問卷或情境選擇實驗取得管理權重的可行性</li>
      <li>比較不同熱點或道路網絡分析方法</li>
      <li>評估現行 PCI 與候選在地化參考指標的適用性</li>
      <li>可調整、可追蹤、可重現的資訊呈現方式</li>
    </ul>
  </div>
</div>
<h3>核心問題</h3>
<table class="t">
  <tr><th style="width:3em">#</th><th>問題</th><th style="width:16em">本網頁對應分頁</th></tr>
  <tr><td>1</td><td>如何將查報案件的來源、損壞類型、程度、時間、照片及修復狀態轉換成可用的空間資訊？</td><td>3 資料、5 決策樹、10 時間軸</td></tr>
  <tr><td>2</td><td>如何在不預先切割 PCI 調查單元的情況下，呈現損壞的集中程度及歷史變化？</td><td>7 地圖、8 方法比較</td></tr>
  <tr><td>3</td><td>如何同時保留獨立損壞事件與民眾重複陳情的不同管理意義？</td><td>7 地圖（三種輸出）、10 時間軸</td></tr>
  <tr><td>4</td><td>如何讓使用者依類型、來源及權重調整地圖，而不把管理偏好誤認為物理損壞程度？</td><td>9 權重與情境</td></tr>
  <tr><td>5</td><td>哪些空間分布特徵可用於辨識年度刨鋪或單車道全面更新的候選道路？</td><td>11 更新候選</td></tr>
  <tr><td>6</td><td>查報資訊與既有 PCI、修復紀錄及實際道路狀況之間，是否存在可驗證的關聯？</td><td>4 架構（驗證階段）${TAG.none}</td></tr>
</table>`;

const CONTRACT_TEXT = `二、PCI指標在地化研究
（一）現行PCI公式探討與調整：針對現行套用美國國外公式（ASTM D6433-20）常導致台灣數值偏高、無法因地制宜之問題，進行公式研究與合理化調整。
（二）建立在地化參考指標：研究成果將提供給未來設備商及機動廠商在巡查時作為客觀參考依據；因本項屬機關內部之測試與研究性質，故無須具備TAF認證。`;

const HTML_CONTRACT = `
<h2>2 桃園115年度巡檢案：固定契約要求</h2>
<div class="contract">
  <div class="lock">固定契約要求｜契約原文，不可改寫</div>
  <blockquote>${CONTRACT_TEXT.replace(/\n/g, '<br>')}</blockquote>
</div>
<div class="callout">契約文字不變，下表中欄的執行方式可以討論。PCI 是否偏高、偏高原因為何，都要在分析後才能判斷；目前沒有完成任何公式修正。</div>
<h3>契約要求、候選執行方式與預計交付成果</h3>
<div class="tablewrap"><table class="t" id="tblContract">
  <tr><th style="width:15%">契約要求 ${TAG.fixed}</th><th>候選執行方式（可討論）</th><th style="width:26%">預計交付成果</th><th style="width:9em">狀態</th></tr>
  <tr class="fixed"><td>（一）現行PCI公式探討與調整</td>
    <td><ul style="margin:0;padding-left:1.1em">
      <li>整理 ASTM D6433-20 計算流程：損壞類型、程度、密度、扣分值、修正扣分值，逐步標出可調整之處</li>
      <li>以歷史 PCI、照片判讀與現場資料比對，檢查是否有系統性差異，以及差異出現在哪個步驟（扣分曲線、調查單元劃分、損壞量測方式等）</li>
      <li>提出候選調整方案，以同一批案例比較調整前後結果</li>
    </ul></td>
    <td>現行 PCI 公式與評價方式檢討；候選合理化調整方案及比較；案例驗證及適用性說明</td>
    <td>${TAG.plan}<br>${TAG.none}</td></tr>
  <tr class="fixed"><td>（二）建立在地化參考指標</td>
    <td><ul style="margin:0;padding-left:1.1em">
      <li>損壞辨識決策樹與簡易程度判斷（見分頁 5）</li>
      <li>以經確認的照片建立標準案例</li>
      <li>指標形式待討論：修正後 PCI、輔助指標或分級規則</li>
      <li>以第一階段問卷檢查不同判讀者的一致性（見分頁 6）</li>
    </ul></td>
    <td>損壞辨識決策樹；簡易程度判斷及標準案例；在地化參考指標或管理評價方法；供機關及未來巡查廠商參考的操作指引</td>
    <td>${TAG.plan}<br>${TAG.none}</td></tr>
</table></div>
<p class="noprint" style="margin-top:8px"><button data-export="contract">匯出對照表 CSV</button></p>
<h3>與臺北市查報資料研究的關係 <span class="tag t-pend">待討論</span></h3>
<div class="grid2">
  <div class="card"><h4>桃園契約</h4><p>範圍為桃園市；交付成果以 PCI 公式檢討、在地化參考指標與操作指引為主。屬機關內部測試與研究性質。</p></div>
  <div class="card"><h4>臺北市中山區查報資料</h4><p>用於方法開發及博士論文實證。決策樹、程度判斷方式兩邊可以共用，但兩地資料不互相替代，博士論文研究區域維持中山區。</p></div>
</div>`;

const HTML_DATA = `
<h2>3 既有資料與資料可用性</h2>
${LEGEND_BAR}
<div class="cards">
  <div class="card"><h4>A. 臺北市道路查報資料 ${TAG.have}</h4>
    <p>中山區及大同、松山、信義等區的多年查報資料。中山區為博士論文主要實證範圍，這個網頁不會擴大研究區域。</p>
    <ul>
      <li>案件編號、查報日期、座標、損壞情形、損壞狀況、案件狀態 ${TAG.have}</li>
      <li>查報來源、登錄人員：原始匯出檔有，整合資料庫尚未納入 ${TAG.pend}</li>
      <li>案件照片網址可否連線 ${TAG.pend}</li>
      <li>各年度、各來源的欄位完整度 ${TAG.pend}</li>
    </ul>
    <p class="hint">查報以廠商巡查為大宗；1999 交辦案件每區每年約數百件，其中可能包含塗鴉等非鋪面問題。</p>
  </div>
  <div class="card"><h4>B. 歷史 PCI 資料 ${TAG.have}</h4>
    <p>部分年度的道路 PCI 與調查單元資料，可用於歷史比較與方法驗證。</p>
    <ul><li>第一版熱點地圖不以 PCI 調查單元為必要條件</li><li>可作為選用圖層、對照資料或後續驗證</li></ul>
  </div>
  <div class="card"><h4>C. 道路維護與修復資料 ${TAG.pend}</h4>
    <p>已有部分工作單、契約數量與維護紀錄。</p>
    <ul><li>位置配對、實際施工範圍與案件的關聯仍不確定</li><li>行政結案不等於實際修復完成</li></ul>
  </div>
  <div class="card"><h4>D. 公開道路資料（OSM）${TAG.have}</h4>
    <p>Geofabrik taiwan-261024.osm.pbf，已讀取到臺灣道路線段幾何與屬性。本網頁的底圖即為其中的中山區可行車道路（不含 service 類）。</p>
    <ul>
      <li>主要道路多以兩條分向線繪製，沿路網計算前需要決定是否合併 ${TAG.pend}</li>
      <li>最窄的巷弄缺漏較多 ${TAG.pend}</li>
      <li>路寬可改用市府道路面資料 ${TAG.have}</li>
    </ul>
  </div>
  <div class="card"><h4>E. 損壞分類資料 ${TAG.have}</h4>
    <p>道路損壞分類教材、ASTM D6433 相關文件與巡查實務資料。</p>
    <ul><li>用於決策樹、輕中重程度分類、複合損壞紀錄與標準案例</li><li>不自行訂定標準未規定的門檻，簡易分類不稱為正式 ASTM PCI</li></ul>
  </div>
  <div class="card note"><h4>本網頁的示意資料</h4>
    <ul>
      <li>路網：OSM 實際道路線段（© OpenStreetMap contributors）</li>
      <li>案件、事件、修復紀錄：全部為程式產生的模擬資料，固定亂數種子</li>
      <li>模擬資料中的陳情比例刻意調高，方便展示陳情圖層；不代表實際比例</li>
      <li>可由右上角「匯入」改用 CSV 或 GeoJSON</li>
    </ul>
  </div>
</div>
<h3>資料結構（三層分開管理）${TAG.plan}</h3>
<div class="diagram"><svg viewBox="0 0 1000 200" role="img" aria-label="案件、事件、修復三層資料結構">
  <defs><marker id="ah0" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" fill="var(--ink2)"/></marker></defs>
  <g font-size="13" fill="var(--ink)">
    <rect x="20" y="20" width="280" height="160" rx="8" fill="var(--panel)" stroke="var(--line)"/>
    <text x="36" y="46" font-weight="700">查報案件 Report</text>
    <text x="36" y="72">案件編號、日期、來源</text><text x="36" y="94">描述、照片網址、座標</text><text x="36" y="116">行政狀態（結案／未結案）</text><text x="36" y="138">配對路段與距離</text>
    <rect x="360" y="20" width="280" height="160" rx="8" fill="var(--panel)" stroke="var(--accent)" stroke-width="2"/>
    <text x="376" y="46" font-weight="700">獨立損壞事件 DamageEvent</text>
    <text x="376" y="72">類型、程度（經判定）</text><text x="376" y="94">路段位置、首次發現日期</text><text x="376" y="116">修復狀態（7 種）</text><text x="376" y="138">再發自哪一事件</text>
    <rect x="700" y="20" width="280" height="160" rx="8" fill="var(--panel)" stroke="var(--line)"/>
    <text x="716" y="46" font-weight="700">修復紀錄 RepairRecord</text>
    <text x="716" y="72">日期、方式</text><text x="716" y="94">是否有修復證據</text><text x="716" y="116">資料來源（工作單、照片）</text>
    <line x1="300" y1="100" x2="356" y2="100" stroke="var(--ink2)" stroke-width="1.5" marker-end="url(#ah0)"/>
    <text x="305" y="92" font-size="11" fill="var(--ink2)">多對一</text>
    <line x1="700" y1="100" x2="644" y2="100" stroke="var(--ink2)" stroke-width="1.5" marker-end="url(#ah0)"/>
    <text x="652" y="92" font-size="11" fill="var(--ink2)">一對多</text>
  </g></svg></div>
<p class="hint">同一個坑洞的多筆陳情，在物理損壞分布中算一個事件，在陳情服務需求分布中保留每一筆。已確認修復的事件可以從「目前未修復」圖層排除，但案件與修復紀錄都不刪除。</p>`;

// ---------- 研究架構圖 ----------
function archSVG() {
  const box = (x, y, w, t, tag) => {
    const st = { have: ['var(--have)', 'var(--have-bg)', ''], pend: ['var(--pend)', 'var(--pend-bg)', ''], plan: ['var(--plan)', 'var(--plan-bg)', ''], none: ['var(--none)', 'var(--none-bg)', '5 4'], fixed: ['var(--contract)', 'var(--contract-bg)', ''] }[tag];
    return `<rect x="${x}" y="${y}" width="${w}" height="40" rx="6" fill="${st[1]}" stroke="${st[0]}" stroke-width="1.4" ${st[2] ? `stroke-dasharray="${st[2]}"` : ''}/>
      <text x="${x + w / 2}" y="${y + 25}" text-anchor="middle" font-size="13" fill="var(--ink)">${t}</text>`;
  };
  const col = (x, w, title, items) => `<text x="${x + w / 2}" y="34" text-anchor="middle" font-weight="700" font-size="14" fill="var(--ink)">${title}</text>` +
    items.map((it, i) => box(x, 52 + i * 52, w, it[0], it[1])).join('');
  const arrow = (x1, x2, y) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="var(--ink2)" stroke-width="2" marker-end="url(#ah1)"/>`;
  return `<svg viewBox="0 0 1180 470" xmlns="http://www.w3.org/2000/svg" font-family="Noto Sans TC, Microsoft JhengHei, sans-serif" role="img" aria-label="研究整體架構">
  <defs><marker id="ah1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0L10,5L0,10z" fill="var(--ink2)"/></marker></defs>
  ${col(20, 190, '既有資料', [['查報案件（四區）', 'have'], ['案件照片網址', 'pend'], ['歷史 PCI', 'have'], ['維護、修復紀錄', 'pend'], ['OSM 道路線段', 'have'], ['損壞分類教材、ASTM', 'have']])}
  ${arrow(214, 246, 200)}
  ${col(250, 210, '整理與標準化', [['損壞辨識決策樹', 'plan'], ['程度判斷、標準案例', 'plan'], ['案件／事件／修復分層', 'plan'], ['案件配對路網', 'plan'], ['修復狀態整理', 'plan']])}
  ${arrow(464, 496, 200)}
  ${col(500, 210, '分析', [['問卷一：辨識一致性', 'plan'], ['問卷二：管理權重', 'plan'], ['空間方法 A–F 比較', 'plan'], ['權重與敏感度分析', 'plan']])}
  ${arrow(714, 746, 200)}
  ${col(750, 200, '輸出（三者分開）', [['物理損壞分布', 'plan'], ['陳情與服務需求分布', 'plan'], ['年度更新候選關注程度', 'plan'], ['年度更新候選範圍', 'none']])}
  ${arrow(954, 976, 200)}
  ${col(980, 180, '驗證與交付', [['與 PCI 比對', 'none'], ['現場複查', 'none'], ['維護紀錄比對', 'none'], ['桃園契約交付成果', 'fixed']])}
  <rect x="20" y="380" width="1140" height="70" rx="8" fill="none" stroke="var(--line)"/>
  <text x="36" y="405" font-size="13" fill="var(--ink)" font-weight="700">回饋</text>
  <text x="36" y="430" font-size="13" fill="var(--ink2)">驗證結果回頭檢討決策樹、權重設定與空間方法的選擇；各階段可依資料取得狀況調整，不必等問卷完成才做地圖原型。</text>
  <g font-size="12" fill="var(--ink2)">
    <rect x="760" y="348" width="12" height="12" fill="var(--have-bg)" stroke="var(--have)"/><text x="776" y="358">已具備</text>
    <rect x="830" y="348" width="12" height="12" fill="var(--pend-bg)" stroke="var(--pend)"/><text x="846" y="358">待確認</text>
    <rect x="900" y="348" width="12" height="12" fill="var(--plan-bg)" stroke="var(--plan)"/><text x="916" y="358">規劃中</text>
    <rect x="970" y="348" width="12" height="12" fill="var(--none-bg)" stroke="var(--none)" stroke-dasharray="3 2"/><text x="986" y="358">尚未取得</text>
    <rect x="1050" y="348" width="12" height="12" fill="var(--contract-bg)" stroke="var(--contract)"/><text x="1066" y="358">契約</text>
  </g>
</svg>`;
}
const HTML_ARCH = () => `
<h2>4 研究整體架構</h2>
${LEGEND_BAR}
<div class="diagram" id="archDiagram">${archSVG()}</div>
<p class="noprint" style="margin-top:8px"><button data-export="arch">匯出架構圖 SVG</button></p>
<div class="grid3" style="margin-top:12px">
  <div class="card"><h4>熱點圖的角色</h4><p>提出候選範圍，不直接判定是否全面刨鋪。最後仍要對照道路現況、修復紀錄、工程可行性與更新範圍。</p></div>
  <div class="card"><h4>權重的角色</h4><p>權重只代表其定義下的評價目的，不是 PCI 扣分值。三種輸出分別使用不同的權重與問題。</p></div>
  <div class="card"><h4>PCI 的角色</h4><p>選用圖層、對照與驗證資料。第一版地圖不需要 PCI 調查單元；工程數量在候選範圍確定後，以道路長度、寬度估算。</p></div>
</div>`;

// ---------- 決策樹 ----------
const TREE = { q: '損壞是否位於鋪面本體？', o: [
  { a: '否，位於人手孔或其周邊', leaf: '人手孔缺失' },
  { a: '否，屬標線、側溝或其他設施', leaf: '非鋪面問題', nosev: true, note: '不納入鋪面損壞統計' },
  { a: '是', next: { q: '主要表現為何？', o: [
    { a: '表面材料缺失或凹洞', next: { q: '缺失形態？', o: [
      { a: '局部凹洞，邊緣明確', leaf: '坑洞' },
      { a: '表層成片脫離', leaf: '薄層剝離' },
      { a: '表面粒料脫落', leaf: '骨材剝落' }] } },
    { a: '裂縫', next: { q: '裂縫型態？', o: [
      { a: '單一或少數線狀裂縫（縱向或橫向）', leaf: '縱橫向裂縫' },
      { a: '相互連接成多邊形小塊', leaf: '龜裂', note: '與塊狀裂縫的分界依 ASTM D6433 定義' },
      { a: '相互連接成較大的矩形塊', leaf: '塊狀裂縫' },
      { a: '新月形', leaf: '滑溜裂縫' },
      { a: '沿車道與路肩交界', leaf: '車道與路肩分離' }] } },
    { a: '變形（下陷、隆起、起伏）', next: { q: '變形位置與形態？', o: [
      { a: '沿輪跡帶縱向下陷', leaf: '車轍' },
      { a: '規則的橫向起伏', leaf: '波浪狀鋪面' },
      { a: '局部隆起或凹陷', leaf: '隆起與凹陷' },
      { a: '受推擠形成局部隆起', leaf: '推擠' }] } },
    { a: '既有修補或管線回填範圍', leaf: '補綻及管線回填', note: '修補範圍內若另有損壞，另行記錄' },
    { a: '同時出現兩種以上', leaf: '複合損壞', note: '分別記錄各類型及程度，並標示主要類型' },
    { a: '照片無法判斷', leaf: '無法判定', nosev: true, note: '列入現場確認' }] } }] };

function treeOutline(node, path = []) {
  return `<ul>` + node.o.map((o, i) => {
    const p = [...path, i]; const id = 'tn-' + p.join('-');
    const inner = o.next ? `<span class="q">${o.next.q}</span>${treeOutline(o.next, p)}` : `→ <span class="leaf">${o.leaf}</span>${o.note ? ` <small class="muted">（${o.note}）</small>` : ''}`;
    return `<li id="${id}"><span class="ans">${o.a}</span>：${inner}</li>`;
  }).join('') + `</ul>`;
}
const HTML_TREE = () => `
<h2>5 損壞辨識決策樹示意 ${TAG.plan}</h2>
<p class="lead">左側逐題作答示範判讀流程，右側為完整樹狀結構。分類名稱取自臺北市查報系統與 ASTM D6433 的損壞類型；程度門檻將由教材及標準原文填入，這裡不列數值。</p>
<div class="callout">此為簡易分類流程，不是正式 ASTM PCI 調查。完整類型清單、各類型的輕中重定義，以標準及教材原文為準。</div>
<div class="grid2">
  <div class="stepper" id="stepper"></div>
  <div class="card tree" id="treeOutline"><div class="q">${TREE.q}</div>${treeOutline(TREE)}</div>
</div>`;

// ---------- 問卷 ----------
const SURVEY_METHODS = `
<table class="t">
<tr><th>方法</th><th>受訪者做什麼</th><th>可得到的資訊</th><th>受訪負擔</th><th>分析方式</th><th>狀態</th></tr>
<tr><td>情境式問卷</td><td>對描述好的道路情境回答優先性</td><td>各情境的優先順序</td><td>低</td><td>描述統計、排序比較</td><td>${TAG.plan}</td></tr>
<tr><td>離散選擇實驗（DCE）</td><td>在兩條以上的假設道路中選一條</td><td>屬性水準之間的取捨（相對效用）</td><td>中</td><td>條件 logit、混合 logit 等</td><td>${TAG.plan}</td></tr>
<tr><td>Best–Worst Scaling</td><td>在一組項目中選最重要與最不重要</td><td>項目的相對重要性</td><td>低至中</td><td>計數法、多項 logit</td><td>${TAG.plan}</td></tr>
<tr><td>MaxDiff</td><td>與 BWS 的項目型（case 1）相同</td><td>同上</td><td>低至中</td><td>同上</td><td>${TAG.plan}</td></tr>
<tr><td>情境評分及迴歸</td><td>對每個情境給分</td><td>各屬性對評分的影響</td><td>中</td><td>迴歸分析</td><td>${TAG.plan}</td></tr>
<tr><td>AHP（保留比較）</td><td>對準則兩兩比較</td><td>準則權重</td><td>準則多時比較次數多</td><td>特徵向量、一致性檢定</td><td>保留比較</td></tr>
</table>
<p class="hint">問卷結果尚未取得 ${TAG.none}。下方示範只記錄選擇，不估計模型。</p>`;

const HTML_SURVEY = `
<h2>6 兩階段問卷示意 ${TAG.plan}</h2>
${LEGEND_BAR}
<h3>第一階段：損壞辨識與程度判斷</h3>
<p>使用經確認的真實道路損壞照片，比較有無決策樹輔助時的判斷結果。參考答案由獨立專業判定建立，不直接使用查報文字作為正確答案 ${TAG.none}。</p>
<div class="grid2">
  <div>
    <div class="photo-ph" id="s1photo"><div>照片位置<br><small>待放入經確認的損壞照片（第 <b id="s1no">1</b> 題）</small></div></div>
  </div>
  <div class="card" id="s1form"></div>
</div>
<div class="tablewrap" style="margin-top:8px"><table class="t" id="s1log"><tr><th>題號</th><th>決策樹輔助</th><th>類型</th><th>程度</th><th>複合損壞</th><th>無法判定</th></tr></table></div>

<h3>第二階段：年度更新優先性與管理權重</h3>
<p>三種問題分開詢問、分開估計，不合併成同一套權重。下方以離散選擇卡示範；屬性水準為示意值。</p>
<div class="qtabs" id="s2tabs"></div>
<div class="grid2">
  <div id="s2card"></div>
  <div class="card"><h4>本題型已作答紀錄</h4><div id="s2log" class="muted">尚未作答</div></div>
</div>
<h3>Best–Worst Scaling 示範</h3>
<div class="grid2">
  <div class="card" id="bws"></div>
  <div class="card"><h4>計數（最重要 − 最不重要）</h4><div id="bwsLog" class="muted">尚未作答</div></div>
</div>
<h3>候選問卷方法比較</h3>
${SURVEY_METHODS}`;

// ---------- 方法比較表 ----------
const METHOD_INFO = {
  A: { name: '不加權查報分布', data: '案件座標', interp: '高：每一點就是一筆案件', cost: '低', net: '不需要', vis: '點多時重疊，難看出集中程度', use: '最基本的比較基準', limit: '若不區分重複陳情與獨立事件，容易高估' },
  B: { name: '加權平面 KDE', data: '案件座標、帶寬', interp: '中：需說明帶寬與核函數', cost: '低', net: '不需要', vis: '連續熱區，直觀', use: '初步找出區域，較難對應到具體路段', limit: '熱度會跨越相鄰道路與街廓內部；受帶寬影響' },
  C: { name: '道路網絡核密度（NKDE）', data: '案件座標、路網拓樸、案件配對', interp: '中：需說明網絡距離與交叉口處理', cost: '中至高（交叉口分流）', net: '高', vis: '強度沿道路呈現', use: '可直接對應到路段範圍', limit: '受路網品質、分向雙線、交叉口處理方式影響' },
  D: { name: '沿道路加權平滑', data: '案件座標、路名或線段', interp: '高：只在同一條路內平滑', cost: '中', net: '中（同名線段需連續）', vis: '以道路為單位呈現', use: '與「某條路某區間是否更新」的判斷方式接近', limit: '路口截斷時跨路口的相鄰損壞不互相影響；路名不一致會斷開' },
  E: { name: '不平滑的事件分布', data: '案件座標、事件屬性', interp: '高：保留原始細節', cost: '低', net: '低（配對即可）', vis: '細節完整，大範圍時雜亂', use: '候選範圍確認、現場複查', limit: '不提供集中程度的量化' },
  F: { name: '統計群聚或異常偵測（Gi* 示範）', data: '分析單位、背景暴露量', interp: '低至中：需解釋統計假設', cost: '中', net: '依分析單位定義', vis: '顯示統計上偏高的路段', use: '可作篩選輔助', limit: '需先定義分析單位與背景暴露量（道路長度、面積、交通量）；多重檢定與空間自相關假設須說明' }
};
function methodTableHTML() {
  const cols = [['data', '資料需求'], ['interp', '可解釋性'], ['cost', '計算難度'], ['net', '路網依賴性'], ['vis', '視覺效果'], ['use', '年度更新應用價值'], ['limit', '主要限制']];
  return `<div class="tablewrap"><table class="t" id="tblMethods"><tr><th>方法</th>${cols.map(c => `<th>${c[1]}</th>`).join('')}</tr>` +
    Object.entries(METHOD_INFO).map(([k, m]) => `<tr><td><b>${k}</b> ${m.name}</td>${cols.map(c => `<td>${m[c[0]]}</td>`).join('')}</tr>`).join('') + `</table></div>`;
}

// ---------- 執行步驟 ----------
const PHASES = [
  ['第一階段', '資料盤點及照片網址可用性檢查', 0, 2, '欄位完整度表、照片可用率'],
  ['第二階段', '損壞辨識決策樹與第一階段問卷', 1, 4, '決策樹初版、問卷一'],
  ['第三階段', '查報事件資料標準化及修復狀態整理', 1, 4, '案件／事件／修復資料表'],
  ['第四階段', '不加權查報地圖及基本時間篩選', 2, 4, '地圖原型 v1'],
  ['第五階段', '比較平面 KDE、道路網絡方法及不平滑事件分布', 3, 6, '方法比較結果'],
  ['第六階段', '第二階段問卷及候選權重推估', 4, 7, '問卷二、權重估計'],
  ['第七階段', '權重調整與年度更新候選區域示意', 5, 8, '候選範圍示意'],
  ['第八階段', '與 PCI、實際道路狀況及維護紀錄比較', 6, 9, '方法適用性與限制']
];
const HTML_PLAN = `
<h2>12 執行步驟、預期成果與待討論事項</h2>
<h3>執行順序 <small class="muted">（橫條為相對先後與可重疊程度，未定實際時程）</small></h3>
<div class="phases">${PHASES.map(p => `<div class="phase"><div class="n">${p[0]}</div><div>${p[1]}<div class="bars" style="margin-top:4px"><i style="left:${p[2] * 10}%;width:${(p[3] - p[2]) * 10}%"></i></div></div><div class="muted">${p[4]}</div></div>`).join('')}</div>
<p class="hint">各階段可依資料取得狀況調整，不必等全部問卷完成才開發地圖原型。</p>
<h3>預期成果 ${TAG.none}</h3>
<div class="grid3">
  <div class="card" style="border-color:var(--contract-line)"><h4>桃園115年度巡檢案 ${TAG.fixed}</h4><ul>
    <li>現行 PCI 公式與評價方式檢討</li><li>候選合理化調整方案及比較</li><li>損壞辨識決策樹</li><li>簡易程度判斷及標準案例</li><li>在地化參考指標或管理評價方法</li><li>案例驗證及適用性說明</li><li>供機關及未來巡查廠商參考的操作指引</li></ul></div>
  <div class="card"><h4>道路管理資訊應用</h4><ul>
    <li>多屬性查報事件資料架構</li><li>可調權重的互動式空間分布圖</li><li>查報、修復及再發的時間資訊</li><li>年度更新候選道路辨識方式</li><li>方法比較及敏感度分析</li></ul></div>
  <div class="card"><h4>博士論文可能延伸</h4><ul>
    <li>查報資料與實際道路狀況的一致性驗證</li><li>時空資料整合與可追溯事件關聯</li><li>查報資訊與 PCI 的互補性</li><li>道路維護需求辨識</li><li>與生命週期成本、採購模式評估的資訊銜接</li></ul></div>
</div>
<p class="hint">以上皆為候選成果，在驗證前不視為已完成或已證明有效。</p>
<h3>待討論事項</h3>
<table class="t">
<tr><th style="width:3em">#</th><th>議題</th><th style="width:22em">目前狀況</th></tr>
<tr><td>1</td><td>桃園在地化參考指標的形式：修正後 PCI、輔助指標或分級規則</td><td>${TAG.pend}</td></tr>
<tr><td>2</td><td>同一損壞事件的合併規則（距離、時間、類型）由誰判定、如何抽查</td><td>${TAG.pend}</td></tr>
<tr><td>3</td><td>修復完成的證據來源：工作單、施工照片或現場確認</td><td>${TAG.pend}</td></tr>
<tr><td>4</td><td>1999 案件中非鋪面問題（例如塗鴉）的篩選方式</td><td>${TAG.pend}</td></tr>
<tr><td>5</td><td>查報來源「隊部」應歸入哪一類</td><td>${TAG.pend}</td></tr>
<tr><td>6</td><td>OSM 主要道路的分向雙線是否合併為中心線</td><td>${TAG.pend}</td></tr>
<tr><td>7</td><td>問卷對象與樣本規模（機關人員、巡查廠商、學者專家）</td><td>${TAG.pend}</td></tr>
<tr><td>8</td><td>照片使用授權與個資遮蔽</td><td>${TAG.pend}</td></tr>
<tr><td>9</td><td>大同、松山、信義三區資料在博士論文中的角色（研究區域維持中山區）</td><td>${TAG.pend}</td></tr>
<tr><td>10</td><td>候選範圍提出後，現場複查與最終決定的分工</td><td>${TAG.pend}</td></tr>
</table>`;
