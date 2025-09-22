/* @Project: JavaScript Slingo */
/* @Author: nick99nack */
/* @Contact: spybob888 at aol dot com */
/* @Modified: July 13, 2025 */

// Game state management - centralizes all game variables
const gameState = {
  board: Array(5).fill().map(() => Array(5).fill(0)),
  boardIDs: [
    ["A1", "B1", "C1", "D1", "E1"],
    ["A2", "B2", "C2", "D2", "E2"],
    ["A3", "B3", "C3", "D3", "E3"],
    ["A4", "B4", "C4", "D4", "E4"],
    ["A5", "B5", "C5", "D5", "E5"]
  ],
  slots: Array(5).fill(0),
  activeJokers: Array(5).fill(0),
  unmatchedColumns: Array(5).fill(0),
  totals: Array(12).fill(0),
  slingos: Array(12).fill(0),
  usedNumbers: [],
  score: 0,
  spin: 0,
  freeSpins: 0,
  devilsCount: 0,
  maxDevils: 2,
  activeDevil: 0,
  specialItem: -1, // Replaces csmb
  isCardFull: false,
  isGameOver: false,
  isSpinActive: false,
  slingoExists: false,
  maxFullCardBonus: 13500,
  gameEndCalled: false,
  audioActive: true,
  valid: false
};

// Constants for number ranges
const NUMBER_RANGES = {
  min: [1, 16, 31, 46, 61],
  max: [15, 30, 45, 60, 75]
};

// Audio file mapping
const AUDIO = {
  start: "start_snd",
  spin: "spinclick_snd",
  match: "filltile_snd",
  invalid: "invalid_snd",
  slingo: "slingo_snd",
  devil: "dd_snd",
  cherub: "csmb_snd",
  coin: "coin",
  freeSpin: "freespin_snd",
  scoreReduce: "scorereduce_snd",
  fullCard: "fc_snd",
  gameOver: "gameover_snd"
};

// Special item types
const SPECIAL_ITEMS = {
  DEVIL: 0,
  CHERUB: 1,
  COIN: 2,
  FREE_SPIN: 5
};

(() => {
  /* configuration — tweak if the rules change */
  const SPIN_WAIT_SECONDS   = 10;  // time to click "Take Spin"
  const MATCH_WAIT_SECONDS  = 30;  // time to mark numbers
  const LOST_SPIN_OVERLAY_MS = 4000;

  /* internal state */
  let phase            = 'idle';  // 'spin', 'match', 'idle'
  let secondsRemaining = 0;
  let timerId          = null;

  /* cached DOM references */
  const timerDisplay  = document.getElementById('timerdisplay');
  const lostSpinImg   = document.getElementById('lostspin');

  /* utility --------------------------------------------------- */
  const format = s => ':' + String(s).padStart(2, '0');

  const setDisplay = s => {
    timerDisplay.textContent = format(s);
    timerDisplay.style.visibility = s < 0 ? 'hidden' : 'visible';
  };

  const stopTimer = () => {
    clearInterval(timerId);
    timerId = null;
  };

  /* phase control --------------------------------------------- */
  function startSpinCountdown() {
    phase = 'spin';
    secondsRemaining = SPIN_WAIT_SECONDS;
    setDisplay(secondsRemaining);

    timerId = setInterval(() => {
      if (--secondsRemaining >= 0) {
        setDisplay(secondsRemaining);
      }
      if (secondsRemaining <= 0) {
        stopTimer();
        handleMissedSpin();
      }
    }, 1000);
  }

  function startMatchCountdown() {
    phase = 'match';
    secondsRemaining = MATCH_WAIT_SECONDS;
    setDisplay(secondsRemaining);

    timerId = setInterval(() => {
      if (--secondsRemaining >= 0) {
        setDisplay(secondsRemaining);
      }
      if (secondsRemaining <= 0) {
        stopTimer();
        // Force end the current spin
        gameState.unmatchedColumns = Array(5).fill(0);
        updateSpinStatus();
      }
    }, 1000);
  }

  /* timeout actions ------------------------------------------- */
  function handleMissedSpin() {
    // show the "lost spin" animation
    lostSpinImg.style.display = 'block';
    document.getElementById("disabledspinbtn").style.display = "block";
    setTimeout(() => {
      lostSpinImg.style.display = 'none';
      // Skip this spin
      if (gameState.spin < 20 && !gameState.isCardFull) {
        incrementSpin();
        if (gameState.spin > 15 && gameState.spin < 20) {
          finalSpins();
        } else {
          startNextSpin();
        }
      } else if (gameState.spin === 20) {
        endGame(2);
      }
    }, LOST_SPIN_OVERLAY_MS);
  }

  /* public hooks – call these from the game logic ------------- */
  window.beginNewSpin = function() {
    stopTimer();          // safety
    setDisplay('-1');     // hides the clock until countdown starts
    
    // Only start countdown if we're not at the end of the game
    if (gameState.spin < 20 && !gameState.isCardFull) {
      startSpinCountdown();
    }
  };

  window.startMatchCountdown = function() {
    if (phase === 'spin') {
      stopTimer();
      startMatchCountdown();
    }
  };

  window.finishSpinNow = function() {
    stopTimer();
    setDisplay('-1');     // hide
    phase = 'idle';
  };

  // Export phase getter for debugging
  window.getTimerPhase = function() {
    return phase;
  };
})();


/**
 * Play a sound effect
 * @param {string} soundName - Name of the sound effect to play
 */
function playSound(soundName) {
  if (!gameState.audioActive) return;
  mPlay(soundName);
}

/**
 * Legacy function to play sound - retained for compatibility
 * @param {string} soundId - ID of the sound element
 */
function mPlay(soundId) {
  if (!gameState.audioActive) return;
  
  const audio = document.getElementById(soundId);
  if (audio) {
    audio.currentTime = 0;
    audio.play();
  }
}

/**
 * Create a new game board with random numbers
 */
function newBoard() {
  document.getElementById("gameover").style.display = "none";
  document.getElementById("scoredisplay").innerHTML = gameState.score;
  gameState.valid = true;
  
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row < 5; row++) {
      let valid = false;
      let tempNum;
      
      while (!valid) {
        tempNum = generateNum(NUMBER_RANGES.min[col], NUMBER_RANGES.max[col]);
        
        if (!gameState.usedNumbers.includes(tempNum)) {
          gameState.usedNumbers.push(tempNum);
          gameState.board[col][row] = tempNum;
          valid = true;
        }
      }
      
      document.getElementById(gameState.boardIDs[col][row]).innerHTML = gameState.board[col][row];
    }
  }
}

/**
 * Generate a random number in range (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @return {number} Random number
 */
function generateNum(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * Increment the spin counter
 */
function incrementSpin() {
  gameState.spin++;
  document.getElementById("spindisplay").innerHTML = gameState.spin;
}

/**
 * Start a new spin
 */
function takeSpin() {
  document.getElementById("startspinbtn").style.display = "none";
  document.getElementById("disabledspinbtn").style.display = "block";
  playSound(AUDIO.spin);
  gameState.activeDevil = 0;
  
  if (gameState.spin < 20) {
    incrementSpin();
    spinAllSlots();
    // Start the match countdown timer
    if (window.startMatchCountdown) {
      window.startMatchCountdown();
    }
  }
}

/**
 * Process all slots in sequence
 */
function spinAllSlots() {
  for (let i = 0; i < 5; i++) {
    (function(colIndex) {
      setTimeout(() => spinSlot(colIndex), 310 * colIndex);
    })(i);
  }
  
  // Wait for all slots to finish spinning before checking for matches
  setTimeout(() => {
    // Check if there are any possible matches after all slots are spun
    const totalUnmatchedCols = gameState.unmatchedColumns.reduce((sum, val) => sum + val, 0);
    
    // If no matches found, proceed to next spin immediately
    if (totalUnmatchedCols === 0) {
      finishSpinNow();
      updateSpinStatus();
    }
  }, 1600);
}

/**
 * Process a single slot
 * @param {number} column - Column index
 */
function spinSlot(column) {
  if (!gameState.valid) return;
  
  // Reset joker for this column
  gameState.activeJokers[column] = 0;
  
  // Generate slot value
  const min = NUMBER_RANGES.min[column];
  const max = NUMBER_RANGES.max[column];
  const slotValue = generateNum(min - 1, max + 4);
  gameState.slots[column] = slotValue;
  
  const slotElement = document.getElementById(`S${column + 1}`);
  
  // Clear the slot first
  slotElement.innerHTML = "";
  slotElement.style.backgroundImage = "";
  
  if (slotValue > max) {
    handleJoker(column);
  } else if (slotValue < min) {
    handleSpecialItem(column);
  } else {
    displayRegularNumber(column, slotValue);
  }
  
  // Check for potential matches
  checkForPotentialMatches(column);
}

/**
 * Handle joker appearance in a slot
 * @param {number} column - Column index
 */
function handleJoker(column) {
  playSound(`slot${column + 1}_snd`);
  const slotElement = document.getElementById(`S${column + 1}`);
  // Make sure the slot is completely empty before setting the background
  slotElement.innerHTML = "";
  slotElement.style.backgroundImage = "url('./img/jokerslot.gif')";
  gameState.activeJokers[column] = 1;
}

/**
 * Handle special item appearance in a slot
 * @param {number} column - Column index
 */
function handleSpecialItem(column) {
  const specialItem = generateNum(0, 6);
  gameState.specialItem = specialItem;
  
  // Devil
  if (specialItem === SPECIAL_ITEMS.DEVIL && gameState.devilsCount < gameState.maxDevils && gameState.activeDevil !== 1) {
    if (gameState.spin === 1) {
      // Convert to coin on first spin
      handleCoin(column);
    } else {
      handleDevil(column);
    }
  } 
  // Cherub
  else if (specialItem === SPECIAL_ITEMS.CHERUB && gameState.devilsCount < gameState.maxDevils && gameState.activeDevil !== 1) {
    if (gameState.spin === 1) {
      // Convert to coin on first spin
      handleCoin(column);
    } else {
      handleCherub(column);
    }
  } 
  // Coin (2-4)
  else if (specialItem > 1 && specialItem < 5) {
    handleCoin(column);
  } 
  // Free Spin (5-6)
  else if (specialItem > 4) {
    handleFreeSpin(column);
  } 
  // Fall back to regular number if we've hit max devils
  else if (gameState.devilsCount >= gameState.maxDevils) {
    gameState.specialItem = -1;
    gameState.slots[column] = generateNum(NUMBER_RANGES.min[column], NUMBER_RANGES.max[column]);
    displayRegularNumber(column, gameState.slots[column]);
  }
}

/**
 * Handle devil special item
 * @param {number} column - Column index
 */
function handleDevil(column) {
  playSound(`slot${column + 1}_snd`);
  const slotElement = document.getElementById(`S${column + 1}`);
  slotElement.innerHTML = "";
  slotElement.style.backgroundImage = "url('./img/devilslot.gif')";
  
  gameState.devilsCount++;
  gameState.activeDevil++;
  gameState.score = Math.floor(gameState.score / 2);
  
  setTimeout(() => {
    document.getElementById("devil").style.display = "block";
    playSound(AUDIO.devil);
    
    setTimeout(() => {
      document.getElementById("devil").style.display = "none";
      playSound(AUDIO.scoreReduce);
      updateScoreDisplay();
    }, 2500);
  }, 1400);
}

/**
 * Handle cherub special item
 * @param {number} column - Column index
 */
function handleCherub(column) {
  playSound(`slot${column + 1}_snd`);
  const slotElement = document.getElementById(`S${column + 1}`);
  slotElement.innerHTML = "";
  slotElement.style.backgroundImage = "url('./img/devilslot.gif')";
  
  gameState.devilsCount++;
  gameState.activeDevil++;
  
  setTimeout(() => {
    document.getElementById("devil").style.display = "block";
    playSound(AUDIO.devil);
    
    setTimeout(() => {
      document.getElementById("devil").style.display = "none";
      document.getElementById("csmb").style.display = "block";
      playSound(AUDIO.cherub);
      
      setTimeout(() => {
        document.getElementById("csmb").style.display = "none";
      }, 3800);
    }, 2500);
  }, 1400);
}

/**
 * Handle coin special item
 * @param {number} column - Column index
 */
function handleCoin(column) {
  playSound(`slot${column + 1}_snd`);
  const slotElement = document.getElementById(`S${column + 1}`);
  slotElement.innerHTML = "";
  slotElement.style.backgroundImage = "url('./img/coinslot.gif')";
  gameState.score += 1000;
  flashSlotAndScore(column + 1);
  playSound(AUDIO.coin);
}

/**
 * Handle free spin special item
 * @param {number} column - Column index
 */
function handleFreeSpin(column) {
  playSound(`slot${column + 1}_snd`);
  const slotElement = document.getElementById(`S${column + 1}`);
  slotElement.innerHTML = "";
  slotElement.style.backgroundImage = "url('./img/freespinslot.gif')";
  gameState.freeSpins += 1;
  flashSlotAndFreeSpins(column + 1);
  playSound(AUDIO.freeSpin);
}

/**
 * Display a regular number in a slot
 * @param {number} column - Column index
 * @param {number} value - Number to display
 */
function displayRegularNumber(column, value) {
  playSound(`slot${column + 1}_snd`);
  const slotElement = document.getElementById(`S${column + 1}`);
  // Clear any background images first
  slotElement.style.backgroundImage = "";
  slotElement.innerHTML = value;
}

/**
 * Check if there are any potential matches in a column
 * @param {number} column - Column index
 */
function checkForPotentialMatches(column) {
  // Reset the column's unmatched status first
  gameState.unmatchedColumns[column] = 0;
  
  for (let row = 0; row < 5; row++) {
    const boardValue = gameState.board[column][row];
    const slotValue = gameState.slots[column];
    
    if ((boardValue === slotValue || gameState.activeJokers[column] === 1) && boardValue !== 0) {
      gameState.unmatchedColumns[column] = 1;
      gameState.isSpinActive = 1;
    }
  }
}

/**
 * Check for a match when a board tile is clicked
 * @param {number} col - Column index
 * @param {number} row - Row index
 */
function checkMatch(col, row) {
  try {
    // Don't process clicks if the board position is already cleared
    if (gameState.board[col][row] === 0) {
      return;
    }
    
    // Don't process clicks if a spin isn't active
    if (!gameState.isSpinActive) {
      return;
    }
    
    const boardValue = gameState.board[col][row];
    const slotValue = gameState.slots[col];
    const hasJoker = gameState.activeJokers[col] === 1;
    
    if ((boardValue === slotValue || hasJoker) && boardValue !== 0) {
      markTileAsMatched(col, row);
      scoring(col, row);
      
      // Reset column status
      gameState.unmatchedColumns[col] = 0;
      gameState.specialItem = -1;
      
      // Check for spin completion
      updateSpinStatus();
    } else {
      playSound(AUDIO.invalid);
    }
  } catch (error) {
    console.error("Error in checkMatch:", error);
  }
}

/**
 * Mark a tile as matched
 * @param {number} col - Column index
 * @param {number} row - Row index
 */
function markTileAsMatched(col, row) {
  playSound(AUDIO.match);
  
  const tileElement = document.getElementById(gameState.boardIDs[col][row]);
  tileElement.style.backgroundImage = "url('./img/coveredtile.gif')";
  tileElement.innerHTML = "";
  
  if (gameState.activeJokers[col] === 1) {
    const slotElement = document.getElementById(`S${col + 1}`);
    slotElement.innerHTML = "";
    slotElement.style.backgroundImage = "url('./img/usedjokerslot.gif')";
  }
  
  gameState.board[col][row] = 0;
  gameState.activeJokers[col] = 0;
}

/**
 * Calculate score for a match
 * @param {number} col - Column index
 * @param {number} row - Row index
 */
function scoring(col, row) {
  // Basic match points
  gameState.score += 200;
  
  // Calculate line totals
  calculateLineTotals();
  
  // Check for slingos
  checkForSlingos();
  
  // Check for full card
  if (isBoardCleared()) {
    gameState.isCardFull = true;
    endGame(1);
  }
}

/**
 * Calculate all line totals on the board
 */
function calculateLineTotals() {
  // Rows
  for (let i = 0; i < 5; i++) {
    gameState.totals[i] = gameState.board[i].reduce((sum, val) => sum + val, 0);
  }
  
  // Columns
  for (let j = 0; j < 5; j++) {
    gameState.totals[j + 5] = gameState.board.reduce((sum, row) => sum + row[j], 0);
  }
  
  // Diagonals
  gameState.totals[10] = gameState.board[0][0] + gameState.board[1][1] + gameState.board[2][2] + gameState.board[3][3] + gameState.board[4][4];
  gameState.totals[11] = gameState.board[4][0] + gameState.board[3][1] + gameState.board[2][2] + gameState.board[1][3] + gameState.board[0][4];
}

/**
 * Check for completed slingos (lines)
 */
function checkForSlingos() {
  gameState.slingoExists = false;
  
  for (let i = 0; i < 12; i++) {
    if (gameState.totals[i] === 0 && gameState.slingos[i] === 0) {
      gameState.slingos[i] = -1;
      gameState.slingoExists = true;
      document.getElementById(`slingo${i + 1}`).style.display = "block";
      
      setTimeout(() => {
        playSound(AUDIO.slingo);
        gameState.score += 1000;
      }, 1400);
    }
  }
  
  if (gameState.slingoExists) {
    setTimeout(() => {
      updateScoreDisplay();
      gameState.slingoExists = false;
      
      for (let j = 1; j < 13; j++) {
        document.getElementById(`slingo${j}`).style.display = "none";
      }
    }, 2500);
  } else {
    updateScoreDisplay();
  }
}

/**
 * Check if the board is completely cleared (full card)
 * @return {boolean} True if board is cleared
 */
function isBoardCleared() {
  return gameState.slingos.every(value => value === -1);
}

/**
 * Calculate full card bonus based on spin number
 * @param {number} spinNum - Current spin number
 * @return {number} Bonus points
 */
function calcFullCardBonus(spinNum) {
  const difference = spinNum - 5;
  return gameState.maxFullCardBonus - (500 * difference);
}

/**
 * Update the spin status and prepare for next spin
 */
function updateSpinStatus() {
  // Check if any column has potential matches
  const totalUnmatchedCols = gameState.unmatchedColumns.reduce((sum, val) => sum + val, 0);
  console.log("Update spin status. Total unmatched columns:", totalUnmatchedCols);
  
  if (totalUnmatchedCols === 0) {
    // No matches available, proceed to next spin
    console.log("No matches available, proceeding to next spin");
    
    // Stop the timer immediately
    finishSpinNow();
    
    let delay = 1800;
    
    if (gameState.slingoExists) {
      delay = 4000;
    } else if (gameState.specialItem === SPECIAL_ITEMS.CHERUB) {
      delay = 7800;
    } else if (gameState.specialItem === SPECIAL_ITEMS.DEVIL) {
      delay = 4000;
    }
    
    setTimeout(() => {
      gameState.isSpinActive = 0;
      
      if (gameState.spin < 20 && !gameState.isCardFull) {
        if (gameState.spin > 15 && gameState.spin < 20) {
          finalSpins();
        } else {
          startNextSpin();
        }
      } else if (gameState.spin === 20) {
        endGame(2);
      }
    }, delay);
  }
}

/**
 * Start the game
 */
function startGame() {
  newBoard();
  playSound(AUDIO.start);
  document.getElementById("startgamebtn").style.display = "none";
  document.getElementById("startspinbtn").style.display = "block";
  clearSlots();
  // Start the timer for the first spin
  beginNewSpin();
}

/**
 * Clear all slots
 */
function clearSlots() {
  for (let i = 0; i < 5; i++) {
    const slotElement = document.getElementById(`S${i + 1}`);
    slotElement.innerHTML = "";
    slotElement.style.backgroundImage = "";
  }
}

/**
 * Handle game end
 * @param {number} mode - End game mode (1=full card, 2=out of spins)
 */
function endGame(mode) {
  // Stop any active timer
  finishSpinNow();
  
  // Full Card
  if (mode === 1) {
    setTimeout(() => {
      gameState.gameEndCalled = true;
      const bonus = calcFullCardBonus(gameState.spin);
      
      document.getElementById("startspinbtn").style.display = "none";
      document.getElementById("fullcard").style.display = "block";
      gameState.score += bonus;
      
      document.getElementById("bonuspntdisplay").style.display = "block";
      document.getElementById("bonuspntdisplay").innerHTML = bonus;
      updateScoreDisplay();
      playSound(AUDIO.fullCard);
      
      setTimeout(() => {
        playSound(AUDIO.gameOver);
        document.getElementById("fullcard").style.display = "none";
        document.getElementById("bonuspntdisplay").style.display = "none";
        document.getElementById("gameover").style.display = "block";
        document.getElementById("startgamebtn").style.display = "block";
        gameReset();
      }, 5000);
    }, 2500);
  } else if (mode === 2 && !gameState.gameEndCalled) {
    document.getElementById("startspinbtn").style.display = "none";
    document.getElementById("startgamebtn").style.display = "block";
    playSound(AUDIO.gameOver);
    document.getElementById("fullcard").style.display = "none";
    document.getElementById("gameover").style.display = "block";
    gameReset();
  }
}

/**
 * Reset the game state
 */
function gameReset() {
  gameState.slots = Array(5).fill(0);
  gameState.activeJokers = Array(5).fill(0);
  gameState.unmatchedColumns = Array(5).fill(0);
  gameState.totals = Array(12).fill(0);
  gameState.slingos = Array(12).fill(0);
  gameState.usedNumbers = [];
  gameState.spin = 0;
  gameState.score = 0;
  gameState.freeSpins = 0;
  gameState.devilsCount = 0;
  gameState.activeDevil = 0;
  gameState.specialItem = -1;
  gameState.isCardFull = false;
  gameState.isGameOver = false;
  gameState.isSpinActive = false;
  gameState.slingoExists = false;
  gameState.gameEndCalled = false;
  
  // Clear board visuals
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row < 5; row++) {
      const tileElement = document.getElementById(gameState.boardIDs[col][row]);
      tileElement.style.backgroundImage = "";
      tileElement.innerHTML = "";
    }
  }
  
  // Update displays
  document.getElementById("freespindisplay").innerHTML = gameState.freeSpins;
  document.getElementById("spindisplay").innerHTML = gameState.spin;
  document.getElementById("disabledspinbtn").style.display = "none";
  clearSlots();
}

/**
 * Handle final spins stage
 */
function finalSpins() {
  let spinDisplay;
  
  if (gameState.spin === 16) {
    spinDisplay = "finalspins4";
  } else if (gameState.spin === 17) {
    spinDisplay = "finalspins3";
  } else if (gameState.spin === 18) {
    spinDisplay = "finalspins2";
  } else if (gameState.spin === 19) {
    spinDisplay = "finalspins1";
  }
  
  document.getElementById(spinDisplay).style.display = "block";
  
  if (gameState.freeSpins === 0) {
    handleFinalSpinWithoutFreeSpins(spinDisplay);
  } else {
    handleFinalSpinWithFreeSpins(spinDisplay);
  }
}

/**
 * Handle final spin when player has no free spins
 * @param {string} spinDisplay - ID of the spin display element
 */
function handleFinalSpinWithoutFreeSpins(spinDisplay) {
  setTimeout(() => {
    document.getElementById(spinDisplay).style.display = "none";
    
    setTimeout(() => {
      playSound(AUDIO.scoreReduce);
      
      // Apply penalty based on spin number
      if (gameState.spin === 16) {
        gameState.score -= 500;
      } else if (gameState.spin === 17) {
        gameState.score -= 1000;
      } else if (gameState.spin === 18) {
        gameState.score -= 1500;
      } else if (gameState.spin === 19) {
        gameState.score -= 2000;
      }
      
      updateScoreDisplay(1000, 0);
      startNextSpin();
    }, 1000);
  }, 5000);
}

/**
 * Handle final spin when player has free spins available
 * @param {string} spinDisplay - ID of the spin display element
 */
function handleFinalSpinWithFreeSpins(spinDisplay) {
  setTimeout(() => {
    document.getElementById(spinDisplay).style.display = "none";
    document.getElementById("freespinq").style.display = "block";
    document.getElementById("yesbtn").style.display = "block";
    document.getElementById("nobtn").style.display = "block";
  }, 5000);
}

/**
 * Process player's answer to free spin question
 * @param {boolean} useFreeSpin - True if using a free spin
 */
function freeSpinAnswer(useFreeSpin) {
  if (useFreeSpin) {
    gameState.freeSpins -= 1;
    flashFreeSpins();
    startNextSpin();
  } else {
    playSound(AUDIO.scoreReduce);
    
    // Apply penalty based on spin number
    if (gameState.spin === 16) {
      gameState.score -= 500;
    } else if (gameState.spin === 17) {
      gameState.score -= 1000;
    } else if (gameState.spin === 18) {
      gameState.score -= 1500;
    } else if (gameState.spin === 19) {
      gameState.score -= 2000;
    }
    
    updateScoreDisplay(1000, 0);
    startNextSpin();
  }
  
  // Hide free spin question
  document.getElementById("freespinq").style.display = "none";
  document.getElementById("yesbtn").style.display = "none";
  document.getElementById("nobtn").style.display = "none";
}

/**
 * Start the next spin
 */
function startNextSpin() {
  gameState.isSpinActive = false;
  playSound(AUDIO.start);
  document.getElementById("disabledspinbtn").style.display = "none";
  document.getElementById("startspinbtn").style.display = "block";
  clearSlots();
  // Start timer for next spin
  beginNewSpin();
}

/**
 * Toggle audio on/off
 */
function toggleVolume() {
  gameState.audioActive = !gameState.audioActive;
  
  document.querySelectorAll("audio").forEach((audio) => {
    audio.muted = !gameState.audioActive;
  });
  
  const volumeBtn = document.getElementById("volumebtn");
  if (gameState.audioActive) {
    volumeBtn.removeAttribute("off");
  } else {
    volumeBtn.setAttribute("off", "");
  }
}

/**
 * Flash a slot with visual effect
 * @param {number} slotNumber - Slot number (1-5)
 * @param {number} delay - Flash duration in ms
 */
function flashSlot(slotNumber, delay = 500) {
  const slotElement = document.getElementById(`S${slotNumber}`);
  slotElement.setAttribute("scoreoutline", "");
  
  setTimeout(() => { 
    slotElement.removeAttribute("scoreoutline");
  }, delay);
}

/**
 * Flash slot and score for coin
 * @param {number} slotNumber - Slot number (1-5)
 */
function flashSlotAndScore(slotNumber) {
  flashSlot(slotNumber);
  updateScoreDisplay(500);
}

/**
 * Flash slot and free spin counter
 * @param {number} slotNumber - Slot number (1-5)
 */
function flashSlotAndFreeSpins(slotNumber) {
  flashSlot(slotNumber);
  flashFreeSpins();
}

/**
 * Flash free spins counter
 * @param {number} delay - Flash duration in ms
 */
function flashFreeSpins(delay = 1000) {
  const displayElement = document.getElementById("freespindisplay");
  displayElement.innerHTML = gameState.freeSpins;
  displayElement.setAttribute("scoreoutline", "");
  
  setTimeout(() => { 
    displayElement.removeAttribute("scoreoutline");
  }, delay);
}

/**
 * Update and flash score display
 * @param {number} interval - Flash duration in ms
 * @param {number} delay - Delay before flashing in ms
 */
function updateScoreDisplay(interval = 800, delay = 500) {
  setTimeout(() => { 
    document.getElementById("scoredisplay").innerHTML = gameState.score;
    document.getElementById("scoredisplay").setAttribute("scoreoutline", "");
    
    setTimeout(() => { 
      document.getElementById("scoredisplay").removeAttribute("scoreoutline");
    }, interval);
  }, delay);
}

/**
 * Try to restart the game
 */
function tryRestartGame() {
  if (gameState.valid) {
    endGame(2);
  } else {
    playSound(AUDIO.invalid);
  }
}

/**
 * Toggle rules display
 */
function toggleRules() {
  const rulesBtn = document.getElementById("rulesbtn");
  const rulesFrame = document.getElementById("rulesframe");
  
  if (rulesBtn.getAttribute("depressed") === null) {
    rulesBtn.setAttribute("depressed", "");
    rulesFrame.style.display = "block";
  } else {
    rulesBtn.removeAttribute("depressed");
    rulesFrame.style.display = "none";
  }
}

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Set up main game buttons
  document.getElementById('startgamebtn').addEventListener('click', startGame);
  document.getElementById('startspinbtn').addEventListener('click', takeSpin);
  document.getElementById('volumebtn').addEventListener('click', toggleVolume);
  document.getElementById('rulesbtn').addEventListener('click', toggleRules);
  document.getElementById('restartbtn').addEventListener('click', tryRestartGame);
  document.getElementById('yesbtn').addEventListener('click', () => freeSpinAnswer(true));
  document.getElementById('nobtn').addEventListener('click', () => freeSpinAnswer(false));
  
  // Set up board click handlers
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row < 5; row++) {
      const tileElement = document.getElementById(gameState.boardIDs[col][row]);
      if (tileElement) {
        tileElement.addEventListener('click', () => checkMatch(col, row));
      }
    }
  }
});