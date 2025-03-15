class MyChess {
  constructor() {
    this.game = new Chess();
    this.selectedSquare = null;
    this.isFlipped = false;
    this.timers = { w: 0, b: 0 };
    this.timerInterval = null;
    this.animationQueue = [];
    this.hintTimeout = null;

    // Sound Effects
    this.sounds = {
      move: new Audio(
        "https://assets.mixkit.co/active_storage/sfx/2853/2853-preview.mp3"
      ),
      capture: new Audio(
        "https://assets.mixkit.co/active_storage/sfx/2854/2854-preview.mp3"
      ),
      check: new Audio(
        "https://assets.mixkit.co/active_storage/sfx/2757/2757-preview.mp3"
      ),
      gameEnd: new Audio(
        "https://assets.mixkit.co/active_storage/sfx/2758/2758-preview.mp3"
      ),
    };

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.startTimers();
    this.loadPieces().then(() => this.renderBoard());
  }

  async loadPieces() {
    // const pieceImages = {
    //   wP: "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wp.png",
    //   wN: "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wn.png",
    //   wB: "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wb.png",
    //   wR: "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wr.png",
    //   wQ: "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wq.png",
    //   wK: "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wk.png",
    //   bP: "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bp.png",
    //   bN: "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bn.png",
    //   bB: "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bb.png",
    //   bR: "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/br.png",
    //   bQ: "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bq.png",
    //   bK: "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bk.png",
    // };
    this.pieceImages = {};
    const baseURL =
      "https://images.chesscomfiles.com/chess-themes/pieces/neo/150/";
    const pieces = ["P", "N", "B", "R", "Q", "K"];

    await Promise.all(
      ["w", "b"].map(async (color) => {
        this.pieceImages[color] = {};
        await Promise.all(
          pieces.map(async (type) => {
            const img = new Image();
            img.src = `${baseURL}${color.toLowerCase()}${type.toLowerCase()}.png`;
            await new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
            });
            this.pieceImages[color][type.toLowerCase()] = img;
          })
        );
      })
    );
  }

  renderBoard() {
    const board = document.getElementById("board");
    board.innerHTML = "";

    const squares = this.game.board();
    squares.forEach((row, i) => {
      row.forEach((piece, j) => {
        const file = String.fromCharCode(97 + j);
        const rank = 8 - i;
        const squareElement = this.createSquare(file, rank, i, j, piece);
        board.appendChild(squareElement);
      });
    });

    this.highlightCheck();
    this.updateStatus();
    this.updateMoveHistory();
  }

  createSquare(file, rank, i, j, piece) {
    const square = document.createElement("div");
    square.className = `square ${(i + j) % 2 === 0 ? "light" : "dark"}`;
    square.dataset.square = `${file}${rank}`;

    if (piece) {
      const pieceDiv = document.createElement("div");
      pieceDiv.className = "piece";
      pieceDiv.style.backgroundImage = `url(${
        this.pieceImages[piece.color][piece.type].src
      })`;
      square.appendChild(pieceDiv);
    }

    return square;
  }

  setupEventListeners() {
    const board = document.getElementById("board");

    // Desktop Events
    board.addEventListener("mousedown", (e) => this.handleStart(e));
    board.addEventListener("mouseup", (e) => this.handleEnd(e));

    // Mobile Events
    board.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.handleStart(e.touches[0]);
    });

    board.addEventListener("touchend", (e) => {
      e.preventDefault();
      this.handleEnd(e.changedTouches[0]);
    });

    // Controls
    document
      .getElementById("undo")
      .addEventListener("click", () => this.undoMove());
    document
      .getElementById("flip")
      .addEventListener("click", () => this.flipBoard());
    document
      .getElementById("reset")
      .addEventListener("click", () => this.resetGame());
    document
      .getElementById("hint")
      .addEventListener("click", () => this.showHint());
  }

  handleStart(e) {
    const square = e.target.closest(".square");
    if (!square) return;

    const piece = this.game.get(square.dataset.square);
    if (piece && piece.color === this.game.turn()) {
      this.selectedSquare = square.dataset.square;
      this.showLegalMoves();
    }
  }

  handleEnd(e) {
    const square = e.target.closest(".square");
    if (!this.selectedSquare || !square) return;

    const move = {
      from: this.selectedSquare,
      to: square.dataset.square,
      promotion: "q",
    };

    if (this.needsPromotion(move.to)) {
      this.showPromotionDialog(move);
    } else {
      this.executeMove(move);
    }

    this.selectedSquare = null;
    this.clearHighlights();
  }

  async executeMove(move) {
    try {
      const result = this.game.move(move);
      if (result) {
        this.playSound(result.captured ? "capture" : "move");
        await this.animateMove(result);
        this.updateGameState();

        if (this.game.in_check()) this.playSound("check");
        if (this.game.game_over()) this.handleGameEnd();
      }
    } catch (e) {
      console.error("Invalid move:", e);
    }
  }

  async animateMove(move) {
    const fromSquare = document.querySelector(`[data-square="${move.from}"]`);
    const toSquare = document.querySelector(`[data-square="${move.to}"]`);
    const piece = fromSquare.querySelector(".piece");

    // Capture animation
    if (move.captured) {
      const capturedPiece = toSquare.querySelector(".piece");
      if (capturedPiece) {
        capturedPiece.style.animation = "piece-capture 0.3s ease-out";
        await new Promise((resolve) =>
          capturedPiece.addEventListener("animationend", resolve, {
            once: true,
          })
        );
        capturedPiece.remove();
      }
    }

    // Move animation
    const fromRect = fromSquare.getBoundingClientRect();
    const toRect = toSquare.getBoundingClientRect();
    const dx = fromRect.left - toRect.left;
    const dy = fromRect.top - toRect.top;

    piece.style.transform = `translate(${-dx}px, ${-dy}px)`;
    await new Promise((resolve) => setTimeout(resolve, 100));

    piece.style.transition = "transform 0.2s ease-in-out";
    piece.style.transform = "none";

    await new Promise((resolve) =>
      piece.addEventListener("transitionend", resolve, { once: true })
    );

    // Update DOM
    toSquare.appendChild(piece);
    if (move.promotion) {
      piece.style.backgroundImage = `url(${
        this.pieceImages[this.game.turn()][move.promotion].src
      })`;
    }
  }

  showLegalMoves() {
    this.clearHighlights();

    const moves = this.game.moves({
      square: this.selectedSquare,
      verbose: true,
    });

    moves.forEach((move) => {
      const square = document.querySelector(`[data-square="${move.to}"]`);
      if (this.game.get(move.to)) {
        square.classList.add("legal-capture");
      } else {
        square.classList.add("legal-move");
      }
    });

    document
      .querySelector(`[data-square="${this.selectedSquare}"]`)
      .classList.add("highlight");
  }

  showPromotionDialog(move) {
    const dialog = document.createElement("div");
    dialog.className = "promotion-dialog";

    ["q", "r", "b", "n"].forEach((type) => {
      const button = document.createElement("button");
      button.style.backgroundImage = `url(${
        this.pieceImages[this.game.turn()][type].src
      })`;
      button.addEventListener("click", () => {
        move.promotion = type;
        this.executeMove(move);
        dialog.remove();
      });
      dialog.appendChild(button);
    });

    document.body.appendChild(dialog);
  }

  updateGameState() {
    this.updateStatus();
    this.updateMoveHistory();
    this.updateTimers();
    this.renderBoard();
  }

  updateStatus() {
    const status = document.getElementById("status");
    let text = `${this.game.turn() === "w" ? "White" : "Black"}'s Turn`;

    if (this.game.in_checkmate()) {
      text = `Checkmate! ${this.game.turn() === "w" ? "Black" : "White"} Wins!`;
      this.playSound("gameEnd");
    } else if (this.game.in_draw()) {
      text = "Game Drawn!";
      this.playSound("gameEnd");
    } else if (this.game.in_check()) {
      text += " - Check!";
    }

    status.textContent = text;
  }

  updateMoveHistory() {
    const history = document.getElementById("move-history");
    history.innerHTML = this.game
      .history({ verbose: true })
      .map(
        (move, i) => `
          <div class="move-entry">
              <span>${Math.floor(i / 2) + 1}.</span>
              <span>${move.san}</span>
              <span>${move.color === "w" ? "⚪" : "⚫"}</span>
          </div>
      `
      )
      .join("");
    history.scrollTop = history.scrollHeight;
  }

  updateTimers() {
    document.getElementById("white-time").textContent = this.formatTime(
      this.timers.w
    );
    document.getElementById("black-time").textContent = this.formatTime(
      this.timers.b
    );
  }

  // Helper Methods
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  playSound(type) {
    if (this.sounds[type]) {
      this.sounds[type].currentTime = 0;
      this.sounds[type].play();
    }
  }

  needsPromotion(square) {
    const piece = this.game.get(square);
    return (
      piece &&
      piece.type === "p" &&
      ((piece.color === "w" && square[1] === "8") ||
        (piece.color === "b" && square[1] === "1"))
    );
  }

  // Game Controls
  undoMove() {
    if (this.game.undo()) {
      this.game.undo(); // Undo both players' moves
      this.updateGameState();
    }
  }

  flipBoard() {
    this.isFlipped = !this.isFlipped;
    document.getElementById("board").style.transform = this.isFlipped
      ? "rotate(180deg)"
      : "none";
    this.renderBoard();
  }

  resetGame() {
    this.game.reset();
    this.timers = { w: 0, b: 0 };
    this.selectedSquare = null;
    this.updateGameState();
    this.startTimers();
  }

  showHint() {
    const moves = this.game.moves({ verbose: true });
    if (moves.length) {
      const bestMove = moves.reduce(
        (best, current) => (current.san.includes("+") ? current : best),
        moves[0]
      );

      this.highlightMove(bestMove);
      this.hintTimeout = setTimeout(() => this.clearHighlights(), 2000);
    }
  }

  highlightMove(move) {
    this.clearHighlights();
    document
      .querySelector(`[data-square="${move.from}"]`)
      .classList.add("highlight");
    document
      .querySelector(`[data-square="${move.to}"]`)
      .classList.add(move.captured ? "legal-capture" : "legal-move");
  }

  clearHighlights() {
    document.querySelectorAll(".square").forEach((square) => {
      square.className = square.className
        .replace("highlight", "")
        .replace("legal-move", "")
        .replace("legal-capture", "")
        .replace("in-check", "");
    });
  }

  highlightCheck() {
    if (this.game.in_check()) {
      const kingSquare = this.game
        .board()
        .flat()
        .find((p) => p?.type === "k" && p.color === this.game.turn())?.square;
      if (kingSquare) {
        document
          .querySelector(`[data-square="${kingSquare}"]`)
          .classList.add("in-check");
      }
    }
  }

  startTimers() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.timers[this.game.turn()]++;
      this.updateTimers();
    }, 1000);
  }

  handleGameEnd() {
    clearInterval(this.timerInterval);
    this.playSound("gameEnd");
    setTimeout(() => {
      if (confirm("Game Over! Start new game?")) this.resetGame();
    }, 500);
  }
}

// Initialize the game
const game = new MyChess();
