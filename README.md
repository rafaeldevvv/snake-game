# Snake Game

It is an implementation of the classic snake game. Try to eat as much food as you can!

## Table of Contents

- [Overview](#overview)
  - [Screenshots](#screenshots)
  - [Links](#links)
- [My process](#my-process)
  - [Built with](#built-with)
  - [Thinking](#thinking)
  - [State](#state)
  - [Snake](#snake)
  - [Display](#display)
  - [Useful resources](#useful-resources)
- [Author](#author)
- [License](#license)

## Overview

### Screenshots

![]()

### Links

- [Repository](https://github.com/rafaeldevvv/snake-game)
- [Live site]()

### Links

## My Process

### Built with

- HTML
- JavaScript
- Canvas API

### Thinking

I wouldn't know how to tell you how the idea for this game came to mind, but it was really interesting and excited me a lot.

Well, I kind of stole the logic for this game from the [game project](https://eloquentjavascript.net/16_game.html) on the book called [Eloquent JavaScript](https://eloquentjavascript.net/) because that was the only time in life I had made a game. So that project helped a lot.

So I would have the classes representing the actors of the game(snake and food), the class for the state and the class to display the state.

I also used a lot of helper functions from that chapter - well, they are, in fact, very helpful.

### State

The state consists of the snake, the pieces of food over the map. the score(how many fruits have been eaten), the status(lost or playing) and the boundaries(limits of the map).

The object representing the state also has an `update()` method which is used to update the state. It takes the time step since the previous update and the keys currently held down.

The static `start()` method just gives you an initial state to begin the game.

```js
class State {
  constructor(snake, food, score, status, boundaries) {
    this.snake = snake;
    this.food = food;
    this.score = score;
    this.status = status;
    this.boundaries = boundaries;
  }

  static start(boundaries) {}

  update(time, keys) {
    // update snake
    const newSnake = this.snake.update(time, keys);

    // wall collision
    const snakeX = newSnake.head.position.x;
    const snakeY = newSnake.head.position.y;
    const limitX = this.boundaries.x;
    const limitY = this.boundaries.y;

    if (snakeX >= limitX || snakeY >= limitY || snakeX < 0 || snakeY < 0) {
      return new State(
        newSnake,
        this.food,
        this.score,
        "lost",
        this.boundaries
      );
    }

    // snake collision
    if (this.snake.tail.some((part) => overlap(part, newSnake.head))) {
      return new State(
        newSnake,
        this.food,
        this.score,
        "lost",
        this.boundaries
      );
    }

    // fruit collision
    let newState = this;
    for (const piece of this.food) {
      if (overlap(piece, newSnake)) {
        newState = piece.collide(newState);
      }
    }

    // return next state
    return newState;
  }
}
```

The `update()` method is also responsible for checking if the snake's head is in a valid position and if any piece of food has been collected.

The `collide()` method provided by the piece of food object updates the length of the snake.

### Classes

#### Snake

First implementation for the update function:

```js
update(time, keys) {
    // update direction based on keys
    let speed = this.speed;
    if (keys.ArrowDown && this.speed.y === 0) {
      speed = new Vec(0, snakeSpeed);
    }
    if (keys.ArrowUp && this.speed.y === 0) {
      speed = new Vec(0, -snakeSpeed);
    }
    if (keys.ArrowLeft && this.speed.x === 0) {
      speed = new Vec(-snakeSpeed, 0);
    }
    if (keys.ArrowRight && this.speed.x === 0) {
      speed = new Vec(snakeSpeed, 0);
    }

    // update head position based on direction
    let previousHeadPosition = this.lastHeadPosition;
    const newHeadPosition = this.head.position.plus(speed.times(time));

    if (
      Math.floor(newHeadPosition.x) !== Math.floor(this.head.position.x) ||
      Math.floor(newHeadPosition.y) !== Math.floor(this.head.position.y)
    ) {
      previousHeadPosition = this.head.position;
    }

    const newHead = {
      position: newHeadPosition,
    };

    // update the tail positions based on what the previous ones were
    const newTail = [{ position: previousHeadPosition }, ...this.tail];

    newTail.pop();

    // return new Snake
    return new Snake(newHead, newTail, speed, previousHeadPosition);
  }
```

The above code does not work properly because it makes the tail parts overlap each other, halting the growing of the snake.

The second implementation works as expected:

```js
class Snake {
  constructor(head, tail, tailLength, speed, previousPositions) {
    this.head = head;
    this.tail = tail; // the closer it is to the beginning of the array, the closer it is to the head
    this.speed = speed;
    this.previousPositions = previousPositions;
    this.tailLength = tailLength;
  }

  update(time, keys) {
    // update direction based on keys
    let speed = this.speed;
    if (keys.ArrowDown && this.speed.y === 0) {
      speed = new Vec(0, snakeSpeed);
    }
    if (keys.ArrowUp && this.speed.y === 0) {
      speed = new Vec(0, -snakeSpeed);
    }
    if (keys.ArrowLeft && this.speed.x === 0) {
      speed = new Vec(-snakeSpeed, 0);
    }
    if (keys.ArrowRight && this.speed.x === 0) {
      speed = new Vec(snakeSpeed, 0);
    }

    // update head position based on direction
    let previousPositions = this.previousPositions;
    const newHeadPosition = this.head.position.plus(speed.times(time));

    if (
      Math.floor(newHeadPosition.x) !== Math.floor(this.head.position.x) ||
      Math.floor(newHeadPosition.y) !== Math.floor(this.head.position.y)
    ) {
      previousPositions.unshift(this.head.position);
    }

    const newHead = {
      position: newHeadPosition,
    };

    previousPositions = previousPositions.filter((_, i) => i < this.tailLength);

    // update the tail positions based on what the previous ones were
    const newTail = this.previousPositions.map((p) => ({
      position: p,
    }));

    // return new Snake
    return new Snake(
      newHead,
      newTail,
      this.tailLength,
      speed,
      previousPositions
    );
  }

  grow() {
    const newTailLength = this.tailLength + 1;
    const newTail = this.previousPositions.map((p) => ({
      position: p,
    }));

    return new Snake(
      this.head,
      newTail,
      newTailLength,
      this.speed,
      this.previousPositions
    );
  }
}
```

I just introduced two new properties called tailLength and previousPositions. The class saves all the different positions that the head of the snake has been and gets the necessary previous positions based on the snake's length removing the unneeded ones.

#### Fruit

The `Fruit` class has a `collide()` method which is called when the snake's head overlaps the food. It returns a new state without the piece of food that was eaten and with the longer snake and it also adds one to the score:

```js
class Fruit {
  constructor(x, y, color) {
    this.position = { x, y };
    this.color = color;
  }

  collide(state) {
    const snake = state.snake;
    const longerSnake = snake.grow();
    eatingSoundEffect.currentTime = 0;
    eatingSoundEffect.play();

    return new State(
      longerSnake,
      state.food.filter((f) => f !== this),
      state.score + (this.score || 1),
      state.status,
      state.boundaries
    );
  }
}
```

### Display

I used the canvas api to render this game because I planned to give the snake a pixel-art style skin and I would also make the fruits in pixel-art style.

This class has a `syncState()` method that gets a given state and renders it.

```js
class CanvasDisplay {
  constructor(width, height) {
    this.dom = elt("canvas", {
      width: width * scale,
      height: height * scale,
    });

    this.width = width;
    this.height = height;
  }

  syncState(state) {
    // draw snake
    // draw food
    // show score
  }
}
```

The `runGame()` function actually runs the game by assembling all the high-level components and using a function to run the animation.

```js
function runGame() {
  let state = State.start({ x: 30, y: 20 });
  const display = new CanvasDisplay(30, 20);
  document.body.appendChild(display.dom);

  const arrowKeys = trackKeys([
    "ArrowDown",
    "ArrowUp",
    "ArrowLeft",
    "ArrowRight",
  ]);

  runAnimation((timeStep) => {
    state = state.update(timeStep, arrowKeys);

    if (state.status === "playing") {
      display.syncState(state);
      return true;
    } else {
      arrowKeys.unregister();
      return false;
    }
  });
}
```

I am quite proud of this function. I didn't know it was so simple. It simply required a `x + y` expression to work as I wanted. Well, I found this solution almost by accident. I knew there was something to do with addition so I was testing and it worked.

```js
function drawChessBackground(context, width, height, color1, color2) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      context.fillStyle = (x + y) % 2 === 0 ? color1 : color2;
      context.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}
```

### Useful Resources

- [chatGPT](https://chat.openai.com/) - I used it for almost every doubt
- [Eloquent JS](https://eloquentjavascript.net/) - Game Project Reference
- [Epidemic Sound](https://www.epidemicsound.com/) - I used it to get the sound effect.
- [Free SVG](https://freesvg.org/) - I got some fruit images from here.

## Author

- Twitter => [@rafaeldevvv](https://www.twitter.com/rafaeldevvv)
- Instagram => [@rafaeldevvv](https://www.instagram.com/rafaeldevvv)
- YouTube => [@rafaelmaia4836](https://www.youtube.com/channel/UC_QOvDZdUskTSJ59eMDjuEg)

## License

MIT License

Copyright (c) 2023 Rafael Maia

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.