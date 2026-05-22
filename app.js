const state = {
  puzzle: null,
  showAnswers: false,
  checked: false,
};

const els = {
  board: document.querySelector("#board"),
  equationList: document.querySelector("#equationList"),
  summary: document.querySelector("#summary"),
  gridSize: document.querySelector("#gridSize"),
  maxResult: document.querySelector("#maxResult"),
  maxEquations: document.querySelector("#maxEquations"),
  blankRatio: document.querySelector("#blankRatio"),
  blankRatioLabel: document.querySelector("#blankRatioLabel"),
  generateButton: document.querySelector("#generateButton"),
  checkButton: document.querySelector("#checkButton"),
  clearButton: document.querySelector("#clearButton"),
  toggleAnswerButton: document.querySelector("#toggleAnswerButton"),
  feedback: document.querySelector("#feedback"),
};

const OPERATORS = ["+", "-", "×", "÷"];
const LATTICE_STEP = 4;

function createCell() {
  return {
    value: "",
    type: "empty",
    hidden: false,
    answer: "",
  };
}

function makeGrid(size) {
  return Array.from({ length: size }, () => Array.from({ length: size }, createCell));
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function cellKey(row, col) {
  return `${row},${col}`;
}

function getSelectedOperators() {
  const selected = [...document.querySelectorAll("input[name='operator']:checked")].map(
    (input) => input.value,
  );
  return selected.length ? selected : [...OPERATORS];
}

function getConfig() {
  const size = Number(els.gridSize.value);
  const maxEdges = maxEquationCountForSize(size);
  return {
    size,
    maxResult: clamp(Number(els.maxResult.value) || 100, 10, 999),
    maxEquations: clamp(Number(els.maxEquations.value) || maxEdges, 4, maxEdges),
    blankRatio: clamp(Number(els.blankRatio.value) || 60, 30, 85) / 100,
    operators: getSelectedOperators(),
  };
}

function maxEquationCountForSize(size) {
  const nodeCount = Math.floor((size - 1) / LATTICE_STEP) + 1;
  const latticeEdges = 2 * nodeCount * (nodeCount - 1);
  return Math.min(120, latticeEdges + Math.round(size * 1.4));
}

function latticeEquationCountForSize(size) {
  const nodeCount = Math.floor((size - 1) / LATTICE_STEP) + 1;
  return 2 * nodeCount * (nodeCount - 1);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function validNode(row, col, size) {
  return row >= 0 && col >= 0 && row < size && col < size && row % LATTICE_STEP === 0 && col % LATTICE_STEP === 0;
}

function getNeighbors(node, size) {
  return [
    { row: node.row, col: node.col + LATTICE_STEP, direction: "right" },
    { row: node.row + LATTICE_STEP, col: node.col, direction: "down" },
    { row: node.row, col: node.col - LATTICE_STEP, direction: "left" },
    { row: node.row - LATTICE_STEP, col: node.col, direction: "up" },
  ].filter((next) => validNode(next.row, next.col, size));
}

function linePositions(start, end) {
  const dr = Math.sign(end.row - start.row);
  const dc = Math.sign(end.col - start.col);
  return Array.from({ length: 5 }, (_, index) => ({
    row: start.row + dr * index,
    col: start.col + dc * index,
  }));
}

function candidateEquations(startValue, targetValue, config) {
  const candidates = [];
  const ops = shuffle(config.operators);

  for (const op of ops) {
    if (op === "+") {
      if (targetValue === undefined) {
        for (let operand = 1; operand <= config.maxResult - startValue; operand += 1) {
          candidates.push({ operator: op, operand, result: startValue + operand });
        }
      } else {
        const operand = targetValue - startValue;
        if (operand > 0) candidates.push({ operator: op, operand, result: targetValue });
      }
    }

    if (op === "-") {
      if (targetValue === undefined) {
        for (let operand = 1; operand < startValue; operand += 1) {
          candidates.push({ operator: op, operand, result: startValue - operand });
        }
      } else {
        const operand = startValue - targetValue;
        if (operand > 0) candidates.push({ operator: op, operand, result: targetValue });
      }
    }

    if (op === "×") {
      if (targetValue === undefined) {
        for (let operand = 2; operand <= Math.floor(config.maxResult / startValue); operand += 1) {
          candidates.push({ operator: op, operand, result: startValue * operand });
        }
      } else if (targetValue > startValue && targetValue % startValue === 0) {
        const operand = targetValue / startValue;
        if (operand > 1) candidates.push({ operator: op, operand, result: targetValue });
      }
    }

    if (op === "÷") {
      if (targetValue === undefined) {
        for (let operand = 2; operand < startValue; operand += 1) {
          if (startValue % operand === 0) {
            candidates.push({ operator: op, operand, result: startValue / operand });
          }
        }
      } else if (targetValue > 0 && targetValue < startValue && startValue % targetValue === 0) {
        const operand = startValue / targetValue;
        if (operand > 1) candidates.push({ operator: op, operand, result: targetValue });
      }
    }
  }

  return shuffle(candidates).filter((item) => item.result >= 1 && item.result <= config.maxResult);
}

function canPlace(grid, positions, equation) {
  const values = [
    String(equation.start),
    equation.operator,
    String(equation.operand),
    "=",
    String(equation.result),
  ];

  return positions.every((pos, index) => {
    const cell = grid[pos.row][pos.col];
    return !cell.value || cell.value === values[index];
  });
}

function placeEquation(grid, positions, equation) {
  const payload = [
    { value: String(equation.start), type: "number" },
    { value: equation.operator, type: "operator" },
    { value: String(equation.operand), type: "number" },
    { value: "=", type: "equal" },
    { value: String(equation.result), type: "number" },
  ];

  positions.forEach((pos, index) => {
    Object.assign(grid[pos.row][pos.col], payload[index], {
      hidden: false,
      answer: payload[index].value,
      userAnswer: "",
      status: "",
    });
  });
}

function generatePuzzle(config) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const grid = makeGrid(config.size);
    const equations = [];
    const startValue = randomInt(2, Math.min(config.maxResult, 30));
    grid[0][0] = { value: String(startValue), type: "number", hidden: false, answer: String(startValue) };

    const queue = [{ row: 0, col: 0 }];
    const visitedEdges = new Set();
    let cursor = 0;

    while (cursor < queue.length && equations.length < config.maxEquations) {
      const startNode = queue[cursor];
      cursor += 1;

      for (const endNode of shuffle(getNeighbors(startNode, config.size))) {
        if (equations.length >= config.maxEquations) break;
        const placed = tryPlaceEdge(grid, equations, visitedEdges, startNode, endNode, config);
        if (placed && placed.targetWasEmpty) queue.push({ row: endNode.row, col: endNode.col });
      }
    }

    fillRemainingEdges(grid, equations, visitedEdges, config);
    fillSparseRowsAndColumns(grid, equations, config);

    const targetFloor = Math.min(config.maxEquations, latticeEquationCountForSize(config.size) + Math.floor(config.size * 0.6));
    if (equations.length >= Math.max(8, targetFloor) && reviewGrid(grid, equations, config)) {
      applySimpleBlanks(grid, equations, config.blankRatio);
      return { grid, equations };
    }
  }

  throw new Error("生成失败，请减少算式数量或放宽结果上限。");
}

function tryPlaceEdge(grid, equations, visitedEdges, startNode, endNode, config) {
  const edgeId = [cellKey(startNode.row, startNode.col), cellKey(endNode.row, endNode.col)].sort().join("|");
  if (visitedEdges.has(edgeId)) return null;

  const positions = linePositions(startNode, endNode);
  const middleCellsClear = positions.slice(1, 4).every((pos) => !grid[pos.row][pos.col].value);
  if (!middleCellsClear) return null;

  const start = Number(grid[startNode.row][startNode.col].value);
  if (!start) return null;

  const targetCell = grid[endNode.row][endNode.col];
  const targetWasEmpty = !targetCell.value;
  const target = targetCell.value ? Number(targetCell.value) : undefined;
  const candidate = candidateEquations(start, target, config).find((item) =>
    canPlace(grid, positions, { ...item, start }),
  );

  if (!candidate) return null;

  const equation = {
    start,
    operator: candidate.operator,
    operand: candidate.operand,
    result: candidate.result,
    positions,
  };

  placeEquation(grid, positions, equation);
  equations.push(equation);
  visitedEdges.add(edgeId);

  return { targetWasEmpty };
}

function fillRemainingEdges(grid, equations, visitedEdges, config) {
  let madeProgress = true;

  while (madeProgress && equations.length < config.maxEquations) {
    madeProgress = false;
    const nodes = [];

    for (let row = 0; row < config.size; row += LATTICE_STEP) {
      for (let col = 0; col < config.size; col += LATTICE_STEP) {
        if (grid[row][col].value) nodes.push({ row, col });
      }
    }

    for (const node of shuffle(nodes)) {
      for (const endNode of shuffle(getNeighbors(node, config.size))) {
        if (equations.length >= config.maxEquations) return;
        const placed = tryPlaceEdge(grid, equations, visitedEdges, node, endNode, config);
        if (placed) madeProgress = true;
      }
    }
  }
}

function fillSparseRowsAndColumns(grid, equations, config) {
  let madeProgress = true;
  let passes = 0;

  while (madeProgress && equations.length < config.maxEquations && passes < 8) {
    madeProgress = false;
    passes += 1;

    const windows = collectSupplementalWindows(grid, config.size);
    for (const item of windows) {
      if (equations.length >= config.maxEquations) return;
      const equation = createEquationForWindow(grid, item.positions, config);
      if (!equation) continue;

      placeEquation(grid, item.positions, equation);
      equations.push({ ...equation, positions: item.positions, supplemental: true });
      madeProgress = true;
    }
  }
}

function collectSupplementalWindows(grid, size) {
  const windows = [];

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col <= size - 5; col += 1) {
      const positions = Array.from({ length: 5 }, (_, index) => ({ row, col: col + index }));
      const score = scoreSupplementalWindow(grid, positions);
      if (score > 0) windows.push({ positions, score });
    }
  }

  for (let col = 0; col < size; col += 1) {
    for (let row = 0; row <= size - 5; row += 1) {
      const positions = Array.from({ length: 5 }, (_, index) => ({ row: row + index, col }));
      const score = scoreSupplementalWindow(grid, positions);
      if (score > 0) windows.push({ positions, score });
    }
  }

  return shuffle(windows).sort((a, b) => b.score - a.score);
}

function scoreSupplementalWindow(grid, positions) {
  let emptyCount = 0;
  let numberIntersections = 0;

  for (let index = 0; index < positions.length; index += 1) {
    const cell = grid[positions[index].row][positions[index].col];
    const needsNumber = index === 0 || index === 2 || index === 4;
    const needsOperator = index === 1;
    const needsEqual = index === 3;

    if (!cell.value) {
      emptyCount += 1;
      continue;
    }

    if (needsNumber && cell.type === "number") {
      numberIntersections += 1;
      continue;
    }

    if (needsOperator && cell.type === "operator") continue;
    if (needsEqual && cell.type === "equal") continue;

    return 0;
  }

  if (emptyCount < 3) return 0;
  return emptyCount * 10 + numberIntersections * 4;
}

function createEquationForWindow(grid, positions, config) {
  const fixed = positions.map((pos) => grid[pos.row][pos.col].value || "");
  const operatorOptions = fixed[1] ? [fixed[1]] : config.operators;
  const starts = fixed[0] ? [Number(fixed[0])] : Array.from({ length: config.maxResult }, (_, index) => index + 1);
  const operands = fixed[2] ? [Number(fixed[2])] : Array.from({ length: config.maxResult }, (_, index) => index + 1);
  const results = fixed[4] ? [Number(fixed[4])] : null;
  const candidates = [];

  if (fixed[3] && fixed[3] !== "=") return null;
  if (starts.some((value) => !Number.isFinite(value))) return null;
  if (operands.some((value) => !Number.isFinite(value))) return null;
  if (results && results.some((value) => !Number.isFinite(value))) return null;

  for (const start of starts) {
    for (const operator of operatorOptions) {
      for (const operand of operands) {
        const result = calculateResult(start, operator, operand);
        if (!Number.isInteger(result) || result < 1 || result > config.maxResult) continue;
        if (results && !results.includes(result)) continue;
        candidates.push({ start, operator, operand, result });
      }
    }
  }

  return shuffle(candidates)[0] || null;
}

function calculateResult(start, operator, operand) {
  if (operator === "+") return start + operand;
  if (operator === "-" && operand < start) return start - operand;
  if (operator === "×" && operand > 1) return start * operand;
  if (operator === "÷" && operand > 1 && start % operand === 0) return start / operand;
  return NaN;
}

function reviewGrid(grid, equations, config) {
  return equations.every((equation) => {
    if (equation.result > config.maxResult) return false;
    if (equation.operator === "÷" && equation.start % equation.operand !== 0) return false;
    if (equation.operator === "+" && equation.start + equation.operand !== equation.result) return false;
    if (equation.operator === "-" && equation.start - equation.operand !== equation.result) return false;
    if (equation.operator === "×" && equation.start * equation.operand !== equation.result) return false;
    if (equation.operator === "÷" && equation.start / equation.operand !== equation.result) return false;
    return equation.positions.every((pos) => grid[pos.row][pos.col].value);
  });
}

function applySimpleBlanks(grid, equations, blankRatio) {
  const equationBlankCounts = new Map();
  const cellToEquations = new Map();

  equations.forEach((equation, equationIndex) => {
    equationBlankCounts.set(equationIndex, 0);
    equation.positions.forEach((pos, posIndex) => {
      if (posIndex === 3) return;
      const key = cellKey(pos.row, pos.col);
      if (!cellToEquations.has(key)) cellToEquations.set(key, []);
      cellToEquations.get(key).push(equationIndex);
    });
  });

  const maxBlanksPerEquation = 2;
  const targetBlankCount = Math.max(equations.length, Math.round(equations.length * maxBlanksPerEquation * blankRatio));
  const candidates = shuffle([...cellToEquations.keys()]);
  let blanks = 0;

  for (const key of candidates) {
    if (blanks >= targetBlankCount) break;

    const linked = cellToEquations.get(key);
    if (linked.some((equationIndex) => equationBlankCounts.get(equationIndex) >= maxBlanksPerEquation)) continue;

    const [row, col] = key.split(",").map(Number);
    const cell = grid[row][col];
    if (!cell.value || cell.value === "=") continue;

    cell.hidden = true;
    cell.answer = cell.value;
    cell.userAnswer = "";
    cell.status = "";
    linked.forEach((equationIndex) => {
      equationBlankCounts.set(equationIndex, equationBlankCounts.get(equationIndex) + 1);
    });
    blanks += 1;
  }
}

function renderPuzzle() {
  const { grid, equations } = state.puzzle;
  els.board.style.setProperty("--size", grid.length);
  const tracks = getCompactTracks(grid);
  els.board.style.gridTemplateColumns = tracks.cols.join(" ");
  els.board.style.gridTemplateRows = tracks.rows.join(" ");
  els.board.innerHTML = "";

  grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
    if (!cell.value) return;

    const node = document.createElement("div");
    const opClass = cell.value === "+" || cell.value === "×" ? "up" : cell.value === "-" || cell.value === "÷" ? "down" : "";
    node.className = [
      "cell",
      cell.type,
      opClass,
      cell.hidden ? "blank" : "",
      cell.hidden && state.showAnswers ? "reveal" : "",
      cell.hidden && state.checked ? cell.status : "",
    ]
      .filter(Boolean)
      .join(" ");
    node.style.gridRow = String(rowIndex + 1);
    node.style.gridColumn = String(colIndex + 1);

    if (cell.hidden && !state.showAnswers) {
      const input = document.createElement("input");
      input.className = "answer-input";
      input.value = cell.userAnswer || "";
      input.placeholder = "?";
      input.maxLength = cell.type === "operator" ? 1 : 3;
      input.inputMode = cell.type === "number" ? "numeric" : "text";
      input.setAttribute("aria-label", `填空 ${rowIndex + 1}-${colIndex + 1}`);
      input.addEventListener("input", () => {
        cell.userAnswer = input.value;
        cell.status = "";
        state.checked = false;
        els.feedback.textContent = "";
      });
      node.append(input);
      node.addEventListener("click", () => input.focus());
    } else {
      node.textContent = cell.hidden && !state.showAnswers ? "" : cell.value;
    }

    els.board.append(node);
    });
  });

  const blankCount = grid.flat().filter((cell) => cell.hidden).length;
  els.summary.textContent = `${grid.length} x ${grid.length}，${equations.length} 条算式，${blankCount} 个填空。`;
  els.equationList.classList.toggle("hidden-answer", !state.showAnswers);
  els.equationList.innerHTML = equations
    .map(
      (item, index) =>
        `<div class="equation-item">${index + 1}. ${item.start} ${item.operator} ${item.operand} = ${item.result}</div>`,
    )
    .join("");
  els.toggleAnswerButton.textContent = state.showAnswers ? "隐藏答案" : "显示答案";
}

function getCompactTracks(grid) {
  const size = grid.length;
  const rowCounts = grid.map((row) => row.filter((cell) => cell.value).length);
  const colCounts = Array.from({ length: size }, (_, col) =>
    grid.reduce((count, row) => count + (row[col].value ? 1 : 0), 0),
  );

  return {
    rows: rowCounts.map((count) => (count === 0 ? "8px" : count <= 2 ? "34px" : "52px")),
    cols: colCounts.map((count) => (count === 0 ? "8px" : count <= 2 ? "34px" : "52px")),
  };
}

function normalizeAnswer(value) {
  return String(value)
    .trim()
    .replaceAll("*", "×")
    .replaceAll("x", "×")
    .replaceAll("X", "×")
    .replaceAll("/", "÷");
}

function checkAnswers() {
  if (!state.puzzle) return;

  let total = 0;
  let correct = 0;

  state.puzzle.grid.flat().forEach((cell) => {
    if (!cell.hidden) return;
    total += 1;
    const isCorrect = normalizeAnswer(cell.userAnswer) === normalizeAnswer(cell.answer);
    cell.status = isCorrect ? "correct" : "incorrect";
    if (isCorrect) correct += 1;
  });

  state.checked = true;
  state.showAnswers = false;
  els.feedback.textContent = correct === total ? `全对！${correct}/${total}` : `答对 ${correct}/${total} 个，红色的再想一想。`;
  renderPuzzle();
}

function clearAnswers() {
  if (!state.puzzle) return;

  state.puzzle.grid.flat().forEach((cell) => {
    if (!cell.hidden) return;
    cell.userAnswer = "";
    cell.status = "";
  });
  state.checked = false;
  state.showAnswers = false;
  els.feedback.textContent = "";
  renderPuzzle();
}

function regenerate() {
  try {
    state.showAnswers = false;
    state.checked = false;
    state.puzzle = generatePuzzle(getConfig());
    els.feedback.textContent = "";
    renderPuzzle();
  } catch (error) {
    els.summary.textContent = error.message;
  }
}

els.blankRatio.addEventListener("input", () => {
  els.blankRatioLabel.textContent = `${els.blankRatio.value}%`;
});

els.gridSize.addEventListener("change", () => {
  els.maxEquations.value = String(maxEquationCountForSize(Number(els.gridSize.value)));
});

els.generateButton.addEventListener("click", regenerate);
els.checkButton.addEventListener("click", checkAnswers);
els.clearButton.addEventListener("click", clearAnswers);

els.toggleAnswerButton.addEventListener("click", () => {
  if (!state.puzzle) return;
  state.showAnswers = !state.showAnswers;
  renderPuzzle();
});

regenerate();
