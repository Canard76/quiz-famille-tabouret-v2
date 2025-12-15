const defaultConfig = {
  quizTitle: "Quiz Familial — Pop & Cuisine (40 questions)",
  requireName: true,
  giftTiers: [
    { minScore: 0,   label: "Niveau Bronze" },
    { minScore: 200, label: "Niveau Argent" },
    { minScore: 320, label: "Niveau Or" }
  ],
  pointsPerQuestionDefault: 10,
  timePerQuestionSeconds: 45
};

let CONFIG = { ...defaultConfig };
let QUESTIONS = [];
let state = { index: 0, score: 0, answers: [], timer: null, timeLeft: defaultConfig.timePerQuestionSeconds };

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function loadData() {
  try { const cfgResp = await fetch('config.json'); if (cfgResp.ok) { const cfg = await cfgResp.json(); CONFIG = { ...defaultConfig, ...cfg }; } } catch (e) { console.warn('Config par défaut utilisée', e); }
  const qResp = await fetch('questions.json'); QUESTIONS = await qResp.json();
}

function startTimer() {
  clearInterval(state.timer);
  state.timeLeft = CONFIG.timePerQuestionSeconds;
  const timeEl = document.getElementById('timeLeft');
  const fill = document.getElementById('timerFill');
  const label = document.getElementById('timerLabel');
  const total = CONFIG.timePerQuestionSeconds;
  timeEl.textContent = state.timeLeft;
  fill.style.width = '100%';
  fill.classList.remove('danger');
  label.classList.remove('danger');
  state.timer = setInterval(() => {
    state.timeLeft--;
    timeEl.textContent = state.timeLeft;
    const pct = Math.max(0, Math.min(100, Math.round(100 * state.timeLeft / total)));
    fill.style.width = pct + '%';
    if (state.timeLeft <= 5) {
      fill.classList.add('danger');
      label.classList.add('danger');
    }
    if (state.timeLeft <= 0) {
      clearInterval(state.timer);
      autoValidateTimeout();
    }
  }, 1000);
}

function renderQuestion() {
  const qTotalEl = document.getElementById('qTotal');
  const qIndexEl = document.getElementById('qIndex');
  const questionEl = document.getElementById('question');
  const choicesEl = document.getElementById('choices');
  const nextBtn = document.getElementById('nextBtn');

  qTotalEl.textContent = QUESTIONS.length;
  qIndexEl.textContent = state.index + 1;
  nextBtn.disabled = true;
  choicesEl.innerHTML = '';

  const q = QUESTIONS[state.index];
  const points = q.points ?? CONFIG.pointsPerQuestionDefault;
  questionEl.textContent = q.question + ` ( ${points} pts )`;

  if (q.type === 'qcm') {
    q.choices.forEach((c, idx) => {
      const div = document.createElement('div');
      div.className = 'choice';
      div.textContent = c;
      div.dataset.index = idx;
      div.addEventListener('click', () => {
        document.querySelectorAll('.choice').forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
        nextBtn.disabled = false;
      });
      choicesEl.appendChild(div);
    });
  } else if (q.type === 'vf') {
    ['Vrai','Faux'].forEach((label, idx) => {
      const val = idx === 0; // Vrai=true, Faux=false
      const div = document.createElement('div');
      div.className = 'choice';
      div.textContent = label;
      div.dataset.value = String(val);
      div.addEventListener('click', () => {
        document.querySelectorAll('.choice').forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
        nextBtn.disabled = false;
      });
      choicesEl.appendChild(div);
    });
  }
  startTimer();
}

function finalizeSelectionAndFeedback(selectedIndex, selectedBool) {
  const q = QUESTIONS[state.index];
  const points = q.points ?? CONFIG.pointsPerQuestionDefault;
  let correct = false;

  document.querySelectorAll('.choice').forEach(el => {
    if (q.type === 'qcm') {
      const idx = parseInt(el.dataset.index, 10);
      if (idx === q.answer) el.classList.add('correct');
      if (selectedIndex !== null && idx === selectedIndex && idx !== q.answer) el.classList.add('wrong');
    } else {
      const val = el.dataset.value === 'true';
      if (val === q.answer) el.classList.add('correct');
      if (selectedBool !== null && val === selectedBool && val !== q.answer) el.classList.add('wrong');
    }
  });

  if (q.type === 'qcm') {
    if (selectedIndex !== null) correct = selectedIndex === q.answer;
  } else {
    if (selectedBool !== null) correct = selectedBool === q.answer;
  }

  if (correct) state.score += points;

  state.answers.push({
    question: q.question,
    correctAnswer: q.type === 'qcm' ? q.choices[q.answer] : (q.answer ? 'Vrai' : 'Faux'),
    selected: q.type === 'qcm' ? (selectedIndex !== null ? q.choices[selectedIndex] : '(aucune)') : (selectedBool !== null ? (selectedBool ? 'Vrai' : 'Faux') : '(aucune)'),
    correct,
    points: correct ? points : 0
  });

  document.getElementById('scoreVal').textContent = state.score;

  setTimeout(() => {
    state.index++;
    if (state.index < QUESTIONS.length) {
      renderQuestion();
    } else {
      showResults();
    }
  }, 600);
}

function validateAndNext() {
  clearInterval(state.timer);
  const q = QUESTIONS[state.index];
  if (q.type === 'qcm') {
    const selEl = document.querySelector('.choice.selected');
    const selectedIndex = selEl ? parseInt(selEl.dataset.index, 10) : null;
    finalizeSelectionAndFeedback(selectedIndex, null);
  } else {
    const selEl = document.querySelector('.choice.selected');
    const selectedBool = selEl ? (selEl.dataset.value === 'true') : null;
    finalizeSelectionAndFeedback(null, selectedBool);
  }
}

function autoValidateTimeout() { finalizeSelectionAndFeedback(null, null); }

function giftLabelForScore(score) {
  const tiers = [...CONFIG.giftTiers].sort((a,b) => a.minScore - b.minScore);
  let label = tiers[0].label;
  for (const t of tiers) { if (score >= t.minScore) label = t.label; }
  return label;
}

function generateClaimCode(name, score) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let seed = (Date.now() ^ (name ? name.length * 97 : 12345) ^ (score * 131)) >>> 0;
  let code = '';
  for (let i = 0; i < 6; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; code += alphabet[seed % alphabet.length]; }
  return code;
}

function showResults() {
  document.getElementById('quiz-screen').classList.add('hidden');
  const result = document.getElementById('result-screen');
  result.classList.remove('hidden');

  const name = (document.getElementById('playerName').value || '').trim();
  document.getElementById('finalName').textContent = name ? `Bravo, ${name} !` : '';
  document.getElementById('finalScore').textContent = state.score;
  const tierLabel = giftLabelForScore(state.score);
  document.getElementById('giftLabel').textContent = tierLabel;
  const claim = generateClaimCode(name, state.score);
  document.getElementById('claimCode').textContent = claim;

  const review = document.getElementById('review');
  review.innerHTML = '';
  state.answers.forEach((a, idx) => {
    const div = document.createElement('div');
    div.className = 'review-item';
    div.innerHTML = `<strong>Q${idx+1}:</strong> ${a.question}<br/>Votre réponse: ${a.selected} — ${a.correct ? '✅ Correct' : '❌ Faux'} ( +${a.points} )<br/>Bonne réponse: ${a.correctAnswer}`;
    review.appendChild(div);
  });
}

function resetQuiz() {
  state = { index: 0, score: 0, answers: [], timer: null, timeLeft: CONFIG.timePerQuestionSeconds };
  document.getElementById('scoreVal').textContent = '0';
  document.getElementById('result-screen').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
}

function printResult() { window.print(); }

async function init() {
  await loadData();
  document.getElementById('quiz-title').textContent = CONFIG.quizTitle;
  document.getElementById('name-field').style.display = CONFIG.requireName ? 'block' : 'block';

  document.getElementById('startBtn').addEventListener('click', () => {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('quiz-screen').classList.remove('hidden');
    renderQuestion();
  });

  document.getElementById('nextBtn').addEventListener('click', validateAndNext);
  document.getElementById('restartBtn').addEventListener('click', resetQuiz);
  document.getElementById('printBtn').addEventListener('click', printResult);
}

init();
