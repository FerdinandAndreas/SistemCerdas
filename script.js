/* ============================================================
   Simulasi Pencarian Dungeon RPG — script.js
   ============================================================ */

// ---------- Graph Data ----------
const NODES = [
  { id: 'Gerbang',       icon: '🛡️', x: 140, y: 200, lines: ['Gerbang', 'Masuk'] },
  { id: 'Ruang Jebakan', icon: '💣',  x: 110, y:  85, lines: ['Ruang',   'Jebakan'] },
  { id: 'Gudang Senjata',icon: '⚔️',  x: 130, y: 325, lines: ['Gudang',  'Senjata'] },
  { id: 'Lorong Utama',  icon: '🏛️',  x: 285, y: 185, lines: ['Lorong',  'Utama'] },
  { id: 'Ruang Harta',   icon: '💎',  x: 315, y: 310, lines: ['Ruang',   'Harta'] },
  { id: 'Aula Tengah',   icon: '🏰',  x: 440, y: 185, lines: ['Aula',    'Tengah'] },
  { id: 'Gua Bawah',     icon: '🦇',  x: 550, y: 135, lines: ['Gua',     'Bawah'] },
  { id: 'Ruang Rahasia', icon: '🗝️',  x: 495, y: 315, lines: ['Ruang',   'Rahasia'] },
  { id: 'Ruang Boss',    icon: '👑',  x: 650, y:  95, lines: ['Ruang',   'Boss'] }
];

const EDGES = [
  ['Gerbang',       'Ruang Jebakan',  32],
  ['Gerbang',       'Gudang Senjata', 29],
  ['Gerbang',       'Lorong Utama',   47],
  ['Lorong Utama',  'Ruang Harta',    28],
  ['Lorong Utama',  'Aula Tengah',    40],
  ['Ruang Harta',   'Aula Tengah',    39],
  ['Ruang Harta',   'Ruang Rahasia',  79],
  ['Aula Tengah',   'Gua Bawah',      24],
  ['Gua Bawah',     'Ruang Boss',     45],
  ['Gua Bawah',     'Ruang Rahasia',  61],
  ['Ruang Rahasia', 'Ruang Boss',     94]
];

// Heuristic straight-line estimate to Ruang Boss
const HEUR = {
  'Gerbang': 140, 'Ruang Jebakan': 155, 'Gudang Senjata': 160,
  'Lorong Utama': 100, 'Ruang Harta': 95, 'Aula Tengah': 60,
  'Gua Bawah': 40, 'Ruang Rahasia': 65, 'Ruang Boss': 0
};

const START = 'Gerbang';
const GOAL  = 'Ruang Boss';
const NS    = 'http://www.w3.org/2000/svg';

// Build adjacency list & distance map
const GRAPH = {};
const DIST  = {};

NODES.forEach(n => {
  GRAPH[n.id] = [];
  DIST[n.id]  = {};
});

EDGES.forEach(([a, b, w]) => {
  GRAPH[a].push(b);
  GRAPH[b].push(a);
  DIST[a][b] = w;
  DIST[b][a] = w;
});

// ---------- Helpers ----------
function sid(n) { return n.replace(/ /g, '_'); }

function totalDistance(path) {
  let t = 0;
  for (let i = 0; i < path.length - 1; i++) t += (DIST[path[i]][path[i + 1]] || 0);
  return t;
}

// ---------- Build SVG Graph ----------
function buildGraph() {
  const edgeG  = document.getElementById('edges-layer');
  const weightG = document.getElementById('weights-layer');
  const nodeG  = document.getElementById('nodes-layer');

  // Clear previous render
  edgeG.innerHTML = '';
  weightG.innerHTML = '';
  nodeG.innerHTML = '';

  // Render Edges
  const drawnEdges = new Set();
  EDGES.forEach(([a, b, w]) => {
    const key = [a, b].sort().join('|');
    if (drawnEdges.has(key)) return;
    drawnEdges.add(key);

    const na = NODES.find(n => n.id === a);
    const nb = NODES.find(n => n.id === b);

    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', na.x);
    line.setAttribute('y1', na.y);
    line.setAttribute('x2', nb.x);
    line.setAttribute('y2', nb.y);
    line.setAttribute('class', 'edge-line');
    line.dataset.a = a;
    line.dataset.b = b;
    edgeG.appendChild(line);

    // Weight badge
    const mx = (na.x + nb.x) / 2;
    const my = (na.y + nb.y) / 2;

    const bgRect = document.createElementNS(NS, 'rect');
    bgRect.setAttribute('x', mx - 16);
    bgRect.setAttribute('y', my - 9);
    bgRect.setAttribute('width', '32');
    bgRect.setAttribute('height', '18');
    bgRect.setAttribute('rx', '4');
    bgRect.setAttribute('class', 'edge-weight-bg');
    weightG.appendChild(bgRect);

    const txt = document.createElementNS(NS, 'text');
    txt.setAttribute('x', mx);
    txt.setAttribute('y', my);
    txt.setAttribute('class', 'edge-weight-text');
    txt.textContent = w + 'm';
    weightG.appendChild(txt);
  });

  // Render Nodes
  NODES.forEach(n => {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'node-group c-unvisited');
    g.id = 'node-' + sid(n.id);
    g.onclick = () => selectNode(n.id);

    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', n.x);
    circle.setAttribute('cy', n.y);
    circle.setAttribute('r', 34);
    circle.setAttribute('class', 'node-circle-bg');
    g.appendChild(circle);

    const icon = document.createElementNS(NS, 'text');
    icon.setAttribute('x', n.x);
    icon.setAttribute('y', n.y - 10);
    icon.setAttribute('class', 'node-icon');
    icon.textContent = n.icon;
    g.appendChild(icon);

    n.lines.forEach((ln, i) => {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('class', 'node-text-title');
      t.setAttribute('x', n.x);
      t.setAttribute('y', n.y + 7 + i * 11);
      t.textContent = ln;
      g.appendChild(t);
    });

    const flabel = document.createElementNS(NS, 'text');
    flabel.setAttribute('class', 'node-f-label');
    flabel.setAttribute('x', n.x);
    flabel.setAttribute('y', n.y + 46);
    flabel.id = 'f-' + sid(n.id);
    g.appendChild(flabel);

    nodeG.appendChild(g);
  });
}

// ============================================================
// Algorithm: BFS (Breadth-First Search — Queue / FIFO)
// ============================================================
function runBFS() {
  const queue   = [[START]];
  const visited = [];
  const frames  = [];
  let step = 0;

  while (queue.length > 0) {
    const path = queue.shift();
    const node = path[path.length - 1];
    step++;

    const frontierNodes = queue.map(p => p[p.length - 1]);

    frames.push({
      step,
      algo: 'BFS',
      caption: `BFS Langkah ${step}: Memproses '${node}'`,
      sub: `Antrian saat ini: [${frontierNodes.map(x => "'" + x + "'").join(', ')}]`,
      current: node,
      visited: visited.slice(),
      frontier: frontierNodes.slice(),
      frontierDetails: queue.map((p, idx) => ({
        name: p[p.length - 1],
        label: `${idx === 0 ? '[Depan Antrian] ' : ''}Jalur: ${p.join(' -> ')}`
      })),
      pathSoFar: path
    });

    if (node === GOAL) {
      const dist = totalDistance(path);
      frames.push({
        step: step + 1, algo: 'BFS',
        caption: `Sampai! Jalur BFS: ${path.join(' -> ')}`,
        sub: `Total jarak ${dist} meter (${path.length - 1} ruangan dilalui).`,
        current: null, visited: path, frontier: [], frontierDetails: [],
        final: true, path, totalDist: dist
      });
      return frames;
    }

    if (!visited.includes(node)) visited.push(node);

    GRAPH[node].forEach(nb => {
      if (!path.includes(nb)) queue.push(path.concat([nb]));
    });
  }
  return frames;
}

// ============================================================
// Algorithm: DFS (Depth-First Search — Stack / LIFO)
// ============================================================
function runDFS() {
  const stack   = [[START]];
  const visited = [];
  const frames  = [];
  let step = 0;

  while (stack.length > 0) {
    const path = stack.pop();
    const node = path[path.length - 1];
    step++;

    const frontierNodes = stack.map(p => p[p.length - 1]);

    frames.push({
      step,
      algo: 'DFS',
      caption: `DFS Langkah ${step}: Memproses '${node}'`,
      sub: `Tumpukan (atas): [${frontierNodes.slice().reverse().map(x => "'" + x + "'").join(', ')}]`,
      current: node,
      visited: visited.slice(),
      frontier: frontierNodes.slice(),
      frontierDetails: stack.slice().reverse().map((p, idx) => ({
        name: p[p.length - 1],
        label: `${idx === 0 ? '[Paling Atas] ' : ''}Jalur: ${p.join(' -> ')}`
      })),
      pathSoFar: path
    });

    if (node === GOAL) {
      const dist = totalDistance(path);
      frames.push({
        step: step + 1, algo: 'DFS',
        caption: `Sampai! Jalur DFS: ${path.join(' -> ')}`,
        sub: `Total jarak ${dist} meter (DFS menjelajah cabang hingga terdalam).`,
        current: null, visited: path, frontier: [], frontierDetails: [],
        final: true, path, totalDist: dist
      });
      return frames;
    }

    if (!visited.includes(node)) visited.push(node);

    // Push neighbors in array order so last neighbor sits on top of stack
    GRAPH[node].forEach(nb => {
      if (!path.includes(nb)) stack.push(path.concat([nb]));
    });
  }
  return frames;
}

// ============================================================
// Algorithm: A* (Priority Queue — f(n) = g(n) + h(n))
// ============================================================
function runAstar() {
  let openList = [{ node: START, g: 0, h: HEUR[START], f: HEUR[START], path: [START] }];
  const visited = [];
  const frames  = [];
  let step = 0;

  while (openList.length > 0) {
    openList.sort((a, b) => a.f - b.f || a.h - b.h);
    const cur  = openList.shift();
    const node = cur.node;
    const path = cur.path;
    step++;

    const frontierNodes = openList.map(o => o.node);
    const fMap = {};
    openList.forEach(o => { fMap[o.node] = `f=${o.f}`; });
    fMap[node] = `f=${cur.f}`;

    frames.push({
      step,
      algo: 'A*',
      caption: `A*: Proses '${node}' (f = ${cur.f} = g ${cur.g} + h ${HEUR[node]})`,
      sub: `Daftar terbuka: [${frontierNodes.map(x => "'" + x + "'").join(', ')}]`,
      current: node,
      visited: visited.slice(),
      frontier: frontierNodes.slice(),
      frontierDetails: openList.map(o => ({
        name: o.node,
        label: `f=${o.f} (g=${o.g} + h=${o.h}) | Jalur: ${o.path.join(' -> ')}`
      })),
      fLabels: fMap,
      pathSoFar: path
    });

    if (node === GOAL) {
      frames.push({
        step: step + 1, algo: 'A*',
        caption: `Sampai! Jalur A*: ${path.join(' -> ')} (OPTIMAL)`,
        sub: `Total jarak ${cur.g} meter (A* menjamin rute terpendek dengan fungsi heuristik).`,
        current: null, visited: path, frontier: [], frontierDetails: [],
        fLabels: { [GOAL]: `f=${cur.g} (OPTIMAL)` },
        final: true, path, totalDist: cur.g
      });
      return frames;
    }

    if (!visited.includes(node)) visited.push(node);

    Object.keys(DIST[node]).forEach(nb => {
      if (path.includes(nb)) return;
      const newG = cur.g + DIST[node][nb];
      const newH = HEUR[nb];
      const newF = newG + newH;
      const existing = openList.findIndex(o => o.node === nb);
      if (existing === -1) {
        openList.push({ node: nb, g: newG, h: newH, f: newF, path: path.concat([nb]) });
      } else if (newG < openList[existing].g) {
        openList[existing] = { node: nb, g: newG, h: newH, f: newF, path: path.concat([nb]) };
      }
    });
  }
  return frames;
}

// ============================================================
// Simulation Controller
// ============================================================
let currentAlgo   = 'bfs';
let frames        = [];
let idx           = 0;
let playing       = false;
let timer         = null;
let playbackSpeed = 800;

function setAlgo(algo) {
  stopPlay();
  currentAlgo = algo;

  if (algo === 'bfs')        frames = runBFS();
  else if (algo === 'dfs')   frames = runDFS();
  else                        frames = runAstar();

  idx = 0;

  // Update tab active classes
  ['bfs', 'dfs', 'astar'].forEach(a => {
    document.getElementById('tab-' + a).className =
      'algo-tab' + (a === algo ? ` active-${a}` : '');
  });

  // Update progress bar color per algorithm
  const bar = document.getElementById('progress-bar');
  if (bar) {
    const colors = {
      bfs:   'linear-gradient(90deg, #06b6d4, #6366f1)',
      dfs:   'linear-gradient(90deg, #a855f7, #ec4899)',
      astar: 'linear-gradient(90deg, #f59e0b, #ef4444)'
    };
    bar.style.background = colors[algo];
  }

  // Update algorithm info panel
  const strategyEl = document.getElementById('info-strategy');
  const optimalEl  = document.getElementById('info-optimal');
  const dsEl       = document.getElementById('info-ds');
  const fTitle     = document.getElementById('frontier-title');

  const svgQueue = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M3 9h18"/></svg>`;
  const svgStack = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19h16"/><path d="M4 15h16"/><path d="M4 11h16"/><path d="M4 7h16"/></svg>`;
  const svgStar  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

  if (algo === 'bfs') {
    strategyEl.textContent = 'FIFO (First-In First-Out)';
    optimalEl.textContent  = 'Optimal pada jumlah langkah';
    dsEl.textContent       = 'Queue (Antrian)';
    fTitle.innerHTML       = svgQueue + ' Daftar Antrian (Queue)';
  } else if (algo === 'dfs') {
    strategyEl.textContent = 'LIFO (Last-In First-Out)';
    optimalEl.textContent  = 'Tidak menjamin optimalitas jarak';
    dsEl.textContent       = 'Stack (Tumpukan)';
    fTitle.innerHTML       = svgStack + ' Daftar Tumpukan (Stack)';
  } else {
    strategyEl.textContent = 'Evaluasi f(n) = g(n) + h(n)';
    optimalEl.textContent  = 'Jaminan Rute Terpendek (Optimal)';
    dsEl.textContent       = 'Priority Queue (Min-Heap)';
    fTitle.innerHTML       = svgStar + ' Open List (Priority Queue)';
  }

  render();
}

// ---------- Render a single frame ----------
function render() {
  if (!frames || frames.length === 0) return;
  const frame = frames[idx];

  document.getElementById('caption').textContent    = frame.caption;
  document.getElementById('subcaption').textContent = frame.sub;
  document.getElementById('step-label').textContent =
    `Langkah ${idx + 1} / ${frames.length}`;

  // Progress bar
  const bar = document.getElementById('progress-bar');
  if (bar) bar.style.width = ((idx + 1) / frames.length * 100) + '%';

  // Result badge
  const badgeContainer = document.getElementById('result-badge-container');
  if (frame.final) {
    badgeContainer.innerHTML =
      `<div class="badge-result">Selesai: Total Jarak ${frame.totalDist} meter</div>`;
    document.getElementById('info-distance').textContent = `${frame.totalDist} meter`;
  } else {
    badgeContainer.innerHTML = '';
    document.getElementById('info-distance').textContent =
      frame.pathSoFar ? `${totalDistance(frame.pathSoFar)} m (sementara)` : '-';
  }

  // Update SVG nodes
  NODES.forEach(n => {
    const g = document.getElementById('node-' + sid(n.id));
    let state = 'c-unvisited';
    if      (frame.final && frame.path.includes(n.id)) state = 'c-final';
    else if (n.id === frame.current)                    state = 'c-current';
    else if (frame.visited.includes(n.id))              state = 'c-visited';
    else if (frame.frontier.includes(n.id))             state = 'c-frontier';
    g.setAttribute('class', `node-group ${state}`);

    const flabel = document.getElementById('f-' + sid(n.id));
    if      (frame.fLabels && frame.fLabels[n.id] !== undefined) flabel.textContent = frame.fLabels[n.id];
    else if (currentAlgo === 'astar')                             flabel.textContent = `h=${HEUR[n.id]}`;
    else                                                          flabel.textContent = '';
  });

  // Update SVG edges
  document.querySelectorAll('#edges-layer line').forEach(line => {
    const a = line.dataset.a;
    const b = line.dataset.b;
    let inPath = false;

    const pathArr = frame.final ? frame.path : (frame.pathSoFar || []);
    for (let i = 0; i < pathArr.length - 1; i++) {
      if ((pathArr[i] === a && pathArr[i+1] === b) ||
          (pathArr[i] === b && pathArr[i+1] === a)) {
        inPath = true; break;
      }
    }
    line.setAttribute('class', inPath ? 'edge-line in-path' : 'edge-line');
  });

  // Update frontier sidebar
  const frontierList = document.getElementById('frontier-items');
  frontierList.innerHTML = '';
  if (frame.frontierDetails && frame.frontierDetails.length > 0) {
    frame.frontierDetails.forEach((item, i) => {
      const div = document.createElement('div');
      div.className = 'frontier-item' + (i === 0 ? ' highlight-head' : '');
      div.innerHTML = `
        <div class="frontier-header">
          <span class="frontier-name">
            <span style="color:var(--color-frontier);font-size:10px;">●</span>
            ${item.name}
          </span>
        </div>
        <span class="frontier-val">${item.label}</span>
      `;
      frontierList.appendChild(div);
    });
  } else {
    frontierList.innerHTML =
      `<div class="empty-msg">${frame.final ? 'Pencarian selesai' : 'Frontier / Antrian kosong'}</div>`;
  }

  // Disable / enable nav buttons
  document.getElementById('btn-prev').disabled = idx === 0;
  document.getElementById('btn-next').disabled = idx === frames.length - 1;
}

// ---------- Playback controls ----------
function stepForward() {
  if (idx < frames.length - 1) { idx++; render(); }
  else stopPlay();
}

function stepBack() {
  if (idx > 0) { idx--; render(); }
}

function resetSim() {
  stopPlay();
  idx = 0;
  render();
}

function togglePlay() {
  playing ? stopPlay() : startPlay();
}

function startPlay() {
  if (idx >= frames.length - 1) idx = 0;
  playing = true;
  document.getElementById('play-icon').innerHTML =
    '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
  timer = setInterval(() => {
    if (idx >= frames.length - 1) { stopPlay(); return; }
    idx++;
    render();
  }, playbackSpeed);
  render();
}

function stopPlay() {
  playing = false;
  clearInterval(timer);
  document.getElementById('play-icon').innerHTML =
    '<polygon points="6 4 20 12 6 20 6 4"/>';
}

function changeSpeed(val) {
  playbackSpeed = parseInt(val, 10);
  if (playing) {
    clearInterval(timer);
    timer = setInterval(() => {
      if (idx >= frames.length - 1) { stopPlay(); return; }
      idx++;
      render();
    }, playbackSpeed);
  }
}

function selectNode(id) {
  const node      = NODES.find(n => n.id === id);
  const neighbors = GRAPH[id].map(nb => `${nb} (${DIST[id][nb]}m)`).join(', ');
  alert(
    `Ruangan : ${node.id}\n` +
    `Heuristik h(n) : ${HEUR[id]}m ke Ruang Boss\n` +
    `Tetangga : ${neighbors}`
  );
}

// ---------- Init ----------
buildGraph();
setAlgo('bfs');
