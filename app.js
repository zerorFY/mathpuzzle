const state = {
  puzzle: null,
  showAnswers: false,
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
  toggleAnswerButton: document.querySelector("#toggleAnswerButton"),
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
  return {
    size,
    maxResult: clamp(Number(els.maxResult.value) || 100, 10, 999),
    maxEquations: clamp(Number(els.maxEquations.value) || 18, 4, 80),
    blankRatio: clamp(Number(els.blankRatio.value) || 25, 10, 45) / 100,
    operators: getSelectedOperators(),
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function validNode(row, col, size) {
  return row >= 0 && col >= 0 && row < size && col < size && row % LATTICE_STEP === 0 && col % LATTICE_STEP === 0;
}

function getNeighbors(node, size) {
  return shuffle([
    { row: node.row, col: node.col + LATTICE_STEP, direction: "right" },
    { row: node.row + LATTICE_STEP, col: node.col, direction: "down" },
    { row: node.row, col: node.col - LATTICE_STEP, direction: "left" },
    { row: node.row - LATTICE_STEP, col: node.col, direction: "up" },
  ]).filter((next) => validNode(next.row, next.col, size));
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
    });
  });
}

function generatePuzzle(config) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
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

      for (const endNode of getNeighbors(startNode, config.size)) {
        if (equations.length >= config.maxEquations) break;

        const edgeId = [cellKey(startNode.row, startNode.col), cellKey(endNode.row, endNode.col)].sort().join("|");
        if (visitedEdges.has(edgeId) || Math.random() < 0.18) continue;

        const positions = linePositions(startNode, endNode);
        const middleCellsClear = positions.slice(1, 4).every((pos) => !grid[pos.row][pos.col].value);
        if (!middleCellsClear) continue;

        const start = Number(grid[startNode.row][startNode.col].value);
        const targetCell = grid[endNode.row][endNode.col];
        const targetWasEmpty = !targetCell.value;
        const target = targetCell.value ? Number(targetCell.value) : undefined;
        const candidate = candidateEquations(start, target, config).find((item) =>
          canPlace(grid, positions, { ...item, start }),
        );

        if (!candidate) continue;

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

        if (targetWasEmpty) queue.push({ row: endNode.row, col: endNode.col });
      }
    }

    if (equations.length >= Math.min(config.maxEquations, 8) && reviewGrid(grid, equations, config)) {
      applySimpleBlanks(grid, equations, config.blankRatio);
      return { grid, equations };
    }
  }

  throw new Error("生成失败，请减少算式数量或放宽结果上限。");
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

  const targetBlankCount = Math.max(1, Math.round(equations.length * blankRatio));
  const candidates = shuffle([...cellToEquations.keys()]);
  let blanks = 0;

  for (const key of candidates) {
    if (blanks >= targetBlankCount) break;

    const linked = cellToEquations.get(key);
    if (linked.some((equationIndex) => equationBlankCounts.get(equationIndex) >= 1)) continue;

    const [row, col] = key.split(",").map(Number);
    const cell = grid[row][col];
    if (!cell.value || cell.value === "=") continue;

    cell.hidden = true;
    cell.answer = cell.value;
    linked.forEach((equationIndex) => {
      equationBlankCounts.set(equationIndex, equationBlankCounts.get(equationIndex) + 1);
    });
    blanks += 1;
  }
}

function renderPuzzle() {
  const { grid, equations } = state.puzzle;
  els.board.style.setProperty("--size", grid.length);
  els.board.innerHTML = "";

  grid.flat().forEach((cell) => {
    const node = document.createElement("div");
    const opClass = cell.value === "+" || cell.value === "×" ? "up" : cell.value === "-" || cell.value === "÷" ? "down" : "";
    node.className = ["cell", cell.type, opClass, cell.hidden ? "blank" : "", cell.hidden && state.showAnswers ? "reveal" : ""]
      .filter(Boolean)
      .join(" ");
    node.textContent = cell.hidden && !state.showAnswers ? "" : cell.value;
    els.board.append(node);
  });

  els.summary.textContent = `${grid.length} x ${grid.length}，${equations.length} 条算式，已按简单策略挖空。`;
  els.equationList.classList.toggle("hidden-answer", !state.showAnswers);
  els.equationList.innerHTML = equations
    .map(
      (item, index) =>
        `<div class="equation-item">${index + 1}. ${item.start} ${item.operator} ${item.operand} = ${item.result}</div>`,
    )
    .join("");
  els.toggleAnswerButton.textContent = state.showAnswers ? "隐藏答案" : "显示答案";
}

function regenerate() {
  try {
    state.showAnswers = false;
    state.puzzle = generatePuzzle(getConfig());
    renderPuzzle();
  } catch (error) {
    els.summary.textContent = error.message;
  }
}

els.blankRatio.addEventListener("input", () => {
  els.blankRatioLabel.textContent = `${els.blankRatio.value}%`;
});

els.generateButton.addEventListener("click", regenerate);

els.toggleAnswerButton.addEventListener("click", () => {
  if (!state.puzzle) return;
  state.showAnswers = !state.showAnswers;
  renderPuzzle();
});

regenerate();
